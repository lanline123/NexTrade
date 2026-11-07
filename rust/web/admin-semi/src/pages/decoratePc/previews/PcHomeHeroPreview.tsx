/**
 * PC 营销通栏（pc-home-hero）预览组件 —— 逐行迁移自原版管理端 Vue 实现。
 *
 * 原源码（java-b2b2c-overseas-v5.8.61/view/admin/src/views/decorate/decorate/editor/modules/pcHome/pc-home-hero）：
 * - Preview.vue：三列布局（左类目 / 中轮播+促销卡+频道卡 / 右会员卡+店铺街）
 * - preview.less：样式（迁移为同目录 pcHomeHero.css）
 * - index.ts：pcHomeHeroDefaults / defaultAvatar 演示数据
 * - types.ts：结构类型
 *
 * 迁移约定：
 * - props 统一 `{ data: Record<string, any> }`，深合并 `pcHomeHeroDefaults`；
 * - 左侧类目优先取 `decorate/pcCatFloor/list` 真实数据（同原版取数与映射），
 *   失败/为空时回退到配置项；
 * - 卡位 `productSource === "productGroup"` 时按原版口径取数：
 *   `productGroup/detail` 拿 productIds → `product/list` 按 ids 查前 2 个商品；
 * - 轮播为轻量自研实现（原版依赖 Swiper 库，本项目未引入 swiper）：
 *   4.5s 自动播放、hover 暂停、圆点分页、隐藏左右导航，视觉与原版一致；
 * - 仅引用 `./pcHomeHero.css`，不改动编辑器（PcDecorateEditor.tsx）与全局样式。
 */
import { useEffect, useState, type CSSProperties, type SyntheticEvent } from 'react';

import { apiGet } from '../../../api';
import i18nInstance, { useI18n } from '../../../i18n';

/** 非组件作用域的翻译：直接用 i18next 单例。 */
const tl = (key: string, params?: Record<string, string | number>) => i18nInstance.t(key, params) as string;

import './pcHomeHero.css';

/** 图片加载失败/未配置时的占位图（原版 empty-img-bg.png，改为内联 SVG 等价占位）。 */
const EMPTY_IMG_BG = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="#f2f3f5"/><path d="M62 158l42-48 30 34 26-28 38 42" stroke="#c0c4cc" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="86" cy="86" r="16" fill="#c0c4cc"/></svg>`,
)}`;

/* ===================== 类型（对齐原版 types.ts） ===================== */

interface HeroPicItem {
  picId?: string | number;
  picUrl?: string;
  picThumb?: string;
  picName?: string;
  picTitle?: string;
  picDesc?: string;
  picLink?: { link?: string; name?: string; title?: string };
}

interface LeftCategoryItem {
  picId?: string | number;
  picTitle?: string;
  picThumb?: string;
  picUrl?: string;
  floorIcoFont?: string;
  useImage?: number;
  imageUrl?: string;
  picLink?: { link?: string };
}

interface CenterProduct {
  productId?: string | number;
  productSn?: string;
  productName?: string;
  pic?: { picUrl?: string; picThumb?: string };
  price?: string;
  label?: string;
  labelBgColorA?: string;
  labelBgColorB?: string;
  labelBgType?: string;
}

interface CenterCard {
  title?: string;
  badgeText?: string;
  pic?: { picUrl?: string; picThumb?: string };
  link?: { link?: string; name?: string };
  productId?: string | number;
  subPic?: { picUrl?: string; picThumb?: string };
  priceText?: string;
  productSource?: 'custom' | 'productGroup';
  productGroupId?: string;
  productGroupName?: string;
  productGroupNum?: number;
  products?: CenterProduct[];
  moduleTitle?: string;
  moduleSubTitle?: string;
  moduleSubTitleBgColorA?: string;
  moduleSubTitleBgColorB?: string;
  moduleSubTitleBgType?: string;
  showPrice?: 0 | 1;
}

type AnyRecord = Record<string, any>;

/* ===================== 演示数据（原版 index.ts 逐字段） ===================== */

const svgPlaceholder = (size: number, bg = '#f2f3f5', radius = 8) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><rect fill='${bg}' width='${size}' height='${size}' rx='${radius}'/><path d='M${Math.round(
    size * 0.25,
  )} ${Math.round(size * 0.62)} L${Math.round(size * 0.45)} ${Math.round(size * 0.42)} L${Math.round(
    size * 0.62,
  )} ${Math.round(size * 0.58)} L${Math.round(size * 0.75)} ${Math.round(
    size * 0.38,
  )}' stroke='#c0c4cc' stroke-width='${Math.max(1, Math.round(size * 0.06))}' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const defaultIcon = svgPlaceholder(64, '#f7f8fa', 12);

/** 原版默认头像（dev 演示数据，保持同源 URL） */
export const defaultAvatar =
  'https://oss.vortmall.com/upload/c4ca4238/2026/02/09/9be6e26cd04b449a8e843df6f790d601.png';

/** 付费会员入口背景图（原版 assets/decorate/pcHome/premium-member-entry.png，内联为 data URI）。 */
const premiumMemberEntry = 'data:image/png;base64,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';

