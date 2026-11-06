import { useEffect, useMemo, useState } from "react";
import { Image, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getGiftCardDetail, giftCardClaim } from "@/api/giftCard/giftCard";
import type { GiftCardInfo } from "@/types/giftCard/giftCard";
import { useProductStyle } from "@/hooks/useProductStyle";
import { useUserStore } from "@/store/user";
import { redirect, staticResource } from "@/utils";
import { handleLogin } from "@/utils/handleLogin";
import { t } from "@/utils/i18n";
import Error from "./src/Error";
import GiftCard from "./src/GiftCard";
import ProductItem from "./src/ProductItem";

import "./transfer.scss";
import { usePageGuards } from "@/utils/pageMixin";

/**
 * 礼品卡转赠领取页（自旧 pages/giftCard/transfer.vue 移植）
 * - 领取转赠礼品卡并拉取卡信息
 * - 展示使用方法、可兑换商品、兑换流程
 * - 领取成功且未兑换时才可「去兑换」
 */
export default function GiftCardTransfer() {
    usePageGuards();
    const router = useRouter();
    const userToken = useUserStore((s) => s.token);

    const [giftCardNumber, setGiftCardNumber] = useState("");
    const [giftCardSn, setGiftCardSn] = useState("");
    const [loadFailed, setLoadFailed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState(t("无效的礼品卡"));
    const [isClaimGiftCardSuccess, setIsClaimGiftCardSuccess] = useState(false);
    const [giftCardInfo, setGiftCardInfo] = useState<GiftCardInfo>({
        giftCardsId: 71,
        cardGroupsId: 5,
        cardNumber: "",
        cardPassword: "",
        cardGroupName: "",
        shopId: 0,
        shopTitle: "",
        giftCardSn: ""
    });

    const hasToken = userToken || Taro.getStorageSync("token");

    const giftCardProductList = useMemo(() => giftCardInfo?.giftCardProducts || [], [giftCardInfo]);
    const { styleMap } = useProductStyle(giftCardProductList);

    const _getGiftCardDetail = async () => {
        const result = await getGiftCardDetail(giftCardNumber, giftCardSn);
        setGiftCardInfo(result);
    };

    /**
     * 领取礼品卡
     */
    const _claimGiftCard = async () => {
        try {
            await giftCardClaim({ cardNum: giftCardNumber, giftCardSn: giftCardSn });
            setIsClaimGiftCardSuccess(true);
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
            setIsClaimGiftCardSuccess(false);
        }
    };

    const getDetail = async () => {
        try {
            // 领取礼品卡
            await _claimGiftCard();
            // 拿到礼品卡信息
            await _getGiftCardDetail();
        } catch (error: any) {
            setErrorMessage(error.message);
            setLoadFailed(true);
        } finally {
            setLoading(false);
        }
    };

    const handleExchange = () => {
        redirect({
            url: "/pages/giftCard/exchange"
        });
    };

    // 页面加载（旧 onLoad）
    useEffect(() => {
        // 需要登录
        if (!hasToken) {
            handleLogin();
            return;
        }
        const option = (router.params || {}) as Record<string, any>;
        if (option?.giftCardSn) {
            // giftCardsId.value = Number(option.cardId);
            setGiftCardNumber(option.cardNum);
            setGiftCardSn(option.giftCardSn);
            void getDetail();
        } else {
            setLoadFailed(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <View>
            <TigLayout title={t("TA送你一张礼品卡")}>
                {!loading && !loadFailed ? (
                    <>
                        <View className="bg" />
                        <View className="gift-card-container">
                            <View className="card-info">
                                <View className="card-wrapper">
                                    <GiftCard cardInfo={giftCardInfo} showActions={isClaimGiftCardSuccess} />
                                </View>
                            </View>
                            <View className="use-step group">
                                <View className="use-step-header group-header">
                                    <View className="line left" />
                                    <View className="group-title">{t("使用方法")}</View>
                                    <View className="line right" />
                                </View>
                                <View className="use-step-content">
                                    <View className="use-step-item step-1">
                                        <View className="icon">
                                            <Image className="img" src={staticResource("giftCard/cart.png")} />
                                        </View>
                                        <View className="text">{t("礼品卡下单")}</View>
                                    </View>
                                    <View className="next-icon">
                                        <View className="iconfont-h5 icon-a-gengduo20" />
                                    </View>
                                    <View className="use-step-item">
                                        <View className="icon">
                                            <Image className="img" src={staticResource("giftCard/exchange.png")} />
                                        </View>
                                        <View className="text">{t("礼品卡兑换")}</View>
                                    </View>
                                    <View className="next-icon">
                                        <View className="iconfont-h5 icon-a-gengduo20" />
                                    </View>
                                    <View className="use-step-item">
                                        <View className="icon">
                                            <Image className="img" src={staticResource("giftCard/card.png")} />
                                        </View>
                                        <View className="text">{t("输入卡号卡密")}</View>
                                    </View>
                                    <View className="next-icon">
                                        <View className="iconfont-h5 icon-a-gengduo20" />
                                    </View>
                                    <View className="use-step-item">
                                        <View className="icon">
                                            <Image className="img" src={staticResource("giftCard/product.png")} />
                                        </View>
                                        <View className="text">{t("立即兑换")}</View>
                                    </View>
                                </View>
                            </View>
                            {giftCardInfo?.giftCardProducts?.length ? (
                                <View className="products group">
                                    <View className="group-header">
                                        <View className="line left" />
                                        <View className="group-title">{t("兑换商品")}</View>
                                        <View className="line right" />
                                    </View>
                                    <View className="group-sub-header">{t("该兑换卡可兑换商品")}</View>
                                    <View className="product-box">
                                        {giftCardInfo.giftCardProducts.map((item, index) => (
                                            <View key={index}>
                                                <ProductItem product={item} productStyle={styleMap[item.productId]} />
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            ) : null}
                            <View className="exchange-flow group">
                                <View className="group-header">
                                    <View className="line left" />
                                    <View className="group-title">{t("兑换流程")}</View>
                                    <View className="line right" />
                                </View>
                                <View className="group-sub-header">{t("该兑换卡可兑换商品")}</View>
                                <View className="flows">
                                    <View className="flow">
                                        <View className="flow-title">
                                            <View className="flow-no">1</View>
                                            <View className="flow-title-text">{t("购买礼品卡")}</View>
                                        </View>
                                        <View className="flow-content">
                                            <View className="flow-tips">
                                                {t("在商城选择所需购买的礼品卡，点击立即购买，并支付订单。 支付成功后，礼品卡需在礼品卡兑换中兑换才可使用")}
                                            </View>
                                        </View>
                                    </View>
                                    <View className="flow">
                                        <View className="flow-title">
                                            <View className="flow-no">2</View>
                                            <View className="flow-title-text">{t("礼品卡兑换")}</View>
                                        </View>
                                        <View className="flow-content">
                                            <View className="flow-tips">{t("在订单底部点击礼品卡兑换按钮进行兑换")}</View>
                                        </View>
                                    </View>
                                    <View className="flow">
                                        <View className="flow-title">
                                            <View className="flow-no">3</View>
                                            <View className="flow-title-text">{t("使用礼品卡")}</View>
                                        </View>
                                        <View className="flow-content">
                                            <View className="flow-tips">{t("进入兑换页面输入礼品卡的卡号卡密进行兑换")}</View>
                                        </View>
                                    </View>
                                    <View className="flow">
                                        <View className="flow-title">
                                            <View className="flow-no">4</View>
                                            <View className="flow-title-text">{t("礼品卡支付")}</View>
                                        </View>
                                        <View className="flow-content">
                                            <View className="flow-tips">{t("点击去兑换按钮，在订单提交页面进行提交")}</View>
                                        </View>
                                    </View>
                                </View>
                            </View>
                            <FixedPlaceholder height="104rpx" backgroundColor="#fff">
                                <View className="order-info-btn">
                                    <View className="order-info-btn-box">
                                        <TigButton2
                                            className="btn"
                                            disabled={!isClaimGiftCardSuccess || giftCardInfo.status != 0}
                                            onClick={handleExchange}
                                        >
                                            {t("去兑换")}
                                        </TigButton2>
                                    </View>
                                </View>
                            </FixedPlaceholder>
                        </View>
                    </>
                ) : null}
                {loadFailed ? (
                    <View className="error-container">
                        <Error message={errorMessage} />
                    </View>
                ) : null}
            </TigLayout>
        </View>
    );
}