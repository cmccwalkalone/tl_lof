# Netlify 部署指南

## 问题描述

项目部署到 Netlify 后无法显示数据，主要原因是 **跨域 (CORS) 问题**。

### 原因分析

原始代码直接从浏览器调用外部 API：
- 腾讯股票 API: `https://qt.gtimg.cn/q=`
- 天天基金 API: `https://fundgz.1234567.com.cn/js/`
- 东财平层 API: `https://fund.eastmoney.com/pingzhongdata/`
- 东财基金信息: `https://fundf10.eastmoney.com/jjfl_`

这些外部 API 不允许来自其他域名的请求，浏览器会阻止这些跨域请求。

## 解决方案

已创建 4 个 Netlify Functions 来代理所有外部 API：

### 1. Netlify Functions

- **netlify/functions/fund.js** - 代理天天基金净值数据
- **netlify/functions/tencent.js** - 代理腾讯股票价格数据
- **netlify/functions/pingzhong.js** - 代理东财平层数据
- **netlify/functions/fundinfo.js** - 代理东财基金信息

### 2. API 路由映射

| 前端调用 | 实际路由 | Netlify Function |
|---------|---------|------------------|
| `/api/fund?code=xxx` | → | `/.netlify/functions/fund` |
| `/api/tencent?code=xxx` | → | `/.netlify/functions/tencent` |
| `/api/pingzhong?code=xxx` | → | `/.netlify/functions/pingzhong` |
| `/api/fundinfo?code=xxx` | → | `/.netlify/functions/fundinfo` |

## 部署步骤

### 方式一：GitHub 部署（推荐）

1. **提交代码到 GitHub**
   ```bash
   git add .
   git commit -m "Fix CORS issue by adding Netlify functions"
   git push origin main
   ```

