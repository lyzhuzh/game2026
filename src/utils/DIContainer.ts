/**
 * 依赖注入容器
 * 用于管理游戏系统之间的依赖关系
 *
 * 使用示例:
 * ```typescript
 * const container = new DIContainer();
 *
 * // 注册服务
 * container.register('physics', () => new PhysicsWorld());
 * container.register('enemies', (physics) => new EnemyManager(physics), ['physics']);
 *
 * // 解析服务
 * const enemies = container.resolve<EnemyManager>('enemies');
 * ```
 */

type ServiceFactory<T = any> = (...deps: any[]) => T;
type ServiceIdentifier = string | symbol;

export interface ServiceDescriptor<T = any> {
    factory: ServiceFactory<T>;
    dependencies: ServiceIdentifier[];
    instance?: T;
    singleton: boolean;
    resolved: boolean;
}

export class DIContainer {
    private services = new Map<ServiceIdentifier, ServiceDescriptor>();
    private resolving = new Set<ServiceIdentifier>();

    /**
     * 注册服务
     * @param id 服务标识符
     * @param factory 工厂函数
     * @param dependencies 依赖的服务ID数组
     * @param singleton 是否单例（默认 true）
     */
    register<T = any>(
        id: ServiceIdentifier,
        factory: ServiceFactory<T>,
        dependencies: ServiceIdentifier[] = [],
        singleton: boolean = true
    ): this {
        if (this.services.has(id)) {
            console.warn(`[DIContainer] Service "${String(id)}" already registered`);
            return this;
        }

        this.services.set(id, {
            factory,
            dependencies,
            singleton,
            resolved: false,
        });

        return this;
    }

    /**
     * 注册单例实例
     * @param id 服务标识符
     * @param instance 实例
     */
    registerInstance<T = any>(id: ServiceIdentifier, instance: T): this {
        if (this.services.has(id)) {
            console.warn(`[DIContainer] Service "${String(id)}" already registered`);
            return this;
        }

        this.services.set(id, {
            factory: () => instance,
            dependencies: [],
            singleton: true,
            instance,
            resolved: true,
        });

        return this;
    }

    /**
     * 注册值类型
     */
    registerValue<T = any>(id: ServiceIdentifier, value: T): this {
        return this.registerInstance(id, value);
    }

    /**
     * 解析服务
     * @param id 服务标识符
     */
    resolve<T = any>(id: ServiceIdentifier): T {
        const descriptor = this.services.get(id);

        if (!descriptor) {
            throw new Error(`[DIContainer] Service "${String(id)}" not found`);
        }

        // 检查循环依赖
        if (this.resolving.has(id)) {
            throw new Error(
                `[DIContainer] Circular dependency detected: "${Array.from(this.resolving).join(' -> ')} -> ${String(id)}"`
            );
        }

        // 如果已解析且是单例，返回缓存实例
        if (descriptor.singleton && descriptor.resolved) {
            return descriptor.instance as T;
        }

        // 开始解析
        this.resolving.add(id);

        try {
            // 解析依赖
            const dependencies = descriptor.dependencies.map((depId) =>
                this.resolve(depId)
            );

            // 创建实例
            const instance = descriptor.factory(...dependencies);

            // 缓存单例实例
            if (descriptor.singleton) {
                descriptor.instance = instance;
                descriptor.resolved = true;
            }

            return instance as T;
        } finally {
            // 结束解析
            this.resolving.delete(id);
        }
    }

    /**
     * 尝试解析服务（失败返回 undefined）
     */
    tryResolve<T = any>(id: ServiceIdentifier): T | undefined {
        try {
            return this.resolve<T>(id);
        } catch {
            return undefined;
        }
    }

    /**
     * 检查服务是否已注册
     */
    has(id: ServiceIdentifier): boolean {
        return this.services.has(id);
    }

    /**
     * 检查服务是否已解析
     */
    isResolved(id: ServiceIdentifier): boolean {
        const descriptor = this.services.get(id);
        return descriptor ? descriptor.resolved : false;
    }

    /**
     * 获取所有已注册的服务ID
     */
    getServiceIds(): ServiceIdentifier[] {
        return Array.from(this.services.keys());
    }

    /**
     * 移除服务
     */
    unregister(id: ServiceIdentifier): boolean {
        const descriptor = this.services.get(id);

        if (!descriptor) {
            return false;
        }

        // 如果有实例，尝试调用 dispose
        if (descriptor.instance && typeof (descriptor.instance as any).dispose === 'function') {
            (descriptor.instance as any).dispose();
        }

        this.services.delete(id);
        return true;
    }

    /**
     * 清空所有服务
     */
    clear(): void {
        // 销毁所有单例实例
        for (const descriptor of this.services.values()) {
            if (descriptor.instance && typeof (descriptor.instance as any).dispose === 'function') {
                try {
                    (descriptor.instance as any).dispose();
                } catch (error) {
                    console.error('[DIContainer] Error disposing service:', error);
                }
            }
        }

        this.services.clear();
    }

    /**
     * 创建子容器
     */
    createChildContainer(): DIContainer {
        const child = new DIContainer();

        // 复制父容器的服务引用（不是深拷贝）
        for (const [id, descriptor] of this.services) {
            child.services.set(id, descriptor);
        }

        return child;
    }

    /**
     * 获取容器统计信息
     */
    getStats() {
        const stats = {
            totalServices: this.services.size,
            resolvedServices: 0,
            singletonServices: 0,
            transientServices: 0,
        };

        for (const descriptor of this.services.values()) {
            if (descriptor.resolved) stats.resolvedServices++;
            if (descriptor.singleton) stats.singletonServices++;
            else stats.transientServices++;
        }

        return stats;
    }

    /**
     * 销毁容器
     */
    dispose(): void {
        this.clear();
    }
}

/**
 * 全局容器实例
 */
let globalContainer: DIContainer | null = null;

export function getGlobalDIContainer(): DIContainer {
    if (!globalContainer) {
        globalContainer = new DIContainer();
    }
    return globalContainer;
}

export function disposeGlobalDIContainer(): void {
    if (globalContainer) {
        globalContainer.dispose();
        globalContainer = null;
    }
}
