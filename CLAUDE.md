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

## 项目初始化

首次克隆项目后：
1. 运行 `npm install` 安装依赖
2. 运行 `npm run dev` 启动开发服务器
3. 浏览器访问 `http://localhost:3000`
4. 点击页面开始游戏（会初始化音频并锁定鼠标指针）

## 开发工作流

1. **修改代码** - 在 `src/` 目录下进行修改
2. **查看效果** - Vite 热更新会自动刷新浏览器
3. **调试** - 使用浏览器控制台查看日志
4. **ANT-DEBUG** - 游戏内置调试工具，按 `H` 查看帮助
5. **提交** - 完成一个阶段后，移除多余日志并 git commit

## 技术栈

- **Three.js** (v0.160.0) - 3D 渲染
- **Cannon-es** (v0.20.0) - 物理引擎
- **TypeScript** (v5.3.0) - 类型安全开发
- **Vite** (v5.0.0) - 构建工具和开发服务器
- **puppeteer** (v21.0.0) - Mixamo 动画下载工具
- **ts-node** (v10.9.0) - 直接运行 TypeScript 脚本

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

**默认键位绑定快速参考**：
- **WASD** - 移动（前/后/左/右）
- **空格** - 跳跃
- **左 Ctrl** - 蹲伏
- **左 Shift** - 冲刺
- **E** - 交互
- **鼠标左键** - 攻击
- **鼠标右键** - 瞄准（狙击镜）
- **R** - 换弹
- **1-7** - 切换武器
- **鼠标滚轮** - 上下切换武器
- **ESC** - 暂停
- **Tab** - 切换库存
- **F1** - 切换控制台

### 武器系统

`src/weapons/` 中的三种武器类型：
- **HitscanWeapon**：即时命中（手枪、步枪、霰弹枪、冲锋枪、狙击枪）
- **ProjectileWeapon**：物理投射物（火箭发射器）
- **Flamethrower**：持续火焰锥形伤害

**武器槽位快速参考**：
1. 手枪 - 半自动，起始武器
2. 步枪 - 全自动，均衡性能
3. 霰弹枪 - 多发弹丸，近距离高伤害
4. 冲锋枪 (SMG) - 高射速，低伤害
5. 狙击枪 - 单发高伤害，可瞄准放大
6. 火箭发射器 - 投射物，范围爆炸伤害
7. 火焰喷射器 - 锥形持续火焰伤害

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

**敌人类型（ENEMY_CONFIGS）**：
- **grunt** - 基础敌人，低生命值，低伤害
- **soldier** - 标准敌人，中等属性
- **heavy** - 重装敌人，高生命值，高伤害，移动慢
- **sniper** - 狙击手，远程高伤害，低生命值

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

### 调试工具 (ANT-DEBUG)

`DebugTools` 类 (src/core/DebugTools.ts) 提供 3D 场景测量和标记功能，在游戏初始化时自动激活。

**6 种标记模式**（数字键 1-6 切换）：

| 模式 | 快捷键 | 功能 |
|------|--------|------|
| POINT | `1` | 单点标记 |
| BOUNDS | `2` | 4点矩形边界测量（墙壁、窗口等） |
| DISTANCE | `3` | 2点距离测量 |
| PATH | `4` | 多点路径标记，自动计算总长度 |
| AREA | `5` | 多边形面积计算 |
| BOX | `6` | 2点盒子（对角点） |

**物体类型**（Shift + 数字键切换）：
- `Shift+1` WALL（墙壁）
- `Shift+2` WINDOW（窗口）
- `Shift+3` PLATFORM（平台）
- `Shift+4` ENEMY（敌人）
- `Shift+5` WEAPON（武器）

**操作快捷键**：
- **`M`** - 标记点（通过准星瞄准场景中的物体）
- **`C`** - 清除所有标记
- **`U`** - 撤销上一步
- **`H`** - 显示帮助
- **`P`** - 打印测量摘要

**特性**：
- 自动绘制边界框和连线
- 自动计算距离、面积、尺寸
- 生成可直接使用的代码片段
- 详细的控制台输出

使用示例：测量墙壁边界
1. 按 `2` 切换到 BOUNDS 模式
2. 按 `Shift+1` 设置物体类型为 WALL
3. 用准星瞄准墙壁的四个角，按 `M` 标记
4. 标记完成后自动输出边界信息和代码片段

## 文件结构

```
src/
├── core/           # Game, GameLoop, Time, DebugTools
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

7. **游戏循环防死螺旋**：GameLoop 实现了最大帧时间限制（0.25秒），防止"死亡螺旋"问题，即当帧处理时间过长时导致累积器失控。

8. **投射物管理**：ProjectileManager 使用对象池管理火箭弹等投射物，支持爆炸范围伤害。
