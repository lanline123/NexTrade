import Taro from "@tarojs/taro";

import { groupLinkUrl } from "@/utils/shopGroup";
import { useConfigStore } from "@/store/config";
import { useRegionStore } from "@/store/region";
import { isO2o, queryParams } from "@/utils";
import { resolveImageUrl } from "@/utils/imageUrl";

// 格式化图片地址
export function imageFormat(path: string) {
    const { storageUrl } = useConfigStore.getState();
    // 保留本地临时预览地址，避免上传完成后切换到远程地址时出现白屏闪烁
    if (path && /^(blob:|data:|file:)/i.test(path)) return path;
    return resolveImageUrl(path, storageUrl);
}

interface PicSource {
    picUrl?: string;
    picThumb?: string;
    picLarge?: string;
}

interface SkuPicSource extends PicSource {
    skuData?: unknown[];
    originSkuData?: unknown[];
    sku?: {
        skuData?: unknown[];
    };
}

// 按 picUrl > picThumb > picLarge 取图，不拼接域名；用于 tig-image 等内部已调 imageFormat 的组件
export function pickPic(source: PicSource | null | undefined): string {
    if (!source) {
        return "";
    }
    return source.picUrl || source.picThumb || source.picLarge || "";
}

/**
 * 订单商品优先展示所选规格图；多个规格维度都配置图片时，以最后一个有效规格图为准。
 * 数据源优先级：商品项顶层 skuData > originSkuData > sku.skuData。
 */
export function pickSkuPic(source: SkuPicSource | null | undefined): string {
    if (!source) {
        return "";
    }

    const skuData =
        Array.isArray(source.skuData) && source.skuData.length > 0
            ? source.skuData
            : Array.isArray(source.originSkuData) && source.originSkuData.length > 0
              ? source.originSkuData
              : Array.isArray(source.sku?.skuData)
                ? source.sku.skuData
                : [];
    for (let index = skuData.length - 1; index >= 0; index--) {
        const skuItem = skuData[index] as { attrPic?: string; attrPicThumb?: string } | undefined;
        const skuPic = skuItem?.attrPicThumb || skuItem?.attrPic;
        if (skuPic) {
            return skuPic;
        }
    }

    return pickPic(source);
}

// 按 picUrl > picThumb > picLarge 取图并拼接 storageUrl 前缀
export function productImage(source: PicSource | null | undefined): string {
    return imageFormat(pickPic(source));
}

export function formatDistance(distance: number | string | undefined | null): string {
    if (distance == null || distance === undefined) return `? km`;

    const num = typeof distance === "string" ? Number(distance) : distance;
    if (num == null || isNaN(num) || num < 0) return "--";
    if (num < 1000) {
        return `${Math.round(num)}m`;
    } else {
        const km = num / 1000;
        if (km > 999) return "999+km";
        return `${km.toFixed(1)}km`;
    }
}

export const formatCount = (count: number, limit: number = 99): string => {
    const num = Number(count);
    if (isNaN(num) || num <= 0) return "0";
    return num > limit ? `${limit}+` : num.toString();
};

/**
 * 格式化数字：有小数则原样输出，没有则补足指定位数的小数0
 * @param num 数字或字符串
 * @param decimalPlaces 小数位数，默认1
 */
export function formatPadZero(num: number | string, decimalPlaces = 1): string {
    const str = String(num);
    if (str.includes(".")) {
        // 有小数，去除多余的0（如5.00 -> 5.0），但不补0
        return parseFloat(str).toString();
    } else if (decimalPlaces > 0) {
        return `${str}.${"0".repeat(decimalPlaces)}`;
    } else {
        return str;
    }
}

// 基础页面列表
const baseList = [
    {
        name: "商城首页",
        link: "/",
        url: "/pages/index/index"
    },
    {
        name: "分类页面（仅分类）",
        link: "list",
        url: "/pages/productCate/index"
    },
    {
        name: "限时秒杀",
        link: "seckill/list",
        url: "/pages/seckill/list"
    },
    {
        name: "购物车",
        link: "cart",
        url: "/pages/cart/index"
    },
    {
        name: "搜索页面",
        link: "search",
        url: "/pages/search/index"
    },
    {
        name: "会员首页",
        link: "member",
        url: "/pages/member/index"
    },
    {
        name: "我的优惠券",
        link: "member/coupon/list",
        url: "/pages/coupon/index?type=2"
    },
    {
        name: "我的订单",
        link: "member/order/list",
        url: "/pages/user/order/list"
    },
    {
        name: "待评价订单",
        link: "member/comment/list",
        url: "/pages/user/order/list?type=await_comment"
    },
    {
        name: "收货地址",
        link: "member/address/list",
        url: "/pages/address/list"
    },
    {
        name: "退换货",
        link: "member/return/list",
        url: "/pages/user/afterSale/list"
    },
    {
        name: "账户余额",
        link: "member/account/detail",
        url: "/pages/user/account/index"
    },
    {
        name: "我的积分",
        link: "member/point/list",
        url: "/pages/user/point/detail"
    },
    {
        name: "收藏商品",
        link: "member/collectProduct/list",
        url: "/pages/user/collectProduct/index"
    },
    {
        name: "站内消息",
        link: "member/userMessage/list",
        url: "/pages/user/messageLog/index"
    },
    {
        name: "账号信息",
        link: "member/profile/info",
        url: "/pages/user/profile/index"
    },
    {
        name: "账号信息",
        link: "exchange/list",
        url: "/pages/exchange/list"
    },
    {
        name: "店铺列表",
        link: "shop/list",
        url: "/pages/shop/list"
    },
    {
        name: "买家秀",
        link: "buyerShow",
        url: "/pages/buyerShow/index"
    },
    {
        name: "抽奖",
        link: "lottery/index",
        url: "/pages/lottery/index"
    },
    {
        name: "礼品卡兑换",
        link: "giftCard/exchange",
        url: "/pages/giftCard/exchange"
    },
    {
        name: "留言咨询",
        link: "member/feedback/list",
        url: "/pages/user/suggest/index"
    },
    {
        name: "拼团",
        link: "joining/list",
        url: "/pages/groupon/mylist"
    },
    {
        name: "我的次卡",
        link: "user/subCard/index",
        url: "/pages/user/subCard/index"
    },
    {
        name: "选择门店",
        link: "store/select/index",
        url: "/pages/store/select/index"
    },
    {
        name: "储蓄中心",
        link: "user/account/index",
        url: "/pages/user/account/index"
    },
    {
        name: "权益卡中心",
        link: "member/premiumMember/index",
        url: "/pages/member/premiumMember/index"
    }
];

