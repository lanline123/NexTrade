/**
 * 模块设置面板通用控件（Semi 版，对齐 view/editor Settings.vue 的字段语义）
 *
 * 统一 onChange(patch) 协议：所有控件只上报字段级 patch，由 store 浅合并进模块数据。
 */
import { Button, ColorPicker, Input, InputNumber, RadioGroup, Radio, Select, Switch, Upload, Toast } from "@douyinfe/semi-ui";
import { IconPlus, IconDelete } from "@douyinfe/semi-icons";
import { imageFormat, pickPic } from "./format";

import { useI18n } from '../../../i18n';
type Patch = Record<string, any>;
interface FieldProps {
    data: Record<string, any>;
    onChange: (patch: Patch) => void;
}

// ---------------- 布局 ----------------

export function SettingGroup({ title, children }: { title?: string; children: React.ReactNode }) {
    const { t } = useI18n();
    return (
        <div className="h5-editor-setting-group" style={{ borderBottom: "1px solid #f0f0f0", paddingBottom: 12 }}>
            {title ? <div className="h5-editor-setting-label" style={{ fontWeight: 600 }}>{t(title)}</div> : null}
            {children}
        </div>
    );
}

export function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
    const { t } = useI18n();
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13, flexShrink: 0 }}>{t(label)}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>{children}</div>
        </div>
    );
}

// ---------------- 基础控件 ----------------

/** 单选（数字值），options: [{value,label}] */
export function RadioField({ data, onChange, field, options }: FieldProps & { field: string; options: Array<{ value: number | string; label: string }> }) {
    const { t } = useI18n();
    return (
        <SettingRow label=" ">
            <RadioGroup
                type="button"
                buttonSize="small"
                value={data?.[field]}
                onChange={(e: any) => onChange({ [field]: e.target.value })}
            >
                {options.map((o) => (
                    <Radio key={String(o.value)} value={o.value}>
                        {t(o.label)}
                    </Radio>
                ))}
            </RadioGroup>
        </SettingRow>
    );
}

/** 带标题的单选 */
export function RadioRowField({ data, onChange, field, label, options }: FieldProps & { field: string; label: string; options: Array<{ value: number | string; label: string }> }) {
    const { t } = useI18n();
    return (
        <SettingRow label={label}>
            <RadioGroup
                type="button"
                buttonSize="small"
                value={data?.[field]}
                onChange={(e: any) => onChange({ [field]: e.target.value })}
            >
                {options.map((o) => (
                    <Radio key={String(o.value)} value={o.value}>
                        {t(o.label)}
                    </Radio>
                ))}
            </RadioGroup>
        </SettingRow>
    );
}

export function NumberField({ data, onChange, field, label, min = 0, max = 999, step = 1, suffix }: FieldProps & { field: string; label: string; min?: number; max?: number; step?: number; suffix?: string }) {
    return (
        <SettingRow label={label}>
            <InputNumber value={Number(data?.[field] ?? 0)} min={min} max={max} step={step} style={{ width: 120 }} onChange={(v: any) => onChange({ [field]: Number(v ?? 0) })} />
            {suffix ? <span style={{ fontSize: 12, color: "#999" }}>{suffix}</span> : null}
        </SettingRow>
    );
}

export function ColorField({ data, onChange, field, label, allowEmpty = true }: FieldProps & { field: string; label: string; allowEmpty?: boolean }) {
    const { t } = useI18n();
    return (
        <SettingRow label={label}>
            <ColorPicker
                value={data?.[field] || undefined}
                onChange={(v: any) => onChange({ [field]: typeof v === "string" ? v : v?.hex })}
            />
            {allowEmpty ? (
                <Button size="small" onClick={() => onChange({ [field]: "" })}>{t('清除')}</Button>
            ) : null}
        </SettingRow>
    );
}

export function TextField({ data, onChange, field, label, placeholder }: FieldProps & { field: string; label: string; placeholder?: string }) {
    const { t } = useI18n();
    return (
        <SettingRow label={label}>
            <Input value={data?.[field] ?? ""} placeholder={placeholder ? t(placeholder) : undefined} style={{ width: 180 }} onChange={(v: string) => onChange({ [field]: v })} />
        </SettingRow>
    );
}

export function SwitchField({ data, onChange, field, label }: FieldProps & { field: string; label: string }) {
    return (
        <SettingRow label={label}>
            <Switch checked={Number(data?.[field]) === 1} onChange={(v: boolean) => onChange({ [field]: v ? 1 : 0 })} />
        </SettingRow>
    );
}

