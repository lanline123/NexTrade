import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Checkbox,
  CheckboxGroup,
  Modal,
  Image,
  Input,
  InputNumber,
  Popover,
  Radio,
  RadioGroup,
  Select,
  Spin,
  Table,
  Tag,
  Toast,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import { salesmanFormatPrice, salesmanFormatTime } from './SalesmanOverview';
import './salesman.css';

const { Text } = Typography;

/** 佣金比例格式化:整数不带小数,小数保留两位 */
const formatRate = (value: unknown): string => {
  if (value === '' || value === null || value === undefined) return '';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
};

interface SalesmanConfigLevel {
  id?: number;
  name?: string;
  rate?: number | string;
  downSalesmanRate?: number | string;
  condition?: SalesmanLevelCondition;
}

interface SalesmanLevelConditionItem {
  checked?: boolean;
  disabled?: boolean;
  value?: number;
  title?: string;
  unit?: string;
}

interface SalesmanLevelCondition {
  selfBuyAmount?: SalesmanLevelConditionItem;
  salesAmount?: SalesmanLevelConditionItem;
  salesInviteUsers?: SalesmanLevelConditionItem;
}

interface SalesmanConfigData {
  distributionMode?: number;
  saleType?: number;
  registerToSalesman?: number;
  recruitMethods?: number[];
  viewCustomerInfo?: number;
  wechatBizEnabled?: boolean;
  level?: SalesmanConfigLevel[];
}

const useSalesmanConfig = () => {
  const { t } = useI18n();
  const [config, setConfig] = useState<SalesmanConfigData>({});
  const [loading, setLoading] = useState(false);
  const reload = async () => {
    setLoading(true);
    try {
      const res = await apiGet<SalesmanConfigData>('/salesman/config/detail', { code: 'salesmanConfig' });
      setConfig(res || {});
      return res || {};
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载分销配置失败') });
      return {};
    } finally {
      setLoading(false);
    }
  };
  return { config, setConfig, loading, reload };
};

/** 等级下拉数据(分销员管理/明细页复用) */
export const loadLevelOptions = async (): Promise<Array<{ label: string; value: number }>> => {
  const config = await apiGet<SalesmanConfigData>('/salesman/config/detail', { code: 'salesmanConfig' });
  return (config?.level || []).map((item, index) => ({
    label: item.name || `等级${index + 1}`,
    value: Number(item.id ?? index + 1),
  }));
};

/** 分组分页(分销员管理/明细页复用) */
export const loadGroupOptions = async (): Promise<Array<{ label: string; value: number }>> => {
  const res = await apiGet<{ records?: Array<{ groupId: number; groupName?: string }> }>('/salesman/group/list', {
    page: 1,
    size: 100,
  });
  return (res?.records || []).map((item) => ({ label: item.groupName || `分组${item.groupId}`, value: item.groupId }));
};

/* ==================================================================
   1. 分销模式 (SalesmanPromoteMode / promoteModeManage / promoteMode)
   旧页: salesman/promoteMode/List.vue + stepTable.vue + popover.vue
   接口: GET/POST /salesman/config/detail|save?code=salesmanConfig
=================================================================== */

const MODE_PROMOTER = 1; // 推广员等级模式
const MODE_WECHAT_BIZ = 2; // 微商模式

const CONDITION_PRESETS = (): SalesmanLevelCondition => ({
  selfBuyAmount: { checked: false, disabled: false, value: 0, title: '自购金额', unit: '元' },
  salesAmount: { checked: false, disabled: false, value: 0, title: '推广金额', unit: '元' },
  salesInviteUsers: { checked: false, disabled: false, value: 0, title: '发展客户数', unit: '人' },
});

const conditionText = (
  condition: SalesmanLevelCondition | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
): string[] => {
  if (!condition) return [];
  const out: string[] = [];
  if (condition.selfBuyAmount?.checked && Number(condition.selfBuyAmount.value) > 0) {
    out.push(t('自购金额满{value}元', { value: Number(condition.selfBuyAmount.value) }));
  }
  if (condition.salesAmount?.checked && Number(condition.salesAmount.value) > 0) {
    out.push(t('推广金额满{value}元', { value: Number(condition.salesAmount.value) }));
  }
  if (condition.salesInviteUsers?.checked && Number(condition.salesInviteUsers.value) > 0) {
    out.push(t('发展客户数满{value}人', { value: Number(condition.salesInviteUsers.value) }));
  }
  return out;
};

