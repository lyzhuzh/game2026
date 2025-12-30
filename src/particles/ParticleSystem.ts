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
     * Muzzle flash effect (enhanced - brighter and more visible)
     */
    muzzleFlash(position: THREE.Vector3, direction: THREE.Vector3): void {
        // Enhanced effect - more particles, larger, more visible
        const particleCount = 8 + Math.floor(Math.random() * 6); // 8-14 particles

        for (let i = 0; i < particleCount; i++) {
            // Cone spread in fire direction
            const spreadDir = direction.clone();
            spreadDir.x += (Math.random() - 0.5) * 0.3; // More spread
            spreadDir.y += (Math.random() - 0.5) * 0.3;
            spreadDir.z += (Math.random() - 0.5) * 0.3;
            spreadDir.normalize();

            // Add randomness to speed
            const speed = 2 + Math.random() * 4;

            const config: ParticleConfig = {
                type: 'muzzle_flash',
                position: position.clone(),
                count: 1,
                color: 0xffdd44, // Bright yellow-orange
                size: 0.4 + Math.random() * 0.3, // Larger size (0.12-0.18 world units)
                lifetime: 0.05 + Math.random() * 0.08, // Longer lived (50-130ms)
                velocity: spreadDir.multiplyScalar(speed),
                gravity: 0,
                fadeOut: true
            };
            this.emit(config);
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
