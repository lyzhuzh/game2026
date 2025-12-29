/**
 * Game Constants
 * Core game configuration values
 */

export const GAME_CONFIG = {
    // Frame rate settings
    TARGET_FPS: 60,
    PHYSICS_TICK_RATE: 60,

    // Player settings
    PLAYER: {
        HEIGHT: 1.8,
        CROUCH_HEIGHT: 1.0,
        RADIUS: 0.4,
        WALK_SPEED: 5.0,
        SPRINT_SPEED: 8.0,
        JUMP_FORCE: 5.0,  // 降低跳跃力（从8.0到5.0）
        MOUSE_SENSITIVITY: 0.002,
        MAX_HEALTH: 100,
        MAX_ARMOR: 100
    },

    // Camera settings
    CAMERA: {
        FOV: 75,
        NEAR_PLANE: 0.1,
        FAR_PLANE: 1000,
        SHAKE_INTENSITY: 0.5
    },

    // Weapon settings
    WEAPONS: {
        PISTOL: {
            DAMAGE: 25,
            FIRE_RATE: 0.5,
            MAGAZINE_SIZE: 12,
            RELOAD_TIME: 1.5,
            SPREAD: 0.01
        },
        RIFLE: {
            DAMAGE: 30,
            FIRE_RATE: 0.1,
            MAGAZINE_SIZE: 30,
            RELOAD_TIME: 2.0,
            SPREAD: 0.02
        },
        SHOTGUN: {
            DAMAGE: 15,
            PELLET_COUNT: 8,
            FIRE_RATE: 0.8,
            MAGAZINE_SIZE: 8,
            RELOAD_TIME: 2.5,
            SPREAD: 0.1
        }
    },

    // Enemy settings
    ENEMIES: {
        GRUNT: {
            HEALTH: 50,
            DAMAGE: 10,
            ATTACK_RANGE: 2.0,
            DETECTION_RANGE: 30.0,
            PATROL_SPEED: 2.0,
            CHASE_SPEED: 4.0
        },
        HEAVY: {
            HEALTH: 150,
            DAMAGE: 25,
            ATTACK_RANGE: 3.0,
            DETECTION_RANGE: 25.0,
            PATROL_SPEED: 1.5,
            CHASE_SPEED: 3.0
        }
    },

    // LOD settings
    LOD: {
        HIGH_DISTANCE: 20,
        MEDIUM_DISTANCE: 50,
        LOW_DISTANCE: 100,
        CULL_DISTANCE: 150
    },

    // Audio settings
    AUDIO: {
        MASTER_VOLUME: 1.0,
        SFX_VOLUME: 0.8,
        MUSIC_VOLUME: 0.6,
        DUCKING_AMOUNT: 0.3
    }
};
