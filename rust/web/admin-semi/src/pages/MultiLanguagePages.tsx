import React, { useState, useEffect } from 'react';
import {
  Button,
  Card,
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
  TabPane,
  Tabs,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconPlus, IconRefresh } from '@douyinfe/semi-icons';
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
    syncIntervalHours: 24,
    lastSyncTime: '',
  });

  // 国际通用代号数据源：后端币种字典（原版 getCurrencyDictionary），失败时回退为手输
  const [dictionary, setDictionary] = useState<CurrencyDictionaryItem[]>([]);
  const [dictFailed, setDictFailed] = useState(false);

  const loadRateConfig = async () => {
    try {
      const res = await apiGet<any>('/lang/currency/exchangeRateConfig');
      if (res) setRateConfig(res);
    } catch {
      // keep
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
      <Card
        title={t('汇率自动同步设置')}
        headerExtraContent={
          <Button
            icon={<IconRefresh />}
            size="small"
            onClick={async () => {
              await apiPost('/lang/currency/syncExchangeRateNow', {});
              Toast.success(t('汇率拉取已触发'));
              setReloadKey((k) => k + 1);
            }}
          >
            {t('立即更新汇率')}
          </Button>
        }
      >
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div>
            <span>{t('自动同步：')}</span>
            <Switch
              checked={rateConfig.autoSync === 1}
              onChange={async (c) => {
                const next = { ...rateConfig, autoSync: c ? 1 : 0 };
                setRateConfig(next);
                await apiPost('/lang/currency/saveExchangeRateConfig', next);
                Toast.success(t('配置已保存'));
              }}
            />
          </div>
          <div>{t('上次同步时间')}: {rateConfig.lastSyncTime || t('尚未同步')}</div>
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
================================================================== */
interface TranslationItem {
  id: number;
  translationName: string;
  dataType: number; // 0: 页面文字, 1: 接口文字, 2: 业务数据
  tdata?: Array<{ localeId: number; translationValue: string }>;
}

export function TranslationContent() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [dataType, setDataType] = useState<number>(0);
  const [formVisible, setFormVisible] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formState, setFormState] = useState({
    translationName: '',
    dataType: 0,
  });

  const openForm = (record?: TranslationItem) => {
    if (record) {
      setEditingId(record.id);
      setFormState({
        translationName: record.translationName,
        dataType: record.dataType,
      });
    } else {
      setEditingId(null);
      setFormState({ translationName: '', dataType });
    }
    setFormVisible(true);
  };

  const handleFormSubmit = async () => {
    if (!formState.translationName.trim()) {
      Toast.error(t('原句不能为空'));
      return;
    }
    setFormLoading(true);
    try {
      if (editingId) {
        await apiPost('/lang/translations/update', { id: editingId, ...formState });
        Toast.success(t('更新成功'));
      } else {
        await apiPost('/lang/translations/create', formState);
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
    await apiPost('/lang/translations/batch', { type: 'del', ids });
    Toast.success(t('删除成功'));
    setReloadKey((k) => k + 1);
  };

  const columns: ColumnConfig<TranslationItem>[] = [
    {
      title: '原句',
      dataIndex: 'translationName',
      render: (val: any) => <span style={{ fontWeight: 500 }}>{val || '--'}</span>,
    },
    {
      title: '翻译类型',
      dataIndex: 'dataType',
      width: 140,
      render: (val: any) => (val === 0 ? t('页面文字') : val === 1 ? t('接口文字') : t('数据维护')),
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

      <ListPage<TranslationItem>
        key={`${dataType}-${reloadKey}`}
        api="/lang/translations/list"
        query={{ dataType }}
        rowKey="id"
        columns={columns}
        selectable
        batchActions={(rows: TranslationItem[], clear: () => void) => (
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
                await apiPost('/lang/translations/batchCreateTranslations', {
                  ids: rows.map((r) => r.id),
                });
                Toast.success(t('已触发批量翻译'));
                clear();
              }}
            >
              {t('批量翻译')}
            </Button>
          </Space>
        )}
        toolbarExtra={
          <Button icon={<IconPlus />} type="primary" onClick={() => openForm()}>
            {t('添加语句')}
          </Button>
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

      <Modal
        title={editingId ? t('编辑语句') : t('添加语句')}
        visible={formVisible}
        onCancel={() => setFormVisible(false)}
        onOk={handleFormSubmit}
        confirmLoading={formLoading}
        width={700}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('原句')}</div>
            <TextArea
              rows={4}
              placeholder={t('请输入需要翻译的原语句')}
              value={formState.translationName}
              onChange={(val) => setFormState({ ...formState, translationName: val })}
            />
          </div>
        </div>
      </Modal>
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
================================================================== */
interface AreaCodeItem {
  id: number;
  areaCode: string;
  areaName: string;
  englishName?: string;
  twoLetterCode?: string;
  threeLetterCode?: string;
  sortOrder?: number;
  status?: number;
}

export function AreaCode() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formState, setFormState] = useState({
    areaCode: '',
    areaName: '',
    englishName: '',
    twoLetterCode: '',
    threeLetterCode: '',
    sortOrder: 50,
    status: 1,
  });

  const openForm = (record?: AreaCodeItem) => {
    if (record) {
      setEditingId(record.id);
      setFormState({
        areaCode: record.areaCode,
        areaName: record.areaName,
        englishName: record.englishName || '',
        twoLetterCode: record.twoLetterCode || '',
        threeLetterCode: record.threeLetterCode || '',
        sortOrder: record.sortOrder ?? 50,
        status: record.status ?? 1,
      });
    } else {
      setEditingId(null);
      setFormState({
        areaCode: '',
        areaName: '',
        englishName: '',
        twoLetterCode: '',
        threeLetterCode: '',
        sortOrder: 50,
        status: 1,
      });
    }
    setFormVisible(true);
  };

  const handleFormSubmit = async () => {
    if (!formState.areaCode.trim() || !formState.areaName.trim()) {
      Toast.error(t('区号和地区名称不能为空'));
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
    } catch {
      // handled
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (ids: number[]) => {
    await apiPost('/setting/areaCode/batch', { type: 'del', ids });
    Toast.success(t('删除成功'));
    setReloadKey((k) => k + 1);
  };

  const columns: ColumnConfig<AreaCodeItem>[] = [
    {
      title: '区号',
      dataIndex: 'areaCode',
      width: 120,
      render: (val: any) => <span style={{ fontWeight: 600 }}>{val}</span>,
    },
    {
      title: '国家/地区名称',
      dataIndex: 'areaName',
      width: 180,
    },
    {
      title: '英文名称',
      dataIndex: 'englishName',
      width: 180,
      render: (val: any) => val || '--',
    },
    {
      title: '二字码',
      dataIndex: 'twoLetterCode',
      width: 100,
      render: (val: any) => val || '--',
    },
    {
      title: '三字码',
      dataIndex: 'threeLetterCode',
      width: 100,
      render: (val: any) => val || '--',
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 90,
      render: (val: any) => val ?? 50,
    },
    {
      title: '是否启用',
      dataIndex: 'status',
      width: 100,
      render: (val: any, row: AreaCodeItem) => (
        <Switch
          checked={val === 1}
          onChange={async (c) => {
            await apiPost('/setting/areaCode/updateField', {
              id: row.id,
              field: 'status',
              val: c ? 1 : 0,
            });
            Toast.success(t('状态更新成功'));
            setReloadKey((k) => k + 1);
          }}
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
            {t('添加区号')}
          </Button>
        }
        filters={[
          {
            field: 'keyword',
            label: '区号/地区',
            placeholder: '输入区号或国家名称',
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
        width={580}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('区号')}</div>
            <Input
              placeholder={t('如：+86')}
              value={formState.areaCode}
              onChange={(val) => setFormState({ ...formState, areaCode: val })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('国家/地区名称')}</div>
            <Input
              placeholder={t('如：中国')}
              value={formState.areaName}
              onChange={(val) => setFormState({ ...formState, areaName: val })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('英文名称')}</div>
            <Input
              placeholder={t('如：China')}
              value={formState.englishName}
              onChange={(val) => setFormState({ ...formState, englishName: val })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('二字码')}</div>
            <Input
              placeholder={t('如：CN')}
              value={formState.twoLetterCode}
              onChange={(val) => setFormState({ ...formState, twoLetterCode: val })}
            />
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
