/**
 * 原版 TigShop 装修 JSON 契约（camelCase type、url='pc'）→ C 端现有渲染器 props 的纯适配层。
 *
 * 背景：admin-semi 编辑器按原版 Java 契约产出模块（{moduleIndex, type, url:'pc', label, isShow, module}），
 * C 端 PC_MODULE_REGISTRY 只注册了自制 kebab-case 类型；本文件把 16 个旧套 camelCase type
 * 转换为「目标渲染器键名 + 已转换的 module props」，渲染组件见 modules.tsx 的 CONTRACT_COMPONENTS。
 *
 * 约定：
 * - 本文件只做字段名/结构转换（纯函数，无副作用、无 JSX）；
 * - 契约里无法映射到 C 端现有渲染器的字段直接丢弃（降级渲染，缺什么渲染什么）；
 * - 契约 picLink 可能是 {link,title,id,sn,path} 对象或字符串，统一经 linkHref 归一。
 */
import type { DecorateModule, ModuleFrameLike } from '../types';

import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
type AnyRecord = Record<string, any>;

export interface ContractRenderPlan {
  /** CONTRACT_COMPONENTS（modules.tsx）中的渲染器键名 */
  component: string;
  /** 传给渲染器的 module props，frame 已按原契约模块处理 */
  module: AnyRecord;
}

export type ContractAdapter = (item: DecorateModule) => ContractRenderPlan;

// ---------------------------------------------------------------------------
// 通用工具
// ---------------------------------------------------------------------------

function asArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: any, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 内嵌复用现有渲染器时，抵消其自带 Frame 的默认内边距/背景。 */
export const FLAT_FRAME: ModuleFrameLike = {
  boxPadding: 0,
  boxPaddingTop: 0,
  boxPaddingBottom: 0,
  boxRadius: 0,
  backgroundColor: 'transparent',
};

/** 契约链接归一：字符串 / {link,title} / {data}（原版 CustomAd2 用 picLink.data）→ url 字符串，空返回 ''。 */
export function linkHref(link: any): string {
  if (!link) return '';
  if (typeof link === 'string') return link;
  if (typeof link === 'object') return String(link.link || link.data || '');
  return '';
}

/**
 * 原版标题归一：旧装修是 string；新契约是 defaultTitle 对象（{showTitle,titleText,descText,...}）。
 * 统一为 C 端渲染器消费的 {titleText, descText}；showTitle===0 时视为不显示标题（返回空对象）。
 * 注意：ShopTitle 以 Number(title.showTitle) !== 1 判定是否渲染，因此可渲染的标题必须带 showTitle: 1，
 * 否则所有契约模块的标题都会被静默丢弃（历史缺陷）。
 */
export function toTitle(value: any): { showTitle?: number; titleText?: string; descText?: string } & AnyRecord {
  if (typeof value === 'string') {
    return value ? { showTitle: 1, titleText: value } : {};
  }
  if (value && typeof value === 'object') {
    if (Number(value.showTitle ?? 1) === 0) return {};
    return {
      showTitle: 1,
      titleText: value.titleText || value.title || '',
      descText: value.descText || value.subTitle || '',
      // 以下视觉字段 ShopTitle 均可消费，契约有值就透传，缺省undefined不影响
      titleStyle: value.titleStyle,
      titleAlign: value.titleAlign,
      titleColor: value.titleColor,
      descColor: value.descColor,
      moreColor: value.moreColor,
      showMore: value.showMore,
      moreLink: value.moreLink,
      titleRadius: value.titleRadius,
      titleBackground: value.titleBackground,
      titleBackground2: value.titleBackground2,
      titleBackgroundPic: value.titleBackgroundPic,
    };
  }
  return {};
}

/** 契约 ModulePic 列表兜底。 */
function picList(module: AnyRecord, key: string): any[] {
  return asArray(module?.[key]);
}

/** 契约商品 productIds 兜底为正整数数组。 */
function idList(value: any): number[] {
  return asArray(value)
    .map((item) => toNumber(typeof item === 'object' ? item?.productId ?? item?.id : item))
    .filter((id) => id > 0);
}

