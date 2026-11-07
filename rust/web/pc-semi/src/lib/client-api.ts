
import i18n from '@/i18n';function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ApiEnvelope<T> {
  code?: number;
  msg?: string;
  message?: string;
  data?: T;
}

export async function apiGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await fetch(`/api/${path}${suffix}`, { credentials: 'include', headers: authHeaders() });
  return read<T>(response);
}

export async function apiPost<T>(path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return read<T>(response);
}

async function read<T>(response: Response): Promise<T> {
  const text = await response.text();
  let json: ApiEnvelope<T> | T;
  try {
    json = text ? JSON.parse(text) : ({} as T);
  } catch {
    throw new Error(i18n.t('接口返回格式异常（HTTP {code}）', { code: response.status }) as string);
  }
  const envelope = json as ApiEnvelope<T>;
  if (!response.ok || (envelope.code !== undefined && envelope.code !== 0)) {
    throw new Error(envelope.msg || envelope.message || (i18n.t('请求失败（HTTP {code}）', { code: response.status }) as string));
  }
  return (envelope.data ?? json) as T;
}
