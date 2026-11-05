/**
 * 图文导航 模块（契约自 view/admin editor/modules/mobile/imageNav/index.ts 逐字段移植）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultFrame } from "../../../contract/sharedDefaults";

/** 与 view/admin imageNavDefaults 逐字段一致（契约） */
export const imageNavDefaults = {
    navType: 1,
    navStyle: 1,
    rowNum: 4,
    colNum: 2,
    picList: [],
    imgPadding: 8,
    radioStyle: 1,
    picPageType: 1,
    swiperPageColor: "",
    frame: defaultFrame
};

registerModule({
    type: "imageNav",
    label: "图文导航",
    icon: '<i class="h5-mod-ico">🖼️</i>',
    url: "mobile",
    platform: "mobile",
    order: 9,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(imageNavDefaults)
});
