import type { ComponentType } from "react";
import { View } from "@tarojs/components";

import { MODULE_REGISTRY } from "./registry";
import type { ShopDetailItem } from "@/types/shop/shop";

/**
 * 店铺版装修分发器（自旧 pages/customPage/modules/shopModules.vue 177 行移植）。
 *
 * 与首页分发器（components/DecorateModules）的差异，逐条对齐旧模板：
 * - 不含 navbar / searchBar / searchBar2 / catNav（店铺头由 shopInfo 模块自己渲染）；
 * - 旧模板只支持下列 36 种类型，其余类型不渲染（不做 isShow 过滤，仅 seckill 判 isShow）；
 * - coupon / product / productA1 / limitedSpecial / productSlide / productCarousel / shopInfo 透传 shopId；
 * - shopInfo 额外接收 shopInfo 数据与刷新回调。
 *
 * 实现方式：不复制 177 行 if 分支，改「旧类型白名单 + registry 查表 + 额外 props 透传」。
 */
const SHOP_MODULE_TYPES = [
    "notice",
    "titleAd",
    "imageAd",
    "imageNav",
    "coupon",
    "whiteBlank",
    "whiteLine",
    "imageSquareAd",
    "imageHotarea",
    "shopInfo",
    "product",
    "productA1",
    "limitedSpecial",
    "productSlide",
    "categoryNav",
    "categoryNavA2",
    "banner",
    "slidingImage",
    "slideLargeImage",
    "comboSuggestions",
    "noticeA2",
    "specialOffer",
    "mixedProductDisplay",
    "categoryRec",
    "categoryRecA1",
    "noticeA3",
    "shopTips",
    "countdown",
    "groupSliding",
    "productGrouping",
    "imageTextComponent",
    "imageShowcase",
    "tagNav",
    "productCarousel",
    "categoryNavA1",
    "seckill"
];

const SHOP_MODULE_TYPE_SET = new Set(SHOP_MODULE_TYPES);

/** 旧模板里带 :shop-id="props.shopInfo.shopId" 的模块 */
const SHOP_ID_MODULE_TYPES = new Set(["coupon", "product", "productA1", "limitedSpecial", "productSlide", "productCarousel", "shopInfo"]);

interface Props {
    modules: any[];
    shopInfo: ShopDetailItem;
    /** 对应旧 @refresh-shop-detail（shopInfo 模块收藏后触发，页面重拉店铺详情） */
    onRefreshShopDetail?: (shopId?: number) => void;
}

export default function ShopModules({ modules, shopInfo, onRefreshShopDetail }: Props) {
    return (
        <View>
            {modules.map((mod: any, index: number) => {
                if (!SHOP_MODULE_TYPE_SET.has(mod.type)) return null;
                const Registered = MODULE_REGISTRY[mod.type] as ComponentType<any> | undefined;
                if (!Registered) {
                    console.warn(`[ShopModules] 模块类型 ${mod.type} 尚未迁移`);
                    return null;
                }
                // 旧模板只有 seckill 分支判 isShow，其余类型无 isShow 过滤
                if (mod.type === "seckill" && !mod?.isShow) return null;

                const props: Record<string, any> = {
                    module: mod.module,
                    moduleIndex: mod.moduleIndex,
                    index
                };
                if (SHOP_ID_MODULE_TYPES.has(mod.type)) {
                    props.shopId = shopInfo?.shopId;
                }
                if (mod.type === "shopInfo") {
                    props.shopInfo = shopInfo;
                    props.onRefreshShopDetail = onRefreshShopDetail;
                }
                return <Registered key={mod.moduleIndex ?? index} {...props} />;
            })}
        </View>
    );
}
