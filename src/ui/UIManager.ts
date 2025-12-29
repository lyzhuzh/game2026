/**
 * UI Manager
 * Manages all HUD updates and UI elements
 */

import * as THREE from 'three';
import { PlayerState } from '../player/Player';
import { DamageNumber } from './components/DamageNumber';
import { KillFeed } from './components/KillFeed';
import { TimerManager } from '../utils/TimerManager';

export class UIManager {
    // Elements cache
    private elements: Map<string, HTMLElement> = new Map();
    private initialized = false;
    private timerManager: TimerManager;

    constructor(timerManager?: TimerManager) {
        this.timerManager = timerManager || new TimerManager();
        this.cacheElements();
    }

    /**
     * Initialize UI systems that require camera
     */
    initialize(camera: THREE.Camera): void {
        if (!this.initialized) {
            DamageNumber.initialize(camera);
            KillFeed.initialize();
            this.initialized = true;
        }
    }

    /**
     * Cache DOM elements for performance
     */
    private cacheElements(): void {
        const elementIds = [
            'health-bar',
            'health-text',
            'armor-bar',
            'armor-text',
            'score-display',
            'kills-display',
            'wave-display',
            'enemies-display',
            'ammo-count',
            'weapon-name',
            'reserve-ammo',
            'crosshair',
            'ammo-warning'
        ];

        for (const id of elementIds) {
            const element = document.getElementById(id);
            if (element) {
                this.elements.set(id, element);
            } else {
                console.warn(`[UIManager] Element not found: ${id}`);
            }
        }
    }

    /**
     * Update all HUD elements
     */
    update(playerState: PlayerState, waveNumber: number, enemyCount?: number): void {
        this.updateHealthBar(playerState.health, playerState.maxHealth);
        this.updateArmorBar(playerState.armor, playerState.maxArmor);
        this.updateScore(playerState.score);
        this.updateKills(playerState.kills);
        this.updateWave(waveNumber);
        if (enemyCount !== undefined) {
            this.updateEnemies(enemyCount);
        }
    }

    /**
     * Update health bar
     */
    updateHealthBar(current: number, max: number): void {
        const bar = this.elements.get('health-bar');
        const text = this.elements.get('health-text');

        if (bar) {
            const percentage = (current / max) * 100;
            bar.style.width = `${percentage}%`;

            // Change color based on health level
            if (percentage > 60) {
                bar.style.backgroundColor = '#4ade80'; // Green
            } else if (percentage > 30) {
                bar.style.backgroundColor = '#fbbf24'; // Yellow
            } else {
                bar.style.backgroundColor = '#ef4444'; // Red
            }
        }

        if (text) {
            text.textContent = `${Math.ceil(current)} / ${max}`;
        }
    }

    /**
     * Update armor bar
     */
    updateArmorBar(current: number, max: number): void {
        const bar = this.elements.get('armor-bar');
        const text = this.elements.get('armor-text');

        if (bar) {
            const percentage = (current / max) * 100;
            bar.style.width = `${percentage}%`;
        }

        if (text) {
            text.textContent = `${Math.ceil(current)} / ${max}`;
        }
    }

    /**
     * Update score display
     */
    updateScore(score: number): void {
        const element = this.elements.get('score-display');
        if (element) {
            element.textContent = `得分: ${score}`;
        }
    }

    /**
     * Update kills display
     */
    updateKills(kills: number): void {
        const element = this.elements.get('kills-display');
        if (element) {
            element.textContent = `击杀: ${kills}`;
        }
    }

    /**
     * Update wave display
     */
    updateWave(wave: number): void {
        const element = this.elements.get('wave-display');
        if (element) {
            element.textContent = `波次: ${wave}`;
        }
    }

    /**
     * Update enemies display
     */
    updateEnemies(count: number): void {
        const element = this.elements.get('enemies-display');
        if (element) {
            element.textContent = `敌人: ${count}`;
        }
    }

    /**
     * Update weapon display
     */
    updateWeapon(type: string, currentAmmo: number, magazineSize: number, reserveAmmo: number): void {
        // Weapon names in Chinese
        const weaponNames: Record<string, string> = {
            pistol: '手枪',
            rifle: '步枪',
            shotgun: '霰弹枪',
            smg: '冲锋枪',
            sniper: '狙击枪',
            melee: '近战',
            rocket_launcher: '火箭筒',
            flamethrower: '火焰喷射器'
        };

        // Update ammo count
        const ammoElement = this.elements.get('ammo-count');
        if (ammoElement) {
            ammoElement.textContent = `${Math.round(currentAmmo)} / ${magazineSize}`;
        }

        // Update weapon name
        const weaponElement = this.elements.get('weapon-name');
        if (weaponElement) {
            weaponElement.textContent = weaponNames[type] || type.toUpperCase();
        }

        // Update reserve ammo
        const reserveElement = this.elements.get('reserve-ammo');
        if (reserveElement) {
            reserveElement.textContent = `备用弹药: ${reserveAmmo}`;
        }

        // Show ammo warning when low
        this.updateAmmoWarning(currentAmmo, magazineSize, reserveAmmo);
    }

