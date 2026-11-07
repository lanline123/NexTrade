/**
 * 分类导航 模块（契约自 view/admin editor/modules/mobile/catNav/index.ts 逐字段移植）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultFrame, defaultIcoPic, defaultBackgroundPic } from "../../../contract/sharedDefaults";

/** 与旧 mobile/catNav/index.ts catNavDefaults 逐字段一致（契约） */
export const catNavDefaults = {
    navBackgroundPic: defaultBackgroundPic,
    logoPic: defaultIcoPic,
    itemWidth: 50,
    textColor: "",
    backgroundColor: "",
    itemBackgroundColor: "",
    searchTextColor: "",
    isGanged: 0,
    logoHeight: 0,
    searchText: "搜索商品",
    boxPadding: 10,
    itemRadius: 3,
    boxPaddingTop: 5,
    boxPaddingBottom: 5,
    frame: defaultFrame
};

registerModule({
    type: "catNav",
    label: "分类导航",
    icon: '<i class="h5-mod-ico">🧭</i>',
    url: "mobile",
    platform: "mobile",
    order: 16,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(catNavDefaults)
});
