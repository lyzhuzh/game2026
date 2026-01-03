/**
 * Physics Body
 * Wrapper for Cannon-es bodies with Three.js sync
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from './PhysicsWorld';

export interface BodyConfig {
    mass?: number;
    type?: 'static' | 'dynamic' | 'kinematic';
    material?: string;
    linearDamping?: number;
    angularDamping?: number;
    fixedRotation?: boolean;
}

export class PhysicsBody {
    public body: CANNON.Body;
    private mesh?: THREE.Object3D;
    private syncPhysicsToMesh: boolean = true;
    private syncMeshToPhysics: boolean = false;

    constructor(
        shape: CANNON.Shape,
        config: BodyConfig = {},
        mesh?: THREE.Object3D
    ) {
        // Determine body type
        let type: CANNON.BodyType;
        switch (config.type ?? 'dynamic') {
            case 'static':
                type = CANNON.Body.STATIC;
                break;
            case 'kinematic':
                type = CANNON.Body.KINEMATIC;
                break;
            case 'dynamic':
            default:
                type = CANNON.Body.DYNAMIC;
                break;
        }

        // Create Cannon-es body
        this.body = new CANNON.Body({
            mass: config.mass ?? (type === CANNON.Body.DYNAMIC ? 1 : 0),
            type: type,
            shape: shape,
            linearDamping: config.linearDamping ?? 0.01,
            angularDamping: config.angularDamping ?? 0.01,
            fixedRotation: config.fixedRotation ?? false
        });

        // Set material (if provided by name, needs to be set after world is available)
        // Material assignment should be done via setMaterial() method

        // Store mesh reference
        this.mesh = mesh;
    }

    /**
     * Set position
     */
    setPosition(position: THREE.Vector3 | CANNON.Vec3 | { x: number; y: number; z: number }): void {
        this.body.position.set(position.x, position.y, position.z);
        if (this.mesh) {
            this.mesh.position.set(position.x, position.y, position.z);
        }
    }

    /**
     * Get position
     */
    getPosition(): THREE.Vector3 {
        return new THREE.Vector3(
            this.body.position.x,
            this.body.position.y,
            this.body.position.z
        );
    }

    /**
     * Set rotation (quaternion)
     */
    setQuaternion(quaternion: THREE.Quaternion | CANNON.Quaternion): void {
        this.body.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
        if (this.mesh) {
            this.mesh.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
        }
    }

    /**
     * Set rotation (Euler angles)
     */
    setRotation(x: number, y: number, z: number): void {
        const euler = new CANNON.Vec3(x, y, z);
        this.body.quaternion.setFromEuler(euler.x, euler.y, euler.z);
        if (this.mesh) {
            this.mesh.rotation.set(x, y, z);
        }
    }

    /**
     * Get quaternion
     */
    getQuaternion(): THREE.Quaternion {
        return new THREE.Quaternion(
            this.body.quaternion.x,
            this.body.quaternion.y,
            this.body.quaternion.z,
            this.body.quaternion.w
        );
    }

    /**
     * Set velocity
     */
    setVelocity(velocity: THREE.Vector3 | CANNON.Vec3): void {
        this.body.velocity.set(velocity.x, velocity.y, velocity.z);
    }

    /**
     * Get velocity
     */
    getVelocity(): THREE.Vector3 {
        return new THREE.Vector3(
            this.body.velocity.x,
            this.body.velocity.y,
            this.body.velocity.z
        );
    }

    /**
     * Apply force at center of mass
     */
    applyForce(force: THREE.Vector3 | CANNON.Vec3): void {
        this.body.applyForce(new CANNON.Vec3(force.x, force.y, force.z), this.body.position);
    }

    /**
     * Apply force at world point
     */
    applyForceAtPoint(force: THREE.Vector3 | CANNON.Vec3, point: THREE.Vector3 | CANNON.Vec3): void {
        this.body.applyForce(
            new CANNON.Vec3(force.x, force.y, force.z),
            new CANNON.Vec3(point.x, point.y, point.z)
        );
    }

    /**
     * Apply impulse
     */
    applyImpulse(impulse: THREE.Vector3 | CANNON.Vec3): void {
        this.body.applyImpulse(new CANNON.Vec3(impulse.x, impulse.y, impulse.z), this.body.position);
    }

    /**
     * Apply torque (rotational force)
     */
    applyTorque(torque: THREE.Vector3 | CANNON.Vec3): void {
        this.body.torque.set(torque.x, torque.y, torque.z);
    }

    /**
     * Wake up body (activate from sleep)
     */
    wakeUp(): void {
        this.body.wakeUp();
    }

    /**
     * Put body to sleep
     */
    sleep(): void {
        this.body.sleep();
    }

    /**
     * Enable/disable collision response
     */
    setCollisionResponse(enabled: boolean): void {
        this.body.collisionResponse = enabled;
    }

    /**
     * Set physics material
     */
    setMaterial(material: CANNON.Material): void {
        this.body.material = material;
    }

    /**
     * Set mesh to sync with this body
     */
    setMesh(mesh: THREE.Object3D, syncPhysics: boolean = true): void {
        this.mesh = mesh;
        this.syncPhysicsToMesh = syncPhysics;

        // Set body position to match mesh (mesh was positioned first)
        this.body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
        this.body.quaternion.set(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w);
    }

    /**
     * Sync physics body to mesh (call each frame)
     */
    update(): void {
        if (this.mesh && this.syncPhysicsToMesh) {
            this.mesh.position.copy(this.body.position as any);
            this.mesh.quaternion.copy(this.body.quaternion as any);
        }
    }

    /**
     * Enable/disable mesh sync
     */
    setSyncPhysicsToMesh(enabled: boolean): void {
        this.syncPhysicsToMesh = enabled;
    }

    /**
     * Enable/disable mesh to physics sync (for kinematic bodies)
     */
    setSyncMeshToPhysics(enabled: boolean): void {
        this.syncMeshToPhysics = enabled;
    }

    /**
     * Get the underlying Cannon-es body
     */
    getBody(): CANNON.Body {
        return this.body;
    }

    /**
     * Dispose body
     */
    dispose(): void {
        this.mesh = undefined;
    }
}

