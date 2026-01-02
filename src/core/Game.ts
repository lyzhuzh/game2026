import * as THREE from 'three';
import { GameLoop } from './GameLoop';
import { Time } from './Time';
import { GAME_CONFIG } from '../constants/GameConstants';
import { InputManager } from '../input/InputManager';
import { PlayerCamera } from '../player/PlayerCamera';
import { PlayerModel } from '../player/PlayerModel';
import { ViewMode } from '../player/ViewMode';
import { MovementController } from '../player/MovementController';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { PhysicsBodyFactory } from '../physics/PhysicsBody';
import { CharacterController } from '../physics/CharacterController';
import { WeaponManager } from '../weapons/WeaponManager';
import { EnemyManager } from '../enemies/EnemyManager';
import { Player } from '../player/Player';
import { UIManager } from '../ui/UIManager';
import { ItemManager } from '../items/ItemManager';
import { SoundManager } from '../audio/SoundManager';
import { ParticleSystem } from '../particles/ParticleSystem';
import { ProjectileManager } from '../weapons/ProjectileManager';
import { AssetManager } from '../assets/AssetManager';
import { GAME_ASSETS } from '../assets/AssetConfig';
import { WeaponRenderer } from '../weapons/WeaponRenderer';
import { LevelBuilder } from '../level/LevelBuilder';
import { DebugTools } from './DebugTools';
import { TimerManager } from '../utils/TimerManager';

/**
 * Main Game Class
 * Manages all game systems and coordinates updates
 */

export class Game {
    private static instance: Game;

    public readonly gameLoop: GameLoop;
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;

    // Player systems
    public readonly input: InputManager;
    public readonly playerCamera: PlayerCamera;
    public readonly movement: MovementController;
    public readonly player: Player;
    public readonly ui: UIManager;
    private playerModel?: PlayerModel;

    // Physics systems
    public readonly physics: PhysicsWorld;
    public readonly character: CharacterController;
    private physicsBodies: any[] = [];

    // Weapon system
    public readonly weapons: WeaponManager;

    // Projectile system
    public readonly projectiles: ProjectileManager;

    // Enemy system
    public readonly enemies: EnemyManager;

    // Item system
    public readonly items: ItemManager;

    // Audio system
    public readonly sound: SoundManager;

    // Particle system
    public readonly particles: ParticleSystem;

    // Asset system
    public readonly assetManager: AssetManager;

    // Weapon renderer (first-person view)
    private weaponRenderer: WeaponRenderer;

    // Level building system
    private levelBuilder: LevelBuilder;

    // Debug tools system
    private debugTools: DebugTools;

    // Timer management system
    private timerManager: TimerManager;

    private isInitialized: boolean = false;
    private isRunning: boolean = false;

    // Player position
    private playerPosition: THREE.Vector3;

    // Footstep audio
    private lastFootstepTime: number = 0;
    private footstepInterval: number = 0.45; // 步伐间隔（秒）

    // === DEBUG: Muzzle flash position ===
    // Arrow keys: forward/down offset, ,/.: nothing (reserved)
    private muzzleFlashForward: number = 0.81;
    private muzzleFlashDown: number = 0.08;
    private lastMuzzleDebugTime: number = 0;

