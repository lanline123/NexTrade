import { useEffect, useState } from "react";
import { RichText, View } from "@tarojs/components";

import { getApplyShopAgreement } from "@/api/user/merchantEnter";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./agreement.scss";

/**
 * 商家入驻协议（自旧 pages/user/merchantEnter/agreement.vue 逐行移植）
 * - onLoad 请求协议富文本并渲染 rich-text
 */
export default function MerchantAgreement() {
    usePageGuards();
    const [content, setContent] = useState("");

    const getApplyShopAgreementData = async () => {
        try {
            const result = await getApplyShopAgreement();
            setContent(result);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        void getApplyShopAgreementData();
        // 对应旧 onLoad，仅执行一次
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <TigLayout title={t("商家入驻协议")}>
            <View className="agreement-box">
                <RichText nodes={content} />
            </View>
        </TigLayout>
    );
}