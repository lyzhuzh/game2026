# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此代码仓库中工作时提供指导。

## 要求

1. 交互使用中文进行回答。
2. 在一个阶段完成后，整理代码去掉多余的 log 并 git commit，git commit 总结这次的修改。

## 项目概述

这是一个使用 Three.js 和 Cannon-es 物理引擎构建的**第一人称射击 (FPS) 游戏**。它是一个基于 TypeScript/Vite 的项目，具有完整的游戏架构，包括武器系统、敌人系统、物理引擎、粒子效果和程序化关卡生成。

## 开发命令

```bash
npm run dev          # 启动 Vite 开发服务器 (http://localhost:3000)
npm run build        # TypeScript 编译 + Vite 构建
npm run preview      # 预览生产构建版本

# Mixamo 动画工具 (网页爬虫)
npm run mixamo:generate   # 生成下载配置
npm run mixamo:download   # 从 Mixamo 下载动画
npm run mixamo:organize   # 整理下载的文件
npm run organize:assets   # 同 mixamo:organize
```

## 技术栈

- **Three.js** (v0.160.0) - 3D 渲染
- **Cannon-es** (v0.20.0) - 物理引擎
- **TypeScript** (v5.3.0) - 类型安全开发
- **Vite** (v5.0.0) - 构建工具和开发服务器

## 架构概述

### 核心设计模式：单例游戏实例

`Game` 类 (src/core/Game.ts) 是一个单例，负责协调所有系统。由于依赖关系，它按特定顺序初始化系统：

1. **InputManager** - 必须首先初始化（单例）
2. **PhysicsWorld** - CharacterController 和武器需要
3. **CharacterController** - 玩家物理
4. **Player** - 游戏状态（生命值、分数等）
5. **AssetManager** - 加载 GLB/FBX 模型和纹理（单例）
6. **EnemyManager** - 需要物理和场景
7. **WeaponManager** - 需要物理、场景、投射物、粒子
8. **ParticleSystem** - 视觉效果

### 游戏循环架构

游戏使用**固定时间步长游戏循环** (src/core/GameLoop.ts)：
- **固定更新** (60 FPS)：物理模拟
- **可变更新**：游戏逻辑、AI、输入处理
- **渲染**：Three.js 渲染

`Game.onUpdate()` 中的关键更新顺序：
1. `fpsCamera.update()` - 必须在 `input.update()` 之前消费鼠标增量
2. `weapons.update()` - 必须在 `input.update()` 之前以检测刚按下的键
3. `input.update()` - 清除每帧输入状态（必须最后执行）

### 输入系统

基于动作的输入抽象（非直接键位绑定）。定义在 `src/input/InputBindings.ts`：
- `'attack'`、`'jump'`、`'move_forward'` 等动作映射到按键/鼠标
- `InputManager.isActionPressed()` 用于持续输入
- `InputManager.isActionJustPressed()` 用于单次触发事件

**重要**：更新顺序很重要。在调用 `input.update()` 之前消费输入状态。

### 武器系统

`src/weapons/` 中的两种武器类型：
- **HitscanWeapon**：即时命中（手枪、步枪、霰弹枪、冲锋枪、狙击枪）
- **ProjectileWeapon**：物理投射物（火箭发射器）
- **Flamethrower**：持续火焰锥形伤害

WeaponManager 处理：
- 武器切换（数字键 1-7、鼠标滚轮）
- 射击输入（自动/半自动）
- 换弹（R 键、空弹匣自动换弹）
- 命中、开火声音、武器切换的回调

### 敌人系统

`src/enemies/Enemy.ts` 带状态机的基类：
- 状态：`idle` → `patrol` → `chase` → `attack` → `dead`
- AI：检测范围、追击速度、攻击冷却
- SkinnedMesh 支持，使用 Three.js AnimationMixer
- 若无动画则回退到程序化动画
- 物理体集成用于碰撞检测

`ENEMY_CONFIGS` 中配置的敌人类型：grunt、soldier、heavy、sniper

### 资源管理

