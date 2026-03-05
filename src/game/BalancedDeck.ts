import { Card } from './Card.js';
import { COLORS, ZERO, ONE, TWO, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE, DRAW_TWO, SKIP, REVERSE, CHOOSE, DRAW_FOUR, SPECIALS, BONUS_SPECIALS, WILD_VALUES, FIRE, ICE, LIGHTNING, SHIELD } from './constants.js';

export class DeckEmptyError extends Error {
    constructor() {
        super('Deste boş');
        this.name = 'DeckEmptyError';
    }
}

// Kart dağılımı istatistikleri
interface DeckStats {
    normalCards: number;
    specialCards: number;
    bonusCards: number;
    wildCards: number;
    totalCards: number;
}

// Adil kart dağılımı için yapılandırma
interface BalancedDeckConfig {
    maxSpecialRatio: number;      // Özel kart maksimum oranı (0.3 = %30)
    maxBonusRatio: number;        // Bonus kart maksimum oranı (0.1 = %10)
    maxWildRatio: number;         // Wild kart maksimum oranı (0.15 = %15)
    ensureBalance: boolean;       // Her oyuncuya dengeli kart dağıt
    playerCount: number;          // Oyuncu sayısı
}

export class BalancedDeck {
    cards: Card[] = [];
    graveyard: Card[] = [];
    private config: BalancedDeckConfig;

