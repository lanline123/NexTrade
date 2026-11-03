import { useEffect, type ReactNode } from 'react';
import i18n from 'i18next';
import { ensureTranslation } from './loader';

const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const SKIP_SELECTOR = 'script,style,textarea,code,pre,[data-no-i18n],[contenteditable="true"]';
const CHINESE_RE = /[\u4e00-\u9fff]/;

/**
 * 存量页面过渡层。
 *
 * 仅作为 admin-semi 页面尚未全部 t() 化时的英文兜底：
 * - 只在 en 下启用
 * - 精确匹配 UI 文案，不翻译业务数据中的普通中文
 * - 切回中文恢复原文
 *
 * 页面迁移完成后删除本文件并关闭 ENABLE_LEGACY_AUTO_TRANSLATE。
 */
export default function LegacyAutoTranslate({
  locale,
  children,
}: {
  locale: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (locale !== 'en') return;
    let disposed = false;
    let applying = false;
    let observer: MutationObserver | null = null;
    const textOriginals = new Map<Text, string>();
    const attrOriginals = new Map<Element, Map<string, string>>();
    let map: Record<string, string> = {};

    const shouldSkip = (element: Element) => Boolean(element.closest(SKIP_SELECTOR));

    const translateText = (node: Text) => {
      const raw = node.nodeValue || '';
      const source = raw.trim();
      if (!source) return;
      const target = map[source];
      if (!target) return;
      const leading = raw.match(/^\s*/)?.[0] || '';
      const trailing = raw.match(/\s*$/)?.[0] || '';
      const next = `${leading}${target}${trailing}`;
      if (next === raw) return;
      if (!textOriginals.has(node)) textOriginals.set(node, raw);
      node.nodeValue = next;
    };

    const translateAttrs = (element: Element) => {
      for (const attr of TRANSLATABLE_ATTRS) {
        const raw = element.getAttribute(attr);
        if (!raw) continue;
        const source = raw.trim();
        const target = map[source];
        if (!target) continue;
        if (!attrOriginals.has(element)) attrOriginals.set(element, new Map());
        const originals = attrOriginals.get(element)!;
        if (!originals.has(attr)) originals.set(attr, raw);
        element.setAttribute(attr, target);
      }
    };

    const translateTree = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        translateText(root as Text);
        return;
      }
      if (root.nodeType !== Node.ELEMENT_NODE) return;
      const element = root as Element;
      if (shouldSkip(element)) return;
      translateAttrs(element);
      element.childNodes.forEach(translateTree);
    };

    const applyAll = () => {
      applying = true;
      translateTree(document.body);
      applying = false;
    };

    const buildMap = (): Record<string, string> => {
      const zh = (i18n.getResourceBundle('zh-CN', 'translation') || {}) as Record<string, unknown>;
      const en = (i18n.getResourceBundle('en', 'translation') || {}) as Record<string, unknown>;
      const result: Record<string, string> = {};

      // 词典 key 本身就是中文的场景
      for (const [key, target] of Object.entries(en)) {
        if (typeof target === 'string' && CHINESE_RE.test(key) && !CHINESE_RE.test(target)) {
          result[key.trim()] = target;
        }
      }
      // 中文 value 作为源文案的场景
      for (const value of Object.values(zh)) {
        if (typeof value !== 'string') continue;
        const source = value.trim();
        if (!source || !CHINESE_RE.test(source)) continue;
        const target = en[source] ?? en[value];
        if (typeof target === 'string' && target && !CHINESE_RE.test(target)) {
          result[source] = target;
        }
      }
      return result;
    };

    const start = async () => {
      await Promise.all([
        ensureTranslation(i18n, 'zh-CN'),
        ensureTranslation(i18n, 'en'),
      ]);
      if (disposed) return;
      map = buildMap();
      if (!Object.keys(map).length) return;
      applyAll();
      observer = new MutationObserver((mutations) => {
        if (applying) return;
        applying = true;
        for (const mutation of mutations) {
          if (mutation.type === 'characterData') {
            translateText(mutation.target as Text);
          } else if (mutation.type === 'attributes') {
            translateAttrs(mutation.target as Element);
          } else {
            mutation.addedNodes.forEach(translateTree);
          }
        }
        applying = false;
      });
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...TRANSLATABLE_ATTRS],
      });
    };

    const restore = () => {
      for (const [node, original] of textOriginals) {
        if (node.isConnected) node.nodeValue = original;
      }
      for (const [element, attrs] of attrOriginals) {
        if (!element.isConnected) continue;
        for (const [attr, original] of attrs) element.setAttribute(attr, original);
      }
      textOriginals.clear();
      attrOriginals.clear();
    };

    void start();

    return () => {
      disposed = true;
      observer?.disconnect();
      restore();
    };
  }, [locale]);

  return <>{children}</>;
}
