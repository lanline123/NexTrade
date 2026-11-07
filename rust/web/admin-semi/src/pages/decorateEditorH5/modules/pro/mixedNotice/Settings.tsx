/**
 * 公告混排 设置（字段对齐 view/admin mobilePro/mixedNotice/Settings.vue）
 */
import { SettingGroup, ColorField } from "../../../shared/settingWidgets";

export default function MixedNoticeSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    const groups: Array<{ notices?: Array<Record<string, any>> }> = data?.noticeGroups || [];
    const setNotice = (gIndex: number, nIndex: number, patch: Record<string, any>) => {
        onChange({
            noticeGroups: groups.map((group, gi) =>
                gi === gIndex
                    ? { ...group, notices: (group.notices || []).map((notice, ni) => (ni === nIndex ? { ...notice, ...patch } : notice)) }
                    : group,
            ),
        });
    };
    const moduleColor = data?.moduleColor ?? {};
    const setColor = (patch: Record<string, any>) => onChange({ moduleColor: { ...moduleColor, ...patch } });

    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="公告内容">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {groups.map((group, gi) =>
                        (group.notices || []).map((notice, ni) => (
                            <div key={`${gi}-${ni}`} style={{ display: "flex", gap: 6 }}>
                                <input
                                    value={notice.picTitle || ""}
                                    placeholder="标题"
                                    onChange={(e) => setNotice(gi, ni, { picTitle: e.target.value })}
                                    style={{ width: 110, height: 28, border: "1px solid var(--semi-color-border)", borderRadius: 4, padding: "0 6px" }}
                                />
                                <input
                                    value={notice.picDesc || ""}
                                    placeholder="卖点描述"
                                    onChange={(e) => setNotice(gi, ni, { picDesc: e.target.value })}
                                    style={{ flex: 1, height: 28, border: "1px solid var(--semi-color-border)", borderRadius: 4, padding: "0 8px" }}
                                />
                            </div>
                        )),
                    )}
                </div>
            </SettingGroup>
            <SettingGroup title="模块颜色">
                <ColorField data={moduleColor} onChange={setColor} field="titleColor" label="大标题颜色" />
                <ColorField data={moduleColor} onChange={setColor} field="sellingPointColor" label="卖点颜色" />
            </SettingGroup>
        </div>
    );
}
