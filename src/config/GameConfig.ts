/**
 * 统一游戏配置管理
 * 将分散在各个文件中的配置集中管理
 */

import * as THREE from 'three';

// ========== 音频配置 ==========
export const AUDIO_CONFIG = {
    // 脚步声间隔（秒）
    footstepInterval: 0.45,
    footstepSprintInterval: 0.3,
    footstepCrouchInterval: 0.6,
} as const;

// ========== 生成配置 ==========
export const SPAWNING_CONFIG = {
    // 玩家出生点
    playerStart: new THREE.Vector3(0, 1.8, 5),

    // 安全区（玩家出生点附近不生成敌人）
    safeZone: {
        x: { min: -40, max: 40 },
        z: { min: -35, max: 35 }
    },

    // 生成参数
    minSpawnDistance: 50,
    spawnRadius: 50,

    // 最大尝试次数
    maxSpawnAttempts: 100,
} as const;

// ========== 物理配置 ==========
export const PHYSICS_CONFIG = {
    // 重力
    gravity: -9.82,

    // 碰撞检测算法
    broadphase: 'Naive' as const, // 'Naive' | 'SAP'

    // 求解器迭代次数
    solverIterations: 10,

    // 碰撞容忍度
    tolerance: 0.001,

    // 地面摩擦力
    groundFriction: 0.0,

    // 默认摩擦力
    defaultFriction: 0.3,

    // 默认弹性
    defaultRestitution: 0.3,
} as const;

// ========== 玩家配置 ==========
export const PLAYER_CONFIG = {
    // 角色控制器
    radius: 0.5,
    height: 1.8,
    walkSpeed: 5,
    sprintSpeed: 8,
    jumpForce: 5,

    // 相机
    mouseSensitivity: 0.002,
    lookSpeed: 0.002,
    maxPitch: Math.PI / 2 - 0.1, // 约85度
    minPitch: -Math.PI / 2 + 0.1,

    // 狙击镜
    sniperZoom: 6,

    // 初始状态
    initialHealth: 100,
    initialArmor: 0,
} as const;

// ========== 敌人配置 ==========
export const ENEMY_SPAWN_CONFIG = {
    // 生成参数
    spawnRadius: 50,
    maxConcurrentEnemies: 10,
    enemiesPerWaveBase: 5,
    enemiesPerWaveMultiplier: 2,
    maxEnemiesPerWave: 10,

    // 波次延迟
    waveDelay: 3000, // ms

    // 死亡清理延迟
    deathCleanupDelay: 2000, // ms

    // AI 配置
    detectionRange: 30,
    chaseRange: 50,
    attackRange: 3,
    attackCooldown: 1.0,
} as const;

// ========== UI 配置 ==========
export const UI_CONFIG = {
    // 伤害指示器
    damageIndicatorDuration: 200, // ms

    // 波次公告
    waveAnnouncementDuration: 2000, // ms
    waveAnnouncementFade: 500, // ms

    // 拾取通知
    pickupNotificationDuration: 2000, // ms
    pickupNotificationFade: 500, // ms

    // 弹药警告
    lowAmmoThreshold: 0.3, // 30%
} as const;

// ========== 关卡配置 ==========
export const LEVEL_CONFIG = {
    // 关卡大小
    size: 100,
    wallHeight: 10,
    platformCount: 15,
    obstacleCount: 20,

    // 天空盒
    skyColor: 0x87ceeb,
    fogColor: 0x87ceeb,
    fogNear: 10,
    fogFar: 500,
} as const;

// ========== 渲染配置 ==========
export const RENDER_CONFIG = {
    // 像素比
    maxPixelRatio: 2,

    // 阴影
    shadowMapSize: 2048,
    shadowCameraNear: 0.5,
    shadowCameraFar: 500,
    shadowCameraLeft: -100,
    shadowCameraRight: 100,
    shadowCameraTop: 100,
    shadowCameraBottom: -100,

    // 抗锯齿
    antialias: true,

    // 性能偏好
    powerPreference: 'high-performance' as const,
} as const;

// ========== 粒子配置 ==========
export const PARTICLE_CONFIG = {
    // 对象池
    maxParticles: 1000,
    particleSize: 0.1,

    // 默认重力
    defaultGravity: -9.8,

    // 地面碰撞阈值
    groundThreshold: 0.05,
} as const;

// ========== 武器配置常量 ==========
export const WEAPON_CONSTANTS = {
    // 换弹时间（秒）
    reloadTime: {
        pistol: 1.2,
        rifle: 1.8,
        shotgun: 2.0,
        smg: 1.5,
        sniper: 2.5,
        rocket_launcher: 2.8,
        flamethrower: 2.0,
    },

    // 弹匣大小
    magazineSize: {
        pistol: 12,
        rifle: 30,
        shotgun: 8,
        smg: 25,
        sniper: 5,
        rocket_launcher: 1,
        flamethrower: 50, // 燃料容量
    },

    // 备弹量
    reserveAmmo: {
        pistol: 48,
        rifle: 120,
        shotgun: 32,
        smg: 100,
        sniper: 20,
        rocket_launcher: 10,
        flamethrower: 150,
    },
} as const;

// ========== 游戏循环配置 ==========
export const GAME_LOOP_CONFIG = {
    // 固定时间步长
    fixedTimeStep: 1 / 60,

    // 最大帧时间（防止死亡螺旋）
    maxFrameTime: 0.25,
} as const;

// ========== 导出所有配置的集合 ==========
export const GAME_CONFIG = {
    audio: AUDIO_CONFIG,
    spawning: SPAWNING_CONFIG,
    physics: PHYSICS_CONFIG,
    player: PLAYER_CONFIG,
    enemy: ENEMY_SPAWN_CONFIG,
    ui: UI_CONFIG,
    level: LEVEL_CONFIG,
    render: RENDER_CONFIG,
    particle: PARTICLE_CONFIG,
    weapon: WEAPON_CONSTANTS,
    gameLoop: GAME_LOOP_CONFIG,
} as const;

// ========== 类型导出 ==========
export type GameConfig = typeof GAME_CONFIG;
export type AudioConfig = typeof AUDIO_CONFIG;
export type SpawningConfig = typeof SPAWNING_CONFIG;
export type PhysicsConfig = typeof PHYSICS_CONFIG;
export type PlayerConfig = typeof PLAYER_CONFIG;
export type EnemySpawnConfig = typeof ENEMY_SPAWN_CONFIG;
export type UIConfig = typeof UI_CONFIG;
export type LevelConfig = typeof LEVEL_CONFIG;
export type RenderConfig = typeof RENDER_CONFIG;
export type ParticleConfig = typeof PARTICLE_CONFIG;
