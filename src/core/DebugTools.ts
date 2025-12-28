/**
 * Debug Tools for 3D Scene Measurement and Annotation
 * Provides various marking modes for debugging game objects
 */

import * as THREE from 'three';

export enum MarkMode {
    POINT = 'point',           // Single point marking
    BOUNDS = 'bounds',         // 4-point boundary (wall, window, etc.)
    DISTANCE = 'distance',     // 2-point distance measurement
    PATH = 'path',             // Multi-point path
    AREA = 'area',             // Polygon area calculation
    BOX = 'box'                // 2-point box (min, max corners)
}

export enum ObjectType {
    WALL = 'wall',
    WINDOW = 'window',
    PLATFORM = 'platform',
    ENEMY = 'enemy',
    WEAPON = 'weapon',
    GENERIC = 'generic'
}

export interface PlayerViewInfo {
    position: THREE.Vector3;      // 玩家位置
    rotation: THREE.Euler;         // 玩家朝向
    yaw: number;                   // 水平旋转角度
    pitch: number;                 // 垂直旋转角度
    distanceToPoint: number;       // 到标记点的距离
    directionToTarget: THREE.Vector3; // 到目标的方向
    horizontalAngle: number;       // 水平角度偏移
    verticalAngle: number;         // 垂直角度偏移
}

export interface DebugPoint {
    position: THREE.Vector3;
    marker: THREE.Mesh;
    timestamp: number;
    playerView: PlayerViewInfo;    // 玩家视角信息
}

export interface DistanceMeasurement {
    point1: THREE.Vector3;
    point2: THREE.Vector3;
    line: THREE.Line;
    label?: THREE.Sprite;
}

export class DebugTools {
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private raycaster: THREE.Raycaster;

    // State
    private currentMode: MarkMode = MarkMode.POINT;
    private currentObjectType: ObjectType = ObjectType.GENERIC;
    private isActive: boolean = false;

    // Collected data
    private debugPoints: DebugPoint[] = [];
    private distanceLines: DistanceMeasurement[] = [];
    private pathPoints: THREE.Vector3[] = [];
    private areaPoints: THREE.Vector3[] = [];

    // Visual elements
    private markers: THREE.Mesh[] = [];
    private lines: THREE.Line[] = [];
    private labels: THREE.Sprite[] = [];
    private boundaryBoxes: THREE.LineSegments[] = [];

    // Configuration
    private readonly markerColor = 0xffff00;
    private readonly lineColor = 0x00ff00;
    private readonly boxColor = 0xff0000;
    private readonly markerSize = 0.2;

    constructor(scene: THREE.Scene, camera: THREE.Camera) {
        this.scene = scene;
        this.camera = camera;
        this.raycaster = new THREE.Raycaster();
    }

    /**
     * Initialize debug tools and setup event listeners
     */
    initialize(): void {
        console.log('[DebugTools] Initializing...');
        this.setupEventListeners();
        this.isActive = true;
        this.showHelp();
    }

    /**
     * Setup keyboard event listeners
     */
    private setupEventListeners(): void {
        window.addEventListener('keydown', (e) => {
            if (!this.isActive) return;

            const key = e.key.toLowerCase();

            // Mode switching (number keys)
            if (key === '1') this.setMode(MarkMode.POINT);
            if (key === '2') this.setMode(MarkMode.BOUNDS);
            if (key === '3') this.setMode(MarkMode.DISTANCE);
            if (key === '4') this.setMode(MarkMode.PATH);
            if (key === '5') this.setMode(MarkMode.AREA);
            if (key === '6') this.setMode(MarkMode.BOX);

            // Object type switching (shift + number)
            if (e.shiftKey) {
                if (key === '1') this.setObjectType(ObjectType.WALL);
                if (key === '2') this.setObjectType(ObjectType.WINDOW);
                if (key === '3') this.setObjectType(ObjectType.PLATFORM);
                if (key === '4') this.setObjectType(ObjectType.ENEMY);
                if (key === '5') this.setObjectType(ObjectType.WEAPON);
            }

            // Actions
            if (key === 'm') this.markPoint();
            if (key === 'c') this.clearAll();
            if (key === 'u') this.undoLast();
            if (key === 'h') this.showHelp();
            if (key === 'p') this.printSummary();
        });
    }

