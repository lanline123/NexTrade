import { View, Text, Image, ScrollView } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";

import { productImage } from "@/utils/format";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";

import closeImg from "@/static/images/common/close.png";

import "./DeliveryProductPop.scss";

interface Props {
    show: boolean;
    onShowChange?: (show: boolean) => void;
    pickupProductData?: any[];
    deliveryProducts?: any[];
    localDeliveryProducts?: any[];
    /** 对应旧 @emit("orderCheckType", type)：1-商城配送 2-到店自提 3-同城配送 */
    onOrderCheckType?: (type: number) => void;
}

/**
 * 配送方式选择弹窗（自旧 pages/cart/src/deliveryProductPop.vue 移植）
 * - O2O 混合配送场景：商品分别支持 商城配送/到店自提/同城配送 时，结算前先选择配送方式
 * - 原 <tig-popup> → NutUI Popup（bottom，z-index 1000，白底）
 */
export default function DeliveryProductPop({ show, onShowChange, pickupProductData = [], deliveryProducts = [], localDeliveryProducts = [], onOrderCheckType }: Props) {
    const configStoreDefaultLogisticsName = useConfigStore((s) => s.defaultLogisticsName);

    const hanleItemClick = (type: number) => {
        onOrderCheckType?.(type);
        onShowChange?.(false);
    };

    const renderSection = (list: any[], iconClass: string, titleText: string, type: number) => {
        if (list.length <= 0) return null;
        return (
            <View className="content-section">
                <View className="content-title">
                    <View className={`iconfont-h5 ${iconClass}`} />
                    <View className="title-text">{t(titleText)}</View>
                    <View className="title-num">
                        {t("共")}
                        <Text>{list.length}</Text>
                        {t("件")}
                    </View>
                </View>

                <View className="list-content">
                    <View className="list">
                        <ScrollView scrollX className="list-scroll">
                            {list.map((item) => (
                                <View className="list-item" key={item.productId}>
                                    <Image src={productImage(item)} />
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                    <View className="btn" onClick={() => hanleItemClick(type)}>
                        {t("去结算")}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <Popup
            visible={show}
            position="bottom"
            zIndex={1000}
            closeable={false}
            onClose={() => onShowChange?.(false)}
            style={{ backgroundColor: "#fff" }}
        >
            <View className="delivery-pop">
                <View className="popup-title-box">
                    <View className="title">{t("选择配送方式")}</View>
                    <View className="close-icon" onClick={() => onShowChange?.(false)}>
                        <Image src={closeImg} />
                    </View>
                </View>
                <View className="tip">{t("不同的配送方式的商品，暂不支持同时结算下单")}</View>
                <View className="content">
                    {renderSection(deliveryProducts, "icon-daishouhuo1", configStoreDefaultLogisticsName || "商家配送", 1)}
                    {renderSection(pickupProductData, "icon-mendianziti", "到店自提", 2)}
                    {renderSection(localDeliveryProducts, "icon-tongcheng1", "同城配送", 3)}
                </View>
            </View>
        </Popup>
    );
}
