/**
 * Keyboard Input Handler
 * Tracks keyboard key states
 */

export class KeyboardInput {
    private keys: Map<string, boolean> = new Map();
    private keysJustPressed: Map<string, boolean> = new Map();
    private keysJustReleased: Map<string, boolean> = new Map();

    constructor() {
        // Bind methods to preserve 'this' context
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.setupEventListeners();
    }

    /**
     * Setup keyboard event listeners
     */
    private setupEventListeners(): void {
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
    }

    /**
     * Handle key down event
     */
    private onKeyDown(event: KeyboardEvent): void {
        const key = event.code;
        const wasPressed = this.keys.get(key);

        if (wasPressed !== true) {
            this.keysJustPressed.set(key, true);
        }

        this.keys.set(key, true);
        this.keysJustReleased.delete(key);
    }

    /**
     * Handle key up event
     */
    private onKeyUp(event: KeyboardEvent): void {
        const key = event.code;

        this.keys.set(key, false);
        this.keysJustPressed.delete(key);
        this.keysJustReleased.set(key, true);
    }

    /**
     * Check if a key is currently down
     */
    isKeyDown(key: string): boolean {
        return this.keys.get(key) === true;
    }

    /**
     * Check if a key is currently up
     */
    isKeyUp(key: string): boolean {
        return this.keys.get(key) !== true;
    }

    /**
     * Check if a key was just pressed this frame
     */
    isKeyJustPressed(key: string): boolean {
        return this.keysJustPressed.get(key) === true;
    }

    /**
     * Check if a key was just released this frame
     */
    isKeyJustReleased(key: string): boolean {
        return this.keysJustReleased.get(key) === true;
    }

    /**
     * Get all currently pressed keys
     */
    getPressedKeys(): string[] {
        return Array.from(this.keys.entries())
            .filter(([_, pressed]) => pressed)
            .map(([key, _]) => key);
    }

    /**
     * Update method to clear just-pressed and just-released states
     * Call this once per frame
     */
    update(): void {
        this.keysJustPressed.clear();
        this.keysJustReleased.clear();
    }

    /**
     * Dispose event listeners
     */
    dispose(): void {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        this.keys.clear();
        this.keysJustPressed.clear();
        this.keysJustReleased.clear();
    }
}

// Key codes for common game inputs
export const KeyCodes = {
    // Movement
    W: 'KeyW',
    A: 'KeyA',
    S: 'KeyS',
    D: 'KeyD',

    // Action
    Space: 'Space',
    ShiftLeft: 'ShiftLeft',
    ShiftRight: 'ShiftRight',
    ControlLeft: 'ControlLeft',
    ControlRight: 'ControlRight',

    // Combat
    MouseLeft: 'MouseLeft',
    MouseRight: 'MouseRight',
    MouseMiddle: 'MouseMiddle',

    // Weapon
    Digit1: 'Digit1',
    Digit2: 'Digit2',
    Digit3: 'Digit3',
    R: 'KeyR',

    // UI
    Escape: 'Escape',
    Tab: 'Tab',
    Enter: 'Enter',
    E: 'KeyE',
} as const;
