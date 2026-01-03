/**
 * 空间网格分区系统
 * 用于优化实体查询，将 O(n) 复杂度降低到接近 O(1)
 *
 * 适用场景:
 * - 敌人检测附近玩家
 * - 物品拾取检测
 * - 碰撞检测优化
 * - 范围伤害查询
 */

import * as THREE from 'three';

export interface SpatialEntity {
    id: string | number;
    position: THREE.Vector3;
    // 可选的边界半径
    radius?: number;
}

export class SpatialGrid {
    protected cellSize: number;
    protected grid = new Map<string, Set<SpatialEntity>>();
    protected entities = new Map<string | number, SpatialEntity>();
    protected positionCache = new Map<string | number, THREE.Vector3>();

    // 统计信息
    protected queryCount = 0;
    protected hitCount = 0;

    constructor(cellSize: number = 10) {
        this.cellSize = cellSize;
    }

    /**
     * 将世界坐标转换为网格键
     */
    private getKey(x: number, z: number): string {
        const cx = Math.floor(x / this.cellSize);
        const cz = Math.floor(z / this.cellSize);
        return `${cx},${cz}`;
    }

    /**
     * 获取实体所在的网格键
     */
    private getEntityKey(entity: SpatialEntity): string {
        return this.getKey(entity.position.x, entity.position.z);
    }

    /**
     * 插入实体到空间分区
     */
    insert(entity: SpatialEntity): void {
        const key = this.getEntityKey(entity);

        if (!this.grid.has(key)) {
            this.grid.set(key, new Set());
        }

        this.grid.get(key)!.add(entity);
        this.entities.set(entity.id, entity);
        this.positionCache.set(entity.id, entity.position.clone());
    }

    /**
     * 更新实体位置（如果实体移动）
     */
    update(entity: SpatialEntity): void {
        // 检查位置是否改变
        const oldPosition = this.positionCache.get(entity.id);
        if (oldPosition) {
            const oldKey = this.getKey(oldPosition.x, oldPosition.z);
            const newKey = this.getEntityKey(entity);

            if (oldKey === newKey) {
                // 还在同一个格子，只更新缓存
                this.positionCache.set(entity.id, entity.position.clone());
                return;
            }

            // 从旧格子移除
            const oldCell = this.grid.get(oldKey);
            if (oldCell) {
                oldCell.delete(entity);
                if (oldCell.size === 0) {
                    this.grid.delete(oldKey);
                }
            }
        }

        // 插入到新格子
        this.insert(entity);
    }

    /**
     * 从空间分区移除实体
     */
    remove(entity: SpatialEntity): void {
        const key = this.getEntityKey(entity);
        const cell = this.grid.get(key);

        if (cell) {
            cell.delete(entity);
            if (cell.size === 0) {
                this.grid.delete(key);
            }
        }

        this.entities.delete(entity.id);
        this.positionCache.delete(entity.id);
    }

    /**
     * 根据ID移除实体
     */
    removeById(id: string | number): void {
        const entity = this.entities.get(id);
        if (entity) {
            this.remove(entity);
        }
    }

    /**
     * 查询附近的实体
     * @param position 查询中心位置
     * @param radius 查询半径
     * @returns 附近的实体列表
     */
    queryNearby(
        position: THREE.Vector3,
        radius: number
    ): SpatialEntity[] {
        this.queryCount++;

        // 计算需要查询的格子范围
        const cellRadius = Math.ceil(radius / this.cellSize);
        const centerKey = this.getKey(position.x, position.z);
        const [cx, cz] = centerKey.split(',').map(Number);

        const results: SpatialEntity[] = [];
        const checked = new Set<SpatialEntity>();
        const radiusSquared = radius * radius;

        // 遍历周围的格子
        for (let dx = -cellRadius; dx <= cellRadius; dx++) {
            for (let dz = -cellRadius; dz <= cellRadius; dz++) {
                const key = `${cx + dx},${cz + dz}`;
                const cell = this.grid.get(key);

                if (cell) {
                    for (const entity of cell) {
                        if (checked.has(entity)) continue;

                        const distanceSquared = position.distanceToSquared(entity.position);

                        // 精确距离检查
                        if (distanceSquared <= radiusSquared) {
                            results.push(entity);
                            this.hitCount++;
                        }

                        checked.add(entity);
                    }
                }
            }
        }

        return results;
    }

    /**
     * 查询圆形区域内的实体
     * @param center 圆心
     * @param radius 半径
     */
    queryInCircle(
        center: THREE.Vector3,
        radius: number
    ): SpatialEntity[] {
        return this.queryNearby(center, radius);
    }

    /**
     * 查询矩形区域内的实体
     * @param min 最小坐标
     * @param max 最大坐标
     */
    queryInBounds(min: THREE.Vector3, max: THREE.Vector3): SpatialEntity[] {
        const results: SpatialEntity[] = [];

        for (const entity of this.entities.values()) {
            const pos = entity.position;
            if (
                pos.x >= min.x && pos.x <= max.x &&
                pos.z >= min.z && pos.z <= max.z
            ) {
                results.push(entity);
            }
        }

        return results;
    }

