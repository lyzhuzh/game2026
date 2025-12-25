/**
 * Particle Types
 * Defines all particle effect types and their configurations
 */

import * as THREE from 'three';

export type ParticleType =
    | 'explosion'       // 爆炸效果 - 球形扩散
    | 'blood_splatter'  // 血迹飞溅 - 红色贴地
    | 'bullet_hole'     // 弹孔 - Decal贴图
    | 'spark'           // 火花 - 黄色短寿命
    | 'smoke'           // 烟雾 - 灰色上升
    | 'muzzle_flash'    // 枪口火焰 - 点光源+粒子
    | 'debris'          // 碎片 - 旋转方块
    | 'health_pickup'   // 拾取特效 - 绿色上升
    | 'shell casing';   // 弹壳 - 抛物线

export interface ParticleConfig {
    type: ParticleType;
    position: THREE.Vector3;
    normal?: THREE.Vector3; // Surface normal for decals
    count?: number;
    color?: number;
    size?: number | { min: number; max: number };
    lifetime?: number | { min: number; max: number };
    velocity?: THREE.Vector3 | { min: number; max: number };
    gravity?: number;
    fadeOut?: boolean;
    stickToSurface?: boolean;
    rotationSpeed?: THREE.Vector3;
}

export interface ParticlePreset {
    count: number;
    lifetime: number | { min: number; max: number };
    size: number | { min: number; max: number };
    color: number;
    velocity: { min: number; max: number };
    gravity: number;
    fadeOut: boolean;
    stickToSurface?: boolean;
    rotationSpeed?: { min: THREE.Vector3; max: THREE.Vector3 };
    spread?: number; // Velocity spread angle
}

/**
 * Individual particle data
 */
export interface Particle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    lifetime: number;
    maxLifetime: number;
    gravity: number;
    fadeOut: boolean;
    rotationSpeed?: THREE.Vector3;
    stickToSurface?: boolean;
    active: boolean;
}

/**
 * Convert color number to THREE.Color
 */
export function getParticleColor(color: number): THREE.Color {
    return new THREE.Color(color);
}

/**
 * Random range helper
 */
export function randomRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

/**
 * Random vector in sphere
 */
export function randomSpherePoint(radius: number): THREE.Vector3 {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);

    return new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
    );
}

/**
 * Random vector in hemisphere (for surface effects)
 */
export function randomHemispherePoint(normal: THREE.Vector3, radius: number): THREE.Vector3 {
    const point = randomSpherePoint(radius);
    if (point.dot(normal) < 0) {
        point.negate();
    }
    return point;
}
