import type { ApiEnvelope } from "@/types/api";
import request from "@/utils/request";
import type { ArticleFilterParams, ArticleFilterResult, ArticleFormResult, ArticleDetailParams } from "@/types/article/article.d";

/**
 * @description 获取文章列表
 * @param params 筛选条件
 * @returns 文章列表
 */
export const getArticleList = (params?: ArticleFilterParams) => {
    return request<ArticleFilterResult>({
        url: "article/article/list",
        method: "get",
        params
    });
};

/**
 * @description 获取文章详情
 * @param params 请求参数
 * @param url 接口路径（detail等）
 * @returns 文章详情
 */
export const getArticle = (params: ArticleDetailParams, url: string) => {
    return request<ApiEnvelope<ArticleFormResult>>({
        url: "article/article/" + url,
        method: "get",
        params
    });
};
