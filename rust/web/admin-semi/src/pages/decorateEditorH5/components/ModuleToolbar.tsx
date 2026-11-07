/**
 * 模块工具栏（移植自 view/admin editor/components/ModuleToolbar.vue）
 *
 * 按页面上下文（decorateType=1 + pageType）展示可用模块分组与模块项；
 * 点击添加（拖拽排序由画布内 dnd-kit 负责，约束校验收敛到 store）。
 */
import { useMemo } from "react";
import { Tabs, TabPane, Toast } from "@douyinfe/semi-ui";
import { getModulesByContext, isExclusiveModule } from "../contract/moduleRegistry";
import { getAvailableToolbarGroups, type ToolbarGroup } from "../contract/constants";
import { editorStore } from "../store/editorStore";
import { createModuleInstance } from "../contract/moduleRegistry";
import type { ModuleDefinition } from "../contract/types";

import { useI18n } from '../../../i18n';
const GROUP_LABELS: Record<ToolbarGroup, string> = {
    basic: "基础模块",
    other: "其它模块",
    live: "直播模块",
    advanced: "高级模块",
    member: "会员模块",
    cateCenter: "分类中心",
    productDetail: "商品详情",
    searchResult: "搜索结果",
    loginConfig: "登录页配置"
};

export default function ModuleToolbar({ pageType, isShop }: { pageType: number; isShop?: boolean }) {
    const { t } = useI18n();
    const groups = useMemo(() => getAvailableToolbarGroups(1, pageType), [pageType]);
    const modules = useMemo(() => getModulesByContext(1, pageType, { isShop }), [pageType, isShop]);

    const modulesByGroup = useMemo(() => {
        const map = new Map<ToolbarGroup, ModuleDefinition[]>();
        for (const m of modules) {
            const group = (m.toolbarGroup as ToolbarGroup) ?? groupByUrl(m.url);
            if (!map.has(group)) map.set(group, []);
            map.get(group)!.push(m);
        }
        return map;
    }, [modules]);

    const handleAdd = (def: ModuleDefinition) => {
        if (isExclusiveModule(def.type) && editorStore.getState().moduleList.length > 0) {
            Toast.warning(t("该模块为独占模块，需要清空页面后才能添加"));
            return;
        }
        const instance = createModuleInstance(def.type, def.url);
        if (!instance) return;
        const result: any = editorStore.addModule(instance);
        if (result !== true && result && typeof result === "object") {
            Toast.warning(t(String(result.reason || '')));
        }
    };

    const renderGrid = (list: ModuleDefinition[]) => (
        <div className="h5-editor-module-grid">
            {list.map((m) => (
                <div key={`${m.type}@${m.url}`} className="h5-editor-module-item" onClick={() => handleAdd(m)} title={t(m.label)}>
                    <div className="h5-editor-module-icon" dangerouslySetInnerHTML={{ __html: m.icon || "" }} />
                    <div className="h5-editor-module-label">{t(m.label)}</div>
                </div>
            ))}
        </div>
    );

    return (
        <div className="h5-editor-toolbar">
            <div className="h5-editor-toolbar-title">{t('模块库')}</div>
            <Tabs type="card" size="small">
                {groups.map((g) => {
                    const list = modulesByGroup.get(g);
                    if (!list || list.length === 0) return null;
                    return (
                        <TabPane tab={t(GROUP_LABELS[g])} itemKey={g} key={g}>
                            {renderGrid(list)}
                        </TabPane>
                    );
                })}
            </Tabs>
        </div>
    );
}

function groupByUrl(url: string): ToolbarGroup {
    switch (url) {
        case "mobile":
            return "basic";
        case "mobilePromotion":
            return "other";
        case "mobilePro":
            return "advanced";
        case "mobileMember":
            return "member";
        case "mobileCateCenter":
            return "cateCenter";
        case "mobileProductDetail":
            return "productDetail";
        case "mobileLogin":
            return "loginConfig";
        case "mobileSearch":
            return "searchResult";
        default:
            return "basic";
    }
}
