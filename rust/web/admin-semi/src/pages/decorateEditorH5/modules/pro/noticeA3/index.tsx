/**
 * 商城公告3 模块（契约自 view/admin editor/modules/mobilePro/noticeA3/index.ts 逐字段移植）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultModuleStyle, defaultContentStyle } from "../../../contract/sharedDefaults";

const defaultNoticeList = [
    { title: "感恩大回馈，优惠大酬宾，先到先得,更多优惠等你来", prefix: "新品", link: {} },
    { title: "感恩大回馈，优惠大酬宾，先到先得,更多优惠等你来", prefix: "新品", link: {} }
];

/** 与旧 mobilePro/noticeA3/index.ts 逐字段一致（契约） */
export const noticeA3Defaults = {
    noticeList: defaultNoticeList,
    showHeader: 1,
    headerImageWidth: 48,
    textColor: "#666666",
    headerImage: {
        picUrl: "https://oss.tigshop.com/official/img/pc/202605/1779266900kyNhWWRQpNHEigvIfz.png",
        picThumb: "https://oss.tigshop.com/official/img/pc/202605/1779266900kyNhWWRQpNHEigvIfz.png?x-oss-process=image/resize,m_pad,h_200,h_200"
    },
    borderColor: "",
    contentBgColor: "",
    showPrefix: 1,
    showBorder: 0,
    moduleStyle: {
        ...defaultModuleStyle,
        boxPaddingTop: 5,
        boxPaddingBottom: 5,
        boxPadding: 10
    },
    contentStyle: defaultContentStyle
};

registerModule({
    type: "noticeA3",
    label: "商城公告3",
    icon: '<i class="h5-mod-ico">📣</i>',
    url: "mobilePro",
    platform: "mobile",
    order: 64,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(noticeA3Defaults)
});
