/**
 * 分类推荐 模块（契约自 view/admin editor/modules/mobilePro/categoryRec/index.ts 逐字段移植）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultAnimation, defaultModuleStyle, defaultContentStyle, defaultSubTitle } from "../../../contract/sharedDefaults";

/** 演示分类（与旧 categoryRec/index.ts categoryList 结构一致） */
const categoryList = [
    { title: "小零食", titleColor: "", backgroundColor: "", catPic: { picUrl: "https://oss.tigshop.com/img/gallery/202411/1730957948LcXRbvCuwlCHyHy7Y0.png", picThumb: "" } },
    { title: "粮油米面", titleColor: "", backgroundColor: "", catPic: { picUrl: "https://oss.tigshop.com/img/gallery/202411/1730957949mTiXqnQpGXzYHnNV.png", picThumb: "" } },
    { title: "洗发水", titleColor: "", backgroundColor: "", catPic: { picUrl: "https://oss.tigshop.com/img/gallery/202411/1730957951pDjgKRAwAEZTKNwv.png", picThumb: "" } }
];

/** 与旧 mobilePro/categoryRec/index.ts 逐字段一致（契约） */
export const categoryRecDefaults = {
    categoryList,
    animation: defaultAnimation,
    categoryPadding: 3,
    radius: 25,
    subTitle: defaultSubTitle,
    backgroundColor: "#fff",
    catBorder: 0,
    catBorderWidth: 1,
    catBorderColor: "#ffffff",
    moduleStyle: defaultModuleStyle,
    contentStyle: defaultContentStyle
};

registerModule({
    type: "categoryRec",
    label: "分类推荐",
    icon: '<i class="h5-mod-ico">🗂️</i>',
    url: "mobilePro",
    platform: "mobile",
    order: 66,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(categoryRecDefaults)
});
