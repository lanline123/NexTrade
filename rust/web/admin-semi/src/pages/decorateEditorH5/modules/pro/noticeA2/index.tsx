/**
 * 商城公告2 模块（契约自 view/admin editor/modules/mobilePro/noticeA2/index.ts 逐字段移植）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultModuleStyle, defaultContentStyle } from "../../../contract/sharedDefaults";

/** 与旧 mobilePro/noticeA2/index.ts 逐字段一致（契约） */
export const noticeA2Defaults = {
    noticeContent: "本店新用户首单0元起送，更多大牌好物低至6.6折起！！", // 公告内容
    nociceLink: { link: { link: "", title: "" } }, // 公告链接
    nociceEffect: "scroll", // 公告滚动效果 scroll / still
    scrollSpeed: 13, // 滚动耗时（秒）
    textAlignment: "center", // still 时的对齐方式
    noticeIconType: "default", // 公告图标 default / hide / custom
    iconPic: { picUrl: "", picThumb: "" },
    contentColor: "#333333",
    closeIcon: 0, // 关闭图标 1 显示 0 隐藏
    moduleStyle: defaultModuleStyle,
    contentStyle: defaultContentStyle
};

registerModule({
    type: "noticeA2",
    label: "商城公告2",
    icon: '<i class="h5-mod-ico">📢</i>',
    url: "mobilePro",
    platform: "mobile",
    order: 63,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(noticeA2Defaults)
});
