import { View } from "@tarojs/components";

import { usePageGuards } from "@/utils/pageMixin";

/**
 * 开放支付页（预留页面）
 * - 用于处理外部支付回调或特殊支付场景
 */
export default function OpenPay() {
    usePageGuards();

    return <View />;
}
