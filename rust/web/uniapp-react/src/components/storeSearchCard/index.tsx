// TODO(B2-1b)：随门店聚合搜索批次移植（对应旧 components/storeSearchCard/index.vue，509 行：
// 门店卡片 + 内嵌商品横滑列表，装修字段全量 props 下发）。
// 渲染 null 保持 props 形状，保证本批可编译。

interface Props {
    store?: any;
    manageListGap?: boolean;
    hasLocation?: boolean;
    showRating?: number;
    showMinOrder?: number;
    showDeliveryFee?: number;
    showDistance?: number;
    showFollow?: number;
    showProductName?: number;
    productNameRow?: number;
    showProductPrice?: number;
    productGap?: number;
    shopTitleColor?: string;
    shopLogoRadius?: number;
    cardRadius?: number;
    cardPaddingTopBottom?: number;
    cardPaddingLeftRight?: number;
    shopTitleFontSize?: number;
    shopTitleFontBold?: number;
    itemBackgroundColor?: string;
    themeColor?: string;
    productImageRadius?: number;
    applyCardStyle?: boolean;
}

export default function StoreSearchCard(_props: Props) {
    return null;
}
