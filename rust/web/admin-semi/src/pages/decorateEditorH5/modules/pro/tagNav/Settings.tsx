/**
 * 标签导航 设置（字段对齐 view/admin mobilePro/tagNav/Settings.vue）
 */
import { SettingGroup, NumberField, ColorField, ColorPairListField } from "../../../shared/settingWidgets";

const DEFAULT_COLORS = [
    { colorA: "#5FC1E8", colorB: "#5FC1E8" },
    { colorA: "#F5A623", colorB: "#F5A623" },
    { colorA: "#FF5C3A", colorB: "#FF5C3A" },
    { colorA: "#FF6B7A", colorB: "#FF6B7A" },
    { colorA: "#8BC53F", colorB: "#8BC53F" },
    { colorA: "#2BC4B4", colorB: "#2BC4B4" },
];

export default function TagNavSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    const groupList: Array<{ title?: string }> = data?.groupList || [];
    const setGroup = (index: number, title: string) => {
        const next = groupList.map((item, i) => (i === index ? { ...item, title } : item));
        onChange({ groupList: next });
    };
    const addGroup = () => onChange({ groupList: [...groupList, { title: "新标签", link: { link: { link: "", title: "" }, linkTitle: "" } }] });
    const removeGroup = (index: number) => onChange({ groupList: groupList.filter((_, i) => i !== index) });

    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="标签导航">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {groupList.map((group, index) => (
                        <div key={index} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                                className="h5-editor-text-input"
                                value={group.title || ""}
                                onChange={(e) => setGroup(index, e.target.value)}
                                style={{ flex: 1, height: 28, border: "1px solid var(--semi-color-border)", borderRadius: 4, padding: "0 8px" }}
                            />
                            <span
                                style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: "50% 0 50% 50%",
                                    background: `linear-gradient(to bottom, ${data?.categoryColors?.[index % 6]?.colorA || "#ccc"}, ${data?.categoryColors?.[index % 6]?.colorB || "#ccc"})`,
                                    flexShrink: 0,
                                }}
                            />
                            <ButtonSmall onClick={() => removeGroup(index)} label="删除" />
                        </div>
                    ))}
                    <ButtonSmall onClick={addGroup} label="+ 添加标签" />
                </div>
                <NumberField data={data} onChange={onChange} field="textWeight" label="文字粗细" min={400} max={700} step={300} />
                <NumberField data={data} onChange={onChange} field="groupGap" label="标签间距" max={40} suffix="px" />
                <NumberField data={data} onChange={onChange} field="groupPadding" label="标签内边距" max={30} suffix="px" />
                <ColorField data={data} onChange={onChange} field="titleColor" label="标题文字颜色" />
                <ColorPairListField data={data} onChange={onChange} field="categoryColors" label="标签配色（循环取用）" defaults={DEFAULT_COLORS} />
            </SettingGroup>
        </div>
    );
}

function ButtonSmall({ onClick, label }: { onClick: () => void; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                height: 26,
                padding: "0 10px",
                fontSize: 12,
                border: "1px solid var(--semi-color-border)",
                borderRadius: 4,
                background: "transparent",
                cursor: "pointer",
            }}
        >
            {label}
        </button>
    );
}
