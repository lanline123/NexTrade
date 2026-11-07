/**
 * 手机画布（移植自 view/admin editor/components/CanvasViewport.vue + ModuleRenderer.vue）
 *
 * - 渲染 moduleList（懒加载预览组件，Suspense 兜底）
 * - 选中/悬停操作条：上移/下移/复制/删除/显隐（固定模块受约束）
 * - dnd-kit 纵向拖拽排序（约束校验失败弹提示并回弹）
 * - 页面背景（backgroundColor/backgroundImage/repeat/size）与旧编辑器 format() 口径一致
 */
import { Suspense, useMemo, lazy } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Toast } from "@douyinfe/semi-ui";
import { IconPlus, IconMinus, IconCopy, IconDelete, IconEyeOpened, IconEyeClosed } from "@douyinfe/semi-icons";
import { editorStore, useEditorState } from "../store/editorStore";
import { getPreviewComponent, getModuleDefinition } from "../contract/moduleRegistry";
import type { DecorateModuleBase } from "../contract/types";

import { useI18n } from '../../../i18n';
/** 预览组件缓存（moduleIndex 无关，按 type@url 缓存） */
const previewCache = new Map<string, React.ComponentType<any>>();

function getLazyPreview(type: string, url?: string): React.ComponentType<any> | null {
    const key = `${type}@${url ?? ""}`;
    if (!previewCache.has(key)) {
        const def = getModuleDefinition(type, url);
        if (!def) return null;
        previewCache.set(key, lazy(def.preview as any));
    }
    return previewCache.get(key)!;
}

/** 页面背景（与 view/admin editor/Index.vue format() 口径一致） */
function pageBackgroundStyle(pageModule: Record<string, any>, pageType: number): React.CSSProperties {
    const backgroundRepeat: Record<number, string> = { 1: "no-repeat", 2: "repeat", 3: "repeat-y", 4: "repeat-x", 5: "no-repeat" };
    const backgroundSize: Record<number, string> = { 1: "100% auto", 2: "auto 100%", 3: "100% 100%", 4: "100% auto" };
    let pageBg = pageModule?.backgroundColor as string | undefined;
    if (pageType === 6) {
        // 搜索页无页面设置入口：取搜索结果模块的 backgroundColor（与旧编辑器一致）
        const searchMod = editorStore.getState().moduleList.find((m) => m.type === "mobileSearchResult");
        pageBg = (searchMod?.module as { backgroundColor?: string } | undefined)?.backgroundColor || pageBg || "#f5f5f5";
    }
    const style: Record<string, string> = {
        backgroundColor: pageBg ? "background-color:" + pageBg + ";" : "",
        backgroundImage: pageModule?.backgroundImage?.picUrl ? "background-image: url(" + pageModule.backgroundImage.picUrl + ");" : "",
        backgroundRepeat: "background-repeat:" + (backgroundRepeat[pageModule?.backgroundRepeat as number] ?? "") + ";",
        backgroundSize: "background-size:" + (backgroundSize[pageModule?.backgroundSize as number] ?? "") + ";"
    };
    const out: Record<string, string> = {};
    for (const decl of Object.values(style).join("").split(";")) {
        const idx = decl.indexOf(":");
        if (idx === -1) continue;
        const key = decl.slice(0, idx).trim();
        const value = decl.slice(idx + 1).trim();
        if (!key || !value) continue;
        out[key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = value;
    }
    return out as React.CSSProperties;
}

function ModuleItem({ moduleData, index }: { moduleData: DecorateModuleBase; index: number }) {
    const { t } = useI18n();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: moduleData.moduleIndex });
    const Preview = getLazyPreview(moduleData.type, moduleData.url);
    const isActive = editorStore.getState().activeModuleIndex === index;

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`modules-item h5-editor-modules-item ${isActive ? "active" : ""} ${moduleData.isShow === false ? "is-hidden" : ""}`}
            onClick={() => editorStore.selectModule(index)}
            {...attributes}
            {...listeners}
        >
            <div className="h5-editor-module-label-tag">{t(moduleData.label || moduleData.type)}</div>
            <div className="h5-editor-module-actions" onClick={(e) => e.stopPropagation()}>
                <span title={t('上移')} onClick={() => tryMove(index, index - 1, t)}>
                    <IconMinus />
                </span>
                <span title={t('下移')} onClick={() => tryMove(index, index + 1, t)}>
                    <IconPlus />
                </span>
                <span
                    title={t('复制')}
                    onClick={() => {
                        editorStore.copyModule(index);
                    }}
                >
                    <IconCopy />
                </span>
                <span title={moduleData.isShow === false ? t("显示") : t("隐藏")} onClick={() => editorStore.toggleModuleVisibility(index)}>
                    {moduleData.isShow === false ? <IconEyeClosed /> : <IconEyeOpened />}
                </span>
                <span title={t('删除')} onClick={() => editorStore.removeModule(index)}>
                    <IconDelete />
                </span>
            </div>
            <div className="h5-editor-module-preview" onClick={(e) => e.stopPropagation()}>
                {Preview ? (
                    <Suspense fallback={<div className="h5-editor-preview-loading">{t('模块加载中…')}</div>}>
                        <Preview data={moduleData.module} />
                    </Suspense>
                ) : (
                    <div className="h5-editor-preview-missing">「{t(moduleData.label || moduleData.type)}」{t('预览待移植')}</div>
                )}
            </div>
        </div>
    );
}

function tryMove(from: number, to: number, t: (key: string) => string) {
    if (to < 0) return;
    const state = editorStore.getState();
    if (to >= state.moduleList.length) return;
    const result: any = editorStore.moveModule(from, to);
    if (result !== true) Toast.warning(t(String(result?.reason || '')));
}

export default function Canvas() {
    const { t } = useI18n();
    const s = useEditorState();
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const items = s.moduleList;

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = items.findIndex((m) => m.moduleIndex === active.id);
        const newIndex = items.findIndex((m) => m.moduleIndex === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        const validation: any = editorStore.moveModule(oldIndex, newIndex);
        if (validation !== true) {
            Toast.warning(t(String(validation?.reason || '')));
            return;
        }
    };

    return (
        <div className="h5-editor-canvas-window">
            <div className="h5-editor-canvas-page" style={useMemo(() => pageBackgroundStyle(s.pageModule, s.pageType), [s.pageModule, s.pageType])}>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={items.map((m) => m.moduleIndex)} strategy={verticalListSortingStrategy}>
                        <div className="gallery-list-ul" style={{ minHeight: s.pageType === 6 && items.length > 0 ? "auto" : "700px" }}>
                            {items.map((m, index) => (
                                <ModuleItem key={m.moduleIndex} moduleData={m} index={index} />
                            ))}
                            {items.length === 0 && <div className="h5-editor-canvas-empty">{t('请在左侧模块库点击添加模块')}</div>}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>
        </div>
    );
}

