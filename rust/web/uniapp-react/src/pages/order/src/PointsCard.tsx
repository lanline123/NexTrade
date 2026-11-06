import { useState } from "react";
import { View, Text, Input } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";
import Taro from "@tarojs/taro";

import { useConfigStore } from "@/store/config";
import { useCurrencyStore } from "@/store/currency";
import { isOverseas, moneyFormat } from "@/utils";
import { t } from "@/utils/i18n";

import "./PointsCard.scss";

interface Props {
    points: number;
    availablePoints: number;
    pointsAmount: number;
    /** v-model:usePoint → usePoint + onUsePointChange */
    usePoint: number;
    onUsePointChange?: (val: number) => void;
    onChange?: () => void;
}

/**
 * 积分抵扣卡片（自旧 pages/order/src/pointsCard.vue 移植）
 * - 展示当前账户积分与本单抵扣金额
 * - 弹层内输入本单使用的积分数量
 * - 旧 uni-forms/uni-easyinput 校验 → Taro Input + 提交时手动校验（规则逐条保留，TODO(MIGRATION) 表单错误改为 toast 展示）
 */
export default function PointsCard({ points, availablePoints, pointsAmount, usePoint, onUsePointChange, onChange }: Props) {
    const configIntegralName = useConfigStore((s) => s.integralName);
    const dollarSign = useConfigStore((s) => s.dollarSign);
    const currentCurrencyData = useCurrencyStore((s) => s.currentCurrencyData);

    // 旧 useCurrency().currency：海外按当前货币符号，缺省回退后台 dollarSign（与 FormatPrice 取值一致）
    const currency = isOverseas() ? currentCurrencyData?.symbol || dollarSign || "￥" : dollarSign || "￥";

    // 跨境积分减免金额：按当前币种汇率换算后展示；国内走裸 pointsAmount 分支，此计算不参与展示
    const displayPointsAmount = (() => {
        let num = String(pointsAmount);
        if (isOverseas() && (currentCurrencyData as any)?.rate) {
            num = moneyFormat((Number(pointsAmount) * Number((currentCurrencyData as any).rate)).toString());
        }
        return num;
    })();

    const [showPoints, setShowPoints] = useState(false);
    const [usePointsInput, setUsePointsInput] = useState<number>(0);

    const handlePoints = () => {
        if (points === 0 && pointsAmount === 0) {
            return Taro.showToast({
                title: `${t("暂无可用")}${configIntegralName}`,
                duration: 1500,
                icon: "none"
            });
        }
        setShowPoints(true);
        setUsePointsInput(usePoint);
    };

    const validate = (): string | null => {
        // 对应旧 uni-forms rules：
        // required → 「请输入{integralName}」；> 可用 → 「{integralName}不能大于可用{integralName}」；< 0 → 「{integralName}不能小于0」
        if (usePointsInput === undefined || usePointsInput === null || `${usePointsInput}` === "") {
            return `${t("请输入")}${configIntegralName}`;
        }
        if (usePointsInput > availablePoints) {
            return `${configIntegralName}${t("不能大于可用")}${configIntegralName}`;
        }
        if (usePointsInput < 0) {
            return `${configIntegralName}${t("不能小于0")}`;
        }
        return null;
    };

    const onSubmit = () => {
        const errorMessage = validate();
        if (errorMessage) {
            console.log("表单错误信息：", errorMessage);
            Taro.showToast({ title: errorMessage, icon: "none" });
            return;
        }
        const nextUsePoints = usePointsInput || 0;
        onUsePointChange?.(Number(nextUsePoints));
        onChange?.();

        setShowPoints(false);
    };

    return (
        // 单根包裹：避免多根时 popup 被拍平进 num-card，多出一次 row-gap
        <View>
            <View className="points" onClick={handlePoints}>
                <View className="points-title">
                    {t(configIntegralName)}
                    <View className="points-text">
                        {`${t("当前账户")}${configIntegralName}`}：<Text className="special-text">{String(points)}</Text>
                    </View>
                </View>
                <View className="points-content">
                    {pointsAmount > 0 ? (
                        <View className="points-text">
                            -{isOverseas() ? currency + displayPointsAmount : currency + pointsAmount}
                        </View>
                    ) : (
                        points === 0 && pointsAmount === 0 && <View className="points-text">{`${t("暂无可用")}${configIntegralName}`}</View>
                    )}
                    <View className="iconfont-h5 icon-fanhui" />
                </View>
            </View>

            <Popup visible={showPoints} onClose={() => setShowPoints(false)} style={{ backgroundColor: "#f5f5f5" } as any}>
                <View className="points-popup">
                    <View className="popup-title">{t(configIntegralName)}</View>
                    <View className="form-usePoints">
                        <View className="form-item">
                            <View className="form-item-label">
                                {t("使用")}
                                {configIntegralName}
                            </View>
                            <Input
                                className="form-item-input"
                                type="number"
                                value={String(usePointsInput)}
                                placeholder={`${t("请输入")}${configIntegralName}`}
                                placeholderClass="form-item-placeholder"
                                onInput={(e) => setUsePointsInput(e.detail.value === "" ? ("" as any) : Number(e.detail.value))}
                            />
                        </View>
                    </View>
                    <View className="points-popup-text">
                        {t("该订单最多可用")} {availablePoints}
                    </View>
                    {/* 旧 tig-fixed-placeholder → 固定底栏（安全区由 --safe-bottom 提供） */}
                    <View className="fixed-placeholder">
                        <View className="btn-box">
                            {/* 旧 tig-button2 theme → 主题色实底按钮（TODO(MIGRATION)：随公共 tig-button 统一替换） */}
                            <View className="theme-btn" style={{ height: "70rpx" }} onClick={onSubmit}>
                                {t("确定")}
                            </View>
                        </View>
                    </View>
                </View>
            </Popup>
        </View>
    );
}
