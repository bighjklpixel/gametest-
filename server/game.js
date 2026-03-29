const { makeCard, shuffleDeck } = require('./card-definitions');
const Player = require('./player');

let io;

class Game {
    constructor(roomId, playersData) {
        this.id = roomId;
        this.players = playersData.map(pData => new Player(pData));
        this.turnNumber = 0;
        this.currentPlayerIndex = -1;
        this.landMagicZone = null;
        this.status = 'rolling_dice';
        this.reactionWindow = null;
        this.diceRolls = {};
        this.pendingDecision = null;
        this.combatState = {};

        // เพิ่มสำหรับ Keywords ใหม่
        this.activatedAbilitiesThisTurn = new Set(); // สำหรับ เทิร์นละครั้ง
    }

    // --- PRE-GAME ---
    initializeGame() {
        this.players.forEach(p => {
            p.setupForGame();
            // BUG FIX: ต้องกำหนด isFirstPlayer ตั้งแต่ตอน setup
            p.isFirstPlayer = false;
        });
    }

    handleDiceRoll(playerId) {
        if (this.status !== 'rolling_dice' || this.diceRolls[playerId]) return;
        const roll = Math.floor(Math.random() * 6) + 1;
        this.diceRolls[playerId] = roll;
        io.to(this.id).emit('systemMessage', `${this.players.find(p=>p.id===playerId).username} ทอยได้ ${roll}`);
        if (Object.keys(this.diceRolls).length === this.players.length)
            this.determineFirstPlayer();
        this.broadcastGameState();
    }

    determineFirstPlayer() {
        const [p1, p2] = this.players;
        if (this.diceRolls[p1.id] > this.diceRolls[p2.id]) {
            this.currentPlayerIndex = 0;
            p1.isFirstPlayer = true; // BUG FIX: ต้อง set flag นี้
        } else if (this.diceRolls[p2.id] > this.diceRolls[p1.id]) {
            this.currentPlayerIndex = 1;
            p2.isFirstPlayer = true; // BUG FIX: ต้อง set flag นี้
        } else {
            this.diceRolls = {};
            this.status = 'rolling_dice';
            io.to(this.id).emit('systemMessage', 'ผลเสมอ! ทอยใหม่อีกครั้ง');
            return;
        }
        this.status = 'mulligan';
        io.to(this.id).emit('systemMessage', `${this.getCurrentPlayer().username} ชนะการทอยเต๋าและจะได้เริ่มก่อน!`);
    }

    handleMulligan(playerId, cardIdsToReplace) {
        const player = this.players.find(p => p.id === playerId);
        if (this.status !== 'mulligan' || !player || player.hasConfirmedMulligan) return;
        if (cardIdsToReplace.length > 0) {
            const cardsToPutBack = player.hand.filter(c => cardIdsToReplace.includes(c.id));
            player.hand = player.hand.filter(c => !cardIdsToReplace.includes(c.id));
            player.deck.push(...cardsToPutBack);
            shuffleDeck(player.deck);
            player.draw(cardIdsToReplace.length);
        }
        player.hasConfirmedMulligan = true;
        this.broadcastGameState();
        if (this.players.every(p => p.hasConfirmedMulligan))
            this.startGameTurns();
    }

    startGameTurns() {
        this.status = 'playing';
        this.startNextTurn();
    }

    // --- TURN MANAGEMENT ---
    startNextTurn() {
        this.turnNumber++;
        this.activatedAbilitiesThisTurn.clear(); // รีเซ็ต เทิร์นละครั้ง

        const currentPlayer = this.getCurrentPlayer();
        const opponent = this.getOpponent(currentPlayer);
        const drawSuccess = currentPlayer.prepareForTurn(this.turnNumber === 1);

        if (!drawSuccess) {
            this.endGame(opponent, `${currentPlayer.username} แพ้เพราะเด็คหมด!`);
            return;
        }

        // จัดการ Life Effects
        if (currentPlayer.flippedLifeEffects.length > 0) {
            const lifeEffectEvents = [];
            currentPlayer.flippedLifeEffects.forEach(effectInfo => {
                const result = this.applyEffect(currentPlayer, opponent, effectInfo.card, effectInfo.card.effect);
                lifeEffectEvents.push(...result.events);
            });
            io.to(currentPlayer.id).emit('resolveLifeEffects', {
                effects: currentPlayer.flippedLifeEffects,
                events: lifeEffectEvents
            });
            currentPlayer.flippedLifeEffects = [];
        }

        this.recalculatePowers();
        this.broadcastGameState();
    }

