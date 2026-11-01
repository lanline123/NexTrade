import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Input,
  InputNumber,
  Select,
  Radio,
  RadioGroup,
  Space,
  Switch,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconArrowLeft, IconDelete, IconPlus } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import ImageUploader from '../components/ImageUploader';
import ProductPicker from '../components/ProductPicker';

const { Text } = Typography;

type MobileModule = {
  moduleIndex: number;
  type: string;
  label: string;
  isShow: boolean;
  module: Record<string, any>;
};

const MOBILE_LIBRARY: Array<{ type: string; label: string; group: string }> = [
  { type: 'imageAd', label: '图片广告', group: '图片' },
  { type: 'imageAd2', label: '图片广告2', group: '图片' },
  { type: 'imageSquareAd', label: '图片魔方', group: '图片' },
  { type: 'slidingImage', label: '大图滑动', group: '图片' },
  { type: 'imageShowcase', label: '图片橱窗', group: '图片' },
  { type: 'imageHotarea', label: '热图绘制', group: '图片' },
  { type: 'imageNav', label: '图文导航', group: '导航' },
  { type: 'categoryNav', label: '类目导航', group: '导航' },
  { type: 'catNav', label: '分类导航', group: '导航' },
  { type: 'categoryNavA3', label: '类目导航A3', group: '导航' },
  { type: 'tagNav', label: '标签导航', group: '导航' },
  { type: 'searchBar', label: '搜索栏', group: '导航' },
  { type: 'notice', label: '公告', group: '辅助' },
  { type: 'imageTextComponent', label: '图文介绍', group: '辅助' },
  { type: 'article', label: '文章列表', group: '辅助' },
  { type: 'countdown', label: '倒计时', group: '辅助' },
  { type: 'banner', label: '首焦轮播', group: '商品与营销' },
  { type: 'productA1', label: '商品A1', group: '商品与营销' },
  { type: 'productSlide', label: '商品滑动', group: '商品与营销' },
  { type: 'productCarousel', label: '商品轮播', group: '商品与营销' },
  { type: 'productGrouping', label: '商品分组', group: '商品与营销' },
  { type: 'limitedSpecial', label: '限时特惠', group: '商品与营销' },
  { type: 'newcomerCombo', label: '新人二重礼', group: '商品与营销' },
  { type: 'seckill', label: '秒杀', group: '商品与营销' },
  { type: 'groupon', label: '拼团', group: '商品与营销' },
  { type: 'videoNumber', label: '视频号', group: '商品与营销' },
  { type: 'live', label: '小程序直播', group: '商品与营销' },
];

const pickImages = (module: Record<string, any>): string[] => {
  const list = module.picList || module.bannerContent?.picList || [];
  if (!Array.isArray(list)) return [];
  return list
    .map((item: any) => item?.picUrl || item?.picThumb || '')
    .filter(Boolean);
};


type FieldSpec = {
  path: string;
  label: string;
  kind: 'images' | 'text' | 'textarea' | 'number' | 'switch' | 'color' | 'image' | 'products' | 'productSource';
  withTitle?: boolean;
};

