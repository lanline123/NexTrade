import { useState } from 'react';
import { Button, Form, Toast, Typography } from '@douyinfe/semi-ui';
import { IconArrowLeft, IconHome, IconLock, IconUser } from '@douyinfe/semi-icons';
import { apiGet, login, setToken } from '../api';

const { Title, Text } = Typography;

interface OrgShop {
  shopId: number;
  shopTitle?: string;
  shopType?: number;
  shopLogo?: string;
}

function tokenAdminType(token: string): string {
  try {
    const raw = token.split('.')[1] || '';
    const payload = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/')));
    return String(payload.typ || 'admin');
  } catch {
    return 'admin';
  }
}

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'login' | 'org'>('login');
  const [account, setAccount] = useState('');
  const [adminType, setAdminType] = useState('admin');
  const [shops, setShops] = useState<OrgShop[]>([]);

  const chooseAdmin = () => {
    localStorage.setItem('adminType', 'admin');
    localStorage.removeItem('shopId');
    onSuccess();
  };

  const chooseShop = (shop: OrgShop) => {
    localStorage.setItem('adminType', 'shop');
    localStorage.setItem('shopId', String(shop.shopId));
    if (shop.shopTitle) localStorage.setItem('shopTitle', shop.shopTitle);
    onSuccess();
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const username = String(values.username || '').trim();
    const password = String(values.password || '');
    if (!username || !password) {
      Toast.warning({ content: '请输入账号和密码' });
      return;
    }
    setLoading(true);
    try {
      const result = await login(username, password);
      setToken(result.token);
      localStorage.removeItem('adminType');
      localStorage.removeItem('shopId');
      const type = result.adminType || tokenAdminType(result.token);
      setAccount(username);
      setAdminType(type);
      Toast.success({ content: '登录成功' });

      try {
        const resultShops = await apiGet<any>('/merchant/shop/myShop', {
          sortField: 'lastLoginTime',
        });
        const list: OrgShop[] = resultShops?.shop?.list || [];
        setShops(list);
        setStep('org');
      } catch {
        onSuccess();
      }
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '登录失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-aurora login-aurora--one" />
      <div className="login-aurora login-aurora--two" />

      <div className="login-shell">
        <aside className="login-hero">
          <div className="login-hero-grid" />
          <div className="login-hero-rings">
            <span />
            <span />
            <span />
          </div>

          <div className="login-hero-brand">
            <span className="login-hero-mark">T</span>
            <div>
              <strong>TIGSHOP</strong>
              <small>数字化交易底座</small>
            </div>
          </div>

          <div className="login-hero-copy">
            <div className="login-hero-meta">
              <span className="login-hero-eyebrow">DIGITAL COMMERCE INFRASTRUCTURE</span>
              <span className="login-ai-tag"><i />AI READY</span>
            </div>
            <h1>
              构建下一代
              <br />
              <em>数字化交易底座</em>
            </h1>
            <p>统一商品、交易、支付、履约与结算能力，连接业务系统与 AI 智能体，让每一次交易更高效、更智能。</p>
          </div>

          <div className="login-hero-points">
            <div>
              <strong>全链路</strong>
              <span>交易履约</span>
            </div>
            <div>
              <strong>AI Ready</strong>
              <span>智能运营扩展</span>
            </div>
            <div>
              <strong>多租户</strong>
              <span>弹性扩展</span>
            </div>
          </div>

          <div className="login-hero-footer">© 2026 TIGSHOP · 数字化交易底座</div>
        </aside>

        <main className="login-panel">
          <div className="login-mobile-brand">
            <span>T</span>
            <strong>TIGSHOP</strong>
          </div>
          <div className="login-card">
            {step === 'login' ? (
              <>
                <div className="login-card-head">
                  <span className="login-card-eyebrow">WELCOME BACK</span>
                  <h2>欢迎回来</h2>
                  <p>登录运营管理后台，继续你的工作</p>
                </div>

                <div className="login-tabs" role="tablist">
                  <button type="button" className="is-active" role="tab" aria-selected="true">
                    密码登录
                  </button>
                  <button type="button" role="tab" aria-selected="false" disabled>
                    手机登录
                  </button>
                </div>

                <Form onSubmit={handleSubmit} labelPosition="top" className="login-form">
                  <Form.Input
                    field="username"
                    placeholder="请输入用户名"
                    size="large"
                    prefix={<IconUser />}
                    autoComplete="username"
                  />
                  <Form.Input
                    field="password"
                    mode="password"
                    placeholder="请输入密码"
                    size="large"
                    prefix={<IconLock />}
                    autoComplete="current-password"
                  />

                  <div className="login-options">
                    <label className="login-remember">
                      <input type="checkbox" /> 记住登录状态
                    </label>
                    <a className="login-forgot" href="javascript:;">
                      忘记密码？
                    </a>
                  </div>

                  <Button
                    theme="solid"
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    size="large"
                    className="login-submit"
                  >
                    登 录
                  </Button>
                </Form>

                <div className="login-agreement">
                  <input type="checkbox" defaultChecked />
                  <span>我已阅读并同意</span>
                  <a href="javascript:;">《用户服务协议》</a>
                  <a href="javascript:;">《用户隐私协议》</a>
                </div>

                <div className="login-safe">
                  <IconLock />
                  <span>安全登录 · 数据全程加密传输</span>
                </div>
              </>
            ) : (
              <div className="login-org">
                <button type="button" className="login-org-back" onClick={() => setStep('login')}>
                  <IconArrowLeft /> 返回登录
                </button>
                <span className="login-card-eyebrow">SELECT ORGANIZATION</span>
                <Title heading={3} style={{ margin: '8px 0 6px' }}>
                  选择进入的组织
                </Title>
                <Text type="tertiary">{account} 已绑定以下组织，请选择要进入的后台</Text>

                <div className="login-org-section">
                  <button type="button" className="login-org-card" onClick={chooseAdmin}>
                    <span className="login-org-avatar">
                      <IconUser />
                    </span>
                    <span className="login-org-main">
                      <span className="login-org-name">管理后台</span>
                      <span className="login-org-meta">{adminType === 'admin' ? 'admin' : account}</span>
                    </span>
                  </button>
                </div>

                <div className="login-org-section">
                  <div className="login-org-label">店铺</div>
                  {shops.length ? (
                    shops.map((shop) => (
                      <button
                        key={shop.shopId}
                        type="button"
                        className="login-org-card"
                        onClick={() => chooseShop(shop)}
                      >
                        <span className="login-org-avatar">
                          {shop.shopLogo ? <img src={shop.shopLogo} alt="" /> : <IconHome />}
                        </span>
                        <span className="login-org-main">
                          <span className="login-org-name">{shop.shopTitle || `店铺 ${shop.shopId}`}</span>
                          <span className="login-org-meta">
                            {shop.shopType === 1 ? '单机设备' : '店铺'} · {shop.shopId}
                          </span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="login-org-empty">暂无可用店铺</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
