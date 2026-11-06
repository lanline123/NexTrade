import { useEffect, useMemo, useRef, useState } from "react";
import { Image, ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useRouter, useShareAppMessage, useShareTimeline, useUnload } from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import ProductNav from "../product/src/productNav";
import ProductImg from "../product/src/productImg";
import ProductTitleInfo, { type ProductTitleInfoRef } from "../product/src/productTitleInfo";
import ProductComment from "../product/src/productComment";
import ProductCoupon from "../product/src/productCoupon";
import ProductGroupon from "../product/src/productGroupon";
import ProductGrouponMore from "../product/src/productGrouponMore";
import ProductContent from "../product/src/productContent";
import Specification, { type SpecificationRef, type SpecificationSendValuePayload } from "@/components/product/specification";
import TigLayout, { type TigLayoutRef } from "@/components/tig/tig-layout/TigLayout";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigBackTop from "@/components/tig/tig-back-top";
import TigLoadingPage from "@/components/tig/tig-loadingpage";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import FormatPrice from "@/components/format-price/FormatPrice";
import Service from "@/components/service";
import Recommend from "@/components/recommend";

import ErrorComp from "./src/Error";
import Animation from "./src/Animation";
import ProductShopInfo from "./src/ProductShopInfo";

import { imageFormat } from "@/utils/format";
import { setPageMeta, setJsonLd, extractDescription, clearJsonLd } from "@/utils/seo";
import { getProductDetail } from "@/api/product/product";
import { getActiveStyle } from "@/api/product/productStyle";
import type { ProductActiveStyleVO } from "@/types/product/productStyle";
import { getExchangeDetail } from "@/api/exchange/exchange";
import { useConfigStore } from "@/store/config";
import { useUserStore } from "@/store/user";
import { asyncGetCartCount } from "@/api/cart/cart";
import type {
    PicList,
    ProductItem,
    AttrList,
    SkuList,
    ServiceList,
    RankDetail,
    DescArr,
    SkuPromotion,
    VideoList,
    GrouponDetail
} from "@/types/product/product";
import type { PresaleInfo } from "@/types/presale/presale";
import type { ShopDetailItem } from "@/types/shop/shop";
import { getShopDetail } from "@/api/shop/shop";
import { getStoreDetail } from "@/api/store/store";
import type { StoreDetailData } from "@/types/store/store";
import { redirect, getElementRect, staticResource, isB2B, parseQueryString } from "@/utils";
import { resolveMiniScene } from "@/api/common";
import { useScrollTop } from "@/hooks";
import { useRegionStore } from "@/store/region";
import type { GrouponRecordListParams, GrouponRecordItem } from "@/types/groupon/groupon";
import { getGrouponRecordList } from "@/api/groupon/groupon";
import { isSubCardReservationProduct as checkIsSubCardReservationProduct } from "@/utils/productSoldOut";
import { t } from "@/utils/i18n";

import "./index.scss";
import { usePageGuards } from "@/utils/pageMixin";

/**
 * 商品详情页（自旧 uniapp pages/productV1/index.vue 移植，1475 行）
 * - 展示商品图片、标题、价格、规格、评论等完整信息
 * - 支持秒杀、拼团、周期购、预约服务等多种商品类型
 * - SKU选择、购物车、立即购买等核心交互
 * - 门店信息、优惠券领取、收藏分享等功能
 *
 * 复用决策：productNav/productImg/productTitleInfo/productComment/productCoupon/
 * productGroupon/productGrouponMore/productContent 与 B2 pages/product/src 同名组件
 * props 契约一致，直接跨目录复用；ProductShopInfo 无等价组件（契约不同）→ 本目录新建。
 */
