/**
 * Game Loop
 * Manages the main game loop with fixed timestep for physics
 */

export type UpdateCallback = (deltaTime: number) => void;
export type RenderCallback = () => void;

export class GameLoop {
    private isRunning: boolean = false;
    private animationFrameId: number | null = null;
    private lastTime: number = 0;
    private accumulator: number = 0;
    private fixedTimeStep: number = 1 / 60;
    private maxFrameTime: number = 0.25;

    private updateCallbacks: UpdateCallback[] = [];
    private fixedUpdateCallbacks: UpdateCallback[] = [];
    private renderCallbacks: RenderCallback[] = [];

    /**
     * Start the game loop
     */
    start(): void {
        if (this.isRunning) {
            console.warn('GameLoop is already running');
            return;
        }

        this.isRunning = true;
        this.lastTime = performance.now() / 1000;
        this.accumulator = 0;
        this.loop();
    }

    /**
     * Stop the game loop
     */
    stop(): void {
        this.isRunning = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Register a callback for variable update (rendering)
     */
    onUpdate(callback: UpdateCallback): void {
        this.updateCallbacks.push(callback);
    }

    /**
     * Register a callback for fixed update (physics)
     */
    onFixedUpdate(callback: UpdateCallback): void {
        this.fixedUpdateCallbacks.push(callback);
    }

    /**
     * Register a callback for rendering
     */
    onRender(callback: RenderCallback): void {
        this.renderCallbacks.push(callback);
    }

    /**
     * Remove all callbacks
     */
    clearCallbacks(): void {
        this.updateCallbacks = [];
        this.fixedUpdateCallbacks = [];
        this.renderCallbacks = [];
    }

    /**
     * Main game loop
     */
    private loop = (): void => {
        if (!this.isRunning) return;

        const currentTime = performance.now() / 1000;
        let frameTime = currentTime - this.lastTime;

        // Prevent spiral of death
        if (frameTime > this.maxFrameTime) {
            frameTime = this.maxFrameTime;
        }

        this.lastTime = currentTime;
        this.accumulator += frameTime;

        // Fixed update (physics)
        while (this.accumulator >= this.fixedTimeStep) {
            this.executeFixedUpdate(this.fixedTimeStep);
            this.accumulator -= this.fixedTimeStep;
        }

        // Variable update (rendering, animations, etc.)
        this.executeUpdate(frameTime);

        // Render
        this.executeRender();

        // Schedule next frame
        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    /**
     * Execute fixed update callbacks
     */
    private executeFixedUpdate(deltaTime: number): void {
        for (const callback of this.fixedUpdateCallbacks) {
            callback(deltaTime);
        }
    }

    /**
     * Execute variable update callbacks
     */
    private executeUpdate(deltaTime: number): void {
        for (const callback of this.updateCallbacks) {
            callback(deltaTime);
        }
    }

    /**
     * Execute render callbacks
     */
    private executeRender(): void {
        for (const callback of this.renderCallbacks) {
            callback();
        }
    }

    /**
     * Get the fixed time step
     */
    getFixedTimeStep(): number {
        return this.fixedTimeStep;
    }

    /**
     * Set the fixed time step
     */
    setFixedTimeStep(timeStep: number): void {
        this.fixedTimeStep = timeStep;
    }

    /**
     * Check if the game loop is running
     */
    isActive(): boolean {
        return this.isRunning;
    }
}
