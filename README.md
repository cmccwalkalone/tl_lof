# LOF基金套利 H5网页版部署指南

## 项目简介

这是一个移动端优先的LOF基金溢价率查询工具，完全复刻自微信小程序版本。

## 功能特点

- 实时查看LOF基金溢价率
- 支持多个基金分类（欧美指数、商品、亚洲市场）
- 显示基金代码、名称、净值、价格、溢价率、状态和限额
- 手动刷新数据
- 自定义基金列表管理
- 移动端优化的触摸交互

## 文件结构

```
d:\AI项目\套利_H5\
├── index.html     # 主入口文件
├── styles.css     # 样式文件
├── app.js         # 主要应用逻辑
├── data.js        # 数据管理和缓存
└── api.js         # API请求逻辑
```

## 本地测试

### 方法1：使用Python服务器

```bash
# 进入项目目录
cd d:\AI项目\套利_H5

# 启动Python HTTP服务器
python -m http.server 8080

# 在浏览器中访问
# http://localhost:8080/
```

### 方法2：使用Node.js服务器

```bash
# 安装http-server（如果未安装）
npm install -g http-server

# 进入项目目录
cd d:\AI项目\套利_H5

# 启动服务器
http-server -p 8080

# 在浏览器中访问
# http://localhost:8080/
```

## 部署到Netlify

### 方式一：拖拽部署（最简单）

1. 访问 [Netlify](https://www.netlify.com/)
2. 登录或注册账户
3. 将 `d:\AI项目\套利_H5` 文件夹拖拽到 Netlify 的部署区域
4. 等待自动部署完成
5. 获取生成的访问URL

### 方式二：使用Netlify CLI

1. 安装 Netlify CLI：
   ```bash
   npm install -g netlify-cli
   ```

2. 登录 Netlify：
   ```bash
   netlify login
   ```

3. 进入项目目录：
   ```bash
   cd d:\AI项目\套利_H5
   ```

4. 初始化 Netlify 站点：
   ```bash
   netlify init
   ```

5. 部署网站：
   ```bash
   netlify deploy --prod
   ```

### 方式三：使用Git部署

1. 将项目上传到 GitHub/GitLab 仓库
2. 在 Netlify 中连接仓库
3. 配置构建设置（此项目无需构建，直接部署）
4. 触发自动部署

## 技术说明

### CORS处理

项目使用 `corsproxy.io` 作为CORS代理来解决跨域访问问题。这使得网页应用可以直接从浏览器访问第三方基金API。

### 数据缓存

- 基金数据缓存在浏览器 localStorage 中
- 缓存有效期为30分钟
- 基金分类配置也保存在 localStorage 中

### 响应式设计

- 移动端优先设计
- 适配各种屏幕尺寸
- 支持触摸友好的交互

## 注意事项

1. **CORS代理依赖**：此应用依赖 corsproxy.io 提供CORS代理服务，在生产环境中请确保该服务可用
2. **数据实时性**：基金数据来自第三方API，可能存在一定的延迟
3. **网络要求**：需要稳定的网络连接以获取实时数据

## 故障排除

### 数据加载失败

如果遇到数据加载失败，请检查：
1. 网络连接是否正常
2. corsproxy.io 服务是否可用
3. 第三方基金API是否可访问

### 部署后无法访问

1. 检查 Netlify 部署状态
2. 确认域名配置正确
3. 查看 Netlify 日志排查错误

## 更新日志

### v1.0.0 (2026-06-01)
- 初始版本发布
- 完全复刻小程序功能
- 支持移动端访问
- 实现CORS代理支持

## 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 Issue 到项目仓库
- 发送邮件至项目维护者

## 许可证

MIT License

Copyright (c) 2026
