/**
 * Rocket Launcher
 * Fires explosive rockets with area damage
 */

import * as THREE from 'three';
import { ProjectileWeapon } from '../ProjectileWeapon';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { WeaponType } from '../WeaponConfig';
import { ProjectileManager } from '../ProjectileManager';

export class RocketLauncher extends ProjectileWeapon {
    private projectileManager: ProjectileManager;

    constructor(
        type: WeaponType,
        world: PhysicsWorld,
        scene: THREE.Scene,
        projectileManager: ProjectileManager
    ) {
        super(type, world, scene, {
            damage: 100, // High burst damage
            radius: 5, // Explosion radius in meters
            speed: 40, // Rocket speed (m/s)
            gravity: -5, // Reduced gravity for rockets
            lifetime: 3, // Seconds before self-destruct
            owner: 'player'
        });

        this.projectileManager = projectileManager;
    }

    /**
     * Fire rocket
     */
    protected createProjectile(origin: THREE.Vector3, direction: THREE.Vector3): void {
        // Offset origin to simulate rocket launcher position
        const rocketOrigin = origin.clone();
        rocketOrigin.addScaledVector(direction, 0.5);
        rocketOrigin.y -= 0.1;

        this.projectileManager.spawnProjectile(
            'rocket',
            rocketOrigin,
            direction,
            this.projectileConfig
        );
    }
}
