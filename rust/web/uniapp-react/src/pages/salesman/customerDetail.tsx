import { useEffect, useState } from "react";
import { Text, Textarea, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getCustomerDetail, updateCustomerRemark } from "@/api/salesman/salesmanCenter";
import { useSafeAreaInsets } from "@/hooks";
import { useConfigStore } from "@/store/config";
import type { CustomerDetail } from "@/types/salesman/customer";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import { ensureViewCustomerInfo } from "./src/salesmanPrivacy";

import "./customerDetail.scss";

/**
 * 客户信息页（自旧 pages/salesman/customerDetail.vue 逐行移植）
 * - 展示客户头像/备注/成交统计
 * - 支持编辑备注
 * - 展示客户绑定渠道与绑定时间
 */
export default function CustomerDetailPage() {
    usePageGuards();

    const router = useRouter();
    const { safeBottom } = useSafeAreaInsets();
    const defaultAvatar = useConfigStore((s) => s.defaultAvatar);

    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState<CustomerDetail>({ userId: 0 });
    const [showAmountTipPopup, setShowAmountTipPopup] = useState(false);
    const [showRemarkEditor, setShowRemarkEditor] = useState(false);
    const [remarkDraft, setRemarkDraft] = useState("");

    const showAmountTip = () => setShowAmountTipPopup(true);
    const money = (value?: number) => Number(value || 0).toFixed(2);
    const formatMinute = (value?: string | null) => (value ? value.replace(/:\d{2}(?=\s*$)/, "") : "");

    const openRemarkEditor = () => {
        setRemarkDraft(detail.remark || "");
        setShowRemarkEditor(true);
    };

    const saveRemark = async () => {
        const remark = remarkDraft.trim();
        try {
            await updateCustomerRemark({ userId: detail.userId, remark });
            setDetail((prev) => ({ ...prev, remark }));
            setShowRemarkEditor(false);
        } catch {
            Taro.showToast({ title: t("保存失败"), icon: "none" });
        }
    };

    // 旧 onLoad(async (options) => ...)
    useEffect(() => {
        let active = true;
        const init = async () => {
            const allowed = await ensureViewCustomerInfo();
            if (!allowed) {
                setLoading(false);
                return;
            }
            const userId = Number(router.params?.userId);
            if (!userId) {
                Taro.showToast({ title: t("客户不存在"), icon: "none" });
                setLoading(false);
                return;
            }
            try {
                const result = await getCustomerDetail(userId);
                if (active) setDetail(result);
            } catch {
                Taro.showToast({ title: t("加载失败"), icon: "none" });
            } finally {
                if (active) setLoading(false);
            }
        };
        void init();
        return () => {
            active = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <TigLayout title={t("客户信息")} needSafeBottom={false}>
            <View className="detail-page">
                {loading ? (
                    <View className="loading">{t("加载中")}</View>
                ) : (
                    <>
                        <View className="card profile">
                            <View className="avatar">
                                <TigImage src={imageFormat(detail.avatar || defaultAvatar)} />
                            </View>
                            <View className="profile-info">
                                <View className="name">{detail.nickname || "-"}</View>
                            </View>
                            <View className="remark-entry" onClick={openRemarkEditor}>
                                <Text>{detail.remark || t("备注")}</Text>
                                <Text className="edit-icon">✎</Text>
                            </View>
                        </View>
                        <Popup
                            visible={showRemarkEditor}
                            position="bottom"
                            zIndex={999}
                            closeable={false}
                            style={{ backgroundColor: "#fff", borderRadius: "20rpx 20rpx 0 0" }}
                            onClose={() => setShowRemarkEditor(false)}
                        >
                            <View className="remark-editor" style={{ paddingBottom: `${safeBottom + 20}px` }}>
                                <View className="remark-editor-header">
                                    <View className="remark-editor-title">{t("备注")}</View>
                                    <View className="remark-close" onClick={() => setShowRemarkEditor(false)}>
                                        <Text className="close-icon">×</Text>
                                    </View>
                                </View>
                                <Textarea
                                    className="remark-textarea"
                                    value={remarkDraft}
                                    placeholder={t("请输入备注")}
                                    maxlength={255}
                                    onInput={(e) => setRemarkDraft(e.detail.value)}
                                />
                                <View className="remark-count">{remarkDraft.length}/255</View>
                                <View className="remark-actions">
                                    <TigButton2 theme onClick={saveRemark}>
                                        {t("确定")}
                                    </TigButton2>
                                </View>
                            </View>
                        </Popup>
                        <View className="card statistics">
                            <View className="stat">
                                <Text>{detail.orderCount || 0}</Text>
                                <View>{t("订单数量")}</View>
                            </View>
                            <View className="stat">
                                <Text>{money(detail.orderAmount)}</Text>
                                <View className="stat-label">
                                    {t("成交金额（元）")}
                                    <Text className="question-icon" onClick={showAmountTip}>
                                        ?
                                    </Text>
                                </View>
                            </View>
                            <View className="stat">
                                <Text>{money(detail.averageOrderAmount)}</Text>
                                <View>{t("客单价（元）")}</View>
                            </View>
                            <View className="stat">
                                <Text>{formatMinute(detail.lastOrderTime) || "-"}</Text>
                                <View>{t("最后成交时间")}</View>
                            </View>
                        </View>
                        <Popup
                            visible={showAmountTipPopup}
                            position="center"
                            zIndex={999}
                            closeable={false}
                            style={{ backgroundColor: "#fff", borderRadius: "24rpx" }}
                            onClose={() => setShowAmountTipPopup(false)}
                        >
                            <View className="amount-tip-popup">
                                <View className="amount-tip-title">{t("成交金额说明")}</View>
                                <View className="amount-tip-content">{t("选定时间内，商城该客户所有订单的实际成交金额，并剔除退款金额")}</View>
                                <TigButton2 className="amount-tip-button" theme onClick={() => setShowAmountTipPopup(false)}>
                                    {t("知道了")}
                                </TigButton2>
                            </View>
                        </Popup>
                        <View className="card relation">
                            <View className="relation-title">{t("客户关系")}</View>
                            <View className="relation-row">
                                <Text>{t("客户绑定渠道")}</Text>
                                <Text>{detail.channel || "-"}</Text>
                            </View>
                            <View className="relation-row">
                                <Text>{t("绑定时间")}</Text>
                                <Text>{formatMinute(detail.bindTime) || "-"}</Text>
                            </View>
                        </View>
                    </>
                )}
            </View>
        </TigLayout>
    );
}