/**
 * PC 首页快捷导航模块 - 预览组件（React 迁移自 5.8.61 旧版
 * `view/admin/src/views/decorate/decorate/editor/modules/pcHome/pc-home-quick-nav/Preview.vue`）
 *
 * DOM / class 与旧版逐行对齐：
 *   .dec-pc-home-quick-nav            外层（CSS 变量驱动 padding/背景/圆角）
 *   .nav_container.fs_mod             原生容器（居左/居中/居右、间距、换行）
 *   .dec-pc-home-quick-nav__item      导航项（图左文右）
 *   .dec-pc-home-quick-nav__icon      图标
 *   .dec-pc-home-quick-nav__text      文字
 *   .dec-pc-home-quick-nav__empty     空态
 *
 * 说明：旧版 `productImage(item)` 会补 storageUrl 前缀；admin preview 无 storage
 * 配置，这里优先取 picUrl / picThumb 原值（与 PcDecorateEditor 内联预览一致）。
 */
import { type CSSProperties } from 'react';
import { useI18n } from '../../../i18n';
import './pcHomeQuickNav.css';

type AnyRecord = Record<string, any>;

interface QuickNavItem {
  picId?: string | number;
  picUrl?: string;
  picThumb?: string;
  picTitle?: string;
  picLink?: string | { link?: string };
}

interface PcHomeQuickNavStyle {
  fontSize?: number;
  textColor?: string;
  hoverColor?: string;
  containerAlign?: number;
  itemGap?: number;
  singleLine?: number;
  fontWeight?: number;
  lineHeight?: number;
  iconSize?: number;
  iconGap?: number;
}

interface PcHomeQuickNavConfig {
  frame: AnyRecord;
  style: PcHomeQuickNavStyle;
  items: QuickNavItem[];
}

/** 旧版 `pcHomeQuickNavDefaults`（frame/style 默认值与 index.ts 对齐）。 */
const DEFAULTS: PcHomeQuickNavConfig = {
  frame: {
    textColor: '',
    itemBackgroundColor: '',
    backgroundColor: 'transparent',
    innerPadding: 0,
    itemHeight: 35,
    itemRadius: 3,
    boxRadius: 0,
    boxPadding: 0,
    leftAndRightPadding: 0,
    boxPaddingTop: 0,
    boxPaddingBottom: 0,
  },
  style: {
    fontSize: 14,
    textColor: '#333333',
    hoverColor: '#e1251b',
    containerAlign: 1,
    itemGap: 20,
    singleLine: 1,
    fontWeight: 400,
    lineHeight: 20,
    iconSize: 16,
    iconGap: 4,
  },
  items: [],
};

function mergeConfig(data: AnyRecord | undefined): PcHomeQuickNavConfig {
  const source = data || {};
  return {
    ...DEFAULTS,
    ...source,
    frame: { ...DEFAULTS.frame, ...(source.frame || {}) },
    style: { ...DEFAULTS.style, ...(source.style || {}) },
    items: Array.isArray(source.items) ? source.items : DEFAULTS.items,
  } as PcHomeQuickNavConfig;
}

function toHref(link?: string | { link?: string }): string {
  if (!link) return 'javascript:;';
  if (typeof link === 'string') return link || 'javascript:;';
  return link.link || 'javascript:;';
}

function getIconUrl(item: QuickNavItem): string {
  return (item.picUrl || item.picThumb || '') as string;
}

export default function PcHomeQuickNavPreview({ data }: { data: Record<string, any> }) {
  const { t } = useI18n();
  const config = mergeConfig(data);
  const frame = config.frame || {};
  const style = config.style || {};
  const items = Array.isArray(config.items) ? config.items : [];

  const align = Number(style.containerAlign ?? 1);
  const justify = align === 2 ? 'center' : align === 3 ? 'flex-end' : 'flex-start';

  const cssVars = {
    '--dec-box-padding': `${frame.boxPadding ?? 0}px`,
    '--dec-box-padding-top': `${frame.boxPaddingTop ?? 0}px`,
    '--dec-box-padding-bottom': `${frame.boxPaddingBottom ?? 0}px`,
    '--dec-box-radius': `${frame.boxRadius ?? 0}px`,
    '--dec-bg-color': frame.backgroundColor || 'transparent',
    '--dec-font-size': `${style.fontSize ?? 14}px`,
    '--dec-text-color': style.textColor || '#333333',
    '--dec-hover-color': style.hoverColor || '#e1251b',
    '--dec-container-justify': justify,
    '--dec-item-gap': `${style.itemGap ?? 20}px`,
    '--dec-single-line': Number(style.singleLine) === 1 ? 'nowrap' : 'wrap',
    '--dec-font-weight': String(style.fontWeight ?? 400),
    '--dec-line-height': `${style.lineHeight ?? 20}px`,
    '--dec-icon-size': `${style.iconSize ?? 16}px`,
    '--dec-icon-gap': `${style.iconGap ?? 4}px`,
  } as CSSProperties & Record<string, string>;

  return (
    <div className="dec-pc-home-quick-nav" style={cssVars}>
      <div className="nav_container fs_mod">
        {items.length === 0 ? (
          <div className="dec-pc-home-quick-nav__empty">{t('请在设置中添加导航项')}</div>
        ) : (
          items.map((item, index) => {
            const icon = getIconUrl(item);
            return (
              <a
                key={String(item.picId || index)}
                className="dec-pc-home-quick-nav__item"
                href={toHref(item.picLink)}
                target="_blank"
                rel="noopener noreferrer"
                title={item.picTitle}
              >
                {icon ? (
                  <img
                    className="dec-pc-home-quick-nav__icon"
                    src={icon}
                    alt={item.picTitle || ''}
                  />
                ) : null}
                <span className="dec-pc-home-quick-nav__text">{item.picTitle}</span>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}
