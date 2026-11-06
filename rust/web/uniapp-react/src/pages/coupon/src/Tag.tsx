import type { ReactNode } from "react";
import { View } from "@tarojs/components";

import { t } from "@/utils/i18n";

import "./Tag.scss";

interface Props {
    /** 旧默认插槽内容（未传时显示「已过期」） */
    children?: ReactNode;
}

/** 优惠券状态印章（自旧 pages/coupon/src/tag.vue 移植） */
export default function Tag({ children }: Props) {
    return <View className="tag">{children ?? t("已过期")}</View>;
}