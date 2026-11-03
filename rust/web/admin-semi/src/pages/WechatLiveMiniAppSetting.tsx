import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Modal,
  Radio,
  RadioGroup,
  Space,
  Spin,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';

const { Text } = Typography;

interface MiniAppForm {
  wechatLiveMiniAppId: string;
  wechatLiveMiniAppSecret: string;
  miniImgSecCheck: number;
}

export function WechatLiveMiniAppSetting() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [secretEditVisible, setSecretEditVisible] = useState(false);
  const [secretDraft, setSecretDraft] = useState('');

  const [formState, setFormState] = useState<MiniAppForm>({
    wechatLiveMiniAppId: '',
    wechatLiveMiniAppSecret: '',
    miniImgSecCheck: 0,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [liveRes, riskRes] = await Promise.all([
        apiGet<Record<string, any>>('/setting/config/wechatLiveSettings').catch(() => ({} as Record<string, any>)),
        apiGet<Record<string, any>>('/setting/config/miniProgramRiskSettings').catch(() => ({} as Record<string, any>)),
      ]);
      setFormState({
        wechatLiveMiniAppId: String(liveRes.wechatLiveMiniAppId || ''),
        wechatLiveMiniAppSecret: String(liveRes.wechatLiveMiniAppSecret || ''),
        miniImgSecCheck: Number(riskRes.miniImgSecCheck ?? 0),
      });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载配置失败') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const maskSecret = (secret: string) => {
    if (!secret) return '';
    if (secret.length <= 8) return '********';
    return secret.slice(0, 4) + '****' + secret.slice(-4);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await Promise.all([
        apiPost('/setting/config/saveWechatLive', {
          wechatLiveMiniAppId: formState.wechatLiveMiniAppId,
          wechatLiveMiniAppSecret: formState.wechatLiveMiniAppSecret,
        }),
        apiPost('/setting/config/saveMiniProgramRisk', {
          miniImgSecCheck: formState.miniImgSecCheck,
        }),
      ]);
      Toast.success({ content: t('修改成功') });
      await loadData();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card title={t('小程序直播/视频号配置')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Text strong style={{ width: 160 }}>{t('小程序AppID')}</Text>
              <Input
                style={{ width: 380 }}
                placeholder={t('请输入小程序AppID')}
                value={formState.wechatLiveMiniAppId}
                onChange={(val) => setFormState({ ...formState, wechatLiveMiniAppId: val })}
              />
            </div>
            <div style={{ marginLeft: 176, marginTop: 6 }}>
              <Text type="tertiary" size="small">
                {t('小程序直播/视频号使用的独立小程序AppID，微信小程序公众平台->设置->开发设置中获取')}
              </Text>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Text strong style={{ width: 160 }}>{t('小程序AppSecret')}</Text>
              <Space align="center">
                <Text style={{ width: 280, fontFamily: 'monospace' }}>
                  {formState.wechatLiveMiniAppSecret ? maskSecret(formState.wechatLiveMiniAppSecret) : t('未配置')}
                </Text>
                <Button
                  theme="borderless"
                  type="primary"
                  onClick={() => {
                    setSecretDraft(formState.wechatLiveMiniAppSecret);
                    setSecretEditVisible(true);
                  }}
                >
                  {t('编辑')}
                </Button>
              </Space>
            </div>
            <div style={{ marginLeft: 176, marginTop: 6 }}>
              <Text type="tertiary" size="small">
                {t('小程序直播/视频号使用的独立小程序AppSecret，微信小程序公众平台->设置->开发设置中获取')}
              </Text>
            </div>
            <div style={{ marginLeft: 176, marginTop: 2 }}>
              <Text type="tertiary" size="small">
                {t('编辑完成后，点击下方提交按钮确认修改，请确保填写正确的小程序AppSecret')}
              </Text>
            </div>
          </div>
        </div>
      </Card>

      <Card title={t('风控配置')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Text strong style={{ width: 160 }}>{t('图片鉴黄')}</Text>
              <RadioGroup
                value={formState.miniImgSecCheck}
                onChange={(e) =>
                  setFormState({ ...formState, miniImgSecCheck: Number(e.target.value) })
                }
              >
                <Radio value={1}>{t('开启')}</Radio>
                <Radio value={0}>{t('关闭')}</Radio>
              </RadioGroup>
            </div>
            <div style={{ marginLeft: 176, marginTop: 6 }}>
              <Text type="tertiary" size="small">
                {t('开启后，小程序端上传头像时将调用微信内容安全接口检测，违规图片将被拦截')}
              </Text>
            </div>
            <div style={{ marginLeft: 176, marginTop: 2 }}>
              <Text type="tertiary" size="small">
                {t('微信限制单个小程序每分钟最多调用 2000 次、每天最多 200000 次，超出限制后本次检测将自动放行')}
              </Text>
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: 176 }}>
        <Button
          theme="solid"
          type="primary"
          size="large"
          loading={saving}
          onClick={handleSubmit}
          style={{ width: 140 }}
        >
          {t('提 交')}
        </Button>
      </div>

      <Modal
        title={t('小程序AppSecret')}
        visible={secretEditVisible}
        onCancel={() => setSecretEditVisible(false)}
        onOk={() => {
          setFormState({ ...formState, wechatLiveMiniAppSecret: secretDraft.trim() });
          setSecretEditVisible(false);
        }}
        width={480}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('小程序AppSecret')}</div>
          <Input
            placeholder={t('请输入小程序AppSecret')}
            value={secretDraft}
            onChange={(val) => setSecretDraft(val)}
          />
        </div>
      </Modal>
    </div>
  );
}
