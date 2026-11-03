import { useEffect, useState } from 'react';
import { Button, Input, SideSheet, Spin } from '@douyinfe/semi-ui';
import { IconClose } from '@douyinfe/semi-icons';
import { apiGet } from '../api';
import { useI18n } from '../i18n';
import './LinkPicker.css';

export interface LinkValue {
  path?: string;
  label?: string;
  name?: string;
  id?: number | string;
  sn?: string;
  link?: string;
  appLink?: string;
  data?: Record<string, any>;
  [key: string]: any;
}

type PickerCategory = 'member' | 'base' | 'product' | 'category' | 'brand' | 'coupon' | 'article' | 'decorate' | 'custom';

const MEMBER_LINKS = [
  { name: '会员中心', link: '/member' },
  { name: '我的订单', link: '/member/order/list' },
  { name: '我的钱包', link: '/member/wallet' },
  { name: '我的优惠券', link: '/member/coupon/list' },
  { name: '我的积分', link: '/member/point' },
  { name: '我的收藏', link: '/member/collect' },
  { name: '收货地址', link: '/member/address' },
  { name: '我的足迹', link: '/member/browsingHistory/list' },
];

const BASE_LINKS = [
  { name: '首页', link: '/' },
  { name: '购物车', link: '/cart' },
  { name: '店铺街', link: '/shop' },
  { name: '客服中心', link: '/service' },
];

export function linkDisplayText(link?: LinkValue): string {
  if (!link) return '';
  const label = link.label || link.path || '';
  const name = link.name || '';
  if (label && name && name !== label) return `${label}|${name}`;
  return label || name || link.link || '';
}