    private constructor() {
        this.gameLoop = new GameLoop();

        // Initialize timer manager (should be first to track all timers)
        this.timerManager = new TimerManager();

        // Initialize input system
        this.input = InputManager.getInstance();

        // Initialize physics system
        this.physics = new PhysicsWorld({
            gravity: -9.82,
            broadphase: 'Naive',
            solverIterations: 10
        });

        // Initialize character controller
        this.character = new CharacterController(this.physics, {
            radius: GAME_CONFIG.PLAYER.RADIUS,
            height: GAME_CONFIG.PLAYER.HEIGHT,
            walkSpeed: GAME_CONFIG.PLAYER.WALK_SPEED,
            sprintSpeed: GAME_CONFIG.PLAYER.SPRINT_SPEED,
            jumpForce: GAME_CONFIG.PLAYER.JUMP_FORCE
        });

        // Set initial character position
        this.character.setPosition(new THREE.Vector3(0, GAME_CONFIG.PLAYER.HEIGHT, 5));

        // Initialize player system
        this.player = new Player();

        // Set player callbacks for sound effects
        this.player.setOnHurt(() => this.sound.play('player_hurt'));
        this.player.setOnDeath(() => this.sound.play('player_death'));
        this.player.setOnRespawn(() => {
            // 重置玩家位置到出生点
            this.respawnPlayer();
            this.sound.play('player_respawn');
        });

        // Initialize UI system
        this.ui = new UIManager(this.timerManager);

        // Initialize sound system
        this.sound = SoundManager.getInstance();

        // Initialize player systems
        this.playerCamera = new PlayerCamera({
            fov: GAME_CONFIG.CAMERA.FOV,
            near: GAME_CONFIG.CAMERA.NEAR_PLANE,
            far: GAME_CONFIG.CAMERA.FAR_PLANE,
            sensitivity: GAME_CONFIG.PLAYER.MOUSE_SENSITIVITY,
            viewMode: ViewMode.FIRST_PERSON,
            thirdPersonConfig: {
                distance: 8.0,     // Increased distance to see full body
                height: 3.0,       // Increased height for better overhead angle
                pitch: 0.2,
                smoothSpeed: 8.0,
                collisionRadius: 0.3,
                minDistance: 2.0   // Increased min distance
            },
            physics: this.physics
        });
        this.movement = new MovementController();
        this.playerPosition = new THREE.Vector3(0, GAME_CONFIG.PLAYER.HEIGHT, 5);

        // Create basic Three.js objects
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
        this.scene.fog = new THREE.Fog(0x87ceeb, 10, 500);

        // Initialize player model (after scene is created)
        this.playerModel = new PlayerModel(this.scene, {
            modelId: 'player_character',
            scale: 1.0,  // Scale is auto-calculated in loadModel()
            visibleInFirstPerson: true, // Will use clipping to show only arms
            shadowEnabled: true
        });

        // Initialize particle system (requires scene)
        this.particles = new ParticleSystem(this.scene);

        // Initialize projectile system (requires scene, physics, particles)
        this.projectiles = new ProjectileManager(this.scene, this.physics, this.particles);

        // Connect projectile explosions to enemy damage
        this.projectiles.setOnExplosionDamage((position, radius, damage) => {
            this.onProjectileExplosion(position, radius, damage);
        });

        // Use the player camera
        this.camera = this.playerCamera.camera;
        this.camera.position.copy(this.playerPosition);

        // Initialize asset system (singleton)
        this.assetManager = AssetManager.getInstance();

        // Initialize weapon renderer (attaches weapon models to camera)
        this.weaponRenderer = new WeaponRenderer(this.scene, this.playerCamera.camera);

        // Set initial view mode to hide third-person weapon (prevent duplicate rendering)
        // Note: showWeapon will be called by WeaponManager.onSwitch callback, don't call it here
        this.weaponRenderer.setViewMode(ViewMode.FIRST_PERSON);

        // Initialize level builder
        this.levelBuilder = new LevelBuilder(this.scene, this.physics);

        // Initialize debug tools
        this.debugTools = new DebugTools(this.scene, this.camera);

        // Create renderer
        const canvas = document.createElement('canvas');
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.localClippingEnabled = true; // Enable clipping for first-person arms

        // Add canvas to DOM
        const container = document.getElementById('game-container');
        if (container) {
            container.insertBefore(canvas, container.firstChild);
        }

        // Initialize enemy system first (needed by weapon onHit callback)
        this.enemies = new EnemyManager(this.physics, this.scene, this.timerManager);

        // Set enemy death callback to update player score and kills
        this.enemies.setOnEnemyDeath((enemy) => {
            this.player.addScore(enemy.stats.scoreValue);
            this.player.registerKill();
            this.sound.play('enemy_death');
        });

        // Set enemy attack callback to damage player
        this.enemies.setOnEnemyAttack((damage) => {
            this.player.takeDamage(damage);
            this.ui.showDamageIndicator();
        });

        // Set enemy hurt callback
        this.enemies.setOnEnemyHurt(() => {
            this.sound.play('enemy_hurt');
        });

        // Initialize item system
        this.items = new ItemManager(this.scene);

        // Set item pickup callback
        this.items.setOnPickup((result) => {
            console.log(`[Game] Picked up ${result.itemName}`);

            // Play pickup sound
            this.sound.play('item_pickup');

            // Apply health restore
            if (result.healthRestore) {
                this.player.heal(result.healthRestore);
            }

            // Apply armor restore
            if (result.armorRestore) {
                this.player.addArmor(result.armorRestore);
            }

            // Add ammo
            if (result.ammoAmount && result.weaponType) {
                this.weapons.addReserveAmmo(result.weaponType, result.ammoAmount);
            }

            // Show pickup notification
            this.ui.showPickupNotification(result.itemName);
        });

        // Initialize weapon system (must be after scene is created)
        this.weapons = new WeaponManager(this.physics, this.scene, {
            startingWeapon: 'pistol',
            autoReload: true,
            onHit: (position, damage) => this.onWeaponHit(position, damage),
            onFire: (weaponType) => this.onWeaponFire(weaponType),
            onReload: () => this.sound.play('reload_start'),
            onSwitch: (weaponType) => this.onWeaponSwitch(weaponType),
            projectileManager: this.projectiles,
            particleSystem: this.particles,
            onFlamethrowerDamage: (origin, direction, range, damage) => this.onFlamethrowerDamage(origin, direction, range, damage)
        });

        this.setupEventListeners();
    }

