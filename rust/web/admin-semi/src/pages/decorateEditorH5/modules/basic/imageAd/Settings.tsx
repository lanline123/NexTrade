/**
 * 图片广告1 设置（字段对齐 view/admin imageAd/Settings.vue）
 */
import {
    SettingGroup,
    RadioRowField,
    NumberField,
    ColorField,
    PicListField,
    TitleSettingsField,
    FrameSettingsField
} from "../../../shared/settingWidgets";

export default function ImageAdSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="模板样式">
                <RadioRowField
                    data={data}
                    onChange={onChange}
                    field="picType"
                    label="选择模板"
                    options={[
                        { value: 1, label: "一行一个" },
                        { value: 2, label: "轮播海报" },
                        { value: 3, label: "横滑大图" },
                        { value: 4, label: "横滑小图" },
                        { value: 5, label: "一行两个" },
                        { value: 6, label: "一行三个" },
                        { value: 7, label: "一行四个" }
                    ]}
                />
                {Number(data?.picType) === 2 && (
                    <>
                        <RadioRowField
                            data={data}
                            onChange={onChange}
                            field="swiperPreView"
                            label="轮播行显示数量"
                            options={[
                                { value: 1, label: "1个" },
                                { value: 2, label: "2个" },
                                { value: 3, label: "3个" }
                            ]}
                        />
                        <RadioRowField
                            data={data}
                            onChange={onChange}
                            field="picPageType"
                            label="指示器样式"
                            options={[
                                { value: 1, label: "样式一" },
                                { value: 2, label: "样式二" },
                                { value: 3, label: "样式三" }
                            ]}
                        />
                        <ColorField data={data} onChange={onChange} field="swiperPageColor" label="指示器颜色" />
                    </>
                )}
                <NumberField data={data} onChange={onChange} field="imgPadding" label="图片边距" suffix="px" max={30} />
                <RadioRowField
                    data={data}
                    onChange={onChange}
                    field="picRadioStyle"
                    label="图片边角"
                    options={[
                        { value: 1, label: "直角" },
                        { value: 2, label: "圆角" }
                    ]}
                />
            </SettingGroup>
            <PicListField data={data} onChange={onChange} field="picList" label="图片广告" />
            <TitleSettingsField data={data} onChange={onChange} />
            <FrameSettingsField data={data} onChange={onChange} />
        </div>
    );
}
