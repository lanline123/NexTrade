/**
 * 热图绘制 设置（字段对齐 view/admin imageHotarea/Settings.vue + components/decorate ImageHotarea.vue）
 *
 * Vue 版为弹窗拖拽绘制热区（vue3-drag-resize-rotate）；此处按移植要求改为表单化：
 * 每张热图下支持增删热区，用 InputNumber 编辑坐标（left/top）与尺寸（width/height，
 * 坐标系为 500px 绘制区域原始宽度），用 Input 编辑热区链接（link.name + link.path）。
 */
import { Button, Input, InputNumber, Toast, Upload } from "@douyinfe/semi-ui";
import { IconDelete, IconPlus } from "@douyinfe/semi-icons";
import { SettingGroup, TitleSettingsField, FrameSettingsField } from "../../../shared/settingWidgets";
import { imageFormat } from "../../../shared/format";

import { useI18n } from '../../../../../i18n';
/** 与 Vue 版 ImageHotarea.vue addHotarea 的新区域初始值一致 */
const emptyHotarea = { height: 100, width: 100, left: 10, top: 10 };

const rowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 } as React.CSSProperties;

export default function ImageHotareaSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    const { t } = useI18n();
    const picList: any[] = Array.isArray(data?.picList) ? data.picList : [];

    const setPicList = (next: any[]) => onChange({ picList: next });

    const setPic = (index: number, patch: Record<string, any>) => {
        const next = [...picList];
        next[index] = { ...next[index], ...patch };
        setPicList(next);
    };

    const setHotarea = (picIndex: number, hotarea: any[]) => {
        setPic(picIndex, { hotarea });
    };

    const uploadProps = {
        action: "/adminapi/file/uploadImage",
        onSuccess: (body: any) => {
            const url = body?.data?.url || body?.url;
            if (!url) {
                Toast.error(t("上传失败"));
                return;
            }
            setPicList([...picList, { picUrl: url, picThumb: url, picTitle: "", hotarea: [] }]);
        },
        onError: () => Toast.error(t("上传失败"))
    };

    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="绘制热区">
                <div style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>{t('提示：添加图片后，点击图片进入绘制')}</div>
                {picList.map((pic, picIndex) => (
                    <div key={picIndex} style={{ border: "1px solid #f0f0f0", borderRadius: 4, padding: 8, marginBottom: 8 }}>
                        <div className="h5-editor-pic-row" style={{ marginBottom: 8 }}>
                            <img src={imageFormat(pic.picThumb || pic.picUrl)} alt="" />
                            <div style={{ flex: 1, display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                <Input
                                    size="small"
                                    placeholder={t('图片标题')}
                                    style={{ width: 120 }}
                                    value={pic.picTitle ?? ""}
                                    onChange={(v: string) => setPic(picIndex, { picTitle: v })}
                                />
                                <Button size="small" type="danger" icon={<IconDelete />} onClick={() => setPicList(picList.filter((_, i) => i !== picIndex))} />
                            </div>
                        </div>
                        {(pic.hotarea as any[])?.map?.((hotarea: any, hotareaIndex: number) => (
                            <div key={hotareaIndex} style={{ borderTop: "1px dashed #e0e0e0", paddingTop: 8, marginTop: 8 }}>
                                <div style={{ fontSize: 12, color: "#666", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                                    <span>热区 {hotareaIndex + 1}（坐标基于 500px 绘制宽度）</span>
                                    <Button
                                        size="small"
                                        type="danger"
                                        icon={<IconDelete />}
                                        onClick={() => setHotarea(picIndex, pic.hotarea.filter((_: any, i: number) => i !== hotareaIndex))}
                                    />
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px", marginBottom: 8 }}>
                                    {(
                                        [
                                            { field: "left", label: "左" },
                                            { field: "top", label: "上" },
                                            { field: "width", label: "宽" },
                                            { field: "height", label: "高" }
                                        ] as Array<{ field: string; label: string }>
                                    ).map((cfg) => (
                                        <div key={cfg.field} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <span style={{ fontSize: 13, flexShrink: 0 }}>{cfg.label}</span>
                                            <InputNumber
                                                size="small"
                                                style={{ flex: 1 }}
                                                min={0}
                                                value={Number(hotarea[cfg.field] ?? 0)}
                                                onChange={(v: any) =>
                                                    setHotarea(
                                                        picIndex,
                                                        pic.hotarea.map((h: any, i: number) => (i === hotareaIndex ? { ...h, [cfg.field]: Number(v ?? 0) } : h))
                                                    )
                                                }
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div style={rowStyle}>
                                    <span style={{ fontSize: 13, flexShrink: 0 }}>{t('链接名称')}</span>
                                    <Input
                                        size="small"
                                        style={{ width: 180 }}
                                        value={hotarea.link?.name ?? ""}
                                        onChange={(v: string) =>
                                            setHotarea(
                                                picIndex,
                                                pic.hotarea.map((h: any, i: number) => (i === hotareaIndex ? { ...h, link: { ...(h.link || {}), name: v } } : h))
                                            )
                                        }
                                    />
                                </div>
                                <div style={rowStyle}>
                                    <span style={{ fontSize: 13, flexShrink: 0 }}>{t('链接地址')}</span>
                                    <Input
                                        size="small"
                                        style={{ width: 180 }}
                                        placeholder={t('如 /pages/product/index?id=1')}
                                        value={hotarea.link?.path ?? ""}
                                        onChange={(v: string) =>
                                            setHotarea(
                                                picIndex,
                                                pic.hotarea.map((h: any, i: number) => (i === hotareaIndex ? { ...h, link: { ...(h.link || {}), path: v } } : h))
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        ))}
                        <Button
                            size="small"
                            icon={<IconPlus />}
                            onClick={() => setHotarea(picIndex, [...(pic.hotarea || []), { ...emptyHotarea }])}
                        >{t('添加热区')}</Button>
                    </div>
                ))}
                <Upload {...(uploadProps as any)} accept="image/*" showUploadList={false}>
                    <Button size="small" icon={<IconPlus />}>{t('添加新热图')}</Button>
                </Upload>
            </SettingGroup>
            <TitleSettingsField data={data} onChange={onChange} />
            <FrameSettingsField data={data} onChange={onChange} />
        </div>
    );
}
