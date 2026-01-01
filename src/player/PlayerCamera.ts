import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { InputManager } from '../input/InputManager';
import { GAME_CONFIG } from '../constants/GameConstants';
import { ViewMode, ThirdPersonCameraConfig } from './ViewMode';
import { PhysicsWorld } from '../physics/PhysicsWorld';

/**
 * Player Camera Controller
 * Handles both first-person and third-person camera views
 */

export interface CameraConfig {
    fov?: number;
    near?: number;
    far?: number;
    sensitivity?: number;
    maxYawAngle?: number;
    maxPitchAngle?: number;
    viewMode?: ViewMode;
    thirdPersonConfig?: Partial<ThirdPersonCameraConfig>;
    physics?: PhysicsWorld;
}

export class PlayerCamera {
    public camera: THREE.PerspectiveCamera;
    public pitch: number = 0; // Vertical rotation (X-axis)
    public yaw: number = 0;   // Horizontal rotation (Y-axis)

    private sensitivity: number;
    private maxPitchAngle: number;
    private shakeIntensity: number = 0;
    private shakeDuration: number = 0;
    private shakeTime: number = 0;
    private shakeOffset: THREE.Vector3 = new THREE.Vector3();

    // FOV / Zoom
    private baseFov: number;
    private currentFov: number;
    private targetFov: number;
    private fovTransitionSpeed: number = 10;

    // View mode
    private viewMode: ViewMode = ViewMode.FIRST_PERSON;
    private thirdPersonConfig: ThirdPersonCameraConfig;
    private playerPosition: THREE.Vector3 = new THREE.Vector3();
    private physics?: PhysicsWorld;

    private readonly input: InputManager;

    constructor(config: CameraConfig = {}) {
        this.input = InputManager.getInstance();
        this.physics = config.physics;

        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            config.fov ?? GAME_CONFIG.CAMERA.FOV,
            window.innerWidth / window.innerHeight,
            config.near ?? GAME_CONFIG.CAMERA.NEAR_PLANE,
            config.far ?? GAME_CONFIG.CAMERA.FAR_PLANE
        );

        // Set initial position (eye level)
        this.camera.position.set(0, GAME_CONFIG.PLAYER.HEIGHT, 0);

        // Configure settings
        this.sensitivity = config.sensitivity ?? GAME_CONFIG.PLAYER.MOUSE_SENSITIVITY;
        this.maxPitchAngle = config.maxPitchAngle ?? Math.PI / 2 - 0.01;

        // Initialize FOV settings
        this.baseFov = config.fov ?? GAME_CONFIG.CAMERA.FOV;
        this.currentFov = this.baseFov;
        this.targetFov = this.baseFov;

        // Initialize view mode
        this.viewMode = config.viewMode ?? ViewMode.FIRST_PERSON;

        // Third person configuration
        this.thirdPersonConfig = {
            distance: 5.0,
            height: 1.5,
            pitch: 0.2,
            smoothSpeed: 8.0,
            collisionRadius: 0.3,
            minDistance: 1.5,
            ...config.thirdPersonConfig
        };

