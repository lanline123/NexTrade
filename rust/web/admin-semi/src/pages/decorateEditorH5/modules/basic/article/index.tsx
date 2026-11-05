/**
 * 文章列表 模块（契约自 view/admin editor/modules/mobile/article/index.ts 逐字段移植）
 */
import { registerModule } from "../../../contract/moduleRegistry";
import { cloneDeep, defaultModuleStyle, defaultContentStyle } from "../../../contract/sharedDefaults";

/** 与旧 mobile/article/View.vue 的 defaultModule 逐字段一致（契约） */
export const articleDefaults = {
    style: 1, // 模块风格选择 1: 大图展示, 2: 两列展示(纵向) 3: 两列展示(横向)
    articleCategoryId: [], // 文章分类ID
    articleNum: 10, // 文章数量
    showTime: 1, // 文章日期显示 0: 不显示 1: 显示
    showPageView: 1, // 文章阅读数显示 0: 不显示 1: 显示
    showLike: 1, // 文章点赞数显示 0: 不显示 1: 显示

    picRadius: 0, // 图片圆角
    articleNameWeight: 400, // 文章名称字体粗细
    moduleColor: {
        articleNameColor: "#333333", // 文章名称颜色
        articleTimeColor: "#999999", // 文章日期颜色
        articleViewColor: "#999999", // 文章阅读数颜色
        articleLikeColor: "#999999", // 文章点赞颜色
        statisticColor: "#999999" // 统计数字颜色
    },
    moduleStyle: defaultModuleStyle, // 模块样式
    contentStyle: defaultContentStyle // 内容样式
};

// 旧 ToolBar 中该条目已被注释、不进工具栏；线上老数据可能仍含该模块，注册仅为可渲染
registerModule({
    type: "article",
    label: "文章列表",
    icon: '<i class="h5-mod-ico">📄</i>',
    url: "mobile",
    platform: "mobile",
    visible: false,
    preview: () => import("./Preview"),
    settings: () => import("./Settings"),
    getDefaultValue: () => cloneDeep(articleDefaults)
});
