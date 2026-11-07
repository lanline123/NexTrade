/**
 * 商品搜索2 模块（契约自 view/admin editor/modules/mobile/searchBar2/index.ts 逐字段移植，跨境版样式）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultFrame, defaultIcoPic } from "../../../contract/sharedDefaults";

/** 与旧 mobile/searchBar2/index.ts searchBar2Defaults 逐字段一致（契约） */
export const searchBar2Defaults = {
    text: "搜索商品",
    icoPic: defaultIcoPic,
    frame: defaultFrame
};

registerModule({
    type: "searchBar2",
    label: "商品搜索2",
    icon: '<i class="h5-mod-ico">🔎</i>',
    url: "mobile",
    platform: "mobile",
    order: 15,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(searchBar2Defaults)
});