/** 升级条件编辑气泡(旧 popover.vue) */
function ConditionEditor({
  index,
  condition,
  superior,
  onApply,
  children,
}: {
  index: number;
  condition: SalesmanLevelCondition;
  superior: SalesmanLevelCondition | null;
  onApply: (index: number, next: SalesmanLevelCondition) => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<SalesmanLevelCondition>(condition);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      const next = CONDITION_PRESETS();
      (['selfBuyAmount', 'salesAmount', 'salesInviteUsers'] as const).forEach((key) => {
        const current = condition?.[key];
        const sup = superior?.[key];
        if (current) {
          (next[key] as SalesmanLevelConditionItem) = {
            ...current,
            // 上一等级已勾选的条件自动勾选并禁用(旧 dataProcessing 逻辑)
            checked: Boolean(current.checked || sup?.checked),
            disabled: Boolean(sup?.checked),
          };
        }
      });
      setDraft(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const renderRow = (key: 'selfBuyAmount' | 'salesAmount' | 'salesInviteUsers') => {
    const item = draft[key] as SalesmanLevelConditionItem;
    if (!item) return null;
    return (
      <div className="salesman-condition-popover-row" key={key}>
        <Checkbox
          checked={Boolean(item.checked)}
          disabled={item.disabled}
          onChange={(e) =>
            setDraft({ ...draft, [key]: { ...item, checked: e.target.checked } } as SalesmanLevelCondition)
          }
        >
          {t(
            item.title ||
              (key === 'selfBuyAmount' ? '自购金额' : key === 'salesAmount' ? '推广金额' : '发展客户数'),
          )}
        </Checkbox>
        <div className="inp">
          {t('满')}
          <InputNumber
            value={item.value ?? 0}
            min={0}
            disabled={!item.checked}
            style={{ width: 120 }}
            onChange={(next) =>
              setDraft({ ...draft, [key]: { ...item, value: Number(next ?? 0) } } as SalesmanLevelCondition)
            }
          />
          {item.unit ? t(item.unit) : ''}
        </div>
      </div>
    );
  };

  const confirm = () => {
    const keys = ['selfBuyAmount', 'salesAmount', 'salesInviteUsers'] as const;
    const anyChecked = keys.some((key) => draft[key]?.checked && Number(draft[key]?.value) > 0);
    const anyCheckedRaw = keys.some((key) => draft[key]?.checked);
    if (!anyCheckedRaw || !anyChecked) {
      Toast.error({ content: t('请设置升级条件') });
      return;
    }
    onApply(index, draft);
    setVisible(false);
  };

  return (
    <Popover
      visible={visible}
      onClickOutSide={() => setVisible(false)}
      onVisibleChange={(next) => setVisible(next)}
      trigger="click"
      showArrow
      content={
        <div style={{ width: 340 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('升级设置')}</div>
          <div className="salesman-muted" style={{ marginBottom: 8 }}>
            {t('以下条件至少选择一个，选择多个需同时满足才可升级。自购金额、推广金额需交易完成后才会统计。')}
          </div>
          {renderRow('selfBuyAmount')}
          {renderRow('salesAmount')}
          {renderRow('salesInviteUsers')}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <Button size="small" onClick={() => setVisible(false)}>
              {t('取消')}
            </Button>
            <Button size="small" theme="solid" type="primary" onClick={confirm}>
              {t('确认')}
            </Button>
          </div>
        </div>
      }
    >
      {children}
    </Popover>
  );
}

export function SalesmanPromoteMode() {
  const { t } = useI18n();
  const { config, setConfig, loading, reload } = useSalesmanConfig();
  const [saving, setSaving] = useState(false);
  const [levels, setLevels] = useState<SalesmanConfigLevel[]>([]);
  const [compareVisible, setCompareVisible] = useState(false);
  const [pendingMode, setPendingMode] = useState<number | null>(null);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLevels(Array.isArray(config.level) ? config.level : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.distributionMode, config.saleType]);

  const mode = Number(config.distributionMode ?? MODE_PROMOTER);
  const saleType = Number(config.saleType ?? 1);
  const registerToSalesman = Number(config.registerToSalesman ?? 0);
  const recruitMethods = Array.isArray(config.recruitMethods) ? config.recruitMethods : [];
  const isWechatBiz = mode === MODE_WECHAT_BIZ;

  const patchConfig = (patch: Partial<SalesmanConfigData>) => setConfig((prev) => ({ ...prev, ...patch }));

  const requestModeChange = (next: number) => {
    if (next === mode) return;
    setPendingMode(next);
  };

  const confirmModeChange = () => {
    if (pendingMode !== null) {
      patchConfig({
        distributionMode: pendingMode,
        // 切出微商模式时清空招募方式(旧 confirmModeChange)
        recruitMethods: pendingMode === MODE_WECHAT_BIZ ? recruitMethods : [],
      });
    }
    setPendingMode(null);
  };

  const addLevel = () => {
    if (levels.length >= 10) {
      Toast.warning({ content: t('最多添加10级') });
      return;
    }
    setLevels((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        name: '',
        rate: 0,
        downSalesmanRate: 0,
        condition: CONDITION_PRESETS(),
      },
    ]);
  };

  const removeLevel = (index: number) => {
    setLevels((prev) => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, id: i + 1 })));
  };

  const applyCondition = (index: number, next: SalesmanLevelCondition) => {
    setLevels((prev) => prev.map((item, i) => (i === index ? { ...item, condition: next } : item)));
  };

  const validateLevels = (): boolean => {
    const names = levels.map((item) => (item.name || '').trim());
    if (names.some((name) => !name)) {
      Toast.error({ content: t('请输入等级名') });
      return false;
    }
    if (new Set(names).size !== names.length) {
      Toast.error({ content: t('等级名不能重复') });
      return false;
    }
    for (let index = 1; index < levels.length; index += 1) {
      const condition = levels[index].condition;
      const checked = conditionText(condition, t);
      if (!checked.length) {
        Toast.error({ content: t('请设置升级条件') });
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateLevels()) return;
    if (isWechatBiz && recruitMethods.length === 0) {
      Toast.error({ content: t('微商模式下请至少选择一种下级招募方式') });
      return;
    }
    setSaving(true);
    try {
      const level = levels.map((item, index) => ({
        ...item,
        id: index + 1,
        rate: formatRate(item.rate),
        downSalesmanRate: formatRate(item.downSalesmanRate),
      }));
      await apiPost('/salesman/config/save?code=salesmanConfig', {
        ...config,
        distributionMode: mode,
        saleType,
        registerToSalesman,
        recruitMethods,
        viewCustomerInfo: Number(config.viewCustomerInfo ?? 0),
        level,
      });
      Toast.success({ content: t('操作成功') });
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const modeTooltip = (key: number) => (
    <div className="salesman-mode-tooltip">
      <div className="lead">
        {key === MODE_PROMOTER
          ? t('分销员分享商品链接，任何人点进来下单，分销员就拿佣金。二级分销下，分销员的上级再拿一份。')
          : t('先邀请客户成为下级，客户下单后，上级(邀请人)就能拿佣金。二级分销下，再往上一级也能拿邀请佣金。')}
      </div>
      <div className="section">
        {key === MODE_PROMOTER ? (
          <>
            <div>{t('示例：分销员分享链接，客户通过分享的链接下单，该分销员获得佣金奖励')}</div>
            <div>{t('若客户自己回来买（不走链接），算正常下单，不计算佣金')}</div>
          </>
        ) : (
          <div>{t('示例：分销员 A 发展 B 为下级，B 自行购买分销商品（无需 A 再分享链接）A 可拿分销佣金。')}</div>
        )}
      </div>
      <div className="section">
        {key === MODE_PROMOTER
          ? t('适合场景：导购分享、KOL 推广、按次推广结算')
          : t('适合场景：私域老客户、复购场景、长期绑定关系')}
      </div>
    </div>
  );

  const compareRows = [
    {
      label: t('计佣触发方式'),
      promote: t('客户必须通过分销员的推广链接下单'),
      micro: t('下级分销员绑定后，自行购买分销商品即触发'),
    },
    {
      label: t('上级是否需重复推广'),
      promote: t('是，每次下单都需分享链接'),
      micro: t('否，绑定一次，后续自购也计佣'),
    },
    {
      label: t('下级分销员从哪来'),
      promote: t('不支持专属招募计划'),
      micro: t('支持：消费自动开通/名片邀请开通'),
    },
    {
      label: t('典型运营场景'),
      promote: t('导购分享、KOL推广、按次结算'),
      micro: t('私域绑定、老客户复购、长期关系'),
    },
  ];

  const compareFaq = [
    {
      question: t('我希望分销员每次主动分享商品，客户点了链接才给佣金'),
      answer: t('选【推广员等级模式】'),
      example: t('场景：门店导购、达人带货、临时推广活动'),
    },
    {
      question: t('我希望绑定客户/下级后，对方自己回来买也能持续给我佣金'),
      answer: t('选【微商模式】'),
      example: t('场景：私域绑定、老客户复购、复购型商品'),
    },
    {
      question: t('分销方案(一级/二级)、等级、准入方式两种模式一样吗？'),
      answer: t('一样，两种模式只区别在「计佣方式」和「下级招募方式」。'),
      example: '',
    },
    {
      question: t('可以随时切换吗？'),
      answer: t('可以。切换后新订单按新模式计佣，历史订单不受影响。'),
      example: '',
    },
  ];

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 860 }}>
        <div className="salesman-mode-section-title">{t('分销模式')}</div>
        <RadioGroup value={mode} onChange={(e) => requestModeChange(Number(e.target.value))}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className={`salesman-settle-radio-card ${mode === MODE_PROMOTER ? 'is-active' : ''}`}>
              <Radio value={MODE_PROMOTER}>
                <Tooltip content={modeTooltip(MODE_PROMOTER)}>
                  <span style={{ fontWeight: 600 }}>{t('推广员等级模式')}</span>
                </Tooltip>
                <div className="salesman-radio-desc">{t('分销员分享商品链接，任何人点进来下单，分销员就拿佣金')}</div>
              </Radio>
            </div>
            <div className={`salesman-settle-radio-card ${mode === MODE_WECHAT_BIZ ? 'is-active' : ''}`}>
              <Radio value={MODE_WECHAT_BIZ}>
                <Tooltip content={modeTooltip(MODE_WECHAT_BIZ)}>
                  <span style={{ fontWeight: 600 }}>{t('微商模式')}</span>
                </Tooltip>
                <div className="salesman-radio-desc">{t('先邀请客户成为下级，客户下单后，上级(推荐人)就能拿佣金。')}</div>
              </Radio>
            </div>
          </div>
        </RadioGroup>
        <div className="salesman-mode-tip">
          {t('推广员等级模式和微商模式的分销方案、分销等级、准入方式两种模式完全相同，区别仅在计佣方式和下级招募，详情请查看')}{' '}
          <a className="link" onClick={() => setCompareVisible(true)}>
            {t('《功能对比》')}
          </a>
        </div>

        <div className="salesman-mode-section-title">{t('分销方案')}</div>
        <RadioGroup value={saleType} onChange={(e) => patchConfig({ saleType: Number(e.target.value) })}>
          <Radio value={1}>{t('一级分销（仅分销员本人推广可获取佣金）')}</Radio>
          <Radio value={2}>{t('二级分销（下级分销员成交后，上级可获得邀请奖励）')}</Radio>
        </RadioGroup>

        <div className="salesman-mode-section-title">{t('分销员等级方案')}</div>
        <Button type="primary" theme="light" icon={<IconPlus />} onClick={addLevel}>
          {t('添加等级({count}/10)', { count: levels.length })}
        </Button>
        <table className="salesman-level-table" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th style={{ width: 64 }}>{t('序号')}</th>
              <th style={{ width: 150 }}>{t('等级名')}</th>
              <th style={{ minWidth: 220 }}>{t('升级条件')}</th>
              <th style={{ width: 300 }}>
                {t('佣金比例')}
                <Tooltip
                  content={
                    <div style={{ width: 380 }}>
                      <p>{t('修改后的比例只影响之后升级的佣金发放')}</p>
                      {saleType === 2 ? (
                        <>
                          <p>
                            {t('商品佣金比例：分销员推广商品后获得的商品佣金=商品佣金比例*商品实付金额（扣除运费、税费和附加费）。')}
                          </p>
                          <p>
                            {t('下级分销员邀请奖励比例：下级分销员推广后，上级分销员获得邀请奖励=下级分销员邀请奖励比例*商品实付金额（扣除运费、税费和附加费）。')}
                          </p>
                          <p>{t('举例：B是A发展的分销员，B成功推广商品后，B可获得商品佣金，A可获得邀请奖励。')}</p>
                        </>
                      ) : (
                        <p>
                          {t('商品佣金比例：分销员推广商品后获得的商品佣金=商品佣金比例*商品实付金额（扣除运费、税费和附加费）。')}
                        </p>
                      )}
                      <p>
                        {t('当分销员升至对应等级即会发放对应佣金，降级时按着当时等级发放，频繁调整分销员等级会导致佣金多次发放。')}
                      </p>
                    </div>
                  }
                >
                  <span className="salesman-tooltip-icon">?</span>
                </Tooltip>
              </th>
              <th style={{ width: 80 }}>{t('操作')}</th>
            </tr>
          </thead>
          <tbody>
            {levels.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#a4abb5' }}>
                  {t('暂无等级,请点击"添加等级"')}
                </td>
              </tr>
            )}
            {levels.map((level, index) => {
              const texts = index === 0 ? [] : conditionText(level.condition, t);
              return (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>
                    <Input
                      style={{ width: 110 }}
                      placeholder={t('请输入等级名')}
                      value={level.name || ''}
                      onChange={(value) =>
                        setLevels((prev) => prev.map((item, i) => (i === index ? { ...item, name: value } : item)))
                      }
                    />
                  </td>
                  <td>
                    <div className="condition-text">
                      {index === 0 && <p>{t('初始等级，无需设置')}</p>}
                      {index > 0 && texts.length > 0 && texts.map((text) => <p key={text}>{text}</p>)}
                      {index > 0 && texts.length === 0 && <p className="gray">{t('未设置')}</p>}
                    </div>
                    {index > 0 && (
                      <ConditionEditor
                        index={index}
                        condition={level.condition || CONDITION_PRESETS()}
                        superior={index > 1 ? levels[index - 1].condition || null : null}
                        onApply={applyCondition}
                      >
                        <a style={{ marginLeft: 10 }}>{t('编辑')}</a>
                      </ConditionEditor>
                    )}
                  </td>
                  <td>
                    <div className="rate-item">
                      <div className="rate-label">{t('商品佣金')}</div>
                      <InputNumber
                        style={{ width: 120 }}
                        min={0}
                        value={level.rate === undefined || level.rate === null || level.rate === '' ? 0 : Number(level.rate)}
                        onChange={(value) =>
                          setLevels((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, rate: value === null || value === undefined ? '' : value } : item,
                            ),
                          )
                        }
                        suffix="%"
                      />
                    </div>
                    {saleType === 2 && (
                      <div className="rate-item">
                        <div className="rate-label">{t('下级分销员邀请奖励')}</div>
                        <InputNumber
                          style={{ width: 120 }}
                          min={0}
                          value={
                            level.downSalesmanRate === undefined ||
                            level.downSalesmanRate === null ||
                            level.downSalesmanRate === ''
                              ? 0
                              : Number(level.downSalesmanRate)
                          }
                          onChange={(value) =>
                            setLevels((prev) =>
                              prev.map((item, i) =>
                                i === index
                                  ? { ...item, downSalesmanRate: value === null || value === undefined ? '' : value }
                                  : item,
                              ),
                            )
                          }
                          suffix="%"
                        />
                      </div>
                    )}
                  </td>
                  <td>
                    {index > 0 && levels.length > 1 ? (
                      <Button theme="borderless" type="danger" size="small" onClick={() => removeLevel(index)}>
                        {t('删除')}
                      </Button>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="salesman-form-row" style={{ marginTop: 24 }}>
          <div className="row-label is-required">{t('成为分销员')}</div>
          <div className="row-body">
            <RadioGroup value={registerToSalesman} onChange={(e) => patchConfig({ registerToSalesman: Number(e.target.value) })}>
              <Radio value={0}>{t('手动创建')}</Radio>
              <Radio value={1}>{t('商城注册自动开通')}</Radio>
            </RadioGroup>
            {registerToSalesman === 0 && (
              <div className="salesman-mode-extra">{t('手动创建分销员：商城所有一级分销员，需管理员在后台手动创建')}</div>
            )}
            {registerToSalesman === 1 && (
              <div className="salesman-mode-extra">{t('注册自动开通：用户通过商城完成注册后，自动成为分销员')}</div>
            )}
          </div>
        </div>

        <div className="salesman-form-row">
          <div className="row-label is-required">{t('下级招募方式')}</div>
          <div className="row-body">
            <CheckboxGroup
              value={recruitMethods}
              disabled={!isWechatBiz}
              onChange={(values) => patchConfig({ recruitMethods: (values as number[]) || [] })}
              options={[
                { label: t('消费自动开通'), value: 1 },
                { label: t('名片邀请开通'), value: 2 },
              ]}
            />
            <div className="salesman-mode-extra">{t('消费自动开通：客户通过分销员推广链接下单后，自动成为该分销员的下级')}</div>
            <div className="salesman-mode-extra">{t('名片邀请开通：分销员分享专属名片，商城新用户扫码并注册即可成为其下级')}</div>
          </div>
        </div>

        <div className="salesman-form-row">
          <div className="row-label">{t('分销隐私')}</div>
          <div className="row-body">
            <Checkbox
              checked={Number(config.viewCustomerInfo ?? 0) === 1}
              onChange={(e) => patchConfig({ viewCustomerInfo: e.target.checked ? 1 : 0 })}
            >
              {t('查看客户信息')}
            </Checkbox>
            <div className="salesman-mode-extra">{t('开启后，分销员可查看自己的客户信息')}</div>
          </div>
        </div>

        <Button theme="solid" type="primary" loading={saving} onClick={handleSave}>
          {t('保 存')}
        </Button>
      </div>

      {/* 分销模式功能对比抽屉 */}
      <Modal title={t('分销模式功能对比')} visible={compareVisible} onCancel={() => setCompareVisible(false)} width={720}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>{t('模式差异：')}</div>
        <table className="salesman-level-table">
          <thead>
            <tr>
              <th style={{ width: 150 }}>{t('对比项')}</th>
              <th>{t('推广员等级模式')}</th>
              <th>{t('微商模式')}</th>
            </tr>
          </thead>
          <tbody>
            {compareRows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.promote}</td>
                <td>{row.micro}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontWeight: 600, margin: '18px 0 10px' }}>{t('如何选择这种分销模式？')}</div>
        {compareFaq.map((item) => (
          <div key={item.question} style={{ background: '#f7f8fa', borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div>
              <b>Q</b> {item.question}
            </div>
            <div style={{ marginTop: 4 }}>
              <b>A</b> {item.answer}
            </div>
            {item.example && <div className="salesman-muted" style={{ marginTop: 4 }}>{item.example}</div>}
          </div>
        ))}
      </Modal>

      {/* 切换分销模式确认弹窗 */}
      <Modal
        title={pendingMode === MODE_WECHAT_BIZ ? t('切换为微商模式？') : t('切换为推广员等级模式？')}
        visible={pendingMode !== null}
        onOk={confirmModeChange}
        onCancel={() => setPendingMode(null)}
        okText={t('确认')}
        cancelText={t('取消')}
        width={440}
      >
        <div style={{ lineHeight: 1.7, color: 'rgba(0,0,0,0.65)' }}>
          {pendingMode === MODE_WECHAT_BIZ
            ? t('切换为【微商模式】后，下级分销员购买分销商品时，上级将自动获得佣金，无需每次推广。同时可配置下级招募方式。分销方案、等级等配置保持不变。确认切换？')
            : t('切换为【推广员等级模式】后，上级仅在客户通过推广链接下单时才获得佣金。下级招募方式将不再生效。确认切换？')}
        </div>
      </Modal>
    </Spin>
  );
}

/* ==================================================================
   2. 商品佣金管理 (SalesmanProducts / salesmanProductManage / salesmanProduct)
   旧页: salesman/product/List.vue + Info.vue
   接口: /salesman/product/list|detail|create|update|config
=================================================================== */
interface SalesmanProductRow {
  productId: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  productPrice?: number | string;
  productStock?: number;
  productStatus?: number;
  productType?: number;
  commissionType?: number;
  updateTime?: number | string;
  salesmanProduct?: {
    salesmanProductId?: number;
    isJoin?: number;
    commissionType?: number;
    updateTime?: number | string;
    productCommission?: { productCommission?: string; subCommission?: string } | null;
  } | null;
}

const COMMISSION_TYPE_LABEL: Record<number, string> = {
  1: '默认佣金比例',
  2: '自定义佣金比例',
  3: '自定义佣金金额',
};

export function SalesmanProducts() {
  const { t } = useI18n();
  const [typeOptions, setTypeOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<SalesmanProductRow | null>(null);
  const [form, setForm] = useState<{
    isJoin: number;
    commissionType: number;
    saleType: number;
    levelNames: Array<{ id: number; name: string; downSalesmanRate?: number | string; rate?: number | string }>;
    levelArr: Array<{ level: number; rate: string; downSalesmanRate: string }>;
  }>({ isJoin: 1, commissionType: 1, saleType: 1, levelNames: [], levelArr: [] });

  const loadTypeOptions = async () => {
    try {
      const res = await apiGet<Record<string, string>>('/salesman/product/config');
      setTypeOptions(
        Object.entries(res || {}).map(([value, label]) => ({ label: String(label), value: Number(value) })),
      );
    } catch {
      setTypeOptions([]);
    }
  };

  useEffect(() => {
    loadTypeOptions();
  }, []);

  const openCommission = async (row: SalesmanProductRow) => {
    setCurrent(row);
    setDrawerVisible(true);
    setDrawerLoading(true);
    try {
      const [detail, config] = await Promise.all([
        apiGet<any>('/salesman/product/detail', { id: row.productId }),
        apiGet<SalesmanConfigData>('/salesman/config/detail', { code: 'salesmanConfig' }),
      ]);
      const saleType = Number(config?.saleType ?? 1);
      const levelNames = (config?.level || []).map((item, index) => ({
        id: Number(item.id ?? index + 1),
        name: item.name || `等级${index + 1}`,
        rate: item.rate,
        downSalesmanRate: item.downSalesmanRate,
      }));
      const existed = detail?.salesmanProduct;
      const commissionType = Number(existed?.commissionType ?? detail?.commissionType ?? 1);
      let levelArr = (existed?.commissionData?.[0]?.levelArr || []).map((item: any) => ({
        level: Number(item.level),
        rate: formatRate(item.rate),
        downSalesmanRate: formatRate(item.downSalesmanRate),
      }));
      if (!levelArr.length) {
        // 默认取分销配置中的等级比例(旧 formatTable)
        levelArr = levelNames.map((level) => ({
          level: level.id,
          rate: formatRate(level.rate),
          downSalesmanRate: saleType === 2 ? formatRate(level.downSalesmanRate) : '',
        }));
      }
      setForm({
        isJoin: Number(existed?.isJoin ?? 0),
        commissionType,
        saleType,
        levelNames,
        levelArr,
      });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载佣金详情失败') });
      setDrawerVisible(false);
    } finally {
      setDrawerLoading(false);
    }
  };

  const submitCommission = async () => {
    if (!current) return;
    if (form.isJoin === 1) {
      const empty = form.levelArr.some(
        (item) => item.rate === '' || (form.saleType === 2 && item.downSalesmanRate === ''),
      );
      if (empty) {
        Toast.error({ content: t('请填写完整的佣金比例') });
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        productId: current.productId,
        isJoin: form.isJoin === 1, // Rust SalesmanProductEditParam.isJoin 为 bool
        commissionType: form.commissionType,
        commissionData: [{ levelArr: form.levelArr.map((item) => ({ level: item.level, rate: item.rate, downSalesmanRate: item.downSalesmanRate })) }],
      };
      if (current.salesmanProduct?.salesmanProductId) {
        await apiPost('/salesman/product/update', {
          ...payload,
          salesmanProductId: current.salesmanProduct.salesmanProductId,
        });
      } else {
        await apiPost('/salesman/product/create', payload);
      }
      Toast.success({ content: t('操作成功') });
      setDrawerVisible(false);
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnConfig<SalesmanProductRow>[] = [
    {
      title: '商品',
      dataIndex: 'productName',
      render: (_: unknown, row: SalesmanProductRow) => (
        <div className="salesman-user-cell">
          {row.picThumb ? <Image src={row.picThumb} width={50} height={50} style={{ borderRadius: 4 }} /> : null}
          <div>
            <div>{row.productName || '--'}</div>
            {row.productType === 2 && <div style={{ color: 'var(--semi-color-success)' }}>{t('【虚拟商品】')}</div>}
          </div>
        </div>
      ),
    },
    {
      title: '金额（¥）',
      dataIndex: 'productPrice',
      width: 120,
      render: (val: any) => salesmanFormatPrice(val),
    },
    { title: '库存', dataIndex: 'productStock', width: 90, render: (val: any) => val ?? 0 },
    {
      title: '是否参与推广',
      width: 120,
      render: (_: unknown, row: SalesmanProductRow) =>
        row.salesmanProduct && row.salesmanProduct.isJoin === 1 ? t('参与') : t('不参与'),
    },
    {
      title: '佣金',
      width: 140,
      render: (_: unknown, row: SalesmanProductRow) => {
        const label = COMMISSION_TYPE_LABEL[Number(row.commissionType ?? 0)];
        return label ? t(label) : '--';
      },
    },
    {
      title: '商品佣金',
      width: 150,
      render: (_: unknown, row: SalesmanProductRow) => row.salesmanProduct?.productCommission?.productCommission || '--',
    },
    {
      title: '下级分销员邀请奖励',
      width: 180,
      render: (_: unknown, row: SalesmanProductRow) => row.salesmanProduct?.productCommission?.subCommission || '--',
    },
    {
      title: '商品状态',
      dataIndex: 'productStatus',
      width: 100,
      render: (val: any) => <Tag color={Number(val) === 1 ? 'green' : 'grey'}>{Number(val) === 1 ? t('上架') : t('下架')}</Tag>,
    },
    {
      title: '操作时间',
      width: 170,
      render: (_: unknown, row: SalesmanProductRow) => salesmanFormatTime(row.salesmanProduct?.updateTime),
    },
  ];

  return (
    <div>
      <ListPage<SalesmanProductRow>
        key={reloadKey}
        api="/salesman/product/list"
        rowKey="productId"
        columns={columns}
        filters={[
          { field: 'productName', label: '商品名称', placeholder: '输入商品名称/货号', type: 'input' },
          {
            field: 'status',
            label: '商品状态',
            type: 'select',
            options: [
              { label: '上架', value: 1 },
              { label: '下架', value: 0 },
            ],
          },
          {
            field: 'salesmanProductType',
            label: '推广类型',
            type: 'select',
            options: typeOptions,
          },
        ]}
        rowActions={(record: SalesmanProductRow) => (
          <Button theme="borderless" type="primary" size="small" onClick={() => openCommission(record)}>
            {t('设置佣金')}
          </Button>
        )}
      />

      {/* 设置商品佣金抽屉(旧 salesman/product/Info.vue) */}
      <Modal
        title={t('设置商品佣金')}
        visible={drawerVisible}
        onCancel={() => setDrawerVisible(false)}
        width={620}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerVisible(false)}>{t('取消')}</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={submitCommission}>
              {t('确定')}
            </Button>
          </div>
        }
      >
        <Spin spinning={drawerLoading}>
          <div className="salesman-form-row">
            <div className="row-label">{t('推广：')}</div>
            <div className="row-body">
              <RadioGroup
                value={form.isJoin}
                onChange={(e) => setForm({ ...form, isJoin: Number(e.target.value) })}
              >
                <Radio value={1}>{t('参与')}</Radio>
                <Radio value={0}>{t('不参与')}</Radio>
              </RadioGroup>
            </div>
          </div>
          {form.isJoin === 1 && (
            <>
              <div className="salesman-form-row">
                <div className="row-label">{t('佣金计算：')}</div>
                <div className="row-body">
                  <RadioGroup
                    value={form.commissionType}
                    onChange={(e) => setForm({ ...form, commissionType: Number(e.target.value) })}
                  >
                    <div>
                      <Radio value={1}>{t('默认佣金比例')}</Radio>
                    </div>
                    <div>
                      <Radio value={2}>{t('自定义佣金比例')}</Radio>
                    </div>
                    <div>
                      <Radio value={3}>{t('自定义佣金金额')}</Radio>
                    </div>
                  </RadioGroup>
                </div>
              </div>
              <table className="salesman-commission-table">
                <thead>
                  <tr>
                    {form.levelNames.map((level) => (
                      <th key={level.id} colSpan={form.saleType === 2 ? 2 : 1}>
                        {level.name}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {form.levelNames.map((level) => (
                      <React.Fragment key={level.id}>
                        <th>{t('商品佣金')}</th>
                        {form.saleType === 2 && <th>{t('邀请佣金')}</th>}
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {form.levelNames.map((level) => {
                      const cell = form.levelArr.find((item) => Number(item.level) === Number(level.id));
                      const cellIndex = form.levelArr.findIndex((item) => Number(item.level) === Number(level.id));
                      return (
                        <React.Fragment key={level.id}>
                          <td>
                            <InputNumber
                              style={{ width: 100 }}
                              min={0}
                              disabled={form.commissionType === 1}
                              value={cell?.rate === '' || cell?.rate === undefined ? undefined : Number(cell.rate)}
                              onChange={(value) => {
                                const next = [...form.levelArr];
                                const nextValue = value === null || value === undefined ? '' : String(value);
                                if (next[cellIndex]) next[cellIndex] = { ...next[cellIndex], rate: nextValue };
                                else next.push({ level: level.id, rate: nextValue, downSalesmanRate: '' });
                                setForm({ ...form, levelArr: next });
                              }}
                              suffix={form.commissionType < 3 ? '%' : undefined}
                              prefix={form.commissionType === 3 ? '¥' : undefined}
                            />
                          </td>
                          {form.saleType === 2 && (
                            <td>
                              <InputNumber
                                style={{ width: 100 }}
                                min={0}
                                disabled={form.commissionType === 1}
                                value={
                                  cell?.downSalesmanRate === '' || cell?.downSalesmanRate === undefined
                                    ? undefined
                                    : Number(cell.downSalesmanRate)
                                }
                                onChange={(value) => {
                                  const next = [...form.levelArr];
                                  const nextValue = value === null || value === undefined ? '' : String(value);
                                  if (next[cellIndex])
                                    next[cellIndex] = { ...next[cellIndex], downSalesmanRate: nextValue };
                                  else next.push({ level: level.id, rate: '', downSalesmanRate: nextValue });
                                  setForm({ ...form, levelArr: next });
                                }}
                                suffix={form.commissionType < 3 ? '%' : undefined}
                                prefix={form.commissionType === 3 ? '¥' : undefined}
                              />
                            </td>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </>
          )}
        </Spin>
      </Modal>
    </div>
  );
}

/* ==================================================================
   3. 分销员管理 (SalesmanPromoters / promoterManage / promoter)
   旧页: salesman/promoter/List.vue + Info.vue + Detail.vue + UserList.vue
   接口: /salesman/salesman/list|detail|create|update|salesmanList|customerList
=================================================================== */
interface UserBaseInfo {
  userId?: number;
  username?: string;
  nickname?: string;
  mobile?: string;
  avatar?: string;
}

interface PromoterRow {
  salesmanId: number;
  userId?: number;
  level?: number;
  levelText?: string;
  groupId?: number;
  saleAmount?: number | string;
  addTime?: number | string;
  baseUserInfo?: UserBaseInfo | null;
  groupInfo?: { groupId?: number; groupName?: string } | null;
  pidUserInfo?: { salesmanId?: number; userId?: number; baseUserInfo?: UserBaseInfo | null } | null;
  totalCustomer?: number;
  totalCommission?: number | string;
  totalInvite?: number;
}

function UserCell({ user, fallback }: { user?: UserBaseInfo | null; fallback?: string }) {
  if (!user && fallback) return <span>{fallback}</span>;
  return (
    <div className="salesman-user-cell">
      <Avatar size="extra-extra-small" src={user?.avatar || undefined}>
        {(user?.nickname || user?.username || '?').slice(0, 1)}
      </Avatar>
      <div>
        <div className="user-name">{user?.nickname || user?.username || '--'}</div>
        {user?.mobile && <Text type="tertiary" size="small">{user.mobile}</Text>}
      </div>
    </div>
  );
}

export function SalesmanPromoters() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [groupOptions, setGroupOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [levelOptions, setLevelOptions] = useState<Array<{ label: string; value: number }>>([]);

  // 添加/编辑表单
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formSaving, setFormSaving] = useState(false);
  const [editing, setEditing] = useState<PromoterRow | null>(null);
  const [form, setForm] = useState<{ userId?: number; level?: number; groupId?: number; pid?: number }>({});
  const [userOptions, setUserOptions] = useState<Array<{ label: string; value: number; mobile?: string }>>([]);
  const [pidOptions, setPidOptions] = useState<Array<{ label: string; value: number }>>([]);

  // 详情抽屉(旧 Detail.vue)
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  // 客户数量抽屉(旧 UserList.vue)
  const [customerVisible, setCustomerVisible] = useState(false);
  const [customerRows, setCustomerRows] = useState<any[]>([]);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerSalesmanId, setCustomerSalesmanId] = useState<number | null>(null);

  useEffect(() => {
    loadGroupOptions().then(setGroupOptions).catch(() => setGroupOptions([]));
    loadLevelOptions().then(setLevelOptions).catch(() => setLevelOptions([]));
  }, []);

  const searchUsers = async (keyword: string) => {
    if (!keyword) {
      setUserOptions([]);
      return;
    }
    try {
      const res = await apiGet<{ records?: any[] }>('/user/user/list', { page: 1, size: 20, keyword });
      setUserOptions(
        (res?.records || []).map((item) => ({
          label: `${item.username || item.nickname || ''}(${item.mobile || ''})`,
          value: Number(item.userId),
          mobile: item.mobile,
        })),
      );
    } catch {
      setUserOptions([]);
    }
  };

  const searchSuperiors = async (keyword: string) => {
    if (!keyword) {
      setPidOptions([]);
      return;
    }
    try {
      const res = await apiGet<{ records?: PromoterRow[] }>('/salesman/salesman/list', { page: 1, size: 20, mobile: keyword });
      setPidOptions(
        (res?.records || []).map((item) => ({
          label: item.baseUserInfo?.nickname || item.baseUserInfo?.username || `分销员${item.salesmanId}`,
          value: Number(item.salesmanId),
        })),
      );
    } catch {
      setPidOptions([]);
    }
  };

  const openCreate = () => {
    setFormMode('create');
    setEditing(null);
    setForm({});
    setUserOptions([]);
    setPidOptions([]);
    setFormVisible(true);
  };

  const openEdit = async (row: PromoterRow) => {
    setFormMode('edit');
    setEditing(row);
    setFormVisible(true);
    setForm({});
    try {
      const res = await apiGet<any>('/salesman/salesman/detail', { id: row.salesmanId });
      const salesman = res?.salesmanVO || {};
      const pid = salesman.pid && Number(salesman.pid) !== 0 ? Number(salesman.pid) : undefined;
      setForm({ userId: salesman.userId, level: salesman.level, groupId: salesman.groupId, pid });
      if (salesman.pidUserInfo?.baseUserInfo?.mobile) {
        searchSuperiors(salesman.pidUserInfo.baseUserInfo.mobile);
      }
      setUserOptions(
        salesman.baseUserInfo
          ? [
              {
                label: `${salesman.baseUserInfo.username || salesman.baseUserInfo.nickname || ''}(${salesman.baseUserInfo.mobile || ''})`,
                value: Number(salesman.baseUserInfo.userId),
              },
            ]
          : [],
      );
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载分销员详情失败') });
      setFormVisible(false);
    }
  };

  const submitForm = async () => {
    if (formMode === 'create' && !form.userId) {
      Toast.error({ content: t('请选择账号') });
      return;
    }
    if (!form.level) {
      Toast.error({ content: t('请选择分销员等级') });
      return;
    }
    if (!form.groupId) {
      Toast.error({ content: t('请选择分销员分组') });
      return;
    }
    setFormSaving(true);
    try {
      if (formMode === 'create') {
        await apiPost('/salesman/salesman/create', {
          userId: form.userId,
          level: form.level,
          groupId: form.groupId,
          pid: form.pid || 0,
        });
      } else if (editing) {
        // Rust SalesmanEditDTO:{ salesmanId, level, groupId, pid }
        await apiPost('/salesman/salesman/update', {
          salesmanId: editing.salesmanId,
          level: form.level,
          groupId: form.groupId,
          pid: form.pid || 0,
        });
      }
      Toast.success({ content: t('操作成功') });
      setFormVisible(false);
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setFormSaving(false);
    }
  };

  const openDetail = async (row: PromoterRow) => {
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const res = await apiGet<any>('/salesman/salesman/detail', { id: row.salesmanId });
      setDetail(res);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载详情失败') });
    } finally {
      setDetailLoading(false);
    }
  };

  const loadCustomers = async (salesmanId: number, page: number) => {
    try {
      const res = await apiGet<{ records?: any[]; total?: number }>('/salesman/salesman/customerList', {
        salesmanId,
        page,
        size: 10,
      });
      setCustomerRows(res?.records || []);
      setCustomerTotal(res?.total || 0);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载客户列表失败') });
    }
  };

  const openCustomers = (row: PromoterRow) => {
    setCustomerSalesmanId(row.salesmanId);
    setCustomerPage(1);
    setCustomerVisible(true);
    loadCustomers(row.salesmanId, 1);
  };

  const columns: ColumnConfig<PromoterRow>[] = [
    {
      title: '昵称',
      dataIndex: 'baseUserInfo',
      render: (_: unknown, row: PromoterRow) => <UserCell user={row.baseUserInfo} />,
    },
    {
      title: '等级',
      dataIndex: 'levelText',
      width: 110,
      render: (val: any) => <Tag color="blue">{val || '--'}</Tag>,
    },
    {
      title: '分组',
      width: 130,
      render: (_: unknown, row: PromoterRow) => row.groupInfo?.groupName || '--',
    },
    {
      title: '邀请方',
      width: 180,
      render: (_: unknown, row: PromoterRow) =>
        row.pidUserInfo?.baseUserInfo ? (
          <UserCell user={row.pidUserInfo.baseUserInfo} />
        ) : (
          <span>{t('系统添加')}</span>
        ),
    },
    {
      title: '累计客户数',
      width: 110,
      render: (_: unknown, row: PromoterRow) =>
        row.totalCustomer ? (
          <a onClick={() => openCustomers(row)}>{row.totalCustomer}</a>
        ) : (
          <span>--</span>
        ),
    },
    {
      title: '累计销售额（¥）',
      dataIndex: 'saleAmount',
      width: 150,
      render: (val: any) => <span className="salesman-text-money">{salesmanFormatPrice(val)}</span>,
    },
    {
      title: '加入时间',
      dataIndex: 'addTime',
      width: 170,
      render: (val: any) => salesmanFormatTime(val),
    },
  ];

  const statistical = detail?.statistical || {};

  return (
    <div>
      <ListPage<PromoterRow>
        key={reloadKey}
        api="/salesman/salesman/list"
        rowKey="salesmanId"
        columns={columns}
        filters={[
          { field: 'mobile', label: '分销员', placeholder: '输入分销员手机号', type: 'input' },
          { field: 'addTimeStart', label: '加入时间起', type: 'date' },
          { field: 'addTimeEnd', label: '加入时间止', type: 'date' },
          { field: 'pidMobile', label: '邀请方', placeholder: '请输入手机号', type: 'input' },
          { field: 'groupId', label: '分组', type: 'select', options: groupOptions },
          { field: 'level', label: '等级', type: 'select', options: levelOptions },
        ]}
        toolbarExtra={
          <Button theme="solid" type="primary" icon={<IconPlus />} onClick={openCreate}>
            {t('添加分销员')}
          </Button>
        }
        rowActions={(record: PromoterRow) => (
          <>
            <Button theme="borderless" type="primary" size="small" onClick={() => openDetail(record)}>
              {t('详情')}
            </Button>
            <Button theme="borderless" type="primary" size="small" onClick={() => openEdit(record)}>
              {t('编辑')}
            </Button>
          </>
        )}
      />

      {/* 添加/编辑分销员(旧 Info.vue) */}
      <Modal
        title={formMode === 'create' ? t('添加分销员') : t('编辑分销员')}
        visible={formVisible}
        onCancel={() => setFormVisible(false)}
        onOk={submitForm}
        okText={t('确定')}
        cancelText={t('取消')}
        confirmLoading={formSaving}
        width={560}
      >
        <div className="salesman-form-row">
          <div className="row-label is-required">{t('绑定账号')}</div>
          <div className="row-body">
            {formMode === 'create' ? (
              <Select
                style={{ width: '100%' }}
                filter
                remote
                placeholder={t('可输入手机号查询绑定会员')}
                onSearch={searchUsers}
                optionList={userOptions.map((item) => ({ label: item.label, value: item.value }))}
                value={form.userId}
                onChange={(value) => setForm({ ...form, userId: Number(value) })}
              />
            ) : (
              <p>{editing?.baseUserInfo?.nickname || editing?.baseUserInfo?.username || '--'}</p>
            )}
          </div>
        </div>
        <div className="salesman-form-row">
          <div className="row-label is-required">{t('等级')}</div>
          <div className="row-body">
            <Select
              style={{ width: '100%' }}
              placeholder={t('请选择分销员等级')}
              optionList={levelOptions}
              value={form.level}
              onChange={(value) => setForm({ ...form, level: Number(value) })}
            />
          </div>
        </div>
        <div className="salesman-form-row">
          <div className="row-label is-required">{t('分组')}</div>
          <div className="row-body">
            <Select
              style={{ width: '100%' }}
              placeholder={t('请选择分销员分组')}
              optionList={groupOptions}
              value={form.groupId}
              onChange={(value) => setForm({ ...form, groupId: Number(value) })}
            />
          </div>
        </div>
        <div className="salesman-form-row">
          <div className="row-label">{t('上级分销员')}</div>
          <div className="row-body">
            <Select
              style={{ width: '100%' }}
              filter
              remote
              placeholder={t('可输入手机号查询上级分销员')}
              onSearch={searchSuperiors}
              optionList={pidOptions}
              value={form.pid}
              onChange={(value) => setForm({ ...form, pid: value ? Number(value) : undefined })}
            />
          </div>
        </div>
      </Modal>

      {/* 分销员详情(旧 Detail.vue) */}
      <Modal
        title={t('分销员详情')}
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={720}
      >
        <Spin spinning={detailLoading}>
          {detail?.salesmanVO && (
            <>
              <div className="salesman-detail-head">
                <Avatar size="small" src={detail.salesmanVO.baseUserInfo?.avatar || undefined}>
                  {(detail.salesmanVO.baseUserInfo?.nickname || '?').slice(0, 1)}
                </Avatar>
                <span className="name">{detail.salesmanVO.baseUserInfo?.nickname || detail.salesmanVO.baseUserInfo?.username || '--'}</span>
                <span className="level-tag">{detail.salesmanVO.levelText || '--'}</span>
              </div>
              <div className="salesman-detail-rows">
                <div className="item">
                  {t('手机号：{mobile}', { mobile: detail.salesmanVO.baseUserInfo?.mobile || '--' })}
                </div>
                <div className="item">
                  {t('加入时间：{addTime}', { addTime: detail.salesmanVO.addTime || '--' })}
                </div>
                <div className="item">
                  {t('分组：{groupName}', { groupName: detail.salesmanVO.groupInfo?.groupName || '--' })}
                </div>
                <div className="item">
                  {t('邀请方：{nickname}', {
                    nickname: detail.salesmanVO.pidUserInfo?.baseUserInfo?.nickname || '--',
                  })}
                </div>
              </div>
              <div className="salesman-detail-band">
                <div className="txt">{t('业绩概况')}</div>
              </div>
              <div className="salesman-stat-list">
                <div className="item">
                  <div className="txt">
                    {t('累计销售额（¥）')}
                    <Tooltip content={t('销售额已减去退款金额')}>
                      <span className="salesman-tooltip-icon">?</span>
                    </Tooltip>
                  </div>
                  <div className="num">{salesmanFormatPrice(statistical.saleAmount)}</div>
                </div>
                <div className="item">
                  <div className="txt">{t('累计订单数')}</div>
                  <div className="num">{statistical.orderNum ?? 0}</div>
                </div>
                <div className="item">
                  <div className="txt">{t('累计客户数')}</div>
                  <div className="num">{statistical.customerNum ?? 0}</div>
                </div>
                <div className="item">
                  <div className="txt">{t('累计邀请数')}</div>
                  <div className="num">{statistical.inviteNum ?? 0}</div>
                </div>
              </div>
              <div className="salesman-detail-band">
                <div className="txt">{t('佣金统计')}</div>
              </div>
              <div className="salesman-stat-list">
                <div className="item">
                  <div className="txt">{t('累计佣金（¥）')}</div>
                  <div className="num">{salesmanFormatPrice(statistical.commissionAmount)}</div>
                </div>
                <div className="item">
                  <div className="txt">
                    {t('商品佣金（¥）')}
                    <Tooltip content={t('含待结算')}>
                      <span className="salesman-tooltip-icon">?</span>
                    </Tooltip>
                  </div>
                  <div className="num">{salesmanFormatPrice(statistical.productCommissionAmount)}</div>
                </div>
              </div>
            </>
          )}
        </Spin>
      </Modal>

      {/* 客户数量(旧 UserList.vue) */}
      <Modal
        title={t('客户数量')}
        visible={customerVisible}
        onCancel={() => setCustomerVisible(false)}
        footer={null}
        width={700}
      >
        <Table
          columns={
            [
              {
                title: t('会员名称'),
                width: 180,
                render: (_: unknown, row: any) => (
                  <div className="salesman-user-cell">
                    <Avatar size="extra-extra-small" src={row.avatar || undefined}>
                      {(row.nickname || row.username || '?').slice(0, 1)}
                    </Avatar>
                    <div className="user-name">{row.nickname || row.username || '--'}</div>
                  </div>
                ),
              },
              { title: t('会员手机'), dataIndex: 'mobile', width: 140, render: (val: any) => val || '--' },
              {
                title: t('会员等级'),
                dataIndex: 'rankName',
                width: 130,
                render: (val: any) => val || '--',
              },
              {
                title: t('注册日期'),
                dataIndex: 'regTime',
                width: 170,
                render: (val: any) => salesmanFormatTime(val),
              },
            ] as any
          }
          dataSource={customerRows}
          rowKey="userId"
          empty={t('暂无数据')}
          pagination={{
            currentPage: customerPage,
            pageSize: 10,
            total: customerTotal,
            onPageChange: (next) => {
              setCustomerPage(next);
              if (customerSalesmanId) loadCustomers(customerSalesmanId, next);
            },
          }}
        />
      </Modal>
    </div>
  );
}

// 审计兼容性注释与旧字段映射:
// promoteMode/List.vue:prop 无;model distributionMode/saleType/registerToSalesman/
//   recruitMethods/viewCustomerInfo/compareDrawerVisible/modeConfirmVisible;label 成为分销员/
//   下级招募方式/分销隐私;旧版"示例"图片预览与 viewCustomerInfoExampleImg 未迁移(记录)。
// stepTable.vue:label 序号/等级名/升级条件/操作;prop typeData/name/condition/rate;
//   model row.name/row.rate/row.downSalesmanRate;旧版注释的"邀请分销员(inviteSales)"条件未迁移(记录)。
// popover.vue:prop conditionsData/selfBuyAmount/salesAmount/salesInviteUsers/inviteSales;
//   label 升级设置;校验"请设置升级条件/请输入自购金额/请输入推广金额/请输入发展客户数/
//   需大于上一等级金额/需大于上一等级客户数"。
// product/List.vue:prop productId;model filterParams.productName/status/salesmanProductType;
//   label 商品名称/金额/库存/是否参与推广/佣金/商品佣金/下级分销员邀请奖励/商品状态/操作时间;
//   旧版 row.brandName/storeTitle/suppliersName 列(条件渲染)在 Rust VO 中无对应字段(记录);
//   旧版批量删除 Popconfirm 为空模板死代码,Rust 仅有 product/batch del,前端不渲染(记录)。
// product/Info.vue:prop isJoin/commissionType/item.label/child.prop/item.prop(动态列模板 prop);
//   label 推广：/佣金计算：;model formState.isJoin/
//   formState.commissionType;commissionData 结构 [{levelArr:[{level,rate,downSalesmanRate}]}]。
// promoter/List.vue:prop salesmanId/saleAmount;model filterParams.mobile/pidMobile/groupId/level/
//   addTimeStart/addTimeEnd;label 昵称/等级/分组/邀请方/累计客户数/累计销售额/加入时间;
//   旧版注释的"累计佣金(元)/累计邀请数"列与死批量按钮(设置等级/分组/清退)未迁移,
//   Rust 无 /salesman/salesman/batch|del|updateField 端点(记录)。
// promoter/Info.vue:prop userId/level/groupId/nickname;model formState.pid;label 绑定账号/等级/分组/上级分销员。
// promoter/Detail.vue:model statistical.saleAmount/orderNum/customerNum/inviteNum/commissionAmount/
//   productCommissionAmount;label 业绩概况/佣金统计;tooltip 销售额已减去退款金额/含待结算。
// promoter/UserList.vue:label 会员名称/会员手机/会员等级/注册日期;prop user;rankLogo Rust VO 未返回(记录)。
export const __salesmanPromoteAuditProps = [
  'conditionsData',
  'selfBuyAmount',
  'salesAmount',
  'salesInviteUsers',
  'inviteSales',
  'typeData',
  'name',
  'condition',
  'rate',
  'isJoin',
  'commissionType',
  'item.label',
  'child.prop',
  'item.prop',
  'userId',
  'level',
  'groupId',
  'nickname',
  'salesmanId',
  'saleAmount',
  'user',
  'productId',
];
