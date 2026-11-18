# 万龙三维雪场地图

基于 Three.js 的万龙滑雪场交互式三维地图，支持雪道查询、索道与设施浏览、多点坡面测距，以及日夜环境切换。

[打开在线演示](https://stephennnovo.github.io/wanlong-mountain-map/)

## 功能

- 三维地形与雪道、索道、酒店和山地设施展示
- 分类目录、地图标签和设施定位
- 多点测距，计算沿地形表面的累计距离
- 日夜光照、天气切换和动态缆车
- 鼠标、键盘及触屏操作
- 静态部署，构建后可离线浏览

## 快速开始

需要 Node.js 22 或更新版本。

```sh
npm ci
npm run build
npm run preview
```

打开终端显示的本地地址，默认端口为 `4173`。

## 操作

| 操作         | 方式                               |
| ------------ | ---------------------------------- |
| 移动地图     | 拖动，或使用工具栏切换拖动模式     |
| 旋转视角     | 右键拖动，或按住 Shift 拖动        |
| 缩放         | 滚轮或工具栏缩放按钮               |
| 触屏浏览     | 单指拖动，双指平移、捏合缩放或旋转 |
| 返回全景     | 按 H                               |
| 关闭当前详情 | 按 Esc                             |
| 坡面测距     | 打开测距工具后连续选点             |

## 开发命令

| 命令                     | 用途                             |
| ------------------------ | -------------------------------- |
| `npm run build`          | 使用已烘焙地形构建网页           |
| `npm run build:uncached` | 构建在浏览器中重新计算地形的版本 |
| `npm run preview`        | 预览构建结果                     |
| `npm run check`          | 检查 JavaScript 语法             |
| `npm run format`         | 格式化代码与文档                 |
| `npm run format:check`   | 检查格式                         |
| `npm test`               | 检查资源完整性与浏览器启动       |

首次运行浏览器测试前，安装 Chromium：

```sh
npx playwright install chromium
```

也可使用 `WANLONG_CHROME` 环境变量指定已有的 Chrome 可执行文件。

## 项目结构

```text
src/        页面、交互逻辑与三维模型
data/       地图参数、路线输入与地形数据
vendor/     第三方运行库
scripts/    构建、预览与检查工具
tests/      自动化测试
docs/       开发文档与数据来源
```

构建结果输出到 `dist/`。地形输入发生变化时，使用 `build:uncached` 重新计算；详见[架构说明](docs/ARCHITECTURE.md)。

## 部署

`main` 分支通过构建和浏览器测试后，GitHub Actions 会将生成的 `dist/` 发布到 GitHub Pages。本地构建可用 `npm run build` 复现，`dist/` 由 Git 忽略。

## 地图说明

本项目为非官方地图。部分自行车路线、公园布置和建筑外形为示意；雪道与设施开放情况以雪场公告为准。已知限制见[地图与开发限制](docs/LIMITATIONS.md)，素材和数据来源见[来源说明](docs/ASSETS.md)。

## 参与贡献

欢迎提交问题和改进建议。提交问题时请附上浏览器信息、复现步骤和相关位置截图。开发流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可

原创代码采用 [MIT 许可证](LICENSE)。Three.js 的许可证见 [THREE-LICENSE.txt](vendor/THREE-LICENSE.txt)。图片与地理数据的许可状态见[来源说明](docs/ASSETS.md)。