/** linkList（{link:{link,title}, linkTitle}）→ {link, text} 简单链接行。 */
function toLinks(value: any): Array<{ link: string; text: string }> {
  return asArray(value)
    .map((item: any) => ({
      link: linkHref(item?.link),
      text: String(item?.linkTitle || item?.link?.title || item?.title || ''),
    }))
    .filter((item) => item.text || item.link);
}

/** 后端富化的子分类（{categoryId, categoryName, seoLink}）→ 分类搜索链接行。 */
function toCategoryLinks(value: any): Array<{ link: string; text: string }> {
  return asArray(value)
    .map((item: any) => ({
      link: toNumber(item?.categoryId, 0) > 0 ? `/search?categoryId=${toNumber(item?.categoryId, 0)}` : linkHref(item?.seoLink),
      text: String(item?.categoryName || ''),
    }))
    .filter((item) => item.text);
}

/** 契约 frame：模块自带 frame 直接透传（如 pcGroupon defaultFrame）。 */
function frameOf(module: AnyRecord): ModuleFrameLike | undefined {
  return module?.frame || undefined;
}

// ---------------------------------------------------------------------------
// Banner 系（pcBanner / pcBanner2 / pcGroupBanner）
// ---------------------------------------------------------------------------

/**
 * pcBanner：bannerStyle 1=默认（原版左分类菜单 + picList 轮播 + picList2 小图 + picList3 图标 + 右用户中心），
 * 2=简约（全宽轮播）。
 * - bannerStyle 2 → GroupBanner 平铺 picList；
 * - bannerStyle 1 → ContractBanner（picList 首图为主图 + picList2 小图列 + picList3 图标行）；
 * - showCat/logo 与原版 CommonAllCate/CommonSmallPersonalCenter 全局组件相关，C 端头部已承载，降级省略。
 */
function adaptPcBanner(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  const banners = picList(m, 'picList');
  if (toNumber(m.bannerStyle, 1) === 2) {
    return { component: 'GroupBanner', module: { banners, frame: frameOf(m) } };
  }
  return {
    component: 'ContractBanner',
    module: {
      main: banners,
      recommend: picList(m, 'picList2'),
      icons: picList(m, 'picList3'),
      frame: frameOf(m),
    },
  };
}

/**
 * pcBanner2：旧版 components/home/BannerNew.vue。
 * slideNum 决定一屏显示几张图（1/2/3），对应新版 Banner2 组件（number + slideGap + picList）。
 * 此前错误地指向 GroupBanner（多图并排版式），导致 pcBanner2 渲染效果与旧版不符。
 */
function adaptPcBanner2(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  return {
    component: 'Banner2',
    module: {
      picList: picList(m, 'picList'),
      number: m.slideNum ?? m.number,
      slideGap: m.slideGap,
      frame: frameOf(m),
    },
  };
}

/** pcGroupBanner：pcBanner 字段 + number（一组显示数量≤3）→ GroupBanner，按 number 截取 picList。 */
function adaptPcGroupBanner(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  const banners = picList(m, 'picList');
  const number = toNumber(m.number, 0);
  return {
    component: 'GroupBanner',
    module: { banners: number > 0 ? banners.slice(0, number) : banners, frame: frameOf(m) },
  };
}

// ---------------------------------------------------------------------------
// 营销系（pcSeckill / pcCoupon / pcGroupon）
// ---------------------------------------------------------------------------

/** pcSeckill：{seckillTitle, style, goodsStyle, goodsRadioStyle, goodsNameRow, ...}；
 * 商品列表由营销数据决定，C 端 Seckill 自行请求 /api/home/home/getSeckill。
 * 卡片视觉字段对齐 PcSeckillLegacy.vue 的 class 钩子（ad-goods_style__ / ad-goods_radio_style__ /
 * ad-goods_name_row__ / ad-text_align__ / ad-text_weight__ / ad-goods_name_padding__）。 */
