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

    // === Third-person camera position (calibrated) ===
    // Arrow Up/Down: adjust cameraHeight
    // Arrow Left/Right: adjust cameraBack
    private debugCameraHeight: number = 0.45;
    private debugCameraBack: number = 0.85;
    private lastCameraDebugTime: number = 0;

    // === Free Debug Camera Mode ===
    // F9 to toggle, WASD to move, mouse to rotate
    private debugCameraMode: boolean = false;
    private debugCameraPosition: THREE.Vector3 = new THREE.Vector3(0, 2, 5);
    private debugCameraYaw: number = 0;
    private debugCameraPitch: number = 0;

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
            distance: 3.5,       // Further back behind player
            height: 0.5,         // Slightly above pivot
            pitch: 0.0,          // Level camera
            smoothSpeed: 8.0,
            collisionRadius: 0.3,
            minDistance: 1.0,
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

                // Clamp pitch based on view mode
                // Third-person: limit upward looking to prevent seeing under character
                if (this.viewMode === ViewMode.THIRD_PERSON) {
                    // Max look up: 45 degrees (0.785 radians)
                    // Max look down: 60 degrees (1.05 radians)
                    this.pitch = Math.max(-1.05, Math.min(0.785, this.pitch));
                } else {
                    // First-person: normal limits
                    this.pitch = Math.max(-this.maxPitchAngle, Math.min(this.maxPitchAngle, this.pitch));
                }

                this.updateCameraRotation();
            }
        }

        // Update camera position based on view mode
        // If debug camera is enabled, use it instead
        if (this.debugCameraMode) {
            this.updateDebugCamera(deltaTime);
            return;
        }

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
        // === DEBUG: Camera position adjustment (DISABLED) ===
        // this.handleCameraDebugInput();

        // Third-person camera parameters
        const cameraHeight = this.debugCameraHeight;
        const cameraBack = this.debugCameraBack;
        const lookAheadDistance = 5.0;

        // Calculate camera offset based on yaw AND pitch
        // Pitch affects vertical position: positive pitch = look up, camera goes lower
        // Negative pitch = look down, camera goes higher
        const pitchCos = Math.cos(this.pitch);
        const pitchSin = Math.sin(this.pitch);

        // Camera position orbits around player based on yaw and pitch
        const horizontalDistance = cameraBack * pitchCos;
        const verticalOffset = cameraHeight - cameraBack * pitchSin;

        const targetPos = new THREE.Vector3(
            this.playerPosition.x - Math.sin(this.yaw) * horizontalDistance,
            this.playerPosition.y + verticalOffset,
            this.playerPosition.z - Math.cos(this.yaw) * horizontalDistance
        );

        // Collision detection
        const finalPos = this.checkCameraCollision(targetPos);

        // Smooth camera movement with Lerp
        const lerpSpeed = this.thirdPersonConfig.smoothSpeed * deltaTime;
        this.camera.position.lerp(finalPos, Math.min(lerpSpeed, 1.0));

        // Camera looks at player position with pitch offset
        // lookAt target height changes based on pitch
        const lookAtHeight = this.playerPosition.y + lookAheadDistance * pitchSin * 0.5;
        const lookAtTarget = new THREE.Vector3(
            this.playerPosition.x + Math.sin(this.yaw) * lookAheadDistance * pitchCos,
            lookAtHeight,
            this.playerPosition.z + Math.cos(this.yaw) * lookAheadDistance * pitchCos
        );
        this.camera.lookAt(lookAtTarget);

        // Camera shake
        if (this.shakeOffset.lengthSq() > 0.0001) {
            this.camera.position.add(this.shakeOffset);
        }
    }

    /**
     * DEBUG: Handle third-person camera position adjustment
     * Arrow Up/Down: adjust height
     * Arrow Left/Right: adjust back distance
     */
    private handleCameraDebugInput(): void {
        const debugKeys = (window as any).__debugKeys;
        if (!debugKeys) return;

        const step = 0.05;
        const now = Date.now();
        if (now - this.lastCameraDebugTime < 100) return;

        // Up/Down = camera height
        if (debugKeys.ArrowUp) {
            this.debugCameraHeight += step;
            this.lastCameraDebugTime = now;
            this.logCameraPosition();
        }
        if (debugKeys.ArrowDown) {
            this.debugCameraHeight = Math.max(0.1, this.debugCameraHeight - step);
            this.lastCameraDebugTime = now;
            this.logCameraPosition();
        }
        // Left/Right = back distance
        if (debugKeys.ArrowRight) {
            this.debugCameraBack += step;
            this.lastCameraDebugTime = now;
            this.logCameraPosition();
        }
        if (debugKeys.ArrowLeft) {
            this.debugCameraBack = Math.max(0, this.debugCameraBack - step);
            this.lastCameraDebugTime = now;
            this.logCameraPosition();
        }
    }

    private logCameraPosition(): void {
        console.log(`[CameraDebug] Height: ${this.debugCameraHeight.toFixed(2)}, Back: ${this.debugCameraBack.toFixed(2)}`);
    }


    /**
     * Check camera collision with scene geometry
     * Uses Cannon.js raycast to detect walls and adjust camera position
     */
    private checkCameraCollision(targetPos: THREE.Vector3): THREE.Vector3 {
        if (!this.physics) return targetPos;

        // Raycast from player (slightly higher) to target camera position
        const from = new CANNON.Vec3(
            this.playerPosition.x,
            this.playerPosition.y + 1.2, // Move higher to avoid body/weapon collision
            this.playerPosition.z
        );
        const to = new CANNON.Vec3(targetPos.x, targetPos.y, targetPos.z);

        const result = this.physics.raycast(from, to, {
            collisionFilterMask: 1, // Only collide with DEFAULT layer (environment), ignore others
            skipBackfaces: true
        });

        if (result && result.hasHit) {
            const distance = result.distance;
            // Only adjust if distance is very different (avoid micro-jitter)
            if (distance < 0.2) return targetPos; // Ignore very close hits (likely self)

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
     * In first-person: camera faces -Z when yaw=0
     * In third-person: forward matches the lookAt direction (what the camera is looking at)
     */
    getFlatForward(): THREE.Vector3 {
        // In third-person, forward is the direction the camera is looking at
        // which is (+sin, 0, +cos) based on lookAt calculation in updateThirdPersonPosition
        // In first-person, forward is traditional -Z when yaw=0, so (-sin, 0, -cos)
        if (this.viewMode === ViewMode.THIRD_PERSON) {
            return new THREE.Vector3(
                Math.sin(this.yaw),
                0,
                Math.cos(this.yaw)
            );
        }
        // First-person: camera faces -Z when yaw=0
        return new THREE.Vector3(
            -Math.sin(this.yaw),
            0,
            -Math.cos(this.yaw)
        );
    }

    /**
     * Get right direction on the horizontal plane (Y = 0)
     * Must be consistent with getFlatForward
     */
    getFlatRight(): THREE.Vector3 {
        // Right is perpendicular to forward (90 degrees clockwise when viewed from above)
        // For forward = (sin(yaw), 0, cos(yaw)), right should be (cos(yaw), 0, -sin(yaw))
        // For forward = (-sin(yaw), 0, -cos(yaw)), right should be (-cos(yaw), 0, sin(yaw))
        // BUT we need to verify: in third-person, if camera looks at +Z when yaw=0,
        // then right should be +X direction, which is (1, 0, 0)
        // cos(0) = 1, sin(0) = 0, so (cos, 0, -sin) = (1, 0, 0) ✓
        // The issue is that A key gives negative x, D gives positive x
        // With right = (1,0,0), pressing D adds +right = moves to +X = correct
        // But the user reports A/D are swapped, so maybe X direction is wrong for third-person camera orientation

        // After analysis: third-person camera is BEHIND the player looking at player
        // So when player faces +Z (yaw=0), camera is at -Z looking at +Z
        // "Right" for player should be the same as screen right
        // The current implementation is correct for first-person but wrong for third-person

        if (this.viewMode === ViewMode.THIRD_PERSON) {
            // For third-person: negate the X component to fix left/right
            return new THREE.Vector3(
                -Math.cos(this.yaw),
                0,
                Math.sin(this.yaw)
            );
        }
        // First-person
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
     * Toggle free debug camera mode
     * In debug mode: camera is free to move, WASD moves camera, mouse rotates
     */
    toggleDebugCamera(): void {
        this.debugCameraMode = !this.debugCameraMode;
        if (this.debugCameraMode) {
            // Initialize debug camera at current camera position
            this.debugCameraPosition.copy(this.camera.position);
            this.debugCameraYaw = this.yaw;
            this.debugCameraPitch = this.pitch;
            console.log('[PlayerCamera] FREE DEBUG CAMERA: ENABLED');
            console.log('  WASD: Move camera');
            console.log('  Mouse: Rotate camera');
            console.log('  F9: Exit debug mode');
        } else {
            console.log('[PlayerCamera] FREE DEBUG CAMERA: DISABLED');
        }
    }

    /**
     * Check if debug camera is enabled
     */
    isDebugCameraEnabled(): boolean {
        return this.debugCameraMode;
    }

    /**
     * Update debug camera (called from update when debug mode is on)
     */
    private updateDebugCamera(deltaTime: number): void {
        if (!this.debugCameraMode) return;

        // Mouse rotation (reuse normal sensitivity)
        if (this.input.isPointerLocked()) {
            const lookInput = this.input.getLookInput();
            if (lookInput.x !== 0 || lookInput.y !== 0) {
                this.debugCameraYaw -= lookInput.x * this.sensitivity;
                this.debugCameraPitch -= lookInput.y * this.sensitivity;
                // Clamp pitch
                this.debugCameraPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.debugCameraPitch));
            }
        }

        // WASD movement
        const moveSpeed = 5.0 * deltaTime;
        const debugKeys = (window as any).__debugKeys || {};

        // Calculate forward and right vectors based on debug camera rotation
        const forward = new THREE.Vector3(
            Math.sin(this.debugCameraYaw) * Math.cos(this.debugCameraPitch),
            Math.sin(this.debugCameraPitch),
            Math.cos(this.debugCameraYaw) * Math.cos(this.debugCameraPitch)
        );
        const right = new THREE.Vector3(
            Math.cos(this.debugCameraYaw),
            0,
            -Math.sin(this.debugCameraYaw)
        );

        // Check movement keys (checking both code and common alternatives)
        if (debugKeys.KeyW || this.input.isActionPressed('move_forward')) {
            this.debugCameraPosition.add(forward.clone().multiplyScalar(moveSpeed));
        }
        if (debugKeys.KeyS || this.input.isActionPressed('move_backward')) {
            this.debugCameraPosition.add(forward.clone().multiplyScalar(-moveSpeed));
        }
        if (debugKeys.KeyA || this.input.isActionPressed('move_left')) {
            this.debugCameraPosition.add(right.clone().multiplyScalar(-moveSpeed));
        }
        if (debugKeys.KeyD || this.input.isActionPressed('move_right')) {
            this.debugCameraPosition.add(right.clone().multiplyScalar(moveSpeed));
        }
        // Q/E for up/down
        if (debugKeys.KeyQ) {
            this.debugCameraPosition.y -= moveSpeed;
        }
        if (debugKeys.KeyE) {
            this.debugCameraPosition.y += moveSpeed;
        }

        // Apply to camera
        this.camera.position.copy(this.debugCameraPosition);
        const euler = new THREE.Euler(this.debugCameraPitch, this.debugCameraYaw, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(euler);
    }

    /**
     * Dispose camera resources
     */
    dispose(): void {
        // Camera will be disposed by the renderer
    }
}
