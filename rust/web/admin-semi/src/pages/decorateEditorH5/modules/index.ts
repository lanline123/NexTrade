/**
 * 模块自注册入口（副作用导入触发 registerModule）
 *
 * 与 view/admin editor/modules/index.ts 对齐；未完成的模块分批补充导入。
 */

// ==================== mobile 基础 ====================
import "./basic/imageAd";
import "./basic/imageAd2";
import "./basic/imageSquareAd";
import "./basic/imageHotarea";
import "./basic/product";
import "./basic/product2";
import "./basic/whiteLine";
import "./basic/whiteBlank";
import "./basic/imageNav";
import "./basic/titleAd";
import "./basic/notice";
import "./basic/searchBar";
import "./basic/searchBar2";
import "./basic/catNav";
// 不进工具栏（visible: false），仅保证老数据可渲染
import "./basic/article";

// ==================== mobilePromotion 营销 ====================
// import "./promotion/coupon";
// import "./promotion/seckill";
// import "./promotion/seckill2";
// import "./promotion/groupon";
// import "./promotion/shopInfo";
// import "./promotion/live";
// import "./promotion/videoNumber";

// ==================== mobilePro 高级（精确移植批次二，2026-11-07） ====================
import "./pro/imageTextComponent";
import "./pro/imageShowcase";
import "./pro/tagNav";
import "./pro/noticeA2";
import "./pro/noticeA3";
import "./pro/categoryNav";
import "./pro/categoryRec";
import "./pro/mixedNotice";
import "./pro/bannerA2";
import "./pro/customProduct";

// ==================== mobilePro 高级 ====================
// import "./pro/imageTextComponent";
// import "./pro/imageShowcase";
// import "./pro/productGrouping";
// import "./pro/groupSliding";
// import "./pro/countdown";
// import "./pro/categoryRec";
// import "./pro/categoryRecA1";
// import "./pro/productA1";
// import "./pro/mixedProductDisplay";
// import "./pro/specialOffer";
// import "./pro/noticeA2";
// import "./pro/mixedNotice";
// import "./pro/comboSuggestions";
// import "./pro/slideLargeImage";
// import "./pro/slidingImage";
// import "./pro/banner";
// import "./pro/bannerA2";
// import "./pro/categoryNav";
// import "./pro/categoryNavA1";
// import "./pro/categoryNavA2";
// import "./pro/categoryNavA3";
// import "./pro/tagNav";
// import "./pro/shopTips";
// import "./pro/noticeA3";
// import "./pro/newcomerCombo";
// import "./pro/limitedSpecial";
// import "./pro/productSlide";
// import "./pro/productCarousel";
// import "./pro/customProduct";
// import "./pro/storeNav";
// import "./pro/storeOrderCard";

// ==================== mobileMember 会员页 ====================
// import "./member/userInfo";
// import "./member/userInfoV2";
// import "./member/userInfo3";
// import "./member/orderEntry";
// import "./member/orderEntryV2";
// import "./member/myWallet";
// import "./member/myWalletV2";
// import "./member/adImage";
// import "./member/myService";
// import "./member/account";
// import "./member/fixedFunctionalArea";

// ==================== mobileCateCenter 分类中心 ====================
// import "./cateCenter/cateCenterV1";
// import "./cateCenter/cateCenterV2";

// ==================== mobileProductDetail 商品详情 ====================
// import "./productDetail/productDetailA1";
// import "./productDetail/productDetailA2";
// import "./productDetail/productDetailA3";

// ==================== mobileLogin / mobileSearch ====================
// import "./login/mobileLogin";
// import "./search/mobileSearchResult";

// ==================== 通用模块工厂（批量补齐缺失 type，诚实版） ====================
import "./generic/simpleModules";
