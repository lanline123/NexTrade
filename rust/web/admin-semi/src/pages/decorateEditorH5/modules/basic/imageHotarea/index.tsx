/**
 * 热图绘制 模块（契约自 view/admin editor/modules/mobile/imageHotarea/index.ts 逐字段移植）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultFrame, defaultTitle } from "../../../contract/sharedDefaults";

/** 与 view/admin imageHotareaDefaults 逐字段一致（契约） */
export const imageHotareaDefaults = {
    picList: [],
    imgPadding: 0,
    picRadioStyle: 1,
    frame: defaultFrame,
    title: defaultTitle
};

registerModule({
    type: "imageHotarea",
    label: "热图绘制",
    icon: '<i class="h5-mod-ico">🖼️</i>',
    url: "mobile",
    platform: "mobile",
    order: 4,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(imageHotareaDefaults)
});
