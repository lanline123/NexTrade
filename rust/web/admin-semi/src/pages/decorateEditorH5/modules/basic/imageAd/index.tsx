/**
 * 图片广告1 模块（契约自 view/admin editor/modules/mobile/imageAd/index.ts 逐字段移植）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultFrame, defaultTitle } from "../../../contract/sharedDefaults";

/** 与 view/admin imageAdDefaults 逐字段一致（契约） */
export const imageAdDefaults = {
    picType: 1,
    picList: [],
    swiperPreView: 1,
    swiperPageColor: "",
    imgPadding: 0,
    picPageType: 1,
    picRadioStyle: 1,
    isFluxWidth: 0,
    frame: defaultFrame,
    title: defaultTitle
};

registerModule({
    type: "imageAd",
    label: "图片广告1",
    icon: '<i class="h5-mod-ico">🖼️</i>',
    url: "mobile",
    platform: "mobile",
    order: 1,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(imageAdDefaults)
});
