import type { ConfigAction } from '../pages/AutoConfigPage';

/**
 * 旧版配置页里的「按钮型功能」清单。
 *
 * 背景：旧 Vue 配置页在表单里直接放按钮（生成密钥、批量更新、测试邮件等），
 * 迁移到 AutoConfigPage 通用表单引擎后这些按钮一度无处承载，造成「字段在、功能不在」。
 * 这里按旧版契约逐项补回；接口路径与 Java 控制器保持一致。
 *
 * 注意：部分能力在 Rust 后端仍是显式未迁移（返回业务码 1001）。
 * 前端不做「假成功」，由 AutoConfigPage 把后端返回的真实错误展示给用户。
 */

/** 与旧版 views/setting/config/base/src/workbuddySettings.ts 的 MCP_CONNECTION_TEMPLATE 保持一致。 */
const MCP_CONNECTION_TEMPLATE = `{
  "mcpServers": {
    "tigshop-mcp": {
      "url": "http://你的Tigshop域名/adminapi/mcp",
      "headers": {
        "X-MCP-Api-Key": "你的MCP密钥"
      },
      "disabled": false
    }
  }
}`;

function pickWorkBuddyKey(data: unknown): string {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return '';
  const record = data as Record<string, unknown>;
  for (const key of ['workbuddyApiKey', 'plainKey', 'apiKey', 'key', 'rawKey']) {
    if (typeof record[key] === 'string' && record[key]) return record[key] as string;
  }
  return '';
}

export const configActions: Record<string, ConfigAction[]> = {
  globalSetting: [
    {
      label: '生成密钥',
      section: 'MCP 设置',
      primary: true,
      confirm: '生成新密钥会使旧密钥立即失效，确认继续？',
      success: '密钥已生成，请设置有效期后点击保存',
      reload: true,
      run: async ({ apiPost }) => {
        await apiPost('/setting/config/generateWorkbuddyKey');
      },
    },
    {
      label: '复制密钥',
      section: 'MCP 设置',
      success: '密钥已复制到剪贴板',
      run: async ({ apiPost, copy }) => {
        const data = await apiPost<unknown>('/setting/config/revealWorkbuddyKey');
        const key = pickWorkBuddyKey(data);
        if (!key) throw new Error('当前没有可复制的 MCP 密钥，请先生成密钥');
        await copy(key);
      },
    },
    {
      label: '复制配置模板',
      section: 'MCP 设置',
      success: '配置模板已复制到剪贴板',
      run: async ({ copy }) => {
        await copy(MCP_CONNECTION_TEMPLATE);
      },
    },
    {
      label: '同步到搜索引擎',
      section: '搜索设置',
      confirm: '将一次性把所有商品同步到 Elasticsearch，异步执行期间请勿重复点击，确认继续？',
      success: '同步任务已提交',
      visibleWhen: (values) => values.selectSearchType === 'es' || values.selectSearchType === 1,
      run: async ({ apiPost }) => {
        await apiPost('/product/product/initAllToEs');
      },
    },
    {
      label: '批量更新商品类目链接',
      section: '链接设置',
      confirm: '仅更新 SEO 链接为空的商品类目，请勿刷新页面，确认更新？',
      success: '批量更新任务已提交',
      run: async ({ apiPost }) => {
        await apiPost('/setting/seo/batchUpdateCategoryLink');
      },
    },
    {
      label: '批量更新商品链接',
      section: '链接设置',
      confirm: '仅更新 SEO 链接为空的商品，请勿刷新页面，确认更新？',
      success: '批量更新任务已提交',
      run: async ({ apiPost }) => {
        await apiPost('/setting/seo/batchUpdateProductLink');
      },
    },
  ],

};
