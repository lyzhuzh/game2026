/**
 * Collision Shapes Factory
 * Creates Cannon-es collision shapes
 */

import * as CANNON from 'cannon-es';

export type ShapeType =
    | 'box'
    | 'sphere'
    | 'cylinder'
    | 'plane'
    | 'heightfield'
    | 'trimesh';

export interface ShapeConfig {
    type: ShapeType;
    // Box
    halfExtents?: CANNON.Vec3;
    // Sphere
    radius?: number;
    // Cylinder
    radiusTop?: number;
    radiusBottom?: number;
    height?: number;
    numSegments?: number;
    // Heightfield
    data?: number[][];
    elementSize?: number;
    // Trimesh
    vertices?: number[][];
    indices?: number[][];
}

export class CollisionShapes {
    /**
     * Create a box shape
     */
    static createBox(halfExtents: CANNON.Vec3): CANNON.Box {
        return new CANNON.Box(halfExtents);
    }

    /**
     * Create a sphere shape
     */
    static createSphere(radius: number): CANNON.Sphere {
        return new CANNON.Sphere(radius);
    }

    /**
     * Create a cylinder shape
     */
    static createCylinder(
        radiusTop: number,
        radiusBottom: number,
        height: number,
        numSegments: number = 8
    ): CANNON.Cylinder {
        return new CANNON.Cylinder(radiusTop, radiusBottom, height, numSegments);
    }

    /**
     * Create a plane shape (infinite flat surface)
     */
    static createPlane(): CANNON.Plane {
        return new CANNON.Plane();
    }

    /**
     * Create a heightfield shape (terrain)
     */
    static createHeightfield(
        data: number[][],
        elementSize: number
    ): CANNON.Heightfield {
        const matrix = data;
        const size = matrix.length * matrix[0].length;

        // Create Cannon-es heightfield
        const heightfield = new CANNON.Heightfield(matrix, {
            elementSize: elementSize
        });

        return heightfield;
    }

    /**
     * Create a triangle mesh shape (complex geometry)
     */
    static createTrimesh(
        vertices: number[][],
        indices?: number[][]
    ): CANNON.Trimesh {
        // Convert vertices to flat array
        const verts = vertices.flat();

        // If no indices provided, generate sequential indices
        let inds: number[];
        if (indices) {
            inds = indices.flat();
        } else {
            inds = [];
            for (let i = 0; i < vertices.length; i++) {
                inds.push(i);
            }
        }

        return new CANNON.Trimesh(verts, inds);
    }

    /**
     * Create a capsule shape (for character controller)
     * Note: Cannon-es doesn't have built-in capsule, using cylinder as approximation
     */
    static createCapsule(radius: number, height: number): CANNON.Cylinder {
        // Use cylinder with same radius on top and bottom
        return new CANNON.Cylinder(radius, radius, height, 8);
    }

    /**
     * Create shape from config
     */
    static createFromConfig(config: ShapeConfig): CANNON.Shape {
        switch (config.type) {
            case 'box':
                if (!config.halfExtents) {
                    throw new Error('Box shape requires halfExtents');
                }
                return this.createBox(config.halfExtents);

            case 'sphere':
                if (config.radius === undefined) {
                    throw new Error('Sphere shape requires radius');
                }
                return this.createSphere(config.radius);

            case 'cylinder':
                if (config.radiusTop === undefined || config.radiusBottom === undefined || config.height === undefined) {
                    throw new Error('Cylinder shape requires radiusTop, radiusBottom, and height');
                }
                return this.createCylinder(
                    config.radiusTop,
                    config.radiusBottom,
                    config.height,
                    config.numSegments
                );

            case 'plane':
                return this.createPlane();

            case 'heightfield':
                if (!config.data || config.elementSize === undefined) {
                    throw new Error('Heightfield shape requires data and elementSize');
                }
                return this.createHeightfield(config.data, config.elementSize);

            case 'trimesh':
                if (!config.vertices) {
                    throw new Error('Trimesh shape requires vertices');
                }
                return this.createTrimesh(config.vertices, config.indices);

            default:
                throw new Error(`Unknown shape type: ${config.type}`);
        }
    }

    /**
     * Create box from Three.js Box dimensions
     */
    static createBoxFromDimensions(width: number, height: number, depth: number): CANNON.Box {
        const halfExtents = new CANNON.Vec3(width / 2, height / 2, depth / 2);
        return this.createBox(halfExtents);
    }

    /**
     * Create shape from Three.js geometry (basic support)
     */
    static createFromGeometry(geometry: any): CANNON.Shape | null {
        // Basic geometry type detection
        if (!geometry.type) return null;

        switch (geometry.type) {
            case 'BoxGeometry':
                const params = geometry.parameters;
                return this.createBoxFromDimensions(params.width, params.height, params.depth);

            case 'SphereGeometry':
                return this.createSphere(geometry.parameters.radius);

            case 'CylinderGeometry':
                const cyl = geometry.parameters;
                return this.createCylinder(cyl.radiusTop, cyl.radiusBottom, cyl.height, cyl.radialSegments);

            default:
                console.warn(`Unsupported geometry type for physics shape: ${geometry.type}`);
                return null;
        }
    }
}
