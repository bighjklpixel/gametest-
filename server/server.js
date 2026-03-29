const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Game, setSocketIoInstance } = require('./game.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
setSocketIoInstance(io);
const PORT = 3000;

app.use(express.static(path.join(__dirname, '..', 'client')));

const players = {};
const rooms = {};
const activeGames = {};

function broadcastRooms() { io.emit('updateRooms', Object.values(rooms)); }
function broadcastPlayers() { io.emit('updatePlayers', players); }

function broadcastGameState(game) {
    if (!game) return;
    game.players.forEach(p => {
        const state = game.getGameStateForPlayer(p);
        io.to(p.id).emit('gameUpdate', state);
    });
}

io.on('connection', (socket) => {
    socket.on('joinGame', (username) => {
        if (!username) return;
        players[socket.id] = { id: socket.id, username, roomId: null, isReady: false, selectedDeck: 'starter_pasulol' };
        broadcastPlayers();
        socket.emit('joined', { ok: true });
    });
    
    socket.on('createRoom', (roomName) => {
        const player = players[socket.id];
        if (!player || player.roomId) return;
        const roomId = 'room-' + Date.now();
        const room = { id: roomId, name: roomName, players: [player], capacity: 2, status: 'waiting' };
        rooms[roomId] = room;
        player.roomId = roomId;
        socket.join(roomId);
        broadcastRooms();
        socket.emit('roomJoined', { roomName, roomId });
        io.to(roomId).emit('updateWaitingRoom', { players: room.players });
    });
    
    socket.on('joinRoom', (roomId) => {
        const player = players[socket.id];
        const room = rooms[roomId];
        if (!player || !room || player.roomId || room.players.length >= room.capacity || room.status !== 'waiting') 
            return socket.emit('roomError', 'ไม่สามารถเข้าร่วมห้องได้');
        player.roomId = roomId;
        room.players.push(player);
        socket.join(roomId);
        broadcastRooms();
        socket.emit('roomJoined', { roomName: room.name, roomId });
        io.to(roomId).emit('updateWaitingRoom', { players: room.players });
    });

    socket.on('playerReady', ({ selectedDeck }) => {
        const player = players[socket.id];
        if (!player || !player.roomId) return;
        player.isReady = true;
        player.selectedDeck = selectedDeck || 'starter_pasulol';
        const room = rooms[player.roomId];
        io.to(room.id).emit('updateWaitingRoom', { players: room.players });

        const allReady = room.players.length === room.capacity && room.players.every(p => p.isReady);
        if (allReady) {
            room.status = 'playing';
            const game = new Game(room.id, room.players);
            activeGames[room.id] = game;
            game.initializeGame();
            io.to(room.id).emit('gameStart', { roomName: room.name });
            broadcastGameState(game);
            broadcastRooms();
        }
    });
    
    socket.on('rollForFirstPlayer', () => {
        const player = players[socket.id];
        const game = activeGames[player?.roomId];
        if (game && game.status === 'rolling_dice') {
            game.handleDiceRoll(player.id);
        }
    });
    
    socket.on('confirmMulligan', (data) => {
        const player = players[socket.id];
        const game = activeGames[player?.roomId];
        if (game && game.status === 'mulligan') {
            game.handleMulligan(player.id, data.cardsToReplace || []);
            socket.emit('mulliganConfirmed');
        }
    });

    socket.on('endTurn', () => {
        const player = players[socket.id];
        const game = activeGames[player?.roomId];
        if (game && game.getCurrentPlayer()?.id === socket.id) {
            game.endTurn();
        }
    });
    
    socket.on('playCard', (data) => {
        const player = players[socket.id];
        const game = activeGames[player?.roomId];
        if (!game || game.getCurrentPlayer()?.id !== socket.id) 
            return socket.emit('gameError', 'ยังไม่ถึงตาของคุณ!');
        const result = game.handlePlayCard(player.id, data);
        if (result.success) {
            result.events?.forEach(event => io.to(game.id).emit('systemMessage', event.message));
        } else {
            socket.emit('gameError', result.message);
        }
    });
    
    socket.on('declareAttack', (data) => {
        const player = players[socket.id];
        const game = activeGames[player?.roomId];
        if (!game || game.getCurrentPlayer()?.id !== socket.id) 
            return socket.emit('gameError', 'ยังไม่ถึงตาของคุณ!');
        const result = game.handleAttack(player.id, data);
        if (result.success) {
            result.events?.forEach(event => {
                if (event.type === 'systemMessage' || event.type === 'battleResult' || event.type === 'statusUpdate')
                    io.to(game.id).emit('systemMessage', event.message);
                else if (event.type === 'lifeFlipped')
                    io.to(game.id).emit('lifeFlipped', { playerId: event.playerId, flippedCardName: event.cardName });
                else if (event.type === 'gameOver') {
                    game.endGame(result.winner, result.reason);
                }
            });
        } else {
            socket.emit('gameError', result.message);
        }
    });
    
    socket.on('activateAbility', (data) => {
        const player = players[socket.id];
        const game = activeGames[player?.roomId];
        if (!game || game.getCurrentPlayer()?.id !== socket.id) 
            return socket.emit('gameError', 'ยังไม่ถึงตาของคุณ!');
        const result = game.handleActivateAbility(player.id, data);
        if (!result.success) {
            socket.emit('gameError', result.message);
        }
    });
    
    socket.on('playerReacts', (data) => {
        const player = players[socket.id];
        const game = activeGames[player?.roomId];
        if (!game) return;
        const result = game.handleReaction(player.id, data);
        if (result.success) {
            result.events?.forEach(event => io.to(game.id).emit('systemMessage', event.message));
        } else {
            socket.emit('gameError', result.message);
        }
    });

    socket.on('sendMessage', (message) => {
        const p = players[socket.id];
        if (!p || !p.roomId) return;
        io.to(p.roomId).emit('chatMessage', { username: p.username, message });
    });
    
    socket.on('disconnect', () => {
        const player = players[socket.id];
        if (!player) return;

        if (player.roomId) {
            const room = rooms[player.roomId];
            if (room) {
                room.players = room.players.filter(p => p.id !== socket.id);
                socket.leave(room.id);

                if (room.players.length === 0) {
                    delete rooms[room.id];
                    delete activeGames[room.id];
                } else if (room.status === 'playing') {
                    const game = activeGames[room.id];
                    if (game) {
                        const winner = game.getOpponent(player);
                        game.endGame(winner, `${player.username} ออกจากเกม`);
                        delete activeGames[room.id];
                        delete rooms[room.id];
                    }
                }
                io.to(room.id).emit('updateWaitingRoom', { players: room.players });
            }
        }
        delete players[socket.id];
        broadcastRooms();
        broadcastPlayers();
    });
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
