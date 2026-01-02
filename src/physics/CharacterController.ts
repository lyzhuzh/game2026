/**
 * Character Controller
 * Physics-based character controller for FPS player
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from './PhysicsWorld';
import { GAME_CONFIG } from '../constants/GameConstants';

export interface CharacterConfig {
    radius?: number;
    height?: number;
    mass?: number;
    walkSpeed?: number;
    sprintSpeed?: number;
    jumpForce?: number;
    stepHeight?: number;
}

export class CharacterController {
    private world: PhysicsWorld;
    private body: CANNON.Body;
    private mesh?: THREE.Object3D;

    // Movement settings
    private walkSpeed: number;
    private sprintSpeed: number;
    private jumpForce: number;
    private _stepHeight: number;

    // Current state
    private isGrounded: boolean = false;
    private isSprinting: boolean = false;
    private isCrouching: boolean = false;
    private currentHeight: number;
    private verticalVelocity: number = 0;
    private isJumping: boolean = false; // Track if we're actively jumping up

    // Eye level offset (camera position relative to body center)
    private readonly EYE_LEVEL_OFFSET: number = 0.7; // Eyes are 0.7m above body center

    // Ground detection
    private readonly _GROUND_CHECK_DISTANCE: number = 0.1;
    private _groundNormal: CANNON.Vec3 = new CANNON.Vec3(0, 1, 0);

    constructor(world: PhysicsWorld, config: CharacterConfig = {}) {
        this.world = world;

        // Settings
        const radius = config.radius ?? GAME_CONFIG.PLAYER.RADIUS;
        const height = config.height ?? GAME_CONFIG.PLAYER.HEIGHT;
        this.currentHeight = height;

        this.walkSpeed = config.walkSpeed ?? GAME_CONFIG.PLAYER.WALK_SPEED;
        this.sprintSpeed = config.sprintSpeed ?? GAME_CONFIG.PLAYER.SPRINT_SPEED;
        this.jumpForce = config.jumpForce ?? GAME_CONFIG.PLAYER.JUMP_FORCE;
        this._stepHeight = config.stepHeight ?? 0.3;

        // Create physics body (cylinder as capsule approximation)
        const shape = new CANNON.Cylinder(radius, radius, height, 8);

        this.body = new CANNON.Body({
            mass: 0, // Zero mass = kinematic/infinite mass
            type: CANNON.Body.KINEMATIC, // Kinematic type for direct control
            shape: shape,
            fixedRotation: true, // Prevent player from tipping over
            linearDamping: 0.0,
            angularDamping: 1.0,
            sleepSpeedLimit: -1 // Disable sleep
        });

        // Set player material for better ground friction
        const playerMaterial = this.world.getMaterial('player');
        if (playerMaterial) {
            this.body.material = playerMaterial;
        }

        // Add to world
        this.world.addBody(this.body);
    }

    /**
     * Update character controller
     * @param deltaTime - Frame delta time
     * @param moveDirection - Normalized movement direction (XZ plane)
     * @param jumpRequested - Whether jump was requested
     * @param sprintRequested - Whether sprint is requested
     * @param crouchRequested - Whether crouch is requested
     */
    update(
        deltaTime: number,
        moveDirection: THREE.Vector3,
        jumpRequested: boolean,
        sprintRequested: boolean,
        crouchRequested: boolean
    ): void {
        // Update states
        this.isSprinting = sprintRequested && !crouchRequested;
        this.isCrouching = crouchRequested;

        // Handle crouch height
        const targetHeight = this.isCrouching
            ? GAME_CONFIG.PLAYER.CROUCH_HEIGHT
            : GAME_CONFIG.PLAYER.HEIGHT;
        this.updateHeight(targetHeight);

        // Check if grounded
        this.checkGrounded();

        // Calculate movement speed
        let speed = this.walkSpeed;
        if (this.isSprinting) {
            speed = this.sprintSpeed;
        }
        if (this.isCrouching) {
            speed *= 0.4;
        }

        // Apply movement - for kinematic body, use position delta
        if (moveDirection.lengthSq() > 0.01) {
            moveDirection.normalize();

            // Calculate movement delta
            const deltaX = moveDirection.x * speed * deltaTime;
            const deltaZ = moveDirection.z * speed * deltaTime;

            // 碰撞检测 - 分别检查 X 和 Z 方向
            const newPos = this.body.position.clone();
            const originalPos = this.body.position.clone();

            // 尝试 X 方向移动
            newPos.x += deltaX;
            if (!this.checkCollision(newPos)) {
                this.body.position.x = newPos.x;
            } else {
                // X 方向受阻，恢复原位置
                newPos.x = originalPos.x;
            }

            // 尝试 Z 方向移动
            newPos.z += deltaZ;
            if (!this.checkCollision(newPos)) {
                this.body.position.z = newPos.z;
            }
            // 如果 Z 方向受阻，保持原位置（不更新）
        }

        // Handle jumping
        if (jumpRequested && this.isGrounded) {
            this.jump();
        }

        // Apply gravity for kinematic body (manual since physics doesn't affect kinematic bodies)
        if (!this.isGrounded) {
            // Apply downward velocity (gravity is negative, so subtract)
            this.verticalVelocity -= 9.82 * deltaTime;
            this.body.position.y += this.verticalVelocity * deltaTime;

            // Clear jumping flag when we start falling
            if (this.isJumping && this.verticalVelocity < 0) {
                this.isJumping = false;
            }

            // Simple ground check for kinematic body
            // But don't immediately ground if we're still jumping up
            const groundLevel = this.currentHeight / 2;
            if (this.body.position.y <= groundLevel && !this.isJumping) {
                this.body.position.y = groundLevel;
                this.verticalVelocity = 0;
                this.isGrounded = true;
            }
        } else {
            this.verticalVelocity = 0;
            // Keep at correct height above ground
            if (this.body.position.y < this.currentHeight / 2) {
                this.body.position.y = this.currentHeight / 2;
            }
        }

        // Sync mesh if attached
        if (this.mesh) {
            this.mesh.position.copy(this.body.position as any);
            this.mesh.quaternion.copy(this.body.quaternion as any);
        }
    }

    /**
     * Handle crouch height change
     */
    private updateHeight(targetHeight: number): void {
        if (Math.abs(targetHeight - this.currentHeight) < 0.01) {
            return;
        }

        // Remove old body and create new one with updated height
        const oldPos = this.body.position.clone();

        this.world.removeBody(this.body);

        const radius = GAME_CONFIG.PLAYER.RADIUS;
        const shape = new CANNON.Cylinder(radius, radius, targetHeight, 8);

        // Create kinematic body (same as original)
        this.body = new CANNON.Body({
            mass: 0,
            type: CANNON.Body.KINEMATIC,
            shape: shape,
            fixedRotation: true,
            linearDamping: 0.0,
            angularDamping: 1.0,
            sleepSpeedLimit: -1
        });

        // Restore material
        const playerMaterial = this.world.getMaterial('player');
        if (playerMaterial) {
            this.body.material = playerMaterial;
        }

        // Restore position (adjust for new height to keep feet on ground)
        this.body.position.set(oldPos.x, targetHeight / 2, oldPos.z);

        this.world.addBody(this.body);
        this.currentHeight = targetHeight;

        // Reset states after height change
        this.verticalVelocity = 0;
        this.isGrounded = true; // Force grounded state after height change
        this.isJumping = false; // Clear jumping state
    }

    /**
     * Check if character is on the ground
     */
    private checkGrounded(): void {
        // For kinematic body, use simple height check instead of raycast
        // Kinematic bodies don't participate in collision detection the same way
        const groundLevel = this.currentHeight / 2;

        // Only consider grounded if we're not actively jumping up
        if (!this.isJumping) {
            this.isGrounded = this.body.position.y <= groundLevel + 0.1;
        }
    }

    /**
     * Check if position collides with static bodies (walls)
     * Uses Cannon-es intersection test
     */
    private checkCollision(position: CANNON.Vec3): boolean {
        // Get all bodies from the physics world
        const allBodies = this.world.getBodies();

        // Player shape for collision testing
        const radius = GAME_CONFIG.PLAYER.RADIUS;
        const height = this.currentHeight;

        for (const body of allBodies) {
            // Skip self and non-static bodies
            if (body === this.body || body.type !== CANNON.Body.STATIC) {
                continue;
            }

            // Check if body has Box shape (walls)
            const shape = body.shapes[0];
            if (shape instanceof CANNON.Box) {
                if (this.checkBoxCollision(position, body, shape as CANNON.Box, radius, height)) {
                    // 碰撞检测日志
                    const halfExtents = (shape as CANNON.Box).halfExtents;
                    console.log('[碰撞检测] 玩家与静态物体碰撞:', {
                        玩家位置: { x: position.x.toFixed(2), y: position.y.toFixed(2), z: position.z.toFixed(2) },
                        物体位置: { x: body.position.x.toFixed(2), y: body.position.y.toFixed(2), z: body.position.z.toFixed(2) },
                        物体尺寸: {
                            x: (halfExtents.x * 2).toFixed(2),
                            y: (halfExtents.y * 2).toFixed(2),
                            z: (halfExtents.z * 2).toFixed(2)
                        }
                    });
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check collision with a box shape
     */
    private checkBoxCollision(
        playerPos: CANNON.Vec3,
        wallBody: CANNON.Body,
        boxShape: CANNON.Box,
        playerRadius: number,
        playerHeight: number
    ): boolean {
        // Get box half extents
        const halfExtents = boxShape.halfExtents;

        // Transform player position to box local space
        const localPlayerPos = playerPos.vsub(wallBody.position);
        const invQuat = wallBody.quaternion.inverse();
        invQuat.vmult(localPlayerPos, localPlayerPos);

        // Check AABB collision in local space
        // Player is treated as a cylinder (capsule)
        // For simplicity, use box approximation for player
        const playerHalfWidth = playerRadius;
        const _playerHalfHeight = playerHeight / 2;

        // Check X axis
        const xMin = -halfExtents.x - playerHalfWidth;
        const xMax = halfExtents.x + playerHalfWidth;

        // Check Y axis (player center is at playerHeight/2, so adjust)
        const yMin = -halfExtents.y;
        const yMax = halfExtents.y + playerHeight;

        // Check Z axis
        const zMin = -halfExtents.z - playerHalfWidth;
        const zMax = halfExtents.z + playerHalfWidth;

        // Check if player's bounding box overlaps with wall's bounding box
        const overlaps =
            localPlayerPos.x >= xMin && localPlayerPos.x <= xMax &&
            localPlayerPos.y >= yMin && localPlayerPos.y <= yMax &&
            localPlayerPos.z >= zMin && localPlayerPos.z <= zMax;

        return overlaps;
    }

    /**
     * Perform jump
     */
    jump(): void {
        if (this.isGrounded) {
            this.verticalVelocity = this.jumpForce;
            this.isGrounded = false;
            this.isJumping = true; // Mark that we're jumping up
        }
    }

    /**
     * Set position
     */
    setPosition(position: THREE.Vector3 | CANNON.Vec3): void {
        this.body.position.set(position.x, position.y, position.z);
    }

    /**
     * Get position
     */
    getPosition(): CANNON.Vec3 {
        return this.body.position;
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
    getVelocity(): CANNON.Vec3 {
        return this.body.velocity;
    }

    /**
     * Check if grounded
     */
    getIsGrounded(): boolean {
        return this.isGrounded;
    }

    /**
     * Check if sprinting
     */
    getIsSprinting(): boolean {
        return this.isSprinting;
    }

    /**
     * Check if crouching
     */
    getIsCrouching(): boolean {
        return this.isCrouching;
    }

    /**
     * Get current height
     */
    getCurrentHeight(): number {
        return this.currentHeight;
    }

    /**
     * Get eye position (where camera should be)
     */
    getEyePosition(): THREE.Vector3 {
        return new THREE.Vector3(
            this.body.position.x,
            this.body.position.y + this.EYE_LEVEL_OFFSET,
            this.body.position.z
        );
    }

    /**
     * Attach mesh for visual sync
     */
    setMesh(mesh: THREE.Object3D): void {
        this.mesh = mesh;
    }

    /**
     * Get the underlying Cannon-es body
     */
    getBody(): CANNON.Body {
        return this.body;
    }

    /**
     * Dispose
     */
    dispose(): void {
        this.world.removeBody(this.body);
        this.mesh = undefined;
    }
}