    /**
     * Get the singleton game instance
     */
    static getInstance(): Game {
        if (!Game.instance) {
            Game.instance = new Game();
        }
        return Game.instance;
    }

    /**
     * Get the timer manager instance
     * Use this to create managed timers that will be automatically cleaned up
     */
    getTimerManager(): TimerManager {
        return this.timerManager;
    }

    /**
     * Initialize the game
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            console.warn('Game is already initialized');
            return;
        }

        console.log('Initializing game...');

        // Initialize asset manager and preload critical assets
        console.log('[Game] Loading assets...');
        await this.assetManager.initialize(GAME_ASSETS);

        // Load player model
        console.log('[Game] playerModel exists?', !!this.playerModel);
        console.log('[Game] Loading player model...');
        if (this.playerModel) {
            await this.playerModel.loadModel();
            // Set initial visibility based on current view mode
            const initialViewMode = this.playerCamera.getViewMode();
            this.playerModel.setVisible(true, initialViewMode);
            console.log('[Game] Player model loaded, initial view mode:', initialViewMode);
        } else {
            console.error('[Game] playerModel is undefined! Cannot load model.');
        }

        // Set weapon attachment point for third-person view
        const attachmentPoint = this.playerModel!.getWeaponAttachmentPoint();
        this.weaponRenderer.setPlayerWeaponAttachmentPoint(attachmentPoint);

        // Initialize level builder and preload environment assets
        console.log('[Game] Initializing level builder...');
        await this.levelBuilder.initialize();



        // Initialize time system
        Time.initialize();

        // Initialize UI with camera (needed for damage numbers)
        this.ui.initialize(this.camera);

        // Set camera for particle billboarding
        this.particles.setCamera(this.camera);

        // Generate procedural level
        console.log('[Game] Generating level...');
        await this.levelBuilder.generateLevel();

        // Add lights
        this.setupLights();

        // Set initial player position for enemy spawning
        this.enemies.setPlayerPosition(this.playerPosition);

        // Start first wave
        this.enemies.startWave(1);

        // Spawn initial items
        this.items.spawnRandomItems(10, new THREE.Vector3(0, 1, 0), 40);

        // Initialize debug tools (after level generation so we have objects to measure)
        console.log('[Game] Initializing debug tools...');
        this.debugTools.initialize();

        // Setup animation debug keyboard listener (F10 to toggle, then 1-9, +/-, P, [/] for controls)
        this.setupAnimationDebugListener();

        // Register game loop callbacks
        this.gameLoop.onFixedUpdate((deltaTime) => this.onFixedUpdate(deltaTime));
        this.gameLoop.onUpdate((deltaTime) => this.onUpdate(deltaTime));
        this.gameLoop.onRender(() => this.onRender());

        this.isInitialized = true;
        console.log('Game initialized successfully');
    }

    /**
     * Setup third-person camera calibration debug
     * DISABLED per user request
     */
    private setupAnimationDebugListener(): void {
        console.log('[Game] Animation debug listener disabled.');
        // Debug features disabled
    }

