import * as THREE from 'three';
import { InputManager } from '../input/InputManager';
import { GAME_CONFIG } from '../constants/GameConstants';

/**
 * Movement Controller
 * Handles WASD movement physics
 */

export interface MovementConfig {
    walkSpeed?: number;
    sprintSpeed?: number;
    friction?: number;
    acceleration?: number;
    airControl?: number;
    gravity?: number;
}

export class MovementController {
    private velocity: THREE.Vector3;
    private inputDirection: THREE.Vector3;

    private walkSpeed: number;
    private sprintSpeed: number;
    private friction: number;
    private acceleration: number;
    private airControl: number;
    private gravity: number;

    private isGrounded: boolean = false;
    private isSprinting: boolean = false;

    private readonly input: InputManager;

    constructor(config: MovementConfig = {}) {
        this.input = InputManager.getInstance();

        // Movement settings
        this.walkSpeed = config.walkSpeed ?? GAME_CONFIG.PLAYER.WALK_SPEED;
        this.sprintSpeed = config.sprintSpeed ?? GAME_CONFIG.PLAYER.SPRINT_SPEED;
        this.friction = config.friction ?? 10.0;
        this.acceleration = config.acceleration ?? 15.0;
        this.airControl = config.airControl ?? 0.3;
        this.gravity = config.gravity ?? 20.0;

        // Velocity and direction
        this.velocity = new THREE.Vector3();
        this.inputDirection = new THREE.Vector3();
    }

    /**
     * Update movement controller
     * @param deltaTime - Frame delta time
     * @param forward - Forward direction vector (flat, Y=0)
     * @param right - Right direction vector (flat, Y=0)
     * @returns The new position to apply
     */
    update(deltaTime: number, forward: THREE.Vector3, right: THREE.Vector3): THREE.Vector3 {
        // Get input
        const movementInput = this.input.getMovementInput();
        const jumpInput = this.input.isActionJustPressed('jump');
        const sprintInput = this.input.isActionPressed('sprint');
        const crouchInput = this.input.isActionPressed('crouch');

        // Update sprint state
        this.isSprinting = sprintInput && !crouchInput;

        // Calculate input direction from camera orientation
        this.inputDirection.set(0, 0, 0);
        this.inputDirection.addScaledVector(forward, movementInput.y);
        this.inputDirection.addScaledVector(right, movementInput.x);

        const hasInput = this.inputDirection.lengthSq() > 0.01;

        // Calculate target speed
        let targetSpeed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;
        if (crouchInput) {
            targetSpeed *= 0.4; // Slower when crouching
        }

        // Calculate target velocity (flat, no Y component)
        const targetVelocity = new THREE.Vector3();
        if (hasInput) {
            this.inputDirection.normalize();
            targetVelocity.copy(this.inputDirection).multiplyScalar(targetSpeed);
        }

        // Apply acceleration/deceleration
        const accel = this.isGrounded ? this.acceleration : this.acceleration * this.airControl;

        if (hasInput) {
            // Accelerate towards target velocity
            const velocityChange = targetVelocity.clone().sub(this.getFlatVelocity());
            const maxChange = accel * deltaTime;

            if (velocityChange.length() <= maxChange) {
                this.velocity.x += velocityChange.x;
                this.velocity.z += velocityChange.z;
            } else {
                velocityChange.normalize().multiplyScalar(maxChange);
                this.velocity.x += velocityChange.x;
                this.velocity.z += velocityChange.z;
            }
        } else {
            // Apply friction when no input
            const frictionAmount = this.friction * deltaTime;
            const flatVelocity = this.getFlatVelocity();

            if (flatVelocity.length() <= frictionAmount) {
                this.velocity.x = 0;
                this.velocity.z = 0;
            } else {
                flatVelocity.normalize().multiplyScalar(frictionAmount);
                this.velocity.x -= flatVelocity.x;
                this.velocity.z -= flatVelocity.z;
            }
        }

        // Apply gravity
        if (!this.isGrounded) {
            this.velocity.y -= this.gravity * deltaTime;
        } else {
            // Keep velocity.y at 0 when grounded (will be set by jump)
            this.velocity.y = Math.min(0, this.velocity.y);
        }

        // Handle jump
        if (jumpInput && this.isGrounded) {
            this.jump();
        }

        // Calculate position change
        const positionDelta = this.velocity.clone().multiplyScalar(deltaTime);

        return positionDelta;
    }

    /**
     * Perform jump
     */
    jump(): void {
        if (this.isGrounded) {
            this.velocity.y = GAME_CONFIG.PLAYER.JUMP_FORCE;
            this.isGrounded = false;
        }
    }

    /**
     * Set grounded state
     */
    setIsGrounded(grounded: boolean): void {
        this.isGrounded = grounded;
        if (grounded && this.velocity.y < 0) {
            this.velocity.y = 0;
        }
    }

    /**
     * Get current velocity
     */
    getVelocity(): THREE.Vector3 {
        return this.velocity.clone();
    }

    /**
     * Get flat velocity (XZ plane only)
     */
    getFlatVelocity(): THREE.Vector3 {
        return new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
    }

    /**
     * Get current movement speed (flat)
     */
    getFlatSpeed(): number {
        return Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
    }

    /**
     * Check if player is grounded
     */
    getIsGrounded(): boolean {
        return this.isGrounded;
    }

    /**
     * Check if player is sprinting
     */
    getIsSprinting(): boolean {
        return this.isSprinting;
    }

    /**
     * Set velocity directly (for external physics system)
     */
    setVelocity(velocity: THREE.Vector3): void {
        this.velocity.copy(velocity);
    }

    /**
     * Reset velocity to zero
     */
    reset(): void {
        this.velocity.set(0, 0, 0);
        this.inputDirection.set(0, 0, 0);
    }
}
