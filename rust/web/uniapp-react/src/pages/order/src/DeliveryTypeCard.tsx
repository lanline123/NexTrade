import { View, Text, Image } from "@tarojs/components";

import type { AddressFilterResult } from "@/types/user/address";
import type { UserPickupListRecord } from "@/types/store/userPicekup";
import { useConfigStore } from "@/store/config";
import { redirect, staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import PickupUserCard from "./PickupUserCard";

import "./DeliveryTypeCard.scss";

interface Props {
    getAddressInfo?: AddressFilterResult | any;
    userPickupIfon?: UserPickupListRecord | any;
    hasStoreDelivery?: boolean;
    hasLocalDelivery?: boolean;
    hasPickupDelivery?: boolean;
    /** v-model:delivery-type → deliveryType + onDeliveryTypeChange */
    deliveryType?: number;
    onDeliveryTypeChange?: (val: number) => void;
    onChange?: (val: number) => void;
}

/**
 * 配送方式切换卡片（自旧 pages/order/src/deliveryTypeCard.vue 移植）
 * - 支持商家配送、到店自提、同城配送三种方式切换
 * - 根据配送方式显示对应的收货地址或自提联系人信息
 * - 带动画效果的Tab切换
 */
export default function DeliveryTypeCard({
    getAddressInfo = {},
    userPickupIfon = {},
    hasStoreDelivery = false,
    hasLocalDelivery = false,
    hasPickupDelivery = false,
    deliveryType = 1,
    onDeliveryTypeChange,
    onChange
}: Props) {
    const configDefaultLogisticsName = useConfigStore((s) => s.defaultLogisticsName);

    const menuList = (() => {
        const list: { id: number; name: string }[] = [];
        // 保持与三 tab 全开时一致的固定顺序：商家配送(1) → 到店自提(2) → 同城配送(3)
        if (hasStoreDelivery) {
            list.push({ id: 1, name: t(configDefaultLogisticsName || "商家配送") });
        }
        if (hasPickupDelivery) {
            list.push({ id: 2, name: t("到店自提") });
        }
        if (hasLocalDelivery) {
            list.push({ id: 3, name: t("同城配送") });
        }
        return list;
    })();

    const currentIndex = menuList.findIndex((item) => item.id === deliveryType);

    const handleChange = (val: number) => {
        onDeliveryTypeChange?.(val);
        onChange?.(val);
    };

    const handleLink = (url: string) => {
        redirect({ url });
    };

    return (
        <View className="delivery-type-box">
            {hasLocalDelivery && hasPickupDelivery && hasStoreDelivery ? (
                <View className="delivery-type">
                    <View className="delivery-menu">
                        <View className={`menu-item ${deliveryType === 1 ? "acitve" : ""}`} onClick={() => handleChange(1)}>
                            {t(configDefaultLogisticsName || "商家配送")}
                        </View>
                        <View className={`menu-item ${deliveryType === 2 ? "acitve" : ""}`} onClick={() => handleChange(2)}>
                            {t("到店自提")}
                        </View>
                        <View className={`menu-item ${deliveryType === 3 ? "acitve" : ""}`} onClick={() => handleChange(3)}>
                            {t("同城配送")}
                        </View>
                        {deliveryType === 3 && (
                            <View className="menu-bg-box right new">
                                {/* 旧 <image> 裸标签 → Taro Image；CSS 中 `image` 选择器同步改为 .bg-img */}
                                <Image className="bg-img" src={staticResource("store/delivery-menu-newbg.png")} />
                            </View>
                        )}
                        {deliveryType === 2 && (
                            <View className="menu-bg-box middle">
                                <Image className="bg-img" src={staticResource("store/delivery-menu-middlebg.png")} />
                            </View>
                        )}
                        {deliveryType === 1 && (
                            <View className="menu-bg-box left new">
                                <Image className="bg-img" src={staticResource("store/delivery-menu-newbg.png")} />
                            </View>
                        )}
                    </View>
                </View>
            ) : (
                <View className="delivery-type">
                    <View className="delivery-menu">
                        {menuList.map((item) => (
                            <View key={item.id} className={`menu-item ${deliveryType === item.id ? "acitve" : ""}`} onClick={() => handleChange(item.id)}>
                                {item.name}
                            </View>
                        ))}

                        {currentIndex === 1 && (
                            <View className="menu-bg-box right">
                                <Image className="bg-img" src={staticResource("store/delivery-menu-bg.png")} />
                            </View>
                        )}
                        {currentIndex === 0 && (
                            <View className="menu-bg-box left">
                                <Image className="bg-img" src={staticResource("store/delivery-menu-bg.png")} />
                            </View>
                        )}
                    </View>
                </View>
            )}

            <View className="card-box">
                {deliveryType === 1 || deliveryType === 3 ? (
                    <View className="address-box card" onClick={() => handleLink("/pages/address/list")}>
                        <View className="address-info">
                            {Object.keys(getAddressInfo || {}).length === 0 ? (
                                <View className="address-text line1">{t("请选择收货地址")}</View>
                            ) : (
                                <>
                                    <View className="user-info">
                                        <Text>{getAddressInfo.consignee}</Text>
                                        <Text>{getAddressInfo.mobile}</Text>
                                    </View>
                                    <View className="address-text line1">
                                        {getAddressInfo.regionName} {getAddressInfo.address}
                                    </View>
                                </>
                            )}
                        </View>
                        <View className="icon-box">
                            <Text className="iconfont-h5 icon-a-gengduo20" />
                        </View>
                        <View className="pickup-bg">
                            <Image className="bg-img" src={staticResource("store/pickup-bg.png")} />
                        </View>
                    </View>
                ) : (
                    deliveryType === 2 && <PickupUserCard userPickupIfon={userPickupIfon} />
                )}
            </View>
        </View>
    );
}
