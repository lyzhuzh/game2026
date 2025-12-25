/**
 * Hitscan Weapon
 * Instant-hit raycast weapon (pistol, rifle, sniper, etc.)
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Weapon, FireResult } from './Weapon';
import { WeaponType } from './WeaponConfig';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export class HitscanWeapon extends Weapon {
    private world: PhysicsWorld;
    private scene: THREE.Scene;

    constructor(type: WeaponType, world: PhysicsWorld, scene: THREE.Scene) {
        super(type);
        this.world = world;
        this.scene = scene;
    }

    /**
     * Fire the weapon
     */
    fire(origin: THREE.Vector3, direction: THREE.Vector3, time: number): FireResult | null {
        if (!this.canFire(time)) {
            return null;
        }

        // Calculate spread
        const spreadAngle = this.calculateSpread();

        // Apply spread to direction
        const spreadDirection = this.applySpread(direction, spreadAngle);

        // Perform raycast
        const result = this.performRaycast(origin, spreadDirection);

        // Consume ammo
        this.consumeAmmo(time);

        // Apply recoil
        this.applyRecoil();

        return result;
    }

    /**
     * Apply spread to firing direction
     */
    private applySpread(direction: THREE.Vector3, spreadAngle: number): THREE.Vector3 {
        if (spreadAngle === 0) {
            return direction.clone();
        }

        // Create a random spread vector
        const spreadX = (Math.random() - 0.5) * spreadAngle;
        const spreadY = (Math.random() - 0.5) * spreadAngle;

        // Get perpendicular vectors to direction
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(direction, up).normalize();
        const realUp = new THREE.Vector3().crossVectors(right, direction).normalize();

        // Apply spread
        const spreadDir = direction.clone();
        spreadDir.addScaledVector(right, spreadX);
        spreadDir.addScaledVector(realUp, spreadY);
        spreadDir.normalize();

        return spreadDir;
    }

    /**
     * Perform raycast for hit detection
     */
    private performRaycast(origin: THREE.Vector3, direction: THREE.Vector3): FireResult {
        const maxDistance = this.stats.range;

        // Convert to cannon-es vectors
        const from = new CANNON.Vec3(origin.x, origin.y, origin.z);
        const to = new CANNON.Vec3(
            origin.x + direction.x * maxDistance,
            origin.y + direction.y * maxDistance,
            origin.z + direction.z * maxDistance
        );

        // Perform physics raycast
        const physicsResult = this.world.raycast(from, to);

        if (physicsResult && physicsResult.hasHit) {
            return {
                hit: true,
                position: new THREE.Vector3(
                    physicsResult.hitPoint.x,
                    physicsResult.hitPoint.y,
                    physicsResult.hitPoint.z
                ),
                normal: new THREE.Vector3(
                    physicsResult.hitNormal.x,
                    physicsResult.hitNormal.y,
                    physicsResult.hitNormal.z
                ),
                distance: physicsResult.distance || 0
            };
        }

        // No hit
        return {
            hit: false
        };
    }

    /**
     * Create visual tracer effect
     */
    createTracer(origin: THREE.Vector3, direction: THREE.Vector3, distance: number): void {
        // Create tracer geometry
        const tracerLength = Math.min(distance, 5); // Tracer extends 5m or to hit point
        const endPosition = origin.clone().addScaledVector(direction, tracerLength);

        // Create line geometry
        const points = [origin, endPosition];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        // Create line material - use white instead of yellow
        const material = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3
        });

        const line = new THREE.Line(geometry, material);
        this.scene.add(line);

        // Fade out and remove - faster fade
        let opacity = 0.3;
        const fadeInterval = setInterval(() => {
            opacity -= 0.15;
            if (opacity <= 0) {
                clearInterval(fadeInterval);
                this.scene.remove(line);
                geometry.dispose();
                material.dispose();
            } else {
                material.opacity = opacity;
            }
        }, 30);
    }

    /**
     * Create muzzle flash effect
     * DISABLED - Using particle system instead
     */
    createMuzzleFlash(_position: THREE.Vector3, _direction: THREE.Vector3): void {
        // Muzzle flash disabled - yellow sprite was the issue
        // Particle system will handle muzzle flash effects
        return;
    }
}