export function SelectField({ data, onChange, field, label, options }: FieldProps & { field: string; label: string; options: Array<{ value: number | string; label: string }> }) {
    const { t } = useI18n();
    return (
        <SettingRow label={label}>
            <Select value={data?.[field]} style={{ width: 180 }} optionList={options.map((o) => ({ ...o, label: t(o.label) })) as any} onChange={(v: any) => onChange({ [field]: v })} />
        </SettingRow>
    );
}

// ---------------- 图片列表（picList） ----------------

export interface PicItem {
    picUrl?: string;
    picThumb?: string;
    picLink?: { link?: string; title?: string };
    [key: string]: any;
}

/** 图片列表编辑器：上传/删除图片 + 链接地址（与旧 PicList 语义一致） */
export function PicListField({ data, onChange, field, label, max = 20 }: FieldProps & { field: string; label: string; max?: number }) {
    const { t } = useI18n();
    const list: PicItem[] = Array.isArray(data?.[field]) ? data[field] : [];

    const uploadProps = {
        action: "/adminapi/file/uploadImage",
        onSuccess: (body: any, file: any) => {
            const url = body?.data?.url || body?.url;
            if (!url) {
                Toast.error(t("上传失败"));
                return;
            }
            const next = [...list, { picUrl: url, picThumb: url, picLink: { link: "", title: "" } }];
            onChange({ [field]: next });
        },
        onError: () => Toast.error(t("上传失败"))
    };

    return (
        <div className="h5-editor-setting-group">
            <div className="h5-editor-setting-label">{t(label)}</div>
            {list.map((item, index) => (
                <div key={index} className="h5-editor-pic-row" style={{ marginBottom: 8 }}>
                    <img src={imageFormat(pickPic(item))} alt="" />
                    <div style={{ flex: 1 }}>
                        <Input
                            size="small"
                            placeholder={t('跳转链接，如 /pages/product/index?id=1')}
                            value={item.picLink?.link ?? ""}
                            onChange={(v: string) => {
                                const next = [...list];
                                next[index] = { ...item, picLink: { ...(item.picLink || { title: "" }), link: v } };
                                onChange({ [field]: next });
                            }}
                        />
                    </div>
                    <Button
                        size="small"
                        type="danger"
                        icon={<IconDelete />}
                        onClick={() => onChange({ [field]: list.filter((_, i) => i !== index) })}
                    />
                </div>
            ))}
            {list.length < max && (
                <Upload {...(uploadProps as any)} accept="image/*" showUploadList={false}>
                    <Button size="small" icon={<IconPlus />}>{t('添加图片')}</Button>
                </Upload>
            )}
        </div>
    );
}

/** 单图编辑器 */
export function SinglePicField({ data, onChange, field, label }: FieldProps & { field: string; label: string }) {
    const { t } = useI18n();
    const pic = data?.[field];
    const url = pic && typeof pic === "object" ? pickPic(pic) : typeof pic === "string" ? pic : "";
    return (
        <div className="h5-editor-setting-group">
            <div className="h5-editor-setting-label">{t(label)}</div>
            {url ? (
                <div className="h5-editor-pic-row">
                    <img src={imageFormat(url)} alt="" />
                    <Button size="small" type="danger" onClick={() => onChange({ [field]: { picUrl: "", picThumb: "" } })}>{t('移除')}</Button>
                </div>
            ) : (
                <Upload
                    action="/adminapi/file/uploadImage"
                    accept="image/*"
                    showUploadList={false}
                    onSuccess={(body: any) => {
                        const u = body?.data?.url || body?.url;
                        if (u) onChange({ [field]: { picUrl: u, picThumb: u } });
                        else Toast.error(t("上传失败"));
                    }}
                >
                    <Button size="small" icon={<IconPlus />}>{t('上传图片')}</Button>
                </Upload>
            )}
        </div>
    );
}

// ---------------- 模块标题（defaultTitle） ----------------

