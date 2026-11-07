/**
 * 首焦轮播A2 模块（契约自 view/admin editor/modules/mobilePro/bannerA2/index.ts 逐字段移植）
 *
 * 毛玻璃背景大图 + 搜索框悬浮 + 轮播 + 指示器（跨境版首焦样式）。
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultModuleStyle } from "../../../contract/sharedDefaults";

const picList = [
    { picUrl: "https://oss.tigshop.com/img/gallery/202411/1730957947YV2lncqLSOSg8OvpbK.png", picThumb: "", picLink: { link: "", title: "" } },
    { picUrl: "https://oss.tigshop.com/img/gallery/202411/1730957948LcXRbvCuwlCHyHy7Y0.png", picThumb: "", picLink: { link: "", title: "" } }
];

/** 与旧 mobilePro/bannerA2/index.ts 逐字段一致（契约） */
export const bannerA2Defaults = {
    bannerContent: {
        picList,
        picRadius: 0,
        picPageType: 1, // 指示器样式 1/2
        swiperPageColor: "",
        indicatorColor: ""
    },
    searchContent: {
        showSearch: 1,
        searchText: "搜索商品"
    },
    bannerStyle: {
        effectType: "ceiling", // ceiling 滚动至顶部固定 / default 正常
        searchBackgroundColor: "#ffffff",
        searchFontColor: "#999999",
        searchIconColor: "#999999",
        searchText: "搜索",
        searchHeight: 34,
        searchRadius: 20
    },
    moduleStyle: defaultModuleStyle
};

registerModule({
    type: "bannerA2",
    label: "首焦轮播A2",
    icon: '<i class="h5-mod-ico">🌄</i>',
    url: "mobilePro",
    platform: "mobile",
    order: 68,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(bannerA2Defaults)
});
