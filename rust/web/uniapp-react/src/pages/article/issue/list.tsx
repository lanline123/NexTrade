import { useState } from "react";
import { Navigator, ScrollView, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";

import EmptyBox from "@/components/empty-box/EmptyBox";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getBzzxCategoryList } from "@/api/article/category";
import type { ArticleFilterState } from "@/types/article/article";
import type { CategoryFilterState } from "@/types/article/category";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";
import { setPageMeta } from "@/utils/seo";

import "./list.scss";

/**
 * 文章中心（常见问题）列表页（自旧 pages/article/issue/list.vue 移植）
 * - 顶部分类 Tab（旧 up-sticky + up-tabs，此处自绘吸顶滚动 Tab 按原视觉复刻）
 * - 分类切换展示对应文章列表
 */
export default function ArticleIssueList() {
    usePageGuards();

    const shopTitle = useConfigStore((s) => s.baseInfo.shopTitle);

    const [loading, setLoading] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [articleState, setArticleState] = useState<CategoryFilterState[]>([]);
    const [articleList, setArticleList] = useState<ArticleFilterState[]>([]);

    const loadBzzxList = async () => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            setLoading(true);
            const result = await getBzzxCategoryList({ categorySize: 99, articleSize: 99 });
            setArticleState(result);
            setArticleList(result[0].articles);
        } catch (error: any) {
            console.error(error.message);
        } finally {
            setLoading(false);
            Taro.hideLoading();
        }
    };

    const aCatChange = (item: CategoryFilterState) => {
        setArticleList(item.articles);
    };

    const goPages = (url: string) => {
        Taro.navigateTo({
            url
        });
    };

    // 对应旧 onLoad
    useLoad(() => {
        if (process.env.TARO_ENV === "h5") {
            setPageMeta({
                title: `${t("常见问题")} - ${shopTitle}`,
                description: `${shopTitle}${t("的常见问题解答")}`
            });
        }
        void loadBzzxList();
    });

    return (
        <TigLayout title={t("文章中心")} overflow={false}>
            {articleState.length > 0 && (
                <View className="tabs-sticky">
                    <ScrollView className="tabs-scroll" scrollX>
                        <View className="tabs-nav">
                            {articleState.map((item, index) => (
                                <View
                                    key={item.articleCategoryId ?? index}
                                    className={`tabs-item${currentIndex === index ? " active" : ""}`}
                                    onClick={() => {
                                        setCurrentIndex(index);
                                        aCatChange(item);
                                    }}
                                >
                                    <Text className="tabs-text">{item.articleCategoryName}</Text>
                                    <View className="tabs-line" />
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                </View>
            )}
            {!loading && (
                <View className={`article-center${articleState.length ? " article-center--with-tabs" : ""}`}>
                    <View className="news-list">
                        {articleList.length ? (
                            articleList.map((article) => (
                                <View key={article.articleId} className="news-item">
                                    <View className="pic-desc" onClick={() => goPages(`/pages/article/issue/detail?id=${article.articleId}`)}>
                                        <View className={`news-left${!article.articleThumb ? " w-100" : ""}`}>
                                            <View className="pd-title">
                                                {article.articleTag && <Text className="yin_agn">{t("新闻资讯")}</Text>}
                                                <Text>{article.articleTitle}</Text>
                                            </View>
                                            {article.description && <View className="pd-det">{article.description}</View>}
                                        </View>
                                        {article.articleThumb && (
                                            <View className="news-right">
                                                <TigImage src={article.articleThumb} />
                                            </View>
                                        )}
                                    </View>
                                    <View className="info-btn">
                                        {article.addTime && (
                                            <View className="evaluate">
                                                <Text className="time">{article.addTime}</Text>
                                            </View>
                                        )}
                                        {article.link && (
                                            <Navigator
                                                className="red-btn"
                                                // TODO(MIGRATION)：旧 uniapp 的 H5 新窗口语义，Taro Navigator 的 target 类型未声明 _blank，按原值透传
                                                target={"_blank" as any}
                                                url={article.link}
                                                hoverClass="navigator-hover"
                                                openType="navigate"
                                            >
                                                <Text>{t("相关链接")}</Text>
                                            </Navigator>
                                        )}
                                    </View>
                                </View>
                            ))
                        ) : (
                            <EmptyBox centerContent height="100%" mode="news" text={t("暂无文章")} />
                        )}
                    </View>
                </View>
            )}
        </TigLayout>
    );
}
