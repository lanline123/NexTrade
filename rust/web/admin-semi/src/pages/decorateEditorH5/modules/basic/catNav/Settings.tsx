/**
 * 分类导航 设置（对齐 view/admin editor/modules/mobile/catNav/Settings.vue）
 */
import { SettingGroup, ColorField, NumberField, RadioRowField, SinglePicField, TextField } from "../../../shared/settingWidgets";

export default function CatNavSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="分类导航">
                <NumberField data={data} onChange={onChange} field="itemWidth" label="分类名宽度(%)" max={50} suffix="%" />
                <ColorField data={data} onChange={onChange} field="textColor" label="文字颜色" />
                <ColorField data={data} onChange={onChange} field="backgroundColor" label="背景颜色" />
                <SinglePicField data={data} onChange={onChange} field="navBackgroundPic" label="背景图" />
                <div style={{ color: '#646a73', fontSize: 12, margin: '4px 0 8px' }}>分类列表请在「移动端装修 → 分类导航」页面维护</div>
                <RadioRowField
                    data={data}
                    onChange={onChange}
                    field="isGanged"
                    label="搜索联动"
                    options={[
                        { value: 1, label: '联动' },
                        { value: 0, label: '不联动' },
                    ]}
                />
                <div style={{ color: '#646a73', fontSize: 12, margin: '4px 0 8px' }}>
                    设置为联动时，顶部会替换为LOGO栏+搜索栏+分类导航。屏幕下滑时LOGO栏会消失，搜索栏会替换至LOGO栏位置（请不要在该组件前再添加其它组件）。
                </div>
                <SinglePicField data={data} onChange={onChange} field="logoPic" label="LOGO图" />
                <div style={{ color: '#646a73', fontSize: 12, margin: '4px 0 8px' }}>提示：LOGO图建议尺寸为 1374px*324px，否则可能显示异常。</div>
                <NumberField data={data} onChange={onChange} field="logoHeight" label="LOGO高度" max={200} suffix="px" />
                <TextField data={data} onChange={onChange} field="searchText" label="搜索框文字" />
                <NumberField data={data} onChange={onChange} field="boxPadding" label="搜索框边距" max={50} suffix="px" />
                <ColorField data={data} onChange={onChange} field="searchTextColor" label="搜索文字颜色" />
                <ColorField data={data} onChange={onChange} field="itemBackgroundColor" label="搜索组件背景" />
                <NumberField data={data} onChange={onChange} field="itemRadius" label="搜索组件圆角" max={50} suffix="px" />
                <NumberField data={data} onChange={onChange} field="boxPaddingTop" label="上边距" max={50} suffix="px" />
                <NumberField data={data} onChange={onChange} field="boxPaddingBottom" label="下边距" max={50} suffix="px" />
            </SettingGroup>
        </div>
    );
}
