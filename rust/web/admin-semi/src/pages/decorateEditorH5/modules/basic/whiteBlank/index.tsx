/**
 * 空白辅助 模块（契约自 view/admin editor/modules/mobile/whiteBlank/index.ts 逐字段移植）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep } from "../../../contract/sharedDefaults";

/** 与旧 mobile/whiteBlank/View.vue 的 defaultModule 逐字段一致（契约） */
export const whiteBlankDefaults = {
    backgroundColor: "",
    blankHeight: 30
};

registerModule({
    type: "whiteBlank",
    label: "空白辅助",
    icon: '<i class="h5-mod-ico">⬜</i>',
    url: "mobile",
    platform: "mobile",
    order: 8,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(whiteBlankDefaults)
});
