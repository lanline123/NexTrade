import { useState } from 'react';
import { Button, Card, Form, Toast, Typography } from '@douyinfe/semi-ui';
import { IconHome, IconUser } from '@douyinfe/semi-icons';
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
      <div className="login-visual">
        <img className="login-visual-logo" src={`${import.meta.env.BASE_URL}admin-assets/admin-light-logo.jpeg`} alt="万物新生" />
        <img
          className="login-visual-illustration"
          src={`${import.meta.env.BASE_URL}admin-assets/login-page-bg.png`}
          alt=""
        />
      </div>

      <div className="login-panel">
        <h1 className="login-title">
          欢迎登录<span>商城后台管理系统</span>
        </h1>
        <Card className="login-card" shadows="always">
        {step === 'login' ? (
          <>
            <div className="login-tabs">
              <span className="is-active">密码登录</span>
              <span>手机登录</span>
            </div>

            <Form onSubmit={handleSubmit} labelPosition="top" style={{ marginTop: 22 }}>
              <Form.Input
                field="username"
                placeholder="请输入用户名"
                size="large"
              />
              <Form.Input
                field="password"
                mode="password"
                placeholder="请输入密码"
                size="large"
              />
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

            <label className="login-remember">
              <input type="checkbox" /> 记住登录状态
            </label>
            <div className="login-agreement">
              <input type="checkbox" defaultChecked /> 我已阅读并同意
              <a href="javascript:;">《用户服务协议》</a>
              <a href="javascript:;">《用户隐私协议》</a>
            </div>
          </>
        ) : (
          <div className="login-org">
            <Button theme="borderless" type="tertiary" className="login-org-back" onClick={() => setStep('login')}>
              返回
            </Button>
            <Title heading={3} style={{ margin: '10px 0 6px' }}>
              欢迎登录商城后台管理系统
            </Title>
            <Text type="tertiary">{account} 已绑定了以下组织，您可以进入以下任一组织</Text>

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
        </Card>
      </div>
    </div>
  );
}
