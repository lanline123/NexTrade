import { useEffect, useState, type ReactNode } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import OrderDetailModal from '../components/OrderDetailModal';

const { Text } = Typography;

interface AftersalesItem {
  itemId?: number;
  productId: number;
  productName: string;
  picThumb?: string;
  price: string | number;
  quantity: number;
  number?: number;
}

interface AftersalesRow {
  aftersaleId: number;
  aftersalesSn: string;
  orderSn: string;
  orderId?: number;
  outTradeNo?: string;
  addTime: string;
  shippingTime?: string;
  userName?: string;
  aftersaleType: number;
  aftersalesTypeName?: string;
  aftersaleReason?: string;
  status: number;
  statusName?: string;
  returnAddress?: string;
  mark?: number;
  aftersalesItems: AftersalesItem[];
}

interface HandleTarget {
  row: AftersalesRow;
  status: 2 | 3;
}

const STATUS_COLORS: Record<number, 'orange' | 'black' | 'grey' | 'green' | 'blue'> = {
  0: 'orange',
  1: 'black',
  2: 'black',
  3: 'grey',
  4: 'black',
  5: 'green',
};

const money = (value: unknown) => `¥${Number(value || 0).toFixed(2)}`;

const toOptions = (source: Record<string, string> | undefined) =>
  Object.entries(source || {}).map(([value, label]) => ({ label: String(label), value: Number(value) }));

