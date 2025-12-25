/**
 * Base Weapon Class
 * Abstract class for all weapon types
 */

import * as THREE from 'three';
import { WeaponType, WeaponStats, WeaponState, createWeaponState, WEAPON_CONFIGS } from './WeaponConfig';

// Re-export WeaponType for use in other modules
export type { WeaponType } from './WeaponConfig';

export interface FireResult {
    hit: boolean;
    position?: THREE.Vector3;
    normal?: THREE.Vector3;
    distance?: number;
}

export abstract class Weapon {
    public readonly type: WeaponType;
    public readonly stats: WeaponStats;
    protected state: WeaponState;

    constructor(type: WeaponType) {
        this.type = type;
        this.stats = WEAPON_CONFIGS[type];
        this.state = createWeaponState(type);
    }

    /**
     * Fire the weapon
     * @param origin - Firing position
     * @param direction - Firing direction
     * @param time - Current time
     * @returns Fire result
     */
    abstract fire(origin: THREE.Vector3, direction: THREE.Vector3, time: number): FireResult | null;

    /**
     * Check if weapon can fire
     */
    canFire(time: number): boolean {
        // Check if reloading
        if (this.state.isReloading) {
            return false;
        }

        // Check if has ammo
        if (this.state.currentAmmo <= 0) {
            return false;
        }

        // Check fire rate
        const timeSinceLastFire = time - this.state.lastFireTime;
        const minTimeBetweenShots = 1 / this.stats.fireRate;

        return timeSinceLastFire >= minTimeBetweenShots;
    }

    /**
     * Reload the weapon
     * @returns Remaining reserve ammo after reload
     */
    reload(): number {
        if (this.state.reserveAmmo <= 0) {
            return 0;
        }

        // Calculate ammo to add
        const ammoNeeded = this.stats.magazineSize - this.state.currentAmmo;
        const ammoToAdd = Math.min(ammoNeeded, this.state.reserveAmmo);

        this.state.currentAmmo += ammoToAdd;
        this.state.reserveAmmo -= ammoToAdd;

        return this.state.reserveAmmo;
    }

    /**
     * Start reload process
     */
    startReload(): void {
        if (!this.state.isReloading && this.state.currentAmmo < this.stats.magazineSize && this.state.reserveAmmo > 0) {
            this.state.isReloading = true;
            setTimeout(() => {
                this.reload();
                this.state.isReloading = false;
            }, this.stats.reloadTime * 1000);
        }
    }

    /**
     * Update weapon state
     */
    update(deltaTime: number): void {
        // Recover from recoil
        if (this.state.currentRecoil > 0) {
            this.state.currentRecoil -= this.stats.recoilRecovery * deltaTime;
            this.state.currentRecoil = Math.max(0, this.state.currentRecoil);
        }

        // Recover spread
        if (this.state.currentSpread > 0) {
            this.state.currentSpread -= this.state.currentSpread * 5 * deltaTime;
            this.state.currentSpread = Math.max(0, this.state.currentSpread);
        }
    }

    /**
     * Get current ammo count
     */
    getCurrentAmmo(): number {
        return this.state.currentAmmo;
    }

    /**
     * Get reserve ammo count
     */
    getReserveAmmo(): number {
        return this.state.reserveAmmo;
    }

    /**
     * Get magazine size
     */
    getMagazineSize(): number {
        return this.stats.magazineSize;
    }

    /**
     * Add reserve ammo
     */
    addReserveAmmo(amount: number): void {
        this.state.reserveAmmo += amount;
    }

    /**
     * Check if reloading
     */
    isReloading(): boolean {
        return this.state.isReloading;
    }

    /**
     * Calculate spread for this shot
     */
    protected calculateSpread(): number {
        // Base spread + current accumulated spread
        return this.stats.spread + this.state.currentSpread;
    }

    /**
     * Apply recoil
     */
    protected applyRecoil(): void {
        // Add recoil
        this.state.currentRecoil = Math.min(
            this.state.currentRecoil + this.stats.recoil,
            this.stats.recoil * 2 // Max recoil cap
        );

        // Add spread increase
        this.state.currentSpread = Math.min(
            this.state.currentSpread + this.stats.spread * 0.5,
            this.stats.spread * 2
        );
    }

    /**
     * Consume ammo
     */
    protected consumeAmmo(time: number): void {
        this.state.currentAmmo--;
        this.state.lastFireTime = time;
    }

    /**
     * Get weapon state for UI display
     */
    getState(): WeaponState {
        return { ...this.state };
    }
}
