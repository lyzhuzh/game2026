import * as THREE from 'three';
import { GameLoop } from './GameLoop';
import { Time } from './Time';
import { GAME_CONFIG } from '../constants/GameConstants';
import { InputManager } from '../input/InputManager';
import { FirstPersonCamera } from '../player/FirstPersonCamera';
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
    public readonly fpsCamera: FirstPersonCamera;
    public readonly movement: MovementController;
    public readonly player: Player;
    public readonly ui: UIManager;

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

    private isInitialized: boolean = false;
    private isRunning: boolean = false;

    // Player position
    private playerPosition: THREE.Vector3;

    private constructor() {
        this.gameLoop = new GameLoop();

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
        this.player.setOnRespawn(() => this.sound.play('player_respawn'));

        // Initialize UI system
        this.ui = new UIManager();

        // Initialize sound system
        this.sound = SoundManager.getInstance();

        // Initialize player systems
        this.fpsCamera = new FirstPersonCamera();
        this.movement = new MovementController();
        this.playerPosition = new THREE.Vector3(0, GAME_CONFIG.PLAYER.HEIGHT, 5);

        // Create basic Three.js objects
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
        this.scene.fog = new THREE.Fog(0x87ceeb, 10, 500);

        // Initialize particle system (requires scene)
        this.particles = new ParticleSystem(this.scene);

        // Initialize projectile system (requires scene, physics, particles)
        this.projectiles = new ProjectileManager(this.scene, this.physics, this.particles);

        // Connect projectile explosions to enemy damage
        this.projectiles.setOnExplosionDamage((position, radius, damage) => {
            this.onProjectileExplosion(position, radius, damage);
        });

        // Use the FPS camera
        this.camera = this.fpsCamera.camera;
        this.camera.position.copy(this.playerPosition);

        // Initialize asset system (singleton)
        this.assetManager = AssetManager.getInstance();

        // Initialize weapon renderer (attaches weapon models to camera)
        this.weaponRenderer = new WeaponRenderer(this.scene, this.fpsCamera.camera);

        // Show initial weapon
        this.weaponRenderer.showWeapon('pistol');

        // Initialize level builder
        this.levelBuilder = new LevelBuilder(this.scene);

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

        // Add canvas to DOM
        const container = document.getElementById('game-container');
        if (container) {
            container.insertBefore(canvas, container.firstChild);
        }

        // Initialize enemy system first (needed by weapon onHit callback)
        this.enemies = new EnemyManager(this.physics, this.scene);

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
            onFire: (_weaponType) => this.onWeaponFire(),
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

        // Start first wave of enemies
        this.enemies.startWave(1);

        // Spawn initial items
        this.items.spawnRandomItems(10, new THREE.Vector3(0, 1, 0), 40);

        // Initialize debug tools (after level generation so we have objects to measure)
        console.log('[Game] Initializing debug tools...');
        this.debugTools.initialize();

        // Register game loop callbacks
        this.gameLoop.onFixedUpdate((deltaTime) => this.onFixedUpdate(deltaTime));
        this.gameLoop.onUpdate((deltaTime) => this.onUpdate(deltaTime));
        this.gameLoop.onRender(() => this.onRender());

        this.isInitialized = true;
        console.log('Game initialized successfully');
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

        // Update FPS camera (mouse look) - must consume mouse delta BEFORE input.update() clears it
        this.fpsCamera.update(deltaTime);

        // Get input for character controller
        const movementInput = this.input.getMovementInput();
        const moveDirection = new THREE.Vector3(movementInput.x, 0, movementInput.y);

        // Transform movement direction by camera direction
        const forward = this.fpsCamera.getFlatForward();
        const right = this.fpsCamera.getFlatRight();
        const worldMoveDir = new THREE.Vector3();
        worldMoveDir.addScaledVector(forward, moveDirection.z);
        worldMoveDir.addScaledVector(right, moveDirection.x);

        // Get action inputs
        const jumpRequested = this.input.isActionJustPressed('jump');
        const sprintRequested = this.input.isActionPressed('sprint');
        const crouchRequested = this.input.isActionPressed('crouch');

        // Update character controller with physics
        this.character.update(
            deltaTime,
            worldMoveDir,
            jumpRequested,
            sprintRequested,
            crouchRequested
        );

        // Update camera position to follow character eyes
        const eyePos = this.character.getEyePosition();
        this.playerPosition.copy(eyePos);
        this.fpsCamera.setPosition(this.playerPosition);

        // Update enemy system
        this.enemies.setPlayerPosition(this.playerPosition);
        this.enemies.update(deltaTime);

        // Update item system
        this.items.setPlayerPosition(this.playerPosition);
        this.items.update(deltaTime);

        // Update weapon system (must be BEFORE input.update() to detect just-pressed keys)
        this.weapons.update(deltaTime);

        // Update projectile system
        this.projectiles.update(deltaTime);

        // Update particle system
        this.particles.update(deltaTime);

        // Pass fire data to weapon manager (camera origin and forward direction)
        const fireOrigin = this.playerPosition.clone();
        const fireDirection = this.fpsCamera.getForward();
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
        this.ui.update(playerState, waveNumber);
        this.updateWeaponHUD();
    }

    /**
     * Render callback
     */
    private onRender(): void {
        this.renderer.render(this.scene, this.camera);
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

        this.fpsCamera.onWindowResize(width, height);
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
        console.log('[PointerLock] State:', isLocked ? 'LOCKED' : 'UNLOCKED');

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
    private onWeaponFire(): void {
        // Play weapon sound
        this.sound.play('pistol_shot');

        // Add subtle particle muzzle flash
        const fireOrigin = this.playerPosition.clone();
        const fireDirection = this.fpsCamera.getForward();

        // Position muzzle flash in front of camera (simulating gun position)
        fireOrigin.addScaledVector(fireDirection, 0.8);
        fireOrigin.y -= 0.12;

        this.particles.muzzleFlash(fireOrigin, fireDirection);
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
        window.removeEventListener('resize', this.onWindowResize);
    }
}
