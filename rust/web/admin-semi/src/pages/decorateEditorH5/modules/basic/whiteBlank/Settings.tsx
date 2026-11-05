/**
 * 空白辅助 设置（字段对齐 view/admin whiteBlank/Settings.vue）
 */
import { ColorField, NumberField } from "../../../shared/settingWidgets";

export default function WhiteBlankSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    return (
        <div className="h5-editor-settings-body">
            <ColorField data={data} onChange={onChange} field="backgroundColor" label="背景颜色" allowEmpty={false} />
            <NumberField data={data} onChange={onChange} field="blankHeight" label="空白高度" suffix="px" max={100} />
        </div>
    );
}
