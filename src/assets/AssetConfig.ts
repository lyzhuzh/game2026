/**
 * Asset Configuration
 * Defines all game assets (models, textures, audio)
 */

import { AssetConfig } from './AssetManager';

// Base path for assets (Vite publicDir is set to 'assets', so paths are relative to root)
const ASSETS_BASE_PATH = '';

export const GAME_ASSETS: AssetConfig[] = [
    // ============ WEAPONS (Kenney Blaster Kit) ============
    // Using actual downloaded file names from Blaster Kit
    {
        id: 'weapon_pistol',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/weapons/blaster-a.glb`,
        preload: true
    },
    {
        id: 'weapon_rifle',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/weapons/blaster-c.glb`,
        preload: true
    },
    {
        id: 'weapon_shotgun',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/weapons/blaster-e.glb`,
        preload: true
    },
    {
        id: 'weapon_smg',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/weapons/blaster-f.glb`,
        preload: false
    },
    {
        id: 'weapon_sniper',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/weapons/blaster-n.glb`, // Long blaster for sniper
        preload: false
    },
    {
        id: 'weapon_rocket_launcher',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/weapons/blaster-h.glb`, // Heavy blaster for rocket launcher
        preload: false
    },

    // ============ PLAYER CHARACTER ============
    // TODO: Add player character model
    {
        id: 'player_character',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/environment/astronautA.glb`, // Using astronaut as placeholder
        preload: false
    },

    // ============ ENEMIES ============
    // Animated character model with Idle, Walk, Run, Shoot animations
    {
        id: 'enemy_grunt',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/enemies/corin_wickes.glb`,
        preload: true
    },
    {
        id: 'enemy_soldier',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/enemies/corin_wickes.glb`,
        preload: true
    },
    {
        id: 'enemy_heavy',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/enemies/corin_wickes.glb`,
        preload: true
    },
    {
        id: 'enemy_sniper',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/enemies/corin_wickes.glb`,
        preload: false
    },

    // ============ ENVIRONMENT (Kenney Space Kit) ============
    {
        id: 'env_platform',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/environment/platform_straight.glb`,
        preload: true
    },
    {
        id: 'env_wall',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/environment/corridor_wall.glb`,
        preload: true
    },
    {
        id: 'env_corner',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/environment/platform_corner.glb`,
        preload: true
    },
    {
        id: 'env_crate',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/weapons/crate-medium.glb`,
        preload: true
    },
    {
        id: 'env_barrel',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/environment/barrel.glb`,
        preload: true
    },
    {
        id: 'env_corridor',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/environment/corridor.glb`,
        preload: true
    },
    {
        id: 'env_corridor_window',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/environment/corridor_window.glb`,
        preload: true
    },
    {
        id: 'env_corridor_corner',
        type: 'glb',
        url: `${ASSETS_BASE_PATH}/environment/corridor_corner.glb`,
        preload: true
    },

    // ============ TEXTURES ============
    {
        id: 'tex_grid',
        type: 'texture',
        url: `${ASSETS_BASE_PATH}/weapons/Textures/colormap.png`,
        preload: true
    },
];

// Helper to get weapon asset ID
export function getWeaponAssetId(weaponType: string): string {
    const mapping: Record<string, string> = {
        'pistol': 'weapon_pistol',
        'rifle': 'weapon_rifle',
        'shotgun': 'weapon_shotgun',
        'smg': 'weapon_smg',
        'sniper': 'weapon_sniper',
        'rocket_launcher': 'weapon_rocket_launcher',
        'flamethrower': 'weapon_pistol' // Use pistol as fallback
    };
    return mapping[weaponType] || 'weapon_pistol';
}

// Helper to get enemy asset ID
export function getEnemyAssetId(enemyType: string): string {
    const mapping: Record<string, string> = {
        'grunt': 'enemy_grunt',
        'soldier': 'enemy_soldier',
        'heavy': 'enemy_heavy',
        'sniper': 'enemy_sniper'
    };
    return mapping[enemyType] || 'enemy_grunt';
}
