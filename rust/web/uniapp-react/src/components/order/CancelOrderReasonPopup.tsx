import { forwardRef, useImperativeHandle, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import { cancelOrder, getOrderReasonConfig } from "@/api/user/order";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import { buildCancelOrderPayload, keepValidSelection } from "@/utils/orderReason";
import { t } from "@/utils/i18n";

import "./CancelOrderReasonPopup.scss";

export interface CancelOrderReasonPopupRef {
    /** 打开弹层（对应旧 defineExpose open） */
    open: (id: number) => void;
}

interface Props {
    /** 取消成功后回调（对应旧 @success） */
    onSuccess?: () => void;
}

/**
 * 取消订单原因弹层（自旧 components/order/CancelOrderReasonPopup.vue 移植）
 * - 后台关闭取消原因开关时直接走 showModal 二次确认
 * - 旧 tig-popup → NutUI Popup；旧 radio-group/radio → 基础组件自绘单选
 */
const CancelOrderReasonPopup = forwardRef<CancelOrderReasonPopupRef, Props>(function CancelOrderReasonPopup({ onSuccess }, ref) {
    const [show, setShow] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [orderId, setOrderId] = useState(0);
    const [reasons, setReasons] = useState<string[]>([]);
    const [selectedReason, setSelectedReason] = useState("");

    const showError = (error: any) => {
        Taro.showToast({ title: error?.message || t("操作失败"), icon: "none" });
    };

    const loadConfig = async () => {
        const result = await getOrderReasonConfig();
        const nextReasons = Array.isArray(result.cancelOrderReasonList) ? result.cancelOrderReasonList : [];
        setReasons(nextReasons);
        setSelectedReason((current) => keepValidSelection(current, nextReasons));
        return {
            enabled: Number(result.afterSalesReasonEnabled) === 1,
            reasons: nextReasons
        };
    };

    const cancelWithoutReason = (id: number) => {
        Taro.showModal({
            title: t("提示"),
            content: t("确认要取消该订单吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: async (res) => {
                if (!res.confirm) return;
                try {
                    await cancelOrder(buildCancelOrderPayload(id));
                    Taro.showToast({ title: t("取消成功"), icon: "none" });
                    onSuccess?.();
                } catch (error: any) {
                    showError(error);
                }
            }
        });
    };

    const open = async (id: number) => {
        setOrderId(id);
        setSelectedReason("");
        try {
            const { enabled, reasons: nextReasons } = await loadConfig();
            if (enabled) {
                // 默认勾选第一个原因
                setSelectedReason(nextReasons[0] || "");
                setShow(true);
            } else cancelWithoutReason(id);
        } catch (error: any) {
            showError(error);
        }
    };

    useImperativeHandle(ref, () => ({ open }));

    const submitWithReason = async () => {
        if (!selectedReason || submitting) return;
        setSubmitting(true);
        try {
            await cancelOrder(buildCancelOrderPayload(orderId, selectedReason));
            Taro.showToast({ title: t("取消成功"), icon: "none" });
            setShow(false);
            onSuccess?.();
        } catch (error: any) {
            showError(error);
            try {
                if (!(await loadConfig()).enabled) setShow(false);
            } catch {
                // 配置刷新失败时保留弹层，由买家决定重试或关闭。
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Popup
            visible={show}
            position="bottom"
            round
            closeable={false}
            onClose={() => {
                if (!submitting) setShow(false);
            }}
            style={{ backgroundColor: "#fff", borderRadius: "20rpx 20rpx 0 0" }}
        >
            <View className="cancel-reason-popup">
                <View className="popup-title">{t("请选择取消订单原因")}</View>
                <View className="reason-list">
                    {reasons.map((reason) => (
                        <View className="reason-item" key={reason} onClick={() => setSelectedReason(reason)}>
                            <Text>{reason}</Text>
                            <View className={`radio${selectedReason === reason ? " radio--checked" : ""}`}>
                                {selectedReason === reason && <View className="radio-dot" />}
                            </View>
                        </View>
                    ))}
                </View>
                <View className="popup-actions">
                    <TigButton2 className="action-button secondary" disabled={submitting} onClick={() => setShow(false)}>
                        {t("取消")}
                    </TigButton2>
                    <TigButton2
                        className="action-button primary"
                        disabled={!selectedReason || submitting}
                        onClick={submitWithReason}
                    >
                        {t("确定")}
                    </TigButton2>
                </View>
            </View>
        </Popup>
    );
});

export default CancelOrderReasonPopup;