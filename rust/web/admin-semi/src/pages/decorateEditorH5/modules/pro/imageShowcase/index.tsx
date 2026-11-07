/**
 * 图片橱窗 模块（契约自 view/admin editor/modules/mobilePro/imageShowcase/index.ts + 共享 defaultImageShowcase 移植）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultModuleStyle, defaultContentStyle } from "../../../contract/sharedDefaults";

/** 图片橱窗演示图（与旧 shared defaultImageShowcaseDemoPics 一致） */
export const imageShowcaseDemoPics = [
    "https://oss.tigshop.com/official/img/pc/202605/1779261324QXU5nLdH8b4qUF4CM9.png",
    "https://oss.tigshop.com/official/img/pc/202605/1779261403hf5gGaRtlmALGOCmT6.png",
    "https://oss.tigshop.com/official/img/pc/202605/1779261407JZ1O44iECmXJHhfmiL.png",
    "https://oss.tigshop.com/official/img/pc/202605/1779261410fhPHeqONn0LxCVgtRZ.png",
].map((url) => ({ picUrl: url, picThumb: url, picLink: { link: "", title: "" } }));

/** 与旧 shared defaultImageShowcase 逐字段一致（契约） */
export const imageShowcaseDefaults = {
    picList: cloneDeep(imageShowcaseDemoPics),
    rowNum: 4,
    listStyle: "fixed",
    picRatio: "default",
    picFillType: "cover",
    picRadius: 8,
    imgPadding: 4,
    boxShadow: 1,
    moduleStyle: cloneDeep(defaultModuleStyle),
    contentStyle: cloneDeep(defaultContentStyle)
};

/** 比例字面量 → padding-top 百分比（与旧 shared imageShowcasePaddingMap 一致） */
export const imageShowcasePaddingMap: Record<string, string> = {
    default: "",
    "3:2": "66.667%",
    "1:1": "100%",
    "3:4": "133.333%",
    "2:1": "50%",
    "16:9": "56.25%"
};

registerModule({
    type: "imageShowcase",
    label: "图片橱窗",
    icon: '<i class="h5-mod-ico">🖼️</i>',
    url: "mobilePro",
    platform: "mobile",
    order: 61,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(imageShowcaseDefaults)
});
