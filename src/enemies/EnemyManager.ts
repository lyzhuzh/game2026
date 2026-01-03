/**
 * Enemy Manager
 * Manages all enemies in the game
 */

import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Enemy, EnemyType } from './Enemy';
import { TimerManager } from '../utils/TimerManager';

export interface EnemySpawnConfig {
    type: EnemyType;
    position: THREE.Vector3;
    patrolPoints?: THREE.Vector3[];
}

export class EnemyManager {
    private physics: PhysicsWorld;
    private scene: THREE.Scene;
    private enemies: Enemy[] = [];
    private playerPosition: THREE.Vector3 = new THREE.Vector3();

    // Wave system
    private waveNumber: number = 1;
    private enemiesRemaining: number = 0;
    private waveInProgress: boolean = false;

    // Track enemies scheduled for cleanup
    private enemiesScheduledForCleanup: Set<Enemy> = new Set();

    // Spawning
    private spawnRadius: number = 50;
    private maxConcurrentEnemies: number = 10;

    // Level boundaries (must match LevelBuilder config)
    private levelBounds = {
        xMin: -95,  // 留出5米缓冲区
        xMax: 95,
        zMin: -95,
        zMax: 95
    };

    // Callbacks
    private onEnemyDeathCallback?: (enemy: Enemy) => void;
    private onEnemyAttackCallback?: (damage: number) => void;
    private onEnemyHurtCallback?: () => void;

    // Timer management
    private timerManager: TimerManager;

    // Cover positions for AI
    private availableCovers: any[] = [];

    constructor(physics: PhysicsWorld, scene: THREE.Scene, timerManager?: TimerManager) {
        this.physics = physics;
        this.scene = scene;
        this.timerManager = timerManager || new TimerManager();
    }

    /**
     * Set on enemy death callback
     */
    setOnEnemyDeath(callback: (enemy: Enemy) => void): void {
        this.onEnemyDeathCallback = callback;
    }

    /**
     * Set on enemy attack callback
     */
    setOnEnemyAttack(callback: (damage: number) => void): void {
        this.onEnemyAttackCallback = callback;
    }

    /**
     * Set on enemy hurt callback
     */
    setOnEnemyHurt(callback: () => void): void {
        this.onEnemyHurtCallback = callback;
    }

    /**
     * Set available cover positions from level
     */
    setAvailableCovers(covers: any[]): void {
        this.availableCovers = covers;
        // Update all existing enemies with new cover positions
        for (const enemy of this.enemies) {
            enemy.setAvailableCovers(covers);
        }
    }

    /**
     * Update all enemies
     */
    update(deltaTime: number): void {
        // Update all living enemies
        for (const enemy of this.enemies) {
            if (!enemy.isEnemyDead()) {
                enemy.update(deltaTime, this.playerPosition);
            }
        }

        // Remove dead enemies after delay
        this.cleanupDeadEnemies();

        // Check wave completion
        this.checkWaveStatus();
    }

    /**
     * Set player position for AI
     */
    setPlayerPosition(position: THREE.Vector3): void {
        this.playerPosition.copy(position);
    }

    /**
     * Spawn an enemy
     */
    spawnEnemy(config: EnemySpawnConfig): Enemy | null {
        // Check max concurrent enemies
        const livingEnemies = this.enemies.filter(e => !e.isEnemyDead()).length;
        if (livingEnemies >= this.maxConcurrentEnemies) {
            return null;
        }

        const enemy = new Enemy(
            config.type,
            config.position,
            this.physics,
            this.scene
        );

        if (config.patrolPoints && config.patrolPoints.length > 0) {
            enemy.setPatrolPoints(config.patrolPoints);
        }

        // Set death callback - also notifies nearby allies
        if (this.onEnemyDeathCallback) {
            enemy.setOnDeath((e) => {
                this.notifyAlliesOfDeath(e);
                this.onEnemyDeathCallback!(e);
            });
        }

        // Set attack callback
        if (this.onEnemyAttackCallback) {
            enemy.setOnAttack(this.onEnemyAttackCallback);
        }

        // Set hurt callback
        if (this.onEnemyHurtCallback) {
            enemy.setOnHurt(this.onEnemyHurtCallback);
        }

        // Set shoot callback for ranged attacks
        enemy.setOnShoot((origin, direction, damage) => this.handleEnemyShoot(origin, direction, damage));

        // Set available cover positions
        enemy.setAvailableCovers(this.availableCovers);

        this.enemies.push(enemy);
        this.enemiesRemaining++;

        return enemy;
    }

