/**
 * Projectile Weapon
 * Base class for weapons that fire physical projectiles (rockets, grenades, etc.)
 */

import * as THREE from 'three';
import { Weapon, FireResult, WeaponType } from './Weapon';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export interface ProjectileConfig {
    damage: number;
    radius: number; // Explosion radius
    speed: number;
    gravity: number;
    lifetime: number;
    owner: 'player' | 'enemy';
}

export class ProjectileWeapon extends Weapon {
    protected world: PhysicsWorld;
    protected scene: THREE.Scene;
    protected projectileConfig: ProjectileConfig;

    constructor(type: WeaponType, world: PhysicsWorld, scene: THREE.Scene, projectileConfig: ProjectileConfig) {
        super(type);
        this.world = world;
        this.scene = scene;
        this.projectileConfig = projectileConfig;
    }

    /**
     * Fire method to be implemented by subclasses
     */
    fire(origin: THREE.Vector3, direction: THREE.Vector3, time: number): FireResult | null {
        if (!this.canFire(time)) {
            return null;
        }

        // Consume ammo
        this.consumeAmmo(time);

        // Apply recoil
        this.applyRecoil();

        // Create projectile (to be implemented by subclass)
        this.createProjectile(origin, direction);

        return {
            hit: false,
            position: origin,
            distance: 0
        };
    }

    /**
     * Create projectile - to be implemented by subclass
     */
    protected createProjectile(_origin: THREE.Vector3, _direction: THREE.Vector3): void {
        // Override in subclass
    }

    /**
     * Get projectile config
     */
    getProjectileConfig(): ProjectileConfig {
        return this.projectileConfig;
    }
}
