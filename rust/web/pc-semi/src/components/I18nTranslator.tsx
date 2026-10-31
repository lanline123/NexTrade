'use client';

import { useEffect } from 'react';

type TranslationMap = Record<string, string>;

function readLocale(): string {
  if (typeof document === 'undefined') return '';
  return document.cookie.match(/(?:^|; )locale=([^;]+)/)?.[1] || '';
}

function translateTextNode(node: Text, map: TranslationMap) {
  const raw = node.nodeValue || '';
  const key = raw.trim();
  if (!key || key.length > 200) return;
  let value = map[key];
  let matched = key;
  if (!value) {
    // 导航/下拉项常把箭头、数量拼在同一文本节点：拆出主文案再匹配。
    const suffix = key.match(/^(.+?)(\s*[▾›⌄]|\s+\d+)$/);
    if (suffix) {
      matched = suffix[1].trim();
      value = map[matched];
    }
  }
  if (!value || value === matched) return;
  node.nodeValue = raw.trim().startsWith(matched) ? raw.replace(matched, value) : raw.replace(key, value);
}

function walk(root: Node, map: TranslationMap) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, map);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as HTMLElement;
  if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(el.tagName)) return;
  if (el.hasAttribute('data-no-i18n')) return;

  const placeholder = el.getAttribute('placeholder');
  if (placeholder) {
    const value = map[placeholder.trim()];
    if (value) el.setAttribute('placeholder', value);
  }
  const title = el.getAttribute('title');
  if (title) {
    const value = map[title.trim()];
    if (value) el.setAttribute('title', value);
  }
  el.childNodes.forEach((child) => walk(child, map));
}

/**
 * 全站 i18n 翻译层：读取 locale cookie + 后端翻译包，替换页面文本。
 * 默认语言（zh / 空）不启用。
 */
export default function I18nTranslator() {
  useEffect(() => {
    const locale = readLocale();
    if (!locale || locale === 'zh') return;
    let cancelled = false;
    let observer: MutationObserver | null = null;
    let map: TranslationMap = {};
    let scheduled = false;

    const apply = () => {
      scheduled = false;
      if (cancelled) return;
      walk(document.body, map);
      document.documentElement.lang = locale;
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(apply);
    };

    fetch(`/api/common/i18n/getLocaleTranslations?localeCode=${encodeURIComponent(locale)}`, {
      credentials: 'include',
    })
      .then((response) => response.json())
      .then((json) => {
        if (cancelled) return;
        const data = json?.data || {};
        const entries = Object.entries(data).filter(([key, value]) => key && typeof value === 'string' && value);
        map = Object.fromEntries(entries) as TranslationMap;
        observer = new MutationObserver(schedule);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        schedule();
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  return null;
}
