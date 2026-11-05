/**
 * 公告 设置（字段对齐 view/admin notice/Settings.vue）
 */
import { SettingGroup, TextField, RadioRowField, SinglePicField, FrameSettingsField } from "../../../shared/settingWidgets";

export default function NoticeSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="公告设置">
                <TextField data={data} onChange={onChange} field="text" label="公告文字" />
                <SinglePicField data={data} onChange={onChange} field="icoPic" label="公告图标" />
                <RadioRowField
                    data={data}
                    onChange={onChange}
                    field="nociceEffect"
                    label="公告文字效果"
                    options={[
                        { value: "scroll", label: "滚动" },
                        { value: "still", label: "静止" }
                    ]}
                />
            </SettingGroup>
            <FrameSettingsField data={data} onChange={onChange} label="边框设置" />
        </div>
    );
}
