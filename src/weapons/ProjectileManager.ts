/**
 * Projectile Manager
 * Manages all in-flight projectiles (rockets, grenades, etc.)
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { ParticleSystem } from '../particles/ParticleSystem';
import { ProjectileConfig } from './ProjectileWeapon';

export interface ProjectileData {
    mesh: THREE.Mesh;
    body: any;
    velocity: THREE.Vector3;
    config: ProjectileConfig;
    lifetime: number;
    maxLifetime: number;
    active: boolean;
}

export class ProjectileManager {
    private projectiles: ProjectileData[] = [];
    private scene: THREE.Scene;
    private physics: PhysicsWorld;
    private particles: ParticleSystem;
    private onHitCallbacks: Map<string, (position: THREE.Vector3, projectile: ProjectileData) => void> = new Map();
    private onExplosionDamage?: (position: THREE.Vector3, radius: number, damage: number) => void;

    constructor(scene: THREE.Scene, physics: PhysicsWorld, particles: ParticleSystem) {
        this.scene = scene;
        this.physics = physics;
        this.particles = particles;
    }

    /**
     * Set callback for explosion damage
     */
    setOnExplosionDamage(callback: (position: THREE.Vector3, radius: number, damage: number) => void): void {
        this.onExplosionDamage = callback;
    }

    /**
     * Register a hit callback for a projectile type
     */
    registerOnHit(type: string, callback: (position: THREE.Vector3, projectile: ProjectileData) => void): void {
        this.onHitCallbacks.set(type, callback);
    }

    /**
     * Spawn a new projectile
     */
    spawnProjectile(
        type: string,
        position: THREE.Vector3,
        direction: THREE.Vector3,
        config: ProjectileConfig
    ): void {
        // Create visual mesh
        const mesh = this.createProjectileMesh(type);
        mesh.position.copy(position);
        mesh.castShadow = true;
        this.scene.add(mesh);

        // Create physics body
        const body = this.createProjectileBody(position, config.radius || 0.2);
        this.physics.addBody(body);

        // Calculate velocity
        const velocity = direction.clone().multiplyScalar(config.speed);

        const projectile: ProjectileData = {
            mesh,
            body,
            velocity,
            config,
            lifetime: config.lifetime,
            maxLifetime: config.lifetime,
            active: true
        };

        this.projectiles.push(projectile);
    }

    /**
     * Update all projectiles
     */
    update(deltaTime: number): void {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];

            if (!projectile.active) continue;

            // Update lifetime
            projectile.lifetime -= deltaTime;

            // Check if expired
            if (projectile.lifetime <= 0) {
                this.explodeProjectile(projectile);
                this.removeProjectile(i);
                continue;
            }

            // Apply gravity
            projectile.velocity.y += projectile.config.gravity * deltaTime;

            // Update position
            const position = projectile.mesh.position;
            position.add(projectile.velocity.clone().multiplyScalar(deltaTime));

            // Update physics body position
            projectile.body.position.set(position.x, position.y, position.z);

            // Update rotation (face direction of movement)
            if (projectile.velocity.length() > 0.1) {
                const angle = Math.atan2(projectile.velocity.x, projectile.velocity.z);
                projectile.mesh.rotation.y = angle;
            }

            // Check for collisions
            if (this.checkCollision(projectile)) {
                this.explodeProjectile(projectile);
                this.removeProjectile(i);
            }
        }
    }

    /**
     * Create visual mesh for projectile
     */
    private createProjectileMesh(type: string): THREE.Mesh {
        let geometry: THREE.BufferGeometry;
        let material: THREE.Material;

        switch (type) {
            case 'rocket':
                geometry = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8);
                material = new THREE.MeshStandardMaterial({
                    color: 0x444444,
                    roughness: 0.5,
                    metalness: 0.8
                });
                break;

            case 'grenade':
                geometry = new THREE.SphereGeometry(0.12, 16, 16);
                material = new THREE.MeshStandardMaterial({
                    color: 0x2a2a2a,
                    roughness: 0.6,
                    metalness: 0.3
                });
                break;

            case 'flame':
                geometry = new THREE.SphereGeometry(0.15, 8, 8);
                material = new THREE.MeshStandardMaterial({
                    color: 0xff6600,
                    emissive: 0xff4400,
                    emissiveIntensity: 0.5
                });
                break;

            default:
                geometry = new THREE.SphereGeometry(0.1, 8, 8);
                material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        }

        return new THREE.Mesh(geometry, material);
    }

    /**
     * Create physics body for projectile
     */
    private createProjectileBody(position: THREE.Vector3, radius: number): any {
        const shape = new CANNON.Sphere(radius);
        const body = new CANNON.Body({
            mass: 1,
            type: CANNON.Body.DYNAMIC,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            shape: shape,
            fixedRotation: false,
            linearDamping: 0.01,
            angularDamping: 0.01
        });

        return body;
    }

    /**
     * Check collision with environment
     */
    private checkCollision(projectile: ProjectileData): boolean {
        const pos = projectile.mesh.position;

        // Check ground collision
        if (pos.y <= 0.2) {
            return true;
        }

        // Check boundary collision (assuming 100x100 arena)
        const bounds = 50;
        if (Math.abs(pos.x) > bounds || Math.abs(pos.z) > bounds) {
            return true;
        }

        // TODO: Check collision with enemies/obstacles
        return false;
    }

    /**
     * Explode projectile
     */
    private explodeProjectile(projectile: ProjectileData): void {
        // Create explosion particle effect
        this.particles.explosion(projectile.mesh.position, projectile.config.radius || 1);

        // Apply damage in radius
        this.applyExplosionDamage(projectile.mesh.position, projectile.config.radius || 1, projectile.config.damage);

        // Call hit callback
        const callback = this.onHitCallbacks.get('projectile');
        if (callback) {
            callback(projectile.mesh.position, projectile);
        }
    }

    /**
     * Apply explosion damage to nearby entities
     */
    private applyExplosionDamage(position: THREE.Vector3, radius: number, damage: number): void {
        if (this.onExplosionDamage) {
            this.onExplosionDamage(position, radius, damage);
        }
    }

    /**
     * Remove projectile
     */
    private removeProjectile(index: number): void {
        const projectile = this.projectiles[index];
        if (!projectile) return;

        // Remove from scene
        this.scene.remove(projectile.mesh);

        // Remove from physics
        this.physics.removeBody(projectile.body);

        // Dispose
        (projectile.mesh.geometry as THREE.BufferGeometry).dispose();
        (projectile.mesh.material as THREE.Material).dispose();

        // Remove from array
        this.projectiles.splice(index, 1);
    }

    /**
     * Clear all projectiles
     */
    clear(): void {
        while (this.projectiles.length > 0) {
            this.removeProjectile(0);
        }
    }

    /**
     * Get active projectile count
     */
    getActiveCount(): number {
        return this.projectiles.filter(p => p.active).length;
    }
}

export default ProjectileManager;
