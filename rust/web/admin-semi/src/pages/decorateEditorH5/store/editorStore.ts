/**
 * 装修编辑器状态管理（React 版）
 *
 * 从 view/admin store/decorateEditor.ts（pinia）移植，移动端（decorateType=1）口径：
 * - getSaveData 整体透传：不做字段剔除（契约红线）
 * - 不做 moduleIndex 去重（契约红线）
 * - initDecorate / restoreFromDraft 内置旧编辑器的加载侧归一化链
 * - 固定模块（fixed）不可删除 / 复制 / 隐藏
 *
 * 实现方式：vanilla external store + useSyncExternalStore（不引入额外依赖）。
 */

import { useSyncExternalStore } from "react";
import type { DecorateData, DecorateModuleBase, EditMode, ModuleValidationResult, PageModule } from "../contract/types";
import { DecorateType, type DecorateTypeValue } from "../contract/constants";
import {
    getModulePlacement,
    isBottomModule,
    isExclusiveModule,
    isTopModule
} from "../contract/moduleRegistry";
import { ensureFixedModules, updateModuleListWithUrls } from "../contract/normalize";

interface EditorState {
    decorateId: string | number;
    decorateType: DecorateTypeValue;
    /** 页面类型（移动端）：1=首页 2=会员中心 3=活动页 4=分类中心 5=登录 6=搜索 8=商品详情 */
    pageType: number;
    decorateTitle: string;
    pageModule: PageModule;
    moduleList: DecorateModuleBase[];
    activeModuleIndex: number | null;
    editMode: EditMode;
    hasDraft: boolean;
    isDirty: boolean;
    localeId: string | number;
    parentId: string | number;
    isDefault: boolean;
}

let state: EditorState = {
    decorateId: "",
    decorateType: 1,
    pageType: 1,
    decorateTitle: "",
    pageModule: {},
    moduleList: [],
    activeModuleIndex: null,
    editMode: null,
    hasDraft: false,
    isDirty: false,
    localeId: 0,
    parentId: 0,
    isDefault: true
};

const listeners = new Set<() => void>();

function set(next: Partial<EditorState>) {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getState() {
    return state;
}

/** 深拷贝（默认值/模块数据均为纯 JSON 结构） */
const cloneDeep = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

// ==================== 模块约束校验 ====================

function topModuleCount(list: DecorateModuleBase[]) {
    return list.filter((m) => isTopModule(m.type)).length;
}

function bottomModuleCount(list: DecorateModuleBase[]) {
    return list.filter((m) => isBottomModule(m.type)).length;
}

function hasExclusiveModule(list: DecorateModuleBase[]) {
    return list.some((m) => isExclusiveModule(m.type));
}

/** 检查是否可以添加模块 */
function canAddModule(type: string, targetIndex?: number): ModuleValidationResult {
    const list = state.moduleList;
    const placement = getModulePlacement(type);
    const isExclusive = isExclusiveModule(type);

    if (hasExclusiveModule(list)) {
        return { ok: false, reason: "页面已包含独占模块，不能添加其他模块" };
    }
    if (isExclusive && list.length > 0) {
        return { ok: false, reason: "该模块为独占模块，需要清空页面后才能添加" };
    }
    if (placement === "top") {
        const validIndex = topModuleCount(list);
        if (targetIndex !== undefined && targetIndex > validIndex) {
            return { ok: false, reason: "该模块必须置顶，不能添加到此位置" };
        }
    } else if (placement === "bottom") {
        const validIndex = list.length - bottomModuleCount(list);
        if (targetIndex !== undefined && targetIndex < validIndex) {
            return { ok: false, reason: "该模块必须置底，不能添加到此位置" };
        }
    } else {
        if (targetIndex !== undefined && targetIndex < topModuleCount(list)) {
            return { ok: false, reason: "不能在置顶模块之上添加其他模块" };
        }
        const bottomStart = list.length - bottomModuleCount(list);
        if (targetIndex !== undefined && targetIndex > bottomStart) {
            return { ok: false, reason: "不能在置底模块之下添加其他模块" };
        }
    }
    return { ok: true };
}

/** 检查是否可以移动模块 */
function canMoveModule(fromIndex: number, toIndex: number): ModuleValidationResult {
    const list = state.moduleList;
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) {
        return { ok: false, reason: "无效的位置" };
    }
    if (fromIndex === toIndex) {
        return { ok: true };
    }
    const movingModule = list[fromIndex];
    if (!movingModule) {
        return { ok: false, reason: "未找到要移动的模块" };
    }
    const movingPlacement = getModulePlacement(movingModule.type);
    const topCount = topModuleCount(list);
    const bottomCount = bottomModuleCount(list);
    const bottomStart = list.length - bottomCount;

    if (movingPlacement === "top") {
        if (toIndex >= topCount) {
            return { ok: false, reason: "置顶模块不能移动到非置顶区域" };
        }
    } else if (movingPlacement === "bottom") {
        if (toIndex < bottomStart) {
            return { ok: false, reason: "置底模块不能移动到非置底区域" };
        }
    } else {
        if (toIndex < topCount) {
            return { ok: false, reason: "不能将模块移动到置顶模块之上" };
        }
        if (toIndex >= bottomStart && bottomCount > 0) {
            return { ok: false, reason: "不能将模块移动到置底模块之下" };
        }
    }
    return { ok: true };
}

