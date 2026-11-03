import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Input,
  Select,
  Space,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { apiGet, apiPost, getToken } from '../api';
import { useI18n } from '../i18n';

const { Text } = Typography;

interface ExportItem {
  key: string;
  value: string;
}

const ORDER_STATUS_OPTIONS = [
  { label: '待付款', value: 0 },
  { label: '待发货', value: 1 },
  { label: '已发货', value: 2 },
  { label: '已取消', value: 3 },
  { label: '无效', value: 4 },
  { label: '已完成', value: 5 },
];

const PAY_STATUS_OPTIONS = [
  { label: '未付款', value: 0 },
  { label: '支付中', value: 1 },
  { label: '已付款', value: 2 },
  { label: '退货中', value: 3 },
  { label: '已退款', value: 4 },
];

const SHIPPING_STATUS_OPTIONS = [
  { label: '待发货', value: 0 },
  { label: '已发货', value: 1 },
  { label: '已收货', value: 2 },
  { label: '配送中', value: 3 },
  { label: '配送失败', value: 4 },
];

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

/** 后端导出字段值可能为字符串或 {key,label} 对象，统一归一化为展示文本。 */
const toExportItems = (source: Record<string, unknown>) =>
  Object.entries(source || {}).map(([key, value]) => ({
    key,
    value:
      typeof value === 'string'
        ? value
        : String((value as { label?: string; value?: string })?.label ?? key),
  }));

/** 订单导出：对应旧版 order/orderExport/List.vue，可自定义导出字段并保存常用配置。 */
export default function OrderExport() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<ExportItem[]>([]);
  const [available, setAvailable] = useState<ExportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<Record<string, any>>({
    keyword: '',
    orderStatus: undefined,
    payStatus: undefined,
    shippingStatus: undefined,
    address: '',
    email: '',
    mobile: '',
    logisticsId: undefined,
    addStartTime: formatDate(new Date(Date.now() - 15 * 24 * 3600 * 1000)),
    addEndTime: formatDate(new Date()),
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      apiGet<Record<string, string>>('/order/order/getExportItemList'),
      apiGet<Record<string, string>>('/order/order/exportItemInfo'),
    ])
      .then(([all, info]) => {
        if (!alive) return;
        const allItems = toExportItems(all || {});
        const infoItems = toExportItems(info || {});
        setSelected(infoItems);
        setAvailable(allItems.filter((item) => !infoItems.some((info) => info.key === item.key)));
      })
      .catch((error) => alive && Toast.error({ content: error.message }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const addTag = (item: ExportItem) => {
    setSelected((current) => [...current, item]);
    setAvailable((current) => current.filter((entry) => entry.key !== item.key));
  };

  const closeTag = (item: ExportItem) => {
    setSelected((current) => current.filter((entry) => entry.key !== item.key));
    setAvailable((current) => [...current, item]);
  };

  const emptyTag = () => {
    setAvailable((current) => [...current, ...selected]);
    setSelected([]);
  };

  const saveTag = async () => {
    if (!selected.length) return;
    try {
      await apiPost('/order/order/saveExportItem', {
        exportItem: selected.map((item) => item.key).join(','),
      });
      Toast.success({ content: t('操作成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    }
  };

  const orderExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
      });
      params.set('exportItem', selected.map((item) => item.key).join(','));
      const res = await fetch(`/adminapi/order/order/orderExport?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = t('导出订单.xlsx');
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('导出失败') });
    } finally {
      setExporting(false);
    }
  };

  const localizeOptions = (options: typeof ORDER_STATUS_OPTIONS) =>
    options.map((option) => ({ ...option, label: t(option.label) }));

  return (
    <div className="order-export-page">
      <Card shadows="hover" loading={loading}>
        <div className="order-export-notice">
          <p>{t('提示：')}</p>
          <p>{t('1、如果数据量过大导至查询时间过久或者直接显示超时报错，请尝试缩小查询的时间间隔！')}</p>
          <p>{t('2、可通过单击可增加项和导出项目来选择需要导出的参数，也可通过拖拽项目来调整参数排序（商品信息栏目默认在单行最后）')}</p>
        </div>

        <Space wrap>
          <Input
            prefix={<IconSearch />}
            placeholder={t('订单号/收货人姓名/商品名称')}
            value={filters.keyword}
            onChange={(next) => setFilters((c) => ({ ...c, keyword: next }))}
            style={{ width: 240 }}
          />
          <Select
            placeholder={t('请选择支付状态')}
            value={filters.orderStatus}
            optionList={localizeOptions(ORDER_STATUS_OPTIONS)}
            onChange={(next) => setFilters((c) => ({ ...c, orderStatus: next }))}
            style={{ width: 150 }}
            showClear
          />
          <Select
            placeholder={t('支付状态')}
            value={filters.payStatus}
            optionList={localizeOptions(PAY_STATUS_OPTIONS)}
            onChange={(next) => setFilters((c) => ({ ...c, payStatus: next }))}
            style={{ width: 140 }}
            showClear
          />
          <Select
            placeholder={t('发货状态')}
            value={filters.shippingStatus}
            optionList={localizeOptions(SHIPPING_STATUS_OPTIONS)}
            onChange={(next) => setFilters((c) => ({ ...c, shippingStatus: next }))}
            style={{ width: 140 }}
            showClear
          />
          <Input
            placeholder={t('详细地址')}
            value={filters.address}
            onChange={(next) => setFilters((c) => ({ ...c, address: next }))}
            style={{ width: 160 }}
          />
          <Input
            placeholder="Email"
            value={filters.email}
            onChange={(next) => setFilters((c) => ({ ...c, email: next }))}
            style={{ width: 150 }}
          />
          <Input
            placeholder={t('手机号')}
            value={filters.mobile}
            onChange={(next) => setFilters((c) => ({ ...c, mobile: next }))}
            style={{ width: 150 }}
          />
          <DatePicker
            type="dateRange"
            value={[filters.addStartTime, filters.addEndTime] as never}
            onChange={(next) => {
              const range = (next as string[]) || [];
              setFilters((c) => ({ ...c, addStartTime: range[0] || '', addEndTime: range[1] || '' }));
            }}
            style={{ width: 260 }}
          />
        </Space>

        <div className="order-export-section">
          <div className="order-export-section-head">
            <Text strong>{t('导出项目')}</Text>
            <Space>
              <Button size="small" onClick={saveTag}>
                {t('保存')}
              </Button>
              <Button size="small" onClick={emptyTag}>
                {t('清空')}
              </Button>
            </Space>
          </div>
          <div className="order-export-tags">
            {selected.length ? (
              selected.map((item) => (
                <Tag
                  key={item.key}
                  size="large"
                  color="grey"
                  closable
                  onClose={() => closeTag(item)}
                >
                  {item.value}
                </Tag>
              ))
            ) : (
              <Text type="tertiary">{t('尚未选择导出字段，请从下方可增加项中选取')}</Text>
            )}
          </div>
        </div>

        <div className="order-export-section">
          <Text strong>{t('可增加项')}</Text>
          <div className="order-export-tags">
            {available.map((item) => (
              <Tag key={item.key} size="large" color="grey" onClick={() => addTag(item)}>
                {item.value}
              </Tag>
            ))}
          </div>
        </div>

        <Button
          theme="solid"
          type="primary"
          loading={exporting}
          disabled={!selected.length}
          onClick={orderExport}
        >
          {t('导出EXCEL')}
        </Button>
      </Card>
    </div>
  );
}