function adaptPcSeckill(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  return {
    component: 'Seckill',
    module: {
      title: toTitle(m.seckillTitle ?? m.title),
      frame: frameOf(m),
      style: m.style,
      goodsStyle: m.goodsStyle,
      goodsRadioStyle: m.goodsRadioStyle,
      goodsNameRow: m.goodsNameRow,
      goodsNamePadding: m.goodsNamePadding,
      goodsPadding: m.goodsPadding,
      textAlign: m.textAlign,
      textWeight: m.textWeight,
      buyBtnStyle: m.buyBtnStyle,
      showName: m.showName,
      showPrice: m.showPrice,
      cardStyle: m.cardStyle,
    },
  };
}

/** pcCoupon：{} 空配置；内容由营销「首页显示」优惠券决定，C 端 Coupon 自行请求 /api/home/home/getCoupon。
 *  注意：C 端 Coupon 的 title 消费 string，这里必须转成字符串而不是 title 对象（否则 React 渲染对象会崩）。 */
function adaptPcCoupon(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  return { component: 'Coupon', module: { title: toTitle(m.title).titleText || '', frame: frameOf(m) } };
}

/**
 * pcGroupon：{style, goodsStyle, ..., title, groupType, grouponActivityItem, ...} → C 端 Groupon
 * （自行请求 /api/promotion/groupon/itemList）。
 * - style/goodsStyle/showName/showPrice/cardStyle 等卡片视觉字段 C 端暂无对应样式，降级省略；
 * - grouponActivityItem（指定拼团活动）依赖接口按活动过滤，C 端现有接口不支持，降级为通用拼团列表。
 */
function adaptPcGroupon(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  // 必须透传 grouponActivityItem：modules.tsx 的 Groupon 组件靠
  // module.grouponActivityItem.grouponPromotionId 调 /api/promotion/groupon/itemList 取拼团数据。
  // 此前此处只传 title/frame，导致 promotionId 为空 → 拼团模块必然空白。
  return {
    component: 'Groupon',
    module: {
      title: toTitle(m.title),
      frame: frameOf(m),
      grouponActivityItem: m.grouponActivityItem,
      // PcGrouponLegacy.vue 消费的样式字段（此前全部丢失）
      style: m.style,
      goodsPadding: m.goodsPadding,
      innerPadding: m.innerPadding,
      boxPadding: m.boxPadding,
      boxPaddingTop: m.boxPaddingTop,
      boxPaddingBottom: m.boxPaddingBottom,
      backgroundColor: m.backgroundColor,
      boxRadius: m.boxRadius,
      showName: m.showName,
      showPrice: m.showPrice,
      cardStyle: m.cardStyle,
      textAlign: m.textAlign,
      textWeight: m.textWeight,
      buyBtnStyle: m.buyBtnStyle,
      goodsNamePadding: m.goodsNamePadding,
      goodsNameRow: m.goodsNameRow,
      goodsStyle: m.goodsStyle,
      goodsRadioStyle: m.goodsRadioStyle,
    },
  };
}

// ---------------------------------------------------------------------------
// 商品楼层系（pcCatProductNormal / Wide / Simple / pcRecommendProduct）
// ---------------------------------------------------------------------------

/** pcCatProductNormal：{categoryId, seoLink, title, color, color2, picList, picList2, childCategoryList}
 *  → ContractCatProductNormal（旧版该模块不渲染商品列表，所以不下发 product 取数配置）。 */
function adaptPcCatProductNormal(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  return {
    component: 'ContractCatProductNormal',
    module: {
      title: toTitle(m.title),
      seoLink: m.seoLink,
      categoryId: toNumber(m.categoryId, 0),
      // 旧版 CatProductNormal.vue:15 取 childCategoryList.slice(0, 6) 渲染关键词行
      childCategoryList: Array.isArray(m.childCategoryList) ? m.childCategoryList : [],
      picList: picList(m, 'picList'),
      picList2: picList(m, 'picList2'),
      links: toCategoryLinks(m.childCategoryList),
      frame: frameOf(m),
      color: m.color,
      color2: m.color2,
    },
  };
}

