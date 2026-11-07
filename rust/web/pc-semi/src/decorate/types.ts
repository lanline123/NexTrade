/** 与原版 Java Admin/PC 共用的装修 JSON 契约。 */

export interface DecoratePic {
  picId?: string | number;
  picUrl?: string;
  picThumb?: string;
  picName?: string;
  picTitle?: string;
  picDesc?: string;
  picLink?: { link?: string; name?: string; label?: string };
}

export interface DecorateTitle {
  showTitle?: number;
  title?: string;
  subTitle?: string;
  titleColor?: string;
  textAlign?: number;
  titleSize?: number;
}

export interface DecorateFrame {
  boxPadding?: number;
  boxPaddingTop?: number;
  boxPaddingBottom?: number;
  boxRadius?: number;
  backgroundColor?: string;
}

export type ModuleFrameLike = DecorateFrame;

export interface PcHeaderConfig {
  logoPic?: DecoratePic;
  logoWidth?: number;
  showMainNav?: number;
  mainNav?: Array<{ title?: string; link?: string; name?: string }>;
  navColor?: string;
  backgroundColor?: string;
  [key: string]: unknown;
}

export interface PageModule {
  type?: string;
  style?: number;
  backgroundColor?: string;
  backgroundImage?: DecoratePic;
  backgroundRepeat?: number;
  backgroundSize?: number;
  homeStyleVersion?: 'new' | 'old';
  pcHeader?: PcHeaderConfig;
  [key: string]: unknown;
}

/**
 * 旧链（PC 旧版 camelCase 装修）模块的图片项。
 * 源码对照：view/pc/components/home/*.vue 的 module.picList / picList2 / picList3。
 */
export interface LegacyPicItem {
  picUrl?: string;
  picThumb?: string;
  picTitle?: string;
  picDesc?: string;
  picLink?: { link?: string; title?: string };
}

/**
 * 旧链「分类商品」系（pcCatProductNormal / pcCatProductWide / pcCatProductSimple）
 * 的原始契约字段。旧版 Vue 组件直接消费这些字段，适配层曾把它们全部丢弃。
 */
export interface LegacyCatProductContract {
  categoryId?: number | number[];
  title?: string;
  shortTitle?: string;
  enTitle?: string;
  color?: string;
  color2?: string;
  logo?: { picUrl?: string; picThumb?: string };
  picList?: LegacyPicItem[];
  picList2?: LegacyPicItem[];
  picList3?: LegacyPicItem[];
  productIds?: number[];
  linkList?: Array<{ link?: { link?: string; title?: string }; linkTitle?: string }>;
  childCategoryIds?: number[];
  baseStyle?: number;
  products?: {
    productSelectType?: number;
    productCategoryId?: number;
    productNumber?: number;
    productIds?: number[];
    productTag?: string;
  };
  moreLink?: string;
}

export interface DecorateModule<T = Record<string, any>> {
  type: string;
  url?: string;
  label?: string;
  moduleIndex?: number | string;
  isShow?: boolean;
  fixed?: boolean;
  module: T;
}

export interface DecorateData {
  decorateId?: number;
  moduleList: DecorateModule[];
  pageModule?: PageModule | null;
  isHome?: number;
}

export interface HomeDecorateResponse extends DecorateData {}
