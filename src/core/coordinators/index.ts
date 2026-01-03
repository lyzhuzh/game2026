/**
 * 协调器系统导出
 */

export { BaseCoordinator } from './BaseCoordinator';
export type { ICoordinator, CoordinatorConfig } from './BaseCoordinator';
export { PhysicsCoordinator } from './PhysicsCoordinator';
export type { PhysicsCoordinatorConfig } from './PhysicsCoordinator';
export { CombatCoordinator } from './CombatCoordinator';
export type { CombatCoordinatorConfig } from './CombatCoordinator';
export { AICoordinator } from './AICoordinator';
export type { AICoordinatorConfig } from './AICoordinator';
export { RenderCoordinator } from './RenderCoordinator';
export type { RenderCoordinatorConfig } from './RenderCoordinator';
export { CoordinatorManager, createDefaultCoordinators } from './CoordinatorManager';