/** 左侧类目演示数据（原版 demoCategories） */
const demoCategories: HeroPicItem[] = [
  {
    picId: '1377',
    picThumb:
      'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957947YV2lncqLSOSg8OvpbK.png?x-oss-process=image/resize,m_pad,h_200,h_200',
    picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957947YV2lncqLSOSg8OvpbK.png',
    picName: 'dangrisuda',
    picTitle: '女装 / 男装 / 内衣',
    picDesc: '',
    picLink: { link: '', name: '' },
  },
  {
    picId: '1384',
    picThumb:
      'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957948LcXRbvCuwlCHyHy7Y0.png?x-oss-process=image/resize,m_pad,h_200,h_200',
    picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957948LcXRbvCuwlCHyHy7Y0.png',
    picName: 'xiuxianlingshi',
    picTitle: '鞋包 / 女靴 / 男鞋',
    picDesc: '',
    picLink: { link: '', name: '' },
  },
  {
    picId: '1378',
    picThumb:
      'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957947XV6cPNonZJurGcDfOP.png?x-oss-process=image/resize,m_pad,h_200,h_200',
    picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957947XV6cPNonZJurGcDfOP.png',
    picName: 'mimianliangyou',
    picTitle: '美妆 / 养护 / 美容',
    picDesc: '',
    picLink: { link: '', name: '' },
  },
  {
    picId: '1385',
    picThumb:
      'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/17309579481I5gopEn7PkOneF0NU.png?x-oss-process=image/resize,m_pad,h_200,h_200',
    picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/17309579481I5gopEn7PkOneF0NU.png',
    picName: 'ruyinjiushui',
    picTitle: '冰洗 / 空调 / 电视 / 厨卫大件',
    picDesc: '',
    picLink: { link: '', name: '' },
  },
  {
    picId: '1382',
    picThumb:
      'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957948Ouz6wPq8cQkgSjDCkF.png?x-oss-process=image/resize,m_pad,h_200,h_200',
    picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957948Ouz6wPq8cQkgSjDCkF.png',
    picName: 'riyongbaihuo',
    picTitle: '电脑 / 办公 / 文具用品',
    picDesc: '',
    picLink: { link: '', name: '' },
  },
  {
    picId: '1380',
    picThumb:
      'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957947iOLEngIwvzxZDjhtQ6.png?x-oss-process=image/resize,m_pad,h_200,h_200',
    picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957947iOLEngIwvzxZDjhtQ6.png',
    picName: 'muyingyongpin',
    picTitle: '食品 / 酒类 / 生鲜 / 特产',
    picDesc: '',
    picLink: { link: '', name: '' },
  },
  {
    picId: '1379',
    picThumb:
      'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957947lWqY7UySCwQ89qsq7f.png?x-oss-process=image/resize,m_pad,h_200,h_200',
    picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957947lWqY7UySCwQ89qsq7f.png',
    picName: 'gerenxihu',
    picTitle: '生活电器 / 厨房小电 / 个护健康',
    picDesc: '',
    picLink: { link: '', name: '' },
  },
  {
    picId: '1383',
    picThumb:
      'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957948vFCfxjt0TIROPOocWI.png?x-oss-process=image/resize,m_pad,h_200,h_200',
    picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957948vFCfxjt0TIROPOocWI.png',
    picName: 'zhipinjiaqing',
    picTitle: '医药 / 器械 / 保健品',
    picDesc: '',
    picLink: { link: '', name: '' },
  },
  {
    picId: '1376',
    picThumb:
      'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957947BswaPOfoOZnn8tDSX6.png?x-oss-process=image/resize,m_pad,h_200,h_200',
    picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957947BswaPOfoOZnn8tDSX6.png',
    picName: 'meironghufu',
    picTitle: '配饰 / 手表 / 玉石',
    picDesc: '',
    picLink: { link: '', name: '' },
  },
  {
    picId: '1381',
    picThumb:
      'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957947vIKQibO98m2q9oP8ct.png?x-oss-process=image/resize,m_pad,h_200,h_200',
    picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957947vIKQibO98m2q9oP8ct.png',
    picName: 'fangbiansushi',
    picTitle: '家装 / 厨卫 / 家具',
    picDesc: '',
    picLink: { link: '', name: '' },
  },
  {
    picId: '1386',
    picThumb:
      'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957947YV2lncqLSOSg8OvpbK.png?x-oss-process=image/resize,m_pad,h_200,h_200',
    picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1730957947YV2lncqLSOSg8OvpbK.png',
    picName: 'qichepeijian',
    picTitle: '汽车 / 摩托 / 配件',
    picDesc: '',
    picLink: { link: '', name: '' },
  },
];

/** 中间轮播演示数据（原版 demoBanners） */
const demoBanners: HeroPicItem[] = [
  {
    picId: '1',
    picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1731301937REbUnsSmPehWiBMaFd.webp',
    picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1731301937REbUnsSmPehWiBMaFd.webp',
    picName: '演示 Banner 1',
    picTitle: '限时直降',
    picLink: { link: '', name: '' },
  },
  {
    picId: '2',
    picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1731301941uaSjIShOBNL2VBSr0y.webp',
    picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1731301941uaSjIShOBNL2VBSr0y.webp',
    picName: '演示 Banner 2',
    picTitle: '新品上新',
    picLink: { link: '', name: '' },
  },
];

/** 演示商品数据（原版 demoProducts） */
const demoProducts = [
  {
    pic: {
      picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1732004872pw39D1oGqdAaZMpvyo.jpg',
      picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1732004872pw39D1oGqdAaZMpvyo.jpg',
    },
    price: '¥88.8',
  },
  {
    pic: {
      picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1732004872f6EcZnbAqdW5kIGzxL.jpg',
      picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1732004872f6EcZnbAqdW5kIGzxL.jpg',
    },
    price: '¥56.8',
  },
  {
    pic: {
      picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1732004872o3s8aqPGdICr1DOCdB.jpg',
      picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1732004872o3s8aqPGdICr1DOCdB.jpg',
    },
    price: '¥48.8',
  },
  {
    pic: {
      picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1732004872Mry8L9BWOCiawPhp72.jpg',
      picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1732004872Mry8L9BWOCiawPhp72.jpg',
    },
    price: '¥48.8',
  },
  {
    pic: {
      picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1732004872yPYr4zSj7AXrfw9oON.jpg',
      picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1732004872yPYr4zSj7AXrfw9oON.jpg',
    },
    price: '¥32.0',
  },
  {
    pic: {
      picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1732004872NlX49KeGeYSN4Tw0wa.jpg',
      picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1732004872NlX49KeGeYSN4Tw0wa.jpg',
    },
    price: '¥32.0',
  },
] as const;