        // Initial rotation (looking forward)
        this.yaw = 0;
        this.pitch = 0;
        this.updateCameraRotation();
    }

    /**
     * Update camera controller
     * Call this once per frame
     */
    update(deltaTime: number): void {
        // Process mouse input for rotation
        if (this.input.isPointerLocked()) {
            const lookInput = this.input.getLookInput();

            if (lookInput.x !== 0 || lookInput.y !== 0) {
                this.yaw -= lookInput.x * this.sensitivity;
                this.pitch -= lookInput.y * this.sensitivity;

                // Clamp pitch to prevent over-rotation
                this.pitch = Math.max(-this.maxPitchAngle, Math.min(this.maxPitchAngle, this.pitch));

                this.updateCameraRotation();
            }
        }

        // Update camera position based on view mode
        if (this.viewMode === ViewMode.FIRST_PERSON) {
            this.updateFirstPersonPosition();
        } else {
            this.updateThirdPersonPosition(deltaTime);
        }

        // Update FOV (smooth zoom transition)
        if (Math.abs(this.currentFov - this.targetFov) > 0.1) {
            this.currentFov += (this.targetFov - this.currentFov) * this.fovTransitionSpeed * deltaTime;
            this.camera.fov = this.currentFov;
            this.camera.updateProjectionMatrix();
        }

        // Update camera shake
        this.updateShake(deltaTime);
    }

    /**
     * Update camera rotation based on pitch and yaw
     */
    private updateCameraRotation(): void {
        // Create rotation: yaw (Y-axis) then pitch (X-axis in local space)
        const euler = new THREE.Euler(0, this.yaw, 0, 'YXZ');
        euler.x = this.pitch;
        this.camera.quaternion.setFromEuler(euler);
    }

    /**
     * Update first-person camera position
     */
    private updateFirstPersonPosition(): void {
        // Position is set externally via setPosition()
        // Just apply shake offset
        if (this.shakeOffset.lengthSq() > 0.0001) {
            this.camera.position.add(this.shakeOffset);
        }
    }

    /**
     * Update third-person camera position
     * Spring Arm style camera (like PUBG Mobile / 和平精英)
     * - Pivot point at character's shoulder/spine
     * - Camera attached via invisible "selfie stick" (spring arm)
     * - Yaw/Pitch control camera orbit around character
     * - Smooth follow with Lerp
     * - Raycast collision detection (anti-wall penetration)
     */
    private updateThirdPersonPosition(deltaTime: number): void {
        // Spring Arm parameters
        const armLength = this.thirdPersonConfig.distance;  // "Selfie stick" length
        const pivotHeight = 1.4;   // Pivot point height (shoulder level, about 1.4m above feet)
        const rightOffset = 0.4;   // Slight offset to the right (over right shoulder)

        // Pivot point: at player's shoulder level
        const playerFeetY = this.playerPosition.y - 1.6; // Approximate feet position
        const pivotPoint = new THREE.Vector3(
            this.playerPosition.x,
            playerFeetY + pivotHeight,
            this.playerPosition.z
        );

        // Calculate camera position using spherical coordinates around pivot
        // Yaw: horizontal rotation (left/right)
        // Pitch: vertical rotation (up/down)

        // Camera direction from pivot (the "spring arm" direction)
        // Using spherical coordinates: 
        // - theta (yaw): angle in XZ plane, 0 = facing +Z
        // - phi (pitch): angle from horizontal, 0 = horizontal, negative = looking up

        const horizontalDist = armLength * Math.cos(this.pitch);
        const verticalOffset = armLength * Math.sin(-this.pitch); // Negative because looking down is positive pitch

        // Camera position relative to pivot
        // The camera is BEHIND the pivot, opposite to where the character looks
        const cameraOffset = new THREE.Vector3(
            -Math.sin(this.yaw) * horizontalDist + Math.cos(this.yaw) * rightOffset,
            verticalOffset + this.thirdPersonConfig.height,
            -Math.cos(this.yaw) * horizontalDist - Math.sin(this.yaw) * rightOffset
        );

        // Target camera position (before collision check)
        const targetPos = pivotPoint.clone().add(cameraOffset);

        // Collision detection: Raycast from pivot to target camera position
        // If wall detected, shorten the arm length
        const finalPos = this.checkCameraCollision(targetPos);

        // Smooth camera movement with Lerp (creates "weight" and smooth feel)
        const lerpSpeed = this.thirdPersonConfig.smoothSpeed * deltaTime;
        this.camera.position.lerp(finalPos, Math.min(lerpSpeed, 1.0));

        // Camera always looks at the pivot point (character's shoulder)
        this.camera.lookAt(pivotPoint);

        // Debug logging
        if (Math.random() < 0.01) {
            const dist = this.camera.position.distanceTo(pivotPoint);
            console.log(`[SpringArm] Distance: ${dist.toFixed(1)}m, Pitch: ${(this.pitch * 180 / Math.PI).toFixed(0)}°`);
        }

        // Apply camera shake
        if (this.shakeOffset.lengthSq() > 0.0001) {
            this.camera.position.add(this.shakeOffset);
        }
    }


    /**
     * Check camera collision with scene geometry
     * Uses Cannon.js raycast to detect walls and adjust camera position
     */
    private checkCameraCollision(targetPos: THREE.Vector3): THREE.Vector3 {
        if (!this.physics) return targetPos;

        // Raycast from player to target camera position
        const from = new CANNON.Vec3(
            this.playerPosition.x,
            this.playerPosition.y + 0.5,
            this.playerPosition.z
        );
        const to = new CANNON.Vec3(targetPos.x, targetPos.y, targetPos.z);

        const result = this.physics.raycast(from, to);

        if (result && result.hasHit) {
            const distance = result.distance || 0;

            // If collision detected and distance is greater than minimum
            if (distance > this.thirdPersonConfig.minDistance) {
                const direction = targetPos.clone().sub(this.playerPosition).normalize();
                const safeDistance = distance - 0.2; // Small offset from wall
                return this.playerPosition.clone().add(direction.multiplyScalar(safeDistance));
            } else {
                // Too close to wall, use minimum distance
                const direction = targetPos.clone().sub(this.playerPosition).normalize();
                return this.playerPosition.clone().add(direction.multiplyScalar(this.thirdPersonConfig.minDistance));
            }
        }

        return targetPos;
    }

    /**
     * Set camera position
     */
    setPosition(position: THREE.Vector3): void {
        this.playerPosition.copy(position);

        if (this.viewMode === ViewMode.FIRST_PERSON) {
            this.camera.position.copy(position);

            // Apply shake offset
            if (this.shakeOffset.lengthSq() > 0.0001) {
                this.camera.position.add(this.shakeOffset);
            }
        }
        // Third person position is calculated in updateThirdPersonPosition()
    }

    /**
     * Set view mode (first-person or third-person)
     */
    setViewMode(mode: ViewMode): void {
        if (this.viewMode === mode) return;
        this.viewMode = mode;

        // Immediately set camera position when switching to third person
        // This prevents smooth transition from wrong position
        if (mode === ViewMode.THIRD_PERSON) {
            this.updateThirdPersonPosition(0.1); // Small delta to set position
        } else {
            // Reset to player position for first person
            this.camera.position.copy(this.playerPosition);
        }
    }

    /**
     * Get current view mode
     */
    getViewMode(): ViewMode {
        return this.viewMode;
    }

    /**
     * Get camera position
     */
    getPosition(): THREE.Vector3 {
        return this.camera.position.clone();
    }

    /**
     * Get camera position reference (for direct manipulation)
     */
    getPositionRef(): THREE.Vector3 {
        return this.camera.position;
    }

    /**
     * Get forward direction vector (normalized)
     */
    getForward(): THREE.Vector3 {
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);
        return forward;
    }

    /**
     * Get right direction vector (normalized)
     */
    getRight(): THREE.Vector3 {
        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(this.camera.quaternion);
        return right;
    }

    /**
     * Get forward direction on the horizontal plane (Y = 0)
     * Uses Three.js camera convention: default forward is -Z
     */
    getFlatForward(): THREE.Vector3 {
        // When yaw=0, camera faces -Z, so forward = (0, 0, -1)
        // When yaw rotates, forward rotates around Y axis
        return new THREE.Vector3(
            -Math.sin(this.yaw),
            0,
            -Math.cos(this.yaw)
        );
    }

    /**
     * Get right direction on the horizontal plane (Y = 0)
     * Uses Three.js camera convention
     */
    getFlatRight(): THREE.Vector3 {
        // Right = cross(up, forward)
        // When yaw=0, forward=-Z, up=Y, so right = Y x (-Z) = X = (1, 0, 0)
        return new THREE.Vector3(
            Math.cos(this.yaw),
            0,
            -Math.sin(this.yaw)
        );
    }

    /**
     * Set yaw angle (public method for external control)
     */
    setYaw(angle: number): void {
        this.yaw = angle;
        this.updateCameraRotation();
    }

    /**
     * Set pitch angle (public method for external control)
     */
    setPitch(angle: number): void {
        this.pitch = Math.max(-this.maxPitchAngle, Math.min(this.maxPitchAngle, angle));
        this.updateCameraRotation();
    }

    /**
     * Set mouse sensitivity
     */
    setSensitivity(sensitivity: number): void {
        this.sensitivity = Math.max(0, sensitivity);
    }

    /**
     * Get mouse sensitivity
     */
    getSensitivity(): number {
        return this.sensitivity;
    }

    /**
     * Set camera rotation directly
     */
    setRotation(yaw: number, pitch: number): void {
        this.yaw = yaw;
        this.pitch = Math.max(-this.maxPitchAngle, Math.min(this.maxPitchAngle, pitch));
        this.updateCameraRotation();
    }

    /**
     * Get camera rotation
     */
    getRotation(): { yaw: number; pitch: number } {
        return { yaw: this.yaw, pitch: this.pitch };
    }

    /**
     * Apply camera shake effect
     */
    applyShake(intensity: number, duration: number): void {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
        this.shakeTime = 0;
    }

    /**
     * Update camera shake effect
     */
    private updateShake(deltaTime: number): void {
        if (this.shakeTime < this.shakeDuration) {
            this.shakeTime += deltaTime;
            const progress = this.shakeTime / this.shakeDuration;
            const currentIntensity = this.shakeIntensity * (1 - progress);

            this.shakeOffset.set(
                (Math.random() - 0.5) * currentIntensity,
                (Math.random() - 0.5) * currentIntensity,
                (Math.random() - 0.5) * currentIntensity
            );
        } else {
            this.shakeOffset.set(0, 0, 0);
        }
    }

    /**
     * Handle window resize
     */
    onWindowResize(width: number, height: number): void {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    /**
     * Set zoom level (multiplier: 1 = normal, 6 = 6x zoom)
     */
    setZoom(multiplier: number): void {
        if (multiplier <= 0) {
            this.targetFov = this.baseFov;
        } else {
            this.targetFov = this.baseFov / multiplier;
        }
    }

    /**
     * Reset zoom to normal
     */
    resetZoom(): void {
        this.targetFov = this.baseFov;
    }

    /**
     * Check if camera is currently zoomed
     */
    isZoomed(): boolean {
        return Math.abs(this.currentFov - this.baseFov) > 1;
    }

    /**
     * Get current zoom multiplier
     */
    getZoomMultiplier(): number {
        return this.baseFov / this.currentFov;
    }

    /**
     * Dispose camera resources
     */
    dispose(): void {
        // Camera will be disposed by the renderer
    }
}
