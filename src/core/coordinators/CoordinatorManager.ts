/**
 * 协调器管理器
 * 统一管理所有协调器的初始化、更新和销毁
 */

import { ICoordinator } from './BaseCoordinator';
import { EventBus } from '../EventBus';
import { Game } from '../Game';

/**
 * 协调器管理器
 */
export class CoordinatorManager {
    private coordinators: Map<string, ICoordinator> = new Map();
    private eventBus: EventBus;
    private _game: Game;
    private isInitialized: boolean = false;

    constructor(game: Game, eventBus: EventBus) {
        this._game = game;
        this.eventBus = eventBus;
    }

    /**
     * 注册协调器
     */
    register(name: string, coordinator: ICoordinator): void {
        if (this.coordinators.has(name)) {
            console.warn(`[CoordinatorManager] Coordinator "${name}" already registered`);
            return;
        }

        this.coordinators.set(name, coordinator);
        console.log(`[CoordinatorManager] Registered "${name}"`);
    }

    /**
     * 获取协调器
     */
    get<T extends ICoordinator>(name: string): T | undefined {
        return this.coordinators.get(name) as T;
    }

    /**
     * 初始化所有协调器
     */
    async initializeAll(): Promise<void> {
        if (this.isInitialized) {
            console.warn('[CoordinatorManager] Already initialized');
            return;
        }

        console.log('[CoordinatorManager] Initializing coordinators...');

        // 按依赖顺序初始化协调器
        const initOrder = Array.from(this.coordinators.entries());

        for (const [_name, coordinator] of initOrder) {
            await coordinator.initialize();
        }

        this.isInitialized = true;
        console.log(`[CoordinatorManager] Initialized ${this.coordinators.size} coordinators`);
    }

    /**
     * 更新所有协调器
     */
    updateAll(deltaTime: number): void {
        for (const coordinator of this.coordinators.values()) {
            coordinator.update(deltaTime);
        }
    }

    /**
     * 销毁所有协调器
     */
    disposeAll(): void {
        console.log('[CoordinatorManager] Disposing coordinators...');

        // 反序销毁（先销毁依赖者）
        const coordinators = Array.from(this.coordinators.values()).reverse();

        for (const coordinator of coordinators) {
            coordinator.dispose();
        }

        this.coordinators.clear();
        this.isInitialized = false;

        console.log('[CoordinatorManager] Disposed');
    }

    /**
     * 获取协调器数量
     */
    getCount(): number {
        return this.coordinators.size;
    }

    /**
     * 获取所有协调器名称
     */
    getNames(): string[] {
        return Array.from(this.coordinators.keys());
    }

    /**
     * 检查是否已初始化
     */
    getIsInitialized(): boolean {
        return this.isInitialized;
    }

    /**
     * 获取事件总线
     */
    getEventBus(): EventBus {
        return this.eventBus;
    }
}

/**
 * 创建默认协调器集合
 */
export function createDefaultCoordinators(
    game: Game,
    eventBus: EventBus
): CoordinatorManager {
    const manager = new CoordinatorManager(game, eventBus);

    // 创建协调器的工厂函数将在 Game 类中实现
    // 这里只是示例结构

    return manager;
}
