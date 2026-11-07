/**
 * 图文介绍 设置（字段对齐 view/admin mobilePro/imageTextComponent/Settings.vue）
 */
import { SettingGroup, TextField, NumberField, ColorField, SinglePicField, RadioRowField } from "../../../shared/settingWidgets";

export default function ImageTextComponentSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="图文介绍">
                <SinglePicField data={data} onChange={onChange} field="picUrl" label="图片" />
                <TextField data={data} onChange={onChange} field="title" label="标题文字" />
                <TextField data={data} onChange={onChange} field="description" label="介绍文字" />
                <NumberField data={data} onChange={onChange} field="picBorder" label="图片边框" max={10} suffix="px" />
                <ColorField data={data} onChange={onChange} field="picBorderColor" label="图片边框颜色" />
                <NumberField data={data} onChange={onChange} field="picRadius" label="图片圆角半径" max={50} suffix="px" />
                <RadioRowField
                    data={data}
                    onChange={onChange}
                    field="titTextAlignment"
                    label="标题对齐方式"
                    options={[
                        { value: "left", label: "左对齐" },
                        { value: "center", label: "居中" },
                        { value: "right", label: "右对齐" },
                    ]}
                />
                <NumberField data={data} onChange={onChange} field="titMarginBottom" label="标题介绍间距" max={50} suffix="px" />
                <ColorField data={data} onChange={onChange} field="titColor" label="标题文字颜色" />
                <RadioRowField
                    data={data}
                    onChange={onChange}
                    field="descTextAlignment"
                    label="介绍对齐方式"
                    options={[
                        { value: "left", label: "左对齐" },
                        { value: "center", label: "居中" },
                        { value: "right", label: "右对齐" },
                    ]}
                />
                <ColorField data={data} onChange={onChange} field="descColor" label="介绍文字颜色" />
            </SettingGroup>
        </div>
    );
}