/** 中间卡位演示数据（原版 demoCards：4 个频道卡，双图模式） */
const demoCards: CenterCard[] = [
  {
    title: '严选臻品',
    badgeText: '优中选优',
    link: { link: '', name: '' },
    products: [
      { pic: demoProducts[0].pic, price: demoProducts[0].price },
      { pic: demoProducts[1].pic, price: demoProducts[1].price },
    ],
  },
  {
    title: '新品上市',
    badgeText: '重磅上新',
    link: { link: '', name: '' },
    products: [
      { pic: demoProducts[2].pic, price: demoProducts[2].price, label: '上新底价', labelBgColorA: '#00C176', labelBgColorB: '#008856' },
      { pic: demoProducts[3].pic, price: demoProducts[3].price, label: '多人加购', labelBgColorA: '#00C176', labelBgColorB: '#008856' },
    ],
  },
  {
    title: '领券中心',
    badgeText: '券',
    link: { link: '', name: '' },
    products: [
      { pic: demoProducts[4].pic, price: demoProducts[4].price },
      { pic: demoProducts[5].pic, price: demoProducts[5].price },
    ],
  },
  {
    title: '组团拼单',
    badgeText: '拼享低价',
    link: { link: '', name: '' },
    products: [
      { pic: demoProducts[0].pic, price: demoProducts[0].price, label: '2人团', labelBgColorA: '#FF9000', labelBgColorB: '#FF5000' },
      { pic: demoProducts[1].pic, price: demoProducts[1].price, label: '5人团', labelBgColorA: '#FF9000', labelBgColorB: '#FF5000' },
    ],
  },
];

/** 右侧推荐位演示数据（原版 demoPromoCards，合并进 modules 前 2 位） */
const demoPromoCards: CenterCard[] = [
  {
    title: '限时秒杀',
    badgeText: '钜惠开秒',
    link: { link: '', name: '' },
    products: [
      { pic: demoProducts[2].pic, price: demoProducts[2].price, label: '秒杀价', labelBgColorA: '#FF4E4E', labelBgColorB: '#E1251B' },
      { pic: demoProducts[3].pic, price: demoProducts[3].price, label: '秒杀价', labelBgColorA: '#FF4E4E', labelBgColorB: '#E1251B' },
    ],
  },
  {
    title: '商家严选',
    badgeText: '品质好物',
    link: { link: '', name: '' },
    products: [
      { pic: demoProducts[4].pic, price: demoProducts[4].price, label: '历史低价', labelBgColorA: '#FF4E4E', labelBgColorB: '#E1251B' },
      { pic: demoProducts[5].pic, price: demoProducts[5].price, label: '多人复购', labelBgColorA: '#FF4E4E', labelBgColorB: '#E1251B' },
    ],
  },
];

/** 中间卡位合并列表（原版 demoModules：0-1 推荐位，2-5 频道卡） */
const demoModules: CenterCard[] = [
  {
    moduleTitle: '限时秒杀',
    moduleSubTitle: '钜惠开秒',
    moduleSubTitleBgColorA: '#FF4E4E',
    moduleSubTitleBgColorB: '#E1251B',
    moduleSubTitleBgType: 'leftRight',
    showPrice: 1,
    link: { link: '', name: '' },
    products: demoPromoCards[0]!.products,
  },
  {
    moduleTitle: '商家严选',
    moduleSubTitle: '品质好物',
    moduleSubTitleBgColorA: '#FF4E4E',
    moduleSubTitleBgColorB: '#E1251B',
    moduleSubTitleBgType: 'leftRight',
    showPrice: 1,
    link: { link: '', name: '' },
    products: demoPromoCards[1]!.products,
  },
  {
    moduleTitle: '严选臻品',
    moduleSubTitle: '优中选优',
    moduleSubTitleBgColorA: '#6C8CFF',
    moduleSubTitleBgColorB: '#3A5BFF',
    moduleSubTitleBgType: 'leftRight',
    showPrice: 1,
    link: { link: '', name: '' },
    products: demoCards[0]!.products,
  },
  {
    moduleTitle: '新品上市',
    moduleSubTitle: '重磅上新',
    moduleSubTitleBgColorA: '#00C176',
    moduleSubTitleBgColorB: '#008856',
    moduleSubTitleBgType: 'leftRight',
    showPrice: 1,
    link: { link: '', name: '' },
    products: demoCards[1]!.products,
  },
  {
    moduleTitle: '领券中心',
    moduleSubTitle: '券',
    moduleSubTitleBgColorA: '#FF4E4E',
    moduleSubTitleBgColorB: '#E1251B',
    moduleSubTitleBgType: 'leftRight',
    showPrice: 1,
    link: { link: '', name: '' },
    products: demoCards[2]!.products,
  },
  {
    moduleTitle: '组团拼单',
    moduleSubTitle: '拼享低价',
    moduleSubTitleBgColorA: '#FF9000',
    moduleSubTitleBgColorB: '#FF5000',
    moduleSubTitleBgType: 'leftRight',
    showPrice: 1,
    link: { link: '', name: '' },
    products: demoCards[3]!.products,
  },
];

/** 右侧快捷入口（原版 demoShortcuts：店铺街图标） */
const demoShortcuts: HeroPicItem[] = [
  { picId: 's1', picThumb: defaultIcon, picUrl: defaultIcon, picName: 'shop_1', picTitle: '进入店铺', picLink: { link: '', name: '' } },
  { picId: 's2', picThumb: defaultIcon, picUrl: defaultIcon, picName: 'shop_2', picTitle: '进入店铺', picLink: { link: '', name: '' } },
  { picId: 's3', picThumb: defaultIcon, picUrl: defaultIcon, picName: 'shop_3', picTitle: '进入店铺', picLink: { link: '', name: '' } },
  { picId: 's4', picThumb: defaultIcon, picUrl: defaultIcon, picName: 'shop_4', picTitle: '进入店铺', picLink: { link: '', name: '' } },
];

