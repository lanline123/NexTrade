/**
 * 分割线 模块（契约自 view/admin editor/modules/mobile/whiteLine/index.ts 逐字段移植）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultFrame } from "../../../contract/sharedDefaults";

/** 与旧 mobile/whiteLine/View.vue 的 defaultModule 逐字段一致（契约） */
export const whiteLineDefaults = {
    lineType: 1,
    lineStyle: 1,
    frame: defaultFrame
};

registerModule({
    type: "whiteLine",
    label: "分割线",
    icon: '<i class="h5-mod-ico">➖</i>',
    url: "mobile",
    platform: "mobile",
    order: 7,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(whiteLineDefaults)
});
