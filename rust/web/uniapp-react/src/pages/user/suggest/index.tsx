import { useState } from "react";
import { Text, Textarea, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import Upload from "@/components/upload/Upload";
import { addConsultation } from "@/api/product/product";
import { useI18nStore } from "@/store/i18n";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./index.scss";

/**
 * 意见建议页（自旧 pages/user/suggest/index.vue 逐行移植）
 * - 用户填写反馈内容（最多 200 字）
 * - 支持上传图片（最多 3 张）
 * - 提交后清空表单
 */
export default function Suggest() {
    usePageGuards();

    // 订阅语言，切换语言时重算 t() 文案
    const langCode = useI18nStore((s) => s.langCode);
    void langCode;

    const [message, setMessage] = useState("");
    const [feedbackPics, setFeedbackPics] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const submit = async () => {
        if (message == "") {
            Taro.showToast({
                title: t("请填写您的意见")
            });
        }
        setIsLoading(true);
        try {
            await addConsultation({
                type: 0, // 0 留言类型使用
                content: message,
                feedbackPics: feedbackPics?.map((item) => item?.picUrl)
            } as any);
            setMessage("");
            setFeedbackPics([]);
            setIsLoading(false);
            Taro.showToast({
                title: t("已收到您的反馈")
            });
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <TigLayout title={t("意见建议")} borderBottom>
            <View className="container">
                <View className="title"> {t("意见建议")}</View>
                <View className="content" data-form-rev="ejIyODJkdmo">
                    <Textarea
                        className="suggest-textarea"
                        value={message}
                        placeholder={t("您填写的信息越全，问题越有的效解决哦~")}
                        maxlength={200}
                        onInput={(e) => setMessage(e.detail.value)}
                    />
                    <View className="bottom">
                        <View className="upload-box">
                            <Upload
                                modelValue={feedbackPics}
                                onModelValueChange={(value) => setFeedbackPics(value as any[])}
                                isValueArray
                                limit={3}
                                isCustom
                            >
                                <View className="tip">
                                    <Text className="iconfont-h5 icon-tupian" style="font-size:25px;color:#a6a7a7" />
                                    <View className="txt">{t("上传图片")}</View>
                                    <View className="txt">{t("最多上传{0}张", { 0: 3 })}</View>
                                </View>
                            </Upload>
                        </View>
                        <View className="popup-item-footer"> {message.length}/200 </View>
                    </View>
                </View>
            </View>
            <FixedPlaceholder backgroundColor="#fff">
                <View className="btn-box">
                    <TigButton2 className="btn" theme onClick={submit} loading={isLoading} disabled={message == ""}>
                        {t("提交意见")}
                    </TigButton2>
                </View>
            </FixedPlaceholder>
        </TigLayout>
    );
}