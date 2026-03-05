import { prisma } from '../db/prisma.js';

export const ACHIEVEMENTS = [
    { id: 'FIRST_WIN', name: 'İlk Galibiyet', description: 'İlk UNO maçınızı kazandınız!', icon: '🏆', xpReward: 500 },
    { id: 'TEN_WINS', name: 'Onluk Seri', description: '10 maçı zaferle tamamladınız.', icon: '🏅', xpReward: 2000 },
    { id: 'UNO_MASTER', name: 'UNO Ustası', description: '5 kez başarılı bir şekilde UNO dediniz.', icon: '🔥', xpReward: 1000 },
    { id: 'PLUS_FOUR_KING', name: '+4 Kralı', description: 'Tek oyunda 3 kez +4 kartı oynadınız.', icon: '💥', xpReward: 1500 },
    { id: 'WILD_FIGHTER', name: 'Vahşi Savaşçı', description: 'Wild modunda 10 galibiyet aldınız.', icon: '🐾', xpReward: 2500 }
];

export async function checkAndUnlock(userId: number, event: string, context?: { mode?: string }) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { achievements: true }
    });

    if (!user) return;

    const unlockedIds = user.achievements.map((ua: { achievementId: string }) => ua.achievementId);

    for (const achievement of ACHIEVEMENTS) {
        if (unlockedIds.includes(achievement.id)) continue;

        let shouldUnlock = false;

        switch (achievement.id) {
            case 'FIRST_WIN':
                if (event === 'WIN' && user.wins >= 1) shouldUnlock = true;
                break;
            case 'TEN_WINS':
                if (event === 'WIN' && user.wins >= 10) shouldUnlock = true;
                break;
            case 'UNO_MASTER':
                // Note: Bu sayaç veritabanında tutulmalı veya event bazında artırılmalı
                // Şimdilik sadece örnek
                break;
            case 'WILD_FIGHTER':
                if (event === 'WIN' && context?.mode === 'wild') {
                    // count checking code logic
                    if (user.wins >= 10) shouldUnlock = true;
                }
                break;
        }

        if (shouldUnlock) {
            await prisma.userAchievement.create({
                data: {
                    userId,
                    achievementId: achievement.id
                }
            });

            // Apply XP reward
            await prisma.user.update({
                where: { id: userId },
                data: {
                    xp: { increment: achievement.xpReward }
                }
            });
        }
    }
}

export async function seedAchievements() {
    for (const a of ACHIEVEMENTS) {
        await prisma.achievement.upsert({
            where: { id: a.id },
            update: { name: a.name, description: a.description, icon: a.icon, xpReward: a.xpReward },
            create: a
        });
    }
}
