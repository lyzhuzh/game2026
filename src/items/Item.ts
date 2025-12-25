/**
 * Item Base Class
 * Represents a pickable item in the game world
 */

import * as THREE from 'three';
import { ItemType, ItemStats, ITEM_CONFIGS } from './ItemConfig';

export class Item {
    public readonly type: ItemType;
    public readonly stats: ItemStats;
    public readonly mesh: THREE.Mesh;

    private position: THREE.Vector3;
    private isPickedUp: boolean = false;
    private respawnTime: number = 0;
    private timeSincePickup: number = 0;

    // Animation
    private initialY: number;
    private elapsedTime: number = 0;

    constructor(type: ItemType, position: THREE.Vector3) {
        this.type = type;
        this.stats = { ...ITEM_CONFIGS[type] };
        this.position = position.clone();
        this.initialY = position.y;

        // Create visual mesh based on item type
        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
    }

    /**
     * Create visual mesh based on item type
     */
    private createMesh(): THREE.Mesh {
        let geometry: THREE.BufferGeometry;
        let material: THREE.Material;

        // Different shapes for different item types
        if (this.type.startsWith('health_')) {
            // Cross shape for health
            geometry = new THREE.BoxGeometry(this.stats.size, this.stats.size * 0.3, this.stats.size * 0.3);
            // Add horizontal bar
            const group = new THREE.Group();

            const verticalBar = new THREE.Mesh(
                new THREE.BoxGeometry(this.stats.size, this.stats.size * 0.3, this.stats.size * 0.3),
                new THREE.MeshStandardMaterial({
                    color: this.stats.color,
                    emissive: this.stats.glowColor || 0x000000,
                    emissiveIntensity: 0.5,
                    roughness: 0.3,
                    metalness: 0.7
                })
            );

            const horizontalBar = new THREE.Mesh(
                new THREE.BoxGeometry(this.stats.size * 0.3, this.stats.size * 0.3, this.stats.size),
                new THREE.MeshStandardMaterial({
                    color: this.stats.color,
                    emissive: this.stats.glowColor || 0x000000,
                    emissiveIntensity: 0.5,
                    roughness: 0.3,
                    metalness: 0.7
                })
            );

            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(this.stats.size, this.stats.size * 0.3, this.stats.size),
                new THREE.MeshStandardMaterial({
                    color: this.stats.color,
                    emissive: this.stats.glowColor || 0x000000,
                    emissiveIntensity: 0.5,
                    roughness: 0.3,
                    metalness: 0.7
                })
            );
            mesh.castShadow = true;
            return mesh;
        } else if (this.type.startsWith('armor_')) {
            // Shield shape for armor
            geometry = new THREE.CylinderGeometry(this.stats.size * 0.6, this.stats.size * 0.6, this.stats.size * 0.3, 16);
            material = new THREE.MeshStandardMaterial({
                color: this.stats.color,
                emissive: this.stats.glowColor || 0x000000,
                emissiveIntensity: 0.5,
                roughness: 0.3,
                metalness: 0.8
            });
        } else {
            // Box for ammo
            geometry = new THREE.BoxGeometry(this.stats.size, this.stats.size, this.stats.size);
            material = new THREE.MeshStandardMaterial({
                color: this.stats.color,
                roughness: 0.4,
                metalness: 0.6
            });
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Add point light for glowing effect
        if (this.stats.glowColor) {
            const light = new THREE.PointLight(this.stats.glowColor, 0.5, 3);
            mesh.add(light);
        }

        return mesh;
    }

    /**
     * Update item animation and respawn
     */
    update(deltaTime: number): void {
        if (this.isPickedUp) {
            // Handle respawn
            this.timeSincePickup += deltaTime;
            if (this.timeSincePickup >= this.respawnTime) {
                this.respawn();
            }
            return;
        }

        // Update animation
        this.elapsedTime += deltaTime;

        // Rotate
        this.mesh.rotation.y += this.stats.rotateSpeed * deltaTime;

        // Bob up and down
        const bobOffset = Math.sin(this.elapsedTime * this.stats.bobSpeed * Math.PI * 2) * this.stats.bobAmount;
        this.mesh.position.y = this.initialY + bobOffset;
    }

    /**
     * Check if player can pick up this item
     */
    canPickup(playerPosition: THREE.Vector3, pickUpRange: number = 2): boolean {
        if (this.isPickedUp) return false;

        const distance = this.mesh.position.distanceTo(playerPosition);
        return distance <= pickUpRange;
    }

    /**
     * Pick up the item
     */
    pickup(): boolean {
        if (this.isPickedUp) return false;

        this.isPickedUp = true;
        this.mesh.visible = false;
        this.respawnTime = this.stats.respawnTime;
        this.timeSincePickup = 0;

        console.log(`[Item] Picked up ${this.stats.name}`);
        return true;
    }

    /**
     * Respawn the item
     */
    private respawn(): void {
        this.isPickedUp = false;
        this.mesh.visible = true;
        this.mesh.position.y = this.initialY;
        console.log(`[Item] ${this.stats.name} respawned`);
    }

    /**
     * Get position
     */
    getPosition(): THREE.Vector3 {
        return this.mesh.position.clone();
    }

    /**
     * Check if item is available (not picked up)
     */
    isAvailable(): boolean {
        return !this.isPickedUp;
    }

    /**
     * Dispose
     */
    dispose(scene: THREE.Scene): void {
        scene.remove(this.mesh);
        (this.mesh.material as THREE.Material).dispose();
        this.mesh.geometry.dispose();
    }
}
