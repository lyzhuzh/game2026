/**
 * Physics World
 * Cannon-es physics engine wrapper
 */

import * as CANNON from 'cannon-es';

export interface PhysicsWorldConfig {
    gravity?: number;
    broadphase?: 'Naive' | 'SAP';
    solverIterations?: number;
    tolerance?: number;
}

export class PhysicsWorld {
    private world: CANNON.World;
    private bodies: CANNON.Body[] = [];
    private materials: Map<string, CANNON.Material> = new Map();

    constructor(config: PhysicsWorldConfig = {}) {
        // Create physics world
        this.world = new CANNON.World();

        // Configure gravity
        this.world.gravity.set(0, config.gravity ?? -9.82, 0);

        // Configure broadphase (collision detection optimization)
        const broadphase = config.broadphase === 'SAP'
            ? new CANNON.SAPBroadphase(this.world)
            : new CANNON.NaiveBroadphase();
        this.world.broadphase = broadphase;

        // Configure solver
        this.world.solver.iterations = config.solverIterations ?? 10;
        this.world.solver.tolerance = config.tolerance ?? 0.001;

        // Create default materials
        this.createDefaultMaterials();
    }

    /**
     * Create default physics materials
     */
    private createDefaultMaterials(): void {
        // Default material
        const defaultMaterial = new CANNON.Material('default');
        this.materials.set('default', defaultMaterial);

        // Ground material
        const groundMaterial = new CANNON.Material('ground');
        this.materials.set('ground', groundMaterial);

        // Player material
        const playerMaterial = new CANNON.Material('player');
        this.materials.set('player', playerMaterial);

        // Material contact properties (friction, bounce)
        const defaultContactMaterial = new CANNON.ContactMaterial(
            defaultMaterial,
            defaultMaterial,
            {
                friction: 0.3,
                restitution: 0.3
            }
        );
        this.world.addContactMaterial(defaultContactMaterial);

        // Player-ground contact (lower friction for responsive movement)
        const playerGroundContact = new CANNON.ContactMaterial(
            playerMaterial,
            groundMaterial,
            {
                friction: 0.0, // No friction for direct velocity control
                restitution: 0.0
            }
        );
        this.world.addContactMaterial(playerGroundContact);
    }

    /**
     * Step physics simulation
     * @param fixedDelta - Fixed time step for physics
     */
    step(fixedDelta: number): void {
        this.world.step(fixedDelta);
    }

    /**
     * Add a body to the physics world
     */
    addBody(body: CANNON.Body): void {
        this.world.addBody(body);
        this.bodies.push(body);
    }

    /**
     * Remove a body from the physics world
     */
    removeBody(body: CANNON.Body): void {
        this.world.removeBody(body);
        const index = this.bodies.indexOf(body);
        if (index !== -1) {
            this.bodies.splice(index, 1);
        }
    }

    /**
     * Get a material by name
     */
    getMaterial(name: string): CANNON.Material | undefined {
        return this.materials.get(name);
    }

    /**
     * Get the underlying Cannon-es world
     */
    getWorld(): CANNON.World {
        return this.world;
    }

    /**
     * Get all bodies
     */
    getBodies(): CANNON.Body[] {
        return this.bodies;
    }

    /**
     * Raycast test - manual AABB intersection
     * @param from - Start position
     * @param to - End position
     * @returns Raycast result or null
     */
    raycast(from: CANNON.Vec3, to: CANNON.Vec3): CANNON.RaycastResult | null {
        // Calculate direction
        const direction = to.vsub(from);
        const maxDistance = direction.length();
        direction.normalize();

        // Find closest hit
        let closestResult: CANNON.RaycastResult | null = null;
        let closestDistance = maxDistance;

        for (const body of this.bodies) {
            // Skip player body (kinematic with mass 0)
            if (body.type === CANNON.Body.KINEMATIC && body.mass === 0) {
                continue;
            }

            // Skip ground (static with plane shape)
            if (body.type === CANNON.Body.STATIC && body.shapes.some((s: any) => s instanceof CANNON.Plane)) {
                continue;
            }

            // Check if body is a Box shape (enemies)
            const shape = body.shapes[0];
            if (shape instanceof CANNON.Box) {
                // Get box half extents
                const halfExtents = (shape as CANNON.Box).halfExtents;

                // Simple ray-box intersection test
                // Transform ray to local space of the box
                const rayLocalFrom = from.vsub(body.position);
                const rayLocalDir = direction.clone();

                // Rotate by inverse of body quaternion
                const invQuat = body.quaternion.inverse();
                invQuat.vmult(rayLocalFrom, rayLocalFrom);
                invQuat.vmult(rayLocalDir, rayLocalDir);

                // AABB slab method for ray-box intersection
                let tMin = -Infinity;
                let tMax = Infinity;

                for (let i = 0; i < 3; i++) {
                    const axis = ['x', 'y', 'z'][i];
                    const min = -halfExtents[axis];
                    const max = halfExtents[axis];
                    const origin = rayLocalFrom[axis];
                    const dir = rayLocalDir[axis];

                    if (Math.abs(dir) < 0.0001) {
                        // Ray parallel to slab
                        if (origin < min || origin > max) {
                            tMin = Infinity;
                            tMax = -Infinity;
                        }
                    } else {
                        let t1 = (min - origin) / dir;
                        let t2 = (max - origin) / dir;
                        if (t1 > t2) {
                            const temp = t1;
                            t1 = t2;
                            t2 = temp;
                        }
                        tMin = Math.max(tMin, t1);
                        tMax = Math.min(tMax, t2);
                    }
                }

                // Check if intersection is valid
                if (tMin <= tMax && tMax >= 0 && tMin < maxDistance) {
                    const hitDistance = Math.max(0, tMin);
                    if (hitDistance < closestDistance) {
                        closestDistance = hitDistance;
                        closestResult = new CANNON.RaycastResult();
                        closestResult.hasHit = true;
                        closestResult.body = body;
                        closestResult.distance = hitDistance;

                        // Calculate hit point in world space
                        const hitPoint = from.clone();
                        hitPoint.vadd(direction.scale(hitDistance), hitPoint);
                        closestResult.hitPointWorld = hitPoint;
                        closestResult.hitPoint = hitPoint;

                        // Set normal (default to facing the ray direction)
                        closestResult.hitNormal = direction.clone().scale(-1);
                    }
                }
            }
        }

        return closestResult;
    }

    /**
     * Clear all bodies
     */
    clear(): void {
        for (const body of this.bodies) {
            this.world.removeBody(body);
        }
        this.bodies = [];
    }

    /**
     * Dispose physics world
     */
    dispose(): void {
        this.clear();
        this.materials.clear();
    }
}
