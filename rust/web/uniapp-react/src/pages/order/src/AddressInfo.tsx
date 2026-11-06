import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import type { AddressFilterResult } from "@/types/user/address";
import { isOverseas } from "@/utils";
import { t } from "@/utils/i18n";

import "./AddressInfo.scss";

interface Props {
    data?: AddressFilterResult | any;
}

/**
 * 收货地址信息展示组件（自旧 pages/order/src/addressInfo.vue 移植，样式对齐海外版）
 * - 显示收货人姓名、手机号、详细地址
 * - 海外版展示 formattedAddress / 国际手机号格式，并支持无效地址标记
 * - 点击跳转地址列表选择或添加地址
 */
export default function AddressInfo({ data = {} }: Props) {
    const isOverseasMode = isOverseas();

    const displayMobile = (() => {
        if (isOverseasMode) return data.internationalMobile || `+${data.mobileAreaCode || ""}${data.mobile || ""}`;
        return data.mobile;
    })();

    const displayAddress = (() => {
        if (isOverseasMode) return data.formattedAddress || data.fullAddress || [data.regionName, data.address].filter(Boolean).join(" ");
        return [data.regionName, data.address].filter(Boolean).join(" ");
    })();

    const handleAddressMore = () => {
        Taro.navigateTo({
            url: "/pages/address/list"
        });
    };

    return (
        <View className="address-info">
            <View className="address-content" onClick={handleAddressMore}>
                <View className="address-box">
                    {data && Object.keys(data).length > 0 ? (
                        <>
                            <View className="user-info">
                                <View className="name">
                                    <View className="consignee">{data.consignee}</View>
                                    <View className="mobile">{displayMobile}</View>
                                    {/* 跨境无效地址标记：数据驱动（后端返回 isInvalid 才展示），国内构建整段裁切 */}
                                    {data.isInvalid && <View className="invalid-tag">{t("无效地址")}</View>}
                                </View>
                            </View>
                            <View className="address">{displayAddress}</View>
                        </>
                    ) : (
                        <View className="user-info">
                            <View className="name">{t("请选择收货地址")}</View>
                        </View>
                    )}
                </View>
                <View className="iconfont-h5 icon-fanhui" />
            </View>
        </View>
    );
}
