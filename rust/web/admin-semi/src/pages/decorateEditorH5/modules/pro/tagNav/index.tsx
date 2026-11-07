/**
 * 标签导航 模块（契约自 view/admin editor/modules/mobilePro/tagNav/index.ts + 共享 defaultTagNav 移植）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultModuleStyle } from "../../../contract/sharedDefaults";

/** 与旧 shared defaultTagNav 逐字段一致（契约） */
export const tagNavDefaults = {
    groupList: [
        { title: "肠胃", link: { link: { link: "", title: "" }, linkTitle: "" } },
        { title: "咽炎", link: { link: { link: "", title: "" }, linkTitle: "" } },
        { title: "上火", link: { link: { link: "", title: "" }, linkTitle: "" } },
        { title: "肾虚", link: { link: { link: "", title: "" }, linkTitle: "" } },
        { title: "减肥", link: { link: { link: "", title: "" }, linkTitle: "" } },
        { title: "失眠", link: { link: { link: "", title: "" }, linkTitle: "" } }
    ],
    textWeight: 700,
    groupGap: 10,
    groupPadding: 10,
    categoryColors: [
        { colorA: "#5FC1E8", colorB: "#5FC1E8" },
        { colorA: "#F5A623", colorB: "#F5A623" },
        { colorA: "#FF5C3A", colorB: "#FF5C3A" },
        { colorA: "#FF6B7A", colorB: "#FF6B7A" },
        { colorA: "#8BC53F", colorB: "#8BC53F" },
        { colorA: "#2BC4B4", colorB: "#2BC4B4" }
    ],
    titleColor: "#ffffff",
    moduleStyle: cloneDeep(defaultModuleStyle)
};

registerModule({
    type: "tagNav",
    label: "标签导航",
    icon: '<i class="h5-mod-ico">🏷️</i>',
    url: "mobilePro",
    platform: "mobile",
    order: 62,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(tagNavDefaults)
});
