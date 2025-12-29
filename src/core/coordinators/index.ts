/**
 * 协调器系统导出
 */

export { BaseCoordinator, ICoordinator, CoordinatorConfig } from './BaseCoordinator';
export { PhysicsCoordinator, PhysicsCoordinatorConfig } from './PhysicsCoordinator';
export { CombatCoordinator, CombatCoordinatorConfig } from './CombatCoordinator';
export { AICoordinator, AICoordinatorConfig } from './AICoordinator';
export { RenderCoordinator, RenderCoordinatorConfig } from './RenderCoordinator';
export { CoordinatorManager, createDefaultCoordinators } from './CoordinatorManager';