/**
 * Factory function to create common physics bodies
 */
export class PhysicsBodyFactory {
    /**
     * Create a ground plane
     */
    static createGround(
        world: PhysicsWorld,
        materialName: string = 'ground'
    ): PhysicsBody {
        const shape = new CANNON.Plane();
        const body = new PhysicsBody(shape, {
            type: 'static',
            mass: 0
        });

        // Set material
        const material = world.getMaterial(materialName);
        if (material) {
            body.setMaterial(material);
        }

        // Rotate plane to face upward (Cannon-es planes face +Z by default)
        body.body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);

        world.addBody(body.body);
        return body;
    }

    /**
     * Create a box
     */
    static createBox(
        world: PhysicsWorld,
        size: { x: number; y: number; z: number },
        config: BodyConfig = {},
        mesh?: THREE.Object3D
    ): PhysicsBody {
        const halfExtents = new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2);
        const shape = new CANNON.Box(halfExtents);

        const body = new PhysicsBody(shape, config, mesh);

        // Set material if specified
        if (config.material) {
            const material = world.getMaterial(config.material);
            if (material) {
                body.setMaterial(material);
            }
        }

        if (mesh) {
            body.setMesh(mesh);
        }

        world.addBody(body.body);
        return body;
    }

    /**
     * Create a sphere
     */
    static createSphere(
        world: PhysicsWorld,
        radius: number,
        config: BodyConfig = {},
        mesh?: THREE.Object3D
    ): PhysicsBody {
        const shape = new CANNON.Sphere(radius);

        const body = new PhysicsBody(shape, config, mesh);

        // Set material if specified
        if (config.material) {
            const material = world.getMaterial(config.material);
            if (material) {
                body.setMaterial(material);
            }
        }

        if (mesh) {
            body.setMesh(mesh);
        }

        world.addBody(body.body);
        return body;
    }

    /**
     * Create a player capsule body
     */
    static createPlayerCapsule(
        world: PhysicsWorld,
        radius: number,
        height: number,
        config: BodyConfig = {}
    ): PhysicsBody {
        const shape = new CANNON.Cylinder(radius, radius, height, 8);

        const playerConfig: BodyConfig = {
            ...config,
            fixedRotation: true,
            linearDamping: 0.0
        };

        const body = new PhysicsBody(shape, playerConfig);

        // Set player material
        const material = world.getMaterial('player');
        if (material) {
            body.setMaterial(material);
        }

        world.addBody(body.body);
        return body;
    }
}