export function TitleSettingsField({ data, onChange, field = "title", label = "模块标题" }: FieldProps & { field?: string; label?: string }) {
    const { t } = useI18n();
    const title = data?.[field] ?? {};
    const set = (patch: Patch) => onChange({ [field]: { ...title, ...patch } });
    return (
        <SettingGroup title={label}>
            <SwitchField
                data={title}
                onChange={(patch: Patch) => set(patch)}
                field="showTitle"
                label="显示标题"
            />
            {Number(title.showTitle) === 1 && (
                <>
                    <RadioRowField
                        data={title}
                        onChange={set}
                        field="titleStyle"
                        label="标题样式"
                        options={[
                            { value: 1, label: "样式一" },
                            { value: 2, label: "样式二" },
                            { value: 3, label: "样式三" }
                        ]}
                    />
                    <RadioRowField
                        data={title}
                        onChange={set}
                        field="titleAlign"
                        label="对齐方式"
                        options={[
                            { value: 1, label: "居左" },
                            { value: 2, label: "居中" },
                            { value: 3, label: "居右" }
                        ]}
                    />
                    <TextField data={title} onChange={set} field="titleText" label="标题文字" />
                    <ColorField data={title} onChange={set} field="titleColor" label="标题颜色" />
                    <ColorField data={title} onChange={set} field="titleBackground" label="标题背景色" />
                    <TextField data={title} onChange={set} field="descText" label="描述文字" />
                    <ColorField data={title} onChange={set} field="descColor" label="描述颜色" />
                    <SwitchField data={title} onChange={set} field="showMore" label="右侧显示更多" />
                    {Number(title.showMore) === 1 && <ColorField data={title} onChange={set} field="moreColor" label="更多颜色" />}
                </>
            )}
        </SettingGroup>
    );
}

// ---------------- 模块边框（defaultFrame） ----------------

export function FrameSettingsField({ data, onChange, field = "frame", label = "模块边框设置" }: FieldProps & { field?: string; label?: string }) {
    const frame = data?.[field] ?? {};
    const set = (patch: Patch) => onChange({ [field]: { ...frame, ...patch } });
    return (
        <SettingGroup title={label}>
            <ColorField data={frame} onChange={set} field="backgroundColor" label="背景颜色" />
            <NumberField data={frame} onChange={set} field="innerPadding" label="内部边距" suffix="px" />
            <NumberField data={frame} onChange={set} field="boxPadding" label="左右间距" suffix="px" />
            <NumberField data={frame} onChange={set} field="boxPaddingTop" label="上间距" suffix="px" />
            <NumberField data={frame} onChange={set} field="boxPaddingBottom" label="下间距" suffix="px" />
            <NumberField data={frame} onChange={set} field="boxRadius" label="圆角" suffix="px" />
        </SettingGroup>
    );
}

// ---------------- 颜色对列表（colorA~colorB，tagNav 标签配色等） ----------------

export function ColorPairListField({
    data,
    onChange,
    field,
    label,
    defaults,
}: FieldProps & { field: string; label: string; defaults: Array<{ colorA: string; colorB: string }> }) {
    const list: Array<{ colorA?: string; colorB?: string }> = data?.[field] || [];
    const setItem = (index: number, key: "colorA" | "colorB", value: string) => {
        const next = list.map((item, i) => (i === index ? { ...item, [key]: value } : item));
        onChange({ [field]: next });
    };
    const addOne = () => onChange({ [field]: [...list, { ...defaults[list.length % defaults.length] }] });
    const removeOne = (index: number) => onChange({ [field]: list.filter((_, i) => i !== index) });
    return (
        <SettingGroup title={label}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {list.map((item, index) => (
                    <div key={index} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="color" value={item.colorA || "#cccccc"} onChange={(e) => setItem(index, "colorA", e.target.value)} style={{ width: 32, height: 26, border: 0, background: "transparent" }} />
                        <span style={{ color: "#98a2b3", fontSize: 12 }}>→</span>
                        <input type="color" value={item.colorB || item.colorA || "#cccccc"} onChange={(e) => setItem(index, "colorB", e.target.value)} style={{ width: 32, height: 26, border: 0, background: "transparent" }} />
                        <button type="button" onClick={() => removeOne(index)} style={{ marginLeft: "auto", fontSize: 12, color: "var(--semi-color-danger)", background: "transparent", border: 0, cursor: "pointer" }}>
                            删除
                        </button>
                    </div>
                ))}
                <button type="button" onClick={addOne} style={{ height: 26, fontSize: 12, border: "1px solid var(--semi-color-border)", borderRadius: 4, background: "transparent", cursor: "pointer" }}>
                    + 添加配色
                </button>
            </div>
        </SettingGroup>
    );
}
