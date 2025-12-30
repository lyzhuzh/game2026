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
     * Raycast test - optimized using Cannon-es built-in raycasting
     * @param from - Start position
     * @param to - End position
     * @returns Raycast result or null
     */
    raycast(from: CANNON.Vec3, to: CANNON.Vec3): CANNON.RaycastResult | null {
        // Calculate direction
        const direction = to.vsub(from);
        const maxDistance = direction.length();
        direction.normalize();

        // Create ray and result
        const ray = new CANNON.Ray(from, to);
        const result = new CANNON.RaycastResult();
        result.reset();

        // Mode: closest hit
        ray.mode = CANNON.Ray.CLOSEST;
        ray.skipBackfaces = true;

        // Perform raycast against the world
        ray.intersectWorld(this.world, result);

        // Debug logging
        console.log(`[PhysicsWorld] Raycast: hasHit=${result.hasHit}, distance=${result.distance?.toFixed(2)}`);

        // Check if we hit something
        if (result.hasHit) {
            const body = result.body;
            console.log(`[PhysicsWorld] Hit body: type=${body.type}, mass=${body.mass}`);

            // Skip player body (kinematic with mass 0)
            if (body.type === CANNON.Body.KINEMATIC && body.mass === 0) {
                console.log(`[PhysicsWorld] Skipping player body`);
                return null;
            }

            // Skip ground (static with plane shape)
            if (body.type === CANNON.Body.STATIC &&
                body.shapes.some((s: any) => s instanceof CANNON.Plane)) {
                console.log(`[PhysicsWorld] Skipping ground`);
                return null;
            }

            // Calculate hit point from ray origin and distance
            const hitPoint = from.vadd(direction.scale(result.distance));

            console.log(`[PhysicsWorld] Valid hit at (${hitPoint.x.toFixed(1)}, ${hitPoint.y.toFixed(1)}, ${hitPoint.z.toFixed(1)})`);

            // Set hit point properties (compatibility with old code)
            result.hitPoint = hitPoint;
            result.hitPointWorld = hitPoint;

            // Set normal (use hitNormalWorld if available, otherwise use hitNormal)
            if (result.hasHit && result.hitNormalWorld) {
                result.hitNormal = result.hitNormalWorld;
            } else if (!result.hitNormal) {
                // Default normal facing back along ray direction
                result.hitNormal = direction.negate(result.hitNormal);
            }

            return result;
        }

        console.log(`[PhysicsWorld] No hit detected`);
        return null;
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
