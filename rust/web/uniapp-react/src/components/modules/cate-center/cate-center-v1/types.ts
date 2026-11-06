/**
 * 分类中心V1模块 - 类型定义
 * 对应后台 cate-center-v1 / cateCenterV1 装修模块（mobileCateCenter/cateCenterV1）
 * 自旧 components/modules/cate-center/cate-center-v1/types.ts 原样移植
 */

/** 分类中心V1模块数据 */
export interface CateCenterV1Data {
    /** 搜索框占位文字 */
    searchPlaceholder?: string;
    /** 是否展示分类名称（右侧内容区） */
    showCategoryName?: boolean;
    /** 是否展示左侧"推荐"入口 */
    showRecommend?: boolean;
    /** 左侧"推荐"文案 */
    recommendText?: string;
    /** 主题色；选中态未单独配置时继承它。空串=跟随店铺主题色 --general */
    themeColor?: string;
    /** 左侧一级分类栏背景色 */
    sideBgColor?: string;
    /** 左侧一级分类文字色 */
    sideTextColor?: string;
    /** 左侧一级分类选中文字色 */
    sideActiveTextColor?: string;
    /** 左侧一级分类选中背景色 */
    sideActiveBgColor?: string;
    /** 右侧分组标题色 */
    groupTitleColor?: string;
    /** 右侧分类名称色 */
    categoryNameColor?: string;
}