export default function LinkPicker({
  visible,
  value,
  onCancel,
  onOk,
  title,
}: {
  visible: boolean;
  value?: LinkValue;
  onCancel: () => void;
  onOk: (link: LinkValue) => void;
  title?: string;
}) {
  const { t } = useI18n();
  const [active, setActive] = useState<PickerCategory>('member');
  const [selected, setSelected] = useState<LinkValue>({});
  const [keyword, setKeyword] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customLink, setCustomLink] = useState('');

  const categories: Array<{ key: PickerCategory; label: string }> = [
    { key: 'member', label: t('会员页面') },
    { key: 'base', label: t('其它页面') },
    { key: 'product', label: t('商品详情页') },
    { key: 'category', label: t('分类搜索') },
    { key: 'brand', label: t('品牌搜索') },
    { key: 'coupon', label: t('优惠券') },
    { key: 'article', label: t('文章资讯') },
    { key: 'decorate', label: t('装修页面') },
    { key: 'custom', label: t('自定义链接') },
  ];

  useEffect(() => {
    if (!visible) return;
    setSelected(value && Object.keys(value).length ? value : {});
    setActive('member');
    setKeyword('');
    setCustomName(value?.name || '');
    setCustomLink(value?.link || '');
  }, [visible, value]);

  const loadRows = async () => {
    if (!visible || active === 'member' || active === 'base' || active === 'custom') return;
    setLoading(true);
    try {
      let result: any = null;
      if (active === 'product') {
        result = await apiGet<any>('/product/product/list', { keyword: keyword || undefined, page: 1, size: 60, productType: 1 });
      } else if (active === 'category') {
        result = await apiGet<any[]>('/product/category/getAllCategory');
      } else if (active === 'brand') {
        result = await apiGet<any>('/product/brand/list', { keyword: keyword || undefined, page: 1, size: 60 });
      } else if (active === 'coupon') {
        result = await apiGet<any>('/promotion/coupon/list', { keyword: keyword || undefined, page: 1, size: 60 });
      } else if (active === 'article') {
        result = await apiGet<any>('/content/article/list', { keyword: keyword || undefined, page: 1, size: 60 });
      } else if (active === 'decorate') {
        result = await apiGet<any>('/decorate/decorate/list', { page: 1, size: 60, decorateType: 2 });
      }
      if (active === 'category') {
        const flat: any[] = [];
        const walk = (nodes: any[]) => nodes.forEach((node) => {
          flat.push({ id: node.categoryId, name: node.categoryName, isCategory: true });
          if (Array.isArray(node.children)) walk(node.children);
        });
        walk(Array.isArray(result) ? result : []);
        setRows(flat);
      } else {
        setRows(result?.records || result?.list || result || []);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, active]);

  const chooseBase = (item: { name: string; link: string }) => {
    setSelected({ path: 'base', label: item.name, name: item.name, link: item.link });
  };

  const chooseProduct = (row: any) => {
    setSelected({ path: 'product', label: t('商品详情页'), name: row.productName, id: row.productId, sn: row.productSn, data: { id: row.productId, sn: row.productSn } });
  };

  const chooseCategory = (row: any) => {
    setSelected({ path: 'list', label: t('分类搜索'), id: row.id, name: row.name, data: { id: row.id } });
  };

  const chooseBrand = (row: any) => {
    setSelected({ path: 'brand', label: t('品牌搜索'), id: row.brandId, name: row.brandName, data: { id: row.brandId } });
  };

  const chooseCoupon = (row: any) => {
    setSelected({ path: 'coupon', label: t('优惠券'), id: row.couponId, name: row.couponName, data: { id: row.couponId } });
  };

  const chooseArticle = (row: any) => {
    setSelected({ path: 'article', label: t('文章资讯'), id: row.articleId, name: row.articleTitle || row.title, data: { id: row.articleId } });
  };

  const chooseDecorate = (row: any) => {
    setSelected({ path: 'decorate', label: t('装修页面'), id: row.decorateId, name: row.decorateTitle, data: { id: row.decorateId } });
  };

  const chooseCustom = () => {
    if (!customLink.trim()) return;
    setSelected({ path: 'custom', label: t('自定义链接'), name: customName.trim() || customLink.trim(), link: customLink.trim() });
  };

  const isPreset = active === 'member' || active === 'base';
  const presets = active === 'member' ? MEMBER_LINKS : BASE_LINKS;

  return (
    <SideSheet
      title={title || t('选择链接')}
      visible={visible}
      onCancel={onCancel}
      placement="right"
      width={700}
      className="link-picker-sheet"
      footer={
        <div className="link-picker-footer">
          <span className="link-picker-current">
            {selected && Object.keys(selected).length ? linkDisplayText(selected) : t('请选择链接地址')}
          </span>
          <Button onClick={onCancel}>{t('取消')}</Button>
          <Button theme="solid" type="primary" disabled={!selected || Object.keys(selected).length === 0} onClick={() => onOk(selected)}>
            {t('确定')}
          </Button>
        </div>
      }
    >
      <div className="link-picker">
        <aside className="link-picker-menu">
          {categories.map((item) => (
            <button
              type="button"
              key={item.key}
              className={`link-picker-menu-item${active === item.key ? ' is-active' : ''}`}
              onClick={() => { setActive(item.key); setKeyword(''); }}
            >
              {item.label}
            </button>
          ))}
        </aside>
        <main className="link-picker-content">
          {isPreset && (
            <div className="link-picker-presets">
              {presets.map((item) => (
                <button
                  type="button"
                  key={item.link}
                  className={`link-picker-preset${selected.link === item.link ? ' is-active' : ''}`}
                  onClick={() => chooseBase(item)}
                >
                  {t(item.name)}
                </button>
              ))}
            </div>
          )}
          {!isPreset && active !== 'custom' && (
            <div className="link-picker-list">
              {active !== 'category' && (
                <div className="link-picker-search">
                  <Input value={keyword} onChange={setKeyword} placeholder={t('搜索名称')} onEnterPress={loadRows} />
                  <Button onClick={loadRows}>{t('搜索')}</Button>
                </div>
              )}
              {loading ? <Spin /> : rows.map((row, index) => {
                const name = row.productName || row.name || row.brandName || row.couponName || row.articleTitle || row.decorateTitle || '';
                const sub = row.productSn || row.brandName || row.couponName || '';
                return (
                  <button
                    type="button"
                    key={row.id || row.productId || row.brandId || row.couponId || row.articleId || row.decorateId || index}
                    className="link-picker-row"
                    onClick={() => {
                      if (active === 'product') chooseProduct(row);
                      else if (active === 'category') chooseCategory(row);
                      else if (active === 'brand') chooseBrand(row);
                      else if (active === 'coupon') chooseCoupon(row);
                      else if (active === 'article') chooseArticle(row);
                      else if (active === 'decorate') chooseDecorate(row);
                    }}
                  >
                    <strong>{name}</strong>
                    {sub && <small>{sub}</small>}
                  </button>
                );
              })}
            </div>
          )}
          {active === 'custom' && (
            <div className="link-picker-custom">
              <label>{t('链接名称')}</label>
              <Input value={customName} onChange={setCustomName} placeholder={t('链接名称')} />
              <label>{t('PC端链接')}</label>
              <Input value={customLink} onChange={setCustomLink} placeholder={t('请输入以 / 开头的链接')} />
              <Button onClick={chooseCustom} disabled={!customLink.trim()}>{t('使用此链接')}</Button>
            </div>
          )}
        </main>
      </div>
    </SideSheet>
  );
}

export function LinkField({
  value,
  onChange,
  placeholder,
  disabled,
  hideButton,
}: {
  value?: LinkValue;
  onChange: (link: LinkValue) => void;
  placeholder?: string;
  disabled?: boolean;
  hideButton?: boolean;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <div className="link-field">
      <Input
        value={linkDisplayText(value)}
        readOnly
        placeholder={placeholder || t('请选择链接地址')}
        onClick={() => !disabled && setVisible(true)}
        className="link-field-input"
      />
      {!hideButton && <Button size="small" disabled={disabled} onClick={() => setVisible(true)}>{t('选择链接')}</Button>}
      {value && Object.keys(value).length > 0 && !disabled && (
        <Button size="small" theme="borderless" icon={<IconClose />} onClick={() => onChange({})} />
      )}
      <LinkPicker
        visible={visible}
        value={value}
        onCancel={() => setVisible(false)}
        onOk={(link) => { onChange(link); setVisible(false); }}
      />
    </div>
  );
}
