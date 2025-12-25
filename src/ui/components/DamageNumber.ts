/**
 * Damage Number Component
 * Shows floating damage numbers when dealing damage
 */

import * as THREE from 'three';

export interface DamageNumberOptions {
    damage: number;
    position: THREE.Vector3;
    isHeadshot?: boolean;
    isCritical?: boolean;
    color?: string;
}

export class DamageNumber {
    private static container: HTMLElement | null = null;
    private static camera: THREE.Camera | null = null;

    /**
     * Initialize the damage number system
     */
    static initialize(camera: THREE.Camera): void {
        DamageNumber.camera = camera;

        // Create container if not exists
        if (!DamageNumber.container) {
            DamageNumber.container = document.getElementById('damage-numbers');
            if (!DamageNumber.container) {
                DamageNumber.container = document.createElement('div');
                DamageNumber.container.id = 'damage-numbers';
                DamageNumber.container.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 100;
                    overflow: hidden;
                `;
                document.body.appendChild(DamageNumber.container);
            }
        }
    }

    /**
     * Show a damage number
     */
    static show(options: DamageNumberOptions): void {
        if (!DamageNumber.container || !DamageNumber.camera) {
            console.warn('[DamageNumber] System not initialized. Call initialize() first.');
            return;
        }

        const {
            damage,
            position,
            isHeadshot = false,
            isCritical = false,
            color
        } = options;

        // Create element
        const element = document.createElement('div');
        element.className = 'damage-number';

        // Set text
        element.textContent = Math.round(damage).toString();

        // Add special classes
        if (isHeadshot) {
            element.classList.add('headshot');
            element.innerHTML = `💀 ${damage}`;
        }
        if (isCritical) {
            element.classList.add('critical');
        }

        // Set custom color if provided
        if (color) {
            element.style.color = color;
        }

        // Calculate screen position
        const screenPos = this.worldToScreen(position, DamageNumber.camera);
        element.style.left = `${screenPos.x}px`;
        element.style.top = `${screenPos.y}px`;

        // Random horizontal offset
        const offsetX = (Math.random() - 0.5) * 40;
        element.style.transform = `translateX(${offsetX}px)`;

        // Add to container
        DamageNumber.container.appendChild(element);

        // Auto remove after animation
        setTimeout(() => {
            element.remove();
        }, 1000);
    }

    /**
     * Show multiple damage numbers (for shotgun, etc.)
     */
    static showMultiple(damages: number[], position: THREE.Vector3, isHeadshot: boolean = false): void {
        damages.forEach((damage, index) => {
            setTimeout(() => {
                DamageNumber.show({
                    damage,
                    position: position.clone().add(new THREE.Vector3(
                        (Math.random() - 0.5) * 0.5,
                        (Math.random() - 0.5) * 0.5,
                        (Math.random() - 0.5) * 0.5
                    )),
                    isHeadshot
                });
            }, index * 50);
        });
    }

    /**
     * Show heal number
     */
    static showHeal(amount: number, position: THREE.Vector3): void {
        DamageNumber.show({
            damage: amount,
            position,
            color: '#00ff00'
        });
    }

    /**
     * Show shield/armor damage
     */
    static showShieldDamage(damage: number, position: THREE.Vector3): void {
        DamageNumber.show({
            damage,
            position,
            color: '#4488ff'
        });
    }

    /**
     * Convert 3D world position to 2D screen position
     */
    private static worldToScreen(position: THREE.Vector3, camera: THREE.Camera): { x: number; y: number } {
        const vector = position.clone();
        vector.project(camera);

        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

        return { x, y };
    }

    /**
     * Clear all damage numbers
     */
    static clear(): void {
        if (DamageNumber.container) {
            DamageNumber.container.innerHTML = '';
        }
    }
}

export default DamageNumber;
