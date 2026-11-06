import { useEffect, useMemo, useRef, useState } from "react";
import { Image, ScrollView, Text, View } from "@tarojs/components";
import Taro, { useRouter, useShareAppMessage, useShareTimeline } from "@tarojs/taro";

import GrouponShare from "@/pages/groupon/src/GrouponShare";
import Specification, { type SpecificationRef, type SpecificationSendValuePayload } from "@/components/product/specification";
import TigLayout, { type TigLayoutRef } from "@/components/tig/tig-layout/TigLayout";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigCountdown from "@/components/tig/tig-countdown/TigCountdown";
import TigLoadingPage from "@/components/tig/tig-loadingpage";
import FormatPrice from "@/components/format-price/FormatPrice";
import Recommend from "@/components/recommend";
import ErrorComp from "./src/error";

import { useUserStore } from "@/store/user";
import { useConfigStore } from "@/store/config";
import { useRegionStore } from "@/store/region";
import { redirect, staticResource } from "@/utils";
import type { ProductItem } from "@/types/product/product";
import type { ShopDetailItem } from "@/types/shop/shop";
import type { GrouponRecordDetail, GrouponJoinUser } from "@/types/groupon/groupon";
import { imageFormat, hideUserName, pickPic, productImage } from "@/utils/format";
import { ensureShareLogin } from "@/utils/shareLogin";
import { shopCollection, getShopDetail } from "@/api/shop/shop";
import { getProductDetail } from "@/api/product/product";
import { getGrouponRecordDetail } from "@/api/groupon/groupon";
import { t } from "@/utils/i18n";

import "./groupBuying.scss";
import { usePageGuards } from "@/utils/pageMixin";

/**
 * 拼团详情页（自旧 pages/product/groupBuying.vue 移植，966 行）
 * - 展示拼团活动信息和参团成员
 * - 倒计时显示拼团剩余时间
 * - 支持分享邀请好友参团
 * - 显示拼团状态（进行中/成功/失败）
 * 与 productV1 版差异：主图取 pickPic(product)、分享门控 ensureShareLogin(true)、
 * 分享图取 productImage(product)、规格弹层使用 components/product/specification（旧 specification.vue，B2 已迁移）。
 */
