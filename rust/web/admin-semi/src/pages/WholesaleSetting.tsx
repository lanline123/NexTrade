import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Form,
  Radio,
  RadioGroup,
  Select,
  Space,
  Spin,
  Switch,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';

const { Text, Title } = Typography;

interface GradeOption {
  gradeId: number;
  gradeName: string;
}

interface WholesaleSettingVO {
  wholesaleEnabled?: number;
  wholesaleAutoRegister?: number;
  wholesaleDefaultGradeId?: number;
  wholesaleGivePoints?: number;
}

export function WholesaleSetting() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gradeOptions, setGradeOptions] = useState<GradeOption[]>([]);
  const [formState, setFormState] = useState<WholesaleSettingVO>({
    wholesaleEnabled: 0,
    wholesaleAutoRegister: 0,
    wholesaleDefaultGradeId: undefined,
    wholesaleGivePoints: 0,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingRes, gradesRes] = await Promise.all([
        apiGet<WholesaleSettingVO>('/wholesale/setting/get').catch(() => ({} as WholesaleSettingVO)),
        apiGet<GradeOption[]>('/wholesale/grade/list', { status: 1 }).catch(() => [] as GradeOption[]),
      ]);
      setFormState({
        wholesaleEnabled: settingRes.wholesaleEnabled ?? 0,
        wholesaleAutoRegister: settingRes.wholesaleAutoRegister ?? 0,
        wholesaleDefaultGradeId: settingRes.wholesaleDefaultGradeId || undefined,
        wholesaleGivePoints: settingRes.wholesaleGivePoints ?? 0,
      });
      setGradeOptions(Array.isArray(gradesRes) ? gradesRes : []);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载配置失败') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async () => {
    if (
      formState.wholesaleEnabled === 1 &&
      formState.wholesaleAutoRegister === 1 &&
      !formState.wholesaleDefaultGradeId
    ) {
      Toast.warning({ content: t('请选择默认批发等级') });
      return;
    }

    setSaving(true);
    try {
      await apiPost('/wholesale/setting/save', {
        wholesaleEnabled: formState.wholesaleEnabled ?? 0,
        wholesaleAutoRegister: formState.wholesaleAutoRegister ?? 0,
        wholesaleDefaultGradeId: formState.wholesaleDefaultGradeId ?? 0,
        wholesaleGivePoints: formState.wholesaleGivePoints ?? 0,
      });
      Toast.success({ content: t('保存成功') });
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
      <Card title={t('批发商功能')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Text strong style={{ width: 140 }}>{t('批发商功能')}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Switch
                checked={formState.wholesaleEnabled === 1}
                onChange={(checked) =>
                  setFormState({ ...formState, wholesaleEnabled: checked ? 1 : 0 })
                }
              />
              <Text>{formState.wholesaleEnabled === 1 ? t('已开启') : t('已关闭')}</Text>
            </div>
          </div>
          <div style={{ marginLeft: 156 }}>
            <Text type="tertiary" size="small">
              {t('开启后，可根据配置的批发商品定价规则，已认证批发商登录可查看专属批发价并批量下单；关闭后批发配置失效，所有用户仅显示零售价，无法进行批发采购。')}
            </Text>
          </div>
        </div>
      </Card>

      {formState.wholesaleEnabled === 1 && (
        <Card title={t('批发商配置')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Text strong style={{ width: 140 }}>{t('添加批发商')}</Text>
                <Checkbox
                  checked={formState.wholesaleAutoRegister === 1}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      wholesaleAutoRegister: e.target.checked ? 1 : 0,
                    })
                  }
                >
                  {t('新增会员默认成为批发商')}
                </Checkbox>
              </div>
              <div style={{ marginLeft: 156, marginTop: 6 }}>
                <Text type="tertiary" size="small">
                  {t('开启此选项后，所有新注册 / 新增的会员，系统将自动赋予其「批发商」身份，默认享有批发价、批量下单等批发权益。如需手动添加批发商，请关闭此选项。')}
                </Text>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Text strong style={{ width: 140 }}>{t('默认批发等级')}</Text>
                <Select
                  style={{ width: 320 }}
                  placeholder={t('请选择默认批发等级')}
                  value={formState.wholesaleDefaultGradeId}
                  onChange={(val) =>
                    setFormState({
                      ...formState,
                      wholesaleDefaultGradeId: Number(val) || undefined,
                    })
                  }
                >
                  {gradeOptions.map((g) => (
                    <Select.Option key={g.gradeId} value={g.gradeId}>
                      {g.gradeName}
                    </Select.Option>
                  ))}
                </Select>
              </div>
              <div style={{ marginLeft: 156, marginTop: 6 }}>
                <Text type="tertiary" size="small">
                  {t('新增会员自动转批发商时绑定的等级；默认等级在此页设置（唯一入口），等级管理只读反映')}
                </Text>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Text strong style={{ width: 140 }}>{t('批发商品赠送积分')}</Text>
                <RadioGroup
                  value={formState.wholesaleGivePoints}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      wholesaleGivePoints: Number(e.target.value),
                    })
                  }
                >
                  <Radio value={1}>{t('赠送')}</Radio>
                  <Radio value={0}>{t('不赠送')}</Radio>
                </RadioGroup>
              </div>
              <div style={{ marginLeft: 156, marginTop: 6 }}>
                <Text type="tertiary" size="small">
                  {t('选择「赠送」时，用户购买批发商品可按平台规则获得对应积分；选择「不赠送」时，批发商品订单将不产生任何积分。')}
                </Text>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: 156 }}>
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
    </div>
  );
}