/**
 * pcCatProductWide：{categoryId(可数组), title, productIds, linkList, picList, picList2, ...}。
 * productIds 优先按 ids 拉取，否则按 categoryId；linkList 渲染为关键词链接行。
 * 原版 CatProductWide.vue：color/color2 → 左栏 30° 渐变、enTitle → 左栏英文副标题、
 * picList2 → 中栏 6 张促销卡。
 */
function adaptPcCatProductWide(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  const productIds = idList(m.productIds);
  const categoryId = toNumber(Array.isArray(m.categoryId) ? m.categoryId[0] : m.categoryId, 0);
  return {
    component: 'ContractCatProductWide',
    module: {
      title: toTitle(m.title),
      seoLink: m.seoLink,
      categoryId,
      productIds,
      linkList: Array.isArray(m.linkList) ? m.linkList : [],
      childCategoryList: Array.isArray(m.childCategoryList) ? m.childCategoryList : [],
      product: productIds.length
        ? { productSelectType: 1, productIds, productNumber: productIds.length }
        : { productSelectType: 2, productCategoryId: categoryId, productNumber: 8 },
      banner: { picList: picList(m, 'picList') },
      links: [...toLinks(m.linkList), ...toCategoryLinks(m.childCategoryList)],
      frame: frameOf(m),
      baseStyle: m.baseStyle,
      color: m.color,
      color2: m.color2,
      enTitle: m.enTitle,
      picList2: picList(m, 'picList2'),
    },
  };
}

/** pcCatProductSimple：products 已是 C 端 Product 的取数配置（productSelectType/productCategoryId/productNumber/productIds/productTag）。 */
function adaptPcCatProductSimple(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  const p = (m.products || {}) as AnyRecord;
  return {
    component: 'ContractCatProductSimple',
    module: {
      title: toTitle(m.title),
      moreLink: m.moreLink,
      // 旧版 CatProductSimple.vue:63-64 `useComProParams(modelValue.products)`
      product: {
        productSelectType: toNumber(p.productSelectType, 1),
        productCategoryId: toNumber(p.productCategoryId, 0),
        productNumber: toNumber(p.productNumber, 8),
        productIds: idList(p.productIds),
        productTag: p.productTag,
      },
      // baseStyle=2 → .contnt.product-small__wrap + 左侧大图（旧版 CatProductSimple.vue:16-21）
      baseStyle: m.baseStyle,
      picList: picList(m, 'picList'),
      frame: frameOf(m),
    },
  };
}

/**
 * pcRecommendProduct：{titleName, products:{productNumber, productIds, productSelectType, productCategoryId, productTag}}。
 * 指定了商品 → Product 按 ids 拉取；未指定 → C 端 RecommendProduct（按 selectType 2=分类/3=标签 取推荐流）。
 * 注意：RecommendProduct 渲染器读的是 module.titleName（字符串）而非 title 对象；
 * selectType/categoryId/tag 需透传（渲染器已支持），此前适配层丢弃导致只能走默认推荐流。
 */
function adaptPcRecommendProduct(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  const p = (m.products || {}) as AnyRecord;
  const rawTitle = m.titleName ?? m.title;
  // 旧版 components/home/RecommendProduct.vue 只有一套结构（.mod_you_like）：
  // selectType 1 → ids、2 → categoryId、3 → introType；不再按「有没有 ids」分流到别的组件。
  return {
    component: 'ContractRecommendProduct',
    module: {
      titleName: typeof rawTitle === 'string' ? rawTitle : toTitle(rawTitle).titleText || '',
      products: {
        productSelectType: toNumber(p.productSelectType, 0),
        productIds: idList(p.productIds),
        productCategoryId: toNumber(p.productCategoryId, 0),
        productTag: p.productTag,
        productNumber: toNumber(p.productNumber, 50),
      },
      frame: frameOf(m),
    },
  };
}

// ---------------------------------------------------------------------------
// 图片广告系（pcImageAd / pcCustomAd1 / pcCustomAd2）
// ---------------------------------------------------------------------------

