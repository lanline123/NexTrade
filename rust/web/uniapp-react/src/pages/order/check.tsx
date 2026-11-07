import { useEffect, useReducer, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useRouter } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigButton from "@/components/tig/tig-button/TigButton";
import FormatPrice from "@/components/format-price/FormatPrice";
import { getOrderCheckData, updateOrderCheckData, orderSubmit, updateCouponData, getPaymentType, getShippingType, getStockCalendar } from "@/api/order/check";
import { orderPaymentList } from "@/api/order/pay";
import { getShopPickupTpl } from "@/api/store/store";
import { getAddressList } from "@/api/user/address";
import { getUserPickupList } from "@/api/store/userPickup";
import { useConfigStore } from "@/store/config";
import { useUserStore } from "@/store/user";
import { useRegionStore } from "@/store/region";
import { redirect } from "@/utils";
import { getOrderPickupParams, filterDayList } from "@/utils/store";
import { getCartReservationFlowType } from "@/utils/productSoldOut";
import { t } from "@/utils/i18n";
import type { CartList, Total, PaymentTypeItem, ShippingTypeItem, DateStockList, CreditPaymentInfo, StockCalendarParams } from "@/types/order/check";
import type { AddressFilterResult } from "@/types/user/address";
import type { UserPickupListRecord } from "@/types/store/userPicekup";
import type { PresaleInfo } from "@/types/presale/presale";

import AddressInfo from "./src/AddressInfo";
import PaymentMode from "./src/PaymentMode";
import PaymentChannelList from "./src/PaymentChannelList";
import StoreCard from "./src/StoreCard";
import CouponInfo from "./src/CouponInfo";
import PointsCard from "./src/PointsCard";
import BalanceCard from "./src/BalanceCard";
import CreditCard from "./src/CreditCard";
import Remark from "./src/Remark";
import TotalCard from "./src/TotalCard";
import DeliveryTypeCard from "./src/DeliveryTypeCard";
import AddressPop from "./src/AddressPop";
import ShippingFeePop from "./src/ShippingFeePop";
import PickupUserCard from "./src/PickupUserCard";
import { usePayment } from "./src/usePayment";

import "./check.scss";
import { usePageGuards } from "@/utils/pageMixin";

// 旧 CycleConfig 为全局声明类型（周期购配置），随周期购批次补充
type CycleConfig = any;

/**
 * 订单结算页（自旧 pages/order/check.vue 移植）
 * - 支持多种配送方式：商城配送、门店自提、同城配送
 * - 支持预约服务：预约到店(flowType=9)、预约上门(flowType=10)
 * - 支持周期购订单配置
 * - 选择支付方式、使用优惠券/积分/余额抵扣
 * - 可开具发票、添加备注
 * - 展示商品清单和价格明细
 *
 * 状态策略：旧版为 Vue reactive/ref 就地改写（formState 被 Object.assign 整体合并、
 * shippingType 按店铺就地 mutation），沿用 cart 页先例（可变 ref + useReducer rerender）
 * 逐行保留原状态机。子组件占位清单见 src/ 目录内 TODO(B3-2b) 注释。
 */
