import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import Service from "@/components/service";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { confirmReceipt, getOrder, getShippingInfo } from "@/api/user/order";
import { giftCardTransfer } from "@/api/giftCard/giftCard";
import type { OrderInfoResponseItem, ShippingInfoTrace } from "@/types/user/order";
import type { GiftCardInfo } from "@/types/giftCard/giftCard";
import { useUserStore } from "@/store/user";
import { useScrollTop } from "@/hooks";
import { copy, getSkuText, hasSkuText, isO2o, redirect, toStoreOrShopHome } from "@/utils";
import { pickPic } from "@/utils/format";
import { t } from "@/utils/i18n";
import GiftCardNav from "../src/GiftCardNav";
import GiftCard from "../src/GiftCard";
import GiftCardShare from "../src/GiftCardShare";
import GiftCardSelect from "../src/GiftCardSelect";

import "./info.scss";
import { usePageGuards } from "@/utils/pageMixin";

/** 旧接口返回的礼品卡订单信息（目标 types 未覆盖，按页面使用面补充） */
interface GiftCardOrderData {
    num: number;
    giftCardOrderInfo: GiftCardInfo[];
}

interface GiftCardOrderResponseItem extends OrderInfoResponseItem {
    giftCardOrder?: GiftCardOrderData;
}

/**
 * 礼品卡订单详情（自旧 pages/giftCard/order/info.vue 移植）
 * - 订单状态、商品明细、卡片信息、订单信息、物流、金额
 * - 底部：确认收货 / 赠送 / 立即兑换
 */
