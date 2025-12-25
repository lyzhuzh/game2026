/**
 * Main Entry Point
 * Bootstrap and initialize the game
 */

import { Game } from './core/Game';

async function main(): Promise<void> {
    try {
        console.log('=== FPS Game Starting ===');

        // Get game instance
        const game = Game.getInstance();

        // Update loading progress
        game.updateLoadingProgress(0.2, 'Creating scene...');

        // Initialize game systems
        await game.initialize();

        game.updateLoadingProgress(0.5, 'Loading assets...');

        // TODO: Load assets here
        // await assetManager.preloadAssets(assetManifest);

        game.updateLoadingProgress(0.8, 'Initializing systems...');

        // TODO: Initialize game systems
        // - Input system
        // - Player controller
        // - Physics world
        // - etc.

        game.updateLoadingProgress(1.0, 'Ready!');

        // Small delay before starting
        await new Promise(resolve => setTimeout(resolve, 500));

        // Start the game loop
        game.start();

        console.log('=== Game Started ===');

    } catch (error) {
        console.error('Failed to start game:', error);
    }
}

// Start the application
main();