    /**
     * Notify nearby allies when an enemy dies
     */
    private notifyAlliesOfDeath(deadEnemy: Enemy): void {
        const deathPosition = deadEnemy.getPosition();

        for (const enemy of this.enemies) {
            if (enemy === deadEnemy || enemy.isEnemyDead()) {
                continue;
            }
            // Notify each living enemy about the death
            enemy.notifyAllyDeath(deathPosition);
        }
    }

    /**
     * Notify nearby enemies of player gunshot
     */
    notifyNearbyEnemiesOfShot(shotPosition: THREE.Vector3): void {
        for (const enemy of this.enemies) {
            if (enemy.isEnemyDead()) {
                continue;
            }
            // Notify each living enemy about the gunshot
            enemy.hearPlayerShot(shotPosition);
        }
    }

    /**
     * Handle enemy shooting - damage player if hit
     */
    private handleEnemyShoot(origin: THREE.Vector3, direction: THREE.Vector3, damage: number): void {
        const playerPos = this.playerPosition;

        // Check if player is in shooting direction
        const toPlayer = new THREE.Vector3().subVectors(playerPos, origin).normalize();
        const dotProduct = direction.dot(toPlayer);

        // If player is in the direction of the shot (within 30 degrees)
        if (dotProduct > 0.87) {
            const distance = origin.distanceTo(playerPos);
            if (distance <= 50) {
                // Apply damage with distance falloff
                const falloff = Math.max(0.5, 1 - distance / 100);
                const finalDamage = damage * falloff;

                // Call attack callback to damage player
                if (this.onEnemyAttackCallback) {
                    this.onEnemyAttackCallback(finalDamage);
                }
            }
        }
    }

    /**
     * Spawn multiple enemies
     */
    spawnEnemies(configs: EnemySpawnConfig[]): void {
        for (const config of configs) {
            this.spawnEnemy(config);
        }
    }

    /**
     * Spawn enemies at random positions
     */
    spawnRandomEnemies(type: EnemyType, count: number, center: THREE.Vector3, radius: number): void {
        for (let i = 0; i < count; i++) {
            const position = this.getRandomSpawnPosition(center, radius);
            this.spawnEnemy({ type, position });
        }
    }

    /**
     * Get random spawn position
     * Excludes center safe zone around spawn point
     * Ensures enemies spawn within level boundaries
     */
    private getRandomSpawnPosition(center: THREE.Vector3, radius: number): THREE.Vector3 {
        // 中心安全区域（玩家出生点附近，与 LevelBuilder 中的排除区域一致）
        const safeZone = {
            xMin: -40,
            xMax: 40,
            zMin: -35,
            zMax: 35
        };

        const minDistance = 30; // 最小距离，远离中心安全区域
        let position: THREE.Vector3;
        let attempts = 0;
        const maxAttempts = 200;

        do {
            const angle = Math.random() * Math.PI * 2;
            const distance = minDistance + Math.random() * (radius - minDistance);

            position = new THREE.Vector3(
                center.x + Math.cos(angle) * distance,
                0, // Ground level
                center.z + Math.sin(angle) * distance
            );

            attempts++;

            // 如果尝试太多次，缩小生成半径
            if (attempts > maxAttempts / 2 && radius > 40) {
                radius = 40;
            }
        } while (
            attempts < maxAttempts && (
                // 在安全区域内
                (position.x >= safeZone.xMin && position.x <= safeZone.xMax &&
                 position.z >= safeZone.zMin && position.z <= safeZone.zMax) ||
                // 在关卡边界外
                (position.x < this.levelBounds.xMin || position.x > this.levelBounds.xMax ||
                 position.z < this.levelBounds.zMin || position.z > this.levelBounds.zMax)
            )
        );

        // 如果仍然找不到合适位置，使用安全位置
        if (attempts >= maxAttempts) {
            console.warn('[EnemyManager] Failed to find valid spawn position, using fallback');
            position = this.getFallbackSpawnPosition(center);
        }

        return position;
    }

