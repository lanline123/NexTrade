import { useState } from "react";
import { Image, ScrollView, Text, View } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";

import type { ServiceList } from "@/types/product/product";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    serviceList?: ServiceList[];
    separated?: boolean;
}

/**
 * 服务保障卡片（自旧 pages/product/src/serviceCard.vue 移植）
 * - 列表展示商品服务名，点击弹窗展示服务详情
 * - 旧 tig-popup → NutUI Popup（bottom + 10px 圆角）
 */
export default function ServiceCard({ serviceList = [], separated = false }: Props) {
    const [show, setShow] = useState(false);

    return (
        <>
            <View className={`service-card-box ${separated ? "service-card-box--separated" : ""}`}>
                <View className="service-card" onClick={() => setShow(true)}>
                    {serviceList.map((item) => (
                        <View key={item.productServiceId} className="service-card-item">
                            <Text className="item-text line1">{item.productServiceName}</Text>
                            <Text className="iconfont-h5 icon-a-gengduo20" />
                        </View>
                    ))}
                </View>
            </View>

            {/* 旧 <tig-popup v-model:show="show" :show-close="false" background-color="#fff"> → NutUI Popup（bottom + 10px 圆角） */}
            <Popup
                visible={show}
                position="bottom"
                closeable={false}
                onClose={() => {
                    setShow(false);
                }}
                style={{ background: "#fff", borderRadius: "20rpx 20rpx 0 0" }}
            >
                <View className="service-popup">
                    <View className="popup-title-box">
                        <View className="title">{t("服务保障")}</View>
                        <View
                            className="close-icon"
                            onClick={() => {
                                setShow(false);
                            }}
                        >
                            <Image className="close-icon-img" src={staticResource("order/close.png")} />
                        </View>
                    </View>

                    {/* 旧 <scroll-view scroll-y class="popup-content"> → ScrollView */}
                    <ScrollView className="popup-content" scrollY>
                        {serviceList.map((item) => (
                            <View key={item.productServiceId} className="content-item">
                                <View className="item-title">{item.productServiceName}</View>
                                {item.productServiceDesc ? <View className="item-content">{item.productServiceDesc}</View> : null}
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </Popup>
        </>
    );
}