/** 模块默认值（原版 pcHomeHeroDefaults，逐字段一致；导出便于编辑器复用/单测）。 */
export const pcHomeHeroDefaults: AnyRecord = {
  frame: {
    boxPadding: 0,
    boxPaddingTop: 0,
    boxPaddingBottom: 0,
    backgroundColor: '',
  },
  left: {
    title: '全部商品分类',
    showCount: 11,
    categories: demoCategories,
    backgroundColor: '#ffffff',
    textColor: '#333333',
  },
  center: {
    banners: demoBanners,
    modules: demoModules,
  },
  right: {
    user: {
      avatar: { picUrl: defaultAvatar, picThumb: defaultAvatar, picName: 'avatar' },
      nickname: '欢迎来商城',
      welcomeText: '登录后更多精彩',
    },
    userCardBackground: '#ffffff',
    userCardGradientColorA: '#FFEDE1',
    userCardGradientColorB: '#FCF9F8',
    userCardGradientType: 'upDown',
    premiumMember: {
      show: false,
      title: '会员',
      description: '',
      link: { path: 'base', label: '权益卡中心', name: '权益卡中心', link: 'member/premiumMember/index' },
    },
    stats: [
      { label: '优惠券', value: '85' },
      { label: '余额', value: '257.58' },
      { label: '积分', value: '544' },
    ],
    shortcuts: demoShortcuts,
    shopsTitle: '店铺街',
    shopsSubTitle: 'HOT',
    shopsSubTitleBg: '#FF4E4E',
    shopsMoreText: '查看全部',
    shopsMoreLink: { link: '', name: '' },
    shopsTextColor: '#a06a38',
  },
  style: {
    height: 336,
    gap: 16,
    leftWidth: 220,
    rightWidth: 260,
    panelBackgroundColor: '#ffffff',
    panelRadius: 8,
    panelShadow: 1,
    titleFontSize: 14,
    titleColor: '#333333',
    mutedColor: '#999999',
    priceColor: '#e1251b',
    bannerRadius: 12,
    cardRadius: 12,
  },
};

/* ===================== 纯函数工具（对齐原版 Preview.vue script） ===================== */

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** 深合并：普通对象递归合并，数组/原始值整体覆盖（原版 deepMerge 语义）。 */
function deepMerge(base: AnyRecord, override: AnyRecord): AnyRecord {
  const out: AnyRecord = Array.isArray(base) ? [...(base as any)] : { ...base };
  Object.keys(override || {}).forEach((key) => {
    const next = (override || {})[key];
    const prev = out[key];
    if (isRecord(prev) && isRecord(next)) {
      out[key] = deepMerge(prev as AnyRecord, next as AnyRecord);
    } else if (next !== undefined) {
      out[key] = next;
    }
  });
  return out;
}

function getFirstString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function getFirstId(obj: Record<string, unknown>, keys: string[]): string | number | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' || typeof value === 'number') return value;
  }
  return undefined;
}

function normalizeLink(rawLink: string): string {
  return rawLink || 'javascript:;';
}

function pickPic(pic?: { picUrl?: string; picThumb?: string } | null): string {
  return pic?.picUrl || pic?.picThumb || '';
}

/** 原版 `imageFormat`：保留绝对地址/data URI，其余原样返回。 */
function formatImage(url?: string): string {
  const value = String(url || '').trim();
  if (!value) return EMPTY_IMG_BG;
  return value;
}

function handleImgError(event: SyntheticEvent<HTMLImageElement>): void {
  const img = event.currentTarget;
  if (!img || img.src === EMPTY_IMG_BG) return;
  img.onerror = null;
  img.src = EMPTY_IMG_BG;
}

function isImageIcon(item: LeftCategoryItem): boolean {
  const useImage = Number(item.useImage ?? (item.imageUrl ? 1 : 0));
  return useImage === 1 && Boolean(item.imageUrl);
}

function getImageIconUrl(item: LeftCategoryItem): string {
  return formatImage(item.imageUrl || pickPic(item));
}

function toLeftCategoryItem(item: unknown): LeftCategoryItem {
  if (!isRecord(item)) return { picLink: { link: 'javascript:;' } };
  const imageUrl = typeof item.imageUrl === 'string' ? item.imageUrl.trim() : '';
  const picThumb = typeof item.picThumb === 'string' ? item.picThumb.trim() : imageUrl;
  const picUrl = typeof item.picUrl === 'string' ? item.picUrl.trim() : picThumb;
  const picId = typeof item.picId === 'string' || typeof item.picId === 'number' ? item.picId : undefined;
  const picTitle = typeof item.picTitle === 'string' && item.picTitle.trim() ? item.picTitle.trim() : '类目';
  const floorIcoFont = typeof item.floorIcoFont === 'string' ? item.floorIcoFont.trim() : '';
  const link = isRecord(item.picLink) ? getFirstString(item.picLink, ['link']) : '';
  const useImage = Number(item.useImage ?? (imageUrl ? 1 : 0));
  return { picId, picTitle, picThumb, picUrl, floorIcoFont, useImage, imageUrl, picLink: { link: normalizeLink(link) } };
}

