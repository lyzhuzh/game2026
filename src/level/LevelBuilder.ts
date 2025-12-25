/**
 * Level Builder
 * Procedurally generates game levels using modular environment pieces
 */

import * as THREE from 'three';
import { AssetManager } from '../assets/AssetManager';
import { GAME_ASSETS } from '../assets/AssetConfig';

export interface LevelConfig {
    size: number; // Arena size (default 100x100)
    wallHeight: number;
    platformCount: number;
    obstacleCount: number;
}

export class LevelBuilder {
    private scene: THREE.Scene;
    private assetManager: AssetManager;
    private loadedModels: Map<string, THREE.Group> = new Map();

    // Level configuration
    private config: LevelConfig = {
        size: 100,
        wallHeight: 10,
        platformCount: 15,
        obstacleCount: 20
    };

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.assetManager = AssetManager.getInstance();
    }

    /**
     * Initialize level builder (preload environment assets)
     */
    async initialize(): Promise<void> {
        console.log('[LevelBuilder] Initializing...');

        // Preload environment models
        const envAssets = GAME_ASSETS.filter(a => a.id.startsWith('env_'));
        const promises = envAssets.map(asset => this.assetManager.loadAsset(asset));

        await Promise.all(promises);
        console.log(`[LevelBuilder] Loaded ${envAssets.length} environment assets`);
    }

    /**
     * Generate a level
     */
    async generateLevel(config: Partial<LevelConfig> = {}): Promise<void> {
        this.config = { ...this.config, ...config };

        console.log('[LevelBuilder] Generating level...', this.config);

        // Clear existing level
        this.clearLevel();

        // Create ground
        this.createGround();

        // Create boundary walls
        this.createBoundaryWalls();

        // Add platforms
        await this.addPlatforms();

        // Add obstacles/cover
        await this.addObstacles();

        console.log('[LevelBuilder] Level generation complete');
    }

    /**
     * Create ground plane
     */
    private createGround(): void {
        const groundGeometry = new THREE.PlaneGeometry(this.config.size * 2, this.config.size * 2);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x333344,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Add grid pattern
        const gridSize = this.config.size * 2;
        const gridDivisions = 40;
        const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x444455, 0x222233);
        this.scene.add(gridHelper);
    }

    /**
     * Create boundary walls
     */
    private async createBoundaryWalls(): Promise<void> {
        const wallConfig = [
            // North wall (+Z)
            { pos: [0, this.config.wallHeight / 2, -this.config.size - 1], size: [this.config.size * 2 + 4, this.config.wallHeight, 2] },
            // South wall (-Z)
            { pos: [0, this.config.wallHeight / 2, this.config.size + 1], size: [this.config.size * 2 + 4, this.config.wallHeight, 2] },
            // East wall (+X)
            { pos: [this.config.size + 1, this.config.wallHeight / 2, 0], size: [2, this.config.wallHeight, this.config.size * 2] },
            // West wall (-X)
            { pos: [-this.config.size - 1, this.config.wallHeight / 2, 0], size: [2, this.config.wallHeight, this.config.size * 2] }
        ];

        // Use corridor wall models if available, otherwise create boxes
        for (const config of wallConfig) {
            const model = await this.getModel('env_wall');
            if (model) {
                // Place modular wall pieces
                const wallLength = config.size[0];
                const pieceCount = Math.ceil(wallLength / 4);
                const startX = config.pos[0] - wallLength / 2;

                for (let i = 0; i < pieceCount; i++) {
                    const piece = model.clone();
                    piece.position.set(
                        startX + (i * 4) + 2,
                        config.pos[1],
                        config.pos[2]
                    );
                    piece.scale.setScalar(4);
                    this.scene.add(piece);
                }
            } else {
                // Fallback to box geometry
                const geometry = new THREE.BoxGeometry(config.size[0], config.size[1], config.size[2]);
                const material = new THREE.MeshStandardMaterial({
                    color: 0x444455,
                    roughness: 0.7,
                    metalness: 0.3
                });
                const wall = new THREE.Mesh(geometry, material);
                wall.position.set(config.pos[0], config.pos[1], config.pos[2]);
                wall.castShadow = true;
                wall.receiveShadow = true;
                this.scene.add(wall);
            }
        }
    }

    /**
     * Add platforms
     */
    private async addPlatforms(): Promise<void> {
        const platformPositions = this.generatePlatformPositions(this.config.platformCount);

        for (const pos of platformPositions) {
            const model = await this.getModel('env_platform');
            if (model) {
                const platform = model.clone();
                platform.position.set(pos.x, pos.y, pos.z);
                platform.rotation.y = pos.rotation || 0;
                this.scene.add(platform);
            }
        }
    }

    /**
     * Add obstacles/covers
     */
    private async addObstacles(): Promise<void> {
        const obstacleTypes = ['env_crate', 'env_barrel'];

        for (let i = 0; i < this.config.obstacleCount; i++) {
            const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
            const model = await this.getModel(type);

            if (model) {
                const obstacle = model.clone();
                const pos = this.getRandomPosition(8); // Keep away from center spawn
                obstacle.position.set(pos.x, 1, pos.z);
                obstacle.rotation.y = Math.random() * Math.PI * 2;
                this.scene.add(obstacle);
            }
        }
    }

    /**
     * Generate platform positions
     */
    private generatePlatformPositions(count: number): Array<{x: number, y: number, z: number, rotation?: number}> {
        const positions: Array<{x: number, y: number, z: number, rotation?: number}> = [];

        for (let i = 0; i < count; i++) {
            const pos = this.getRandomPosition(15); // Keep away from center spawn
            const height = 1 + Math.random() * 3;
            positions.push({
                x: pos.x,
                y: height,
                z: pos.z,
                rotation: Math.floor(Math.random() * 4) * (Math.PI / 2) // 90 degree increments
            });
        }

        return positions;
    }

    /**
     * Get random position away from center
     */
    private getRandomPosition(minDistance: number): {x: number, z: number} {
        const angle = Math.random() * Math.PI * 2;
        const distance = minDistance + Math.random() * (this.config.size - minDistance - 5);

        return {
            x: Math.cos(angle) * distance,
            z: Math.sin(angle) * distance
        };
    }

    /**
     * Get model from asset manager (with caching)
     */
    private async getModel(assetId: string): Promise<THREE.Group | null> {
        if (this.loadedModels.has(assetId)) {
            return this.loadedModels.get(assetId)!.clone();
        }

        const model = this.assetManager.getGLTF(assetId);
        if (model) {
            this.loadedModels.set(assetId, model);
            return model.clone();
        }

        return null;
    }

    /**
     * Clear current level
     */
    clearLevel(): void {
        // Remove all level geometry (keep lights, player, enemies, etc.)
        const toRemove: THREE.Object3D[] = [];

        this.scene.traverse((child) => {
            if (child.userData.isLevelObject) {
                toRemove.push(child);
            }
        });

        toRemove.forEach(obj => {
            this.scene.remove(obj);
            if (obj instanceof THREE.Mesh) {
                obj.geometry.dispose();
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
    }

    /**
     * Dispose
     */
    dispose(): void {
        this.clearLevel();
        this.loadedModels.clear();
    }
}

export default LevelBuilder;
