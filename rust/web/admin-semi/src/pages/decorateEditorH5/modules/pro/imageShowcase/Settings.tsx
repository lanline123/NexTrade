/**
 * 图片橱窗 设置（字段对齐 view/admin mobilePro/imageShowcase/Settings.vue）
 */
import { SettingGroup, RadioRowField, SelectField, NumberField, SwitchField, PicListField } from "../../../shared/settingWidgets";

export default function ImageShowcaseSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="图片橱窗">
                <PicListField data={data} onChange={onChange} field="picList" label="图片组" max={20} />
                <SelectField
                    data={data}
                    onChange={onChange}
                    field="listStyle"
                    label="列表样式"
                    options={[
                        { value: "fixed", label: "固定网格" },
                        { value: "scroll", label: "横向滑动" },
                    ]}
                />
                <NumberField data={data} onChange={onChange} field="rowNum" label="每行数量" min={1} max={10} />
                <SelectField
                    data={data}
                    onChange={onChange}
                    field="picRatio"
                    label="图片比例"
                    options={[
                        { value: "default", label: "自适应" },
                        { value: "3:2", label: "3:2" },
                        { value: "1:1", label: "1:1" },
                        { value: "3:4", label: "3:4" },
                        { value: "2:1", label: "2:1" },
                        { value: "16:9", label: "16:9" },
                    ]}
                />
                <SelectField
                    data={data}
                    onChange={onChange}
                    field="picFillType"
                    label="图片填充"
                    options={[
                        { value: "cover", label: "填充" },
                        { value: "contain", label: "留白" },
                    ]}
                />
                <NumberField data={data} onChange={onChange} field="picRadius" label="图片圆角" max={50} suffix="px" />
                <NumberField data={data} onChange={onChange} field="imgPadding" label="图片间距" max={30} suffix="px" />
                <SwitchField data={data} onChange={onChange} field="boxShadow" label="显示阴影" />
            </SettingGroup>
        </div>
    );
}
