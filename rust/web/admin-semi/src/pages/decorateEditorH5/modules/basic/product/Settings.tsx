/**
 * 商品 设置（对齐 view/admin editor/modules/mobile/product/Settings.vue）
 *
 * 选择模板（7 种）+ 扩展设置（frame/商品来源）+ 指示器颜色（样式7）+ 模块标题。
 */
import { SettingGroup, RadioRowField, ColorField, NumberField, TitleSettingsField, FrameSettingsField } from "../../../shared/settingWidgets";
import ProductsSourceField from "../../../shared/ProductsSourceField";

const STYLE_OPTIONS = [
    { value: 1, label: "一行一个" },
    { value: 2, label: "一行两个" },
    { value: 3, label: "一行三个" },
    { value: 4, label: "一大两小" },
    { value: 5, label: "详细列表" },
    { value: 6, label: "横向滑动" },
    { value: 7, label: "轮播滑动" },
];

export default function ProductSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="商品">
                <div style={{ color: '#646a73', fontSize: 12, marginBottom: 8 }}>
                    提示：仅“一行两个”模板类型支持<b style={{ color: '#333' }}>瀑布流</b>展示，为了展示效果，请尽量将瀑布流组件置于底部，一个页面不要超过一个
                </div>
                <RadioRowField data={data} onChange={onChange} field="style" label="选择模板" options={STYLE_OPTIONS} />
                <ProductsSourceField data={data} onChange={onChange} />
            </SettingGroup>
            <SettingGroup title="扩展设置">
                <ColorField data={data} onChange={onChange} field="backgroundColor" label="背景颜色" />
                <NumberField data={data} onChange={onChange} field="boxRadius" label="圆角" max={50} suffix="px" />
                <NumberField data={data} onChange={onChange} field="innerPadding" label="内边距" max={50} suffix="px" />
                <NumberField data={data} onChange={onChange} field="boxPadding" label="左右边距" max={50} suffix="px" />
                <NumberField data={data} onChange={onChange} field="boxPaddingTop" label="上边距" max={50} suffix="px" />
                <NumberField data={data} onChange={onChange} field="boxPaddingBottom" label="下边距" max={50} suffix="px" />
                <NumberField data={data} onChange={onChange} field="goodsPadding" label="商品间距" max={50} suffix="px" />
                <NumberField data={data} onChange={onChange} field="imgPadding" label="图片边距" max={50} suffix="px" />
            </SettingGroup>
            {Number(data?.style) === 7 ? (
                <SettingGroup title="轮播设置">
                    <ColorField data={data} onChange={onChange} field="swiperPageColor" label="指示器颜色" />
                </SettingGroup>
            ) : null}
            <TitleSettingsField data={data} onChange={onChange} label="模块标题" />
            <FrameSettingsField data={data} onChange={onChange} label="边框设置" />
        </div>
    );
}
