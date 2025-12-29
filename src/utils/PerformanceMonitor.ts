/**
 * 性能监控系统
 * 用于实时监控游戏性能指标
 */

export interface PerformanceMetrics {
    // 帧率
    fps: number;
    frameTime: number;

    // 内存
    heapUsed: number;
    heapTotal: number;
    heapLimit: number;

    // 渲染
    drawCalls: number;
    triangles: number;
    textures: number;
    programs: number;

    // 物理
    physicsTime: number;
    bodyCount: number;

    // 实体
    enemyCount: number;
    particleCount: number;
    projectileCount: number;

    // 自定义指标
    customMetrics: Map<string, number>;
}

export interface PerformanceOptions {
    updateInterval: number; // 更新间隔（毫秒）
    enableLogging: boolean;
    enableMemoryTracking: boolean;
}

export class PerformanceMonitor {
    private metrics: PerformanceMetrics;
    private options: Required<PerformanceOptions>;

    // 帧率计算
    private frameCount: number = 0;
    private lastFpsUpdate: number = 0;
    private frameTimes: number[] = [];

    // 物理时间
    private physicsStartTime: number = 0;

    // 历史记录
    private fpsHistory: number[] = [];
    private maxHistoryLength: number = 60;

    // 性能警告阈值
    private thresholds = {
        lowFps: 30,
        highMemory: 500 * 1024 * 1024, // 500MB
        highFrameTime: 33.33, // 30 FPS
    };

    // 回调
    private onWarning?: (warning: string, metrics: PerformanceMetrics) => void;

    constructor(options: Partial<PerformanceOptions> = {}) {
        this.options = {
            updateInterval: options.updateInterval ?? 1000,
            enableLogging: options.enableLogging ?? false,
            enableMemoryTracking: options.enableMemoryTracking ?? true,
        };

        this.metrics = this.createEmptyMetrics();
    }

    /**
     * 开始帧
     */
    beginFrame(): void {
        this.frameCount++;
    }

    /**
     * 结束帧
     */
    endFrame(): void {
        const now = performance.now();
        const frameTime = now - (this.lastFpsUpdate || now);

        this.frameTimes.push(frameTime);

        // 只保留最近 60 帧的数据
        if (this.frameTimes.length > 60) {
            this.frameTimes.shift();
        }

        // 每秒更新一次 FPS
        if (now - this.lastFpsUpdate >= this.options.updateInterval) {
            this.updateMetrics(now);
        }
    }

    /**
     * 开始物理计时
     */
    beginPhysics(): void {
        this.physicsStartTime = performance.now();
    }

    /**
     * 结束物理计时
     */
    endPhysics(): void {
        this.metrics.physicsTime = performance.now() - this.physicsStartTime;
    }

    /**
     * 更新实体计数
     */
    updateEntityCounts(
        enemyCount: number,
        particleCount: number,
        projectileCount: number
    ): void {
        this.metrics.enemyCount = enemyCount;
        this.metrics.particleCount = particleCount;
        this.metrics.projectileCount = projectileCount;
    }

    /**
     * 更新物理体计数
     */
    updateBodyCount(count: number): void {
        this.metrics.bodyCount = count;
    }

    /**
     * 更新渲染统计
     */
    updateRenderStats(
        drawCalls: number,
        triangles: number,
        textures?: number,
        programs?: number
    ): void {
        this.metrics.drawCalls = drawCalls;
        this.metrics.triangles = triangles;
        if (textures !== undefined) this.metrics.textures = textures;
        if (programs !== undefined) this.metrics.programs = programs;
    }

    /**
     * 设置自定义指标
     */
    setCustomMetric(name: string, value: number): void {
        this.metrics.customMetrics.set(name, value);
    }

    /**
     * 获取自定义指标
     */
    getCustomMetric(name: string): number | undefined {
        return this.metrics.customMetrics.get(name);
    }

    /**
     * 获取当前指标
     */
    getMetrics(): PerformanceMetrics {
        return { ...this.metrics };
    }

