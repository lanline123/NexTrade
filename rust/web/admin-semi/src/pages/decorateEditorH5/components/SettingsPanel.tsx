/**
 * 设置面板（移植自 view/admin editor/components/SettingPanel.vue）
 *
 * editMode=page：页面设置（背景色/背景图/平铺/尺寸）；
 * editMode=module：懒加载当前模块的设置组件（协议：props = { data, onChange }）。
 */
import { Suspense, lazy, useMemo } from "react";
import { Button, ColorPicker, Upload, Toast } from "@douyinfe/semi-ui";
import { IconPlus } from "@douyinfe/semi-icons";
import { editorStore, useEditorState } from "../store/editorStore";
import { getSettingsComponent, getModuleDefinition } from "../contract/moduleRegistry";
import { imageFormat } from "../shared/format";

import { useI18n } from '../../../i18n';
const settingsCache = new Map<string, React.ComponentType<any>>();

function getLazySettings(type: string, url?: string): React.ComponentType<any> | null {
    const key = `${type}@${url ?? ""}`;
    if (!settingsCache.has(key)) {
        const def = getModuleDefinition(type, url);
        if (!def) return null;
        settingsCache.set(key, lazy(def.settings as any));
    }
    return settingsCache.get(key)!;
}

const backgroundRepeatOptions = [
    { value: 1, label: "不平铺" },
    { value: 2, label: "平铺" },
    { value: 3, label: "纵向平铺" },
    { value: 4, label: "横向平铺" }
];
const backgroundSizeOptions = [
    { value: 1, label: "按宽度缩放" },
    { value: 2, label: "按高度缩放" },
    { value: 3, label: "拉伸铺满" },
    { value: 4, label: "原始尺寸" }
];

function PageSettings({ pageModule }: { pageModule: Record<string, any> }) {
    const { t } = useI18n();
    const bg = (pageModule.backgroundImage && typeof pageModule.backgroundImage === "object" ? pageModule.backgroundImage : null) as
        | { picUrl?: string; picThumb?: string }
        | null;
    return (
        <div className="h5-editor-settings-body">
            <div className="h5-editor-setting-group">
                <div className="h5-editor-setting-label">{t('页面背景色')}</div>
                <ColorPicker
                    value={pageModule.backgroundColor || "#f5f5f5"}
                    onChange={(v: any) => editorStore.updatePageModule({ backgroundColor: typeof v === "string" ? v : v.hex })}
                />
            </div>
            <div className="h5-editor-setting-group">
                <div className="h5-editor-setting-label">{t('页面背景图')}</div>
                {bg?.picUrl ? (
                    <div className="h5-editor-pic-row">
                        <img src={imageFormat(bg.picThumb || bg.picUrl)} alt="" />
                        <Button size="small" type="danger" onClick={() => editorStore.updatePageModule({ backgroundImage: null })}>{t('移除')}</Button>
                    </div>
                ) : (
                    <Upload
                        action="/adminapi/file/uploadImage"
                        onSuccess={(body: any) => {
                            const url = body?.data?.url || body?.url;
                            if (url) {
                                editorStore.updatePageModule({ backgroundImage: { picUrl: url, picThumb: url } });
                            } else {
                                Toast.error(t("上传失败"));
                            }
                        }}
                    >
                        <Button icon={<IconPlus />}>{t('上传图片')}</Button>
                    </Upload>
                )}
            </div>
            <div className="h5-editor-setting-group">
                <div className="h5-editor-setting-label">{t('背景平铺')}</div>
                <select
                    className="h5-editor-select"
                    value={pageModule.backgroundRepeat ?? 1}
                    onChange={(e) => editorStore.updatePageModule({ backgroundRepeat: Number(e.target.value) })}
                >
                    {backgroundRepeatOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                            {t(o.label)}
                        </option>
                    ))}
                </select>
            </div>
            <div className="h5-editor-setting-group">
                <div className="h5-editor-setting-label">{t('背景尺寸')}</div>
                <select
                    className="h5-editor-select"
                    value={pageModule.backgroundSize ?? 1}
                    onChange={(e) => editorStore.updatePageModule({ backgroundSize: Number(e.target.value) })}
                >
                    {backgroundSizeOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                            {t(o.label)}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}

export default function SettingsPanel() {
    const { t } = useI18n();
    const s = useEditorState();
    const activeModule = s.activeModuleIndex !== null ? s.moduleList[s.activeModuleIndex] : null;

    const SettingsComp = useMemo(() => {
        if (s.editMode !== "module" || !activeModule) return null;
        return getLazySettings(activeModule.type, activeModule.url);
    }, [s.editMode, activeModule?.type, activeModule?.url, activeModule?.moduleIndex]);

    return (
        <div className="h5-editor-settings">
            <div className="h5-editor-settings-header">
                {s.editMode === "page" ? t("页面设置") : activeModule ? t(activeModule.label || activeModule.type) : t("设置")}
            </div>
            {s.editMode === "page" ? (
                <PageSettings pageModule={s.pageModule as Record<string, any>} />
            ) : activeModule && SettingsComp ? (
                <Suspense fallback={<div className="h5-editor-preview-loading">{t('设置加载中…')}</div>}>
                    <SettingsComp
                        data={activeModule.module}
                        onChange={(patch: Record<string, any>) => editorStore.updateActiveModule(patch)}
                        moduleIndex={activeModule.moduleIndex}
                    />
                </Suspense>
            ) : (
                <div className="h5-editor-settings-empty">{t('请选择模块或页面进行设置')}</div>
            )}
        </div>
    );
}
