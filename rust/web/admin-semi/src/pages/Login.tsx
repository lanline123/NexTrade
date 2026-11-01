import { useState } from 'react';
import { Button, Card, Form, Toast, Typography } from '@douyinfe/semi-ui';
import { IconHome, IconLock, IconUser } from '@douyinfe/semi-icons';
import { apiGet, enterDemo, login, setToken } from '../api';

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
      <div className="login-brand">
        <div className="login-logo">W</div>
        <Title heading={1} style={{ color: '#fff', margin: '28px 0 14px', fontSize: 40 }}>
          万物新生
        </Title>
        <Text style={{ color: 'rgba(255,255,255,.78)', fontSize: 17, lineHeight: '30px' }}>
          退役动力电池循环利用
          <br />
          产业服务平台
        </Text>
        <div className="login-brand-line" />
        <div className="login-points">
          {['安全合规', '高效协同', '绿色循环', '数据可追溯'].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>

      <Card className="login-card" shadows="always">
        {step === 'login' ? (
          <>
            <Title heading={3} style={{ marginBottom: 4 }}>
              运营管理后台
            </Title>
            <Text type="tertiary">请使用管理员账号登录</Text>

            <Form onSubmit={handleSubmit} labelPosition="top" style={{ marginTop: 28 }}>
              <Form.Input
                field="username"
                label="账号"
                placeholder="请输入管理员账号"
                prefix={<IconUser />}
                rules={[{ required: true, message: '请输入账号' }]}
                size="large"
              />
              <Form.Input
                field="password"
                label="密码"
                mode="password"
                placeholder="请输入密码"
                prefix={<IconLock />}
                rules={[{ required: true, message: '请输入密码' }]}
                size="large"
              />
              <Button
                theme="solid"
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                style={{ marginTop: 12, height: 44 }}
              >
                登录
              </Button>
            </Form>

            <div className="login-demo">
              <Button
                theme="borderless"
                type="tertiary"
                onClick={() => {
                  enterDemo();
                  onSuccess();
                }}
              >
                进入演示模式
              </Button>
            </div>

            <div className="login-footer">
              <Text type="tertiary" size="small">
                万物新生 · 运营管理后台
              </Text>
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
  );
}