/** 售后申请：对应旧版 order/aftersales/List.vue。 */
export default function AftersalesOrders() {
  const { t } = useI18n();
  const [rows, setRows] = useState<AftersalesRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState<Record<string, any>>({
    keyword: '',
    outTradeNo: '',
    aftersalesSn: '',
    aftersaleType: '',
    status: '',
  });
  const [typeOptions, setTypeOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [statusOptions, setStatusOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [detailId, setDetailId] = useState<number | undefined>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [aftersaleDetail, setAftersaleDetail] = useState<AftersalesRow | null>(null);
  const [aftersaleDetailOpen, setAftersaleDetailOpen] = useState(false);
  const [markTarget, setMarkTarget] = useState<number | null>(null);
  const [markForm, setMarkForm] = useState<{ mark: number; adminNote: string }>({ mark: 0, adminNote: '' });
  const [handleTarget, setHandleTarget] = useState<HandleTarget | null>(null);
  const [handleForm, setHandleForm] = useState<{ refundAmount: number | null; returnAddress: string; reply: string }>({
    refundAmount: null,
    returnAddress: '',
    reply: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<{ records: AftersalesRow[]; total: number }>('/order/aftersales/list', {
      page,
      size: 10,
      sortField: 'orderId',
      sortOrder: 'desc',
      ...filters,
    })
      .then((result) => {
        if (!alive) return;
        setRows(result.records || []);
        setTotal(result.total || 0);
      })
      .catch((error) => alive && Toast.error({ content: error.message }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, reloadKey]);

  useEffect(() => {
    apiGet<Record<string, string>>('/order/aftersales/applyType')
      .then((result) => setTypeOptions(toOptions(result)))
      .catch(() => undefined);
    apiGet<Record<string, string>>('/order/aftersales/returnGoodsStatus')
      .then((result) => setStatusOptions(toOptions(result)))
      .catch(() => undefined);
  }, []);

  const search = () => {
    setPage(1);
    setReloadKey((key) => key + 1);
  };

  const reset = () => {
    setFilters({ keyword: '', outTradeNo: '', aftersalesSn: '', aftersaleType: '', status: '' });
    setPage(1);
    setReloadKey((key) => key + 1);
  };

  const reload = () => setReloadKey((key) => key + 1);

  const submitMark = async () => {
    if (!markTarget) return;
    setSaving(true);
    try {
      await apiPost('/order/order/setAdminNote', { id: markTarget, ...markForm });
      Toast.success({ content: t('操作成功') });
      setMarkTarget(null);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    } finally {
      setSaving(false);
    }
  };

  const openHandle = (row: AftersalesRow, status: 2 | 3) => {
    setHandleForm({
      refundAmount: Number(
        (row.aftersalesItems || []).reduce(
          (sum, item) => sum + Number(item.price || 0) * Number(item.number ?? item.quantity ?? 0),
          0,
        ),
      ),
      returnAddress: row.returnAddress || '',
      reply: '',
    });
    setHandleTarget({ row, status });
  };

  const submitHandle = async () => {
    if (!handleTarget) return;
    const { row, status } = handleTarget;
    if (status === 2 && row.aftersaleType === 1 && !handleForm.returnAddress.trim()) {
      Toast.error({ content: t('退货地址不能为空') });
      return;
    }
    if (status === 3 && !handleForm.reply.trim()) {
      Toast.error({ content: t('拒绝说明不能为空') });
      return;
    }
    setSaving(true);
    try {
      await apiPost('/order/aftersales/update', {
        id: row.aftersaleId,
        status,
        refundAmount: handleForm.refundAmount ?? 0,
        returnAddress: handleForm.returnAddress,
        reply: handleForm.reply,
      });
      Toast.success({ content: t('操作成功') });
      setHandleTarget(null);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    } finally {
      setSaving(false);
    }
  };

  const receiveAction = (row: AftersalesRow, action: 'receive' | 'rejectReceive', title: string) => {
    Modal.confirm({
      title,
      onOk: async () => {
        try {
          await apiPost(`/order/aftersales/${action}`, { id: row.aftersaleId });
          Toast.success({ content: t('操作成功') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
        }
      },
    });
  };

  const renderRow = (row: AftersalesRow): ReactNode => {
    const canHandle = row.status === 1;
    const canConfirmReceipt = row.aftersaleType === 1 && row.status === 5;
    return (
      <Card className="aftersales-card" key={row.aftersaleId} shadows="hover">
        <div className="aftersales-head">
          <span className="aftersales-sn">{t('订单编号：')}{row.orderSn}</span>
          {row.outTradeNo ? <span className="aftersales-sn">{t('交易单号：')}{row.outTradeNo}</span> : null}
          <span className="aftersales-sn">{t('售后编号：')}{row.aftersalesSn}</span>
          <span className="aftersales-sn">{t('申请时间：')}{row.addTime}</span>
          {row.shippingTime ? <span className="aftersales-sn">{t('发货时间：')}{row.shippingTime}</span> : null}
          {row.userName ? <span className="aftersales-sn">{t('申请人：')}{row.userName}</span> : null}
          <div className="aftersales-head-actions">
            <Button
              theme="borderless"
              size="small"
              onClick={async () => {
                try {
                  const detail = await apiGet<AftersalesRow>('/order/aftersales/detail', {
                    id: row.aftersaleId,
                  });
                  setAftersaleDetail(detail || row);
                  setAftersaleDetailOpen(true);
                } catch (error) {
                  Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
                }
              }}
            >
              {t('售后详情')}
            </Button>
            {row.orderId ? (
              <Button
                theme="borderless"
                size="small"
                onClick={() => {
                  setDetailId(row.orderId);
                  setDetailOpen(true);
                }}
              >
                {t('订单详情')}
              </Button>
            ) : null}
            {row.orderId ? (
              <Button
                theme="borderless"
                size="small"
                onClick={() => {
                  setMarkForm({ mark: row.mark || 0, adminNote: '' });
                  setMarkTarget(row.orderId!);
                }}
              >
                {t('标记')}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="aftersales-body">
          <Table
            size="small"
            pagination={false}
            rowKey={(item?: AftersalesItem) => String(item?.itemId || item?.productId)}
            dataSource={row.aftersalesItems || []}
            columns={[
              {
                title: t('退换货商品'),
                dataIndex: 'productName',
                render: (_: unknown, item: AftersalesItem) => (
                  <div className="aftersales-product">
                    {item.picThumb ? <img src={item.picThumb} alt="" width={36} height={36} /> : null}
                    <span>{item.productName}</span>
                  </div>
                ),
              },
              {
                title: t('价格/数量'),
                dataIndex: 'price',
                width: 220,
                render: (_: unknown, item: AftersalesItem) => (
                  <div className="aftersales-right">
                    <div>{money(item.price)}</div>
                    <Text type="tertiary" size="small">
                      × {item.quantity}
                      <span className="aftersales-return-count">({t('退货数量：')}{item.number ?? item.quantity})</span>
                    </Text>
                  </div>
                ),
              },
            ]}
          />
          <div className="aftersales-info">
            <div className="aftersales-cell">
              <span>{row.aftersaleReason || '-'}</span>
            </div>
            <div className="aftersales-cell">
              <span>{row.aftersalesTypeName || '-'}</span>
            </div>
            <div className="aftersales-cell">
              <Tag color={(STATUS_COLORS[row.status] || 'blue') as never}>{row.statusName || '-'}</Tag>
            </div>
            <div className="aftersales-cell aftersales-actions">
              {row.aftersaleType === 1 && canHandle ? (
                <Button type="danger" theme="borderless" size="small" onClick={() => openHandle(row, 2)}>
                  {t('同意退货退款')}
                </Button>
              ) : null}
              {row.aftersaleType === 1 && canHandle ? (
                <Button theme="borderless" size="small" onClick={() => openHandle(row, 3)}>
                  {t('拒绝退货退款')}
                </Button>
              ) : null}
              {row.aftersaleType === 2 && canHandle ? (
                <Button type="danger" theme="borderless" size="small" onClick={() => openHandle(row, 2)}>
                  {t('同意仅退款')}
                </Button>
              ) : null}
              {row.aftersaleType === 2 && canHandle ? (
                <Button theme="borderless" size="small" onClick={() => openHandle(row, 3)}>
                  {t('拒绝仅退款')}
                </Button>
              ) : null}
              {canConfirmReceipt ? (
                <Button
                  type="danger"
                  theme="borderless"
                  size="small"
                  onClick={() => receiveAction(row, 'receive', t('确认收货'))}
                >
                  {t('确认收货')}
                </Button>
              ) : null}
              {canConfirmReceipt ? (
                <Button theme="borderless" size="small" onClick={() => receiveAction(row, 'rejectReceive', t('拒收商品'))}>
                  {t('拒收')}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="aftersales-page">
      <Card shadows="hover">
        <Space wrap>
          <Input
            prefix={<IconSearch />}
            placeholder={t('订单号')}
            value={filters.keyword}
            onChange={(next) => setFilters((c) => ({ ...c, keyword: next }))}
            onEnterPress={search}
            style={{ width: 200 }}
          />
          <Input
            placeholder={t('交易单号')}
            value={filters.outTradeNo}
            onChange={(next) => setFilters((c) => ({ ...c, outTradeNo: next }))}
            style={{ width: 180 }}
          />
          <Input
            placeholder={t('售后编号')}
            value={filters.aftersalesSn}
            onChange={(next) => setFilters((c) => ({ ...c, aftersalesSn: next }))}
            style={{ width: 180 }}
          />
          <Select
            placeholder={t('申请类型')}
            value={filters.aftersaleType === '' ? undefined : filters.aftersaleType}
            optionList={typeOptions}
            onChange={(next) => setFilters((c) => ({ ...c, aftersaleType: next ?? '' }))}
            style={{ width: 140 }}
            showClear
          />
          <Select
            placeholder={t('退换状态')}
            value={filters.status === '' ? undefined : filters.status}
            optionList={statusOptions}
            onChange={(next) => setFilters((c) => ({ ...c, status: next ?? '' }))}
            style={{ width: 140 }}
            showClear
          />
          <Button theme="solid" type="primary" icon={<IconSearch />} onClick={search}>
            {t('搜索')}
          </Button>
          <Button onClick={reset}>{t('重置')}</Button>
          <Button icon={<IconRefresh />} onClick={reload}>
            {t('刷新')}
          </Button>
        </Space>

        <Spin spinning={loading}>
          {rows.map((row) => renderRow(row))}
          {rows.length === 0 && !loading ? <div className="aftersales-empty">{t('暂无数据')}</div> : null}
        </Spin>

        <div className="aftersales-pagination">
          <Space>
            <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('上一页')}
            </Button>
            <span>
              {t('第 {page} / {pages} 页，共 {total} 条', {
                page,
                pages: Math.max(1, Math.ceil(total / 10)),
                total,
              })}
            </span>
            <Button disabled={page >= Math.ceil(total / 10)} onClick={() => setPage((p) => p + 1)}>
              {t('下一页')}
            </Button>
          </Space>
        </div>
      </Card>

      <OrderDetailModal
        visible={detailOpen}
        orderId={detailId}
        onCancel={() => setDetailOpen(false)}
        onChanged={reload}
      />

      <Modal
        title={aftersaleDetail ? `${t('售后详情')} ${aftersaleDetail.aftersalesSn}` : t('售后详情')}
        visible={aftersaleDetailOpen}
        footer={null}
        onCancel={() => setAftersaleDetailOpen(false)}
        width={640}
      >
        {aftersaleDetail ? (
          <div className="aftersales-detail">
            <div className="aftersales-detail-row">
              <label>{t('订单编号')}</label>
              <span>{aftersaleDetail.orderSn}</span>
            </div>
            <div className="aftersales-detail-row">
              <label>{t('售后编号')}</label>
              <span>{aftersaleDetail.aftersalesSn}</span>
            </div>
            <div className="aftersales-detail-row">
              <label>{t('服务类型')}</label>
              <span>{aftersaleDetail.aftersalesTypeName || '-'}</span>
            </div>
            <div className="aftersales-detail-row">
              <label>{t('售后状态')}</label>
              <span>{aftersaleDetail.statusName || '-'}</span>
            </div>
            <div className="aftersales-detail-row">
              <label>{t('售后原因')}</label>
              <span>{aftersaleDetail.aftersaleReason || '-'}</span>
            </div>
            {(aftersaleDetail.aftersalesItems || []).map((item) => (
              <div className="aftersales-detail-row" key={item.itemId || item.productId}>
                <label>{t('退换商品')}</label>
                <span>
                  {item.productName} × {item.quantity}（{t('退货数量：')}{item.number ?? item.quantity}）
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </Modal>

      <Modal
        title={t('添加标记')}
        visible={Boolean(markTarget)}
        confirmLoading={saving}
        onOk={submitMark}
        onCancel={() => setMarkTarget(null)}
      >
        <div className="aftersales-form">
          <label>{t('标记')}</label>
          <Space wrap>
            <Checkbox checked={markForm.mark === 0} onChange={(e) => setMarkForm((c) => ({ ...c, mark: 0 }))}>
              {t('无标记')}
            </Checkbox>
            {[1, 2, 3, 4, 5].map((value) => (
              <Checkbox
                key={value}
                checked={markForm.mark === value}
                onChange={(e) => setMarkForm((c) => ({ ...c, mark: e.target.checked ? value : 0 }))}
              >
                {t('标记{n}', { n: value })}
              </Checkbox>
            ))}
          </Space>
          <label>{t('备注')}</label>
          <TextArea
            value={markForm.adminNote}
            onChange={(next) => setMarkForm((c) => ({ ...c, adminNote: next }))}
            placeholder={t('商家备注')}
          />
        </div>
      </Modal>

      <Modal
        title={
          handleTarget
            ? handleTarget.status === 2
              ? handleTarget.row.aftersaleType === 1
                ? t('同意退货退款')
                : t('同意仅退款')
              : t('拒绝退款')
            : t('处理售后')
        }
        visible={Boolean(handleTarget)}
        confirmLoading={saving}
        onOk={submitHandle}
        onCancel={() => setHandleTarget(null)}
      >
        {handleTarget?.status === 2 ? (
          <div className="aftersales-form">
            <label>{t('退款金额')}</label>
            <InputNumber
              style={{ width: 200 }}
              min={0}
              value={handleForm.refundAmount ?? 0}
              onChange={(next) => setHandleForm((c) => ({ ...c, refundAmount: Number(next ?? 0) }))}
            />
            {handleTarget.row.aftersaleType === 1 ? (
              <>
                <label>{t('退货地址')}</label>
                <TextArea
                  value={handleForm.returnAddress}
                  onChange={(next) => setHandleForm((c) => ({ ...c, returnAddress: next }))}
                  placeholder={t('请输入退货地址')}
                />
              </>
            ) : null}
            <p className="aftersales-muted">
              {t('提交后按"同意并发送退货地址"处理，用户将收到退货地址与退款金额。')}
            </p>
          </div>
        ) : (
          <div className="aftersales-form">
            <label>{t('拒绝说明')}</label>
            {/* 快捷拒绝理由（对齐旧版 RejectReceive：formData.refuseReason 服务端下发） */}
            {Array.isArray((handleTarget?.row as any)?.refuseReason) &&
              ((handleTarget?.row as any).refuseReason as string[]).length > 0 && (
                <Space wrap style={{ marginBottom: 8 }}>
                  {((handleTarget?.row as any).refuseReason as string[]).map((phrase) => (
                    <Tag
                      key={phrase}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setHandleForm((c) => ({ ...c, reply: phrase }))}
                    >
                      {phrase}
                    </Tag>
                  ))}
                </Space>
              )}
            <TextArea
              value={handleForm.reply}
              onChange={(next) => setHandleForm((c) => ({ ...c, reply: next }))}
              placeholder={t('请输入拒绝说明')}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