    /**
     * 获取性能报告
     */
    getReport(): string {
        const m = this.metrics;
        const heapUsedMB = (m.heapUsed / 1024 / 1024).toFixed(1);
        const heapTotalMB = (m.heapTotal / 1024 / 1024).toFixed(1);

        return `
=== 性能报告 ===
FPS: ${m.fps.toFixed(1)}
帧时间: ${m.frameTime.toFixed(2)}ms

内存: ${heapUsedMB}MB / ${heapTotalMB}MB
物理时间: ${m.physicsTime.toFixed(2)}ms

渲染:
  Draw Calls: ${m.drawCalls}
  Triangles: ${m.triangles.toLocaleString()}
  Textures: ${m.textures}

实体:
  敌人: ${m.enemyCount}
  粒子: ${m.particleCount}
  投射物: ${m.projectileCount}
        `.trim();
    }

    /**
     * 获取简短报告
     */
    getShortReport(): string {
        const m = this.metrics;
        return `FPS: ${m.fps.toFixed(1)} | 内存: ${(m.heapUsed / 1024 / 1024).toFixed(0)}MB | 敌人: ${m.enemyCount}`;
    }

    /**
     * 获取 FPS 历史
     */
    getFpsHistory(): number[] {
        return [...this.fpsHistory];
    }

    /**
     * 设置性能警告回调
     */
    setWarningCallback(
        callback: (warning: string, metrics: PerformanceMetrics) => void
    ): void {
        this.onWarning = callback;
    }

    /**
     * 设置警告阈值
     */
    setThresholds(thresholds: Partial<typeof this.thresholds>): void {
        this.thresholds = { ...this.thresholds, ...thresholds };
    }

    /**
     * 重置统计
     */
    reset(): void {
        this.frameCount = 0;
        this.frameTimes = [];
        this.fpsHistory = [];
        this.lastFpsUpdate = 0;
        this.metrics = this.createEmptyMetrics();
    }

    /**
     * 创建空指标
     */
    private createEmptyMetrics(): PerformanceMetrics {
        return {
            fps: 60,
            frameTime: 16.67,
            heapUsed: 0,
            heapTotal: 0,
            heapLimit: 0,
            drawCalls: 0,
            triangles: 0,
            textures: 0,
            programs: 0,
            physicsTime: 0,
            bodyCount: 0,
            enemyCount: 0,
            particleCount: 0,
            projectileCount: 0,
            customMetrics: new Map(),
        };
    }

    /**
     * 更新指标
     */
    private updateMetrics(now: number): void {
        // 计算 FPS
        this.metrics.fps = this.frameCount;
        this.frameCount = 0;
        this.lastFpsUpdate = now;

        // 计算平均帧时间
        const avgFrameTime =
            this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        this.metrics.frameTime = avgFrameTime || 0;

        // 记录 FPS 历史
        this.fpsHistory.push(this.metrics.fps);
        if (this.fpsHistory.length > this.maxHistoryLength) {
            this.fpsHistory.shift();
        }

        // 更新内存信息
        if (this.options.enableMemoryTracking && (performance as any).memory) {
            const memory = (performance as any).memory;
            this.metrics.heapUsed = memory.usedJSHeapSize;
            this.metrics.heapTotal = memory.totalJSHeapSize;
            this.metrics.heapLimit = memory.jsHeapSizeLimit;
        }

        // 记录日志
        if (this.options.enableLogging) {
            console.log(this.getShortReport());
        }

        // 检查警告
        this.checkWarnings();
    }

    /**
     * 检查性能警告
     */
    private checkWarnings(): void {
        if (!this.onWarning) return;

        const m = this.metrics;

        // 低 FPS 警告
        if (m.fps < this.thresholds.lowFps) {
            this.onWarning(`低 FPS: ${m.fps.toFixed(1)}`, m);
        }

        // 高内存警告
        if (m.heapUsed > this.thresholds.highMemory) {
            const mb = (m.heapUsed / 1024 / 1024).toFixed(0);
            this.onWarning(`高内存使用: ${mb}MB`, m);
        }

        // 高帧时间警告
        if (m.frameTime > this.thresholds.highFrameTime) {
            this.onWarning(`高帧时间: ${m.frameTime.toFixed(2)}ms`, m);
        }
    }
}

/**
 * 全局性能监控器
 */
let globalMonitor: PerformanceMonitor | null = null;

export function getGlobalPerformanceMonitor(): PerformanceMonitor {
    if (!globalMonitor) {
        globalMonitor = new PerformanceMonitor();
    }
    return globalMonitor;
}

export function disposeGlobalPerformanceMonitor(): void {
    globalMonitor = null;
}