/** 原版 `getTitleAndLinkFromCategoryNames`：兼容对象/数组/JSON 字符串三种历史格式。 */
function getTitleAndLinkFromCategoryNames(raw: unknown): { title: string; link: string } {
  const emptyResult = { title: '', link: '' };
  if (!raw) return emptyResult;
  const parseRecord = (item: Record<string, unknown>) => ({
    title: getFirstString(item, ['categoryTitleName']),
    link: getFirstString(item, ['categoryLink']),
  });
  const parseRecordList = (list: unknown[]) => {
    const parsedList = list
      .filter((item): item is Record<string, unknown> => isRecord(item))
      .map((item) => parseRecord(item));
    const title = parsedList
      .map((item) => item.title)
      .filter((item) => !!item)
      .join(' / ');
    const link = parsedList.find((item) => !!item.link)?.link || '';
    return { title, link };
  };
  if (isRecord(raw)) return parseRecord(raw);
  if (Array.isArray(raw)) return parseRecordList(raw);
  if (typeof raw === 'string' && raw.trim()) {
    const text = raw.trim();
    if (!text.startsWith('{') && !text.startsWith('[')) return { title: text, link: '' };
    try {
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed)) return parseRecordList(parsed);
      if (isRecord(parsed)) return parseRecord(parsed);
    } catch {
      return emptyResult;
    }
  }
  return emptyResult;
}

/** 原版 `mapCatFloorToLeftItems`：PC 分类抽屉楼层 → 左侧类目项。 */
function mapCatFloorToLeftItems(source: unknown): LeftCategoryItem[] {
  if (!isRecord(source)) return [];
  const records = Array.isArray(source.records) ? source.records : Array.isArray(source.list) ? source.list : [];
  return records.reduce<LeftCategoryItem[]>((acc, floor) => {
    if (!isRecord(floor)) return acc;
    if (Number(floor.isShow ?? 1) === 0) return acc;
    const floorId = getFirstId(floor, ['catFloorId', 'id']);
    const iconUrl = getFirstString(floor, ['imageUrl', 'picUrl']);
    const floorIcoFont = getFirstString(floor, ['floorIcoFont']);
    const useImage = Number(floor.useImage ?? (iconUrl ? 1 : 0));
    const titleAndLink = getTitleAndLinkFromCategoryNames(floor.categoryNames);
    const title = (getFirstString(floor, ['catFloorName', 'picTitle']) || titleAndLink.title || tl('类目'))
      .replace(/[，,、]/g, ' / ')
      .replace(/\s*\/\s*/g, ' / ')
      .trim();
    const directLink = getFirstString(floor, ['categoryLink']);
    acc.push({
      picId: floorId,
      picTitle: title,
      picThumb: iconUrl,
      picUrl: iconUrl,
      floorIcoFont,
      useImage,
      imageUrl: iconUrl,
      picLink: { link: normalizeLink(titleAndLink.link || directLink) },
    });
    return acc;
  }, []);
}

const GRADIENT_DIRECTION_MAP: Record<string, string> = {
  upDown: 'to bottom',
  leftRight: 'to right',
  diagonal: 'to bottom right',
};

/* 原版渐变色默认值（与 Settings.vue 保持一致） */
const DEFAULT_SUBTITLE_BG_COLOR_A = '#FF4E4E';
const DEFAULT_SUBTITLE_BG_COLOR_B = '#E1251B';
const DEFAULT_LABEL_BG_COLOR_A = '#FF4E4E';
const DEFAULT_LABEL_BG_COLOR_B = '#E1251B';

/** 原版 `getSubTitleBg`：子标题支持自定义渐变，缺省红渐变。 */
function getSubTitleBg(card: CenterCard): string {
  const colorA = card.moduleSubTitleBgColorA;
  const colorB = card.moduleSubTitleBgColorB;
  const type = card.moduleSubTitleBgType || 'leftRight';
  if (colorA && colorB) {
    const direction = GRADIENT_DIRECTION_MAP[type] || 'to right';
    return `linear-gradient(${direction}, ${colorA}, ${colorB})`;
  }
  return `linear-gradient(to right, ${DEFAULT_SUBTITLE_BG_COLOR_A}, ${DEFAULT_SUBTITLE_BG_COLOR_B})`;
}

/** 原版 `getLabelStyle`：标签背景恒为深色渐变，文字统一白色。 */
function getLabelStyle(product: CenterProduct): Record<string, string> {
  const colorA = product.labelBgColorA;
  const colorB = product.labelBgColorB;
  const type = product.labelBgType || 'leftRight';
  const background =
    colorA && colorB
      ? `linear-gradient(${GRADIENT_DIRECTION_MAP[type] || 'to right'}, ${colorA}, ${colorB})`
      : `linear-gradient(to right, ${DEFAULT_LABEL_BG_COLOR_A}, ${DEFAULT_LABEL_BG_COLOR_B})`;
  return { background, color: '#fff' };
}

/* ===================== 数据 Hooks（对齐原版取数口径） ===================== */

/** 左侧类目：优先取 `decorate/pcCatFloor/list`（排序同 PC 前台 common/pc/getCatFloor），回退配置项。 */
function useHeroLeftCategories(configCategories: HeroPicItem[], showCount: number): LeftCategoryItem[] {
  const [apiCategories, setApiCategories] = useState<LeftCategoryItem[]>([]);
  useEffect(() => {
    let alive = true;
    // 排序须与 PC 前台 common/pc/getCatFloor 一致；不传排序参数时后端默认按主键倒序，预览顺序会与前台相反
    apiGet<Record<string, any>>('/decorate/pcCatFloor/list', {
      page: 1,
      size: 50,
      sortField: 'sortOrder',
      sortOrder: 'asc',
    })
      .then((result) => {
        if (alive) setApiCategories(mapCatFloorToLeftItems(result));
      })
      .catch(() => {
        if (alive) setApiCategories([]);
      });
    return () => {
      alive = false;
    };
  }, []);
  const list = apiCategories.length ? apiCategories : configCategories.map((item) => toLeftCategoryItem(item));
  const raw = Number(showCount ?? 10);
  const count = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 10;
  return list.slice(0, count);
}

