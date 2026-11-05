/**
 * 装修编辑器（H5）基础类型
 *
 * 契约约束：保存 JSON 与 view/admin 旧编辑器逐字段一致。
 * 模块与页面设置均带索引签名——编辑器不认识的字段必须原样透传，
 * 不得收窄为白名单结构。
 */

import type { ComponentType } from "react";

/** 装修模块基础结构 */
export interface DecorateModuleBase {
    /** 模块唯一标识（Date.now() 时间戳） */
    moduleIndex: number;
    /** 模块类型（camelCase，契约冻结） */
    type: string;
    /** 模块所在分类目录，动态加载路径的一部分，随保存持久化（契约字段） */
    url?: string;
    /** 显示名称 */
    label?: string;
    /** 是否显示 */
    isShow?: boolean;
    /** 固定模块标记（不可删除/复制/隐藏） */
    fixed?: boolean;
    /** 模块数据 */
    module: Record<string, any>;
    /** 未知字段透传 */
    [key: string]: any;
}

/** 页面设置（透传结构） */
export interface PageModule {
    backgroundColor?: string;
    backgroundImage?: string | Record<string, any> | null;
    backgroundRepeat?: string | number;
    backgroundSize?: string | number;
    style?: number;
    /** 页面标题沉浸式（仅会员中心页使用） */
    immersive?: boolean;
    [key: string]: any;
}

/** 装修数据结构（getSaveData 输出 / 接口 data 字段） */
export interface DecorateData {
    pageModule: PageModule;
    moduleList: DecorateModuleBase[];
}

/** 编辑模式：page=页面设置，module=模块设置 */
export type EditMode = "page" | "module" | null;

/** 模块校验结果 */
export interface ModuleValidationResult {
    ok: boolean;
    reason?: string;
}

/** 模块定义（React 版：preview/settings 为懒加载的 React 组件） */
export interface ModuleDefinition {
    /** 模块类型标识（唯一，camelCase，契约冻结） */
    type: string;
    /** 显示名称 */
    label: string;
    /** 工具栏图标（icon class 或图片地址，与 view/admin ToolBar 项一致） */
    icon?: string;
    /** 模块分类目录（契约字段，写入模块实例并随保存持久化） */
    url: string;
    /** 适用平台 */
    platform: string;
    /** 预览组件（懒加载） */
    preview: () => Promise<{ default: ComponentType<any> }>;
    /** 设置组件（懒加载） */
    settings: () => Promise<{ default: ComponentType<any> }>;
    /** 默认值工厂函数（必须与 view/admin defaultXxx 逐字段一致，契约） */
    getDefaultValue: () => object;
    /** 是否在工具栏显示 */
    visible?: boolean;
    /** 排序权重（越小越靠前） */
    order?: number;
    /** 工具栏分组（未指定时按 url 自动映射） */
    toolbarGroup?: string;
    /** 运行时展示条件（承接 isStore/isB2b 等版本判断），返回 false 时不显示 */
    enabled?: () => boolean;
    /** 位置约束："top" 必须位于列表第一位；"bottom" 必须位于最后一位 */
    placement?: "top" | "bottom";
    /** 独占模式：添加后不允许再添加其他模块 */
    exclusive?: boolean;
    /** 店铺端专属：仅 adminType=shop 显示 */
    shopOnly?: boolean;
}