const MODULE_FIELDS: Record<string, FieldSpec[]> = {
  imageAd: [{ path: 'picList', label: '广告图', kind: 'images' }],
  imageAd2: [{ path: 'picList', label: '广告图', kind: 'images' }],
  imageSquareAd: [{ path: 'picList', label: '魔方图片', kind: 'images' }, { path: 'title.showTitle', label: '显示标题', kind: 'switch' }, { path: 'title.titleText', label: '标题内容', kind: 'text' }, { path: 'title.titleColor', label: '标题颜色', kind: 'color' }, { path: 'title.showMore', label: '显示更多', kind: 'switch' }],
  slidingImage: [{ path: 'picList', label: '滑动图片', kind: 'images' }],
  banner: [
    { path: 'bannerContent.picList', label: '轮播图', kind: 'images' },
    { path: 'bannerContent.height', label: '轮播高度', kind: 'number' },
    { path: 'bannerContent.picRadius', label: '图片圆角', kind: 'number' },
    { path: 'logoPic.picUrl', label: 'LOGO图片', kind: 'image' },
    { path: 'logoHeight', label: 'LOGO高度', kind: 'number' },
    { path: 'navContent.showNav', label: '显示导航', kind: 'switch' },
    { path: 'searchContent.showSearch', label: '显示搜索', kind: 'switch' },
    { path: 'searchContent.searchText', label: '搜索提示文字', kind: 'text' },
    { path: 'searchContent.menuIcon', label: '显示菜单图标', kind: 'switch' },
    { path: 'searchContent.signIcon', label: '显示签到图标', kind: 'switch' },
  ],
  imageNav: [{ path: 'picList', label: '导航图标', kind: 'images', withTitle: true }],
  categoryNav: [{ path: 'categoryList', label: '分类图标', kind: 'images', withTitle: true }],
  catNav: [{ path: 'categoryList', label: '分类图标', kind: 'images', withTitle: true }],
  imageTextComponent: [
    { path: 'title', label: '标题', kind: 'text' },
    { path: 'description', label: '描述', kind: 'textarea' },
    { path: 'picUrl.picUrl', label: '主图', kind: 'image' },
  ],
  productA1: [
    { path: 'products', label: '商品来源', kind: 'productSource' },
    { path: 'title.showTitle', label: '显示标题', kind: 'switch' },
    { path: 'title.titleText', label: '标题内容', kind: 'text' },
    { path: 'title.titleColor', label: '标题颜色', kind: 'color' },
    { path: 'title.descText', label: '副标题', kind: 'text' },
    { path: 'title.descColor', label: '副标题颜色', kind: 'color' },
    { path: 'title.showMore', label: '显示更多', kind: 'switch' },
    { path: 'title.moreType', label: '更多类型', kind: 'text' },

    { path: 'showName', label: '显示名称', kind: 'switch' },
    { path: 'showPrice', label: '显示价格', kind: 'switch' },
  ],
  productSlide: [
    { path: 'products', label: '商品来源', kind: 'productSource' },
    { path: 'title.showTitle', label: '显示标题', kind: 'switch' },
    { path: 'title.titleText', label: '标题内容', kind: 'text' },
    { path: 'title.titleColor', label: '标题颜色', kind: 'color' },
    { path: 'title.descText', label: '副标题', kind: 'text' },
    { path: 'title.descColor', label: '副标题颜色', kind: 'color' },
    { path: 'title.showMore', label: '显示更多', kind: 'switch' },
    { path: 'title.moreType', label: '更多类型', kind: 'text' },

    { path: 'showProductName', label: '显示名称', kind: 'switch' },
    { path: 'showPrice', label: '显示价格', kind: 'switch' },
  ],
  seckill: [
    { path: 'title.showTitle', label: '显示标题', kind: 'switch' },
    { path: 'title.titleText', label: '标题内容', kind: 'text' },
    { path: 'title.titleColor', label: '标题颜色', kind: 'color' },
    { path: 'title.descText', label: '副标题', kind: 'text' },
    { path: 'title.descColor', label: '副标题颜色', kind: 'color' },
    { path: 'title.showMore', label: '显示更多', kind: 'switch' },
    { path: 'title.moreType', label: '更多类型', kind: 'text' },
  ],
  groupon: [
    { path: 'title.showTitle', label: '显示标题', kind: 'switch' },
    { path: 'title.titleText', label: '标题内容', kind: 'text' },
    { path: 'title.titleColor', label: '标题颜色', kind: 'color' },
    { path: 'title.descText', label: '副标题', kind: 'text' },
    { path: 'title.descColor', label: '副标题颜色', kind: 'color' },
    { path: 'title.showMore', label: '显示更多', kind: 'switch' },
    { path: 'title.moreType', label: '更多类型', kind: 'text' },
  ],
  limitedSpecial: [
    { path: 'products', label: '商品来源', kind: 'productSource' },
    { path: 'title.showTitle', label: '显示标题', kind: 'switch' },
    { path: 'title.titleText', label: '标题内容', kind: 'text' },
    { path: 'title.titleColor', label: '标题颜色', kind: 'color' },
    { path: 'title.descText', label: '副标题', kind: 'text' },
    { path: 'title.descColor', label: '副标题颜色', kind: 'color' },
    { path: 'title.showMore', label: '显示更多', kind: 'switch' },
    { path: 'showPrice', label: '显示价格', kind: 'switch' },
    { path: 'showProductName', label: '显示名称', kind: 'switch' },
    { path: 'showMarketPrice', label: '显示划线价', kind: 'switch' },
  ],
  productGrouping: [
    { path: 'products', label: '商品来源', kind: 'productSource' },
    { path: 'title.showTitle', label: '显示标题', kind: 'switch' },
    { path: 'title.titleText', label: '标题内容', kind: 'text' },
    { path: 'title.titleColor', label: '标题颜色', kind: 'color' },
    { path: 'title.descText', label: '副标题', kind: 'text' },
    { path: 'title.descColor', label: '副标题颜色', kind: 'color' },
    { path: 'title.showMore', label: '显示更多', kind: 'switch' },
    { path: 'showProductName', label: '显示名称', kind: 'switch' },
    { path: 'showProductPrice', label: '显示价格', kind: 'switch' },
    { path: 'productNameRow', label: '名称行数', kind: 'number' },
  ],
  newcomerCombo: [
    { path: 'headerTitle', label: '主标题', kind: 'text' },
    { path: 'headerSubTitle', label: '副标题', kind: 'text' },
    { path: 'section1Title', label: '第一重礼标题', kind: 'text' },
    { path: 'section2Title', label: '第二重礼标题', kind: 'text' },
    { path: 'showHeader', label: '显示头部', kind: 'switch' },
    { path: 'showSection1', label: '显示第一重礼', kind: 'switch' },
    { path: 'showSection2', label: '显示第二重礼', kind: 'switch' },
    { path: 'products', label: '商品来源', kind: 'productSource' },
  ],
  productCarousel: [
    { path: 'moduleTitle', label: '模块标题', kind: 'text' },
    { path: 'showModuleTitle', label: '显示模块标题', kind: 'switch' },
    { path: 'showName', label: '显示名称', kind: 'switch' },
    { path: 'showPrice', label: '显示价格', kind: 'switch' },
    { path: 'showMarketPrice', label: '显示划线价', kind: 'switch' },
  ],
  categoryNavA3: [
    { path: 'categoryList', label: '分类图标', kind: 'images', withTitle: true },
    { path: 'rowNum', label: '每行数量', kind: 'number' },
    { path: 'listStyleType', label: '列表样式', kind: 'text' },
  ],
  imageShowcase: [
    { path: 'picList', label: '橱窗图片', kind: 'images' },
    { path: 'listStyle', label: '列表样式', kind: 'number' },
    { path: 'rowNum', label: '排列布局', kind: 'number' },
    { path: 'picRatio', label: '图片比例', kind: 'text' },
    { path: 'picFillType', label: '图片模式', kind: 'text' },
    { path: 'picRadius', label: '图片圆角', kind: 'number' },
    { path: 'imgPadding', label: '图片间距', kind: 'number' },
    { path: 'boxShadow', label: '模块投影', kind: 'switch' },
  ],
  tagNav: [
    { path: 'textWeight', label: '文本样式', kind: 'number' },
    { path: 'groupGap', label: '分组间距', kind: 'number' },
  ],
  countdown: [
    { path: 'moduleTitle.title', label: '模块大标题', kind: 'text' },
    { path: 'moduleTitle.subTitle', label: '模块小标题', kind: 'text' },
    { path: 'moduleTitle.moreText', label: '右侧提示信息', kind: 'text' },
    { path: 'countdownData.showCountdown', label: '显示倒计时', kind: 'switch' },
    { path: 'countdownData.countdownType', label: '倒计时类型', kind: 'number' },
    { path: 'countdownData.dailyTime', label: '每日循环时间', kind: 'text' },
    { path: 'countdownData.specifyTime', label: '指定时间', kind: 'text' },
    { path: 'countdownData.marginTop', label: '顶部距离', kind: 'number' },
  ],
  searchBar: [
    { path: 'text', label: '搜索框文字', kind: 'text' },
  ],
  notice: [
    { path: 'text', label: '公告内容', kind: 'text' },
    { path: 'icoPic.picUrl', label: '公告图标', kind: 'image' },
    { path: 'nociceEffect', label: '文字效果(滚动/静止)', kind: 'text' },
  ],
  article: [
    { path: 'style', label: '展示风格', kind: 'number' },
    { path: 'articleCategoryId', label: '文章分类', kind: 'number' },
    { path: 'articleNum', label: '文章数量', kind: 'number' },
    { path: 'showTime', label: '显示日期', kind: 'switch' },
    { path: 'showPageView', label: '显示浏览量', kind: 'switch' },
    { path: 'showLike', label: '显示点赞数', kind: 'switch' },
  ],
  videoNumber: [
    { path: 'titleText', label: '标题', kind: 'text' },
    { path: 'liveTitle', label: '直播文案', kind: 'text' },
  ],
  live: [{ path: 'titleText', label: '标题', kind: 'text' }],
};

