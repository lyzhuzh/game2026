/**
 * View Mode
 * First-person and third-person camera view modes
 */

export enum ViewMode {
    FIRST_PERSON = 'first_person',
    THIRD_PERSON = 'third_person'
}

export interface ThirdPersonCameraConfig {
    /** Camera distance from player (horizontal) */
    distance: number;
    /** Camera height offset above player */
    height: number;
    /** Camera pitch angle (looking down, in radians) */
    pitch: number;
    /** Camera follow smooth speed */
    smoothSpeed: number;
    /** Camera collision detection radius */
    collisionRadius: number;
    /** Minimum distance (prevent camera from getting too close when clipping through walls) */
    minDistance: number;
}
