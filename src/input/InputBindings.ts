/**
 * Input Bindings Configuration
 * Maps physical inputs to game actions
 */

export type InputAction =
    // Movement
    | 'move_forward'
    | 'move_backward'
    | 'move_left'
    | 'move_right'
    // Actions
    | 'jump'
    | 'crouch'
    | 'sprint'
    | 'interact'
    // Combat
    | 'attack'
    | 'aim'
    | 'reload'
    // Weapons
    | 'weapon_1'
    | 'weapon_2'
    | 'weapon_3'
    | 'weapon_4'
    | 'weapon_5'
    | 'weapon_6'
    | 'weapon_7'
    | 'next_weapon'
    | 'previous_weapon'
    // UI
    | 'pause'
    | 'toggle_inventory'
    | 'toggle_console';

export interface BindingConfig {
    keyboard?: string;
    mouseButton?: number;
    gamepadButton?: number;
}

export class InputBindings {
    private bindings: Map<InputAction, BindingConfig> = new Map();

    constructor() {
        this.setDefaultBindings();
    }

    /**
     * Set default input bindings
     */
    private setDefaultBindings(): void {
        // Movement
        this.setBinding('move_forward', { keyboard: 'KeyW' });
        this.setBinding('move_backward', { keyboard: 'KeyS' });
        this.setBinding('move_left', { keyboard: 'KeyA' });
        this.setBinding('move_right', { keyboard: 'KeyD' });

        // Actions
        this.setBinding('jump', { keyboard: 'Space' });
        this.setBinding('crouch', { keyboard: 'ControlLeft' });
        this.setBinding('sprint', { keyboard: 'ShiftLeft' });
        this.setBinding('interact', { keyboard: 'KeyE' });

        // Combat
        this.setBinding('attack', { mouseButton: 0 }); // Left click
        this.setBinding('aim', { mouseButton: 2 }); // Right click
        this.setBinding('reload', { keyboard: 'KeyR' });

        // Weapons
        this.setBinding('weapon_1', { keyboard: 'Digit1' });
        this.setBinding('weapon_2', { keyboard: 'Digit2' });
        this.setBinding('weapon_3', { keyboard: 'Digit3' });
        this.setBinding('weapon_4', { keyboard: 'Digit4' });
        this.setBinding('weapon_5', { keyboard: 'Digit5' });
        this.setBinding('weapon_6', { keyboard: 'Digit6' });
        this.setBinding('weapon_7', { keyboard: 'Digit7' });
        this.setBinding('next_weapon', { mouseButton: 3 }); // Scroll down
        this.setBinding('previous_weapon', { mouseButton: 4 }); // Scroll up

        // UI
        this.setBinding('pause', { keyboard: 'Escape' });
        this.setBinding('toggle_inventory', { keyboard: 'Tab' });
        this.setBinding('toggle_console', { keyboard: 'F1' });
    }

    /**
     * Set binding for an action
     */
    setBinding(action: InputAction, config: BindingConfig): void {
        this.bindings.set(action, config);
    }

    /**
     * Get binding for an action
     */
    getBinding(action: InputAction): BindingConfig | undefined {
        return this.bindings.get(action);
    }

    /**
     * Get keyboard key for an action
     */
    getKeyboardKey(action: InputAction): string | undefined {
        return this.bindings.get(action)?.keyboard;
    }

    /**
     * Get mouse button for an action
     */
    getMouseButton(action: InputAction): number | undefined {
        return this.bindings.get(action)?.mouseButton;
    }

    /**
     * Check if action has keyboard binding
     */
    hasKeyboardBinding(action: InputAction): boolean {
        return this.bindings.get(action)?.keyboard !== undefined;
    }

    /**
     * Check if action has mouse binding
     */
    hasMouseBinding(action: InputAction): boolean {
        return this.bindings.get(action)?.mouseButton !== undefined;
    }

    /**
     * Get all bindings
     */
    getAllBindings(): Map<InputAction, BindingConfig> {
        return new Map(this.bindings);
    }

    /**
     * Reset to default bindings
     */
    resetToDefaults(): void {
        this.bindings.clear();
        this.setDefaultBindings();
    }
}

/**
 * Singleton instance for easy access
 */
export const inputBindings = new InputBindings();
