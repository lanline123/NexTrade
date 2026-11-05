/**
 * 图片广告2 设置（字段对齐 view/admin imageAd2/Settings.vue）
 */
import {
    SettingGroup,
    RadioRowField,
    NumberField,
    ColorField,
    SelectField,
    PicListField,
    TitleSettingsField,
    FrameSettingsField
} from "../../../shared/settingWidgets";

export default function ImageAd2Settings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="选择模板">
                <RadioRowField
                    data={data}
                    onChange={onChange}
                    field="picType"
                    label="选择模板"
                    options={[
                        { value: 1, label: "一行一个" },
                        { value: 2, label: "轮播" },
                        { value: 3, label: "横向滑动-大图" },
                        { value: 4, label: "横向滑动-小图" },
                        { value: 5, label: "一行两个" },
                        { value: 6, label: "一行三个" },
                        { value: 7, label: "一行四个" }
                    ]}
                />
            </SettingGroup>
            <SettingGroup title="添加图片">
                <PicListField data={data} onChange={onChange} field="picList" label="添加图片" />
            </SettingGroup>
            {Number(data?.picType) === 2 && (
                <>
                    <SettingGroup title="轮播指示器">
                        <RadioRowField
                            data={data}
                            onChange={onChange}
                            field="showIndicator"
                            label="是否显示指示器"
                            options={[
                                { value: 1, label: "是" },
                                { value: 0, label: "否" }
                            ]}
                        />
                        {Number(data?.showIndicator) === 1 && (
                            <>
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
                        <SelectField
                            data={data}
                            onChange={onChange}
                            field="swiperPreView"
                            label="轮播一行显示"
                            options={[
                                { value: 1, label: "1个" },
                                { value: 2, label: "2个" },
                                { value: 3, label: "3个" },
                                { value: 4, label: "4个" }
                            ]}
                        />
                    </SettingGroup>
                </>
            )}
            <SettingGroup title="图片设置">
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
                <RadioRowField
                    data={data}
                    onChange={onChange}
                    field="isFluxWidth"
                    label="是否通宽排版(仅PC端有效)"
                    options={[
                        { value: 1, label: "是" },
                        { value: 0, label: "否" }
                    ]}
                />
            </SettingGroup>
            <TitleSettingsField data={data} onChange={onChange} />
            <FrameSettingsField data={data} onChange={onChange} />
        </div>
    );
}
