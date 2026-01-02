/**
 * 通用对象池基类
 * 用于高效管理可重用对象，减少 GC 压力
 *
 * 使用示例:
 * ```typescript
 * class BulletPool extends ObjectPool<Bullet> {
 *     protected create() {
 *         return new Bullet();
 *     }
 *
 *     protected reset(bullet: Bullet) {
 *         bullet.velocity.set(0, 0, 0);
 *         bullet.active = false;
 *     }
 * }
 * ```
 */

export interface PoolObject {
    active?: boolean;
}

export interface PoolOptions {
    initialSize: number;
    maxSize: number;
    growthFactor: number; // 池满时每次增长的数量
}

export class ObjectPool<T extends PoolObject> {
    protected pool: T[] = [];
    protected active: T[] = [];
    protected options: PoolOptions;

    constructor(options: Partial<PoolOptions> = {}) {
        this.options = {
            initialSize: options.initialSize ?? 10,
            maxSize: options.maxSize ?? 1000,
            growthFactor: options.growthFactor ?? 5,
        };

        // 预创建初始对象
        for (let i = 0; i < this.options.initialSize; i++) {
            const obj = this.create();
            this.pool.push(obj);
        }
    }

    /**
     * 获取对象
     */
    acquire(): T {
        let obj: T;

        // 从池中获取
        if (this.pool.length > 0) {
            obj = this.pool.pop()!;
        } else {
            // 池已空，创建新对象
            if (this.active.length + this.pool.length < this.options.maxSize) {
                obj = this.create();
            } else {
                // 达到最大限制，复用最旧的活动对象
                console.warn(
                    `[ObjectPool] Pool exhausted (max: ${this.options.maxSize}). ` +
                    `Consider increasing pool size.`
                );
                obj = this.active.shift()!;
            }
        }

        // 重置对象状态
        this.reset(obj);

        // 标记为活动
        if ('active' in obj) {
            (obj as any).active = true;
        }

        this.active.push(obj);
        return obj;
    }

    /**
     * 释放对象
     */
    release(obj: T): void {
        const index = this.active.indexOf(obj);

        if (index === -1) {
            console.warn('[ObjectPool] Attempting to release non-active object');
            return;
        }

        // 从活动列表移除
        this.active.splice(index, 1);

        // 标记为非活动
        if ('active' in obj) {
            (obj as any).active = false;
        }

        // 返回池中（如果未满）
        if (this.pool.length < this.options.maxSize) {
            this.pool.push(obj);
        }
    }

    /**
     * 释放所有活动对象
     */
    releaseAll(): void {
        while (this.active.length > 0) {
            this.release(this.active[0]);
        }
    }

    /**
     * 更新所有活动对象
     * @param deltaTime 时间增量
     * @param updateFn 更新函数，返回 true 表示对象需要释放
     */
    update(deltaTime: number, updateFn?: (obj: T, deltaTime: number) => boolean | void): void {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const obj = this.active[i];

            if (updateFn) {
                const shouldRelease = updateFn(obj, deltaTime);
                if (shouldRelease) {
                    this.release(obj);
                }
            }
        }
    }

    /**
     * 清空对象池
     */
    clear(): void {
        // 释放所有活动对象
        this.releaseAll();

        // 销毁池中对象
        for (const obj of this.pool) {
            this.destroy(obj);
        }

        this.pool = [];
    }

    /**
     * 获取活动对象数量
     */
    getActiveCount(): number {
        return this.active.length;
    }

    /**
     * 获取池中空闲对象数量
     */
    getAvailableCount(): number {
        return this.pool.length;
    }

    /**
     * 获取总对象数量
     */
    getTotalCount(): number {
        return this.active.length + this.pool.length;
    }

    /**
     * 获取使用率
     */
    getUsageRate(): number {
        return this.getTotalCount() > 0
            ? this.getActiveCount() / this.getTotalCount()
            : 0;
    }

    /**
     * 预分配对象
     */
    preAllocate(count: number): void {
        const currentTotal = this.getTotalCount();
        const toCreate = Math.min(count, this.options.maxSize - currentTotal);

        for (let i = 0; i < toCreate; i++) {
            const obj = this.create();
            this.pool.push(obj);
        }
    }

    /**
     * 收缩池到指定大小
     */
    shrink(targetSize: number): void {
        const currentSize = this.pool.length;
        const toRemove = Math.max(0, currentSize - targetSize);

        for (let i = 0; i < toRemove; i++) {
            const obj = this.pool.pop()!;
            this.destroy(obj);
        }
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            active: this.active.length,
            available: this.pool.length,
            total: this.getTotalCount(),
            usageRate: this.getUsageRate(),
            maxSize: this.options.maxSize,
        };
    }

    /**
     * 子类实现：创建新对象
     */
    protected create(): T {
        throw new Error('[ObjectPool] create() must be implemented by subclass');
    }

    /**
     * 子类实现：重置对象状态
     */
    protected reset(_obj: T): void {
        // 默认不重置，子类可覆盖
    }

    /**
     * 子类实现：销毁对象
     */
    protected destroy(_obj: T): void {
        // 默认不销毁，子类可覆盖
    }

    /**
     * 析构
     */
    dispose(): void {
        this.clear();
    }
}

/**
 * 类型化对象池（使用类构造函数）
 */
export class TypedObjectPool<T extends PoolObject> extends ObjectPool<T> {
    private constructorFn: new (...args: any[]) => T;

    constructor(
        constructorFn: new (...args: any[]) => T,
        options: Partial<PoolOptions> = {}
    ) {
        super(options);
        this.constructorFn = constructorFn;
    }

    protected create(): T {
        return new this.constructorFn();
    }
}

/**
 * 工厂对象池（使用工厂函数）
 */
export class FactoryObjectPool<T extends PoolObject> extends ObjectPool<T> {
    private factory: () => T;

    constructor(
        factory: () => T,
        options: Partial<PoolOptions> = {}
    ) {
        super(options);
        this.factory = factory;
    }

    protected create(): T {
        return this.factory();
    }
}