/** pcImageAd（老链）：{picList, boxPaddingTop, boxPaddingBottom} → ContractImageAd。
 *  旧版 components/home/ImageAd.vue 只有「一列图顺序铺开」+ 上下内边距，
 *  与新版注册表的 ImageAd（kebab pc-image-ad，七种栅格/轮播）不是同一个组件，
 *  所以老链单独走 ContractImageAd，新版 pc-image-ad 一行不动。
 *  兼容：数据里带 `picType`（新链栅格/轮播字段，旧版 ImageAd.vue 从不消费）时仍走新组件，
 *  这样活动页等历史 camelCase 数据不会被换掉外观。 */
function adaptPcImageAd(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  const isLegacyShaped = m.picType === undefined || m.picType === null;
  if (!isLegacyShaped) {
    return {
      component: 'ImageAd',
      module: {
        picList: picList(m, 'picList'),
        picType: m.picType,
        frame: m.frame || { boxPaddingTop: m.boxPaddingTop, boxPaddingBottom: m.boxPaddingBottom },
      },
    };
  }
  return {
    component: 'ContractImageAd',
    module: {
      picList: picList(m, 'picList'),
      frame: m.frame || { boxPaddingTop: m.boxPaddingTop, boxPaddingBottom: m.boxPaddingBottom },
    },
  };
}

/** pcCustomAd1：{picList, picList2, picList3} → ContractCustomAd1
 *  原版 CustomAd1.vue 固定三列编辑版式：左大图(270x400) + 中「每日推荐」 + 右「热销精品」
 *  （含固定标题文案与 GO >> 角标），不是三组图平铺。 */
function adaptPcCustomAd1(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  return {
    component: 'ContractCustomAd1',
    module: {
      picList: picList(m, 'picList'),
      picList2: picList(m, 'picList2'),
      picList3: picList(m, 'picList3'),
      frame: frameOf(m),
    },
  };
}

/** pcCustomAd2：{linkList, picList, picList2, picList3} → ContractCustomAd（链接行 + 三组图）。 */
function adaptPcCustomAd2(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  return {
    component: 'ContractCustomAd',
    module: {
      // CustomAd2.vue 按 picList2[0..4] / picList3 下标逐格取图，必须给原始数组
      picList: picList(m, 'picList'),
      picList2: picList(m, 'picList2'),
      picList3: picList(m, 'picList3'),
      groups: [picList(m, 'picList'), picList(m, 'picList2'), picList(m, 'picList3')],
      links: toLinks(m.linkList),
      frame: frameOf(m),
    },
  };
}

// ---------------------------------------------------------------------------
// 分类导航系（pcCategoryNav / pcCategoryNav3 / pcCatWide）
// ---------------------------------------------------------------------------

/**
 * pcCategoryNav：原版 CategoryNew 调 category/category/hot 渲染热门分类卡片（titleName、rowNum 一屏数量）。
 * C 端复用同一接口（ContractCategoryHot），rowNum 作为每行列数。
 */
function adaptPcCategoryNav(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  return {
    component: 'ContractCategoryHot',
    module: {
      title: toTitle(m.titleName ?? m.title),
      rowNum: clamp(toNumber(m.rowNum ?? m.displayNum, 6), 1, 10),
      catIds: [],
      frame: frameOf(m),
    },
  };
}

/**
 * pcCategoryNav3：picList 图片轮播 + titleText/showMore/showMoreText/moreLink/imageBackgroundColor。
 * 对应旧版 decorate/components/pc/PcCategoryNavWrapper.vue → components/home/CategoryNew3.vue。
 * 契约指向 CategoryNav3（图片轮播版），此前误指向 ContractCategoryHot（热门分类卡片版），
 * 导致 picList 丢失、整个模块退化为热门分类。
 */
function adaptPcCategoryNav3(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  return {
    component: 'CategoryNav3',
    module: {
      title: toTitle(m.titleText ?? m.titleName ?? m.title),
      titleText: m.titleText,
      picList: picList(m, 'picList'),
      rowNum: clamp(toNumber(m.rowNum ?? m.displayNum, 6), 1, 10),
      showMore: toNumber(m.showMore, 0) === 1,
      moreText: m.showMoreText || (i18n.t('查看更多') as string),
      moreLink: m.moreLink,
      backgroundColor: m.backgroundColor,
      imageBackgroundColor: m.imageBackgroundColor,
      catIds: [],
      frame: frameOf(m),
    },
  };
}

