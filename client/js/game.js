// File: client/js/game.js - With Action Menu & Turn Display

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- References to all UI elements ---
    const screens = {
        login: document.getElementById('login-screen'),
        lobby: document.getElementById('lobby-menu'),
        joinRoom: document.getElementById('join-room-screen'),
        createRoom: document.getElementById('create-room-screen'),
        waiting: document.getElementById('waiting-room-screen'),
        game: document.getElementById('game-screen'),
    };

    const ui = {
        // Opponent
        opponentName: document.getElementById('opponent-name'),
        opponentTurn: document.getElementById('opponent-turn'),
        opponentDeckZone: document.getElementById('opponent-deck-zone'),
        opponentGraveyardZone: document.getElementById('opponent-graveyard-zone'),
        opponentHand: document.getElementById('opponent-hand'),
        opponentLifeZone: document.getElementById('opponent-life-zone'),
        opponentAvatarZone: document.getElementById('opponent-avatar-zone'),
        opponentMagicZone: document.getElementById('opponent-magic-zone'),
        opponentConstructZone: document.getElementById('opponent-construct-zone'),

        // Player
        myName: document.getElementById('my-name'),
        myTurn: document.getElementById('my-turn'),
        myDeckZone: document.getElementById('my-deck-zone'),
        myGraveyardZone: document.getElementById('my-graveyard-zone'),
        myHand: document.getElementById('my-hand'),
        myLifeZone: document.getElementById('my-life-zone'),
        myAvatarZone: document.getElementById('my-avatar-zone'),
        myMagicZone: document.getElementById('my-magic-zone'),
        myConstructZone: document.getElementById('my-construct-zone'),

        // Shared
        landMagicZone: document.getElementById('land-zone'),
        turnStatus: document.getElementById('turn-status'),
        endTurnButton: document.getElementById('end-turn-button'),
        gameChatBox: document.getElementById('game-log'),
        actionPrompt: document.getElementById('action-prompt'),

        // Lobby & Waiting
        playerList: document.getElementById('player-list'),
        showJoinScreenButton: document.getElementById('show-join-screen-button'),
        showCreateScreenButton: document.getElementById('show-create-screen-button'),
        roomList: document.getElementById('room-list'),
        createRoomButton: document.getElementById('create-room-button'),
        readyButton: document.getElementById('ready-button'),
        waitingPlayerList: document.getElementById('waiting-player-list'),
        waitingRoomName: document.getElementById('waiting-room-name'),
    };

    let myPlayerId = null;
    let currentGameState = null;
    let selectedCardForAction = null;
    let paymentMode = false;
    let selectedCardsForPayment = [];

    // ===== ACTION MENU SYSTEM =====
    function showActionMenu(card, context) {
        selectedCardForAction = card;
        const isMyTurn = currentGameState && currentGameState.currentPlayerId === myPlayerId;

        // Create overlay and menu if not exists
        let overlay = document.getElementById('action-menu-overlay');
        let menu = document.getElementById('action-menu');

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'action-menu-overlay';
            document.body.appendChild(overlay);
            overlay.addEventListener('click', hideActionMenu);
        }

        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'action-menu';
            document.body.appendChild(menu);
        }

        // Build menu content
        let menuHTML = `
            <div class="action-menu-header">
                <div class="action-menu-title">${card.name}</div>
                <div class="action-menu-subtitle">${card.type}${card.subType ? ' - ' + card.subType : ''} | Cost: ${card.cost || 0} | Power: ${card.currentPower || card.power || '-'}</div>
            </div>
            <div class="action-menu-buttons">
        `;

        // Options based on context
        if (context === 'hand' && isMyTurn) {
            menuHTML += `<button class="action-menu-button primary" onclick="window.gameActions.playCard('${card.id}')">🎴 เล่นการ์ด (Cost: ${card.cost || 0})</button>`;
        }

        if (context.includes('avatar') && isMyTurn) {
            if (!card.isTapped) {
                menuHTML += `<button class="action-menu-button primary" onclick="window.gameActions.declareAttack('${card.id}')">⚔️ ประกาศโจมตี</button>`;
                menuHTML += `<button class="action-menu-button secondary" onclick="window.gameActions.useSamdaeng('${card.id}')">✨ ใช้สำแดง</button>`;
            }
        }

        if (context.includes('magic') && isMyTurn) {
            menuHTML += `<button class="action-menu-button secondary" onclick="window.gameActions.useFieldMagic('${card.id}')">✨ ใช้ความสามารถ</button>`;
        }

        // Always show card info
        menuHTML += `
                <button class="action-menu-button secondary" onclick="window.gameActions.showCardInfo('${card.id}')">ℹ️ ดูรายละเอียด</button>
                <button class="action-menu-button danger" onclick="window.gameActions.closeMenu()">✕ ปิด</button>
            </div>
        `;

        menu.innerHTML = menuHTML;
        overlay.classList.add('active');
        menu.classList.add('active');
    }

    function hideActionMenu() {
        const overlay = document.getElementById('action-menu-overlay');
        const menu = document.getElementById('action-menu');
        if (overlay) overlay.classList.remove('active');
        if (menu) menu.classList.remove('active');
        selectedCardForAction = null;
    }

    function startPaymentMode(costRequired) {
        paymentMode = true;
        selectedCardsForPayment = [];
        hideActionMenu();

        const paymentUI = document.createElement('div');
        paymentUI.id = 'payment-mode-ui';
        paymentUI.className = 'payment-info';
        paymentUI.innerHTML = `
            <div class="payment-info-text">
                💎 เลือกการ์ดจากมือเพื่อจ่าย Cost: <strong>${costRequired}</strong><br>
                <span id="payment-current">Gem รวม: 0</span>
            </div>
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 10px;">
                <button class="action-menu-button primary" id="confirm-payment-btn" disabled>✅ ยืนยัน</button>
                <button class="action-menu-button danger" id="cancel-payment-btn">✕ ยกเลิก</button>
            </div>
        `;

        if (ui.actionPrompt) {
            ui.actionPrompt.innerHTML = '';
            ui.actionPrompt.appendChild(paymentUI);
        }

        document.getElementById('confirm-payment-btn').addEventListener('click', () => {
            confirmPayment(costRequired);
        });

        document.getElementById('cancel-payment-btn').addEventListener('click', () => {
            cancelPayment();
        });

        updatePaymentUI(costRequired);
    }

    function updatePaymentUI(costRequired) {
        const totalGems = selectedCardsForPayment.reduce((sum, c) => sum + (c.gemValue || 0), 0);
        const currentSpan = document.getElementById('payment-current');
        const confirmBtn = document.getElementById('confirm-payment-btn');

        if (currentSpan) {
            currentSpan.innerHTML = `Gem รวม: <strong style="color: ${totalGems >= costRequired ? '#2ecc71' : '#e74c3c'}">${totalGems}</strong> / ${costRequired}`;
        }

        if (confirmBtn) {
            confirmBtn.disabled = totalGems < costRequired;
        }
    }

    function confirmPayment(costRequired) {
        const totalGems = selectedCardsForPayment.reduce((sum, c) => sum + (c.gemValue || 0), 0);

        if (totalGems < costRequired) {
            alert('💎 Gem ไม่เพียงพอ!');
            return;
        }

        // Send to server
        socket.emit('playCard', {
            cardToPlayId: selectedCardForAction.id,
            cardsToDiscardIds: selectedCardsForPayment.map(c => c.id)
        });

        cancelPayment();
    }

    function cancelPayment() {
        paymentMode = false;
        selectedCardsForPayment = [];
        selectedCardForAction = null;

        if (ui.actionPrompt) ui.actionPrompt.innerHTML = '';

        // Remove payment-selected class
        document.querySelectorAll('.payment-selected').forEach(el => {
            el.classList.remove('payment-selected');
        });
    }

    // ===== Global Actions =====
    window.gameActions = {
        playCard: (cardId) => {
            const me = currentGameState.players.find(p => p.id === myPlayerId);
            const card = me.hand.find(c => c.id === cardId);

            if (!card) return;

            if (card.cost === 0) {
                socket.emit('playCard', { cardToPlayId: cardId, cardsToDiscardIds: [] });
                hideActionMenu();
            } else {
                startPaymentMode(card.cost);
            }
        },

        declareAttack: (cardId) => {
            socket.emit('declareAttack', { attackerId: cardId, targetId: 'life' });
            hideActionMenu();
        },

        useSamdaeng: (cardId) => {
            socket.emit('activateAbility', { cardId: cardId, abilityType: 'samakkhi' });
            hideActionMenu();
        },

        useFieldMagic: (cardId) => {
            socket.emit('activateAbility', { cardId: cardId, abilityType: 'sangChai' });
            hideActionMenu();
        },

        showCardInfo: (cardId) => {
            if (selectedCardForAction) {
                showCardPreview(selectedCardForAction);
            }
        },

        closeMenu: () => {
            hideActionMenu();
        }
    };

    // ===== MODAL FUNCTIONS =====
    function showCardPreview(card) {
        const modal = document.getElementById('card-preview-modal');
        if (!modal) return;

        document.getElementById('preview-card-name').textContent = card.name;
        document.getElementById('preview-card-type').textContent = card.type + (card.subType ? ' - ' + card.subType : '');
        document.getElementById('preview-card-cost').textContent = card.cost || 0;
        document.getElementById('preview-card-gem').textContent = card.gemValue || 0;
        document.getElementById('preview-card-power').textContent = card.currentPower !== undefined ? card.currentPower : (card.power || '-');
        document.getElementById('preview-card-tribe').textContent = card.tribe || '-';
        document.getElementById('preview-card-description').textContent = card.description || 'ไม่มีคำอธิบาย';

        modal.classList.add('active');
    }

    function hideCardPreview() {
        const modal = document.getElementById('card-preview-modal');
        if (modal) modal.classList.remove('active');
    }

    function showTutorial() {
        const modal = document.getElementById('tutorial-modal');
        if (modal) modal.classList.add('active');
    }

    function hideTutorial() {
        const modal = document.getElementById('tutorial-modal');
        if (modal) modal.classList.remove('active');
    }

    // ===== SCREEN NAVIGATION =====
    function showScreen(screenName) {
        console.log('Switching to screen:', screenName);

        Object.values(screens).forEach(s => {
            if (s) s.style.display = 'none';
        });

        if (screens[screenName]) {
            if (screenName === 'game') {
                screens[screenName].style.display = 'grid';
            } else {
                screens[screenName].style.display = 'flex';
            }
        }
    }

    // ===== CARD RENDERING =====
    function createCardElement(card, context) {
        const el = document.createElement('div');
        el.className = 'card';
        if (card.isTapped) el.classList.add('tapped');

        el.className += ' ' + card.type;
        let icon = '❓';
        if (card.type === 'Avatar') icon = '⚔️';
        else if (card.type === 'Magic') icon = '✨';
        else if (card.type === 'Construct') icon = '🏗️';

        const displayPower = card.currentPower !== undefined ? card.currentPower : (card.power || 0);

        if (card.imageId) {
            el.style.backgroundImage = 'url("../images/cards/' + card.imageId + '.jpg")';
        }

        el.dataset.cardId = card.id;

        if (context.includes('hand') || context.includes('deck') || context.includes('grave')) {
            el.classList.add('card-back');
            el.innerHTML = '';
        } else {
            el.innerHTML = '<div class="card-title">' + card.name + '</div>' +
                '<div class="card-content"><span class="card-icon">' + icon + '</span></div>' +
                '<div class="card-meta">' +
                (card.subType ? (card.subType + ' / ') : '') +
                'C:' + (card.cost || 0) + ' G:' + (card.gemValue || 0) + '<br>' +
                (card.type === 'Avatar' || card.type === 'Construct' ? ('⚔️' + displayPower) : '') +
                '</div>';
        }

        // Click handler
        el.addEventListener('click', function(e) {
            e.stopPropagation();

            // Payment mode
            if (paymentMode && context === 'hand') {
                const idx = selectedCardsForPayment.findIndex(c => c.id === card.id);
                if (idx >= 0) {
                    selectedCardsForPayment.splice(idx, 1);
                    el.classList.remove('payment-selected');
                } else {
                    selectedCardsForPayment.push(card);
                    el.classList.add('payment-selected');
                }
                updatePaymentUI(selectedCardForAction ? selectedCardForAction.cost : 0);
                return;
            }

            const isMyTurn = currentGameState && currentGameState.currentPlayerId === myPlayerId;

            if (currentGameState && currentGameState.status === 'mulligan' && context === 'hand') {
                el.classList.toggle('selected');
                return;
            }

            if (isMyTurn) {
                showActionMenu(card, context);
            }
        });

        // Right click
        el.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            if (!context.includes('opp-hand')) {
                showCardPreview(card);
            }
        });

        return el;
    }

    function renderHand(container, hand) {
        if (!container) return;
        container.innerHTML = '';
        if (!Array.isArray(hand)) return;

        hand.forEach(function(card) {
            const cardEl = createCardElement(card, 'hand');
            container.appendChild(cardEl);
        });
    }

    function renderGameState(state) {
        console.log('Rendering game state:', state);
        currentGameState = state;

        const me = state.players.find(function(p) { return p.id === myPlayerId; });
        const opponent = state.players.find(function(p) { return p.id !== myPlayerId; });

        if (me) {
            renderPlayerInfo(me, true);
            renderHand(ui.myHand, me.hand);
            renderField(ui.myAvatarZone, me.field, 'my-avatar');
            renderField(ui.myConstructZone, me.constructZone, 'my-construct');
            renderField(ui.myMagicZone, me.magicZone, 'my-magic');
            renderLifeZone(ui.myLifeZone, me.lifeCards);
            renderDeckAndGrave(ui.myDeckZone, ui.myGraveyardZone, me);
        }

        if (opponent) {
            renderPlayerInfo(opponent, false);
            renderOpponentHand(ui.opponentHand, opponent.handCount);
            renderField(ui.opponentAvatarZone, opponent.field, 'opp-avatar');
            renderField(ui.opponentConstructZone, opponent.constructZone, 'opp-construct');
            renderField(ui.opponentMagicZone, opponent.magicZone, 'opp-magic');
            renderLifeZone(ui.opponentLifeZone, opponent.lifeCards);
            renderDeckAndGrave(ui.opponentDeckZone, ui.opponentGraveyardZone, opponent);
        }

        if (ui.landMagicZone) {
            ui.landMagicZone.innerHTML = '';
            if (state.landMagicZone) {
                ui.landMagicZone.appendChild(createCardElement(state.landMagicZone, 'land'));
            }
        }

        updateTurnStatus(state);
    }

    function updateTurnStatus(state) {
        if (ui.actionPrompt && !paymentMode) ui.actionPrompt.innerHTML = '';
        let statusText = '';
        const isMyTurn = state.currentPlayerId === myPlayerId;
        const myPlayerData = state.players.find(function(p) { return p.id === myPlayerId; });

        switch(state.status) {
            case 'rolling_dice':
                statusText = "🎲 ทอยเต๋าตัดสินคนเริ่ม!";
                if (ui.endTurnButton) ui.endTurnButton.disabled = true;

                const rollButton = document.createElement('button');
                rollButton.innerText = '🎲 ทอยเต๋า';

                if (myPlayerData && !state.diceRolls[myPlayerId]) {
                    rollButton.disabled = false;
                    rollButton.onclick = function() {
                        socket.emit('rollForFirstPlayer');
                        rollButton.innerText = 'รอผลทอยเต๋า...';
                        rollButton.disabled = true;
                        if (ui.turnStatus) ui.turnStatus.innerText = "⏳ รอผลทอยเต๋าจากอีกฝ่าย...";
                    };
                } else if (myPlayerData && state.diceRolls[myPlayerId]) {
                    rollButton.innerText = '✅ ทอยแล้ว (' + state.diceRolls[myPlayerId] + ')';
                    rollButton.disabled = true;
                    statusText = "⏳ รอดูผลทอยเต๋าของอีกฝ่าย...";
                } else {
                    rollButton.disabled = true;
                }

                if (ui.actionPrompt && !paymentMode) ui.actionPrompt.appendChild(rollButton);
                break;

            case 'mulligan':
                if (myPlayerData && !myPlayerData.hasConfirmedMulligan) {
                    statusText = "🔄 เลือกการ์ดที่ต้องการเปลี่ยน (คลิกเพื่อเลือก)";

                    const confirmButton = document.createElement('button');
                    confirmButton.innerText = '✅ ยืนยัน';
                    confirmButton.onclick = function() {
                        const selectedCards = document.querySelectorAll('#my-hand .card.selected');
                        const cardIdsToReplace = Array.from(selectedCards).map(function(el) { return el.dataset.cardId; });
                        socket.emit('confirmMulligan', { cardsToReplace: cardIdsToReplace });
                        confirmButton.disabled = true;
                        if (ui.turnStatus) ui.turnStatus.innerText = "⏳ รอยืนยันจากอีกฝ่าย...";
                    };
                    if (ui.actionPrompt && !paymentMode) ui.actionPrompt.appendChild(confirmButton);
                } else {
                    statusText = "⏳ รอยืนยันจากอีกฝ่าย...";
                }
                if (ui.endTurnButton) ui.endTurnButton.disabled = true;
                break;

            case 'playing':
                const currentPlayer = state.players.find(function(p) { return p.id === state.currentPlayerId; });
                if (currentPlayer) {
                    if (isMyTurn) {
                        statusText = "✨ ถึงตาคุณ!";
                        if (ui.endTurnButton) ui.endTurnButton.disabled = false;
                    } else {
                        statusText = '⏳ รอตาของ ' + currentPlayer.username + '...';
                        if (ui.endTurnButton) ui.endTurnButton.disabled = true;
                    }
                }
                break;

            default:
                statusText = state.status;
                if (ui.endTurnButton) ui.endTurnButton.disabled = true;
        }

        if (ui.turnStatus) ui.turnStatus.innerText = statusText;
    }

    function renderPlayerInfo(playerData, isMe) {
        const turnNumber = currentGameState ? currentGameState.turnNumber || 0 : 0;

        if (isMe) {
            if (ui.myName) ui.myName.innerText = playerData.username;
            if (ui.myTurn) ui.myTurn.innerText = turnNumber;
        } else {
            if (ui.opponentName) ui.opponentName.innerText = playerData.username;
            if (ui.opponentTurn) ui.opponentTurn.innerText = turnNumber;
        }
    }

    function renderOpponentHand(container, count) {
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const el = document.createElement('div');
            el.className = 'card card-back';
            container.appendChild(el);
        }
    }

    function renderLifeZone(container, lifeCards) {
        if (!container) return;
        container.innerHTML = '';
        if (!lifeCards || !Array.isArray(lifeCards)) return;

        lifeCards.forEach(function(lc) {
            const el = document.createElement('div');
            el.className = 'card life-card-slot';

            if (!lc.faceUp) {
                el.classList.add('card-back');
                el.innerText = 'LIFE ' + lc.index;
            } else {
                el.innerText = lc.card.name;
                if (lc.card.imageId) {
                    el.style.backgroundImage = 'url("../images/cards/' + lc.card.imageId + '.jpg")';
                }
            }

            container.appendChild(el);
        });
    }

    function renderField(container, field, context) {
        if (!container) return;
        container.innerHTML = '';
        if (!field || !Array.isArray(field)) return;

        field.forEach(function(card) {
            container.appendChild(createCardElement(card, context));
        });
    }

    function renderDeckAndGrave(deckContainer, graveContainer, playerData) {
        if (deckContainer) {
            deckContainer.innerHTML = 'Deck<br>(' + playerData.deckCount + ')';
        }
        if (graveContainer) {
            graveContainer.innerHTML = 'Grave<br>(' + playerData.graveyardCount + ')';
        }
    }

    // ===== SOCKET LISTENERS =====
    socket.on('connect', function() {
        myPlayerId = socket.id;
        console.log('✅ Connected:', myPlayerId);
        showScreen('login');
    });

    socket.on('gameStart', function() {
        console.log('🎮 Game Starting!');
        showScreen('game');
    });

    socket.on('gameUpdate', function(gameState) {
        console.log('📊 Game Update:', gameState);
        renderGameState(gameState);
    });

    socket.on('systemMessage', function(message) {
        console.log('[System]', message);
        const msgEl = document.createElement('p');
        msgEl.innerText = '[System] ' + message;
        msgEl.style.color = '#4CAF50';
        if (ui.gameChatBox) {
            ui.gameChatBox.appendChild(msgEl);
            ui.gameChatBox.scrollTop = ui.gameChatBox.scrollHeight;
        }
    });

    socket.on('gameOver', function(data) {
        alert('🏆 เกมจบแล้ว!\n\n' + data.winner + ' เป็นฝ่ายชนะ!\n\nเหตุผล: ' + data.reason);
        showScreen('lobby');
    });

    socket.on('roomJoined', function(data) {
        if (ui.waitingRoomName) ui.waitingRoomName.innerText = 'ห้อง: ' + data.roomName;
        showScreen('waiting');
    });

    socket.on('updateRooms', function(rooms) {
        if (!ui.roomList) return;
        ui.roomList.innerHTML = '';

        if (!rooms || rooms.length === 0) {
            ui.roomList.innerHTML = '<li style="padding: 10px; color: #999;">ไม่มีห้องว่าง</li>';
            return;
        }

        rooms.forEach(function(room) {
            const li = document.createElement('li');
            li.style.padding = '10px';
            li.style.marginBottom = '5px';
            li.style.background = 'rgba(255,255,255,0.05)';
            li.style.borderRadius = '5px';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';

            const isFull = room.players.length >= room.capacity;

            const roomInfo = document.createElement('span');
            roomInfo.innerText = room.name + ' (' + room.players.length + '/' + room.capacity + ')';

            const btn = document.createElement('button');
            btn.innerText = isFull ? '🔒 เต็ม' : '🚪 เข้าร่วม';
            btn.disabled = isFull;
            btn.dataset.roomId = room.id;
            btn.addEventListener('click', function() {
                socket.emit('joinRoom', room.id);
            });

            li.appendChild(roomInfo);
            li.appendChild(btn);
            ui.roomList.appendChild(li);
        });
    });

    socket.on('updateWaitingRoom', function(data) {
        if (!ui.waitingPlayerList) return;
        ui.waitingPlayerList.innerHTML = '';

        data.players.forEach(function(p) {
            const playerEl = document.createElement('p');
            playerEl.innerText = p.username + ' ' + (p.isReady ? '✅ พร้อม' : '⏳ รอ...');
            playerEl.style.padding = '5px';
            playerEl.style.marginBottom = '5px';
            playerEl.style.background = p.isReady ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255,255,255,0.05)';
            playerEl.style.borderRadius = '5px';
            ui.waitingPlayerList.appendChild(playerEl);
        });
    });

    socket.on('updatePlayers', function(players) {
        if (!ui.playerList) return;
        ui.playerList.innerHTML = '<h4>ผู้เล่นใน Lobby:</h4>';

        Object.values(players).forEach(function(p) {
            if (!p.roomId) {
                const playerEl = document.createElement('p');
                playerEl.innerText = '👤 ' + p.username;
                playerEl.style.padding = '5px';
                ui.playerList.appendChild(playerEl);
            }
        });
    });

    // ===== EVENT HANDLERS =====
    const joinButton = document.getElementById('join-button');
    if (joinButton) {
        joinButton.addEventListener('click', function() {
            const usernameInput = document.getElementById('username-input');
            const username = usernameInput ? usernameInput.value.trim() : '';

            if (!username) {
                alert('กรุณาใส่ชื่อผู้เล่น');
                return;
            }

            socket.emit('joinGame', username);
            showScreen('lobby');
        });
    }

    if (ui.endTurnButton) {
        ui.endTurnButton.addEventListener('click', function() {
            socket.emit('endTurn');
        });
    }

    if (ui.showJoinScreenButton) {
        ui.showJoinScreenButton.addEventListener('click', function() { showScreen('joinRoom'); });
    }

    if (ui.showCreateScreenButton) {
        ui.showCreateScreenButton.addEventListener('click', function() { showScreen('createRoom'); });
    }

    document.querySelectorAll('.back-button').forEach(function(btn) {
        btn.addEventListener('click', function() { showScreen('lobby'); });
    });

    if (ui.createRoomButton) {
        ui.createRoomButton.addEventListener('click', function() {
            const roomNameInput = document.getElementById('roomname-input');
            const roomName = roomNameInput ? roomNameInput.value.trim() : '';

            if (!roomName) {
                alert('กรุณาใส่ชื่อห้อง');
                return;
            }

            socket.emit('createRoom', roomName);
        });
    }

    if (ui.readyButton) {
        ui.readyButton.addEventListener('click', function() {
            const deckSelect = document.getElementById('deck-select');
            const selectedDeck = deckSelect ? deckSelect.value : 'starter_pasulol';
            socket.emit('playerReady', { selectedDeck });
            ui.readyButton.disabled = true;
            ui.readyButton.innerText = '✅ พร้อมแล้ว';
        });
    }

    // ===== MODAL EVENT HANDLERS =====
    const tutorialButton = document.getElementById('tutorial-button');
    if (tutorialButton) {
        tutorialButton.addEventListener('click', showTutorial);
    }

    const closePreview = document.getElementById('close-card-preview');
    if (closePreview) {
        closePreview.addEventListener('click', hideCardPreview);
    }

    const closeTutorial = document.getElementById('close-tutorial');
    if (closeTutorial) {
        closeTutorial.addEventListener('click', hideTutorial);
    }

    const previewModal = document.getElementById('card-preview-modal');
    if (previewModal) {
        previewModal.addEventListener('click', function(e) {
            if (e.target === previewModal) hideCardPreview();
        });
    }

    const tutorialModal = document.getElementById('tutorial-modal');
    if (tutorialModal) {
        tutorialModal.addEventListener('click', function(e) {
            if (e.target === tutorialModal) hideTutorial();
        });
    }

    // Close modals with ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideCardPreview();
            hideTutorial();
            hideActionMenu();
            if (paymentMode) cancelPayment();
        }
    });

    console.log('✅ Game.js loaded successfully');
});