/** 卡位商品来源为商品分组时：分组详情拿 productIds → 按 ids 查商品（取前 2）。 */
function useHeroGroupProducts(cards: CenterCard[]): Record<number, CenterProduct[]> {
  const [groupProductsMap, setGroupProductsMap] = useState<Record<number, CenterProduct[]>>({});
  const key = JSON.stringify(cards.map((card) => ({ src: card.productSource, gid: card.productGroupId })));
  useEffect(() => {
    const pending: Array<{ idx: number; gid: string }> = [];
    cards.forEach((card, idx) => {
      if (card.productSource === 'productGroup' && card.productGroupId) {
        pending.push({ idx, gid: String(card.productGroupId) });
      }
    });
    if (!pending.length) {
      setGroupProductsMap({});
      return;
    }
    let alive = true;
    Promise.all(
      pending.map(async ({ idx, gid }) => {
        try {
          const group = await apiGet<Record<string, any>>('/product/productGroup/detail', { id: gid });
          const productIds = Array.isArray(group?.productIds) ? (group.productIds as Array<number | string>).slice(0, 2) : [];
          if (!productIds.length) return [idx, []] as const;
          const result = await apiGet<{ records?: Array<Record<string, any>> }>('/product/product/list', {
            ids: productIds.join(','),
            size: 2,
            page: 1,
          });
          const records = (result.records || []).map(
            (item): CenterProduct => ({
              productId: item.productId,
              productSn: item.productSn || '',
              productName: item.productName || '',
              pic: { picUrl: item.picUrl || '', picThumb: item.picThumb || '' },
              price: item.productPrice ? `¥${item.productPrice}` : '¥0',
            }),
          );
          return [idx, records] as const;
        } catch {
          return [idx, []] as const;
        }
      }),
    ).then((entries) => {
      if (!alive) return;
      const map: Record<number, CenterProduct[]> = {};
      entries.forEach(([idx, rows]) => {
        map[idx as number] = rows as CenterProduct[];
      });
      setGroupProductsMap(map);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return groupProductsMap;
}

/* ===================== 子渲染：卡位卡片（促销卡 / 频道卡共用） ===================== */

function HeroCard({
  card,
  cardIndex,
  groupProducts,
  variant,
  t,
}: {
  card: CenterCard;
  cardIndex: number;
  groupProducts: Record<number, CenterProduct[]>;
  variant: 'promo' | 'channel';
  t: (key: string) => string;
}) {
  const isGroup = card.productSource === 'productGroup';
  const products: CenterProduct[] = isGroup ? groupProducts[cardIndex] || [] : card.products || [];
  const className =
    variant === 'promo'
      ? 'dec-pc-home-hero__panel dec-pc-home-hero__promo-card'
      : 'dec-pc-home-hero__channel-card';
  return (
    <a
      className={className}
      href={card.link?.link || 'javascript:;'}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="dec-pc-home-hero__card-header">
        <div className="dec-pc-home-hero__card-title" title={card.moduleTitle || ''}>
          {card.moduleTitle || t(variant === 'promo' ? t('促销') : '推荐')}
        </div>
        {card.moduleSubTitle ? (
          <div className="dec-pc-home-hero__card-badge" style={{ background: getSubTitleBg(card) }}>
            {card.moduleSubTitle}
          </div>
        ) : null}
      </div>

      <div className="dec-pc-home-hero__card-products">
        {products.length ? (
          products.slice(0, 2).map((product, productIndex) => (
            <div className="dec-pc-home-hero__card-product" key={productIndex}>
              <div className="dec-pc-home-hero__card-img-box">
                <img
                  className="dec-pc-home-hero__card-img"
                  src={formatImage(pickPic(product.pic))}
                  alt=""
                  onError={handleImgError}
                />
                {product.label ? (
                  <div className="dec-pc-home-hero__card-label" style={getLabelStyle(product)}>
                    {product.label}
                  </div>
                ) : null}
              </div>
              {String(card.showPrice) !== '0' ? (
                <div className="dec-pc-home-hero__card-price">{product.price || '¥0'}</div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="dec-pc-home-hero__empty-text" style={{ fontSize: 12 }}>
            {t('配置商品')}
          </div>
        )}
      </div>
    </a>
  );
}

/* ===================== 主组件 ===================== */

/**
 * PC 营销通栏预览。
 *
 * @param data 模块配置（`module` / `moduleList[i].module` 内容），深合并 `pcHomeHeroDefaults`。
 */
export default function PcHomeHeroPreview({ data }: { data: Record<string, any> }) {
  const { t } = useI18n();

  const moduleConfig = deepMerge(pcHomeHeroDefaults, (data || {}) as AnyRecord);
  const frame = (moduleConfig.frame || {}) as AnyRecord;
  const style = (moduleConfig.style || {}) as AnyRecord;
  const left = (moduleConfig.left || {}) as AnyRecord;
  const center = (moduleConfig.center || {}) as AnyRecord;
  const right = (moduleConfig.right || {}) as AnyRecord;

  const banners = (center.banners || []) as HeroPicItem[];
  const rawModules = (center.modules || []) as CenterCard[];
  const modules = (rawModules.length === 0 ? demoModules : [...rawModules]);
  while (modules.length < 6) modules.push({});
  const allModules = modules.slice(0, 6);
  const promoCards = allModules.slice(0, 2);
  const productCards = allModules.slice(2, 6);

  const displayCategories = useHeroLeftCategories(
    (left.categories || []) as HeroPicItem[],
    Number(left.showCount ?? 10),
  );
  const groupProductsMap = useHeroGroupProducts(allModules);

  /* 轮播：轻量自研（4.5s 自动播放、hover 暂停、循环） */
  const [bannerIndex, setBannerIndex] = useState(0);
  const [bannerPaused, setBannerPaused] = useState(false);
  const bannerCount = banners.length;
  useEffect(() => {
    setBannerIndex(0);
  }, [bannerCount]);
  useEffect(() => {
    if (bannerCount <= 1 || bannerPaused) return;
    const timer = window.setInterval(() => {
      setBannerIndex((index) => (index + 1) % bannerCount);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [bannerCount, bannerPaused]);

  const rightUser = (right.user || {}) as AnyRecord;
  const rightShortcuts = (right.shortcuts || []) as HeroPicItem[];
  const shopsConfig = {
    title: (right.shopsTitle as string) || t('店铺街'),
    subTitle: (right.shopsSubTitle as string) || '',
    subTitleBg: (right.shopsSubTitleBg as string) || '#FF4E4E',
    moreText: (right.shopsMoreText as string) || t('查看全部'),
    moreLink: ((right.shopsMoreLink as AnyRecord)?.link as string) || '',
    textColor: (right.shopsTextColor as string) || '#a06a38',
  };
  const premiumMember = (right.premiumMember || {}) as AnyRecord;
  const premiumLink = ((premiumMember.link as AnyRecord)?.link as string) || '';

  /* 用户卡渐变（原版 cssVars 计算） */
  let userCardGradient = 'none';
  if (right.userCardGradientColorA && right.userCardGradientColorB) {
    const direction = GRADIENT_DIRECTION_MAP[String(right.userCardGradientType || 'upDown')] || 'to bottom';
    userCardGradient = `linear-gradient(${direction}, ${right.userCardGradientColorA}, ${right.userCardGradientColorB})`;
  }

  const cssVars: CSSProperties & Record<string, string | number> = {
    '--dec-box-padding': `${Number(frame.boxPadding ?? 0)}px`,
    '--dec-box-padding-top': `${Number(frame.boxPaddingTop ?? 0)}px`,
    '--dec-box-padding-bottom': `${Number(frame.boxPaddingBottom ?? 0)}px`,
    '--dec-box-radius': `${Number(frame.boxRadius ?? 0)}px`,
    '--dec-bg-color': (frame.backgroundColor as string) || 'transparent',

    '--dec-height': `${Number(style.height ?? 336)}px`,
    '--dec-gap': `${Number(style.gap ?? 16)}px`,
    '--dec-left-width': `${Number(style.leftWidth ?? 220)}px`,
    '--dec-right-width': `${Number(style.rightWidth ?? 260)}px`,

    '--dec-panel-bg': (style.panelBackgroundColor as string) ?? '#ffffff',
    '--dec-panel-radius': `${Number(style.panelRadius ?? 8)}px`,
    '--dec-panel-shadow': Number(style.panelShadow) === 1 ? '0 2px 12px 0 rgba(0, 0, 0, 0.06)' : 'none',
    '--dec-left-bg': (left.backgroundColor as string) ?? '#ffffff',
    '--dec-left-text-color': (left.textColor as string) ?? '#333333',
    '--dec-user-card-bg': (right.userCardBackground as string) || (style.panelBackgroundColor as string) || '#ffffff',
    '--dec-user-card-gradient': userCardGradient,

    '--dec-title-size': `${Number(style.titleFontSize ?? 14)}px`,
    '--dec-title-color': (style.titleColor as string) ?? '#333333',
    '--dec-muted-color': (style.mutedColor as string) ?? '#999999',
    '--dec-price-color': (style.priceColor as string) ?? '#e1251b',

    '--dec-banner-radius': `${Number(style.bannerRadius ?? 12)}px`,
    '--dec-card-radius': `${Number(style.cardRadius ?? 12)}px`,

    '--dec-premium-entry': `url("${premiumMemberEntry}")`,
  };

  const bannerLink = (banner?: HeroPicItem) => banner?.picLink?.link || 'javascript:;';

  return (
    <div className="dec-pc-home-hero" style={cssVars}>
      <div className="dec-pc-home-hero__layout">
        {/* ==================== 左：分类导航 ==================== */}
        <section className="dec-pc-home-hero__panel dec-pc-home-hero__left">
          {displayCategories.length ? (
            <div className="dec-pc-home-hero__cate-list">
              {displayCategories.map((item, index) => (
                <div className="dec-pc-home-hero__cate-item" key={String(item.picId ?? index)}>
                  {isImageIcon(item) ? (
                    <img
                      className="dec-pc-home-hero__cate-icon"
                      src={getImageIconUrl(item)}
                      alt=""
                      onError={handleImgError}
                    />
                  ) : item.floorIcoFont ? (
                    <em className={`${item.floorIcoFont} dec-pc-home-hero__cate-icon-font`} />
                  ) : (
                    <span className="dec-pc-home-hero__cate-icon-font">-</span>
                  )}
                  <div className="dec-pc-home-hero__cate-text">
                    <div className="dec-pc-home-hero__cate-title" title={item.picTitle || ''}>
                      {item.picTitle || t('类目')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="dec-pc-home-hero__empty">
              <div className="dec-pc-home-hero__empty-text">{t('点击配置左侧类目')}</div>
            </div>
          )}
        </section>

        {/* ==================== 中：轮播 + 促销卡 / 频道卡 ==================== */}
        <section className="dec-pc-home-hero__center">
          <div className="dec-pc-home-hero__center-top">
            <div
              className="dec-pc-home-hero__banner"
              onMouseEnter={() => setBannerPaused(true)}
              onMouseLeave={() => setBannerPaused(false)}
            >
              {banners.length ? (
                <div className="dec-pc-home-hero__banner-inner">
                  <div className="dec-pc-home-hero__banner-viewport">
                    <div
                      className="dec-pc-home-hero__banner-track"
                      style={{ transform: `translateX(-${bannerIndex * 100}%)` }}
                    >
                      {banners.map((banner, index) => (
                        <div className="dec-pc-home-hero__banner-slide" key={String(banner.picId ?? index)}>
                          <a
                            className="dec-pc-home-hero__banner-link"
                            href={bannerLink(banner)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              className="dec-pc-home-hero__banner-img"
                              src={formatImage(banner.picUrl)}
                              alt=""
                              onError={handleImgError}
                            />
                          </a>
                        </div>
                      ))}
                    </div>
                    {banners.length > 1 ? (
                      <div className="dec-pc-home-hero__banner-dots">
                        {banners.map((banner, index) => (
                          <span
                            key={String(banner.picId ?? index)}
                            className={`dec-pc-home-hero__banner-dot${
                              index === bannerIndex ? ' is-active' : ''
                            }`}
                            onClick={() => setBannerIndex(index)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="dec-pc-home-hero__banner-empty">
                  <div className="dec-pc-home-hero__empty-text">{t('点击添加轮播')}</div>
                </div>
              )}
            </div>

            {/* 右侧推荐位（0-1） */}
            <div className="dec-pc-home-hero__promo-group">
              {promoCards.map((card, index) => (
                <HeroCard
                  key={index}
                  card={card}
                  cardIndex={index}
                  groupProducts={groupProductsMap}
                  variant="promo"
                  t={t}
                />
              ))}
            </div>
          </div>

          <div className="dec-pc-home-hero__center-bottom">
            {productCards.some((card) => !!(card.moduleTitle || (card.products || []).length || card.productGroupId)) ? (
              <div className="dec-pc-home-hero__product-grid">
                {productCards.map((card, index) => (
                  <HeroCard
                    key={index}
                    card={card}
                    cardIndex={index + 2}
                    groupProducts={groupProductsMap}
                    variant="channel"
                    t={t}
                  />
                ))}
              </div>
            ) : (
              <div className="dec-pc-home-hero__empty dec-pc-home-hero__cards-empty">
                <div className="dec-pc-home-hero__empty-text">{t('点击配置推荐卡片')}</div>
              </div>
            )}
          </div>
        </section>

        {/* ==================== 右：会员卡 + 店铺街 ==================== */}
        <section className="dec-pc-home-hero__right">
          <div className="dec-pc-home-hero__panel dec-pc-home-hero__user-card">
            {premiumMember.show === true ? (
              <a
                className={`dec-pc-home-hero__premium-member${
                  premiumMember.description ? '' : ' is-title-only'
                }`}
                href={premiumLink || 'javascript:;'}
                target={premiumLink ? '_blank' : undefined}
                rel="noopener noreferrer"
                title={
                  (premiumMember.description as string) ||
                  (premiumMember.title as string) ||
                  t('会员')
                }
              >
                <span className="dec-pc-home-hero__premium-member-title">
                  {(premiumMember.title as string) || t('会员')}
                </span>
                {premiumMember.description ? (
                  <span className="dec-pc-home-hero__premium-member-desc">
                    {premiumMember.description as string}
                  </span>
                ) : null}
              </a>
            ) : null}

            <div className="dec-pc-home-hero__user-top">
              <img className="dec-pc-home-hero__avatar" src={defaultAvatar} alt="" />
              <div className="dec-pc-home-hero__user-info">
                <div className="dec-pc-home-hero__user-name">
                  {(rightUser.nickname as string) || t('欢迎来商城')}
                </div>
                <div className="dec-pc-home-hero__user-links">
                  <span>{t('注册')}</span>
                  <span className="divider" />
                  <span>{t('入驻')}</span>
                </div>
              </div>
            </div>

            <div className="dec-pc-home-hero__user-desc">
              <div className="title">{(rightUser.welcomeText as string) || t('登录后更多精彩')}</div>
              <div className="subtitle">{t('一键登录，福利好物全拥有')}</div>
            </div>

            <a className="dec-pc-home-hero__login-btn" href="javascript:;">
              {t('立即登录')}
            </a>

            <div className="dec-pc-home-hero__user-actions">
              <div className="dec-pc-home-hero__action-item">
                <i className="dec-pc-home-hero__action-icon dec-pc-home-hero__action-icon--order" />
                <span>{t('我的订单')}</span>
              </div>
              <div className="dec-pc-home-hero__action-item">
                <i className="dec-pc-home-hero__action-icon dec-pc-home-hero__action-icon--history" />
                <span>{t('浏览记录')}</span>
              </div>
              <div className="dec-pc-home-hero__action-item">
                <i className="dec-pc-home-hero__action-icon dec-pc-home-hero__action-icon--collect" />
                <span>{t('商品收藏')}</span>
              </div>
              <div className="dec-pc-home-hero__action-item">
                <i className="dec-pc-home-hero__action-icon dec-pc-home-hero__action-icon--shop" />
                <span>{t('关注店铺')}</span>
              </div>
            </div>
          </div>

          <div className="dec-pc-home-hero__panel dec-pc-home-hero__shops">
            <div className="dec-pc-home-hero__shops-header">
              <div className="title">
                {shopsConfig.title}
                {shopsConfig.subTitle ? (
                  <span className="hot" style={{ background: shopsConfig.subTitleBg }}>
                    {shopsConfig.subTitle}
                  </span>
                ) : null}
              </div>
              <a
                className="more"
                href={shopsConfig.moreLink || 'javascript:;'}
                target={shopsConfig.moreLink ? '_blank' : undefined}
                rel="noopener noreferrer"
              >
                {shopsConfig.moreText}
                <span className="more-icon" aria-hidden="true" />
              </a>
            </div>
            {rightShortcuts.length ? (
              <div className="dec-pc-home-hero__shop-list">
                {rightShortcuts.map((shortcut, index) => (
                  <a
                    className="dec-pc-home-hero__shop-item"
                    key={String(shortcut.picId ?? index)}
                    href={shortcut.picLink?.link || 'javascript:;'}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="dec-pc-home-hero__shop-img-box">
                      <img
                        className="dec-pc-home-hero__shop-icon"
                        src={formatImage(pickPic(shortcut))}
                        alt=""
                        onError={handleImgError}
                      />
                    </div>
                    <span
                      className="dec-pc-home-hero__shop-enter"
                      style={{ color: shopsConfig.textColor }}
                    >
                      {shortcut.picTitle || t('进入店铺')}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="dec-pc-home-hero__empty">
                <div className="dec-pc-home-hero__empty-text">{t('点击配置店铺')}</div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