2. **连接 Netlify**
   - 登录 [Netlify](https://app.netlify.com/)
   - 点击 "Add new site" → "Import an existing project"
   - 选择 GitHub 并授权
   - 选择你的仓库
   - 配置构建设置：
     - Build command: `echo "No build needed"`
     - Publish directory: `.`
   - 点击 "Deploy site"

3. **等待部署完成**
   - Netlify 会自动检测 `netlify.toml` 配置文件
   - Functions 会自动部署

### 方式二：Netlify CLI 部署

1. **安装 Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **登录 Netlify**
   ```bash
   netlify login
   ```

3. **部署**
   ```bash
   netlify deploy --prod
   ```

4. **验证部署**
   - 访问你的 Netlify 域名
   - 打开浏览器开发者工具 (F12)
   - 查看 Console 和 Network 标签页

## 测试验证

### 1. 创建测试文件

已创建 `netlify-api-test.html`，用于测试所有 API：

1. **部署前本地测试**
   ```bash
   # 启动本地服务器
   npx http-server . -p 8080
   # 或
   python -m http.server 8080
   ```

2. **访问测试页面**
   - 打开浏览器访问 `http://localhost:8080/netlify-api-test.html`
   - 点击 "运行所有测试" 按钮

### 2. 预期结果

所有测试应该显示 ✅ 成功：
- 基金净值 API: ✅ 成功
- 腾讯股票 API: ✅ 成功
- 东财平层 API: ✅ 成功
- 基金信息 API: ✅ 成功

### 3. 常见错误

如果测试失败，检查以下内容：

#### 错误 1: `Failed to fetch`

**原因**: API 路由未正确配置

**解决方案**:
1. 检查 `netlify.toml` 文件是否存在且配置正确
2. 确认 Functions 文件在 `netlify/functions/` 目录
3. 检查 Netlify 部署日志

#### 错误 2: `CORS error`

**原因**: 仍然存在跨域问题

**解决方案**:
1. 确认所有 API 都通过 `/api/*` 路由调用
2. 检查 Netlify Function 是否有正确的 CORS 头

#### 错误 3: `404 Not Found`

**原因**: Function 未部署

**解决方案**:
1. 在 Netlify Dashboard 中检查 Functions 标签页
2. 查看部署日志确认 Function 是否构建成功
3. 重新部署

#### 错误 4: API 返回错误数据

**原因**: 外部 API 变更或不可用

**解决方案**:
1. 检查外部 API 是否可访问
2. 查看 Function 日志中的错误信息
3. 可能需要更新解析逻辑

## 查看日志

### Netlify Dashboard

1. 登录 Netlify
2. 选择你的站点
3. 点击 "Functions" 标签
4. 点击具体的 Function 查看日志

### Netlify CLI

```bash
# 查看实时日志
netlify functions:invoke fund --name fund --verbose

# 查看所有 Function 日志
netlify functions:list
```

## 本地开发测试

### 使用 Netlify Dev

```bash
# 安装
npm install -g netlify-cli

# 启动本地开发服务器（会模拟 Netlify 环境）
netlify dev
```

访问 `http://localhost:8888` 查看应用，所有 API 会自动代理到本地 Functions。

## 项目结构

```
项目根目录/
├── index.html              # 主页面
├── styles.css              # 样式文件
├── data.js                 # 数据存储
├── api.js                  # API 调用逻辑（已更新）
├── app.js                  # 应用逻辑
├── netlify-api-test.html   # API 测试页面
├── netlify.toml            # Netlify 配置
└── netlify/
    └── functions/          # Netlify Functions
        ├── fund.js         # 基金净值代理
        ├── tencent.js      # 腾讯股票代理
        ├── pingzhong.js    # 东财平层代理
        └── fundinfo.js     # 基金信息代理
```

## 部署检查清单

- [ ] 所有文件已提交到 GitHub
- [ ] GitHub 仓库已连接到 Netlify
- [ ] `netlify.toml` 配置文件存在
- [ ] Functions 在 `netlify/functions/` 目录
- [ ] 部署成功完成
- [ ] 测试页面所有测试通过
- [ ] 主页面数据正常显示
- [ ] 浏览器控制台无错误

## 故障排除

### 1. 清除缓存并重新部署

如果遇到奇怪的问题，尝试：

1. 在 Netlify Dashboard 中点击 "Build & deploy"
2. 点击 "Clear cache and deploy site"
3. 等待重新部署完成

### 2. 检查 Node.js 版本

Netlify Functions 使用 Node.js，确保兼容：

```javascript
// 在 function 文件顶部添加
exports.handler = async (event, context) => {
  // Node.js 18.x
  // ...
}
```

### 3. 查看实际请求

在浏览器中打开开发者工具：

1. **Network 标签**
   - 筛选 `XHR` 或 `fetch`
   - 查看 `/api/*` 请求
   - 检查请求和响应

2. **Console 标签**
   - 查看所有 `console.log` 输出
   - 查看错误信息

## 获取帮助

如果问题仍未解决：

1. 查看 Netlify 官方文档: https://docs.netlify.com/
2. 查看 Functions 文档: https://docs.netlify.com/functions/overview/
3. 在 GitHub Issues 中搜索类似问题

## 技术细节

### 为什么需要代理？

浏览器安全策略阻止跨域请求。流程对比：

**之前（直接调用）**:
```
浏览器 → 外部API → ❌ CORS 错误
```

**现在（通过代理）**:
```
浏览器 → Netlify Function → 外部API → ✅ 成功
```

Netlify Function 运行在服务端，不受浏览器 CORS 限制。

### 性能考虑

- Function 有执行时间限制（10秒）
- Function 有并发限制
- 已实现批量请求优化

### 安全建议

- Functions 代码不应包含敏感信息
- 外部 API 密钥应通过环境变量配置
- 已添加适当的错误处理
- 已添加请求超时保护

## 更新日志

### v2.0.0
- 添加 4 个 Netlify Functions 代理所有外部 API
- 更新 `api.js` 使用新的代理端点
- 创建测试页面验证所有 API
- 添加详细的部署文档

## 许可证

本项目使用 MIT 许可证。
