/**
 * Kill Feed Component
 * Shows kill notifications in the top-right corner
 */

export interface KillFeedEntry {
    killer: string;
    victim: string;
    weapon: string;
    isHeadshot?: boolean;
    timestamp: number;
    element?: HTMLElement;
}

export class KillFeed {
    private static container: HTMLElement | null = null;
    private static maxEntries: number = 5;
    private static displayDuration: number = 5000; // 5 seconds
    private static entries: KillFeedEntry[] = [];

    /**
     * Initialize the kill feed system
     */
    static initialize(): void {
        // Create container if not exists
        if (!KillFeed.container) {
            KillFeed.container = document.getElementById('kill-feed');
            if (!KillFeed.container) {
                KillFeed.container = document.createElement('div');
                KillFeed.container.id = 'kill-feed';
                KillFeed.container.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 300px;
                    pointer-events: none;
                    z-index: 100;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    align-items: flex-end;
                `;
                document.body.appendChild(KillFeed.container);
            }
        }
    }

    /**
     * Add a kill entry
     */
    static add(killer: string, victim: string, weapon: string, isHeadshot: boolean = false): void {
        const entry: KillFeedEntry = {
            killer,
            victim,
            weapon,
            isHeadshot,
            timestamp: Date.now()
        };

        KillFeed.entries.push(entry);
        KillFeed.renderEntry(entry);

        // Limit entries
        if (KillFeed.entries.length > KillFeed.maxEntries) {
            const removed = KillFeed.entries.shift();
            if (removed && removed.element) {
                removed.element.remove();
            }
        }

        // Auto remove after duration
        setTimeout(() => {
            KillFeed.remove(entry);
        }, KillFeed.displayDuration);
    }

    /**
     * Add player kill (simplified)
     */
    static addPlayerKill(victim: string, weapon: string, isHeadshot: boolean = false): void {
        KillFeed.add('你', victim, weapon, isHeadshot);
    }

    /**
     * Add player death (simplified)
     */
    static addPlayerDeath(killer: string, weapon: string, isHeadshot: boolean = false): void {
        KillFeed.add(killer, '你', weapon, isHeadshot);
    }

    /**
     * Render a kill feed entry
     */
    private static renderEntry(entry: KillFeedEntry): void {
        if (!KillFeed.container) return;

        const element = document.createElement('div');
        element.className = 'kill-feed-entry';

        const headshotIcon = entry.isHeadshot ? ' 💀' : '';
        const weaponName = KillFeed.getWeaponDisplayName(entry.weapon);

        element.innerHTML = `
            <span class="killer">${entry.killer}</span>
            <span class="separator"> 击败了 </span>
            <span class="victim">${entry.victim}</span>
            <span class="weapon">[${weaponName}]</span>
            <span class="headshot">${headshotIcon}</span>
        `;

        element.style.cssText = `
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 4px;
            animation: slideIn 0.3s ease-out, fadeOut 0.5s ease-in ${KillFeed.displayDuration - 500}ms forwards;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        `;

        // Style differences
        const killerSpan = element.querySelector('.killer') as HTMLElement;
        const victimSpan = element.querySelector('.victim') as HTMLElement;
        const weaponSpan = element.querySelector('.weapon') as HTMLElement;
        const headshotSpan = element.querySelector('.headshot') as HTMLElement;

        if (killerSpan) {
            killerSpan.style.color = '#4CAF50';
            killerSpan.style.fontWeight = 'bold';
        }

        if (victimSpan) {
            victimSpan.style.color = '#ff4444';
            victimSpan.style.fontWeight = 'bold';
        }

        if (weaponSpan) {
            weaponSpan.style.color = '#ffaa00';
            weaponSpan.style.fontSize = '12px';
        }

        if (headshotSpan) {
            headshotSpan.style.color = '#ffcc00';
            headshotSpan.style.fontSize = '16px';
        }

        KillFeed.container.appendChild(element);

        // Store element reference
        (entry as any).element = element;
    }

    /**
     * Remove a kill entry
     */
    private static remove(entry: KillFeedEntry): void {
        const index = KillFeed.entries.indexOf(entry);
        if (index !== -1) {
            KillFeed.entries.splice(index, 1);
        }

        if ((entry as any).element) {
            (entry as any).element.remove();
        }
    }

    /**
     * Get display name for weapon
     */
    private static getWeaponDisplayName(weapon: string): string {
        const weaponNames: Record<string, string> = {
            'pistol': '手枪',
            'rifle': '步枪',
            'shotgun': '霰弹枪',
            'smg': '冲锋枪',
            'sniper': '狙击枪',
            'melee': '近战',
            'rocket_launcher': '火箭筒',
            'flamethrower': '火焰喷射器',
            'laser': '激光枪'
        };

        return weaponNames[weapon] || weapon;
    }

    /**
     * Clear all entries
     */
    static clear(): void {
        KillFeed.entries = [];
        if (KillFeed.container) {
            KillFeed.container.innerHTML = '';
        }
    }

    /**
     * Cleanup
     */
    static dispose(): void {
        KillFeed.clear();
        if (KillFeed.container && KillFeed.container.parentNode) {
            KillFeed.container.parentNode.removeChild(KillFeed.container);
        }
        KillFeed.container = null;
    }
}

// Add CSS animations
export function injectKillFeedStyles(): void {
    const styleId = 'kill-feed-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes fadeOut {
            from {
                opacity: 1;
            }
            to {
                opacity: 0;
            }
        }

        .kill-feed-entry .killer {
            color: #4CAF50;
            font-weight: bold;
        }

        .kill-feed-entry .victim {
            color: #ff4444;
            font-weight: bold;
        }

        .kill-feed-entry .weapon {
            color: #ffaa00;
            font-size: 12px;
        }

        .kill-feed-entry .headshot {
            color: #ffcc00;
            font-size: 16px;
        }
    `;
    document.head.appendChild(style);
}

export default KillFeed;
