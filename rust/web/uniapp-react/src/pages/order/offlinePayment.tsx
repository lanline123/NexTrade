import { useEffect, useMemo, useState } from "react";
import { Input, PickerView, PickerViewColumn, Text, View } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";
import Taro, { useRouter } from "@tarojs/taro";
import dayjs from "dayjs";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigNavbar from "@/components/tig/tig-navbar/TigNavbar";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import FormatPrice from "@/components/format-price/FormatPrice";
import MediaUpload, { type MediaItem } from "@/pages/buyerShow/src/MediaUpload";
import { orderPayInfo } from "@/api/order/pay";
import { getOfflinePaymentClaimDetail, getOrder, submitOfflinePaymentClaim } from "@/api/user/order";
import { imageFormat } from "@/utils/format";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./offlinePayment.scss";

/**
 * 线下转账认款（自旧 pages/order/offlinePayment.vue 逐行移植）
 * - edit：填写转账时间、付款人、流水号并上传凭证后提交
 * - detail：只读展示已提交的认款信息及审核状态
 */

/** 转账时间精确到分钟，展示与提交保持同一格式 */
const TRANSFER_TIME_FORMAT = "YYYY-MM-DD HH:mm";
/** 将「yyyy-mm-dd hh:MM」转为秒级时间戳；使用 / 分隔兼容 iOS 解析 */
const parseTransferTime = (value: string) => {
    if (!value) return undefined;
    const time = new Date(`${value.replace(/-/g, "/")}:00`).getTime();
    return Number.isNaN(time) ? undefined : Math.floor(time / 1000);
};

const MIN_YEAR = 2000;

interface TransferPickerProps {
    visible: boolean;
    value: number;
    onCancel: () => void;
    onConfirm: (value: number) => void;
}

/**
 * 旧 up-datetime-picker（mode=datetime）→ NutUI Popup + Taro PickerView 自绘
 * 五列：年 / 月 / 日 / 时 / 分；最大可选到当前时间
 */
