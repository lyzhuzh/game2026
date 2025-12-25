/**
 * Time Management
 * Handles delta time and time scaling for the game
 */

export class Time {
    private static _currentTime: number = 0;
    private static _deltaTime: number = 0;
    private static _unscaledDeltaTime: number = 0;
    private static _timeScale: number = 1.0;
    private static _frameCount: number = 0;
    private static _lastFrameTime: number = 0;

    /**
     * Initialize the time system
     */
    static initialize(): void {
        this._currentTime = performance.now() / 1000;
        this._lastFrameTime = this._currentTime;
    }

    /**
     * Update time calculations (call once per frame)
     */
    static update(): void {
        const currentTime = performance.now() / 1000;
        this._unscaledDeltaTime = currentTime - this._lastFrameTime;
        this._deltaTime = this._unscaledDeltaTime * this._timeScale;
        this._currentTime = currentTime;
        this._lastFrameTime = currentTime;
        this._frameCount++;
    }

    /**
     * Get the current time in seconds since start
     */
    static get time(): number {
        return this._currentTime;
    }

    /**
     * Get the delta time for this frame (scaled by timeScale)
     */
    static get deltaTime(): number {
        return this._deltaTime;
    }

    /**
     * Get the unscaled delta time (ignores timeScale)
     */
    static get unscaledDeltaTime(): number {
        return this._unscaledDeltaTime;
    }

    /**
     * Set the time scale (1.0 = normal, 0.5 = slow motion, 0 = paused)
     */
    static set timeScale(value: number) {
        this._timeScale = Math.max(0, value);
    }

    /**
     * Get the current time scale
     */
    static get timeScale(): number {
        return this._timeScale;
    }

    /**
     * Get the total number of frames rendered
     */
    static get frameCount(): number {
        return this._frameCount;
    }

    /**
     * Reset the time system
     */
    static reset(): void {
        this._currentTime = 0;
        this._deltaTime = 0;
        this._unscaledDeltaTime = 0;
        this._timeScale = 1.0;
        this._frameCount = 0;
        this._lastFrameTime = performance.now() / 1000;
    }
}
