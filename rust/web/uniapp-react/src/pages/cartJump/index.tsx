import { useReducer, useRef, useState } from "react";
import { View, Text, Image } from "@tarojs/components";
import Taro, { useDidShow, useDidHide, useUnload } from "@tarojs/taro";
import { Swipe } from "@nutui/nutui-react-taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import FormatPrice from "@/components/format-price/FormatPrice";
import ActivityCard from "@/components/masonry/ActivityCard";
import { getCart, updateCartItemData, updateCartCheck, removeCartItemData } from "@/api/cart/cart";
import { updateCollectProduct } from "@/api/product/product";
import { getDeliveryOptions } from "@/api/store/store";
import { useConfigStore } from "@/store/config";
import { useCartStore } from "@/store/cart";
import { useTabbarDerived } from "@/store/tabbar";
import { useProductStyle } from "@/hooks";
import { productImage } from "@/utils/format";
import { redirect, getSkuValueList, getSkuValueText, toStoreOrShopHome } from "@/utils";
import { isProductUnavailable } from "@/utils/productSale";
import { t } from "@/utils/i18n";
import type { updateCartCheckitem } from "@/types/cart/cart";

import { createKeyedLatestTaskScheduler, createLatestRequestGuard } from "../cart/src/cartAsync";
import Checkbox from "../cart/src/Checkbox";
import NumberStepper from "../cart/src/NumberStepper";
import CartHeard from "../cart/src/CartHeard";
import CartEmpty from "../cart/src/CartEmpty";
import ToLogin from "../cart/src/ToLogin";
import Detail from "../cart/src/Detail";
import DiscountInfo from "@/components/product/DiscountInfo/DiscountInfo";
import DeliveryProductPop from "../cart/src/DeliveryProductPop";
import Recommend from "../cart/src/Recommend";

import "./index.scss";
import { usePageGuards } from "@/utils/pageMixin";

/**
 * 购物车跳转页（非 tab，带返回键；自旧 pages/cartJump/index.vue 移植）
 * - 商详登录态点购物车入口；样式与 pages/cart 对齐
 * - 按店铺分组展示购物车商品
 * - 支持单选/全选商品、修改数量、删除商品
 * - 显示商品优惠信息和价格计算
 * - 提供结算入口和推荐商品展示
 *
 * 状态策略：与 pages/cart 移植版一致（可变 ref + 手动 rerender），逐行保留原状态机。
 */
