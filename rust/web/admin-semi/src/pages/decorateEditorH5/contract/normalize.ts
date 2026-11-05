/**
 * 加载侧归一化工具（契约行为，与 view/admin editor/modules/normalize.ts + ensureFixed.ts 对齐）
 *
 * 调用时机与旧编辑器严格一致：
 * - 详情加载 / 从其他页面复制 / 模板导入：updateModuleListWithUrls + ensureFixedModules
 * - 草稿还原：仅 ensureFixedModules（旧编辑器不在此路径回填 url）
 */

import type { DecorateModuleBase } from "./types";
import { getAllModules } from "./moduleRegistry";
import { isB2b, isStore } from "./version";

// 桶迁移兼容：folder 已迁移到新桶的 type，强制把历史草稿烧录的旧 url 纠正过来（加载时自愈）
const RELOCATED_TYPE_URLS: Record<string, string> = {
    newcomerCombo: "mobilePro",
    limitedSpecial: "mobilePro"
};

const typeToUrlMap: Record<string, string> = {};
getAllModules().forEach(({ type, url }) => {
    if (!typeToUrlMap[type]) typeToUrlMap[type] = url;
});

/**
 * 为已保存数据回填模块 url（原地修改并返回，与旧实现一致）
 */
export function updateModuleListWithUrls(moduleList: DecorateModuleBase[] = []): DecorateModuleBase[] {
    moduleList.forEach((module) => {
        if (RELOCATED_TYPE_URLS[module.type]) {
            module.url = RELOCATED_TYPE_URLS[module.type];
        } else if (!module.url) {
            const correspondingUrl = typeToUrlMap[module.type];
            if (correspondingUrl) {
                module.url = correspondingUrl;
            }
        }
    });
    return moduleList;
}

// ==================== 固定模块幂等注入 ====================

type FixedModuleSpec = {
    /** 构造一条新的 fixed module */
    make: () => DecorateModuleBase;
    /** 判定 moduleList 中是否已存在该 fixed module（兼容 kebab / camel 两种命名） */
    matches: (m: any) => boolean;
    /** 锚点优先级数组：按顺序定位最后一个匹配项，在它之后插入 */
    anchorAfter: Array<(m: any) => boolean>;
    /** 展示条件：返回 false 时不注入，并清理已存在的同类模块 */
    enabled?: () => boolean;
};

const isType = (...types: string[]) => (m: any) => !!m && types.includes(m.type);

export const FIXED_MODULES_BY_PAGE_TYPE: Record<number, FixedModuleSpec[]> = {
    // 会员中心
    2: [
        {
            make: () => ({
                type: "fixedFunctionalArea",
                url: "mobileMember",
                label: "固定功能区",
                fixed: true,
                isShow: true,
                moduleIndex: Date.now(),
                module: {}
            }),
            matches: isType("fixedFunctionalArea", "fixed-functional-area"),
            anchorAfter: [isType("myWallet", "my-wallet"), isType("orderEntry", "order-entry", "orderEntryV2", "order-entry-v2")],
            enabled: () => isB2b() || isStore()
        }
    ]
};

const findLastIndex = (list: any[], matcher: (m: any) => boolean): number => {
    for (let i = list.length - 1; i >= 0; i--) {
        if (matcher(list[i])) return i;
    }
    return -1;
};

const findInsertIndex = (list: any[], anchorAfter: Array<(m: any) => boolean>): number => {
    for (const matcher of anchorAfter) {
        const idx = findLastIndex(list, matcher);
        if (idx !== -1) return idx + 1;
    }
    return list.length;
};

/**
 * 幂等保证：
 * - moduleList 中已有该 fixed module → 仅回写 fixed: true 与标准 type / url，不重复插入
 * - moduleList 中没有 → 按 anchorAfter 优先级插入
 */
export function ensureFixedModules(list: DecorateModuleBase[], pageType: number): DecorateModuleBase[] {
    if (!Array.isArray(list)) return list;
    const specs = FIXED_MODULES_BY_PAGE_TYPE[pageType] ?? [];
    specs.forEach((spec) => {
        if (spec.enabled && !spec.enabled()) {
            for (let i = list.length - 1; i >= 0; i--) {
                if (spec.matches(list[i])) list.splice(i, 1);
            }
            return;
        }
        const existing = list.find(spec.matches);
        if (existing) {
            const proto = spec.make();
            if (existing.type !== proto.type) existing.type = proto.type;
            if (!existing.url) existing.url = proto.url;
            if (existing.fixed !== true) existing.fixed = true;
            return;
        }
        const insertAt = findInsertIndex(list, spec.anchorAfter);
        list.splice(insertAt, 0, spec.make());
    });
    return list;
}
