/**
 * 类目导航 设置（字段对齐 view/admin mobilePro/categoryNav/Settings.vue）
 */
import { SettingGroup, RadioRowField, SelectField, NumberField, PicListField } from "../../../shared/settingWidgets";

export default function CategoryNavSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="类目导航">
                <PicListField data={data} onChange={onChange} field="categoryList" label="分类图片" max={30} />
                <RadioRowField
                    data={data}
                    onChange={onChange}
                    field="listStyleType"
                    label="列表样式"
                    options={[
                        { value: "list", label: "固定" },
                        { value: "slide", label: "横向滑动" },
                    ]}
                />
                <NumberField data={data} onChange={onChange} field="rowNum" label="行数" min={2} max={6} />
                <NumberField data={data} onChange={onChange} field="picPercent" label="图片百分比" min={50} max={100} suffix="%" />
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
                <NumberField data={data} onChange={onChange} field="radius" label="圆角" max={200} suffix="px" />
                <NumberField data={data} onChange={onChange} field="categoryPadding" label="分类间距" max={30} suffix="px" />
            </SettingGroup>
        </div>
    );
}