export default function GiftCardOrderInfo() {
    usePageGuards();
    const router = useRouter();
    const userServiceConfigShow = useUserStore((s) => s.serviceConfig.show);
    const { scrollTop } = useScrollTop();

    const [orderInfo, setOrderInfo] = useState<GiftCardOrderResponseItem>({} as GiftCardOrderResponseItem);
    const [shippingInfo, setShippingInfo] = useState<ShippingInfoTrace[]>([]);
    const [emptyText] = useState<string>("");
    const [showMore, setShowMore] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showCardSelect, setShowCardSelect] = useState(false);
    const [cardSelectType, setCardSelectType] = useState<"exchange" | "send">();
    const [selectedGiftCard, setSelectedGiftCard] = useState<GiftCardInfo>();
    const [transferLinkUrl, setTransferLinkUrl] = useState<string>("");

    const idRef = useRef<null | number>(null);

    const handleScrollTo = (module: string) => {
        const query = Taro.createSelectorQuery();
        query.select(module).boundingClientRect();
        query.selectViewport().scrollOffset();
        query.exec((res: any[]) => {
            if (!res || !res[0] || !res[1]) return;
            Taro.pageScrollTo({
                scrollTop: res[0].top + res[1].scrollTop - 50,
                duration: 0
            });
        });
    };

    const __getOrder = async () => {
        try {
            const result = await getOrder({ id: idRef.current });
            setOrderInfo(result);
        } catch (error) {
            console.error(error);
        }
    };

    const __getShippingInfo = async () => {
        try {
            const result: any = await getShippingInfo({ id: idRef.current });
            if (result) {
                if (Array.isArray(result)) {
                    setShippingInfo(result);
                } else {
                    setShippingInfo(result.traces ?? ([] as ShippingInfoTrace[]));
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            Taro.hideLoading();
        }
    };

    // 页面加载（旧 onLoad）
    useEffect(() => {
        const option = (router.params || {}) as Record<string, any>;
        if (option && option.id) {
            idRef.current = option.id;
            try {
                Taro.showLoading({
                    title: t("加载中")
                });
                void Promise.all([__getOrder(), __getShippingInfo()]);
            } catch (error) {
                console.error(error);
            } finally {
                // Taro.hideLoading();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const showExchange = useMemo(() => {
        return !(orderInfo?.orderStatus == 0 || orderInfo?.orderStatus == 3);
    }, [orderInfo?.orderStatus]);

    const isGiftCardExchangeOrder = orderInfo?.orderType === 12;

    const unUseGiftCards = useMemo(() => {
        return orderInfo?.giftCardOrder?.giftCardOrderInfo?.filter((item: GiftCardInfo) => item.status == 0);
    }, [orderInfo?.giftCardOrder]);

    // 电子礼品卡才展示卡片信息
    const showGiftCards = useMemo(() => {
        return orderInfo?.items?.[0]?.productType === 8;
    }, [orderInfo?.items]);

    const showService = useMemo(() => {
        if (orderInfo?.shop && Object.keys(orderInfo.shop).length > 0) {
            const kefuInlet: any = orderInfo.shop.kefuInlet;
            if (kefuInlet && kefuInlet.length > 0 && kefuInlet.includes(2)) {
                return true;
            }
            return false;
        }
        return userServiceConfigShow;
    }, [orderInfo?.shop, userServiceConfigShow]);

    const handleConfirmReceipt = (id: number) => {
        Taro.showModal({
            title: t("提示"),
            content: t("确认收货吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: async (res) => {
                if (res.confirm) {
                    try {
                        await confirmReceipt({ id });
                        void __getOrder();
                    } catch (error: any) {
                        Taro.showToast({
                            title: error.message,
                            icon: "none"
                        });
                    }
                }
            }
        });
    };

    const handleToShop = (shopId?: string | number) => {
        if (shopId === undefined || shopId === null || shopId === "") return;
        if (String(shopId) === "0") return;
        // 触发关店提示的店铺状态码：4 停业（枚举：1开业 4停业 10关店）
        if ((orderInfo?.shop as { status?: number } | undefined)?.status === 4) {
            Taro.showToast({
                title: isO2o() ? t("该门店已停业") : t("该店铺已停业"),
                icon: "none"
            });
            return;
        }
        toStoreOrShopHome(String(shopId), { navType: "navigateTo" });
    };

    const handleLink = (id: number) => {
        const shopId = (orderInfo as any)?.shopId;
        Taro.navigateTo({
            url: `/pages/product/index?id=${id}${shopId != null ? `&shopId=${shopId}` : ""}`
        });
    };

    const handleCopy = (data: any) => {
        copy(data, () => {
            Taro.showToast({
                title: t("复制成功"),
                icon: "none"
            });
        });
    };

    // 礼品卡兑换按钮点击事件
    const handleGiftCardExchange = () => {
        // setShowCardSelect(true);
        // setCardSelectType("exchange");
        void giftCardExchagne();
    };

    // 礼品卡赠送按钮点击事件
    const handleGiftCardSend = async () => {
        setShowCardSelect(true);
        setCardSelectType("send");
    };

    const giftCardExchagne = () => {
        Taro.navigateTo({
            url: "/pages/giftCard/exchange"
        });
    };

    const giftCardSend = async (giftCardSn: string) => {
        try {
            const res: any = await giftCardTransfer({ giftCardSn, isFrom: "1" });
            // 从接口响应中获取转赠链接
            // H5_DOMAIN 末尾带 `/` 时，后端拼接会生成 `/mobile//pages/...`，复制前兼容清理。
            const link = (res || "").replace(/\/mobile\/{2,}/g, "/mobile/");
            setTransferLinkUrl(link);
            if (link) {
                setShowShare(true);
            }
        } catch (error: any) {
            console.error(error);
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        }
    };

    const handleGiftCardSelectOk = async (giftCard: GiftCardInfo) => {
        setSelectedGiftCard(giftCard);
        // 兑换
        if (cardSelectType == "exchange") {
            // giftCardExchagne(giftCard.cardNumber);
        } else if (cardSelectType == "send") {
            // 赠送
            void giftCardSend(giftCard.giftCardSn);
        }
    };

    // 旧 selectedGiftCard 赋值后仅作记录，保留占位避免语义丢失
    void selectedGiftCard;

    return (
        <TigLayout>
            <GiftCardNav modelValue={scrollTop} event={handleScrollTo} title={t("订单详情")} />
            <View className="bg" />
            <View className="order-info">
                {Object.keys(orderInfo).length ? (
                    <>
                        <View className="order-info-content">
                            <View className="order-info-content-status">
                                <View className="order-info-content-status-title">{orderInfo?.orderStatusName}</View>
                                <View className="order-info-content-status-desc">
                                    {t("为了您的财产安全，请妥善保管卡密信息，切勿将卡号、卡密、二维码截图等任何信息发送他人，谨防上当受骗！")}
                                </View>
                            </View>
                            <View className="product-card card-space">
                                <View className="product-card-shop-title" onClick={() => handleToShop(orderInfo.shop?.shopId)}>
                                    <Text className="iconfont-h5 icon-dianpu" />
                                    <View>{orderInfo.shopId == 0 ? t("自营") : orderInfo.shop?.shopTitle}</View>
                                </View>
                                {orderInfo.items?.map((item) => (
                                    <View className="item-box" key={item.productId}>
                                        <View className="product-card-item">
                                            <View className="product-card-content">
                                                <View className="product-card-item-left" onClick={() => handleLink(item.productId)}>
                                                    <View className="left-img">
                                                        <TigImage src={pickPic(item)} />
                                                    </View>
                                                </View>
                                                <View className="product-card-item-right" onClick={() => handleLink(item.productId)}>
                                                    <View className="product-info">
                                                        <View className="product-top">
                                                            <View className="right-title line2">
                                                                <Text>{item.productName}</Text>
                                                            </View>
                                                            <View className="right-price">
                                                                {/* 旧 class 作用在 format-price 根节点 → 外层容器承接 */}
                                                                <View className="right-price-pricenum">
                                                                    <FormatPrice
                                                                        showText={false}
                                                                        decimalsStyle={{
                                                                            fontSize: "24rpx"
                                                                        }}
                                                                        currencyStyle={{
                                                                            fontSize: "20rpx"
                                                                        }}
                                                                        priceData={item.price}
                                                                    />
                                                                </View>
                                                            </View>
                                                        </View>
                                                        <View className="product-bottom">
                                                            <View>
                                                                <View
                                                                    className={`sku-card${!hasSkuText(item.skuData) ? " nodata" : ""}`}
                                                                >
                                                                    {hasSkuText(item.skuData) ? (
                                                                        <View className="sku-item line1">{getSkuText(item.skuData)}</View>
                                                                    ) : null}
                                                                </View>
                                                                {item.extraSkuData && item.extraSkuData.length ? (
                                                                    <View className="extraskudata-box">
                                                                        <View className="extraskudata">
                                                                            {item.extraSkuData.map((attr: any) => (
                                                                                <View className="extraskudata-item" key={attr}>
                                                                                    <View className="title">{attr.attrName}</View>
                                                                                    <View className="line-box">
                                                                                        <View className="line" />
                                                                                    </View>
                                                                                    <View className="content">
                                                                                        <Text className="line1 content-text">
                                                                                            {attr.attrValue}
                                                                                        </Text>
                                                                                        <View className="price">
                                                                                            <FormatPrice
                                                                                                showText={false}
                                                                                                priceData={attr.attrPrice}
                                                                                            />
                                                                                        </View>
                                                                                        <View className="num">x{item.quantity}</View>
                                                                                    </View>
                                                                                </View>
                                                                            ))}
                                                                        </View>
                                                                    </View>
                                                                ) : null}
                                                            </View>
                                                            <View className="right-price-quantity">x {item.quantity}</View>
                                                        </View>
                                                    </View>
                                                </View>
                                            </View>
                                            {orderInfo.payStatus === 2 && item.isGift === 0 ? (
                                                <View className="action">
                                                    <View className="item-btn">
                                                        {/* 旧 tig-button 注释原样保留；serviceRef.handleService() 在新 Service 内部自处理 onClick */}
                                                        {showService ? (
                                                            <View className="pay-card-item im-btn">
                                                                <Service
                                                                    phone={orderInfo.shop && orderInfo.shop.kefuPhone ? orderInfo.shop.kefuPhone : ""}
                                                                    orderId={orderInfo.orderId}
                                                                    shopId={orderInfo.shopId}
                                                                >
                                                                    <TigButton2
                                                                        plain
                                                                        style={{ height: "55rpx" }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        {t("联系客服")}
                                                                    </TigButton2>
                                                                </Service>
                                                            </View>
                                                        ) : null}
                                                    </View>
                                                </View>
                                            ) : null}
                                        </View>
                                    </View>
                                ))}
                            </View>
                            {showGiftCards && orderInfo.giftCardOrder?.num ? (
                                <View className="gift-card-box card-space">
                                    <View className="gift-card-header">
                                        <Text className="title">{t("卡片信息")}</Text>
                                        <Text className="count">
                                            （{t("共") + orderInfo.giftCardOrder?.num + t("张")}）
                                        </Text>
                                    </View>
                                    <View className="gift-card-list">
                                        {orderInfo.giftCardOrder?.giftCardOrderInfo?.map((item) => (
                                            <View className="gift-card-item" key={item.giftCardsId}>
                                                <GiftCard cardInfo={item} cardSize="large" />
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            ) : null}
                            <View className="order-card card-space">
                                <View className="order-card-item flex justify-between">
                                    <View className="item-left">
                                        <Text className="order-item-label">{t("订单编号")}：</Text>
                                        <Text>{orderInfo.orderSn}</Text>
                                    </View>
                                    <View className="item-right">
                                        <TigButton2
                                            className="btn-copy"
                                            style={{ color: "#8C8C8C", height: "28rpx", width: "64rpx" }}
                                            plain
                                            onClick={() => handleCopy(orderInfo.orderSn)}
                                        >
                                            {t("复制")}
                                        </TigButton2>
                                    </View>
                                </View>
                                <View className="order-card-item">
                                    <Text className="order-item-label">{t("创建时间")}：</Text>
                                    <Text>{orderInfo.addTime}</Text>
                                </View>
                                <View className="order-card-item">
                                    <Text className="order-item-label">{t("付款时间")}：</Text>
                                    <Text>{orderInfo.addTime}</Text>
                                </View>
                                <View className="pay-card-item">
                                    <Text className="order-item-label">{t("支付方式")}：</Text>
                                    {isGiftCardExchangeOrder ? (
                                        <Text>{t("礼品卡兑换")}</Text>
                                    ) : (
                                        <Text>
                                            {orderInfo.payTypeId === 1
                                                ? t("在线支付")
                                                : orderInfo.payTypeId === 2
                                                  ? t("货到付款")
                                                  : t("线下支付")}
                                        </Text>
                                    )}
                                </View>
                                <View className="order-card-item flex justify-between">
                                    <View className="item-left">
                                        <Text className="order-item-label">{t("交易单号")}：</Text>
                                        <Text>{orderInfo.orderSn}</Text>
                                    </View>
                                    <View className="item-right">
                                        <TigButton2
                                            className="btn-copy"
                                            style={{ color: "#8C8C8C", height: "28rpx", width: "64rpx" }}
                                            plain
                                            onClick={() => handleCopy(orderInfo.orderSn)}
                                        >
                                            {t("复制")}
                                        </TigButton2>
                                    </View>
                                </View>
                                {orderInfo.buyerNote ? (
                                    <View className="order-card-item">
                                        <Text className="order-item-label">{t("订单备注")}：</Text>
                                        <Text>{orderInfo.buyerNote}</Text>
                                    </View>
                                ) : null}
                            </View>
                            {orderInfo.orderId &&
                            (orderInfo.orderStatus === 2 || orderInfo.orderStatus === 5) &&
                            orderInfo.shippingMethod == 1 ? (
                                <View className="expressage-card card-space">
                                    {shippingInfo.length === 0 ? (
                                        <View className="shippingInfo-title"> {t("物流信息")} </View>
                                    ) : null}

                                    <View className="expressage-box">
                                        <View className="expressage-info">
                                            <View className="">{orderInfo.logisticsName}</View>
                                            <View className="">{orderInfo.trackingNo}</View>
                                        </View>
                                        {orderInfo?.trackingNo ? (
                                            <View className="copy-btn" onClick={() => handleCopy(orderInfo.trackingNo)}>
                                                {t("复制")}
                                            </View>
                                        ) : null}
                                    </View>
                                    {shippingInfo.length > 0 ? (
                                        <View className="shippingInfo-box">
                                            <View
                                                className={`shippingInfo-box-content${!showMore ? " dim" : ""}${showMore ? " more-height" : ""}`}
                                            >
                                                {/* 旧 up-steps（uview-plus，column/dot）→ 自绘时间轴 */}
                                                <View className="shipping-steps">
                                                    {shippingInfo.map((item, index) => (
                                                        <View className="shipping-step" key={index}>
                                                            <View className={`step-dot${index === 0 ? " active" : ""}`} />
                                                            <View className="step-content">
                                                                <View className="step-title">{item.acceptStation}</View>
                                                                <View className="step-desc">{item.acceptTime}</View>
                                                            </View>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                            <View className="shippingInfo-btn" onClick={() => setShowMore((prev) => !prev)}>
                                                {showMore ? t("收起") : t("展开")}
                                                <Text className={`iconfont-h5 ${showMore ? "icon-up" : "icon-arrowdown"}`} />
                                            </View>
                                        </View>
                                    ) : (
                                        <View className="emptyText">{emptyText}</View>
                                    )}
                                </View>
                            ) : null}
                            <View className="money-card card-space">
                                <View className="money-card-item">
                                    <Text className="order-item-label">{t("订单金额")}：</Text>
                                    <FormatPrice showText={false} isBottom={false} priceData={orderInfo.productAmount} />
                                </View>
                                {/* 旧注释保留：附加费用行已停用 */}
                                <View className="money-card-item">
                                    <Text className="order-item-label">{t("优惠券")}：</Text>
                                    <FormatPrice showText={false} isBottom={false} priceData={orderInfo.couponAmount} />
                                </View>
                                {/* 旧注释保留：快递 / 其他优惠行已停用 */}
                            </View>
                        </View>
                        {orderInfo.availableActions?.confirmReceipt || showExchange ? (
                            <FixedPlaceholder height="100rpx" backgroundColor="#fff">
                                <View className="order-info-btn">
                                    <View className="order-info-btn-box">
                                        {orderInfo.availableActions?.confirmReceipt ? (
                                            <TigButton2
                                                style={{ color: "#333" }}
                                                className="btn"
                                                plain
                                                onClick={() => handleConfirmReceipt(orderInfo.orderId)}
                                            >
                                                {t("确认已收货")}
                                            </TigButton2>
                                        ) : null}
                                        {unUseGiftCards?.length ? (
                                            <TigButton2 className="btn" plain onClick={handleGiftCardSend}>
                                                <Text>{`\u2003${t("赠送")}\u2003`}</Text>
                                            </TigButton2>
                                        ) : null}
                                        {showExchange ? (
                                            <TigButton2 className="btn" onClick={handleGiftCardExchange}>
                                                {t("立即兑换")}
                                            </TigButton2>
                                        ) : null}
                                    </View>
                                </View>
                            </FixedPlaceholder>
                        ) : null}
                    </>
                ) : null}
                <GiftCardShare
                    modelValue={showShare}
                    linkUrl={transferLinkUrl}
                    onUpdateModelValue={(value) => setShowShare(value)}
                />
                <GiftCardSelect
                    modelValue={showCardSelect}
                    cards={unUseGiftCards}
                    onUpdateModelValue={(value) => setShowCardSelect(value)}
                    okCallBack={handleGiftCardSelectOk}
                />
            </View>
        </TigLayout>
    );
}