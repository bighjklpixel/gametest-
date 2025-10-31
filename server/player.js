const { createMasterDeck, createLifeDeck } = require('./card-definitions');

class Player {
    constructor(playerData) {
        this.id = playerData.id;
        this.username = playerData.username;
        this.selectedDeck = playerData.selectedDeck || 'starter_pasulol';

        this.deck = [];
        this.hand = [];
        this.field = [];
        this.magicZone = [];
        this.graveyard = [];
        this.lifeCards = [];
        this.flippedLifeEffects = [];

        this.maxGems = 0;
        this.gems = 0;
        this.status = 'alive';
        this.hasConfirmedMulligan = false;
        this.magicPlayedThisTurn = {};
        this.isFirstPlayer = false;
        this.hasUsedFirstPlayerDraw = false;
    }

    setupForGame() {
        this.deck = createMasterDeck(this.selectedDeck);
        const lifeDeckCards = createLifeDeck();
        this.lifeCards = lifeDeckCards.map((card, i) => ({
            card: card,
            faceUp: false,
            index: 5 - i
        }));

        // 🔧 BUG FIX: Reset flag เพื่อป้องกันปัญหาเมื่อเล่นเกมใหม่
        this.hasUsedFirstPlayerDraw = false;
        this.isFirstPlayer = false;

        this.draw(5);
    }

    prepareForTurn(isFirstTurnOfGame) {
        this.field.forEach(c => { c.isTapped = false; });
        this.maxGems = Math.min(this.maxGems + 1, 10);
        this.gems = this.maxGems;
        this.magicPlayedThisTurn = { normal: false, mod: false, land: false };

        // ถ้าเป็นเทิร์นแรกและเป็นผู้เล่นคนแรก → จั่ว 2 ใบ
        if (isFirstTurnOfGame && this.isFirstPlayer && !this.hasUsedFirstPlayerDraw) {
            this.hasUsedFirstPlayerDraw = true;
            return this.draw(2);
        }

        // เทิร์นถัดไป: จั่วตามปกติ
        const currentHandSize = this.hand.length;
        let amountToDraw = 1;
        if (currentHandSize < 3) {
            amountToDraw = 3 - currentHandSize;
        } else if (currentHandSize === 3) {
            amountToDraw = 1;
        }
        return this.draw(amountToDraw);
    }

    draw(count = 1) {
        for (let i = 0; i < count; i++) {
            if (this.deck.length === 0) {
                this.status = 'lost_deckout';
                return false;
            }
            this.hand.push(this.deck.pop());
        }
        return true;
    }
}

module.exports = Player;