export default function CartJump() {
    usePageGuards();
    const cartStoreSetCartCount = useCartStore((s) => s.setCartCount);
    const configStoreIsGuestLikeGoods = useConfigStore((s) => s.isGuestLikeGoods);
    const configStoreCloseOrder = useConfigStore((s) => s.closeOrder);
    const { currentActiveValue: tabbarCurrentActiveValue } = useTabbarDerived();

    // ===================== 旧 onShow/onHide/onUnload 生命周期 =====================
    const isCartPageActiveRef = useRef(true);
    const hasCartMutationFailureRef = useRef(false);

    useDidShow(() => {
        isCartPageActiveRef.current = true;
        // 对应旧 uni.hideTabBar()：cartJump 为 navigateTo 非 tab 页，React 版 TigLayout
        // 仅在 tab 页渲染 TigTabbar，本页无原生/自绘 tabbar，无需隐藏。
        getCartList();
    });

    useDidHide(() => {
        isCartPageActiveRef.current = false;
        invalidateCartListRequest();
    });

    useUnload(() => {
        isCartPageActiveRef.current = false;
        invalidateCartListRequest();
        void cartMutationScheduler.close({ flush: true });
    });

    const [, rerender] = useReducer((c: number) => c + 1, 0);

    const cartListRef = useRef<any[]>([]);
    // 旧 cartList ref 的读取封装（模板与逻辑直接读 ref，渲染由 rerender 驱动）
    const cartList = cartListRef.current;

    const totalRef = useRef<any>({
        checkedCount: 0,
        discountAfter: 0,
        discountCouponAmount: 0,
        discountProductPromotionAmount: 0,
        discountSeckillAmount: 0,
        discountTimeDiscountAmount: 0,
        discounts: 0,
        productAmount: 0,
        totalCount: 0
    });
    const total = totalRef.current;

    const [cartManage, setCartManage] = useState(false);
    const allCheckedRef = useRef(false);
    const allChecked = allCheckedRef.current;

    const [isLoad, setIsLoad] = useState(true);
    const [showLogin, setShowLogin] = useState(!Taro.getStorageSync("token"));

    // ===================== 左滑操作（uni-swipe-action → NutUI Swipe） =====================
    /** 各行 Swipe 实例引用：点击操作后手动收起（对应旧 uni-swipe-action-item auto-close） */
    const swipeRefsRef = useRef<Map<number, { close: () => void }>>(new Map());

    /** 旧 template #right 的 cart-move-box 结构（移入收藏 + 删除） */
    const renderSwipeActions = (goods: any) => (
        <View className="cart-move-box">
            <View
                className="btn-collect"
                onClick={() => {
                    swipeRefsRef.current.get(goods.cartId)?.close();
                    handleCollect(goods.productId, goods.cartId);
                }}
            >
                <Text>{t("移入收藏")}</Text>
            </View>
            <View
                className="btn-del"
                onClick={() => {
                    swipeRefsRef.current.get(goods.cartId)?.close();
                    handleDel(goods.cartId);
                }}
            >
                <Text>{t("删除")}</Text>
            </View>
        </View>
    );

    /**
     * 是否按零售计步器渲染该行
     * - 批发判定包在 wholesale 切割块内，关闭批发时退化为恒 true（所有行走零售控件），行为零变化
     */
    const isRetailLine = (_goods: any): boolean => {
        return true;
    };

    // 空态占满一屏仅在无猜你喜欢时生效，否则需要页面可滚动以展示下方推荐
    const isEmptyWithoutRecommend = cartList.length === 0 && !Number(configStoreIsGuestLikeGoods);
    const flatCartProducts = cartList.flatMap((shop: any) => shop?.carts ?? []);
    const { styleMap: cartProductStyleMap } = useProductStyle(flatCartProducts);

    const isCartLineInvalid = (product: any) => product.sku?.isEnabled === 0 || isProductUnavailable(product);
    const isCartProductDisabled = (product: any) => product.isDisabled || isCartLineInvalid(product);

    type CartMutationTask = { type: "quantity"; cartId: number; quantity: number } | { type: "selection"; checkData: updateCartCheckitem[] };

    const CART_SELECTION_TASK_KEY = "selection";
    const getQuantityTaskKey = (cartId: number) => `quantity:${cartId}`;

    /**
     * @description 全选/取消全选购物车商品
     * 遍历所有店铺下的商品，将未禁用的商品选中状态与全选状态同步
     */
    const onCheckAll = () => {
        cartListRef.current.forEach((item: any) => {
            item.carts.forEach((product: any) => {
                if (!isCartProductDisabled(product)) {
                    product.isChecked = allCheckedRef.current;
                }
            });
        });
        updateCheckbox();
        updateCheckData();
    };

    /**
     * @description 点击全选文字触发全选切换
     */
    const onCheckAllText = () => {
        allCheckedRef.current = !allCheckedRef.current;
        onCheckAll();
    };

    /**
     * @description 店铺级别全选/取消全选
     * @param index 店铺在购物车列表中的索引
     */
    const onCheckAllItem = (index: number) => {
        const item = cartListRef.current[index];
        item.carts.forEach((product: any) => {
            if (!isCartProductDisabled(product)) {
                product.isChecked = item.isChecked;
            }
        });
        updateCheckbox();
        updateCheckData();
    };

    /**
     * @description 单个商品选中状态变更处理
     */
    const onChangeCheck = () => {
        updateCheckbox();
        updateCheckData();
    };

    /**
     * @description 更新复选框联动状态
     * 根据商品选中情况更新店铺全选状态和总全选状态
     */
    const updateCheckbox = () => {
        cartListRef.current.forEach((item: any) => {
            const validItem = item.carts.filter((product: any) => !isCartProductDisabled(product));
            item.isChecked = validItem.every((product: any) => product.isChecked === true);
        });
        allCheckedRef.current = cartListRef.current.every((item: any) => item.isChecked === true);
        rerender();
    };

    /**
     * @description 同步选中状态到服务器
     * 管理模式下不同步，避免影响正常结算流程
     */
    const updateCheckData = async (waitForSync = false) => {
        if (cartManage) return true;

        invalidateCartListRequest();
        const checkData: updateCartCheckitem[] = [];
        cartListRef.current.forEach((item: any) => {
            item.carts.forEach((product: any) => {
                checkData.push({
                    cartId: product.cartId,
                    isChecked: product.isChecked && !isProductUnavailable(product) ? 1 : 0
                });
            });
        });
        cartMutationScheduler.schedule(CART_SELECTION_TASK_KEY, { type: "selection", checkData }, 0);

        return waitForSync ? cartMutationScheduler.flush() : true;
    };

    /**
     * @description 登录成功回调，刷新购物车数据
     */
    const loginSuccess = () => {
        getCartList();
    };
    const cartListRequestGuard = createLatestRequestGuard();

    const invalidateCartListRequest = () => {
        cartListRequestGuard.invalidate();
        Taro.hideLoading();
    };

    /**
     * @description 获取购物车列表数据
     * 包含商品信息、店铺分组、优惠计算等
     * 未登录时显示登录引导页
     */
    const getCartList = async () => {
        if (!isCartPageActiveRef.current) return undefined;

        const requestId = cartListRequestGuard.begin();
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            const result = await getCart();
            if (!isCartPageActiveRef.current || !cartListRequestGuard.isLatest(requestId)) return undefined;

            // console.log(result);
            totalRef.current = result.total;
            cartListRef.current = result.cartList;
            hasCartMutationFailureRef.current = false;
            setShowLogin(false);
            updateCheckbox();
            cartStoreSetCartCount(Number(result.total?.totalCount ?? 0));
            return true;
        } catch (error: any) {
            if (!isCartPageActiveRef.current || !cartListRequestGuard.isLatest(requestId)) return undefined;

            console.error(error);
            if (error.code === 401) {
                setShowLogin(true);
                cartStoreSetCartCount(0);
            }
            return false;
        } finally {
            if (isCartPageActiveRef.current && cartListRequestGuard.isLatest(requestId)) {
                setIsLoad(false);
                Taro.hideLoading();
            }
        }
    };

    /**
     * @description 实际执行购物车商品数量更新
     * @param cartId 购物车项ID
     * @param quantity 目标数量
     */
    const executeCartMutation = async (_key: string, task: CartMutationTask) => {
        if (task.type === "quantity") {
            await updateCartItemData({ cartId: task.cartId, data: { quantity: task.quantity } });
            return;
        }

        await updateCartCheck({ data: task.checkData });
    };

    const handleCartMutationError = (error: unknown, _key: string, task: CartMutationTask) => {
        console.error(error);
        hasCartMutationFailureRef.current = true;
        if (!isCartPageActiveRef.current || task.type !== "quantity") return;

        // 批发价失效或身份过期时刷新对应运行态，再拉取购物车恢复最新价格。

        const message = error instanceof Error ? error.message : t("购物车数量更新失败");
        Taro.showToast({
            title: message,
            icon: "none",
            duration: 800
        });
    };

    const cartMutationScheduler = createKeyedLatestTaskScheduler(executeCartMutation, 300, {
        onError: handleCartMutationError,
        onIdle: async () => {
            if (!isCartPageActiveRef.current) return;
            const loaded = await getCartList();
            if (loaded === false) {
                hasCartMutationFailureRef.current = true;
                throw new Error("购物车列表刷新失败");
            }
        }
    });

    /**
     * @description 更新购物车商品数量（同一商品合并最新值，不同商品独立提交）
     * @param cartId 购物车项ID
     * @param quantity 目标数量
     */
    const updateCartItem = (cartId: number, quantity: number) => {
        invalidateCartListRequest();
        cartMutationScheduler.schedule(getQuantityTaskKey(cartId), { type: "quantity", cartId, quantity });
    };

    /**
     * @description 切换购物车管理模式
     * 管理模式下可批量删除商品，非管理模式下可正常结算
     */
    const cartManageFun = () => {
        setCartManage(!cartManage);
    };

    /**
     * @description 清空购物车确认弹窗
     * （随「清空购物车」入口一并注释保留，对应旧 checkClearCart）
     */
    // const checkClearCart = () => {
    //     Taro.showModal({
    //         title: t("提示"),
    //         content: t("确认要清空购物车吗？"),
    //         success: async (res) => {
    //             if (res.confirm) {
    //                 await clearCart();
    //                 getCartList();
    //             }
    //         }
    //     });
    // };

    /**
     * @description 计算当前选中的购物车项ID列表
     * @returns 选中的cartId数组
     */
    const getCartIds = () => {
        const cartiDs: number[] = [];
        cartListRef.current.forEach((item: any) => {
            item.carts.forEach((product: any) => {
                if (product.isChecked) cartiDs.push(product.cartId);
            });
        });
        return cartiDs || [];
    };

    /**
     * @description 判断商品是否为预售
     * 兼容后端可能的字段：saleMode/productSaleMode/presaleInfo
     */
    const isPresaleGoods = (goods: any) => {
        const saleMode = Number(goods?.saleMode ?? goods?.productSaleMode ?? 0);
        if (saleMode > 0) return true;
        // 部分接口可能直接带 presaleInfo
        if (goods?.presaleInfo) return true;
        return false;
    };

    /**
     * @description 获取当前勾选的商品列表（扁平化）
     */
    const getSelectedGoods = () => {
        const selected: any[] = [];
        cartListRef.current.forEach((shopGroup: any) => {
            shopGroup.carts.forEach((goods: any) => {
                if (goods.isChecked) {
                    selected.push(goods);
                }
            });
        });
        return selected;
    };

    /**
     * @description 批量删除选中的购物车商品
     */
    const delCartItem = () => {
        const cartIds = getCartIds();
        if (cartIds.length == 0) {
            Taro.showToast({ title: t("请选择要删除的商品"), icon: "none" });
            return;
        }
        Taro.showModal({
            title: t("提示"),
            content: t("确认要删除指定的商品吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: async (res) => {
                if (res.confirm) {
                    try {
                        invalidateCartListRequest();
                        const selectedCartIds = [...cartIds];
                        await Promise.all(selectedCartIds.map((cartId) => cartMutationScheduler.cancel(getQuantityTaskKey(cartId))));
                        const cartUpdated = await cartMutationScheduler.flush();
                        if (!cartUpdated || hasCartMutationFailureRef.current) return;
                        await removeCartItemData({ cartIds: selectedCartIds });

                        getCartList();
                    } catch (error) {
                        console.error(error);
                    }
                }
            }
        });
    };

    /**
     * @description 去结算入口
     * O2O场景下需先获取配送方式选项（商城配送/到店自提/同城配送）
     */
    const checkoutInProgressRef = useRef(false);
    const handleCheckout = async () => {
        if (checkoutInProgressRef.current) return;

        checkoutInProgressRef.current = true;
        try {
            await executeCheckout();
        } finally {
            checkoutInProgressRef.current = false;
        }
    };

    const executeCheckout = async () => {
        if (configStoreCloseOrder === 1) {
            Taro.showToast({ title: t("商城已关闭下单"), icon: "none" });
            return;
        }

        const cartUpdated = await cartMutationScheduler.flush();
        if (!cartUpdated || hasCartMutationFailureRef.current || !isCartPageActiveRef.current) return;
        if (!(await refreshSaleBeforeCheckout())) return;
        if (totalRef.current.checkedCount == 0) return;

        // 预售不混单：预售商品必须单独结算（且通常单门店）
        const selectedGoods = getSelectedGoods();
        const presaleGoods = selectedGoods.filter((g) => isPresaleGoods(g));
        if (presaleGoods.length > 0) {
            // 只保留第一个预售商品，其它一律取消勾选
            const keep = presaleGoods[0];
            cartListRef.current.forEach((shopGroup: any) => {
                shopGroup.carts.forEach((goods: any) => {
                    goods.isChecked = goods.cartId === keep.cartId;
                });
            });
            updateCheckbox();
            const selectionUpdated = await updateCheckData(true);
            if (!selectionUpdated) return;
            Taro.showToast({
                title: t("预售商品需单独结算"),
                icon: "none",
                duration: 1500
            });
            return;
        }
        redirect({
            url: `/pages/order/check`
        });
    };

    /**
     * @description 移入收藏并删除购物车商品
     * @param productId 商品ID
     * @param cartId 购物车项ID
     */
    const handleCollect = async (productId: number, cartId: number) => {
        invalidateCartListRequest();
        await cartMutationScheduler.cancel(getQuantityTaskKey(cartId));
        const cartUpdated = await cartMutationScheduler.flush();
        if (!cartUpdated || hasCartMutationFailureRef.current) return;
        try {
            await updateCollectProduct({
                productId
            });
        } catch (error) {
            console.error(error);
        } finally {
            await removeCartItemData({ cartIds: [cartId] });
            getCartList();
        }
    };

    /**
     * @description 删除单个购物车商品
     * @param cartId 购物车项ID
     */
    const handleDel = (cartId: number) => {
        Taro.showModal({
            title: t("提示"),
            content: t("确认要删除该商品吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: async (res) => {
                if (res.confirm) {
                    try {
                        invalidateCartListRequest();
                        await cartMutationScheduler.cancel(getQuantityTaskKey(cartId));
                        const cartUpdated = await cartMutationScheduler.flush();
                        if (!cartUpdated || hasCartMutationFailureRef.current) return;
                        await removeCartItemData({ cartIds: [cartId] });

                        getCartList();
                    } catch (error) {
                        console.error(error);
                    }
                }
            }
        });
    };

    /**
     * @description 跳转到店铺/门店详情页
     * O2O 进入门店首页，普通版本进入店铺首页。
     */
    const handleToShop = (id: number) => {
        toStoreOrShopHome(id, { navType: "navigateTo" });
    };

    const getProductUrl = (goods: any, shopId?: number) => {
        let url = `/pages/product/index?id=${goods.productId}`;
        if (goods.skuId > 0) {
            url += `&sku_id=${goods.skuId}`;
        }
        if (shopId && shopId > 0) {
            url += `&shopId=${shopId}`;
        }
        return url;
    };

    const formatActivityList = (data: any, usedPromotions: any = []) => {
        const activityList: any[] = [];
        const list = Array.isArray(data) ? data : [];
        const usedList = Array.isArray(usedPromotions) ? usedPromotions : [];
        const couponList = list.filter((item: any) => item.type === 2);
        const promotionList = list.filter((item: any) => item.type !== 2);
        const usedCouponList = usedList.filter((item: any) => item.type === 2);
        if (promotionList.length > 0) activityList.push(promotionList[0]);
        // usedCouponList：使用的优惠券；从 couponList 中找到第一个“已使用”的优惠券展示
        if (couponList.length > 0) {
            const usedKeySet = new Set(usedCouponList.map((x: any) => x?.promotionId).filter((x: any) => x !== undefined && x !== null));
            const usedCoupon = couponList.find((c: any) => usedKeySet.has(c?.promotionId));
            activityList.push(usedCoupon || couponList[0]);
        }

        return activityList;
    };

    const [showDetail, setShowDetail] = useState(false);
    const currentDetailRef = useRef<any>({});
    const handleAttr = (item: any) => {
        setShowDetail(true);
        currentDetailRef.current = item;
    };

    const [showDiscountInfo, setShowDiscountInfo] = useState(false);
    const handleShowDiscountInfo = () => {
        if (totalRef.current.checkedCount <= 0) return;
        if (showDetail) setShowDetail(false);
        setShowDiscountInfo(!showDiscountInfo);
    };

    const [showDeliveryProductPop, setShowDeliveryProductPop] = useState(false);

    const [deliveryProducts, setDeliveryProducts] = useState<any[]>([]); // 支持商城配送的商品
    const [pickupProducts, setPickupProducts] = useState<any[]>([]); // 支持到店自提的商品
    const [pickupProductData, setPickupProductData] = useState<any[]>([]); // 自提商品扁平化数据
    const [localDeliveryProducts, setLocalDeliveryProducts] = useState<any[]>([]); // 支持同城配送的商品

    /**
     * @description 获取O2O配送方式选项
     * 根据商品支持的配送方式决定是否需要用户选择
     * deliveryType: 1-全部支持自提或配送 2-部分自提部分配送 3-全部配送 4-全部自提
     */
    const getDeliveryOptionsData = async () => {
        try {
            const result = await getDeliveryOptions();

            if (result.deliveryType === 2) {
                // 需要用户选择配送方式
                setDeliveryProducts(result.deliveryProducts);
                setPickupProducts(result.pickupProducts);
                setLocalDeliveryProducts(result.shopDeliveryProducts);
                setPickupProductData([]);
                result.pickupProducts.forEach((item: any) => {
                    setPickupProductData((prev) => [...prev, ...item.products]);
                });
                setShowDeliveryProductPop(true);
            } else {
                // 直接跳转结算页
                redirect({
                    url: `/pages/order/check`
                });
            }
        } catch (error) {
            console.error("Error fetching delivery options:", error);
        }
    };

    /**
     * @description 根据配送方式筛选购物车商品
     * 取消不支持当前配送方式的商品选中状态
     * @param type 配送方式：1-商城配送 2-到店自提 3-同城配送
     */
    const changeCart = async (type: number) => {
        const deliveryIds = deliveryProducts.map((item: any) => item.productId);
        const pickupIds = pickupProductData.map((item: any) => item.productId);
        const localIds = localDeliveryProducts.map((item: any) => item.productId);

        const typeMap: Record<number, { keep: number[]; cancel: number[] }> = {
            1: { keep: deliveryIds, cancel: [...pickupIds, ...localIds] },
            2: { keep: pickupIds, cancel: [...deliveryIds, ...localIds] },
            3: { keep: localIds, cancel: [...deliveryIds, ...pickupIds] }
        };

        const config = typeMap[type];
        if (!config) return;

        const keepSet = new Set(config.keep);
        const cancelIds = config.cancel.filter((id: number) => !keepSet.has(id));
        const cancelIdsSet = new Set(cancelIds);

        // 批量更新购物车商品的选中状态
        cartListRef.current.forEach((item: any) => {
            item.carts.forEach((product: any) => {
                if (cancelIdsSet.has(product.productId)) {
                    product.isChecked = false;
                }
            });
        });

        updateCheckbox();
        return updateCheckData(true);
    };

    /**
     * @description 用户选择配送方式后跳转结算页
     * @param type 配送方式：1-商城配送 2-到店自提 3-同城配送
     */
    const handleOrderCheckType = async (type: number) => {
        const cartUpdated = await changeCart(type);
        if (!cartUpdated) return;

        redirect({
            url: `/pages/order/check?deliveryType=${type}`
        });
    };

    /**
     * 底栏定位：自绘 tabbar 显示时贴在 tabbar 之上（安全区由 tabbar 负责），否则贴底并自行让出安全区。
     * 结算与编辑态共用底栏占位高度，避免切换时购物车列表重新布局。
     */
    const checkOutBarStyle = {
        bottom: tabbarCurrentActiveValue > -1 ? "var(--tabbar-height)" : "0",
        paddingBottom: tabbarCurrentActiveValue > -1 ? "0" : "var(--safe-bottom)"
    } as any;

    const saleCheckoutPendingRef = useRef(false);
    const refreshSaleBeforeCheckout = async () => {
        if (saleCheckoutPendingRef.current) return false;
        saleCheckoutPendingRef.current = true;
        const selectedIds = new Set(
            cartListRef.current
                .flatMap((group: any) => group.carts ?? [])
                .filter((line: any) => line.isChecked)
                .map((line: any) => line.cartId)
        );
        try {
            const fresh = await getCart();
            cartListRef.current = fresh.cartList;
            totalRef.current = fresh.total;
            updateCheckbox();
            const lines = fresh.cartList.flatMap((group: any) => group.carts ?? []);
            const blocked = lines.some((line: any) => selectedIds.has(line.cartId) && isProductUnavailable(line));
            if (blocked) {
                await updateCartCheck({ data: lines.map((line: any) => ({ cartId: line.cartId, isChecked: line.isChecked && !isProductUnavailable(line) ? 1 : 0 })) });
                Taro.showToast({ title: t("商品已下架"), icon: "none" });
                return false;
            }
            return lines.some((line: any) => line.isChecked && !isProductUnavailable(line));
        } catch (error: any) {
            Taro.showToast({ title: error.message, icon: "none" });
            return false;
        } finally {
            saleCheckoutPendingRef.current = false;
        }
    };

    /** 商品图/跳转的统一点击守卫：不可售商品不跳转（对应旧 navigator :url=""） */
    const handleToProduct = (goods: any, shopId?: number) => {
        if (isProductUnavailable(goods)) return;
        redirect({ url: getProductUrl(goods, shopId) });
    };

    return (
        <TigLayout onLoginSuccess={loginSuccess}>
            {!showLogin && (
                <>
                    {/* cartJump 是可 push 的非 tab 页，必须保留返回键；不用 mainHeader（原页也没有），
                        否则跨境皮肤下会丢掉返回入口。编辑入口统一走 cartHeard。 */}
                    <CartHeard showBack={true} showEditButton={cartList.length > 0} isEditMode={cartManage} onEdit={cartManageFun} />
                    {!isLoad && (
                        <View
                            className={`cart-box shoppingCart ${cartManage ? "cart-box--edit" : ""} ${cartList.length === 0 ? "cart-box--empty" : ""} ${
                                isEmptyWithoutRecommend ? "cart-box--empty-fill" : ""
                            }`}
                        >
                            {cartList.length > 0 && (
                                <>
                                    <View className="cart_list_wrap">
                                        {cartList.map((item: any, index: number) => (
                                            /* 旧 :key="item.cartId"（后端店铺分组沿用首个 cartId；分组缺 cartId 时回退 shopId/索引） */
                                            <View className="cart_table" key={item.cartId ?? item.shopId ?? index}>
                                                <View className="cart_store_title noborder">
                                                    {/* 旧 v-model:checked + @change：先翻转选中态，再走店铺级联动 */}
                                                    <Checkbox
                                                        checked={item.isChecked}
                                                        size={19}
                                                        iconSize={18}
                                                        onChange={() => {
                                                            item.isChecked = !item.isChecked;
                                                            rerender();
                                                            onCheckAllItem(Number(index));
                                                        }}
                                                    />
                                                    <View className="store_label" onClick={() => handleToShop(item.shopId)}>
                                                        {item.shopTitle ? item.shopTitle : t("自营")}
                                                    </View>
                                                </View>
                                                <View className="goods-list-cart">
                                                    {item.carts.map((goods: any) => (
                                                        /* 旧 :key="goods.productId" */
                                                        <View className="cart_item" key={goods.productId}>
                                                            {/* 旧 uni-swipe-action / uni-swipe-action-item(:threshold="0" auto-close) → NutUI Swipe
                                                                （threshold 0 与自动收起语义由点击后手动 close 等价实现） */}
                                                            <Swipe
                                                                rightAction={renderSwipeActions(goods)}
                                                                name={goods.cartId}
                                                                ref={(el: any) => {
                                                                    if (el) {
                                                                        swipeRefsRef.current.set(goods.cartId, el);
                                                                    } else {
                                                                        swipeRefsRef.current.delete(goods.cartId);
                                                                    }
                                                                }}
                                                            >
                                                                <View
                                                                    className={`cart_list_con ${goods.isDisabled && !isCartLineInvalid(goods) ? "cart_item_disabled" : ""}`}
                                                                >
                                                                    <View className={`check-item ${isCartLineInvalid(goods) ? "check-item-disabled" : ""}`}>
                                                                        <Checkbox
                                                                            checked={goods.isChecked}
                                                                            size={19}
                                                                            iconSize={18}
                                                                            disabled={cartManage ? false : isCartProductDisabled(goods)}
                                                                            onChange={() => {
                                                                                // 旧 v-model:checked + @change：先翻转选中态，再走联动同步
                                                                                goods.isChecked = !goods.isChecked;
                                                                                rerender();
                                                                                onChangeCheck();
                                                                            }}
                                                                        />
                                                                    </View>
                                                                    <View
                                                                        className={`photo ${isCartLineInvalid(goods) ? "photo-disabled" : ""} ${
                                                                            isProductUnavailable(goods) ? "product-link-disabled" : ""
                                                                        }`}
                                                                        onClick={() => handleToProduct(goods, item.shopId)}
                                                                    >
                                                                        <View className="photo-img">
                                                                            <Image src={productImage(goods)} />
                                                                            {cartProductStyleMap[goods.productId]?.borderImage && (
                                                                                <Image className="product-style-border" src={cartProductStyleMap[goods.productId].borderImage} mode="scaleToFill" />
                                                                            )}
                                                                            {goods.stock === 0 && <View className="cart-notice-row">{t("已售罄")}</View>}
                                                                            {isProductUnavailable(goods) && <View className="cart-notice-row">{t("已下架")}</View>}
                                                                        </View>
                                                                    </View>
                                                                    <View className={`cart-row ${isCartLineInvalid(goods) ? "cart-row-invalid" : ""}`}>
                                                                        <View
                                                                            className={isProductUnavailable(goods) ? "product-link-disabled" : ""}
                                                                            onClick={() => handleToProduct(goods, item.shopId)}
                                                                        >
                                                                            <View className={`name line2 ${isCartLineInvalid(goods) ? "product-name-disabled" : ""}`}>{goods.productName}</View>
                                                                        </View>
                                                                        {!!getSkuValueText(goods.skuData) && <View className="cart-sku-text">{getSkuValueText(goods.skuData)}</View>}

                                                                        {goods.activityInfo && !isCartLineInvalid(goods) && (
                                                                            <View className="activity-box">
                                                                                {formatActivityList(goods.activityInfo, item.usedPromotions).map((subItem: any) => (
                                                                                    <View key={subItem.promotionId}>
                                                                                        <ActivityCard activityInfo={subItem} cardType="sub" />
                                                                                    </View>
                                                                                ))}
                                                                            </View>
                                                                        )}

                                                                        {!isCartLineInvalid(goods) ? (
                                                                            <View
                                                                                className={`cart-price ${
                                                                                    (!goods.skuData || goods.skuData.length === 0) && !goods.activityInfo ? "cart-price-margin" : ""
                                                                                }`}
                                                                            >
                                                                                <View className="price-one">
                                                                                    <FormatPrice
                                                                                        showText={false}
                                                                                        fontStyle={{ fontWeight: "bold" }}
                                                                                        decimalsStyle={{
                                                                                            fontSize: "22rpx",
                                                                                            fontWeight: "bold"
                                                                                        }}
                                                                                        currencyStyle={{
                                                                                            fontSize: "23rpx",
                                                                                            fontWeight: "bold"
                                                                                        }}
                                                                                        priceData={goods.price}
                                                                                    />
                                                                                </View>
                                                                                <View className={`cart-num-box ${goods.isDisabled || goods.stock === 0 ? "cart-num-box-disabled" : ""}`}>
                                                                                    {isRetailLine(goods) && (
                                                                                        <NumberStepper
                                                                                            value={goods.quantity}
                                                                                            disabled={isCartProductDisabled(goods) || goods.stock === 0}
                                                                                            min={1}
                                                                                            max={goods.stock}
                                                                                            isDelete={true}
                                                                                            onChange={(e) => updateCartItem(goods.cartId, e?.value ?? goods.quantity)}
                                                                                            onDelete={() => handleDel(goods.cartId)}
                                                                                        />
                                                                                    )}
                                                                                </View>
                                                                            </View>
                                                                        ) : (
                                                                            isCartLineInvalid(goods) && (
                                                                                <View className="cart-invalid-text">
                                                                                    <Text className="invalid-message">
                                                                                        {goods.sku?.isEnabled === 0 ? t("请重新选择规格") : t("暂不支持购买")}
                                                                                    </Text>
                                                                                    <View
                                                                                        className="inline-delete"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleDel(goods.cartId);
                                                                                        }}
                                                                                    >
                                                                                        {t("删除")}
                                                                                    </View>
                                                                                </View>
                                                                            )
                                                                        )}
                                                                        {!isCartLineInvalid(goods) && goods.price && goods.originPrice !== goods.price && (
                                                                            <View className="origin-price">
                                                                                {t("每件预计到手")}
                                                                                <FormatPrice showText={false} isBottom={false} priceData={goods.price} />
                                                                            </View>
                                                                        )}
                                                                        {goods.extraSkuData && goods.extraSkuData.length && (
                                                                            <View
                                                                                className={`extraskudata ${isProductUnavailable(goods) ? "extra-sku-disabled" : ""}`}
                                                                                onClick={() => {
                                                                                    if (!isProductUnavailable(goods)) handleAttr(goods);
                                                                                }}
                                                                            >
                                                                                {goods.extraSkuData.length === 1 ? (
                                                                                    goods.extraSkuData.map((attr: any, attrIndex: number) => (
                                                                                        <View className="extraskudata-item" key={attrIndex}>
                                                                                            <View className="title line1">{attr.attrName}</View>
                                                                                            <View className="line-box">
                                                                                                <View className="line" />
                                                                                            </View>
                                                                                            <View className="content">
                                                                                                <Text className="line1 content-text">{attr.attrValue}</Text>
                                                                                                <View className="price price-box">
                                                                                                    <FormatPrice showText={false} priceData={attr.totalAttrPrice} />
                                                                                                </View>
                                                                                                <Text className="iconfont-h5 icon-xiajiantou1-copy" />
                                                                                            </View>
                                                                                        </View>
                                                                                    ))
                                                                                ) : (
                                                                                    <View className="extraskudata-item">
                                                                                        <View className="title">{t("附加")}</View>
                                                                                        <View className="line-box">
                                                                                            <View className="line" />
                                                                                        </View>
                                                                                        <View className="content">
                                                                                            <Text className="line1 content-text">
                                                                                                {`已选${goods.extraSkuData.length}项`}
                                                                                                <View className="price price-box">
                                                                                                    <FormatPrice showText={false} priceData={goods.serviceFee} />
                                                                                                </View>
                                                                                            </Text>

                                                                                            <Text className="iconfont-h5 icon-xiajiantou1-copy" />
                                                                                        </View>
                                                                                    </View>
                                                                                )}
                                                                            </View>
                                                                        )}
                                                                    </View>
                                                                </View>
                                                            </Swipe>
                                                        </View>
                                                    ))}
                                                </View>

                                                {item.gift.length > 0 && (
                                                    <View className="gift-box">
                                                        <View className="gift-title">{t("赠品")}</View>
                                                        <View className="gift-content">
                                                            {item.gift.map((subItem: any) => (
                                                                <View className="gift-content-item" key={subItem.giftId}>
                                                                    <View className="gift-item-left">
                                                                        <Image src={productImage(subItem)} />
                                                                    </View>
                                                                    <View className="gift-item-right">
                                                                        <View className="gift-item-name line1">{subItem.productName}</View>
                                                                        {!!getSkuValueList(subItem.skuData).length && (
                                                                            <View className="cart-gift-sku">
                                                                                {getSkuValueList(subItem.skuData).map((skuValue: string, skuIndex: number) => (
                                                                                    <View className="cart-gift-sku-item" key={skuIndex}>
                                                                                        {skuValue}
                                                                                    </View>
                                                                                ))}
                                                                            </View>
                                                                        )}
                                                                        <View className="gift-item-num">x{subItem.num}</View>
                                                                    </View>
                                                                </View>
                                                            ))}
                                                        </View>
                                                    </View>
                                                )}
                                            </View>
                                        ))}
                                    </View>

                                    <View className="checkOutBar" style={checkOutBarStyle}>
                                        {/* 编辑态：全选 + 删除 */}
                                        {cartManage ? (
                                            <View className="cart-edit-footer">
                                                <View className="cart-edit-footer-left">
                                                    {/* 旧 v-model:checked="allChecked" + @change：先翻转全选态再联动 */}
                                                    <Checkbox
                                                        checked={allChecked}
                                                        shape="circle"
                                                        size={19}
                                                        iconSize={18}
                                                        onChange={() => {
                                                            allCheckedRef.current = !allCheckedRef.current;
                                                            rerender();
                                                            onCheckAll();
                                                        }}
                                                    />
                                                    <Text className="cart-edit-footer-check-text" onClick={onCheckAllText}>
                                                        {t("全选")}
                                                    </Text>
                                                </View>
                                                {/*
                                                <View className="l_a_tool lt_delete" onClick={checkClearCart}>{t("清空购物车")}</View>
                                                */}
                                                <View
                                                    className={`cart-edit-footer-btn ${getCartIds().length === 0 ? "is-disabled" : ""}`}
                                                    onClick={delCartItem}
                                                >
                                                    {t("删除")}
                                                </View>
                                            </View>
                                        ) : (
                                            /* 结算态：单行布局 */
                                            <View className="cart-footer-content cart-footer-content--style2">
                                                <View className="cart-footer-left">
                                                    {!showDiscountInfo && (
                                                        <>
                                                            {/* 旧 v-model:checked="allChecked" + @change：先翻转全选态再联动 */}
                                                            <Checkbox
                                                                checked={allChecked}
                                                                shape="circle"
                                                                size={19}
                                                                iconSize={18}
                                                                onChange={() => {
                                                                    allCheckedRef.current = !allCheckedRef.current;
                                                                    rerender();
                                                                    onCheckAll();
                                                                }}
                                                            />
                                                            <Text className="cart-footer-text" onClick={onCheckAllText}>
                                                                {t("全选")}
                                                            </Text>
                                                        </>
                                                    )}
                                                </View>
                                                <View className="cart-footer-right">
                                                    <View className="cart-footer-price">
                                                        <View className="cart-footer-total" onClick={handleShowDiscountInfo}>
                                                            <Text className="cart-footer-label">{t("合计")}</Text>
                                                            <FormatPrice
                                                                showText={false}
                                                                isBottom={false}
                                                                priceData={total.discountAfter}
                                                                fontStyle={{ fontWeight: "bold" }}
                                                                currencyStyle={{ fontSize: "22rpx", fontWeight: "bold" }}
                                                                decimalsStyle={{ fontSize: "22rpx", fontWeight: "bold" }}
                                                            />
                                                        </View>
                                                        <View className="cart-footer-discount-row">
                                                            {total.discounts > 0 && (
                                                                <View className="cart-footer-discount">
                                                                    {t("优惠")}：
                                                                    <FormatPrice showText={false} isBottom={false} priceData={total.discounts} />
                                                                </View>
                                                            )}
                                                            <View
                                                                className={`cart-footer-detail ${total.checkedCount == 0 ? "is-disabled" : ""}`}
                                                                onClick={handleShowDiscountInfo}
                                                            >
                                                                {t("明细")}
                                                                <Text className={`iconfont-h5 icon-xiajiantou1-copy ${showDiscountInfo ? "icon-active" : ""}`} />
                                                            </View>
                                                        </View>
                                                    </View>
                                                    {/* TODO(MIGRATION)：旧 tig-button2 以 .cart-footer-btn 样式 View 等价重写（主题色实底 + 白字加粗） */}
                                                    <View
                                                        className={`cart-footer-btn ${total.checkedCount == 0 ? "is-disabled" : ""}`}
                                                        style={{ height: "72rpx", margin: "0" } as any}
                                                        onClick={handleCheckout}
                                                    >
                                                        <Text className="cart-footer-btn-text">{t("去结算")}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                </>
                            )}

                            {cartList.length === 0 && !isLoad && (
                                <View className="cart-empty">
                                    <CartEmpty />
                                </View>
                            )}
                            <Recommend onCallback={getCartList} />
                        </View>
                    )}
                </>
            )}
            {showLogin && <ToLogin />}

            <DiscountInfo show={showDiscountInfo} onShowChange={setShowDiscountInfo} total={total} />

            <Detail show={showDetail} onShowChange={setShowDetail} detail={currentDetailRef.current} />

            <DeliveryProductPop
                show={showDeliveryProductPop}
                onShowChange={setShowDeliveryProductPop}
                deliveryProducts={deliveryProducts}
                pickupProductData={pickupProductData}
                localDeliveryProducts={localDeliveryProducts}
                onOrderCheckType={handleOrderCheckType}
            />
        </TigLayout>
    );
}
