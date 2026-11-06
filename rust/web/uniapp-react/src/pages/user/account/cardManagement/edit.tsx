/**
 * 添加/编辑提现账号 —— 旧 pages.json 路由兼容入口（pages/user/account/cardManagement/edit）
 *
 * 实现已随 U3 批次自旧 pages/user/account/cardManagement/edit.vue 移植至
 * src/pages/user/account/edit.tsx（注册路由 pages/user/account/edit）。
 * 本文件仅为保持旧 pages.json 路径（后台配置菜单/历史深链）可达的薄包装，
 * 逻辑零重复；页面实现请改 ../edit.tsx。
 */
export { default } from "@/pages/user/account/edit";
