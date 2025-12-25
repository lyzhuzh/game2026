/**
 * Flamethrower
 * Fires continuous stream of fire particles
 */

import * as THREE from 'three';
import { Weapon, FireResult, WeaponType } from '../Weapon';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { ParticleSystem } from '../../particles/ParticleSystem';

export class Flamethrower extends Weapon {
    private particles: ParticleSystem;
    private isFiring: boolean = false;
    private fireTimer: number = 0;
    private damageTimer: number = 0;
    private fireInterval: number = 0.05; // Spawn particles every 50ms
    private damageInterval: number = 0.15; // Apply damage every 150ms (more frequent)

    // Store reference for getting fire origin/direction
    private getFireOrigin: () => THREE.Vector3 = () => new THREE.Vector3();
    private getFireDirection: () => THREE.Vector3 = () => new THREE.Vector3(0, 0, -1);

    // Callback for applying damage
    private onDamageCallback?: (origin: THREE.Vector3, direction: THREE.Vector3, range: number, damage: number) => void;

    constructor(
        type: WeaponType,
        _world: PhysicsWorld,
        _scene: THREE.Scene,
        particles: ParticleSystem
    ) {
        super(type);
        this.particles = particles;
    }

    /**
     * Set fire data callbacks
     */
    setFireData(
        getOrigin: () => THREE.Vector3,
        getDirection: () => THREE.Vector3
    ): void {
        this.getFireOrigin = getOrigin;
        this.getFireDirection = getDirection;
    }

    /**
     * Set damage callback
     */
    setOnDamage(callback: (origin: THREE.Vector3, direction: THREE.Vector3, range: number, damage: number) => void): void {
        this.onDamageCallback = callback;
    }

    /**
     * Start firing
     */
    startFiring(): void {
        this.isFiring = true;
    }

    /**
     * Stop firing
     */
    stopFiring(): void {
        this.isFiring = false;
    }

    /**
     * Fire method (called on first press)
     */
    fire(origin: THREE.Vector3, direction: THREE.Vector3, time: number): FireResult | null {
        if (!this.canFire(time)) {
            return null;
        }

        // Start continuous fire
        this.isFiring = true;
        this.fireTimer = 0;
        this.damageTimer = 0;

        // Spawn initial burst
        this.spawnFlameParticles();

        // Consume ammo
        this.consumeAmmo(time);
        this.applyRecoil();

        return {
            hit: false,
            position: origin.clone().addScaledVector(direction, 1),
            distance: 0
        };
    }

    /**
     * Update flamethrower (call continuously while firing)
     */
    update(deltaTime: number): void {
        // Call parent update for recoil recovery
        super.update(deltaTime);

        if (!this.isFiring) {
            return;
        }

        this.fireTimer += deltaTime;
        this.damageTimer += deltaTime;

        // Spawn particles
        if (this.fireTimer >= this.fireInterval) {
            this.fireTimer = 0;
            this.spawnFlameParticles();

            // Continuously consume ammo while firing
            if (this.state.currentAmmo > 0) {
                this.state.currentAmmo = Math.max(0, this.state.currentAmmo - 0.1);
            } else {
                this.isFiring = false;
            }
        }

        // Apply damage over time
        if (this.damageTimer >= this.damageInterval) {
            this.damageTimer = 0;
            this.applyDamage();
        }
    }

    /**
     * Stop firing (called by WeaponManager)
     */
    stopFire(): void {
        this.isFiring = false;
    }

    /**
     * Check if currently firing
     */
    getIsFiring(): boolean {
        return this.isFiring;
    }

    /**
     * Apply damage in cone
     */
    private applyDamage(): void {
        if (!this.onDamageCallback || !this.isFiring) return;

        const origin = this.getFireOrigin();
        const direction = this.getFireDirection();

        // Damage per tick (damage per second * interval)
        const damagePerTick = this.stats.damage * this.damageInterval;

        this.onDamageCallback(origin.clone(), direction.clone(), this.stats.range, damagePerTick);
    }

    /**
     * Spawn flame particles
     */
    private spawnFlameParticles(): void {
        const origin = this.getFireOrigin();
        const direction = this.getFireDirection();

        // Offset origin slightly in front of player (simulate weapon position)
        const spawnOrigin = origin.clone().addScaledVector(direction, 0.5);

        // Spawn multiple flame particles in a cone
        const particleCount = 12;
        const spread = 0.25; // Spread angle in radians

        for (let i = 0; i < particleCount; i++) {
            // Add random spread to direction
            const spreadDir = direction.clone();
            spreadDir.x += (Math.random() - 0.5) * spread;
            spreadDir.y += (Math.random() - 0.5) * spread * 0.5;
            spreadDir.z += (Math.random() - 0.5) * spread;
            spreadDir.normalize();

            // Random flame color (yellow to red)
            const flameColor = Math.random() > 0.5 ? 0xffaa00 : 0xff4400;

            // Create flame particle - use explosion type for better visibility
            this.particles.emit({
                type: 'explosion',
                position: spawnOrigin.clone(),
                count: 1,
                color: flameColor,
                size: 0.8 + Math.random() * 0.8, // Larger particles (0.8 - 1.6)
                lifetime: 0.5 + Math.random() * 0.4, // Longer lifetime
                velocity: spreadDir.multiplyScalar(15 + Math.random() * 8), // Faster velocity
                gravity: -2, // Less gravity
                fadeOut: true
            });
        }
    }
}
