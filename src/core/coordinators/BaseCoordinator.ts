/**
 * 协调器基类和接口
 * 用于将 Game 类拆分为多个独立的协调器
 */

import { Game } from '../Game';
import { EventBus } from '../EventBus';

/**
 * 协调器初始化配置
 */
export interface CoordinatorConfig {
    game: Game;
    eventBus: EventBus;
}

/**
 * 协调器接口
 * 所有协调器必须实现此接口
 */
export interface ICoordinator {
    /**
     * 初始化协调器
     */
    initialize(): Promise<void> | void;

    /**
     * 每帧更新
     */
    update(deltaTime: number): void;

    /**
     * 销毁协调器
     */
    dispose(): void;

    /**
     * 获取协调器名称
     */
    getName(): string;
}

/**
 * 协调器基类
 * 提供通用功能实现
 */
export abstract class BaseCoordinator implements ICoordinator {
    protected game: Game;
    protected eventBus: EventBus;
    protected isInitialized: boolean = false;
    protected isDisposed: boolean = false;

    constructor(config: CoordinatorConfig) {
        this.game = config.game;
        this.eventBus = config.eventBus;
    }

    /**
     * 初始化协调器
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            console.warn(`[${this.getName()}] Already initialized`);
            return;
        }

        console.log(`[${this.getName()}] Initializing...`);
        await this.onInitialize();
        this.isInitialized = true;
        console.log(`[${this.getName()}] Initialized`);
    }

    /**
     * 更新协调器
     */
    update(deltaTime: number): void {
        if (!this.isInitialized || this.isDisposed) {
            return;
        }

        this.onUpdate(deltaTime);
    }

    /**
     * 销毁协调器
     */
    dispose(): void {
        if (this.isDisposed) {
            return;
        }

        console.log(`[${this.getName()}] Disposing...`);
        this.onDispose();
        this.isDisposed = true;
        this.isInitialized = false;
        console.log(`[${this.getName()}] Disposed`);
    }

    /**
     * 检查是否已初始化
     */
    getIsInitialized(): boolean {
        return this.isInitialized;
    }

    /**
     * 检查是否已销毁
     */
    getIsDisposed(): boolean {
        return this.isDisposed;
    }

    /**
     * 子类实现：初始化逻辑
     */
    protected async onInitialize(): Promise<void> {
        // 子类覆盖
    }

    /**
     * 子类实现：更新逻辑
     */
    protected onUpdate(_deltaTime: number): void {
        // 子类覆盖
    }

    /**
     * 子类实现：销毁逻辑
     */
    protected onDispose(): void {
        // 子类覆盖
    }

    /**
     * 子类实现：获取协调器名称
     */
    abstract getName(): string;
}
