/**
 * 公告混排 模块（契约自 view/admin editor/modules/mobilePro/mixedNotice/index.ts 逐字段移植）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultModuleStyle, defaultContentStyle } from "../../../contract/sharedDefaults";

/** 演示公告分组（与旧 mixedNotice/index.ts groups 一致，节选） */
const groups = [
    {
        notices: [
            {
                picId: 1428,
                picThumb: "https://oss.tigshop.com/img/gallery/202507/1752202673o7FOMjRwwsNOXB8OjP.png?x-oss-process=image/resize,m_pad,h_200,h_200",
                picUrl: "https://oss.tigshop.com/img/gallery/202507/1752202673o7FOMjRwwsNOXB8OjP.png",
                picName: "FmBvbpIyBQcPAjaR1tpYu4NSfM2L",
                picTitle: "免运费",
                picDesc: "前三单购物均可免运费！"
            }
        ]
    },
    {
        notices: [
            {
                picId: 1428,
                picThumb: "https://oss.tigshop.com/img/gallery/202507/1752202678mQIAJqOXqUO54YdFfj.png?x-oss-process=image/resize,m_pad,h_200,h_200",
                picUrl: "https://oss.tigshop.com/img/gallery/202507/1752202678mQIAJqOXqUO54YdFfj.png",
                picName: "FmBvbpIyBQcPAjaR1tpYu4NSfM2L",
                picTitle: "24*7客户支持",
                picDesc: "随时随地提供保障"
            },
            {
                picId: 1428,
                picThumb: "https://oss.tigshop.com/img/gallery/202507/1752202678mQIAJqOXqUO54YdFfj.png?x-oss-process=image/resize,m_pad,h_200,h_200",
                picUrl: "https://oss.tigshop.com/img/gallery/202507/1752202678mQIAJqOXqUO54YdFfj.png",
                picName: "FmBvbpIyBQcPAjaR1tpYu4NSfM2L",
                picTitle: "售后无忧",
                picDesc: "7 天无理由退换"
            }
        ]
    }
];

/** 与旧 mobilePro/mixedNotice/index.ts 逐字段一致（契约） */
export const mixedNoticeDefaults = {
    noticeGroups: groups,
    moduleColor: {
        titleColor: "#171B1E",
        sellingPointColor: "#999999"
    },
    moduleStyle: defaultModuleStyle,
    contentStyle: defaultContentStyle
};

registerModule({
    type: "mixedNotice",
    label: "公告混排",
    icon: '<i class="h5-mod-ico">📢</i>',
    url: "mobilePro",
    platform: "mobile",
    order: 67,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(mixedNoticeDefaults)
});
