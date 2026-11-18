# 参与贡献

修改前请阅读 README 和 docs/ARCHITECTURE.md。问题报告请提供浏览器、屏幕尺寸、复现步骤和位置截图。

修改 src 或 data 中的输入，不直接提交 dist、.build、node_modules。修正雪道、站点和建筑时，说明参考资料、坐标体系及不确定性；避免仅凭官方透视图推算真实坐标。

提交前执行 npm run check、npm run build、npm test。修改地形输入时使用 npm run build:uncached，并实际检查关联的雪道交汇、建筑接地及索道站。当前没有正式数据接口兼容承诺。
