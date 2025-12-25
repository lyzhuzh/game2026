/**
 * Input Manager
 * Centralized input management system
 */

import { KeyboardInput, KeyCodes } from './KeyboardInput';
import { MouseInput, MouseButtons } from './MouseInput';
import { InputBindings, InputAction, inputBindings } from './InputBindings';

export class InputManager {
    private static instance: InputManager;
    private static keyboard: KeyboardInput;
    private static mouse: MouseInput;

    public readonly keyboard: KeyboardInput;
    public readonly mouse: MouseInput;
    public readonly bindings: InputBindings;

    private constructor() {
        // Use static shared instances
        InputManager.keyboard = InputManager.keyboard || new KeyboardInput();
        InputManager.mouse = InputManager.mouse || new MouseInput();

        this.keyboard = InputManager.keyboard;
        this.mouse = InputManager.mouse;
        this.bindings = inputBindings;
    }

    /**
     * Get the singleton InputManager instance
     */
    static getInstance(): InputManager {
        if (!InputManager.instance) {
            InputManager.instance = new InputManager();
        }
        return InputManager.instance;
    }

    /**
     * Check if an action is currently pressed (held down)
     */
    isActionPressed(action: InputAction): boolean {
        const binding = this.bindings.getBinding(action);

        // Check keyboard binding
        if (binding?.keyboard) {
            if (this.keyboard.isKeyDown(binding.keyboard)) {
                return true;
            }
        }

        // Check mouse binding
        if (binding?.mouseButton !== undefined) {
            if (this.mouse.isButtonDown(binding.mouseButton)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if an action was just pressed this frame
     */
    isActionJustPressed(action: InputAction): boolean {
        const binding = this.bindings.getBinding(action);

        // Check keyboard binding
        if (binding?.keyboard) {
            if (this.keyboard.isKeyJustPressed(binding.keyboard)) {
                return true;
            }
        }

        // Check mouse binding
        if (binding?.mouseButton !== undefined) {
            if (this.mouse.isButtonJustPressed(binding.mouseButton)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if an action was just released this frame
     */
    isActionJustReleased(action: InputAction): boolean {
        const binding = this.bindings.getBinding(action);

        // Check keyboard binding
        if (binding?.keyboard) {
            if (this.keyboard.isKeyJustReleased(binding.keyboard)) {
                return true;
            }
        }

        // Check mouse binding
        if (binding?.mouseButton !== undefined) {
            if (this.mouse.isButtonJustReleased(binding.mouseButton)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get movement input as a normalized vector
     * Returns { x: -1 to 1, y: -1 to 1 }
     * x: left/right (negative = left, positive = right)
     * y: forward/backward (negative = backward, positive = forward)
     */
    getMovementInput(): { x: number; y: number } {
        let x = 0;
        let y = 0;

        if (this.isActionPressed('move_left')) x -= 1;
        if (this.isActionPressed('move_right')) x += 1;
        if (this.isActionPressed('move_forward')) y += 1;
        if (this.isActionPressed('move_backward')) y -= 1;

        // Normalize diagonal movement
        if (x !== 0 && y !== 0) {
            const length = Math.sqrt(x * x + y * y);
            x /= length;
            y /= length;
        }

        return { x, y };
    }

    /**
     * Get look input (mouse movement delta)
     */
    getLookInput(): { x: number; y: number } {
        return this.mouse.getDelta();
    }

    /**
     * Get scroll wheel delta
     */
    getScrollDelta(): number {
        return this.mouse.getWheelDelta();
    }

    /**
     * Request pointer lock
     */
    requestPointerLock(): void {
        document.body.requestPointerLock();
    }

    /**
     * Exit pointer lock
     */
    exitPointerLock(): void {
        document.exitPointerLock();
    }

    /**
     * Check if pointer is locked
     */
    isPointerLocked(): boolean {
        return this.mouse.isLocked();
    }

    /**
     * Update all input systems
     * Call this once per frame
     */
    update(): void {
        this.keyboard.update();
        this.mouse.update();
    }

    /**
     * Dispose all input systems
     */
    dispose(): void {
        this.keyboard.dispose();
        this.mouse.dispose();
    }
}