export default function ProductV1Index() {
    usePageGuards();
    const router = useRouter();

    const configStore = useConfigStore();
    const userToken = useUserStore((s) => s.token);
    const userServiceConfigShow = useUserStore((s) => s.serviceConfig.show);

    const { scrollTop } = useScrollTop();

    const [productId, setProductId] = useState(0);
    const [showAttrRef, setShowAttrRef] = useState(false);
    const [showMoreGroupon, setShowMoreGroupon] = useState(false);
    const specificationRef = useRef<SpecificationRef | null>(null);
    const titleInfoRef = useRef<ProductTitleInfoRef | null>(null);
    const layoutRef = useRef<TigLayoutRef | null>(null);
    const [specificationId, setSpecificationId] = useState(0);
    const [animationPosition, setAnimationPosition] = useState({
        top: 0,
        left: 0
    });
    const [type, setType] = useState("");
    // 旧 Vue ref 语义：异步函数在请求发起时读取当时的 type，React state 闭包会滞后，故保留 ref 镜像。
    const typeRef = useRef("");
    const setTypeBoth = (val: string) => {
        typeRef.current = val;
        setType(val);
    };
    const [exchangeIntegral, setExchangeIntegral] = useState(0);
    const [skuId, setSkuId] = useState(0);

    /**
     * @description 显示规格参数弹窗
     */
    const showDrawer = () => {
        setShowAttrRef(true);
    };

    /**
     * @description 显示更多拼团列表弹窗
     */
    const handleShowMore = () => {
        setShowMoreGroupon(true);
    };

    /**
     * @description 显示规格选择弹窗（单独购买模式）
     */
    const showSpecification = () => {
        if (specificationRef.current) {
            setGrouponEnable(false);
            specificationRef.current.handleShowPopup();
        }
    };

    /**
     * @description 显示规格选择弹窗（开团模式）
     * 用于发起新的拼团
     */
    const showGrouponPoup = () => {
        if (specificationRef.current) {
            setGrouponEnable(true);
            setGrouponRecordInfo((prev) => ({ ...prev, minGroupNum: 0, grouponPromotionRecordId: 0 }));
            specificationRef.current.handleShowPopup();
        }
    };

    const [product, setProduct] = useState<ProductItem>({
        productId: 0,
        productStock: 0
    });

    // 预售信息（saleMode>0 时存在）
    const productPresale = useMemo<PresaleInfo | null>(() => {
        const info = (product as any)?.presaleInfo;
        const saleMode = Number((product as any)?.saleMode ?? info?.saleMode ?? 0);
        if (saleMode > 0 && info) return info as PresaleInfo;
        return null;
    }, [product]);
    const isPresale = useMemo(() => Number(productPresale?.saleMode ?? 0) > 0, [productPresale]);
    const [attrList, setAttrList] = useState<AttrList>({} as AttrList);
    const [skuList, setSkuList] = useState<SkuList[]>([]);
    const [picList, setPicList] = useState<PicList[]>([]);
    const [serviceList, setServiceList] = useState<ServiceList[]>([]);
    const [rankDetail, setRankDetail] = useState<RankDetail>({} as RankDetail);
    const [descArr, setDescArr] = useState<DescArr[]>([]);
    const [checkedValue, setCheckedValue] = useState<string[]>([]);
    const [videoList, setVideoList] = useState<VideoList[]>([]);
    const [failLoad, setFailLoad] = useState(false);
    const [grouponEnable, setGrouponEnable] = useState(true);
    const [activityStyleData, setActivityStyleData] = useState<ProductActiveStyleVO | null>(null);
    const activityBgImage = useMemo(() => activityStyleData?.activityBackgroundImage || "", [activityStyleData]);
    // 详情接口（商品/兑换）已返回并完成数据落地后，才允许子组件做“是否售罄”的判断
    const [detailLoaded, setDetailLoaded] = useState(false);

    const [shopId, setShopId] = useState<number>(-1);
    // 对应旧 shopId ref：__getProductDetail 需要在 setShopId 后立即读到最新值
    const shopIdRef = useRef<number>(-1);
    const setShopIdBoth = (val: number) => {
        shopIdRef.current = val;
        setShopId(val);
    };
    const [formType, setFormType] = useState(false);

    // 规格组件加载完成（用于避免它先触发结束 loading，而详情接口还没返回）
    const specLoadedRef = useRef(false);
    // 详情接口落地 / 失败标记（旧 ref 语义，finally 中同步读取）
    const detailLoadedRef = useRef(false);
    const failLoadRef = useRef(false);

    // 是否是周期购
    const [cycleInfo, setCycleInfo] = useState<any>({});
    const [isCycleBuy, setIsCycleBuy] = useState(true);

    // 是否是次卡
    const [isSubCard, setIsSubCard] = useState(false);

    // 是否是次卡商品，并且是预约商品
    const isSubCardReservationProduct = useMemo(() => {
        return checkIsSubCardReservationProduct(product as unknown as Record<string, unknown>, isSubCard);
    }, [product, isSubCard]);

    const fetchActivityStyle = async (pid: number) => {
        try {
            const result = await getActiveStyle(pid);
            setActivityStyleData(result);
        } catch {
            setActivityStyleData(null);
        }
    };

    /**
     * @description 获取商品详情
     * O2O场景下优先使用指定门店ID，否则使用最近门店ID
     * 支持普通商品和积分兑换商品两种模式
     * @param id 商品ID或包含sn的对象
     */
    const __getProductDetail = async (id: number | object) => {
        try {
            setLoadEndStatus(true);
            setDetailLoaded(false);
            detailLoadedRef.current = false;
            let result: any = {};

            let params: any = {
                shopId: null,
                nearestShopId: null
            };

            if (typeof id === "object") {
                params = { ...params, ...id };
            } else {
                params.id = id;
            }
            if (shopIdRef.current > -1) {
                params.shopId = shopIdRef.current;
            } else {
                params.nearestShopId = (useRegionStore.getState() as any).nearestShopInfo?.shopId || null;
            }

            switch (typeRef.current) {
                case "exchange":
                    if (typeof id === "object") return;
                    result = await getExchangeDetail(params);
                    setExchangeIntegral(result.exchangeInfo.exchangeIntegral);
                    setProductStock(Number(result.exchangeInfo?.productStock ?? 0));
                    setProductPrice(result.exchangeInfo.discountsPrice || "0");
                    setSpecificationId(result.exchangeInfo.id);
                    break;
                default:
                    result = await getProductDetail(params);
                    setProductStock(Number(result.item?.productStock ?? 0));
                    setProductPrice(result.item.productPrice || "0");
                    setSpecificationId(result.item.productId);
            }
            setProductId(result.item.productId);
            setProduct(result.item);
            setAttrList(result.attrList);
            setPicList(result.picList);
            setVideoList(result.videoList);
            setRankDetail(result.rankDetail);
            setSkuList(result.skuList);
            setCheckedValue(result.checkedValue);
            setDescArr(result.descArr);
            setServiceList(result.serviceList);
            getGrouponRecordsParamsRef.current.productId = result.item.productId;
            Taro.setNavigationBarTitle({
                title: result.item.productName
            });
            // 对应旧 #ifdef H5
            if (process.env.TARO_ENV === "h5") {
                const shopTitle = configStore.baseInfo.shopTitle;
                const productTitle = `${result.item.productName} - ${shopTitle}`;
                const productDesc = extractDescription(result.item.productBrief || result.item.productDesc || result.item.productName);
                const productImage = imageFormat(result.item.picUrl || "");

                setPageMeta({
                    title: productTitle,
                    description: productDesc,
                    keywords: result.item.productName,
                    image: productImage,
                    type: "product"
                });

                setJsonLd({
                    "@context": "https://schema.org",
                    "@type": "Product",
                    name: result.item.productName,
                    description: productDesc,
                    image: productImage,
                    url: window.location.href,
                    offers: {
                        "@type": "Offer",
                        price: result.item.productPrice,
                        priceCurrency: "CNY",
                        availability: result.item.productStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
                    }
                });
            }

            // 优先使用传入的 shopId，如果没有则使用接口返回的
            const finalShopId = shopIdRef.current > -1 ? shopIdRef.current : (result.shopId ?? -1);
            setShopIdBoth(finalShopId);

            if (finalShopId > -1) {
                getStoreDetailData(finalShopId);
                getShopInfo(finalShopId);
            }

            fetchActivityStyle(result.item.productId);

            // 数据已落地，允许展示“已售罄”遮罩（最终是否售罄由库存判断决定）
            detailLoadedRef.current = true;
            setDetailLoaded(true);
            setTimeout(() => {
                layoutRef.current?.handleLog();
            }, 0);
            // 只有“规格组件加载完成 + 详情接口落地完成”同时满足，才结束 loading
            if (specLoadedRef.current) setLoadEndStatus(false);
        } catch (error: any) {
            console.error(error);
            failLoadRef.current = true;
            setFailLoad(true);
            setLoadEndStatus(false);
        } finally {
            // 成功场景下由 specLoaded/detailLoaded 共同控制 loading；失败则直接结束
            if (failLoadRef.current) {
                setLoadEndStatus(false);
            } else if (detailLoadedRef.current && specLoadedRef.current) {
                setLoadEndStatus(false);
            } else {
                setLoadEndStatus(true);
            }
        }
    };

    const [loadEndStatus, setLoadEndStatus] = useState(true);

    /**
     * @description 规格组件加载完成回调，隐藏加载页
     */
    const getLoadStatus = () => {
        specLoadedRef.current = true;
        if (detailLoadedRef.current) {
            setLoadEndStatus(false);
        }
    };

    const [storeInfo, setStoreInfo] = useState<StoreDetailData>({} as StoreDetailData);

    /**
     * @description 获取门店详情信息
     * O2O场景特有，用于显示门店地址、营业时间等
     * @param shopId 门店ID
     */
    const getStoreDetailData = async (shopId: number) => {
        try {
            const result = await getStoreDetail({ shopId });
            setStoreInfo(result);
        } catch (error) {
            console.error("Error fetching store details:", error);
        }
    };

    const [skuStr, setSkuStr] = useState<string>("");
    const [productPrice, setProductPrice] = useState<string>("0");
    const [productOriginPrice, setProductOriginPrice] = useState<string | number | null>(null);
    const [productStock, setProductStock] = useState<number>(0);
    const [isSeckill, setIsSeckill] = useState<number>(0);
    const [seckillValue, setSeckillValue] = useState<any>({});
    const [productNumber, setProductNumber] = useState<number>(1);
    const [promotionList, setPromotionList] = useState<SkuPromotion[]>([]);
    const [isDiscount, setIsDiscount] = useState<number>(0);
    const [isGroupon, setIsGroupon] = useState<number>(0);
    const [discountValue, setDiscountValue] = useState<any>({});
    const [discountEndTime, setDiscountEndTime] = useState<string>("");
    const [grouponValue, setGrouponValue] = useState<any>({});

    /**
     * @description 接收规格组件传递的商品信息
     * 包含价格、库存、促销活动、拼团信息等
     * @param val 商品规格相关数据
     */
    const getValue = (val: SpecificationSendValuePayload) => {
        console.log("getValue", val);
        if (val.productSkuId && val.skuStr) {
            setSkuStr(val.skuStr);
        }
        // 规格组件回传的库存可能是 string/undefined，这里统一转 number，保证后续判断稳定
        setProductStock(Number((val as any)?.productStock ?? 0));
        setPromotionList(val.promotionList);
        setProductPrice(String(val.productPrice));
        // 对应旧 val.cycleInfo?.originalPrice（React 规格载荷中 cycleInfo 可能缺省）
        setProductOriginPrice((val as any).cycleInfo?.originalPrice || val.productOriginPrice);
        setProduct((prev) => ({ ...prev, marketPrice: (val.marketPrice || val.productOriginPrice || prev.marketPrice) as any }));
        setProductNumber(val.productNumber);
        setIsSeckill(val.isSeckill);
        setSeckillValue(val.seckillValue);
        setIsDiscount(val.isDiscount);
        setDiscountValue(val.discountValue);
        setDiscountEndTime((val as any).discountEndTime ?? "");
        setGrouponValue(val.grouponValue);
        // 旧 ref 写入后同步读取，这里以本次载荷为据
        const nextIsGroupon = val.grouponValue?.productId ? 1 : 0;
        setIsGroupon(nextIsGroupon);

        // 预售优先：预售商品不再叠加秒杀/折扣/拼团活动，避免标题区同时显示秒杀价与预售价
        if (isPresale) {
            setIsSeckill(0);
            setIsDiscount(0);
            setIsGroupon(0);
        }

        if (nextIsGroupon) {
            void getGrouponRecords();
        }

        // 预售（SKU 联动定金）
        if ((val as any).depositAmount !== undefined && (val as any).depositAmount !== null && isPresale) {
            setProduct((prev) => {
                const next = { ...prev } as any;
                if (!next.presaleInfo) next.presaleInfo = {} as PresaleInfo;
                next.presaleInfo.depositAmount = Number((val as any).depositAmount);
                return next;
            });
        }
    };

    // 定金预售：尾款时间文案
    const paymentTimeText = useMemo(() => {
        const info = productPresale;
        if (!info || Number(info.saleMode) !== 2) return "";

        if (Number(info.finalPaymentType) === 1) {
            return info.finalPaymentRelativeDays ? t("付定金{0}天后开始", { 0: info.finalPaymentRelativeDays }) : "";
        }
        return info.finalPaymentStartTime ? `${info.finalPaymentStartTime}${t("开始")}` : "";
    }, [productPresale]);

    // 预售：发货时间文案
    const deliverTimeText = useMemo(() => {
        const info = productPresale;
        if (!info) return "";

        if (Number(info.deliveryType) === 1) {
            const days = info.deliveryRelativeDays ? `${info.deliveryRelativeDays}${t("天")}` : "";
            const hours = info.deliveryRelativeHours ? `${info.deliveryRelativeHours}${t("小时")}` : "";
            return `${Number(info.saleMode) === 1 ? t("付全款") : t("付尾款")}${days}${hours}${t("后发货")}`;
        }
        return info.deliveryDate ? `${info.deliveryDate}${t("开始")}` : "";
    }, [productPresale]);
    const [cartCount, setCartCount] = useState<number>(0);

    /**
     * @description 获取购物车商品数量（用于底部栏角标显示）
     */
    const _getCartCount = async () => {
        try {
            const result = await asyncGetCartCount();
            setCartCount(result);
        } catch (error) {
            console.error(error);
        }
    };

    /**
     * @description 页面跳转
     * @param url 目标页面路径
     */
    const toPage = (url: string) => {
        redirect({ url });
    };

    const [showCoupon, setShowCoupon] = useState(false);

    /**
     * @description 计算商品参数名称展示文本
     */
    const shuxinText = useMemo(() => {
        if (attrList.normal && attrList.normal.length) {
            const names = attrList.normal.map((item: any) => item.attrName);
            return names.join("/");
        }
        return "";
    }, [attrList.normal]);

    /**
     * @description 跳转首页
     */
    const handleToHome = () => {
        Taro.switchTab({ url: "/pages/index/index" });
    };

    /**
     * @description 商品售罄/下架时跳转商品列表查看其他商品
     */
    const handleToProductList = () => {
        Taro.navigateTo({ url: "/pages/search/result" });
    };

    const systemInfo = useRef<any>(Taro.getSystemInfoSync());

    /**
     * @description 滚动到指定模块位置
     * @param module 模块选择器（如.product-area）
     */
    const handleScrollTo = (module: string) => {
        const query = Taro.createSelectorQuery();
        query.select(module).boundingClientRect();
        query.selectViewport().scrollOffset(() => {});
        query.exec((res: any) => {
            if (!res?.[0] || !res?.[1]) return;
            Taro.pageScrollTo({
                scrollTop: res[0].top + res[1].scrollTop - 50,
                duration: 0
            });
        });
    };
    const [activeModule, setActiveModule] = useState(".product-area");
    const productObserverRef = useRef<any>(null);
    const evaluateObserverRef = useRef<any>(null);
    const productDetailObserverRef = useRef<any>(null);

    /**
     * @description 创建交叉观察器，用于导航栏高亮切换
     * @param observer 观察器实例
     * @param module 模块选择器
     */
    const getObserver = (observer: any, module: string) => {
        observer.relativeToViewport({ bottom: -(systemInfo.current.windowHeight - 200) }).observe(module, (res: any) => {
            if (res.intersectionRatio > 0) {
                setActiveModule(module);
            }
        });
    };

    // 对应旧 onReady
    useEffect(() => {
        const page = (Taro.getCurrentInstance().page ?? {}) as any;
        productObserverRef.current = Taro.createIntersectionObserver(page, { observeAll: false });
        evaluateObserverRef.current = Taro.createIntersectionObserver(page, { observeAll: false });
        productDetailObserverRef.current = Taro.createIntersectionObserver(page, { observeAll: false });
        getObserver(productObserverRef.current, ".product-area");
        getObserver(evaluateObserverRef.current, ".evaluate-area");
        getObserver(productDetailObserverRef.current, ".product-detail-area");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 对应旧 onUnload
    useUnload(() => {
        // 对应旧 #ifdef H5
        if (process.env.TARO_ENV === "h5") {
            clearJsonLd();
        }
        if (productObserverRef.current) {
            productObserverRef.current?.disconnect();
            productObserverRef.current = null;
        }
        if (evaluateObserverRef.current) {
            evaluateObserverRef.current?.disconnect();
            evaluateObserverRef.current = null;
        }
        if (productDetailObserverRef.current) {
            productDetailObserverRef.current?.disconnect();
            productDetailObserverRef.current = null;
        }

        const pages = Taro.getCurrentPages();
        const index = pages.findIndex((item: any) => item.route === "pages/product/index");
        if (index === -1) {
            Taro.eventCenter.off("refreshStoreInfo");
        }

        // 对应旧 #ifdef H5 || APP（Taro 无 App 运行时，仅 H5 处理）
        if (process.env.TARO_ENV === "h5") {
            (Taro as any).closePreviewImage?.();
        }
    });

    /**
     * @description 保存分销员推广商品关系
     * 用于追踪分销员推广业绩
     * @param salesmanId 分销员ID
     * @param productId 商品ID
     */
    const saveSalesmanProducts = (salesmanId: string, productId: string) => {
        let salesmanProducts = Taro.getStorageSync("salesmanProducts") || [];
        if (salesmanProducts.length > 0) {
            const index = salesmanProducts.findIndex((item: any) => item.productId == productId);
            if (index !== -1) {
                salesmanProducts[index].salesmanId = salesmanId;
            }
        }
        salesmanProducts = [...salesmanProducts, { salesmanId, productId }];
        Taro.setStorageSync("salesmanProducts", salesmanProducts);
    };

    const init = async (option: any) => {
        if (option) {
            // 对应旧 #ifdef MP-WEIXIN
            if (process.env.TARO_ENV === "weapp" && option.scene) {
                const sceneStr = decodeURIComponent(String(option.scene));
                Object.assign(option, parseQueryString(sceneStr));
                if (option.s && !option.salesmanId) {
                    option.salesmanId = option.s;
                }
                if (!option.id && sceneStr && !sceneStr.includes("=")) {
                    try {
                        const resolved = await resolveMiniScene(sceneStr);
                        if (resolved?.id) {
                            option.id = String(resolved.id);
                        }
                        if (resolved?.salesmanId) {
                            option.salesmanId = String(resolved.salesmanId);
                        }
                    } catch (error) {
                        console.error(error);
                    }
                }
                // 短码场景下若最终仍未解析出商品 ID，避免页面空白且无任何反馈
                if (!option.id && !option.sn) {
                    Taro.showToast({ title: t("商品参数无效，请重新进入"), icon: "none", duration: 2000 });
                    setTimeout(() => {
                        const pages = Taro.getCurrentPages();
                        if (pages.length > 1) {
                            Taro.navigateBack();
                        } else {
                            Taro.switchTab({ url: "/pages/index/index" });
                        }
                    }, 1500);
                    return;
                }
            }

            if (option.type) {
                setTypeBoth(option.type);
            }
            if (option.shopId) {
                setShopIdBoth(Number(option.shopId));
                setFormType(true);
            }

            if (option.sn) {
                void __getProductDetail({ sn: option.sn });
            } else if (option.id) {
                void __getProductDetail(Number(option.id));
            }
            if (option.skuId) {
                setSkuId(Number(option.skuId));
            }
            if (option.salesmanId) {
                saveSalesmanProducts(option.salesmanId, option.id);
            }
        }
    };

    // 对应旧 onLoad
    useEffect(() => {
        void (async () => {
            const option: any = router.params;
            Taro.eventCenter.on("refreshStoreInfo", (id: number) => {
                if (id > -1) {
                    setShopIdBoth(id);

                    setTimeout(() => {
                        if (option?.sn) {
                            void __getProductDetail({ sn: option.sn });
                        } else if (option?.id) {
                            void __getProductDetail(Number(option.id));
                        }
                        specificationRef.current?.refresh();
                    }, 0);
                }
            });

            await init(option);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 对应旧 onShow
    useDidShow(() => {
        void _getCartCount();
    });

    const [showAnimation, setShowAnimation] = useState(false);

    /**
     * @description 触发加入购物车动画
     * @param val 是否显示动画
     */
    const getShowAnimation = async (val: boolean) => {
        await queryRect(".cart-position");
        await getAnimationPosition(".cart");

        setShowAnimation(val);
        void _getCartCount();
    };

    /**
     * @description 获取动画起始位置
     * @param selector 元素选择器
     */
    const getAnimationPosition = async (selector: any) => {
        const data = await getElementRect(selector);
        if (data) {
            const { width, height, top, left } = data;
            setAnimationPosition((prev) => ({ ...prev, top: top - height / 2, left: left + width / 2 }));
        }
    };

    const [cartRect, setCartRect] = useState({
        left: 0,
        top: 0
    });

    const queryRect = async (selector: any) => {
        const data = await getElementRect(selector);
        if (data) {
            const { width, height, top, left } = data;
            setCartRect((prev) => ({ ...prev, top: top - height / 2, left: left + width / 2 }));
        }
    };

    const styleVariable = useMemo(() => {
        return {
            "--x": cartRect.left - animationPosition.left + "px",
            "--y": "8px"
        };
    }, [cartRect.left, animationPosition.left]);

    useShareAppMessage(() => {
        return {
            title: product.productName as string,
            imageUrl: imageFormat(product.picUrl || "")
        };
    });

    useShareTimeline(() => {
        return {
            title: product.productName as string,
            imageUrl: imageFormat(product.picUrl || "")
        };
    });

    const [shopInfo, setShopInfo] = useState<ShopDetailItem>({} as ShopDetailItem);

    /**
     * @description 获取店铺信息
     * 用于显示客服入口和店铺相关信息
     * @param id 店铺ID
     */
    const getShopInfo = async (id: number) => {
        try {
            const result = await getShopDetail(id);
            setShopInfo(result);
        } catch (error: any) {
            console.error(error);
        }
    };

    /**
     * @description 判断是否显示客服入口
     * 店铺配置了客服入口显示在商品详情页时显示
     */
    const showService = useMemo(() => {
        if (Object.keys(shopInfo).length > 0 && shopInfo.shopId !== 0) {
            if (shopInfo.kefuInlet && shopInfo.kefuInlet.length > 0 && shopInfo.kefuInlet.includes(1)) {
                return true;
            }
            return false;
        } else {
            return userServiceConfigShow;
        }
    }, [shopInfo, userServiceConfigShow]);

    const [grouponRecordInfo, setGrouponRecordInfo] = useState<{
        grouponPromotionRecordId: number;
        minGroupNum: number;
    }>({
        grouponPromotionRecordId: 0,
        minGroupNum: 0
    });

    const getGrouponRecordsParamsRef = useRef<GrouponRecordListParams & { excludeEnded: boolean }>({
        page: 1,
        size: 10,
        // isMine: false,
        joinStatus: 1,
        dateType: 0, // Fix: add missing required property
        productId: 0,
        excludeEnded: true
    });
    const [groupList, setGroupList] = useState<GrouponRecordItem[]>([]);

    /**
     * @description 首页展示的拼团数据（最多2条）
     */
    const [twoGroupList, setTwoGroupList] = useState<GrouponRecordItem[]>([]);
    const [totalGroupCount, setTotalGroupCount] = useState(0);

    /**
     * @description 获取当前商品的拼团记录列表
     * 用于显示可参与的拼团
     */
    const getGrouponRecords = async () => {
        try {
            const res = await getGrouponRecordList(getGrouponRecordsParamsRef.current);
            if (res.records) {
                setGroupList(res.records);
                setTotalGroupCount(res.total);
                if (res.records && res.records.length) {
                    if (res.records.length > 1) {
                        setTwoGroupList(res.records.slice(0, 2));
                    } else {
                        setTwoGroupList(res.records);
                    }
                }
            }
        } catch (error) {
            console.log(error);
        }
    };

    /**
     * @description 加入现有拼团
     * @param item 要加入的拼团记录
     */
    const hanldeJoinGroup = (item: GrouponRecordItem) => {
        setShowMoreGroupon(false);
        setTimeout(() => {
            setGrouponRecordInfo({
                grouponPromotionRecordId: item.grouponPromotionRecordId,
                minGroupNum: item.minGroupNum
            });
            setGrouponEnable(true);
            specificationRef.current?.handleShowPopup();
        }, 0);
    };

    // 收藏态（对应旧 titleInfoRef?.isCollect，React ref 无响应性 → 状态回调）
    const [isCollectState, setIsCollectState] = useState(false);

    return (
        <View>
            <TigLayout ref={layoutRef} immediateLog={false} productId={productId} shopId={product.shopId}>
                {!failLoad ? (
                    <View style={{ display: !loadEndStatus ? undefined : "none" }}>
                        <ProductNav
                            modelValue={scrollTop}
                            activeModule={activeModule}
                            onUpdateActiveModule={setActiveModule}
                            event={handleScrollTo}
                            isCollect={isCollectState}
                            onShare={() => titleInfoRef.current?.handleShare()}
                            onCollect={() => titleInfoRef.current?.addCollect()}
                        />
                        <View className="product-area-wrapper">
                            <View className="product-area">
                                <ProductImg
                                    isSubCard={isSubCard}
                                    videoList={videoList}
                                    picList={picList}
                                    productInfo={product}
                                    seckillValue={seckillValue}
                                    grouponValue={grouponValue}
                                    productStock={productStock}
                                    detailLoaded={detailLoaded}
                                />
                            </View>
                        </View>
                        <View
                            className="productDetail-content"
                            style={{
                                paddingBottom: `${detailLoaded && (product.productStatus === 0 || productStock === 0) ? 160 : 100}rpx`
                            }}
                        >
                            <ProductTitleInfo
                                ref={titleInfoRef}
                                isCycleBuy={isCycleBuy}
                                showCoupon={showCoupon}
                                isSeckill={isSeckill}
                                isGroupon={isGroupon}
                                isPresale={isPresale ? 1 : 0}
                                promotionList={promotionList}
                                productInfo={product}
                                productPrice={productPrice}
                                isDiscount={isDiscount}
                                isSubCard={isSubCard}
                                type={type}
                                exchangeIntegral={exchangeIntegral}
                                productOriginPrice={productOriginPrice as any}
                                grouponValue={grouponValue}
                                productStock={productStock}
                                activityBgImage={activityBgImage}
                                seckillValue={seckillValue}
                                discountValue={discountValue}
                                presaleInfo={productPresale || undefined}
                                presalePaymentTimeText={paymentTimeText}
                                presaleDeliveryTimeText={deliverTimeText}
                                soldCount={product.virtualSales || 0}
                                onUpdateShowCoupon={(val) => setShowCoupon(val)}
                                onCollectChange={setIsCollectState}
                            />

                            {isGroupon && totalGroupCount ? (
                                <View className="group-card-row">
                                    <View className="flex justify-between align-center">
                                        <View className="group-num">
                                            {grouponValue.joinNumCount}
                                            {t("人在拼单，可直接参与")}
                                        </View>
                                        <View className="flex align-center group-desc" onClick={handleShowMore}>
                                            {t("查看更多")}
                                            <View className="iconfont-h5 icon-gengduo1 more" />
                                        </View>
                                    </View>
                                    <View className="group">
                                        <ProductGroupon groups={twoGroupList} padding="" onJoinClick={hanldeJoinGroup} />
                                    </View>
                                    <View className="instructions">
                                        <Text className="">{t("拼团说明")}</Text>
                                        <View className="process">
                                            <View className="process-item">
                                                <Image className="process-image" src={staticResource("groupon/groupon_open.png")} />
                                                <Text>{t("1.开团/参加")}</Text>
                                            </View>
                                            <View className="process-item">
                                                <Image className="process-image" src={staticResource("groupon/groupon_invite.png")} />
                                                <Text>{t("2.邀友参团")}</Text>
                                            </View>
                                            <View className="process-item">
                                                <Image className="process-image" src={staticResource("groupon/groupon_success.png")} />
                                                <Text>{t("3.人满成团")}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            ) : null}

                            <View className="product-card-row">
                                <View className="cart-item flex align-center justify-between" onClick={showSpecification}>
                                    <View className="flex align-center">
                                        <View className="title"> {t("规格")} </View>
                                        <View className="label">
                                            {isB2B() && (attrList.spe?.length ?? 0) > 0 ? (
                                                <>
                                                    {attrList.spe?.map((item: any, index: number) => (
                                                        <Text key={String(item.attrName) + "-" + index}>
                                                            {String(item.attrList.length) + t("种") + t(String(item.attrName))}
                                                        </Text>
                                                    ))}
                                                </>
                                            ) : (
                                                <>
                                                    {" "}
                                                    {skuStr} {productNumber} {t("件")}
                                                </>
                                            )}
                                        </View>
                                    </View>
                                    <View>
                                        <Image className="icon-image" src={staticResource("common/more.png")} />
                                    </View>
                                </View>

                                {isPresale && productPresale ? (
                                    <>
                                        {productPresale.saleMode === 2 ? (
                                            <View className="cart-item flex align-center justify-between">
                                                <View className="flex align-center">
                                                    <View className="title"> {t("尾款")} </View>
                                                    <View className="label"> {paymentTimeText} </View>
                                                </View>
                                            </View>
                                        ) : null}
                                        <View className="cart-item flex align-center justify-between">
                                            <View className="flex align-center">
                                                <View className="title"> {t("发货")} </View>
                                                <View className="label"> {deliverTimeText} </View>
                                            </View>
                                        </View>
                                    </>
                                ) : null}

                                {configStore.showSelledCount ||
                                (attrList.normal?.length ?? 0) > 0 ||
                                product.fixedShippingType === 1 ||
                                serviceList.length > 0 ? (
                                    <View className="card-row-flex">
                                        {configStore.showSelledCount ? (
                                            <View className="cart-item flex align-center justify-between">
                                                <View className="flex align-center">
                                                    <View className="title"> {t("销量")} </View>
                                                    <View className="label">
                                                        {" "}
                                                        {product.virtualSales} {t("件")}{" "}
                                                    </View>
                                                </View>
                                            </View>
                                        ) : null}

                                        {(attrList.normal?.length ?? 0) > 0 ? (
                                            <View className="cart-item flex align-center justify-between" onClick={showDrawer}>
                                                <View className="flex align-center">
                                                    <View className="title"> {t("参数")} </View>
                                                    <View className="label attr_text line1">
                                                        <View className="shuxin">{t(shuxinText)}</View>
                                                    </View>
                                                </View>
                                                <View>
                                                    <Image className="icon-image" src={staticResource("common/more.png")} />
                                                </View>
                                            </View>
                                        ) : null}

                                        {product.fixedShippingType === 1 &&
                                        Number(product.fixedShippingFee) == 0 &&
                                        ![2, 3, 4, 5, 6, 8].includes(product.productType as number) ? (
                                            <View className="cart-item flex align-center justify-between">
                                                <View className="flex align-center">
                                                    <View className="title"> {t("运费")} </View>
                                                    <View className="label attr_text line1">
                                                        <View className="shuxin">
                                                            {/* 电子礼品卡、虚拟、付费、卡密商品详情页中运费为无需配送 */}
                                                            {[2, 3, 4, 8].includes(product.productType as number)
                                                                ? t("无需配送")
                                                                : t("包邮")}
                                                        </View>
                                                    </View>
                                                </View>
                                                <View>
                                                    <Image className="icon-image" src={staticResource("common/more.png")} />
                                                </View>
                                            </View>
                                        ) : null}
                                        {product.productType === 7 || product.productType === 8 ? (
                                            <View className="cart-item flex align-center justify-between">
                                                <View className="flex align-center">
                                                    <View className="title"> {t("说明")} </View>
                                                    <View className="label attr_text line1">
                                                        <View className="shuxin">{t("此商品不支持售后，如需售后请联系客服")}</View>
                                                    </View>
                                                </View>
                                            </View>
                                        ) : null}
                                        {serviceList.length > 0 ? (
                                            <View className="cart-item">
                                                <View className="flex">
                                                    <View className="title"> {t("服务")} </View>
                                                    <View className="label flex-wrap align-center servicelist">
                                                        {serviceList.map((item: any, index: number) => (
                                                            <Text key={index} className="flex align-center service-item">
                                                                {item.icoImg ? (
                                                                    <TigImage
                                                                        className="service-icon"
                                                                        src={item.icoImg}
                                                                    />
                                                                ) : null}
                                                                {item.productServiceName}
                                                            </Text>
                                                        ))}
                                                    </View>
                                                </View>
                                            </View>
                                        ) : null}
                                    </View>
                                ) : null}
                            </View>

                            {shopId > -1 && type !== "exchange" && ![2, 4].includes(configStore.storeEntryRule) ? (
                                <ProductShopInfo
                                    storeInfo={storeInfo}
                                    shopId={shopId}
                                    productId={product.productId}
                                    formType={formType}
                                />
                            ) : null}

                            <View className="evaluate-area">
                                <ProductComment productId={product.productId} shopId={shopId} />
                            </View>

                            <ProductContent
                                isBuy={product.isBuy}
                                paidContent={product.paidContent}
                                productType={product.productType}
                                descArr={descArr}
                                productId={product.productId}
                            />
                        </View>

                        <View
                            className="bottom-bar-box"
                            style={{ paddingBottom: `${configStore.safeAreaInsets.bottom}rpx` }}
                        >
                            <View className="bottom-bar flex align-center">
                                <View className="icon-box">
                                    <View className="label" onClick={handleToHome}>
                                        <View>
                                            <Image mode="widthFix" src={staticResource("product/home.png")} className="img" />
                                        </View>
                                        <View className="label-text">
                                            <Text>{t("首页")}</Text>
                                        </View>
                                    </View>

                                    {showService ? (
                                        <View className="label">
                                            <Service phone={shopInfo.kefuPhone} productId={productId} shopId={shopInfo.shopId}>
                                                <View>
                                                    <Image mode="widthFix" src={staticResource("product/service.png")} className="img" />
                                                </View>
                                                <View className="label-text">
                                                    <Text>{t("客服")}</Text>
                                                </View>
                                            </Service>
                                        </View>
                                    ) : null}

                                    {!isCycleBuy && !isPresale ? (
                                        <View
                                            className="label cart-position"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toPage(userToken ? "/pages/cartJump/index" : "/pages/cart/index");
                                            }}
                                        >
                                            <View className="cart-badge-wrap">
                                                <Image mode="widthFix" src={staticResource("product/cart.png")} className="img" />
                                                {/* 旧 uni-badge absolute="rightTop" → 自绘角标 */}
                                                {cartCount > 0 ? <View className="cart-badge">{cartCount}</View> : null}
                                            </View>
                                            <View className="label-text">
                                                <Text>{t("购物车")}</Text>
                                            </View>
                                        </View>
                                    ) : null}
                                </View>
                                <View className="btn-box">
                                    {product.productType === 4 && product.isBuy === 1 ? (
                                        <TigButton2 disabled className="isBuyBtn">
                                            {t("商品已购买")}{" "}
                                        </TigButton2>
                                    ) : (product.productStatus === 0 || productStock === 0) &&
                                      !isSubCardReservationProduct ? (
                                        <View className="other-products-btn" onClick={handleToProductList}>
                                            {t("查看其他商品")}
                                        </View>
                                    ) : (
                                        <>
                                            {type === "exchange" ? (
                                                <View className="other-products-btn" onClick={showSpecification}>
                                                    {t("立即兑换")}
                                                </View>
                                            ) : (
                                                <>
                                                    {isPresale && productPresale ? (
                                                        <View className="other-products-btn" onClick={showSpecification}>
                                                            {productPresale.saleMode === 2 ? (
                                                                <>
                                                                    <FormatPrice
                                                                        fontStyle={{ fontWeight: "bold" }}
                                                                        decimalsStyle={{ fontSize: "24rpx", fontWeight: "bold" }}
                                                                        currencyStyle={{ fontSize: "24rpx", fontWeight: "bold" }}
                                                                        priceData={productPresale.depositAmount}
                                                                    />
                                                                    {t("立即预定")}
                                                                </>
                                                            ) : (
                                                                <>{t("立即预购")}</>
                                                            )}
                                                        </View>
                                                    ) : (
                                                        <>
                                                            {product.productType === 1 || isGroupon ? (
                                                                <>
                                                                    {isGroupon ? (
                                                                        <>
                                                                            <View className="btn cart" onClick={showSpecification}>
                                                                                {t("单独购买")}{" "}
                                                                            </View>
                                                                            {isGroupon ? (
                                                                                <View className="btn buy" onClick={showGrouponPoup}>
                                                                                    {t("我要开团")}
                                                                                </View>
                                                                            ) : null}
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            {isCycleBuy || isSubCard ? (
                                                                                <View
                                                                                    className="other-products-btn"
                                                                                    onClick={showSpecification}
                                                                                >
                                                                                    {t("立即购买")}
                                                                                </View>
                                                                            ) : (
                                                                                <>
                                                                                    <View className="btn cart" onClick={showSpecification}>
                                                                                        {t("加入购物车")}
                                                                                    </View>
                                                                                    <View className="btn buy" onClick={showSpecification}>
                                                                                        {t("立即购买")}{" "}
                                                                                    </View>
                                                                                </>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <View className="other-products-btn" onClick={showSpecification}>
                                                                    {[5, 6].includes(product.productType as number) &&
                                                                    !isSubCardReservationProduct
                                                                        ? t("立即预约")
                                                                        : t("立即购买")}
                                                                </View>
                                                            )}
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    )}
                                </View>
                                {detailLoaded &&
                                (product.productStatus === 0 || productStock === 0) &&
                                !isSubCardReservationProduct ? (
                                    <View className="product-status">
                                        {t(product.productStatus === 0 ? "商品已下架" : "商品已售罄")}
                                    </View>
                                ) : null}
                            </View>
                        </View>

                        <Specification
                            ref={specificationRef}
                            productId={specificationId}
                            skuId={skuId}
                            onSkuIdChange={setSkuId}
                            isCycleBuy={isCycleBuy}
                            isSubCard={isSubCard}
                            shopId={shopId}
                            type={type}
                            grouponEnable={grouponEnable}
                            grouponRecordInfo={grouponRecordInfo}
                            onLoadEnd={getLoadStatus}
                            onAddCardSucceed={getShowAnimation}
                            onSendValue={getValue}
                            onClose={() => setGrouponEnable(true)}
                        />

                        <ProductCoupon
                            modelValue={showCoupon}
                            onUpdateModelValue={setShowCoupon}
                            productId={Number(productId)}
                            promotionList={promotionList}
                            shopId={shopId}
                        />
                        <Popup visible={showAttrRef} onClose={() => setShowAttrRef(false)}>
                            <ScrollView scrollY className="attr_table-box">
                                <View className="popup-title title">{t("规格参数")}</View>
                                <View className="attr_table">
                                    {(attrList.normal || []).map((item: any, index: number) => (
                                        <View key={index} className="item flex">
                                            <View className="lable">{t(item.attrName)}</View>
                                            {(item.attrList || []).map((attr: any, attrIndex: number) => (
                                                <View key={attrIndex} className="value">
                                                    {" "}
                                                    {attr.attrValue}{" "}
                                                </View>
                                            ))}
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        </Popup>
                        {/*更多拼团列表*/}
                        <ProductGrouponMore
                            modelValue={showMoreGroupon}
                            onUpdateModelValue={setShowMoreGroupon}
                            productId={product.productId}
                            groupList={groupList}
                            total={totalGroupCount}
                            onJoinClick={hanldeJoinGroup}
                        />
                        <TigBackTop scrollTop={scrollTop} />
                        <Animation
                            modelValue={showAnimation}
                            onUpdateModelValue={setShowAnimation}
                            styleVariable={styleVariable as any}
                            animationPosition={animationPosition}
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