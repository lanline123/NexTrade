/**
 * H5 装修编辑器（React 版，对齐 view/admin editor/Index.vue 移动端口径）
 *
 * 路由：?page=h5DecorateEditor&id={decorateId}&pageType={1首页|2会员|3活动|4分类|5登录|6搜索|8商品详情}
 * 链路：decorate/decorate/detail 加载 → store.initDecorate（url 回填 + 固定模块注入）→
 *       saveDraft/publish 保存（整体透传，契约红线）。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Toast } from "@douyinfe/semi-ui";
import { IconChevronLeft } from "@douyinfe/semi-icons";
import { apiGet, apiPost } from "../../api";
import { editorStore, useEditorState } from "./store/editorStore";
import ModuleToolbar from "./components/ModuleToolbar";
import Canvas from "./components/Canvas";
import SettingsPanel from "./components/SettingsPanel";
import { setStorageUrl } from "./shared/format";
import { ensureFixedModules } from "./contract/normalize";
import "./styles/css/module.css";
import "./styles/css/decorate.css";
import "./styles/editor.less";
import "./modules/index";

import { useI18n } from '../../i18n';
const DEFAULT_DECORATE_TITLE = "未命名页面";

interface Props {
    decorateId?: number;
    pageType?: number;
    decorateType?: number;
    onExit?: () => void;
}

export default function H5DecorateEditor({ decorateId: idProp, pageType: pageTypeProp, decorateType = 1, onExit }: Props) {
    const { t } = useI18n();
    const s = useEditorState();

    const query = useMemo(() => new URLSearchParams(window.location.search), []);
    const initialId = idProp ?? Number(query.get("id") || 0);
    const pageType = pageTypeProp ?? Number(query.get("pageType") || 1);
    const isAddMode = !initialId;

    const [decorateTitleDraft, setDecorateTitleDraft] = useState("");
    const [saving, setSaving] = useState(false);

    // 初始化 store（含固定模块注入，空白页也有默认结构）
    useEffect(() => {
        editorStore.reset();
        editorStore.initDecorate({
            decorateId: initialId,
            decorateType: decorateType as any,
            pageType,
            decorateTitle: query.get("title") || DEFAULT_DECORATE_TITLE,
            moduleList: []
        });
        setDecorateTitleDraft(query.get("title") || DEFAULT_DECORATE_TITLE);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 注入云存储 URL（相对路径图片回显）
    useEffect(() => {
        apiGet<any>("setting/config/getAdminBase")
            .then((result) => {
                const url = result?.storageUrl || result?.storageLocalUrl || "";
                if (url) setStorageUrl(url);
            })
            .catch(() => {});
    }, []);

    // 加载装修详情
    useEffect(() => {
        if (isAddMode) return;
        apiGet<any>("decorate/decorate/detail", { id: initialId, decorateType })
            .then((result) => {
                if (result == null) return;
                editorStore.initDecorate({
                    decorateId: result.decorateId || initialId,
                    decorateType: decorateType as any,
                    pageType,
                    decorateTitle: result.decorateTitle || query.get("title") || "",
                    pageModule: result.data?.pageModule || {},
                    moduleList: result.data?.moduleList || [],
                    hasDraft: !!result.draftData
                });
                setDecorateTitleDraft(result.decorateTitle || "");
            })
            .catch((error) => Toast.error(error.message || t("加载装修详情失败")));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialId]);

    /** 延迟创建：新建场景首次保存时校验名称并创建记录 */
    const ensureCreated = async (): Promise<boolean> => {
        if (editorStore.getState().decorateId) return true;
        const title = (editorStore.getState().decorateTitle || "").trim();
        if (!title || title === DEFAULT_DECORATE_TITLE) {
            Toast.warning(t("请先修改页面名称"));
            return false;
        }
        try {
            const result = await apiPost<any>("decorate/decorate/create", {
                decorateType,
                pageType,
                decorateTitle: title
            });
            const newId = result?.decorateId ?? result?.id ?? 0;
            if (!newId) {
                Toast.error(t("创建失败"));
                return false;
            }
            const url = new URL(window.location.href);
            url.searchParams.set("id", String(newId));
            window.history.replaceState(null, "", url.toString());
            return true;
        } catch (error: any) {
            Toast.error(error.message || t("创建失败"));
            return false;
        }
    };

    const buildSavePayload = (data: Record<string, any>) => ({
        id: editorStore.getState().decorateId,
        decorateType,
        pageType,
        data
    });

    const onSavetoDraft = useCallback(async () => {
        if (saving) return;
        if (!(await ensureCreated())) return;
        setSaving(true);
        try {
            await apiPost("decorate/decorate/saveDraft", buildSavePayload(editorStore.getSaveData()));
            Toast.success(t("操作成功"));
            editorStore.markAsSaved();
        } catch (error: any) {
            Toast.error(error.message || t("保存草稿失败"));
        } finally {
            setSaving(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saving]);

    const onPublish = useCallback(async () => {
        if (saving) return;
        if (!(await ensureCreated())) return;
        setSaving(true);
        try {
            const saveData = editorStore.getSaveData();
            // 个人中心页：pageModule 标记为新版，供前台识别（与 view/admin 一致）
            if (pageType === 2) {
                saveData.pageModule = { ...saveData.pageModule, homeStyleVersion: "new" };
            }
            await apiPost("decorate/decorate/publish", buildSavePayload(saveData));
            Toast.success(t("操作成功"));
            editorStore.markAsSaved();
        } catch (error: any) {
            Toast.error(error.message || t("发布失败"));
        } finally {
            setSaving(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saving]);

    const onContinueDraft = useCallback(async () => {
        try {
            const result = await apiGet<any>("decorate/decorate/loadDraftData", { id: editorStore.getState().decorateId });
            editorStore.restoreFromDraft({
                pageModule: result?.pageModule ?? editorStore.getState().pageModule,
                moduleList: result?.moduleList ?? []
            });
        } catch (error: any) {
            Toast.error(error.message || t("恢复草稿失败"));
        }
    }, []);

    const commitTitle = async () => {
        const val = (decorateTitleDraft || "").trim();
        const oldVal = (editorStore.getState().decorateTitle || "").trim();
        if (!val) {
            Toast.warning(t("页面名称不能为空"));
            return;
        }
        if (val === oldVal) return;
        if (!editorStore.getState().decorateId) {
            editorStore.updatePageModule({});
            // 未创建记录：仅本地暂存，首次保存时随 create 提交
            editorStore.initDecorate({
                decorateId: editorStore.getState().decorateId,
                decorateType: decorateType as any,
                pageType,
                decorateTitle: val,
                pageModule: editorStore.getState().pageModule,
                moduleList: editorStore.getState().moduleList,
                hasDraft: editorStore.getState().hasDraft
            });
            return;
        }
        try {
            await apiPost("decorate/decorate/updateField", { id: editorStore.getState().decorateId, field: "decorateTitle", val });
            Toast.success(t("页面名称修改成功"));
        } catch (error: any) {
            Toast.error(error.message || t("修改失败"));
        }
    };

    // 会员中心页固定模块：此处已在 initDecorate/restoreFromDraft 内注入

    return (
        <div className="h5-editor-root">
            <div className="h5-editor-header">
                <div className="h5-editor-header-left">
                    <Button icon={<IconChevronLeft />} theme="borderless" onClick={onExit ?? (() => (window.location.href = window.location.origin))}>{t('返回')}</Button>
                    <span className="h5-editor-page-tag">{t('移动端 H5 装修')}</span>
                    <Input
                        className="h5-editor-title-input"
                        value={decorateTitleDraft}
                        onChange={(v) => setDecorateTitleDraft(v)}
                        onBlur={commitTitle}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        style={{ width: 260 }}
                    />
                </div>
                <div className="h5-editor-header-right">
                    {s.hasDraft && (
                        <Button onClick={onContinueDraft} style={{ marginRight: 8 }}>{t('恢复草稿')}</Button>
                    )}
                    <Button loading={saving} onClick={onSavetoDraft} style={{ marginRight: 8 }}>{t('保存草稿')}</Button>
                    <Button theme="solid" type="primary" loading={saving} onClick={onPublish}>{t('发布上线')}</Button>
                </div>
            </div>
            <div className="h5-editor-body">
                <div className="h5-editor-left">
                    <div className="h5-editor-page-entry" onClick={() => editorStore.selectPage()}>{t('页面设置')}</div>
                    <ModuleToolbar pageType={pageType} isShop={localStorage.getItem("adminType") === "shop"} />
                </div>
                <div className="h5-editor-center">
                    <Canvas />
                </div>
                <div className="h5-editor-right">
                    <SettingsPanel />
                </div>
            </div>
        </div>
    );
}

// 保留引用避免 tree-shake（会员页固定模块注入依赖 ensureFixedModules 链路）
void ensureFixedModules;
