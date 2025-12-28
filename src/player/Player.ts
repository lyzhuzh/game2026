/**
 * Player Class
 * Manages player health, damage, death, and score
 */

import { GAME_CONFIG } from '../constants/GameConstants';

export interface PlayerState {
    health: number;
    maxHealth: number;
    armor: number;
    maxArmor: number;
    isDead: boolean;
    score: number;
    kills: number;
}

export class Player {
    private state: PlayerState;

    // Damage cooldown
    private lastDamageTime: number = 0;
    private damageCooldown: number = 0.5; // seconds

    // Callbacks
    private onHurtCallback?: () => void;
    private onDeathCallback?: () => void;
    private onRespawnCallback?: () => void;

    constructor() {
        this.state = {
            health: GAME_CONFIG.PLAYER.MAX_HEALTH || 100,
            maxHealth: GAME_CONFIG.PLAYER.MAX_HEALTH || 100,
            armor: GAME_CONFIG.PLAYER.MAX_ARMOR || 50,
            maxArmor: GAME_CONFIG.PLAYER.MAX_ARMOR || 50,
            isDead: false,
            score: 0,
            kills: 0
        };
    }

    /**
     * Update player
     */
    update(deltaTime: number): void {
        // Check for death
        if (this.state.health <= 0 && !this.state.isDead) {
            this.die();
        }
    }

    /**
     * Take damage
     */
    takeDamage(amount: number): void {
        if (this.state.isDead) return;

        const time = performance.now() / 1000;
        if (time - this.lastDamageTime < this.damageCooldown) {
            return;
        }

        this.lastDamageTime = time;

        // Armor absorbs damage first
        if (this.state.armor > 0) {
            const armorDamage = Math.min(this.state.armor, amount);
            this.state.armor -= armorDamage;
            amount -= armorDamage;
        }

        // Apply remaining damage to health
        if (amount > 0) {
            this.state.health = Math.max(0, this.state.health - amount);
        }

        // Call hurt callback
        if (this.onHurtCallback) {
            this.onHurtCallback();
        }
    }

    /**
     * Heal player
     */
    heal(amount: number): void {
        if (this.state.isDead) return;

        this.state.health = Math.min(this.state.maxHealth, this.state.health + amount);
    }

    /**
     * Add armor
     */
    addArmor(amount: number): void {
        if (this.state.isDead) return;

        this.state.armor = Math.min(this.state.maxArmor, this.state.armor + amount);
    }

    /**
     * Add score
     */
    addScore(points: number): void {
        this.state.score += points;
    }

    /**
     * Register kill
     */
    registerKill(): void {
        this.state.kills++;
    }

    /**
     * Die
     */
    private die(): void {
        this.state.isDead = true;
        this.state.health = 0;

        // Call death callback
        if (this.onDeathCallback) {
            this.onDeathCallback();
        }

        // Trigger respawn after delay
        setTimeout(() => {
            this.respawn();
        }, 3000);
    }

    /**
     * Respawn
     */
    respawn(): void {
        this.state.health = this.state.maxHealth;
        this.state.armor = Math.floor(this.state.maxArmor / 2); // Half armor on respawn
        this.state.isDead = false;

        // Call respawn callback
        if (this.onRespawnCallback) {
            this.onRespawnCallback();
        }
    }

    /**
     * Get current health
     */
    getHealth(): number {
        return this.state.health;
    }

    /**
     * Get max health
     */
    getMaxHealth(): number {
        return this.state.maxHealth;
    }

    /**
     * Get health percentage
     */
    getHealthPercentage(): number {
        return this.state.health / this.state.maxHealth;
    }

    /**
     * Get current armor
     */
    getArmor(): number {
        return this.state.armor;
    }

    /**
     * Get max armor
     */
    getMaxArmor(): number {
        return this.state.maxArmor;
    }

    /**
     * Get armor percentage
     */
    getArmorPercentage(): number {
        return this.state.armor / this.state.maxArmor;
    }

    /**
     * Get score
     */
    getScore(): number {
        return this.state.score;
    }

    /**
     * Get kills
     */
    getKills(): number {
        return this.state.kills;
    }

    /**
     * Check if dead
     */
    isPlayerDead(): boolean {
        return this.state.isDead;
    }

    /**
     * Set on hurt callback
     */
    setOnHurt(callback: () => void): void {
        this.onHurtCallback = callback;
    }

    /**
     * Set on death callback
     */
    setOnDeath(callback: () => void): void {
        this.onDeathCallback = callback;
    }

    /**
     * Set on respawn callback
     */
    setOnRespawn(callback: () => void): void {
        this.onRespawnCallback = callback;
    }

    /**
     * Get full state
     */
    getState(): PlayerState {
        return { ...this.state };
    }
}
