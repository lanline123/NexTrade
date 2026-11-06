/**
 * 服务端取主题快照（供 RootLayout 的 <style> 与 generateViewport / manifest 共用）。
 *
 * `getThemeSettings()` 已经带 300s 的 fetch 级缓存，但同一次请求里 RootLayout 与
 * generateViewport 会各调一次，这里再加一层进程内短缓存，避免一次渲染发两次请求；
 * 后台改色后最多 60s 生效（与 fetch revalidate 同量级）。
 *
 * 拿不到有效配置时只缓存 10s，让接口恢复后能较快自愈。
 */

import { getThemeSettings } from '@/lib/api';
import { parseThemeStyle, themeVarsToCss, type ThemeVars } from '@/lib/theme-style';

export interface ThemeSnapshot {
  vars: ThemeVars;
  /** 注入用的 CSS 文本；无有效变量时为空串 */
  css: string;
  /** 主色，用于 viewport.themeColor / manifest.theme_color */
  primary: string;
}

/** 后台未配置时的兜底主色（与 globals.scss 的 --pc-primary 默认值一致） */
const FALLBACK_PRIMARY = '#1456f0';

let memo: { at: number; snapshot: ThemeSnapshot } | null = null;

export async function loadTheme(): Promise<ThemeSnapshot> {
  const now = Date.now();
  if (memo && now - memo.at < (memo.snapshot.css ? 60_000 : 10_000)) return memo.snapshot;

  const settings = await getThemeSettings();
  const vars = parseThemeStyle(settings?.themeStyle);
  const snapshot: ThemeSnapshot = {
    vars,
    css: themeVarsToCss(vars),
    primary: (vars['--general'] || FALLBACK_PRIMARY).trim(),
  };
  memo = { at: now, snapshot };
  return snapshot;
}
