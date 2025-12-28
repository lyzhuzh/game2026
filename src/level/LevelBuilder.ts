/**
 * Level Builder
 * Procedurally generates game levels using modular environment pieces
 */

import * as THREE from 'three';
import { AssetManager } from '../assets/AssetManager';
import { GAME_ASSETS } from '../assets/AssetConfig';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { PhysicsBodyFactory } from '../physics/PhysicsBody';

export interface LevelConfig {
    size: number; // Arena size (default 100x100)
    wallHeight: number;
    platformCount: number;
    obstacleCount: number;
}

export class LevelBuilder {
    private scene: THREE.Scene;
    private assetManager: AssetManager;
    private physics: PhysicsWorld;
    private loadedModels: Map<string, THREE.Group> = new Map();

    // Level configuration
    private config: LevelConfig = {
        size: 100,
        wallHeight: 10,
        platformCount: 15,
        obstacleCount: 20
    };

    constructor(scene: THREE.Scene, physics?: PhysicsWorld) {
        this.scene = scene;
        this.assetManager = AssetManager.getInstance();
        this.physics = physics!;
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

        // Add corridor along one wall
        await this.createCorridor();

        console.log('[LevelBuilder] Level generation complete');
    }

    /**
     * Create ground plane
     */
    private createGround(): void {
        // Create ground texture with graffiti
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d')!;

        // Dark background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, 1024, 1024);

        // Grid pattern
        ctx.strokeStyle = '#2a2a3e';
        ctx.lineWidth = 2;
        const gridSize = 64;
        for (let i = 0; i <= 1024; i += gridSize) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, 1024);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(1024, i);
            ctx.stroke();
        }

        // Random graffiti on ground - MORE types and quantity
        const graffitiColors = ['#ff00ff', '#00ffff', '#ffff00', '#00ff00', '#ff6600', '#ff0066', '#66ff00', '#0066ff'];

        // Draw many random graffiti elements scattered across ground
        for (let g = 0; g < 25; g++) {
            const cx = 50 + Math.random() * 924;
            const cy = 50 + Math.random() * 924;
            const color = graffitiColors[Math.floor(Math.random() * graffitiColors.length)];
            const type = Math.floor(Math.random() * 10);

            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 6 + Math.random() * 6;

            switch (type) {
                case 0: // Circle
                    ctx.beginPath();
                    ctx.arc(cx, cy, 30 + Math.random() * 50, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                case 1: // Star
                    ctx.beginPath();
                    const r1 = 25 + Math.random() * 35;
                    for (let j = 0; j < 5; j++) {
                        const a1 = (j * 4 * Math.PI / 5) - Math.PI / 2;
                        if (j === 0) ctx.moveTo(cx + r1 * Math.cos(a1), cy + r1 * Math.sin(a1));
                        else ctx.lineTo(cx + r1 * Math.cos(a1), cy + r1 * Math.sin(a1));
                    }
                    ctx.closePath();
                    ctx.fill();
                    break;
                case 2: // X mark
                    const xSize = 20 + Math.random() * 40;
                    ctx.beginPath();
                    ctx.moveTo(cx - xSize, cy - xSize);
                    ctx.lineTo(cx + xSize, cy + xSize);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(cx + xSize, cy - xSize);
                    ctx.lineTo(cx - xSize, cy + xSize);
                    ctx.stroke();
                    break;
                case 3: // Arrow
                    const len = 40 + Math.random() * 60;
                    const arrowAngle = Math.random() * Math.PI * 2;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy);
                    ctx.lineTo(cx + len * Math.cos(arrowAngle), cy + len * Math.sin(arrowAngle));
                    ctx.stroke();
                    break;
                case 4: // Lightning bolt
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - 40);
                    ctx.lineTo(cx - 25, cy);
                    ctx.lineTo(cx + 5, cy);
                    ctx.lineTo(cx - 15, cy + 50);
                    ctx.lineTo(cx + 30, cy - 10);
                    ctx.lineTo(cx + 5, cy - 10);
                    ctx.closePath();
                    ctx.fill();
                    break;
                case 5: // Heart
                    ctx.beginPath();
                    const hs = 20 + Math.random() * 25;
                    ctx.moveTo(cx, cy + hs);
                    ctx.bezierCurveTo(cx - hs * 2, cy - hs, cx, cy - hs * 1.5, cx, cy - hs * 0.5);
                    ctx.bezierCurveTo(cx, cy - hs * 1.5, cx + hs * 2, cy - hs, cx, cy + hs);
                    ctx.fill();
                    break;
                case 6: // Triangle
                    const triSize = 30 + Math.random() * 40;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - triSize);
                    ctx.lineTo(cx - triSize, cy + triSize * 0.7);
                    ctx.lineTo(cx + triSize, cy + triSize * 0.7);
                    ctx.closePath();
                    Math.random() > 0.5 ? ctx.fill() : ctx.stroke();
                    break;
                case 7: // Spiral
                    ctx.beginPath();
                    for (let t = 0; t < 4 * Math.PI; t += 0.2) {
                        const sr = 5 + t * 4;
                        if (t === 0) ctx.moveTo(cx + sr, cy);
                        else ctx.lineTo(cx + sr * Math.cos(t), cy + sr * Math.sin(t));
                    }
                    ctx.stroke();
                    break;
                case 8: // Diamond
                    const ds = 25 + Math.random() * 35;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - ds);
                    ctx.lineTo(cx + ds, cy);
                    ctx.lineTo(cx, cy + ds);
                    ctx.lineTo(cx - ds, cy);
                    ctx.closePath();
                    Math.random() > 0.5 ? ctx.fill() : ctx.stroke();
                    break;
                case 9: // Dots cluster
                    for (let d = 0; d < 6; d++) {
                        ctx.beginPath();
                        ctx.arc(cx + (Math.random() - 0.5) * 60, cy + (Math.random() - 0.5) * 60, 5 + Math.random() * 10, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    break;
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);

        const groundGeometry = new THREE.PlaneGeometry(this.config.size * 2, this.config.size * 2);
        const groundMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            color: 0xffffff,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Add grid pattern overlay
        const gridSize2 = this.config.size * 2;
        const gridDivisions = 40;
        const gridHelper = new THREE.GridHelper(gridSize2, gridDivisions, 0x444455, 0x222233);
        this.scene.add(gridHelper);
    }

    /**
     * Create boundary walls
     */
    private async createBoundaryWalls(): Promise<void> {
        // Use procedural grid walls for consistent four-sided appearance
        this.createBoxWalls();
    }

    /**
     * Create beautiful procedural box walls with grid texture
     */
    private createBoxWalls(): void {
        // Generate 4 random colors with good contrast
        const randomColors = [
            { hue: Math.random() * 360 },
            { hue: Math.random() * 360 },
            { hue: Math.random() * 360 },
            { hue: Math.random() * 360 }
        ].map(c => ({
            base: `hsl(${c.hue}, 70%, 30%)`,
            accent: `hsl(${c.hue}, 60%, 40%)`,
            emissive: Math.floor(c.hue / 360 * 0xffffff) & 0x333333
        }));

        // Function to create unique texture for each wall with graffiti
        const createWallTexture = (_wallName: string, baseColor: string, accentColor: string, graffitiColors: string[]) => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d')!;

            // Background
            ctx.fillStyle = baseColor;
            ctx.fillRect(0, 0, 512, 512);

            // Grid pattern
            ctx.strokeStyle = accentColor;
            ctx.lineWidth = 2;
            const gridSize = 64;
            for (let i = 0; i <= 512; i += gridSize) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, 512);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(512, i);
                ctx.stroke();
            }

            // Draw multiple random graffiti elements
            for (let g = 0; g < 8; g++) {
                const cx = 50 + Math.random() * 412;
                const cy = 50 + Math.random() * 412;
                const color = graffitiColors[Math.floor(Math.random() * graffitiColors.length)];
                const gType = Math.floor(Math.random() * 10);

                ctx.strokeStyle = color;
                ctx.fillStyle = color;
                ctx.lineWidth = 8 + Math.random() * 8;

                switch (gType) {
                    case 0: // Circle
                        ctx.beginPath();
                        ctx.arc(cx, cy, 30 + Math.random() * 40, 0, Math.PI * 2);
                        ctx.stroke();
                        break;
                    case 1: // Star
                        ctx.beginPath();
                        const sr = 25 + Math.random() * 30;
                        for (let j = 0; j < 5; j++) {
                            const sa = (j * 4 * Math.PI / 5) - Math.PI / 2;
                            if (j === 0) ctx.moveTo(cx + sr * Math.cos(sa), cy + sr * Math.sin(sa));
                            else ctx.lineTo(cx + sr * Math.cos(sa), cy + sr * Math.sin(sa));
                        }
                        ctx.closePath();
                        ctx.fill();
                        break;
                    case 2: // X mark
                        const xs = 20 + Math.random() * 30;
                        ctx.beginPath();
                        ctx.moveTo(cx - xs, cy - xs);
                        ctx.lineTo(cx + xs, cy + xs);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(cx + xs, cy - xs);
                        ctx.lineTo(cx - xs, cy + xs);
                        ctx.stroke();
                        break;
                    case 3: // Arrow
                        const al = 40 + Math.random() * 50;
                        const aa = Math.random() * Math.PI * 2;
                        ctx.beginPath();
                        ctx.moveTo(cx, cy);
                        ctx.lineTo(cx + al * Math.cos(aa), cy + al * Math.sin(aa));
                        ctx.stroke();
                        break;
                    case 4: // Lightning
                        const ls = 0.8 + Math.random() * 0.5;
                        ctx.beginPath();
                        ctx.moveTo(cx, cy - 40 * ls);
                        ctx.lineTo(cx - 20 * ls, cy);
                        ctx.lineTo(cx + 5 * ls, cy);
                        ctx.lineTo(cx - 10 * ls, cy + 40 * ls);
                        ctx.lineTo(cx + 25 * ls, cy - 10 * ls);
                        ctx.closePath();
                        ctx.fill();
                        break;
                    case 5: // Heart
                        const hs = 15 + Math.random() * 20;
                        ctx.beginPath();
                        ctx.moveTo(cx, cy + hs);
                        ctx.bezierCurveTo(cx - hs * 2, cy - hs, cx, cy - hs * 1.5, cx, cy - hs * 0.5);
                        ctx.bezierCurveTo(cx, cy - hs * 1.5, cx + hs * 2, cy - hs, cx, cy + hs);
                        ctx.fill();
                        break;
                    case 6: // Triangle
                        const ts = 25 + Math.random() * 35;
                        ctx.beginPath();
                        ctx.moveTo(cx, cy - ts);
                        ctx.lineTo(cx - ts, cy + ts * 0.7);
                        ctx.lineTo(cx + ts, cy + ts * 0.7);
                        ctx.closePath();
                        Math.random() > 0.5 ? ctx.fill() : ctx.stroke();
                        break;
                    case 7: // Spiral
                        ctx.beginPath();
                        for (let t = 0; t < 3 * Math.PI; t += 0.2) {
                            const spr = 5 + t * 3;
                            if (t === 0) ctx.moveTo(cx + spr, cy);
                            else ctx.lineTo(cx + spr * Math.cos(t), cy + spr * Math.sin(t));
                        }
                        ctx.stroke();
                        break;
                    case 8: // Diamond
                        const ds = 20 + Math.random() * 30;
                        ctx.beginPath();
                        ctx.moveTo(cx, cy - ds);
                        ctx.lineTo(cx + ds, cy);
                        ctx.lineTo(cx, cy + ds);
                        ctx.lineTo(cx - ds, cy);
                        ctx.closePath();
                        Math.random() > 0.5 ? ctx.fill() : ctx.stroke();
                        break;
                    case 9: // Dots
                        for (let d = 0; d < 5; d++) {
                            ctx.beginPath();
                            ctx.arc(cx + (Math.random() - 0.5) * 50, cy + (Math.random() - 0.5) * 50, 4 + Math.random() * 8, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        break;
                }
            }

            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(2, 1);  // Less repeat = bigger patterns
            return texture;
        };

        // Different color schemes and graffiti for each wall - using random colors
        const wallConfig = [
            {
                pos: [0, this.config.wallHeight / 2 - 0.5, -this.config.size - 1],
                size: [this.config.size * 2 + 4, this.config.wallHeight, 2],
                name: 'North',
                baseColor: randomColors[0].base,
                accentColor: randomColors[0].accent,
                graffitiColors: ['#ffffff', '#ffff00'],  // White and yellow on any color
                emissive: randomColors[0].emissive
            },
            {
                pos: [0, this.config.wallHeight / 2 - 0.5, this.config.size + 1],
                size: [this.config.size * 2 + 4, this.config.wallHeight, 2],
                name: 'South',
                baseColor: randomColors[1].base,
                accentColor: randomColors[1].accent,
                graffitiColors: ['#ffffff', '#00ffff'],  // White and cyan
                emissive: randomColors[1].emissive
            },
            {
                pos: [this.config.size + 1, this.config.wallHeight / 2 - 0.5, 0],
                size: [2, this.config.wallHeight, this.config.size * 2],
                name: 'East',
                baseColor: randomColors[2].base,
                accentColor: randomColors[2].accent,
                graffitiColors: ['#ffffff', '#ff00ff'],  // White and magenta
                emissive: randomColors[2].emissive
            },
            {
                pos: [-this.config.size - 1, this.config.wallHeight / 2 - 0.5, 0],
                size: [2, this.config.wallHeight, this.config.size * 2],
                name: 'West',
                baseColor: randomColors[3].base,
                accentColor: randomColors[3].accent,
                graffitiColors: ['#ffffff', '#00ff00'],  // White and green
                emissive: randomColors[3].emissive
            }
        ];

        for (const config of wallConfig) {
            const geometry = new THREE.BoxGeometry(config.size[0], config.size[1], config.size[2]);

            // Create unique texture for this wall
            const texture = createWallTexture(
                config.name,
                config.baseColor,
                config.accentColor,
                config.graffitiColors
            );

            // Material - use white color to show texture clearly
            const material = new THREE.MeshStandardMaterial({
                map: texture,
                color: 0xffffff,  // White to not tint the texture
                roughness: 0.7,
                metalness: 0.2,
                emissive: config.emissive,
                emissiveIntensity: 0.3  // Stronger glow
            });

            const wall = new THREE.Mesh(geometry, material);
            wall.position.set(config.pos[0], config.pos[1], config.pos[2]);
            wall.castShadow = true;
            wall.receiveShadow = true;

            // Add colored edge glow matching graffiti color
            const edgesGeometry = new THREE.EdgesGeometry(geometry);
            const edgesMaterial = new THREE.LineBasicMaterial({
                color: config.graffitiColors[0],
                transparent: true,
                opacity: 0.5
            });
            const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
            wall.add(edges);

            this.scene.add(wall);

            // 为围墙添加物理碰撞体
            if (this.physics) {
                const wallBody = PhysicsBodyFactory.createBox(
                    this.physics,
                    { x: config.size[0], y: config.size[1], z: config.size[2] },
                    { type: 'static', mass: 0 }
                );
                wallBody.setPosition({
                    x: config.pos[0],
                    y: config.pos[1],
                    z: config.pos[2]
                });
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
                const platform = this.deepCloneGltf(model);
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
                const obstacle = this.deepCloneGltf(model);
                const pos = this.getRandomPosition(8); // Keep away from center spawn
                obstacle.position.set(pos.x, 0, pos.z); // Y=0 to sit on ground
                obstacle.rotation.y = Math.random() * Math.PI * 2;
                this.scene.add(obstacle);
            }
        }
    }

    /**
     * Create a simple graffiti texture for decals
     */
    private createGraffitiTexture(overrideColor?: string): THREE.CanvasTexture {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d')!;

        // Transparent background
        ctx.clearRect(0, 0, 256, 256);

        // Random neon color or override
        const colors = ['#ffffff', '#ffff00', '#00ffff', '#ff00ff', '#00ff00', '#ff6600'];
        const color = overrideColor || colors[Math.floor(Math.random() * colors.length)];

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 6 + Math.random() * 6;

        const cx = 128;
        const cy = 128;
        const gType = Math.floor(Math.random() * 10);

        switch (gType) {
            case 0: // Circle
                ctx.beginPath();
                ctx.arc(cx, cy, 60 + Math.random() * 40, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 1: // Star
                ctx.beginPath();
                const sr = 50 + Math.random() * 30;
                for (let j = 0; j < 5; j++) {
                    const sa = (j * 4 * Math.PI / 5) - Math.PI / 2;
                    if (j === 0) ctx.moveTo(cx + sr * Math.cos(sa), cy + sr * Math.sin(sa));
                    else ctx.lineTo(cx + sr * Math.cos(sa), cy + sr * Math.sin(sa));
                }
                ctx.closePath();
                ctx.fill();
                break;
            case 2: // X mark
                const xs = 50 + Math.random() * 30;
                ctx.beginPath();
                ctx.moveTo(cx - xs, cy - xs);
                ctx.lineTo(cx + xs, cy + xs);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(cx + xs, cy - xs);
                ctx.lineTo(cx - xs, cy + xs);
                ctx.stroke();
                break;
            case 3: // Arrow
                const al = 60 + Math.random() * 40;
                const aa = Math.random() * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + al * Math.cos(aa), cy + al * Math.sin(aa));
                ctx.stroke();
                break;
            case 4: // Lightning
                const ls = 1.0 + Math.random() * 0.5;
                ctx.beginPath();
                ctx.moveTo(cx, cy - 80 * ls);
                ctx.lineTo(cx - 40 * ls, cy);
                ctx.lineTo(cx + 10 * ls, cy);
                ctx.lineTo(cx - 20 * ls, cy + 80 * ls);
                ctx.lineTo(cx + 50 * ls, cy - 20 * ls);
                ctx.closePath();
                ctx.fill();
                break;
            default: // Random scribbles
                ctx.beginPath();
                ctx.moveTo(cx + (Math.random() - 0.5) * 100, cy + (Math.random() - 0.5) * 100);
                for (let k = 0; k < 5; k++) {
                    ctx.lineTo(cx + (Math.random() - 0.5) * 150, cy + (Math.random() - 0.5) * 150);
                }
                ctx.stroke();
                break;
        }

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    /**
     * Create a corridor structure along the north wall
     */
    private async createCorridor(): Promise<void> {
        const corridorModel = await this.getModel('env_corridor');
        const windowModel = await this.getModel('env_corridor_window');

        if (!corridorModel) {
            return;
        }

        // Corridor parameters
        const corridorScale = 5;  // Scale factor for corridor
        const corridorCount = 10;  // Number of corridor segments
        const segmentWidth = 10;   // Width of each corridor segment (scaled)
        // Center the corridor segments: -45, -35, -25, -15, -5, 5, 15, 25, 35, 45
        const startX = -((corridorCount - 1) * segmentWidth) / 2;
        const zPosition = -this.config.size - 7.5;  // Aligned with north wall

        for (let i = 0; i < corridorCount; i++) {
            // Alternate between regular and window corridors
            const useWindow = windowModel && i % 2 === 1;
            const model = useWindow ? windowModel : corridorModel;

            if (model) {
                const segment = this.deepCloneGltf(model);
                const x = startX + i * segmentWidth;

                segment.position.set(x, 0, zPosition);
                segment.rotation.y = -Math.PI / 2;  // Rotate so back faces the wall
                segment.scale.setScalar(corridorScale);  // Scale up for player to walk through

                this.scene.add(segment);

                // Calculate precise bounds for graffiti placement and physics
                // Force matrix update to ensure world coordinates are correct
                segment.updateMatrixWorld(true);
                const box = new THREE.Box3().setFromObject(segment);

                // 使用实际测量的 bounding box 创建物理碰撞体
                // 走廊模型实际尺寸（考虑了缩放和旋转）
                const actualWidth = box.max.x - box.min.x;
                const actualHeight = box.max.y - box.min.y;
                const actualDepth = box.max.z - box.min.z;
                const centerX = (box.max.x + box.min.x) / 2;
                const centerY = (box.max.y + box.min.y) / 2;
                const centerZ = (box.max.z + box.min.z) / 2;

                if (this.physics) {
                    // 走廊墙壁：北侧和南侧各有一面墙
                    // 墙壁位于走廊的前后边缘
                    const wallThickness = 0.5;
                    const wallHeight = actualHeight;

                    // 北墙 (走廊北侧，靠近围墙)
                    const northWallBody = PhysicsBodyFactory.createBox(
                        this.physics,
                        { x: actualWidth, y: wallHeight, z: wallThickness },
                        { type: 'static', mass: 0 }
                    );
                    northWallBody.setPosition({
                        x: centerX,
                        y: centerY,
                        z: box.max.z - wallThickness / 2
                    });

                    // 南墙 (走廊南侧，靠近竞技场中心)
                    const southWallBody = PhysicsBodyFactory.createBox(
                        this.physics,
                        { x: actualWidth, y: wallHeight, z: wallThickness },
                        { type: 'static', mass: 0 }
                    );
                    southWallBody.setPosition({
                        x: centerX,
                        y: centerY,
                        z: box.min.z + wallThickness / 2
                    });
                }

                // 墙壁正面表面位置（基于 DebugTools 测量）
                // 测量显示墙壁正面 Z ≈ -95.01
                const wallFaceZ = -95.01;
                const width = box.max.x - box.min.x;
                const height = box.max.y - box.min.y;

                const decalCount = 4; // Increased count to ensure edge coverage
                for (let d = 0; d < decalCount; d++) {
                    // 随机涂鸦颜色
                    const randomColor = `hsl(${Math.random() * 360}, 70%, 50%)`;
                    const decalTexture = this.createGraffitiTexture(randomColor);
                    let size = 3 + Math.random() * 2; // Size 3-5

                    // Safety check: ensure segment is large enough
                    // Relaxed margin calculation to prevent skipping valid segments
                    let margin = size / 2;
                    const safeWidth = width - (margin * 2);
                    const safeHeight = height - (margin * 2);

                    // If segment is too small, try reducing size
                    if (safeWidth <= 0 || safeHeight <= 0) {
                        continue;
                    }

                    // Calculate safe ranges relative to center/bottom
                    const centerX = (box.max.x + box.min.x) / 2;
                    const bottomY = box.min.y;

                    // 使用实际测量的墙壁正面边界
                    // 基于测量: X范围约 -5 到 0, Y范围约 0 到 4.01
                    // 每个走廊段中心不同，需要相对计算
                    const wallHalfWidth = 2.5;  // 墙壁半宽（约5米宽）
                    const wallMinX = centerX - wallHalfWidth;
                    const wallMaxX = centerX + wallHalfWidth;
                    const wallMinY = bottomY;
                    const wallMaxY = bottomY + 4.01;  // 墙壁高度约4米

                    let finalX = 0, finalY = 0;

                    // Hole definition (Zero size by default for solid walls)
                    let holeMinX = 0, holeMaxX = 0, holeMinY = 0, holeMaxY = 0;

                    if (useWindow) {
                        // Define Window Hole (Forbidden Zone)
                        // 最新测量: 3.015 wide x 1.519 high
                        // Window offset: 1.5075 from center, 1.501 from bottom
                        holeMinX = centerX - 1.5075;  // Half of 3.015 width
                        holeMaxX = centerX + 1.5075;
                        holeMinY = bottomY + 1.501;   // Bottom offset
                        holeMaxY = bottomY + 3.020;   // 1.501 + 1.519 = 3.020
                    }

                    // Placement logic
                    // Use large, random size (3-5)
                    size = 3 + Math.random() * 2;
                    margin = size / 2;

                    // We allow placement across the whole bounding width because the shader will clip it
                    finalX = centerX + (Math.random() - 0.5) * (width - size);
                    finalY = box.min.y + margin + Math.random() * (height - margin * 2);

                    // Unified ShaderMaterial for ALL walls (Solid & Window)
                    // This ensures "Overhanging" decals are clipped by wall boundaries
                    const clippingUniforms = {
                        map: { value: decalTexture },
                        holeMin: { value: new THREE.Vector2(holeMinX, holeMinY) },
                        holeMax: { value: new THREE.Vector2(holeMaxX, holeMaxY) },
                        wallMin: { value: new THREE.Vector2(wallMinX, wallMinY) },
                        wallMax: { value: new THREE.Vector2(wallMaxX, wallMaxY) }
                    };

                    const decalMat = new THREE.ShaderMaterial({
                        uniforms: clippingUniforms,
                        vertexShader: `
                            varying vec2 vUv;
                            varying vec3 vWorldPosition;
                            void main() {
                                vUv = uv;
                                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                                vWorldPosition = worldPosition.xyz;
                                gl_Position = projectionMatrix * viewMatrix * worldPosition;
                            }
                        `,
                        fragmentShader: `
                            uniform sampler2D map;
                            uniform vec2 holeMin;
                            uniform vec2 holeMax;
                            uniform vec2 wallMin;
                            uniform vec2 wallMax;
                            varying vec2 vUv;
                            varying vec3 vWorldPosition;

                            void main() {
                                vec4 color = texture2D(map, vUv);

                                // 1. CLIP HOLE (If inside window hole)
                                // Only active if hole dimensions are non-zero (implied by max > min)
                                if (holeMax.x > holeMin.x) {
                                    if (vWorldPosition.x > holeMin.x && vWorldPosition.x < holeMax.x &&
                                        vWorldPosition.y > holeMin.y && vWorldPosition.y < holeMax.y) {
                                        discard;
                                    }
                                }

                                // 2. CLIP BOUNDARY (If outside wall visual limits)
                                if (vWorldPosition.x < wallMin.x || vWorldPosition.x > wallMax.x ||
                                    vWorldPosition.y < wallMin.y || vWorldPosition.y > wallMax.y) {
                                    discard;
                                }

                                if (color.a < 0.1) discard;
                                gl_FragColor = color;
                            }
                        `,
                        transparent: true,
                        side: THREE.FrontSide,
                        depthWrite: true,
                        depthTest: true
                    });

                    const decal = new THREE.Mesh(new THREE.PlaneGeometry(size, size), decalMat);

                    // 将涂鸦紧贴墙壁表面，稍微偏移 0.02 避免 z-fighting
                    decal.position.set(
                        finalX,
                        finalY,
                        wallFaceZ + 0.02
                    );

                    // Face +Z (Towards Arena Center)
                    decal.rotation.set(0, 0, 0);

                    this.scene.add(decal);
                }

                // 为走廊内部添加涂鸦（左右两侧墙壁）
                const innerDecalCount = 3; // 每面墙3个涂鸦
                const innerWallHeight = box.max.y - box.min.y;
                const innerWallDepth = box.max.z - box.min.z;

                // 左墙（西侧）- 面向 +X 方向
                for (let d = 0; d < innerDecalCount; d++) {
                    const randomColor = `hsl(${Math.random() * 360}, 70%, 50%)`;
                    const decalTexture = this.createGraffitiTexture(randomColor);
                    const size = 2 + Math.random() * 2; // Size 2-4

                    const decalMat = new THREE.MeshBasicMaterial({
                        map: decalTexture,
                        transparent: true,
                        side: THREE.FrontSide,
                        depthWrite: true,
                        depthTest: true
                    });

                    const decal = new THREE.Mesh(new THREE.PlaneGeometry(size, size), decalMat);

                    // 位置：左墙表面
                    decal.position.set(
                        box.min.x + 0.02, // 稍微偏移避免 z-fighting
                        box.min.y + size / 2 + Math.random() * (innerWallHeight - size),
                        box.min.z + Math.random() * innerWallDepth
                    );

                    // 面向 +X 方向
                    decal.rotation.set(0, Math.PI / 2, 0);

                    this.scene.add(decal);
                }

                // 右墙（东侧）- 面向 -X 方向
                for (let d = 0; d < innerDecalCount; d++) {
                    const randomColor = `hsl(${Math.random() * 360}, 70%, 50%)`;
                    const decalTexture = this.createGraffitiTexture(randomColor);
                    const size = 2 + Math.random() * 2; // Size 2-4

                    const decalMat = new THREE.MeshBasicMaterial({
                        map: decalTexture,
                        transparent: true,
                        side: THREE.FrontSide,
                        depthWrite: true,
                        depthTest: true
                    });

                    const decal = new THREE.Mesh(new THREE.PlaneGeometry(size, size), decalMat);

                    // 位置：右墙表面
                    decal.position.set(
                        box.max.x - 0.02, // 稍微偏移避免 z-fighting
                        box.min.y + size / 2 + Math.random() * (innerWallHeight - size),
                        box.min.z + Math.random() * innerWallDepth
                    );

                    // 面向 -X 方向
                    decal.rotation.set(0, -Math.PI / 2, 0);

                    this.scene.add(decal);
                }
            }
        }
    }

    /**
     * Generate platform positions
     */
    private generatePlatformPositions(count: number): Array<{ x: number, y: number, z: number, rotation?: number }> {
        const positions: Array<{ x: number, y: number, z: number, rotation?: number }> = [];

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
    private getRandomPosition(minDistance: number): { x: number, z: number } {
        const angle = Math.random() * Math.PI * 2;
        const distance = minDistance + Math.random() * (this.config.size - minDistance - 5);

        return {
            x: Math.cos(angle) * distance,
            z: Math.sin(angle) * distance
        };
    }

    /**
     * Get a model from loaded models
     */
    private getModel(id: string): THREE.Group | undefined {
        return this.assetManager.getGLTF(id) || undefined;
    }

    /**
     * Deep clone a GLTF model
     * Three.js Group.clone() creates a shallow copy, need deep clone for GLTF models
     */
    private deepCloneGltf(model: THREE.Group): THREE.Group {
        const cloned = model.clone(true); // Recursive clone

        // Clone all materials to avoid sharing
        cloned.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(mat => mat.clone());
                } else {
                    child.material = child.material.clone();
                }
            }
        });

        return cloned;
    }

    /**
     * Clear existing level
     */
    private clearLevel(): void {
        console.log('[LevelBuilder] Clearing level...');
        // In a real implementation, we would track all created objects and remove them
        // For now, we rely on the main game clear logic or just add to scene
    }
}