    /**
     * Get fallback spawn position when random spawning fails
     * Returns a position guaranteed to be within level bounds
     */
    private getFallbackSpawnPosition(center: THREE.Vector3): THREE.Vector3 {
        const corners = [
            new THREE.Vector3(this.levelBounds.xMin, 0, this.levelBounds.zMin),
            new THREE.Vector3(this.levelBounds.xMax, 0, this.levelBounds.zMin),
            new THREE.Vector3(this.levelBounds.xMin, 0, this.levelBounds.zMax),
            new THREE.Vector3(this.levelBounds.xMax, 0, this.levelBounds.zMax)
        ];

        // 找离中心最远且在边界内的角落
        let bestCorner = corners[0];
        let maxDistance = 0;

        for (const corner of corners) {
            const dist = center.distanceTo(corner);
            if (dist > maxDistance) {
                maxDistance = dist;
                bestCorner = corner;
            }
        }

        // 从角落向内偏移5米
        return new THREE.Vector3(
            Math.max(this.levelBounds.xMin + 5, Math.min(this.levelBounds.xMax - 5, bestCorner.x * 0.9)),
            0,
            Math.max(this.levelBounds.zMin + 5, Math.min(this.levelBounds.zMax - 5, bestCorner.z * 0.9))
        );
    }

    /**
     * Start a wave
     */
    startWave(waveNumber: number): void {
        this.waveNumber = waveNumber;
        this.enemiesRemaining = 0;
        this.waveInProgress = true;

        // Calculate enemy count based on wave number
        const enemyCount = Math.min(5 + waveNumber * 2, this.maxConcurrentEnemies);

        // Spawn enemies
        for (let i = 0; i < enemyCount; i++) {
            const enemyType = this.getRandomEnemyType(waveNumber);
            const position = this.getRandomSpawnPosition(this.playerPosition, this.spawnRadius);
            this.spawnEnemy({ type: enemyType, position });
        }

        console.log(`[EnemyManager] Wave ${waveNumber} started with ${enemyCount} enemies`);
    }

    /**
     * Get random enemy type based on wave number
     */
    private getRandomEnemyType(waveNumber: number): EnemyType {
        const types: EnemyType[] = ['grunt'];

        if (waveNumber >= 2) types.push('soldier');
        if (waveNumber >= 4) types.push('sniper');
        if (waveNumber >= 6 && waveNumber % 2 === 0) types.push('heavy');

        return types[Math.floor(Math.random() * types.length)];
    }

    /**
     * Check wave status
     */
    private checkWaveStatus(): void {
        if (!this.waveInProgress) return;

        const livingEnemies = this.enemies.filter(e => !e.isEnemyDead()).length;

        if (livingEnemies === 0 && this.enemiesRemaining === 0) {
            this.waveInProgress = false;

            // Auto-start next wave after delay
            this.timerManager.setTimeout(() => {
                this.startWave(this.waveNumber + 1);
            }, 3000);
        }
    }

    /**
     * Cleanup dead enemies
     */
    private cleanupDeadEnemies(): void {
        // Find dead enemies that are not yet scheduled for cleanup
        const deadEnemies = this.enemies.filter(e => e.isEnemyDead() && !this.enemiesScheduledForCleanup.has(e));

        for (const enemy of deadEnemies) {
            // Mark as scheduled for cleanup
            this.enemiesScheduledForCleanup.add(enemy);

            // Remove after delay (for death animation)
            this.timerManager.setTimeout(() => {
                const index = this.enemies.indexOf(enemy);
                if (index !== -1) {
                    enemy.dispose();
                    this.enemies.splice(index, 1);
                    this.enemiesScheduledForCleanup.delete(enemy);
                    this.enemiesRemaining--;
                }
            }, 2000);
        }
    }

