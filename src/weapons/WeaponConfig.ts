/**
 * Weapon Configuration
 * Defines weapon properties and statistics
 */

export type WeaponType =
    | 'pistol'
    | 'rifle'
    | 'shotgun'
    | 'smg'
    | 'sniper'
    | 'melee'
    | 'rocket_launcher'
    | 'flamethrower';

export interface WeaponStats {
    // Damage
    damage: number;
    headshotMultiplier: number;

    // Fire rate
    fireRate: number; // Shots per second
    isAutomatic: boolean;

    // Ammunition
    magazineSize: number;
    reserveAmmo: number;
    reloadTime: number;

    // Accuracy
    spread: number; // Radians
    recoil: number;
    recoilRecovery: number;

    // Range
    range: number; // Maximum effective range in meters

    // Visual/Audio
    muzzleFlashSize: number;
    muzzleLightColor: number;
    soundRange: number;
}

export const WEAPON_CONFIGS: Record<WeaponType, WeaponStats> = {
    pistol: {
        damage: 25,
        headshotMultiplier: 2.0,
        fireRate: 2.0,
        isAutomatic: false,
        magazineSize: 12,
        reserveAmmo: 60,
        reloadTime: 1.5,
        spread: 0.01,
        recoil: 0.1,
        recoilRecovery: 5.0,
        range: 50,
        muzzleFlashSize: 0.5,
        muzzleLightColor: 0xffaa00,
        soundRange: 30
    },

    rifle: {
        damage: 20,  // 30 -> 20
        headshotMultiplier: 2.0,
        fireRate: 8.0,  // 10 -> 8
        isAutomatic: true,
        magazineSize: 30,
        reserveAmmo: 180,
        reloadTime: 2.0,
        spread: 0.02,
        recoil: 0.15,
        recoilRecovery: 8.0,
        range: 100,
        muzzleFlashSize: 0.8,
        muzzleLightColor: 0xffaa00,
        soundRange: 50
    },  // 160 DPS (was 300)

    shotgun: {
        damage: 8,  // 15 -> 8 (per pellet)
        headshotMultiplier: 1.5,
        fireRate: 1.0,  // 1.2 -> 1.0
        isAutomatic: false,
        magazineSize: 8,
        reserveAmmo: 32,
        reloadTime: 2.5,
        spread: 0.15,
        recoil: 0.4,
        recoilRecovery: 3.0,
        range: 20,
        muzzleFlashSize: 1.2,
        muzzleLightColor: 0xff8800,
        soundRange: 60
    },  // Note: Should fire multiple pellets

    smg: {
        damage: 12,  // 18 -> 12
        headshotMultiplier: 1.8,
        fireRate: 12.0,  // 15 -> 12
        isAutomatic: true,
        magazineSize: 30,  // 25 -> 30
        reserveAmmo: 150,
        reloadTime: 1.8,
        spread: 0.05,  // 0.04 -> 0.05
        recoil: 0.08,
        recoilRecovery: 10.0,
        range: 40,
        muzzleFlashSize: 0.6,
        muzzleLightColor: 0xffaa00,
        soundRange: 35
    },  // 144 DPS (was 270)

    sniper: {
        damage: 150,  // 100 -> 150
        headshotMultiplier: 3.0,
        fireRate: 0.6,  // 0.5 -> 0.6
        isAutomatic: false,
        magazineSize: 5,
        reserveAmmo: 20,
        reloadTime: 3.0,
        spread: 0.001,
        recoil: 0.8,
        recoilRecovery: 2.0,
        range: 300,
        muzzleFlashSize: 1.5,
        muzzleLightColor: 0xffcc00,
        soundRange: 70
    },  // 90 DPS but high burst

    melee: {
        damage: 50,
        headshotMultiplier: 1.0,
        fireRate: 1.0,
        isAutomatic: false,
        magazineSize: Infinity,
        reserveAmmo: Infinity,
        reloadTime: 0,
        spread: 0,
        recoil: 0.2,
        recoilRecovery: 2.0,
        range: 2,
        muzzleFlashSize: 0,
        muzzleLightColor: 0xffffff,
        soundRange: 10
    },

    rocket_launcher: {
        damage: 100, // High burst damage
        headshotMultiplier: 1.0,
        fireRate: 0.4, // Slow fire rate
        isAutomatic: false,
        magazineSize: 3,
        reserveAmmo: 12,
        reloadTime: 4.0,
        spread: 0.005,
        recoil: 0.8,
        recoilRecovery: 2.0,
        range: 200, // Long range
        muzzleFlashSize: 2.0,
        muzzleLightColor: 0xff4400,
        soundRange: 100
    },

    flamethrower: {
        damage: 40, // Damage per second (increased from 15)
        headshotMultiplier: 1.0,
        fireRate: 2, // Lower fireRate for canFire check (allows continuous fire)
        isAutomatic: true,
        magazineSize: 100, // Fuel tank
        reserveAmmo: 200,
        reloadTime: 3.0,
        spread: 0.3, // Wide spread
        recoil: 0.05,
        recoilRecovery: 3.0,
        range: 12, // Short range
        muzzleFlashSize: 1.0,
        muzzleLightColor: 0xff6600,
        soundRange: 40
    }
};

export interface WeaponState {
    currentAmmo: number;
    reserveAmmo: number;
    isReloading: boolean;
    lastFireTime: number;
    currentSpread: number;
    currentRecoil: number;
}

export function createWeaponState(type: WeaponType): WeaponState {
    const config = WEAPON_CONFIGS[type];
    return {
        currentAmmo: config.magazineSize,
        reserveAmmo: config.reserveAmmo,
        isReloading: false,
        lastFireTime: 0,
        currentSpread: 0,
        currentRecoil: 0
    };
}