    /**
     * Set current marking mode
     */
    setMode(mode: MarkMode): void {
        this.currentMode = mode;
        this.clearCurrentSession();
        console.log(`[DebugTools] Mode: ${mode.toUpperCase()}`);
    }

    /**
     * Set current object type
     */
    setObjectType(type: ObjectType): void {
        this.currentObjectType = type;
        console.log(`[DebugTools] Object Type: ${type.toUpperCase()}`);
    }

    /**
     * Mark a point at camera crosshair
     */
    private markPoint(): void {
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        if (intersects.length === 0) {
            console.warn('[DebugTools] Nothing targeted!');
            return;
        }

        const hit = intersects[0];
        const point = hit.point.clone();

        // 捕获玩家视角信息
        const playerView = this.capturePlayerViewInfo(point);

        switch (this.currentMode) {
            case MarkMode.POINT:
                this.addPointMarker(point);
                console.log(`[DebugTools] Point marked:`, point);
                this.logPlayerView(playerView);
                break;

            case MarkMode.BOUNDS:
                this.handleBoundsMode(point, playerView);
                break;

            case MarkMode.DISTANCE:
                this.handleDistanceMode(point, playerView);
                break;

            case MarkMode.PATH:
                this.handlePathMode(point, playerView);
                break;

            case MarkMode.AREA:
                this.handleAreaMode(point, playerView);
                break;

            case MarkMode.BOX:
                this.handleBoxMode(point, playerView);
                break;
        }
    }

    /**
     * 捕获玩家视角信息
     */
    private capturePlayerViewInfo(targetPoint: THREE.Vector3): PlayerViewInfo {
        const camera = this.camera as THREE.PerspectiveCamera;

        // 玩家位置
        const playerPos = camera.position.clone();

        // 计算到目标的距离
        const distance = playerPos.distanceTo(targetPoint);

        // 计算方向向量
        const direction = new THREE.Vector3()
            .subVectors(targetPoint, playerPos)
            .normalize();

        // 获取相机朝向（假设是 PerspectiveCamera）
        const yaw = Math.atan2(
            -Math.sin(camera.rotation.y),
            -Math.cos(camera.rotation.y)
        );
        const pitch = camera.rotation.x;

        // 计算水平角度偏移（目标方向相对于玩家朝向的角度）
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(camera.quaternion);
        const horizontalAngle = Math.atan2(
            forward.cross(direction).y,
            forward.dot(direction)
        );

        // 计算垂直角度偏移
        const toTarget = new THREE.Vector3().subVectors(targetPoint, playerPos).normalize();
        const verticalAngle = Math.asin(toTarget.y);

        return {
            position: playerPos,
            rotation: camera.rotation.clone(),
            yaw,
            pitch,
            distanceToPoint: distance,
            directionToTarget: direction,
            horizontalAngle: horizontalAngle * (180 / Math.PI), // 转换为度数
            verticalAngle: verticalAngle * (180 / Math.PI)
        };
    }

    /**
     * 输出玩家视角信息
     */
    private logPlayerView(view: PlayerViewInfo): void {
        console.log(`  └─ Player Position: (${view.position.x.toFixed(2)}, ${view.position.y.toFixed(2)}, ${view.position.z.toFixed(2)})`);
        console.log(`  └─ Distance: ${view.distanceToPoint.toFixed(2)} units`);
        console.log(`  └─ Yaw: ${(view.yaw * 180 / Math.PI).toFixed(1)}°, Pitch: ${(view.pitch * 180 / Math.PI).toFixed(1)}°`);
        console.log(`  └─ Horizontal Offset: ${view.horizontalAngle.toFixed(1)}°`);
        console.log(`  └─ Vertical Offset: ${view.verticalAngle.toFixed(1)}°`);
    }

