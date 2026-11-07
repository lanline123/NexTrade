import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  CheckboxGroup,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  RadioGroup,
  Select,
  Space,
  Switch,
  Table,
  TabPane,
  Tabs,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';

const { Text } = Typography;

/* ==================================================================
   1. 语言列表 (LanguagesList / languagesList)
================================================================== */
interface LanguageItem {
  id: number;
  language: string;
  localeCode: string;
  domain?: string;
  currency?: { name?: string; symbol?: string };
  lastUpdated?: string;
  isEnabled?: number;
  isDefault?: number;
  sort?: number;
}

export function LanguagesList() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formState, setFormState] = useState({
    language: '',
    localeCode: '',
    domain: '',
    sort: 50,
    isEnabled: 1,
  });

  const openForm = async (record?: LanguageItem) => {
    if (record) {
      setEditingId(record.id);
      try {
        const res = await apiGet<any>('/lang/locales/detail', { id: record.id });
        setFormState({
          language: res?.language || record.language || '',
          localeCode: res?.localeCode || record.localeCode || '',
          domain: res?.domain || record.domain || '',
          sort: res?.sort ?? record.sort ?? 50,
          isEnabled: res?.isEnabled ?? record.isEnabled ?? 1,
        });
      } catch {
        setFormState({
          language: record.language || '',
          localeCode: record.localeCode || '',
          domain: record.domain || '',
          sort: record.sort ?? 50,
          isEnabled: record.isEnabled ?? 1,
        });
      }
    } else {
      setEditingId(null);
      setFormState({ language: '', localeCode: '', domain: '', sort: 50, isEnabled: 1 });
    }
    setFormVisible(true);
  };

  const handleFormSubmit = async () => {
    if (!formState.language.trim()) {
      Toast.error(t('语言名称不能为空'));
      return;
    }
    setFormLoading(true);
    try {
      if (editingId) {
        await apiPost('/lang/locales/update', { id: editingId, ...formState });
        Toast.success(t('更新成功'));
      } else {
        await apiPost('/lang/locales/create', formState);
        Toast.success(t('创建成功'));
      }
      setFormVisible(false);
      setReloadKey((k) => k + 1);
    } catch {
      // handled
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (ids: number[]) => {
    await apiPost('/lang/locales/batch', { type: 'del', ids });
    Toast.success(t('删除成功'));
    setReloadKey((k) => k + 1);
  };

  const handleBatchEnable = async (ids: number[], enabled: number) => {
    await apiPost('/lang/locales/batch', { type: 'enabled', ids, value: enabled });
    Toast.success(enabled === 1 ? t('批量启用成功') : t('批量取消启用成功'));
    setReloadKey((k) => k + 1);
  };

  const columns: ColumnConfig<LanguageItem>[] = [
    {
      title: '语言名称',
      dataIndex: 'language',
      width: 150,
      render: (val: any) => <span style={{ fontWeight: 500 }}>{val || '--'}</span>,
    },
    {
      title: '语言识别码',
      dataIndex: 'localeCode',
      width: 160,
    },
    {
      title: '语言独立域名',
      dataIndex: 'domain',
      width: 200,
      render: (val: any) => val || '--',
    },
    {
      title: '货币',
      dataIndex: 'currency.name',
      width: 140,
      render: (_: any, row: LanguageItem) => row.currency?.name || '--',
    },
    {
      title: '货币符号',
      dataIndex: 'currency.symbol',
      width: 120,
      render: (_: any, row: LanguageItem) => row.currency?.symbol || '--',
    },
    {
      title: '最后更新时间',
      dataIndex: 'lastUpdated',
      width: 180,
    },
    {
      title: '是否启用',
      dataIndex: 'isEnabled',
      width: 100,
      render: (val: any, row: LanguageItem) => (
        <Switch
          checked={val === 1}
          onChange={async (checked) => {
            await apiPost('/lang/locales/updateField', {
              id: row.id,
              field: 'isEnabled',
              val: checked ? 1 : 0,
            });
            Toast.success(t('状态更新成功'));
            setReloadKey((k) => k + 1);
          }}
        />
      ),
    },
    {
      title: '是否默认',
      dataIndex: 'isDefault',
      width: 100,
      render: (val: any) => (val === 1 ? <Tag color="blue">{t('默认')}</Tag> : '--'),
    },
    {
      title: '排序',
      dataIndex: 'sort',
      width: 90,
      render: (val: any) => val ?? 50,
    },
    {
      title: '操作',
      width: 140,
      render: (_: any, record: LanguageItem) => (
        <Space>
          <Button
            theme="borderless"
            type="primary"
            size="small"
            onClick={() => openForm(record)}
          >
            {t('编辑')}
          </Button>
          <Popconfirm
            title={t('您确认要删除所选数据吗？')}
            okType="danger"
            onConfirm={() => handleDelete([record.id])}
          >
            <Button theme="borderless" type="danger" size="small">
              {t('删除')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <ListPage<LanguageItem>
        key={reloadKey}
        api="/lang/locales/list"
        rowKey="id"
        columns={columns}
        selectable
        batchActions={(rows: LanguageItem[], clear: () => void) => (
          <Space>
            <Popconfirm
              title={t('您确认要批量删除所选数据吗？')}
              okType="danger"
              onConfirm={async () => {
                await handleDelete(rows.map((r) => r.id));
                clear();
              }}
            >
              <Button type="danger" size="small">
                {t('批量删除')} ({rows.length})
              </Button>
            </Popconfirm>
            <Button
              type="primary"
              size="small"
              onClick={async () => {
                await handleBatchEnable(rows.map((r) => r.id), 1);
                clear();
              }}
            >
              {t('批量启用')}
            </Button>
            <Button
              size="small"
              onClick={async () => {
                await handleBatchEnable(rows.map((r) => r.id), 0);
                clear();
              }}
            >
              {t('批量取消启用')}
            </Button>
          </Space>
        )}
        toolbarExtra={
          <Button icon={<IconPlus />} type="primary" onClick={() => openForm()}>
            {t('添加语言')}
          </Button>
        }
        filters={[
          {
            field: 'keyword',
            label: '语言名称',
            placeholder: '输入语言名称/编码',
            type: 'input',
          },
        ]}
      />

      <Modal
        title={editingId ? t('编辑语言') : t('添加语言')}
        visible={formVisible}
        onCancel={() => setFormVisible(false)}
        onOk={handleFormSubmit}
        confirmLoading={formLoading}
        width={580}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('语言名称')}</div>
            <Input
              placeholder={t('如：English / 简体中文')}
              value={formState.language}
              onChange={(val) => setFormState({ ...formState, language: val })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('语言识别码')}</div>
            <Input
              placeholder={t('如：en_US / zh_CN')}
              value={formState.localeCode}
              onChange={(val) => setFormState({ ...formState, localeCode: val })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('语言独立域名')}</div>
            <Input
              placeholder={t('可选，绑定独立访问域名')}
              value={formState.domain}
              onChange={(val) => setFormState({ ...formState, domain: val })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('排序')}</div>
            <InputNumber
              style={{ width: '100%' }}
              value={formState.sort}
              onChange={(val) => setFormState({ ...formState, sort: Number(val) || 50 })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

// width: 580

/* ==================================================================
   2. 货币管理 (CurrencyManagement / currencyManagement)
================================================================== */
interface CurrencyItem {
  id: number;
  name: string;
  symbol: string;
  code: string;
  rate: number | string;
  isDefault?: number;
}

/** GET /lang/currency/dictionary 返回的币种代码字典项（原版 CurrencyDictionaryItem） */
interface CurrencyDictionaryItem {
  id: number;
  name: string;
  code: string;
  numericCode?: string;
}

export function CurrencyManagement() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    symbol: '',
    code: '',
    rate: 1,
    isDefault: 0,
  });

  const [rateConfig, setRateConfig] = useState<any>({
    autoSync: 0,
    appId: '',
    syncIntervalHours: 1,
    lastSyncTime: '',
  });
  // 汇率配置自动保存的脏检查快照（对齐旧版 savedSnapshot）
  const savedSnapshotRef = useRef('');
  const [syncing, setSyncing] = useState(false);
  const [tipVisible, setTipVisible] = useState(true);

  // 国际通用代号数据源：后端币种字典（原版 getCurrencyDictionary），失败时回退为手输
  const [dictionary, setDictionary] = useState<CurrencyDictionaryItem[]>([]);
  const [dictFailed, setDictFailed] = useState(false);

  const snapshotOf = (cfg: { autoSync: unknown; appId: unknown; syncIntervalHours: unknown }) =>
    `${cfg.autoSync}|${cfg.appId}|${cfg.syncIntervalHours}`;

  const loadRateConfig = async () => {
    try {
      const res = await apiGet<any>('/lang/currency/exchangeRateConfig');
      if (res) {
        setRateConfig({
          autoSync: Number(res.autoSync) === 1 ? 1 : 0,
          appId: res.appId || '',
          syncIntervalHours: Number(res.syncIntervalHours) > 0 ? Number(res.syncIntervalHours) : 1,
          lastSyncTime: res.lastSyncTime || '',
        });
        savedSnapshotRef.current = snapshotOf({
          autoSync: Number(res.autoSync) === 1 ? 1 : 0,
          appId: res.appId || '',
          syncIntervalHours: Number(res.syncIntervalHours) > 0 ? Number(res.syncIntervalHours) : 1,
        });
      }
    } catch {
      // keep
    }
  };

  // 汇率配置自动保存（对齐旧版 autoSaveConfig）：
  // 切换更新方式、AppID 失焦、修改更新周期时即时持久化；
  // 开启自动更新但未填 AppID 时不写坏状态；无变化时跳过保存与提示
  const autoSaveConfig = async (next: typeof rateConfig) => {
    setRateConfig(next);
    if (Number(next.autoSync) === 1 && !String(next.appId || '').trim()) {
      Toast.warning(t('请先填写 AppID 以启用汇率自动更新'));
      return;
    }
    if (snapshotOf(next) === savedSnapshotRef.current) {
      return;
    }
    try {
      await apiPost('/lang/currency/saveExchangeRateConfig', {
        autoSync: next.autoSync,
        appId: next.appId,
        syncIntervalHours: next.syncIntervalHours,
      });
      savedSnapshotRef.current = snapshotOf(next);
      Toast.success(t('配置已保存'));
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : t('保存失败'));
    }
  };

  // 立即更新汇率（旧版 onSyncNow；Rust 端返回 bool，旧版返回 {success, message}，两者兼容）
  const onSyncNow = async () => {
    setSyncing(true);
    try {
      const result = await apiPost<any>('/lang/currency/syncExchangeRateNow', {});
      const success = result !== null && typeof result === 'object' ? !!result.success : !!result;
      const msg = result !== null && typeof result === 'object' ? result.message : '';
      if (success) {
        Toast.success(t(msg || '汇率更新成功'));
      } else {
        Toast.error(t(msg || '汇率更新失败'));
      }
      await loadRateConfig();
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : t('汇率更新失败'));
    } finally {
      setSyncing(false);
    }
  };

  const loadDictionary = async () => {
    try {
      const res = await apiGet<CurrencyDictionaryItem[]>('/lang/currency/dictionary');
      setDictionary(Array.isArray(res) ? res : []);
      setDictFailed(false);
    } catch {
      // 字典不可用时回退手输（保留现有数据兜底）
      setDictFailed(true);
    }
  };

  useEffect(() => {
    loadRateConfig();
    loadDictionary();
  }, []);

  const openForm = async (record?: CurrencyItem) => {
    if (record) {
      setEditingId(record.id);
      try {
        const res = await apiGet<any>('/lang/currency/detail', { id: record.id });
        setFormState({
          name: res?.name || record.name || '',
          symbol: res?.symbol || record.symbol || '',
          code: res?.code || record.code || '',
          rate: Number(res?.rate ?? record.rate) || 1,
          isDefault: res?.isDefault ?? record.isDefault ?? 0,
        });
      } catch {
        setFormState({
          name: record.name || '',
          symbol: record.symbol || '',
          code: record.code || '',
          rate: Number(record.rate) || 1,
          isDefault: record.isDefault ?? 0,
        });
      }
    } else {
      setEditingId(null);
      setFormState({ name: '', symbol: '', code: '', rate: 1, isDefault: 0 });
    }
    loadDictionary();
    setFormVisible(true);
  };

  // 代号下拉：字典项「名称 (代号)」；编辑时已保存代号不在字典中则补充为选项保证回显（对齐原版 codeOptions）
  const codeOptions = (() => {
    const options = dictionary.map((item) => ({
      label: `${item.name} (${item.code})`,
      value: item.code,
    }));
    const current = formState.code;
    if (current && !options.some((item) => item.value === current)) {
      options.unshift({ label: current, value: current });
    }
    return options;
  })();

  const handleFormSubmit = async () => {
    if (!formState.name.trim()) {
      Toast.error(t('币种名称不能为空'));
      return;
    }
    setFormLoading(true);
    try {
      if (editingId) {
        await apiPost('/lang/currency/update', { id: editingId, ...formState });
        Toast.success(t('更新成功'));
      } else {
        await apiPost('/lang/currency/create', formState);
        Toast.success(t('创建成功'));
      }
      setFormVisible(false);
      setReloadKey((k) => k + 1);
    } catch {
      // handled
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (ids: number[]) => {
    await apiPost('/lang/currency/batch', { type: 'del', ids });
    Toast.success(t('删除成功'));
    setReloadKey((k) => k + 1);
  };

  const columns: ColumnConfig<CurrencyItem>[] = [
    {
      title: '币种名称',
      dataIndex: 'name',
      width: 150,
      render: (val: any, row: CurrencyItem) => (
        <Space>
          {row.isDefault === 1 && <Tag color="blue" size="small">{t('默认')}</Tag>}
          <span style={{ fontWeight: 500 }}>{val || '--'}</span>
        </Space>
      ),
    },
    {
      title: '币种符号',
      dataIndex: 'symbol',
      width: 140,
    },
    {
      title: '国际通用代号',
      dataIndex: 'code',
      width: 140,
    },
    {
      title: '汇率',
      dataIndex: 'rate',
      width: 140,
      render: (val: any) => <span style={{ fontWeight: 600 }}>{val || 1}</span>,
    },
    {
      title: '是否默认',
      dataIndex: 'isDefault',
      width: 110,
      render: (val: any) => (val === 1 ? <Tag color="green">{t('默认币种')}</Tag> : '--'),
    },
    {
      title: '操作',
      width: 140,
      render: (_: any, record: CurrencyItem) => (
        <Space>
          <Button
            theme="borderless"
            type="primary"
            size="small"
            onClick={() => openForm(record)}
          >
            {t('编辑')}
          </Button>
          <Popconfirm
            title={t('您确认要删除所选数据吗？')}
            okType="danger"
            onConfirm={() => handleDelete([record.id])}
          >
            <Button theme="borderless" type="danger" size="small">
              {t('删除')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 顶部默认货币风险提醒（旧版 currency-default-tip） */}
      {tipVisible && (
        <div
          style={{
            border: '1px solid #ffe6d7',
            backgroundColor: '#ffefe6',
            padding: '10px 20px',
            lineHeight: '24px',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div>【重要提醒】</div>
            <div>
              1、默认货币是全平台计价基准，设置完成后禁止频繁切换；修改可能会破坏历史汇率换算逻辑，造成商品标价、订单实付、用户账户余额前后金额不匹配等问题，引发客诉与财务对账误差。
            </div>
            <div>
              2、默认货币为用户端展示基准币种，修改后务必同步调整后台商品计价货币，防止商品标价与前端展示出现数值偏差，引发误解。
              <a
                style={{ color: 'var(--semi-color-primary)', cursor: 'pointer', marginLeft: 4 }}
                onClick={() => {
                  window.location.href = `${window.location.origin}/?page=baseProductManage`;
                }}
              >
                {t('去设置')}
              </a>
            </div>
          </div>
          <div style={{ cursor: 'pointer', color: '#909399' }} onClick={() => setTipVisible(false)}>
            ×
          </div>
        </div>
      )}

      {/* 汇率更新面板（对齐旧版 exchange-rate-panel：自动/手动 + AppID + 更新周期 + 立即更新） */}
      <Card title={t('汇率自动同步设置')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ width: 110, flexShrink: 0 }}>{t('汇率更新：')}</span>
            <RadioGroup
              value={Number(rateConfig.autoSync) === 1 ? 1 : 0}
              onChange={(e) =>
                autoSaveConfig({ ...rateConfig, autoSync: Number(e.target.value) })
              }
            >
              <Radio value={1}>{t('自动更新')}</Radio>
              <Radio value={0}>{t('手动维护')}</Radio>
            </RadioGroup>
          </div>
          {Number(rateConfig.autoSync) === 1 && (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <span style={{ width: 110, flexShrink: 0, lineHeight: '32px' }}>{t('AppID：')}</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <Input
                    style={{ width: 420 }}
                    placeholder={t('请输入appid')}
                    value={rateConfig.appId || ''}
                    onChange={(val) => setRateConfig({ ...rateConfig, appId: val })}
                    onBlur={() => autoSaveConfig(rateConfig)}
                  />
                  <div style={{ marginTop: 4, color: '#909399', fontSize: 12, lineHeight: '20px' }}>
                    {t(
                      '客户切换展示货币后，商品会以切换后的货币展示价格，仅供参考。本数据由Open Exchange Rate提供支持，如需配置请前往官网获取 appid。',
                    )}
                    <a
                      href="https://openexchangerates.org"
                      target="_blank"
                      rel="noopener"
                      style={{ color: 'var(--semi-color-primary)', marginLeft: 4 }}
                    >
                      {t('去获取')}&gt;
                    </a>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <span style={{ width: 110, flexShrink: 0, lineHeight: '32px' }}>{t('更新周期：')}</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: 8 }}>{t('每')}</span>
                    <InputNumber
                      style={{ width: 90 }}
                      min={1}
                      max={720}
                      hideButtons
                      value={Number(rateConfig.syncIntervalHours) > 0 ? Number(rateConfig.syncIntervalHours) : 1}
                      onChange={(v) =>
                        autoSaveConfig({
                          ...rateConfig,
                          syncIntervalHours: Math.min(720, Math.max(1, Math.round(Number(v) || 1))),
                        })
                      }
                    />
                    <span style={{ margin: '0 12px 0 6px', color: '#909399' }}>{t('小时')}</span>
                    <span>{t('自动更新汇率')}</span>
                  </div>
                  <div style={{ marginTop: 4, color: '#909399', fontSize: 12, lineHeight: '20px' }}>
                    {t('因Open Exchange Rate免费版每月更新次数为 1000 次，请合理分配更新周期。')}
                  </div>
                </div>
              </div>
            </>
          )}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ width: 110, flexShrink: 0 }}>{t('上次更新时间：')}</span>
            <span style={{ marginRight: 12 }}>{rateConfig.lastSyncTime || t('尚未同步')}</span>
            {syncing ? (
              <span style={{ color: '#a0cfff' }}>{t('更新中…')}</span>
            ) : (
              <Popconfirm
                title={t('确认立即拉取最新汇率并更新各币种？（默认币种不参与）')}
                onConfirm={onSyncNow}
              >
                <a style={{ color: 'var(--semi-color-primary)', cursor: 'pointer' }}>{t('更新汇率')}</a>
              </Popconfirm>
            )}
          </div>
        </div>
      </Card>

      <ListPage<CurrencyItem>
        key={reloadKey}
        api="/lang/currency/list"
        rowKey="id"
        columns={columns}
        selectable
        batchActions={(rows: CurrencyItem[], clear: () => void) => (
          <Popconfirm
            title={t('您确认要批量删除所选数据吗？')}
            okType="danger"
            onConfirm={async () => {
              await handleDelete(rows.map((r) => r.id));
              clear();
            }}
          >
            <Button type="danger" size="small">
              {t('批量删除')} ({rows.length})
            </Button>
          </Popconfirm>
        )}
        toolbarExtra={
          <Button icon={<IconPlus />} type="primary" onClick={() => openForm()}>
            {t('添加币种')}
          </Button>
        }
        filters={[
          {
            field: 'name',
            label: '币种名称',
            placeholder: '请输入币种',
            type: 'input',
          },
        ]}
      />

      <Modal
        title={editingId ? t('编辑币种') : t('添加币种')}
        visible={formVisible}
        onCancel={() => setFormVisible(false)}
        onOk={handleFormSubmit}
        confirmLoading={formLoading}
        width={600}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('币种名称')}</div>
            <Input
              placeholder={t('如：人民币 / 美元')}
              value={formState.name}
              onChange={(val) => setFormState({ ...formState, name: val })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('币种符号')}</div>
            <Input
              placeholder={t('如：¥ / $')}
              value={formState.symbol}
              onChange={(val) => setFormState({ ...formState, symbol: val })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('国际通用代号')}</div>
            {dictFailed ? (
              // 字典加载失败时保留原手输兜底
              <Input
                placeholder={t('如：CNY / USD')}
                value={formState.code}
                onChange={(val) => setFormState({ ...formState, code: val })}
              />
            ) : (
              <Select
                placeholder={t('请选择国际通用代号')}
                optionList={codeOptions}
                value={formState.code || undefined}
                onChange={(val) => setFormState({ ...formState, code: String(val || '') })}
                style={{ width: '100%' }}
              />
            )}
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('汇率')}</div>
            <InputNumber
              style={{ width: '100%' }}
              value={formState.rate}
              onChange={(val) => setFormState({ ...formState, rate: Number(val) || 1 })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

// width: 600

/* ==================================================================
   3. 翻译内容管理 (TranslationContent / translationContent)
   契约对齐旧版 setting/multilingual/translationContent：
   List.vue（三 Tab + 每语言译文列 + 一键/批量翻译）
   Info.vue（添加/编辑语句：原文 + 每语言译文 + 一键生成翻译）
   Add.vue（批量添加语句：多行原文 → batchCreate）
   Quick.vue（智能翻译：按语言逐条 multiple，可暂停/继续，覆盖策略）
   BusinessDialog.vue（数据维护翻译：getTranslations + createTranslations）
================================================================== */
interface TranslationItem {
  id: number;
  translationName: string;
  dataType: number; // 0: 页面文字, 1: 接口文字, 2: 业务数据
  tdata?: Array<{ localeId: number; translationValue: string }>;
}

interface LocaleRow {
  id: number;
  language: string;
  localeCode: string;
  translationValue?: string;
}

async function loadEnabledLocales(): Promise<LocaleRow[]> {
  // Rust 端 size 为 u64（1-100），旧版 -1 表示全部的写法会 400；语言数远小于 100，取上限
  const res = await apiGet<{ records?: any[] }>('/lang/locales/list', {
    isEnabled: 1,
    size: 100,
  });
  return (res.records || []).map((r) => ({
    id: Number(r.id),
    language: r.language || '',
    localeCode: r.localeCode || '',
    translationValue: '',
  }));
}

function mergeTranslationItems(list: LocaleRow[], items?: Array<{ localeId?: number; translationValue?: string }>) {
  (items || []).forEach((item) => {
    if (item.localeId === undefined || item.localeId === null) return;
    const row = list.find((l) => l.id === Number(item.localeId));
    if (row) row.translationValue = item.translationValue || '';
  });
}

function LocaleTranslationTable({
  locales,
  loading,
  onChange,
}: {
  locales: LocaleRow[];
  loading: boolean;
  onChange: (id: number, value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <Table
      size="small"
      loading={loading}
      dataSource={locales}
      rowKey="id"
      pagination={false}
      empty={t('暂无数据')}
      columns={[
        { title: t('语言'), dataIndex: 'language', width: 180 },
        {
          title: t('翻译内容'),
          dataIndex: 'translationValue',
          render: (_: any, row: LocaleRow) => (
            <Input
              value={row.translationValue || ''}
              onChange={(val) => onChange(row.id, val)}
            />
          ),
        },
      ]}
    />
  );
}

/**
 * 添加/编辑语句（旧版 Info.vue）与数据维护翻译（旧版 BusinessDialog.vue）共用弹窗。
 * content 模式：detail?id= 载入，create/update 保存（后端按原文+类型+语言 upsert）。
 * business 模式：getTranslations?dataType&translationName 载入，createTranslations 保存。
 */
function TranslationEditModal({
  visible,
  title,
  mode,
  id = 0,
  dataType,
  businessName = '',
  onClose,
  onSaved,
}: {
  visible: boolean;
  title: string;
  mode: 'content' | 'business';
  id?: number;
  dataType: number;
  businessName?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [translationName, setTranslationName] = useState('');
  const [currentDataType, setCurrentDataType] = useState(dataType);
  const [locales, setLocales] = useState<LocaleRow[]>([]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setLoading(true);
    setTranslationName(mode === 'business' ? businessName : '');
    setCurrentDataType(dataType);
    (async () => {
      try {
        const list = await loadEnabledLocales();
        if (mode === 'business') {
          const res = await apiGet<{ items?: any[] }>('/lang/translations/getTranslations', {
            dataType,
            translationName: businessName,
          });
          mergeTranslationItems(list, res.items);
        } else if (id > 0) {
          const res = await apiGet<any>('/lang/translations/detail', { id });
          if (!alive) return;
          setTranslationName(res?.translationName || '');
          if (typeof res?.dataType === 'number') setCurrentDataType(res.dataType);
          mergeTranslationItems(list, res?.items);
        }
        if (!alive) return;
        setLocales(list);
      } catch (error) {
        Toast.error(error instanceof Error ? error.message : t('加载失败'));
        if (alive) onClose();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mode, id, dataType, businessName]);

  const handleLocaleChange = (localeId: number, value: string) => {
    setLocales((cur) => cur.map((l) => (l.id === localeId ? { ...l, translationValue: value } : l)));
  };

  // 一键生成翻译（旧版 Info/BusinessDialog 同款：逐语言调 translation 接口）
  const handleGenerate = async () => {
    if (!translationName.trim()) {
      Toast.error(t('翻译原文不能为空!'));
      return;
    }
    setGenerating(true);
    try {
      for (const locale of locales) {
        const res = await apiPost<{ translation?: string }>('/lang/translations/translation', {
          code: locale.localeCode,
          text: translationName,
        });
        handleLocaleChange(locale.id, res.translation || '');
      }
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : t('翻译失败'));
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (!translationName.trim()) {
      Toast.error(t('翻译原文不能为空!'));
      return;
    }
    setSaving(true);
    try {
      const items = locales.map((l) => ({
        localeId: l.id,
        translationValue: l.translationValue || '',
      }));
      if (mode === 'business') {
        await apiPost('/lang/translations/createTranslations', {
          translationName,
          dataType: currentDataType,
          items,
        });
      } else {
        await apiPost(id > 0 ? '/lang/translations/update' : '/lang/translations/create', {
          ...(id > 0 ? { id } : {}),
          translationName,
          dataType: currentDataType,
          items,
        });
      }
      Toast.success(t('操作成功'));
      onSaved();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : t('保存失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={title}
      visible={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={saving}
      width={700}
      okText={t('确定')}
      cancelText={t('取消')}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('翻译原文：')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              style={{ flex: 1 }}
              maxLength={60}
              value={translationName}
              onChange={(val) => setTranslationName(val)}
            />
            <Button theme="solid" type="primary" loading={generating} onClick={handleGenerate}>
              {t('一键生成翻译')}
            </Button>
          </div>
        </div>
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('翻译列表：')}</div>
          <LocaleTranslationTable
            locales={locales}
            loading={loading}
            onChange={handleLocaleChange}
          />
        </div>
      </div>
    </Modal>
  );
}

/** 批量添加语句（旧版 Add.vue）：多行原文按 Enter 拆句，batchCreate 一次建多条 */
function TranslationBatchAddModal({
  visible,
  dataType,
  onClose,
  onSaved,
}: {
  visible: boolean;
  dataType: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState<number[]>([dataType]);
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) {
      setTypes([dataType]);
      setText('');
    }
  }, [visible, dataType]);

  const handleSubmit = async () => {
    if (!text.trim()) {
      Toast.error(t('翻译原文不能为空!'));
      return;
    }
    if (types.length === 0) {
      Toast.error(t('请选择翻译类型!'));
      return;
    }
    setSaving(true);
    try {
      await apiPost('/lang/translations/batchCreate', { translationName: text, dataType: types });
      Toast.success(t('操作成功'));
      onSaved();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : t('保存失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('批量添加语句')}
      visible={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={saving}
      width={700}
      okText={t('确定')}
      cancelText={t('取消')}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('翻译类型：')}</div>
          <CheckboxGroup
            value={types}
            onChange={(val) => setTypes((val as number[]).map(Number))}
          >
            <Checkbox value={0}>{t('页面文字')}</Checkbox>
            <Checkbox value={1}>{t('接口文字')}</Checkbox>
          </CheckboxGroup>
        </div>
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('翻译原文：')}</div>
          <TextArea rows={10} value={text} onChange={(val) => setText(val)} />
          <div style={{ marginTop: 6, color: 'var(--semi-color-text-2)', fontSize: 12 }}>
            {t('输入需要翻译的原文句子, 每输入完成一句用Enter键换行, 继续输入下一句')}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * 智能翻译（旧版 Quick.vue）：按语言逐批调 multiple 接口，
 * 支持全部翻译/单独翻译/暂停/继续，以及覆盖策略（1 仅未维护 / 2 覆盖全部）。
 */
function TranslationQuickModal({
  visible,
  dataType,
  total,
  ids,
  onClose,
  onDone,
}: {
  visible: boolean;
  dataType: number;
  total: number;
  ids: number[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [locales, setLocales] = useState<LocaleRow[]>([]);
  const [progress, setProgress] = useState<number[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [updateType, setUpdateType] = useState<1 | 2>(1);
  // 用 ref 保存翻译循环的可变状态，避免闭包陷阱
  const runState = useRef({
    paused: false,
    type: 'all' as 'all' | 'single',
    currentIndex: 0,
    done: 0,
    updateType: 1 as 1 | 2,
    running: false,
  });
  const batchSize = 20;
  const totalTranslations = ids.length > 0 ? ids.length : total;

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    loadEnabledLocales()
      .then(setLocales)
      .catch((error) => Toast.error(error instanceof Error ? error.message : t('加载失败')))
      .finally(() => setLoading(false));
    return () => {
      // 关闭弹窗时停止翻译
      runState.current.paused = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setProgress([]);
      setIsTranslating(false);
      setIsPaused(false);
      runState.current = {
        paused: false,
        type: 'all',
        currentIndex: 0,
        done: 0,
        updateType: 1,
        running: false,
      };
    }
  }, [visible]);

  const translateLanguage = async (languageIndex: number) => {
    const state = runState.current;
    const locale = locales[languageIndex];
    if (!locale) return;
    state.done = state.type === 'all' && languageIndex !== state.currentIndex ? 0 : state.done;
    for (let start = state.done; start < totalTranslations; start += batchSize) {
      if (state.paused) return;
      const page = Math.floor(start / batchSize) + 1;
      try {
        await apiPost('/lang/translations/multiple', {
          ids,
          localesId: locale.id,
          dataType,
          size: batchSize,
          page,
          updateType: state.updateType,
        });
      } catch (error) {
        Toast.error(error instanceof Error ? error.message : t('翻译失败'));
        return;
      }
      state.done = Math.min(start + batchSize, totalTranslations);
      setProgress((cur) => {
        const next = [...cur];
        next[languageIndex] = state.done;
        return next;
      });
    }
  };

  const runAll = async (startIndex: number) => {
    const state = runState.current;
    state.running = true;
    setIsTranslating(true);
    for (let i = startIndex; i < locales.length; i++) {
      if (state.paused) break;
      state.currentIndex = i;
      await translateLanguage(i);
      if (state.paused) break;
      state.done = 0;
    }
    if (!state.paused) {
      setIsTranslating(false);
      state.running = false;
      onDone();
    }
  };

  // 覆盖策略二次确认（旧版 ElMessageBox 同款两选项）
  const confirmUpdateType = (index: number, type: 'all' | 'single') => {
    setPendingIndex(index);
    runState.current.type = type;
    setUpdateType(1);
    setConfirmVisible(true);
  };

  const startConfirmed = () => {
    setConfirmVisible(false);
    const state = runState.current;
    state.paused = false;
    state.updateType = updateType;
    state.done = 0;
    setIsPaused(false);
    if (state.type === 'all') {
      runAll(pendingIndex ?? 0);
    } else {
      setIsTranslating(true);
      translateLanguage(pendingIndex ?? 0).then(() => {
        if (!runState.current.paused) {
          setIsTranslating(false);
          runState.current.running = false;
        }
      });
    }
  };

  const pauseTranslation = () => {
    runState.current.paused = true;
    setIsPaused(true);
  };

  const resumeTranslation = () => {
    const state = runState.current;
    state.paused = false;
    setIsPaused(false);
    if (state.type === 'all') {
      runAll(state.currentIndex);
    } else {
      setIsTranslating(true);
      translateLanguage(state.currentIndex).then(() => {
        if (!runState.current.paused) {
          setIsTranslating(false);
          runState.current.running = false;
        }
      });
    }
  };

  const handleClose = () => {
    if (runState.current.running && !runState.current.paused) {
      Modal.confirm({
        title: t('提示'),
        content: t('当前还有正在进行中的翻译，关闭之后会停止所有翻译操作，是否确认关闭？'),
        okText: t('确定'),
        cancelText: t('取消'),
        onOk: () => {
          runState.current.paused = true;
          onClose();
        },
      });
      return;
    }
    onClose();
  };

  const getProgress = (index: number) => `${progress[index] || 0}/${totalTranslations}`;

  return (
    <Modal
      title={t('智能翻译')}
      visible={visible}
      onCancel={handleClose}
      footer={null}
      width={700}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Button
          theme="solid"
          type="primary"
          style={{ alignSelf: 'flex-start', marginBottom: 8 }}
          disabled={isTranslating}
          onClick={() => confirmUpdateType(0, 'all')}
        >
          {t('全部翻译')}
        </Button>
        <Table
          size="small"
          loading={loading}
          dataSource={locales}
          rowKey="id"
          pagination={false}
          columns={[
            {
              title: t('语言'),
              dataIndex: 'language',
              width: 180,
              render: (val: any) => val || '--',
            },
            {
              title: t('翻译进度'),
              dataIndex: 'progress',
              render: (_: any, row: LocaleRow, index: number) => (
                <Space>
                  {isTranslating && runState.current.currentIndex === index && (
                    <span>
                      {isPaused
                        ? t('当前翻译完成后暂停...')
                        : t('正在翻译中，请稍候...')}
                    </span>
                  )}
                  <span>({getProgress(index)})</span>
                </Space>
              ),
            },
            {
              title: t('操作'),
              width: 100,
              render: (_: any, row: LocaleRow, index: number) =>
                isTranslating && runState.current.currentIndex === index && !isPaused ? (
                  <Button theme="borderless" type="primary" size="small" onClick={pauseTranslation}>
                    {t('暂停翻译')}
                  </Button>
                ) : isPaused && runState.current.currentIndex === index ? (
                  <Button theme="borderless" type="primary" size="small" onClick={resumeTranslation}>
                    {t('继续翻译')}
                  </Button>
                ) : (
                  <Button
                    theme="borderless"
                    type="primary"
                    size="small"
                    disabled={isTranslating}
                    onClick={() => confirmUpdateType(index, 'single')}
                  >
                    {t('单独翻译')}
                  </Button>
                ),
            },
          ]}
        />
      </div>
      <Modal
        title={t('智能翻译')}
        visible={confirmVisible}
        onCancel={() => setConfirmVisible(false)}
        onOk={startConfirmed}
        width={520}
        okText={t('确认翻译')}
        cancelText={t('取消')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>{t('即将对当前分类下的翻译内容执行智能翻译')}</div>
          <div style={{ fontWeight: 500 }}>{t('请选择覆盖策略：')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', gap: 8, cursor: 'pointer' }}>
              <Radio
                checked={updateType === 1}
                onChange={() => setUpdateType(1)}
              />
              <span>
                <div>{t('仅翻译未维护的内容（推荐）')}</div>
                <div style={{ color: 'var(--semi-color-text-2)', fontSize: 12, marginTop: 4 }}>
                  {t('跳过已手动编辑过的翻译，仅处理未翻译的条目')}
                </div>
              </span>
            </label>
            <label style={{ display: 'flex', gap: 8, cursor: 'pointer' }}>
              <Radio
                checked={updateType === 2}
                onChange={() => setUpdateType(2)}
              />
              <span>
                <div>{t('覆盖全部内容')}</div>
                <div style={{ color: 'var(--semi-color-text-2)', fontSize: 12, marginTop: 4 }}>
                  {t('对所有条目重新翻译，包括已手动维护过的内容')}
                </div>
              </span>
            </label>
          </div>
        </div>
      </Modal>
    </Modal>
  );
}

// 数据维护 Tab 支持的业务类型（旧版 options：商品 2 / 分类 3 / 品牌 4 / 文章 6）
const BUSINESS_TYPE_META: Record<number, { api: string; nameField: string; label: string }> = {
  2: { api: '/product/product/list', nameField: 'productName', label: '商品名称' },
  3: { api: '/product/category/list', nameField: 'categoryName', label: '分类名称' },
  4: { api: '/product/brand/list', nameField: 'brandName', label: '品牌名称' },
  6: { api: '/content/article/list', nameField: 'articleTitle', label: '文章标题' },
};

export function TranslationContent() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [dataType, setDataType] = useState<number>(0);
  const [bizType, setBizType] = useState<number>(2);
  const [locales, setLocales] = useState<LocaleRow[]>([]);
  const [localeIds, setLocaleIds] = useState('');
  const [listTotal, setListTotal] = useState(0);
  const [contentModal, setContentModal] = useState<{ visible: boolean; id: number }>({
    visible: false,
    id: 0,
  });
  const [batchAddVisible, setBatchAddVisible] = useState(false);
  const [quickModal, setQuickModal] = useState<{
    visible: boolean;
    dataType: number;
    total: number;
    ids: number[];
  }>({ visible: false, dataType: 0, total: 0, ids: [] });
  const [bizModal, setBizModal] = useState<{
    visible: boolean;
    dataType: number;
    dataId: number;
    name: string;
  }>({ visible: false, dataType: 2, dataId: 0, name: '' });

  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let alive = true;
    apiGet<any>('/lang/translations/getLocalesLimit3')
      .then((res) => {
        if (!alive) return;
        const list: any[] = Array.isArray(res) ? res : res?.records || [];
        setLocales(list);
        setLocaleIds(list.map((item: any) => item.id).join(','));
      })
      .catch(() => {
        // 语言列表加载失败时不渲染译文列
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleDelete = async (ids: number[]) => {
    await apiPost('/lang/translations/batch', { type: 'del', ids });
    Toast.success(t('删除成功'));
    reload();
  };

  // —— 页面文字 / 接口文字 Tab（dataType < 2）——
  const contentColumns: ColumnConfig<TranslationItem>[] = [
    {
      title: '原句',
      dataIndex: 'translationName',
      render: (val: any) => <span style={{ fontWeight: 500 }}>{val || '--'}</span>,
    },
    ...locales.map((locale) => ({
      title: locale.language,
      dataIndex: `locale_${locale.id}`,
      width: 160,
      render: (_: any, record: TranslationItem) => {
        const hit = record.tdata?.find((item) => item.localeId === locale.id);
        return <span>{hit?.translationValue || ''}</span>;
      },
    })),
    {
      title: '翻译类型',
      dataIndex: 'dataType',
      width: 140,
      render: (val: any) => (val === 0 ? t('页面文字') : t('接口文字')),
    },
    {
      title: '操作',
      width: 140,
      render: (_: any, record: TranslationItem) => (
        <Space>
          <Button
            theme="borderless"
            type="primary"
            size="small"
            onClick={() => setContentModal({ visible: true, id: record.id })}
          >
            {t(record.dataType === 0 ? '编辑页面文字' : '编辑接口文字')}
          </Button>
          <Popconfirm
            title={t('您确认要删除所选数据吗？')}
            okType="danger"
            onConfirm={() => handleDelete([record.id])}
          >
            <Button theme="borderless" type="danger" size="small">
              {t('删除')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // —— 数据维护 Tab（dataType == 2，旧版 optionsParams 走商品/分类/品牌/文章列表）——
  const bizMeta = BUSINESS_TYPE_META[bizType] || BUSINESS_TYPE_META[2];
  const bizColumns: ColumnConfig<any>[] = [
    {
      title: '原句',
      dataIndex: bizMeta.nameField,
      render: (val: any) => <span style={{ fontWeight: 500 }}>{val || '--'}</span>,
    },
    {
      title: '翻译类型',
      dataIndex: 'dataType',
      width: 150,
      render: () => t(bizMeta.label),
    },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: any) => (
        <Button
          theme="borderless"
          type="primary"
          size="small"
          onClick={() =>
            setBizModal({
              visible: true,
              dataType: bizType,
              dataId: Number(record.productId ?? record.categoryId ?? record.brandId ?? record.articleId ?? record.id),
              name: String(record[bizMeta.nameField] || ''),
            })
          }
        >
          {t('翻译')}
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <Tabs
        type="line"
        activeKey={String(dataType)}
        onChange={(k) => setDataType(Number(k))}
        style={{ marginBottom: 16 }}
      >
        <TabPane tab={t('页面文字')} itemKey="0" />
        <TabPane tab={t('接口文字')} itemKey="1" />
        <TabPane tab={t('数据维护')} itemKey="2" />
      </Tabs>

      {dataType < 2 ? (
        <ListPage<TranslationItem>
          key={`content-${dataType}-${localeIds}-${reloadKey}`}
          api="/lang/translations/list"
          query={{ dataType, localeIds }}
          rowKey="id"
          columns={contentColumns}
          selectable
          onDataLoaded={({ total }) => setListTotal(total)}
          batchActions={(rows: TranslationItem[], clear: () => void) => (
            <Space>
              <span>
                {t('已选择：')}<b>{rows.length}</b> {t('项')}
              </span>
              <Popconfirm
                title={t('您确认要批量删除所选数据吗？')}
                okType="danger"
                onConfirm={async () => {
                  await handleDelete(rows.map((r) => r.id));
                  clear();
                }}
              >
                <Button type="danger" size="small">
                  {t('批量删除')} ({rows.length})
                </Button>
              </Popconfirm>
              <Button
                type="primary"
                size="small"
                onClick={() => {
                  clear();
                  setQuickModal({
                    visible: true,
                    dataType,
                    total: rows.length,
                    ids: rows.map((r) => r.id),
                  });
                }}
              >
                {t('批量翻译')}
              </Button>
            </Space>
          )}
          toolbarExtra={
            <Space>
              <Button
                icon={<IconPlus />}
                type="primary"
                onClick={() => setContentModal({ visible: true, id: 0 })}
              >
                {t('添加语句')}
              </Button>
              <Button
                icon={<IconPlus />}
                type="primary"
                onClick={() => setBatchAddVisible(true)}
              >
                {t('批量添加语句')}
              </Button>
              <Button
                type="warning"
                onClick={() =>
                  setQuickModal({ visible: true, dataType, total: listTotal, ids: [] })
                }
              >
                {t('一键翻译')}
              </Button>
            </Space>
          }
          filters={[
            {
              field: 'translationName',
              label: '原句',
              placeholder: '请输入原句',
              type: 'input',
            },
          ]}
        />
      ) : (
        <ListPage<any>
          key={`biz-${bizType}-${reloadKey}`}
          api={bizMeta.api}
          query={bizType === 3 ? { parentId: -1 } : {}}
          rowKey="id"
          columns={bizColumns}
          onDataLoaded={({ total }) => setListTotal(total)}
          toolbarExtra={
            <Space>
              <Select
                style={{ width: 180 }}
                placeholder={t('请选择数据类型')}
                value={bizType}
                onChange={(val) => {
                  setBizType(Number(val));
                  reload();
                }}
                optionList={[
                  { value: 2, label: t('商品') },
                  { value: 3, label: t('分类') },
                  { value: 4, label: t('品牌') },
                  { value: 6, label: t('文章') },
                ]}
              />
              <Button
                type="warning"
                onClick={() =>
                  setQuickModal({ visible: true, dataType: bizType, total: listTotal, ids: [] })
                }
              >
                {t('一键翻译')}
              </Button>
            </Space>
          }
        />
      )}

      <TranslationEditModal
        visible={contentModal.visible}
        title={
          contentModal.id > 0
            ? t(dataType === 0 ? '编辑页面文字' : '编辑接口文字')
            : t(dataType === 0 ? '添加页面文字' : '添加接口文字')
        }
        mode="content"
        id={contentModal.id}
        dataType={dataType}
        onClose={() => setContentModal({ visible: false, id: 0 })}
        onSaved={() => {
          setContentModal({ visible: false, id: 0 });
          reload();
        }}
      />

      <TranslationBatchAddModal
        visible={batchAddVisible}
        dataType={dataType}
        onClose={() => setBatchAddVisible(false)}
        onSaved={() => {
          setBatchAddVisible(false);
          reload();
        }}
      />

      <TranslationQuickModal
        visible={quickModal.visible}
        dataType={quickModal.dataType}
        total={quickModal.total}
        ids={quickModal.ids}
        onClose={() => setQuickModal({ visible: false, dataType: 0, total: 0, ids: [] })}
        onDone={reload}
      />

      <TranslationEditModal
        visible={bizModal.visible}
        title={t('查看')}
        mode="business"
        dataType={bizModal.dataType}
        businessName={bizModal.name}
        onClose={() => setBizModal({ visible: false, dataType: 2, dataId: 0, name: '' })}
        onSaved={() => {
          setBizModal({ visible: false, dataType: 2, dataId: 0, name: '' });
          reload();
        }}
      />
    </Card>
  );
}

// width: 700

/* ==================================================================
   4. 词汇关联/地区语言关联 (VerbalAssociation / verbalAssociation)
================================================================== */
interface VerbalAssociationItem {
  id: number;
  name: string;
  code: string;
}

export function VerbalAssociation() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    code: '',
  });

  const openForm = (record?: VerbalAssociationItem) => {
    if (record) {
      setEditingId(record.id);
      setFormState({ name: record.name, code: record.code });
    } else {
      setEditingId(null);
      setFormState({ name: '', code: '' });
    }
    setFormVisible(true);
  };

  const handleFormSubmit = async () => {
    if (!formState.name.trim() || !formState.code.trim()) {
      Toast.error(t('地区和语言标识码不能为空'));
      return;
    }
    setFormLoading(true);
    try {
      if (editingId) {
        await apiPost('/lang/localesRelation/update', { id: editingId, ...formState });
        Toast.success(t('更新成功'));
      } else {
        await apiPost('/lang/localesRelation/create', formState);
        Toast.success(t('创建成功'));
      }
      setFormVisible(false);
      setReloadKey((k) => k + 1);
    } catch {
      // handled
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (ids: number[]) => {
    await apiPost('/lang/localesRelation/batch', { type: 'del', ids });
    Toast.success(t('删除成功'));
    setReloadKey((k) => k + 1);
  };

  const columns: ColumnConfig<VerbalAssociationItem>[] = [
    {
      title: '地区',
      dataIndex: 'name',
      render: (val: any) => <span style={{ fontWeight: 500 }}>{val || '--'}</span>,
    },
    {
      title: '语言标识码',
      dataIndex: 'code',
      render: (val: any) => <Tag color="blue">{val || '--'}</Tag>,
    },
    {
      title: '操作',
      width: 140,
      render: (_: any, record: VerbalAssociationItem) => (
        <Space>
          <Button
            theme="borderless"
            type="primary"
            size="small"
            onClick={() => openForm(record)}
          >
            {t('编辑')}
          </Button>
          <Popconfirm
            title={t('您确认要删除所选数据吗？')}
            okType="danger"
            onConfirm={() => handleDelete([record.id])}
          >
            <Button theme="borderless" type="danger" size="small">
              {t('删除')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <ListPage<VerbalAssociationItem>
        key={reloadKey}
        api="/lang/localesRelation/list"
        rowKey="id"
        columns={columns}
        selectable
        batchActions={(rows: VerbalAssociationItem[], clear: () => void) => (
          <Popconfirm
            title={t('您确认要批量删除所选数据吗？')}
            okType="danger"
            onConfirm={async () => {
              await handleDelete(rows.map((r) => r.id));
              clear();
            }}
          >
            <Button type="danger" size="small">
              {t('批量删除')} ({rows.length})
            </Button>
          </Popconfirm>
        )}
        toolbarExtra={
          <Button icon={<IconPlus />} type="primary" onClick={() => openForm()}>
            {t('添加地区语言关联')}
          </Button>
        }
        filters={[
          {
            field: 'keyword',
            label: '地区/标识码',
            placeholder: '输入地区或标识码',
            type: 'input',
          },
        ]}
      />

      <Modal
        title={editingId ? t('编辑地区语言') : t('添加地区语言关联')}
        visible={formVisible}
        onCancel={() => setFormVisible(false)}
        onOk={handleFormSubmit}
        confirmLoading={formLoading}
        width={580}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('地区')}</div>
            <Input
              placeholder={t('如：中国 / 美国')}
              value={formState.name}
              onChange={(val) => setFormState({ ...formState, name: val })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('语言标识码')}</div>
            <Input
              placeholder={t('如：zh_CN / en_US')}
              value={formState.code}
              onChange={(val) => setFormState({ ...formState, code: val })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

// width: 580

/* ==================================================================
   5. 区号管理 (AreaCode / areaCode)
   契约对齐 Rust system::area_code / Java AreaCodeController：
   字段为 name / code / isDefault / isAvailable（camelCase），
   updateField 白名单 {code, name, isAvailable, isDefault}，del 按单个 id。
================================================================== */
interface AreaCodeItem {
  id: number;
  name: string;
  code: string;
  isDefault?: number;
  isAvailable?: number;
  label?: string;
}

export function AreaCode() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    code: '',
    isDefault: 0,
    isAvailable: 1,
  });

  const openForm = (record?: AreaCodeItem) => {
    if (record) {
      setEditingId(record.id);
      setFormState({
        name: record.name || '',
        code: record.code || '',
        isDefault: record.isDefault ?? 0,
        isAvailable: record.isAvailable ?? 1,
      });
    } else {
      setEditingId(null);
      setFormState({ name: '', code: '', isDefault: 0, isAvailable: 1 });
    }
    setFormVisible(true);
  };

  const handleFormSubmit = async () => {
    if (!formState.name.trim()) {
      Toast.error(t('区号地区不能为空'));
      return;
    }
    if (!formState.code.trim()) {
      Toast.error(t('区号不能为空'));
      return;
    }
    setFormLoading(true);
    try {
      if (editingId) {
        await apiPost('/setting/areaCode/update', { id: editingId, ...formState });
        Toast.success(t('更新成功'));
      } else {
        await apiPost('/setting/areaCode/create', formState);
        Toast.success(t('创建成功'));
      }
      setFormVisible(false);
      setReloadKey((k) => k + 1);
    } catch (error) {
      // 明确报错，不再静默吞掉（否则接口失败时弹窗看起来像「点不动」）
      Toast.error(error instanceof Error ? error.message : t('保存失败'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleFieldUpdate = async (row: AreaCodeItem, field: 'isDefault' | 'isAvailable', val: number) => {
    // updateField 白名单：code / name / isAvailable / isDefault
    await apiPost('/setting/areaCode/updateField', { id: row.id, field, val });
    Toast.success(t('操作成功'));
    setReloadKey((k) => k + 1);
  };

  const handleDelete = async (id: number) => {
    // 旧版 DeleteRecord → /setting/areaCode/del {id}（OperateDTO 单主键）
    await apiPost('/setting/areaCode/del', { id });
    Toast.success(t('删除成功'));
    setReloadKey((k) => k + 1);
  };

  const handleBatchDelete = async (ids: number[]) => {
    // batch 仅支持 del：{ids, type: 'del'}
    await apiPost('/setting/areaCode/batch', { type: 'del', ids });
    Toast.success(t('删除成功'));
    setReloadKey((k) => k + 1);
  };

  const columns: ColumnConfig<AreaCodeItem>[] = [
    {
      title: '区号地区',
      dataIndex: 'name',
      width: 150,
      render: (val: any, row: AreaCodeItem) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {row.isDefault === 1 && <Tag color="blue">{t('默认')}</Tag>}
          <span>{val || '--'}</span>
        </div>
      ),
    },
    {
      title: '区号',
      dataIndex: 'code',
      width: 200,
    },
    {
      title: '是否默认',
      dataIndex: 'isDefault',
      width: 100,
      render: (val: any, row: AreaCodeItem) => (
        <Switch
          checked={val === 1}
          onChange={(c) => handleFieldUpdate(row, 'isDefault', c ? 1 : 0)}
        />
      ),
    },
    {
      title: '是否启用',
      dataIndex: 'isAvailable',
      width: 100,
      render: (val: any, row: AreaCodeItem) => (
        <Switch
          checked={val === 1}
          onChange={(c) => handleFieldUpdate(row, 'isAvailable', c ? 1 : 0)}
        />
      ),
    },
    {
      title: '操作',
      width: 140,
      render: (_: any, record: AreaCodeItem) => (
        <Space>
          <Button
            theme="borderless"
            type="primary"
            size="small"
            onClick={() => openForm(record)}
          >
            {t('编辑')}
          </Button>
          <Popconfirm
            title={t('您确认要删除所选数据吗？')}
            okType="danger"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button theme="borderless" type="danger" size="small">
              {t('删除')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <ListPage<AreaCodeItem>
        key={reloadKey}
        api="/setting/areaCode/list"
        rowKey="id"
        columns={columns}
        selectable
        batchActions={(rows: AreaCodeItem[], clear: () => void) => (
          <Popconfirm
            title={t('您确认要批量删除所选数据吗？')}
            okType="danger"
            onConfirm={async () => {
              await handleBatchDelete(rows.map((r) => r.id));
              clear();
            }}
          >
            <Button type="danger" size="small">
              {t('批量删除')} ({rows.length})
            </Button>
          </Popconfirm>
        )}
        toolbarExtra={
          <Button icon={<IconPlus />} type="primary" onClick={() => openForm()}>
            {t('添加区号')}
          </Button>
        }
        filters={[
          {
            field: 'name',
            label: '区号地区',
            placeholder: '请输入区号地区名称',
            type: 'input',
          },
        ]}
      />

      <Modal
        title={editingId ? t('编辑区号') : t('添加区号')}
        visible={formVisible}
        onCancel={() => setFormVisible(false)}
        onOk={handleFormSubmit}
        confirmLoading={formLoading}
        width={600}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('区号地区')}</div>
            <Input
              maxLength={60}
              value={formState.name}
              onChange={(val) => setFormState({ ...formState, name: val })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('区号')}</div>
            <Input
              maxLength={60}
              value={formState.code}
              onChange={(val) => setFormState({ ...formState, code: val })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('是否默认')}</div>
            <RadioGroup
              value={formState.isDefault}
              onChange={(e) => setFormState({ ...formState, isDefault: Number(e.target.value) })}
            >
              <Radio value={1}>{t('是')}</Radio>
              <Radio value={0}>{t('否')}</Radio>
            </RadioGroup>
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('是否启用')}</div>
            <RadioGroup
              value={formState.isAvailable}
              onChange={(e) => setFormState({ ...formState, isAvailable: Number(e.target.value) })}
            >
              <Radio value={1}>{t('是')}</Radio>
              <Radio value={0}>{t('否')}</Radio>
            </RadioGroup>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// width: 580

/* ==================================================================
   6. 图片智能处理/AI设置 (AiImageSetting / aiImageSetting)
================================================================== */
export function AiImageSetting() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    aiImageEnabled: 0,
    provider: 'default',
    apiKey: '',
    apiSecret: '',
  });

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await apiGet<any>('/setting/config/aiImageSettings');
      if (res) setConfig((c) => ({ ...c, ...res }));
    } catch {
      // keep default
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPost('/setting/config/saveAiImage', config);
      Toast.success(t('配置已保存'));
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={t('图片智能处理 / AI翻译设置')} loading={loading}>
      <div style={{ maxWidth: 650, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('启用图片AI翻译与消除')}</div>
          <Switch
            checked={config.aiImageEnabled === 1}
            onChange={(c) => setConfig({ ...config, aiImageEnabled: c ? 1 : 0 })}
          />
        </div>

        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('服务提供商')}</div>
          <Select
            style={{ width: '100%' }}
            value={config.provider}
            onChange={(val) => setConfig({ ...config, provider: String(val) })}
          >
            <Select.Option value="default">{t('系统默认 AI 引擎')}</Select.Option>
            <Select.Option value="aliyun">{t('阿里云视觉智能')}</Select.Option>
            <Select.Option value="tencent">{t('腾讯云智能图像')}</Select.Option>
          </Select>
        </div>

        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>API Key</div>
          <Input
            placeholder={t('请输入服务 API Key')}
            value={config.apiKey}
            onChange={(val) => setConfig({ ...config, apiKey: val })}
          />
        </div>

        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>API Secret</div>
          <Input
            type="password"
            placeholder={t('请输入服务 API Secret')}
            value={config.apiSecret}
            onChange={(val) => setConfig({ ...config, apiSecret: val })}
          />
        </div>

        <div>
          <Button theme="solid" type="primary" loading={saving} onClick={handleSave}>
            {t('保存设置')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
