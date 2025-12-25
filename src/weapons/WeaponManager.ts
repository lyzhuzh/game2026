/**
 * Weapon Manager
 * Manages weapon inventory and input handling
 */

import * as THREE from 'three';
import { HitscanWeapon } from './HitscanWeapon';
import { Weapon, FireResult } from './Weapon';
import { WeaponType } from './WeaponConfig';
import { InputManager } from '../input/InputManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { ProjectileManager } from './ProjectileManager';
import { RocketLauncher } from './projectiles/RocketLauncher';
import { Flamethrower } from './projectiles/Flamethrower';
import { ParticleSystem } from '../particles/ParticleSystem';

export interface WeaponManagerConfig {
    startingWeapon?: WeaponType;
    autoReload?: boolean;
    onHit?: (position: THREE.Vector3, damage: number) => void;
    onFire?: (weaponType: WeaponType) => void;
    onReload?: () => void;
    onSwitch?: (weaponType: WeaponType) => void;
    projectileManager?: ProjectileManager;
    particleSystem?: ParticleSystem;
    onFlamethrowerDamage?: (origin: THREE.Vector3, direction: THREE.Vector3, range: number, damage: number) => void;
}

export class WeaponManager {
    private input: InputManager;
    private world: PhysicsWorld;
    private scene: THREE.Scene;
    private autoReload: boolean;
    private onHit?: (position: THREE.Vector3, damage: number) => void;
    private onFire?: (weaponType: WeaponType) => void;
    private onReload?: () => void;
    private onSwitch?: (weaponType: WeaponType) => void;
    private projectileManager?: ProjectileManager;
    private particleSystem?: ParticleSystem;
    private onFlamethrowerDamage?: (origin: THREE.Vector3, direction: THREE.Vector3, range: number, damage: number) => void;

    private weapons: Map<WeaponType, Weapon> = new Map();
    private currentWeapon: Weapon | null = null;
    private weaponIndex: number = 0;
    private weaponTypes: WeaponType[] = [];

    // Firing state
    private isFiring: boolean = false;

    // For flamethrower continuous fire
    private flamethrower?: Flamethrower;

    constructor(world: PhysicsWorld, scene: THREE.Scene, config: WeaponManagerConfig = {}) {
        this.input = InputManager.getInstance();
        this.world = world;
        this.scene = scene;
        this.autoReload = config.autoReload ?? true;
        this.onHit = config.onHit;
        this.onFire = config.onFire;
        this.onReload = config.onReload;
        this.onSwitch = config.onSwitch;
        this.projectileManager = config.projectileManager;
        this.particleSystem = config.particleSystem;
        this.onFlamethrowerDamage = config.onFlamethrowerDamage;

        // Initialize default weapons
        this.initializeWeapons();

        // Equip starting weapon
        const startingWeapon = config.startingWeapon || 'pistol';
        this.equipWeapon(startingWeapon);
    }

    /**
     * Initialize all weapons
     */
    private initializeWeapons(): void {
        this.weaponTypes = ['pistol', 'rifle', 'shotgun', 'smg', 'sniper', 'rocket_launcher', 'flamethrower'];

        // Initialize hitscan weapons
        const hitscanTypes: WeaponType[] = ['pistol', 'rifle', 'shotgun', 'smg', 'sniper'];
        for (const type of hitscanTypes) {
            const weapon = new HitscanWeapon(type, this.world, this.scene);
            this.weapons.set(type, weapon);
        }

        // Initialize rocket launcher (requires ProjectileManager)
        if (this.projectileManager) {
            const rocketLauncher = new RocketLauncher('rocket_launcher', this.world, this.scene, this.projectileManager);
            this.weapons.set('rocket_launcher', rocketLauncher);
        }

        // Initialize flamethrower (requires ParticleSystem)
        if (this.particleSystem) {
            this.flamethrower = new Flamethrower('flamethrower', this.world, this.scene, this.particleSystem);
            // Set damage callback if provided
            if (this.onFlamethrowerDamage) {
                this.flamethrower.setOnDamage(this.onFlamethrowerDamage);
            }
            this.weapons.set('flamethrower', this.flamethrower);
        }
    }

    /**
     * Equip a weapon
     */
    private equipWeapon(type: WeaponType): void {
        const weapon = this.weapons.get(type);
        if (weapon) {
            const previousWeapon = this.currentWeapon;
            this.currentWeapon = weapon;
            this.weaponIndex = this.weaponTypes.indexOf(type);

            // Reset firing state when switching weapons
            this.isFiring = false;

            // Stop flamethrower if it was firing
            if (this.flamethrower) {
                this.flamethrower.stopFire();
            }

            // Call switch callback if weapon changed
            if (previousWeapon !== weapon && this.onSwitch) {
                this.onSwitch(type);
            }
        }
    }

    /**
     * Update weapon manager
     */
    update(deltaTime: number): void {
        // Update current weapon
        if (this.currentWeapon) {
            this.currentWeapon.update(deltaTime);
        }

        // Handle weapon switching
        this.handleWeaponSwitching();

        // Handle firing
        this.handleFiring();

        // Handle reload
        this.handleReload();
    }