    /**
     * Add a visual marker at position
     */
    private addPointMarker(position: THREE.Vector3, color: number = this.markerColor): THREE.Mesh {
        const marker = new THREE.Mesh(
            new THREE.SphereGeometry(this.markerSize, 16, 16),
            new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.8 })
        );
        marker.position.copy(position);
        marker.renderOrder = 999;
        this.scene.add(marker);
        this.markers.push(marker);

        return marker;
    }

    /**
     * Handle BOUNDS mode (4 points for rectangular boundary)
     */
    private handleBoundsMode(point: THREE.Vector3, playerView: PlayerViewInfo): void {
        this.debugPoints.push({
            position: point,
            marker: this.addPointMarker(point),
            timestamp: Date.now(),
            playerView
        });

        console.log(`[DebugTools] Bounds point ${this.debugPoints.length}/4 marked`);
        this.logPlayerView(playerView);

        if (this.debugPoints.length === 4) {
            this.calculateBounds();
        }
    }

    /**
     * Calculate and output boundary information
     */
    private calculateBounds(): void {
        const points = this.debugPoints.map(p => p.position);
        const views = this.debugPoints.map(p => p.playerView);

        const min = new THREE.Vector3(
            Math.min(...points.map(p => p.x)),
            Math.min(...points.map(p => p.y)),
            Math.min(...points.map(p => p.z))
        );
        const max = new THREE.Vector3(
            Math.max(...points.map(p => p.x)),
            Math.max(...points.map(p => p.y)),
            Math.max(...points.map(p => p.z))
        );

        const size = new THREE.Vector3().subVectors(max, min);
        const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);

        console.log('='.repeat(50));
        console.log(`[DebugTools] === BOUNDS COMPLETE (${this.currentObjectType.toUpperCase()}) ===`);
        console.log(`[DebugTools] Min: (${min.x.toFixed(3)}, ${min.y.toFixed(3)}, ${min.z.toFixed(3)})`);
        console.log(`[DebugTools] Max: (${max.x.toFixed(3)}, ${max.y.toFixed(3)}, ${max.z.toFixed(3)})`);
        console.log(`[DebugTools] Size: (${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)})`);
        console.log(`[DebugTools] Center: (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`);

        // 输出每个点的玩家视角信息
        console.log(`[DebugTools] Player View Information:`);
        views.forEach((view, i) => {
            console.log(`  Point ${i + 1}:`);
            console.log(`    Player Pos: (${view.position.x.toFixed(2)}, ${view.position.y.toFixed(2)}, ${view.position.z.toFixed(2)})`);
            console.log(`    Distance: ${view.distanceToPoint.toFixed(2)} units`);
            console.log(`    H-Angle: ${view.horizontalAngle.toFixed(1)}°, V-Angle: ${view.verticalAngle.toFixed(1)}°`);
        });

        console.log('='.repeat(50));

        // Draw bounding box
        this.drawBoundingBox(min, max);

        // Generate code snippet
        this.generateCodeSnippet(min, max);

        this.clearCurrentSession();
    }

    /**
     * Handle DISTANCE mode (2 points)
     */
    private handleDistanceMode(point: THREE.Vector3, playerView: PlayerViewInfo): void {
        this.debugPoints.push({
            position: point,
            marker: this.addPointMarker(point),
            timestamp: Date.now(),
            playerView
        });

        console.log(`[DebugTools] Distance point ${this.debugPoints.length}/2 marked`);
        this.logPlayerView(playerView);

        if (this.debugPoints.length === 2) {
            const p1 = this.debugPoints[0].position;
            const p2 = this.debugPoints[1].position;
            const v1 = this.debugPoints[0].playerView;
            const v2 = this.debugPoints[1].playerView;
            const distance = p1.distanceTo(p2);

            console.log(`[DebugTools] === DISTANCE COMPLETE ===`);
            console.log(`[DebugTools] Point-to-Point Distance: ${distance.toFixed(3)} units`);
            console.log(`[DebugTools] Point 1: ${p1.x.toFixed(2)}, ${p1.y.toFixed(2)}, ${p1.z.toFixed(2)} (dist: ${v1.distanceToPoint.toFixed(2)})`);
            console.log(`[DebugTools] Point 2: ${p2.x.toFixed(2)}, ${p2.y.toFixed(2)}, ${p2.z.toFixed(2)} (dist: ${v2.distanceToPoint.toFixed(2)})`);

            // Draw line between points
            this.drawLine(p1, p2, this.lineColor);

            this.debugPoints = [];
        }
    }

    /**
     * Handle PATH mode (multiple points)
     */
    private handlePathMode(point: THREE.Vector3, playerView: PlayerViewInfo): void {
        this.pathPoints.push(point);
        this.addPointMarker(point, 0x00ffff);

        if (this.pathPoints.length > 1) {
            const prev = this.pathPoints[this.pathPoints.length - 2];
            this.drawLine(prev, point, 0x00ffff);
        }

        // Calculate total path length
        let totalLength = 0;
        for (let i = 1; i < this.pathPoints.length; i++) {
            totalLength += this.pathPoints[i - 1].distanceTo(this.pathPoints[i]);
        }

        console.log(`[DebugTools] Path point ${this.pathPoints.length} marked`);
        this.logPlayerView(playerView);
        console.log(`[DebugTools] Total path length: ${totalLength.toFixed(3)} units`);
    }

    /**
     * Handle AREA mode (polygon area calculation)
     */
    private handleAreaMode(point: THREE.Vector3, playerView: PlayerViewInfo): void {
        this.areaPoints.push(point);
        this.addPointMarker(point, 0xff00ff);

        if (this.areaPoints.length > 1) {
            const prev = this.areaPoints[this.areaPoints.length - 2];
            this.drawLine(prev, point, 0xff00ff);
        }

        console.log(`[DebugTools] Area point ${this.areaPoints.length} marked`);
        this.logPlayerView(playerView);

        if (this.areaPoints.length >= 3) {
            const area = this.calculatePolygonArea(this.areaPoints);
            console.log(`[DebugTools] Polygon area (2D projection): ${area.toFixed(3)} square units`);
        }
    }

    /**
     * Handle BOX mode (2 corners: min and max)
     */
    private handleBoxMode(point: THREE.Vector3, playerView: PlayerViewInfo): void {
        this.debugPoints.push({
            position: point,
            marker: this.addPointMarker(point),
            timestamp: Date.now(),
            playerView
        });

        console.log(`[DebugTools] Box corner ${this.debugPoints.length}/2 marked`);
        this.logPlayerView(playerView);

        if (this.debugPoints.length === 2) {
            const p1 = this.debugPoints[0].position;
            const p2 = this.debugPoints[1].position;
            const v1 = this.debugPoints[0].playerView;
            const v2 = this.debugPoints[1].playerView;

            const min = new THREE.Vector3(
                Math.min(p1.x, p2.x),
                Math.min(p1.y, p2.y),
                Math.min(p1.z, p2.z)
            );
            const max = new THREE.Vector3(
                Math.max(p1.x, p2.x),
                Math.max(p1.y, p2.y),
                Math.max(p1.z, p2.z)
            );

            console.log(`[DebugTools] === BOX COMPLETE ===`);
            console.log(`[DebugTools] Corner 1: ${p1.x.toFixed(2)}, ${p1.y.toFixed(2)}, ${p1.z.toFixed(2)} (dist: ${v1.distanceToPoint.toFixed(2)})`);
            console.log(`[DebugTools] Corner 2: ${p2.x.toFixed(2)}, ${p2.y.toFixed(2)}, ${p2.z.toFixed(2)} (dist: ${v2.distanceToPoint.toFixed(2)})`);

            this.drawBoundingBox(min, max);
            this.generateCodeSnippet(min, max);

            this.debugPoints = [];
        }
    }

    /**
     * Calculate 2D polygon area (using XY plane projection)
     */
    private calculatePolygonArea(points: THREE.Vector3[]): number {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return Math.abs(area / 2);
    }

    /**
     * Draw a line between two points
     */
    private drawLine(from: THREE.Vector3, to: THREE.Vector3, color: number): void {
        const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
        const material = new THREE.LineBasicMaterial({ color, depthTest: false });
        const line = new THREE.Line(geometry, material);
        line.renderOrder = 998;
        this.scene.add(line);
        this.lines.push(line);
    }

    /**
     * Draw a bounding box
     */
    private drawBoundingBox(min: THREE.Vector3, max: THREE.Vector3): void {
        const size = new THREE.Vector3().subVectors(max, min);
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const edges = new THREE.EdgesGeometry(geometry);
        const material = new THREE.LineBasicMaterial({ color: this.boxColor, depthTest: false });
        const box = new THREE.LineSegments(edges, material);

        box.position.copy(min).add(size.multiplyScalar(0.5));
        box.renderOrder = 997;
        this.scene.add(box);
        this.boundaryBoxes.push(box);
    }

    /**
     * Generate code snippet for using the measured bounds
     */
    private generateCodeSnippet(min: THREE.Vector3, max: THREE.Vector3): void {
        const snippet = `
// ${this.currentObjectType.toUpperCase()} bounds (measured with DebugTools)
const ${this.currentObjectType.toLowerCase()}Bounds = {
    min: new THREE.Vector3(${min.x.toFixed(3)}, ${min.y.toFixed(3)}, ${min.z.toFixed(3)}),
    max: new THREE.Vector3(${max.x.toFixed(3)}, ${max.y.toFixed(3)}, ${max.z.toFixed(3)}),
    size: new THREE.Vector3(${(max.x - min.x).toFixed(3)}, ${(max.y - min.y).toFixed(3)}, ${(max.z - min.z).toFixed(3)})
};
        `.trim();

        console.log('[DebugTools] Generated code snippet:');
        console.log(snippet);
    }

    /**
     * Clear current session data
     */
    private clearCurrentSession(): void {
        this.debugPoints.forEach(p => this.scene.remove(p.marker));
        this.debugPoints = [];
        this.pathPoints = [];
        this.areaPoints = [];
    }

    /**
     * Clear all debug visual elements
     */
    clearAll(): void {
        this.clearCurrentSession();

        this.markers.forEach(m => this.scene.remove(m));
        this.markers = [];

        this.lines.forEach(l => this.scene.remove(l));
        this.lines = [];

        this.boundaryBoxes.forEach(b => this.scene.remove(b));
        this.boundaryBoxes = [];

        this.labels.forEach(l => this.scene.remove(l));
        this.labels = [];

        this.distanceLines = [];

        console.log('[DebugTools] All debug markers cleared');
    }

    /**
     * Undo last action
     */
    undoLast(): void {
        if (this.markers.length === 0) {
            console.log('[DebugTools] Nothing to undo');
            return;
        }

        const lastMarker = this.markers.pop();
        if (lastMarker) this.scene.remove(lastMarker);

        if (this.debugPoints.length > 0) {
            this.debugPoints.pop();
        } else if (this.pathPoints.length > 0) {
            this.pathPoints.pop();
            // Remove last line
            const lastLine = this.lines.pop();
            if (lastLine) this.scene.remove(lastLine);
        } else if (this.areaPoints.length > 0) {
            this.areaPoints.pop();
            const lastLine = this.lines.pop();
            if (lastLine) this.scene.remove(lastLine);
        }

        console.log('[DebugTools] Undo');
    }

    /**
     * Print summary of all measurements
     */
    printSummary(): void {
        console.log('='.repeat(50));
        console.log('[DebugTools] === MEASUREMENT SUMMARY ===');
        console.log(`[DebugTools] Current Mode: ${this.currentMode}`);
        console.log(`[DebugTools] Object Type: ${this.currentObjectType}`);
        console.log(`[DebugTools] Markers: ${this.markers.length}`);
        console.log(`[DebugTools] Lines: ${this.lines.length}`);
        console.log(`[DebugTools] Boxes: ${this.boundaryBoxes.length}`);
        console.log('='.repeat(50));
    }

    /**
     * Show help information
     */
    showHelp(): void {
        console.log('='.repeat(50));
        console.log('[DebugTools] === DEBUG TOOLS HELP ===');
        console.log('[DebugTools] MODES (press number key):');
        console.log('[DebugTools]   1 - POINT: Mark single points');
        console.log('[DebugTools]   2 - BOUNDS: Mark 4-point rectangular boundary');
        console.log('[DebugTools]   3 - DISTANCE: Measure 2-point distance');
        console.log('[DebugTools]   4 - PATH: Create multi-point path');
        console.log('[DebugTools]   5 - AREA: Calculate polygon area');
        console.log('[DebugTools]   6 - BOX: Mark 2-point box (min/max)');
        console.log('[DebugTools]');
        console.log('[DebugTools] OBJECT TYPES (Shift + number):');
        console.log('[DebugTools]   Shift+1 - WALL');
        console.log('[DebugTools]   Shift+2 - WINDOW');
        console.log('[DebugTools]   Shift+3 - PLATFORM');
        console.log('[DebugTools]   Shift+4 - ENEMY');
        console.log('[DebugTools]   Shift+5 - WEAPON');
        console.log('[DebugTools]');
        console.log('[DebugTools] ACTIONS:');
        console.log('[DebugTools]   M - Mark point at crosshair');
        console.log('[DebugTools]   C - Clear all markers');
        console.log('[DebugTools]   U - Undo last point');
        console.log('[DebugTools]   H - Show this help');
        console.log('[DebugTools]   P - Print summary');
        console.log('='.repeat(50));
    }

    /**
     * Enable/disable debug tools
     */
    setActive(active: boolean): void {
        this.isActive = active;
        console.log(`[DebugTools] ${active ? 'Enabled' : 'Disabled'}`);
    }
}
