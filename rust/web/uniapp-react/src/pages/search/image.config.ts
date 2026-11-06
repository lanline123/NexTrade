// 自旧 pages.json 的 pages/search/image 路由配置平移：
// navigationStyle custom（页面用自己的头部）、状态栏文字白色（扫描层黑底）
// 注意：pages/search/image 需在 src/app.config.ts 中注册后才能从小程序/H5 打开；
// 本轮按任务约束未改动 app.config.ts。
export default definePageConfig({
    navigationBarTitleText: "图片搜索",
    navigationStyle: "custom",
    navigationBarTextStyle: "white"
});