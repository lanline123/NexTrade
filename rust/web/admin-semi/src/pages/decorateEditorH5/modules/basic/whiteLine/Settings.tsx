/**
 * 分割线 设置（字段对齐 view/admin whiteLine/Settings.vue）
 */
import { SettingGroup, RadioRowField, FrameSettingsField } from "../../../shared/settingWidgets";

export default function WhiteLineSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="空白分割">
                <RadioRowField
                    data={data}
                    onChange={onChange}
                    field="lineType"
                    label="分割类型"
                    options={[
                        { value: 1, label: "空白" },
                        { value: 2, label: "分割线" }
                    ]}
                />
                {Number(data?.lineType) === 2 && (
                    <RadioRowField
                        data={data}
                        onChange={onChange}
                        field="lineStyle"
                        label="选择样式"
                        options={[
                            { value: 1, label: "实线" },
                            { value: 2, label: "虚线" },
                            { value: 3, label: "点状线" }
                        ]}
                    />
                )}
            </SettingGroup>
            <FrameSettingsField data={data} onChange={onChange} label="边框设置" />
        </div>
    );
}
