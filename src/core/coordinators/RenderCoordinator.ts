/**
 * 渲染协调器
 * 负责渲染、UI更新等视觉相关系统
 */

import * as THREE from 'three';
import { BaseCoordinator, CoordinatorConfig } from './BaseCoordinator';
import { UIManager } from '../../ui/UIManager';
import { WeaponRenderer } from '../../weapons/WeaponRenderer';
import { GAME_CONFIG } from '../../config/GameConfig';

export interface RenderCoordinatorConfig extends CoordinatorConfig {
    ui: UIManager;
    weaponRenderer: WeaponRenderer;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
}

export class RenderCoordinator extends BaseCoordinator {
    private ui: UIManager;
    private weaponRenderer: WeaponRenderer;
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.Camera;

    // 渲染统计
    private frameCount: number = 0;
    private lastFpsUpdate: number = 0;
    private fps: number = 60;

    constructor(config: RenderCoordinatorConfig) {
        super(config);
        this.ui = config.ui;
        this.weaponRenderer = config.weaponRenderer;
        this.renderer = config.renderer;
        this.scene = config.scene;
        this.camera = config.camera;
    }

    protected async onInitialize(): Promise<void> {
        console.log('[RenderCoordinator] Renderer initialized');
    }

    protected onUpdate(deltaTime: number): void {
        // 更新武器渲染
        // this.weaponRenderer.update(deltaTime);

        // 更新 FPS 计算
        this.updateFPS(deltaTime);

        // 渲染在 Game.onRender 中处理
        // 这里可以添加渲染前的准备工作
    }

    protected onDispose(): void {
        this.ui.dispose();
        this.weaponRenderer.dispose();
    }

    getName(): string {
        return 'RenderCoordinator';
    }

    /**
     * 渲染场景
     */
    render(): void {
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * 更新 UI
     */
    updateUI(playerState: any, waveNumber: number, enemyCount: number): void {
        this.ui.update(playerState, waveNumber, enemyCount);
    }

    /**
     * 更新武器 HUD
     */
    updateWeaponHUD(weaponState: any): void {
        if (!weaponState) return;
        const { type, state, stats } = weaponState;
        this.ui.updateWeapon(type, state.currentAmmo, stats.magazineSize, state.reserveAmmo);
    }

    /**
     * 显示伤害指示器
     */
    showDamageIndicator(): void {
        this.ui.showDamageIndicator();
    }

    /**
     * 显示拾取通知
     */
    showPickupNotification(itemName: string): void {
        this.ui.showPickupNotification(itemName);
    }

    /**
     * 显示波次公告
     */
    showWaveAnnouncement(wave: number): void {
        this.ui.showWaveAnnouncement(wave);
    }

    /**
     * 更新武器渲染
     */
    updateWeaponRenderer(
        deltaTime: number,
        movementInput: { x: number; y: number },
        isFiring: boolean
    ): void {
        this.weaponRenderer.update(deltaTime, movementInput, isFiring);
    }

    /**
     * 显示武器
     */
    showWeapon(weaponType: string): void {
        this.weaponRenderer.showWeapon(weaponType as any);
    }

    /**
     * 更新 FPS
     */
    private updateFPS(deltaTime: number): void {
        this.frameCount++;
        const now = performance.now() / 1000;

        if (now - this.lastFpsUpdate >= 1.0) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = now;

            // 可以触发 FPS 更新事件
            // this.eventBus.emit('performance:fps', { fps: this.fps });
        }
    }

    /**
     * 获取当前 FPS
     */
    getFPS(): number {
        return this.fps;
    }

    /**
     * 处理窗口大小调整
     */
    onWindowResize(width: number, height: number): void {
        this.renderer.setSize(width, height);
    }

    /**
     * 获取渲染器信息
     */
    getRendererInfo() {
        return this.renderer.info;
    }
}
