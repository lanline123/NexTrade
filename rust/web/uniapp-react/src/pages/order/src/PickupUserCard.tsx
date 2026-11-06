import { View, Text, Image } from "@tarojs/components";

import type { UserPickupListRecord } from "@/types/store/userPicekup";
import { redirect, staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./PickupUserCard.scss";

interface Props {
    userPickupIfon?: UserPickupListRecord | any;
    borderRadius?: string;
}

/**
 * 自提联系人卡片组件（自旧 pages/order/src/pickupUserCard.vue 移植）
 * - 显示自提联系人姓名、手机号
 * - 点击可跳转选择或添加联系人
 */
export default function PickupUserCard({ userPickupIfon = {}, borderRadius = "0" }: Props) {
    const handleLink = (url: string) => {
        redirect({ url });
    };

    return (
        <View className="pickup-info-box" style={{ borderRadius }} onClick={() => handleLink("/pages/store/contacts/list")}>
            <View className="pickup-info">
                {userPickupIfon && Object.keys(userPickupIfon).length !== 0 ? (
                    <>
                        <View className="info-label">{t("联系人")}</View>
                        <View className="info-content">
                            {userPickupIfon.consignee} {userPickupIfon.mobile}
                        </View>
                    </>
                ) : (
                    <View className="info-tip">{t("请选择自提联系人")}</View>
                )}
            </View>
            <View className="icon-box">
                <Text className="iconfont-h5 icon-a-gengduo20" />
            </View>
            <View className="pickup-bg">
                {/* 旧 <image> 裸标签 → Taro Image；CSS 中 `image` 选择器同步改为 .bg-img */}
                <Image className="bg-img" src={staticResource("store/pickup-bg.png")} />
            </View>
        </View>
    );
}