    /**
     * 查询最近的实体
     * @param position 位置
     * @param maxDistance 最大距离
     * @param filter 过滤函数
     */
    findNearest(
        position: THREE.Vector3,
        maxDistance: number = Infinity,
        filter?: (entity: SpatialEntity) => boolean
    ): SpatialEntity | null {
        const nearby = this.queryNearby(position, maxDistance);

        let nearest: SpatialEntity | null = null;
        let nearestDistance = maxDistance * maxDistance;

        for (const entity of nearby) {
            if (filter && !filter(entity)) continue;

            const distanceSquared = position.distanceToSquared(entity.position);
            if (distanceSquared < nearestDistance) {
                nearest = entity;
                nearestDistance = distanceSquared;
            }
        }

        return nearest;
    }

    /**
     * 清空所有实体
     */
    clear(): void {
        this.grid.clear();
        this.entities.clear();
        this.positionCache.clear();
    }

    /**
     * 获取实体总数
     */
    size(): number {
        return this.entities.size;
    }

    /**
     * 获取格子数量
     */
    getCellCount(): number {
        return this.grid.size;
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            entityCount: this.entities.size,
            cellCount: this.grid.size,
            queryCount: this.queryCount,
            hitCount: this.hitCount,
            hitRate: this.queryCount > 0 ? this.hitCount / this.queryCount : 0,
            avgEntitiesPerCell: this.grid.size > 0 ? this.entities.size / this.grid.size : 0,
        };
    }

    /**
     * 重置统计信息
     */
    resetStats(): void {
        this.queryCount = 0;
        this.hitCount = 0;
    }

    /**
     * 可视化调试（开发用）
     */
    debugInfo(): void {
        const stats = this.getStats();
        console.log('[SpatialGrid] Stats:', stats);
        console.log('[SpatialGrid] Cells:', this.grid.size);
    }
}

/**
 * 3D 空间哈希（支持高度）
 */
export class SpatialHash3D extends SpatialGrid {
    private getKey3D(x: number, y: number, z: number): string {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        const cz = Math.floor(z / this.cellSize);
        return `${cx},${cy},${cz}`;
    }

    private getEntityKey3D(entity: SpatialEntity): string {
        return this.getKey3D(
            entity.position.x,
            entity.position.y,
            entity.position.z
        );
    }

    override insert(entity: SpatialEntity): void {
        const key = this.getEntityKey3D(entity);

        if (!this.grid.has(key)) {
            this.grid.set(key, new Set());
        }

        this.grid.get(key)!.add(entity);
        this.entities.set(entity.id, entity);
        this.positionCache.set(entity.id, entity.position.clone());
    }

    override update(entity: SpatialEntity): void {
        const oldPosition = this.positionCache.get(entity.id);
        if (oldPosition) {
            const oldKey = this.getKey3D(
                oldPosition.x,
                oldPosition.y,
                oldPosition.z
            );
            const newKey = this.getEntityKey3D(entity);

            if (oldKey === newKey) {
                this.positionCache.set(entity.id, entity.position.clone());
                return;
            }

            const oldCell = this.grid.get(oldKey);
            if (oldCell) {
                oldCell.delete(entity);
                if (oldCell.size === 0) {
                    this.grid.delete(oldKey);
                }
            }
        }

        this.insert(entity);
    }

    override remove(entity: SpatialEntity): void {
        const key = this.getEntityKey3D(entity);
        const cell = this.grid.get(key);

        if (cell) {
            cell.delete(entity);
            if (cell.size === 0) {
                this.grid.delete(key);
            }
        }

        this.entities.delete(entity.id);
        this.positionCache.delete(entity.id);
    }

    override queryNearby(
        position: THREE.Vector3,
        radius: number
    ): SpatialEntity[] {
        this.queryCount++;

        const cellRadius = Math.ceil(radius / this.cellSize);
        const [cx, cy, cz] = this.getKey3D(
            position.x,
            position.y,
            position.z
        ).split(',').map(Number);

        const results: SpatialEntity[] = [];
        const checked = new Set<SpatialEntity>();
        const radiusSquared = radius * radius;

        for (let dx = -cellRadius; dx <= cellRadius; dx++) {
            for (let dy = -cellRadius; dy <= cellRadius; dy++) {
                for (let dz = -cellRadius; dz <= cellRadius; dz++) {
                    const key = `${cx + dx},${cy + dy},${cz + dz}`;
                    const cell = this.grid.get(key);

                    if (cell) {
                        for (const entity of cell) {
                            if (checked.has(entity)) continue;

                            const distanceSquared = position.distanceToSquared(entity.position);

                            if (distanceSquared <= radiusSquared) {
                                results.push(entity);
                                this.hitCount++;
                            }

                            checked.add(entity);
                        }
                    }
                }
            }
        }

        return results;
    }
}
