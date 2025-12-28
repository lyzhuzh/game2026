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
        console.log('[LevelBuilder] Using procedural grid walls');
        this.createBoxWalls();
        return;

        const baseModel = gltf.scene;

        // Debug: analyze model structure
        console.log('[LevelBuilder] Analyzing wall model structure:');
        baseModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                console.log(`[LevelBuilder] Mesh: ${child.name || '(unnamed)'}, position=(${child.position.x.toFixed(2)}, ${child.position.y.toFixed(2)}, ${child.position.z.toFixed(2)})`);
            }
        });

        // Get original model size and center
        const box = new THREE.Box3().setFromObject(baseModel);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        console.log(`[LevelBuilder] Original: size=(${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)}), center=(${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`);

        // Use the larger dimension as the wall piece length
        const modelLength = Math.max(size.x, size.z);
        const targetPieceLength = 4;
        const uniformScale = targetPieceLength / modelLength;

        // Calculate wall length to cover arena size + overlap at corners
        // Account for overlap (5%) between pieces
        const arenaLength = this.config.size * 2;
        const overlap = 0.05;
        const effectiveLength = targetPieceLength * (1 - overlap);

        // Calculate how many pieces we need and actual coverage
        // Need to cover arenaLength + 10 (corner overlap), account for 5% overlap between pieces
        const pieceCount = Math.ceil((arenaLength + 10) / effectiveLength);
        const actualCoverage = pieceCount * effectiveLength;
        const wallLength = pieceCount * targetPieceLength;

        console.log(`[LevelBuilder] Arena length: ${arenaLength}, target coverage: ${arenaLength + 10}`);
        console.log(`[LevelBuilder] Pieces: ${pieceCount}, effectiveLength: ${effectiveLength.toFixed(2)}, actual coverage: ${actualCoverage.toFixed(2)}`);
        console.log(`[LevelBuilder] Wall length (before overlap): ${wallLength}`);

        const wallConfig = [
            { name: 'North', pos: [0, 0, -this.config.size], length: wallLength, axis: 'x' },
            { name: 'South', pos: [0, 0, this.config.size], length: wallLength, axis: 'x' },
            { name: 'East', pos: [this.config.size, 0, 0], length: wallLength, axis: 'z' },
            { name: 'West', pos: [-this.config.size, 0, 0], length: wallLength, axis: 'z' }
        ];

        for (const config of wallConfig) {
            const pieceCount = Math.ceil(config.length / targetPieceLength);
            const startOffset = -config.length / 2;

            const overlap = 0.05;
            const effectiveLength = targetPieceLength * (1 - overlap);

            console.log(`[LevelBuilder] ${config.name} wall: pieces=${pieceCount}, startOffset=${startOffset}, length=${config.length}`);

            for (let i = 0; i < pieceCount; i++) {
                // Clone fresh from gltf.scene each time
                const piece = this.deepCloneGltf(baseModel);

                // Determine scale based on wall - flip X for South and East to mirror texture
                let scaleX = uniformScale;
                let scaleY = uniformScale;
                let scaleZ = uniformScale;

                if (config.name === 'South' || config.name === 'East') {
                    scaleX = -uniformScale; // Mirror the model horizontally
                }

                piece.scale.set(scaleX, scaleY, scaleZ);

                // Create container for positioning
                const container = new THREE.Group();
                container.add(piece);

                // Set container rotation - walls extend parallel to edge, face inward
                // Model extends along Z axis, texture on one side only
                // North (90°) and West (0°) work correctly
                switch (config.name) {
                    case 'North':
                        // North wall: 90° - extends along X, has texture facing inward
                        container.rotation.y = Math.PI / 2;
                        break;
                    case 'South':
                        // South wall: 90° like North, mirrored via scale.x
                        container.rotation.y = Math.PI / 2;
                        break;
                    case 'East':
                        // East wall: 0° like West, mirrored via scale.x
                        container.rotation.y = 0;
                        break;
                    case 'West':
                        // West wall: 0° - extends along Z, has texture facing inward
                        container.rotation.y = 0;
                        break;
                }

                // Enable double-sided rendering for all wall materials
                piece.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => mat.side = THREE.DoubleSide);
                        } else if (child.material) {
                            child.material.side = THREE.DoubleSide;
                        }
                    }
                });

                // Debug: Log wall orientation
                if (i === 0) {
                    console.log(`%c[墙壁调试] ${config.name}墙`, 'color: yellow; font-weight: bold',
                        `旋转=${(container.rotation.y * 180 / Math.PI).toFixed(0)}°`,
                        `位置=${config.pos}`);
                }

                if (i === 0) {
                    console.log(`[LevelBuilder] ${config.name}: container rotation=${(container.rotation.y * 180 / Math.PI).toFixed(0)}deg, piece rotation=${(piece.rotation.y * 180 / Math.PI).toFixed(0)}deg, piece scale=(${piece.scale.x.toFixed(2)}, ${piece.scale.y.toFixed(2)}, ${piece.scale.z.toFixed(2)})`);

                    // Calculate forward direction to understand which way the model faces
                    const forward = new THREE.Vector3(0, 0, 1);
                    forward.applyQuaternion(container.quaternion);
                    console.log(`[LevelBuilder] ${config.name}: container forward direction=(${forward.x.toFixed(2)}, ${forward.y.toFixed(2)}, ${forward.z.toFixed(2)})`);
                    if (Math.abs(forward.x) > Math.abs(forward.z)) {
                        console.log(`[LevelBuilder] ${config.name}: facing ${forward.x > 0 ? '+X (East)' : '-X (West)'}`);
                    } else {
                        console.log(`[LevelBuilder] ${config.name}: facing ${forward.z > 0 ? '+Z (South)' : '-Z (North)'}`);
                    }

                    // Also show piece local forward (before container rotation)
                    const pieceForward = new THREE.Vector3(0, 0, 1);
                    pieceForward.applyAxisAngle(new THREE.Vector3(0, 1, 0), piece.rotation.y);
                    console.log(`[LevelBuilder] ${config.name}: piece local forward=(${pieceForward.x.toFixed(2)}, ${pieceForward.y.toFixed(2)}, ${pieceForward.z.toFixed(2)})`);
                }

                // Get bounding box AFTER rotation
                const scaledBox = new THREE.Box3().setFromObject(container);
                const boxCenter = new THREE.Vector3();
                scaledBox.getCenter(boxCenter);
                const boxMin = scaledBox.min;

                const posOnWall = startOffset + (i * effectiveLength) + effectiveLength / 2;

                // Position walls at arena edge, adjusting for boxCenter offset
                // For axis='x' walls (North/South): vary X, fixed Z at arena edge
                // For axis='z' walls (East/West): vary Z, fixed X at arena edge
                if (config.axis === 'x') {
                    // North/South: subtract boxCenter.x from X position, subtract boxCenter.z from Z position
                    container.position.set(posOnWall - boxCenter.x, -boxMin.y, config.pos[2] - boxCenter.z);
                } else {
                    // East/West: subtract boxCenter.x from X position, subtract boxCenter.z from Z position
                    container.position.set(config.pos[0] - boxCenter.x, -boxMin.y, posOnWall - boxCenter.z);
                }

                // Log first and last piece positions for debugging
                if (i === 0 || i === pieceCount - 1) {
                    console.log(`[LevelBuilder] ${config.name} piece ${i + 1}/${pieceCount}: posOnWall=${posOnWall.toFixed(2)}, finalPos=(${container.position.x.toFixed(2)}, ${container.position.y.toFixed(2)}, ${container.position.z.toFixed(2)})`);
                }

                this.scene.add(container);
            }
        }

        // === DEBUG: Add test wall in center ===
        console.log('%c[测试] 在场地中央添加测试墙壁', 'color: cyan; font-weight: bold');
        const testPiece = this.deepCloneGltf(baseModel);
        testPiece.scale.set(uniformScale, uniformScale, uniformScale);

        // Calculate center offset to align model center to origin for proper rotation
        const testBox = new THREE.Box3().setFromObject(testPiece);
        const testCenter = new THREE.Vector3();
        testBox.getCenter(testCenter);

        // Adjust piece position to center it at origin (so rotation happens in place)
        testPiece.position.sub(testCenter);

        const testContainer = new THREE.Group();
        testContainer.add(testPiece);

        // 设置旋转角度 - 修改这个值来测试不同的朝向
        const testRotation = 270; // 0, 90, 180, 270度对应 0, π/2, π, 3π/2
        testContainer.rotation.y = testRotation * Math.PI / 180;

        // 放置在场地中央，稍微抬高以便观察
        testContainer.position.set(0, 2, 0);

        console.log(`%c[测试墙壁] 旋转角度=${testRotation}°`, 'color: lime; font-weight: bold');
        console.log('[测试墙壁] 位置=(0, 2, 0) - 在场地中央，高度2米');
        console.log('[测试墙壁] 请在游戏中观察纹理朝向哪个方向');

        this.scene.add(testContainer);
        // ======================================
    }

    /**
     * Create beautiful procedural box walls with grid texture
     */
    private createBoxWalls(): void {
        console.log('[LevelBuilder] Creating procedural grid walls with random colors');

        // Generate random vibrant colors for walls
        const generateRandomColor = () => {
            const hue = Math.random() * 360;
            const saturation = 60 + Math.random() * 30; // 60-90%
            const lightness = 25 + Math.random() * 15;  // 25-40% (dark but visible)
            return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        };

        const generateAccentColor = (baseHue: number) => {
            const lightness = 35 + Math.random() * 15;
            return `hsl(${baseHue}, 70%, ${lightness}%)`;
        };

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

        console.log('[LevelBuilder] Random wall colors:', randomColors.map(c => c.base));

        // Function to create unique texture for each wall with graffiti
        const createWallTexture = (wallName: string, baseColor: string, accentColor: string, graffitiColor: string) => {
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

            // Draw random graffiti scattered across wall - same method as ground
            const wallGraffitiColors = ['#ffffff', '#ffff00', '#00ffff', '#ff00ff', '#00ff00', '#ff6600'];

            // Draw multiple random graffiti elements
            for (let g = 0; g < 8; g++) {
                const cx = 50 + Math.random() * 412;
                const cy = 50 + Math.random() * 412;
                const color = wallGraffitiColors[Math.floor(Math.random() * wallGraffitiColors.length)];
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

            console.log(`[LevelBuilder] Created ${config.name} wall with multi-colored graffiti:`, config.graffitiColors);
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
     * Deep clone GLTF scene with materials and skeleton support
     */
    private deepCloneGltf(source: THREE.Object3D): THREE.Object3D {
        // First, collect all bones from original source by name
        const originalBonesByName = new Map<string, THREE.Bone>();
        source.traverse((child) => {
            if (child instanceof THREE.Bone) {
                originalBonesByName.set(child.name, child as THREE.Bone);
            }
        });

        // Clone the entire scene
        const clone = source.clone();

        // Collect cloned bones by name
        const clonedBonesByName = new Map<string, THREE.Bone>();
        clone.traverse((child) => {
            if (child instanceof THREE.Bone) {
                clonedBonesByName.set(child.name, child as THREE.Bone);
            }
        });

        // Handle SkinnedMesh - update skeleton to use cloned bones
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isSkinnedMesh) {
                const skinnedMesh = child as THREE.SkinnedMesh;
                const originalSkeleton = skinnedMesh.skeleton;

                if (originalSkeleton) {
                    // Map original bones to cloned bones by name
                    const clonedBones = originalSkeleton.bones.map(bone => {
                        return clonedBonesByName.get(bone.name) || bone;
                    });

                    // Create new skeleton with cloned bones
                    skinnedMesh.skeleton = new THREE.Skeleton(clonedBones, originalSkeleton.boneInverses);

                    // Update bind matrix
                    skinnedMesh.bind(skinnedMesh.skeleton, skinnedMesh.bindMatrix);
                }
            }

            // Clone materials
            if (child instanceof THREE.Mesh) {
                const mesh = child as THREE.Mesh;
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material = mesh.material.map(mat => mat.clone());
                    } else {
                        mesh.material = mesh.material.clone();
                    }
                }
            }
        });

        return clone;
    }

    /**
     * Get model from asset manager (with caching)
     */
    private async getModel(assetId: string): Promise<THREE.Group | null> {
        if (this.loadedModels.has(assetId)) {
            return this.deepCloneGltf(this.loadedModels.get(assetId)!);
        }

        // Try to get from cache
        const cachedModel = this.assetManager.getGLTF(assetId);
        if (cachedModel) {
            this.loadedModels.set(assetId, cachedModel);
            return this.deepCloneGltf(cachedModel);
        }

        // Asset not loaded - find config and load it
        const assetConfig = GAME_ASSETS.find(a => a.id === assetId);
        if (assetConfig) {
            try {
                console.log(`[LevelBuilder] Loading asset on-demand: ${assetId}`);
                const gltf = await this.assetManager.loadAsset(assetConfig);
                if (gltf && gltf.scene) {
                    const model = gltf.scene.clone();
                    this.loadedModels.set(assetId, model);
                    return this.deepCloneGltf(model);
                }
            } catch (error) {
                console.warn(`[LevelBuilder] Failed to load ${assetId}:`, error);
            }
        }

        console.warn(`[LevelBuilder] Model not found: ${assetId}`);
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
