import { useEffect, useState } from "react";
import Taro, { useRouter } from "@tarojs/taro";
import { View, RichText } from "@tarojs/components";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getArticle } from "@/api/article/article";
import type { ArticleFormState } from "@/types/article/article";
import { useUserStore } from "@/store/user";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./mallAgreement.scss";

/**
 * 商城协议页面（自旧 pages/login/mallAgreement.vue 移植）
 * - 展示用户协议、隐私政策等协议内容
 * - 富文本渲染协议详情
 * - 支持返回上一页并通知同意状态
 */
export default function MallAgreement() {
    usePageGuards();

    const router = useRouter();

    const [fromLoginPopup, setFromLoginPopup] = useState(false);
    const [articleSn, setArticleSn] = useState<"fwxy" | "ysxy">("fwxy");
    const [articleData, setArticleData] = useState<ArticleFormState>({
        content: ""
    });

    // 对应旧 onLoad（useRouter.params + useEffect）
    useEffect(() => {
        const options: any = router.params;
        if (options && options.articleSn) {
            setArticleSn(options.articleSn as "fwxy" | "ysxy");
            getArticleData(options.articleSn as "fwxy" | "ysxy");
        }
        // 标记是否来自登录弹窗
        if (options && options.from === "loginPopup") {
            setFromLoginPopup(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 处理返回逻辑
    // TODO(MIGRATION)：旧 onBackPress（安卓物理返回键拦截，fromLoginPopup 时走 handleBack 并阻止默认返回）
    // 在 Taro React 无对等钩子（onBackPress 仅原生小程序可用），待 App 端批次统一补齐
    const handleBack = () => {
        if (fromLoginPopup) {
            // 跳转到我的页面并打开登录弹窗
            Taro.reLaunch({
                url: "/pages/member/index",
                success: () => {
                    useUserStore.getState().setAuthType("login");
                }
            });
        }
    };

    const getArticleData = async (sn?: "fwxy" | "ysxy") => {
        try {
            const result = await getArticle({ articleSn: sn ?? articleSn }, "issueInfo");
            setArticleData(result.item);
        } catch (error) {
            console.error("获取文章失败:", error);
        }
    };

    const titleMap: Record<"fwxy" | "ysxy", string> = {
        fwxy: t("服务协议"),
        ysxy: t("隐私政策")
    };

    return (
        <TigLayout title={titleMap[articleSn]} customBack onBack={handleBack}>
            <View className="rich-box">
                <RichText className="rich-text" nodes={articleData.content} />
            </View>
        </TigLayout>
    );
}