/**
 * pcCatWide：{catIds}。原版由后端按 decorateId+moduleIndex 富化分类列表（home/home/getRecommend），
 * C 端暂未接入该富化接口，降级为：取热门分类并按 catIds 过滤（命中才渲染，未命中整块隐藏）。
 */
function adaptPcCatWide(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  return {
    component: 'ContractCategoryHot',
    module: {
      catIds: idList(m.catIds),
      rowNum: 6,
      frame: frameOf(m),
    },
  };
}

// ---------------------------------------------------------------------------
// 店铺装修（camelCase type，旧版 pages/shop/src/ShopHomepage.vue）
// ---------------------------------------------------------------------------

/**
 * 店铺装修适配器组。
 *
 * 背景：旧版店铺首页（pages/shop/src/ShopHomepage.vue）遍历 moduleList 渲染
 * components/shop/** 的 11 个组件，type 为 camelCase：
 *   shopInfo / notice / coupon / imageSquareAd / whiteBlank / whiteLine /
 *   titleAd / imageNav / imageAd / imageHotarea / product
 * 新版 PC_MODULE_REGISTRY 只注册了 kebab-case 的 pc-* 类型，导致店铺装修整体降级
 * （ShopHomepageClient 自建 switch，modules.tsx 里已写好的组件全闲置）。
 *
 * 这里把旧 camelCase type 映射到 modules.tsx 现有渲染器：字段结构本就一致
 * （picList / picType / isFluxWidth / frame / title），无需重复实现。
 */

/**
 * shopInfo：店铺信息卡。
 *
 * 注意：旧版 ShopInfo.vue 消费的是整个 shopInfo 对象（logo / 名称 / 评分 / 资质 / 客服 / 关注按钮），
 * 而不是 module 内的字段；新版这些信息由 ShopRefHeaderBlock（店铺装修模块列表之前独立渲染）
 * 承担，参见 src/components/ShopHomepageClient.tsx。
 * 因此这里返回空计划，由 ShopHomepageClient 跳过该 type，避免重复渲染两张店铺信息卡。
 */
function adaptShopInfo(item: DecorateModule): ContractRenderPlan {
  return { component: 'ShopInfoCard', module: {} };
}

/**
 * notice：店铺公告。
 * 旧版 ShopNotice.vue 读 module.text（文本）+ module.icoPic（图标）+ module.frame，
 * 而非新版 Notice 组件期望的 noticeList —— 此前读 noticeList 导致公告恒空。
 */
function adaptShopNotice(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  const text = m.text || m.noticeTitle || '';
  const icoPic = m.icoPic || {};
  return {
    component: 'Notice',
    module: {
      // 旧版单条公告：文本 + 图标，转成新版 noticeList 结构
      noticeList: text
        ? [
            {
              picTitle: text,
              picUrl: icoPic.picUrl || icoPic.picThumb || '',
              picLink: m.link || m.picLink,
            },
          ]
        : [],
      icoPic,
      text,
      frame: {
        ...frameOf(m),
        itemHeight: m.frame?.itemHeight,
        itemRadius: m.frame?.itemRadius,
        itemBackgroundColor: m.frame?.itemBackgroundColor,
        textColor: m.frame?.textColor,
      },
    },
  };
}

/** imageAd：图片广告。picType 决定版式，isFluxWidth=1 为通栏。 */
function adaptShopImageAd(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  return {
    component: 'ImageAd',
    module: {
      picList: picList(m, 'picList'),
      picType: m.picType,
      isFluxWidth: m.isFluxWidth,
      title: m.title,
      frame: m.frame || { boxPaddingTop: m.boxPaddingTop, boxPaddingBottom: m.boxPaddingBottom },
    },
  };
}