`AssetManager` 是一个单例，负责：
- 通过 `AssetConfig` 在启动时预加载关键资源
- 支持 GLB、GLTF、FBX、纹理
- 缓存已加载的资源
- 处理 SkinnedMesh 模型的正确深度克隆

**关键**：敌人模型需要深度克隆并正确重建骨骼（参见 `Enemy.deepCloneGltf()`）

### 物理系统

`src/physics/` 中的 Cannon-es 封装：
- `PhysicsWorld`：管理 Cannon.js 世界
- `CharacterController`：带碰撞的玩家移动
- `PhysicsBodyFactory`：创建物理体（盒子、球体、地面、胶囊）
- 物理体必须通过 `body.update()` 与视觉网格同步

### 粒子系统

对象池以提高性能：
- `ParticleSystem`：主粒子管理器
- `ParticlePool`：回收粒子对象
- 预设位于 `src/particles/presets/ParticlePresets.ts`

### 关卡生成

`LevelBuilder` 从环境模块（Kenney Space Kit 模型）生成程序化关卡。

## 文件结构

```
src/
├── core/           # Game, GameLoop, Time
├── player/         # 玩家状态, FirstPersonCamera, MovementController
├── physics/        # PhysicsWorld, CharacterController, PhysicsBody
├── weapons/        # WeaponManager, HitscanWeapon, ProjectileWeapon, WeaponRenderer
├── enemies/        # EnemyManager, Enemy
├── items/          # ItemManager (生命值、护甲、弹药拾取)
├── particles/      # ParticleSystem, ParticlePool, presets
├── ui/             # UIManager, HUD 组件 (DamageNumber, KillFeed)
├── audio/          # SoundManager (单例)
├── assets/         # AssetManager (单例), AssetConfig
├── level/          # LevelBuilder
├── input/          # InputManager, KeyboardInput, MouseInput, InputBindings
└── constants/      # GameConstants
```

## 常用模式

### 跨系统通信的回调

系统通过初始化时设置的回调进行通信：
- 敌人死亡 → 玩家分数更新 (`enemies.setOnEnemyDeath()`)
- 武器命中 → 敌人伤害 + UI 伤害数字
- 物品拾取 → 玩家恢复/弹药 + UI 通知
- 敌人攻击 → 玩家受伤

Game.ts 示例：
```typescript
this.enemies.setOnEnemyDeath((enemy) => {
    this.player.addScore(enemy.stats.scoreValue);
    this.player.registerKill();
    this.sound.play('enemy_death');
});
```

### 单例模式

以下类为单例（使用 `getInstance()`）：
- `InputManager`
- `SoundManager`
- `AssetManager`
- `Game`

### 对象池

用于粒子和投射物，避免垃圾回收卡顿。

## 资源指南

模型放置在 `assets/` 目录：
- `weapons/` - Kenney Blaster Kit（GLB 格式）
- `enemies/` - Sketchfab 上的 Quaternius 模型（带动画的 GLB）
- `environment/` - 关卡模块的 Kenney Space Kit
- `textures/` - 网格图案、PBR 材质

下载说明参见 `assets/README.md`（中文）。

## TypeScript 配置

- 启用严格模式
- 路径别名：`@/*` → `src/*`
- ES2020 目标，包含 DOM 类型

## 重要注意事项

1. **更新顺序**：`Game.onUpdate()` 中的操作顺序至关重要。必须在 `input.update()` 清除每帧状态之前消费输入。

2. **敌人模型加载**：带 SkinnedMesh 的 GLTF 模型需要特殊的深度克隆以正确处理骨骼引用。参见 `Enemy.deepCloneGltf()`。

3. **指针锁定**：游戏需要指针锁定才能进行鼠标视角控制。用户必须点击开始（也会初始化音频上下文）。

4. **物理同步**：物理体必须每帧与视觉网格同步。大多数物理体都有 `update()` 方法。

5. **资源预加载**：关键资源在 `Game.initialize()` 中通过 `AssetManager.initialize()` 预加载。

6. **伤害系统**：武器调用 `onHit` 回调并传递位置和伤害。这会路由到 `EnemyManager.damageEnemyAtPosition()`，它会找到最近的敌人并应用伤害。