    endTurn() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.startNextTurn();
    }

    endGame(winner, reason) {
        this.status = 'finished';
        io.to(this.id).emit('gameOver', { winner: winner.username, reason });
    }

    // --- CORE LOGIC ---
    getCurrentPlayer() { return this.players[this.currentPlayerIndex]; }
    getOpponent(player) { return this.players.find(p => p.id !== player.id); }

    recalculatePowers() {
        for (const player of this.players) {
            for (const card of player.field) {
                if (card.type !== 'Avatar' && card.type !== 'Construct') continue;
                let newPower = card.power;

                // Land buff
                if (this.landMagicZone?.effect?.kind === 'globalBuff')
                    newPower += this.landMagicZone.effect.power || 0;

                // Mod attachments
                if (card.attachments?.length > 0)
                    newPower += card.attachments.reduce((sum, mod) => sum + (mod.effect?.power || 0), 0);

                // ต่อเนื่อง effects
                if (this.landMagicZone?.effect?.kind === 'continuous' &&
                    this.landMagicZone.effect.targetNames?.includes(card.name)) {
                    newPower += this.landMagicZone.effect.buff?.power || 0;
                }

                card.currentPower = newPower;
            }
        }
    }

    applyEffect(caster, targetPlayer, card, effect) {
        const events = [];
        if (!effect) return { events };

        // === จุติ effects ===
        if (effect.juti?.action === 'searchDeck') {
            const foundCard = caster.deck.find(c => c.name === effect.juti.cardName);
            if (foundCard) {
                caster.deck = caster.deck.filter(c => c.id !== foundCard.id);
                caster.hand.push(foundCard);
                shuffleDeck(caster.deck);
                events.push({type: 'systemMessage', message: `${caster.username} ใช้ จุติ ของ ${card.name} ค้นหา ${foundCard.name}!`});
            }
        }

        if (effect.juti?.action === 'graveyardToDeckAndDraw') {
            const targetNames = effect.juti.targetNames;
            const maxTargets = effect.juti.maxTargets || 3;
            let cardsToReturn = [];

            for (let name of targetNames) {
                const found = caster.graveyard.filter(c => c.name === name);
                if (found.length > 0) cardsToReturn.push(...found);
                if (cardsToReturn.length >= maxTargets) break;
            }

            cardsToReturn = cardsToReturn.slice(0, maxTargets);
            cardsToReturn.forEach(card => {
                caster.graveyard = caster.graveyard.filter(c => c.id !== card.id);
                caster.deck.push(card);
            });

            if (cardsToReturn.length > 0) {
                shuffleDeck(caster.deck);
                caster.draw(effect.juti.drawValue || 1);
                events.push({type: 'systemMessage', message: `${caster.username} นำการ์ดจากนรกกลับเข้า Deck และจั่วการ์ด!`});
            }
        }

        if (effect.juti?.action === 'graveyardToHand') {
            const targetNames = effect.juti.targetNames;
            const unique = effect.juti.unique;

            if (unique) {
                // นำการ์ดแต่ละชื่อขึ้นมา 1 ใบ
                for (let name of targetNames) {
                    const found = caster.graveyard.find(c => c.name === name);
                    if (found) {
                        caster.graveyard = caster.graveyard.filter(c => c.id !== found.id);
                        caster.hand.push(found);
                        events.push({type: 'systemMessage', message: `${caster.username} นำ ${found.name} กลับขึ้นมือจากนรก!`});
                    }
                }
            }
        }

        // === คำสั่งเสีย (On Destroy) - NEW ===
        if (effect.onDestroy) {
            // จะถูกเรียกจาก resolveCombat หรือ destroy effects
            if (effect.onDestroy.action === 'drawCard') {
                caster.draw(effect.onDestroy.value || 1);
                events.push({type: 'systemMessage', message: `คำสั่งเสีย: ${caster.username} จั่วการ์ด ${effect.onDestroy.value} ใบ!`});
            } else if (effect.onDestroy.action === 'damage') {
                const target = effect.onDestroy.target === 'opponent' ? targetPlayer : caster;
                // ทำความเสียหายเข้า Life โดยตรง
                this.dealDamageToLife(target, effect.onDestroy.value || 1);
                events.push({type: 'systemMessage', message: `คำสั่งเสีย: ทำความเสียหาย ${effect.onDestroy.value} เข้า Life!`});
            }
        }

        // === เซ่นไหว้ (Destroy Target) - NEW ===
        if (effect.senWai) {
            const targetType = effect.senWai.targetType || 'Avatar';
            const targetZone = effect.senWai.targetZone || 'field';
            const targetOwner = effect.senWai.targetOwner === 'opponent' ? targetPlayer : caster;

            let possibleTargets = [];
            if (targetZone === 'field') {
                possibleTargets = targetOwner.field.filter(c => c.type === targetType);
            }

            if (possibleTargets.length > 0 && effect.senWai.condition) {
                // ตรวจสอบเงื่อนไข (เช่น power <= X)
                possibleTargets = possibleTargets.filter(c => {
                    if (effect.senWai.condition.powerLessThanOrEqual) {
                        return c.currentPower <= effect.senWai.condition.powerLessThanOrEqual;
                    }
                    return true;
                });
            }

            if (possibleTargets.length > 0) {
                const target = possibleTargets[0]; // เลือกตัวแรก (หรือให้ผู้เล่นเลือก)
                targetOwner.field = targetOwner.field.filter(c => c.id !== target.id);
                targetOwner.graveyard.push(target);
                events.push({type: 'systemMessage', message: `เซ่นไหว้: ${target.name} ถูกทำลาย!`});

                // Trigger คำสั่งเสีย ถ้ามี
                if (target.effect?.onDestroy) {
                    const destroyResult = this.applyEffect(targetOwner, caster, target, {onDestroy: target.effect.onDestroy});
                    events.push(...destroyResult.events);
                }
            }
        }

        // === พอดี (Perfect Cost) - NEW ===
        if (effect.poDee && card.perfectCostPaid) {
            // ความสามารถพิเศษเมื่อจ่าย cost พอดี
            if (effect.poDee.action === 'drawCard') {
                caster.draw(effect.poDee.value || 1);
                events.push({type: 'systemMessage', message: `พอดี: ${caster.username} จั่วการ์ด ${effect.poDee.value} ใบ!`});
            } else if (effect.poDee.action === 'gainPower') {
                card.currentPower += effect.poDee.value || 1;
                events.push({type: 'systemMessage', message: `พอดี: ${card.name} ได้รับ Power +${effect.poDee.value}!`});
            } else if (effect.poDee.action === 'gainPowerAndDraw') {
                card.currentPower += effect.poDee.power || 0;
                caster.draw(effect.poDee.drawValue || 1);
                events.push({type: 'systemMessage', message: `พอดี: ${card.name} ได้รับ Power +${effect.poDee.power} และจั่วการ์ด ${effect.poDee.drawValue} ใบ!`});
            }
        }

        // === สอดแนม (Scry) - NEW ===
        if (effect.sodNam) {
            const count = effect.sodNam.count || 1;
            const targetDeck = effect.sodNam.target === 'opponent' ? targetPlayer : caster;

            // ในเกมจริงควรมี UI ให้เลือกเรียงการ์ด
            // ตัวอย่างนี้จะแค่แสดงการ์ดบนสุด
            const topCards = targetDeck.deck.slice(-count);
            events.push({
                type: 'scry',
                playerId: caster.id,
                cards: topCards,
                message: `${caster.username} สอดแนมการ์ด ${count} ใบบนสุดของ Deck!`
            });
        }

        // === ธีรสูป (Mill) - NEW ===
        if (effect.teeRaSup) {
            const count = effect.teeRaSup.count || 1;
            const targetDeck = effect.teeRaSup.target === 'opponent' ? targetPlayer : caster;

            for (let i = 0; i < count; i++) {
                if (targetDeck.deck.length > 0) {
                    const milledCard = targetDeck.deck.pop();
                    targetDeck.graveyard.push(milledCard);
                }
            }
            events.push({type: 'systemMessage', message: `ธีรสูป: ส่งการ์ด ${count} ใบจากบน Deck ลงนรก!`});
        }

        // === เลือกปฏิบัติ (Choose One) - NEW ===
        if (effect.luakPatibat) {
            // ควรมี UI ให้เลือก option
            // ตัวอย่างนี้จะเลือก option แรก
            const chosenOption = effect.luakPatibat.options[0];
            const optionResult = this.applyEffect(caster, targetPlayer, card, chosenOption);
            events.push(...optionResult.events);
        }

        // === Life Effect ===
        if (effect.lifeEffect?.action === 'drawCard') {
            caster.draw(effect.lifeEffect.value || 1);
            events.push({type: 'systemMessage', message: `เอฟเฟกต์ Life: ${caster.username} จั่วการ์ด ${effect.lifeEffect.value} ใบ!`});
        }

        // === Sacrifice Effects ===
        if (effect.kind === 'sacrificeAndDraw') {
            caster.draw(effect.drawValue);
            events.push({type: 'systemMessage', message: `${caster.username} สังเวยการ์ดเพื่อจั่ว ${effect.drawValue} ใบ!`});
        }

        if (effect.kind === 'sacrificeAndBounce') {
            // นำ Avatar กลับมือ
            if (targetPlayer.field.length > 0) {
                const target = targetPlayer.field[0]; // ควรให้เลือก
                targetPlayer.field = targetPlayer.field.filter(c => c.id !== target.id);
                targetPlayer.hand.push(target);
                events.push({type: 'systemMessage', message: `${target.name} ถูกส่งกลับมือ!`});
            }
        }

        if (effect.kind === 'sacrificeAndBoardWipe') {
            // ทำลาย Avatar ทั้งหมดของฝ่ายตรงข้าม
            const destroyed = targetPlayer.field.filter(c => c.type === 'Avatar');
            targetPlayer.graveyard.push(...destroyed);
            targetPlayer.field = targetPlayer.field.filter(c => c.type !== 'Avatar');
            events.push({type: 'systemMessage', message: `ทำลาย Avatar ทั้งหมดของฝ่ายตรงข้าม!`});

            // Trigger คำสั่งเสีย
            destroyed.forEach(d => {
                if (d.effect?.onDestroy) {
                    const destroyResult = this.applyEffect(targetPlayer, caster, d, {onDestroy: d.effect.onDestroy});
                    events.push(...destroyResult.events);
                }
            });
        }

        return { events };
    }

    dealDamageToLife(player, amount) {
        for (let i = 0; i < amount; i++) {
            if (player.status === 'OOO') {
                this.endGame(this.getOpponent(player), `${player.username} แพ้จากความเสียหายเข้า Life!`);
                return;
            }

            const lifeCard = player.lifeCards.find(lc => !lc.faceUp);
            if (lifeCard) {
                lifeCard.faceUp = true;
                player.flippedLifeEffects.push({ card: lifeCard.card });

                if (player.lifeCards.filter(lc => lc.faceUp).length >= 5) {
                    player.status = 'OOO';
                }
            }
        }
    }

    // --- PLAYER ACTIONS ---
    handlePlayCard(playerId, { cardToPlayId, cardsToDiscardIds = [], targetCardId, sacrificeCardIds = [] }) {
        const player = this.players.find(p => p.id === playerId);
        const opponent = this.getOpponent(player);
        const cardToPlay = player.hand.find(c => c.id === cardToPlayId);
        if (!cardToPlay) return { success: false, message: 'ไม่พบการ์ดที่ต้องการเล่น' };

        const events = [];
        let costPaid = false;
        let perfectCost = false; // สำหรับ พอดี

        if (cardToPlay.effect?.requiresSacrifice) {
            // จ่าย cost ด้วยการสังเวย
            const sacTargets = cardToPlay.effect.sacrificeTargets;
            const cardsToSacrifice = sacrificeCardIds.map(id =>
                player.hand.find(c => c.id === id) || player.field.find(c => c.id === id)
            ).filter(Boolean);

            const foundNames = new Set(cardsToSacrifice.map(c => c.name));
            let requirementMet = false;

            if (sacTargets.unique) {
                const namesToFind = new Set(sacTargets.names);
                requirementMet = namesToFind.size === foundNames.size &&
                    [...namesToFind].every(name => foundNames.has(name));
            } else {
                requirementMet = cardsToSacrifice.length > 0 &&
                    cardsToSacrifice.every(c => sacTargets.names.includes(c.name));
            }

            if (requirementMet) {
                cardsToSacrifice.forEach(sacCard => {
                    if (player.hand.some(c=>c.id === sacCard.id))
                        player.hand = player.hand.filter(c => c.id !== sacCard.id);
                    else
                        player.field = player.field.filter(c => c.id !== sacCard.id);
                    player.graveyard.push(sacCard);
                });
                costPaid = true;
                events.push({type: 'systemMessage', message: `${player.username} สังเวยการ์ดเพื่อใช้ ${cardToPlay.name}`});
            } else {
                return { success: false, message: 'ตัวสังเวยไม่ถูกต้อง' };
            }
        } else {
            // จ่าย cost ด้วย Gem Value
            const totalGemValue = cardsToDiscardIds.reduce((sum, id) => {
                const card = player.hand.find(c => c.id === id);
                return sum + (card?.gemValue || 0);
            }, 0);

            if (totalGemValue < cardToPlay.cost)
                return { success: false, message: 'Gem ไม่พอ' };

            // ตรวจสอบ พอดี
            if (totalGemValue === cardToPlay.cost) {
                perfectCost = true;
            }

            const cardsToDiscard = player.hand.filter(c => cardsToDiscardIds.includes(c.id));
            player.graveyard.push(...cardsToDiscard);
            player.hand = player.hand.filter(c => !cardsToDiscardIds.includes(c.id));
            costPaid = true;
        }

        if (!costPaid) return { success: false, message: 'จ่ายค่าร่ายไม่สำเร็จ' };

        player.hand = player.hand.filter(c => c.id !== cardToPlayId);
        const newCardInstance = makeCard(cardToPlay);
        newCardInstance.perfectCostPaid = perfectCost; // เก็บ flag สำหรับ พอดี

        if (newCardInstance.type === 'Avatar' || newCardInstance.type === 'Construct') {
            // ตรวจสอบ limit
            if (newCardInstance.type === 'Avatar' && player.field.filter(c => c.type === 'Avatar').length >= 4) {
                player.hand.push(newCardInstance);
                return { success: false, message: 'Avatar Zone เต็มแล้ว (สูงสุด 4 ใบ)' };
            }

            // แก้ไข: Construct Zone จำกัด 3 ใบ
            if (newCardInstance.type === 'Construct' && player.field.filter(c => c.type === 'Construct').length >= 3) {
                player.hand.push(newCardInstance);
                return { success: false, message: 'Construct Zone เต็มแล้ว (สูงสุด 3 ใบ)' };
            }

            player.field.push(newCardInstance);

            // Trigger จุติ และ พอดี
            if (newCardInstance.effect?.juti) {
                const result = this.applyEffect(player, opponent, newCardInstance, newCardInstance.effect);
                events.push(...result.events);
            }

            if (perfectCost && newCardInstance.effect?.poDee) {
                const result = this.applyEffect(player, opponent, newCardInstance, newCardInstance.effect);
                events.push(...result.events);
            }

        } else if (newCardInstance.type === 'Magic') {
            if (newCardInstance.subType === 'Normal') {
                if (player.magicPlayedThisTurn.normal)
                    return { success: false, message: 'คุณใช้ Normal Magic ไปแล้ว' };

                player.magicPlayedThisTurn.normal = true;

                // ตรวจสอบ เทิร์นละครั้ง
                if (newCardInstance.effect?.oncePerTurn) {
                    const abilityKey = `${newCardInstance.name}-${player.id}`;
                    if (this.activatedAbilitiesThisTurn.has(abilityKey)) {
                        return { success: false, message: 'ใช้ความสามารถนี้ไปแล้วในเทิร์นนี้' };
                    }
                    this.activatedAbilitiesThisTurn.add(abilityKey);
                }

                if (newCardInstance.effect?.requiresSacrifice) {
                    const result = this.applyEffect(player, opponent, newCardInstance, newCardInstance.effect);
                    events.push(...result.events);
                    player.graveyard.push(newCardInstance);
                } else {
                    this.reactionWindow = { card: newCardInstance, caster: player, opponent: opponent };
                    io.to(opponent.id).emit('promptReaction', {
                        actionType: 'Normal Magic',
                        cardName: newCardInstance.name,
                        timeout: 15000
                    });
                    events.push({ type: 'systemMessage', message: `${player.username} กำลังใช้ ${newCardInstance.name}, รอการตอบสนอง...` });
                }
            } else if (newCardInstance.subType === 'Mod') {
                if (player.magicPlayedThisTurn.mod)
                    return { success: false, message: 'คุณใช้ Mod Magic ไปแล้ว' };

                const targetAvatar = player.field.find(c => c.id === targetCardId && c.type === 'Avatar');
                if (!targetAvatar) return { success: false, message: 'เป้าหมายไม่ถูกต้อง' };

                if (newCardInstance.effect?.grantAbility)
                    targetAvatar.abilities.push(newCardInstance.effect.grantAbility);

                targetAvatar.attachments.push(newCardInstance);
                player.magicPlayedThisTurn.mod = true;

            } else if (newCardInstance.subType === 'Land') {
                if (player.magicPlayedThisTurn.land)
                    return { success: false, message: 'คุณใช้ Land Magic ไปแล้ว' };

                if (this.landMagicZone) {
                    const oldCard = this.landMagicZone;
                    this.players.forEach(p => {
                        const cardIdx = p.magicZone.findIndex(c => c.id === oldCard.id);
                        if (cardIdx > -1) {
                            p.magicZone.splice(cardIdx, 1);
                            p.graveyard.push(oldCard);
                        }
                    });
                }

                this.landMagicZone = newCardInstance;
                player.magicZone.push(newCardInstance);
                player.magicPlayedThisTurn.land = true;
            }
        }

        this.recalculatePowers();
        this.broadcastGameState();
        return { success: true, message: 'เล่นการ์ดสำเร็จ', events };
    }

    handleAttack(playerId, { attackerId, targetId }) {
        const player = this.players.find(p => p.id === playerId);
        const opponent = this.getOpponent(player);
        const attacker = player.field.find(c => c.id === attackerId);

        if (this.turnNumber === 1 && this.currentPlayerIndex === 0)
            return { success: false, message: 'เทิร์นแรกโจมตีไม่ได้' };

        if (attacker?.type === 'Construct')
            return { success: false, message: 'Construct โจมตีไม่ได้' };

        if (!attacker || attacker.isTapped)
            return { success: false, message: 'ไม่สามารถโจมตีได้' };

        let tempAttackerPower = attacker.currentPower;
        const landEffect = this.landMagicZone?.effect;

        // Land buff on attack
        if(landEffect?.kind === 'onAttackDeclarationBuff' &&
           landEffect.targetNames.includes(attacker.name)){
            tempAttackerPower += landEffect.buff.power;
            io.to(this.id).emit('systemMessage',
                `${attacker.name} ได้รับ Power +${landEffect.buff.power} จาก ${this.landMagicZone.name}!`);
        }

        const events = [];
        const hasTeKai = attacker.abilities.includes('เตะไข่');

        if (targetId === 'life') {
            if (!hasTeKai) {
                const hasAvatarDefender = opponent.field.some(card => card.type === 'Avatar');
                if (hasAvatarDefender)
                    return { success: false, message: 'โจมตี Life ไม่ได้ (มี Avatar ป้องกัน)' };
            }

            attacker.isTapped = true;

            if (opponent.status === 'OOO') {
                this.endGame(player, `${opponent.username} แพ้จากการโจมตีซ้ำ!`);
                return { success: true, events };
            }

            const lifeCard = opponent.lifeCards.find(lc => !lc.faceUp);
            if (lifeCard) {
                lifeCard.faceUp = true;
                opponent.flippedLifeEffects.push({ card: lifeCard.card });
                events.push({ type: 'lifeFlipped', playerId: opponent.id, cardName: lifeCard.card.name });

                if (opponent.lifeCards.filter(lc => lc.faceUp).length >= 5) {
                    opponent.status = 'OOO';
                    events.push({ type: 'statusUpdate', playerId: opponent.id, status: 'OOO' });
                }
            }
        } else {
            const target = opponent.field.find(c => c.id === targetId);

            const hasAvatarDefender = opponent.field.some(card => card.type === 'Avatar');
            if (target?.type === 'Construct' && hasAvatarDefender) {
                 return { success: false, message: 'ไม่สามารถเลือก Construct เป็นเป้าหมายได้เมื่อมี Avatar ป้องกัน' };
            }

            if (!target) return { success: false, message: 'ไม่พบเป้าหมาย' };

            this.combatState = {
                attacker,
                target,
                tempAttackerPower,
                isResolved: false,
                events: [],
                // เพิ่มสำหรับ โล่มนุษย์
                originalTarget: target,
                redirected: false
            };

            this.status = 'combat_reaction';
            io.to(this.id).emit('systemMessage',
                `${attacker.name} ประกาศโจมตี ${target.name}! เปิดโอกาสให้ใช้ 'สำแดง' หรือ 'โล่มนุษย์'`);

            // เปิดโอกาสให้ใช้ความสามารถตอบโต้
            setTimeout(() => this.resolveCombat(), 5000);
        }

        this.recalculatePowers();
        this.broadcastGameState();
        return { success: true, message: 'ประกาศโจมตี', events: this.combatState.events };
    }

    resolveCombat() {
        if (!this.combatState || this.combatState.isResolved) return;

        const { attacker, target } = this.combatState;
        let { tempAttackerPower } = this.combatState;
        const player = this.players.find(p => p.field.some(c => c.id === attacker.id));
        const opponent = this.getOpponent(player);

        attacker.isTapped = true;

        // คำนวณ ลูกอึด
        const attackerHasLukUed = attacker.abilities?.includes('ลูกอึด');
        const targetHasLukUed = target.abilities?.includes('ลูกอึด');

        let attackerDestroyed = false, targetDestroyed = false;

        if (tempAttackerPower > target.currentPower) {
            targetDestroyed = true;
        } else if (tempAttackerPower < target.currentPower) {
            attackerDestroyed = true;
        } else {
            // Power เท่ากัน - ตรวจสอบ ลูกอึด
            if (attackerHasLukUed && !targetHasLukUed) {
                targetDestroyed = true; // attacker ชนะ
            } else if (!attackerHasLukUed && targetHasLukUed) {
                attackerDestroyed = true; // target ชนะ
            } else {
                // ทั้งคู่มีหรือไม่มี ลูกอึด
                attackerDestroyed = true;
                targetDestroyed = true;
            }
        }

        // ตรวจสอบ แทงหลัง
        if (this.combatState.backstabInfo) {
            const { helper, attacker: backstabAttacker, differentTribe } = this.combatState.backstabInfo;
            if (!targetDestroyed && differentTribe) {
                // ถ้าไม่ชนะและ tribe ต่างกัน ทำลายตัวที่โจมตี
                attackerDestroyed = true;
                io.to(this.id).emit('systemMessage',
                    `${backstabAttacker.name} ถูกทำลายจากการแทงหลังของ ${helper.name} (Tribe ต่างกัน)!`);
            }
        }

        // จัดการการทำลาย และ trigger คำสั่งเสีย
        if (attackerDestroyed) {
            player.field = player.field.filter(c => c.id !== attacker.id);
            player.graveyard.push(attacker);
            if (attacker.attachments) player.graveyard.push(...attacker.attachments);

            // Trigger คำสั่งเสีย
            if (attacker.effect?.onDestroy) {
                const result = this.applyEffect(player, opponent, attacker, {onDestroy: attacker.effect.onDestroy});
                io.to(this.id).emit('systemMessage', `${attacker.name} ถูกทำลาย!`);
            }
        }

        if (targetDestroyed) {
            opponent.field = opponent.field.filter(c => c.id !== target.id);
            opponent.graveyard.push(target);
            if (target.attachments) opponent.graveyard.push(...target.attachments);

            // Trigger คำสั่งเสีย
            if (target.effect?.onDestroy) {
                const result = this.applyEffect(opponent, player, target, {onDestroy: target.effect.onDestroy});
                io.to(this.id).emit('systemMessage', `${target.name} ถูกทำลาย!`);
            }
        }

        this.combatState.isResolved = true;
        this.status = 'playing';
        this.recalculatePowers();
        io.to(this.id).emit('systemMessage', 'การต่อสู้สิ้นสุด!');
        this.broadcastGameState();
    }

    handleActivateAbility(playerId, { cardId, targetId, abilityType }) {
        const player = this.players.find(p => p.id === playerId);
        const card = player.field.find(c => c.id === cardId);

        if(!card || card.isTapped)
            return { success: false, message: 'ไม่สามารถใช้ความสามารถได้' };

        // === สำแดง (Samakkhi) ===
        if (card.effect?.samakkhi && abilityType === 'samakkhi') {
            if (this.status === 'combat_reaction' && this.combatState) {
                const { attacker, target } = this.combatState;
                const isCurrentPlayer = player.id === this.players[this.currentPlayerIndex].id;

                if (isCurrentPlayer && (attacker.id === targetId || attacker.id === card.id)) {
                    this.combatState.tempAttackerPower += card.effect.samakkhi.power;
                    card.isTapped = true;
                    io.to(this.id).emit('systemMessage',
                        `${player.username} ใช้ สามัคคี ของ ${card.name} บัฟ ${attacker.name}! Power โจมตีเป็น ${this.combatState.tempAttackerPower}`);
                } else if (!isCurrentPlayer && target.id === targetId) {
                    target.currentPower += card.effect.samakkhi.power;
                    card.isTapped = true;
                    io.to(this.id).emit('systemMessage',
                        `${player.username} ใช้ สามัคคี ของ ${card.name} บัฟ ${target.name}! Power ป้องกันเป็น ${target.currentPower}`);
                } else {
                    return { success: false, message: "เป้าหมายของสามัคคีไม่ถูกต้อง" };
                }
            }
        }

        // === สำแดง (Samdaeng - ชื่อเดิม) ===
        if (card.effect?.samdaeng && abilityType === 'samdaeng') {
            if (this.status === 'combat_reaction' && this.combatState && card.effect.samdaeng.action === 'buffAttacker') {
                const { attacker, target } = this.combatState;
                const isCurrentPlayer = player.id === this.players[this.currentPlayerIndex].id;

                if (isCurrentPlayer && (attacker.id === targetId || attacker.id === card.id)) {
                    this.combatState.tempAttackerPower += card.effect.samdaeng.power;
                    card.isTapped = true;
                    io.to(this.id).emit('systemMessage',
                        `${player.username} ใช้ สำแดง ของ ${card.name} บัฟ ${attacker.name}! Power โจมตีเป็น ${this.combatState.tempAttackerPower}`);
                } else if (!isCurrentPlayer && target.id === targetId) {
                    target.currentPower += card.effect.samdaeng.power;
                    card.isTapped = true;
                    io.to(this.id).emit('systemMessage',
                        `${player.username} ใช้ สำแดง ของ ${card.name} บัฟ ${target.name}! Power ป้องกันเป็น ${target.currentPower}`);
                } else {
                    return { success: false, message: "เป้าหมายของสำแดงไม่ถูกต้อง" };
                }
            }
        }

        // === โล่มนุษย์ (Human Shield) - NEW ===
        if (card.effect?.loManut && abilityType === 'loManut') {
            if (this.status === 'combat_reaction' && this.combatState && !this.combatState.redirected) {
                const opponent = this.getOpponent(player);
                const isDefender = opponent.field.some(c => c.id === this.combatState.target.id);

                if (isDefender && card.id !== this.combatState.target.id) {
                    // เปลี่ยนเป้าหมายมาที่ตัวนี้แทน
                    this.combatState.target = card;
                    this.combatState.redirected = true;
                    card.isTapped = true;
                    io.to(this.id).emit('systemMessage',
                        `${player.username} ใช้ โล่มนุษย์! ${card.name} รับการโจมตีแทน!`);
                } else {
                    return { success: false, message: "ไม่สามารถใช้โล่มนุษย์ได้" };
                }
            }
        }

        // === แทงหลัง (Backstab) - NEW ===
        if (card.effect?.tangLang && abilityType === 'tangLang') {
            if (this.status === 'combat_reaction' && this.combatState) {
                const { attacker } = this.combatState;
                const isCurrentPlayer = player.id === this.players[this.currentPlayerIndex].id;

                if (isCurrentPlayer && attacker.id === targetId) {
                    this.combatState.tempAttackerPower += card.effect.tangLang.power + 1;
                    card.isTapped = true;

                    // เก็บข้อมูลสำหรับทำลายหลังการต่อสู้ถ้าสีต่างกัน
                    this.combatState.backstabInfo = {
                        helper: card,
                        attacker: attacker,
                        differentTribe: card.tribe !== attacker.tribe
                    };

                    io.to(this.id).emit('systemMessage',
                        `${player.username} ใช้ แทงหลัง! ${card.name} ช่วย ${attacker.name}! Power +${card.effect.tangLang.power + 1}`);
                } else {
                    return { success: false, message: "ไม่สามารถใช้แทงหลังได้" };
                }
            }
        }

        // === สั่งใช้ (Activated Ability) - NEW ===
        if (card.effect?.sangChai && abilityType === 'sangChai') {
            // ตรวจสอบเทิร์นละครั้ง
            if (card.effect.sangChai.oncePerTurn) {
                const abilityKey = `${card.id}-sangChai`;
                if (this.activatedAbilitiesThisTurn.has(abilityKey)) {
                    return { success: false, message: 'ใช้ความสามารถนี้ไปแล้วในเทิร์นนี้' };
                }
                this.activatedAbilitiesThisTurn.add(abilityKey);
            }

            // ดำเนินการตาม effect
            const opponent = this.getOpponent(player);
            const result = this.applyEffect(player, opponent, card, {sangChai: card.effect.sangChai});
            card.isTapped = true;
            io.to(this.id).emit('systemMessage', `${player.username} ใช้ สั่งใช้ ของ ${card.name}!`);
        }

        this.broadcastGameState();
        return { success: true };
    }

    handleReaction(reactingPlayerId, reactionData) {
        if (!this.reactionWindow || reactingPlayerId !== this.reactionWindow.opponent.id)
            return { success: false, message: "ไม่มีอะไรให้ตอบสนอง" };

        const { card, caster, opponent } = this.reactionWindow;
        const events = [];
        let actionWasCancelled = false;

        if (reactionData.cardId) {
            const reactingCard = opponent.hand.find(c => c.id === reactionData.cardId);
            if (reactingCard?.subType === 'React') {
                actionWasCancelled = true;
                opponent.hand = opponent.hand.filter(c => c.id !== reactingCard.id);
                opponent.graveyard.push(reactingCard);
                caster.graveyard.push(card);
                events.push({ type: 'systemMessage',
                    message: `${opponent.username} ใช้ ${reactingCard.name} ยกเลิก ${card.name}!` });
            }
        }

        if (!actionWasCancelled) {
            const result = this.applyEffect(caster, opponent, card, card.effect);
            events.push(...result.events);
            caster.graveyard.push(card);
        }

        this.reactionWindow = null;
        this.recalculatePowers();
        this.broadcastGameState();
        return { success: true, message: "ตอบสนองสำเร็จ", events };
    }

    // --- Game State Functions ---
    broadcastGameState() {
        this.players.forEach(p => {
            const state = this.getGameStateForPlayer(p);
            io.to(p.id).emit('gameUpdate', state);
        });
    }

    getGameStateForEveryone() {
        return {
            id: this.id,
            status: this.status,
            diceRolls: this.diceRolls,
            currentPlayerId: this.currentPlayerIndex > -1 ? this.getCurrentPlayer().id : null,
            turnNumber: this.turnNumber,
            landMagicZone: this.landMagicZone,
            players: this.players.map(p => {
                const avatarCards = p.field.filter(c => c.type === 'Avatar');
                const constructCards = p.field.filter(c => c.type === 'Construct');
                const otherMagicCards = p.magicZone.filter(c => c.subType !== 'Land');

                return {
                    id: p.id,
                    username: p.username,
                    deckCount: p.deck.length,
                    handCount: p.hand.length,
                    graveyardCount: p.graveyard.length,
                    field: avatarCards,
                    constructZone: constructCards,
                    magicZone: otherMagicCards,
                    lifeCards: p.lifeCards,
                    gems: p.gems,
                    maxGems: p.maxGems,
                    status: p.status,
                    hasConfirmedMulligan: p.hasConfirmedMulligan
                };
            }),
        };
    }

    getGameStateForPlayer(player) {
        const state = this.getGameStateForEveryone();

        const me = state.players.find(p => p.id === player.id);
        const opponent = state.players.find(p => p.id !== player.id);

        // ข้อมูลส่วนตัวสำหรับผู้เล่นคนนี้
        me.hand = player.hand;

        // ลบข้อมูลมือจริงของคู่ต่อสู้ทิ้ง
        delete opponent.hand;

        return state;
    }
}

const setSocketIoInstance = (ioInstance) => { io = ioInstance; };
module.exports = { Game, setSocketIoInstance };
