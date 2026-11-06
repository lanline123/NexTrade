const API_BASE = '/adminapi';

export interface LoginResult {
  token: string;
  adminType?: string;
}

async function readJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || '接口返回格式异常');
  }
}

export async function getCsrfToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/common/csrf/create`, {
    credentials: 'include',
  });
  const json = await readJson(res);
  if (!res.ok || json.code !== 0) {
    throw new Error(json.msg || '获取 CSRF Token 失败');
  }
  return json.data as string;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const csrf = await getCsrfToken();
  const res = await fetch(`${API_BASE}/login/signin`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf,
    },
    body: JSON.stringify({
      loginType: 'password',
      username,
      password,
      captchaUid: '',
    }),
  });
  const json = await readJson(res);
  if (!res.ok || json.code !== 0) {
    throw new Error(json.msg || '登录失败');
  }
  return json.data as LoginResult;
}

/** 发送后台登录短信验证码（event=login）。 */
export async function sendMobileCode(mobile: string): Promise<void> {
  const res = await fetch(`${API_BASE}/login/sendMobileCode`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'login', mobile }),
  });
  const json = await readJson(res);
  if (!res.ok || json.code !== 0) {
    throw new Error(json.msg || '验证码发送失败');
  }
}

/** 后台手机验证码登录。 */
export async function loginMobile(mobile: string, mobileCode: string): Promise<LoginResult> {
  const csrf = await getCsrfToken();
  const res = await fetch(`${API_BASE}/login/mobileSignin`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf,
    },
    body: JSON.stringify({ mobile, mobileCode }),
  });
  const json = await readJson(res);
  if (!res.ok || json.code !== 0) {
    throw new Error(json.msg || '登录失败');
  }
  return json.data as LoginResult;
}

export function getToken(): string {
  return localStorage.getItem('admin_access_token') || '';
}

export function getContextHeaders(): Record<string, string> {
  const adminType = localStorage.getItem('adminType') || '';
  const shopId = localStorage.getItem('shopId') || '';
  if (!adminType || adminType === 'admin') return {};
  return { 'x-admin-type': adminType, ...(shopId ? { 'x-shop-id': shopId } : {}) };
}

export function setToken(token: string) {
  localStorage.setItem('admin_access_token', token);
}

export function clearToken() {
  localStorage.removeItem('admin_access_token');
  localStorage.removeItem('admin_demo');
  localStorage.removeItem('adminType');
  localStorage.removeItem('shopId');
  localStorage.removeItem('shopTitle');
}

export function isDemo() {
  return localStorage.getItem('admin_demo') === '1';
}

export function enterDemo() {
  localStorage.setItem('admin_demo', '1');
}

export async function apiGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  // 如果 path 已含 ?xxx=yyy,先拆出已有的查询参数并与 params 合并
  const [basePath, existingQs] = path.split('?');
  const query = new URLSearchParams(existingQs || '');
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item !== undefined && item !== null && item !== '') query.append(key, String(item));
        });
      } else {
        query.set(key, String(value));
      }
    }
  });
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${API_BASE}${basePath}${suffix}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      ...getContextHeaders(),
    },
  });
  const json = await readJson(res);
  if (res.status === 401 || json.code === 401) {
    clearToken();
    window.location.reload();
    throw new Error('登录已过期，请重新登录');
  }
  if (!res.ok || json.code !== 0) {
    throw new Error(json.msg || '请求失败');
  }
  return json.data as T;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...getContextHeaders(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await readJson(res);
  if (res.status === 401 || json.code === 401) {
    clearToken();
    window.location.reload();
    throw new Error('登录已过期，请重新登录');
  }
  if (!res.ok || json.code !== 0) {
    throw new Error(json.msg || '请求失败');
  }
  return json.data as T;
}

/** GET 下载（导出 Excel 等 arraybuffer 接口），filename 不含扩展名时后端 Content-Type 决定。 */
export async function apiDownload(path: string, params?: Record<string, unknown>, filename?: string) {
  const [basePath, existingQs] = path.split('?');
  const query = new URLSearchParams(existingQs || '');
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${API_BASE}${basePath}${suffix}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      ...getContextHeaders(),
    },
  });
  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error('登录已过期，请重新登录');
  }
  if (!res.ok) throw new Error('导出失败');
  const disposition = res.headers.get('Content-Disposition') || '';
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/);
  const serverName = utf8Match
    ? decodeURIComponent(utf8Match[1])
    : plainMatch
      ? plainMatch[1]
      : '';
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || serverName || '导出文件';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function apiUpload<T>(
  path: string,
  file: File,
  fields?: Record<string, string>,
): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  Object.entries(fields || {}).forEach(([key, value]) => form.append(key, value));
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      ...getContextHeaders(),
    },
    body: form,
  });
  const json = await readJson(res);
  if (res.status === 401 || json.code === 401) {
    clearToken();
    window.location.reload();
    throw new Error('登录已过期，请重新登录');
  }
  if (!res.ok || json.code !== 0) {
    throw new Error(json.msg || '上传失败');
  }
  return json.data as T;
}
