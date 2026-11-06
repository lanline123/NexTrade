import { useEffect, useState } from "react";
import { Input, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import { getDepositList, updateRechargeOrder } from "@/api/user/account";
import type { DepositFilterState } from "@/types/user/account";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./deposit.scss";

interface Props {
    /** 旧 emit("backDetail") */
    onBackDetail?: () => void;
}

/**
 * 余额充值（自旧 pages/user/account/src/deposit.vue 移植）
 * - 展示预设充值金额选项（含赠送金额）
 * - 支持自定义金额输入
 * - 提交后跳转支付页面
 */
export default function Deposit({ onBackDetail }: Props) {
    usePageGuards();

    const [filterState, setFilterState] = useState<DepositFilterState[]>([]);
    // 旧 inputFocus：仅在 selectCard 内赋值，原逻辑保留
    const [, setInputFocus] = useState(false);
    const [pay, setPay] = useState<any>({
        id: 0,
        amount: 0,
        money: "",
        payType: "recharge"
    });

    const __getDepositList = async () => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            const result: any = await getDepositList();
            const list: DepositFilterState[] = Array.isArray(result) ? [...result] : [...(result?.data || [])];
            // 自定义金额
            const temp: DepositFilterState = {
                rechargeId: 0
            };
            list.push(temp);
            list.forEach((item: any) => {
                item.selected = false;
            });
            setFilterState(list);
        } catch (error: any) {
            console.log(error.message);
        } finally {
            Taro.hideLoading();
        }
    };

    // 旧 onBeforeMount
    useEffect(() => {
        void __getDepositList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectCard = (index: number) => {
        setInputFocus(index === 5);
        setFilterState((prev) => prev.map((item, idx) => ({ ...item, selected: idx === index })));
    };

    const onSubmit = () => {
        const nextPay: any = { ...pay };
        let flag = false;
        filterState.forEach((item: any) => {
            if (item.selected) {
                flag = true;
                nextPay.id = item.rechargeId;
                if (item.rechargeId != 0) {
                    nextPay.amount = null;
                    nextPay.money = item.money;
                } else {
                    nextPay.money = nextPay.amount;
                }
            }
        });
        setPay(nextPay);
        if (!nextPay.money) {
            Taro.showToast({
                title: t("请输入充值金额"),
                icon: "none"
            });
            return;
        }
        if (Number(nextPay.money) <= 0) {
            Taro.showToast({
                title: t("请输入大于0的充值金额"),
                icon: "none"
            });
            return;
        }
        if (flag) {
            void __updateRechargeOrder(nextPay);
        } else {
            Taro.showToast({
                title: t("请选择充值金额"),
                icon: "none"
            });
        }
    };

    const __updateRechargeOrder = async (data: object) => {
        try {
            const result: any = await updateRechargeOrder(data);
            Taro.navigateTo({
                url: `/pages/order/cashier?orderId=${result.orderId}&type=recharge`
            });
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1000
            });
        }
    };

    const backDetail = () => {
        onBackDetail?.();
    };

    return (
        <View>
            <View className="recharge-box">
                {filterState.length > 0 ? (
                    <View className="recharge-wrap">
                        {filterState.map((item, index) => (
                            <View
                                key={index}
                                className={`recharge-item${item.selected ? " selected" : ""}`}
                                onClick={() => selectCard(index)}
                            >
                                {item.rechargeId != 0 ? (
                                    <>
                                        <View className="recharge-amount">
                                            <FormatPrice
                                                base
                                                showText={false}
                                                priceData={item.money}
                                                decimalsStyle={{
                                                    fontSize: "25rpx"
                                                }}
                                                currencyStyle={{
                                                    fontSize: "23rpx"
                                                }}
                                            />
                                        </View>
                                        {Number(item.discountMoney) > 0 ? (
                                            <View className="recharge-give">
                                                {t("赠送")}
                                                <FormatPrice
                                                    base
                                                    showText={false}
                                                    priceData={item.discountMoney}
                                                    isBottom={false}
                                                    fontStyle={{ fontSize: "11px" }}
                                                />
                                            </View>
                                        ) : null}
                                    </>
                                ) : (
                                    <>
                                        <View className="recharge-amount">
                                            {item.selected ? (
                                                <Input
                                                    className="amount-input"
                                                    type="digit"
                                                    value={pay.amount === null || pay.amount === undefined ? "" : String(pay.amount)}
                                                    onInput={(e) => setPay({ ...pay, amount: e.detail.value })}
                                                    placeholderStyle="color:#c0c4cc;font-size:26rpx"
                                                />
                                            ) : (
                                                <View style={{ height: "42rpx" }} />
                                            )}
                                        </View>
                                        <View className="recharge-give">{t("自定义金额")}</View>
                                    </>
                                )}
                            </View>
                        ))}
                    </View>
                ) : null}
            </View>

            {/* 旧 tig-fixed-placeholder（background #fff）→ 固定底栏 + 等高占位 */}
            <View className="btn-fixed-placeholder">
                <View className="btn-box">
                    <TigButton2 className="btn" plain onClick={backDetail}>
                        {t("取消充值")}
                    </TigButton2>
                    <TigButton2 className="btn" theme onClick={onSubmit}>
                        {t("提交申请")}
                    </TigButton2>
                </View>
            </View>
            <View className="btn-placeholder" />
        </View>
    );
}