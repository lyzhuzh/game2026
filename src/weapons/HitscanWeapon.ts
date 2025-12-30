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

        console.log(`[HitscanWeapon] Fire result: hit=${result.hit}, position=(${result.position?.x.toFixed(1)}, ${result.position?.y.toFixed(1)}, ${result.position?.z.toFixed(1)}), distance=${result.distance}`);

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
     * Enhanced with brighter, more visible tracer
     */
    createTracer(origin: THREE.Vector3, direction: THREE.Vector3, distance: number): void {
        // Create tracer geometry with better visibility
        const tracerLength = Math.min(distance, 10); // Extended tracer for better visibility
        const endPosition = origin.clone().addScaledVector(direction, tracerLength);

        // Create line geometry with thickness simulation (multiple lines)
        const points = [origin, endPosition];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        // Brighter, more visible tracer material
        const material = new THREE.LineBasicMaterial({
            color: 0xffff88, // Bright yellow-white
            transparent: true,
            opacity: 0.8,
            linewidth: 2 // Note: linewidth only works in some browsers
        });

        const line = new THREE.Line(geometry, material);
        this.scene.add(line);

        // Add a second line for "glow" effect
        const glowMaterial = new THREE.LineBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.4
        });
        const glowLine = new THREE.Line(geometry.clone(), glowMaterial);
        glowLine.position.x += 0.02; // Slight offset for glow
        glowLine.position.z += 0.02;
        this.scene.add(glowLine);

        // Fast fade out effect
        let opacity = 0.8;
        let frameCount = 0;
        const maxFrames = 8; // About 240ms at 30fps

        const fadeTracer = () => {
            frameCount++;
            opacity -= 0.1;

            if (frameCount >= maxFrames || opacity <= 0) {
                // Remove tracers
                this.scene.remove(line);
                this.scene.remove(glowLine);
                geometry.dispose();
                material.dispose();
                glowLine.geometry.dispose();
                glowMaterial.dispose();
            } else {
                material.opacity = opacity;
                glowMaterial.opacity = opacity * 0.5;
                requestAnimationFrame(fadeTracer);
            }
        };

        requestAnimationFrame(fadeTracer);
    }

    /**
     * Create muzzle flash effect
     * DISABLED - Using particle system instead
     */
    createMuzzleFlash(_position: THREE.Vector3, _direction: THREE.Vector3): void {
        // Muzzle flash disabled - particle system will handle it
        return;
    }
}
