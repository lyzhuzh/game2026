/**
 * Asset Manager
 * Manages loading, caching, and accessing all game assets (models, textures, sounds)
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export interface AssetConfig {
    id: string;
    type: 'gltf' | 'glb' | 'fbx' | 'texture' | 'audio';
    url: string;
    preload?: boolean; // Preload on startup
}

export interface LoadedAsset {
    id: string;
    type: string;
    data: any;
    timestamp: number;
}

export class AssetManager {
    private static instance: AssetManager;
    private loadingManager: THREE.LoadingManager;
    private gltfLoader: GLTFLoader;
    private fbxLoader: FBXLoader;

    private assets: Map<string, LoadedAsset> = new Map();
    private loadingPromises: Map<string, Promise<any>> = new Map();

    private constructor() {
        // Create loading manager
        this.loadingManager = new THREE.LoadingManager();

        // Setup loaders
        this.gltfLoader = new GLTFLoader(this.loadingManager);
        this.fbxLoader = new FBXLoader(this.loadingManager);
    }

    static getInstance(): AssetManager {
        if (!AssetManager.instance) {
            AssetManager.instance = new AssetManager();
        }
        return AssetManager.instance;
    }

    /**
     * Initialize asset manager and preload critical assets
     */
    async initialize(configs: AssetConfig[]): Promise<void> {
        console.log('[AssetManager] Initializing...');

        const preloadConfigs = configs.filter(c => c.preload);
        const promises = preloadConfigs.map(config => this.loadAsset(config));

        await Promise.all(promises);
        console.log(`[AssetManager] Preloaded ${preloadConfigs.length} assets`);
    }

    /**
     * Load an asset from URL
     */
    async loadAsset(config: AssetConfig): Promise<any> {
        // Check if already loaded
        if (this.assets.has(config.id)) {
            return this.assets.get(config.id)!.data;
        }

        // Check if already loading
        if (this.loadingPromises.has(config.id)) {
            return this.loadingPromises.get(config.id);
        }

        // Load based on type
        const promise = this.loadByType(config);
        this.loadingPromises.set(config.id, promise);

        try {
            const data = await promise;

            // Store loaded asset
            this.assets.set(config.id, {
                id: config.id,
                type: config.type,
                data: data,
                timestamp: Date.now()
            });

            this.loadingPromises.delete(config.id);
            console.log(`[AssetManager] Loaded: ${config.id}`);
            return data;
        } catch (error) {
            this.loadingPromises.delete(config.id);
            console.error(`[AssetManager] Failed to load ${config.id}:`, error);
            throw error;
        }
    }

    /**
     * Load asset based on type
     */
    private loadByType(config: AssetConfig): Promise<any> {
        return new Promise((resolve, reject) => {
            switch (config.type) {
                case 'gltf':
                case 'glb':
                    this.gltfLoader.load(
                        config.url,
                        (gltf) => resolve(gltf),
                        undefined,
                        (error) => reject(error)
                    );
                    break;

                case 'fbx':
                    this.fbxLoader.load(
                        config.url,
                        (fbx) => resolve(fbx),
                        undefined,
                        (error) => reject(error)
                    );
                    break;

                case 'texture':
                    new THREE.TextureLoader(this.loadingManager).load(
                        config.url,
                        (texture) => resolve(texture),
                        undefined,
                        (error) => reject(error)
                    );
                    break;

                default:
                    reject(new Error(`Unknown asset type: ${config.type}`));
            }
        });
    }

    /**
     * Get loaded asset
     */
    getAsset(id: string): any {
        const asset = this.assets.get(id);
        if (!asset) {
            console.warn(`[AssetManager] Asset not found: ${id}`);
            return null;
        }
        return asset.data;
    }

    /**
     * Get GLTF scene
     */
    getGLTF(id: string): THREE.Group | null {
        const asset = this.getAsset(id);
        if (asset && asset.scene) {
            return asset.scene.clone();
        }
        return null;
    }

    /**
     * Get texture
     */
    getTexture(id: string): THREE.Texture {
        return this.getAsset(id);
    }

    /**
     * Check if asset is loaded
     */
    isLoaded(id: string): boolean {
        return this.assets.has(id);
    }

    /**
     * Unload asset (free memory)
     */
    unloadAsset(id: string): void {
        const asset = this.assets.get(id);
        if (!asset) return;

        // Dispose based on type
        if (asset.type === 'texture') {
            (asset.data as THREE.Texture).dispose();
        } else if (asset.type === 'gltf' || asset.type === 'glb') {
            asset.data.scenes.forEach((scene: THREE.Scene) => {
                scene.traverse((child: THREE.Object3D) => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry.dispose();
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
            });
        }

        this.assets.delete(id);
        console.log(`[AssetManager] Unloaded: ${id}`);
    }

    /**
     * Clear all assets
     */
    clear(): void {
        this.assets.forEach((_, id) => this.unloadAsset(id));
        this.assets.clear();
    }

    /**
     * Get asset count
     */
    getAssetCount(): number {
        return this.assets.size;
    }
}

export default AssetManager;