    constructor(config: Partial<BalancedDeckConfig> = {}) {
        this.config = {
            maxSpecialRatio: 0.30,  // %30 özel kart
            maxBonusRatio: 0.10,    // %10 bonus kart  
            maxWildRatio: 0.15,     // %15 wild kart
            ensureBalance: true,
            playerCount: 4,
            ...config
        };
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    draw(): Card {
        if (this.cards.length === 0) {
            if (this.graveyard.length > 0) {
                this.cards = [...this.graveyard];
                this.graveyard = [];
                this.shuffle();
                return this.draw();
            } else {
                throw new DeckEmptyError();
            }
        }
        return this.cards.pop()!;
    }

    dismiss(card: Card) {
        this.graveyard.push(card);
    }

    // Destenin mevcut istatistiklerini al
    getStats(): DeckStats {
        const stats: DeckStats = {
            normalCards: 0,
            specialCards: 0,
            bonusCards: 0,
            wildCards: 0,
            totalCards: this.cards.length
        };

        for (const card of this.cards) {
            if (card.special) {
                if ((BONUS_SPECIALS as readonly string[]).includes(card.special)) {
                    stats.bonusCards++;
                } else {
                    stats.specialCards++;
                }
            } else if (card.value !== null) {
                stats.normalCards++;
            } else {
                stats.wildCards++;
            }
        }

        return stats;
    }

    // Destenin dengeli olup olmadığını kontrol et
    isBalanced(): boolean {
        const stats = this.getStats();
        const total = stats.totalCards;

        if (total === 0) return true;

        const specialRatio = stats.specialCards / total;
        const bonusRatio = stats.bonusCards / total;
        const wildRatio = stats.wildCards / total;

        return (
            specialRatio <= this.config.maxSpecialRatio &&
            bonusRatio <= this.config.maxBonusRatio &&
            wildRatio <= this.config.maxWildRatio
        );
    }

    // Dengeli klasik desteyi oluştur
    fillBalancedClassic() {
        this.cards = [];
        
        // 1. Normal kartları ekle (her renkten 2 adet 0-9)
        for (const color of COLORS) {
            // 0 kartı (1 adet)
            this.cards.push(new Card(color, ZERO));
            
            // 1-9 kartları (2 adet)
            const numericals = [ONE, TWO, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE];
            for (const val of numericals) {
                this.cards.push(new Card(color, val));
                this.cards.push(new Card(color, val));
            }
        }

        // 2. Özel kartları kontrollü ekle
        this.addControlledSpecialCards();

        // 3. Wild kartları ekle
        this.addWildCards();

        // 4. Karıştır ve denge kontrolü
        this.shuffle();
        this.ensureDeckBalance();
    }

    // Kontrollü özel kart ekleme
    private addControlledSpecialCards() {
        const targetSpecialCount = Math.floor(this.cards.length * this.config.maxSpecialRatio);
        const currentSpecialCount = this.cards.filter(c => c.special && !(BONUS_SPECIALS as readonly string[]).includes(c.special!)).length;
        const specialCardsToAdd = Math.max(0, targetSpecialCount - currentSpecialCount);

        if (specialCardsToAdd > 0) {
            const actions = [SKIP, REVERSE, DRAW_TWO];
            const cardsPerColor = Math.floor(specialCardsToAdd / (COLORS.length * actions.length));
            
            for (const color of COLORS) {
                for (const action of actions) {
                    for (let i = 0; i < cardsPerColor; i++) {
                        this.cards.push(new Card(color, action));
                    }
                }
            }
        }
    }

    // Wild kartları ekle
    private addWildCards() {
        const targetWildCount = Math.floor(this.cards.length * this.config.maxWildRatio);
        const currentWildCount = this.cards.filter(c => c.special && (c.special === CHOOSE || c.special === DRAW_FOUR)).length;
        const wildCardsToAdd = Math.max(0, targetWildCount - currentWildCount);

        for (let i = 0; i < wildCardsToAdd / 2; i++) {
            this.cards.push(new Card(null, null, CHOOSE));
            this.cards.push(new Card(null, null, DRAW_FOUR));
        }
    }

    // Bonus kartları ekle (daha az sayıda)
    private addBonusCards() {
        const targetBonusCount = Math.floor(this.cards.length * this.config.maxBonusRatio);
        const currentBonusCount = this.cards.filter(c => c.special && (BONUS_SPECIALS as readonly string[]).includes(c.special!)).length;
        const bonusCardsToAdd = Math.max(0, targetBonusCount - currentBonusCount);

        if (bonusCardsToAdd > 0) {
            // Bonus kartları stratejik olarak seç
            const strategicBonuses = [FIRE, ICE, LIGHTNING, SHIELD]; // En dengeli kartlar
            const cardsPerBonus = Math.floor(bonusCardsToAdd / strategicBonuses.length);
            
            for (const bonus of strategicBonuses) {
                for (let i = 0; i < cardsPerBonus; i++) {
                    this.cards.push(new Card(null, null, bonus));
                }
            }
        }
    }

    // Wild mod için dengeli desteyi oluştur
    fillBalancedWild() {
        this.cards = [];
        
        // 1. Normal kartları (daha az)
        for (const color of COLORS) {
            for (const value of WILD_VALUES) {
                // Her değerden 2 adet (daha dengeli)
                this.cards.push(new Card(color, value));
                this.cards.push(new Card(color, value));
            }
        }

        // 2. Çek 2 kartlarını ekle (daha fazla)
        for (const color of COLORS) {
            for (let i = 0; i < 3; i++) { // 3 adet yerine 2
                this.cards.push(new Card(color, DRAW_TWO));
            }
        }

        // 3. Bonus kartları (çok az)
        this.addBonusCards();

        // 4. Wild kartları (kontrollü)
        this.addWildCards();

        // 5. Karıştır ve dengele
        this.shuffle();
        this.ensureDeckBalance();
    }

    // Destenin dengesini sağla
    private ensureDeckBalance() {
        let attempts = 0;
        const maxAttempts = 10;

        while (!this.isBalanced() && attempts < maxAttempts) {
            attempts++;
            
            // Fazla olan kart türlerini azalt
            const stats = this.getStats();
            const total = stats.totalCards;

            // Fazla özel kart varsa bazılarını normal kartla değiştir
            if (stats.specialCards / total > this.config.maxSpecialRatio) {
                this.balanceCardType('special', 'normal');
            }

            // Fazla bonus kart varsa bazılarını normal kartla değiştir
            if (stats.bonusCards / total > this.config.maxBonusRatio) {
                this.balanceCardType('bonus', 'normal');
            }

            // Fazla wild kart varsa bazılarını normal kartla değiştir
            if (stats.wildCards / total > this.config.maxWildRatio) {
                this.balanceCardType('wild', 'normal');
            }
        }

        this.shuffle();
    }

    // Kart türlerini dengele
    private balanceCardType(fromType: string, toType: string) {
        const fromIndex = this.cards.findIndex(card => {
            if (fromType === 'special') return card.special && !(BONUS_SPECIALS as readonly string[]).includes(card.special!);
            if (fromType === 'bonus') return card.special && (BONUS_SPECIALS as readonly string[]).includes(card.special!);
            if (fromType === 'wild') return card.special && (card.special === CHOOSE || card.special === DRAW_FOUR);
            return false;
        });

        if (fromIndex !== -1) {
            // Normal kart oluştur ve değiştir
            const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
            const randomValue = [ONE, TWO, THREE, FOUR, FIVE][Math.floor(Math.random() * 5)];
            this.cards[fromIndex] = new Card(randomColor, randomValue);
        }
    }

    // Oyunculara dengeli kart dağıt
    dealBalancedHands(playerCount: number): Card[][] {
        const hands: Card[][] = [];
        const cardsPerPlayer = 7;

        // Her oyuncu için boş el oluştur
        for (let i = 0; i < playerCount; i++) {
            hands[i] = [];
        }

        // Kartları dağıt (round-robin)
        for (let cardIndex = 0; cardIndex < cardsPerPlayer; cardIndex++) {
            for (let playerIndex = 0; playerIndex < playerCount; playerIndex++) {
                if (this.cards.length > 0) {
                    const card = this.draw();
                    hands[playerIndex].push(card);
                }
            }
        }

        // Her elin dengesini kontrol et ve düzelt
        for (let i = 0; i < hands.length; i++) {
            hands[i] = this.balanceHand(hands[i]);
        }

        return hands;
    }

    // Tek bir eli dengele
    private balanceHand(hand: Card[]): Card[] {
        const stats = this.getHandStats(hand);
        
        // Eğer bir oyuncuda çok fazla özel kart varsa, diğer oyuncularla değiştir
        if (stats.specialCards > 3) {
            // Fazla olan özel kartları normal kartlarla değiştir
            for (let i = 0; i < hand.length; i++) {
                if (hand[i].special && !(BONUS_SPECIALS as readonly string[]).includes(hand[i].special!)) {
                    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
                    const randomValue = [ONE, TWO, THREE, FOUR, FIVE][Math.floor(Math.random() * 5)];
                    hand[i] = new Card(randomColor, randomValue);
                    break; // Sadece bir kart değiştir
                }
            }
        }

        return hand;
    }

    // El istatistiklerini al
    private getHandStats(hand: Card[]) {
        const stats = {
            normalCards: 0,
            specialCards: 0,
            bonusCards: 0,
            wildCards: 0
        };

        for (const card of hand) {
            if (card.special) {
                if ((BONUS_SPECIALS as readonly string[]).includes(card.special)) {
                    stats.bonusCards++;
                } else {
                    stats.specialCards++;
                }
            } else if (card.value !== null) {
                stats.normalCards++;
            } else {
                stats.wildCards++;
            }
        }

        return stats;
    }

    // İlk kartı güvenli seç (oyunu başlatmak için)
    drawSafeFirstCard(): Card {
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            const card = this.draw();
            
            // İlk kart normal kart olmalı (özel kart oyun başında kaos yaratır)
            if (!card.special && card.value !== null) {
                return card;
            }
            
            // Özel kartsa geri koy
            this.cards.unshift(card);
            attempts++;
        }

        // Bulamazsa rastgele bir kart dön
        return this.draw();
    }

    // Destenin durumunu logla (debug için)
    logDeckState() {
        const stats = this.getStats();
        console.log('Deck Balance Stats:', {
            total: stats.totalCards,
            normal: `${stats.normalCards} (${((stats.normalCards / stats.totalCards) * 100).toFixed(1)}%)`,
            special: `${stats.specialCards} (${((stats.specialCards / stats.totalCards) * 100).toFixed(1)}%)`,
            bonus: `${stats.bonusCards} (${((stats.bonusCards / stats.totalCards) * 100).toFixed(1)}%)`,
            wild: `${stats.wildCards} (${((stats.wildCards / stats.totalCards) * 100).toFixed(1)}%)`,
            isBalanced: this.isBalanced()
        });
    }
}
