/**
 * 文本标题 模块（契约自 view/admin editor/modules/mobile/titleAd/index.ts 逐字段移植）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultFrame, defaultTitle } from "../../../contract/sharedDefaults";

/** 与旧 mobile/titleAd/View.vue 的 defaultModule 逐字段一致（契约） */
export const titleAdDefaults = {
    frame: defaultFrame,
    title: defaultTitle
};

registerModule({
    type: "titleAd",
    label: "文本标题",
    icon: '<i class="h5-mod-ico">🅰️</i>',
    url: "mobile",
    platform: "mobile",
    order: 10,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(titleAdDefaults)
});
