'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeLocale } from '@/i18n';

type Translator = (key: string) => string;

function translateDynamic(key: string): string | null {
  const patterns: Array<[RegExp, (...matches: string[]) => string]> = [
    [/^请求失败（HTTP (\d+)）$/, (code) => `Request failed (HTTP ${code})`],
    [/^请求失败（(\d+)）$/, (code) => `Request failed (${code})`],
    [/^接口返回不是 JSON（HTTP (\d+)）$/, (code) => `Response is not JSON (HTTP ${code})`],
    [/^接口返回格式异常（HTTP (\d+)）$/, (code) => `Unexpected response format (HTTP ${code})`],
    [/^(.+) 分$/, (value) => `${value} points`],
    [/^还差 (\d+) 人成团$/, (count) => `${count} more people to form the group`],
    [/^，还差 (\d+) 人成团$/, (count) => `, ${count} more people to form the group`],
    [/^订单 (.+)$/, (orderNo) => `Order ${orderNo}`],
    [/^支付方式 (.+)$/, (id) => `Payment method ${id}`],
    [/^规格 (.+)$/, (id) => `Specification ${id}`],
    [/^第 (\d+) 张$/, (index) => `Image ${index}`],
    [/^搜索：(.+)$/, (keyword) => `Search: ${keyword}`],
    [/^“(.+)”的搜索结果$/, (keyword) => `Search results for "${keyword}"`],
    [/^快捷入口 (\d+)$/, (index) => `Quick Entry ${index}`],
    [/^导航 (\d+)$/, (index) => `Navigation ${index}`],
    [/^分组 (\d+)$/, (index) => `Group ${index}`],
    [/^（冻结 (.+)）$/, (amount) => `(Frozen ${amount})`],
    [/^请输入(.+)账号$/, (type) => `Please enter ${type} account`],
    [/^(.+) · 搜索 · 万物新生$/, (keyword) => `Search "${keyword}" · Wanwu Xinsheng`],
    [/^(.+) · 积分兑换 · 万物新生$/, (name) => `${name} · Points Redemption · Wanwu Xinsheng`],
    [/^(.+)营业执照信息公示专用$/, (shop) => `${shop} Business License Public Notice`],
  ];
  for (const [pattern, build] of patterns) {
    const match = key.match(pattern);
    if (match) return build(...match.slice(1));
  }
  return null;
}

function translateTextNode(node: Text, t: Translator, originals: WeakMap<Text, string>, enabled: boolean) {
  const current = node.nodeValue || '';
  const original = originals.get(node);
  const translated = original === undefined ? undefined : t(original.trim());
  if (original === undefined || (translated !== undefined && current !== translated)) {
    originals.set(node, current);
  }
  const source = originals.get(node) || '';
  const key = source.trim();
  if (!enabled || !key || key.length > 200) {
    if (current !== source) node.nodeValue = source;
    return;
  }
  const value = t(key);
  if (!value || value === key) return;
  node.nodeValue = current.trim().startsWith(key) ? current.replace(key, value) : value;
}

const ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'] as const;

function walk(root: Node, t: Translator, originals: WeakMap<Text, string>, attributeOriginals: WeakMap<Element, Map<string, string>>, enabled: boolean) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, t, originals, enabled);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as HTMLElement;
  if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(el.tagName)) return;
  if (el.hasAttribute('data-no-i18n')) return;

  let originalsForElement = attributeOriginals.get(el);
  if (!originalsForElement) {
    originalsForElement = new Map();
    attributeOriginals.set(el, originalsForElement);
  }
  for (const attribute of ATTRIBUTES) {
    const current = el.getAttribute(attribute);
    if (!current) continue;
    const saved = originalsForElement.get(attribute);
    const translated = saved ? t(saved.trim()) : '';
    if (!saved || (translated && current !== translated)) originalsForElement.set(attribute, current);
    const source = originalsForElement.get(attribute) || '';
    if (!enabled) {
      if (current !== source) el.setAttribute(attribute, source);
      continue;
    }
    const value = t(source.trim());
    if (value && value !== source.trim()) el.setAttribute(attribute, value);
  }
  el.childNodes.forEach((child) => walk(child, t, originals, attributeOriginals, enabled));
}

/**
 * i18next 兼容渲染层：
 * 现有页面仍以中文原文为 key，这里统一通过 i18next.t 翻译，语言切换时自动重跑。
 * 新页面应优先使用 useTranslation()/t()，本组件只作为存量硬编码文案的兜底。
 */
export default function I18nTranslator() {
  const { i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);
  const enabled = locale !== 'zh-CN';

  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;
    let scheduled = false;
    const originals = new WeakMap<Text, string>();
    const attributeOriginals = new WeakMap<Element, Map<string, string>>();
    const t: Translator = (key) => {
      if (!enabled) return key;
      const direct = i18n.t(key, { defaultValue: key });
      if (direct !== key) return direct;
      const dynamic = translateDynamic(key);
      if (dynamic) return dynamic;
      const suffix = ' · 万物新生';
      if (key.endsWith(suffix)) {
        const base = key.slice(0, -suffix.length).trim();
        const translatedBase = i18n.t(base, { defaultValue: base });
        return `${translatedBase} · Wanwu Xinsheng`;
      }
      return key;
    };

    const apply = () => {
      scheduled = false;
      if (cancelled || typeof document === 'undefined') return;
      walk(document.body, t, originals, attributeOriginals, enabled);
      document.documentElement.lang = locale;
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(apply);
    };

    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRIBUTES] });
    i18n.on('languageChanged', schedule);
    i18n.on('loaded', schedule);
    i18n.on('added', schedule);
    schedule();

    return () => {
      cancelled = true;
      observer?.disconnect();
      i18n.off('languageChanged', schedule);
      i18n.off('loaded', schedule);
      i18n.off('added', schedule);
    };
  }, [enabled, i18n, locale]);

  return null;
}
