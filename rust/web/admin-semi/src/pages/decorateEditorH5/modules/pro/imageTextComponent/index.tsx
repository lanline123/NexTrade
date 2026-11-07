/**
 * 图文介绍 模块（契约自 view/admin editor/modules/mobilePro/imageTextComponent/index.ts 逐字段移植）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultModuleStyle, defaultContentStyle } from "../../../contract/sharedDefaults";

/** 与旧 mobilePro/imageTextComponent/index.ts 逐字段一致（契约） */
export const imageTextComponentDefaults = {
    picUrl: { picUrl: "", picThumb: "" }, //图片
    title: "关于我们", //标题文字
    description: "我们是一个全类目的商城平台，应有尽有。其中包括休闲零食、日用百货、医疗健康、美容护理等类目，让你不出门就能买到你想要的。", //图片介绍文字
    picBorder: 0, //图片边框
    picBorderColor: "#EEEEEE", //图片边框颜色
    picRadius: 0, //图片圆角
    titTextAlignment: "center", //标题对齐方式
    titMarginBottom: 10, //标题介绍间距
    titColor: "#333333", //标题颜色
    descTextAlignment: "center", //介绍对齐方式
    descColor: "#333333", //介绍颜色

    moduleStyle: defaultModuleStyle, // 模块样式
    contentStyle: defaultContentStyle // 内容样式
};

registerModule({
    type: "imageTextComponent",
    label: "图文介绍",
    icon: '<i class="h5-mod-ico">📝</i>',
    url: "mobilePro",
    platform: "mobile",
    order: 60,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(imageTextComponentDefaults)
});
