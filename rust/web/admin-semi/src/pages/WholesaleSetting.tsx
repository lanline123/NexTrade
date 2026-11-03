import { useEffect, useState } from 'react';
import { IconSetting, IconShoppingBag } from '@douyinfe/semi-icons';
import SettingsCard from '../components/SettingsCard';
import {
  Button,
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
    <div className="config-page">
      <SettingsCard
        icon={<IconShoppingBag />}
        title={t('批发商功能')}
        description={t('开启后，已认证批发商可查看专属批发价并批量下单。')}
        count={t('{count} 项', { count: 1 })}
      >
        <div className="config-field">
          <label>{t('批发商功能')}</label>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Switch
                checked={formState.wholesaleEnabled === 1}
                onChange={(checked) =>
                  setFormState({ ...formState, wholesaleEnabled: checked ? 1 : 0 })
                }
              />
              <span>{formState.wholesaleEnabled === 1 ? t('已开启') : t('已关闭')}</span>
            </div>
            <p className="config-field__help">
              {t('开启后，可根据配置的批发商品定价规则，已认证批发商登录可查看专属批发价并批量下单；关闭后批发配置失效，所有用户仅显示零售价，无法进行批发采购。')}
            </p>
          </div>
        </div>
      </SettingsCard>

      {formState.wholesaleEnabled === 1 && (
        <SettingsCard
          icon={<IconSetting />}
          title={t('批发商配置')}
          description={t('新增会员转批发商、默认等级与积分规则。')}
          count={t('{count} 项', { count: 3 })}
        >
          <div className="config-field">
            <label>{t('添加批发商')}</label>
            <div>
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
              <p className="config-field__help">
                {t('开启此选项后，所有新注册 / 新增的会员，系统将自动赋予其「批发商」身份，默认享有批发价、批量下单等批发权益。如需手动添加批发商，请关闭此选项。')}
              </p>
            </div>
          </div>

          <div className="config-field">
            <label>{t('默认批发等级')}</label>
            <div>
              <Select
                style={{ maxWidth: 320 }}
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
              <p className="config-field__help">
                {t('新增会员自动转批发商时绑定的等级；默认等级在此页设置（唯一入口），等级管理只读反映')}
              </p>
            </div>
          </div>

          <div className="config-field">
            <label>{t('批发商品赠送积分')}</label>
            <div>
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
              <p className="config-field__help">
                {t('选择「赠送」时，用户购买批发商品可按平台规则获得对应积分；选择「不赠送」时，批发商品订单将不产生任何积分。')}
              </p>
            </div>
          </div>
        </SettingsCard>
      )}

      <div className="config-actions">
        <Button theme="solid" type="primary" loading={saving} onClick={handleSubmit}>
          {t('提交')}
        </Button>
      </div>
    </div>
  );
}
