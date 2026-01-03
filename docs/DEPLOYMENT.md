# Cloudflare Pages 部署指南

## 项目概述

将 Three.js FPS 游戏项目通过 Cloudflare Pages 部署，使用 GitHub 自动集成。

---

## 第一阶段：GitHub 仓库准备

### 1.1 确认仓库状态
- 当前仓库：`D:\work\ant\game`
- 分支：`master`
- 状态：干净（无未提交更改）

### 1.2 需要推送到 GitHub
如果还没有远程仓库，需要：

```bash
# 1. 在 GitHub 创建新仓库（假设命名为 threejs-fps-game）

# 2. 添加远程仓库
git remote add origin https://github.com/你的用户名/threejs-fps-game.git

# 3. 推送代码
git push -u origin master
```

### 1.3 创建 .gitignore（如不存在）
确保以下内容被忽略：
```
node_modules/
dist/
.DS_Store
*.log
```

---

## 第二阶段：Cloudflare Pages 配置

### 2.1 在 Cloudflare 控制台创建项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. 选择 GitHub 仓库 `threejs-fps-game`

### 2.2 构建设置

| 配置项 | 值 |
|--------|-----|
| **构建命令** | `npm run build` |
| **构建输出目录** | `dist` |
| **根目录** | `/` (默认) |
| **Node.js 版本** | `18` 或 `20` (推荐) |

### 2.3 环境变量（可选）
目前项目不需要环境变量，如需要可在 **Settings** → **Environment variables** 中添加。

---

## 第三阶段：项目配置优化（推荐）

### 3.1 生产环境构建优化

修改 `vite.config.ts`，关闭 sourcemap 以减小文件体积：

**文件**: `vite.config.ts`

```typescript
build: {
  target: 'es2020',
  outDir: 'dist',
  assetsDir: 'assets',
  sourcemap: false,  // 改为 false，生产环境不需要 sourcemap
  rollupOptions: {
    output: {
      manualChunks: {
        'three': ['three'],
        'cannon': ['cannon-es']
      }
    }
  }
}
```

### 3.2 添加 _redirects 文件（单页应用路由）

**新建文件**: `public/_redirects`

```
# 将所有路由重定向到 index.html（单页应用）
/*    /index.html   200
```

### 3.3 添加自定义域名（可选）

在 Cloudflare Pages 项目设置中：
1. **Custom domains** → **Set up a custom domain**
2. 输入域名（如 `game.yourdomain.com`）
3. 按照 Cloudflare 指引配置 DNS

---

## 第四阶段：部署流程

### 4.1 自动部署

一旦连接 GitHub，每次 `push` 到 `master` 分支会自动触发部署：

```bash
git add .
git commit -m "feat: 某功能"
git push origin master
```

Cloudflare Pages 会自动：
1. 拉取最新代码
2. 运行 `npm install` 安装依赖
3. 运行 `npm run build` 构建项目
4. 部署 `dist` 目录到 CDN

### 4.2 预览部署

对于每个 Pull Request，Cloudflare Pages 会自动创建预览部署，用于测试。

---

## 第五阶段：验证和测试

### 5.1 检查部署

部署完成后，访问 Cloudflare 提供的 URL（如 `https://threejs-fps-game.pages.dev`）

### 5.2 功能检查清单

- [ ] 页面正常加载
- [ ] 游戏可以启动（点击开始）
- [ ] 3D 场景渲染正常
- [ ] 静态资源（模型、纹理）加载正常
- [ ] 音频播放正常（需要用户交互后）
- [ ] WASD 移动、鼠标视角控制正常
- [ ] 武器射击正常

---

## 第六阶段：高级配置（可选）

### 6.1 添加缓存头

在 Cloudflare Pages 项目中创建 `_headers` 文件：

**新建文件**: `public/_headers`

```
# 静态资源长期缓存
/assets/*
  Cache-Control: public, max-age=31536000, immutable

# HTML 文件不缓存
/*.html
  Cache-Control: public, max-age=0, must-revalidate
```

### 6.2 配置 GitHub Actions（可选）

如果需要在部署前运行测试：

**新建文件**: `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
```

### 6.3 启用 Cloudflare Analytics

在 Cloudflare Pages 项目设置中启用 **Web Analytics**，监控访问数据。

---

## 关键文件路径

| 文件 | 用途 |
|------|------|
| `package.json` | 构建脚本配置 |
| `vite.config.ts` | Vite 构建配置 |
| `tsconfig.json` | TypeScript 配置 |
| `public/_redirects` | 单页应用路由（需创建） |
| `public/_headers` | 缓存策略（可选） |
| `.github/workflows/deploy.yml` | CI/CD 配置（可选） |

---

## 快速开始总结

1. **推送代码到 GitHub**
2. **Cloudflare Pages 连接 GitHub 仓库**
3. **配置构建设置**：
   - 构建命令：`npm run build`
   - 输出目录：`dist`
4. **自动部署完成**

部署后的 URL 格式：`https://你的项目名.pages.dev`