    /**
     * Start the game
     */
    start(): void {
        if (!this.isInitialized) {
            console.error('Cannot start game: not initialized');
            return;
        }

        if (this.isRunning) {
            console.warn('Game is already running');
            return;
        }

        console.log('Starting game...');
        this.isRunning = true;
        this.gameLoop.start();

        // Hide loading screen
        this.hideLoadingScreen();
    }

    /**
     * Stop the game
     */
    stop(): void {
        if (!this.isRunning) return;

        console.log('Stopping game...');
        this.isRunning = false;
        this.gameLoop.stop();
    }

    /**
     * Setup scene lighting
     */
    private setupLights(): void {
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Add directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        this.scene.add(directionalLight);

        // Create physics ground
        const groundBody = PhysicsBodyFactory.createGround(this.physics, 'ground');
        this.physicsBodies.push(groundBody);
    }

    /**
     * Fixed update callback (for physics)
     */
    private onFixedUpdate(deltaTime: number): void {
        // Step physics simulation
        this.physics.step(deltaTime);

        // Sync physics bodies with visual meshes
        for (const body of this.physicsBodies) {
            body.update();
        }
    }

    /**
     * Variable update callback (for game logic)
     */
    private onUpdate(deltaTime: number): void {
        // Update time system
        Time.update();

        // Update player
        this.player.update(deltaTime);

        // Update player camera (mouse look) - must consume mouse delta BEFORE input.update() clears it
        this.playerCamera.update(deltaTime);

        // Get input for character controller
        let movementInput = this.input.getMovementInput();

        // Get action inputs
        let jumpRequested = this.input.isActionJustPressed('jump');
        let sprintRequested = this.input.isActionPressed('sprint');
        let crouchRequested = this.input.isActionPressed('crouch');

        // BLOCK PLAYER MOVEMENT when in Free Debug Camera mode
        if (this.playerCamera.isDebugCameraEnabled()) {
            movementInput = { x: 0, y: 0 };
            jumpRequested = false;
            sprintRequested = false;
            crouchRequested = false;
        }

        const moveDirection = new THREE.Vector3(movementInput.x, 0, movementInput.y);

        // Transform movement direction by camera direction
        const forward = this.playerCamera.getFlatForward();
        const right = this.playerCamera.getFlatRight();
        const worldMoveDir = new THREE.Vector3();
        worldMoveDir.addScaledVector(forward, moveDirection.z);
        worldMoveDir.addScaledVector(right, moveDirection.x);

        // Update character controller with physics
        this.character.update(
            deltaTime,
            worldMoveDir,
            jumpRequested,
            sprintRequested,
            crouchRequested
        );

        // Update camera position to follow character eyes (ONLY if NOT in debug camera mode)
        // In debug mode, camera moves independently
        if (!this.playerCamera.isDebugCameraEnabled()) {
            const eyePos = this.character.getEyePosition();
            this.playerPosition.copy(eyePos);
            this.playerCamera.setPosition(this.playerPosition);
        }

        // 检测玩家移动并播放脚步声
        this.updatePlayerFootsteps(deltaTime, movementInput.x !== 0 || movementInput.y !== 0);

        // Update player model (sync position/rotation with camera)
        if (this.playerModel) {
            const cameraRotation = this.playerCamera.getRotation();
            // Physics body position is at center, convert to feet position for model
            const bodyPos = this.character.getPosition();
            const feetPos = new THREE.Vector3(bodyPos.x, bodyPos.y - this.character.getCurrentHeight() / 2, bodyPos.z);

            // Calculate movement state for animation
            const isMoving = movementInput.x !== 0 || movementInput.y !== 0;
            const isGrounded = this.character.getIsGrounded();
            let moveState: 'idle' | 'walk' | 'run' | 'jump' = 'idle';

            if (!isGrounded) {
                moveState = 'jump';
            } else if (isMoving) {
                moveState = sprintRequested ? 'run' : 'walk';
            }

            // Calculate rotation based on view mode
            let modelRotation = { yaw: cameraRotation.yaw };

            // In third-person, player model should face movement direction (away from camera)
            if (this.playerCamera.getViewMode() === ViewMode.THIRD_PERSON && isMoving) {
                // Calculate movement direction in world space
                // W=forward(0,1), A=left(-1,0), S=back(0,-1), D=right(1,0)
                const moveAngle = Math.atan2(movementInput.x, movementInput.y);

                // Model rotation = camera direction + movement offset
                modelRotation.yaw = cameraRotation.yaw + moveAngle;
            }
            // When not moving, keep camera yaw (face away from camera by default)

            this.playerModel.update(deltaTime, feetPos, modelRotation, moveState);

            // Update weapon renderer with player position for third-person weapon following
            this.weaponRenderer.setPlayerTransform(feetPos, cameraRotation.yaw);
        }

        // Handle view mode toggle (Tab key)
        if (this.input.isActionJustPressed('toggle_view')) {
            const oldMode = this.playerCamera.getViewMode();
            this.toggleViewMode();
            const newMode = this.playerCamera.getViewMode();

            // Debug log
            const modelPos = this.playerModel ? new THREE.Vector3() : new THREE.Vector3();
            if (this.playerModel) {
                // Get model group position
                const groupPos = this.character.getPosition();
                const feetPos = new THREE.Vector3(groupPos.x, groupPos.y - this.character.getCurrentHeight() / 2, groupPos.z);
                modelPos.copy(feetPos);
            }

            console.log(`[View Toggle] ${oldMode} -> ${newMode}`);
            console.log(`[View Toggle] Model position: (${modelPos.x.toFixed(2)}, ${modelPos.y.toFixed(2)}, ${modelPos.z.toFixed(2)})`);
            console.log(`[View Toggle] Camera position: (${this.camera.position.x.toFixed(2)}, ${this.camera.position.y.toFixed(2)}, ${this.camera.position.z.toFixed(2)})`);
        }

        // Update enemy system
        this.enemies.setPlayerPosition(this.playerPosition);
        this.enemies.update(deltaTime);

        // Update item system
        this.items.setPlayerPosition(this.playerPosition);
        this.items.update(deltaTime);

        // Update weapon system (must be BEFORE input.update() to detect just-pressed keys)
        this.weapons.update(deltaTime);

        // Update sniper scope zoom
        this.updateSniperScope();

        // Update projectile system
        this.projectiles.update(deltaTime);

        // Update particle system
        this.particles.update(deltaTime);

        // Pass fire data to weapon manager (camera origin and forward direction)
        const fireOrigin = this.playerCamera.getPosition();
        const fireDirection = this.playerCamera.getForward();
        this.weapons.setFireData(fireOrigin, fireDirection);

        // Update weapon renderer (sway, recoil)
        const weaponState = this.weapons.getCurrentWeaponState();
        const isFiring = this.input.isActionPressed('attack') && (weaponState?.state?.currentAmmo ?? 0) > 0;
        this.weaponRenderer.update(deltaTime, movementInput, isFiring);

        // Update input system (clears per-frame states AFTER consuming)
        this.input.update();

        // Update HUD
        const playerState = this.player.getState();
        const waveNumber = this.enemies.getWaveNumber();
        const enemyCount = this.enemies.getLivingEnemyCount();
        this.ui.update(playerState, waveNumber, enemyCount);
        this.updateWeaponHUD();
    }

