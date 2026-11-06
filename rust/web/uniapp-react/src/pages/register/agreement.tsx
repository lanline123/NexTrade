import { useEffect, useState } from "react";
import { View, RichText } from "@tarojs/components";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getArticle } from "@/api/article/article";
import { usePageGuards } from "@/utils/pageMixin";

import "./agreement.scss";

/** 注册协议页（自旧 pages/register/agreement.vue 移植） */
export default function Agreement() {
    usePageGuards();

    const [content, setContent] = useState("");

    const __getApplyShopAgreement = async () => {
        try {
            const result = await getArticle({ articleSn: "zcxy" }, "issueInfo");
            setContent(result.item.content!);
        } catch (error) {
            console.error(error);
        }
    };

    // 对应旧 onLoad
    useEffect(() => {
        void __getApplyShopAgreement();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <TigLayout title="注册协议">
            <View className="agreement-box">
                <RichText nodes={content} />
            </View>
        </TigLayout>
    );
}
