import { useEffect, useRef, useState } from "react";
import { Text, Textarea, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import TigImageUpload, { type ImageUploadItem } from "@/components/tig/tig-image-upload/TigImageUpload";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { aftersalesFeedback } from "@/api/user/afterSale";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./leaveMessage.scss";

interface ReturnPic {
    picName: string;
    picThumb: string;
    picUrl: string;
}

interface LeaveMessageForm {
    logInfo: string;
    returnPic: ReturnPic[];
    id: number | string;
}

/**
 * 售后留言页（自旧 pages/user/afterSale/leaveMessage.vue 移植）
 * - 填写问题描述（最多100字）
 * - 上传凭证图片（最多3张）
 * - 提交后跳转协商记录页
 */
export default function AfterSaleLeaveMessage() {
    usePageGuards();
    const router = useRouter();

    const [form, setForm] = useState<LeaveMessageForm>({
        logInfo: "",
        returnPic: [],
        id: 0
    });
    const formRef = useRef(form);
    formRef.current = form;

    const [fileLists, setFileLists] = useState<ImageUploadItem[]>([]);

    // 旧 onLoad：id 来自路由
    useEffect(() => {
        const id = (router.params || {}).id;
        if (id) {
            setForm((prev) => ({ ...prev, id }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** 旧 uploadFile 成功回调：form.returnPic 只追加，删除图片时不同步移除（保持旧行为） */
    const handleUploaded = (item: ImageUploadItem) => {
        setForm((prev) => ({
            ...prev,
            returnPic: [
                ...prev.returnPic,
                {
                    picName: item.picName || "",
                    picThumb: item.picThumb || "",
                    picUrl: item.picUrl || ""
                }
            ]
        }));
    };

    const handleSubmit = () => {
        if (!formRef.current.logInfo) {
            Taro.showToast({
                title: t("留言不能为空"),
                icon: "none"
            });
            return;
        }
        void __aftersalesFeedback();
    };

    const __aftersalesFeedback = async () => {
        try {
            await aftersalesFeedback(formRef.current);

            Taro.redirectTo({
                url: "/pages/user/afterSale/negotiate",
                success: () => {
                    Taro.eventCenter.trigger("refreshNegotiate", formRef.current.id);
                }
            });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <View>
            <TigLayout title={t("发表留言")}>
                <View className="leave-message">
                    <View className="form-row">
                        <View className="form-row-label">{t("问题描述")}</View>
                        <Textarea
                            className="form-textarea"
                            value={form.logInfo}
                            maxlength={100}
                            autoHeight
                            placeholder={t("为保障你的权益，请尽可能详细的描述，最多200字")}
                            placeholderStyle="font-size: 26rpx;"
                            onInput={(e) => setForm((prev) => ({ ...prev, logInfo: e.detail.value }))}
                        />
                    </View>
                    <View className="form-row">
                        <View className="form-row-label">{t("上传凭证")}</View>
                        <View className="upload-content">
                            <View className="upload-title">{t("最多选择3张图片")}</View>
                            <TigImageUpload
                                limit={3}
                                modelValue={fileLists}
                                onModelValueChange={setFileLists}
                                onUploaded={handleUploaded}
                                trigger="camera"
                            />
                        </View>
                    </View>
                </View>
                <View className="leave-message-btn-fixed">
                    <View className="leave-message-btn">
                        <View className="btn" onClick={handleSubmit}>
                            {t("提交")}
                        </View>
                    </View>
                </View>
                <View className="leave-message-btn-placeholder" />
            </TigLayout>
        </View>
    );
}