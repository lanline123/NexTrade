/**
 * 分类中心V2模块 - 类型定义
 * 对应后台 cate-center-v2 / cateCenterV2 装修模块（mobileCateCenter/cateCenterV2）
 * 自旧 components/modules/cate-center/cate-center-v2/types.ts 原样移植
 */

/** 分类中心V2模块数据 */
export interface CateCenterV2Data {
    /** 搜索框占位文字 */
    searchPlaceholder?: string;
    /** 样式类型：2=双列网格（瀑布流），3=图文列表 */
    styleType?: 2 | 3;
    /** 二级分类标签风格：1=实心高亮，2=描边高亮 */
    subTabStyle?: 1 | 2;
    /** 文本对齐：1=左对齐，2=居中对齐 */
    textAlign?: 1 | 2;
    /** 文字粗细：1=常规体，2=加粗体 */
    textWeight?: 1 | 2;
    /** 商品名称行数：1=1行，2=2行 */
    goodsNameRow?: 1 | 2;
    /** 显示商品名称：0=不显示，1=显示 */
    showName?: 0 | 1;
    /** 购买按钮样式：0=不显示，1~8=样式一~八 */
    buyBtnStyle?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    /** 主题色；价格 / 购买按钮 / 选中态未单独配置时继承它。空串=跟随店铺主题色 --general */
    themeColor?: string;
    /** 左侧一级分类栏背景色 */
    sideBgColor?: string;
    /** 左侧一级分类文字色 */
    sideTextColor?: string;
    /** 左侧一级分类选中文字色 */
    sideActiveTextColor?: string;
    /** 左侧一级分类选中背景色 */
    sideActiveBgColor?: string;
    /** 左侧一级分类选中指示条颜色 */
    sideIndicatorColor?: string;
    /** 二级标签文字色 */
    subTabTextColor?: string;
    /** 二级标签背景色 */
    subTabBgColor?: string;
    /** 二级标签选中文字色（描边风格下为文字与边框色） */
    subTabActiveTextColor?: string;
    /** 二级标签选中背景色（描边风格下为边框色） */
    subTabActiveBgColor?: string;
    /** 商品区背景色 */
    goodsListBgColor?: string;
    /** 商品标题色 */
    productTitleColor?: string;
    /** 商品价格色 */
    priceColor?: string;
    /** 购买按钮色 */
    buyBtnColor?: string;
}