/** 按置顶/置底约束计算有效插入位置 */
function getValidInsertIndex(type: string, preferredIndex?: number): number {
    const list = state.moduleList;
    const placement = getModulePlacement(type);
    if (placement === "top") {
        return topModuleCount(list);
    } else if (placement === "bottom") {
        return list.length - bottomModuleCount(list);
    } else {
        const minIndex = topModuleCount(list);
        const maxIndex = list.length - bottomModuleCount(list);
        if (preferredIndex === undefined) return maxIndex;
        return Math.max(minIndex, Math.min(preferredIndex, maxIndex));
    }
}

// ==================== store 动作 ====================

export const editorStore = {
    subscribe,
    getState,

    // -------------------- 初始化 --------------------

    /** 初始化装修数据（详情加载 / 从其他页面复制 / 模板导入共用），内置 url 回填 + 固定模块注入 */
    initDecorate(data: {
        decorateId: string | number;
        decorateType: DecorateTypeValue;
        pageType?: number;
        decorateTitle?: string;
        pageModule?: PageModule;
        moduleList?: DecorateModuleBase[];
        hasDraft?: boolean;
        localeId?: string | number;
        parentId?: string | number;
        isDefault?: boolean;
    }) {
        const pageModule = data.pageModule ? cloneDeep(data.pageModule) : {};
        const list = normalizeProductDetailStyles(updateModuleListWithUrls(cloneDeep(data.moduleList ?? [])));
        ensureFixedModules(list, data.pageType ?? 1);
        set({
            decorateId: data.decorateId,
            decorateType: data.decorateType,
            pageType: data.pageType ?? 1,
            decorateTitle: data.decorateTitle ?? "",
            pageModule,
            moduleList: list,
            hasDraft: data.hasDraft ?? false,
            localeId: data.localeId ?? 0,
            parentId: data.parentId ?? 0,
            isDefault: data.isDefault ?? true,
            activeModuleIndex: null,
            editMode: null,
            isDirty: false
        });
    },

    /** 从草稿恢复：只注入固定模块，不回填 url（草稿保存时已带 url） */
    restoreFromDraft(draftData: DecorateData) {
        const list = normalizeProductDetailStyles(cloneDeep(draftData.moduleList ?? []));
        ensureFixedModules(list, state.pageType);
        set({
            pageModule: draftData.pageModule ? cloneDeep(draftData.pageModule) : state.pageModule,
            moduleList: list,
            hasDraft: false,
            activeModuleIndex: null,
            editMode: null
        });
    },

    /** 应用模板（url 回填 + 固定模块注入，pageModule 合并而非替换） */
    applyTemplate(json: { moduleList?: DecorateModuleBase[]; pageModule?: PageModule }) {
        const list = normalizeProductDetailStyles(updateModuleListWithUrls(cloneDeep(json.moduleList ?? [])));
        ensureFixedModules(list, state.pageType);
        set({
            moduleList: list,
            pageModule: { ...state.pageModule, ...(json.pageModule ?? {}) },
            isDirty: true
        });
    },

    // -------------------- 选择 --------------------

    selectModule(index: number) {
        if (index >= 0 && index < state.moduleList.length) {
            set({ activeModuleIndex: index, editMode: "module" });
        }
    },

    selectPage() {
        set({ activeModuleIndex: null, editMode: "page" });
    },

    clearSelection() {
        set({ activeModuleIndex: null, editMode: null });
    },

    // -------------------- 模块操作 --------------------

    /**
     * 添加模块
     * @returns 成功返回 moduleIndex，失败返回校验结果
     */
    addModule(moduleData: Omit<DecorateModuleBase, "moduleIndex">, index?: number, skipValidation = false): number | ModuleValidationResult {
        if (!skipValidation) {
            const validation = canAddModule(moduleData.type, index);
            if (!validation.ok) return validation;
        }
        const list = [...state.moduleList];
        const validIndex = getValidInsertIndex(moduleData.type, index);
        const newModule = {
            ...moduleData,
            moduleIndex: Date.now(),
            isShow: moduleData.isShow ?? true
        } as DecorateModuleBase;
        list.splice(validIndex, 0, newModule);
        set({ moduleList: list, activeModuleIndex: validIndex, editMode: "module", isDirty: true });
        return newModule.moduleIndex;
    },

    /** 更新指定模块数据（浅合并） */
    updateModule(index: number, data: Record<string, any>) {
        const list = [...state.moduleList];
        const target = list[index];
        if (target) {
            list[index] = { ...target, module: { ...target.module, ...data } };
            set({ moduleList: list, isDirty: true });
        }
    },

    /** 更新当前激活模块（浅合并） */
    updateActiveModule(data: Record<string, any>) {
        if (state.activeModuleIndex !== null) {
            editorStore.updateModule(state.activeModuleIndex, data);
        }
    },

    /** 替换当前激活模块的全部数据 */
    replaceActiveModuleData(data: Record<string, any>) {
        if (state.activeModuleIndex !== null) {
            const list = [...state.moduleList];
            const target = list[state.activeModuleIndex];
            if (target) {
                list[state.activeModuleIndex] = { ...target, module: data };
                set({ moduleList: list, isDirty: true });
            }
        }
    },

    /** 更新嵌套字段（如 frame.boxPadding） */
    patchNestedField(parentKey: string, childKey: string, value: unknown) {
        if (state.activeModuleIndex !== null) {
            const list = [...state.moduleList];
            const current = list[state.activeModuleIndex];
            if (current?.module) {
                const parent = current.module[parentKey];
                if (parent && typeof parent === "object") {
                    list[state.activeModuleIndex] = {
                        ...current,
                        module: { ...current.module, [parentKey]: { ...parent, [childKey]: value } }
                    };
                    set({ moduleList: list, isDirty: true });
                }
            }
        }
    },

    /** 更新页面设置 */
    updatePageModule(data: Partial<PageModule>) {
        set({ pageModule: { ...state.pageModule, ...data }, isDirty: true });
    },

    /** 删除模块（固定模块不可删除） */
    removeModule(index: number) {
        if (index >= 0 && index < state.moduleList.length) {
            if (state.moduleList[index]?.fixed) return;
            const list = state.moduleList.filter((_, i) => i !== index);
            let activeModuleIndex = state.activeModuleIndex;
            let editMode = state.editMode;
            if (list.length === 0) {
                activeModuleIndex = null;
                editMode = null;
            } else if (activeModuleIndex !== null) {
                if (activeModuleIndex >= list.length) {
                    activeModuleIndex = list.length - 1;
                } else if (activeModuleIndex > index) {
                    activeModuleIndex = activeModuleIndex - 1;
                }
            }
            set({ moduleList: list, activeModuleIndex, editMode, isDirty: true });
        }
    },

    /** 复制模块（固定模块不可复制） */
    copyModule(index: number) {
        const source = state.moduleList[index];
        if (source && !source.fixed) {
            const copied = cloneDeep(source);
            copied.moduleIndex = Date.now();
            const list = [...state.moduleList];
            list.splice(index + 1, 0, copied);
            set({ moduleList: list, activeModuleIndex: index + 1, isDirty: true });
        }
    },

    /**
     * 移动模块
     * @returns 成功返回 true，失败返回校验结果
     */
    moveModule(fromIndex: number, toIndex: number, skipValidation = false): true | ModuleValidationResult {
        if (fromIndex === toIndex) return true;
        if (!skipValidation) {
            const validation = canMoveModule(fromIndex, toIndex);
            if (!validation.ok) return validation;
        }
        if (fromIndex >= 0 && fromIndex < state.moduleList.length && toIndex >= 0 && toIndex < state.moduleList.length) {
            const list = [...state.moduleList];
            const [moved] = list.splice(fromIndex, 1);
            if (moved) {
                list.splice(toIndex, 0, moved);
                set({ moduleList: list, activeModuleIndex: toIndex, isDirty: true });
            }
        }
        return true;
    },

    moveUp(index: number): true | ModuleValidationResult {
        if (index <= 0) return true;
        return editorStore.moveModule(index, index - 1);
    },

    moveDown(index: number): true | ModuleValidationResult {
        if (index >= state.moduleList.length - 1) return true;
        return editorStore.moveModule(index, index + 1);
    },

    /** 切换模块显隐（固定模块不可隐藏） */
    toggleModuleVisibility(index: number) {
        const target = state.moduleList[index];
        if (target && !target.fixed) {
            const list = [...state.moduleList];
            list[index] = { ...target, isShow: !target.isShow };
            set({ moduleList: list, isDirty: true });
        }
    },

    // -------------------- 数据获取 --------------------

    /** 获取保存数据（契约出口）：整体透传，不做任何字段剔除 */
    getSaveData(): DecorateData {
        return {
            pageModule: cloneDeep(state.pageModule),
            moduleList: cloneDeep(state.moduleList)
        };
    },

    /** 获取指定模块数据 */
    getModuleData<T = Record<string, unknown>>(index: number): T | null {
        const target = state.moduleList[index];
        return target ? (target.module as T) : null;
    },

    // -------------------- 状态管理 --------------------

    markAsSaved() {
        set({ isDirty: false, hasDraft: false });
    },

    markHasDraft(value: boolean) {
        set({ hasDraft: value });
    },

    reset() {
        set({
            decorateId: "",
            decorateType: 1,
            pageType: 1,
            decorateTitle: "",
            pageModule: {},
            moduleList: [],
            activeModuleIndex: null,
            editMode: null,
            hasDraft: false,
            isDirty: false,
            localeId: 0,
            parentId: 0,
            isDefault: true
        });
    }
};

/** 商品详情装修风格契约升级：历史值按模块类型归一为 A1/A2/A3 */
function normalizeProductDetailStyles(list: DecorateModuleBase[]): DecorateModuleBase[] {
    const styleByType: Record<string, "A1" | "A2" | "A3"> = {
        productDetailA1: "A1",
        productDetailA2: "A2",
        productDetailA3: "A3"
    };
    list.forEach((item) => {
        const style = styleByType[item.type];
        if (style) {
            item.module ??= {};
            item.module.decorateStyle = style;
        }
    });
    return list;
}

// ==================== React 绑定 ====================

export function useEditorState(): EditorState {
    return useSyncExternalStore(subscribe, getState, getState);
}

/** 派生选择器（避免无关字段变化引起重渲染时使用） */
export function useEditorSelector<T>(selector: (s: EditorState) => T): T {
    return useSyncExternalStore(
        subscribe,
        () => selector(state),
        () => selector(state)
    );
}

export { DecorateType };

