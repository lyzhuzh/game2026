/**
 * Particle System
 * Main particle effect manager for the game
 */

import * as THREE from 'three';
import { ParticleConfig, ParticleType } from './ParticleTypes';
import { ParticlePool } from './ParticlePool';
import { createConfigFromPreset } from './presets/ParticlePresets';

export class ParticleSystem {
    private pool: ParticlePool;
    private scene: THREE.Scene;
    private camera?: THREE.Camera;
    private decalMeshes: THREE.Mesh[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.pool = new ParticlePool(scene, 2000);
    }

    /**
     * Set camera for billboarding
     */
    setCamera(camera: THREE.Camera): void {
        this.camera = camera;
        this.pool.setCamera(camera);
    }

    /**
     * Emit particles at position
     */
    emit(config: ParticleConfig): void {
        const count = config.count ?? 1;

        for (let i = 0; i < count; i++) {
            // Add slight position randomness for multiple particles
            const pos = config.position.clone();
            if (count > 1) {
                pos.x += (Math.random() - 0.5) * 0.1;
                pos.y += (Math.random() - 0.5) * 0.1;
                pos.z += (Math.random() - 0.5) * 0.1;
            }

            const particleConfig: ParticleConfig = {
                ...config,
                position: pos
            };

            this.pool.acquire(particleConfig);
        }
    }

    /**
     * Emit preset particle effect
     */
    emitPreset(type: ParticleType, position: THREE.Vector3, normal?: THREE.Vector3): void {
        const config = createConfigFromPreset(type, position, normal);
        this.emit(config);
    }

    /**
     * Explosion effect
     */
    explosion(position: THREE.Vector3, size: number = 1): void {
        const config = createConfigFromPreset('explosion', position);

        // Scale based on size
        if (typeof config.size === 'object') {
            config.size = {
                min: config.size.min * size,
                max: config.size.max * size
            };
        }

        // Increase count for larger explosions
        config.count = Math.floor((config.count ?? 1) * size);

        this.emit(config);

        // Add smoke after explosion
        setTimeout(() => {
            this.emitPreset('smoke', position);
        }, 100);
    }

    /**
     * Blood splatter effect
     */
    bloodSplatter(position: THREE.Vector3, normal: THREE.Vector3): void {
        this.emitPreset('blood_splatter', position, normal);
    }

    /**
     * Bullet hole decal
     */
    bulletHole(position: THREE.Vector3, normal: THREE.Vector3): void {
        const config = createConfigFromPreset('bullet_hole', position, normal);
        this.emit(config);
    }

    /**
     * Spark effect
     */
    spark(position: THREE.Vector3, normal?: THREE.Vector3): void {
        if (normal) {
            this.emitPreset('spark', position, normal);
        } else {
            this.emitPreset('spark', position);
        }
    }

    /**
     * Muzzle flash effect - weapon specific
     * @param position - Position to emit from
     * @param direction - Direction the weapon is facing
     * @param weaponType - Type of weapon (affects flash characteristics)
     */
    muzzleFlash(position: THREE.Vector3, direction: THREE.Vector3, weaponType: string = 'pistol'): void {
        // Weapon-specific configurations
        interface FlashConfig {
            particleCount: number;
            color: number;
            sizeMin: number;
            sizeMax: number;
            speedMin: number;
            speedMax: number;
            spread: number;
            lifetime: number;
        }

        const configs: Record<string, FlashConfig> = {
            pistol: {
                particleCount: 6,
                color: 0xffdd44,      // Yellow-orange
                sizeMin: 0.15,
                sizeMax: 0.25,
                speedMin: 2,
                speedMax: 4,
                spread: 0.2,
                lifetime: 0.06
            },
            rifle: {
                particleCount: 10,
                color: 0xffaa22,      // Orange
                sizeMin: 0.2,
                sizeMax: 0.35,
                speedMin: 4,
                speedMax: 8,
                spread: 0.15,
                lifetime: 0.05
            },
            shotgun: {
                particleCount: 25,    // Lots of particles for spread
                color: 0xff6622,      // Deep orange
                sizeMin: 0.25,
                sizeMax: 0.45,
                speedMin: 5,
                speedMax: 12,
                spread: 0.5,          // Wide spread
                lifetime: 0.08
            },
            smg: {
                particleCount: 5,     // Small, fast
                color: 0xffcc44,      // Bright yellow
                sizeMin: 0.1,
                sizeMax: 0.2,
                speedMin: 3,
                speedMax: 6,
                spread: 0.15,
                lifetime: 0.04
            },
            sniper: {
                particleCount: 15,
                color: 0xffffff,      // White-hot flash
                sizeMin: 0.3,
                sizeMax: 0.5,
                speedMin: 8,
                speedMax: 15,
                spread: 0.1,          // Tight, focused
                lifetime: 0.1
            }
        };

        const config = configs[weaponType] || configs.pistol;

        for (let i = 0; i < config.particleCount; i++) {
            // Cone spread in fire direction
            const spreadDir = direction.clone();
            spreadDir.x += (Math.random() - 0.5) * config.spread;
            spreadDir.y += (Math.random() - 0.5) * config.spread;
            spreadDir.z += (Math.random() - 0.5) * config.spread;
            spreadDir.normalize();

            // Add randomness to speed
            const speed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);

            const particleConfig: ParticleConfig = {
                type: 'muzzle_flash',
                position: position.clone(),
                count: 1,
                color: config.color,
                size: config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin),
                lifetime: config.lifetime * (0.8 + Math.random() * 0.4),
                velocity: spreadDir.multiplyScalar(speed),
                gravity: 0,
                fadeOut: true
            };
            this.emit(particleConfig);
        }
    }

    /**
     * Debris effect
     */
    debris(position: THREE.Vector3): void {
        this.emitPreset('debris', position);
    }

    /**
     * Health pickup effect
     */
    healthPickup(position: THREE.Vector3): void {
        this.emitPreset('health_pickup', position);
    }

    /**
     * Shell casing ejection
     */
    shellCasing(position: THREE.Vector3, direction: THREE.Vector3): void {
        const config = createConfigFromPreset('shell casing', position);

        // Perpendicular velocity for shell ejection
        const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
        const up = new THREE.Vector3(0, 1, 0);

        config.velocity = right.multiplyScalar(3).add(up.multiplyScalar(2));
        config.rotationSpeed = new THREE.Vector3(
            Math.random() * 10 - 5,
            Math.random() * 10 - 5,
            0
        );

        this.emit(config);
    }

    /**
     * Update all particles
     */
    update(deltaTime: number): void {
        this.pool.update(deltaTime);
    }

    /**
     * Clear all particles
     */
    clear(): void {
        this.pool.clear();

        // Clear decals
        for (const mesh of this.decalMeshes) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
        }
        this.decalMeshes = [];
    }

    /**
     * Get active particle count
     */
    getActiveCount(): number {
        return this.pool.getActiveCount();
    }

    /**
     * Dispose
     */
    dispose(): void {
        this.clear();
    }
}

export default ParticleSystem;
