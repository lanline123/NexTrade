/**
 * PC 首页装修编辑器（对齐原版 5.8.61 新版模块集 modules/pcHome，/decorate/pc 独立编辑器）
 *
 * 数据契约（与原版逐字段一致，透传不裁剪）：
 * - data = { pageModule, moduleList }
 * - pageModule = { type:'page', module:{}, backgroundRepeat:'', backgroundSize:'', style:0,
 *                  headerStyle:1, homeStyleVersion:'new'|'old', pcHeader?(仅新版) }
 * - moduleList 项 = { moduleIndex: Date.now(), type, url:'pc', label, isShow, module:{...defaults} }
 * - 新套 20 模块 kebab-case（pc-home-hero / pc-image-ad / ...），旧套 16 模块 camelCase 仅兼容历史数据
 * - 加载: GET decorate/decorate/detail?id&decorateType=2&localeId=0&parentId=0
 * - 保存: POST decorate/decorate/saveDraft | publish  body {id, decorateType:2, pageType:1, localeId:0, parentId:0, data}
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Button,
  Input,
  InputNumber,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Space,
  Spin,
  Switch,
  Tag,
  TextArea,
  Toast,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconArrowLeft,
  IconCart,
  IconChevronDown,
  IconChevronUp,
  IconClose,
  IconCopy,
  IconDelete,
  IconPlus,
  IconRefresh,
} from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import './decorate-editor.css';

const { Text } = Typography;

/* ===================== 共享默认值构造（原版 _shared/types.ts 逐字段） ===================== */

interface PicItem {
  picId?: string;
  picUrl: string;
  picThumb?: string;
  picName?: string;
  picTitle?: string;
  picDesc?: string;
  /** 分类导航3 卡片级图片背景色（原版 PcCategoryNav3Item） */
  imageBackgroundColor?: string;
  picLink?: { link?: string; name?: string; title?: string };
}

const DEMO_PIC_1 = 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1731301937REbUnsSmPehWiBMaFd.webp';
const DEMO_PIC_2 = 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1731301941uaSjIShOBNL2VBSr0y.webp';
const NOTICE_ICON = 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202508/1754895669bP3iJSUiXSBoRB1VQq.png';
/** 分类导航3 描述行火苗图标（对齐原版 preview.less 内联 hot.svg 渐变） */
const HOT_FLAME_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none'%3E%3Cdefs%3E%3ClinearGradient id='fa' x1='3.563' x2='12.438' y1='8.398' y2='8.398' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%23FF475D'/%3E%3Cstop offset='1' stop-color='%23FF0F23'/%3E%3C/linearGradient%3E%3ClinearGradient id='fb' x1='8' x2='8' y1='1.008' y2='14.988' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%23FFB78A'/%3E%3Cstop offset='1' stop-color='%23FF3449'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath fill='url(%23fa)' d='M11.516 6.855q-.226.364-.538.712a1.14 1.14 0 0 1-.797.381 1.15 1.15 0 0 1-1.132-.717 1.16 1.16 0 0 1-.083-.51c.047-.741-.194-1.612-.716-2.59-.264-.49-.58-.91-.956-1.256a3.8 3.8 0 0 1-.19.727 5.5 5.5 0 0 1-.909 1.578q-.406.497-.915.887a4.4 4.4 0 0 0-1.263 1.53 4.3 4.3 0 0 0-.454 1.937c0 1.17.46 2.27 1.296 3.1A4.43 4.43 0 0 0 8 13.922a4.43 4.43 0 0 0 3.14-1.288 4.34 4.34 0 0 0 1.297-3.1c0-.612-.126-1.207-.374-1.767a4.3 4.3 0 0 0-.547-.912'/%3E%3Cpath fill='url(%23fb)' d='M13.033 7.334a5.4 5.4 0 0 0-1.295-1.8l-.455-.417a.126.126 0 0 0-.203.052l-.203.583c-.127.365-.36.739-.69 1.106a.1.1 0 0 1-.064.031.09.09 0 0 1-.067-.023.1.1 0 0 1-.031-.075c.058-.941-.223-2.002-.84-3.157-.508-.959-1.216-1.707-2.1-2.23l-.646-.379a.125.125 0 0 0-.187.114l.034.75c.023.513-.036.966-.177 1.342-.171.461-.418.89-.734 1.274q-.331.401-.742.72a5.5 5.5 0 0 0-1.567 1.898 5.43 5.43 0 0 0-.133 4.536 5.49 5.49 0 0 0 2.928 2.9A5.5 5.5 0 0 0 8 14.988c.742 0 1.46-.144 2.14-.427a5.45 5.45 0 0 0 1.747-1.167A5.4 5.4 0 0 0 13.5 9.536c0-.763-.156-1.503-.467-2.202m-1.892 5.302A4.43 4.43 0 0 1 8 13.923a4.43 4.43 0 0 1-3.14-1.287 4.34 4.34 0 0 1-1.298-3.1c0-.68.154-1.331.455-1.938a4.4 4.4 0 0 1 1.263-1.53c.338-.258.646-.556.915-.887.39-.476.697-1.008.91-1.578a3.8 3.8 0 0 0 .189-.726c.376.346.692.765.956 1.256.522.978.762 1.848.716 2.589a1.156 1.156 0 0 0 2.012.847q.313-.349.538-.713.328.42.547.913a4.3 4.3 0 0 1 .374 1.767c0 1.17-.46 2.272-1.296 3.1'/%3E%3C/svg%3E";

const demoPic = (id: string, url: string, name: string, title: string): PicItem => ({
  picId: id,
  picUrl: url,
  picThumb: url,
  picName: name,
  picTitle: title,
  picLink: { link: '', name: '' },
});

const standardFrame = (extra: Record<string, unknown> = {}) => ({
  textColor: '',
  itemBackgroundColor: '',
  backgroundColor: '#ffffff',
  innerPadding: 0,
  itemHeight: 35,
  itemRadius: 3,
  boxRadius: 0,
  boxPadding: 10,
  leftAndRightPadding: 0,
  boxPaddingTop: 5,
  boxPaddingBottom: 5,
  ...extra,
});

const standardTitle = (extra: Record<string, unknown> = {}) => ({
  showTitle: 0,
  titleStyle: 1,
  titleAlign: 1,
  titleBackground: '',
  titleBackground2: '',
  titleBackgroundPic: { picUrl: '', picThumb: '' },
  titleRadius: 0,
  titlePaddingTop: 0,
  titlePaddingBottom: 0,
  titleText: '标题内容',
  titleColor: '',
  descText: '',
  descColor: '#aaaaaa',
  showMore: 0,
  moreType: 1,
  countdownLabel: '',
  moreLink: { link: '', title: '' },
  moreColor: '#aaaaaa',
  ...extra,
});

const productsDefaults = () => ({
  productSelectType: 1,
  productIds: [] as number[],
  productCategoryId: undefined as unknown as number,
  productTag: '',
  productNumber: 10,
});

/** 快捷导航演示项（原版 defaultItems 逐字段） */
const QUICK_NAV_ITEMS: PicItem[] = [
  ['1377', '1730957947YV2lncqLSOSg8OvpbK', '当日速达'],
  ['1384', '1730957948LcXRbvCuwlCHyHy7Y0', '休闲零食'],
  ['1378', '1730957947XV6cPNonZJurGcDfOP', '粮油米面'],
  ['1385', '17309579481I5gopEn7PkOneF0NU', '乳饮酒水'],
  ['1382', '1730957948Ouz6wPq8cQkgSjDCkF', '日用百货'],
  ['1380', '1730957947iOLEngIwvzxZDjhtQ6', '母婴用品'],
  ['1379', '1730957947lWqY7UySCwQ89qsq7f', '个人洗护'],
  ['1383', '1730957948vFCfxjt0TIROPOocWI', '纸品家清'],
  ['1376', '1730957947BswaPOfoOZnn8tDSX6', '护肤美容'],
  ['1381', '1730957947vIKQibO98m2q9oP8ct', '方便速食'],
].map(([picId, hash, picTitle]) => ({
  picId,
  picThumb: `https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/${hash}.png?x-oss-process=image/resize,m_pad,h_200,h_200`,
  picUrl: `https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/${hash}.png`,
  picName: picId,
  picTitle,
  picLink: { link: '', name: '' },
}));

const HERO_CATEGORIES: PicItem[] = [
  ['1377', '1730957947YV2lncqLSOSg8OvpbK', '女装 / 男装 / 内衣'],
  ['1384', '1730957948LcXRbvCuwlCHyHy7Y0', '鞋包 / 女靴 / 男鞋'],
  ['1378', '1730957947XV6cPNonZJurGcDfOP', '美妆 / 养护 / 美容'],
  ['1385', '17309579481I5gopEn7PkOneF0NU', '冰洗 / 空调 / 电视 / 厨卫大件'],
  ['1382', '1730957948Ouz6wPq8cQkgSjDCkF', '电脑 / 办公 / 文具用品'],
  ['1380', '1730957947iOLEngIwvzxZDjhtQ6', '食品 / 酒类 / 生鲜 / 特产'],
  ['1379', '1730957947lWqY7UySCwQ89qsq7f', '生活电器 / 厨房小电 / 个护健康'],
  ['1383', '1730957948vFCfxjt0TIROPOocWI', '医药 / 器械 / 保健品'],
  ['1376', '1730957947BswaPOfoOZnn8tDSX6', '配饰 / 手表 / 玉石'],
  ['1381', '1730957947vIKQibO98m2q9oP8ct', '家装 / 厨卫 / 家具'],
  ['1386', '1730957947YV2lncqLSOSg8OvpbK', '汽车 / 摩托 / 配件'],
].map(([picId, hash, picTitle]) => ({
  picId,
  picThumb: `https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/${hash}.png?x-oss-process=image/resize,m_pad,h_200,h_200`,
  picUrl: `https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/${hash}.png`,
  picName: picId,
  picTitle,
  picDesc: '',
  picLink: { link: '', name: '' },
}));

const HERO_DEMO_PRODUCTS = [
  '1732004872pw39D1oGqdAaZMpvyo',
  '1732004872f6EcZnbAqdW5kIGzxL',
  '1732004872o3s8aqPGdICr1DOCdB',
  '1732004872Mry8L9BWOCiawPhp72',
  '1732004872yPYr4zSj7AXrfw9oON',
  '1732004872NlX49KeGeYSN4Tw0wa',
].map((hash, i) => ({
  pic: {
    picUrl: `https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/${hash}.jpg`,
    picThumb: `https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/${hash}.jpg`,
  },
  price: ['¥88.8', '¥56.8', '¥48.8', '¥48.8', '¥32.0', '¥32.0'][i],
}));

const heroDemoModules = (): Array<Record<string, any>> => {
  const defs: Array<[string, string, string, string]> = [
    ['限时秒杀', '钜惠开秒', '#FF4E4E', '#E1251B'],
    ['商家严选', '品质好物', '#FF4E4E', '#E1251B'],
    ['严选臻品', '优中选优', '#6C8CFF', '#3A5BFF'],
    ['新品上市', '重磅上新', '#00C176', '#008856'],
    ['领券中心', '券', '#FF4E4E', '#E1251B'],
    ['组团拼单', '拼享低价', '#FF9000', '#FF5000'],
  ];
  const picks: number[][] = [[2, 3], [4, 5], [0, 1], [2, 3], [4, 5], [0, 1]];
  return defs.map(([moduleTitle, moduleSubTitle, a, b], i) => ({
    moduleTitle,
    moduleSubTitle,
    moduleSubTitleBgColorA: a,
    moduleSubTitleBgColorB: b,
    moduleSubTitleBgType: 'leftRight',
    showPrice: 1,
    link: { link: '', name: '' },
    products: picks[i].map((p) => ({ ...HERO_DEMO_PRODUCTS[p] })),
  }));
};

/* ===================== 设置字段定义 ===================== */

interface SettingFieldDef {
  kind:
    | 'radio' | 'switch' | 'select' | 'input' | 'textarea' | 'number' | 'slider'
    | 'color' | 'picList' | 'pic' | 'link' | 'linkList'
    | 'category' | 'categoryMulti' | 'products' | 'productIds' | 'groupon'
    | 'title' | 'container' | 'hotarea' | 'groupList' | 'heroCards';
  key: string;
  label: string;
  hint?: string;
  options?: Array<{ label: string; value: number | string }>;
  max?: number;
  min?: number;
  numberMin?: number;
  numberMax?: number;
  numberStep?: number;
  /** container 字段的子结构类型 */
  containerType?: 'frame' | 'buyBtn' | 'productColor' | 'groupTitle' | 'moduleStyle' | 'contentStyle';
  /** color 字段"重置"按钮写回的值（原版各 SelectColor 的 dec-color-reset 语义），缺省为 '' */
  resetValue?: unknown;
  /** title 字段是否隐藏"更多链接/倒计时"二选（原版 enableMoreType 未开启的模块） */
  titleHideMoreType?: boolean;
  /** title 字段是否隐藏标题上/下内边距（原版 enableTitleVerticalPadding 未开启的模块） */
  titleHideVerticalPadding?: boolean;
  /** title 字段是否隐藏对齐选项（原版 hide-title-align） */
  titleHideAlign?: boolean;
  /** picList 字段是否显示描述输入（原版 ModulePicList show-desc） */
  picDesc?: boolean;
  /** 字段写入后的附加行为（如切换拼团类型时清空活动） */
  onChangeExtra?: (moduleData: Record<string, any>, newValue: unknown) => Record<string, any>;
  showIf?: (m: Record<string, any>) => boolean;
}

interface ModuleDef {
  type: string;
  label: string;
  group: string;
  overseasOnly?: boolean;
  hiddenInLibrary?: boolean;
  legacy?: boolean;
  note?: string;
  defaults: () => Record<string, any>;
  settings: SettingFieldDef[];
  summary?: (m: Record<string, any>) => string;
}

