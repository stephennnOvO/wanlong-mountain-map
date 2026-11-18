# 架构

## 运行结构

地图使用 Three.js 和浏览器原生 DOM。`src/app.js` 是程序入口模板，`scripts/legacy/build.cjs` 按标记插入各模块，生成共享闭包作用域中的应用代码。

| 模块                                           | 职责                           |
| ---------------------------------------------- | ------------------------------ |
| `geo-data.js`、`geo-projection.js`             | 地形输入和坐标转换             |
| `geo-routes.js`、`trail-footprints.js`         | 雪道线位、宽度和边界           |
| `hotel-snow-flow.js`、`local-piste-terrain.js` | 显示边界和局部地形整修         |
| `terrain-surface.js`                           | 雪面、林地及选中状态绘制       |
| 建筑与设施模块                                 | 酒店、索道站、公园及水池等几何 |
| 界面模块                                       | 目录、详情、测距、环境与触控   |

## 构建流程

`scripts/build.cjs` 按 `scripts/inputs.json` 将输入映射到 `.build/work/`，调用组装器，最后将网页输出到 `dist/`。`.build/` 和 `dist/` 均为生成目录。

## 地形缓存

默认构建校验地形产物的文件摘要和关键源码绑定。关键地形输入变更后，使用 `npm run build:uncached` 生成运行时重新计算地形的网页。

修改雪道、地形或设施高度后，需要检查关联雪道的连接、横坡、建筑接地和索道站位置。
