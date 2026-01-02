/**
 * 战斗协调器
 * 负责武器、敌人、伤害等战斗相关系统
 */

import * as THREE from 'three';
import { BaseCoordinator, CoordinatorConfig } from './BaseCoordinator';
import { WeaponManager } from '../../weapons/WeaponManager';
import { EnemyManager } from '../../enemies/EnemyManager';
import { ProjectileManager } from '../../weapons/ProjectileManager';
import { ParticleSystem } from '../../particles/ParticleSystem';

export interface CombatCoordinatorConfig extends CoordinatorConfig {
    weapons: WeaponManager;
    enemies: EnemyManager;
    projectiles: ProjectileManager;
    particles: ParticleSystem;
    scene: THREE.Scene;
}

export class CombatCoordinator extends BaseCoordinator {
    private weapons: WeaponManager;
    private enemies: EnemyManager;
    private projectiles: ProjectileManager;
    private particles: ParticleSystem;
    private _scene: THREE.Scene;

    // 玩家状态引用
    private playerPosition: THREE.Vector3 = new THREE.Vector3();

    constructor(config: CombatCoordinatorConfig) {
        super(config);
        this.weapons = config.weapons;
        this.enemies = config.enemies;
        this.projectiles = config.projectiles;
        this.particles = config.particles;
        this._scene = config.scene;
    }

    protected async onInitialize(): Promise<void> {
        // 设置武器命中回调
        this.setupWeaponCallbacks();

        // 设置敌人事件回调
        this.setupEnemyCallbacks();

        // 设置投射物爆炸回调
        this.setupProjectileCallbacks();

        // 监听事件
        this.setupEventListeners();
    }

    protected onUpdate(deltaTime: number): void {
        // 更新武器系统
        this.weapons.update(deltaTime);

        // 更新投射物系统
        this.projectiles.update(deltaTime);

        // 更新粒子系统
        this.particles.update(deltaTime);

        // 更新敌人系统
        this.enemies.setPlayerPosition(this.playerPosition);
        this.enemies.update(deltaTime);
    }

    protected onDispose(): void {
        this.weapons.dispose?.();
        this.enemies.dispose();
        this.projectiles.clear();
        this.particles.dispose();

        // 移除所有事件监听
        this.eventBus.removeAllListeners('weapon:fired');
        this.eventBus.removeAllListeners('weapon:hit');
        this.eventBus.removeAllListeners('enemy:died');
        this.eventBus.removeAllListeners('enemy:hurt');
        this.eventBus.removeAllListeners('explosion:damage');
        this.eventBus.removeAllListeners('flamethrower:damage');
    }

    getName(): string {
        return 'CombatCoordinator';
    }

    /**
     * 设置玩家位置
     */
    setPlayerPosition(position: THREE.Vector3): void {
        this.playerPosition.copy(position);
    }

    /**
     * 设置武器开火数据
     */
    setWeaponFireData(origin: THREE.Vector3, direction: THREE.Vector3): void {
        this.weapons.setFireData(origin, direction);
    }

    /**
     * 获取当前武器状态
     */
    getCurrentWeaponState() {
        return this.weapons.getCurrentWeaponState();
    }

    /**
     * 获取击杀数
     */
    getLivingEnemyCount(): number {
        return this.enemies.getLivingEnemyCount();
    }

    /**
     * 获取波次
     */
    getWaveNumber(): number {
        return this.enemies.getWaveNumber();
    }

    /**
     * 开始波次
     */
    startWave(waveNumber: number): void {
        this.enemies.startWave(waveNumber);
    }

    /**
     * 设置武器回调
     */
    private setupWeaponCallbacks(): void {
        // 武器命中回调
        const onHit = (position: THREE.Vector3, damage: number) => {
            this.onWeaponHit(position, damage);
        };

        // 武器开火回调
        const onFire = (weaponType: string) => {
            this.onWeaponFire(weaponType);
        };

        // 武器换弹回调
        const onReload = () => {
            this.eventBus.emit('weapon:reloaded');
        };

        // 武器切换回调
        const onSwitch = (weaponType: string) => {
            this.eventBus.emit('weapon:switched', { weaponType });
        };

        // 火焰喷射器伤害回调
        const onFlamethrowerDamage = (
            origin: THREE.Vector3,
            direction: THREE.Vector3,
            range: number,
            damage: number
        ) => {
            this.onFlamethrowerDamage(origin, direction, range, damage);
        };

        // 设置回调到 WeaponManager
        (this.weapons as any).setOnHit?.(onHit);
        (this.weapons as any).setOnFire?.(onFire);
        (this.weapons as any).setOnReload?.(onReload);
        (this.weapons as any).setOnSwitch?.(onSwitch);
        (this.weapons as any).setOnFlamethrowerDamage?.(onFlamethrowerDamage);
    }

    /**
     * 设置敌人事件回调
     */
    private setupEnemyCallbacks(): void {
        // 敌人死亡回调
        this.enemies.setOnEnemyDeath((enemy) => {
            this.eventBus.emit('enemy:died', {
                enemy,
                scoreValue: enemy.stats.scoreValue
            });
        });

        // 敌人攻击回调
        this.enemies.setOnEnemyAttack((damage) => {
            this.eventBus.emit('enemy:attack', { damage });
        });

        // 敌人受伤回调
        this.enemies.setOnEnemyHurt(() => {
            this.eventBus.emit('enemy:hurt');
        });
    }

    /**
     * 设置投射物回调
     */
    private setupProjectileCallbacks(): void {
        this.projectiles.setOnExplosionDamage(
            (position, radius, damage) => {
                this.onExplosionDamage(position, radius, damage);
            }
        );
    }

    /**
     * 设置事件监听器
     */
    private setupEventListeners(): void {
        // 监听玩家位置更新
        this.eventBus.on('player:position:updated', (data) => {
            this.setPlayerPosition(data.position);
        });
    }

    /**
     * 武器命中处理
     */
    private onWeaponHit(position: THREE.Vector3, damage: number): void {
        const hit = this.enemies.damageEnemyAtPosition(position, damage);

        if (hit) {
            this.eventBus.emit('weapon:hit', { position, damage });
            this.particles.bloodSplatter(position, new THREE.Vector3(0, 1, 0));
        } else {
            this.particles.bulletHole(position, new THREE.Vector3(0, 1, 0));
            this.particles.spark(position, new THREE.Vector3(0, 1, 0));
        }
    }

    /**
     * 武器开火处理
     */
    private onWeaponFire(weaponType: string): void {
        this.eventBus.emit('weapon:fired', { weaponType });
    }

    /**
     * 投射物爆炸伤害
     */
    private onExplosionDamage(
        position: THREE.Vector3,
        radius: number,
        damage: number
    ): void {
        this.enemies.damageEnemiesInRadius(position, radius, damage);
        this.eventBus.emit('explosion:damage', { position, radius, damage });
    }

    /**
     * 火焰喷射器伤害
     */
    private onFlamethrowerDamage(
        origin: THREE.Vector3,
        direction: THREE.Vector3,
        range: number,
        damage: number
    ): void {
        this.enemies.damageEnemiesInCone(origin, direction, range, damage);
        this.eventBus.emit('flamethrower:damage', { origin, direction, range, damage });
    }
}
