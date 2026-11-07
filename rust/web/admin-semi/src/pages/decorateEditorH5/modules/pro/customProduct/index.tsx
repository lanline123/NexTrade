/**
 * 个性商品 模块（契约自 view/admin editor/modules/mobilePro/customProduct/index.ts 逐字段移植）
 *
 * 旧 ToolBar 中已被注释、不进工具栏（visible:false）；保留注册仅为老数据可渲染。
 * 旧 Preview.vue 本身只渲染占位文本「个性商品」，此处忠实还原。
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultAnimation, defaultModuleStyle, defaultContentStyle } from "../../../contract/sharedDefaults";

/** 与旧 mobilePro/customProduct/index.ts 逐字段一致（契约） */
export const customProductDefaults = {
    pruductList: [],
    picUrl: { picUrl: "", picThumb: "" },
    picLocation: "right",
    animation: defaultAnimation,
    picFillType: "cover",
    productRadius: 5,
    picBottomRadius: 1,
    crossedOutPrice: 1,
    moduleColor: {
        productBackgroundColor: "#ffffff",
        productNameColor: "#333333",
        productPriceColor: "#72b76c",
        crossedOutPriceColor: "#999999"
    },
    moduleStyle: defaultModuleStyle,
    contentStyle: defaultContentStyle
};

registerModule({
    type: "customProduct",
    label: "个性商品",
    icon: '<i class="h5-mod-ico">🛒</i>',
    url: "mobilePro",
    platform: "mobile",
    visible: false,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(customProductDefaults)
});