    /**
     * Render callback
     * Uses dual render pass for weapon layer separation:
     * 1. Main scene - renders environment and characters
     * 2. Weapon scene - renders first-person weapon (always on top, never clips through walls)
     */
    private onRender(): void {
        // === STEP 1: Render main scene ===
        this.renderer.autoClear = true;
        this.renderer.render(this.scene, this.camera);

        // === STEP 2: Render weapon scene (always on top) ===
        // Only in first-person mode and if weapon renderer exists
        if (this.weaponRenderer && this.playerCamera.getViewMode() === ViewMode.FIRST_PERSON) {
            // Sync weapon camera with main camera
            this.weaponRenderer.syncWeaponCamera();

            // Clear depth buffer but keep color buffer
            // This makes weapon render on top of everything
            this.renderer.autoClear = false;
            this.renderer.clearDepth();

            // Render weapon scene
            this.renderer.render(
                this.weaponRenderer.getWeaponScene(),
                this.weaponRenderer.getWeaponCamera()
            );

            // Reset autoClear for next frame
            this.renderer.autoClear = true;
        }
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        // Window resize
        window.addEventListener('resize', this.onWindowResize);

        // Pointer lock
        const clickToStart = document.getElementById('click-to-start');
        if (clickToStart) {
            clickToStart.addEventListener('click', this.requestPointerLock);
        }

        // Pointer lock change
        document.addEventListener('pointerlockchange', this.onPointerLockChange);

        // Pointer lock error
        document.addEventListener('pointerlockerror', () => {
            console.error('[PointerLock] Error - Unable to lock pointer');
        });
    }

