/**
 * 事件总线系统
 * 用于解耦系统间通信，替代直接回调
 *
 * 使用示例:
 * ```typescript
 * // 监听事件
 * const unsubscribe = eventBus.on('enemy:died', (data) => {
 *     console.log('Enemy died:', data);
 * });
 *
 * // 触发事件
 * eventBus.emit('enemy:died', { enemyId: 1, score: 100 });
 *
 * // 取消监听
 * unsubscribe();
 * ```
 */

type EventCallback<T = any> = (data: T) => void;
type UnsubscribeFn = () => void;

export interface EventBusOptions {
    maxListeners?: number;
    enableLogging?: boolean;
}

export class EventBus {
    private listeners = new Map<string, Set<EventCallback>>();
    private eventHistory: Map<string, any[]> = new Map();
    private historyLimit: number = 100;

    private options: Required<EventBusOptions>;

    constructor(options: EventBusOptions = {}) {
        this.options = {
            maxListeners: options.maxListeners ?? 100,
            enableLogging: options.enableLogging ?? false,
        };
    }

    /**
     * 注册事件监听器
     * @param event 事件名称
     * @param callback 回调函数
     * @returns 取消监听函数
     */
    on<T = any>(event: string, callback: EventCallback<T>): UnsubscribeFn {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        const listeners = this.listeners.get(event)!;

        // 检查监听器数量限制
        if (listeners.size >= this.options.maxListeners) {
            console.warn(
                `[EventBus] Event "${event}" has reached max listeners ` +
                `(${this.options.maxListeners}). This may indicate a memory leak.`
            );
        }

        listeners.add(callback);

        if (this.options.enableLogging) {
            console.log(`[EventBus] Subscribed to "${event}" (total: ${listeners.size})`);
        }

        // 返回取消订阅函数
        return () => this.off(event, callback);
    }

    /**
     * 注册一次性事件监听器
     * @param event 事件名称
     * @param callback 回调函数
     * @returns 取消监听函数
     */
    once<T = any>(event: string, callback: EventCallback<T>): UnsubscribeFn {
        const wrappedCallback: EventCallback<T> = (data) => {
            callback(data);
            this.off(event, wrappedCallback as any);
        };

        return this.on(event, wrappedCallback as any);
    }

