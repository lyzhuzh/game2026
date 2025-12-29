/**
 * Enemy Manager
 * Manages all enemies in the game
 */

import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Enemy, EnemyType } from './Enemy';

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

    // Spawning
    private spawnRadius: number = 50;
    private maxConcurrentEnemies: number = 10;

    // Callbacks
    private onEnemyDeathCallback?: (enemy: Enemy) => void;
    private onEnemyAttackCallback?: (damage: number) => void;
    private onEnemyHurtCallback?: () => void;

    constructor(physics: PhysicsWorld, scene: THREE.Scene) {
        this.physics = physics;
        this.scene = scene;
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

        // Set death callback
        if (this.onEnemyDeathCallback) {
            enemy.setOnDeath(this.onEnemyDeathCallback);
        }

        // Set attack callback
        if (this.onEnemyAttackCallback) {
            enemy.setOnAttack(this.onEnemyAttackCallback);
        }

        // Set hurt callback
        if (this.onEnemyHurtCallback) {
            enemy.setOnHurt(this.onEnemyHurtCallback);
        }

        this.enemies.push(enemy);
        this.enemiesRemaining++;

        return enemy;
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
     */
    private getRandomSpawnPosition(center: THREE.Vector3, radius: number): THREE.Vector3 {
        // 中心安全区域（玩家出生点附近，与 LevelBuilder 中的排除区域一致）
        const safeZone = {
            xMin: -40,
            xMax: 40,
            zMin: -35,
            zMax: 35
        };

        const minDistance = 50; // 最小距离，远离中心安全区域
        let position: THREE.Vector3;
        let attempts = 0;

        do {
            const angle = Math.random() * Math.PI * 2;
            const distance = minDistance + Math.random() * (radius - minDistance);

            position = new THREE.Vector3(
                center.x + Math.cos(angle) * distance,
                0, // Ground level
                center.z + Math.sin(angle) * distance
            );

            attempts++;
        } while (
            attempts < 100 &&
            position.x >= safeZone.xMin && position.x <= safeZone.xMax &&
            position.z >= safeZone.zMin && position.z <= safeZone.zMax
        );

        return position;
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

        // console.log(`[EnemyManager] Wave ${waveNumber} started with ${enemyCount} enemies`);
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
            // console.log(`[EnemyManager] Wave ${this.waveNumber} complete!`);

            // Auto-start next wave after delay
            setTimeout(() => {
                this.startWave(this.waveNumber + 1);
            }, 3000);
        }
    }

    /**
     * Cleanup dead enemies
     */
    private cleanupDeadEnemies(): void {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (enemy.isEnemyDead()) {
                // Remove after delay (for death animation)
                setTimeout(() => {
                    const index = this.enemies.indexOf(enemy);
                    if (index !== -1) {
                        enemy.dispose();
                        this.enemies.splice(index, 1);
                        this.enemiesRemaining--;
                    }
                }, 2000);
            }
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

            const enemyPos = enemy.getPosition();
            const distance = position.distanceTo(enemyPos);
            if (distance < 3) { // Hit threshold - increased for better hit detection
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
    }
}
