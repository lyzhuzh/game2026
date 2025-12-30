/**
 * Particle Presets
 * Predefined configurations for common particle effects
 */

import * as THREE from 'three';
import { ParticlePreset, ParticleType } from '../ParticleTypes';

export const PARTICLE_PRESETS: Record<ParticleType, ParticlePreset> = {
    /**
     * Explosion - spherical burst of particles
     */
    explosion: {
        count: 50,
        lifetime: { min: 0.5, max: 1.5 },
        size: { min: 0.1, max: 0.3 },
        color: 0xff6600,
        velocity: { min: 5, max: 15 },
        gravity: -9.8,
        fadeOut: true
    },

    /**
     * Blood splatter - red particles that stick to surfaces
     */
    blood_splatter: {
        count: 15,
        lifetime: { min: 0.3, max: 0.8 },
        size: { min: 0.05, max: 0.15 },
        color: 0xcc0000,
        velocity: { min: 2, max: 6 },
        gravity: -9.8,
        fadeOut: true,
        stickToSurface: false
    },

    /**
     * Bullet hole - static decal (simplified as particle)
     */
    bullet_hole: {
        count: 1,
        lifetime: 30, // Persistent
        size: 0.08,
        color: 0x222222,
        velocity: { min: 0, max: 0 },
        gravity: 0,
        fadeOut: false,
        stickToSurface: true
    },

    /**
     * Spark - bright short-lived particles
     */
    spark: {
        count: 20,
        lifetime: { min: 0.1, max: 0.3 },
        size: { min: 0.02, max: 0.05 },
        color: 0xffff00,
        velocity: { min: 3, max: 8 },
        gravity: -9.8,
        fadeOut: true
    },

    /**
     * Smoke - rising gray particles
     */
    smoke: {
        count: 30,
        lifetime: { min: 1.0, max: 2.0 },
        size: { min: 0.2, max: 0.5 },
        color: 0x666666,
        velocity: { min: 0.5, max: 2 },
        gravity: 0, // Smoke rises naturally
        fadeOut: true
    },

    /**
     * Muzzle flash - brief bright flash (enhanced)
     */
    muzzle_flash: {
        count: 12, // More particles for fuller effect
        lifetime: { min: 0.05, max: 0.15 }, // Slightly longer
        size: { min: 0.15, max: 0.35 }, // Larger, more visible
        color: 0xffdd44, // Brighter yellow-orange
        velocity: { min: 2, max: 5 }, // More spread
        gravity: 0,
        fadeOut: true
    },

    /**
     * Debris - rotating cubes
     */
    debris: {
        count: 25,
        lifetime: { min: 0.5, max: 1.5 },
        size: { min: 0.05, max: 0.15 },
        color: 0x8b7355, // Brownish
        velocity: { min: 3, max: 10 },
        gravity: -9.8,
        fadeOut: false,
        rotationSpeed: {
            min: new THREE.Vector3(-5, -5, -5),
            max: new THREE.Vector3(5, 5, 5)
        }
    },

    /**
     * Health pickup - green rising particles
     */
    health_pickup: {
        count: 20,
        lifetime: { min: 0.5, max: 1.0 },
        size: { min: 0.05, max: 0.1 },
        color: 0x00ff00,
        velocity: { min: 1, max: 3 },
        gravity: 0,
        fadeOut: true
    },

    /**
     * Shell casing - ejected bullet shells
     */
    'shell casing': {
        count: 1,
        lifetime: 5,
        size: 0.03,
        color: 0xcc9900, // Brass
        velocity: { min: 2, max: 4 },
        gravity: -9.8,
        fadeOut: false,
        rotationSpeed: {
            min: new THREE.Vector3(-10, -10, 0),
            max: new THREE.Vector3(10, 10, 0)
        }
    }
};

/**
 * Get preset configuration for particle type
 */
export function getPreset(type: ParticleType): ParticlePreset {
    return PARTICLE_PRESETS[type];
}

/**
 * Create particle config from preset
 */
export function createConfigFromPreset(
    type: ParticleType,
    position: THREE.Vector3,
    normal?: THREE.Vector3
): import('../ParticleTypes').ParticleConfig {
    const preset = getPreset(type);
    const config: import('../ParticleTypes').ParticleConfig = {
        type,
        position,
        count: preset.count,
        color: preset.color,
        size: preset.size,
        lifetime: preset.lifetime,
        velocity: preset.velocity,
        gravity: preset.gravity,
        fadeOut: preset.fadeOut,
        stickToSurface: preset.stickToSurface
    };

    if (normal) {
        config.normal = normal;
    }

    if (preset.rotationSpeed) {
        const rs = preset.rotationSpeed;
        config.rotationSpeed = new THREE.Vector3(
            Math.random() * (rs.max.x - rs.min.x) + rs.min.x,
            Math.random() * (rs.max.y - rs.min.y) + rs.min.y,
            Math.random() * (rs.max.z - rs.min.z) + rs.min.z
        );
    }

    return config;
}