    /**
     * 取消事件监听器
     * @param event 事件名称
     * @param callback 回调函数
     */
    off<T = any>(event: string, callback: EventCallback<T>): void {
        const listeners = this.listeners.get(event);
        if (listeners) {
            listeners.delete(callback);

            if (this.options.enableLogging) {
                console.log(`[EventBus] Unsubscribed from "${event}" (remaining: ${listeners.size})`);
            }

            // 如果没有监听器了，删除事件
            if (listeners.size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    /**
     * 触发事件
     * @param event 事件名称
     * @param data 事件数据
     */
    emit<T = any>(event: string, data?: T): void {
        const listeners = this.listeners.get(event);

        if (this.options.enableLogging) {
            console.log(`[EventBus] Emitting "${event}"`, data);
        }

        if (listeners && listeners.size > 0) {
            // 创建副本以避免在迭代时修改 Set
            const callbacks = Array.from(listeners);

            for (const callback of callbacks) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(
                        `[EventBus] Error in "${event}" listener:`,
                        error
                    );
                }
            }
        }

        // 记录事件历史（用于调试）
        this.addToHistory(event, data);
    }

    /**
     * 异步触发事件
     * @param event 事件名称
     * @param data 事件数据
     */
    async emitAsync<T = any>(event: string, data?: T): Promise<void> {
        const listeners = this.listeners.get(event);

        if (listeners && listeners.size > 0) {
            const callbacks = Array.from(listeners);

            for (const callback of callbacks) {
                try {
                    await callback(data);
                } catch (error) {
                    console.error(
                        `[EventBus] Error in async "${event}" listener:`,
                        error
                    );
                }
            }
        }

        this.addToHistory(event, data);
    }

    /**
     * 移除事件的所有监听器
     * @param event 事件名称
     */
    removeAllListeners(event?: string): void {
        if (event) {
            this.listeners.delete(event);
            if (this.options.enableLogging) {
                console.log(`[EventBus] Removed all listeners for "${event}"`);
            }
        } else {
            const count = this.listeners.size;
            this.listeners.clear();
            if (this.options.enableLogging) {
                console.log(`[EventBus] Removed all listeners (${count} events)`);
            }
        }
    }

    /**
     * 获取事件的监听器数量
     * @param event 事件名称
     */
    listenerCount(event: string): number {
        return this.listeners.get(event)?.size ?? 0;
    }

    /**
     * 获取所有事件名称
     */
    eventNames(): string[] {
        return Array.from(this.listeners.keys());
    }

    /**
     * 检查是否有事件监听器
     * @param event 事件名称
     */
    hasListeners(event: string): boolean {
        const listeners = this.listeners.get(event);
        return listeners ? listeners.size > 0 : false;
    }

    /**
     * 获取事件历史
     * @param event 事件名称
     * @param limit 返回数量限制
     */
    getHistory(event: string, limit: number = 10): any[] {
        const history = this.eventHistory.get(event);
        return history ? history.slice(-limit) : [];
    }

    /**
     * 清空事件历史
     */
    clearHistory(): void {
        this.eventHistory.clear();
    }

    /**
     * 添加到事件历史
     */
    private addToHistory(event: string, data: any): void {
        if (!this.eventHistory.has(event)) {
            this.eventHistory.set(event, []);
        }

        const history = this.eventHistory.get(event)!;
        history.push({
            event,
            data,
            timestamp: Date.now(),
        });

        // 限制历史记录大小
        if (history.length > this.historyLimit) {
            history.shift();
        }
    }

    /**
     * 设置历史记录限制
     */
    setHistoryLimit(limit: number): void {
        this.historyLimit = limit;
    }

    /**
     * 销毁事件总线
     */
    dispose(): void {
        this.removeAllListeners();
        this.clearHistory();
    }
}

/**
 * 游戏事件名称常量
 * 用于类型安全的事件订阅
 */
export const GameEvents = {
    // 敌人事件
    ENEMY_SPAWNED: 'enemy:spawned',
    ENEMY_DIED: 'enemy:died',
    ENEMY_HURT: 'enemy:hurt',
    ENEMY_ATTACK: 'enemy:attack',

    // 玩家事件
    PLAYER_HURT: 'player:hurt',
    PLAYER_DIED: 'player:died',
    PLAYER_RESPAWNED: 'player:respawned',
    PLAYER_FOOTSTEP: 'player:footstep',

    // 武器事件
    WEAPON_FIRED: 'weapon:fired',
    WEAPON_HIT: 'weapon:hit',
    WEAPON_RELOADED: 'weapon:reloaded',
    WEAPON_SWITCHED: 'weapon:switched',
    WEAPON_EMPTY: 'weapon:empty',

    // 游戏事件
    GAME_STARTED: 'game:started',
    GAME_PAUSED: 'game:paused',
    GAME_RESUMED: 'game:resumed',
    GAME_OVER: 'game:over',

    // 波次事件
    WAVE_STARTED: 'wave:started',
    WAVE_COMPLETED: 'wave:completed',

    // 物品事件
    ITEM_PICKED_UP: 'item:picked_up',
    ITEM_SPAWNED: 'item:spawned',

    // UI 事件
    UI_UPDATED: 'ui:updated',
    DAMAGE_SHOWN: 'damage:shown',
} as const;

export type GameEventName = typeof GameEvents[keyof typeof GameEvents];

/**
 * 全局事件总线实例
 */
let globalEventBus: EventBus | null = null;

export function getGlobalEventBus(): EventBus {
    if (!globalEventBus) {
        globalEventBus = new EventBus({
            enableLogging: false, // 生产环境设为 false
            maxListeners: 100,
        });
    }
    return globalEventBus;
}

export function disposeGlobalEventBus(): void {
    if (globalEventBus) {
        globalEventBus.dispose();
        globalEventBus = null;
    }
}
