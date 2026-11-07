/**
 * 分类推荐 设置（字段对齐 view/admin mobilePro/categoryRec/Settings.vue）
 */
import { SettingGroup, NumberField, ColorField, SwitchField } from "../../../shared/settingWidgets";

export default function CategoryRecSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    const categoryList: Array<Record<string, any>> = data?.categoryList || [];
    const setRow = (index: number, patch: Record<string, any>) => {
        onChange({ categoryList: categoryList.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
    };
    const subTitle = data?.subTitle ?? {};
    const setSubTitle = (patch: Record<string, any>) => onChange({ subTitle: { ...subTitle, ...patch } });

    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="分类列表">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {categoryList.map((item, index) => (
                        <div key={index} style={{ display: "flex", gap: 6 }}>
                            <input
                                value={item.title || ""}
                                placeholder="分类名"
                                onChange={(e) => setRow(index, { title: e.target.value })}
                                style={{ width: 90, height: 28, border: "1px solid var(--semi-color-border)", borderRadius: 4, padding: "0 6px" }}
                            />
                            <input
                                value={item.titleColor || ""}
                                placeholder="标题色 #hex"
                                onChange={(e) => setRow(index, { titleColor: e.target.value })}
                                style={{ width: 110, height: 28, border: "1px solid var(--semi-color-border)", borderRadius: 4, padding: "0 6px" }}
                            />
                            <input
                                value={item.backgroundColor || ""}
                                placeholder="背景色 #hex"
                                onChange={(e) => setRow(index, { backgroundColor: e.target.value })}
                                style={{ width: 110, height: 28, border: "1px solid var(--semi-color-border)", borderRadius: 4, padding: "0 6px" }}
                            />
                        </div>
                    ))}
                </div>
            </SettingGroup>
            <SettingGroup title="样式设置">
                <NumberField data={data} onChange={onChange} field="categoryPadding" label="分类间距" max={30} suffix="px" />
                <NumberField data={data} onChange={onChange} field="radius" label="圆角" max={100} suffix="px" />
                <ColorField data={data} onChange={onChange} field="backgroundColor" label="背景颜色" />
                <SwitchField data={data} onChange={onChange} field="catBorder" label="显示分类边框" />
                {Number(data?.catBorder) === 1 && (
                    <>
                        <NumberField data={data} onChange={onChange} field="catBorderWidth" label="边框宽度" min={1} max={10} suffix="px" />
                        <ColorField data={data} onChange={onChange} field="catBorderColor" label="边框颜色" />
                    </>
                )}
                <NumberField data={subTitle} onChange={setSubTitle} field="titleFontSize" label="标题字号" min={10} max={24} suffix="px" />
                <NumberField data={subTitle} onChange={setSubTitle} field="titleFontBold" label="标题粗细" min={400} max={700} step={300} />
                <ColorField data={subTitle} onChange={setSubTitle} field="titleColor" label="标题颜色" />
            </SettingGroup>
        </div>
    );
}
