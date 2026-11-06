/**
 * 装修模块注册表：module.type → React 组件。
 * 模块按迁移批次陆续补入（对应旧 modules/index.vue 的 40+ 分支），
 * 未注册的类型渲染 null（DevTools 可见 TODO 日志），不影响其余模块。
 */
import type { ComponentType } from "react";

import Notice from "./notice/index";
import NoticeA2 from "./noticeA2/index";
import NoticeA3 from "./noticeA3/index";
import MixedNotice from "./mixedNotice/index";
import ShopTips from "./shopTips/index";
import TagNav from "./tagNav/index";
import WhiteBlank from "./whiteBlank/index";
import WhiteLine from "./whiteLine/index";
import CommonTitle from "./commonTitle/index";
import CatNav from "./catNav/index";
import CatNavSticky from "./catNav/Sticky";
import NavbarModule from "./navbar/index";
import SearchBar from "./searchBar/index";
import SearchBar2 from "./searchBar2/index";
import TitleAd from "./titleAd/index";
import ImageAd from "./imageAd/index";
import ImageNav from "./imageNav/index";
import ImageSquareAd from "./imageSquareAd/index";
import ImageHotarea from "./imageHotarea/index";
import Product from "./product/index";
import Product2 from "./product2/index";
import ProductA1 from "./productA1/index";
import Banner from "./banner/index";
import BannerA2 from "./bannerA2/index";
import ImageAd2 from "./imageAd2/index";
import SlidingImage from "./slidingImage/index";
import SlideLargeImage from "./slideLargeImage/index";
import ImageShowcase from "./imageShowcase/index";
import ProductSlide from "./productSlide/index";
import ProductCarousel from "./productCarousel/index";
import LimitedSpecial from "./limitedSpecial/index";
import SpecialOffer from "./specialOffer/index";
import Coupon from "./coupon/index";
import Seckill from "./seckill/index";
import Seckill2 from "./seckill2/index";
import Countdown from "./countdown/index";
import GroupSliding from "./groupSliding/index";
import ProductGrouping from "./productGrouping/index";
import ComboSuggestions from "./comboSuggestions/index";
import MixedProductDisplay from "./mixedProductDisplay/index";
import NewcomerCombo from "./newcomerCombo/index";
import Groupon from "./groupon/index";
import CategoryNav from "./categoryNav/index";
import CategoryNavA1 from "./categoryNavA1/index";
import CategoryNavA2 from "./categoryNavA2/index";
import CategoryNavA3 from "./categoryNavA3/index";
import CategoryRec from "./categoryRec/index";
import CategoryRecA1 from "./categoryRecA1/index";
import ImageTextComponent from "./imageTextComponent/index";
import VideoNumber from "./videoNumber/index";
import Live from "./live/index";
import ShopInfoModule from "./shopInfo/index";

export interface DecorateModuleProps {
    module: any;
    moduleIndex?: number;
    index?: number;
    scrollTop?: number;
    needStatusBar?: boolean;
    onChangeCatNav?: (data: any) => void;
    onIsCut?: (val: boolean) => void;
}

export const MODULE_REGISTRY: Record<string, ComponentType<DecorateModuleProps>> = {
    navbar: NavbarModule,
    searchBar: SearchBar,
    searchBar2: SearchBar2,
    notice: Notice,
    noticeA2: NoticeA2,
    noticeA3: NoticeA3,
    mixedNotice: MixedNotice,
    shopTips: ShopTips,
    tagNav: TagNav,
    whiteBlank: WhiteBlank,
    whiteLine: WhiteLine,
    commonTitle: CommonTitle,
    catNav: CatNav,
    titleAd: TitleAd,
    imageAd: ImageAd,
    imageNav: ImageNav,
    imageSquareAd: ImageSquareAd,
    imageHotarea: ImageHotarea,
    product: Product,
    product2: Product2,
    productA1: ProductA1,
    banner: Banner,
    bannerA2: BannerA2,
    imageAd2: ImageAd2,
    slidingImage: SlidingImage,
    slideLargeImage: SlideLargeImage,
    imageShowcase: ImageShowcase,
    productSlide: ProductSlide,
    productCarousel: ProductCarousel,
    limitedSpecial: LimitedSpecial,
    specialOffer: SpecialOffer,
    coupon: Coupon,
    seckill: Seckill,
    seckill2: Seckill2,
    countdown: Countdown,
    groupSliding: GroupSliding,
    productGrouping: ProductGrouping,
    comboSuggestions: ComboSuggestions,
    mixedProductDisplay: MixedProductDisplay,
    newcomerCombo: NewcomerCombo,
    groupon: Groupon,
    categoryNav: CategoryNav,
    categoryNavA1: CategoryNavA1,
    categoryNavA2: CategoryNavA2,
    categoryNavA3: CategoryNavA3,
    categoryRec: CategoryRec,
    categoryRecA1: CategoryRecA1,
    imageTextComponent: ImageTextComponent,
    // 仅微信小程序端生效（旧 #ifdef MP-WEIXIN，非 weapp 渲染 null）
    videoNumber: VideoNumber,
    live: Live,
    shopInfo: ShopInfoModule
};

/** 挂载在 catNav 分支之外的 sticky 变体（旧 catNav/sticky.vue） */
export const STICKY_REGISTRY: Record<string, ComponentType<DecorateModuleProps>> = {
    catNav: CatNavSticky
};