    /**
     * Get nearest enemy to position
     */
    getNearestEnemy(position: THREE.Vector3, maxRange: number = 100): Enemy | null {
        let nearest: Enemy | null = null;
        let nearestDistance = maxRange;

        for (const enemy of this.enemies) {
            if (enemy.isEnemyDead()) continue;

            const distance = position.distanceTo(enemy.getPosition());
            if (distance < nearestDistance) {
                nearest = enemy;
                nearestDistance = distance;
            }
        }

        return nearest;
    }

    /**
     * Get all enemies in range
     */
    getEnemiesInRange(position: THREE.Vector3, range: number): Enemy[] {
        const inRange: Enemy[] = [];

        for (const enemy of this.enemies) {
            if (enemy.isEnemyDead()) continue;

            const distance = position.distanceTo(enemy.getPosition());
            if (distance <= range) {
                inRange.push(enemy);
            }
        }

        return inRange;
    }

    /**
     * Damage all enemies in range (for area attacks)
     */
    damageEnemiesInRange(position: THREE.Vector3, range: number, damage: number): void {
        const enemies = this.getEnemiesInRange(position, range);

        for (const enemy of enemies) {
            enemy.takeDamage(damage);
        }
    }


    /**
     * Damage enemy at position (raycast hit)
     */
    damageEnemyAtPosition(position: THREE.Vector3, damage: number): boolean {
        for (const enemy of this.enemies) {
            if (enemy.isEnemyDead()) continue;

            const enemyPos = enemy.getCenterPosition(); // Use center position for more accurate hit detection
            const distance = position.distanceTo(enemyPos);

            // 敌人身高 2m，中心在躯干高度 (y+1.2)
            // 头部在 y+2，距离中心 0.8m；腿部在 y+0，距离中心 1.2m
            // 使用 1.2m 阈值可以覆盖躯干和大部分命中情况
            if (distance < 1.2) {
                enemy.takeDamage(damage);
                return true;
            }
        }

        return false;
    }

    /**
     * Damage all enemies within a radius (explosion damage)
     */
    damageEnemiesInRadius(center: THREE.Vector3, radius: number, damage: number): void {
        for (const enemy of this.enemies) {
            if (enemy.isEnemyDead()) continue;

            const enemyPos = enemy.getPosition();
            const distance = center.distanceTo(enemyPos);

            if (distance <= radius) {
                // Damage falls off with distance (optional - linear falloff)
                const falloff = 1 - (distance / radius * 0.5); // 50% damage at edge
                const finalDamage = damage * falloff;
                enemy.takeDamage(finalDamage);
            }
        }
    }

    /**
     * Damage all enemies in a cone (flamethrower damage)
     */
    damageEnemiesInCone(origin: THREE.Vector3, direction: THREE.Vector3, range: number, damage: number): void {
        const coneAngle = Math.cos(0.5); // ~30 degree cone half-angle

        for (const enemy of this.enemies) {
            if (enemy.isEnemyDead()) continue;

            const enemyPos = enemy.getPosition();
            const toEnemy = enemyPos.clone().sub(origin);
            const distance = toEnemy.length();

            // Check if in range
            if (distance > range) continue;

            // Normalize direction to enemy
            toEnemy.normalize();

            // Check if within cone angle
            const dotProduct = direction.dot(toEnemy);
            if (dotProduct >= coneAngle) {
                // Enemy is in the cone - apply damage
                enemy.takeDamage(damage);
            }
        }
    }

    /**
     * Get living enemy count
     */
    getLivingEnemyCount(): number {
        return this.enemies.filter(e => !e.isEnemyDead()).length;
    }

    /**
     * Get total kill count
     */
    getTotalKills(): number {
        return this.enemies.filter(e => e.isEnemyDead()).length;
    }

    /**
     * Get current wave number
     */
    getWaveNumber(): number {
        return this.waveNumber;
    }

    /**
     * Check if wave is in progress
     */
    isWaveInProgress(): boolean {
        return this.waveInProgress;
    }

    /**
     * Clear all enemies
     */
    clearAllEnemies(): void {
        for (const enemy of this.enemies) {
            enemy.dispose();
        }
        this.enemies = [];
        this.enemiesRemaining = 0;
        this.waveInProgress = false;
    }

    /**
     * Dispose
     */
    dispose(): void {
        this.clearAllEnemies();
        this.timerManager.dispose();
    }
}