const getPath = (source: any, path: string): any =>
  path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), source);

const setPath = (source: any, path: string, value: any): any => {
  const keys = path.split('.');
  const root = Array.isArray(source) ? [...source] : { ...(source || {}) };
  let cursor: any = root;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
      return;
    }
    cursor[key] = Array.isArray(cursor[key]) ? [...cursor[key]] : { ...(cursor[key] || {}) };
    cursor = cursor[key];
  });
  return root;
};

function ImageListField({
  value,
  onChange,
  withTitle,
}: {
  value: any;
  onChange: (next: any[]) => void;
  withTitle?: boolean;
}) {
  const list = Array.isArray(value) ? value : [];
  const update = (index: number, patch: Record<string, any>) => {
    onChange(list.map((item: any, i: number) => (i === index ? { ...item, ...patch } : item)));
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {list.map((item: any, index: number) => (
        <div key={index} style={{ border: '1px solid #eef0f3', borderRadius: 6, padding: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {item?.picUrl || item?.picThumb ? (
              <img src={item.picUrl || item.picThumb} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
            ) : (
              <div style={{ width: 40, height: 40, background: '#f2f3f5', borderRadius: 4 }} />
            )}
            <Input
              value={item?.picUrl || ''}
              placeholder="图片 URL"
              onChange={(next: string) => update(index, { picUrl: next, picThumb: next })}
              style={{ width: 150 }}
            />
            <Button theme="borderless" type="danger" size="small" onClick={() => onChange(list.filter((_: any, i: number) => i !== index))}>删除</Button>
          </div>
          <div style={{ marginTop: 6 }}>
            <ImageUploader
              value={item?.picUrl ? [item.picUrl] : []}
              single
              onChange={(urls) => update(index, { picUrl: urls[0] || '', picThumb: urls[0] || '' })}
            />
          </div>
          {withTitle ? (
            <Input
              value={item?.picTitle || ''}
              placeholder="标题"
              onChange={(next: string) => update(index, { picTitle: next })}
              style={{ marginTop: 6 }}
            />
          ) : null}
        </div>
      ))}
      <Button icon={<IconPlus />} size="small" onClick={() => onChange([...list, { picUrl: '', picThumb: '', picTitle: '' }])}>添加图片</Button>
    </div>
  );
}

function CategoryPickerField({
  value,
  categories,
  onChange,
}: {
  value: any;
  categories: Array<{ label: string; value: number; picUrl?: string }>;
  onChange: (next: any[]) => void;
}) {
  const list = Array.isArray(value) ? value : [];
  const selected = list.map((item: any) => Number(item.categoryId)).filter(Boolean);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Select
        multiple
        value={selected}
        placeholder="从分类树选择"
        filter
        maxTagCount={5}
        style={{ width: '100%' }}
        optionList={categories}
        onChange={(next) => {
          const ids = (Array.isArray(next) ? next : [next]).map(Number).filter(Boolean);
          onChange(ids.map((id) => {
            const old = list.find((item: any) => Number(item.categoryId) === id);
            if (old) return old;
            const category = categories.find((item) => item.value === id);
            return {
              categoryId: id,
              picTitle: category?.label?.split(' / ').pop() || '',
              picUrl: category?.picUrl || '',
              picThumb: category?.picUrl || '',
            };
          }));
        }}
      />
      <div style={{ color: '#98a2b3', fontSize: 12 }}>已选 {selected.length} 个分类，可在下方继续调整图标和标题</div>
    </div>
  );
}

function ProductSourceField({
  value,
  categories,
  onChange,
}: {
  value: Record<string, any>;
  categories: Array<{ label: string; value: number }>;
  onChange: (next: Record<string, any>) => void;
}) {
  const products = value || {};
  const type = Number(products.productSelectType || 1);
  const set = (patch: Record<string, any>) => onChange({ ...products, ...patch });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <RadioGroup value={type} onChange={(e: any) => set({ productSelectType: Number(e.target.value) })}>
        <Radio value={1}>选商品</Radio>
        <Radio value={2}>按分类</Radio>
        <Radio value={3}>按标签</Radio>
      </RadioGroup>
      {type === 1 ? (
        <ProductPicker
          value={Array.isArray(products.productIds) ? products.productIds.map(Number) : []}
          max={50}
          onChange={(ids) => set({ productIds: ids })}
        />
      ) : null}
      {type === 2 ? (
        <>
          <Select
            value={products.productCategoryId ? Number(products.productCategoryId) : undefined}
            placeholder="选择分类"
            showClear
            filter
            style={{ width: '100%' }}
            optionList={categories}
            onChange={(next) => set({ productCategoryId: Number(next) || 0 })}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#646a73', fontSize: 12 }}>商品数量</span>
            <InputNumber value={Number(products.productNumber) || 10} min={1} max={100} onChange={(next) => set({ productNumber: Number(next ?? 10) })} />
          </div>
        </>
      ) : null}
      {type === 3 ? (
        <>
          <Input value={String(products.productTag || '')} placeholder="商品标签" onChange={(next: string) => set({ productTag: next })} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#646a73', fontSize: 12 }}>商品数量</span>
            <InputNumber value={Number(products.productNumber) || 10} min={1} max={100} onChange={(next) => set({ productNumber: Number(next ?? 10) })} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function ModuleFields({
  item,
  categories,
  onChange,
}: {
  item: MobileModule;
  categories: Array<{ label: string; value: number }>;
  onChange: (module: Record<string, any>) => void;
}) {
  const specs = MODULE_FIELDS[item.type] || [];
  const isCategoryModule = item.type === 'categoryNav' || item.type === 'catNav' || item.type === 'imageNav';
  return (
    <>
      {isCategoryModule ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: '#646a73', fontSize: 12, marginBottom: 6 }}>选择分类</div>
          <CategoryPickerField
            value={getPath(item.module, 'categoryList')}
            categories={categories}
            onChange={(next) => onChange(setPath(item.module, 'categoryList', next))}
          />
        </div>
      ) : null}
      {specs.map((spec) => {
        const value = getPath(item.module, spec.path);
        return (
          <div key={spec.path} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ width: 90, color: '#646a73', fontSize: 12, lineHeight: '30px', flexShrink: 0 }}>{spec.label}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {spec.kind === 'images' ? (
                <ImageListField
                  value={value}
                  withTitle={spec.withTitle}
                  onChange={(next) => onChange(setPath(item.module, spec.path, next))}
                />
              ) : spec.kind === 'image' ? (
                <Input
                  value={String(value || '')}
                  placeholder="图片 URL"
                  onChange={(next: string) => onChange(setPath(item.module, spec.path, next))}
                />
              ) : spec.kind === 'products' ? (
                <ProductPicker
                  value={Array.isArray(value) ? value.map(Number) : []}
                  max={50}
                  onChange={(ids) => onChange(setPath(item.module, spec.path, ids))}
                />
              ) : spec.kind === 'productSource' ? (
                <ProductSourceField
                  value={value || {}}
                  categories={categories}
                  onChange={(next) => onChange(setPath(item.module, spec.path, next))}
                />
              ) : spec.kind === 'textarea' ? (
                <TextArea
                  value={String(value || '')}
                  autosize={{ minRows: 3, maxRows: 6 }}
                  onChange={(next: string) => onChange(setPath(item.module, spec.path, next))}
                />
              ) : spec.kind === 'switch' ? (
                <Switch checked={Boolean(value)} onChange={(next) => onChange(setPath(item.module, spec.path, next))} />
              ) : spec.kind === 'number' ? (
                <InputNumber value={Number(value) || 0} onChange={(next) => onChange(setPath(item.module, spec.path, Number(next ?? 0)))} style={{ width: 150 }} />
              ) : spec.kind === 'color' ? (
                <input type="color" value={String(value || '#ffffff')} onChange={(e) => onChange(setPath(item.module, spec.path, e.target.value))} />
              ) : (
                <Input value={String(value || '')} onChange={(next: string) => onChange(setPath(item.module, spec.path, next))} />
              )}
            </div>
          </div>
        );
      })}
      {item.module?.frame ? (
        <div style={{ borderTop: '1px solid #eef0f3', marginTop: 12, paddingTop: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>通用容器</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <span style={{ width: 90, color: '#646a73', fontSize: 12 }}>背景色</span>
            <input
              type="color"
              value={item.module.frame.backgroundColor || '#ffffff'}
              onChange={(e) => onChange(setPath(item.module, 'frame.backgroundColor', e.target.value))}
            />
          </div>
          {[
            { key: 'boxPadding', label: '内边距' },
            { key: 'boxPaddingTop', label: '上边距' },
            { key: 'boxPaddingBottom', label: '下边距' },
            { key: 'boxRadius', label: '圆角' },
          ].map((field) => (
            <div key={field.key} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <span style={{ width: 90, color: '#646a73', fontSize: 12 }}>{field.label}</span>
              <InputNumber
                value={Number(getPath(item.module, `frame.${field.key}`)) || 0}
                min={0}
                max={50}
                onChange={(next) => onChange(setPath(item.module, `frame.${field.key}`, Number(next ?? 0)))}
                style={{ width: 120 }}
              />
            </div>
          ))}
        </div>
      ) : null}
      {item.module?.moduleStyle ? (
        <div style={{ borderTop: '1px solid #eef0f3', marginTop: 12, paddingTop: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>模块样式</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <span style={{ width: 90, color: '#646a73', fontSize: 12 }}>背景色</span>
            <input
              type="color"
              value={item.module.moduleStyle.backgroundColor || '#ffffff'}
              onChange={(e) => onChange(setPath(item.module, 'moduleStyle.backgroundColor', e.target.value))}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <span style={{ width: 90, color: '#646a73', fontSize: 12 }}>上边距</span>
            <InputNumber
              value={Number(getPath(item.module, 'moduleStyle.bannerMarginTop')) || 0}
              min={0}
              max={50}
              onChange={(next) => onChange(setPath(item.module, 'moduleStyle.bannerMarginTop', Number(next ?? 0)))}
              style={{ width: 120 }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function MobileModulePreview({ item }: { item: MobileModule }) {
  const m = item.module || {};
  const images = pickImages(m);
  const title = m.title?.titleText || m.name || m.liveTitle || item.label;
  if (images.length) {
    return (
      <div style={{ padding: '6px 8px' }}>
        <img src={images[0]} alt="" style={{ width: '100%', maxHeight: 150, objectFit: 'cover', borderRadius: 6 }} />
        {images.length > 1 ? <div style={{ fontSize: 10, color: '#98a2b3', marginTop: 4 }}>{images.length} 张图</div> : null}
      </div>
    );
  }
  if (item.type === 'categoryNav' || item.type === 'catNav' || item.type === 'imageNav') {
    const cats = Array.isArray(m.categoryList) ? m.categoryList : [];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, padding: 10 }}>
        {(cats.length ? cats : Array.from({ length: 4 })).map((cat: any, index: number) => (
          <div key={index} style={{ textAlign: 'center', fontSize: 11 }}>
            <div style={{ width: 34, height: 34, margin: '0 auto 4px', borderRadius: 17, background: cat?.picUrl ? 'transparent' : '#eef1f5', overflow: 'hidden' }}>
              {cat?.picUrl ? <img src={cat.picUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
            </div>
            <div>{cat?.picTitle || '分类'}</div>
          </div>
        ))}
      </div>
    );
  }
  if (item.type === 'imageTextComponent') {
    return (
      <div style={{ padding: 12 }}>
        {m.picUrl?.picUrl ? <img src={m.picUrl.picUrl} alt="" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 6 }} /> : null}
        <div style={{ fontWeight: 600, marginTop: 8 }}>{m.title || item.label}</div>
        <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>{m.description || ''}</div>
      </div>
    );
  }
  return (
    <div style={{ padding: '14px 10px', background: '#f7f8fa', borderRadius: 6, color: '#646a73', textAlign: 'center', fontSize: 12 }}>
      {item.label || title}{item.type === 'productSlide' || item.type === 'productA1' ? ' · 商品模块' : ''}
    </div>
  );
}

export default function MobileDecorateEditor({ decorateId, onExit }: { decorateId: number; onExit: () => void }) {
  const [title, setTitle] = useState('');
  const [pageModule, setPageModule] = useState<Record<string, any>>({});
  const [pageType, setPageType] = useState(1);
  const [hasDraft, setHasDraft] = useState(false);
  const [categories, setCategories] = useState<Array<{ label: string; value: number; picUrl?: string }>>([]);
  const [moduleList, setModuleList] = useState<MobileModule[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    apiGet<any[]>('/product/category/getAllCategory')
      .then((tree) => {
        const flat: Array<{ label: string; value: number; picUrl?: string }> = [];
        const walk = (nodes: any[], prefix = '') => {
          (Array.isArray(nodes) ? nodes : []).forEach((node) => {
            flat.push({
              label: prefix ? `${prefix} / ${node.categoryName}` : node.categoryName,
              value: node.categoryId,
              picUrl: node.picUrl || node.categoryImage || node.image || '',
            });
            if (Array.isArray(node.children) && node.children.length) walk(node.children, node.categoryName);
          });
        };
        walk(Array.isArray(tree) ? tree : []);
        setCategories(flat);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!decorateId) return;
    setLoading(true);
    apiGet<any>('/decorate/decorate/detail', { id: decorateId, decorateType: 1, parentId: 0, localeId: 0 })
      .then((result) => {
        setTitle(result?.decorateTitle || '');
        setPageType(Number(result?.pageType) || 1);
        setHasDraft(Boolean(result?.draftData));
        const data = result?.draftData || result?.data || {};
        setPageModule(data.pageModule || {});
        setModuleList(Array.isArray(data.moduleList) ? data.moduleList.map((item: any, index: number) => ({
          moduleIndex: item.moduleIndex ?? Date.now() + index,
          type: item.type,
          label: item.label || item.type,
          isShow: item.isShow !== false,
          module: item.module || {},
        })) : []);
      })
      .catch((error) => Toast.error(error instanceof Error ? error.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [decorateId]);

  const active = activeIndex >= 0 ? moduleList[activeIndex] : null;

  const updateActive = (patch: Partial<MobileModule>) => {
    if (!active) return;
    setModuleList((prev) => prev.map((item, index) => (index === activeIndex ? { ...item, ...patch } : item)));
  };
  const updateField = (key: string, value: any) => {
    if (!active) return;
    updateActive({ module: { ...active.module, [key]: value } });
  };

  const addModule = (type: string, label: string, index?: number) => {
    const defaults: Record<string, Record<string, any>> = {
      imageAd: { picList: [] },
      imageAd2: { picList: [] },
      imageSquareAd: { picList: [] },
      slidingImage: { picList: [] },
      banner: {
        bannerContent: { picList: [], height: 200, picRadius: 6 },
        logoPic: { picUrl: '', picThumb: '' },
        logoHeight: 100,
        navContent: { showNav: 1, navList: [] },
        searchContent: { showSearch: 1, searchText: '搜索商品', menuIcon: 1, signIcon: 1 },
      },
      imageNav: { picList: [] },
      categoryNav: { categoryList: [] },
      catNav: { categoryList: [] },
      imageTextComponent: { title: '', description: '', picUrl: { picUrl: '' } },
      productA1: { title: { titleText: '' }, showName: 1, showPrice: 1 },
      productSlide: { title: { titleText: '' }, showProductName: 1, showPrice: 1 },
      seckill: { title: { titleText: '' } },
      groupon: { title: { titleText: '' } },
      videoNumber: { titleText: '', liveTitle: '' },
      limitedSpecial: { products: { productSelectType: 1, productIds: [], productNumber: 6 }, title: {}, showPrice: 1, showProductName: 1 },
      productGrouping: { products: { productSelectType: 1, productIds: [], productNumber: 8 }, title: {}, showProductName: 1, showProductPrice: 1, productNameRow: 1 },
      newcomerCombo: { headerTitle: '新人专享二重礼', headerSubTitle: '限量供应 先到先得', section1Title: '新人尝鲜价', section2Title: '新人专享礼包', showHeader: 1, showSection1: 1, showSection2: 1, products: { productSelectType: 1, productIds: [], productNumber: 6 } },
      productCarousel: { moduleTitle: '', showModuleTitle: 1, showName: 1, showPrice: 1, showMarketPrice: 1 },
      categoryNavA3: { categoryList: [], rowNum: 4 },
      imageShowcase: { picList: [], listStyle: 1, rowNum: 1, picRatio: '1:1', picFillType: 'cover', picRadius: 0, imgPadding: 0, boxShadow: 0 },
      searchBar: { text: '搜索商品' },
      notice: { text: '公告内容', icoPic: { picUrl: '', picThumb: '' }, nociceEffect: 'scroll' },
      article: { style: 1, articleCategoryId: 0, articleNum: 6, showTime: 1, showPageView: 1, showLike: 1 },
      imageHotarea: { picList: [], hotareaList: [] },
      tagNav: { groupList: [], textWeight: 400, groupGap: 10 },
      countdown: { moduleTitle: { title: '', subTitle: '', moreText: '' }, countdownData: { showCountdown: 1, countdownType: 1, dailyTime: '', specifyTime: '', marginTop: 0 } },
      live: { titleText: '' },
    };
    const item: MobileModule = {
      moduleIndex: Date.now(),
      type,
      label,
      isShow: true,
      module: defaults[type] || {},
    };
    if (typeof index === 'number') {
      setModuleList((prev) => [...prev.slice(0, index), item, ...prev.slice(index)]);
      setActiveIndex(index);
    } else {
      setModuleList((prev) => [...prev, item]);
      setActiveIndex(moduleList.length);
    }
  };

  const save = async (mode: 'draft' | 'publish') => {
    if (!decorateId) {
      Toast.warning('缺少装修页面 ID');
      return;
    }
    setSaving(mode);
    try {
      await apiPost(mode === 'draft' ? '/decorate/decorate/saveDraft' : '/decorate/decorate/publish', {
        id: decorateId,
        decorateType: 1,
        pageType,
        localeId: 0,
        parentId: 0,
        data: { pageModule, moduleList },
      });
      await apiPost('/decorate/decorate/updateField', {
        id: decorateId,
        field: 'decorateTitle',
        val: title,
      }).catch(() => undefined);
      Toast.success(mode === 'draft' ? '草稿已保存' : '发布成功');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f5f7fa' }}>
      <div style={{ height: 60, background: '#fff', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderBottom: '1px solid #e5e6eb' }}>
        <Button icon={<IconArrowLeft />} onClick={onExit}>返回列表</Button>
        <Input value={title} onChange={setTitle} style={{ width: 200 }} />
        <Tag color="blue">移动端装修</Tag>
        {hasDraft && <Tag color="cyan">草稿</Tag>}
        <div style={{ flex: 1 }} />
        <Button loading={saving === 'draft'} onClick={() => save('draft')}>保存草稿</Button>
        <Button theme="solid" type="primary" loading={saving === 'publish'} onClick={() => save('publish')}>保存并发布</Button>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ width: 220, background: '#fff', borderRight: '1px solid #e5e6eb', overflow: 'auto', padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>移动端模块</div>
          {MOBILE_LIBRARY.map((item) => (
            <div
              key={item.type}
              onClick={() => addModule(item.type, item.label)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/mobile-lib', item.type);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', marginBottom: 6, borderRadius: 6, background: '#f7f8fa', cursor: 'grab', fontSize: 13 }}
            >
              <span>{item.label}</span>
              <span style={{ color: '#98a2b3' }}>{item.group}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          <div style={{ width: 375, background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.08)', overflow: 'hidden' }}>
            <div style={{ height: 44, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0', fontWeight: 600 }}>{title || '移动端页面'}</div>
            <div style={{ minHeight: 600, background: pageModule.backgroundColor || '#fff' }}>
              {loading ? <div style={{ padding: 20, color: '#98a2b3' }}>加载中...</div> : moduleList.map((item, index) => (
                <div
                  key={item.moduleIndex}
                  onClick={() => setActiveIndex(index)}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const libType = e.dataTransfer.getData('text/mobile-lib');
                    if (libType) {
                      const lib = MOBILE_LIBRARY.find((entry) => entry.type === libType);
                      if (lib) addModule(lib.type, lib.label, index);
                      setDragIndex(null);
                      return;
                    }
                    if (dragIndex === null || dragIndex === index) return;
                    setModuleList((prev) => {
                      const next = [...prev];
                      const [moved] = next.splice(dragIndex, 1);
                      next.splice(index, 0, moved);
                      return next;
                    });
                    setActiveIndex(index);
                    setDragIndex(null);
                  }}
                  style={{
                    position: 'relative',
                    opacity: item.isShow ? 1 : 0.45,
                    outline: activeIndex === index ? '2px solid #1456f0' : '1px dashed transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, background: '#1456f0', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: '0 0 4px 0' }}>{item.label}</div>
                  <MobileModulePreview item={item} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ width: 300, background: '#fff', borderLeft: '1px solid #e5e6eb', overflow: 'auto', padding: 14 }}>
          {active ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <b>{active.label}</b>
                <Space>
                  <Button size="small" disabled={activeIndex <= 0} onClick={() => {
                    setModuleList((prev) => {
                      const next = [...prev];
                      [next[activeIndex - 1], next[activeIndex]] = [next[activeIndex], next[activeIndex - 1]];
                      return next;
                    });
                    setActiveIndex(activeIndex - 1);
                  }}>上移</Button>
                  <Button size="small" disabled={activeIndex >= moduleList.length - 1} onClick={() => {
                    setModuleList((prev) => {
                      const next = [...prev];
                      [next[activeIndex + 1], next[activeIndex]] = [next[activeIndex], next[activeIndex + 1]];
                      return next;
                    });
                    setActiveIndex(activeIndex + 1);
                  }}>下移</Button>
                  <Button size="small" onClick={() => {
                    if (!active) return;
                    const copy = { ...active, moduleIndex: Date.now(), label: `${active.label}-副本`, module: JSON.parse(JSON.stringify(active.module || {})) };
                    setModuleList((prev) => {
                      const next = [...prev];
                      next.splice(activeIndex + 1, 0, copy);
                      return next;
                    });
                    setActiveIndex(activeIndex + 1);
                  }}>复制</Button>
                  <Button icon={<IconDelete />} theme="borderless" type="danger" size="small" onClick={() => { setModuleList((prev) => prev.filter((_, i) => i !== activeIndex)); setActiveIndex(-1); }} />
                </Space>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <span style={{ width: 80, color: '#646a73' }}>显示</span>
                <Switch checked={active.isShow} onChange={(checked) => updateActive({ isShow: checked })} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <span style={{ width: 80, color: '#646a73' }}>模块名称</span>
                <Input value={active.label} onChange={(value: string) => updateActive({ label: value })} />
              </div>
              <ModuleFields item={active} categories={categories} onChange={(module) => updateActive({ module })} />
              <div style={{ borderTop: '1px solid #eef0f3', marginTop: 14, paddingTop: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>更多字段</div>
                {Object.entries(active.module || {})
                  .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
                  .slice(0, 20)
                  .map(([key, value]) => (
                    <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ width: 90, color: '#646a73', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }} title={key}>{key}</span>
                      {typeof value === 'boolean' ? (
                        <Switch checked={value} onChange={(checked) => updateField(key, checked)} />
                      ) : typeof value === 'number' ? (
                        <InputNumber value={value} onChange={(next) => updateField(key, Number(next ?? 0))} style={{ width: 150 }} />
                      ) : key.toLowerCase().includes('color') ? (
                        <input type="color" value={String(value) || '#ffffff'} onChange={(e) => updateField(key, e.target.value)} />
                      ) : (
                        <Input value={String(value)} onChange={(next: string) => updateField(key, next)} style={{ width: 160 }} />
                      )}
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <>
              <b>页面设置</b>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
                <span style={{ width: 80, color: '#646a73' }}>页面标题</span>
                <Input value={title} onChange={setTitle} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <span style={{ width: 80, color: '#646a73' }}>背景色</span>
                <input type="color" value={pageModule.backgroundColor || '#ffffff'} onChange={(e) => setPageModule({ ...pageModule, backgroundColor: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
                <span style={{ width: 80, color: '#646a73', lineHeight: '30px' }}>背景图</span>
                <div style={{ flex: 1 }}>
                  <ImageUploader
                    value={pageModule.backgroundImage?.picUrl ? [pageModule.backgroundImage.picUrl] : []}
                    single
                    onChange={(urls) => setPageModule({ ...pageModule, backgroundImage: { picUrl: urls[0] || '', picThumb: urls[0] || '' } })}
                  />
                </div>
              </div>
              <div style={{ color: '#98a2b3', fontSize: 12 }}>点击画布中的模块编辑属性</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
