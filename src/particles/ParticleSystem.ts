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
     * Muzzle flash effect (subtle particle burst, no screen flash)
     */
    muzzleFlash(position: THREE.Vector3, direction: THREE.Vector3): void {
        // Very subtle effect - just 1-2 tiny particles
        const particleCount = 1 + Math.floor(Math.random() * 2);

        for (let i = 0; i < particleCount; i++) {
            // Slight spread in fire direction
            const spreadDir = direction.clone();
            spreadDir.x += (Math.random() - 0.5) * 0.1;
            spreadDir.y += (Math.random() - 0.5) * 0.1;
            spreadDir.z += (Math.random() - 0.5) * 0.1;
            spreadDir.normalize();

            const config: ParticleConfig = {
                type: 'muzzle_flash',
                position: position.clone(),
                count: 1,
                color: 0xffcc88, // Lighter, softer orange
                size: 0.3 + Math.random() * 0.2, // Tiny size (0.1 base * 0.3-0.5 = 0.03-0.05 world units)
                lifetime: 0.01 + Math.random() * 0.01, // Very short lived
                velocity: spreadDir.multiplyScalar(1 + Math.random()),
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