    /**
     * Handle window resize
     */
    private onWindowResize = (): void => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.playerCamera.onWindowResize(width, height);
        this.renderer.setSize(width, height);
    };

    /**
     * Request pointer lock
     */
    private requestPointerLock = (): void => {
        console.log('[PointerLock] Requesting...');
        // Initialize audio system on first user interaction
        this.sound.initialize();
        document.body.requestPointerLock();
    };

    /**
     * Handle pointer lock change
     */
    private onPointerLockChange = (): void => {
        const isLocked = document.pointerLockElement === document.body;

        const clickToStart = document.getElementById('click-to-start');
        if (isLocked) {
            clickToStart?.classList.add('hidden');
        } else {
            clickToStart?.classList.remove('hidden');
        }
    };

    /**
     * Hide loading screen
     */
    private hideLoadingScreen(): void {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
    }

    /**
     * Respawn player at spawn point
     */
    private respawnPlayer(): void {
        // 重置角色控制器位置到出生点（与初始化位置一致）
        const spawnPos = new THREE.Vector3(0, GAME_CONFIG.PLAYER.HEIGHT, 5);
        this.character.setPosition(spawnPos);

        // 重置相机朝向（面向 Z 轴负方向，yaw=0, pitch=0）
        this.playerCamera.setRotation(0, 0);

        // 更新玩家位置变量
        this.playerPosition.copy(this.character.getEyePosition());
        this.playerCamera.setPosition(this.playerPosition);

        console.log('[Game] Player respawned at spawn point');
    }

    /**
     * Update loading progress
     */
    updateLoadingProgress(progress: number, status: string): void {
        const loadingBar = document.getElementById('loading-bar');
        const loadingStatus = document.getElementById('loading-status');

        if (loadingBar) {
            loadingBar.style.width = `${progress * 100}%`;
        }
        if (loadingStatus) {
            loadingStatus.textContent = status;
        }
    }

    /**
     * Update player footsteps
     */
    private updatePlayerFootsteps(deltaTime: number, isMoving: boolean): void {
        if (!isMoving || !this.character.getIsGrounded()) {
            return;
        }

        this.lastFootstepTime += deltaTime;

        // 根据移动速度调整步伐间隔
        let interval = this.footstepInterval;
        if (this.character.getIsSprinting()) {
            interval = 0.3; // 跑步时步伐更快
        } else if (this.character.getIsCrouching()) {
            interval = 0.6; // 蹲伏时步伐更慢
        }

        if (this.lastFootstepTime >= interval) {
            this.sound.play('player_footstep');
            this.lastFootstepTime = 0;
        }
    }

    /**
     * Update weapon scope/zoom (sniper 6x, rifle 2x)
     */
    private updateSniperScope(): void {
        const weaponState = this.weapons.getCurrentWeaponState();
        const isAiming = this.input.isActionPressed('aim');

        if (!weaponState) {
            this.playerCamera.resetZoom();
            this.ui.hideSniperScope();
            return;
        }

        // Sniper: 6x zoom with scope overlay
        if (weaponState.type === 'sniper') {
            if (isAiming) {
                this.playerCamera.setZoom(6);
                this.ui.showSniperScope();
                this.weaponRenderer.setWeaponVisible(false);
            } else {
                this.playerCamera.resetZoom();
                this.ui.hideSniperScope();
                this.weaponRenderer.setWeaponVisible(true);
            }
        }
        // Rifle: 2x zoom (no scope overlay, weapon still visible)
        else if (weaponState.type === 'rifle') {
            if (isAiming) {
                this.playerCamera.setZoom(2);
            } else {
                this.playerCamera.resetZoom();
            }
        }
        // Other weapons: no zoom
        else {
            this.playerCamera.resetZoom();
            this.ui.hideSniperScope();
            this.weaponRenderer.setWeaponVisible(true);
        }
    }

    /**
     * Toggle view mode (first-person <-> third-person)
     */
    private toggleViewMode(): void {
        const currentMode = this.playerCamera.getViewMode();
        const newMode = currentMode === ViewMode.FIRST_PERSON
            ? ViewMode.THIRD_PERSON
            : ViewMode.FIRST_PERSON;

        this.playerCamera.setViewMode(newMode);
        this.weaponRenderer.setViewMode(newMode);

        if (this.playerModel) {
            const viewMode = this.playerCamera.getViewMode();
            this.playerModel.setVisible(true, viewMode);
        }

        // Play sound effect
        this.sound.play('weapon_switch');

        console.log(`[Game] View mode: ${newMode}`);
    }

    /**
     * Update weapon HUD
     */
    private updateWeaponHUD(): void {
        const weaponState = this.weapons.getCurrentWeaponState();
        if (!weaponState) {
            return;
        }

        const { type, state, stats } = weaponState;
        this.ui.updateWeapon(type, state.currentAmmo, stats.magazineSize, state.reserveAmmo);
    }

    /**
     * Handle weapon fire (play sound + particle muzzle flash)
     */
    private onWeaponFire(weaponType: string): void {
        // Play weapon-specific sound
        switch (weaponType) {
            case 'pistol':
                this.sound.play('pistol_shot');
                break;
            case 'rifle':
                this.sound.play('rifle_shot');
                break;
            case 'shotgun':
                this.sound.play('shotgun_shot');
                break;
            case 'smg':
                this.sound.play('smg_shot');
                break;
            case 'sniper':
                this.sound.play('sniper_shot');
                break;
            default:
                this.sound.play('pistol_shot');
        }

        // Add subtle particle muzzle flash
        const fireOrigin = this.playerPosition.clone();
        const fireDirection = this.playerCamera.getForward();

        // Get camera local vectors for proper positioning
        // cameraRight points to the right, cameraDown is perpendicular to both forward and right
        const cameraRight = this.playerCamera.getRight();
        // Calculate camera's local down vector: cross(forward, right) gives up, so we negate
        const cameraDown = new THREE.Vector3().crossVectors(fireDirection, cameraRight).normalize();

        // === DEBUG: Muzzle flash position adjustment (DISABLED) ===
        // this.handleMuzzleFlashDebug();

        // Position muzzle flash in front of camera, below crosshair (follows camera pitch)
        fireOrigin.addScaledVector(fireDirection, this.muzzleFlashForward);
        fireOrigin.addScaledVector(cameraDown, this.muzzleFlashDown);

        this.particles.muzzleFlash(fireOrigin, fireDirection, weaponType);
    }

    /**
     * DEBUG: Handle muzzle flash position adjustment via keyboard
     * Arrow Up/Down: adjust forward distance
     * Arrow Left/Right: adjust down distance
     * Press to log current values
     */
    private _handleMuzzleFlashDebug(): void {
        const debugKeys = (window as any).__debugKeys;
        if (!debugKeys) return;

        const step = 0.01;
        const now = Date.now();
        if (now - this.lastMuzzleDebugTime < 100) return;

        // Up/Down = forward distance
        if (debugKeys.ArrowUp) {
            this.muzzleFlashForward += step;
            this.lastMuzzleDebugTime = now;
            this.logMuzzleFlashPosition();
        }
        if (debugKeys.ArrowDown) {
            this.muzzleFlashForward = Math.max(0.1, this.muzzleFlashForward - step);
            this.lastMuzzleDebugTime = now;
            this.logMuzzleFlashPosition();
        }
        // Left/Right = down distance
        if (debugKeys.ArrowRight) {
            this.muzzleFlashDown += step;
            this.lastMuzzleDebugTime = now;
            this.logMuzzleFlashPosition();
        }
        if (debugKeys.ArrowLeft) {
            this.muzzleFlashDown -= step;
            this.lastMuzzleDebugTime = now;
            this.logMuzzleFlashPosition();
        }
    }

    private logMuzzleFlashPosition(): void {
        console.log(`[MuzzleFlash] Forward: ${this.muzzleFlashForward.toFixed(3)}, Down: ${this.muzzleFlashDown.toFixed(3)}`);
    }


    /**
     * Handle weapon hit (damage number + particles)
     */
    private onWeaponHit(position: THREE.Vector3, damage: number): void {
        // Damage enemy at position (returns true if hit)
        const hit = this.enemies.damageEnemyAtPosition(position, damage);

        if (hit) {
            // Show damage number
            this.ui.showDamageNumber(damage, position, false);

            // Add blood splatter effect
            this.particles.bloodSplatter(position, new THREE.Vector3(0, 1, 0));
        } else {
            // Missed - add spark/bullet hole effect
            this.particles.bulletHole(position, new THREE.Vector3(0, 1, 0));
            this.particles.spark(position, new THREE.Vector3(0, 1, 0));
        }
    }

    /**
     * Handle projectile explosion (area damage)
     */
    private onProjectileExplosion(position: THREE.Vector3, radius: number, damage: number): void {
        // Apply damage to all enemies in radius
        this.enemies.damageEnemiesInRadius(position, radius, damage);

        // Show explosion damage number at center
        this.ui.showDamageNumber(damage, position, false);
    }

    /**
     * Handle flamethrower damage (cone damage)
     */
    private onFlamethrowerDamage(origin: THREE.Vector3, direction: THREE.Vector3, range: number, damage: number): void {
        // Apply damage to all enemies in cone
        this.enemies.damageEnemiesInCone(origin, direction, range, damage);
    }

    /**
     * Handle weapon switch (show weapon model)
     */
    private onWeaponSwitch(weaponType: string): void {
        // Play switch sound
        this.sound.play('weapon_switch');

        // Show weapon model in first-person view
        this.weaponRenderer.showWeapon(weaponType as any);
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.stop();
        this.gameLoop.clearCallbacks();

        // Clear all timers first to prevent callbacks after disposal
        this.timerManager.dispose();

        // Dispose particles
        this.particles.dispose();
        this.projectiles.clear();
        this.ui.dispose();
        this.weaponRenderer.dispose();
        this.levelBuilder.dispose();
        this.assetManager.clear();

        // Dispose physics
        this.character.dispose();
        this.physics.dispose();
        this.physicsBodies = [];

        // Dispose Three.js resources
        this.renderer.dispose();
        this.scene.clear();

        window.removeEventListener('resize', this.onWindowResize);
    }
}
