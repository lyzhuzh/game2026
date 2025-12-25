# 游戏资产目录

下载的模型文件请放入对应目录：

## 目录结构

```
assets/
├── weapons/        # 武器模型 (Kenney Blaster Kit)
│   ├── pistol.glb
│   ├── rifle.glb
│   ├── shotgun.glb
│   ├── smg.glb
│   ├── sniper.glb
│   └── rocket_launcher.glb
├── enemies/         # 敌人模型 (Quaternius)
│   ├── mech.glb      # Animated Mech
│   └── soldier.glb   # Soldier
├── environment/      # 环境模块 (Kenney Space Kit)
│   ├── floor_panel.glb
│   ├── wall_module.glb
│   ├── pillar.glb
│   ├── platform.glb
│   └── crate.glb
└── textures/         # 纹理贴图
    └── grid.png
```

## 下载步骤

### 1. Kenney.nl

#### Blaster Kit (武器)
1. 访问: https://kenney.nl/assets/blaster-kit
2. 点击 "Download (27MB)"
3. 解压后找到武器模型文件
4. 将以下文件转换为 GLB 格式或直接使用:
   - blaster_fbx/ → 放入 assets/weapons/
   - 包含: pistol, rifle, shotgun, sniper 等

#### Space Kit (地图模块)
1. 访问: https://kenney.nl/assets/space-kit
2. 点击 "Download (74MB)"
3. 解压后找到环境模块
4. 将模块放入 assets/environment/

### 2. Quaternius (Sketchfab)

#### Animated Mech / Soldier (敌人)
1. 访问: https://sketchfab.com/quaternius
2. 搜索 "Soldier" 或找到 Animated Mech
3. 点击模型页面
4. 筛选: Downloadable → Free
5. 点击 Download 按钮
6. 选择 GLB 或 GLTF 格式
7. 放入 assets/enemies/

## 格式转换

如果下载的是 FBX 格式，使用 Blender 转换为 GLB:

1. 打开 Blender
2. File → Import → FBX
3. File → Export → glTF 2.0 (.glb)
4. 勾选 "Include → Selected Objects"
5. 勾选 "Mesh → Apply Modifiers"
6. 点击 Export

## 模型要求

- **格式**: GLB 或 GLTF 2.0 (推荐)
- **缩放**: 导出时使用适当缩放 (通常 0.01 - 0.1)
- **原点**: 模型原点应在底部中心
- **材质**: 使用 PBR 材质 (Metalness/Roughness)
- **多边形**: 保持合理面数 (武器 < 5000 三角形)

## 当前状态

⏳ 等待下载...