export default function Check() {
    usePageGuards();
    const configXClientType = useConfigStore((s) => s.XClientType);
    const configIntegralName = useConfigStore((s) => s.integralName);
    const userInfo = useUserStore((s) => s.userInfo);
    const userGetUserInfo = useUserStore((s) => s.getUserInfo);

    const [, rerender] = useReducer((c: number) => c + 1, 0);

    const cycleConfigRef = useRef<any>({});
    const cardConfigRef = useRef<CycleConfig>({});

    const cycleOrderInfoRef = useRef<any>({});
    const useGiftCardRef = useRef(false);

    // 当前结算表单数据
    interface IformState {
        addressId?: number;
        shopId?: number;
        shippingType: {
            [key: string]: {
                typeId: number;
                shopId: number;
                typeName: string;
                pickupId?: number;
                pickupTitle?: string;
                expectPickupTime?: string;
                pickupTime?: string;
                pickupDateType?: number; // 0 今日 1 明日 2 后日
            };
        };
        productExtra: any;
        payTypeId: number;
        usePoint: number;
        useBalance: number;
        /** 是否使用账期支付：0-不使用，1-使用 */
        useCredit: 0 | 1;
        useCouponIds: number[];
        selectUserCouponIds: number[];
        buyerNote: string;
        invoiceData: any;
        useDefaultCouponIds?: number;
        productReservationTimeId?: number;
        reservationDate?: string;
        deliveryType?: number;
        longitude?: number;
        latitude?: number;
        lotteryRecordId?: any;
        flowType?: number;
    }

    // 当前结算表单数据（旧 reactive → 可变 ref + rerender；仅在 mount 时初始化一次）
    // TODO(MIGRATION)：旧 regionStore.currentLocationInfo（定位经纬度）尚未随 region store stub 提供，
    // region 全量迁移（O2O 批次）后就位后此处自动生效
    const regionStateAny = useRegionStore.getState() as any;
    const formStateRef = useRef<IformState>({
        shippingType: {},
        payTypeId: 0,
        usePoint: 0,
        useBalance: 0,
        useCredit: 0,
        useCouponIds: [],
        selectUserCouponIds: [],
        buyerNote: "",
        invoiceData: {},
        productExtra: {},
        longitude: regionStateAny.currentLocationInfo?.longitude,
        latitude: regionStateAny.currentLocationInfo?.latitude,
        lotteryRecordId: null
    });
    const formState = formStateRef.current;

    const isCycleBuy = () => {
        return !!(cycleConfigRef.current && Object.keys(cycleConfigRef.current).length > 0);
    };

    const showReserveErrorRef = useRef(false);
    const reserveInfoRef = useRef({
        productReservationTimeId: 0,
        reservationDate: ""
    });
    const reserveInfo = reserveInfoRef.current;

    const userPickupIfonRef = useRef<UserPickupListRecord>({} as UserPickupListRecord);
    const userPickupIfon = userPickupIfonRef.current;
    const isUserPickupListEmptyRef = useRef(false);
    const isOrderInfoLoadedRef = useRef(false);

    /**
     * @description 获取用户自提联系人列表
     * 用于到店自提和预约上门服务场景，获取用户已保存的联系人信息
     * 预约到店场景如无联系人则引导添加，次卡下单阶段除外
     */
    const getUserPickupListData = async () => {
        try {
            const result = await getUserPickupList({ page: 1, size: 2 });
            isUserPickupListEmptyRef.current = result.records.length === 0;
            userPickupIfonRef.current = !isUserPickupListEmptyRef.current ? result.records[0] : ({} as UserPickupListRecord);

            if (isOrderInfoLoadedRef.current && reserveFlowType() === 9 && isUserPickupListEmptyRef.current && !isSubCardRef.current) {
                redirect({
                    url: "/pages/store/contacts/list"
                });
            }
            rerender();
        } catch (error) {
            console.error(error);
        }
    };

    const pickupTplDataRef = useRef<any>({});

    /**
     * @description 获取门店自提时间配置模板
     * 包含各门店的自提时间段、预约时间限制等配置
     */
    const getShopPickupTplData = async () => {
        try {
            const result = await getShopPickupTpl({ shopId: formState.shopId });

            for (const item of result as any[]) {
                pickupTplDataRef.current[item.shopId] = item;
            }
            rerender();
        } catch (error) {
            console.error(error);
        }
    };

    const addressListRef = useRef<AddressFilterResult[]>([]);
    const addressList = addressListRef.current;
    const [showAddressPop, setShowAddressPop] = useState(false);
    const hasPickupDeliveryRef = useRef(false); // 是否有到店自提
    const hasPickupDelivery = hasPickupDeliveryRef.current;

    /**
     * @description 获取用户收货地址列表
     * 商城配送和同城配送场景需要收货地址
     */
    const getAddressListData = async () => {
        try {
            const result = await getAddressList({ page: 1, size: 5 });
            if (result.records.length > 0) {
                const records = result.records;
                // 默认选中用户在地址/定位页切换的收货地址：优先按地址 id 精确匹配，其次坐标，再次地址文案，否则回退第一条
                // TODO(MIGRATION)：旧 regionStore 的 currentSelectedName/currentSelectedAddressId/currentLocationInfo
                // 尚未随 region store stub 提供，先按空值走回退分支，region 迁移后恢复
                const regionAny = useRegionStore.getState() as any;
                const selName = regionAny.currentSelectedName;
                const selAddressId = Number(regionAny.currentSelectedAddressId) || 0;
                const lat = Number(regionAny.currentLocationInfo?.latitude) || 0;
                const lng = Number(regionAny.currentLocationInfo?.longitude) || 0;
                let matched = selAddressId ? records.find((r) => Number(r.addressId) === selAddressId) : undefined;
                if (!matched && lat && lng) {
                    matched = records.find((r) => Number(r.latitude) === lat && Number(r.longitude) === lng);
                }
                if (!matched && selName) {
                    matched = records.find((r) => r.address === selName);
                }
                addressListRef.current = matched ? [matched, ...records.filter((r) => r !== matched)] : records;
                formState.addressId = addressListRef.current[0].addressId;
                rerender();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const checkLanLon = () => {
        if (!addressListRef.current[0]) {
            return true;
        }

        return addressListRef.current[0]?.latitude && addressListRef.current[0]?.longitude;
    };

    const handleLink = () => {
        setShowAddressPop(false);
        redirect({
            url: `/pages/address/editRegion?id=${addressListRef.current[0]?.addressId}&type=check`
        });
    };

    const paymentTypeListRef = useRef<PaymentTypeItem[]>([]);
    const paymentTypeList = paymentTypeListRef.current;

    /**
     * @description 获取可用的支付方式列表
     * 礼品卡订单使用特定flowType获取支付方式
     */
    const getPaymentTypeData = async () => {
        try {
            const result = useGiftCardRef.current ? await getPaymentType(flowTypeRef.current) : await getPaymentType();
            formState.payTypeId = result[0].typeId;
            paymentTypeListRef.current = result;
            rerender();
        } catch (e) {
            console.log(e);
        }
    };

    /** 在线支付大类 typeId */
    const ONLINE_PAY_TYPE_ID = 1;

    /** 当前直选的在线支付渠道 code（不随 formState 提交给后端，仅用于建单后发起支付） */
    const selectedPaymentTypeRef = useRef("");
    const selectedPaymentType = selectedPaymentTypeRef.current;
    const onlinePaymentListRef = useRef<string[]>([]);
    const onlinePaymentList = onlinePaymentListRef.current;

    /**
     * @description 获取在线支付的具体渠道列表（结算页直选用）
     * 调用下单前渠道列表接口（无需订单 id）；返回为空时不展示直选，提交后走支付页原流程选择渠道
     */
    const getOnlinePaymentListData = async () => {
        try {
            const result = await orderPaymentList();
            onlinePaymentListRef.current = result.paymentList || [];
            rerender();
        } catch (e) {
            onlinePaymentListRef.current = [];
            console.log(e);
        }
    };

    /**
     * @description 支付大类变更回调
     * 切到在线支付时默认选中第一个渠道，切到其它大类时清空已选渠道，随后重算订单金额
     */
    const onPayTypeChange = () => {
        if (formState.payTypeId === ONLINE_PAY_TYPE_ID) {
            if (needOnlinePayment() && !selectedPaymentTypeRef.current && onlinePaymentListRef.current.length > 0) {
                selectedPaymentTypeRef.current = onlinePaymentListRef.current[0];
            }
        } else {
            selectedPaymentTypeRef.current = "";
        }
        rerender();
        updateOrderCheck();
    };

    const shippingTypeDataRef = useRef<{ [key: string]: ShippingTypeItem[] }>({});
    const shippingTypeData = shippingTypeDataRef.current;

    /**
     * @description 获取各店铺可用配送方式
     * 按店铺ID分组，支持多店铺不同配送方式
     */
    const getShippingTypeData = async () => {
        try {
            const result = await getShippingType({ flowType: flowTypeRef.current, shopId: formState.shopId });
            shippingTypeDataRef.current = result;
            for (const key in result) {
                if (result[key] && result[key].length > 0) {
                    formState.shippingType[key] = {
                        typeId: result[key][0].shippingTypeId,
                        shopId: result[key][0].shopId,
                        typeName: result[key][0].shippingTypeName
                    };
                }
            }
            rerender();
        } catch (e) {
            console.log(e);
        }
    };

    /**
     * @description 更新自提配送信息
     * 将用户选择的自提门店和自提时间同步到配送类型数据中
     * 处理自提时间计算逻辑：今日/明日/后日
     */
    const updateShippingType = () => {
        if (storesRef.current && storesRef.current.length > 0) {
            for (const key in formState.shippingType) {
                const index = storesRef.current.findIndex((item: any) => item.shopId === Number(key));
                if (index !== -1) {
                    formState.shippingType[key].pickupId = storesRef.current[index].pickupId;
                    formState.shippingType[key].pickupTitle = storesRef.current[index].pickupTitle;
                }

                if (pickupTplDataRef.current && pickupTplDataRef.current[key] && pickupTplDataRef.current[key].pickupTimeStatus === 1) {
                    const timeList = filterDayList(pickupTplDataRef.current[key].timeList || [], pickupTplDataRef.current[key].appointmentTime);

                    if (
                        pickupTplDataRef.current[key].appointmentTime &&
                        pickupTplDataRef.current[key].appointmentTime.timeUnit === "d" &&
                        pickupTplDataRef.current[key].appointmentTime.timeNum > 0
                    ) {
                        const time = pickupTplDataRef.current[key].timeList[0];
                        formState.shippingType[key].pickupTime = `${time.startTime} - ${time.endTime}`;
                        formState.shippingType[key].pickupDateType = pickupTplDataRef.current[key].appointmentTime.timeNum;
                        continue;
                    }

                    if (timeList.length === 0) {
                        const time = pickupTplDataRef.current[key].timeList[0];
                        formState.shippingType[key].pickupTime = `${time.startTime}-${time.endTime}`;
                        formState.shippingType[key].pickupDateType = 1;
                        continue;
                    }

                    const time = timeList[0];
                    formState.shippingType[key].pickupTime = `${time.startTime} - ${time.endTime}`;
                    formState.shippingType[key].pickupDateType = 0;
                }
            }
        }
    };

    const cartListDataRef = useRef<CartList[]>([]);
    const cartListData = cartListDataRef.current;
    const cartReservationFlowType = () => getCartReservationFlowType(cartListDataRef.current);
    const reserveFlowType = () => {
        if (flowTypeRef.current === 9 || flowTypeRef.current === 10) return flowTypeRef.current;
        return cartReservationFlowType() ?? 0;
    };
    const isReserve = () => reserveFlowType() === 9 || reserveFlowType() === 10;
    const totalDataRef = useRef<Total>();
    const totalData = totalDataRef.current;
    // 预售信息（本项目约束：预售不混单，结算时最多只有一个预售配置）
    const productPresaleRef = useRef<PresaleInfo | null>(null);
    const productPresale = productPresaleRef.current;
    const couponListDataRef = useRef<any>([]);
    const couponListData = couponListDataRef.current;
    const tmplIdsDataRef = useRef<any>([]);
    const flowTypeRef = useRef<number>(1);
    const flowType = flowTypeRef.current;
    const availablePointsRef = useRef(0);
    const availablePoints = availablePointsRef.current;
    const creditPaymentInfoRef = useRef<CreditPaymentInfo | null>(null);
    const creditPaymentInfo = creditPaymentInfoRef.current;
    const showCouponCard = () => !useGiftCardRef.current && useConfigStore.getState().useCoupon == 1 && flowTypeRef.current != 3;
    const showPointsCard = () => !useGiftCardRef.current && useConfigStore.getState().usePoints == 1 && flowTypeRef.current != 3;
    const showBalanceCard = () => !useGiftCardRef.current && useConfigStore.getState().useSurplus == 1;
    // 授信客户只要返回了账期信息就展示，不可用时由卡片内部显示禁用原因
    const showCreditCard = () => !useGiftCardRef.current && !!creditPaymentInfoRef.current;
    const [showShippingFee, setShowShippingFee] = useState(false);
    const storeShippingRuleRef = useRef<any>(null);
    const storeShippingRule = storeShippingRuleRef.current;
    const shopDeliveryDataRef = useRef<any>([]);

    const isPresaleDeposit = () => productPresaleRef.current?.saleMode === 2;
    const payableAmount = () => {
        if (isPresaleDeposit()) {
            return totalDataRef.current?.actualPayDepositAmount ?? totalDataRef.current?.depositAmount ?? totalDataRef.current?.unpaidAmount;
        }
        return totalDataRef.current?.unpaidAmount;
    };
    const needOnlinePayment = () => Number(payableAmount() ?? 0) > 0;

    // 旧 watch(needOnlinePayment)：金额重算后由 getOrderInfo/updateOrderCheck/updateCoupon 收尾处
    // 手动调用 applyNeedOnlinePaymentWatch（TODO(MIGRATION)：随 watch → 显式同步的转换约定）
    const applyNeedOnlinePaymentWatch = () => {
        const needPay = needOnlinePayment();
        if (!needPay) {
            selectedPaymentTypeRef.current = "";
            return;
        }
        if (formState.payTypeId === ONLINE_PAY_TYPE_ID && !selectedPaymentTypeRef.current && onlinePaymentListRef.current.length > 0) {
            selectedPaymentTypeRef.current = onlinePaymentListRef.current[0];
        }
    };

    // 是否是次卡
    const isSubCardRef = useRef<boolean>(false);
    const isSubCard = isSubCardRef.current;

    const shippingFeeType = (): "homeService" | "localDelivery" => (reserveFlowType() === 10 ? "homeService" : "localDelivery");

    const hasStoreDeliveryRef = useRef(false); // 是否有商城配送
    const hasStoreDelivery = hasStoreDeliveryRef.current;
    const hasLocalDeliveryRef = useRef(false); // 是否有同城配送
    const hasLocalDelivery = hasLocalDeliveryRef.current;

    const pickupProductsRef = useRef<any[]>([]);
    const pickupProducts = pickupProductsRef.current;

    /**
     * 门店详情页顶部 tab 携带的配送类型白名单（URL 参数 tabDeliveryTypes 解析而来）
     * 用于把结算页可选的配送方式（快递/自提/同城）再收敛一层，只保留当前 tab 允许的
     * 门店 tab 使用的配送类型枚举：1=到店自提 2=上门服务 3=预约到店 4=同城配送 5=快递配送
     */
    const tabDeliveryTypesRef = useRef<number[]>([]);

    /**
     * 结算页 deliveryType (1/2/3) 与门店 tab deliveryType (1/4/5) 的映射
     * 1 快递配送 ↔ tab 5；2 门店自提 ↔ tab 1；3 同城配送 ↔ tab 4
     */
    const CHECK_TO_TAB_DELIVERY_MAP: Record<number, number> = {
        1: 5,
        2: 1,
        3: 4
    };

    /**
     * 判断结算页某个 deliveryType (1/2/3) 是否被当前门店 tab 允许
     * tabDeliveryTypes 为空表示不做过滤（例如来自 cart 页 / 其它入口）
     */
    const isDeliveryAllowedByTab = (checkDeliveryType: number): boolean => {
        if (tabDeliveryTypesRef.current.length === 0) return true;
        const mapped = CHECK_TO_TAB_DELIVERY_MAP[checkDeliveryType];
        if (mapped === undefined) return true;
        return tabDeliveryTypesRef.current.includes(mapped);
    };

    /**
     * 当后端默认 deliveryType 被当前 tab 过滤掉时，在剩余可用的配送方式里挑一个作为兜底
     * 优先取当前实际拉到的可用配送方式（避免选到一个没有商品可下单的方式）
     */
    const pickFallbackDeliveryType = (): number => {
        if (hasStoreDeliveryRef.current && isDeliveryAllowedByTab(1)) return 1;
        if (hasPickupDeliveryRef.current && isDeliveryAllowedByTab(2)) return 2;
        if (hasLocalDeliveryRef.current && isDeliveryAllowedByTab(3)) return 3;
        return 0;
    };

    /**
     * 把当前 deliveryType 收敛到 tab 白名单内（首次加载与每次 update 回包后都执行），
     * 防止后端回包把配送方式带回被 tab 禁用的类型（如门店自提 tab 被切回快递）
     */
    const enforceTabDeliveryType = () => {
        if (tabDeliveryTypesRef.current.length === 0 || isDeliveryAllowedByTab(deliveryTypeRef.current)) return;
        const fallback = pickFallbackDeliveryType();
        if (fallback > 0) {
            deliveryTypeRef.current = fallback;
            formState.deliveryType = fallback;
        }
    };

    /**
     * @description 判断用户是否可以切换配送方式
     * 当有2种或以上配送方式可用时允许切换
     */
    const canChangeDelivery = () => {
        if (flowTypeRef.current === 12 && (reserveFlowType() === 9 || reserveFlowType() === 10)) {
            return false;
        }
        const availableDeliveryTypes = [hasStoreDeliveryRef.current, hasLocalDeliveryRef.current, hasPickupDeliveryRef.current].filter(Boolean).length;

        // 当有2种或以上配送方式时，用户可以切换配送方式
        return availableDeliveryTypes >= 2;
    };

    /**
     * @description 判断同城配送是否超出配送范围
     * 仅在同城配送模式下检查
     */
    const isBeyondDelivery = () => {
        if (!shopDeliveryDataRef.current || shopDeliveryDataRef.current.length === 0) {
            return false;
        }

        if (deliveryTypeRef.current === 3) {
            const index = shopDeliveryDataRef.current.findIndex((item: any) => item.isOutOfRange);

            if (index !== -1) {
                return true;
            }
        }
        return false;
    }; // 是否超出配送范围

    const [isLoading, setIsLoading] = useState(false);

    const mergeShippingType = (current: any, incoming: any) => {
        if (!incoming) return current;

        const merged = { ...current };
        for (const shopId in incoming) {
            merged[shopId] = {
                ...(current[shopId] || {}),
                ...incoming[shopId]
            };
        }
        return merged;
    };

    /**
     * @description 获取订单结算信息
     * 包含商品列表、价格汇总、优惠券、配送选项等完整结算数据
     * O2O场景下会返回商城配送/到店自提/同城配送的商品分组
     */
    const getOrderInfo = async () => {
        try {
            const result: any = await getOrderCheckData({ flowType: flowTypeRef.current, ...formState });

            const { cartList, total, couponList, tmplIds, item, useCouponIds, selectUserCouponIds, deliveryOption = {}, creditPaymentInfo: cpi } = result;
            isOrderInfoLoadedRef.current = true;
            cartListDataRef.current = cartList;
            // 次卡下单阶段不强制要求联系人，联系人为空也不跳转联系人列表。
            if (reserveFlowType() === 9 && isUserPickupListEmptyRef.current && !isSubCardRef.current) {
                return redirect({
                    url: "/pages/store/contacts/list"
                });
            }
            // 周期购/次卡不去请求预约模板
            if (isReserve() && !isCycleBuy() && !isSubCardRef.current) {
                getStockCalendarData({
                    productId: cartList[0]?.carts[0]?.productId,
                    shopId: cartList[0]?.shopId,
                    skuId: cartList[0]?.carts[0]?.skuId
                });
            }

            if (item) {
                const currentShippingType = formState.shippingType;
                Object.assign(formState, item);
                formState.shippingType = mergeShippingType(currentShippingType, item.shippingType);

                if (item.deliveryType) {
                    deliveryTypeRef.current = item.deliveryType;

                    if (!isSubCardRef.current && item.deliveryType === 3 && !checkLanLon() && reserveFlowType() !== 9) {
                        setShowAddressPop(true);
                    }
                }
            }

            if (deliveryOption && Object.keys(deliveryOption).length > 0) {
                if (deliveryOption.deliveryProducts && deliveryOption.deliveryProducts.length > 0 && isDeliveryAllowedByTab(1)) {
                    hasStoreDeliveryRef.current = true;
                }

                if (deliveryOption.pickupProducts && deliveryOption.pickupProducts.length > 0 && isDeliveryAllowedByTab(2)) {
                    hasPickupDeliveryRef.current = true;

                    pickupProductsRef.current = deliveryOption?.pickupProducts || [];

                    storesRef.current = getOrderPickupParams(deliveryOption?.pickupProducts);
                    updateShippingType();
                }

                if (deliveryOption.shopDeliveryProducts && deliveryOption.shopDeliveryProducts.length > 0 && isDeliveryAllowedByTab(3)) {
                    hasLocalDeliveryRef.current = true;
                }

                shopDeliveryDataRef.current = deliveryOption?.shopDeliveryData;
            }

            // 如果后端默认的 deliveryType 被当前 tab 过滤掉了，兜底切换到 tab 允许的第一个可选项
            enforceTabDeliveryType();

            if (useCouponIds && useCouponIds.length > 0) {
                formState.useCouponIds = useCouponIds;
            }
            if (selectUserCouponIds && selectUserCouponIds.length > 0) {
                formState.selectUserCouponIds = selectUserCouponIds;
            }

            // 后端仅在同城配送/预约上门时返回配送规则，未返回时需清空，避免残留旧规则
            storeShippingRuleRef.current = total?.storeShippingRule ?? null;

            cartListDataRef.current = cartList;
            totalDataRef.current = total;
            productPresaleRef.current = (result as any)?.productPresale ?? null;
            couponListDataRef.current = couponList;
            tmplIdsDataRef.current = tmplIds;
            creditPaymentInfoRef.current = cpi ?? null;
            // 抽奖订单无可用积分
            availablePointsRef.current = formState.lotteryRecordId ? 0 : result.availablePoints;

            // 是预约到店无需弹窗添加地址,并且不是到店自提
            const isLink = Taro.getStorageSync("link");
            if (addressListRef.current.length === 0 && !isLink && reserveFlowType() !== 9 && !hasPickupDeliveryRef.current && !isSubCardRef.current) {
                return redirect({
                    url: "/pages/address/list"
                });
            }
            rerender();
        } catch (error: any) {
            if (error.message === "用户地址不存在") {
                const isLink = Taro.getStorageSync("link");
                if (!isLink && reserveFlowType() !== 9 && !hasPickupDeliveryRef.current && !isSubCardRef.current) {
                    return redirect({
                        url: "/pages/address/list"
                    });
                }
                return;
            }
            console.error(error);
        } finally {
            setIsLoading(false);
            // 旧 watch(needOnlinePayment) 触发点：金额重算完成后同步直选渠道
            applyNeedOnlinePaymentWatch();
            // 旧 watch(isCycleBuy) 触发点
            applyCycleBuyWatch();
            rerender();
        }
    };

    const dateStockListRef = useRef<DateStockList[]>([]);
    const getStockCalendarData = async (params: StockCalendarParams) => {
        try {
            const result = await getStockCalendar(params);
            dateStockListRef.current = result.dateStockList;
            rerender();
        } catch (error) {
            console.error(error);
        }
    };

    /**
     * @description 更新商品附加服务选项
     * @param data 附加服务数据
     */
    const changeProductExtra = async (data: any) => {
        formState.productExtra = data;
        const result = await updateOrderCheck();
        if (result) {
            cartListDataRef.current = result.cartList;
            rerender();
        }
    };

    /**
     * @description 切换配送方式
     * @param val 配送方式：1-商城配送 2-门店自提 3-同城配送
     */
    const handleChangeDelivery = (val: number) => {
        formState.deliveryType = val;

        updateOrderCheck();
    };

    const hasStoreShippingRule = () => {
        // 配送规则仅适用于同城配送和预约上门，快递配送按运费模板计费不展示
        if (reserveFlowType() !== 10 && deliveryTypeRef.current !== 3) return false;
        const rule = storeShippingRuleRef.current as any;
        if (!rule) return false;
        if (Array.isArray(rule)) return rule.some((item) => !!item);
        if (typeof rule === "object") return Object.values(rule).some((item) => !!item);
        return false;
    };

    const handleShowShippingFee = () => {
        if (!hasStoreShippingRule()) return;
        setShowShippingFee(true);
    };

    /**
     * @description 更新订单结算数据
     * 切换配送方式、地址、支付方式等时重新计算订单金额
     */
    const updateOrderCheck = async () => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            const result: any = await updateOrderCheckData({ flowType: flowTypeRef.current, ...formState });

            if (result.item) {
                const currentShippingType = formState.shippingType;
                Object.assign(formState, result.item);
                formState.shippingType = mergeShippingType(currentShippingType, result.item.shippingType);
                deliveryTypeRef.current = result.item.deliveryType;
                enforceTabDeliveryType();

                if (!isSubCardRef.current && deliveryTypeRef.current === 3 && !checkLanLon()) {
                    setShowAddressPop(true);
                }
            }

            if (result.deliveryOption && Object.keys(result.deliveryOption).length > 0) {
                if (result.deliveryOption.pickupProducts && result.deliveryOption.pickupProducts.length > 0) {
                    pickupProductsRef.current = result.deliveryOption?.pickupProducts || [];
                }

                shopDeliveryDataRef.current = result.deliveryOption?.shopDeliveryData;
            }

            // 切换配送方式后同步配送规则，快递配送（运费模板计费）不返回规则
            storeShippingRuleRef.current = result.total?.storeShippingRule ?? null;

            cartListDataRef.current = result.cartList;
            totalDataRef.current = result.total;
            productPresaleRef.current = (result as any)?.productPresale ?? productPresaleRef.current;
            // 抽奖订单无可用积分
            availablePointsRef.current = formState.lotteryRecordId ? 0 : result.availablePoints;
            return result;
        } catch (error: any) {
            showToast(error.message);
        } finally {
            Taro.hideLoading();
            // 旧 watch(needOnlinePayment) 触发点
            applyNeedOnlinePaymentWatch();
            rerender();
        }
    };

    /**
     * @description 更新优惠券使用状态并重新计算订单金额
     */
    const updateCoupon = async () => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            const result: any = await updateCouponData(formState);

            couponListDataRef.current = result.couponList;
            totalDataRef.current = result.total;
            productPresaleRef.current = (result as any)?.productPresale ?? productPresaleRef.current;
            cartListDataRef.current = result.cartList;
            formState.useCouponIds = result.useCouponIds;
            formState.selectUserCouponIds = result.selectUserCouponIds;

            return result;
        } catch (error) {
            console.error(error);
        } finally {
            Taro.hideLoading();
            // 旧 watch(needOnlinePayment) 触发点
            applyNeedOnlinePaymentWatch();
            rerender();
        }
    };

    /**
     * @description 切换余额抵扣状态
     * @param status true-使用余额 false-不使用余额
     */
    const getBalanceStatus = (status: boolean) => {
        if (status) {
            // 使用余额时：互斥关闭账期支付
            formState.useBalance = Number(userInfo.balance || 0);
            formState.useCredit = 0;
            // 旧版经 creditCardRef 置内部 isCredit 状态（与余额互斥），组件已随 B3-2b 就位
            if (creditCardRef.current) {
                creditCardRef.current.isCredit = false;
            }
        } else {
            formState.useBalance = 0;
        }
        updateOrderCheck();
    };

    /**
     * @description 账期支付使用状态变更回调（与余额互斥）
     */
    const getCreditStatus = (status: boolean) => {
        if (status) {
            formState.useCredit = 1;
            formState.useBalance = 0;
            if (balanceCardRef.current) {
                balanceCardRef.current.isBalance = false;
            }
        } else {
            formState.useCredit = 0;
        }
        updateOrderCheck();
    };

    /**
     * @description 判断提交按钮是否禁用
     * 检查：配送范围、配送方式、最低起送金额等
     */
    const submitDisabled = () => {
        if (isBeyondDelivery()) {
            return true;
        }

        if (!formState.shippingType) {
            return true;
        }

        // if (isReserve() && (!reserveInfo.productReservationTimeId || !reserveInfo.reservationDate)) {
        //     return true;
        // }

        for (const item of cartListDataRef.current) {
            if (item.noShipping === 0 && !formState.shippingType[item.shopId]) {
                return true;
            }
        }

        if (cartListDataRef.current.length > 0) {
            const index = cartListDataRef.current.findIndex((item) => item.isNotReachMinOrderAmount);
            if (index !== -1) {
                return true;
            }
        }

        return false;
    };

    const [submitLoading, setSubmitLoading] = useState(false);

    const submitBtnText = () => {
        if (productPresaleRef.current?.saleMode === 2) return "支付定金";
        if (needOnlinePayment() && formState.payTypeId === ONLINE_PAY_TYPE_ID && selectedPaymentTypeRef.current) return "立即支付";
        return "提交订单";
    };

    /**
     * 根据天数偏移获取对应的年月日
     * @param daysOffset 距今天的天数偏移（0=今天，1=明天，2=后天...）
     * @returns 年月日字符串，如 "2025-09-12"
     */
    function getDateYMD(daysOffset: number): string {
        const date = new Date();
        date.setDate(date.getDate() + daysOffset);

        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const day = date.getDate().toString().padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    /**
     * @description 格式化提交数据
     * 根据不同配送方式处理表单数据：
     * - 门店自提(2)：删除地址ID，设置自提时间
     * - 商城配送(1)：清理自提相关字段
     * - 同城配送(3)：清空配送类型数据
     */
    const formatFormState = () => {
        formState.flowType = flowTypeRef.current;
        const shippingTypeEntries = Object.entries(formState.shippingType);
        const pickupFieldsToDelete = ["expectPickupTime", "pickupId", "pickupTitle", "pickupTime", "pickupDateType"] as const;

        if (deliveryTypeRef.current === 2) {
            delete formState.addressId;

            shippingTypeEntries.forEach(([key, shippingInfo]) => {
                if (isSubCardRef.current) {
                    pickupFieldsToDelete.forEach((field) => {
                        delete formState.shippingType[key][field];
                    });
                    formState.shippingType[key].typeName = "到店自提";
                    formState.shippingType[key].typeId = deliveryTypeRef.current;
                    return;
                }

                if (shippingInfo?.pickupTime) {
                    const pickupDateType = shippingInfo.pickupDateType ?? 0;
                    const dateYMD = getDateYMD(pickupDateType);
                    formState.shippingType[key].expectPickupTime = `${dateYMD} ${shippingInfo.pickupTime}`;
                }

                formState.shippingType[key].typeName = "到店自提";
                formState.shippingType[key].typeId = deliveryTypeRef.current;
            });
        } else if (deliveryTypeRef.current === 1) {
            shippingTypeEntries.forEach(([key]) => {
                pickupFieldsToDelete.forEach((field) => {
                    delete formState.shippingType[key][field];
                });
            });

            cartListDataRef.current.forEach((item) => {
                if (item.noShipping === 1) {
                    formState.shippingType[item.shopId].typeName = "无需配送";
                }
            });
        } else if (deliveryTypeRef.current === 3) {
            formState.shippingType = {};
        }

        if (isReserve() && !isSubCardRef.current) {
            // 周期购 + 预约类型：不需要选择预约日期，仅需要预约时间段ID（以及 cycleOrderInfo.selectedTimeSlot）
            formState.productReservationTimeId = reserveInfo.productReservationTimeId;
            if (!isCycleBuy()) {
                formState.reservationDate = reserveInfo.reservationDate;
            } else {
                delete formState.reservationDate;
            }
        } else if (!isSubCardRef.current) {
            delete formState.productReservationTimeId;
            delete formState.reservationDate;
        }

        formState.deliveryType = deliveryTypeRef.current;
    };

    /**
     * @description 验证配送方式和联系信息
     * 根据订单类型和配送方式检查必填信息：
     * - 预约到店服务(flowType=9)：需要联系人
     * - 预约上门服务(flowType=10)：需要收货地址
     * - 快递/同城配送：需要收货地址
     * - 门店自提：需要联系人、自提点
     * @returns 验证是否通过
     */
    const validateDeliveryAndContact = (): boolean => {
        // 预约服务验证
        if (isReserve()) {
            if (reserveFlowType() === 9) {
                // 到店服务 - 需要联系人信息
                if (Object.keys(userPickupIfonRef.current).length === 0) {
                    Taro.showToast({
                        title: t("请选择联系人信息"),
                        icon: "none"
                    });
                    return false;
                }
            } else if (reserveFlowType() === 10) {
                // 上门服务 - 需要收货地址
                if (addressListRef.current.length === 0) {
                    Taro.showToast({
                        title: t("请选择收货地址"),
                        icon: "none"
                    });
                    return false;
                }
            }
            return true;
        }

        // 普通订单配送方式验证
        switch (deliveryTypeRef.current) {
            case 1: // 快递配送
            case 3: // 同城配送
                if (addressListRef.current.length === 0) {
                    Taro.showToast({
                        title: t("请选择收货地址"),
                        icon: "none"
                    });
                    return false;
                }
                break;

            case 2: // 门店自提
                if (Object.keys(userPickupIfonRef.current).length === 0) {
                    Taro.showToast({
                        title: t("请选择联系人信息"),
                        icon: "none"
                    });
                    return false;
                }
                // 自提点未选择或不存在时拦截提交
                for (const item of cartListDataRef.current) {
                    const shippingInfo = formState.shippingType?.[item.shopId];
                    if (!shippingInfo?.pickupId || !shippingInfo?.pickupTitle) {
                        Taro.showToast({
                            title: t("请选择自提点"),
                            icon: "none"
                        });
                        return false;
                    }
                }
                break;
        }

        return true;
    };

    /**
     * @description 提交订单入口
     * 校验配送方式、联系信息、支付方式后提交订单
     * 微信小程序需先请求订阅消息授权
     */
    const submit = async () => {
        if (submitLoading) return;
        // 支付流程已发起（跳转前），禁止重复提交；已建单则转到收银台重新支付
        if (payingRef.current) {
            goPendingCashier();
            return;
        }

        if (!isSubCardRef.current && deliveryTypeRef.current === 3 && !checkLanLon()) {
            setShowAddressPop(true);
            return;
        }

        // 验证配送方式和联系信息
        if (!validateDeliveryAndContact()) {
            return;
        }

        if (formState.payTypeId === 0) {
            return Taro.showToast({
                title: t("请选择付款方式"),
                icon: "none"
            });
        }

        if (submitDisabled()) {
            return;
        }

        // 预约到店/上门：非周期购且非次卡才需要选择预约日期+时间段
        if (!isCycleBuy() && !isSubCardRef.current && isReserve() && (reserveInfo.productReservationTimeId === 0 || !reserveInfo.reservationDate)) {
            // 显示错误提示
            showReserveErrorRef.current = true;
            // 滚动到对应位置
            const query = Taro.createSelectorQuery();
            query
                .select(".store-card")
                .boundingClientRect((data: any) => {
                    // TODO(MIGRATION)：占位 StoreCard 渲染 null 期间查不到节点，组件就位后恢复滚动定位
                    if (data) {
                        Taro.pageScrollTo({
                            scrollTop: data.top,
                            duration: 300
                        });
                    }
                })
                .exec();
            return Taro.showToast({
                title: t("请选择预约时间"),
                icon: "none"
            });
        }

        formatFormState();

        setSubmitLoading(true);
        // #ifdef MP-WEIXIN → Taro: weapp 小程序调用订阅消息需要授权模板
        if (process.env.TARO_ENV === "weapp") {
            Taro.requestSubscribeMessage({
                tmplIds: tmplIdsDataRef.current,
                complete: () => {
                    submitOrder();
                }
            } as any).catch(() => {});
        } else {
            submitOrder();
        }
    };

    /**
     * @description 执行订单提交
     * 根据返回类型跳转不同页面：
     * - returnType=2 且有拼团ID：跳转拼团详情
     * - returnType=2 无拼团：跳转支付成功页
     * - 其他：跳转支付页
     * 特殊错误处理：5002-需绑定微信，5003-预约时间已满
     */
    const submitOrder = async () => {
        try {
            const result = await orderSubmit(formState as any);
            if (result.returnType === 2) {
                // 如果有拼团记录id，则跳转到拼团详情页
                if (result.grouponPromotionRecordId) {
                    redirect({
                        url: `/pages/product/groupBuying?grouponPromotionRecordId=${result.grouponPromotionRecordId}`,
                        mode: "redirectTo"
                    });
                } else {
                    redirect({
                        url: `/pages/order/payStatus?id=${result.orderId}`,
                        mode: "redirectTo"
                    });
                }
            } else if (needOnlinePayment() && formState.payTypeId === ONLINE_PAY_TYPE_ID && selectedPaymentTypeRef.current) {
                // 直选在线渠道：建单成功后直接发起支付，不再经支付页选择渠道
                await handleDirectPay(result.orderId);
            } else {
                // 线下支付/货到付款/渠道列表降级：走支付页原流程
                redirect({
                    url: `/pages/order/pay?orderId=${result.orderId}`,
                    mode: "redirectTo"
                });
            }
        } catch (error: any) {
            console.error(error);

            if (configXClientType === "wechat" && error.code === 5002) {
                Taro.setStorageSync("bindWechatFlowType", flowTypeRef.current);
                return redirect({
                    url: `/pages/user/profile/index?bindWechat=true&flowType=${flowTypeRef.current}`
                });
            } else if (error.code === 5003) {
                showToast(error.message);
                reserveInfo.productReservationTimeId = 0;
                reserveInfo.reservationDate = "";
                // 旧 watch(reserveInfo) 触发点：重置预约选择后清除错误提示
                applyReserveInfoWatch();
                getOrderInfo();
            } else {
                showToast(error.message);

                setTimeout(() => {
                    redirect({
                        url: `/pages/cart/index`,
                        mode: "redirectTo"
                    });
                }, 1500);
            }
        } finally {
            setSubmitLoading(false);
        }
    };

    const { startPay, stopPolling } = usePayment();

    /** 支付中标记：页内收银台弹层关闭会触发 onShow，此时购物车已被下单清空，需跳过结算数据重拉 */
    const payingRef = useRef(false);
    /** 直选支付已创建的待支付订单，取消支付后用于进入收银台 */
    const pendingCashierOrderIdRef = useRef<number | null>(null);

    /**
     * @description 判断当前渠道能否在本页内直接拉起收银台（弹层 / JSAPI）
     * 否则为整页跳转型渠道（H5 支付宝表单、H5 微信 mweb、PayPal 等），需经收银台页中转发起
     */
    const inlineCapable = () => {
        const client = useConfigStore.getState().XClientType;
        const type = selectedPaymentTypeRef.current;
        if (client === "miniProgram") return type === "wechat" || type === "yunpayWechat";
        if (client === "app") return type === "wechat" || type === "alipay";
        if (client === "wechat") return type === "wechat" || type === "yunpayWechat";
        return false;
    };

    /** 生成收银台地址，并保留用户本次选择的支付渠道 */
    const getCashierUrl = (orderId: number, paymentType = "") => {
        const paymentTypeQuery = paymentType ? `&paymentType=${encodeURIComponent(paymentType)}` : "";
        return `/pages/order/cashier?orderId=${orderId}&from=settle${paymentTypeQuery}`;
    };

    const goPendingCashier = () => {
        if (!pendingCashierOrderIdRef.current) return;
        redirect({
            url: getCashierUrl(pendingCashierOrderIdRef.current, selectedPaymentTypeRef.current),
            mode: "redirectTo"
        });
    };

    /** 支付平台可能直接返回收银台，发起前先写入与收银台约定的渠道缓存 */
    const cacheCashierPaymentType = (orderId: number, paymentType: string) => {
        Taro.setStorageSync("cashierPaymentSelection", { orderId, paymentType, ts: Date.now(), entryFrom: "settle" });
    };

    /**
     * @description 直选支付：订单创建成功后发起支付
     * - 页内拉起型渠道（小程序/App/公众号）：本页直接拉起收银台并轮询，取消/失败/超时落到收银台页可重新支付
     * - 整页跳转型渠道（H5 浏览器）：当前页直接跳转支付网站，返回结算页时由 onShow / pageshow 转到收银台页
     */
    const handleDirectPay = async (orderId: number) => {
        payingRef.current = true;
        pendingCashierOrderIdRef.current = orderId;
        const saleModeQuery = productPresaleRef.current?.saleMode === 2 ? "&saleMode=1" : "";
        const paymentType = selectedPaymentTypeRef.current;
        cacheCashierPaymentType(orderId, paymentType);

        // 整页跳转型渠道（H5 浏览器）：记录待支付订单，用户从支付网站返回结算页时转到收银台页
        if (!inlineCapable()) {
            Taro.setStorageSync("directPayPending", { orderId, paymentType, ts: Date.now() });
        }

        const launched = await startPay({
            orderId,
            paymentType,
            presaleInfo: productPresaleRef.current,
            // H5 微信用当前页跳转，避免开新窗口造成的中转观感
            h5WechatMode: "href",
            onSuccess: () => {
                Taro.removeStorageSync("cashierPaymentSelection");
                redirect({
                    url: `/pages/order/payStatus?id=${orderId}${saleModeQuery}`,
                    mode: "redirectTo"
                });
            },
            onFail: () => {
                // 页内拉起型渠道取消/失败：落到收银台页，可重新支付或放弃
                redirect({
                    url: getCashierUrl(orderId, paymentType),
                    mode: "redirectTo"
                });
            },
            onTimeout: () => {
                redirect({
                    url: getCashierUrl(orderId, paymentType),
                    mode: "redirectTo"
                });
            }
        });
        if (!launched) {
            // 创建支付单失败：订单已生成，去收银台页重试
            Taro.removeStorageSync("directPayPending");
            redirect({
                url: getCashierUrl(orderId, paymentType),
                mode: "redirectTo"
            });
        }
    };

    // #ifdef H5 → process.env.TARO_ENV === "h5"
    /**
     * @description 直选整页跳转支付后返回结算页的处理
     * 检测到待支付标记（10 分钟内有效）则转到收银台页，可重新支付/放弃
     * @returns 是否已发生跳转
     */
    const handleDirectPayReturn = (): boolean => {
        const pending = Taro.getStorageSync("directPayPending");
        if (pending && pending.orderId && Date.now() - pending.ts < 10 * 60 * 1000) {
            Taro.removeStorageSync("directPayPending");
            redirect({
                url: getCashierUrl(pending.orderId, pending.paymentType),
                mode: "redirectTo"
            });
            return true;
        }
        if (pending) Taro.removeStorageSync("directPayPending");
        return false;
    };

    // 整页跳转支付返回时页面多从 bfcache 恢复，不触发 onShow，需监听 pageshow/visibilitychange 兜底
    const onPageReturn = () => {
        handleDirectPayReturn();
    };
    const onVisibilityChange = () => {
        if (document.visibilityState === "visible") handleDirectPayReturn();
    };
    // #endif

    const balanceCardRef = useRef<any>(null);
    const creditCardRef = useRef<any>(null);

    /**
     * 显示toast提示
     * 旧 up-toast ref 实例 → Taro.showToast 等价封装（default 居中提示 1.5s）
     */
    const showToast = (message: string) => {
        Taro.showToast({
            title: message,
            duration: 1500,
            icon: "none"
        });
    };

    // ===================== 旧 onShow / onUnload 生命周期 =====================
    useDidShow(() => {
        // #ifdef H5
        if (process.env.TARO_ENV === "h5" && handleDirectPayReturn()) return;
        // #endif
        // 支付中触发的 onShow：购物车已被下单清空，跳过重拉，去向由支付回调/轮询决定
        if (payingRef.current) return;
        if (balanceCardRef.current) {
            balanceCardRef.current.isBalance = false;
        }
        if (creditCardRef.current) {
            creditCardRef.current.isCredit = false;
        }
        formState.useBalance = 0;
        formState.useCredit = 0;
        initPageData();
    });

    const initPageData = async () => {
        try {
            Taro.showLoading({
                title: t("加载中")
            });

            setIsLoading(true);
            isOrderInfoLoadedRef.current = false;

            let arr = [
                getAddressListData(),
                getPaymentTypeData(),
                getOnlinePaymentListData(),
                getShippingTypeData(),
                userGetUserInfo(),
                getUserPickupListData()
            ];

            if (flowTypeRef.current !== 9 && flowTypeRef.current !== 10) {
                arr = [...arr, getShopPickupTplData()];
            }

            await Promise.all(arr);
            await getOrderInfo();
            // 订单金额完成重算后，再为需要支付的订单默认选中第一个在线渠道
            if (needOnlinePayment() && formState.payTypeId === ONLINE_PAY_TYPE_ID && !selectedPaymentTypeRef.current && onlinePaymentListRef.current.length > 0) {
                selectedPaymentTypeRef.current = onlinePaymentListRef.current[0];
            }
        } catch (error: any) {
            console.error(error);
            showToast(error.message);
            setTimeout(() => {
                redirect({
                    url: `/pages/cart/index`,
                    mode: "redirectTo"
                });
            }, 1500);
        } finally {
            Taro.hideLoading();
        }
    };

    const deliveryTypeRef = useRef<number>(1); // 1 快递配送 2 门店自提
    const deliveryType = deliveryTypeRef.current;

    const storesRef = useRef<any>(null);

    // ===================== 旧 onLoad =====================
    // 路由参数在首次渲染前解析（对应旧 onLoad 时机），保证 initPageData 前(flowType 等)已就位
    const routerParams = useRouter().params;
    const onLoadParsedRef = useRef(false);
    if (!onLoadParsedRef.current) {
        onLoadParsedRef.current = true;
        const options: any = routerParams;

        if (options) {
            if (options.id) {
                formState.shopId = Number(options.id);
            }

            if (options.flowType) {
                flowTypeRef.current = Number(options.flowType);
                // 如果是12则是礼品卡流程
                if (flowTypeRef.current == 12) {
                    useGiftCardRef.current = true;
                }
            }

            if (options.stores) {
                storesRef.current = JSON.parse(decodeURIComponent(options.stores));
                deliveryTypeRef.current = 2;
            }

            if (options.deliveryType) {
                formState.deliveryType = Number(options.deliveryType);
            }
            if (options.lotteryRecordId) {
                formState.lotteryRecordId = options.lotteryRecordId;
            }
            if (options.tabDeliveryTypes) {
                tabDeliveryTypesRef.current = String(options.tabDeliveryTypes)
                    .split(",")
                    .map((v: string) => Number(v))
                    .filter((v: number) => Number.isFinite(v));
            }
        }
    }

    // 旧 onLoad 中的全局事件注册（uni.$on → Taro.eventCenter.on）
    useEffect(() => {
        const refreshAddress = async () => {
            await getAddressListData();
            updateOrderCheck();
        };
        const refreshUserPickup = () => {
            getUserPickupListData();
        };
        const refreshStorePickup = async (data: any) => {
            storesRef.current = data;
            updateShippingType();
            rerender();
        };
        Taro.eventCenter.on("refreshAddress", refreshAddress);
        Taro.eventCenter.on("refreshUserPickup", refreshUserPickup);
        Taro.eventCenter.on("refreshStorePickup", refreshStorePickup);

        // #ifdef H5
        if (process.env.TARO_ENV === "h5") {
            window.addEventListener("pageshow", onPageReturn);
            document.addEventListener("visibilitychange", onVisibilityChange);
        }
        // #endif

        // 旧 onBeforeUnmount
        return () => {
            Taro.removeStorageSync("link");
            Taro.eventCenter.off("refreshAddress");
            Taro.eventCenter.off("refreshUserPickup");
            Taro.eventCenter.off("refreshStorePickup");
            stopPolling();
            // #ifdef H5
            if (process.env.TARO_ENV === "h5") {
                window.removeEventListener("pageshow", onPageReturn);
                document.removeEventListener("visibilitychange", onVisibilityChange);
            }
            // #endif
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 监听预约时间选择，选择后清除错误提示（旧 watch(reserveInfo)；重置/选择后手动调用）
    const applyReserveInfoWatch = () => {
        if (Number(reserveInfo.productReservationTimeId) > 0 && (reserveInfo.reservationDate || isCycleBuy())) {
            showReserveErrorRef.current = false;
            rerender();
        }
    };

    // 周期购场景不展示预约选择块，避免遗留错误提示（旧 watch(isCycleBuy)；周期购配置就位后手动调用）
    const applyCycleBuyWatch = () => {
        if (isCycleBuy()) {
            showReserveErrorRef.current = false;
        }
    };

    return (
        <TigLayout title={t("提交订单")}>
            {!isLoading &&
                (isSubCard ? (
                    <AddressInfo data={addressList[0]} />
                ) : !canChangeDelivery() ? (
                    hasPickupDelivery || reserveFlowType() === 9 ? (
                        <PickupUserCard userPickupIfon={userPickupIfon} borderRadius="0 0 18rpx 18rpx" />
                    ) : (
                        ((hasStoreDelivery || reserveFlowType() === 10 || hasLocalDelivery) && <AddressInfo data={addressList[0]} />)
                    )
                ) : (
                    <DeliveryTypeCard
                        deliveryType={deliveryType}
                        onDeliveryTypeChange={(val: number) => {
                            deliveryTypeRef.current = val;
                            rerender();
                        }}
                        hasLocalDelivery={hasLocalDelivery}
                        hasPickupDelivery={hasPickupDelivery}
                        hasStoreDelivery={hasStoreDelivery}
                        getAddressInfo={addressList[0] || {}}
                        userPickupIfon={userPickupIfon}
                        onChange={handleChangeDelivery}
                    />
                ))}

            {paymentTypeList.length > 0 && (
                <PaymentMode
                    payTypeId={formState.payTypeId}
                    onPayTypeIdChange={(val: number) => {
                        formState.payTypeId = val;
                        rerender();
                    }}
                    availablePaymentType={paymentTypeList}
                    deliveryType={deliveryType}
                    canChangeDelivery={canChangeDelivery()}
                    pickupProducts={pickupProducts}
                    cartList={cartListData}
                    shippingType={formState.shippingType}
                    onChange={onPayTypeChange}
                />
            )}

            {/* O2O 需要门店卡中的预约日期/时间段、自提点和自提时间能力。
                旧 <stroeCard class="store-card"> → 外层 View 保留 .store-card 锚点（提交前滚动定位用） */}
            <View className="store-card">
                <StoreCard
                    shippingType={formState.shippingType}
                    onShippingTypeChange={(val: any) => {
                        formState.shippingType = val;
                        rerender();
                    }}
                    cartList={cartListData}
                    shippingTypeList={shippingTypeData}
                    presaleInfo={productPresale}
                    total={totalData}
                    deliveryType={deliveryType}
                    onChange={updateOrderCheck}
                    onChangeProductExtra={changeProductExtra}
                />
            </View>

            <Remark
                value={formState.buyerNote}
                onValueChange={(val: string) => {
                    formState.buyerNote = val;
                    rerender();
                }}
            />

            {showCouponCard() && (
                <CouponInfo
                    onUseCouponIdsChange={(ids: number[]) => {
                        formState.useCouponIds = ids;
                    }}
                    onSelectUserCouponIdsChange={(ids: number[]) => {
                        formState.selectUserCouponIds = ids;
                    }}
                    couponAmount={Number(totalData?.discountCouponAmount) ?? 0}
                    couponList={couponListData}
                    onChange={updateCoupon}
                />
            )}

            {(showPointsCard() || showBalanceCard() || showCreditCard()) && (
                <View className="num-card">
                    {showPointsCard() && (
                        <PointsCard
                            usePoint={formState.usePoint}
                            onUsePointChange={(val: number) => {
                                formState.usePoint = val;
                            }}
                            points={userInfo.points}
                            availablePoints={availablePoints}
                            pointsAmount={Number(totalData?.pointsAmount) ?? 0}
                            onChange={updateOrderCheck}
                        />
                    )}
                    {showBalanceCard() && (
                        <BalanceCard
                            ref={balanceCardRef}
                            balance={userInfo.balance ?? 0}
                            balanceAmount={Number(totalData?.balance) ?? 0}
                            onSendBalanceStatus={getBalanceStatus}
                        />
                    )}
                    {showCreditCard() && <CreditCard ref={creditCardRef} creditPaymentInfo={creditPaymentInfo} onSendCreditStatus={getCreditStatus} />}
                </View>
            )}

            {needOnlinePayment() && formState.payTypeId === ONLINE_PAY_TYPE_ID && onlinePaymentList.length > 0 && (
                <PaymentChannelList
                    value={selectedPaymentType}
                    onValueChange={(code: string) => {
                        selectedPaymentTypeRef.current = code;
                        rerender();
                    }}
                    paymentList={onlinePaymentList}
                    title=""
                />
            )}

            <TotalCard
                total={totalData}
                cartList={cartListData}
                flowType={flowType}
                deliveryType={deliveryType}
                presaleInfo={productPresale}
                cardConfig={cardConfigRef.current}
                isSubCard={isSubCard}
                hasShippingRule={hasStoreShippingRule()}
                onShowShippingFee={handleShowShippingFee}
            />

            {isBeyondDelivery() && <View className="placeholder" />}

            {/* 旧 tig-fixed-placeholder（background #fff）→ 固定底栏，安全区由 .submit-fixed-placeholder 让出 */}
            <View className="submit-fixed-placeholder">
                <View className="submit-btn-box">
                    <View className="submit-btn-price">
                        <View className="price-text">{t(productPresale?.saleMode === 2 ? "定金" : "仍需支付")}:</View>
                        {flowType == 3 && (
                            <View className="points-box">
                                <View className="points-value">
                                    {totalData?.exchangePoints}
                                    <View className="points-text">{t(configIntegralName)} </View>
                                </View>
                                <View className="symbol">+</View>
                            </View>
                        )}

                        <FormatPrice
                            fontStyle={{ fontWeight: "bold", fontSize: "34rpx" }}
                            decimalsStyle={{
                                fontSize: "24rpx",
                                fontWeight: "bold"
                            }}
                            currencyStyle={{
                                fontSize: "23rpx",
                                fontWeight: "bold"
                            }}
                            priceData={productPresale?.saleMode === 2 ? totalData?.actualPayDepositAmount : totalData?.unpaidAmount}
                        />
                    </View>
                    <View>
                        {/* 旧 tig-button（disabled/loading/loading-text）（已收敛到公共组件） */}
                        <TigButton
                            className="btn"
                            disabled={submitDisabled() || submitLoading}
                            loading={submitLoading}
                            loadingText={t("提交中...")}
                            onClick={submit}
                        >
                            {t(submitBtnText())}
                        </TigButton>
                    </View>

                    {isBeyondDelivery() && (
                        <View className="tips">
                            <Text className="iconfont-h5" />
                            <Text>{t("已超出配送范围，请重新选择地址")}</Text>
                        </View>
                    )}
                </View>
            </View>

            <AddressPop show={showAddressPop} onShowChange={setShowAddressPop} onLink={handleLink} />

            <ShippingFeePop
                show={showShippingFee}
                onShowChange={setShowShippingFee}
                feeType={shippingFeeType()}
                storeShippingRule={storeShippingRule}
                cartList={cartListData}
            />
        </TigLayout>
    );
}
