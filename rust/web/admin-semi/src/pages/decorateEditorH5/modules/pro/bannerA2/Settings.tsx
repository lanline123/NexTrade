/**
 * 首焦轮播A2 设置（字段对齐 view/admin mobilePro/bannerA2/Settings.vue）
 */
import { SettingGroup, RadioRowField, NumberField, ColorField, PicListField, TextField, SwitchField } from "../../../shared/settingWidgets";

export default function BannerA2Settings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    const bannerContent = data?.bannerContent ?? {};
    const setBanner = (patch: Record<string, any>) => onChange({ bannerContent: { ...bannerContent, ...patch } });
    const searchContent = data?.searchContent ?? {};
    const setSearch = (patch: Record<string, any>) => onChange({ searchContent: { ...searchContent, ...patch } });
    const bannerStyle = data?.bannerStyle ?? {};
    const setStyle = (patch: Record<string, any>) => onChange({ bannerStyle: { ...bannerStyle, ...patch } });

    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="轮播内容">
                <PicListField data={bannerContent} onChange={setBanner} field="picList" label="轮播图片" max={10} />
                <NumberField data={bannerContent} onChange={setBanner} field="picRadius" label="图片圆角" max={40} suffix="px" />
                <RadioRowField
                    data={bannerContent}
                    onChange={setBanner}
                    field="picPageType"
                    label="指示器样式"
                    options={[
                        { value: 1, label: "圆点" },
                        { value: 2, label: "横条" },
                    ]}
                />
                <ColorField data={bannerContent} onChange={setBanner} field="swiperPageColor" label="指示器选中颜色" />
                <ColorField data={bannerContent} onChange={setBanner} field="indicatorColor" label="指示器默认颜色" />
            </SettingGroup>
            <SettingGroup title="搜索框">
                <SwitchField data={searchContent} onChange={setSearch} field="showSearch" label="显示搜索框" />
                {Number(searchContent?.showSearch) === 1 && <TextField data={searchContent} onChange={setSearch} field="searchText" label="搜索框文字" />}
            </SettingGroup>
            <SettingGroup title="样式设置">
                <ColorField data={bannerStyle} onChange={setStyle} field="searchBackgroundColor" label="搜索框背景颜色" />
                <ColorField data={bannerStyle} onChange={setStyle} field="searchFontColor" label="搜索框文本颜色" />
                <ColorField data={bannerStyle} onChange={setStyle} field="searchIconColor" label="搜索框图标颜色" />
                <NumberField data={bannerStyle} onChange={setStyle} field="searchHeight" label="搜索框高度" min={24} max={60} suffix="px" />
                <NumberField data={bannerStyle} onChange={setStyle} field="searchRadius" label="搜索框圆角" max={30} suffix="px" />
            </SettingGroup>
        </div>
    );
}
