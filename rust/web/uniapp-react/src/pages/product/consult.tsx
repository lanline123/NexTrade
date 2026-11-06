import { useEffect, useRef, useState } from "react";
import { Image, Text, Textarea, View } from "@tarojs/components";
import Taro, { useReachBottom, useRouter } from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import FormatPrice from "@/components/format-price/FormatPrice";
import { productImage } from "@/utils/format";
import { getProductConsultationList, getProductDetail, addConsultation } from "@/api/product/product";
import type { ProductConsultationItem, ProductConsultationListParams, ProductItem } from "@/types/product/product";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./consult.scss";

/**
 * 商品咨询页（自旧 pages/product/consult.vue 移植）
 * - 展示商品的用户咨询问答列表
 * - 支持发布新咨询问题
 * - 显示商家回复内容
 * - 新版按 productId + shopId 拉取咨询，详情接口用于解析真实 shopId
 */
export default function ProductConsultPage() {
    const router = useRouter();
    const productIdRef = useRef<number | undefined>(undefined);
    const shopIdRef = useRef<number | undefined>(undefined);

    const [product, setProduct] = useState<ProductItem>({
        productId: 0,
        productStock: 0
    });
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState<number>(1);
    const size = 10;
    const [total, setTotal] = useState(0);
    const [, setLoaded] = useState(false);
    const [consultationLoading, setConsultationLoading] = useState(false);
    const [consultationMessage, setConsultationMessage] = useState<string>("");
    const [consultationList, setConsultationList] = useState<ProductConsultationItem[]>([]);
    const [, setConsultationTotal] = useState(0);
    const [textareaFocus, setTextareaFocus] = useState(false);

    const __getProductDetail = async (id: number, requestedShopId: number) => {
        try {
            const result = await getProductDetail({ id, shopId: requestedShopId });
            setProduct(result.item);
            const detailShopId = result.item.shopId ?? (result as any).shopId;
            shopIdRef.current =
                typeof detailShopId === "number" && Number.isFinite(detailShopId) ? detailShopId : undefined;
            return shopIdRef.current !== undefined;
        } catch (error: any) {
            shopIdRef.current = undefined;
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
            return false;
        }
    };

    const fetchConsultation = async (reset = false, pageArg?: number) => {
        const pid = productIdRef.current;
        const sid = shopIdRef.current;
        if (pid === undefined || sid === undefined) return;

        const targetPage = reset ? 1 : pageArg ?? page;
        if (reset) {
            setPage(1);
        }
        if (targetPage > 1) {
            setLoaded(true);
        }
        Taro.showLoading({
            title: t("加载中")
        });
        if (targetPage === 1) {
            setConsultationList([]);
        }
        try {
            const params: ProductConsultationListParams = {
                productId: pid,
                page: targetPage,
                size: size,
                shopId: sid
            };
            const result = await getProductConsultationList(params);
            setConsultationList((prev) => (targetPage === 1 ? [...result.records] : [...prev, ...result.records]));
            setTotal(result.total);
            setConsultationTotal(result.total);
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        } finally {
            setLoaded(false);
            Taro.hideLoading();
        }
    };

    // 对应旧 onLoad
    useEffect(() => {
        void (async () => {
            const parsedProductId = Number(router.params.id);
            const hasShopId = router.params.shopId !== undefined && router.params.shopId !== "";
            const parsedShopId = hasShopId ? Number(router.params.shopId) : undefined;
            if (
                Number.isFinite(parsedProductId) &&
                parsedProductId > 0 &&
                parsedShopId !== undefined &&
                Number.isFinite(parsedShopId) &&
                parsedShopId >= 0
            ) {
                productIdRef.current = parsedProductId;
                const hasResolvedShop = await __getProductDetail(parsedProductId, parsedShopId);
                if (hasResolvedShop) {
                    await fetchConsultation(true);
                }
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const customerService = () => {
        setConsultationLoading(true);
        setTimeout(() => {
            setTextareaFocus(true);
        }, 100); // 延迟以确保弹窗已渲染
    };

    const submitConsultation = async () => {
        const pid = productIdRef.current;
        const sid = shopIdRef.current;
        if (pid === undefined || sid === undefined) return;

        if (!consultationMessage.trim()) {
            Taro.showToast({
                title: t("请输入咨询内容"),
                icon: "none"
            });
            return;
        }
        try {
            await addConsultation({
                productId: pid,
                shopId: sid,
                content: consultationMessage,
                type: 2 // 2表示商品咨询
            });
            setConsultationMessage("");
            setConsultationLoading(false);
            Taro.showToast({
                title: t("请您耐心等待客服人员的回复，您可在会员中心查看留言回复消息动态")
            });
            void fetchConsultation(true);
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        }
    };

    const handleIcon = () => {
        setConsultationLoading(false);
    };

    useReachBottom(() => {
        if (page < Math.ceil(total / size)) {
            const nextPage = page + 1;
            setPage(nextPage);
            void fetchConsultation(false, nextPage);
        }
    });

    return (
        <TigLayout title={t("商品咨询")}>
            <View className="product-info flex">
                <View className="product-info-img">
                    <Image lazyLoad className="product-img" src={productImage(product)} />
                </View>
                <View>
                    <View className="product-info-title line2">{product.productName}</View>
                    {product.marketPrice && Number(product.marketPrice) > 0 ? (
                        <View className="product-info-price">
                            <FormatPrice isBottom={false} priceData={product.marketPrice} />
                        </View>
                    ) : null}
                </View>
            </View>
            <View className="product-consult-card">
                {consultationList.map((item, index) => (
                    <View key={index} className="consult-item">
                        <View className="consult-item-tit flex justify-between">
                            <View className="time">{item.addTime}</View>
                            <View className="name">{item.username}</View>
                        </View>
                        <View className="consult-con line1">
                            <Text>Q</Text>
                            {item.content}
                        </View>
                        {item.reply ? (
                            <View className="consult-con line1 reply">
                                <Text>A</Text>
                                {item.reply.content}
                            </View>
                        ) : null}
                    </View>
                ))}
            </View>
            <FixedPlaceholder backgroundColor="#fff">
                <View className="btn-box">
                    <TigButton2 className="btn" onClick={customerService}>
                        {t("咨询客服")}
                    </TigButton2>
                </View>
            </FixedPlaceholder>
            <Popup
                visible={consultationLoading}
                closeable={false}
                onClose={() => setConsultationLoading(false)}
                style={{ borderRadius: "20rpx" }}
            >
                <View className="popup-content">
                    <View className="popup-header">
                        <View className="flex">
                            <View className="product-Slot">
                                {/* 旧 slot name="left" 默认内容 */}
                                <View className="iconfont icon-houtui" onClick={handleIcon} />
                            </View>
                            <View className="product-info-img">
                                <Image lazyLoad className="product-img" src={productImage(product)} />
                            </View>
                            <View className="product-info-title">{t(product.productName || "")}</View>
                        </View>
                        <View className="popup-footer">
                            <TigButton2
                                className="btn"
                                disabled={!consultationMessage.trim()}
                                style={{
                                    background: consultationMessage.trim() ? "#C3A769" : "#e6e6e6",
                                    color: consultationMessage.trim() ? "#fff" : "#f7f7f7",
                                    borderColor: "transparent"
                                }}
                                onClick={submitConsultation}
                            >
                                {t("提交")}
                            </TigButton2>
                        </View>
                    </View>
                    <View className="popup-body">
                        <View className="popup-item">
                            <View className="popup-item-title">{t("咨询内容")}:</View>
                            {/* 旧 up-textarea → Taro Textarea（input-align=right → textAlign: right） */}
                            <Textarea
                                value={consultationMessage}
                                onInput={(e) => setConsultationMessage(e.detail.value)}
                                style={{ textAlign: "right", height: "120px", background: "#f5f5f5" }}
                                placeholder={t("您可以对商品包装、规格、支付、发票、退换货和物流配送类的问题咨询客服")}
                                maxlength={200}
                                focus={textareaFocus}
                            />
                            <View className="popup-item-footer"> {consultationMessage.length}/200 </View>
                        </View>
                    </View>
                </View>
            </Popup>
            {page > 1 ? (
                <View className="loading-box">
                    {loading ? (
                        <View className="bottomLoading">
                            <Image lazyLoad className="loading" src={staticResource("common/loading.gif")} />
                        </View>
                    ) : null}
                </View>
            ) : null}
            <View className="loading-box">
                {consultationList.length < 1 ? (
                    <View className="empty-box">
                        <View className="pictrue">
                            <Image src={staticResource("common/data_empty.png")} />
                        </View>
                        <View className="txt">{t("暂无咨询")}</View>
                    </View>
                ) : null}
            </View>
        </TigLayout>
    );
}