    /**
     * Update ammo warning
     */
    private updateAmmoWarning(currentAmmo: number, magazineSize: number, reserveAmmo: number): void {
        const warningElement = this.elements.get('ammo-warning');
        if (!warningElement) return;

        const lowAmmo = currentAmmo <= magazineSize * 0.25 && currentAmmo > 0;
        const noAmmo = currentAmmo === 0 && reserveAmmo === 0;

        if (lowAmmo || noAmmo) {
            warningElement.classList.add('show');
            if (noAmmo) {
                warningElement.textContent = '没有弹药!';
            } else {
                warningElement.textContent = '弹药不足!';
            }
        } else {
            warningElement.classList.remove('show');
        }
    }

    /**
     * Show damage indicator
     */
    showDamageIndicator(): void {
        const crosshair = this.elements.get('crosshair');
        if (crosshair) {
            crosshair.classList.add('damage');
            this.timerManager.setTimeout(() => {
                crosshair.classList.remove('damage');
            }, 200);
        }
    }

    /**
     * Show death screen
     */
    showDeathScreen(): void {
        // Create death screen if not exists
        let deathScreen = document.getElementById('death-screen');
        if (!deathScreen) {
            deathScreen = document.createElement('div');
            deathScreen.id = 'death-screen';
            deathScreen.className = 'death-screen';
            deathScreen.innerHTML = `
                <div class="death-content">
                    <h1>你已死亡</h1>
                    <p>3秒后重生...</p>
                </div>
            `;
            document.body.appendChild(deathScreen);
        }
        deathScreen.classList.remove('hidden');
    }

    /**
     * Hide death screen
     */
    hideDeathScreen(): void {
        const deathScreen = document.getElementById('death-screen');
        if (deathScreen) {
            deathScreen.classList.add('hidden');
        }
    }

    /**
     * Show wave announcement
     */
    showWaveAnnouncement(wave: number): void {
        // Create announcement if not exists
        let announcement = document.getElementById('wave-announcement');
        if (!announcement) {
            announcement = document.createElement('div');
            announcement.id = 'wave-announcement';
            announcement.className = 'wave-announcement';
            document.body.appendChild(announcement);
        }

        announcement.textContent = `第 ${wave} 波`;
        announcement.classList.remove('hidden');
        announcement.classList.add('show');

        this.timerManager.setTimeout(() => {
            announcement.classList.remove('show');
            this.timerManager.setTimeout(() => {
                announcement.classList.add('hidden');
            }, 500);
        }, 2000);
    }

    /**
     * Show pickup notification
     */
    showPickupNotification(itemName: string): void {
        // Create notification if not exists
        let notification = document.getElementById('pickup-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'pickup-notification';
            notification.className = 'pickup-notification';
            document.body.appendChild(notification);
        }

        notification.textContent = `+ ${itemName}`;
        notification.classList.remove('hidden');
        notification.classList.add('show');

        // Auto hide after 2 seconds
        this.timerManager.setTimeout(() => {
            notification.classList.remove('show');
            this.timerManager.setTimeout(() => {
                notification.classList.add('hidden');
            }, 500);
        }, 2000);
    }

    // ========== New UI Features ==========

    /**
     * Show damage number
     */
    showDamageNumber(damage: number, position: THREE.Vector3, isHeadshot: boolean = false): void {
        if (!this.initialized) {
            console.warn('[UIManager] Not initialized. Call initialize() first.');
            return;
        }
        DamageNumber.show({ damage, position, isHeadshot });
    }

    /**
     * Show multiple damage numbers (for shotgun, etc.)
     */
    showMultipleDamageNumbers(damages: number[], position: THREE.Vector3, isHeadshot: boolean = false): void {
        if (!this.initialized) return;
        DamageNumber.showMultiple(damages, position, isHeadshot);
    }

    /**
     * Show heal number
     */
    showHealNumber(amount: number, position: THREE.Vector3): void {
        if (!this.initialized) return;
        DamageNumber.showHeal(amount, position);
    }

    /**
     * Show shield damage number
     */
    showShieldDamage(damage: number, position: THREE.Vector3): void {
        if (!this.initialized) return;
        DamageNumber.showShieldDamage(damage, position);
    }

    /**
     * Add kill feed entry
     */
    addKillFeed(killer: string, victim: string, weapon: string, isHeadshot: boolean = false): void {
        if (!this.initialized) return;
        KillFeed.add(killer, victim, weapon, isHeadshot);
    }

    /**
     * Add player kill notification
     */
    addPlayerKill(victimName: string, weapon: string, isHeadshot: boolean = false): void {
        if (!this.initialized) return;
        KillFeed.addPlayerKill(victimName, weapon, isHeadshot);
    }

    /**
     * Add player death notification
     */
    addPlayerDeath(killerName: string, weapon: string, isHeadshot: boolean = false): void {
        if (!this.initialized) return;
        KillFeed.addPlayerDeath(killerName, weapon, isHeadshot);
    }

    /**
     * Clear all damage numbers
     */
    clearDamageNumbers(): void {
        DamageNumber.clear();
    }

    /**
     * Clear kill feed
     */
    clearKillFeed(): void {
        KillFeed.clear();
    }

    /**
     * Cleanup
     */
    dispose(): void {
        KillFeed.dispose();
        DamageNumber.clear();
        this.timerManager.dispose();
    }
}
