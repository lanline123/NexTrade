import { useEffect, useRef, useState } from "react";
import { Input, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { aftersalesFeedback } from "@/api/user/afterSale";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./shipments.scss";

interface ShipmentsForm {
    logisticsName: string;
    trackingNo: string;
    id: number | string;
}

/**
 * 售后寄货页（自旧 pages/user/afterSale/shipments.vue 移植）
 * - 展示回寄地址信息
 * - 填写快递公司和快递单号
 * - 提交后跳转售后详情页
 */
export default function AfterSaleShipments() {
    usePageGuards();
    const router = useRouter();

    const [form, setForm] = useState<ShipmentsForm>({
        logisticsName: "",
        trackingNo: "",
        id: 0
    });
    const formRef = useRef(form);
    formRef.current = form;

    const [returnAddress, setReturnAddress] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});

    // 旧 onLoad：id 与回寄地址来自路由参数
    useEffect(() => {
        const options = (router.params || {}) as Record<string, any>;
        if (options.id) {
            formRef.current = { ...formRef.current, id: options.id };
            setForm(formRef.current);
        }
        if (options.returnAddress) {
            setReturnAddress(String(options.returnAddress));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateForm = (patch: Partial<ShipmentsForm>) => {
        formRef.current = { ...formRef.current, ...patch };
        setForm(formRef.current);
    };

    const handleSubmit = () => {
        const nextErrors: Record<string, string> = {};
        if (!formRef.current.logisticsName) nextErrors.logisticsName = t("快递公司不能为空");
        if (!formRef.current.trackingNo) nextErrors.trackingNo = t("快递单号不能为空");
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;
        void __aftersalesFeedback();
    };

    const __aftersalesFeedback = async () => {
        try {
            await aftersalesFeedback(formRef.current);

            Taro.redirectTo({
                url: "/pages/user/afterSale/info",
                success: () => {
                    Taro.eventCenter.trigger("refreshInfo", formRef.current.id);
                }
            });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <View>
            <TigLayout title={t("填写物流")}>
                <View className="returnaddress">
                    <View className="title">{t("回寄信息")}</View>
                    <View className="returnaddress-content">{returnAddress}</View>
                </View>
                <View className="leave-message">
                    <View className="form-row">
                        <View className="form-row-label">{t("快递公司")}</View>
                        <View className="form-row-content">
                            <Input
                                className="form-input"
                                value={form.logisticsName}
                                placeholder={t("请您填写快递公司")}
                                onInput={(e) => updateForm({ logisticsName: e.detail.value })}
                            />
                            {errors.logisticsName && <View className="form-error">{errors.logisticsName}</View>}
                        </View>
                    </View>
                    <View className="form-row">
                        <View className="form-row-label">{t("快递单号")}</View>
                        <View className="form-row-content">
                            <Input
                                className="form-input"
                                value={form.trackingNo}
                                placeholder={t("请您填写快递单号")}
                                onInput={(e) => updateForm({ trackingNo: e.detail.value })}
                            />
                            {errors.trackingNo && <View className="form-error">{errors.trackingNo}</View>}
                        </View>
                    </View>
                </View>
                <View className="leave-message-btn">
                    <View className="btn-box" onClick={handleSubmit}>
                        {t("提交")}
                    </View>
                </View>
            </TigLayout>
        </View>
    );
}