/**
 * 归一化门店 id：平台自营门店 id 为 0，真值判断会把它误判成「未选门店」
 * @returns 合法门店 id，无法解析时返回 null
 */
function normalizeShopId(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const id = Number(value);
    return Number.isFinite(id) ? id : null;
}

// 链接格式化
export function urlFormat(params: string | { path: string; [key: string]: any }, _title?: string): string {
    if (!params) return "";
    if (typeof params === "string") {
        return params;
    } else if (typeof params === "object" && Object.values(params).length) {
        // 地址栏参数
        let urlParameter;
        Object.keys(params).length && (urlParameter = `?${queryParams(params.data)}`);
        switch (params.path) {
            case "shopGroup":
                return groupLinkUrl(params);
            case "product":
                // 商品
                return `/pages/product/index${urlParameter}`;
            case "list":
                // 分类
                return `/pages/search/result?cat=${params.data.id}`;
            case "article":
                // 文章
                return `/pages/article/news/detail?id=${params.data.id}`;
            case "shop":
                // 文章
                return `/pages/shop/index?shopId=${params.data.id}`;
            case "store": {
                // 门店首页
                const storeId = normalizeShopId(params.data?.id);
                if (storeId === null) return "/pages/store/select/index";
                return `/pages/store/index?id=${storeId}`;
            }
            case "brand":
                // 品牌
                if (params.data.id) {
                    // 搜索页使用驼峰参数 brandId 初始化品牌筛选；保持与其他品牌入口一致。
                    const data = { ...params.data, brandId: params.data.id };
                    delete data.id;
                    urlParameter = `?${queryParams(data)}`;
                }
                return `/pages/search/result${urlParameter}`;
            case "coupon":
                // 优惠券
                return `/pages/coupon/detail${urlParameter}`;
            case "base":
                if (params.link === "toNearestStore") {
                    // 与 bannerA2 头部展示逻辑保持一致：优先用户主动选中的当前门店，
                    // 其次按定位算出的最近门店
                    const regionStore = useRegionStore.getState();
                    const targetShopId = [regionStore.currentShop?.shopId, regionStore.nearestShopInfo?.shopId, regionStore.nearestShopByLocation?.shopId]
                        .map(normalizeShopId)
                        .find((id) => id !== null);
                    if (targetShopId !== undefined) {
                        return `/pages/store/index?id=${targetShopId}`;
                    }
                    return "/pages/store/select/index";
                }
                // 选择门店：已选过门店则直接进入该门店，否则进入选择门店页
                if (params.link === "store/select/index") {
                    const regionStore = useRegionStore.getState();
                    const selectedShopId = normalizeShopId(regionStore.currentShop?.shopId);
                    if (selectedShopId !== null) {
                        return `/pages/store/index?id=${selectedShopId}`;
                    }
                    return "/pages/store/select/index";
                }
                // 基础页面
                const { url = "/pages/index/index" } = baseList.find((item) => item.link === params.link)!;
                return url;
            case "custom":
                // 自定义链接
                return params.appLink;
            case "decorate":
                // 自定义装修页面
                return `/pages/customPage/index?id=${params.data.id}`;
            case "default":
                return params.link;
            case "order":
                return `/pages/user/order/info?id=${params.id}`;
            case "reservationOrder": // 预约订单详情
                return `/pages/store/order/reserveInfo?id=${params.id}`;
            default:
                return params.path;
        }
    }
}

export function formatDate(date: Date, format = "yyyy-MM-dd"): string {
    const map = {
        yyyy: date.getFullYear().toString(),
        MM: ("0" + (date.getMonth() + 1)).slice(-2),
        dd: ("0" + date.getDate()).slice(-2),
        HH: ("0" + date.getHours()).slice(-2),
        mm: ("0" + date.getMinutes()).slice(-2),
        ss: ("0" + date.getSeconds()).slice(-2)
    };
    return format.replace(/yyyy|MM|dd|HH|mm|ss/g, (matched) => map[matched]);
}

/**
 * 将px转换为rpx
 * @param px - 需要转换的像素值
 * @returns 转换后的rpx值
 */
export function pxToRpx(px: number): number {
    // 获取设备屏幕宽度（单位：px）
    const deviceWidth = Taro.getSystemInfoSync().screenWidth;
    // 设计稿基准宽度（单位：rpx），通常为750rpx
    const designWidth = 750;
    // 计算转换比例
    const ratio = deviceWidth / designWidth;
    // 返回转换后的rpx值
    return Math.round(px / ratio);
}

/**
 * 隐藏用户名
 * @param username - 用户名
 * @returns 隐藏后的用户名
 */
export function hideUserName(username: string): string {
    if (!username) {
        return "";
    }
    if (username.length === 1) {
        return username;
    }
    if (username.length === 2) {
        // 隐藏最后一位
        return username[0] + "*";
    }
    return username.replace(/^(.).*?(.)$/, "$1**$2");
}
