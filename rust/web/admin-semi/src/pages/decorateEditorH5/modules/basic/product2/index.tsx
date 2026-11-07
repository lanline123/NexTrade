/**
 * 商品2 模块（契约自 view/admin editor/modules/mobile/product2/index.ts 逐字段移植，跨境版样式）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultProducts } from "../../../contract/sharedDefaults";

/** 与旧 mobile/product2/index.ts product2Defaults 逐字段一致（契约） */
export const product2Defaults = {
    imageBackgroundColor: "",
    buyBtnStyle: 0,
    goodsRadio: 0,
    boxRadius: 0,
    innerPadding: 0,
    boxPadding: 10,
    boxPaddingTop: 5,
    boxPaddingBottom: 5,
    products: defaultProducts
};

registerModule({
    type: "product2",
    label: "商品2",
    icon: '<i class="h5-mod-ico">🛍️</i>',
    url: "mobile",
    platform: "mobile",
    order: 13,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(product2Defaults)
});
