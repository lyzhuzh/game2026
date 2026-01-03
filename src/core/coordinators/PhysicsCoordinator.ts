/**
 * 物理协调器
 * 负责物理系统的更新和同步
 */

import { BaseCoordinator, CoordinatorConfig } from './BaseCoordinator';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { CharacterController } from '../../physics/CharacterController';

export interface PhysicsCoordinatorConfig extends CoordinatorConfig {
    physics: PhysicsWorld;
    character: CharacterController;
}

export class PhysicsCoordinator extends BaseCoordinator {
    private _physics: PhysicsWorld;
    private _character: CharacterController;

    constructor(config: PhysicsCoordinatorConfig) {
        super(config);
        this._physics = config.physics;
        this._character = config.character;
    }

    protected async onInitialize(): Promise<void> {
        // 监听物理相关事件
        this.eventBus.on('player:jump', () => this.onPlayerJump());
        this.eventBus.on('player:landed', () => this.onPlayerLanded());
    }

    protected onUpdate(_deltaTime: number): void {
        // 物理步进在 Game.onFixedUpdate 中处理
        // 这里处理物理与视觉的同步
        this.syncPhysics();
    }

    protected onDispose(): void {
        this.eventBus.removeAllListeners('player:jump');
        this.eventBus.removeAllListeners('player:landed');
    }

    getName(): string {
        return 'PhysicsCoordinator';
    }

    /**
     * 同步物理体与视觉网格
     */
    private syncPhysics(): void {
        // CharacterController 会自动同步
        // 其他物理体如果有需要在这里处理
    }

    /**
     * 玩家跳跃事件
     */
    private onPlayerJump(): void {
        // 可以在这里添加跳跃相关的物理逻辑
    }

    /**
     * 玩家落地事件
     */
    private onPlayerLanded(): void {
        // 可以在这里添加落地相关的物理逻辑
    }

    /**
     * 获取物理世界
     */
    getPhysics(): PhysicsWorld {
        return this._physics;
    }

    /**
     * 获取角色控制器
     */
    getCharacter(): CharacterController {
        return this._character;
    }
}
