/**
 * AI 协调器
 * 负责敌人 AI、寻路等 AI 相关系统
 */

import * as THREE from 'three';
import { BaseCoordinator, CoordinatorConfig } from './BaseCoordinator';
import { EnemyManager } from '../../enemies/EnemyManager';
import { SpatialGrid } from '../../physics/SpatialGrid';
import { GAME_CONFIG } from '../../config/GameConfig';

export interface AICoordinatorConfig extends CoordinatorConfig {
    enemyManager: EnemyManager;
    scene: THREE.Scene;
}

export class AICoordinator extends BaseCoordinator {
    private spatialGrid: SpatialGrid;
    private _playerPosition: THREE.Vector3 = new THREE.Vector3();

    constructor(config: AICoordinatorConfig) {
        super(config);

        // 初始化空间分区
        this.spatialGrid = new SpatialGrid(GAME_CONFIG.enemy.detectionRange);
    }

    protected async onInitialize(): Promise<void> {
        console.log('[AICoordinator] Spatial grid initialized');

        // 监听敌人事件
        this.eventBus.on('enemy:spawned', (data) => this.onEnemySpawned(data));
        this.eventBus.on('enemy:died', (data) => this.onEnemyDied(data));
    }

    protected onUpdate(_deltaTime: number): void {
        // 更新空间分区中的敌人位置
        this.updateSpatialGrid();

        // 可以在这里添加更复杂的 AI 协调逻辑
        // 例如：敌人之间的协作、战术配合等
    }

    protected onDispose(): void {
        this.spatialGrid.clear();
        this.eventBus.removeAllListeners('enemy:spawned');
        this.eventBus.removeAllListeners('enemy:died');
    }

    getName(): string {
        return 'AICoordinator';
    }

    /**
     * 设置玩家位置
     */
    setPlayerPosition(position: THREE.Vector3): void {
        this._playerPosition.copy(position);
    }

    /**
     * 获取空间分区
     */
    getSpatialGrid(): SpatialGrid {
        return this.spatialGrid;
    }

    /**
     * 查询附近的敌人
     */
    getNearbyEnemies(position: THREE.Vector3, radius: number) {
        return this.spatialGrid.queryNearby(position, radius);
    }

    /**
     * 更新空间分区
     */
    private updateSpatialGrid(): void {
        // 空间分区会在 EnemyManager 中使用
        // 这里可以添加额外的优化逻辑
    }

    /**
     * 敌人生成事件
     */
    private onEnemySpawned(_data: any): void {
        // 可以在空间分区中注册敌人
        // if (data.enemy && data.enemy.position) {
        //     this.spatialGrid.insert({
        //         id: data.enemy.id,
        //         position: data.enemy.position
        //     });
        // }
    }

    /**
     * 敌人死亡事件
     */
    private onEnemyDied(_data: any): void {
        // 从空间分区中移除敌人
        // if (data.enemy && data.enemy.id) {
        //     this.spatialGrid.removeById(data.enemy.id);
        // }
    }
}
