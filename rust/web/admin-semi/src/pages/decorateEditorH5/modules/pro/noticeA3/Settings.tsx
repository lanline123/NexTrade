/**
 * 商城公告3 设置（字段对齐 view/admin mobilePro/noticeA3/Settings.vue）
 */
import { SettingGroup, NumberField, ColorField, SwitchField, SinglePicField } from "../../../shared/settingWidgets";

export default function NoticeA3Settings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    const noticeList: Array<{ title?: string; prefix?: string }> = data?.noticeList || [];
    const setRow = (index: number, patch: Record<string, any>) => {
        onChange({ noticeList: noticeList.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
    };
    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="公告内容">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {noticeList.map((item, index) => (
                        <div key={index} style={{ display: "flex", gap: 6 }}>
                            <input
                                value={item.prefix || ""}
                                placeholder="前缀"
                                onChange={(e) => setRow(index, { prefix: e.target.value })}
                                style={{ width: 60, height: 28, border: "1px solid var(--semi-color-border)", borderRadius: 4, padding: "0 6px" }}
                            />
                            <input
                                value={item.title || ""}
                                placeholder="公告标题"
                                onChange={(e) => setRow(index, { title: e.target.value })}
                                style={{ flex: 1, height: 28, border: "1px solid var(--semi-color-border)", borderRadius: 4, padding: "0 8px" }}
                            />
                        </div>
                    ))}
                </div>
            </SettingGroup>
            <SettingGroup title="样式设置">
                <SwitchField data={data} onChange={onChange} field="showHeader" label="显示头图" />
                {Number(data?.showHeader) === 1 && (
                    <>
                        <SinglePicField data={data} onChange={onChange} field="headerImage" label="头图" />
                        <NumberField data={data} onChange={onChange} field="headerImageWidth" label="头图宽度" max={120} suffix="px" />
                    </>
                )}
                <SwitchField data={data} onChange={onChange} field="showPrefix" label="显示前缀标签" />
                <ColorField data={data} onChange={onChange} field="textColor" label="文字颜色" />
                <SwitchField data={data} onChange={onChange} field="showBorder" label="显示边框" />
                {Number(data?.showBorder) === 1 && <ColorField data={data} onChange={onChange} field="borderColor" label="边框颜色" />}
                <ColorField data={data} onChange={onChange} field="contentBgColor" label="内容背景色" />
            </SettingGroup>
        </div>
    );
}
