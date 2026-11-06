import { useReducer, useRef, useState } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import type { CouponList } from "@/types/order/check";
import { useConfigStore } from "@/store/config";
import { useCurrencyStore } from "@/store/currency";
import { isOverseas } from "@/utils";
import { t } from "@/utils/i18n";

import "./CouponInfo.scss";

interface Props {
    couponList?: CouponList | any;
    /** v-model:useCouponIds → useCouponIds + onUseCouponIdsChange */
    useCouponIds?: number[];
    onUseCouponIdsChange?: (ids: number[]) => void;
    /** v-model:selectUserCouponIds → selectUserCouponIds + onSelectUserCouponIdsChange */
    selectUserCouponIds?: number[];
    onSelectUserCouponIdsChange?: (ids: number[]) => void;
    couponAmount?: number;
    onChange?: () => void;
}

/**
 * 优惠券选择组件（自旧 pages/order/src/couponInfo.vue 移植）
 * - 显示可用/不可用优惠券列表，支持选择/取消选择
 * - 积分/余额/账期抵扣已拆分为 pointsCard / balanceCard / creditCard
 * - 旧 tig-checkbox（v-model:checked）→ 展示型选中圆点（TODO(MIGRATION)：随公共 tig-checkbox 统一替换）
 */
export default function CouponInfo({
    couponList = { enableCoupons: [], disableCoupons: [] } as any,
    onUseCouponIdsChange,
    onSelectUserCouponIdsChange,
    couponAmount = 0,
    onChange
}: Props) {
    // 旧 ref(couponListData) 为就地可变结构（item.selected 翻转后模板即时刷新），
    // 沿用工程先例：可变 ref + useReducer rerender
    const [, rerender] = useReducer((c: number) => c + 1, 0);

    const dollarSign = useConfigStore((s) => s.dollarSign);
    const currentCurrencyData = useCurrencyStore((s) => s.currentCurrencyData);
    // 旧 useCurrency().currency：海外按当前货币符号，缺省回退后台 dollarSign（与 FormatPrice 取值一致）
    const currency = isOverseas() ? currentCurrencyData?.symbol || dollarSign || "￥" : dollarSign || "￥";

    // 旧 ref(couponListData)：初始为空列表，打开弹层时深拷贝 props.couponList
    const couponListDataRef = useRef<CouponList | any>({ enableCoupons: [], disableCoupons: [] });
    // 旧 watch(couponListData, deep+immediate)：等价时机为「打开弹层拷贝列表后」同步一次已选集合
    const selectedDatasRef = useRef<any[]>([]);

    const [show, setShow] = useState(false);
    const [tabsActive, setTabsActive] = useState("可用优惠券");

    const handleTabsActive = (str: string) => {
        setTabsActive(str);
    };

    const handleCoupon = () => {
        couponListDataRef.current = JSON.parse(JSON.stringify(couponList));
        selectedDatasRef.current = (couponListDataRef.current.enableCoupons || []).filter((item: any) => item.selected);
        setShow(true);
    };

    const handleCheck = (item: any) => {
        item.selected = !item.selected;

        if (item.selected) {
            // 处理选中逻辑
            handleSelectCoupon(item);
        } else {
            // 处理取消选中逻辑
            handleUnselectCoupon(item);
        }
        rerender();
    };

    /**
     * 处理优惠券选中逻辑
     * @param item 选中的优惠券
     */
    const handleSelectCoupon = (item: any) => {
        // 处理同店铺已选中的优惠券
        const sameShopCouponIndex = selectedDatasRef.current.findIndex((data) => data.shopId === item.shopId);
        if (sameShopCouponIndex > -1) {
            // 移除同店铺已选优惠券
            removeSelectedCouponsByShopId(item.shopId);
            // 取消同店铺其他优惠券的选中状态
            updateCouponSelectionByShopId(item.shopId, item.userCouponId, false);
        }
        // 处理不同店铺但同种优惠券
        else {
            // 旧代码同名变量复用（按 id 再查一次），此处保持行为一致
            const sameIdCouponIndex = selectedDatasRef.current.findIndex((data) => data.id === item.id);
            if (sameIdCouponIndex > -1) {
                // 移除同种优惠券
                removeSelectedCouponsById(item.id);
                // 取消同种优惠券的选中状态
                updateCouponSelectionById(item.id, item.userCouponId, false);
            } else {
                // 将当前优惠券添加到选中数组
                selectedDatasRef.current.push(item);
            }
            // 旧版此处存在重复 push 的历史行为（同一条券会被加入两次），逐行保留
            selectedDatasRef.current.push(item);
        }
    };

    /**
     * 处理优惠券取消选中逻辑
     * @param item 取消选中的优惠券
     */
    const handleUnselectCoupon = (item: any) => {
        // 从选中数组中移除当前优惠券
        selectedDatasRef.current = selectedDatasRef.current.filter(({ id }) => id !== item.id);
    };

    /**
     * 根据店铺ID移除已选优惠券
     * @param shopId 店铺ID
     */
    const removeSelectedCouponsByShopId = (shopId: any) => {
        selectedDatasRef.current = selectedDatasRef.current.filter((data) => data.shopId !== shopId);
    };

    /**
     * 根据优惠券ID移除已选优惠券
     * @param couponId 优惠券ID
     */
    const removeSelectedCouponsById = (couponId: any) => {
        selectedDatasRef.current = selectedDatasRef.current.filter((data) => data.id !== couponId);
    };

    /**
     * 更新同店铺优惠券的选中状态
     * @param shopId 店铺ID
     * @param excludeUserCouponId 排除的用户优惠券ID
     * @param selected 选中状态
     */
    const updateCouponSelectionByShopId = (shopId: any, excludeUserCouponId: any, selected: boolean) => {
        (couponListDataRef.current.enableCoupons || []).forEach((data: any) => {
            if (data.shopId === shopId && data.userCouponId !== excludeUserCouponId) {
                data.selected = selected;
            }
        });
    };

    /**
     * 更新同种优惠券的选中状态
     * @param couponId 优惠券ID
     * @param excludeUserCouponId 排除的用户优惠券ID
     * @param selected 选中状态
     */
    const updateCouponSelectionById = (couponId: any, excludeUserCouponId: any, selected: boolean) => {
        (couponListDataRef.current.enableCoupons || []).forEach((data: any) => {
            if (data.id === couponId && data.userCouponId !== excludeUserCouponId) {
                data.selected = selected;
            }
        });
    };

    const handlecConfirm = () => {
        let selectedIds: any = [],
            selectedUserCouponIds: any = [];
        if (selectedDatasRef.current.length > 0) {
            selectedIds = selectedDatasRef.current.map(({ id }) => id);
            selectedUserCouponIds = selectedDatasRef.current.map(({ userCouponId }) => userCouponId);
        }
        onUseCouponIdsChange?.(selectedIds);
        onSelectUserCouponIdsChange?.(selectedUserCouponIds);
        onChange?.();
        setShow(false);
    };

    const enableCoupons = couponListDataRef.current?.enableCoupons || [];
    const disableCoupons = couponListDataRef.current?.disableCoupons || [];

    return (
        <>
            <View className="coupon-info">
                <View className="coupon" onClick={handleCoupon}>
                    <View className="coupon-title">{t("优惠券")}</View>
                    <View className="coupon-content">
                        {couponAmount > 0 ? (
                            isOverseas() ? (
                                <View className="coupon-text">
                                    -
                                    <FormatPrice
                                        isBottom={false}
                                        fontStyle={{ fontSize: "24.5rpx" }}
                                        currencyStyle={{ fontSize: "24.5rpx" }}
                                        decimalsStyle={{ fontSize: "24.5rpx" }}
                                        priceData={couponAmount}
                                    />
                                </View>
                            ) : (
                                <View className="coupon-text">-{currency + couponAmount}</View>
                            )
                        ) : null}
                        <View className="iconfont-h5 icon-fanhui" />
                    </View>
                </View>
            </View>

            <Popup visible={show} onClose={() => setShow(false)} style={{ backgroundColor: "#fff" } as any}>
                <ScrollView scrollY className="coupon-container">
                    <View className="popup-title">{t("优惠券")}</View>
                    <View className="coupon-menu">
                        <View className={`coupon-menu-item ${tabsActive === "可用优惠券" ? "active" : ""}`} onClick={() => handleTabsActive("可用优惠券")}>
                            {t("可用优惠券")}({enableCoupons.length})
                        </View>
                        <View
                            className={`coupon-menu-item ${tabsActive === "不可用优惠券" ? "active" : ""}`}
                            onClick={() => handleTabsActive("不可用优惠券")}
                        >
                            {t("不可用优惠券")}({disableCoupons.length})
                        </View>
                    </View>

                    <View className="coupon-container-content">
                        {tabsActive === "可用优惠券" && (
                            <View className="coupon-box">
                                {enableCoupons.map((item: any, idx: number) => (
                                    <View key={idx} className="coupon-item" onClick={() => handleCheck(item)}>
                                        <View className="coupon-click-area" />
                                        <View className="left">
                                            <View className="col-1">
                                                <View className="title">{item.couponName}</View>
                                            </View>
                                            {item.couponDesc && <View className="col-2">{item.couponDesc}</View>}
                                            <View className={`col-3 ${!item.couponDesc ? "special-col" : ""}`}>
                                                {" "}
                                                {t("有效期：")}
                                                {item.endDate}{" "}
                                            </View>
                                        </View>
                                        <View className="right">
                                            <View className="right-1">
                                                {item.couponType === 2 ? (
                                                    <>
                                                        <View className="zhekou"> {item.couponDiscount}</View>
                                                        <View className="zhe">{t("折")}</View>
                                                    </>
                                                ) : (
                                                    <FormatPrice
                                                        fontStyle={{ fontSize: "48rpx", lineHeight: "1" }}
                                                        currencyStyle={{ alignSelf: "flex-end", fontSize: "24rpx" }}
                                                        priceData={item.couponMoney}
                                                    />
                                                )}
                                            </View>
                                            <View className="right-2">
                                                <View className={`tig-check ${item.selected ? "tig-check--checked" : ""}`}>
                                                    {item.selected && <Text className="tig-check-icon">✓</Text>}
                                                </View>
                                            </View>
                                        </View>
                                        <View className="dotted-line" />
                                    </View>
                                ))}
                                {enableCoupons.length === 0 && <View className="coupon-empty">{t("暂无优惠券")}</View>}
                            </View>
                        )}
                        {tabsActive === "不可用优惠券" && (
                            <View className="coupon-box">
                                {disableCoupons.map((item: any, idx: number) => (
                                    <View key={idx} className="coupon-item grayScaleDiv">
                                        <View className="left">
                                            <View className="col-1">
                                                <View className="title">{item.couponName}</View>
                                            </View>
                                            {item.disableReason && <View className="col-2">{item.disableReason}</View>}
                                            <View className={`col-3 ${!item.couponDesc ? "special-col" : ""}`}>
                                                {" "}
                                                {t("有效期：")}
                                                {item.endDate}{" "}
                                            </View>
                                        </View>
                                        <View className="right">
                                            <View className="right-1">
                                                {item.couponType === 2 ? (
                                                    <>
                                                        <View className="zhekou"> {item.couponDiscount}</View>
                                                        <View className="zhe">{t("折")}</View>
                                                    </>
                                                ) : (
                                                    <FormatPrice
                                                        fontStyle={{ fontSize: "48rpx", lineHeight: "1" }}
                                                        currencyStyle={{ alignSelf: "flex-end", fontSize: "24rpx" }}
                                                        priceData={item.couponMoney}
                                                    />
                                                )}
                                            </View>
                                            <View className="right-2">
                                                <View className="tig-check tig-check--disabled">{item.selected && <Text className="tig-check-icon">✓</Text>}</View>
                                            </View>
                                        </View>
                                        <View className="dotted-line" />
                                    </View>
                                ))}
                                {disableCoupons.length === 0 && <View className="coupon-empty">{t("暂无优惠券")}</View>}
                            </View>
                        )}
                    </View>
                    {/* 旧 tig-fixed-placeholder → 固定底栏（安全区由 --safe-bottom 提供） */}
                    <View className="fixed-placeholder">
                        <View className="btn-box">
                            {/* 旧 tig-button2 theme → 主题色实底按钮（TODO(MIGRATION)：随公共 tig-button 统一替换） */}
                            <View className="theme-btn" style={{ height: "70rpx" }} onClick={handlecConfirm}>
                                {t("确定")}
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </Popup>
        </>
    );
}
