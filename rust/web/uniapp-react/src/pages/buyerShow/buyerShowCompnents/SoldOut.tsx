import type { ReactNode } from "react";
import { View } from "@tarojs/components";

import { shouldShowSoldOut } from "@/utils/productSoldOut";
import { t } from "@/utils/i18n";

import "./SoldOut.scss";

interface Props {
    showOutsale?: boolean;
    item?: any;
    stockField?: string;
    className?: string;
    children?: ReactNode;
    onClick?: (event: any) => void;
}

/**
 * 售罄标签组件（自旧 buyerShowCompnents/SoldOut.vue 移植）
 * - item 含 stockField 时以库存判定，否则回退 show-out-sale
 * - 旧组件根节点上的 @click 由 Vue 属性透传落到根 view，这里显式挂 onClick
 */
export default function SoldOut({ showOutsale = false, item = {}, stockField = "productStock", className = "", children, onClick }: Props) {
    const finalShowOutsale = item && stockField in item ? shouldShowSoldOut(item, { stockField }) : showOutsale;

    return (
        <View className={`sold-out-box${className ? ` ${className}` : ""}`} onClick={onClick}>
            {finalShowOutsale && <View className="outsale">{t("已售罄")}</View>}
            {children}
        </View>
    );
}