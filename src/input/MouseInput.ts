/**
 * Mouse Input Handler
 * Tracks mouse position, buttons, and movement delta
 */

export interface MousePosition {
    x: number;
    y: number;
}

export interface MouseDelta {
    x: number;
    y: number;
}

export class MouseInput {
    private position: MousePosition = { x: 0, y: 0 };
    private delta: MouseDelta = { x: 0, y: 0 };
    private buttons: Map<number, boolean> = new Map();
    private buttonsJustPressed: Map<number, boolean> = new Map();
    private buttonsJustReleased: Map<number, boolean> = new Map();
    private wheelDelta: number = 0;

    private isPointerLocked: boolean = false;

    constructor() {
        // Bind methods to preserve 'this' context
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.onPointerLockChange = this.onPointerLockChange.bind(this);
        this.setupEventListeners();
    }

    /**
     * Setup mouse event listeners
     */
    private setupEventListeners(): void {
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mouseup', this.onMouseUp);
        window.addEventListener('wheel', this.onWheel, { passive: false });
        document.addEventListener('pointerlockchange', this.onPointerLockChange);
    }

    /**
     * Handle mouse move event
     */
    private onMouseMove(event: MouseEvent): void {
        this.position.x = event.clientX;
        this.position.y = event.clientY;

        if (this.isPointerLocked) {
            this.delta.x += event.movementX;
            this.delta.y += event.movementY;
        }
    }

    /**
     * Handle mouse button down event
     */
    private onMouseDown(event: MouseEvent): void {
        const button = event.button;
        const wasPressed = this.buttons.get(button);

        if (wasPressed !== true) {
            this.buttonsJustPressed.set(button, true);
        }

        this.buttons.set(button, true);
        this.buttonsJustReleased.delete(button);
    }

    /**
     * Handle mouse button up event
     */
    private onMouseUp(event: MouseEvent): void {
        const button = event.button;

        this.buttons.set(button, false);
        this.buttonsJustPressed.delete(button);
        this.buttonsJustReleased.set(button, true);
    }

    /**
     * Handle mouse wheel event
     */
    private onWheel(event: WheelEvent): void {
        this.wheelDelta += event.deltaY;
        event.preventDefault();
    }

    /**
     * Handle pointer lock change
     */
    private onPointerLockChange(): void {
        this.isPointerLocked = document.pointerLockElement === document.body;
    }

    /**
     * Get current mouse position
     */
    getPosition(): MousePosition {
        return { ...this.position };
    }

    /**
     * Get mouse movement delta since last frame
     */
    getDelta(): MouseDelta {
        return { ...this.delta };
    }

    /**
     * Check if a mouse button is currently down
     */
    isButtonDown(button: number): boolean {
        return this.buttons.get(button) === true;
    }

    /**
     * Check if a mouse button is currently up
     */
    isButtonUp(button: number): boolean {
        return this.buttons.get(button) !== true;
    }

    /**
     * Check if a button was just pressed this frame
     */
    isButtonJustPressed(button: number): boolean {
        return this.buttonsJustPressed.get(button) === true;
    }

    /**
     * Check if a button was just released this frame
     */
    isButtonJustReleased(button: number): boolean {
        return this.buttonsJustReleased.get(button) === true;
    }

    /**
     * Get mouse wheel scroll delta
     */
    getWheelDelta(): number {
        return this.wheelDelta;
    }

    /**
     * Check if pointer is locked
     */
    isLocked(): boolean {
        return this.isPointerLocked;
    }

    /**
     * Update method to clear per-frame states
     * Call this once per frame
     */
    update(): void {
        this.delta.x = 0;
        this.delta.y = 0;
        this.wheelDelta = 0;
        this.buttonsJustPressed.clear();
        this.buttonsJustReleased.clear();
    }

    /**
     * Dispose event listeners
     */
    dispose(): void {
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mouseup', this.onMouseUp);
        window.removeEventListener('wheel', this.onWheel);
        document.removeEventListener('pointerlockchange', this.onPointerLockChange);
        this.buttons.clear();
        this.buttonsJustPressed.clear();
        this.buttonsJustReleased.clear();
    }
}

// Mouse button codes
export const MouseButtons = {
    Left: 0,
    Middle: 1,
    Right: 2,
} as const;