export default function GroupBuying() {
    usePageGuards();
    const router = useRouter();
    const userStore = useUserStore();
    const configStore = useConfigStore();

    const [pageTitle, setPageTitle] = useState(t("拼团"));
    const [shopInfo, setShopInfo] = useState<ShopDetailItem>({} as ShopDetailItem);
    const [grouponPromotionRecordId, setGrouponPromotionRecordId] = useState(0);
    const [grouponRecordDetail, setGrouponRecordDetail] = useState<GrouponRecordDetail>({} as GrouponRecordDetail);
    const [product, setProduct] = useState<ProductItem>({
        productId: 0,
        productStock: 0
    });
    const [productStock, setProductStock] = useState(10);
    const [specificationId, setSpecificationId] = useState(0);
    const [skuId, setSkuId] = useState(0);
    const [grouponEnable, setGrouponEnable] = useState(true);
    const specificationRef = useRef<SpecificationRef | null>(null);
    const [grouponRecordInfo, setGrouponRecordInfo] = useState<{
        grouponPromotionRecordId: number;
        minGroupNum: number;
        skuId: number;
    }>({
        grouponPromotionRecordId: 0,
        minGroupNum: 0,
        skuId: 0
    });
    const [productId, setProductId] = useState(0);
    const [showShare, setShowShare] = useState(false);
    const layoutRef = useRef<TigLayoutRef | null>(null);
    const [loadEndStatus, setLoadEndStatus] = useState(true);
    const [failLoad, setFailLoad] = useState(false);
    const [productPrice, setProductPrice] = useState<string>("0");
    const [, setProductOriginPrice] = useState<string | number | null>("0");
    const [, setProductNumber] = useState<number>(1);
    const [isCollect, setIsCollect] = useState(false);
    const [joinUsers, setJoinUsers] = useState<GrouponJoinUser[]>([]);

    const getValue = (val: SpecificationSendValuePayload) => {
        setProductStock(val.productStock);
        setProductPrice(String(val.productPrice));
        setProductOriginPrice(val.productOriginPrice);
        setProductNumber(val.productNumber);
    };

    const getLoadStatus = () => {
        setLoadEndStatus(false);
    };

    const __getProductDetail = async (id: number) => {
        try {
            const result: any = await getProductDetail(id);
            setProductStock(result.item.productStock);
            setProductPrice(result.item.productPrice || "0");
            setSpecificationId(result.item.productId);
            setProductId(result.item.productId);
            setProduct(result.item);

            if (result.item.shopId) {
                void getShopInfo(result.item.shopId);
            }
            setTimeout(() => {
                layoutRef.current?.handleLog();
            }, 0);
        } catch (error: any) {
            console.error(error);
            setFailLoad(true);
            setLoadEndStatus(false);
        }
    };

    /**
     * 当前用户是否参过团
     */
    const isUserJoined = useMemo(() => {
        if (!grouponRecordDetail) {
            return false;
        }
        return (grouponRecordDetail.joinUsers || []).some((item) => item.userId === userStore.userInfo?.userId);
    }, [grouponRecordDetail, userStore.userInfo?.userId]);

    /**
     * 团是否结束了
     */
    const isGroupEnd = () => {
        // 不是待成团的状态，拼团结束了
        if (grouponRecordDetail.joinStatus !== 1) {
            return true;
        }
        if (!grouponRecordDetail.endTime) {
            return true;
        }
        const endTime = dateStringToTimestamp(grouponRecordDetail.endTime);
        return endTime < new Date().getTime();
    };

    /*时间字符串转时间戳 */
    const dateStringToTimestamp = (dateString: any) => {
        const dateParts = dateString.split(" ");
        const [year, month, day] = dateParts[0].split("-");
        const [hour, minute, second] = dateParts[1].split(":");
        const date = new Date(year, month - 1, day, hour, minute, second);
        return date.getTime();
    };

    // 获取店铺信息
    const getShopInfo = async (id: number) => {
        try {
            const result = await getShopDetail(id);
            setShopInfo(result);
            setIsCollect(result.collectShop);
        } catch (error: any) {
            console.error(error);
        }
    };

    const toProductPage = (id: number) => {
        redirect({
            url: `/pages/product/index?id=${id}`
        });
    };

    // 跳转
    const toPage = (url: string) => {
        redirect({ url });
    };

    // 跳转店铺
    const handleToShop = () => {
        if (shopInfo.shopId) {
            // TODO(MIGRATION)：store/region 当前为 stub，currentLocationInfo 待 region 全量迁移后补全，空值兜底。
            const regionStore = useRegionStore.getState() as any;
            const location = regionStore.currentLocationInfo || {};
            Taro.navigateTo({
                url: `/pages/store/index?id=${shopInfo.shopId}&latitude=${location.latitude ?? ""}&longitude=${location.longitude ?? ""}`
            });
        }
    };

    /**
     * 加入拼团
     */
    const hanldeJoinGroup = () => {
        setGrouponRecordInfo({
            grouponPromotionRecordId: grouponRecordDetail.grouponPromotionRecordId,
            minGroupNum: grouponRecordDetail.minGroupNum,
            skuId: grouponRecordDetail.skuId
        });
        setGrouponEnable(true);
        specificationRef.current?.handleShowPopup();
    };

    const collectText = useMemo(() => {
        return isCollect ? t("取消收藏") : t("收藏门店");
    }, [isCollect]);

    /**
     * 处理店铺收藏
     */
    const handleShopCollection = async () => {
        await shopCollection({ shopId: shopInfo.shopId });
        Taro.showToast({
            title: isCollect ? t("取消收藏成功") : t("收藏成功"),
            icon: "none"
        });
        await getShopInfo(shopInfo.shopId);
    };

    /**
     * 处理分享
     */
    const handleShare = () => {
        if (!ensureShareLogin(true)) {
            return;
        }
        setShowShare(true);
    };

    // 拿到拼团记录详情
    const getDetail = async () => {
        try {
            const result = await getGrouponRecordDetail(grouponPromotionRecordId);
            setGrouponRecordDetail(result);
            setJoinUsers([...result.joinUsers].sort((a, b) => (b.leader ? 1 : -1)));
            switch (result.joinStatus) {
                case 2:
                    setPageTitle(t("拼团成功"));
                    break;
                case 3:
                    setPageTitle(t("拼团失败"));
                    break;
                case 1:
                default:
                    setPageTitle(t("拼团"));
            }
            void __getProductDetail(result.productId);
            setSkuId(result.skuId);
            // 如果有商铺id
            if (result.shopId) {
                await getShopInfo(result.shopId);
            }
        } catch (error: any) {
            setFailLoad(true);
            setLoadEndStatus(false);
            console.error(error);
        }
    };

    const showSpecification = () => {
        if (specificationRef.current) {
            setGrouponEnable(false);
            specificationRef.current.handleShowPopup();
        }
    };

    /**
     * 查看其他商品
     */
    const handleToProductList = () => {
        Taro.navigateTo({ url: "/pages/search/result" });
    };

    /**
     * 查看更多拼团
     */
    const toMoreGroupon = () => {
        redirect({ url: `/pages/groupon/list?id=${grouponRecordDetail.grouponPromotionId}`, mode: "redirectTo" });
    };

    // 页面加载
    useEffect(() => {
        const recordId = Number(router.params.grouponPromotionRecordId || 0);
        if (recordId) {
            setGrouponPromotionRecordId(recordId);
        } else {
            setFailLoad(true);
            setLoadEndStatus(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 对应旧 onLoad：拿到 id 后请求详情
    useEffect(() => {
        if (grouponPromotionRecordId) {
            void getDetail();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [grouponPromotionRecordId]);

    useShareAppMessage(() => {
        return {
            title: grouponRecordDetail.productName || product.productName || t("拼团"),
            path: `/pages/product/groupBuying?grouponPromotionRecordId=${grouponPromotionRecordId}`,
            imageUrl: productImage(product)
        };
    });

    useShareTimeline(() => {
        return {
            title: grouponRecordDetail.productName || product.productName || t("拼团"),
            query: `grouponPromotionRecordId=${grouponPromotionRecordId}`,
            imageUrl: productImage(product)
        };
    });

    return (
        <View>
            <TigLayout ref={layoutRef} title={pageTitle}>
                {!failLoad ? (
                    <View className="groupon-info-container" style={{ display: !loadEndStatus ? undefined : "none" }}>
                        <View className="card-box product-card">
                            <View className="image" onClick={() => toProductPage(product.productId)}>
                                <TigImage src={pickPic(product)} mode="heightFix" />
                            </View>
                            <View className="detail">
                                <View className="header" onClick={() => toProductPage(product.productId)}>
                                    <View className="line2">
                                        <Text className="detail-title">{grouponRecordDetail.productName}</Text>
                                    </View>
                                    <View className="detail-group">
                                        <Text className="btn">
                                            {grouponRecordDetail.minGroupNum}
                                            {t("人团")}
                                        </Text>
                                        <Text className="num">
                                            {t("已有") + grouponRecordDetail.joinNumCount + t("人参团")}
                                        </Text>
                                    </View>
                                </View>
                                <View className="flex">
                                    <View className="group-price">
                                        <Text className="price-text">{t("拼团价")}:</Text>
                                        <FormatPrice
                                            currencyStyle={{ fontSize: "23rpx" }}
                                            priceData={grouponRecordDetail.grouponPrice}
                                        />
                                    </View>
                                    <View className="original-price">
                                        <FormatPrice
                                            fontStyle={{ textDecoration: "line-through" }}
                                            currencyStyle={{ fontSize: "23rpx" }}
                                            priceData={grouponRecordDetail.productPrice}
                                        />
                                    </View>
                                </View>
                            </View>
                        </View>
                        <View className="card-box group-card">
                            <View className="group-sub-title">
                                {grouponRecordDetail.joinStatus === 1 ? (
                                    <View className="text">
                                        <Text>{t("还差")}</Text>
                                        <Text className="num">
                                            {joinUsers.length > grouponRecordDetail.minGroupNum
                                                ? 0
                                                : grouponRecordDetail.minGroupNum - joinUsers.length}
                                        </Text>
                                        <Text>{t("人成团")}</Text>
                                    </View>
                                ) : null}
                                {grouponRecordDetail.joinStatus === 2 ? (
                                    <View className="flex align-center">
                                        <Text className="text">{t("拼团成功")}</Text>
                                        <Text className="msg">{t("商家会尽快发货")}</Text>
                                    </View>
                                ) : null}
                                {grouponRecordDetail.joinStatus === 3 ? (
                                    <View className="flex align-center">
                                        <Text className="text">{t("拼团失败")}</Text>
                                        <Text className="msg">{t("超时未成团，系统将原路退款")}</Text>
                                    </View>
                                ) : null}
                                {!isGroupEnd() ? (
                                    <View className="group-end-info flex align-center">
                                        <View className="countdown-title">{t("距结束")}</View>
                                        <TigCountdown
                                            backgroundColor="var(--primary-light-9)"
                                            splitorColor="#1A1A1A"
                                            color="var(--ump-price)"
                                            endTime={grouponRecordDetail.endTime}
                                            fontSize={11}
                                        />
                                    </View>
                                ) : null}
                            </View>
                            <ScrollView className="join-users" scrollX showScrollbar enableFlex>
                                <View className="userinfo-container">
                                    {joinUsers.map((item, index) => (
                                        <View key={item.userId || index} className="userinfo">
                                            <View className="userinfo-avatar">
                                                <View className="image">
                                                    <TigImage src={imageFormat(item?.avatar || configStore.defaultAvatar)} />
                                                </View>
                                                {item.leader ? <View className="image-leader">{t("团长")}</View> : null}
                                            </View>
                                            <Text className="name">{hideUserName(item.username || "")}</Text>
                                        </View>
                                    ))}
                                    {grouponRecordDetail.joinStatus === 1 &&
                                    grouponRecordDetail.joinNumCount < grouponRecordDetail.minGroupNum ? (
                                        <View className="userinfo" onClick={handleShare}>
                                            <View className="userinfo-avatar">
                                                <View className="image">
                                                    <View className="btn-add">
                                                        <View className="iconfont-h5 icon-zengjia" />
                                                    </View>
                                                </View>
                                            </View>
                                            <Text className="name">{t("待加入")}</Text>
                                        </View>
                                    ) : null}
                                </View>
                            </ScrollView>
                        </View>
                        <View className="card-box process-card">
                            <View className="sub-title">
                                <Text>{t("拼团流程")}</Text>
                            </View>
                            <View className="process">
                                <View className="process-item">
                                    <Image className="process-image" src={staticResource("groupon/groupon_open.png")} />
                                    <View className="step-name">
                                        <Text>{t("1.开团/参加")}</Text>
                                    </View>
                                </View>
                                <View className="process-line">
                                    {[1, 2, 3].map((i) => (
                                        <View key={i} className="process-line-item" />
                                    ))}
                                </View>
                                <View className="process-item">
                                    <Image className="process-image" src={staticResource("groupon/groupon_invite.png")} />
                                    <View className="step-name">
                                        <Text>{t("2.邀友参团")}</Text>
                                    </View>
                                </View>
                                <View className="process-line">
                                    {[1, 2, 3].map((i) => (
                                        <View key={i} className="process-line-item" />
                                    ))}
                                </View>
                                <View className="process-item">
                                    <Image className="process-image" src={staticResource("groupon/groupon_success.png")} />
                                    <View className="step-name">
                                        <Text>{t("3.人满成团")}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                        {shopInfo.shopId ? (
                            <View className="card-box store-card">
                                <View className="shop-info">
                                    <TigImage className="shop-image" src={imageFormat(shopInfo.shopLogo || "")} />
                                    <Text className="shop-title">{shopInfo.shopTitle}</Text>
                                </View>
                                <View className="store">
                                    <View className="btn" onClick={handleShopCollection}>
                                        <Text>{collectText}</Text>
                                    </View>
                                    <View className="btn" onClick={handleToShop}>
                                        <Image src={staticResource("product/shop.png")} className="img" />
                                        <Text>{t("进店逛逛")}</Text>
                                    </View>
                                </View>
                            </View>
                        ) : null}
                        <View className="footer">
                            <View
                                className="bottom-bar-box"
                                style={{ paddingBottom: `${configStore.safeAreaInsets.bottom}rpx` }}
                            >
                                <View className="bottom-bar flex align-center">
                                    <View className="icon-box">
                                        <View
                                            className="label my-groupon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toPage("/pages/groupon/mylist");
                                            }}
                                        >
                                            <View>
                                                <Image src={staticResource("groupon/groupon.png")} className="img" />
                                            </View>
                                            <View className="label-text">
                                                <Text className="my-group-text">{t("我的拼团")}</Text>
                                            </View>
                                        </View>
                                        {shopInfo.shopId ? (
                                            <View className="label" onClick={handleToShop}>
                                                <View>
                                                    <Image src={staticResource("product/shop.png")} className="img" />
                                                </View>
                                                <View className="label-text">
                                                    <Text>{t("门店")}</Text>
                                                </View>
                                            </View>
                                        ) : null}
                                    </View>
                                    <View className="btn-box">
                                        {product.productStatus === 0 || productStock === 0 ? (
                                            <View className="other-products-btn" onClick={handleToProductList}>
                                                {t("查看其他商品")}{" "}
                                            </View>
                                        ) : (
                                            <>
                                                {product.productType === 1 || grouponRecordDetail.joinStatus === 1 ? (
                                                    <>
                                                        {/* 待成团 */}
                                                        {grouponRecordDetail.joinStatus === 1 ? (
                                                            <>
                                                                {/* 参与类型是参团 */}
                                                                {!isUserJoined ? (
                                                                    <View className="other-products-btn" onClick={hanldeJoinGroup}>
                                                                        {t("去参团")}
                                                                    </View>
                                                                ) : (
                                                                    <View className="other-products-btn" onClick={handleShare}>
                                                                        {t("邀请好友参团")}
                                                                    </View>
                                                                )}
                                                            </>
                                                        ) : grouponRecordDetail.joinStatus === 2 ? (
                                                            /* 拼团成功 */
                                                            <View className="other-products-btn" onClick={toMoreGroupon}>
                                                                {t("更多拼团")}
                                                            </View>
                                                        ) : grouponRecordDetail.joinStatus === 3 ? (
                                                            /* 拼团失败 */
                                                            <View className="other-products-btn" onClick={showSpecification}>
                                                                {t("原价购买")}
                                                            </View>
                                                        ) : null}
                                                    </>
                                                ) : (
                                                    <View className="other-products-btn" onClick={showSpecification}>
                                                        {t("立即购买")}
                                                    </View>
                                                )}
                                            </>
                                        )}
                                    </View>
                                    {product.productStatus === 0 || productStock === 0 ? (
                                        <View className="product-status">
                                            {t(product.productStatus === 0 ? "商品已下架" : "商品已售罄")}
                                        </View>
                                    ) : null}
                                </View>
                            </View>
                        </View>
                        <GrouponShare
                            modelValue={showShare}
                            onChange={setShowShare}
                            productId={Number(productId)}
                            productInfo={product}
                            productPrice={productPrice}
                            grouponPromotionId={grouponRecordDetail.grouponPromotionId}
                            grouponPromotionRecordId={grouponPromotionRecordId}
                        />
                        <Specification
                            ref={specificationRef}
                            productId={specificationId}
                            skuId={skuId}
                            onSkuIdChange={setSkuId}
                            grouponEnable={grouponEnable}
                            grouponRecordInfo={grouponRecordInfo as any}
                            onLoadEnd={getLoadStatus}
                            onSendValue={getValue}
                        />
                    </View>
                ) : (
                    <>
                        <ErrorComp />
                        <Recommend titleBg="#fff" />
                    </>
                )}
            </TigLayout>
            <TigLoadingPage modelValue={loadEndStatus} />
        </View>
    );
}