    /**
     * Handle weapon switching input
     */
    private handleWeaponSwitching(): void {
        // Number keys 1-7 for weapon switching
        for (let i = 1; i <= 7; i++) {
            if (this.input.isActionJustPressed(`weapon_${i}` as any)) {
                const weaponType = this.weaponTypes[i - 1];
                if (weaponType) {
                    this.equipWeapon(weaponType);
                }
            }
        }

        // Scroll wheel for weapon switching
        const scrollInput = this.input.getScrollDelta();
        if (scrollInput !== 0) {
            const newIndex = this.weaponIndex + (scrollInput > 0 ? 1 : -1);
            if (newIndex >= 0 && newIndex < this.weaponTypes.length) {
                this.equipWeapon(this.weaponTypes[newIndex]);
            }
        }
    }

    /**
     * Handle firing input
     */
    private handleFiring(): void {
        if (!this.currentWeapon) {
            return;
        }

        const time = performance.now() / 1000;
        const attackInput = this.input.isActionPressed('attack');

        // Check if weapon is automatic
        const isAutomatic = this.currentWeapon.stats.isAutomatic;
        const isFlamethrower = this.currentWeapon.type === 'flamethrower';

        if (attackInput) {
            // Special handling for flamethrower - continuous fire
            if (isFlamethrower && this.flamethrower) {
                if (!this.isFiring) {
                    // First press - start firing
                    const result = this.flamethrower.fire(
                        this.getFireOrigin(),
                        this.getFireDirection(),
                        time
                    );
                    if (result) {
                        this.isFiring = true;
                        if (this.onFire) {
                            this.onFire(this.currentWeapon.type);
                        }
                    }
                }
                // Flamethrower's update method handles continuous damage
            } else if (isAutomatic || !this.isFiring) {
                // Normal weapon firing
                const result = this.currentWeapon.fire(
                    this.getFireOrigin(),
                    this.getFireDirection(),
                    time
                );

                if (result) {
                    this.isFiring = true;

                    // Call fire callback for sound
                    if (this.onFire) {
                        this.onFire(this.currentWeapon.type);
                    }

                    this.onFireResult(result);
                }
            }
        } else {
            this.isFiring = false;

            // Stop flamethrower continuous fire
            if (this.flamethrower) {
                this.flamethrower.stopFire();
            }
        }

        // Auto reload when empty
        if (this.autoReload && this.currentWeapon.getCurrentAmmo() === 0 && !this.currentWeapon.isReloading()) {
            if (this.currentWeapon.getReserveAmmo() > 0) {
                this.currentWeapon.startReload();
            }
        }
    }

    /**
     * Handle reload input
     */
    private handleReload(): void {
        if (this.input.isActionJustPressed('reload')) {
            if (this.currentWeapon && !this.currentWeapon.isReloading()) {
                this.currentWeapon.startReload();
                if (this.onReload) {
                    this.onReload();
                }
            }
        }
    }

    /**
     * Get fire origin (camera position)
     */
    private getFireOrigin(): THREE.Vector3 {
        // This will be set from camera position
        return new THREE.Vector3();
    }

    /**
     * Get fire direction (camera forward)
     */
    private getFireDirection(): THREE.Vector3 {
        // This will be set from camera direction
        return new THREE.Vector3();
    }

    /**
     * Set fire origin and direction from camera
     */
    setFireData(origin: THREE.Vector3, direction: THREE.Vector3): void {
        this.getFireOrigin = () => origin;
        this.getFireDirection = () => direction;

        // Also update flamethrower if active
        if (this.flamethrower) {
            this.flamethrower.setFireData(
                this.getFireOrigin,
                this.getFireDirection
            );
        }
    }

    /**
     * Handle fire result (visual effects, damage, etc.)
     */
    private onFireResult(result: FireResult): void {
        // Create muzzle flash at fire origin
        const origin = this.getFireOrigin();
        const direction = this.getFireDirection();

        // Handle hitscan weapons
        if (this.currentWeapon instanceof HitscanWeapon) {
            this.currentWeapon.createMuzzleFlash(origin, direction);

            // Create tracer if hit
            if (result.hit && result.position) {
                const distance = result.distance || 0;
                this.currentWeapon.createTracer(origin, direction, distance);

                // Apply damage to hit target
                if (this.onHit && result.position) {
                    this.onHit(result.position, this.currentWeapon.stats.damage);
                }
            }
        }

        // Projectile weapons handle their own visual effects via ProjectileManager
        // Flamethrower handles its own particle effects
    }

    /**
     * Get current weapon state for UI
     */
    getCurrentWeaponState() {
        if (!this.currentWeapon) {
            return null;
        }
        return {
            type: this.currentWeapon.type,
            state: this.currentWeapon.getState(),
            stats: this.currentWeapon.stats
        };
    }

    /**
     * Get all weapon types
     */
    getWeaponTypes(): WeaponType[] {
        return [...this.weaponTypes];
    }

    /**
     * Add reserve ammo to a weapon
     */
    addReserveAmmo(weaponType: string, amount: number): void {
        const weapon = this.weapons.get(weaponType as WeaponType);
        if (weapon) {
            weapon.addReserveAmmo(amount);
            console.log(`[WeaponManager] Added ${amount} ammo to ${weaponType}`);
        }
    }

    /**
     * Dispose
     */
    dispose(): void {
        this.weapons.clear();
        this.currentWeapon = null;
    }
}