function TransferTimePicker({ visible, value, onCancel, onConfirm }: TransferPickerProps) {
    const now = new Date();
    const years = useMemo(() => Array.from({ length: now.getFullYear() - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i), [now]);
    const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
    const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
    const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

    const [indices, setIndices] = useState<number[]>([]);

    // 弹窗打开时按当前值初始化；未选择时默认当前时间
    useEffect(() => {
        if (!visible) return;
        const date = new Date(value || Date.now());
        setIndices([
            Math.max(date.getFullYear() - MIN_YEAR, 0),
            date.getMonth(),
            date.getDate() - 1,
            date.getHours(),
            date.getMinutes()
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, value]);

    const selectedYear = MIN_YEAR + (indices[0] ?? 0);
    const selectedMonth = (indices[1] ?? 0) + 1;
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

    // 月份切换后日期超出当月天数时收敛到当月最后一天
    const safeIndices = [...indices];
    if ((safeIndices[2] ?? 0) > daysInMonth - 1) safeIndices[2] = daysInMonth - 1;

    const handleChange = (event: any) => {
        const next = [...(event.detail.value as number[])];
        setIndices(next);
    };

    const handleConfirm = () => {
        const year = MIN_YEAR + safeIndices[0];
        const month = safeIndices[1];
        const day = safeIndices[2];
        const hour = safeIndices[3] ?? 0;
        const minute = safeIndices[4] ?? 0;
        const picked = new Date(year, month, day, hour, minute).getTime();
        onConfirm(Math.min(picked, Date.now()));
    };

    return (
        <Popup visible={visible} position="bottom" zIndex={999} onClose={onCancel} style={{ backgroundColor: "#fff" } as any}>
            <View className="transfer-picker">
                <View className="transfer-picker__actions">
                    <Text className="transfer-picker__btn" onClick={onCancel}>
                        {t("取消")}
                    </Text>
                    <Text className="transfer-picker__btn transfer-picker__btn--confirm" onClick={handleConfirm}>
                        {t("确定")}
                    </Text>
                </View>
                <PickerView className="transfer-picker__view" indicatorStyle="height: 88rpx;" value={safeIndices} onChange={handleChange}>
                    <PickerViewColumn>
                        {years.map((year) => (
                            <View key={year} className="transfer-picker__item">
                                {year}
                            </View>
                        ))}
                    </PickerViewColumn>
                    <PickerViewColumn>
                        {months.map((month) => (
                            <View key={month} className="transfer-picker__item">
                                {month}
                            </View>
                        ))}
                    </PickerViewColumn>
                    <PickerViewColumn>
                        {days.map((day) => (
                            <View key={day} className="transfer-picker__item">
                                {day}
                            </View>
                        ))}
                    </PickerViewColumn>
                    <PickerViewColumn>
                        {hours.map((hour) => (
                            <View key={hour} className="transfer-picker__item">
                                {hour < 10 ? `0${hour}` : hour}
                            </View>
                        ))}
                    </PickerViewColumn>
                    <PickerViewColumn>
                        {minutes.map((minute) => (
                            <View key={minute} className="transfer-picker__item">
                                {minute < 10 ? `0${minute}` : minute}
                            </View>
                        ))}
                    </PickerViewColumn>
                </PickerView>
            </View>
        </Popup>
    );
}

export default function OfflinePayment() {
    const router = useRouter();
    const orderId = Number(router.params?.orderId || 0);
    const mode: "edit" | "detail" = router.params?.mode === "detail" ? "detail" : "edit";

    const [showDatetime, setShowDatetime] = useState(false);
    const [amount, setAmount] = useState("");
    const [voucherList, setVoucherList] = useState<MediaItem[]>([]);
    const [form, setForm] = useState({ transferTime: "", payerName: "", bankSerialNo: "" });
    const [submitting, setSubmitting] = useState(false);
    const [claimStatus, setClaimStatus] = useState<number | null>(null);
    const [auditRemark, setAuditRemark] = useState("");
    const [rejectReason, setRejectReason] = useState("");
    const [voucherUrlsForView, setVoucherUrlsForView] = useState<string[]>([]);

    useEffect(() => {
        if (!orderId) return;
        const load = async () => {
            try {
                const result = await orderPayInfo(orderId);
                setAmount(String(result?.order?.unpaidAmount || ""));
            } catch {
                setAmount("");
            }
            try {
                const claim: any = await getOfflinePaymentClaimDetail(orderId);
                if (!claim) return;
                if (claim.claimedAmount !== undefined && claim.claimedAmount !== null) setAmount(String(claim.claimedAmount));
                setClaimStatus(Number(claim.status));
                setAuditRemark(String(claim.auditRemark || "").trim());
                setRejectReason(String(claim.rejectReason || "").trim());
                setForm({
                    transferTime: claim.transferTime ? dayjs(Number(claim.transferTime) * 1000).format(TRANSFER_TIME_FORMAT) : "",
                    payerName: claim.payerName || "",
                    bankSerialNo: claim.bankSerialNo || ""
                });
                const urls = (claim.voucherUrls || []) as string[];
                setVoucherUrlsForView(urls.map((url) => imageFormat(url)));
                if (mode !== "detail") {
                    setVoucherList(urls.map((url) => ({ type: "image", url: imageFormat(url), picUrl: url }) as MediaItem));
                }
            } catch {
                // 认款详情读取失败时保持空白表单，不阻断后续填写
            }
        };
        void load();
        // 仅在挂载时按 orderId 拉取一次（对应旧 onLoad）
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId]);

    /** 选择器回显已选时间，未选择时默认当前时间 */
    const transferPickerValue = (parseTransferTime(form.transferTime) ?? Math.floor(Date.now() / 1000)) * 1000;

    const handleTransferTime = (value: number) => {
        setForm((prev) => ({ ...prev, transferTime: dayjs(value).format(TRANSFER_TIME_FORMAT) }));
        setShowDatetime(false);
    };

    const redirectToOrderDetail = async () => {
        let url = `/pages/user/order/info?id=${orderId}`;
        try {
            const order: any = await getOrder({ id: orderId });
            const firstItem = order?.items?.[0];
            if (firstItem?.productType === 8) {
                url = `/pages/giftCard/order/info?id=${orderId}`;
            } else if (order?.cycleCardInfo?.cardId && !order?.cyclePlan) {
                url = `/pages/store/order/info?id=${orderId}`;
            } else if (order?.orderType === 9 || order?.orderType === 10 || (order?.orderType === 2 && order?.isPickup && !order?.pickupDetail)) {
                url = `/pages/store/order/reserveInfo?id=${orderId}`;
            } else if (order?.isPickup && !order?.cyclePlan) {
                url = `/pages/store/order/info?id=${orderId}`;
            }
        } catch {
            // 查询详情失败时回退到普通订单详情，避免提交成功后停留在认款页。
        }
        Taro.redirectTo({ url });
    };

    const handleSubmit = () => {
        if (submitting) return;
        const voucherUrls = voucherList.filter((item) => !item.uploading && item.picUrl).map((item) => item.picUrl as string);
        if (!voucherUrls.length || voucherUrls.length !== voucherList.length) {
            Taro.showToast({ title: t("付款凭证必传"), icon: "none" });
            return;
        }
        setSubmitting(true);
        const transferTime = parseTransferTime(form.transferTime);
        submitOfflinePaymentClaim({
            orderId,
            transferTime,
            payerName: form.payerName.trim() || undefined,
            bankSerialNo: form.bankSerialNo.trim() || undefined,
            voucherUrls
        })
            .then(() => {
                Taro.showToast({ title: t("提交成功，等待财务审核"), icon: "none", duration: 1500 });
                /* 提示展示完再跳转，等待期间保持提交锁防止重复提交 */
                setTimeout(() => redirectToOrderDetail(), 1000);
            })
            .catch((error: any) => {
                setSubmitting(false);
                Taro.showToast({ title: error?.message || t("提交失败，请稍后重试"), icon: "none" });
            });
    };

    return (
        <TigLayout>
            <TigNavbar title={mode === "detail" ? t("认款详情") : t("支付完成")} />
            <View className="offline-payment-page">
                {mode === "detail" && claimStatus === 0 && (
                    <View className="claim-tip">
                        <TigImage className="claim-tip-icon" src={staticResource("order/bell.svg")} mode="aspectFit" />
                        <Text className="claim-tip-text">{t("您已提交汇款凭证，等待财务人员核对流水，我们尽快完成审核")}</Text>
                    </View>
                )}
                {mode === "detail" && claimStatus === 1 && auditRemark && (
                    <View className="claim-tip claim-tip--audit">
                        <Text className="claim-tip-text">
                            {t("审核备注")}：{auditRemark}
                        </Text>
                    </View>
                )}
                {mode === "detail" && claimStatus === 2 && (
                    <View className="claim-tip claim-tip--reject">
                        <Text className="claim-tip-text">
                            {t("认款审核未通过")}
                            {rejectReason ? `：${rejectReason}` : ""}
                        </Text>
                    </View>
                )}
                <View className="form-card">
                    <View className="form-line">
                        <Text>{t("付款金额")}</Text>
                        <View className="value">
                            <FormatPrice showText={false} isBottom={false} priceData={amount} />
                        </View>
                    </View>
                    <View className="form-line" onClick={() => mode !== "detail" && setShowDatetime(true)}>
                        <Text>{t("转账时间")}</Text>
                        <Text className={`placeholder${form.transferTime || mode === "detail" ? " selected" : ""}`}>
                            {form.transferTime || (mode === "detail" ? "--" : t("请选择"))}
                            {mode !== "detail" && <Text className="arrow">?</Text>}
                        </Text>
                    </View>
                    <View className="form-line">
                        <Text>{t("付款人姓名")}</Text>
                        {mode !== "detail" ? (
                            <Input
                                className="line-input"
                                placeholder={t("请输入")}
                                value={form.payerName}
                                onInput={(e) => setForm((prev) => ({ ...prev, payerName: e.detail.value }))}
                            />
                        ) : (
                            <Text className="line-value">{form.payerName || "--"}</Text>
                        )}
                    </View>
                    <View className="form-line">
                        <Text>{t("转账流水号")}</Text>
                        {mode !== "detail" ? (
                            <Input
                                className="line-input"
                                placeholder={t("请填写")}
                                value={form.bankSerialNo}
                                onInput={(e) => setForm((prev) => ({ ...prev, bankSerialNo: e.detail.value }))}
                            />
                        ) : (
                            <Text className="line-value">{form.bankSerialNo || "--"}</Text>
                        )}
                    </View>
                    <View className="voucher-section">
                        <View className="voucher-label">
                            {mode !== "detail" && <Text className="required">*</Text>}
                            {t("付款凭证")}
                        </View>
                        {mode !== "detail" ? (
                            <MediaUpload
                                mediaList={voucherList}
                                onMediaListChange={setVoucherList}
                                maxCount={5}
                                maxVideoCount={0}
                                mediaType="image"
                                uploadTip={`${t("上传凭证图片")}\n${t("最多上传{0}张", { 0: 5 })}`}
                                imageMode="aspectFit"
                            />
                        ) : (
                            <View className="claim-voucher-list">
                                {voucherUrlsForView.map((url, index) => (
                                    <View key={`${url}-${index}`} className="claim-voucher-item">
                                        <TigImage src={url} preview mode="aspectFit" />
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                </View>
                <View className="bottom-space" />
            </View>
            {mode !== "detail" && (
                <FixedPlaceholder backgroundColor="#f4f5f7">
                    <View className="submit-footer">
                        <TigButton2 className="submit-button" loading={submitting} disabled={submitting} onClick={handleSubmit}>
                            {t("提交信息")}
                        </TigButton2>
                    </View>
                </FixedPlaceholder>
            )}
            {/* 旧 up-datetime-picker → NutUI Popup + PickerView（见组件内说明） */}
            <TransferTimePicker
                visible={showDatetime}
                value={transferPickerValue}
                onCancel={() => setShowDatetime(false)}
                onConfirm={handleTransferTime}
            />
        </TigLayout>
    );
}