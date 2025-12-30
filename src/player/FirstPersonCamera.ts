import * as THREE from 'three';
import { InputManager } from '../input/InputManager';
import { GAME_CONFIG } from '../constants/GameConstants';

/**
 * First Person Camera Controller
 * Handles mouse look for FPS camera control
 */

export interface CameraConfig {
    fov?: number;
    near?: number;
    far?: number;
    sensitivity?: number;
    maxYawAngle?: number;
    maxPitchAngle?: number;
}

export class FirstPersonCamera {
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
    private fovTransitionSpeed: number = 10; // FOV 变化速度

    private readonly input: InputManager;

    constructor(config: CameraConfig = {}) {
        this.input = InputManager.getInstance();

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
        this.maxPitchAngle = config.maxPitchAngle ?? Math.PI / 2 - 0.01; // ~89 degrees

        // Initialize FOV settings
        this.baseFov = config.fov ?? GAME_CONFIG.CAMERA.FOV;
        this.currentFov = this.baseFov;
        this.targetFov = this.baseFov;

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
     * Set camera position
     */
    setPosition(position: THREE.Vector3): void {
        this.camera.position.copy(position);

        // Apply shake offset to position
        if (this.shakeOffset.lengthSq() > 0.0001) {
            this.camera.position.add(this.shakeOffset);
        }
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

        // Debug: Log camera orientation occasionally
        if (Math.random() < 0.01) { // 1% chance to avoid spam
            console.log(`[Camera] yaw=${this.yaw.toFixed(2)}, pitch=${this.pitch.toFixed(2)}`);
            console.log(`[Camera] forward=(${forward.x.toFixed(2)}, ${forward.y.toFixed(2)}, ${forward.z.toFixed(2)})`);
        }

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
     */
    getFlatForward(): THREE.Vector3 {
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        return forward;
    }

    /**
     * Get right direction on the horizontal plane (Y = 0)
     */
    getFlatRight(): THREE.Vector3 {
        const right = new THREE.Vector3(1, 0, 0);
        right.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        return right;
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
     * @param intensity - Shake intensity
     * @param duration - Shake duration in seconds
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

            // Random shake offset
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
