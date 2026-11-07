/**
 * 商品搜索 设置（对齐 view/admin editor/modules/mobile/searchBar/Settings.vue）
 *
 * 搜索框文字 + 边框设置（CommonFrameEdit：背景/圆角/搜索组件背景/高度/圆角/文字颜色）。
 */
import { SettingGroup, TextField, ColorField, NumberField } from "../../../shared/settingWidgets";

export default function SearchBarSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    const frame = (data?.frame || {}) as Record<string, any>;
    const setFrame = (patch: Record<string, any>) => onChange({ frame: { ...frame, ...patch } });
    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="商品搜索">
                <TextField data={data} onChange={onChange} field="text" label="搜索框文字" />
            </SettingGroup>
            <SettingGroup title="搜索组件">
                <ColorField data={frame} onChange={setFrame} field="itemBackgroundColor" label="搜索组件背景" />
                <NumberField data={frame} onChange={setFrame} field="itemHeight" label="搜索组件高度" max={100} suffix="px" />
                <NumberField data={frame} onChange={setFrame} field="itemRadius" label="搜索组件圆角" max={50} suffix="px" />
                <ColorField data={frame} onChange={setFrame} field="textColor" label="文字颜色" />
            </SettingGroup>
        </div>
    );
}
