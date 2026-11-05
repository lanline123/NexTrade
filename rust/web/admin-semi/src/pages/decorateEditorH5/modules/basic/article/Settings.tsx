/**
 * 文章列表 设置（字段对齐 view/admin article/Settings.vue）
 */
import { SettingGroup, RadioRowField, NumberField, SwitchField, ColorField } from "../../../shared/settingWidgets";

export default function ArticleSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    const moduleColor = data?.moduleColor ?? {};
    const setColor = (patch: Record<string, any>) => onChange({ moduleColor: { ...moduleColor, ...patch } });
    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="文章列表">
                <RadioRowField
                    data={data}
                    onChange={onChange}
                    field="style"
                    label="模块风格"
                    options={[
                        { value: 1, label: "大图展示" },
                        { value: 2, label: "两列纵向" },
                        { value: 3, label: "两列横向" }
                    ]}
                />
                <NumberField data={data} onChange={onChange} field="articleNum" label="文章数量" max={50} />
                <SwitchField data={data} onChange={onChange} field="showTime" label="显示日期" />
                <SwitchField data={data} onChange={onChange} field="showPageView" label="显示阅读数" />
                <SwitchField data={data} onChange={onChange} field="showLike" label="显示点赞数" />
            </SettingGroup>
            <SettingGroup title="模块颜色">
                <ColorField data={moduleColor} onChange={setColor} field="articleNameColor" label="名称颜色" />
                <ColorField data={moduleColor} onChange={setColor} field="articleTimeColor" label="日期颜色" />
                <ColorField data={moduleColor} onChange={setColor} field="articleViewColor" label="阅读数颜色" />
                <ColorField data={moduleColor} onChange={setColor} field="articleLikeColor" label="点赞颜色" />
            </SettingGroup>
        </div>
    );
}
