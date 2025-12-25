/**
 * Item Manager
 * Manages all pickable items in the game
 */

import * as THREE from 'three';
import { Item, ItemType } from './Item';
import { getRandomItemType } from './ItemConfig';

export interface ItemSpawnConfig {
    type?: ItemType;
    position: THREE.Vector3;
}

export interface PickupResult {
    success: boolean;
    itemType: ItemType;
    healthRestore?: number;
    armorRestore?: number;
    ammoAmount?: number;
    weaponType?: string;
    itemName: string;
}

export class ItemManager {
    private scene: THREE.Scene;
    private items: Item[] = [];
    private playerPosition: THREE.Vector3 = new THREE.Vector3();

    // Pickup callback
    private onPickupCallback?: (result: PickupResult) => void;

    // Spawning
    private pickUpRange: number = 2;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    /**
     * Set on pickup callback
     */
    setOnPickup(callback: (result: PickupResult) => void): void {
        this.onPickupCallback = callback;
    }

    /**
     * Update all items
     */
    update(deltaTime: number): void {
        // Update all items
        for (const item of this.items) {
            item.update(deltaTime);

            // Check if player can pick up
            if (item.canPickup(this.playerPosition, this.pickUpRange)) {
                this.tryPickup(item);
            }
        }
    }

    /**
     * Set player position for pickup detection
     */
    setPlayerPosition(position: THREE.Vector3): void {
        this.playerPosition.copy(position);
    }

    /**
     * Try to pick up an item
     */
    private tryPickup(item: Item): void {
        if (!item.isAvailable()) return;

        // Attempt pickup
        if (item.pickup()) {
            const result: PickupResult = {
                success: true,
                itemType: item.type,
                healthRestore: item.stats.healthRestore,
                armorRestore: item.stats.armorRestore,
                ammoAmount: item.stats.ammoAmount,
                weaponType: item.stats.weaponType,
                itemName: item.stats.name
            };

            // Notify callback
            if (this.onPickupCallback) {
                this.onPickupCallback(result);
            }
        }
    }

    /**
     * Spawn an item
     */
    spawnItem(config: ItemSpawnConfig): Item {
        const type = config.type || getRandomItemType();
        const item = new Item(type, config.position);

        this.scene.add(item.mesh);
        this.items.push(item);

        console.log(`[ItemManager] Spawned ${item.stats.name} at`, config.position);
        return item;
    }

    /**
     * Spawn multiple items
     */
    spawnItems(configs: ItemSpawnConfig[]): void {
        for (const config of configs) {
            this.spawnItem(config);
        }
    }

    /**
     * Spawn random items in an area
     */
    spawnRandomItems(count: number, center: THREE.Vector3, radius: number): void {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * radius;

            const position = new THREE.Vector3(
                center.x + Math.cos(angle) * distance,
                1, // Ground level + offset
                center.z + Math.sin(angle) * distance
            );

            this.spawnItem({ position });
        }
    }

    /**
     * Get all items
     */
    getItems(): Item[] {
        return this.items;
    }

    /**
     * Get available (pickupable) items
     */
    getAvailableItems(): Item[] {
        return this.items.filter(item => item.isAvailable());
    }

    /**
     * Get items in range of player
     */
    getItemsInRange(range: number): Item[] {
        const inRange: Item[] = [];
        for (const item of this.items) {
            if (item.isAvailable() && item.canPickup(this.playerPosition, range)) {
                inRange.push(item);
            }
        }
        return inRange;
    }

    /**
     * Clear all items
     */
    clearAllItems(): void {
        for (const item of this.items) {
            item.dispose(this.scene);
        }
        this.items = [];
    }

    /**
     * Dispose
     */
    dispose(): void {
        this.clearAllItems();
    }
}
