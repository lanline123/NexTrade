/**
 * 装修模块注册表（与 view/admin editor/config/module-registry.ts 对齐，
 * 仅移动端部分；preview/settings 为 React 懒加载组件）
 *
 * type 保留 camelCase（契约冻结）；url 字段随模块实例写入并保存（契约字段）。
 */

import type { ComponentType } from "react";
import type { ModuleDefinition } from "./types";
import { getModuleToolbarGroup, resolveContextRule, type DecorateTypeValue, type ToolbarGroup } from "./constants";

const moduleRegistry = new Map<string, ModuleDefinition>();

const keyOf = (type: string, url: string) => `${type}@${url}`;

/** 注册模块 */
export function registerModule(definition: ModuleDefinition) {
    const key = keyOf(definition.type, definition.url);
    if (moduleRegistry.has(key)) {
        console.warn(`[ModuleRegistry] 模块 "${key}" 已存在，将被覆盖`);
    }
    moduleRegistry.set(key, {
        visible: true,
        order: 100,
        ...definition
    });
}

/** 获取模块定义 */
export function getModuleDefinition(type: string, url?: string): ModuleDefinition | undefined {
    if (url) {
        return moduleRegistry.get(keyOf(type, url));
    }
    for (const def of moduleRegistry.values()) {
        if (def.type === type) return def;
    }
    return undefined;
}

/** 获取所有模块定义（按 order 升序） */
export function getAllModules(): ModuleDefinition[] {
    return Array.from(moduleRegistry.values()).sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

/** 创建新模块实例（moduleIndex 由 store.addModule 写入；url 写入实例并随保存持久化，契约） */
export function createModuleInstance(type: string, url?: string): Omit<import("./types").DecorateModuleBase, "moduleIndex"> | null {
    const definition = getModuleDefinition(type, url);
    if (!definition) {
        console.error(`[ModuleRegistry] 未找到模块类型: ${type}`);
        return null;
    }
    return {
        type: definition.type,
        url: definition.url,
        label: definition.label,
        isShow: true,
        module: definition.getDefaultValue() as Record<string, any>
    };
}

/** 获取预览组件 */
export async function getPreviewComponent(type: string, url?: string): Promise<ComponentType<any> | null> {
    const definition = getModuleDefinition(type, url);
    if (!definition) return null;
    try {
        const mod = await definition.preview();
        return mod.default;
    } catch (error) {
        console.error(`[ModuleRegistry] 加载预览组件失败: ${type}`, error);
        return null;
    }
}

/** 获取设置组件 */
export async function getSettingsComponent(type: string, url?: string): Promise<ComponentType<any> | null> {
    const definition = getModuleDefinition(type, url);
    if (!definition) return null;
    try {
        const mod = await definition.settings();
        return mod.default;
    } catch (error) {
        console.error(`[ModuleRegistry] 加载设置组件失败: ${type}`, error);
        return null;
    }
}

/**
 * 按上下文获取模块列表（统一入口，对应旧 ToolBar 的硬编码面板）
 * @param decorateType 1=移动端
 * @param pageType 移动端页面类型：1=首页，2=会员中心，3=活动页，4=分类中心，5=登录页，6=搜索页，8=商品详情
 * @param options.isShop 是否店铺端
 */
export function getModulesByContext(decorateType: DecorateTypeValue, pageType: number, options?: { isShop?: boolean }): ModuleDefinition[] {
    const rule = resolveContextRule(decorateType, pageType);
    const isShop = options?.isShop ?? false;
    return getAllModules().filter((m) => {
        if (m.visible === false) return false;
        if (m.enabled && !m.enabled()) return false;
        if (m.shopOnly && !isShop) return false;
        const group = getModuleToolbarGroup(m.url, m.toolbarGroup as ToolbarGroup | undefined);
        if (!rule.allowedGroups.includes(group)) return false;
        if (isShop && group === "advanced") return false;
        return true;
    });
}

// ==================== 模块约束查询 ====================

/** 获取模块的位置约束 */
export function getModulePlacement(type: string): "top" | "bottom" | undefined {
    return getModuleDefinition(type)?.placement;
}

/** 是否独占模块 */
export function isExclusiveModule(type: string): boolean {
    return getModuleDefinition(type)?.exclusive === true;
}

/** 是否置顶模块 */
export function isTopModule(type: string): boolean {
    return getModulePlacement(type) === "top";
}

/** 是否置底模块 */
export function isBottomModule(type: string): boolean {
    return getModulePlacement(type) === "bottom";
}
