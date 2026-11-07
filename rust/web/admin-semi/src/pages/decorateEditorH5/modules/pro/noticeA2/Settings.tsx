/**
 * 商城公告2 设置（字段对齐 view/admin mobilePro/noticeA2/Settings.vue）
 */
import { SettingGroup, TextField, NumberField, ColorField, RadioRowField, SinglePicField, SwitchField } from "../../../shared/settingWidgets";

export default function NoticeA2Settings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="商城公告">
                <TextField data={data} onChange={onChange} field="noticeContent" label="公告内容" />
                <RadioRowField
                    data={data}
                    onChange={onChange}
                    field="noticeIconType"
                    label="公告图标"
                    options={[
                        { value: "default", label: "默认" },
                        { value: "custom", label: "自定义" },
                        { value: "hide", label: "隐藏" },
                    ]}
                />
                {data?.noticeIconType === "custom" && <SinglePicField data={data} onChange={onChange} field="iconPic" label="自定义图标" />}
                <RadioRowField
                    data={data}
                    onChange={onChange}
                    field="nociceEffect"
                    label="公告文字效果"
                    options={[
                        { value: "scroll", label: "滚动" },
                        { value: "still", label: "静止" },
                    ]}
                />
                {data?.nociceEffect === "scroll" ? (
                    <NumberField data={data} onChange={onChange} field="scrollSpeed" label="滚动耗时" min={5} max={60} suffix="秒" />
                ) : (
                    <RadioRowField
                        data={data}
                        onChange={onChange}
                        field="textAlignment"
                        label="公告对齐方式"
                        options={[
                            { value: "left", label: "左对齐" },
                            { value: "center", label: "居中" },
                            { value: "right", label: "右对齐" },
                        ]}
                    />
                )}
                <ColorField data={data} onChange={onChange} field="contentColor" label="公告文字颜色" />
                <SwitchField data={data} onChange={onChange} field="closeIcon" label="显示关闭图标" />
            </SettingGroup>
        </div>
    );
}
