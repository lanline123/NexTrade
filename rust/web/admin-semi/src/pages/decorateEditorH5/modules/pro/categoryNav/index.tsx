/**
 * 类目导航 模块（契约自 view/admin editor/modules/mobilePro/categoryNav/index.ts 逐字段移植）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultAnimation, defaultModuleStyle, defaultContentStyle, defaultSubTitle } from "../../../contract/sharedDefaults";

/** 演示分类图（与旧 categoryNav/index.ts categoryList 一致，节选 5 项） */
const categoryList = [
    { picId: 1377, picThumb: "https://oss.tigshop.com/img/gallery/202411/1730957947YV2lncqLSOSg8OvpbK.png?x-oss-process=image/resize,m_pad,h_200,h_200", picUrl: "https://oss.tigshop.com/img/gallery/202411/1730957947YV2lncqLSOSg8OvpbK.png", picName: "dangrisuda", picTitle: "当日速达" },
    { picId: 1384, picThumb: "https://oss.tigshop.com/img/gallery/202411/1730957948LcXRbvCuwlCHyHy7Y0.png?x-oss-process=image/resize,m_pad,h_200,h_200", picUrl: "https://oss.tigshop.com/img/gallery/202411/1730957948LcXRbvCuwlCHyHy7Y0.png", picName: "xiuxianlingshi", picTitle: "休闲零食" },
    { picId: 1390, picThumb: "https://oss.tigshop.com/img/gallery/202411/1730957949mTiXqnQpGXzYHnNV.png?x-oss-process=image/resize,m_pad,h_200,h_200", picUrl: "https://oss.tigshop.com/img/gallery/202411/1730957949mTiXqnQpGXzYHnNV.png", picName: "richongyongpin", picTitle: "日常用品" },
    { picId: 1396, picThumb: "https://oss.tigshop.com/img/gallery/202411/1730957950bBFeVKuTtCEWKllS.png?x-oss-process=image/resize,m_pad,h_200,h_200", picUrl: "https://oss.tigshop.com/img/gallery/202411/1730957950bBFeVKuTtCEWKllS.png", picName: "shujiajianzhi", picTitle: "数码家电" },
    { picId: 1402, picThumb: "https://oss.tigshop.com/img/gallery/202411/1730957951pDjgKRAwAEZTKNwv.png?x-oss-process=image/resize,m_pad,h_200,h_200", picUrl: "https://oss.tigshop.com/img/gallery/202411/1730957951pDjgKRAwAEZTKNwv.png", picName: "meizhuang", picTitle: "美妆护肤" }
];

/** 与旧 mobilePro/categoryNav/index.ts 逐字段一致（契约） */
export const categoryNavDefaults = {
    listStyleType: "list", // list 固定 / slide 横向滑动
    categoryList,
    rowNum: 5,
    animation: defaultAnimation,
    picFillType: "cover",
    picPercent: 90,
    radius: 200,
    categoryPadding: 10,
    subTitle: defaultSubTitle,
    moduleStyle: defaultModuleStyle,
    contentStyle: defaultContentStyle
};

registerModule({
    type: "categoryNav",
    label: "类目导航",
    icon: '<i class="h5-mod-ico">🧭</i>',
    url: "mobilePro",
    platform: "mobile",
    order: 65,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(categoryNavDefaults)
});
