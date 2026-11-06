import { useRef, useState } from "react";
import { Navigator, Text, View } from "@tarojs/components";
import Taro, { useLoad, useReachBottom } from "@tarojs/taro";

import EmptyBox from "@/components/empty-box/EmptyBox";
import LoadingBox from "@/components/loading-box";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getArticleList } from "@/api/article/article";
import type { ArticleFilterParams, ArticleFilterState } from "@/types/article/article";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";
import { setPageMeta } from "@/utils/seo";

import "./list.scss";

/**
 * 新闻列表页（自旧 pages/article/news/list.vue 移植）
 * - 展示新闻文章列表
 * - 支持分页加载
 */
export default function ArticleNewsList() {
    usePageGuards();

    const shopTitle = useConfigStore((s) => s.baseInfo.shopTitle);

    const [navbarTitle, setNavbarTitle] = useState(t("文章中心"));
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [articleList, setArticleList] = useState<ArticleFilterState[]>([]);

    // 旧 filterParams 为 reactive 对象并被原地改写分页字段，这里用 ref 保持同一语义
    // TODO(MIGRATION)：旧页面用 defineProps({ id }) 取 categorySn，但 uni-app 页面层不会把路由
    // query 注入 props（旧行为下 categorySn 恒为空串、列表不按 id 过滤）；此处按 onLoad 的可达语义
    // 取路由 query.id，等价于「最新资讯/最新公告/客服中心」三个入口的预期过滤结果，待业务确认。
    const filterParamsRef = useRef<ArticleFilterParams>({
        page: 1,
        categorySn: "",
        size: 10
    });
    const totalRef = useRef(0);

    const loadFilter = async () => {
        if (filterParamsRef.current.page > 1) {
            setLoaded(true);
        } else {
            Taro.showLoading({
                title: t("加载中")
            });
            setLoading(true);
        }
        try {
            const result = await getArticleList({ ...filterParamsRef.current });
            totalRef.current = result.total;
            setArticleList((prev) => [...prev, ...result.records]);
        } catch (error: any) {
            console.error(error.message);
        } finally {
            setLoading(false);
            setLoaded(false);
            Taro.hideLoading();
        }
    };

    const goPages = (url: string) => {
        Taro.navigateTo({
            url
        });
    };

    // 对应旧 onLoad
    useLoad((option: any) => {
        if (process.env.TARO_ENV === "h5") {
            setPageMeta({
                title: `${t("资讯列表")} - ${shopTitle}`,
                description: `${shopTitle}${t("的最新资讯和公告")}`
            });
        }
        if (option && option.id) {
            filterParamsRef.current.categorySn = option.id;
            setNavbarTitle(
                option.id === "zxzx" ? "最新资讯" : option.id === "bzgg" ? "最新公告" : option.id === "kfzx" ? "客服中心" : ""
            );
            void loadFilter();
        }
    });

    // 对应旧 onReachBottom
    useReachBottom(() => {
        if (filterParamsRef.current.page < Math.ceil(totalRef.current / Number(filterParamsRef.current.size))) {
            filterParamsRef.current.page++;
            void loadFilter();
        }
    });

    return (
        <TigLayout title={navbarTitle}>
            {!loading && (
                <View className="article-center">
                    <View className="news-list">
                        {articleList.length ? (
                            articleList.map((article) => (
                                <View key={article.articleId} className="news-item">
                                    <View className="pic-desc" onClick={() => goPages(`/pages/article/news/detail?id=${article.articleId}`)}>
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
                        <LoadingBox modelValue={loaded} page={filterParamsRef.current.page} length={articleList.length} />
                    </View>
                </View>
            )}
        </TigLayout>
    );
}