/** imageNav：图片导航（横向图片链接列表）。 */
function adaptShopImageNav(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  return {
    component: 'ImageNav',
    module: {
      picList: picList(m, 'picList'),
      items: asArray(m.items),
      title: m.title,
      frame: frameOf(m),
    },
  };
}

/** imageSquareAd：图片宫格。 */
function adaptShopImageSquareAd(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  return {
    component: 'ImageSquareAd',
    module: {
      picList: picList(m, 'picList'),
      picType: m.picType,
      title: m.title,
      frame: frameOf(m),
    },
  };
}

/** imageHotarea：热区图（图片上叠加可点击热区）。 */
function adaptShopImageHotarea(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  return {
    component: 'ImageHotarea',
    module: {
      picList: picList(m, 'picList'),
      title: m.title,
      frame: frameOf(m),
    },
  };
}

/** whiteBlank：空白间隔。 */
function adaptShopWhiteBlank(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  return {
    component: 'Spacer',
    module: {
      blankHeight: m.blankHeight ?? m.frame?.itemHeight ?? 20,
      frame: frameOf(m),
    },
  };
}

/** whiteLine：分割线。 */
function adaptShopWhiteLine(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  return {
    component: 'Divider',
    module: {
      lineType: m.lineType,
      lineStyle: m.lineStyle,
      frame: m.frame,
    },
  };
}

/** titleAd：标题条。 */
function adaptShopTitleAd(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  return {
    component: 'TitleAd',
    module: {
      title: m.title || {},
      titleText: m.titleText,
      frame: frameOf(m),
    },
  };
}

/** coupon：店铺优惠券（展示 + 领取）。 */
function adaptShopCoupon(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  return {
    component: 'Coupon',
    module: {
      title: toTitle(m.title),
      frame: frameOf(m),
      ...m,
    },
  };
}

/** product：店铺商品楼层（7 种 picType 版式）。 */
function adaptShopProduct(item: DecorateModule): ContractRenderPlan {
  const m = (item.module || {}) as AnyRecord;
  return {
    component: 'Product',
    module: {
      style: m.style,
      goodsPadding: m.goodsPadding,
      products: m.products || {
        productSelectType: m.productSelectType ?? 2,
        productCategoryId: m.categoryId ?? 0,
        productNumber: m.productNumber ?? 8,
        picType: m.picType,
      },
      title: toTitle(m.title),
      frame: frameOf(m),
    },
  };
}

// ---------------------------------------------------------------------------
// 注册表：camelCase type → 适配器（DecorateRenderer 先查 PC_MODULE_REGISTRY，再查这里）
// ---------------------------------------------------------------------------

export const CONTRACT_ADAPTERS: Record<string, ContractAdapter> = {
  pcBanner: adaptPcBanner,
  pcBanner2: adaptPcBanner2,
  pcGroupBanner: adaptPcGroupBanner,
  pcSeckill: adaptPcSeckill,
  pcCoupon: adaptPcCoupon,
  pcCatProductNormal: adaptPcCatProductNormal,
  pcCatProductWide: adaptPcCatProductWide,
  pcCatProductSimple: adaptPcCatProductSimple,
  pcRecommendProduct: adaptPcRecommendProduct,
  pcImageAd: adaptPcImageAd,
  pcCustomAd1: adaptPcCustomAd1,
  pcCustomAd2: adaptPcCustomAd2,
  pcCategoryNav: adaptPcCategoryNav,
  pcCategoryNav3: adaptPcCategoryNav3,
  pcCatWide: adaptPcCatWide,
  pcGroupon: adaptPcGroupon,
  // ---- 店铺装修（旧版 pages/shop/src/ShopHomepage.vue）----
  shopInfo: adaptShopInfo,
  notice: adaptShopNotice,
  coupon: adaptShopCoupon,
  imageAd: adaptShopImageAd,
  imageNav: adaptShopImageNav,
  imageSquareAd: adaptShopImageSquareAd,
  imageHotarea: adaptShopImageHotarea,
  whiteBlank: adaptShopWhiteBlank,
  whiteLine: adaptShopWhiteLine,
  titleAd: adaptShopTitleAd,
  product: adaptShopProduct,
};
