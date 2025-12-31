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
     * Raycast test - mixed approach for maximum compatibility
     * Uses Cannon.js for static bodies, custom check for dynamic bodies (enemies)
     * @param from - Start position
     * @param to - End position
     * @returns Raycast result or null
     */
    raycast(from: CANNON.Vec3, to: CANNON.Vec3): CANNON.RaycastResult | null {
        // Calculate direction
        const direction = to.vsub(from);
        direction.normalize();

        // Create ray and result
        const ray = new CANNON.Ray(from, to);
        const result = new CANNON.RaycastResult();
        result.reset();

        // Mode: closest hit
        ray.mode = CANNON.Ray.CLOSEST;
        ray.skipBackfaces = true;

        // Set collision filter to detect ALL bodies
        ray.collisionFilterGroup = 1;
        ray.collisionFilterMask = -1;

        // Perform raycast against the world (for static bodies like walls)
        ray.intersectWorld(this.world, result);

        // Check for dynamic body hits manually (Cannon.js raycast doesn't detect moving dynamic bodies)
        const dynamicResult = this.checkDynamicBodies(from, direction, to);

        // Use the closer hit between static and dynamic
        if (dynamicResult && (!result.hasHit || dynamicResult.distance < result.distance)) {
            return dynamicResult;
        }

        // Check if we hit something static
        if (result.hasHit) {
            const body = result.body;

            // Skip player body (kinematic with mass 0)
            if (body.type === CANNON.Body.KINEMATIC && body.mass === 0) {
                return null;
            }

            // Skip ground (static with plane shape)
            if (body.type === CANNON.Body.STATIC &&
                body.shapes.some((s: any) => s instanceof CANNON.Plane)) {
                return null;
            }

            // Calculate hit point from ray origin and distance
            const hitPoint = from.vadd(direction.scale(result.distance));

            // Set hit point properties
            (result as any).hitPointWorld = hitPoint;
            (result as any).hitPoint = hitPoint;
            (result as any).hitNormal = result.hitNormalWorld || direction.negate(new CANNON.Vec3());

            return result;
        }

        return null;
    }

    /**
     * Check dynamic bodies for raycast hits (enemies, projectiles, etc.)
     * Cannon.js raycast doesn't reliably detect moving dynamic bodies
     */
    private checkDynamicBodies(
        from: CANNON.Vec3,
        direction: CANNON.Vec3,
        to: CANNON.Vec3
    ): CANNON.RaycastResult | null {
        const maxDistance = to.vsub(from).length();
        let closestHit: { result: CANNON.RaycastResult; distance: number } | null = null;

        for (const body of this.bodies) {
            // Only check dynamic bodies with mass
            if (body.type !== CANNON.Body.DYNAMIC || body.mass === 0) {
                continue;
            }

            // Check each shape in the body
            for (const shape of body.shapes) {
                const hit = this.intersectShape(body, shape, from, direction, maxDistance);
                if (hit && (!closestHit || hit.distance < closestHit.distance)) {
                    closestHit = { result: hit, distance: hit.distance };
                }
            }
        }

        return closestHit?.result || null;
    }

    /**
     * Check if a ray intersects with a shape
     */
    private intersectShape(
        body: CANNON.Body,
        shape: CANNON.Shape,
        from: CANNON.Vec3,
        direction: CANNON.Vec3,
        maxDistance: number
    ): CANNON.RaycastResult | null {
        // For box shapes, use ray-AABB intersection
        if (shape instanceof CANNON.Box) {
            return this.intersectBox(body, shape as CANNON.Box, from, direction, maxDistance);
        }

        // For sphere shapes, use ray-sphere intersection
        if (shape instanceof CANNON.Sphere) {
            return this.intersectSphere(body, shape as CANNON.Sphere, from, direction, maxDistance);
        }

        return null;
    }

    /**
     * Ray-box intersection
     */
    private intersectBox(
        body: CANNON.Body,
        box: CANNON.Box,
        from: CANNON.Vec3,
        direction: CANNON.Vec3,
        maxDistance: number
    ): CANNON.RaycastResult | null {
        // Get box world position and orientation
        const boxPos = body.position;
        const boxQuat = body.quaternion;

        // Transform ray to box local space
        const localFrom = from.vsub(boxPos);
        const localFromInv = boxQuat.inverse().vmult(localFrom, new CANNON.Vec3());
        const localDir = boxQuat.inverse().vmult(direction, new CANNON.Vec3());

        // AABB in local space
        const halfExtents = box.halfExtents;
        const min = new CANNON.Vec3(-halfExtents.x, -halfExtents.y, -halfExtents.z);
        const max = new CANNON.Vec3(halfExtents.x, halfExtents.y, halfExtents.z);

        // Slab method for ray-AABB intersection
        let tmin = -Infinity;
        let tmax = Infinity;

        for (let i = 0; i < 3; i++) {
            if (Math.abs(localDir.toArray()[i]) < 0.0001) {
                // Ray is parallel to this slab
                if (localFromInv.toArray()[i] < min.toArray()[i] || localFromInv.toArray()[i] > max.toArray()[i]) {
                    return null;
                }
            } else {
                const t1 = (min.toArray()[i] - localFromInv.toArray()[i]) / localDir.toArray()[i];
                const t2 = (max.toArray()[i] - localFromInv.toArray()[i]) / localDir.toArray()[i];
                tmin = Math.max(tmin, Math.min(t1, t2));
                tmax = Math.min(tmax, Math.max(t1, t2));
            }
        }

        if (tmin > tmax || tmax < 0) {
            return null;
        }

        const distance = Math.max(tmin, 0);
        if (distance > maxDistance) {
            return null;
        }

        // Create result
        const result = new CANNON.RaycastResult();
        result.hasHit = true;
        result.body = body;
        result.shape = box;
        result.distance = distance;

        // Calculate hit point and normal
        const hitPoint = new CANNON.Vec3(
            from.x + direction.x * distance,
            from.y + direction.y * distance,
            from.z + direction.z * distance
        );
        result.hitPointWorld = hitPoint;
        (result as any).hitPoint = hitPoint;

        // Simple normal (face the ray direction)
        const normal = new CANNON.Vec3(-direction.x, -direction.y, -direction.z);
        result.hitNormalWorld = normal;
        (result as any).hitNormal = normal;

        return result;
    }

    /**
     * Ray-sphere intersection
     */
    private intersectSphere(
        body: CANNON.Body,
        sphere: CANNON.Sphere,
        from: CANNON.Vec3,
        direction: CANNON.Vec3,
        maxDistance: number
    ): CANNON.RaycastResult | null {
        const sphereCenter = body.position;
        const radius = sphere.radius;

        // Vector from ray origin to sphere center
        const oc = from.vsub(sphereCenter);

        // Quadratic equation coefficients
        const a = direction.dot(direction);
        const b = 2 * oc.dot(direction);
        const c = oc.dot(oc) - radius * radius;

        const discriminant = b * b - 4 * a * c;

        if (discriminant < 0) {
            return null;
        }

        const sqrtDiscriminant = Math.sqrt(discriminant);
        const t1 = (-b - sqrtDiscriminant) / (2 * a);
        const t2 = (-b + sqrtDiscriminant) / (2 * a);

        const distance = t1 >= 0 ? t1 : (t2 >= 0 ? t2 : -1);

        if (distance < 0 || distance > maxDistance) {
            return null;
        }

        // Create result
        const result = new CANNON.RaycastResult();
        result.hasHit = true;
        result.body = body;
        result.shape = sphere;
        result.distance = distance;

        // Calculate hit point
        const hitPoint = new CANNON.Vec3(
            from.x + direction.x * distance,
            from.y + direction.y * distance,
            from.z + direction.z * distance
        );
        result.hitPointWorld = hitPoint;
        (result as any).hitPoint = hitPoint;

        // Normal at hit point
        const normalVec = new CANNON.Vec3(
            hitPoint.x - sphereCenter.x,
            hitPoint.y - sphereCenter.y,
            hitPoint.z - sphereCenter.z
        );
        normalVec.normalize();
        result.hitNormalWorld = normalVec;
        (result as any).hitNormal = normalVec;

        return result;
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
