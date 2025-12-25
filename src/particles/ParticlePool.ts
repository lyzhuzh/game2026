/**
 * Particle Pool
 * Object pool for efficient particle memory management
 */

import * as THREE from 'three';
import { Particle, ParticleConfig, randomRange } from './ParticleTypes';

export class ParticlePool {
    private particles: Particle[] = [];
    private active: Particle[] = [];
    private scene: THREE.Scene;
    private maxSize: number;
    private camera?: THREE.Camera;

    constructor(scene: THREE.Scene, maxSize: number = 1000) {
        this.scene = scene;
        this.maxSize = maxSize;
    }

    /**
     * Set camera for billboarding
     */
    setCamera(camera: THREE.Camera): void {
        this.camera = camera;
    }

    /**
     * Acquire a particle from the pool or create new one
     */
    acquire(config: ParticleConfig): Particle {
        let particle: Particle;

        // Try to get from inactive pool
        if (this.particles.length > 0) {
            particle = this.particles.pop()!;
        } else {
            // Create new particle
            particle = this.createParticle();
        }

        // Configure particle
        this.configureParticle(particle, config);

        // Add to scene and active list
        this.scene.add(particle.mesh);
        particle.active = true;
        this.active.push(particle);

        return particle;
    }

    /**
     * Release particle back to pool
     */
    release(particle: Particle): void {
        particle.active = false;
        particle.mesh.visible = false;

        // Remove from scene
        this.scene.remove(particle.mesh);

        // Remove from active list
        const index = this.active.indexOf(particle);
        if (index !== -1) {
            this.active.splice(index, 1);
        }

        // Return to pool (if not at max size)
        if (this.particles.length < this.maxSize) {
            this.particles.push(particle);
        } else {
            // Destroy particle if pool is full
            this.destroyParticle(particle);
        }
    }

    /**
     * Update all active particles
     */
    update(deltaTime: number): void {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const particle = this.active[i];

            // Update lifetime
            particle.lifetime -= deltaTime;

            // Check if dead
            if (particle.lifetime <= 0) {
                this.release(particle);
                continue;
            }

            // Apply gravity
            if (particle.gravity !== 0 && !particle.stickToSurface) {
                particle.velocity.y += particle.gravity * deltaTime;
            }

            // Update position
            particle.mesh.position.add(
                particle.velocity.clone().multiplyScalar(deltaTime)
            );

            // Billboard: make particle face camera
            if (this.camera) {
                particle.mesh.lookAt(this.camera.position);
            }

            // Update rotation
            if (particle.rotationSpeed) {
                particle.mesh.rotation.x += particle.rotationSpeed.x * deltaTime;
                particle.mesh.rotation.y += particle.rotationSpeed.y * deltaTime;
                particle.mesh.rotation.z += particle.rotationSpeed.z * deltaTime;
            }

            // Update opacity (fade out)
            if (particle.fadeOut) {
                const lifePercent = particle.lifetime / particle.maxLifetime;
                const material = particle.mesh.material as THREE.MeshStandardMaterial;
                if (material.transparent) {
                    material.opacity = lifePercent;
                }
            }

            // Check ground collision
            if (particle.mesh.position.y <= 0.05 && !particle.stickToSurface) {
                particle.mesh.position.y = 0.05;
                particle.velocity.set(0, 0, 0);
                particle.stickToSurface = true;
            }
        }
    }

    /**
     * Get active particle count
     */
    getActiveCount(): number {
        return this.active.length;
    }

    /**
     * Clear all particles
     */
    clear(): void {
        // Release all active particles
        while (this.active.length > 0) {
            this.release(this.active[0]);
        }

        // Clear pool
        for (const particle of this.particles) {
            this.destroyParticle(particle);
        }
        this.particles = [];
    }

    /**
     * Create a new particle
     */
    private createParticle(): Particle {
        // Use plane geometry for billboarding (always faces camera)
        const geometry = new THREE.PlaneGeometry(0.1, 0.1);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0x000000,
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.visible = false;
        mesh.castShadow = false;
        mesh.receiveShadow = false;

        return {
            mesh,
            velocity: new THREE.Vector3(),
            lifetime: 0,
            maxLifetime: 0,
            gravity: -9.8,
            fadeOut: true,
            active: false
        };
    }

    /**
     * Configure particle with settings
     */
    private configureParticle(particle: Particle, config: ParticleConfig): void {
        // Position
        particle.mesh.position.copy(config.position);

        // Color
        const color = config.color || 0xffffff;
        const material = particle.mesh.material as THREE.MeshStandardMaterial;
        material.color.setHex(color);

        // For muzzle flash and similar effects, use emissive to make it glow
        if (config.type === 'muzzle_flash') {
            material.emissive.setHex(color);
            material.emissiveIntensity = 0.3; // Lower intensity
        } else if (config.type === 'explosion' || config.type === 'spark') {
            material.emissive.setHex(color);
            material.emissiveIntensity = 1.0; // Higher intensity for better visibility
        } else {
            material.emissive.setHex(0x000000);
            material.emissiveIntensity = 0;
        }

        // Size
        const size = typeof config.size === 'number'
            ? config.size
            : randomRange((config.size as { min: number; max: number }).min, (config.size as { min: number; max: number }).max);
        particle.mesh.scale.set(size, size, size);

        // Lifetime
        particle.maxLifetime = typeof config.lifetime === 'number'
            ? config.lifetime
            : randomRange((config.lifetime as { min: number; max: number }).min, (config.lifetime as { min: number; max: number }).max);
        particle.lifetime = particle.maxLifetime;

        // Velocity
        if (config.velocity instanceof THREE.Vector3) {
            particle.velocity.copy(config.velocity);
        } else if (config.normal) {
            // Use normal for surface-aligned particles
            const velConfig = config.velocity as { min: number; max: number };
            const speed = randomRange(velConfig.min, velConfig.max);
            particle.velocity.copy(config.normal).multiplyScalar(speed);
            particle.velocity.y += Math.random() * 2; // Add some upward velocity
        } else {
            // Random spherical velocity
            const velConfig = config.velocity as { min: number; max: number } | undefined;
            const minSpeed = velConfig?.min || 1;
            const maxSpeed = velConfig?.max || 5;
            const speed = randomRange(minSpeed, maxSpeed);
            particle.velocity.set(
                (Math.random() - 0.5) * speed,
                Math.random() * speed,
                (Math.random() - 0.5) * speed
            );
        }

        // Gravity
        particle.gravity = config.gravity ?? -9.8;

        // Fade out
        particle.fadeOut = config.fadeOut ?? true;
        material.transparent = particle.fadeOut;
        material.opacity = 1;

        // Stick to surface
        particle.stickToSurface = config.stickToSurface ?? false;

        // Rotation speed
        if (config.rotationSpeed) {
            particle.rotationSpeed = config.rotationSpeed.clone();
        } else {
            particle.rotationSpeed = undefined;
        }

        // Reset rotation
        particle.mesh.rotation.set(0, 0, 0);

        // Make visible
        particle.mesh.visible = true;
    }

    /**
     * Destroy particle and free resources
     */
    private destroyParticle(particle: Particle): void {
        particle.mesh.geometry.dispose();
        (particle.mesh.material as THREE.Material).dispose();
    }
}
