import { normalizeLocale } from './config';

interface I18nLike {
  hasResourceBundle(lng: string, ns?: string): boolean;
  addResourceBundle(
    lng: string,
    ns: string,
    resources: Record<string, unknown>,
    deep?: boolean,
    overwrite?: boolean,
  ): unknown;
}

const resourceLoaders = import.meta.glob('./resources/*/translation.json') as Record<
  string,
  () => Promise<{ default: Record<string, string> }>
>;

const pending = new Map<string, Promise<Record<string, string>>>();

function resourceKey(code: string): string {
  return `./resources/${normalizeLocale(code)}/translation.json`;
}

export function hasTranslation(code: string): boolean {
  return Boolean(resourceLoaders[resourceKey(code)]);
}

/** 按语言懒加载 JSON 资源；同一语言并发请求只加载一次。 */
export async function loadTranslation(code: string): Promise<Record<string, string>> {
  const normalized = normalizeLocale(code);
  const key = resourceKey(normalized);
  const loader = resourceLoaders[key];
  if (!loader) {
    throw new Error(`Missing translation resource: ${normalized}`);
  }
  if (!pending.has(normalized)) {
    pending.set(
      normalized,
      loader().then((module) => module.default as Record<string, string>),
    );
  }
  return pending.get(normalized)!;
}

/** 加载并注册到 i18next，可被 Provider、语言切换和回退层共用。 */
export async function ensureTranslation(i18n: I18nLike, code: string): Promise<boolean> {
  const normalized = normalizeLocale(code);
  if (i18n.hasResourceBundle(normalized, 'translation')) return true;
  if (!hasTranslation(normalized)) return false;
  const resource = await loadTranslation(normalized);
  i18n.addResourceBundle(normalized, 'translation', resource, true, true);
  return true;
}

/** 已具备资源的语言码，新增 JSON 后自动出现。 */
export function availableTranslationCodes(): string[] {
  return Object.keys(resourceLoaders)
    .map((path) => path.match(/\.\/resources\/([^/]+)\//)?.[1])
    .filter((code): code is string => Boolean(code))
    .map((code) => normalizeLocale(code));
}
