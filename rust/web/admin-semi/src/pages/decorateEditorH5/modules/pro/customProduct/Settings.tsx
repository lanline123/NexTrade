/**
 * 个性商品 设置（旧版模块不进工具栏，设置面板仅保留占位说明）
 */
import { SettingGroup } from "../../../shared/settingWidgets";

export default function CustomProductSettings() {
    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="个性商品">
                <div style={{ color: '#646a73', fontSize: 12 }}>
                    该模块在旧版工具栏中已停用（仅保证历史页面数据可渲染），建议改用「商品」或「商品2」模块。
                </div>
            </SettingGroup>
        </div>
    );
}
