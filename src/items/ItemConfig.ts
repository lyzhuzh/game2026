/**
 * Item Configuration
 * Defines all pickable items in the game
 */

export type ItemType = 'health_small' | 'health_large' | 'armor_small' | 'armor_large' | 'ammo_pistol' | 'ammo_rifle' | 'ammo_shotgun' | 'ammo_smg' | 'ammo_sniper';

export interface ItemStats {
    // Display
    name: string;
    icon?: string;

    // Pickup values
    healthRestore?: number;
    armorRestore?: number;
    ammoAmount?: number;
    weaponType?: string;

    // Spawning
    respawnTime: number; // Seconds before respawn
    rotateSpeed: number; // Visual rotation speed
    bobSpeed: number; // Vertical bob speed
    bobAmount: number; // Vertical bob amount

    // Visual
    color: number;
    size: number;
    glowColor?: number;
}

export const ITEM_CONFIGS: Record<ItemType, ItemStats> = {
    // Health items
    health_small: {
        name: '急救包',
        healthRestore: 30,  // 25 -> 30
        respawnTime: 30,
        rotateSpeed: 1,
        bobSpeed: 2,
        bobAmount: 0.1,
        color: 0xff4444,
        size: 0.5,
        glowColor: 0xff0000
    },
    health_large: {
        name: '医疗箱',
        healthRestore: 100,
        respawnTime: 60,
        rotateSpeed: 1,
        bobSpeed: 2,
        bobAmount: 0.1,
        color: 0xff4444,
        size: 0.7,
        glowColor: 0xff0000
    },

    // Armor items
    armor_small: {
        name: '轻型护甲',
        armorRestore: 30,  // 25 -> 30
        respawnTime: 30,
        rotateSpeed: 1,
        bobSpeed: 2,
        bobAmount: 0.1,
        color: 0x4444ff,
        size: 0.5,
        glowColor: 0x0000ff
    },
    armor_large: {
        name: '重型护甲',
        armorRestore: 100,
        respawnTime: 60,
        rotateSpeed: 1,
        bobSpeed: 2,
        bobAmount: 0.1,
        color: 0x4444ff,
        size: 0.7,
        glowColor: 0x0000ff
    },

    // Ammo items
    ammo_pistol: {
        name: '手枪弹药',
        ammoAmount: 36,  // 24 -> 36
        weaponType: 'pistol',
        respawnTime: 20,
        rotateSpeed: 1,
        bobSpeed: 2,
        bobAmount: 0.1,
        color: 0xffaa00,
        size: 0.3
    },
    ammo_rifle: {
        name: '步枪弹药',
        ammoAmount: 45,  // 30 -> 45
        weaponType: 'rifle',
        respawnTime: 20,
        rotateSpeed: 1,
        bobSpeed: 2,
        bobAmount: 0.1,
        color: 0xffaa00,
        size: 0.3
    },
    ammo_shotgun: {
        name: '霰弹枪弹药',
        ammoAmount: 16,  // 8 -> 16
        weaponType: 'shotgun',
        respawnTime: 25,
        rotateSpeed: 1,
        bobSpeed: 2,
        bobAmount: 0.1,
        color: 0xffaa00,
        size: 0.35
    },
    ammo_smg: {
        name: '冲锋枪弹药',
        ammoAmount: 50,  // 40 -> 50
        weaponType: 'smg',
        respawnTime: 20,
        rotateSpeed: 1,
        bobSpeed: 2,
        bobAmount: 0.1,
        color: 0xffaa00,
        size: 0.3
    },
    ammo_sniper: {
        name: '狙击枪弹药',
        ammoAmount: 15,  // 10 -> 15
        weaponType: 'sniper',
        respawnTime: 30,
        rotateSpeed: 1,
        bobSpeed: 2,
        bobAmount: 0.1,
        color: 0xffaa00,
        size: 0.35
    }
};

/**
 * Get random item type based on weights
 */
export function getRandomItemType(): ItemType {
    const weights: Record<ItemType, number> = {
        health_small: 18,  // 20 -> 18 (slightly less common)
        health_large: 8,   // 5 -> 8 (more common)
        armor_small: 15,
        armor_large: 5,
        ammo_pistol: 15,
        ammo_rifle: 12,
        ammo_shotgun: 10,
        ammo_smg: 12,
        ammo_sniper: 5    // 6 -> 5
    };

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (const [type, weight] of Object.entries(weights)) {
        random -= weight;
        if (random <= 0) {
            return type as ItemType;
        }
    }

    return 'health_small';
}
