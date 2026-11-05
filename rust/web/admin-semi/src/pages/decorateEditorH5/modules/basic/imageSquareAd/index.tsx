/**
 * 图片魔方 模块（契约自 view/admin editor/modules/mobile/imageSquareAd/index.ts 逐字段移植）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultFrame, defaultTitle } from "../../../contract/sharedDefaults";

/** 与 view/admin imageSquareAdDefaults 逐字段一致（契约） */
export const imageSquareAdDefaults = {
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
    type: "imageSquareAd",
    label: "图片魔方",
    icon: '<i class="h5-mod-ico">🖼️</i>',
    url: "mobile",
    platform: "mobile",
    order: 3,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(imageSquareAdDefaults)
});
