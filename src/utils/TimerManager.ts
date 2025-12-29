/**
 * Timer Manager
 * 管理所有定时器，防止内存泄漏
 * 提供统一的清理机制
 */

export type TimerCallback = () => void;
export type IntervalCallback = () => void;

export class TimerManager {
    private timeouts: Set<number> = new Set();
    private intervals: Set<number> = new Set();
    private isDisposed: boolean = false;

    /**
     * 创建一个受管理的 setTimeout
     * @param callback 回调函数
     * @param delay 延迟时间（毫秒）
     * @returns 定时器 ID
     */
    setTimeout(callback: TimerCallback, delay: number): number {
        if (this.isDisposed) {
            console.warn('[TimerManager] Attempted to set timeout on disposed manager');
            return -1;
        }

        const id = window.setTimeout(() => {
            this.timeouts.delete(id);
            callback();
        }, delay);

        this.timeouts.add(id);
        return id;
    }

    /**
     * 清除指定的 setTimeout
     * @param id 定时器 ID
     */
    clearTimeout(id: number): void {
        if (this.timeouts.has(id)) {
            window.clearTimeout(id);
            this.timeouts.delete(id);
        }
    }

    /**
     * 创建一个受管理的 setInterval
     * @param callback 回调函数
     * @param interval 间隔时间（毫秒）
     * @returns 定时器 ID
     */
    setInterval(callback: IntervalCallback, interval: number): number {
        if (this.isDisposed) {
            console.warn('[TimerManager] Attempted to set interval on disposed manager');
            return -1;
        }

        const id = window.setInterval(callback, interval);
        this.intervals.add(id);
        return id;
    }

    /**
     * 清除指定的 setInterval
     * @param id 定时器 ID
     */
    clearInterval(id: number): void {
        if (this.intervals.has(id)) {
            window.clearInterval(id);
            this.intervals.delete(id);
        }
    }

    /**
     * 清除所有 setTimeout
     */
    clearAllTimeouts(): void {
        this.timeouts.forEach(id => window.clearTimeout(id));
        this.timeouts.clear();
    }

    /**
     * 清除所有 setInterval
     */
    clearAllIntervals(): void {
        this.intervals.forEach(id => window.clearInterval(id));
        this.intervals.clear();
    }

    /**
     * 清除所有定时器
     */
    clearAll(): void {
        this.clearAllTimeouts();
        this.clearAllIntervals();
    }

    /**
     * 获取当前活跃的定时器数量
     */
    getActiveCount(): number {
        return this.timeouts.size + this.intervals.size;
    }

    /**
     * 获取超时定时器数量
     */
    getTimeoutCount(): number {
        return this.timeouts.size;
    }

    /**
     * 获取间隔定时器数量
     */
    getIntervalCount(): number {
        return this.intervals.size;
    }

    /**
     * 销毁管理器并清理所有定时器
     */
    dispose(): void {
        this.clearAll();
        this.isDisposed = true;
    }

    /**
     * 检查管理器是否已销毁
     */
    isDisposedManager(): boolean {
        return this.isDisposed;
    }
}

/**
 * 全局定时器管理器实例
 * 用于需要全局访问的场景
 */
let globalTimerManager: TimerManager | null = null;

export function getGlobalTimerManager(): TimerManager {
    if (!globalTimerManager) {
        globalTimerManager = new TimerManager();
    }
    return globalTimerManager;
}

export function disposeGlobalTimerManager(): void {
    if (globalTimerManager) {
        globalTimerManager.dispose();
        globalTimerManager = null;
    }
}