/** 深层取值（'title.titleText' 形式） */
function getPath(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

/** 深层写入（不可变） */
function setPath(obj: Record<string, any>, path: string, value: unknown): Record<string, any> {
  const keys = path.split('.');
  const clone: Record<string, any> = { ...obj };
  let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    cur[k] = { ...(cur[k] || {}) };
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return clone;
}

const containerFields = (opts: { showInnerPadding?: boolean } = {}): SettingFieldDef[] => [
  { kind: 'color', key: 'frame.backgroundColor', label: '背景颜色', resetValue: '#ffffff' },
  { kind: 'slider', key: 'frame.boxRadius', label: '容器圆角', max: 30 },
  { kind: 'slider', key: 'frame.boxPadding', label: '左右边距', max: 30 },
  { kind: 'slider', key: 'frame.boxPaddingTop', label: '上边距', max: 30 },
  { kind: 'slider', key: 'frame.boxPaddingBottom', label: '下边距', max: 30 },
  ...(opts.showInnerPadding
    ? [{ kind: 'slider' as const, key: 'frame.leftAndRightPadding', label: '左右内边距', max: 30 }]
    : []),
];

/**
 * 标题设置字段集（对齐原版 _shared/ModuleTitleSettings.vue 的字段顺序/条件显隐/重置值/文案）：
 * 显示标题 → 标题样式 → 标题对齐 → 标题内容 → 标题颜色 → 描述内容 → 描述颜色 → 背景颜色
 * → 标题圆角 → [标题上/下边距] → 显示右侧内容/显示更多链接 → [右侧内容二选]
 * → 链接模式：[链接文字] → 链接颜色 → 链接地址 ｜ 倒计时模式：前缀文字 → 文字颜色
 */
const titleFields = (opts: { moreType?: boolean; verticalPadding?: boolean; hideAlign?: boolean } = {}): SettingFieldDef[] => {
  const moreColorDefault = opts.moreType ? '#1a1a1a' : '#969799';
  const showTitleOn = (m: Record<string, any>) => Number(getPath(m, 'title.showTitle')) === 1;
  const showMoreOn = (m: Record<string, any>) => showTitleOn(m) && Number(getPath(m, 'title.showMore')) === 1;
  const countdownMode = (m: Record<string, any>) =>
    showMoreOn(m) && !!opts.moreType && Number(getPath(m, 'title.moreType')) === 2;
  const linkMode = (m: Record<string, any>) =>
    showMoreOn(m) && (!opts.moreType || Number(getPath(m, 'title.moreType')) !== 2);
  return [
    { kind: 'switch', key: 'title.showTitle', label: '显示标题' },
    { kind: 'radio', key: 'title.titleStyle', label: '标题样式', options: [{ label: '样式一', value: 1 }, { label: '样式二', value: 2 }, { label: '样式三', value: 3 }], showIf: showTitleOn },
    { kind: 'radio', key: 'title.titleAlign', label: '标题对齐', options: [{ label: '左对齐', value: 1 }, { label: '居中', value: 2 }, { label: '右对齐', value: 3 }], showIf: (m) => showTitleOn(m) && !opts.hideAlign },
    { kind: 'input', key: 'title.titleText', label: '标题内容', showIf: showTitleOn },
    { kind: 'color', key: 'title.titleColor', label: '标题颜色', resetValue: '#2a3145', showIf: showTitleOn },
    { kind: 'input', key: 'title.descText', label: '描述内容', showIf: showTitleOn },
    { kind: 'color', key: 'title.descColor', label: '描述颜色', resetValue: '#aaaaaa', showIf: showTitleOn },
    { kind: 'color', key: 'title.titleBackground', label: '背景颜色', showIf: showTitleOn },
    { kind: 'slider', key: 'title.titleRadius', label: '标题圆角', max: 30, showIf: showTitleOn },
    ...(opts.verticalPadding
      ? [
          { kind: 'slider' as const, key: 'title.titlePaddingTop', label: '标题上边距', max: 60 },
          { kind: 'slider' as const, key: 'title.titlePaddingBottom', label: '标题下边距', max: 60 },
        ]
      : []),
    { kind: 'switch', key: 'title.showMore', label: opts.moreType ? '显示右侧内容' : '显示更多链接', showIf: showTitleOn },
    ...(opts.moreType
      ? [
          { kind: 'radio' as const, key: 'title.moreType', label: '右侧内容', options: [{ label: '显示更多', value: 1 }, { label: '显示倒计时', value: 2 }], showIf: showMoreOn },
          { kind: 'input' as const, key: 'title.countdownLabel', label: '前缀文字', showIf: countdownMode },
        ]
      : []),
    { kind: 'input', key: 'title.moreLink.title', label: '链接文字', showIf: linkMode },
    { kind: 'color', key: 'title.moreColor', label: opts.moreType ? '文字颜色' : '链接颜色', resetValue: moreColorDefault, showIf: countdownMode },
    { kind: 'color', key: 'title.moreColor', label: '链接颜色', resetValue: moreColorDefault, showIf: (m) => linkMode(m) && (!opts.moreType || Number(getPath(m, 'title.moreType')) !== 2) },
    { kind: 'link', key: 'title.moreLink', label: '链接地址', showIf: linkMode },
  ];
};

/* ===================== 新版模块集（modules/pcHome 20 个，kebab-case） ===================== */

const NEW_MODULE_DEFS: ModuleDef[] = [
  {
    type: 'pc-banner2', label: '轮播Banner2', group: '轮播横幅', overseasOnly: true,
    defaults: () => ({
      frame: { boxPadding: 10, boxPaddingTop: 0, boxPaddingBottom: 0, boxRadius: 8, backgroundColor: '#eeeeee' },
      bannerStyle: 1, showCat: 1, logo: { picUrl: '', picThumb: '' },
      picList: [demoPic('1', DEMO_PIC_1, '演示图片1', 'Banner1'), demoPic('2', DEMO_PIC_2, '演示图片2', 'Banner2')],
      picList2: [], picList3: [], number: 1, slideGap: 12,
    }),
    settings: [
      { kind: 'picList', key: 'picList', label: '轮播图', hint: '可拖拽排序，建议尺寸 1264*280' },
      ...containerFields(),
    ],
    summary: (m) => `${((m.picList || []) as PicItem[]).length} 图`,
  },
  {
    type: 'pc-group-banner', label: '分组轮播Banner', group: '轮播横幅', overseasOnly: true,
    defaults: () => ({
      frame: { backgroundColor: '#ffffff', boxPadding: 10, boxPaddingTop: 0, boxPaddingBottom: 0, boxRadius: 8, slideHeight: 195 },
      bannerStyle: 1, showCat: 1, logo: { picUrl: '', picThumb: '' },
      picList: [demoPic('1', DEMO_PIC_1, '演示图片1', 'Banner1'), demoPic('2', DEMO_PIC_2, '演示图片2', 'Banner2')],
      picList2: [], picList3: [], number: 3,
    }),
    settings: [
      { kind: 'picList', key: 'picList', label: 'Banner图', hint: '可拖拽排序，建议 1180*940（高清）或 750*479' },
      { kind: 'number', key: 'number', label: '一组显示的数量', min: 1, max: 3, hint: '最多只显示3个' },
      ...containerFields(),
    ],
    summary: (m) => `每组 ${m.number || '-'} 个 · ${((m.picList || []) as PicItem[]).length} 图`,
  },
  {
    type: 'pc-image-ad', label: '图片广告', group: '轮播横幅',
    defaults: () => ({
      picType: 1,
      picList: [demoPic('1', DEMO_PIC_1, '演示图片1', '广告位1'), demoPic('2', DEMO_PIC_2, '演示图片2', '广告位2')],
      swiperPreView: 1, swiperPageColor: '#333333', imgPadding: 0, picPageType: 1, picRadioStyle: 1, isFluxWidth: 0,
      frame: standardFrame(),
      title: standardTitle(),
    }),
    settings: [
      { kind: 'radio', key: 'picType', label: '选择模板', options: [{ label: '一行一个', value: 1 }, { label: '轮播', value: 2 }, { label: '一行两个', value: 5 }, { label: '一行三个', value: 6 }, { label: '一行四个', value: 7 }] },
      { kind: 'picList', key: 'picList', label: '广告图', hint: '可拖拽排序，建议宽1500px' },
      { kind: 'radio', key: 'picPageType', label: '指示器样式', options: [{ label: '样式一', value: 1 }, { label: '样式二', value: 2 }, { label: '样式三', value: 3 }], showIf: (m) => Number(m.picType) === 2 },
      { kind: 'color', key: 'swiperPageColor', label: '指示器颜色', resetValue: '#333333', showIf: (m) => Number(m.picType) === 2 },
      { kind: 'select', key: 'swiperPreView', label: '轮播一行显示', options: [1, 2, 3, 4].map((n) => ({ label: `${n}个`, value: n })), showIf: (m) => Number(m.picType) === 2 },
      { kind: 'slider', key: 'imgPadding', label: '图片边距', max: 30 },
      { kind: 'radio', key: 'picRadioStyle', label: '图片边角', options: [{ label: '直角', value: 1 }, { label: '圆角', value: 2 }] },
      { kind: 'title', key: 'title', label: '标题设置', titleHideMoreType: true, titleHideVerticalPadding: true },
      { kind: 'radio', key: 'isFluxWidth', label: '是否通宽排版', options: [{ label: '是', value: 1 }, { label: '否', value: 0 }] },
      // 原版 ModuleContainerSettings hide-horizontal-spacing：通宽排版时隐藏"左右边距"
      ...containerFields().map((f) => (f.key === 'frame.boxPadding' ? { ...f, showIf: (m: Record<string, any>) => Number(m.isFluxWidth) !== 1 } : f)),
    ],
    summary: (m) => `模板${m.picType} · ${((m.picList || []) as PicItem[]).length} 图`,
  },
  {
    type: 'pc-image-nav', label: '图文导航', group: '导航分类',
    defaults: () => ({
      navType: 1, navStyle: 1, rowNum: 4, colNum: 2, picList: [],
      backgroundColor: '#ffffff', imgPadding: 8, radioStyle: 1, picPageType: 1, swiperPageColor: '#333333',
      frame: standardFrame(),
    }),
    settings: [
      { kind: 'radio', key: 'navType', label: '显示模式', options: [{ label: '固定显示', value: 1 }, { label: '滑动分页', value: 2 }] },
      { kind: 'radio', key: 'navStyle', label: '样式', options: [{ label: '图文', value: 1 }, { label: '仅图片', value: 2 }, { label: '仅文字', value: 3 }] },
      { kind: 'select', key: 'rowNum', label: '一行显示', options: [3, 4, 5, 6].map((n) => ({ label: `${n}个`, value: n })) },
      { kind: 'select', key: 'colNum', label: '显示行数', options: [1, 2, 3].map((n) => ({ label: `${n}行`, value: n })) },
      { kind: 'picList', key: 'picList', label: '导航项', hint: '可拖拽排序' },
      { kind: 'color', key: 'backgroundColor', label: '背景颜色', resetValue: '#ffffff' },
      { kind: 'slider', key: 'imgPadding', label: '元素边距', max: 30 },
      // 原版 isNavStyleImage = navStyle !== 3：仅文字模式下不显示图片边角
      { kind: 'radio', key: 'radioStyle', label: '图片边角', options: [{ label: '直角', value: 1 }, { label: '圆角', value: 2 }], showIf: (m) => Number(m.navStyle) !== 3 },
      { kind: 'radio', key: 'picPageType', label: '指示器样式', options: [{ label: '样式一', value: 1 }, { label: '样式二', value: 2 }], showIf: (m) => Number(m.navType) === 2 },
      { kind: 'color', key: 'swiperPageColor', label: '指示器颜色', resetValue: '#333333', showIf: (m) => Number(m.navType) === 2 },
      ...containerFields(),
    ],
    summary: (m) => `${m.rowNum}×${m.colNum} · ${((m.picList || []) as PicItem[]).length} 项`,
  },
  {
    type: 'pc-image-square-ad', label: '图片魔方', group: '图片展示',
    defaults: () => ({
      picType: 1,
      picList: [demoPic('1', DEMO_PIC_1, '演示图片1', '魔方图1'), demoPic('2', DEMO_PIC_2, '演示图片2', '魔方图2')],
      imgPadding: 0,
      frame: standardFrame(),
      title: standardTitle(),
    }),
    settings: [
      { kind: 'radio', key: 'picType', label: '选择布局', options: [{ label: '一行两个', value: 1 }, { label: '一行三个', value: 2 }, { label: '一行四个', value: 3 }, { label: '左二右二', value: 4 }, { label: '左一右二', value: 5 }, { label: '左一右三', value: 6 }, { label: '上一下二', value: 7 }] },
      { kind: 'picList', key: 'picList', label: '魔方图', hint: '先选模板确定格子数量（固定张数）' },
      { kind: 'slider', key: 'imgPadding', label: '图片边距', max: 30 },
      { kind: 'title', key: 'title', label: '标题设置', titleHideMoreType: true, titleHideVerticalPadding: true },
      ...containerFields({ showInnerPadding: true }),
    ],
    summary: (m) => `布局${m.picType} · ${((m.picList || []) as PicItem[]).length} 图`,
  },
  {
    type: 'pc-image-hotarea', label: '热图绘制', group: '图片展示',
    defaults: () => ({
      picList: [] as PicItem[],
      imgPadding: 0,
      frame: standardFrame(),
      title: standardTitle(),
    }),
    settings: [
      { kind: 'picList', key: 'picList', label: '热图', hint: '添加图片后在每张图下绘制热区（宽/高/上/左 为像素，基准 500px 宽）' },
      { kind: 'hotarea', key: 'hotarea', label: '热区' },
      { kind: 'title', key: 'title', label: '标题设置', titleHideMoreType: true, titleHideVerticalPadding: true },
      ...containerFields({ showInnerPadding: true }),
    ],
    summary: (m) => `${((m.picList || []) as PicItem[]).length} 图`,
  },
  {
    type: 'pc-home-quick-nav', label: '快捷导航', group: '导航分类',
    defaults: () => ({
      frame: { boxPadding: 0, boxPaddingTop: 0, boxPaddingBottom: 0, backgroundColor: '' },
      style: { fontSize: 14, textColor: '#333333', hoverColor: '#e1251b', containerAlign: 2, itemGap: 16, singleLine: 1, fontWeight: 700, lineHeight: 36, iconSize: 18, iconGap: 6 },
      items: QUICK_NAV_ITEMS,
    }),
    settings: [
      { kind: 'picList', key: 'items', label: '导航项', hint: '图标+文字+链接，可拖拽排序' },
      { kind: 'slider', key: 'style.fontSize', label: '字号', min: 12, max: 24 },
      { kind: 'radio', key: 'style.fontWeight', label: '文字粗细', options: [{ label: '常规体', value: 400 }, { label: '加粗体', value: 700 }] },
      { kind: 'slider', key: 'style.lineHeight', label: '行高', min: 12, max: 40 },
      { kind: 'color', key: 'style.textColor', label: '文字颜色', resetValue: '#333333' },
      { kind: 'color', key: 'style.hoverColor', label: '悬停颜色', resetValue: '#e1251b' },
      { kind: 'slider', key: 'style.iconSize', label: '图标尺寸', min: 12, max: 32 },
      { kind: 'slider', key: 'style.iconGap', label: '图文间距', min: 0, max: 16 },
      { kind: 'radio', key: 'style.containerAlign', label: '整体排布', options: [{ label: '居左', value: 1 }, { label: '居中', value: 2 }, { label: '居右', value: 3 }] },
      { kind: 'slider', key: 'style.itemGap', label: '项目间距', min: 8, max: 60 },
      { kind: 'radio', key: 'style.singleLine', label: '单行模式', options: [{ label: '单行不换行', value: 1 }, { label: '自动换行', value: 0 }] },
      ...containerFields(),
    ],
    summary: (m) => `${((m.items || []) as PicItem[]).length} 项`,
  },
  {
    type: 'pc-category-nav', label: '分类导航', group: '导航分类',
    defaults: () => ({
      frame: { boxPadding: 0, boxPaddingTop: 0, boxPaddingBottom: 0, boxRadius: 8, backgroundColor: '#f7f7f7', boxHeight: 328 },
      titleName: '热门分类', showTitle: 1, displayNum: 6, backgroundColor: '#f7f7f7',
    }),
    settings: [
      { kind: 'radio', key: 'showTitle', label: '显示标题', options: [{ label: '显示', value: 1 }, { label: '不显示', value: 0 }] },
      { kind: 'input', key: 'titleName', label: '标题', showIf: (m) => Number(m.showTitle) === 1 },
      { kind: 'slider', key: 'displayNum', label: '一屏显示数量', min: 1, max: 10 },
      { kind: 'color', key: 'backgroundColor', label: '背景颜色', resetValue: '#f7f7f7' },
      ...containerFields(),
    ],
    summary: (m) => `${m.titleName || ''} · 每屏 ${m.displayNum}`,
  },
  {
    type: 'pc-category-nav3', label: '分类导航3', group: '导航分类', overseasOnly: true,
    defaults: () => ({
      frame: { boxPadding: 0, boxPaddingTop: 0, boxPaddingBottom: 0, boxRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.02)', boxHeight: 352 },
      titleText: '热门推荐', showMore: 1, showMoreText: '更多', moreLink: { link: '', name: '' },
      imageBackgroundColor: '', picList: [], backgroundColor: 'rgba(0, 0, 0, 0.02)',
    }),
    settings: [
      { kind: 'picList', key: 'picList', label: '图片卡片', hint: '可拖拽排序，建议 180*180 像素', picDesc: true },
      { kind: 'color', key: 'imageBackgroundColor', label: '图片背景色', resetValue: '' },
      { kind: 'input', key: 'titleText', label: '标题内容' },
      { kind: 'radio', key: 'showMore', label: '显示查看更多', options: [{ label: '显示', value: 1 }, { label: '不显示', value: 0 }] },
      { kind: 'input', key: 'showMoreText', label: '查看更多文字', showIf: (m) => Number(m.showMore) === 1 },
      { kind: 'link', key: 'moreLink', label: '更多链接', showIf: (m) => Number(m.showMore) === 1 },
      { kind: 'color', key: 'backgroundColor', label: '模块背景颜色', resetValue: 'rgba(0, 0, 0, 0.02)' },
    ],
    summary: (m) => `${m.titleText || ''} · ${((m.picList || []) as PicItem[]).length} 卡`,
  },
  {
    type: 'pc-product', label: '商品', group: '商品',
    defaults: () => ({
      style: 1, goodsStyle: 1, goodsRadioStyle: 1, textAlign: 1, textWeight: 1, goodsNameRow: 2,
      goodsNamePadding: 1, showName: 1, showBrief: 1, showPrice: 1, goodsPadding: 5, buyBtnStyle: 1,
      backgroundColor: '', boxRadius: 0, innerPadding: 0, boxPadding: 10, boxPaddingTop: 5,
      boxPaddingBottom: 5, imgPadding: 1, waterfall: 0, swiperPageColor: '',
      frame: standardFrame(),
      title: standardTitle(),
      products: productsDefaults(),
    }),
    settings: [
      { kind: 'radio', key: 'style', label: '展示样式', options: [{ label: '一行四个', value: 1 }, { label: '一行五个', value: 2 }] },
      { kind: 'slider', key: 'goodsPadding', label: '商品边距', max: 30 },
      { kind: 'products', key: 'products', label: '商品设置' },
      { kind: 'title', key: 'title', label: '标题设置', titleHideMoreType: true, titleHideVerticalPadding: true },
      ...containerFields({ showInnerPadding: true }),
    ],
    summary: (m) => `样式${Number(m.style) === 2 ? 5 : 4}列 · ${((m.products?.productIds || []) as number[]).length} 商品`,
  },
  {
    type: 'pc-product-group', label: '商品分组', group: '商品',
    defaults: () => {
      // 演示商品（原版 demoProductList 逐字段）
      const demoProductList = [
        ['1732004872pw39D1oGqdAaZMpvyo', 88.8, 98.8],
        ['1732004872f6EcZnbAqdW5kIGzxL', 56.8, 68.88],
        ['1732004872o3s8aqPGdICr1DOCdB', 48.8, 69.9],
        ['1732004872Mry8L9BWOCiawPhp72', 48.8, 69.9],
        ['1732004872yPYr4zSj7AXrfw9oON', 32.0, 39.0],
        ['1732004872NlX49KeGeYSN4Tw0wa', 32.0, 39.0],
      ].map(([hash, price, marketPrice]) => ({
        productId: 0,
        productSn: '',
        productName: '商品的大标题雨价格在后台他会自动调用读取',
        productDesc: '',
        productPrice: price as number,
        marketPrice: marketPrice as number,
        picThumb: `https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/${hash}.jpg`,
      }));
      const demoGroup = (title: string, withTitlePic: boolean): Record<string, any> => ({
        sourceType: 'products',
        title,
        titlePic: withTitlePic
          ? {
              picUrl: 'https://oss.vortmall.com/demo/upload/c4ca4238/2026/02/07/147580fe25834bb09199267ee601b834.png',
              picThumb: 'https://oss.vortmall.com/demo/upload/c4ca4238/2026/02/07/147580fe25834bb09199267ee601b834.png?x-oss-process=image/resize,m_pad,h_200,h_200',
            }
          : { picUrl: '', picThumb: '' },
        titleLink: { link: '', name: '' },
        bannerPic: { picUrl: '', picThumb: '' },
        bannerLink: { link: '', name: '' },
        productList: demoProductList.map((p) => ({ ...p })),
      });
      return {
        productSource: 'products',
        productGroups: [demoGroup('为你推荐', true), demoGroup('热卖', false), demoGroup('折扣', false), demoGroup('预售', false)],
        groupList: [],
        productCardStyle: 1, listStyle: 4, cardPadding: 0, cardRadius: 4,
        showProductName: 1, productNameRow: 1, productNameWeight: 400, productNameSize: 16,
        showProductPrice: 1, productPriceMarginTop: 10, productPriceWeight: 400, productPriceSize: 28,
        crossedOutPrice: 1, showSales: 1, showShopTag: 1,
        buyBtnStyle: { showBtn: 1, btnType: 1, text: '', textColor: '#ffffff', iconColor: '#ffffff', paddingLeftRight: 3 },
        productColor: { infoLeftRightPadding: 10, backgroundColor: '#ffffff', titleColor: '#19191b', priceColor: '', crossedOutPriceColor: '#999999' },
        groupTitle: { marginLeftRight: 5, showTitle: 1, bigTitleFontSize: 14, titleColor: '#444444', activeTitleColor: '#FF0F23', activeTitleBgColor: '#ffebf1', titleMinWidth: 80, titlePaddingTopBottom: 8, titlePaddingLeftRight: 12, titleRadius: 4, splitLineColor: 'transparent' },
        moduleStyle: { boxPaddingTop: 5, boxPaddingBottom: 5, boxPadding: 10, backgroundColor: '' },
        contentStyle: { paddingTop: 0, paddingBottom: 0, paddingLeftRight: 0, boxRadius: 0, backgroundColor: '', backgroundPic: { picUrl: '', picThumb: '' }, backgroundPicFillType: 'cover', boxShadow: 0 },
      };
    },
    settings: [
      { kind: 'groupList', key: 'productGroups', label: '分组列表' },
      { kind: 'radio', key: 'productCardStyle', label: '商品样式', options: [{ label: '扁平', value: 1 }, { label: '卡片', value: 2 }, { label: '描边', value: 3 }] },
      { kind: 'radio', key: 'listStyle', label: '展示样式', options: [{ label: '一行四个', value: 4 }, { label: '一行五个', value: 6 }, { label: '一行六个', value: 7 }] },
      { kind: 'slider', key: 'cardPadding', label: '商品内部边距', max: 10 },
      { kind: 'slider', key: 'cardRadius', label: '商品圆角半径', max: 20 },
      { kind: 'radio', key: 'showProductName', label: '商品标题', options: [{ label: '显示', value: 1 }, { label: '不显示', value: 0 }] },
      { kind: 'radio', key: 'productNameRow', label: '标题行数', options: [{ label: '一行', value: 1 }, { label: '两行', value: 2 }], showIf: (m) => Number(m.showProductName) === 1 },
      { kind: 'radio', key: 'productNameWeight', label: '标题粗细', options: [{ label: '常规', value: 400 }, { label: '加粗', value: 700 }], showIf: (m) => Number(m.showProductName) === 1 },
      { kind: 'slider', key: 'productNameSize', label: '标题大小', min: 12, max: 16, showIf: (m) => Number(m.showProductName) === 1 },
      { kind: 'radio', key: 'showProductPrice', label: '商品价格', options: [{ label: '显示', value: 1 }, { label: '不显示', value: 0 }] },
      { kind: 'radio', key: 'crossedOutPrice', label: '商品划线价', options: [{ label: '显示', value: 1 }, { label: '不显示', value: 0 }] },
      { kind: 'radio', key: 'showSales', label: '已售', options: [{ label: '显示', value: 1 }, { label: '不显示', value: 0 }] },
      { kind: 'radio', key: 'showShopTag', label: '商品店铺', options: [{ label: '显示', value: 1 }, { label: '不显示', value: 0 }] },
      { kind: 'container', key: 'buyBtnStyle', label: '购买按钮', containerType: 'buyBtn' },
      { kind: 'container', key: 'productColor', label: '商品颜色设置', containerType: 'productColor' },
      { kind: 'container', key: 'groupTitle', label: '分组标题设置', containerType: 'groupTitle' },
      { kind: 'container', key: 'moduleStyle', label: '模块样式设置', containerType: 'moduleStyle' },
      { kind: 'container', key: 'contentStyle', label: '内容区样式设置', containerType: 'contentStyle' },
    ],
    summary: (m) => `${((m.productGroups || []) as Array<Record<string, any>>).length} 组 · 样式${m.listStyle}`,
  },
  {
    type: 'pc-recommend-product', label: '推荐商品', group: '商品', hiddenInLibrary: true,
    defaults: () => ({
      frame: { boxPadding: 10, boxPaddingTop: 10, boxPaddingBottom: 50, boxRadius: 0, backgroundColor: 'transparent', itemGap: 16, columns: 5 },
      titleName: '猜你喜欢',
      products: { ...productsDefaults(), productNumber: 20 },
    }),
    settings: [
      { kind: 'input', key: 'titleName', label: '标题', hint: '可不填' },
      { kind: 'products', key: 'products', label: '商品设置', numberMax: 50 },
      ...containerFields(),
    ],
    summary: (m) => `${m.titleName || ''} · ${((m.products?.productIds || []) as number[]).length} 商品`,
  },
  {
    type: 'pc-home-coupon', label: '优惠券', group: '营销活动',
    note: '优惠券内容由营销-优惠券"首页显示"决定',
    defaults: () => ({
      showTitle: 0, title: '每日领券', desc: '天天优惠领不停', colorStyle: 0,
      itemBackgroundColor: '#ffffff', backgroundColor: '#ffffff',
      itemPadding: 10, boxRadius: 8, boxPadding: 10, boxPaddingTop: 5, boxPaddingBottom: 5,
    }),
    settings: [
      { kind: 'switch', key: 'showTitle', label: '显示标题栏' },
      { kind: 'input', key: 'title', label: '标题内容', showIf: (m) => Number(m.showTitle) === 1 },
      { kind: 'textarea', key: 'desc', label: '描述内容', showIf: (m) => Number(m.showTitle) === 1 },
      { kind: 'slider', key: 'itemPadding', label: '组件边距', max: 30 },
      { kind: 'slider', key: 'boxRadius', label: '圆角', max: 30 },
      { kind: 'slider', key: 'boxPadding', label: '左右边距', max: 30 },
      { kind: 'slider', key: 'boxPaddingTop', label: '上边距', max: 30 },
      { kind: 'slider', key: 'boxPaddingBottom', label: '下边距', max: 30 },
    ],
    summary: () => '展示"首页显示"的优惠券',
  },
  {
    type: 'pc-home-seckill', label: '秒杀', group: '营销活动',
    defaults: () => ({
      frame: { boxPadding: 0, boxPaddingTop: 0, boxPaddingBottom: 0, boxRadius: 0 },
      seckillTitle: '全场优惠限时9折起',
      title: standardTitle({ showTitle: 1, titlePaddingTop: 20, titlePaddingBottom: 20, titleText: '全场优惠限时9折起', titleColor: '#1a1a1a', moreType: 2, countdownLabel: '倒计时', moreColor: '#1a1a1a' }),
      goodsGap: 10,
    }),
    settings: [
      { kind: 'slider', key: 'goodsGap', label: '商品间距', max: 40 },
      { kind: 'title', key: 'title', label: '标题设置', hint: '秒杀商品由营销-秒杀决定', titleHideAlign: true },
      ...containerFields({ showInnerPadding: true }),
    ],
    summary: (m) => String(getPath(m, 'title.titleText') || m.seckillTitle || ''),
  },
  {
    type: 'pc-home-groupon', label: '拼团', group: '营销活动',
    defaults: () => ({
      style: 4, groupType: 1, cardStyle: 1, showName: 1, showPrice: 1, textAlign: 1, goodsPadding: 0,
      backgroundColor: '#ffffff', boxRadius: 0, innerPadding: 0, boxPadding: 0, boxPaddingTop: 5, boxPaddingBottom: 5,
      title: standardTitle({ showTitle: 0, titlePaddingTop: 20, titlePaddingBottom: 20, titleText: '拼团', titleColor: '#2a3145', moreType: 2, countdownLabel: '距结束', moreColor: '#1a1a1a' }),
      buyBtnStyle: 0,
      grouponActivityItem: null as unknown as Record<string, any>,
    }),
    settings: [
      { kind: 'radio', key: 'style', label: '选择模板', options: [{ label: '一行四个', value: 2 }, { label: '一行五个', value: 3 }, { label: '一行六个', value: 4 }, { label: '横向滑动', value: 6 }] },
      {
        kind: 'radio', key: 'groupType', label: '拼团类型', options: [{ label: '普通拼团', value: 1 }, { label: '阶梯拼团', value: 2 }],
        onChangeExtra: (m) => ({ ...m, grouponActivityItem: null }), // 原版：切换类型清空已选活动
      },
      { kind: 'groupon', key: 'grouponActivityItem', label: '拼团活动' },
      { kind: 'radio', key: 'cardStyle', label: '商品卡片样式', options: [{ label: '样式一', value: 1 }, { label: '样式二', value: 2 }] },
      { kind: 'radio', key: 'textAlign', label: '文本对齐', options: [{ label: '左对齐', value: 1 }, { label: '居中对齐', value: 2 }] },
      { kind: 'radio', key: 'showName', label: '显示商品名称', options: [{ label: '显示', value: 1 }, { label: '不显示', value: 0 }] },
      { kind: 'radio', key: 'showPrice', label: '显示商品价格', options: [{ label: '显示', value: 1 }, { label: '不显示', value: 0 }] },
      { kind: 'slider', key: 'goodsPadding', label: '商品边距', max: 50 },
      { kind: 'title', key: 'title', label: '标题设置', titleHideAlign: true },
      { kind: 'color', key: 'backgroundColor', label: '背景颜色', resetValue: '#ffffff' },
      { kind: 'slider', key: 'boxRadius', label: '圆角', max: 30 },
      { kind: 'slider', key: 'innerPadding', label: '内边距', max: 30 },
      { kind: 'slider', key: 'boxPadding', label: '左右边距', max: 30 },
      { kind: 'slider', key: 'boxPaddingTop', label: '上边距', max: 30 },
      { kind: 'slider', key: 'boxPaddingBottom', label: '下边距', max: 30 },
    ],
    summary: (m) => (m.grouponActivityItem ? m.grouponActivityItem.name : '未选择活动'),
  },
  {
    type: 'pc-home-hero', label: '营销通栏', group: '营销活动',
    defaults: () => ({
      frame: { boxPadding: 0, boxPaddingTop: 0, boxPaddingBottom: 0, backgroundColor: '' },
      left: {
        title: '全部商品分类',
        showCount: 11,
        categories: HERO_CATEGORIES,
        backgroundColor: '#ffffff',
        textColor: '#333333',
      },
      center: {
        banners: [demoPic('1', DEMO_PIC_1, '演示 Banner 1', '限时直降'), demoPic('2', DEMO_PIC_2, '演示 Banner 2', '新品上新')],
        modules: heroDemoModules(),
      },
      right: {
        user: { avatar: { picUrl: 'https://oss.vortmall.com/upload/c4ca4238/2026/02/09/9be6e26cd04b449a8e843df6f790d601.png', picThumb: 'https://oss.vortmall.com/upload/c4ca4238/2026/02/09/9be6e26cd04b449a8e843df6f790d601.png', picName: 'avatar' }, nickname: '欢迎来商城', welcomeText: '登录后更多精彩' },
        userCardBackground: '#ffffff',
        userCardGradientColorA: '#FFEDE1',
        userCardGradientColorB: '#FCF9F8',
        userCardGradientType: 'upDown',
        premiumMember: { show: false, title: '会员', description: '', link: { path: 'base', label: '权益卡中心', name: '权益卡中心', link: 'member/premiumMember/index' } },
        stats: [
          { label: '优惠券', value: '85' },
          { label: '余额', value: '257.58' },
          { label: '积分', value: '544' },
        ],
        shortcuts: [1, 2, 3, 4].map((n) => ({ picId: `s${n}`, picThumb: '', picUrl: '', picName: `shop_${n}`, picTitle: '进入店铺', picLink: { link: '', name: '' } })),
        shopsTitle: '店铺街',
        shopsSubTitle: 'HOT',
        shopsSubTitleBg: '#FF4E4E',
        shopsMoreText: '查看全部',
        shopsMoreLink: { link: '', name: '' },
        shopsTextColor: '#a06a38',
      },
      style: {
        height: 336, gap: 16, leftWidth: 220, rightWidth: 260,
        panelBackgroundColor: '#ffffff', panelRadius: 8, panelShadow: 1,
        titleFontSize: 14, titleColor: '#333333', mutedColor: '#999999',
        priceColor: '#e1251b', bannerRadius: 12, cardRadius: 12,
      },
    }),
    settings: [
      { kind: 'color', key: 'left.backgroundColor', label: '左侧分类背景' },
      { kind: 'color', key: 'left.textColor', label: '左侧分类文字色' },
      { kind: 'number', key: 'left.showCount', label: '分类显示条数', min: 1, max: 20 },
      { kind: 'picList', key: 'center.banners', label: '中间轮播图' },
      { kind: 'heroCards', key: 'center.modules', label: '频道卡位(6个)' },
      { kind: 'input', key: 'right.user.nickname', label: '未登录欢迎语' },
      { kind: 'input', key: 'right.user.welcomeText', label: '未登录提示语' },
      { kind: 'switch', key: 'right.premiumMember.show', label: '显示付费会员卡' },
      { kind: 'input', key: 'right.premiumMember.title', label: '会员卡标题', showIf: (m) => m.right?.premiumMember?.show === true },
      { kind: 'input', key: 'right.premiumMember.description', label: '会员卡描述', showIf: (m) => m.right?.premiumMember?.show === true },
      { kind: 'link', key: 'right.premiumMember.link', label: '会员卡链接', showIf: (m) => m.right?.premiumMember?.show === true },
      { kind: 'input', key: 'right.shopsTitle', label: '店铺街标题' },
      { kind: 'input', key: 'right.shopsSubTitle', label: '店铺街角标文字' },
      { kind: 'color', key: 'right.shopsSubTitleBg', label: '角标背景色' },
      { kind: 'picList', key: 'right.shortcuts', label: '快捷入口(≤4)' },
      { kind: 'input', key: 'right.shopsMoreText', label: '查看全部文字' },
      { kind: 'link', key: 'right.shopsMoreLink', label: '查看全部链接' },
      { kind: 'color', key: 'right.shopsTextColor', label: '店铺街文字色' },
      { kind: 'number', key: 'style.height', label: '整体高度', min: 200, max: 600 },
      { kind: 'slider', key: 'style.panelRadius', label: '面板圆角', max: 30 },
      { kind: 'color', key: 'style.panelBackgroundColor', label: '面板背景色' },
      { kind: 'slider', key: 'style.gap', label: '列间距', max: 30 },
      { kind: 'slider', key: 'style.titleFontSize', label: '标题字号', min: 12, max: 20 },
      { kind: 'color', key: 'style.titleColor', label: '标题颜色' },
      { kind: 'color', key: 'style.mutedColor', label: '弱化文字色' },
      { kind: 'color', key: 'style.priceColor', label: '价格颜色' },
      { kind: 'slider', key: 'style.bannerRadius', label: '轮播圆角', max: 30 },
      { kind: 'slider', key: 'style.cardRadius', label: '卡片圆角', max: 30 },
    ],
    summary: (m) => `三列通栏 · ${((m.center?.banners || []) as PicItem[]).length} 轮播`,
  },
  {
    type: 'pc-notice', label: '公告', group: '辅助元素',
    defaults: () => ({
      text: '公告内容',
      icoPic: { picUrl: NOTICE_ICON, picThumb: NOTICE_ICON },
      frame: { textColor: '#555555', itemBackgroundColor: '#fff8e6', backgroundColor: '#ffffff', innerPadding: 0, itemHeight: 35, itemRadius: 4, boxRadius: 0, boxPadding: 10, boxPaddingTop: 5, boxPaddingBottom: 5 },
    }),
    settings: [
      { kind: 'input', key: 'text', label: '公告内容' },
      { kind: 'pic', key: 'icoPic', label: '公告图标', resetValue: { picUrl: NOTICE_ICON, picThumb: NOTICE_ICON } },
      { kind: 'color', key: 'frame.textColor', label: '文字颜色', resetValue: '#555555' },
      { kind: 'color', key: 'frame.itemBackgroundColor', label: '组件背景', resetValue: '#ffffff' },
      { kind: 'slider', key: 'frame.itemRadius', label: '组件圆角', max: 50 },
      { kind: 'slider', key: 'frame.itemHeight', label: '组件高度', min: 20, max: 80 },
      ...containerFields(),
    ],
    summary: (m) => String(m.text || '').slice(0, 20),
  },
  {
    type: 'pc-title-ad', label: '文本标题', group: '辅助元素',
    defaults: () => ({
      title: {
        showTitle: 1, titleStyle: 1, titleAlign: 1, titleBackground: '', titleBackground2: '',
        titleBackgroundPic: { picUrl: '', picThumb: '' }, titleRadius: 0, titleText: '标题内容',
        titleColor: '#2a3145', descText: '', descColor: '#aaaaaa', showMore: 0,
        moreLink: { link: '', title: '' }, moreColor: '#969799',
      },
      frame: standardFrame(),
    }),
    settings: [
      { kind: 'radio', key: 'title.titleStyle', label: '标题栏风格', options: [{ label: '风格一', value: 1 }, { label: '风格二', value: 2 }] },
      { kind: 'radio', key: 'title.titleAlign', label: '标题位置', options: [{ label: '居左', value: 1 }, { label: '居中', value: 2 }] },
      { kind: 'color', key: 'title.titleBackground', label: '标题背景色', resetValue: '' },
      { kind: 'slider', key: 'title.titleRadius', label: '标题圆角', max: 30 },
      { kind: 'input', key: 'title.titleText', label: '标题内容', onChangeExtra: (m) => setPath(m, 'title.showTitle', 1) },
      { kind: 'color', key: 'title.titleColor', label: '标题颜色', resetValue: '#2a3145' },
      { kind: 'input', key: 'title.descText', label: '描述内容' },
      { kind: 'color', key: 'title.descColor', label: '描述颜色', resetValue: '#aaaaaa' },
      { kind: 'radio', key: 'title.showMore', label: '显示查看更多', options: [{ label: '显示', value: 1 }, { label: '不显示', value: 0 }] },
      { kind: 'color', key: 'title.moreColor', label: '更多文字颜色', resetValue: '#969799' },
      { kind: 'link', key: 'title.moreLink', label: '更多链接' },
      ...containerFields({ showInnerPadding: true }),
    ],
    summary: (m) => String(getPath(m, 'title.titleText') || ''),
  },
  {
    type: 'pc-divider', label: '分割线', group: '辅助元素',
    defaults: () => ({
      lineType: 2, lineStyle: 1,
      frame: { textColor: '', itemBackgroundColor: '', backgroundColor: '#ffffff', innerPadding: 0, itemHeight: 10, itemRadius: 0, boxRadius: 0, boxPadding: 10, boxPaddingTop: 5, boxPaddingBottom: 5 },
    }),
    settings: [
      { kind: 'radio', key: 'lineType', label: '分割类型', options: [{ label: '空白', value: 1 }, { label: '分割线', value: 2 }] },
      { kind: 'radio', key: 'lineStyle', label: '选择样式', options: [{ label: '实线', value: 1 }, { label: '虚线', value: 2 }, { label: '点状线', value: 3 }] },
      { kind: 'slider', key: 'frame.itemHeight', label: '组件高度', min: 0, max: 100 },
      ...containerFields(),
    ],
    summary: (m) => (Number(m.lineType) === 1 ? '空白' : '分割线'),
  },
  {
    type: 'pc-spacer', label: '空白辅助', group: '辅助元素',
    defaults: () => ({
      frame: { boxPadding: 0, boxPaddingTop: 0, boxPaddingBottom: 0, boxRadius: 0 },
      backgroundColor: '#ffffff',
      blankHeight: 30,
    }),
    settings: [
      { kind: 'color', key: 'backgroundColor', label: '背景颜色', resetValue: '#ffffff' },
      { kind: 'slider', key: 'blankHeight', label: '高度', min: 0, max: 200 },
      // 原版 ModuleContainerSettings hide-background-color：自身已有背景色字段，容器设置里不再重复
      ...containerFields().filter((f) => f.key !== 'frame.backgroundColor'),
    ],
    summary: (m) => `高 ${m.blankHeight}px`,
  },
];

/* ===================== 旧版模块集（camelCase，仅兼容历史数据编辑） ===================== */

const LEGACY_MODULE_DEFS: ModuleDef[] = [
  { type: 'pcBanner', label: '轮播Banner', group: '旧版', legacy: true, defaults: () => ({ bannerStyle: 1, showCat: 1, logo: { picUrl: '', picThumb: '' }, picList: [], picList2: [], picList3: [] }), settings: [{ kind: 'radio', key: 'bannerStyle', label: '风格', options: [{ label: '默认风格', value: 1 }, { label: '简约风格', value: 2 }] }, { kind: 'switch', key: 'showCat', label: '显示分类' }, { kind: 'pic', key: 'logo', label: 'LOGO' }, { kind: 'picList', key: 'picList', label: '轮播大图' }, { kind: 'picList', key: 'picList2', label: '轮播图2' }, { kind: 'picList', key: 'picList3', label: '轮播图3' }], summary: (m) => `${((m.picList || []) as PicItem[]).length} 图` },
  { type: 'pcBanner2', label: '轮播Banner2', group: '旧版', legacy: true, defaults: () => ({ bannerStyle: 1, showCat: 1, logo: { picUrl: '', picThumb: '' }, picList: [], picList2: [], picList3: [] }), settings: [{ kind: 'radio', key: 'bannerStyle', label: 'Banner风格', options: [{ label: '默认风格', value: 1 }, { label: '简约风格', value: 2 }] }, { kind: 'switch', key: 'showCat', label: '显示分类' }, { kind: 'pic', key: 'logo', label: 'LOGO' }, { kind: 'picList', key: 'picList', label: '轮播图' }, { kind: 'picList', key: 'picList2', label: '轮播图2' }, { kind: 'picList', key: 'picList3', label: '轮播图3' }], summary: (m) => `${((m.picList || []) as PicItem[]).length} 图` },
  { type: 'pcGroupBanner', label: '分组轮播Banner', group: '旧版', legacy: true, defaults: () => ({ bannerStyle: 1, showCat: 1, logo: { picUrl: '', picThumb: '' }, picList: [], picList2: [], picList3: [], number: undefined as unknown as number }), settings: [{ kind: 'radio', key: 'bannerStyle', label: 'Banner风格', options: [{ label: '默认风格', value: 1 }, { label: '简约风格', value: 2 }] }, { kind: 'switch', key: 'showCat', label: '显示分类' }, { kind: 'pic', key: 'logo', label: 'LOGO' }, { kind: 'picList', key: 'picList', label: 'Banner图' }, { kind: 'number', key: 'number', label: '一组显示数量', min: 1, max: 3 }], summary: (m) => `每组 ${m.number || '-'}` },
  { type: 'pcImageAd', label: '通宽广告图', group: '旧版', legacy: true, defaults: () => ({ picList: [], boxPaddingTop: 10, boxPaddingBottom: 10 }), settings: [{ kind: 'picList', key: 'picList', label: '广告图' }, { kind: 'slider', key: 'boxPaddingTop', label: '上边距', max: 30 }, { kind: 'slider', key: 'boxPaddingBottom', label: '下边距', max: 30 }], summary: (m) => `${((m.picList || []) as PicItem[]).length} 图` },
  { type: 'pcCustomAd1', label: '自定义模块一', group: '旧版', legacy: true, defaults: () => ({ picList: [], picList2: [], picList3: [] }), settings: [{ kind: 'picList', key: 'picList', label: '左侧大图' }, { kind: 'picList', key: 'picList2', label: '中间每日推荐', picDesc: true }, { kind: 'picList', key: 'picList3', label: '右侧热销精品', picDesc: true }], summary: () => '三列自定义' },
  { type: 'pcCustomAd2', label: '自定义模块二', group: '旧版', legacy: true, defaults: () => ({ linkList: [], picList: [], picList2: [], picList3: [] }), settings: [{ kind: 'picList', key: 'picList', label: '左侧大图' }, { kind: 'linkList', key: 'linkList', label: '左侧链接' }, { kind: 'picList', key: 'picList2', label: '中间广告图', picDesc: true }, { kind: 'picList', key: 'picList3', label: '右侧广告图', picDesc: true }], summary: () => '三列自定义' },
  { type: 'pcCatProductNormal', label: '分类商品-窄', group: '旧版', legacy: true, defaults: () => ({ categoryId: 0, title: '', shortTitle: '', enTitle: '', color: '', color2: '', logo: { picUrl: '', picThumb: '' }, picList: [], picList2: [] }), settings: [{ kind: 'category', key: 'categoryId', label: '选择分类' }, { kind: 'input', key: 'title', label: '标题名称' }, { kind: 'input', key: 'shortTitle', label: '标题短名称' }, { kind: 'input', key: 'enTitle', label: '标题英文简称' }, { kind: 'color', key: 'color', label: '模块主颜色' }, { kind: 'color', key: 'color2', label: '模块副颜色(渐变)' }, { kind: 'picList', key: 'picList', label: '左侧轮播图', picDesc: true }, { kind: 'picList', key: 'picList2', label: '右侧四小图', picDesc: true }], summary: (m) => String(m.title || '') },
  { type: 'pcCatProductWide', label: '分类商品-宽', group: '旧版', legacy: true, defaults: () => ({ categoryId: 0, childCategoryIds: [] as number[], title: '', shortTitle: '', enTitle: '', color: '', color2: '', logo: { picUrl: '', picThumb: '' }, picList: [], picList2: [], productIds: [], linkList: [] }), settings: [{ kind: 'categoryMulti', key: 'categoryId', label: '选择分类' }, { kind: 'categoryMulti', key: 'childCategoryIds', label: '选择子分类显示' }, { kind: 'input', key: 'title', label: '标题名称' }, { kind: 'input', key: 'shortTitle', label: '标题短名称' }, { kind: 'input', key: 'enTitle', label: '标题英文简称' }, { kind: 'color', key: 'color', label: '模块主颜色' }, { kind: 'color', key: 'color2', label: '模块副颜色(渐变)' }, { kind: 'picList', key: 'picList', label: '左侧轮播图', picDesc: true }, { kind: 'linkList', key: 'linkList', label: '左侧轮播下方链接' }, { kind: 'picList', key: 'picList2', label: '中间6广告图', picDesc: true }, { kind: 'productIds', key: 'productIds', label: '右侧热门商品' }], summary: (m) => String(m.title || '') },
  { type: 'pcCatProductSimple', label: '分类商品-简约', group: '旧版', legacy: true, defaults: () => ({ baseStyle: 1, title: '', products: { productSelectType: 1, productCategoryId: 1, productNumber: 8, productIds: [], productTag: '' }, moreLink: '', picList: [] }), settings: [{ kind: 'radio', key: 'baseStyle', label: '风格选择', options: [{ label: '风格一', value: 1 }, { label: '风格二', value: 2 }] }, { kind: 'input', key: 'title', label: '标题名称' }, { kind: 'link', key: 'moreLink', label: '更多链接' }, { kind: 'picList', key: 'picList', label: '添加左侧大图' }, { kind: 'products', key: 'products', label: '商品设置' }], summary: (m) => String(m.title || '') },
  { type: 'pcRecommendProduct', label: '推荐商品-瀑布流', group: '旧版', legacy: true, defaults: () => ({ titleName: '', products: { productNumber: 50, productIds: [] } }), settings: [{ kind: 'input', key: 'titleName', label: '标题' }, { kind: 'products', key: 'products', label: '商品设置', numberMin: 20, numberStep: 10 }, { kind: 'switch', key: 'showTitle', label: '显示标题' }], summary: (m) => String(m.titleName || '') },
  { type: 'pcSeckill', label: '秒杀模块', group: '旧版', legacy: true, defaults: () => ({ seckillTitle: '全场优惠限时9折起' }), settings: [{ kind: 'input', key: 'seckillTitle', label: '活动标题' }], summary: (m) => String(m.seckillTitle || '') },
  { type: 'pcCoupon', label: '优惠券模块', group: '旧版', legacy: true, note: '内容由营销-优惠券"首页显示"决定', defaults: () => ({}), settings: [], summary: () => '优惠券' },
  { type: 'pcGroupon', label: '拼团', group: '旧版', legacy: true, defaults: () => ({ style: 2, goodsStyle: 1, goodsRadioStyle: 1, textAlign: 1, textWeight: 1, goodsNameRow: 2, goodsNamePadding: 1, showName: 1, showBrief: 1, showPrice: 1, goodsPadding: 5, buyBtnStyle: 1, backgroundColor: '', boxRadius: 0, innerPadding: 0, boxPadding: 10, boxPaddingTop: 5, boxPaddingBottom: 5, frame: { textColor: '', itemBackgroundColor: '', backgroundColor: '#ffffff', innerPadding: 0, itemHeight: 35, itemRadius: 3, boxRadius: 0, boxPadding: 10, leftAndRightPadding: 0, boxPaddingTop: 5, boxPaddingBottom: 5 }, title: { showTitle: 0, titleStyle: 1, titleAlign: 1, titleBackground: '', titleBackground2: '', titleBackgroundPic: { picUrl: '', picThumb: '' }, titleRadius: 0, titleText: '标题内容', titleColor: '', titleWeight: 'normal', descText: '', descColor: '#aaaaaa', showMore: 0, moreType: 1, countdownLabel: '', moreLink: [], moreColor: '#aaaaaa', format: { titleBackground: '', titleRadius: '' } }, groupType: 1, grouponActivityItem: undefined as unknown as Record<string, any>, cardStyle: 1 }), settings: [{ kind: 'radio', key: 'style', label: '模板', options: [{ label: '一行四个', value: 2 }, { label: '一行五个', value: 3 }, { label: '横向滑动', value: 6 }] }, { kind: 'radio', key: 'groupType', label: '拼团类型', options: [{ label: '普通拼团', value: 1 }, { label: '阶梯拼团', value: 2 }] }, { kind: 'radio', key: 'goodsStyle', label: '商品样式', options: [{ label: '标准', value: 1 }, { label: '投影', value: 2 }, { label: '描边', value: 3 }, { label: '透明底', value: 4 }] }, { kind: 'radio', key: 'goodsRadioStyle', label: '商品圆角', options: [{ label: '直角', value: 1 }, { label: '圆角', value: 2 }] }, { kind: 'radio', key: 'textAlign', label: '文本对齐', options: [{ label: '左对齐', value: 1 }, { label: '居中对齐', value: 2 }] }, { kind: 'radio', key: 'textWeight', label: '文本字重', options: [{ label: '常规体', value: 1 }, { label: '加粗体', value: 2 }] }, { kind: 'number', key: 'goodsNameRow', label: '商品名称行数', min: 1, max: 3 }, { kind: 'switch', key: 'showName', label: '显示商品名称' }, { kind: 'switch', key: 'showPrice', label: '显示商品价格' }, { kind: 'slider', key: 'goodsPadding', label: '商品间距', max: 50 }, { kind: 'slider', key: 'boxRadius', label: '模块圆角', max: 30 }, { kind: 'slider', key: 'boxPadding', label: '模块内边距', max: 30 }, { kind: 'groupon', key: 'grouponActivityItem', label: '拼团活动' }, { kind: 'color', key: 'backgroundColor', label: '背景颜色' }], summary: (m) => (m.grouponActivityItem ? m.grouponActivityItem.name : '未选择活动') },
  { type: 'pcCategoryNav', label: '分类导航', group: '旧版', legacy: true, defaults: () => ({ rowNum: 5, categoryList: [] as number[] }), settings: [{ kind: 'radio', key: 'rowNum', label: '每屏显示数量', options: [2, 3, 4, 5, 6].map((n) => ({ label: `${n}个`, value: n })) }, { kind: 'categoryMulti', key: 'categoryList', label: '已选分类' }], summary: (m) => `${((m.categoryList || []) as number[]).length} 分类` },
  { type: 'pcCategoryNav3', label: '分类导航3', group: '旧版', legacy: true, defaults: () => ({ bannerStyle: 1, showCat: 1, logo: { picUrl: '', picThumb: '' }, picList: [], picList2: [], picList3: [], imageBackgroundColor: undefined as unknown as string, titleText: undefined as unknown as string, showMore: undefined as unknown as number, showMoreText: undefined as unknown as string, moreLink: undefined as unknown as Record<string, any> }), settings: [{ kind: 'picList', key: 'picList', label: '图片卡片' }, { kind: 'color', key: 'imageBackgroundColor', label: '图片背景色' }, { kind: 'input', key: 'titleText', label: '标题内容' }, { kind: 'switch', key: 'showMore', label: '查看更多' }], summary: (m) => String(m.titleText || '') },
  { type: 'pcCatWide', label: '分类模块-宽', group: '旧版', legacy: true, defaults: () => ({ catIds: [] as number[] }), settings: [{ kind: 'categoryMulti', key: 'catIds', label: '已选分类' }], summary: (m) => `${((m.catIds || []) as number[]).length} 分类` },
];

const ALL_MODULE_DEFS = [...NEW_MODULE_DEFS, ...LEGACY_MODULE_DEFS];
const MODULE_DEF_MAP = new Map(ALL_MODULE_DEFS.map((d) => [d.type, d]));
const LEGACY_TYPES = new Set(LEGACY_MODULE_DEFS.map((d) => d.type));

const LIB_GROUPS = ['轮播横幅', '导航分类', '图片展示', '商品', '营销活动', '辅助元素'];

/** 模块库原版元数据：工具栏排序 order + iconfont 图标类（原版 index.ts 注册值） */
const LIB_META: Record<string, { order: number; icon: string }> = {
  'pc-banner2': { order: 1, icon: 'icon-banner' },
  'pc-group-banner': { order: 2, icon: 'icon-banner' },
  'pc-home-hero': { order: 4, icon: 'icon-category_nav' },
  'pc-category-nav': { order: 4, icon: 'icon-category_nav' },
  'pc-category-nav3': { order: 5, icon: 'icon-category_nav' },
  'pc-home-quick-nav': { order: 6, icon: 'icon-category_nav' },
  'pc-image-ad': { order: 10, icon: 'icon-image_nav' },
  'pc-image-nav': { order: 11, icon: 'icon-image_nav' },
  'pc-image-square-ad': { order: 12, icon: 'icon-image_square_ad' },
  'pc-image-hotarea': { order: 13, icon: 'icon-image_hotarea' },
  'pc-product': { order: 14, icon: 'icon-product' },
  'pc-product-group': { order: 15, icon: 'icon-product_grouping' },
  'pc-divider': { order: 60, icon: 'icon-white_line' },
  'pc-spacer': { order: 70, icon: 'icon-white_blank' },
  'pc-notice': { order: 72, icon: 'icon-notice' },
  'pc-title-ad': { order: 75, icon: 'icon-title_ad' },
  'pc-home-coupon': { order: 82, icon: 'icon-coupon' },
  'pc-home-groupon': { order: 83, icon: 'icon-seckill' },
  'pc-home-seckill': { order: 84, icon: 'icon-seckill' },
};

/* ===================== 编辑器组件 ===================== */

interface EditorModule {
  moduleIndex: number;
  type: string;
  url: string;
  label: string;
  isShow: boolean;
  fixed?: boolean;
  module: Record<string, any>;
}

interface PcDecorateEditorProps {
  decorateId: number;
  onExit?: () => void;
}

export default function PcDecorateEditor({ decorateId, onExit }: PcDecorateEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);
  const [title, setTitle] = useState('');
  const [pageModule, setPageModule] = useState<Record<string, any>>({});
  const [moduleList, setModuleList] = useState<EditorModule[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [panelTab, setPanelTab] = useState<'module' | 'page' | 'pcHeader'>('module');
  const [libOpen, setLibOpen] = useState(true);
  const dirtyRef = useRef(false);
  const decorateIdRef = useRef(decorateId);
  const moduleElRefs = useRef(new Map<number, HTMLElement>());
  const [railTops, setRailTops] = useState<Record<number, number>>({});

  const markDirty = () => {
    dirtyRef.current = true;
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<{
      decorateId?: number;
      decorateTitle?: string;
      data?: { pageModule?: Record<string, any>; moduleList?: EditorModule[] } | null;
      draftData?: { pageModule?: Record<string, any>; moduleList?: EditorModule[] } | null;
    }>('/decorate/decorate/detail', { id: decorateId, decorateType: 2, localeId: 0, parentId: 0 })
      .then((res) => {
        if (!alive) return;
        if (res?.decorateId) decorateIdRef.current = res.decorateId;
        setTitle(res?.decorateTitle || '');
        const source = res?.data || {};
        const pm: Record<string, any> = {
          type: 'page', module: {}, backgroundRepeat: '', backgroundSize: '',
          style: 0, headerStyle: 1,
          ...source.pageModule,
        };
        // 原版 commonPage dealDefault 语义：未设置时落到默认值
        if (pm.backgroundRepeat === undefined || pm.backgroundRepeat === '') pm.backgroundRepeat = 1;
        if (pm.backgroundSize === undefined || pm.backgroundSize === '') pm.backgroundSize = 1;
        if (typeof pm.title !== 'string') pm.title = '';
        // 新版头部装修默认值合并（原版 mergePcHeaderDefaults 语义）
        pm.pcHeader = { ...PC_HEADER_DEFAULTS, ...(pm.pcHeader || {}) };
        if (!pm.homeStyleVersion) pm.homeStyleVersion = 'new';
        setPageModule(pm);
        const list = Array.isArray(source.moduleList) ? source.moduleList : [];
        setModuleList(list.map((item, idx) => ({
          moduleIndex: item.moduleIndex ?? Date.now() + idx,
          type: item.type,
          url: item.url || 'pc',
          label: item.label || MODULE_DEF_MAP.get(item.type)?.label || item.type,
          isShow: item.isShow !== false,
          fixed: item.fixed,
          module: item.module || {},
        })));
      })
      .catch((e) => Toast.error(e?.message || '加载装修数据失败'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [decorateId]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // 测量各模块在滚动流中的纵向位置，供左右轨道标签/操作条对齐（原版 railTops 机制）
  useEffect(() => {
    const timer = setTimeout(() => {
      const tops: Record<number, number> = {};
      moduleElRefs.current.forEach((el, key) => {
        tops[key] = el.offsetTop;
      });
      setRailTops(tops);
    }, 80);
    return () => clearTimeout(timer);
  }, [moduleList, activeIndex, loading]);

  const buildPayload = (data: Record<string, any>) => ({
    id: decorateIdRef.current,
    decorateType: 2,
    pageType: 1,
    localeId: 0,
    parentId: 0,
    data,
  });

  const getSaveData = () => {
    const hasLegacy = moduleList.some((m) => LEGACY_TYPES.has(m.type));
    const homeStyleVersion: 'new' | 'old' = hasLegacy ? 'old' : 'new';
    const pm: any = { ...pageModule, homeStyleVersion };
    if (homeStyleVersion !== 'new') {
      delete pm.pcHeader; // 原版契约：旧版不携带头部装修
    }
    return { pageModule: pm, moduleList: moduleList.map((m) => ({ ...m })) };
  };

  const handleSave = async (mode: 'draft' | 'publish') => {
    if (!decorateIdRef.current) {
      Toast.warning('缺少装修页面 ID');
      return;
    }
    setSaving(mode);
    try {
      await apiPost(mode === 'draft' ? '/decorate/decorate/saveDraft' : '/decorate/decorate/publish', buildPayload(getSaveData()));
      Toast.success(mode === 'draft' ? '草稿已保存' : '发布成功');
      dirtyRef.current = false;
    } catch (e: any) {
      Toast.error(e?.message || '保存失败');
    } finally {
      setSaving(null);
    }
  };

  const handleRename = async () => {
    if (!title.trim()) {
      Toast.warning('页面名称不能为空');
      return;
    }
    try {
      await apiPost('/decorate/decorate/updateField', { id: decorateIdRef.current, field: 'decorateTitle', val: title.trim() });
      Toast.success('页面名称修改成功');
    } catch (e: any) {
      Toast.error(e?.message || '修改失败');
    }
  };

  /** 切换首页装修版本（原版 onSwitchHomeVersion：清空另一套模块，旧版还会清掉头部装修） */
  const switchHomeVersion = (target: 'new' | 'old') => {
    const toNew = target === 'new';
    const clearCount = toNew
      ? moduleList.filter((m) => LEGACY_TYPES.has(m.type)).length
      : moduleList.filter((m) => !LEGACY_TYPES.has(m.type)).length;
    const clearLabel = toNew ? '旧版' : '新版';
    const targetLabel = toNew ? '新版' : '旧版';
    const clearsHeader = !toNew; // 切旧版时 pcHeader 头部装修数据会随保存一并清空
    const clearParts: string[] = [];
    if (clearCount > 0) clearParts.push(`${clearCount} 个${clearLabel}模块`);
    if (clearsHeader) clearParts.push('头部装修数据');
    Modal.confirm({
      title: '切换首页装修版本',
      content: `切换到${targetLabel}后，将清空当前画布上的${clearParts.join('和') || '无关内容'}；一经预览、保存草稿或发布，将无法恢复。确认切换？`,
      okText: '确认切换',
      cancelText: '取消',
      onOk: () => {
        setModuleList((prev) => prev.filter((m) => (LEGACY_TYPES.has(m.type) ? !toNew : toNew)));
        setPageModule((prev) => {
          const next: any = { ...prev, homeStyleVersion: target };
          if (target === 'old') delete next.pcHeader;
          return next;
        });
        markDirty();
        Toast.success(`已切换到${targetLabel}首页`);
      },
    });
  };

  const addModule = (def: ModuleDef) => {
    const item: EditorModule = {
      moduleIndex: Date.now(),
      type: def.type,
      url: 'pc',
      label: def.label,
      isShow: true,
      module: def.defaults(),
    };
    setModuleList((prev) => [...prev, item]);
    setActiveIndex(-1);
    setPanelTab('module');
    markDirty();
    Toast.success(`已添加「${def.label}」`);
  };

  /** 拖拽入画布：插入到目标位置（原版 vuedraggable clone 行为） */
  const addModuleAt = (def: ModuleDef, index: number) => {
    const item: EditorModule = {
      moduleIndex: Date.now(),
      type: def.type,
      url: 'pc',
      label: def.label,
      isShow: true,
      module: def.defaults(),
    };
    setModuleList((prev) => [...prev.slice(0, index), item, ...prev.slice(index)]);
    setActiveIndex(index);
    setPanelTab('module');
    markDirty();
    Toast.success(`已添加「${def.label}」`);
  };

  const removeModule = (index: number) => {
    setModuleList((prev) => prev.filter((_, i) => i !== index));
    if (activeIndex === index) setActiveIndex(-1);
    markDirty();
  };

  const copyModule = (index: number) => {
    const clone: EditorModule = { ...JSON.parse(JSON.stringify(moduleList[index])), moduleIndex: Date.now() };
    setModuleList((prev) => [...prev.slice(0, index + 1), clone, ...prev.slice(index + 1)]);
    markDirty();
  };

  const moveModule = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= moduleList.length) return;
    setModuleList((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    if (activeIndex === index) setActiveIndex(target);
    markDirty();
  };

  const toggleShow = (index: number) => {
    setModuleList((prev) => prev.map((m, i) => (i === index ? { ...m, isShow: !m.isShow } : m)));
    markDirty();
  };

  const dropModule = (from: number, to: number) => {
    if (from === to) return;
    setModuleList((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    markDirty();
  };

  const updateActiveModule = (updater: (m: Record<string, any>) => Record<string, any>) => {
    setModuleList((prev) => prev.map((m, i) => (i === activeIndex ? { ...m, module: updater(m.module) } : m)));
    markDirty();
  };

  const activeModule = activeIndex >= 0 && activeIndex < moduleList.length ? moduleList[activeIndex] : null;
  const activeDef = activeModule ? MODULE_DEF_MAP.get(activeModule.type) : null;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f2f3f5' }}>
        <Spin size="large" tip="加载装修数据..." />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f2f3f5', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
          background: '#fff', borderBottom: '1px solid var(--semi-color-border)', flexShrink: 0,
        }}
      >
        <Button
          icon={<IconArrowLeft />}
          onClick={() => {
            if (dirtyRef.current && !window.confirm('有未保存的修改，确定离开？')) return;
            if (onExit) onExit();
            else window.location.href = `${window.location.origin}/?page=pcDecorateManage`;
          }}
        >
          返回列表
        </Button>
        <Space>
          <Input
            value={title}
            onChange={(v) => setTitle(v)}
            onBlur={handleRename}
            onEnterPress={handleRename}
            style={{ width: 280 }}
          />
          {dirtyRef.current && <Tag color="orange">未保存</Tag>}
          {getSaveData().pageModule.homeStyleVersion === 'new' ? <Tag color="green">新版装修</Tag> : <Tag color="grey">旧版兼容</Tag>}
        </Space>
        <div style={{ flex: 1 }} />
        <Button icon={<IconRefresh />} onClick={() => window.open(`${window.location.origin}/?page=home`, '_blank')}>
          打开商城首页
        </Button>
        <Button theme="light" loading={saving === 'draft'} onClick={() => handleSave('draft')}>
          保存草稿
        </Button>
        <Button theme="solid" type="primary" loading={saving === 'publish'} onClick={() => handleSave('publish')}>
          保存并发布
        </Button>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* 左侧模块库（对齐原版 ModuleToolbar：单折叠分组 + 图标卡片网格 + 拖拽入画布） */}
        <div className="pc-decorate-lib">
          <div className="pc-decorate-lib__inside">
            <div className="pc-decorate-lib__head" onClick={() => setLibOpen((v) => !v)}>
              <span>PC首页模块</span>
              <span className={`pc-decorate-lib__arrow${libOpen ? ' pc-decorate-lib__arrow--open' : ''}`}>▾</span>
            </div>
            {libOpen && (
              <div className="pc-decorate-lib__list">
                {NEW_MODULE_DEFS.filter((d) => !d.hiddenInLibrary)
                  .slice()
                  .sort((a, b) => (LIB_META[a.type]?.order ?? 999) - (LIB_META[b.type]?.order ?? 999))
                  .map((def) => (
                    <Tooltip key={def.type} content={def.note || `${def.label}（点击添加，可拖入画布指定位置）`} position="right">
                      <div
                        className="pc-decorate-lib__item"
                        onClick={() => addModule(def)}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/pc-decorate-lib', def.type);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                      >
                        <span className="pc-decorate-lib__pic">
                          <i className={`iconfont-admin ${LIB_META[def.type]?.icon || 'icon-category_nav'}`} />
                        </span>
                        <span className="pc-decorate-lib__content" title={def.label}>{def.label}</span>
                      </div>
                    </Tooltip>
                  ))}
              </div>
            )}
            <div style={{ height: 50 }} />
          </div>
        </div>

        {/* 中间画布：1600px 整页无缝渲染（对齐原版 CanvasViewport，与 C 端一致） */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#eef1f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fff', borderBottom: '1px solid var(--semi-color-border)' }}>
            <Button size="small" onClick={() => { setPanelTab('page'); setActiveIndex(-1); }}>页面设置</Button>
            <Button size="small" onClick={() => { setPanelTab('pcHeader'); setActiveIndex(-1); }}>PC头部装修</Button>
            <Text type="tertiary" size="small">画布宽 1600px，与前台首页渲染一致；模块可从左侧拖入指定位置</Text>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minWidth: 'fit-content', padding: '30px 0 60px', position: 'relative' }}>
              {/* 左轨道：模块标签 */}
              <div style={{ width: 100, position: 'relative', flexShrink: 0, minHeight: 300 }}>
                {moduleList.map((item, index) => (
                  <div
                    key={item.moduleIndex}
                    className={`pc-decorate-rail-label${activeIndex === index ? ' pc-decorate-rail-label--active' : ''}`}
                    style={{ top: railTops[item.moduleIndex] ?? 0 }}
                    onClick={() => { setActiveIndex(index); setPanelTab('module'); }}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
              {/* 1600px 整页窗口（背景取页面设置） */}
              <div
                className="pc-decorate-window"
                style={{
                  background: pageModule.backgroundColor || '#fff',
                  ...(pageModule.backgroundImage?.picUrl
                    ? {
                        backgroundImage: `url(${pageModule.backgroundImage.picUrl})`,
                        backgroundRepeat: (['no-repeat', 'repeat', 'repeat-y', 'repeat-x'][Number(pageModule.backgroundRepeat) || 1] || 'no-repeat') as any,
                        backgroundSize: (['100% auto', 'auto 100%', '100% 100%'][Number(pageModule.backgroundSize) || 1] || '100% auto') as any,
                      }
                    : {}),
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const libType = e.dataTransfer.getData('text/pc-decorate-lib');
                  if (libType) {
                    const def = MODULE_DEF_MAP.get(libType);
                    if (def) addModuleAt(def, moduleList.length);
                  }
                }}
              >
                <PcHeaderPreviewStrip
                  header={pageModule.pcHeader || {}}
                  onOpen={() => { setPanelTab('pcHeader'); setActiveIndex(-1); }}
                />
                {moduleList.length === 0 && (
                  <div style={{ padding: 100, textAlign: 'center', color: '#c0c4cc' }}>暂无模块，请从左侧模块库拖入或点击添加</div>
                )}
                {moduleList.map((item, index) => {
                  const isActive = activeIndex === index;
                  const isLegacy = LEGACY_TYPES.has(item.type);
                  return (
                    <div
                      key={item.moduleIndex}
                      data-module-index={index}
                      ref={(el) => {
                        if (el) moduleElRefs.current.set(item.moduleIndex, el);
                        else moduleElRefs.current.delete(item.moduleIndex);
                      }}
                      className={`pc-decorate-module${isActive ? ' pc-decorate-module--active' : ''}${item.isShow ? '' : ' pc-decorate-module--hidden'}`}
                      style={{ position: 'relative' }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const libType = e.dataTransfer.getData('text/pc-decorate-lib');
                        if (libType) {
                          const def = MODULE_DEF_MAP.get(libType);
                          if (def) addModuleAt(def, index);
                          return;
                        }
                        const from = Number(e.dataTransfer.getData('text/pc-decorate-index'));
                        if (!Number.isNaN(from)) dropModule(from, index);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveIndex(index);
                        setPanelTab('module');
                      }}
                    >
                      {isActive && <span className="pc-decorate-module__tag">{item.label}{isLegacy ? '（旧版）' : ''}</span>}
                      <ModulePreview type={item.type} data={item.module} />
                    </div>
                  );
                })}
              </div>
              {/* 右轨道：选中模块操作条 */}
              <div style={{ width: 120, position: 'relative', flexShrink: 0, minHeight: 300 }}>
                {activeIndex >= 0 && activeIndex < moduleList.length && (
                  <div className="pc-decorate-rail-operate" style={{ top: railTops[moduleList[activeIndex]?.moduleIndex] ?? 0 }} onClick={(e) => e.stopPropagation()}>
                    <Button size="small" theme="borderless" icon={<IconChevronUp />} disabled={activeIndex === 0} onClick={() => moveModule(activeIndex, -1)} />
                    <Button size="small" theme="borderless" icon={<IconChevronDown />} disabled={activeIndex === moduleList.length - 1} onClick={() => moveModule(activeIndex, 1)} />
                    <Button size="small" theme="borderless" onClick={() => toggleShow(activeIndex)}>{moduleList[activeIndex]?.isShow ? '隐藏' : '显示'}</Button>
                    <Button size="small" theme="borderless" icon={<IconCopy />} onClick={() => copyModule(activeIndex)} />
                    <Button size="small" theme="borderless" type="danger" icon={<IconDelete />} onClick={() => removeModule(activeIndex)} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 右侧设置面板 */}
        <div style={{ width: 380, background: '#fff', borderLeft: '1px solid var(--semi-color-border)', overflowY: 'auto', padding: 16, flexShrink: 0 }}>
          {panelTab === 'page' && (
            <PageSettingsPanel
              pageModule={pageModule}
              legacyCount={moduleList.filter((m) => LEGACY_TYPES.has(m.type)).length}
              newCount={moduleList.filter((m) => !LEGACY_TYPES.has(m.type)).length}
              onChange={(next) => { setPageModule(next); markDirty(); }}
              onSwitchVersion={(target) => switchHomeVersion(target)}
            />
          )}
          {panelTab === 'pcHeader' && (
            <PcHeaderPanel header={pageModule.pcHeader || {}} onChange={(next) => { setPageModule({ ...pageModule, pcHeader: next }); markDirty(); }} />
          )}
          {panelTab === 'module' && (
            activeModule && activeDef ? (
              <ModuleSettingsPanel
                def={activeDef}
                moduleData={activeModule.module}
                onChange={(next) => updateActiveModule(() => next)}
              />
            ) : (
              <Text type="tertiary">请在画布中选择一个模块，或切换到「页面设置 / PC头部装修」</Text>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================== 画布预览（轻量真实结构渲染） ===================== */

/** 模块标题预览（对齐原版 _shared/ModuleTitle.vue：样式一/二/三 装饰、对齐、背景色、圆角、更多/倒计时） */
function PreviewTitle({ title }: { title?: Record<string, any> }) {
  if (!title || Number(title.showTitle) !== 1) return null;
  const align = Number(title.titleAlign) || 1;
  const style = Number(title.titleStyle) || 1;
  const moreColor = title.moreColor || '#969799';
  const containerStyle: Record<string, any> = {
    display: 'flex',
    alignItems: 'center',
    lineHeight: '30px',
    padding: '5px 10px 3px',
    position: 'relative',
    justifyContent: align === 2 ? 'center' : align === 3 ? 'flex-end' : 'space-between',
  };
  if (align === 3) containerStyle.flexDirection = 'row-reverse';
  if (title.titleBackground) containerStyle.backgroundColor = title.titleBackground;
  if (Number(title.titleRadius)) containerStyle.borderRadius = `${Number(title.titleRadius)}px ${Number(title.titleRadius)}px 0 0`;
  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', flexDirection: align === 2 ? 'column' : align === 3 ? 'row-reverse' : undefined, textAlign: align === 2 ? 'center' : undefined }}>
        {title.titleBackgroundPic?.picUrl ? (
          <img src={title.titleBackgroundPic.picUrl} alt="" style={{ width: 30, height: 30, marginRight: align === 2 || align === 3 ? 0 : 5, objectFit: 'contain', flexShrink: 0 }} />
        ) : null}
        <div style={{ position: 'relative', fontWeight: 700, fontSize: 16, color: title.titleColor || '#2a3145', paddingLeft: style === 2 ? 10 : undefined }}>
          {style === 2 && (
            <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 16, borderRadius: 2, background: 'linear-gradient(180deg, #155bd4 0%, #64b5f6 100%)' }} />
          )}
          {title.titleText || ''}
          {style === 3 && (
            <span style={{ position: 'absolute', left: 0, bottom: -2, width: '100%', height: 2, borderRadius: 1, background: 'linear-gradient(90deg, #155bd4 0%, transparent 100%)' }} />
          )}
        </div>
        {title.descText ? (
          <div style={{ fontSize: 12, color: title.descColor || '#aaaaaa', marginLeft: align === 2 ? 0 : 5, marginTop: align === 2 ? 2 : 0, position: 'relative', top: align === 2 ? undefined : 1 }}>
            {title.descText}
          </div>
        ) : null}
      </div>
      {Number(title.showMore) === 1 && Number(title.moreType ?? 1) === 1 && (
        <span style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: moreColor, ...(align === 2 ? { position: 'absolute' as const, right: 10 } : {}) }}>
          {getPath(title, 'moreLink.title') || getPath(title, 'moreLink.name') || '更多'} ›
        </span>
      )}
      {Number(title.moreType) === 2 && (
        <span style={{ fontSize: 12, color: moreColor, ...(align === 2 ? { position: 'absolute' as const, right: 10 } : {}) }}>{title.countdownLabel || '倒计时'} 00:00:00</span>
      )}
    </div>
  );
}

/** 模块 frame → 内联样式（背景/内边距/圆角，与 C 端渲染一致） */
function frameStyle(m: Record<string, any>): Record<string, any> {
  const f = m?.frame;
  if (!f || typeof f !== 'object') return {};
  const style: Record<string, any> = {};
  if (f.backgroundColor) style.background = f.backgroundColor;
  if (Number(f.boxRadius)) style.borderRadius = Number(f.boxRadius);
  const top = Number(f.boxPaddingTop) || 0;
  const bottom = Number(f.boxPaddingBottom) || 0;
  const side = Number(f.boxPadding) || 0;
  const inner = Number(f.leftAndRightPadding) || 0;
  style.padding = `${top}px ${side + inner}px ${bottom}px ${side + inner}px`;
  return style;
}

interface PreviewProduct {
  productId?: number;
  productName?: string;
  picUrl?: string;
  picThumb?: string;
  productPrice?: number | string;
  marketPrice?: number | string;
  minGroupPrice?: number | string;
  minGroupNum?: number | string;
  categoryId?: number;
  categoryName?: string;
  isHot?: number;
  isShow?: number;
  picUrl1?: string;
}

/** 按选品配置拉取真实商品（与原版 Preview 取数口径一致） */
function usePreviewProducts(products?: Record<string, any>) {
  const [rows, setRows] = useState<PreviewProduct[]>([]);
  const key = products ? JSON.stringify(products) : '';
  useEffect(() => {
    if (!products) {
      setRows([]);
      return;
    }
    const type = Number(products.productSelectType) || 1;
    let params: Record<string, unknown> | null = null;
    if (type === 1) {
      const ids = (products.productIds || []) as number[];
      if (!ids.length) {
        setRows([]);
        return;
      }
      params = { ids: ids.join(','), size: ids.length, page: 1, productStatus: 1, checkStatus: 1 };
    } else if (type === 2) {
      params = { categoryId: products.productCategoryId || 1, page: 1, size: products.productNumber || 10, productStatus: 1, checkStatus: 1 };
    } else {
      params = { introType: products.productTag || '', page: 1, size: products.productNumber || 10, productStatus: 1, checkStatus: 1 };
    }
    let alive = true;
    apiGet<{ records?: PreviewProduct[]; list?: PreviewProduct[] }>('/product/product/list', params)
      .then((res) => {
        if (alive) setRows(res.records || res.list || []);
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return rows;
}

/** 秒杀预览数据（原版 listForHomePreview，size 15 与 C 端分页窗口一致） */
function useSeckillPreview() {
  const [rows, setRows] = useState<PreviewProduct[]>([]);
  useEffect(() => {
    let alive = true;
    apiGet<{ records?: PreviewProduct[]; list?: PreviewProduct[] }>('/promotion/seckill/listForHomePreview', { page: 1, size: 15 })
      .then((res) => {
        if (alive) setRows(res.records || res.list || []);
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, []);
  return rows;
}

/** 拼团活动商品（promotion/groupon/item/list） */
function useGrouponItems(promotionId?: number) {
  const [rows, setRows] = useState<PreviewProduct[]>([]);
  useEffect(() => {
    if (!promotionId) {
      setRows([]);
      return;
    }
    let alive = true;
    apiGet<{ records?: PreviewProduct[]; list?: PreviewProduct[] }>('/promotion/groupon/item/list', { grouponPromotionId: promotionId, page: 1, size: 20 })
      .then((res) => {
        if (alive) setRows(res.records || res.list || []);
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, [promotionId]);
  return rows;
}

/** 热门分类（product/category/list 过滤 isHot+isShow） */
function useHotCategories() {
  const [rows, setRows] = useState<PreviewProduct[]>([]);
  useEffect(() => {
    let alive = true;
    apiGet<{ records?: PreviewProduct[]; list?: PreviewProduct[] }>('/product/category/list', { page: 1, size: 100, parentId: -1 })
      .then((res) => {
        if (!alive) return;
        const all = res.records || res.list || [];
        setRows(all.filter((c) => Number(c.isHot) === 1 && Number(c.isShow) === 1));
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, []);
  return rows;
}

/** C 端风格商品卡（真实数据） */
function ProductCards({
  rows,
  cols,
  emptyHint,
  priceField = 'productPrice',
  groupMode = false,
}: {
  rows: PreviewProduct[];
  cols: number;
  emptyHint?: string;
  priceField?: string;
  groupMode?: boolean;
}) {
  if (!rows.length) {
    return <div style={{ padding: 30, textAlign: 'center', color: '#c0c4cc', fontSize: 13 }}>{emptyHint || '暂无商品数据'}</div>;
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10, padding: 10 }}>
      {rows.slice(0, 30).map((p, i) => (
        <div key={p.productId ?? i} style={{ background: '#fff', borderRadius: 6, overflow: 'hidden', border: '1px solid #f2f3f5' }}>
          <div style={{ aspectRatio: '1 / 1', background: '#f7f8fa', overflow: 'hidden' }}>
            {(p.picThumb || p.picUrl) && <img src={p.picThumb || p.picUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div style={{ padding: 6 }}>
            {p.productName && (
              <div style={{ fontSize: 12, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: Number(cols) >= 4 ? 'nowrap' : 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                {p.productName}
              </div>
            )}
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ color: '#e1251b', fontWeight: 700, fontSize: 14 }}>
                ¥{Number((p as any)[priceField] ?? p.productPrice ?? 0).toFixed(2)}
              </span>
              {groupMode && p.minGroupNum ? <span style={{ fontSize: 11, color: '#999' }}>{p.minGroupNum}人团</span> : null}
              {p.marketPrice && Number(p.marketPrice) > 0 ? (
                <span style={{ fontSize: 11, color: '#999', textDecoration: 'line-through' }}>¥{Number(p.marketPrice).toFixed(2)}</span>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ModulePreview({ type, data }: { type: string; data: Record<string, any> }) {
  const m = data || {};
  switch (type) {
    case 'pc-banner2': {
      // 对齐原版 dec-pc-banner2：frame 内边距在外层，背景色/圆角在内层，一屏 1~3 张、间距 12
      const pics = (m.picList || []) as PicItem[];
      const f = (m.frame || {}) as Record<string, any>;
      const num = Math.min(3, Math.max(1, Number(m.number) || 1));
      if (!pics.length) {
        return (
          <div style={{ height: 280, border: '1px dashed #dcdfe6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', color: '#909399', fontSize: 14 }}>
            点击添加轮播Banner2
          </div>
        );
      }
      return (
        <div style={{ padding: `${Number(f.boxPaddingTop) || 0}px ${Number(f.boxPadding) || 0}px ${Number(f.boxPaddingBottom) || 0}px` }}>
          <div style={{ width: '100%', overflow: 'hidden', borderRadius: Number(f.boxRadius) || 8, background: f.backgroundColor || '#eeeeee' }}>
            <div style={{ display: 'flex', gap: num > 1 ? 12 : 0 }}>
              {pics.slice(0, num).map((p, i) => (
                <div key={i} style={{ flex: 1, minWidth: 0 }}>
                  {p.picUrl ? (
                    <img src={p.picUrl} alt="" style={{ display: 'block', width: '100%', height: 'auto', objectFit: 'contain', objectPosition: 'center', backgroundColor: '#eeeeee' }} />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '1264 / 280', background: '#eeeeee' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    case 'pc-group-banner': {
      // 对齐原版 dec-pc-group-banner：外层 frame 背景/圆角，内层固定高 slideHeight，图片 cover、间隙 30
      const pics = (m.picList || []) as PicItem[];
      const f = (m.frame || {}) as Record<string, any>;
      const num = Math.min(3, Math.max(1, Number(m.number) || 3));
      const slideHeight = Number(f.slideHeight) || 195;
      if (!pics.length) {
        return (
          <div style={{ height: 140, border: '1px dashed #dcdfe6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', color: '#909399', fontSize: 14 }}>
            点击添加分组轮播Banner
          </div>
        );
      }
      return (
        <div style={{ padding: `${Number(f.boxPaddingTop) || 0}px ${Number(f.boxPadding ?? 10)}px ${Number(f.boxPaddingBottom) || 0}px`, backgroundColor: f.backgroundColor || 'transparent', borderRadius: Number(f.boxRadius) || 8 }}>
          <div style={{ height: slideHeight, borderRadius: Number(f.boxRadius) || 8, overflow: 'hidden', display: 'flex', gap: 30 }}>
            {pics.slice(0, num).map((p, i) => (
              <div key={i} style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', borderRadius: 8 }}>
                {p.picUrl ? <img src={p.picUrl} alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
              </div>
            ))}
          </div>
        </div>
      );
    }
    case 'pc-image-ad': {
      // 对齐原版 dec-image-ad：通宽时左右 padding 为 0，背景/圆角内外双层，图片高度自适应，间距=图片边距
      const t = Number(m.picType) || 1;
      const pics = (m.picList || []) as PicItem[];
      const radius = Number(m.picRadioStyle) === 2 ? 8 : 0;
      const f = (m.frame || {}) as Record<string, any>;
      const flux = Number(m.isFluxWidth) === 1;
      const pad = Number(m.imgPadding) || 0;
      const boxBg = f.backgroundColor || '#ffffff';
      const boxRadius = Number(f.boxRadius) || 0;
      const cols = t === 5 ? 2 : t === 6 ? 3 : t === 7 ? 4 : 1;
      let grid: JSX.Element;
      if (t === 2) {
        const perView = Math.max(1, Number(m.swiperPreView) || 1);
        grid = (
          <div style={{ borderRadius: radius, overflow: 'hidden', display: 'flex', gap: pad }}>
            {pics.slice(0, perView).map((p, i) => (
              <div key={i} style={{ flex: 1, minWidth: 0, padding: pad, boxSizing: 'border-box', borderRadius: radius, overflow: 'hidden' }}>
                {p.picUrl ? <img src={p.picUrl} alt="" style={{ display: 'block', width: '100%', height: 'auto', objectFit: 'cover', borderRadius: radius }} /> : <div style={{ width: '100%', aspectRatio: '1500 / 350', background: '#f5f5f5', borderRadius: radius }} />}
              </div>
            ))}
          </div>
        );
      } else {
        grid = (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: pad }}>
            {pics.map((p, i) => (
              <div key={i} style={{ boxSizing: 'border-box', padding: pad, width: `calc((100% - ${pad * (cols - 1)}px) / ${cols})`, borderRadius: radius, overflow: 'hidden' }}>
                {p.picUrl ? <img src={p.picUrl} alt="" style={{ display: 'block', width: '100%', height: 'auto', objectFit: 'cover', borderRadius: radius }} /> : <div style={{ width: '100%', aspectRatio: cols === 1 ? '1500 / 350' : '1 / 1', background: '#f5f5f5', borderRadius: radius }} />}
              </div>
            ))}
          </div>
        );
      }
      return (
        <div style={{ padding: `${Number(f.boxPaddingTop ?? 5)}px ${flux ? 0 : Number(f.boxPadding ?? 10)}px ${Number(f.boxPaddingBottom ?? 5)}px`, backgroundColor: boxBg, borderRadius: boxRadius }}>
          <div style={{ backgroundColor: boxBg, borderRadius: boxRadius, overflow: 'hidden' }}>
            <PreviewTitle title={m.title} />
            {pics.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f5f5f5', borderRadius: 4, color: '#999', fontSize: 12 }}>点击添加图片广告</div>
            ) : (
              grid
            )}
          </div>
        </div>
      );
    }
    case 'pc-image-nav': {
      // 对齐原版 dec-pc-image-nav：内容背景/容器背景分层，rowNum 列栅格，图片宽度 100% 高度自适应，仅图片/仅文字按 navStyle 裁剪
      const pics = (m.picList || []) as PicItem[];
      const navStyle = Number(m.navStyle) || 1;
      const navType = Number(m.navType) || 1;
      const rowNum = Math.min(6, Math.max(3, Number(m.rowNum) || 4));
      const colNum = Math.min(3, Math.max(1, Number(m.colNum) || 2));
      const f = (m.frame || {}) as Record<string, any>;
      const pad = Number(m.imgPadding ?? 8);
      const radius = Number(m.radioStyle) === 2 ? 8 : 0;
      const items = navType === 1 ? pics.slice(0, rowNum * colNum) : pics;
      return (
        <div style={{ padding: `${Number(f.boxPaddingTop ?? 5)}px ${Number(f.boxPadding ?? 10)}px ${Number(f.boxPaddingBottom ?? 5)}px`, backgroundColor: f.backgroundColor || '#ffffff' }}>
          <div style={{ backgroundColor: m.backgroundColor || '#ffffff', borderRadius: Number(f.boxRadius) || 0, overflow: 'hidden' }}>
            {items.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f5f5f5', borderRadius: 4, color: '#999', fontSize: 12 }}>点击添加图文导航</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rowNum}, minmax(0, 1fr))`, gap: pad, padding: pad, boxSizing: 'border-box' }}>
                {items.map((p, i) => (
                  <div key={i} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    {navStyle !== 3 && (p.picUrl ? (
                      <img src={p.picUrl} alt={p.picTitle || ''} style={{ display: 'block', width: '100%', height: 'auto', borderRadius: radius, background: '#f0f0f0', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: radius, background: '#f0f0f0' }} />
                    ))}
                    {navStyle !== 2 && <div style={{ fontSize: 12, color: '#333', lineHeight: 1.2, textAlign: 'center', wordBreak: 'break-all' }}>{p.picTitle}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }
    case 'pc-image-square-ad': {
      // 对齐原版 dec-image-cube：布局 4/5/6/7 为特殊拼版，1/2/3 为等分栅格；间距=图片边距，内容区带左右内边距
      const pics = ((m.picList || []) as PicItem[]).map((p) => p || ({} as PicItem));
      const t = Number(m.picType) || 1;
      const f = (m.frame || {}) as Record<string, any>;
      const pad = Number(m.imgPadding) || 0;
      const boxBg = f.backgroundColor || '#ffffff';
      const boxRadius = Number(f.boxRadius) || 0;
      const inner = Number(f.leftAndRightPadding) || 0;
      const cubeImg = (p?: PicItem, fill?: boolean) => (
        <div style={{ overflow: 'hidden', ...(fill ? { height: '100%' } : {}) }}>
          {p?.picUrl ? <img src={p.picUrl} alt="" style={{ display: 'block', width: '100%', height: fill ? '100%' : 'auto', objectFit: 'cover' }} /> : <div style={{ width: '100%', aspectRatio: fill ? undefined : '1 / 1', height: fill ? '100%' : undefined, minHeight: fill ? 80 : undefined, background: '#f5f5f5' }} />}
        </div>
      );
      let body: JSX.Element;
      if (t === 5) {
        // 左一右二
        body = (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: pad, alignItems: 'stretch' }}>
            <div style={{ minHeight: 120 }}>{cubeImg(pics[0], true)}</div>
            <div style={{ display: 'grid', gridTemplateRows: 'repeat(2, 1fr)', gap: pad }}>{cubeImg(pics[1], true)}{cubeImg(pics[2], true)}</div>
          </div>
        );
      } else if (t === 7) {
        // 上一下二
        body = (
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: pad }}>
            {cubeImg(pics[0])}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: pad }}>{cubeImg(pics[1])}{cubeImg(pics[2])}</div>
          </div>
        );
      } else if (t === 6) {
        // 左一右三
        body = (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: pad, alignItems: 'stretch' }}>
            <div style={{ minHeight: 120 }}>{cubeImg(pics[0], true)}</div>
            <div style={{ display: 'grid', gridTemplateRows: 'repeat(2, 1fr)', gap: pad }}>
              {cubeImg(pics[1], true)}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: pad }}>{cubeImg(pics[2], true)}{cubeImg(pics[3], true)}</div>
            </div>
          </div>
        );
      } else if (t === 4) {
        // 左二右二：列优先排布（左列 1/2，右列 3/4）
        body = (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gridAutoFlow: 'column', gap: pad }}>
            {cubeImg(pics[0], true)}{cubeImg(pics[1], true)}{cubeImg(pics[2], true)}{cubeImg(pics[3], true)}
          </div>
        );
      } else {
        const cols = t === 2 ? 3 : t === 3 ? 4 : 2;
        body = (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: pad }}>
            {pics.map((p, i) => (
              <div key={i}>{cubeImg(p)}</div>
            ))}
          </div>
        );
      }
      return (
        <div style={{ padding: `${Number(f.boxPaddingTop ?? 5)}px ${Number(f.boxPadding ?? 10)}px ${Number(f.boxPaddingBottom ?? 5)}px` }}>
          <div style={{ backgroundColor: boxBg, borderRadius: boxRadius, overflow: 'hidden', padding: inner }}>
            <PreviewTitle title={m.title} />
            {pics.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f5f5f5', borderRadius: 4, color: '#999', fontSize: 12 }}>点击添加图片魔方</div>
            ) : (
              <div style={{ overflow: 'hidden' }}>{body}</div>
            )}
          </div>
        </div>
      );
    }
    case 'pc-image-hotarea':
      return <HotareaPreview data={m} />;
    case 'pc-home-quick-nav':
      return <QuickNavPreview data={m} />;
    case 'pc-category-nav':
      return <CategoryNavPreview data={m} />;
    case 'pc-category-nav3':
      return <CategoryNav3Preview data={m} />;
    case 'pc-product': {
      return <ProductPreview data={m} />;
    }
    case 'pc-product-group': {
      return <ProductGroupPreview data={m} />;
    }
    case 'pc-recommend-product': {
      return <RecommendPreview data={m} />;
    }
    case 'pc-divider':
      return <DividerPreview data={m} />;
    case 'pc-spacer':
      return <SpacerPreview data={m} />;
    case 'pc-notice':
      return <NoticePreview data={m} />;
    case 'pc-title-ad':
      return <TitleAdPreview data={m} />;
    case 'pc-home-coupon':
      return <CouponPreview data={m} />;
    case 'pc-home-seckill':
      return <SeckillPreview data={m} />;
    case 'pc-home-groupon':
      return <GrouponPreview data={m} />;
    case 'pc-home-hero':
      return <HeroPreview data={m} />;

    default:
      return <span>{MODULE_DEF_MAP.get(type)?.summary ? MODULE_DEF_MAP.get(type)!.summary!(data) : type}</span>;
  }
}

/* ---- 真实数据预览子组件（hooks 按实例隔离） ---- */

/** 热图绘制预览（对齐原版 dec-image-hotarea：图片纵向堆叠，热区按 500px 基准随容器宽度等比缩放） */
function HotareaPreview({ data }: { data: Record<string, any> }) {
  const pics = (data.picList || []) as Array<PicItem & { hotarea?: Array<Record<string, any>> }>;
  const f = (data.frame || {}) as Record<string, any>;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [wrapWidth, setWrapWidth] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWrapWidth(Number((entry.target as HTMLElement).offsetWidth.toFixed(2)));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [pics.length]);
  const scale = (v?: number) => ((wrapWidth || 0) / 500) * (Number(v) || 0);
  return (
    <div style={{ padding: `${Number(f.boxPaddingTop ?? 5)}px ${Number(f.boxPadding ?? 10)}px ${Number(f.boxPaddingBottom ?? 5)}px` }}>
      <div style={{ backgroundColor: f.backgroundColor || '#ffffff', borderRadius: Number(f.boxRadius) || 0, overflow: 'hidden', padding: Number(f.leftAndRightPadding) || 0 }}>
        <PreviewTitle title={data.title} />
        {pics.length === 0 ? (
          <div style={{ paddingTop: 30, paddingBottom: 50, textAlign: 'center', backgroundColor: '#f2f4f6', color: '#666', fontSize: 14 }}>
            <div style={{ width: 100, height: 100, margin: '0 auto 10px', background: '#e5e9f0', borderRadius: 8 }} />
            点击添加热图绘制
          </div>
        ) : (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: Number(data.imgPadding) || 0 }}>
              {pics.map((pic, pi) => (
                <div key={pi} style={{ position: 'relative', overflow: 'hidden' }} ref={pi === 0 ? wrapRef : undefined}>
                  {pic.picUrl ? (
                    <img src={pic.picUrl} alt={pic.picTitle || ''} style={{ display: 'block', width: '100%', height: 'auto', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', paddingTop: '40%', background: '#f2f4f6' }} />
                  )}
                  {(pic.hotarea || []).map((h, hi) => (
                    <div
                      key={hi}
                      style={{
                        position: 'absolute',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(21, 91, 212, 0.6)',
                        color: '#fff',
                        boxSizing: 'border-box',
                        border: '1px solid transparent',
                        width: scale(h.width),
                        height: scale(h.height),
                        top: scale(h.top),
                        left: scale(h.left),
                      }}
                    >
                      <span style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px' }}>{h.link?.name || ''}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 商品模块预览（对齐原版 dec-pc-product：4/5 列栅格 gap 12、商品边距包裹层、卡片描边、名称/描述/价格开关） */
function ProductPreview({ data }: { data: Record<string, any> }) {
  const rows = usePreviewProducts(data.products);
  const f = (data.frame || {}) as Record<string, any>;
  const cols = Number(data.style) === 2 ? 5 : 4;
  const hasData = Number(data.products?.productSelectType || 0) === 1
    ? ((data.products?.productIds || []) as number[]).length > 0
    : Number(data.products?.productSelectType || 0) > 0;
  return (
    <div style={{ padding: `${Number(f.boxPaddingTop ?? 5)}px ${Number(f.boxPadding ?? 10)}px ${Number(f.boxPaddingBottom ?? 5)}px`, backgroundColor: f.backgroundColor || data.backgroundColor || '#ffffff', borderRadius: Number(f.boxRadius) || 0 }}>
      <div style={{ padding: `0 ${Number(f.leftAndRightPadding) || 0}px` }}>
        <PreviewTitle title={data.title} />
        {!hasData || rows.length === 0 ? (
          <div style={{ paddingTop: 30, paddingBottom: 50, textAlign: 'center', backgroundColor: '#f2f4f6', color: '#666', fontSize: 14 }}>
            <div style={{ width: 100, height: 100, margin: '0 auto 10px', background: '#e5e9f0', borderRadius: 8 }} />
            点击添加商品
          </div>
        ) : (
          <div style={{ padding: Number(data.goodsPadding ?? 5) }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 12 }}>
              {rows.slice(0, 30).map((p, i) => (
                <div key={p.productId ?? i} style={{ minWidth: 0 }}>
                  <div style={{ display: 'block', border: '1px solid rgba(50, 50, 51, 0.08)', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
                    <div style={{ width: '100%', aspectRatio: '1 / 1', background: '#f5f5f5', overflow: 'hidden' }}>
                      {(p.picThumb || p.picUrl) && <img src={p.picThumb || p.picUrl} alt={p.productName || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                    </div>
                    <div style={{ padding: '10px 10px 12px' }}>
                      {Number(data.showName) !== 0 && (
                        <div style={{ fontSize: 13, lineHeight: '18px', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.productName}</div>
                      )}
                      {Number(data.showBrief) !== 0 && (
                        <div style={{ marginTop: 6, fontSize: 12, lineHeight: '16px', color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(p as any).brief || '商品描述'}</div>
                      )}
                      {Number(data.showPrice) !== 0 && (
                        <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, color: '#e60012' }}>¥{Number(p.productPrice ?? 0).toFixed(2)}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 推荐商品预览（对齐原版 dec-pc-recommend-product：大标题+下划线、columns/itemGap 栅格、白卡 1:1 contain 图、加购圆钮） */
function RecommendPreview({ data }: { data: Record<string, any> }) {
  const rows = usePreviewProducts(data.products);
  const f = (data.frame || {}) as Record<string, any>;
  const columns = Number(f.columns) || 5;
  const itemGap = Number(f.itemGap ?? 16);
  return (
    <div style={{ padding: `${Number(f.boxPaddingTop ?? 0)}px ${Number(f.boxPadding ?? 10)}px 0`, backgroundColor: f.backgroundColor || 'transparent', borderRadius: Number(f.boxRadius) || 0 }}>
      {!rows.length ? (
        <div style={{ minHeight: 120, borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 0 50px', textAlign: 'center', backgroundColor: '#f2f4f6', color: '#666', fontSize: 14 }}>
          <div style={{ width: 100, height: 100, margin: '0 auto 10px', background: '#e5e9f0', borderRadius: 8 }} />
          点击添加商品
        </div>
      ) : (
        <>
          {data.titleName ? (
            <h3 style={{ position: 'relative', width: 'fit-content', margin: 0, whiteSpace: 'nowrap', fontSize: 24, fontWeight: 700, color: '#333333', textAlign: 'left', paddingBottom: 4, overflow: 'hidden', display: 'flex', alignItems: 'flex-start' }}>
              {data.titleName}
              <span style={{ position: 'absolute', width: 36, left: '50%', bottom: 0, height: 3, borderRadius: 1, backgroundColor: '#1a1a1a', transform: 'translateX(-50%)' }} />
            </h3>
          ) : null}
          <div style={{ marginTop: data.titleName ? 32 : 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: itemGap, paddingBottom: Number(f.boxPaddingBottom ?? 50) }}>
            {rows.slice(0, 30).map((p, i) => (
              <div key={p.productId ?? i} style={{ boxSizing: 'border-box', width: '100%', borderRadius: 4, paddingBottom: 12, background: '#ffffff', overflow: 'hidden', border: '1px solid transparent' }}>
                <div style={{ width: '100%', aspectRatio: '1 / 1', background: '#ffffff', overflow: 'hidden' }}>
                  {(p.picThumb || p.picUrl) && <img src={p.picThumb || p.picUrl} alt={p.productName || ''} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} />}
                </div>
                <div style={{ padding: '8px 12px 0', marginTop: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 400, lineHeight: '22px', wordBreak: 'break-word', textAlign: 'left', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, color: '#19191b', minHeight: 44 }}>{p.productName}</div>
                  <div style={{ minHeight: 18, marginTop: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 400, lineHeight: '18px', color: '#888b94', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>已售 {(p as any).virtualSales ?? 0}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, minHeight: 32 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', color: '#be081d', fontWeight: 600 }}>
                      <span style={{ fontSize: 16, fontWeight: 400 }}>¥</span>
                      <span style={{ fontSize: 28, fontWeight: 600, lineHeight: '28px' }}>{Number(p.productPrice ?? 0).toFixed(2).split('.')[0]}</span>
                      <span style={{ fontSize: 16, fontWeight: 400 }}>.{Number(p.productPrice ?? 0).toFixed(2).split('.')[1] || '00'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: 32, height: 32, borderRadius: '50%', background: 'rgba(255, 63, 79, 0.12)', color: '#ff3f4f', flexShrink: 0 }}>
                      <IconPlus />
                    </div>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: '18px', color: '#269636', fontWeight: 600, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(p as any).shopTitle || '官方自营'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** 商品分组预览（对齐原版 dec-pc-product-group：分组标题栏（标题图/分割线/选中态）+ 卡片式商品列表） */
function ProductGroupPreview({ data }: { data: Record<string, any> }) {
  const groups = (data.productGroups || []) as Array<Record<string, any>>;
  const [activeIndex, setActiveIndex] = useState(0);
  const ms = data.moduleStyle || {};
  const cs = data.contentStyle || {};
  const gt = data.groupTitle || {};
  const pc = data.productColor || {};
  const listStyle = Number(data.listStyle) || 4;
  const gap = Number(pc.infoLeftRightPadding) || 0;
  const widthByStyle: Record<number, string> = { 1: '100%', 2: '50%', 3: '33.333%', 4: '25%', 6: '20%', 7: '16.666%' };
  const itemWidth = listStyle >= 1 && listStyle <= 4
    ? `calc((100% - ${gap * (listStyle - 1)}px) / ${listStyle})`
    : widthByStyle[listStyle] || `calc((100% - ${gap * 3}px) / 4)`;
  const activeGroup = groups[Math.min(activeIndex, groups.length - 1)] || groups[0];
  return (
    <div style={{ backgroundColor: ms.backgroundColor || 'transparent', padding: `${Number(ms.boxPaddingTop) || 5}px ${Number(ms.boxPadding) || 10}px ${Number(ms.boxPaddingBottom) || 5}px` }}>
      <div style={{ paddingTop: Number(cs.paddingTop) || 0, paddingBottom: Number(cs.paddingBottom) || 0, paddingLeft: Number(cs.paddingLeftRight) || 0, paddingRight: Number(cs.paddingLeftRight) || 0, borderRadius: Number(cs.boxRadius) || 0, backgroundColor: cs.backgroundColor || 'transparent', boxShadow: Number(cs.boxShadow) ? '0 2px 8px rgba(93, 113, 127, 0.08)' : undefined }}>
        {Number(gt.showTitle ?? 1) === 1 && groups.length > 0 && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: Number(gt.marginLeftRight) || 0, overflowX: 'auto', overflowY: 'hidden', flex: 1, scrollbarWidth: 'none' }}>
              {groups.map((g, i) => (
                <div
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  style={{ flex: '0 0 auto', position: 'relative', textAlign: 'center', cursor: 'pointer', display: 'flex', alignItems: 'stretch' }}
                >
                  {i > 0 && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRight: `1px solid ${gt.splitLineColor || 'transparent'}`, transform: 'scale(0.5)' }} />}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      minWidth: Number(gt.titleMinWidth) || 80,
                      padding: `${Number(gt.titlePaddingTopBottom ?? 8)}px ${Number(gt.titlePaddingLeftRight ?? 12)}px`,
                      backgroundColor: i === activeIndex ? gt.activeTitleBgColor || '#ffebf1' : 'transparent',
                      borderRadius: Number(gt.titleRadius) || 4,
                      justifyContent: 'center',
                      boxSizing: 'border-box',
                      transition: 'background-color 0.3s',
                    }}
                  >
                    {g.titlePic?.picUrl ? <img src={g.titlePic.picUrl} alt="" style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }} /> : null}
                    <span style={{ fontSize: Number(gt.bigTitleFontSize) || 14, fontWeight: 700, color: i === activeIndex ? gt.activeTitleColor || '#FF0F23' : gt.titleColor || '#444444', whiteSpace: 'nowrap', transition: 'color 0.3s' }}>{g.title}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginTop: 5, overflow: 'hidden' }}>
          {activeGroup ? (
            <GroupProductsList key={activeIndex} group={activeGroup} itemWidth={itemWidth} data={data} />
          ) : (
            <div style={{ padding: 30, textAlign: 'center', color: '#c0c4cc', fontSize: 13 }}>请在设置中添加商品分组</div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 商品分组商品列表（listStyle 定宽 + productColor/groupTitle/buyBtnStyle 变量，对齐原版 preview.less；取数口径对齐原版 fetchProductList） */
function GroupProductsList({ group, itemWidth, data }: { group: Record<string, any>; itemWidth: string; data: Record<string, any> }) {
  const listStyle = Number(data.listStyle) || 4;
  const cols = listStyle === 6 ? 5 : listStyle === 7 ? 6 : 4;
  const demoList = ((group.productList || []) as PreviewProduct[]).filter((p) => p.picThumb || p.picUrl || p.productName);
  const ids = ((group.productIds || demoList.map((p) => Number(p.productId)).filter((id) => Number(id) > 0)) || []) as number[];
  const byGroup = (group.sourceType || 'products') === 'productGroup' && Number(group.productGroupId) > 0;
  const fetched = usePreviewProducts(!byGroup && ids.length ? { productSelectType: 1, productIds: ids } : undefined);
  const [groupRows, setGroupRows] = useState<PreviewProduct[]>([]);
  const gid = Number(group.productGroupId) || 0;
  useEffect(() => {
    if (!byGroup) {
      setGroupRows([]);
      return;
    }
    let alive = true;
    apiGet<{ records?: PreviewProduct[]; list?: PreviewProduct[] }>('/product/product/list', { productGroupId: gid, page: 1, size: cols * 3 })
      .then((res) => {
        if (alive) setGroupRows(res.records || res.list || []);
      })
      .catch(() => {
        if (alive) setGroupRows([]);
      });
    return () => {
      alive = false;
    };
  }, [byGroup, gid, cols]);
  const rows = byGroup ? groupRows : fetched.length ? fetched : demoList;
  const pc = data.productColor || {};
  const gap = Number(pc.infoLeftRightPadding) || 0;
  const cardStyle = Number(data.productCardStyle) || 1;
  const buyBtn = data.buyBtnStyle || {};
  const fmtParts = (v: unknown) => {
    const num = Number(v ?? 0);
    const text = Number.isFinite(num) ? num.toFixed(2) : '0.00';
    const [int, dec] = text.split('.');
    return { int, dec };
  };
  if (!rows.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', rowGap: gap, columnGap: gap }}>
      {rows.slice(0, 30).map((p, i) => {
        const parts = fmtParts(p.productPrice);
        return (
          <div key={`${p.productId ?? 'x'}-${i}`} style={{ boxSizing: 'border-box', width: itemWidth }}>
            <div
              style={{
                display: 'block',
                overflow: 'hidden',
                padding: `${Number(data.cardPadding) || 0}px`,
                paddingBottom: 12,
                borderRadius: Number(data.cardRadius) || 4,
                backgroundColor: pc.backgroundColor || '#ffffff',
                border: cardStyle === 3 ? '1px solid #eeeeee' : '1px solid transparent',
                boxShadow: cardStyle === 2 ? '0 2px 8px rgba(93, 113, 127, 0.08)' : undefined,
                boxSizing: 'border-box',
              }}
            >
              <div style={{ position: 'relative', overflow: 'hidden', width: '100%', height: 0, paddingTop: '100%', background: '#ffffff' }}>
                {(p.picThumb || p.picUrl) && (
                  <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundImage: `url(${p.picThumb || p.picUrl})`, backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundSize: 'contain' }} />
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 156, padding: '8px 12px 0', marginTop: 8, textAlign: 'left' }}>
                {Number(data.showProductName ?? 1) !== 0 && (
                  <div
                    style={{
                      fontSize: Number(data.productNameSize) || 16,
                      fontWeight: Number(data.productNameWeight) || 400,
                      color: pc.titleColor || '#19191b',
                      lineHeight: '22px',
                      minHeight: `calc(${Number(data.productNameRow) || 1} * 22px)`,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: Number(data.productNameRow) || 1,
                      WebkitBoxOrient: 'vertical' as any,
                      wordBreak: 'break-word',
                    }}
                  >
                    {p.productName}
                  </div>
                )}
                {Number(data.showSales ?? 1) !== 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ height: 18, fontSize: 14, color: '#888b94', lineHeight: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>已售 {(p as any).virtualSales ?? 0}</div>
                  </div>
                )}
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', flex: 1, overflow: 'hidden' }}>
                    {Number(data.showProductPrice ?? 1) !== 0 && (
                      <span style={{ marginRight: 5, display: 'flex', alignItems: 'baseline', color: pc.priceColor || '#be081d', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 16, fontWeight: 400 }}>¥</span>
                        <span style={{ fontSize: 24, fontWeight: 600 }}>{parts.int}</span>
                        <span style={{ fontSize: 24, fontWeight: 600 }}>.{parts.dec}</span>
                      </span>
                    )}
                    {Number(data.crossedOutPrice ?? 1) !== 0 && Number(p.marketPrice) > 0 && (
                      <span style={{ marginLeft: 5, fontSize: 16, color: pc.crossedOutPriceColor || '#999999', position: 'relative', display: 'inline-flex', alignItems: 'baseline', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <span style={{ fontSize: 12, fontWeight: 400 }}>¥</span>
                        {Number(p.marketPrice).toFixed(2)}
                        <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: '1px solid currentColor', transform: 'translateY(-50%)' }} />
                      </span>
                    )}
                  </div>
                  {Number(buyBtn.showBtn ?? 1) !== 0 && (
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'transparent',
                        color: pc.priceColor || '#be081d',
                        borderRadius: Number(buyBtn.btnType) === 3 ? 6 : '50%',
                        flexShrink: 0,
                        paddingLeft: Number(buyBtn.btnType) === 1 ? (Number(buyBtn.paddingLeftRight) || 0) : 0,
                        paddingRight: Number(buyBtn.btnType) === 1 ? (Number(buyBtn.paddingLeftRight) || 0) : 0,
                      }}
                    >
                      {Number(buyBtn.btnType) === 1 ? <IconPlus /> : <IconCart />}
                    </span>
                  )}
                </div>
                {Number(data.showShopTag ?? 1) !== 0 && (
                  <div style={{ fontSize: 14, color: '#269636', fontWeight: 600, lineHeight: '18px', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(p as any).shopTitle || '官方自营'}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 分类导航预览（对齐原版 dec-pc-category-nav：外层 frame 留白、内层背景/圆角/固定高、一屏 displayNum 个、圆形箭头） */
function CategoryNavPreview({ data }: { data: Record<string, any> }) {
  const rows = useHotCategories();
  const f = (data.frame || {}) as Record<string, any>;
  const displayNum = Math.min(10, Math.max(1, Number(data.displayNum) || 6));
  const display = rows.slice(0, displayNum);
  return (
    <div
      style={{
        boxSizing: 'border-box',
        backgroundColor: f.backgroundColor || 'transparent',
        borderRadius: Number(f.boxRadius ?? 8),
        overflow: Number(f.boxRadius) ? 'hidden' : undefined,
        padding: `${Number(f.boxPaddingTop) || 0}px ${Number(f.boxPadding) || 0}px ${Number(f.boxPaddingBottom) || 0}px`,
      }}
    >
      <div style={{ backgroundColor: data.backgroundColor || '#f7f7f7', borderRadius: 8, height: Number(f.boxHeight ?? 328), display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
        {Number(data.showTitle) === 1 && (
          <div style={{ padding: '20px 24px', fontSize: 24, fontWeight: 700, color: '#1a1a1a' }}>{data.titleName || '热门分类'}</div>
        )}
        <div style={{ position: 'relative', flex: 1, width: '100%', minHeight: 0 }}>
          {display.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', color: '#999', fontSize: 14 }}>
              暂无热门分类（请在分类管理中勾选"热门"）
            </div>
          ) : (
            <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
              {display.map((c, i) => (
                <div key={c.categoryId ?? i} style={{ flex: 1, minWidth: 0, boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 'min(180px, 100%)', aspectRatio: '1', background: '#ecf5ff', borderRadius: 4, overflow: 'hidden' }}>
                      {((c as any).picUrl || (c as any).pic)
                        ? <img src={(c as any).picUrl || (c as any).pic} alt={c.categoryName || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Crect fill='%23f0f0f0' width='180' height='180'/%3E%3C/svg%3E" alt="" style={{ width: '100%', height: '100%', display: 'block' }} />}
                    </div>
                    <div style={{ maxWidth: 180, width: '100%', marginTop: 12, marginBottom: 8, textAlign: 'center', color: '#1a1a1a', fontSize: 16, lineHeight: '20px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                      {c.categoryName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {display.length > 0 && (
            <>
              <div className="pc-decorate-swiper-arrow pc-decorate-swiper-arrow--prev"><span /></div>
              <div className="pc-decorate-swiper-arrow pc-decorate-swiper-arrow--next"><span /></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** 快捷导航预览（对齐原版 dec-pc-home-quick-nav：frame 留白/背景 + nav_container fs_mod 图左文右横排） */
function QuickNavPreview({ data }: { data: Record<string, any> }) {
  const f = (data.frame || {}) as Record<string, any>;
  const s = (data.style || {}) as Record<string, any>;
  const items = (data.items || []) as PicItem[];
  const align = Number(s.containerAlign ?? 1);
  const justify = align === 2 ? 'center' : align === 3 ? 'flex-end' : 'flex-start';
  const iconSize = Number(s.iconSize ?? 16);
  return (
    <div
      style={{
        boxSizing: 'border-box',
        padding: `${Number(f.boxPaddingTop) || 0}px ${Number(f.boxPadding) || 0}px ${Number(f.boxPaddingBottom) || 0}px`,
        backgroundColor: f.backgroundColor || 'transparent',
        borderRadius: Number(f.boxRadius) || 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: Number(s.singleLine) === 1 ? 'nowrap' : 'wrap',
          alignItems: 'center',
          justifyContent: justify,
          gap: Number(s.itemGap ?? 20),
          overflow: 'hidden',
          lineHeight: `${Number(s.lineHeight ?? 20)}px`,
          fontWeight: Number(s.fontWeight ?? 400),
        }}
      >
        {items.length === 0 ? (
          <div style={{ padding: '16px 0', textAlign: 'center', color: '#999', fontSize: 14, width: '100%' }}>请在设置中添加导航项</div>
        ) : (
          items.map((item, i) => (
            <a
              key={item.picId || i}
              className="pc-quick-nav-item"
              style={
                {
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: Number(s.iconGap ?? 4),
                  fontSize: Number(s.fontSize ?? 14),
                  fontWeight: Number(s.fontWeight ?? 400),
                  lineHeight: `${Number(s.lineHeight ?? 20)}px`,
                  color: s.textColor || '#333333',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  '--quick-nav-hover-color': s.hoverColor || '#e1251b',
                } as Record<string, any>
              }
              title={item.picTitle || ''}
            >
              {(item.picUrl || item.picThumb) && (
                <img src={(item.picUrl || item.picThumb) as string} alt={item.picTitle || ''} style={{ flexShrink: 0, width: iconSize, height: iconSize, objectFit: 'contain' }} />
              )}
              <span style={{ flexShrink: 0 }}>{item.picTitle}</span>
            </a>
          ))
        )}
      </div>
    </div>
  );
}

/** 分类导航3预览（对齐原版 dec-pc-category-nav3：顶栏 24px 标题+更多、一屏 6 卡、图片背景色、火苗描述行） */
function CategoryNav3Preview({ data }: { data: Record<string, any> }) {
  const f = (data.frame || {}) as Record<string, any>;
  const picList = (Array.isArray(data.picList) ? data.picList : []) as PicItem[];
  const bgColor = data.backgroundColor || f.backgroundColor || 'rgba(0, 0, 0, 0.02)';
  const moduleImageBg = data.imageBackgroundColor || '';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: `${Number(f.boxPaddingTop) || 0}px ${Number(f.boxPadding) || 0}px ${Number(f.boxPaddingBottom) || 0}px`,
        height: Number(f.boxHeight ?? 352),
        borderRadius: Number(f.boxRadius ?? 8),
        backgroundColor: bgColor,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a' }}>{data.titleText || '热门推荐'}</div>
        {Number(data.showMore) === 1 && (
          <span style={{ display: 'flex', alignItems: 'center', fontSize: 16, color: '#1a1a1a' }}>
            <span style={{ lineHeight: '20px' }}>{data.showMoreText || '更多'}</span>
            <span style={{ marginLeft: 6, fontSize: 18, lineHeight: '18px' }}>&gt;</span>
          </span>
        )}
      </div>
      <div style={{ position: 'relative', flex: 1, height: '100%', width: '100%', minHeight: 0 }}>
        {picList.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 120, borderRadius: 6, padding: '30px 0 50px', textAlign: 'center', backgroundColor: '#f2f4f6', color: '#666', fontSize: 14 }}>
            <div style={{ width: 100, height: 100, margin: '0 auto 10px', background: '#e5e9f0', borderRadius: 8 }} />
            请在设置中添加内容
          </div>
        ) : (
          <div style={{ display: 'flex', width: '100%', height: '100%', overflowX: 'auto', overflowY: 'hidden', boxSizing: 'border-box', padding: '0 12px', scrollbarWidth: 'none' }}>
            {picList.map((item, i) => (
              <div key={String(item.picId || i)} style={{ boxSizing: 'border-box', flex: '0 0 calc(100% / 6)', minWidth: 0, height: '100%', padding: '0 14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ width: '100%', aspectRatio: '1', flex: '0 1 auto', minHeight: 0, backgroundColor: item.imageBackgroundColor || moduleImageBg || '#ecf5ff', borderRadius: 4, overflow: 'hidden' }}>
                    {(item.picUrl || item.picThumb)
                      ? <img src={(item.picUrl || item.picThumb) as string} alt={item.picTitle || ''} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                      : <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Crect fill='%23f0f0f0' width='180' height='180'/%3E%3C/svg%3E" alt="" style={{ width: '100%', height: '100%', display: 'block' }} />}
                  </div>
                  <div style={{ flex: 'none', width: '100%', height: 20, marginTop: 12, marginBottom: 8, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: '#1a1a1a', fontSize: 16, lineHeight: '20px' }}>
                    {item.picTitle}
                  </div>
                  {item.picDesc ? (
                    <div style={{ display: 'flex', flex: 'none', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                      <img src={HOT_FLAME_ICON} alt="" style={{ width: 16, height: 16 }} />
                      <span style={{ marginLeft: 4, color: '#888b94', fontSize: 16, lineHeight: '20px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.picDesc}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** 公告预览（对齐原版 dec-pc-notice：frame 留白/容器底 + itemHeight 圆角条 + 图标 16px） */
function NoticePreview({ data }: { data: Record<string, any> }) {
  const f = (data.frame || {}) as Record<string, any>;
  const displayText = String(data.text ?? '').trim();
  const icon = (data.icoPic || {}) as PicItem;
  return (
    <div
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: `${Number(f.boxPaddingTop ?? 5)}px ${Number(f.boxPadding ?? 10)}px ${Number(f.boxPaddingBottom ?? 5)}px`,
        background: f.backgroundColor ?? '#ffffff',
        borderRadius: Number(f.boxRadius) || 0,
      }}
    >
      <div style={{ width: '100%' }}>
        {!displayText ? (
          <div style={{ width: '100%', height: 80, border: '1px dashed #dcdfe6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
            <span style={{ color: '#909399', fontSize: 14 }}>点击添加通知公告</span>
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              height: Number(f.itemHeight) || 35,
              background: f.itemBackgroundColor ?? '#fff8e6',
              borderRadius: Number(f.itemRadius) || 0,
              color: f.textColor ?? '#555555',
              display: 'flex',
              alignItems: 'center',
              boxSizing: 'border-box',
              padding: '0 10px',
            }}
          >
            {icon.picUrl ? <img src={icon.picUrl} alt="" style={{ width: 16, height: 16, flexShrink: 0, marginRight: 8, objectFit: 'contain', display: 'block' }} /> : null}
            <div style={{ flex: 1, fontSize: 14, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayText}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 文本标题预览（对齐原版 dec-pc-title-ad：风格一/二、居左/居中、背景渐变、查看更多） */
function TitleAdPreview({ data }: { data: Record<string, any> }) {
  const t = (data.title || {}) as Record<string, any>;
  const f = (data.frame || {}) as Record<string, any>;
  const align = Number(t.titleAlign ?? 1);
  const style = Number(t.titleStyle ?? 1);
  const hasTitleText = String(t.titleText ?? '').trim().length > 0;
  const bg1 = String(t.titleBackground ?? '');
  const bg2 = String(t.titleBackground2 ?? '');
  const background = bg1 && bg2 ? `linear-gradient(to right, ${bg1}, ${bg2})` : bg1;
  const innerPadding = Number(f.leftAndRightPadding ?? 0);
  return (
    <div
      style={{
        background: f.backgroundColor ?? '#ffffff',
        borderRadius: Number(f.boxRadius) || 0,
        padding: `${Number(f.boxPaddingTop ?? 5)}px ${Number(f.boxPadding ?? 10)}px ${Number(f.boxPaddingBottom ?? 5)}px`,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ paddingLeft: innerPadding, paddingRight: innerPadding }}>
        {!hasTitleText ? (
          <div style={{ padding: '30px 0 50px', textAlign: 'center', backgroundColor: '#f2f4f6', borderRadius: 6, color: '#888', fontSize: 14 }}>点击添加标题</div>
        ) : (
          <div style={{ width: '100%' }}>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: align === 2 ? 'center' : 'space-between',
                gap: 12,
                padding: `10px ${Number(f.leftAndRightPadding ?? f.innerPadding ?? 0)}px`,
                boxSizing: 'border-box',
                overflow: 'hidden',
                borderRadius: Number(t.titleRadius) || 0,
                background: background || undefined,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: align === 2 ? 'none' : 1, overflow: 'hidden', alignItems: align === 2 ? 'center' : undefined, textAlign: align === 2 ? 'center' : undefined }}>
                <div style={{ lineHeight: '20px', fontSize: 16, fontWeight: style === 2 ? 600 : 'bold', color: t.titleColor || '#2a3145', wordBreak: 'break-all' }}>{t.titleText}</div>
                {t.descText ? (
                  <div
                    style={{
                      lineHeight: '18px',
                      paddingTop: style === 2 ? 0 : 8,
                      fontSize: style === 2 ? 16 : 12,
                      fontWeight: style === 2 ? 600 : undefined,
                      color: t.descColor || (style === 2 ? '#11bb55' : '#8c8c8c'),
                      wordBreak: 'break-all',
                    }}
                  >
                    {t.descText}
                  </div>
                ) : null}
              </div>
              {Number(t.showMore) === 1 && (
                <span
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: t.moreColor || '#969799',
                    whiteSpace: 'nowrap',
                    ...(align === 2 ? { position: 'absolute' as const, right: 0 } : {}),
                  }}
                >
                  <span>查看更多</span>
                  <span style={{ fontSize: 12, lineHeight: '12px' }}>&gt;</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 分割线预览（对齐原版 dec-divider：容器底色/圆角 + itemHeight 行高 + 实线/虚线/点状线） */
function DividerPreview({ data }: { data: Record<string, any> }) {
  const f = (data.frame || {}) as Record<string, any>;
  const lineType = Number(data.lineType ?? 2);
  const lineStyle = Number(data.lineStyle ?? 1);
  const lineNode =
    lineType === 2 ? (
      <div
        style={{
          width: '100%',
          ...(lineStyle === 2
            ? { height: 0, borderTop: '1px dashed #e5e5e5' }
            : lineStyle === 3
              ? { height: 0, borderTop: '1px dotted #e5e5e5' }
              : { height: 1, backgroundColor: '#e5e5e5' }),
        }}
      />
    ) : null;
  return (
    <div
      style={{
        boxSizing: 'border-box',
        paddingLeft: Number(f.boxPadding ?? 10),
        paddingRight: Number(f.boxPadding ?? 10),
        paddingTop: Number(f.boxPaddingTop ?? 5),
        paddingBottom: Number(f.boxPaddingBottom ?? 5),
      }}
    >
      <div style={{ backgroundColor: f.backgroundColor ?? '#ffffff', borderRadius: Number(f.boxRadius) || 0, overflow: 'hidden' }}>
        <div style={{ height: Number(f.itemHeight) || 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{lineNode}</div>
      </div>
    </div>
  );
}

/** 空白辅助预览（对齐原版 dec-pc-spacer：frame 留白 + blankHeight/背景/圆角） */
function SpacerPreview({ data }: { data: Record<string, any> }) {
  const f = (data.frame || {}) as Record<string, any>;
  return (
    <div
      style={{
        boxSizing: 'border-box',
        paddingLeft: Number(f.boxPadding) || 0,
        paddingRight: Number(f.boxPadding) || 0,
        paddingTop: Number(f.boxPaddingTop) || 0,
        paddingBottom: Number(f.boxPaddingBottom) || 0,
      }}
    >
      <div style={{ height: Number(data.blankHeight) || 30, background: data.backgroundColor || 'transparent', borderRadius: Number(f.boxRadius) || 0, boxSizing: 'border-box' }} />
    </div>
  );
}

/** 优惠券预览（对齐原版 _shared/coupon/PcCouponPreview：标题栏 + 领券中心条 + 4 张演示券 + 查看更多竖条） */
function CouponPreview({ data }: { data: Record<string, any> }) {
  const itemPadding = Number(data.itemPadding) || 0;
  const boxRadius = Number(data.boxRadius) || 0;
  const mockCoupons = [
    { type: 1, int: '5', dec: '00', name: '满60减5', desc: '可领取' },
    { type: 2, discount: '8', name: '折扣券', desc: '可领取' },
    { type: 1, int: '5', dec: '00', name: '满60减5', desc: '可领取' },
    { type: 2, discount: '8', name: '折扣券', desc: '可领取' },
  ];
  return (
    <div style={{ boxSizing: 'border-box', padding: itemPadding }}>
      <div
        style={{
          boxSizing: 'border-box',
          paddingLeft: Number(data.boxPadding ?? 10),
          paddingRight: Number(data.boxPadding ?? 10),
          paddingTop: Number(data.boxPaddingTop ?? 5),
          paddingBottom: Number(data.boxPaddingBottom ?? 5),
        }}
      >
        <div style={{ borderRadius: boxRadius, overflow: 'hidden' }}>
          {Number(data.showTitle) === 1 && (
            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', padding: '10px 0', boxSizing: 'border-box' }}>
              <div style={{ lineHeight: '20px', fontSize: 16, fontWeight: 'bold', color: '#2a3145', wordBreak: 'break-all' }}>{data.title}</div>
              {data.desc ? <div style={{ marginLeft: 5, lineHeight: '18px', color: '#8c8c8c', fontSize: 12, wordBreak: 'break-all', position: 'relative', top: 1 }}>{data.desc}</div> : null}
            </div>
          )}
          <div style={{ height: 106, display: 'flex', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', flexShrink: 0 }}>
              <div style={{ width: 153, padding: '12px 0 0 18px', borderRadius: '2px 0 0 2px', backgroundColor: '#ec3639', color: '#fff', boxSizing: 'border-box' }}>
                <div style={{ height: 30, lineHeight: '30px', fontSize: 22 }}>领券中心</div>
                <div style={{ fontSize: 14, lineHeight: '28px', color: '#f7afb0' }}>COUPON</div>
                <div style={{ margin: '8px 0 0', fontSize: 12 }}>GO <em>&gt;&gt;</em></div>
              </div>
              <div style={{ width: 15, height: 106, flexShrink: 0, background: 'linear-gradient(90deg, #ec3639 50%, transparent 50%)', opacity: 0.9 }} />
            </div>
            <div style={{ display: 'flex', flex: 1, height: 106, overflow: 'hidden', minWidth: 0 }}>
              {mockCoupons.map((c, i) => (
                <div key={i} style={{ display: 'flex', flex: 'none', width: 246, maxWidth: 246, overflow: 'hidden', minWidth: 0 }}>
                  <div style={{ display: 'block', height: 106, padding: '0 5px', boxShadow: '1px 0 2px #ccc', color: '#999', boxSizing: 'border-box', width: '100%', minWidth: 0, background: '#fff' }}>
                    <div style={{ paddingTop: 15, display: 'flex', boxSizing: 'border-box' }}>
                      <div style={{ minWidth: 95, marginTop: 3, color: '#ff7070', fontWeight: 'bold', boxSizing: 'border-box' }}>
                        {c.type === 1 ? (
                          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', lineHeight: '32px', height: 32 }}>
                            <span style={{ fontSize: 18, position: 'relative', bottom: -7, lineHeight: '32px' }}>¥</span>
                            <span style={{ fontSize: 32, fontWeight: 700, lineHeight: '32px' }}>{c.int}</span>
                            <span style={{ fontSize: 16, position: 'relative', bottom: -5, lineHeight: '32px' }}>.{c.dec}</span>
                          </div>
                        ) : (
                          <div style={{ fontWeight: 'bold', textAlign: 'center', lineHeight: '32px' }}>
                            {c.discount}<span style={{ fontSize: 12, marginLeft: 5 }}>折</span>
                          </div>
                        )}
                      </div>
                      <div style={{ color: '#999', lineHeight: '20px', flex: 1, overflow: 'hidden', paddingRight: 10, boxSizing: 'border-box' }}>
                        <p style={{ height: 20, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', margin: 0, fontSize: 14, fontWeight: 'bold', color: '#ff7070' }}>{c.name}</p>
                        <p style={{ height: 20, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', margin: 0, fontSize: 12 }}>{c.desc}</p>
                      </div>
                    </div>
                    <p style={{ borderTop: '1px solid #f3f3f3', textAlign: 'center', lineHeight: '30px', marginTop: 15, marginBottom: 0, color: '#999' }}>
                      马上领<em>&nbsp;&gt;</em>
                    </p>
                  </div>
                  <div style={{ width: 15, height: 106, flexShrink: 0, background: 'radial-gradient(circle at 0 53px, transparent 5px, #fff 5px), #fff', boxShadow: '-1px 0 2px #eee' }} />
                </div>
              ))}
              <div style={{ position: 'relative', width: 20, flexShrink: 0 }}>
                <span
                  style={{
                    height: '100%', position: 'absolute', top: -5, left: -9, overflow: 'hidden', padding: '30px 10px 0', textAlign: 'left', lineHeight: '14px', color: '#ccc',
                    writingMode: 'vertical-lr', background: 'linear-gradient(180deg, #f5f5f5, #e8e8e8)', fontSize: 12,
                  }}
                >
                  查看更多
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- 秒杀/拼团共享预览原子（对齐原版 _shared/groupon/utils + utils/titleMore） ---- */

/** 1s 心跳时钟（倒计时实时走秒） */
function useNowTick(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** "YYYY-MM-DD HH:mm:ss" → 时间戳（无效返回 0，口径同原版 dateStringToTimestamp） */
function dateStringToTimestamp(dateString?: string | null): number {
  if (!dateString) return 0;
  const parts = String(dateString).split(' ');
  const datePart = parts[0] || '';
  const timePart = parts[1] || '';
  const [year, month, day] = datePart.split('-');
  const [hour, minute, second] = timePart ? timePart.split(':') : ['0', '0', '0'];
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).getTime();
}

function parseCountdownParts(remainingMs: number) {
  return {
    days: Math.floor(remainingMs / (1000 * 60 * 60 * 24)),
    hours: Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((remainingMs % (1000 * 60)) / 1000),
  };
}

const formatNumTwo = (n: number) => String(n).padStart(2, '0');

/** 三段式价格（int/dec），口径同原版 formatPriceParts */
function priceParts(price: string | number): { int: string; dec: string } {
  const num = Number(price);
  const text = Number.isFinite(num) ? num.toFixed(2) : String(price ?? '0.00');
  const [int, dec] = text.split('.');
  return { int: int || '0', dec: dec || '00' };
}

/** 右侧「更多」箭头（原版内联 SVG） */
function TitleMoreArrow() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" style={{ display: 'block' }}>
      <path d="M5.5 2.5l5 5.5-5 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

/** 标题右侧倒计时（深色数字方块，对齐前台 countdown-box） */
function TitleCountdownBox({ label, targetTs, now, color }: { label: string; targetTs: number; now: number; color: string }) {
  const remaining = targetTs ? Math.max(0, targetTs - now) : 0;
  const { days, hours, minutes, seconds } = parseCountdownParts(remaining);
  const boxStyle: Record<string, any> = {
    display: 'inline-block', padding: '2px 0', width: 32, textAlign: 'center',
    backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 4, fontSize: 16,
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', fontSize: 18, color }}>
      <div style={{ display: 'flex', alignItems: 'center', color }}>
        <span style={{ fontSize: 18, fontWeight: 400, lineHeight: '24px' }}>{label}: </span>
        {days > 0 && (
          <>
            <span style={{ ...boxStyle, width: 'auto', minWidth: 32, padding: '2px 5px' }}>{days}</span>
            <span style={{ fontSize: 18, margin: '0 2px' }}>天</span>
          </>
        )}
        <span style={boxStyle}>{formatNumTwo(hours)}</span>
        <span style={{ margin: '0 2px' }}>:</span>
        <span style={boxStyle}>{formatNumTwo(minutes)}</span>
        <span style={{ margin: '0 2px' }}>:</span>
        <span style={boxStyle}>{formatNumTwo(seconds)}</span>
      </div>
    </div>
  );
}

/**
 * 秒杀/拼团标题栏（对齐原版 Preview.vue groupon-top/dec-pc-home-seckill__top）：
 * titleStyle 3 竖线、标题图 30px、24px 粗标题、desc 12/16px、右侧倒计时方块或「更多」链接
 */
function SeckillGrouponTitleBar({
  title,
  fallbackText,
  fallbackLabel,
  countdownTargetTs,
  activityStartTs,
  now,
  innerPaddingPx,
}: {
  title?: Record<string, any>;
  fallbackText: string;
  fallbackLabel: string;
  countdownTargetTs: number;
  activityStartTs?: number;
  now: number;
  innerPaddingPx: number;
}) {
  if (!title || Number(title.showTitle) !== 1) return null;
  const showMore = Number(title.showMore) === 1;
  const moreTypeRaw = Number(title.moreType);
  const mode = moreTypeRaw === 1 || moreTypeRaw === 2 ? moreTypeRaw : 2; // 老语义：首页模块缺省即倒计时
  const titleColor = title.titleColor || '#1a1a1a';
  const descColor = title.descColor || '#1a1a1a';
  const moreColor = title.moreColor || '#1a1a1a';
  const style = Number(title.titleStyle) || 1;
  const customLabel = String(title.countdownLabel || '').trim();
  let countdownLabel = customLabel || fallbackLabel;
  if (!customLabel && countdownTargetTs) {
    if (activityStartTs && activityStartTs > now) countdownLabel = '距开始';
    else if (countdownTargetTs - now <= 0) countdownLabel = '已结束';
  }
  const barStyle: Record<string, any> = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxSizing: 'border-box',
    padding: `${Number(title.titlePaddingTop) || 20}px ${innerPaddingPx}px ${Number(title.titlePaddingBottom) || 20}px`,
  };
  const bg1 = String(title.titleBackground || '');
  const bg2 = String(title.titleBackground2 || '');
  if (bg1 && bg2) barStyle.background = `linear-gradient(to right, ${bg1}, ${bg2})`;
  else if (bg1) barStyle.background = bg1;
  if (Number(title.titleRadius)) {
    barStyle.borderTopLeftRadius = `${Number(title.titleRadius)}px`;
    barStyle.borderTopRightRadius = `${Number(title.titleRadius)}px`;
  }
  return (
    <div style={barStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        {style === 3 && <div style={{ width: 4, height: 16, backgroundColor: '#1a1a1a', borderRadius: 8, alignSelf: 'center' }} />}
        {title.titleBackgroundPic?.picUrl ? <img src={title.titleBackgroundPic.picUrl} alt="" style={{ width: 30, height: 30, marginLeft: 10, objectFit: 'contain' }} /> : null}
        <div style={{ fontSize: 24, fontWeight: 700, color: titleColor, textTransform: 'capitalize' }}>{title.titleText || fallbackText}</div>
        {title.descText ? <div style={{ fontSize: style === 2 ? 16 : 12, color: descColor }}>{title.descText}</div> : null}
      </div>
      {showMore && mode === 2 && <TitleCountdownBox label={countdownLabel} targetTs={countdownTargetTs} now={now} color={moreColor} />}
      {showMore && mode === 1 && (
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 14, color: moreColor, cursor: 'pointer' }}>
          <span>{String(title.moreLink?.title || '').trim() || '更多'}</span>
          <span style={{ marginLeft: 4, color: 'inherit' }}><TitleMoreArrow /></span>
        </div>
      )}
    </div>
  );
}

/** 轮播左右切换按钮（对齐原版 swiper-button-prev/next 圆角半透明块 + SVG mask 箭头） */
function SwiperArrowButton({ dir, left, right }: { dir: 'prev' | 'next'; left?: number | string; right?: number | string }) {
  return (
    <div
      className={`pc-decorate-swiper-arrow pc-decorate-swiper-arrow--${dir}`}
      style={{ left, right }}
    >
      <span />
    </div>
  );
}

function SeckillPreview({ data }: { data: Record<string, any> }) {
  const rows = useSeckillPreview();
  const now = useNowTick();
  const f = (data.frame || {}) as Record<string, any>;
  const title = (data.title || {}) as Record<string, any>;
  const goodsGap = Number(data.goodsGap) || 10;
  const innerPadding = Number(f.leftAndRightPadding) || 0;
  const first = rows[0] as (PreviewProduct & { seckkillData?: { seckillEndTime?: string } }) | undefined;
  const countdownTargetTs = dateStringToTimestamp(first?.seckkillData?.seckillEndTime || '');
  const skeletonItems = [1, 2, 3, 4, 5, 6];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        boxSizing: 'border-box',
        paddingLeft: Number(f.boxPadding) || 0,
        paddingRight: Number(f.boxPadding) || 0,
        paddingBottom: 20,
        marginTop: Number(f.boxPaddingTop) || 0,
        marginBottom: Number(f.boxPaddingBottom) || 0,
        borderRadius: Number(f.boxRadius) || 0,
        backgroundColor: f.backgroundColor || '#fafafa',
        overflow: 'hidden',
      }}
    >
      <SeckillGrouponTitleBar
        title={title}
        fallbackText={data.seckillTitle || '限时秒杀'}
        fallbackLabel="倒计时"
        countdownTargetTs={countdownTargetTs}
        now={now}
        innerPaddingPx={innerPadding}
      />
      <div style={{ position: 'relative', zIndex: 1, flex: 1, width: '100%' }}>
        {rows.length > 0 ? (
          <div
            style={{
              display: 'flex',
              overflowX: 'auto',
              overflowY: 'hidden',
              width: '100%',
              padding: `0 ${innerPadding}px`,
              gap: goodsGap,
              boxSizing: 'border-box',
              scrollbarWidth: 'none',
            }}
          >
            {rows.slice(0, 15).map((p, i) => {
              const current = Number((p as any).seckillPrice ?? p.productPrice ?? 0);
              const original = Number((p as any).productPrice ?? (p as any).marketPrice ?? 0);
              const discount = original > 0 && current < original ? Math.floor(((original - current) / original) * 100 * 10) / 10 : 0;
              const parts = priceParts(current);
              return (
                <div
                  key={p.productId ?? i}
                  style={{ flexShrink: 0, boxSizing: 'border-box', position: 'relative', zIndex: 1, width: `calc((100% - ${goodsGap * 5}px) / 6)`, background: '#ffffff', borderRadius: 4 }}
                >
                  <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden' }}>
                    {(p.picThumb || p.picUrl) ? (
                      <img src={(p.picThumb || p.picUrl) as string} alt={p.productName || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Crect fill='%23f0f0f0' width='180' height='180'/%3E%3C/svg%3E" alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
                    )}
                  </div>
                  {discount > 0 && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: 5, width: 'fit-content', height: 24, lineHeight: '24px', padding: '0 6px', color: '#fff', fontSize: 14, borderRadius: 2, backgroundColor: '#ee0a24' }}>
                      优惠{discount}%
                    </div>
                  )}
                  <div style={{ height: 20, marginTop: 5, marginBottom: 8, padding: '0 5px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: '#1a1a1a', fontSize: 16, fontWeight: 700, lineHeight: '18px' }}>
                    {p.productName}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 5px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', marginRight: 8, color: '#1a1a1a', lineHeight: '28px' }}>
                      <span style={{ fontSize: 16, fontWeight: 400 }}>¥</span>
                      <span style={{ fontSize: 24, fontWeight: 700 }}>{parts.int}</span>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>.{parts.dec}</span>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                      <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: 32, height: 32, borderRadius: '50%', background: 'rgba(255, 63, 79, 0.12)', color: '#ff3f4f', flexShrink: 0, position: 'relative', cursor: 'pointer' }} title="添加购物车">
                        <span style={{ width: 18, height: 18, position: 'relative', display: 'block' }}>
                          <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', background: 'currentColor', borderRadius: 1, width: 14, height: 2 }} />
                          <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', background: 'currentColor', borderRadius: 1, width: 2, height: 14 }} />
                        </span>
                      </span>
                    </div>
                  </div>
                  {original > 0 && (
                    <div style={{ marginBottom: 10, padding: '0 5px', height: 19, color: '#888b94', fontSize: 16, textDecoration: 'line-through', lineHeight: '22px', boxSizing: 'border-box' }}>
                      ¥{Number.isFinite(original) ? original.toFixed(2) : '0.00'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', overflow: 'hidden', width: '100%', padding: `0 ${innerPadding}px`, gap: goodsGap, boxSizing: 'border-box' }}>
            {skeletonItems.map((i) => (
              <div key={i} style={{ flexShrink: 0, boxSizing: 'border-box', width: `calc((100% - ${goodsGap * 5}px) / 6)`, background: '#ffffff', borderRadius: 4 }}>
                <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)', backgroundSize: '200% 100%' }} />
                <div style={{ height: 30, marginTop: 10, borderRadius: 4, background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)', backgroundSize: '200% 100%' }} />
              </div>
            ))}
          </div>
        )}
        {rows.length > 0 && (
          <>
            <SwiperArrowButton dir="prev" left={innerPadding} />
            <SwiperArrowButton dir="next" right={innerPadding} />
          </>
        )}
      </div>
    </div>
  );
}

/** 拼团 mock 商品（无活动时展示，与原版 mockProducts 逐字段一致） */
const GROUPON_MOCK_PRODUCTS: PreviewProduct[] = [
  { productId: 1, productName: '拼团商品示例一号', picThumb: 'https://dummyimage.com/200x200/f5f5f5/999&text=1', minGroupPrice: 99, productPrice: 199, minGroupNum: 2 } as PreviewProduct,
  { productId: 2, productName: '拼团商品示例二号', picThumb: 'https://dummyimage.com/200x200/f5f5f5/999&text=2', minGroupPrice: 128, productPrice: 256, minGroupNum: 3 } as PreviewProduct,
  { productId: 3, productName: '拼团商品示例三号', picThumb: 'https://dummyimage.com/200x200/f5f5f5/999&text=3', minGroupPrice: 68, productPrice: 168, minGroupNum: 2 } as PreviewProduct,
  { productId: 4, productName: '拼团商品示例四号', picThumb: 'https://dummyimage.com/200x200/f5f5f5/999&text=4', minGroupPrice: 188, productPrice: 388, minGroupNum: 5 } as PreviewProduct,
  { productId: 5, productName: '拼团商品示例五号', picThumb: 'https://dummyimage.com/200x200/f5f5f5/999&text=5', minGroupPrice: 58, productPrice: 118, minGroupNum: 2 } as PreviewProduct,
  { productId: 6, productName: '拼团商品示例六号', picThumb: 'https://dummyimage.com/200x200/f5f5f5/999&text=6', minGroupPrice: 88, productPrice: 168, minGroupNum: 3 } as PreviewProduct,
];

/** 拼团商品卡（对齐原版 GrouponItemCard：cardStyle 1 图片倒计时条+priceBox / 2 简版价格行） */
function GrouponCard({
  item,
  cardStyle,
  textAlign,
  buyBtnStyle,
  showName,
  showPrice,
  countdownText,
  countdownLabel,
}: {
  item: PreviewProduct;
  cardStyle: number;
  textAlign: number;
  buyBtnStyle: number;
  showName: boolean;
  showPrice: boolean;
  countdownText: string;
  countdownLabel: string;
}) {
  const isCardStyle1 = cardStyle === 1;
  const groupNum = String((item as any).minGroupNum || '2');
  const groupPrice = String((item as any).minGroupPrice ?? item.productPrice ?? '0');
  const originPrice = String(item.productPrice ?? '0');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ margin: '0 auto', display: 'flex', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#f5f5f5', aspectRatio: '1 / 1', width: isCardStyle1 ? '90%' : '100%' }}>
            {(item.picThumb || item.picUrl) ? (
              <img src={(item.picThumb || item.picUrl) as string} alt={item.productName || ''} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
            ) : (
              <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f5f5f5' width='100' height='100'/%3E%3C/svg%3E" alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
            )}
          </div>
        </div>
        {isCardStyle1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(90deg, #f86e30, #e91817)', height: 34, padding: '0 10px', boxSizing: 'border-box', fontSize: 12, color: '#ffffff' }}>
            <div style={{ flex: '0 0 auto', fontWeight: 'bold', fontSize: 16, color: '#ffffff' }}>拼团</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1, gap: 6, whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: 12 }}>{countdownLabel}</div>
              {countdownText ? <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{countdownText}</div> : null}
            </div>
          </div>
        )}
      </div>
      {showName && (
        <div
          style={{
            minHeight: 20, marginTop: 10, marginBottom: isCardStyle1 ? 0 : 12,
            overflow: 'hidden', whiteSpace: 'nowrap', color: '#1a1a1a', fontSize: 16, fontWeight: 400, lineHeight: '18px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 4,
            textAlign: textAlign === 1 ? 'left' : 'center', justifyContent: textAlign === 1 ? 'flex-start' : 'center',
          }}
        >
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', color: '#ff4d4f', background: '#fff1f0', height: 16,
              padding: '0 4px', borderRadius: 2, fontSize: 12, lineHeight: '16px', fontWeight: 'normal',
              whiteSpace: 'nowrap', boxSizing: 'border-box', marginRight: 4, flexShrink: 0, transform: 'translateY(-1px)',
            }}
          >
            {groupNum}人团
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{item.productName}</span>
        </div>
      )}
      {showPrice && (
        isCardStyle1 ? (
          <div style={{ width: '100%', height: 35, background: '#fff2f3', borderRadius: 3, marginTop: 18, display: 'flex', alignItems: 'center', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <span style={{ color: '#ee0a24', fontWeight: 500, fontSize: 22, paddingLeft: 9, height: 26, display: 'flex', alignItems: 'flex-end' }}>¥{groupPrice}</span>
              <div style={{ marginLeft: 7, display: 'flex', alignItems: 'flex-end', fontWeight: 500, fontSize: 12, color: '#9a9a9a', textDecorationLine: 'line-through' }}>¥{originPrice}</div>
            </div>
            <div style={{ padding: '0 20px', height: 30, background: '#ee0a25', borderRadius: 3, fontWeight: 600, fontSize: 20, color: '#ffffff', lineHeight: '30px', marginLeft: 'auto', clipPath: 'polygon(20% 0, 100% 0, 100% 100%, 0 100%)', textAlign: 'center' }}>拼</div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', flexDirection: textAlign === 1 ? 'row' : 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ marginRight: 8, color: '#ee0a24', lineHeight: '22px', fontSize: 24, fontWeight: 600 }}>¥{groupPrice}</span>
              <span style={{ height: 19, color: '#888b94', textDecoration: 'line-through', fontSize: 14 }}>¥{originPrice}</span>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              {buyBtnStyle > 0 ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 13, background: '#ee0a24', color: '#fff', fontSize: 12 }}>
                  {buyBtnStyle === 5 || buyBtnStyle === 6 ? '购买' : buyBtnStyle === 7 || buyBtnStyle === 8 ? '马上抢' : buyBtnStyle === 3 || buyBtnStyle === 4 ? <IconPlus size="small" /> : <IconCart size="small" />}
                </span>
              ) : (
                <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: 32, height: 32, borderRadius: '50%', background: '#ecf5ff', color: '#409eff', cursor: 'pointer' }}>
                  <IconPlus size="small" />
                </span>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}

/** 拼团预览（对齐原版 dec-pc-home-groupon：root 边距/内边距 + 标题倒计时 + 2/3/4 栅格、6 横滚 + 双卡片样式 + mock 商品） */
function GrouponPreview({ data }: { data: Record<string, any> }) {
  const activity = (data.grouponActivityItem || null) as Record<string, any> | null;
  const activityId = Number(activity?.grouponPromotionId ?? activity?.grouponId) || undefined;
  const fetched = useGrouponItems(activityId);
  const now = useNowTick();

  const style = Number(data.style ?? 4);
  const isScrollLayout = style === 6;
  const cardStyle = Number(data.cardStyle ?? 1);
  const textAlign = Number(data.textAlign ?? 1);
  const buyBtnStyle = Number(data.buyBtnStyle ?? 0);
  const showName = Number(data.showName ?? 1) === 1;
  const showPrice = Number(data.showPrice ?? 1) === 1;
  const goodsPadding = Number(data.goodsPadding) || 0;

  const activityStartTs = dateStringToTimestamp(activity?.startTime || '');
  const activityEndTs = dateStringToTimestamp(activity?.endTime || '');

  // 无活动时按 style 取 mock（原版 displayProducts 口径：2→4 个，4→6 个，其余全部）
  const baseRows: PreviewProduct[] = fetched.length
    ? fetched
    : style === 2
      ? GROUPON_MOCK_PRODUCTS.slice(0, 4)
      : style === 4
        ? GROUPON_MOCK_PRODUCTS.slice(0, 6)
        : GROUPON_MOCK_PRODUCTS;
  const rows = baseRows.map((r) => ({ ...r, startTime: activity?.startTime || '', endTime: activity?.endTime || '' }));

  // 卡片倒计时文案（进行中→距结束，未开始→距开始，已结束→空）
  const cardCountdown = (item: PreviewProduct): { label: string; text: string } => {
    const startTs = dateStringToTimestamp((item as any).startTime || '');
    const endTs = dateStringToTimestamp((item as any).endTime || '');
    const started = !startTs || startTs < now;
    const ended = !!endTs && endTs < now;
    if (ended) return { label: '已结束', text: '' };
    const target = !started ? startTs : endTs;
    const remaining = target ? Math.max(0, target - now) : 0;
    if (!remaining) return { label: started ? '距结束' : '距开始', text: '' };
    const { days, hours, minutes, seconds } = parseCountdownParts(remaining);
    return { label: started ? '距结束' : '距开始', text: days > 0 ? `${days}天${formatNumTwo(hours)}:${formatNumTwo(minutes)}:${formatNumTwo(seconds)}` : `${formatNumTwo(hours)}:${formatNumTwo(minutes)}:${formatNumTwo(seconds)}` };
  };

  // 列宽（原版 itemWidth/scrollItemWidth：gap 参与宽度补偿）
  const gapComp = (perRow: number) => (goodsPadding > 0 ? `calc(${100 / perRow}% - ${(goodsPadding * (perRow - 1)) / perRow}px)` : `${100 / perRow}%`);
  const itemWidth = style === 2 ? gapComp(4) : style === 4 ? gapComp(6) : gapComp(5);

  return (
    <div
      style={{
        width: `calc(100% - ${(Number(data.boxPadding) || 0) * 2}px)`,
        boxSizing: 'border-box',
        position: 'relative',
        backgroundColor: data.backgroundColor || '#ffffff',
        borderRadius: Number(data.boxRadius) || 0,
        marginLeft: Number(data.boxPadding) || 0,
        marginRight: Number(data.boxPadding) || 0,
        marginTop: Number(data.boxPaddingTop ?? 5),
        marginBottom: Number(data.boxPaddingBottom ?? 5),
        padding: `0 ${Number(data.innerPadding) || 0}px`,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', overflow: 'hidden' }}>
        <SeckillGrouponTitleBar
          title={data.title}
          fallbackText="拼团"
          fallbackLabel="距结束"
          countdownTargetTs={activityEndTs}
          activityStartTs={activityStartTs}
          now={now}
          innerPaddingPx={0}
        />
        <div style={{ position: 'relative', zIndex: 1, flex: 1, width: '100%' }}>
          {isScrollLayout ? (
            <div style={{ position: 'relative', width: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', overflowY: 'hidden', gap: goodsPadding, padding: goodsPadding, boxSizing: 'border-box', scrollbarWidth: 'none' }}>
                {rows.map((item, index) => (
                  <div key={index} style={{ flex: '0 0 auto', boxSizing: 'border-box', position: 'relative', backgroundColor: '#ffffff', width: gapComp(6) }}>
                    <GrouponCard
                      item={item}
                      cardStyle={cardStyle}
                      textAlign={textAlign}
                      buyBtnStyle={buyBtnStyle}
                      showName={showName}
                      showPrice={showPrice}
                      countdownText={cardCountdown(item).text}
                      countdownLabel={cardCountdown(item).label}
                    />
                  </div>
                ))}
              </div>
              <SwiperArrowButton dir="prev" left={0} />
              <SwiperArrowButton dir="next" right={0} />
            </div>
          ) : (
            <div style={{ overflow: 'hidden', boxSizing: 'border-box', padding: goodsPadding }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: goodsPadding }}>
                {rows.map((item, index) => (
                  <div key={index} style={{ boxSizing: 'border-box', position: 'relative', backgroundColor: '#ffffff', width: itemWidth }}>
                    <div style={{ backgroundColor: 'transparent' }}>
                      <div style={{ backgroundColor: '#ffffff', paddingBottom: 10 }}>
                        <GrouponCard
                          item={item}
                          cardStyle={cardStyle}
                          textAlign={textAlign}
                          buyBtnStyle={buyBtnStyle}
                          showName={showName}
                          showPrice={showPrice}
                          countdownText={cardCountdown(item).text}
                          countdownLabel={cardCountdown(item).label}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 营销通栏画布预览（1:1 对齐原版 Preview.vue：API拉类目/分组商品 + 右面板逐像素还原） */



function HeaderColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <a style={{ fontSize: 12, cursor: 'pointer', color: 'var(--semi-color-primary)' }} onClick={() => onChange('')}>重置</a>
      <input
        type="color"
        value={value || '#ffffff'}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 34, height: 26, border: '1px solid var(--semi-color-border)', borderRadius: 4, cursor: 'pointer' }}
      />
    </span>
  );
}

/** 左列类目：优先取 pcCatFloor/list（PC 分类抽屉）真实数据，回退到配置项 */
function useHeroLeftCategories(configCategories: PicItem[], showCount: number) {
  const [apiCategories, setApiCategories] = useState<PicItem[]>([]);
  useEffect(() => {
    let alive = true;
    apiGet<{ records?: Array<Record<string, any>>; list?: Array<Record<string, any>> }>('/decorate/pcCatFloor/list', {
      page: 1, size: 50, sortField: 'sortOrder', sortOrder: 'asc',
    })
      .then((res) => {
        if (!alive) return;
        const raw = res.records || res.list || [];
        const mapped: PicItem[] = raw.map((item: any) => ({
          picId: String(item.picId ?? item.id ?? ''),
          picUrl: item.picUrl || item.imageUrl || '',
          picThumb: item.picThumb || item.picUrl || item.imageUrl || '',
          picName: item.picName || '',
          picTitle: item.picTitle || item.title || '类目',
          picDesc: '',
          picLink: { link: item.picLink?.link || item.link || '', name: '' },
        }));
        setApiCategories(mapped);
      })
      .catch(() => {
        if (alive) setApiCategories([]);
      });
    return () => {
      alive = false;
    };
  }, []);
  const categories = apiCategories.length ? apiCategories : configCategories;
  return categories.slice(0, Math.max(0, Math.floor(showCount)));
}

/** 卡位商品来源为 productGroup 时：分组详情拿 productIds → 按 ids 查商品（取前 2） */
function useHeroGroupProducts(cards: Array<Record<string, any>>) {
  const [groupProductsMap, setGroupProductsMap] = useState<Record<number, PreviewProduct[]>>({});
  const key = JSON.stringify(cards.map((c) => ({ src: c.productSource, gid: c.productGroupId })));
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
          const result = await apiGet<{ records?: PreviewProduct[] }>('/product/product/list', {
            ids: productIds.join(','), size: 2, page: 1,
          });
          const records = (result.records || []).map((item) => ({
            productId: item.productId,
            productName: item.productName || '',
            picUrl: item.picUrl || '',
            picThumb: item.picThumb || '',
            productPrice: item.productPrice ? `¥${item.productPrice}` : '¥0',
          }));
          return [idx, records] as const;
        } catch {
          return [idx, []] as const;
        }
      }),
    ).then((entries) => {
      if (!alive) return;
      const map: Record<number, PreviewProduct[]> = {};
      entries.forEach(([idx, rows]) => {
        map[idx] = rows as PreviewProduct[];
      });
      setGroupProductsMap(map);
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return groupProductsMap;
}

function HeroPreview({ data }: { data: Record<string, any> }) {
  const m = data || {};
  const frame = m.frame || {};
  const style = m.style || {};
  const left = m.left || {};
  const right = m.right || {};
  const center = m.center || {};

  const gap = Number(style.gap) || 16;
  const height = Number(style.height) || 336;
  const panelShadow = Number(style.panelShadow) === 1 ? '0 2px 12px 0 rgba(0,0,0,0.06)' : 'none';
  const panelBg = style.panelBackgroundColor || '#ffffff';
  const panelRadius = Number(style.panelRadius) || 8;
  const titleSize = Number(style.titleFontSize) || 14;
  const titleColor = style.titleColor || '#333333';
  const mutedColor = style.mutedColor || '#999999';
  const priceColor = style.priceColor || '#e1251b';
  const cardRadius = Number(style.cardRadius) || 12;
  const bannerRadius = Number(style.bannerRadius) || 12;

  const gradientDirMap: Record<string, string> = { upDown: 'to bottom', leftRight: 'to right', diagonal: 'to bottom right' };
  const userGradient =
    right.userCardGradientColorA && right.userCardGradientColorB
      ? `linear-gradient(${gradientDirMap[right.userCardGradientType || 'upDown'] || 'to bottom'}, ${right.userCardGradientColorA}, ${right.userCardGradientColorB})`
      : 'none';

  const showCount = Number(left.showCount) || 10;
  const configCategories = ((left.categories || []) as PicItem[]);
  const categories = useHeroLeftCategories(configCategories, showCount);

  const allModules: Array<Record<string, any>> = (center.modules || []).length ? center.modules : [];
  const promoCards = allModules.slice(0, 2);
  const channelCards = allModules.slice(2, 6);
  const banners = (center.banners || []) as PicItem[];
  const shortcuts = (right.shortcuts || []) as PicItem[];

  const groupProductsMap = useHeroGroupProducts(allModules);

  const panelStyle: Record<string, any> = { background: panelBg, borderRadius: panelRadius, boxShadow: panelShadow, overflow: 'hidden' };
  const cardStyle: Record<string, any> = { ...panelStyle, borderRadius: cardRadius };

  const subtitleBg = (card: Record<string, any>) =>
    `linear-gradient(${gradientDirMap[card.moduleSubTitleBgType || 'leftRight'] || 'to right'}, ${card.moduleSubTitleBgColorA || '#FF4E4E'}, ${card.moduleSubTitleBgColorB || '#E1251B'})`;

  /** 卡位商品渲染：productGroup 来源走 groupProductsMap，products 来源走 card.products */
  const getCardProducts = (card: Record<string, any>, idx: number): PreviewProduct[] => {
    if (card.productSource === 'productGroup') return groupProductsMap[idx] || [];
    return ((card.products || []) as Array<Record<string, any>>).map((p) => ({
      productId: 0,
      productName: '',
      picUrl: p.pic?.picUrl || '',
      picThumb: p.pic?.picThumb || p.pic?.picUrl || '',
      productPrice: p.price || '¥0',
    }));
  };

  const HeroCard = ({ card, cardIndex }: { card: Record<string, any>; cardIndex: number }) => {
    const products = getCardProducts(card, cardIndex);
    return (
      <div style={{ ...cardStyle, width: '100%', height: '100%', padding: 8, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
          <span style={{ fontSize: titleSize, fontWeight: 700, color: titleColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {card.moduleTitle || '推荐'}
          </span>
          {card.moduleSubTitle ? (
            <span style={{ fontSize: 10, color: '#fff', background: subtitleBg(card), borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>
              {card.moduleSubTitle}
            </span>
          ) : null}
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 6, minHeight: 0 }}>
          {products.length
            ? products.slice(0, 2).map((p, pi) => {
                const rawP = ((card.products || [])[pi] || {}) as Record<string, any>;
                return (
                  <div key={pi} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <div style={{ flex: 1, borderRadius: 6, overflow: 'hidden', background: '#f7f8fa', position: 'relative', minHeight: 0 }}>
                      {(p.picThumb || p.picUrl) ? <img src={p.picThumb || p.picUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                      {rawP.label ? (
                        <span
                          style={{
                            position: 'absolute', left: 0, bottom: 0, fontSize: 9, color: '#fff', padding: '1px 4px',
                            background: `linear-gradient(to right, ${rawP.labelBgColorA || '#FF4E4E'}, ${rawP.labelBgColorB || '#E1251B'})`,
                          }}
                        >
                          {rawP.label}
                        </span>
                      ) : null}
                    </div>
                    {String(card.showPrice) !== '0' && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: priceColor, textAlign: 'center' }}>
                        {typeof p.productPrice === 'string' && p.productPrice.startsWith('¥') ? p.productPrice : `¥${Number(p.productPrice ?? 0).toFixed(2)}`}
                      </div>
                    )}
                  </div>
                );
              })
            : <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: mutedColor, fontSize: 12 }}>配置商品</div>}
        </div>
      </div>
    );
  };

  const framePad = `${Number(frame.boxPaddingTop) || 0}px ${Number(frame.boxPadding) || 0}px ${Number(frame.boxPaddingBottom) || 0}px`;

  return (
    <div style={{ padding: framePad, background: frame.backgroundColor || 'transparent', borderRadius: Number(frame.boxRadius) || 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `${style.leftWidth || 220}px minmax(0, 1fr) ${style.rightWidth || 260}px`, gap, height, overflow: 'hidden', alignItems: 'stretch' }}>

        {/* 左：类目列表（API 优先） */}
        <section style={{ ...panelStyle, background: left.backgroundColor || '#ffffff', color: left.textColor || '#333333', paddingTop: 6, overflowY: 'auto' }}>
          {categories.length ? (
            categories.map((c, i) => (
              <div key={c.picId ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 28, padding: '4px 8px 4px 16px', fontSize: 12 }}>
                {c.picUrl ? <img src={c.picUrl} alt="" style={{ width: 18, height: 18, flexShrink: 0 }} /> : <span style={{ width: 12, color: 'inherit' }}>-</span>}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.picTitle || '类目'}</span>
              </div>
            ))
          ) : (
            <div style={{ padding: 30, textAlign: 'center', color: mutedColor, fontSize: 12 }}>点击配置左侧类目</div>
          )}
        </section>

        {/* 中：上（轮播+促销卡）/ 下（4 频道卡） */}
        <section style={{ display: 'flex', flexDirection: 'column', gap, minWidth: 0, minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', gap, minHeight: 0 }}>
            <div style={{ ...panelStyle, flex: 1, borderRadius: bannerRadius, minWidth: 0 }}>
              {banners.length ? (
                <img src={banners[0]?.picUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: mutedColor, fontSize: 12 }}>点击添加轮播</div>
              )}
            </div>
            <div style={{ flex: 1, display: 'flex', gap, minWidth: 0 }}>
              {promoCards.map((card, i) => (
                <div key={i} style={{ flex: 1, minWidth: 0 }}>
                  <HeroCard card={card} cardIndex={i} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap, height: '100%' }}>
              {channelCards.map((card, i) => (
                <HeroCard key={i} card={card} cardIndex={i + 2} />
              ))}
            </div>
          </div>
        </section>

        {/* 右：用户卡 + 店铺街（1:1 还原） */}
        <section style={{ display: 'flex', flexDirection: 'column', gap, minWidth: 0, minHeight: 0 }}>
          {/* 用户卡 */}
          <div style={{ ...panelStyle, height: 220, flexShrink: 0, padding: '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', background: userGradient !== 'none' ? userGradient : right.userCardBackground || panelBg, position: 'relative' }}>
            {/* 付费会员入口：绝对定位右上角 */}
            {right.premiumMember?.show === true && (
              <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 2, width: 86, height: 41, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', color: '#ffd700', borderRadius: '0 0 0 12px', fontSize: 12, fontWeight: 700 }}>
                {right.premiumMember.title || '会员'}
                {right.premiumMember.description ? <span style={{ fontWeight: 400, fontSize: 9 }}>{right.premiumMember.description}</span> : null}
              </div>
            )}
            {/* 用户信息行 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginBottom: 15 }}>
              <img src={getPath(right, 'user.avatar.picUrl') || ''} alt="" style={{ width: 36, height: 36, borderRadius: '50%', background: '#ececec', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#333', paddingBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {getPath(right, 'user.nickname') || '欢迎来商城'}
                </div>
                <div style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>注册</span>
                  <span style={{ width: 1, height: 10, background: '#ddd' }} />
                  <span>入驻</span>
                </div>
              </div>
            </div>
            {/* 欢迎语 */}
            <div style={{ width: '100%', textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#333', marginBottom: 4 }}>{getPath(right, 'user.welcomeText') || '登录后更多精彩'}</div>
              <div style={{ fontSize: 12, color: '#999' }}>一键登录，福利好物全拥有</div>
            </div>
            {/* 立即登录按钮 */}
            <div style={{ display: 'block', width: '100%', height: 36, lineHeight: '36px', background: '#ff4141', color: '#fff', fontSize: 14, borderRadius: 4, textAlign: 'center', flexShrink: 0 }}>
              立即登录
            </div>
            {/* 四宫格动作 */}
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, marginTop: 10, flexShrink: 0 }}>
              {['我的订单', '浏览记录', '商品收藏', '关注店铺'].map((t) => (
                <div key={t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 11, color: '#333' }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#f2f3f5', display: 'inline-block' }} />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
          {/* 店铺街 */}
          <div style={{ ...panelStyle, flex: 1, padding: '0 12px 10px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '10px 0', flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: titleSize, color: titleColor, display: 'flex', alignItems: 'center', gap: 4 }}>
                {getPath(right, 'shopsTitle') || '店铺街'}
                {getPath(right, 'shopsSubTitle') ? (
                  <span style={{ fontSize: 10, color: '#fff', background: getPath(right, 'shopsSubTitleBg') || '#FF4E4E', borderRadius: 3, padding: '1px 4px' }}>
                    {getPath(right, 'shopsSubTitle')}
                  </span>
                ) : null}
              </div>
              <a style={{ fontSize: 11, color: mutedColor }}>
                {getPath(right, 'shopsMoreText') || '查看全部'} <span style={{ fontSize: 9 }}>▾</span>
              </a>
            </div>
            {shortcuts.length ? (
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, alignContent: 'start' }}>
                {shortcuts.map((sc, i) => (
                  <div key={sc.picId ?? i} style={{ textAlign: 'center' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', background: '#ffffff', border: '1px solid #f2f2f2', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {sc.picUrl ? <img src={sc.picUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : null}
                    </div>
                    <span style={{ fontSize: 11, color: getPath(right, 'shopsTextColor') || '#a06a38', display: 'block', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sc.picTitle || '进入店铺'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: mutedColor, fontSize: 12 }}>点击配置店铺</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}


const PC_HEADER_DEFAULTS: Record<string, any> = {
  styleType: 1,
  isWhite: 1,
  bottomDividerType: 1,
  showTopMenuBar: 1,
  topMenuTextColor: '',
  topMenuTextHoverColor: '',
  showTopRegion: 1,
  topRegionText: '中国江西',
  showTopUserMenu: 1,
  showTopMemberCenter: 1,
  memberCenterItems: [
    { picTitle: '我的足迹', picDesc: '', picLink: { link: '/member/browsingHistory/list', name: '我的足迹', label: '我的足迹' } },
    { picTitle: '我的优惠券', picDesc: '', picLink: { link: '/member/coupon/list', name: '我的优惠券', label: '我的优惠券' } },
  ],
  showTopMemberName: 1,
  showTopMessage: 1,
  showTopOrders: 1,
  showTopSiteNav: 1,
  showTopAd: 1,
  topAdPic: { picUrl: '', picThumb: '' },
  logoPic: { picUrl: '', picThumb: '' },
  logoAlign: 1,
  logoWidth: 100,
  logoHeight: 25,
  rightCartShow: 1,
  cartStyle: 1,
  cartPic: { picUrl: '', picThumb: '' },
  topMenuCartShow: 1,
  searchStyle: 1,
  searchColorType: 1,
  searchColor: '',
  showCategory: 1,
  showHomeCategory: 1,
  categoryMarginTop: 0,
  showMainNav: 1,
  mainNavPaddingTop: 0,
  mainNavPaddingBottom: 0,
  showBenefitBar: 1,
  benefitBarBackgroundColor: '',
  benefitTitleColor: '',
  benefitDescColor: '',
  benefitNoticeGroups: [],
};

function PcHeaderPreviewStrip({ header, onOpen }: { header: Record<string, any>; onOpen: () => void }) {
  const h = { ...PC_HEADER_DEFAULTS, ...header };
  const styleType = Number(h.styleType ?? 1) === 2 ? 2 : 1;
  const simple = styleType === 1;
  const showBenefitBar = Number(h.showBenefitBar ?? 1) !== 0;
  const showTopMenuBar = Number(h.showTopMenuBar ?? 1) !== 0;
  const showTopRegion = Number(h.showTopRegion ?? 1) !== 0;
  const showTopUserMenu = Number(h.showTopUserMenu ?? 1) !== 0;
  const showTopMemberCenter = Number(h.showTopMemberCenter ?? 1) !== 0;
  const showTopMemberName = Number(h.showTopMemberName ?? 1) !== 0;
  const showTopMessage = Number(h.showTopMessage ?? 1) !== 0;
  const showTopOrders = Number(h.showTopOrders ?? 1) !== 0;
  const showTopSiteNav = Number(h.showTopSiteNav ?? 1) !== 0;
  const showRightCart = Number(h.rightCartShow ?? 1) !== 0;
  const cartStyle = Number(h.cartStyle ?? 1);
  const showCategory = Number(h.showCategory ?? 1) !== 0 && Number(h.showHomeCategory ?? 1) !== 0;
  const showMainNav = Number(h.showMainNav ?? 1) !== 0;
  const showTopMenuCart = Number(h.topMenuCartShow ?? 1) !== 0;
  const divider = [1, 2].includes(Number(h.bottomDividerType)) ? Number(h.bottomDividerType) : simple ? 2 : 1;
  const navTitles = useHeaderNavTitles();
  const navItems = navTitles.length ? navTitles : ['首页', '导航1', '导航2'];

  const topMenuTextStyle: Record<string, any> = {};
  if (h.topMenuTextColor) topMenuTextStyle.color = h.topMenuTextColor;
  if (h.topMenuTextHoverColor) (topMenuTextStyle as any)['--hover-color'] = h.topMenuTextHoverColor;

  const stripLeft = simple && (showTopRegion || showTopMemberName);
  const stripRight = showTopSiteNav || showTopMenuCart || (simple && showTopMenuBar && showTopUserMenu);

  const logoStyle: Record<string, any> = {
    width: Math.min(Number(h.logoWidth) || 100, 160),
    height: Math.min(Number(h.logoHeight) || 25, 60),
    objectFit: 'contain',
  };
  const logoAlign = Number(h.logoAlign ?? 1);
  const searchAccent = Number(h.searchColorType ?? 1) === 2 && h.searchColor ? h.searchColor : '#1a1a1a';

  return (
    <div className="dec-pc-header-preview" onClick={onOpen} title="点击配置 PC 头部装修">
      {/* 顶部提示条（showBenefitBar 总开关，两种风格共用） */}
      {showBenefitBar && (
        <div className="dec-pc-header-preview__strip" style={h.benefitBarBackgroundColor ? { background: h.benefitBarBackgroundColor } : undefined}>
          <div className="dec-pc-header-preview__strip-inner">
            <div className="pchead-strip">
              <div className="pchead-strip__left" style={topMenuTextStyle}>
                {simple && showTopRegion && <span className="pchead-strip__region">{h.topRegionText || '北京市'}</span>}
                {simple && showTopMemberName && <a className="pchead-strip__link">会员信息</a>}
              </div>
              <div className="pchead-strip__right" style={topMenuTextStyle}>
                {showTopMenuCart && <a className="pchead-strip__link">🛒 购物车</a>}
                {simple && showTopMenuBar && showTopUserMenu && (
                  <span className="pchead-strip__menus">
                    {showTopMemberCenter && <a className="pchead-strip__link">会员中心 ▾</a>}
                    {showTopMessage && <a className="pchead-strip__link">站内消息</a>}
                    {showTopOrders && <a className="pchead-strip__link">我的订单</a>}
                  </span>
                )}
                {showTopSiteNav && <a className="pchead-strip__link">站点导航 ▾</a>}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 头部主体（简约风） */}
      {simple && (
        <div className={`dec-pchead-body${Number(h.isWhite ?? 1) !== 0 ? ' dec-pchead-body--white' : ''} dec-pchead-body--divider-${divider}`}>
          <div className="dec-pchead-body__grid">
            <div className="dec-pchead-body__left">
              <div className={`dec-pchead-logo dec-pchead-logo--${logoAlign === 2 ? 'center' : logoAlign === 3 ? 'right' : 'left'}`}>
                {h.logoPic?.picUrl
                  ? <img src={h.logoPic.picUrl} alt="logo" style={logoStyle} />
                  : <span style={{ fontWeight: 800, fontSize: 20, color: '#1a1a1a' }}>LOGO</span>}
              </div>
              {showCategory && (
                <div className="dec-pchead-cate" style={{ marginTop: Number(h.categoryMarginTop) || 0 }}>
                  <span className="dec-pchead-cate__icon">☰</span>
                  <span className="dec-pchead-cate__txt">分类</span>
                  <span className="dec-pchead-cate__arrow">▾</span>
                </div>
              )}
            </div>
            <div className="dec-pchead-body__center">
              <div className="dec-pchead-search">
                <div className="dec-pchead-search__box" style={{ borderColor: searchAccent }}>
                  <span className="dec-pchead-search__type">商品 <i>▾</i></span>
                  <input className="dec-pchead-search__input" placeholder="请输入关键词" disabled />
                  <span className="dec-pchead-search__submit" style={{ background: searchAccent }}>搜索</span>
                </div>
                {showMainNav && (
                  <ul className="dec-pchead-nav" style={{ marginTop: Number(h.mainNavPaddingTop) || 0, marginBottom: Number(h.mainNavPaddingBottom) || 0 }}>
                    {navItems.map((t: string, i: number) => <li key={i}>{t}</li>)}
                  </ul>
                )}
              </div>
            </div>
            <div className="dec-pchead-body__right">
              {showRightCart && (
                cartStyle === 2 ? (
                  <div className={`dec-pchead-cartpic${h.cartPic?.picUrl ? '' : ' dec-pchead-cartpic--empty'}`}>
                    {h.cartPic?.picUrl ? <img src={h.cartPic.picUrl} alt="" /> : <span>购物车图</span>}
                  </div>
                ) : (
                  <div className="dec-pchead-cart">
                    <span className="dec-pchead-cart__icon">🛒</span>
                    <span className="dec-pchead-cart__count">18</span>
                    <span className="dec-pchead-cart__text">购物车</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
      {!simple && (
        <div className="dec-pchead-body dec-pchead-body--white dec-pchead-body--divider-0" style={{ padding: '20px 24px', fontSize: 13, color: '#999' }}>
          跨境风头部（由跨境风专属字段驱动，画布预览以简约风结构为准）
        </div>
      )}
    </div>
  );
}


function PageSettingsPanel({
  pageModule,
  legacyCount,
  newCount,
  onChange,
  onSwitchVersion,
}: {
  pageModule: Record<string, any>;
  legacyCount: number;
  newCount: number;
  onChange: (next: Record<string, any>) => void;
  onSwitchVersion: (target: 'new' | 'old') => void;
}) {
  const currentVersion = pageModule.homeStyleVersion === 'old' ? 'old' : 'new';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Text strong>页面设置</Text>

      <div>
        <Text type="tertiary" size="small">页面标题（可不填，默认为页面名称）</Text>
        <Input value={pageModule.title || ''} onChange={(v) => onChange({ ...pageModule, title: v })} placeholder="请输入页面标题" />
      </div>

      {/* 头部风格仅服务旧版头部；新版 PC 首页走 pcHeader，故新版时隐藏（原版同逻辑） */}
      {currentVersion === 'old' && (
        <div>
          <Text type="tertiary" size="small">头部风格</Text>
          <RadioGroup
            value={Number(pageModule.headerStyle) === 2 ? 2 : 1}
            onChange={(e: any) => onChange({ ...pageModule, headerStyle: Number(e.target.value) })}
            type="button"
          >
            <Radio value={1}>默认风格</Radio>
            <Radio value={2}>简约风格</Radio>
          </RadioGroup>
        </div>
      )}

      <div>
        <Text type="tertiary" size="small">标题栏背景颜色</Text>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="color"
            value={pageModule.titleBackgroundColor || '#ffffff'}
            onChange={(e) => onChange({ ...pageModule, titleBackgroundColor: e.target.value })}
            style={{ width: 46, height: 30, border: '1px solid var(--semi-color-border)', borderRadius: 4, cursor: 'pointer' }}
          />
          <Button size="small" onClick={() => onChange({ ...pageModule, titleBackgroundColor: '' })}>重置</Button>
        </div>
      </div>

      <div>
        <Text type="tertiary" size="small">页面背景颜色</Text>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="color"
            value={pageModule.backgroundColor || '#ffffff'}
            onChange={(e) => onChange({ ...pageModule, backgroundColor: e.target.value })}
            style={{ width: 46, height: 30, border: '1px solid var(--semi-color-border)', borderRadius: 4, cursor: 'pointer' }}
          />
          <Button size="small" onClick={() => onChange({ ...pageModule, backgroundColor: '' })}>重置</Button>
        </div>
      </div>

      <div>
        <Text type="tertiary" size="small">背景图</Text>
        <Input
          value={typeof pageModule.backgroundImage === 'string' ? pageModule.backgroundImage : pageModule.backgroundImage?.picUrl || ''}
          onChange={(v) => onChange({ ...pageModule, backgroundImage: v ? { picUrl: v, picThumb: v } : { picUrl: '', picThumb: '' } })}
          placeholder="https://..."
        />
      </div>

      <div>
        <Text type="tertiary" size="small">背景图显示</Text>
        <RadioGroup
          value={Number(pageModule.backgroundRepeat) || 1}
          onChange={(e: any) => onChange({ ...pageModule, backgroundRepeat: Number(e.target.value) })}
          type="button"
        >
          <Radio value={1}>不平铺</Radio>
          <Radio value={2}>平铺</Radio>
          <Radio value={3}>纵向平铺</Radio>
          <Radio value={4}>横向平铺</Radio>
        </RadioGroup>
      </div>

      <div>
        <Text type="tertiary" size="small">背景图填充大小</Text>
        <RadioGroup
          value={Number(pageModule.backgroundSize) || 1}
          onChange={(e: any) => onChange({ ...pageModule, backgroundSize: Number(e.target.value) })}
          type="button"
        >
          <Radio value={1}>横向100%</Radio>
          <Radio value={2}>纵向100%</Radio>
          <Radio value={3}>100%填充</Radio>
        </RadioGroup>
      </div>

      <div style={{ borderTop: '1px solid var(--semi-color-border)', paddingTop: 12 }}>
        <Text type="tertiary" size="small">首页装修版本</Text>
        <RadioGroup
          value={currentVersion}
          onChange={(e: any) => onSwitchVersion(e.target.value as 'new' | 'old')}
          type="button"
          style={{ marginTop: 4 }}
        >
          <Radio value="new">新版首页</Radio>
          <Radio value="old">旧版首页</Radio>
        </RadioGroup>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Text type="tertiary" size="small"><b>新版首页：</b>支持可视化网格、高级轮播等新模块，顶部带 PC 头部实时预览，排版更现代。当前 {newCount} 个模块。</Text>
          <Text type="tertiary" size="small"><b>旧版首页：</b>使用传统全宽占位模块，无头部预览，适合维护旧有页面。当前 {legacyCount} 个模块。</Text>
        </div>
      </div>
    </div>
  );
}


function HeaderSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 14, borderTop: '1px solid #eef0f3', paddingTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2329', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function HeaderField({
  label,
  value,
  showIf = true,
  children,
}: {
  label: string;
  value?: ReactNode;
  showIf?: boolean;
  children?: ReactNode;
}) {
  if (!showIf) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0' }}>
      <div style={{ width: 98, flexShrink: 0, color: '#646a73', fontSize: 13, lineHeight: '28px' }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
        {value ? <div style={{ color: '#98a2b3', fontSize: 12, lineHeight: '20px', marginTop: 2 }}>{value}</div> : null}
      </div>
    </div>
  );
}

function useHeaderNavTitles() {
  const [titles, setTitles] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    apiGet<any>('/decorate/pcNavigation/list', { page: 1, size: 10 })
      .then((result) => {
        if (!alive) return;
        const rows = result?.records || result?.list || [];
        const next = rows
          .filter((item: any) => item.isShow !== 0)
          .map((item: any) => String(item.navName || item.name || item.title || ''))
          .filter(Boolean);
        if (next.length) setTitles(next);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return titles;
}

function PcHeaderPanel({
  header,
  onChange,
}: {
  header: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}) {
  const set = (key: string, value: unknown) => onChange({ ...header, [key]: value });
  const simple = Number(header.styleType ?? 1) === 1;

  const updateMemberItems = (next: Array<Record<string, any>>) => set('memberCenterItems', next);
  const updateBenefitGroups = (next: Array<Record<string, any>>) => set('benefitNoticeGroups', next);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 20 }}>
      <Text strong>PC头部装修</Text>

      <HeaderField label="头部风格">
        <RadioGroup value={Number(header.styleType ?? 1) === 2 ? 2 : 1} onChange={(e: any) => set('styleType', Number(e.target.value) === 2 ? 2 : 1)} type="button">
          <Radio value={1}>简约风</Radio>
          <Radio value={2}>跨境风</Radio>
        </RadioGroup>
      </HeaderField>
      <HeaderField label="底部样式">
        <RadioGroup value={Number(header.bottomDividerType ?? 1)} onChange={(e: any) => set('bottomDividerType', Number(e.target.value))} type="button">
          <Radio value={1}>阴影</Radio>
          <Radio value={2}>边框</Radio>
          <Radio value={0}>不展示</Radio>
        </RadioGroup>
      </HeaderField>

      <HeaderSection title="LOGO">
        <div style={{ width: '100%' }}>
          <HeaderField label="LOGO图片" value="建议 320*120 PNG 透明底">
            <a style={{ fontSize: 12, cursor: 'pointer', color: 'var(--semi-color-primary)' }} onClick={() => set('logoPic', { picUrl: '', picThumb: '' })}>默认logo</a>
          </HeaderField>
          <Input
            value={header.logoPic?.picUrl || ''}
            onChange={(v) => set('logoPic', { picUrl: v, picThumb: v })}
            placeholder="LOGO 图片 URL"
            size="small"
            style={{ marginTop: 4 }}
          />
        </div>
        <HeaderField label="logo位置">
          <RadioGroup value={Number(header.logoAlign ?? 1)} onChange={(e: any) => set('logoAlign', Number(e.target.value))} type="button">
            <Radio value={1}>居左</Radio>
            <Radio value={2}>居中</Radio>
            <Radio value={3}>居右</Radio>
          </RadioGroup>
        </HeaderField>
        <HeaderField label="LOGO宽度">
          <Slider value={Number(header.logoWidth) || 100} min={40} max={300} step={1} style={{ width: 150 }} onChange={(v) => set('logoWidth', typeof v === 'number' ? v : (v as number[])[0])} />
        </HeaderField>
        <HeaderField label="LOGO高度">
          <Slider value={Number(header.logoHeight) || 25} min={10} max={100} step={1} style={{ width: 150 }} onChange={(v) => set('logoHeight', typeof v === 'number' ? v : (v as number[])[0])} />
        </HeaderField>
      </HeaderSection>

      <HeaderSection title="购物车">
        <HeaderField label="右侧购物车" value={Number(header.rightCartShow ?? 1) === 0 ? '隐藏' : '显示'}>
          <RadioGroup value={Number(header.rightCartShow ?? 1)} onChange={(e: any) => set('rightCartShow', Number(e.target.value))} type="button">
            <Radio value={1}>显示</Radio>
            <Radio value={0}>隐藏</Radio>
          </RadioGroup>
        </HeaderField>
        <HeaderField label="购物车样式">
          <RadioGroup value={Number(header.cartStyle ?? 1)} onChange={(e: any) => set('cartStyle', Number(e.target.value))} type="button">
            <Radio value={1}>购物车</Radio>
            <Radio value={2}>图片</Radio>
          </RadioGroup>
        </HeaderField>
        {Number(header.rightCartShow ?? 1) !== 0 && Number(header.cartStyle ?? 1) === 2 && (
          <div style={{ width: '100%' }}>
            <HeaderField label="添加图片">
              <a style={{ fontSize: 12, cursor: 'pointer', color: 'var(--semi-color-primary)' }} onClick={() => set('cartPic', { picUrl: '', picThumb: '' })}>重置</a>
            </HeaderField>
            <Input value={header.cartPic?.picUrl || ''} onChange={(v) => set('cartPic', { picUrl: v, picThumb: v })} placeholder="购物车图片 URL" size="small" />
          </div>
        )}
        <HeaderField label="顶部菜单购物车" value={Number(header.topMenuCartShow ?? 1) === 0 ? '隐藏' : '显示'}>
          <RadioGroup value={Number(header.topMenuCartShow ?? 1)} onChange={(e: any) => set('topMenuCartShow', Number(e.target.value))} type="button">
            <Radio value={1}>显示</Radio>
            <Radio value={0}>隐藏</Radio>
          </RadioGroup>
        </HeaderField>
      </HeaderSection>

      <HeaderSection title="搜索条">
        <HeaderField label="搜索条颜色" value={Number(header.searchColorType ?? 1) === 2 ? '自定义' : '跟随系统'}>
          <RadioGroup value={Number(header.searchColorType ?? 1)} onChange={(e: any) => set('searchColorType', Number(e.target.value))} type="button">
            <Radio value={1}>系统</Radio>
            <Radio value={2}>自定义</Radio>
          </RadioGroup>
        </HeaderField>
        {Number(header.searchColorType ?? 1) === 2 && (
          <HeaderField label="自定义颜色">
            <HeaderColorInput value={header.searchColor || ''} onChange={(v) => set('searchColor', v)} />
          </HeaderField>
        )}
        <HeaderField label="所有商品分类" value={Number(header.showCategory ?? 1) === 0 ? '关闭' : '开启'}>
          <RadioGroup value={Number(header.showCategory ?? 1)} onChange={(e: any) => set('showCategory', Number(e.target.value))} type="button">
            <Radio value={1}>开启</Radio>
            <Radio value={0}>关闭</Radio>
          </RadioGroup>
        </HeaderField>
        <HeaderField label="首页分类" value={Number(header.showHomeCategory ?? 1) === 0 ? '隐藏' : '显示'}>
          <RadioGroup value={Number(header.showHomeCategory ?? 1)} onChange={(e: any) => set('showHomeCategory', Number(e.target.value))} type="button">
            <Radio value={1}>显示</Radio>
            <Radio value={0}>隐藏</Radio>
          </RadioGroup>
        </HeaderField>
        <HeaderField label="分类上间距">
          <Slider value={Number(header.categoryMarginTop) || 0} min={0} max={60} step={1} style={{ width: 150 }} onChange={(v) => set('categoryMarginTop', typeof v === 'number' ? v : (v as number[])[0])} />
        </HeaderField>
      </HeaderSection>

      <HeaderSection title="导航栏">
        <HeaderField label="主导航" value={Number(header.showMainNav ?? 1) === 0 ? '隐藏' : '显示'}>
          <RadioGroup value={Number(header.showMainNav ?? 1)} onChange={(e: any) => set('showMainNav', Number(e.target.value))} type="button">
            <Radio value={1}>显示</Radio>
            <Radio value={0}>隐藏</Radio>
          </RadioGroup>
        </HeaderField>
        <HeaderField label="导航栏上间距">
          <Slider value={Number(header.mainNavPaddingTop) || 0} min={0} max={60} step={1} style={{ width: 150 }} onChange={(v) => set('mainNavPaddingTop', typeof v === 'number' ? v : (v as number[])[0])} />
        </HeaderField>
        <HeaderField label="导航栏下间距">
          <Slider value={Number(header.mainNavPaddingBottom) || 0} min={0} max={60} step={1} style={{ width: 150 }} onChange={(v) => set('mainNavPaddingBottom', typeof v === 'number' ? v : (v as number[])[0])} />
        </HeaderField>
      </HeaderSection>

      <HeaderSection title="Benefit Bar">
        <HeaderField label="展示 benefit bar">
          <Switch checked={Number(header.showBenefitBar ?? 1) === 1} onChange={(v) => set('showBenefitBar', v ? 1 : 0)} />
        </HeaderField>
        {Number(header.showBenefitBar ?? 1) === 1 && (
          <>
            <HeaderField label="背景色">
              <HeaderColorInput value={header.benefitBarBackgroundColor || ''} onChange={(v) => set('benefitBarBackgroundColor', v)} />
            </HeaderField>
            <HeaderField label="主标题颜色">
              <HeaderColorInput value={header.benefitTitleColor || ''} onChange={(v) => set('benefitTitleColor', v)} />
            </HeaderField>
            <HeaderField label="副标题颜色">
              <HeaderColorInput value={header.benefitDescColor || ''} onChange={(v) => set('benefitDescColor', v)} />
            </HeaderField>
          </>
        )}
      </HeaderSection>

      {simple && (
        <HeaderSection title="顶部提示条（简约风）">
          <HeaderField label="顶部菜单文字颜色">
            <HeaderColorInput value={header.topMenuTextColor || ''} onChange={(v) => set('topMenuTextColor', v)} />
          </HeaderField>
          <HeaderField label="顶部菜单文字悬浮颜色">
            <HeaderColorInput value={header.topMenuTextHoverColor || ''} onChange={(v) => set('topMenuTextHoverColor', v)} />
          </HeaderField>
          <HeaderField label="站点导航" value={Number(header.showTopSiteNav ?? 1) === 0 ? '隐藏' : '显示'}>
            <RadioGroup value={Number(header.showTopSiteNav ?? 1)} onChange={(e: any) => set('showTopSiteNav', Number(e.target.value))} type="button">
              <Radio value={1}>显示</Radio>
              <Radio value={0}>隐藏</Radio>
            </RadioGroup>
          </HeaderField>
          <HeaderField label="会员信息" value={Number(header.showTopMemberName ?? 1) === 0 ? '隐藏' : '显示'}>
            <RadioGroup value={Number(header.showTopMemberName ?? 1)} onChange={(e: any) => set('showTopMemberName', Number(e.target.value))} type="button">
              <Radio value={1}>显示</Radio>
              <Radio value={0}>隐藏</Radio>
            </RadioGroup>
          </HeaderField>
          <HeaderField label="地区选择" value={Number(header.showTopRegion ?? 1) === 0 ? '隐藏' : '显示'}>
            <RadioGroup value={Number(header.showTopRegion ?? 1)} onChange={(e: any) => set('showTopRegion', Number(e.target.value))} type="button">
              <Radio value={1}>显示</Radio>
              <Radio value={0}>隐藏</Radio>
            </RadioGroup>
          </HeaderField>
          <HeaderField label="地区文字" showIf={Number(header.showTopRegion ?? 1) === 1}>
            <Input value={header.topRegionText || ''} onChange={(v) => set('topRegionText', v)} size="small" style={{ width: 140 }} />
          </HeaderField>
          <HeaderField label="显示右侧菜单（不含站点导航、购物车）">
            <Switch checked={Number(header.showTopMenuBar ?? 1) === 1} onChange={(v) => set('showTopMenuBar', v ? 1 : 0)} />
          </HeaderField>
          {Number(header.showTopMenuBar ?? 1) !== 0 && (
            <>
              <HeaderField label="右侧菜单" value={Number(header.showTopUserMenu ?? 1) === 0 ? '隐藏' : '显示'}>
                <RadioGroup value={Number(header.showTopUserMenu ?? 1)} onChange={(e: any) => set('showTopUserMenu', Number(e.target.value))} type="button">
                  <Radio value={1}>显示</Radio>
                  <Radio value={0}>隐藏</Radio>
                </RadioGroup>
              </HeaderField>
              {Number(header.showTopUserMenu ?? 1) !== 0 && (
                <>
                  <HeaderField label="站内消息" value={Number(header.showTopMessage ?? 1) === 0 ? '隐藏' : '显示'}>
                    <RadioGroup value={Number(header.showTopMessage ?? 1)} onChange={(e: any) => set('showTopMessage', Number(e.target.value))} type="button">
                      <Radio value={1}>显示</Radio>
                      <Radio value={0}>隐藏</Radio>
                    </RadioGroup>
                  </HeaderField>
                  <HeaderField label="我的订单" value={Number(header.showTopOrders ?? 1) === 0 ? '隐藏' : '显示'}>
                    <RadioGroup value={Number(header.showTopOrders ?? 1)} onChange={(e: any) => set('showTopOrders', Number(e.target.value))} type="button">
                      <Radio value={1}>显示</Radio>
                      <Radio value={0}>隐藏</Radio>
                    </RadioGroup>
                  </HeaderField>
                  <HeaderField label="会员中心" value={Number(header.showTopMemberCenter ?? 1) === 0 ? '隐藏' : '显示'}>
                    <RadioGroup value={Number(header.showTopMemberCenter ?? 1)} onChange={(e: any) => set('showTopMemberCenter', Number(e.target.value))} type="button">
                      <Radio value={1}>显示</Radio>
                      <Radio value={0}>隐藏</Radio>
                    </RadioGroup>
                  </HeaderField>
                  {Number(header.showTopMemberCenter ?? 1) !== 0 && (
                    <div style={{ width: '100%' }}>
                      <Text type="tertiary" size="small">会员中心菜单</Text>
                      {((header.memberCenterItems || []) as Array<Record<string, any>>).map((it, index) => (
                        <div key={index} style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center' }}>
                          <Input
                            value={it.picTitle || ''}
                            onChange={(v) => updateMemberItems((header.memberCenterItems || []).map((x: any, i: number) => (i === index ? { ...x, picTitle: v, picLink: { ...(x.picLink || {}), name: v, label: v } } : x)))}
                            placeholder="菜单名"
                            size="small"
                          />
                          <Input
                            value={it.picLink?.link || ''}
                            onChange={(v) => updateMemberItems((header.memberCenterItems || []).map((x: any, i: number) => (i === index ? { ...x, picLink: { ...(x.picLink || {}), link: v } } : x)))}
                            placeholder="链接"
                            size="small"
                          />
                          <Button size="small" theme="borderless" type="danger" icon={<IconClose />} onClick={() => updateMemberItems((header.memberCenterItems || []).filter((_: any, i: number) => i !== index))} />
                        </div>
                      ))}
                      <Button size="small" icon={<IconPlus />} style={{ marginTop: 4 }} onClick={() => updateMemberItems([...(header.memberCenterItems || []), { picTitle: '新菜单', picDesc: '', picLink: { link: '', name: '新菜单', label: '新菜单' } }])}>
                        添加菜单
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {Number(header.showBenefitBar ?? 1) === 1 && (
            <div style={{ width: '100%' }}>
              <Text type="tertiary" size="small">顶部提示内容（分组）</Text>
              {((header.benefitNoticeGroups || []) as Array<Record<string, any>>).map((g, gi) => (
                <div key={gi} style={{ border: '1px dashed var(--semi-color-border)', borderRadius: 6, padding: 8, marginTop: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong size="small">提示组 {gi + 1}</Text>
                    <Button size="small" theme="borderless" type="danger" icon={<IconClose />} onClick={() => updateBenefitGroups((header.benefitNoticeGroups || []).filter((_: any, i: number) => i !== gi))} />
                  </div>
                  {((g.notices || []) as Array<Record<string, any>>).map((n, ni) => (
                    <div key={ni} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, borderTop: '1px dashed var(--semi-color-border)', paddingTop: 6 }}>
                      <Input value={n.picTitle || ''} onChange={(v) => updateBenefitGroups((header.benefitNoticeGroups || []).map((grp: any, i: number) => (i === gi ? { ...grp, notices: (grp.notices || []).map((x: any, xi: number) => (xi === ni ? { ...x, picTitle: v } : x)) } : grp)))} placeholder="主标题" size="small" />
                      <Input value={n.picDesc || ''} onChange={(v) => updateBenefitGroups((header.benefitNoticeGroups || []).map((grp: any, i: number) => (i === gi ? { ...grp, notices: (grp.notices || []).map((x: any, xi: number) => (xi === ni ? { ...x, picDesc: v } : x)) } : grp)))} placeholder="副标题" size="small" />
                      <Input value={n.picLink?.link || ''} onChange={(v) => updateBenefitGroups((header.benefitNoticeGroups || []).map((grp: any, i: number) => (i === gi ? { ...grp, notices: (grp.notices || []).map((x: any, xi: number) => (xi === ni ? { ...x, picLink: { ...(x.picLink || {}), link: v } } : x)) } : grp)))} placeholder="链接(可选)" size="small" />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button size="small" theme="borderless" type="danger" icon={<IconClose />} onClick={() => updateBenefitGroups((header.benefitNoticeGroups || []).map((grp: any, i: number) => (i === gi ? { ...grp, notices: (grp.notices || []).filter((_: any, xi: number) => xi !== ni) } : grp)))} />
                        <Button size="small" icon={<IconPlus />} onClick={() => updateBenefitGroups((header.benefitNoticeGroups || []).map((grp: any, i: number) => (i === gi ? { ...grp, notices: [...(grp.notices || []), { picId: '0', picThumb: '', picUrl: '', picName: '', picTitle: '', picDesc: '', picLink: { link: '', name: '' } }] } : grp)))}>
                          添加提示
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <Button size="small" icon={<IconPlus />} style={{ marginTop: 6 }} onClick={() => updateBenefitGroups([...(header.benefitNoticeGroups || []), { notices: [{ picId: '0', picThumb: '', picUrl: '', picName: '', picTitle: '', picDesc: '', picLink: { link: '', name: '' } }] }])}>
                添加提示组
              </Button>
            </div>
          )}
        </HeaderSection>
      )}
    </div>
  );
}

/* ===================== 模块设置面板（字段驱动） ===================== */

function ModuleSettingsPanel({
  def,
  moduleData,
  onChange,
}: {
  def: ModuleDef;
  moduleData: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Text strong>{def.label}设置</Text>
      {def.note && <Text type="tertiary" size="small">{def.note}</Text>}
      {def.settings.length === 0 && <Text type="tertiary">该模块无可配置项</Text>}
      {def.settings.map((field) => {
        if (field.showIf && !field.showIf(moduleData)) return null;
        return (
          <div key={field.key}>
            {field.kind !== 'title' && field.kind !== 'container' && (
              <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>
                {field.label}
                {field.hint ? `（${field.hint}）` : ''}
              </Text>
            )}
            <FieldControl field={field} moduleData={moduleData} onChange={onChange} />
          </div>
        );
      })}
    </div>
  );
}

/* ===================== 字段控件 ===================== */

let categoryCache: Array<{ label: string; value: number }> | null = null;

function useCategoryOptions() {
  const [options, setOptions] = useState<Array<{ label: string; value: number }>>(categoryCache || []);
  useEffect(() => {
    if (categoryCache) return;
    apiGet<any[]>('/product/category/getAllCategory')
      .then((tree) => {
        const flat: Array<{ label: string; value: number }> = [];
        const traverse = (nodes: any[], prefix = '') => {
          nodes.forEach((n) => {
            const label = prefix ? `${prefix}└─ ${n.categoryName}` : n.categoryName;
            flat.push({ label, value: n.categoryId });
            if (Array.isArray(n.children) && n.children.length > 0) traverse(n.children, `${prefix}    `);
          });
        };
        traverse(Array.isArray(tree) ? tree : []);
        categoryCache = flat;
        setOptions(flat);
      })
      .catch(() => setOptions([]));
  }, []);
  return options;
}

interface ProductRow {
  productId: number;
  productName?: string;
  productPrice?: number | string;
  picUrl?: string;
  picThumb?: string;
}

function ProductPickerModal({
  visible,
  selectedIds,
  multiple = true,
  onOk,
  onCancel,
}: {
  visible: boolean;
  selectedIds: number[];
  multiple?: boolean;
  onOk: (ids: number[], rows: ProductRow[]) => void;
  onCancel: () => void;
}) {
  const [keyword, setKeyword] = useState('');
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<number[]>(selectedIds);

  useEffect(() => {
    if (visible) setPicked(selectedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const load = () => {
    setLoading(true);
    apiGet<{ records?: ProductRow[]; list?: ProductRow[] }>('/product/product/list', {
      keyword: keyword || undefined,
      page: 1,
      size: 20,
      productType: 1,
    })
      .then((res) => setRows(res.records || res.list || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (visible) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggle = (row: ProductRow) => {
    setPicked((prev) => {
      if (prev.includes(row.productId)) return prev.filter((id) => id !== row.productId);
      if (!multiple) return [row.productId];
      return [...prev, row.productId];
    });
  };

  return (
    <Modal
      title="选择商品"
      visible={visible}
      width={720}
      onOk={() => onOk(picked, [])}
      onCancel={onCancel}
      okText="确定"
      cancelText="取消"
    >
      <Space style={{ marginBottom: 12, width: '100%' }}>
        <Input value={keyword} onChange={setKeyword} onEnterPress={load} placeholder="输入商品名称搜索" style={{ width: 260 }} showClear onClear={() => setKeyword('')} />
        <Button onClick={load}>搜索</Button>
        <Text type="tertiary" size="small">已选 {picked.length} 个</Text>
      </Space>
      <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && <Spin />}
        {!loading && rows.length === 0 && <Text type="tertiary">暂无数据</Text>}
        {rows.map((row) => (
          <div
            key={row.productId}
            onClick={() => toggle(row)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: 8,
              border: `1px solid ${picked.includes(row.productId) ? 'var(--semi-color-primary)' : 'var(--semi-color-border)'}`,
              borderRadius: 6, cursor: 'pointer',
            }}
          >
            {(row.picThumb || row.picUrl) && <img src={row.picThumb || row.picUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />}
            <div style={{ flex: 1 }}>
              <div>{row.productName || `商品#${row.productId}`}</div>
              <Text type="tertiary" size="small">¥{row.productPrice ?? '-'}</Text>
            </div>
            {picked.includes(row.productId) && <Tag color="blue">已选</Tag>}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function GrouponPickerModal({
  visible,
  current,
  onOk,
  onCancel,
}: {
  visible: boolean;
  current?: Record<string, any> | null;
  onOk: (item: Record<string, any> | null) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Record<string, any> | null>(current || null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    apiGet<{ records?: Array<Record<string, any>>; list?: Array<Record<string, any>> }>('/promotion/groupon/list', { page: 1, size: 20 })
      .then((res) => setRows(res.records || res.list || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [visible]);

  return (
    <Modal title="选择拼团活动" visible={visible} width={640} onOk={() => onOk(picked)} onCancel={onCancel} okText="确定" cancelText="取消">
      <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && <Spin />}
        {!loading && rows.length === 0 && <Text type="tertiary">暂无拼团活动</Text>}
        {rows.map((row) => {
          const id = row.grouponPromotionId ?? row.grouponId ?? row.id;
          const name = row.name || row.title || `活动#${id}`;
          const isPicked = picked && (picked.grouponPromotionId ?? picked.grouponId ?? picked.id) === id;
          return (
            <div
              key={id}
              onClick={() => setPicked({ grouponPromotionId: id, name, groupType: row.groupType, startTime: row.startTime, endTime: row.endTime })}
              style={{
                padding: 10, borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${isPicked ? 'var(--semi-color-primary)' : 'var(--semi-color-border)'}`,
              }}
            >
              <div>{name}</div>
              <Text type="tertiary" size="small">{Number(row.groupType) === 2 ? '阶梯拼团' : '普通拼团'}</Text>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function PicListEditor({ value, onChange, showDesc = false }: { value: PicItem[]; onChange: (next: PicItem[]) => void; showDesc?: boolean }) {
  const list = Array.isArray(value) ? value : [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {list.map((item, index) => (
        <div key={index} style={{ border: '1px solid var(--semi-color-border)', borderRadius: 6, padding: 8, display: 'flex', gap: 8 }}>
          {item.picUrl ? (
            <img src={item.picUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: 4, background: 'var(--semi-color-fill-0)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--semi-color-text-2)', fontSize: 16 }}>?</div>
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Input value={item.picUrl} onChange={(v) => onChange(list.map((it, i) => (i === index ? { ...it, picUrl: v, picThumb: v } : it)))} placeholder="图片 URL" size="small" />
            <Input value={item.picTitle || ''} onChange={(v) => onChange(list.map((it, i) => (i === index ? { ...it, picTitle: v } : it)))} placeholder="文字标题(可选)" size="small" />
            {showDesc && (
              <Input value={item.picDesc || ''} onChange={(v) => onChange(list.map((it, i) => (i === index ? { ...it, picDesc: v } : it)))} placeholder="描述(可选)" size="small" />
            )}
            <Input
              value={item.picLink?.link || ''}
              onChange={(v) => onChange(list.map((it, i) => (i === index ? { ...it, picLink: { ...it.picLink, link: v, name: it.picLink?.name || '' } } : it)))}
              placeholder="跳转链接(可选)"
              size="small"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button size="small" theme="borderless" icon={<IconChevronUp />} disabled={index === 0} onClick={() => {
              const next = [...list];
              [next[index - 1], next[index]] = [next[index], next[index - 1]];
              onChange(next);
            }} />
            <Button size="small" theme="borderless" icon={<IconChevronDown />} disabled={index === list.length - 1} onClick={() => {
              const next = [...list];
              [next[index + 1], next[index]] = [next[index], next[index + 1]];
              onChange(next);
            }} />
            <Button size="small" theme="borderless" type="danger" icon={<IconClose />} onClick={() => onChange(list.filter((_, i) => i !== index))} />
          </div>
        </div>
      ))}
      <Button size="small" icon={<IconPlus />} onClick={() => onChange([...list, { picUrl: '', picThumb: '', picName: '', picTitle: '', picLink: { link: '', name: '' } }])}>
        添加图片
      </Button>
    </div>
  );
}

/** 命名容器（非 frame）的字段集：pc-product-group 的扩展设置（对齐原版 components/*Settings.vue） */
const CONTAINER_VARIANTS: Record<string, SettingFieldDef[]> = {
  // 对齐原版 BuyBtnSettings.vue：showBtn/btnType/paddingLeftRight（按钮宽度仅在自定义文字时生效），无 text/颜色字段
  buyBtn: [
    { kind: 'radio', key: 'showBtn', label: '购买按钮', options: [{ label: '显示', value: 1 }, { label: '不显示', value: 0 }] },
    { kind: 'radio', key: 'btnType', label: '购买样式', options: [{ label: '样式一', value: 1 }, { label: '样式二', value: 2 }, { label: '样式三', value: 3 }], showIf: (m) => Number(m.showBtn) === 1 },
    { kind: 'slider', key: 'paddingLeftRight', label: '按钮宽度', max: 10, showIf: (m) => Number(m.showBtn) === 1 && String(m.text ?? '') !== '' },
  ],
  // 对齐原版 Settings.vue 扩展设置"商品颜色设置"
  productColor: [
    { kind: 'slider', key: 'infoLeftRightPadding', label: '商品间距', max: 20 },
    { kind: 'color', key: 'backgroundColor', label: '商品背景颜色' },
    { kind: 'color', key: 'titleColor', label: '商品标题颜色' },
    { kind: 'color', key: 'priceColor', label: '商品价格颜色' },
    { kind: 'color', key: 'crossedOutPriceColor', label: '商品划线价颜色', resetValue: '#999999' },
  ],
  // 对齐原版 Settings.vue 扩展设置"分组标题设置"（标题分割线颜色不受"分组标题"开关控制）
  groupTitle: [
    { kind: 'slider', key: 'marginLeftRight', label: '分组标题间距', max: 50 },
    { kind: 'radio', key: 'showTitle', label: '分组标题', options: [{ label: '显示', value: 1 }, { label: '不显示', value: 0 }] },
    { kind: 'radio', key: 'bigTitleFontSize', label: '标题大小', options: [{ label: '小', value: 14 }, { label: '中', value: 16 }, { label: '大', value: 18 }], showIf: (m) => Number(m.showTitle) === 1 },
    { kind: 'color', key: 'titleColor', label: '标题默认颜色', showIf: (m) => Number(m.showTitle) === 1 },
    { kind: 'color', key: 'activeTitleColor', label: '标题选中颜色', showIf: (m) => Number(m.showTitle) === 1 },
    { kind: 'color', key: 'activeTitleBgColor', label: '标题选中背景色', showIf: (m) => Number(m.showTitle) === 1 },
    { kind: 'slider', key: 'titlePaddingTopBottom', label: '标题上下内边距', max: 30, showIf: (m) => Number(m.showTitle) === 1 },
    { kind: 'slider', key: 'titlePaddingLeftRight', label: '标题左右内边距', max: 30, showIf: (m) => Number(m.showTitle) === 1 },
    { kind: 'slider', key: 'titleRadius', label: '标题圆角', max: 20, showIf: (m) => Number(m.showTitle) === 1 },
    { kind: 'color', key: 'splitLineColor', label: '标题分割线颜色', resetValue: 'transparent' },
  ],
  // 对齐原版 ModuleStyleSettings.vue
  moduleStyle: [
    { kind: 'slider', key: 'boxPaddingTop', label: '模块顶部间距', max: 30 },
    { kind: 'slider', key: 'boxPaddingBottom', label: '模块底部间距', max: 30 },
    { kind: 'slider', key: 'boxPadding', label: '模块左右间距', max: 30 },
    { kind: 'color', key: 'backgroundColor', label: '模块背景颜色' },
  ],
  // 对齐原版 ContentStyleSettings.vue：精简为圆角 + 背景颜色
  contentStyle: [
    { kind: 'slider', key: 'boxRadius', label: '内容区圆角半径', max: 40 },
    { kind: 'color', key: 'backgroundColor', label: '内容区背景颜色', resetValue: '#ffffff' },
  ],
};

function FieldControl({
  field,
  moduleData,
  onChange,
}: {
  field: SettingFieldDef;
  moduleData: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}) {
  const categoryOptions = useCategoryOptions();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [grouponVisible, setGrouponVisible] = useState(false);
  const value = getPath(moduleData, field.key);

  const set = (v: unknown) => {
    let next = setPath(moduleData, field.key, v);
    if (field.onChangeExtra) next = field.onChangeExtra(next, v);
    onChange(next);
  };

  switch (field.kind) {
    case 'radio':
      return (
        <RadioGroup value={(value ?? field.options?.[0]?.value) as string | number | undefined} onChange={(e: any) => set(Number(e.target.value))}>
          {(field.options || []).map((o) => (
            <Radio key={String(o.value)} value={o.value}>{o.label}</Radio>
          ))}
        </RadioGroup>
      );
    case 'switch':
      return <Switch checked={Number(value) === 1} onChange={(v) => set(v ? 1 : 0)} />;
    case 'select':
      return (
        <Select
          value={(value ?? field.options?.[0]?.value) as string | number | undefined}
          optionList={(field.options || []).map((o) => ({ label: o.label, value: o.value }))}
          style={{ width: 160 }}
          onChange={(v) => set(v)}
        />
      );
    case 'input':
      return <Input value={String(value ?? '')} onChange={(v) => set(v)} />;
    case 'textarea':
      return <TextArea value={String(value ?? '')} onChange={(v: string) => set(v)} rows={2} maxLength={500} />;
    case 'number':
      return (
        <InputNumber
          value={typeof value === 'number' ? value : undefined}
          onChange={(v) => set(v ?? undefined)}
          min={field.min}
          max={field.max}
          style={{ width: 160 }}
        />
      );
    case 'slider':
      return (
        <Slider
          value={typeof value === 'number' ? value : 0}
          min={field.min ?? 0}
          max={field.max ?? 30}
          step={1}
          onChange={(v) => set(typeof v === 'number' ? v : (v as number[])[0])}
        />
      );
    case 'color':
      return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="color"
            value={String(value || '#ffffff')}
            onChange={(e) => set(e.target.value)}
            style={{ width: 46, height: 30, border: '1px solid var(--semi-color-border)', borderRadius: 4, cursor: 'pointer' }}
          />
          <Button size="small" onClick={() => set(field.resetValue ?? '')}>重置</Button>
          <Text type="tertiary" size="small">{String(value || '未设置')}</Text>
        </div>
      );
    case 'picList':
      return <PicListEditor value={(value as PicItem[]) || []} onChange={(v) => set(v)} showDesc={field.picDesc} />;
    case 'pic':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <PicListEditor value={value && (value as PicItem).picUrl ? [value as PicItem] : []} onChange={(v) => set(v[0] || { picUrl: '', picThumb: '' })} />
          <Button size="small" onClick={() => set((field.resetValue as PicItem) || { picUrl: '', picThumb: '' })}>重置</Button>
        </div>
      );
    case 'link': {
      const link = (value && typeof value === 'object' ? value : { link: '', title: '' }) as Record<string, any>;
      return (
        <div style={{ display: 'flex', gap: 6 }}>
          <Input value={link.link || ''} onChange={(v) => set({ ...link, link: v })} placeholder="链接地址" />
          <Input value={link.name || ''} onChange={(v) => set({ ...link, name: v })} placeholder="名称" style={{ width: 110 }} />
        </div>
      );
    }
    case 'linkList': {
      const list = (Array.isArray(value) ? value : []) as Array<{ link?: { link?: string; title?: string }; linkTitle?: string }>;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.map((item, index) => (
            <div key={index} style={{ display: 'flex', gap: 6 }}>
              <Input value={item.link?.link || ''} onChange={(v) => set(list.map((it, i) => (i === index ? { ...it, link: { ...it.link, link: v } } : it)))} placeholder="链接地址" />
              <Input value={item.linkTitle || ''} onChange={(v) => set(list.map((it, i) => (i === index ? { ...it, linkTitle: v } : it)))} placeholder="名称" style={{ width: 110 }} />
              <Button size="small" theme="borderless" type="danger" icon={<IconClose />} onClick={() => set(list.filter((_, i) => i !== index))} />
            </div>
          ))}
          <Button size="small" icon={<IconPlus />} onClick={() => set([...list, { link: { link: '', title: '' }, linkTitle: '' }])}>
            添加链接
          </Button>
        </div>
      );
    }
    case 'category':
      return (
        <Select
          value={typeof value === 'number' && value > 0 ? value : undefined}
          optionList={categoryOptions}
          showClear
          filter
          style={{ width: '100%' }}
          placeholder="选择商品分类"
          onChange={(v) => set(v ? Number(v) : 0)}
        />
      );
    case 'categoryMulti': {
      const arr = Array.isArray(value) ? value : typeof value === 'number' && value > 0 ? [value] : [];
      return (
        <Select
          value={arr as unknown as string[]}
          optionList={categoryOptions}
          multiple
          showClear
          filter
          style={{ width: '100%' }}
          placeholder="选择商品分类(可多选)"
          onChange={(v) => set(((v as unknown as number[]) || []).map(Number))}
        />
      );
    }
    case 'productIds': {
      const ids = (Array.isArray(value) ? value : []) as number[];
      return (
        <div>
          <Button icon={<IconPlus />} onClick={() => setPickerVisible(true)}>选择商品（已选 {ids.length}）</Button>
          {ids.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {ids.map((id) => <Tag key={id} size="small">#{id}</Tag>)}
            </div>
          )}
          {pickerVisible && (
            <ProductPickerModal visible selectedIds={ids} onOk={(nextIds) => { set(nextIds); setPickerVisible(false); }} onCancel={() => setPickerVisible(false)} />
          )}
        </div>
      );
    }
    case 'products': {
      const products = (value && typeof value === 'object' ? value : productsDefaults()) as Record<string, any>;
      const setProducts = (next: Record<string, any>) => set(next);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>选品方式</Text>
            <RadioGroup value={products.productSelectType ?? 1} onChange={(e: any) => setProducts({ ...products, productSelectType: Number(e.target.value) })}>
              <Radio value={1}>选商品</Radio>
              <Radio value={2}>按分类</Radio>
              <Radio value={3}>按标签</Radio>
            </RadioGroup>
          </div>
          {Number(products.productSelectType) === 1 && (
            <div>
              <Button icon={<IconPlus />} onClick={() => setPickerVisible(true)}>选择商品（已选 {((products.productIds || []) as number[]).length}）</Button>
              {pickerVisible && (
                <ProductPickerModal visible selectedIds={(products.productIds || []) as number[]} onOk={(nextIds) => { setProducts({ ...products, productIds: nextIds }); setPickerVisible(false); }} onCancel={() => setPickerVisible(false)} />
              )}
            </div>
          )}
          {Number(products.productSelectType) === 2 && (
            <Select value={products.productCategoryId || undefined} optionList={categoryOptions} showClear filter placeholder="选择分类" onChange={(v) => setProducts({ ...products, productCategoryId: v ? Number(v) : 0 })} />
          )}
          {Number(products.productSelectType) === 3 && (
            <Input value={products.productTag || ''} onChange={(v) => setProducts({ ...products, productTag: v })} placeholder="商品标签" />
          )}
          {[2, 3].includes(Number(products.productSelectType)) && (
            <div>
              <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>商品数量</Text>
              <InputNumber
                value={products.productNumber ?? 10}
                onChange={(v) => setProducts({ ...products, productNumber: v ?? 10 })}
                min={field.numberMin ?? 1}
                max={field.numberMax}
                style={{ width: 140 }}
              />
            </div>
          )}
        </div>
      );
    }
    case 'groupon': {
      const item = value as Record<string, any> | undefined | null;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {item ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag color="blue">{item.name || `活动#${item.grouponPromotionId}`}</Tag>
              <Button size="small" theme="borderless" type="danger" onClick={() => set(null)}>移除</Button>
            </div>
          ) : (
            <Text type="tertiary" size="small">未选择活动</Text>
          )}
          <Button icon={<IconPlus />} onClick={() => setGrouponVisible(true)}>选择拼团活动</Button>
          {grouponVisible && (
            <GrouponPickerModal visible current={item || null} onOk={(next) => { set(next); setGrouponVisible(false); }} onCancel={() => setGrouponVisible(false)} />
          )}
        </div>
      );
    }
    case 'title': {
      const titleData = (value && typeof value === 'object' ? value : standardTitle()) as Record<string, any>;
      return (
        <div style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Text strong size="small">{field.label}</Text>
          {titleFields({
            moreType: !field.titleHideMoreType,
            verticalPadding: !field.titleHideVerticalPadding && Object.prototype.hasOwnProperty.call(titleData, 'titlePaddingTop'),
            hideAlign: field.titleHideAlign,
          }).map((f) => {
            if (f.showIf && !f.showIf({ title: titleData })) return null;
            return (
              <div key={f.key}>
                <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>{f.label}{f.hint ? `（${f.hint}）` : ''}</Text>
                <FieldControl field={{ ...f, key: f.key.replace('title.', '') }} moduleData={titleData} onChange={(next) => set(next)} />
              </div>
            );
          })}
        </div>
      );
    }
    case 'container': {
      if (field.containerType && field.containerType !== 'frame') {
        const group = (value && typeof value === 'object' ? value : {}) as Record<string, any>;
        return (
          <div style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Text strong size="small">{field.label}</Text>
            {(CONTAINER_VARIANTS[field.containerType] || []).map((f) => {
              if (f.showIf && !f.showIf(group)) return null;
              return (
                <div key={f.key}>
                  <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>{f.label}</Text>
                  <FieldControl field={f} moduleData={group} onChange={(next) => set(next)} />
                </div>
              );
            })}
          </div>
        );
      }
      const frame = (getPath(moduleData, field.key) && typeof getPath(moduleData, field.key) === 'object' ? getPath(moduleData, field.key) : standardFrame()) as Record<string, any>;
      return (
        <div style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Text strong size="small">{field.label || '容器设置'}</Text>
          {containerFields().map((f) => (
            <div key={f.key}>
              <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>{f.label}</Text>
              <FieldControl field={{ ...f, key: f.key.replace('frame.', '') }} moduleData={frame} onChange={(next) => set(next)} />
            </div>
          ))}
        </div>
      );
    }
    case 'heroCards': {
      const cards = (Array.isArray(value) ? value : []) as Array<Record<string, any>>;
      const updateCard = (index: number, updater: (c: Record<string, any>) => Record<string, any>) => {
        set(cards.map((c, i) => (i === index ? updater(c) : c)));
      };
      const labelColors = (prefix: string, label: string) => [
        { kind: 'color' as const, key: `${prefix}BgColorA`, label: `${label}色A` },
        { kind: 'color' as const, key: `${prefix}BgColorB`, label: `${label}色B` },
      ];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cards.map((card, ci) => (
            <div key={ci} style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag size="small" color="blue">卡位 {ci + 1}</Tag>
                <Input
                  value={card.moduleTitle || ''}
                  onChange={(v) => updateCard(ci, (c) => ({ ...c, moduleTitle: v }))}
                  placeholder="卡片标题"
                  size="small"
                />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Input value={card.moduleSubTitle || ''} onChange={(v) => updateCard(ci, (c) => ({ ...c, moduleSubTitle: v }))} placeholder="子标题" size="small" />
                <input
                  type="color"
                  value={card.moduleSubTitleBgColorA || '#ff4e4e'}
                  onChange={(e) => updateCard(ci, (c) => ({ ...c, moduleSubTitleBgColorA: e.target.value }))}
                  style={{ width: 34, height: 28, border: '1px solid var(--semi-color-border)', borderRadius: 4, cursor: 'pointer' }}
                  title="子标题背景色A"
                />
                <input
                  type="color"
                  value={card.moduleSubTitleBgColorB || '#e1251b'}
                  onChange={(e) => updateCard(ci, (c) => ({ ...c, moduleSubTitleBgColorB: e.target.value }))}
                  style={{ width: 34, height: 28, border: '1px solid var(--semi-color-border)', borderRadius: 4, cursor: 'pointer' }}
                  title="子标题背景色B"
                />
                <Select
                  value={card.moduleSubTitleBgType || 'leftRight'}
                  optionList={[{ label: '左右渐变', value: 'leftRight' }, { label: '上下渐变', value: 'upDown' }, { label: '对角渐变', value: 'diagonal' }]}
                  style={{ width: 110 }}
                  onChange={(v) => updateCard(ci, (c) => ({ ...c, moduleSubTitleBgType: v }))}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Text type="tertiary" size="small">显示价格</Text>
                <Switch checked={Number(card.showPrice) === 1} onChange={(v) => updateCard(ci, (c) => ({ ...c, showPrice: v ? 1 : 0 }))} />
                <Input
                  value={card.link?.link || ''}
                  onChange={(v) => updateCard(ci, (c) => ({ ...c, link: { ...c.link, link: v, name: c.link?.name || '' } }))}
                  placeholder="跳转链接(可选)"
                  size="small"
                  style={{ flex: 1 }}
                />
              </div>
              {((card.products || []) as Array<Record<string, any>>).map((p, pi) => (
                <div key={pi} style={{ borderTop: '1px dashed var(--semi-color-border)', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Text type="tertiary" size="small">商品槽 {pi + 1}</Text>
                  <Input
                    value={p.pic?.picUrl || ''}
                    onChange={(v) => updateCard(ci, (c) => ({
                      ...c,
                      products: (c.products || []).map((x: any, xi: number) => (xi === pi ? { ...x, pic: { ...(x.pic || {}), picUrl: v, picThumb: v } } : x)),
                    }))}
                    placeholder="商品图 URL"
                    size="small"
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Input value={p.price || ''} onChange={(v) => updateCard(ci, (c) => ({ ...c, products: (c.products || []).map((x: any, xi: number) => (xi === pi ? { ...x, price: v } : x)) }))} placeholder="价格如 ¥88.8" size="small" />
                    <Input value={p.label || ''} onChange={(v) => updateCard(ci, (c) => ({ ...c, products: (c.products || []).map((x: any, xi: number) => (xi === pi ? { ...x, label: v } : x)) }))} placeholder="角标文字(可选)" size="small" />
                  </div>
                  {p.label ? (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {labelColors('label', '角标').map((lc) => (
                        <input
                          key={lc.key}
                          type="color"
                          value={String((p as Record<string, any>)[lc.key.replace('label', 'label')] || '#ff9000')}
                          onChange={(e) => updateCard(ci, (c) => ({
                            ...c,
                            products: (c.products || []).map((x: any, xi: number) => (xi === pi ? { ...x, [lc.key]: e.target.value } : x)),
                          }))}
                          style={{ width: 34, height: 26, border: '1px solid var(--semi-color-border)', borderRadius: 4, cursor: 'pointer' }}
                          title={lc.label}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }
    case 'hotarea': {
      const pics = (getPath(moduleData, 'picList') || []) as Array<PicItem & { hotarea?: Array<Record<string, any>> }>;
      const updatePics = (nextPics: Array<PicItem & { hotarea?: Array<Record<string, any>> }>) => {
        onChange(setPath(moduleData, 'picList', nextPics));
      };
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pics.length === 0 && <Text type="tertiary" size="small">请先在上方添加热图</Text>}
          {pics.map((pic, pi) => {
            const hotareas = pic.hotarea || [];
            const updateHotareas = (next: Array<Record<string, any>>) => {
              updatePics(pics.map((p, i) => (i === pi ? { ...p, hotarea: next } : p)));
            };
            return (
              <div key={pi} style={{ border: '1px solid var(--semi-color-border)', borderRadius: 6, padding: 8 }}>
                <Text strong size="small">图 {pi + 1} 的热区</Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                  {hotareas.map((h, index) => (
                    <div key={index} style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      <InputNumber value={h.width} onChange={(v) => updateHotareas(hotareas.map((x, i) => (i === index ? { ...x, width: v ?? 0 } : x)))} placeholder="宽" style={{ width: 70 }} />
                      <InputNumber value={h.height} onChange={(v) => updateHotareas(hotareas.map((x, i) => (i === index ? { ...x, height: v ?? 0 } : x)))} placeholder="高" style={{ width: 70 }} />
                      <InputNumber value={h.top} onChange={(v) => updateHotareas(hotareas.map((x, i) => (i === index ? { ...x, top: v ?? 0 } : x)))} placeholder="上" style={{ width: 70 }} />
                      <InputNumber value={h.left} onChange={(v) => updateHotareas(hotareas.map((x, i) => (i === index ? { ...x, left: v ?? 0 } : x)))} placeholder="左" style={{ width: 70 }} />
                      <Input value={h.link?.link || ''} onChange={(v) => updateHotareas(hotareas.map((x, i) => (i === index ? { ...x, link: { ...x.link, link: v } } : x)))} placeholder="链接" style={{ flex: 1, minWidth: 100 }} />
                      <Button size="small" theme="borderless" type="danger" icon={<IconClose />} onClick={() => updateHotareas(hotareas.filter((_, i) => i !== index))} />
                    </div>
                  ))}
                  <Button size="small" icon={<IconPlus />} onClick={() => updateHotareas([...hotareas, { width: 100, height: 60, top: 0, left: 0, link: { link: '', name: '' } }])}>
                    添加热区
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    case 'groupList': {
      const groups = (Array.isArray(value) ? value : []) as Array<Record<string, any>>;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groups.map((g, index) => (
            <div key={index} style={{ border: '1px solid var(--semi-color-border)', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Text strong size="small">第【{index + 1}】组{index === 0 ? '（固定，不可删除/拖动）' : ''}</Text>
              <div>
                <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>标题</Text>
                <Input value={g.title || ''} onChange={(v) => set(groups.map((x, i) => (i === index ? { ...x, title: v } : x)))} placeholder="请输入标题内容" />
              </div>
              <div>
                <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>标题图片</Text>
                <FieldControl
                  field={{ kind: 'pic', key: 'titlePic', label: '标题图片' }}
                  moduleData={g}
                  onChange={(nextGroup) => set(groups.map((x, i) => (i === index ? nextGroup : x)))}
                />
              </div>
              <RadioGroup value={g.sourceType || 'products'} onChange={(e: any) => {
                const type = e.target.value;
                if ((g.sourceType || 'products') === type) return;
                // 对齐原版 handleSourceTypeChange：切换来源时清空对应数据
                set(groups.map((x, i) => (i === index
                  ? (type === 'products'
                    ? { ...x, sourceType: type, productGroupId: undefined, productGroupName: undefined }
                    : { ...x, sourceType: type, productList: [] })
                  : x)));
              }}>
                <Radio value="products">选择商品</Radio>
                <Radio value="productGroup">商品分组</Radio>
              </RadioGroup>
              {(g.sourceType || 'products') === 'products' ? (
                <div>
                  <Button
                    size="small"
                    icon={<IconPlus />}
                    onClick={() => setPickerVisible(true)}
                  >
                    选择商品（已选 {((g.productIds || []) as number[]).length}）
                  </Button>
                  {pickerVisible && (
                    <ProductPickerModal visible selectedIds={(g.productIds || []) as number[]} onOk={(nextIds) => { set(groups.map((x, i) => (i === index ? { ...x, productIds: nextIds } : x))); setPickerVisible(false); }} onCancel={() => setPickerVisible(false)} />
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <InputNumber value={g.productGroupId} onChange={(v) => set(groups.map((x, i) => (i === index ? { ...x, productGroupId: v ?? undefined } : x)))} placeholder="商品分组 ID" style={{ width: 160 }} />
                  {g.productGroupName ? <Text type="tertiary" size="small">已选分组：{g.productGroupName}</Text> : null}
                </div>
              )}
              {index > 0 && (
                <Button size="small" theme="borderless" type="danger" icon={<IconClose />} onClick={() => set(groups.filter((_, i) => i !== index))}>
                  删除该组
                </Button>
              )}
            </div>
          ))}
          <Button size="small" icon={<IconPlus />} onClick={() => set([...groups, { sourceType: 'products', title: '', titlePic: { picUrl: '', picThumb: '' }, titleLink: { link: '', name: '' }, bannerPic: { picUrl: '', picThumb: '' }, bannerLink: { link: '', name: '' }, productIds: [], productList: [] }])}>
            添加一组
          </Button>
        </div>
      );
    }
    default:
      return null;
  }
}
