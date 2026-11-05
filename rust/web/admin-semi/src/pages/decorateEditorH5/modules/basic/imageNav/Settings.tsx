/**
 * 图文导航 设置（字段对齐 view/admin imageNav/Settings.vue）
 */
import {
    SettingGroup,
    RadioRowField,
    SelectField,
    NumberField,
    ColorField,
    PicListField,
    FrameSettingsField
} from "../../../shared/settingWidgets";

export default function ImageNavSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="图文导航">
                <RadioRowField
                    data={data}
                    onChange={onChange}
                    field="navType"
                    label="显示模式"
                    options={[
                        { value: 1, label: "固定显示" },
                        { value: 2, label: "滑动分页" }
                    ]}
                />
                <RadioRowField
                    data={data}
                    onChange={onChange}
                    field="navStyle"
                    label="样式"
                    options={[
                        { value: 1, label: "图片文字" },
                        { value: 2, label: "仅图片" },
                        { value: 3, label: "仅文字" }
                    ]}
                />
                {Number(data?.navType) === 1 ? (
                    <>
                        <SelectField
                            data={data}
                            onChange={onChange}
                            field="rowNum"
                            label="一行显示"
                            options={[
                                { value: 3, label: "3个" },
                                { value: 4, label: "4个" },
                                { value: 5, label: "5个" },
                                { value: 6, label: "6个" }
                            ]}
                        />
                        <SelectField
                            data={data}
                            onChange={onChange}
                            field="colNum"
                            label="显示行数"
                            options={[
                                { value: 1, label: "1行" },
                                { value: 2, label: "2行" },
                                { value: 3, label: "3行" }
                            ]}
                        />
                    </>
                ) : null}
                <PicListField data={data} onChange={onChange} field="picList" label="导航图片（图片+文字+链接）" />
                <NumberField data={data} onChange={onChange} field="imgPadding" label="元素边距" suffix="px" max={30} />
                <RadioRowField
                    data={data}
                    onChange={onChange}
                    field="radioStyle"
                    label="图片边角"
                    options={[
                        { value: 1, label: "直角" },
                        { value: 2, label: "圆角" }
                    ]}
                />
                {Number(data?.navType) === 2 ? (
                    <>
                        <RadioRowField
                            data={data}
                            onChange={onChange}
                            field="picPageType"
                            label="指示器样式"
                            options={[
                                { value: 1, label: "样式一" },
                                { value: 2, label: "样式二" }
                            ]}
                        />
                        <ColorField data={data} onChange={onChange} field="swiperPageColor" label="指示器颜色" />
                    </>
                ) : null}
            </SettingGroup>
            <FrameSettingsField data={data} onChange={onChange} label="边框设置" />
        </div>
    );
}
