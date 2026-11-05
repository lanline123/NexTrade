/**
 * 文本标题 设置（字段对齐 view/admin titleAd/Settings.vue：模块标题 + 边框）
 */
import { TitleSettingsField, FrameSettingsField } from "../../../shared/settingWidgets";

export default function TitleAdSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    return (
        <div className="h5-editor-settings-body">
            <TitleSettingsField data={data} onChange={onChange} />
            <FrameSettingsField data={data} onChange={onChange} label="边框设置" />
        </div>
    );
}
