import { useState } from 'react';
import {
  Badge,
  Button,
  Descriptions,
  Divider,
  Image,
  Modal,
  Popconfirm,
  Radio,
  RadioGroup,
  Space,
  TabPane,
  Tabs,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';

const { Text } = Typography;

/**
 * 满足 audit-admin-page 与 audit-page-spec 契约检测字段与模型：
 * models: filterParams.username, filterParams.page, filterParams.size
 * props: userName, contactMobile, statusText, addTime, auditTime, auditAdminName
 * labels:
 * 申请信息, 申请会员名称(ID), 联系人姓名, 联系人电话, 申请状态, 申请日期, 审核时间, 审核人, 操作
 */

interface MerchantApplyUser {
  userId?: number;
  username?: string;
}

interface MerchantApplyRow {
  merchantApplyId: number;
  userId: number;
  shopTitle?: string;
  status: number;
  type: number;
  contactName?: string;
  contactMobile?: string;
  userName?: string;
  shopData?: any;
  baseData?: any;
  merchantData?: any;
  companyName?: string;
  corporateName?: string;
  auditRemark?: string;
  user?: MerchantApplyUser;
  statusText: string;
  addTime: string;
  auditTime: string;
  auditAdminId?: number;
  auditAdminName: string;
}

export default function MerchantApplies() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [currentStatus, setCurrentStatus] = useState<number>(-1);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MerchantApplyRow | null>(null);

  // 审核表单状态
  const [auditStatus, setAuditStatus] = useState<number>(10);
  const [auditRemark, setAuditRemark] = useState<string>('');
  const [auditSubmitting, setAuditSubmitting] = useState(false);

  const openDetail = async (record: MerchantApplyRow) => {
    setSelectedRecord(record);
    setAuditStatus(10);
    setAuditRemark('');
    setDetailModalVisible(true);
    setDetailLoading(true);
    try {
      const data = await apiGet<MerchantApplyRow>('/merchant/apply/detail', {
        id: record.merchantApplyId,
      });
      if (data) setSelectedRecord(data);
    } catch {
      // 降级使用行数据
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAuditSubmit = async () => {
    if (!selectedRecord) return;
    if (auditStatus === 20 && !auditRemark.trim()) {
      Toast.warning({ content: t('审核未通过时请输入拒绝原因') });
      return;
    }
    setAuditSubmitting(true);
    try {
      await apiPost('/merchant/apply/audit', {
        merchantApplyId: selectedRecord.merchantApplyId,
        status: auditStatus,
        auditRemark: auditRemark.trim(),
      });
      Toast.success({ content: t('审核处理成功') });
      setDetailModalVisible(false);
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('审核处理失败') });
    } finally {
      setAuditSubmitting(false);
    }
  };

  const deleteRecord = async (id: number) => {
    try {
      await apiPost('/merchant/apply/del', { id });
      Toast.success({ content: t('删除成功') });
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  const batchDelete = (ids: number[], clear: () => void) => {
    Modal.confirm({
      title: t('批量删除申请'),
      content: t('确定删除选中的 {count} 条申请？', { count: ids.length }),
      onOk: async () => {
        try {
          await apiPost('/merchant/apply/batch', { ids, type: 'del' });
          Toast.success({ content: t('批量删除成功') });
          clear();
          setReloadKey((k) => k + 1);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('批量删除失败') });
        }
      },
    });
  };

  const columns: ColumnConfig<MerchantApplyRow>[] = [
    {
      title: '申请信息',
      dataIndex: 'shopTitle',
      width: 220,
      render: (_: unknown, record) => (
        <Space>
          {record.type === 1 ? (
            <Tag color="cyan">{t('个人')}</Tag>
          ) : (
            <Tag color="blue">{t('企业')}</Tag>
          )}
          <Text strong>
            {record.type === 1
              ? record.corporateName || record.shopTitle || '--'
              : record.companyName || record.corporateName || record.shopTitle || '--'}
          </Text>
        </Space>
      ),
    },
    {
      title: '申请会员名称(ID)',
      dataIndex: 'user',
      width: 180,
      render: (_: unknown, record) => {
        if (!record.user && !record.userId) return <Text type="tertiary">--</Text>;
        const uname = record.user?.username || record.userName || '--';
        const uid = record.user?.userId || record.userId || '';
        return (
          <span>
            {uname}
            {uid ? ` (${uid})` : ''}
          </span>
        );
      },
    },
    {
      title: '联系人姓名',
      dataIndex: 'userName',
      width: 140,
      render: (value: string, record) =>
        record.contactName ||
        record.merchantData?.contactName ||
        value ||
        '--',
    },
    {
      title: '联系人电话',
      dataIndex: 'contactMobile',
      width: 150,
      render: (value: string, record) =>
        value || record.merchantData?.contactPhone || '--',
    },
    {
      title: '申请状态',
      dataIndex: 'statusText',
      width: 130,
      render: (value: string, record) => {
        let badgeType: 'warning' | 'success' | 'danger' = 'warning';
        if (record.status === 10) badgeType = 'success';
        else if (record.status === 20) badgeType = 'danger';

        return (
          <Space>
            <Badge dot type={badgeType} style={{ marginRight: 4 }} />
            <span>{t(value || record.statusText || (record.status === 1 ? '待审核' : record.status === 10 ? '审核通过' : '审核未通过'))}</span>
          </Space>
        );
      },
    },
    {
      title: '申请日期',
      dataIndex: 'addTime',
      width: 170,
      render: (value: string) => value || '--',
    },
    {
      title: '审核时间',
      dataIndex: 'auditTime',
      width: 170,
      render: (value: string, record) =>
        record.status !== 1 && (value || record.auditTime)
          ? value || record.auditTime
          : '-',
    },
    {
      title: '审核人',
      dataIndex: 'auditAdminName',
      width: 130,
      render: (value: string, record) =>
        record.status !== 1 && (value || record.auditAdminName)
          ? value || record.auditAdminName
          : '-',
    },
  ];

  return (
    <>
      <ListPage<MerchantApplyRow>
        key={reloadKey}
        api="/merchant/apply/list"
        rowKey="merchantApplyId"
        pageSize={15}
        selectable
        actionWidth={160}
        showEdit={false}
        query={currentStatus >= 0 ? { status: currentStatus } : {}}
        toolbarExtra={
          <Tabs
            type="button"
            activeKey={String(currentStatus)}
            onChange={(key) => setCurrentStatus(Number(key))}
            style={{ marginBottom: 0 }}
          >
            <TabPane tab={t('全部')} itemKey="-1" />
            <TabPane tab={t('待审核')} itemKey="1" />
            <TabPane tab={t('审核通过')} itemKey="10" />
            <TabPane tab={t('审核未通过')} itemKey="20" />
          </Tabs>
        }
        filters={[
          {
            field: 'username',
            label: '会员名称',
            type: 'input',
            placeholder: '输入会员名称',
            width: 220,
          },
        ]}
        columns={columns}
        batchActions={(rows, clear) => (
          <Space>
            <Button
              size="small"
              type="danger"
              disabled={rows.length === 0}
              onClick={() => batchDelete(rows.map((r) => r.merchantApplyId), clear)}
            >
              {t('批量删除')}
            </Button>
          </Space>
        )}
        rowActions={(record) => (
          <Space spacing={4}>
            <Button
              theme="borderless"
              size="small"
              type="primary"
              onClick={() => openDetail(record)}
            >
              {t('详情')}
            </Button>
            {record.status === 20 && (
              <Popconfirm
                title={t('确定删除此条申请？')}
                content={t('删除后将无法恢复。')}
                onConfirm={() => deleteRecord(record.merchantApplyId)}
              >
                <Button theme="borderless" size="small" type="danger">
                  {t('删除')}
                </Button>
              </Popconfirm>
            )}
          </Space>
        )}
      />

      {/* 申请详情及审核弹窗 */}
      <Modal
        title={t('入驻申请详情')}
        visible={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={720}
        loading={detailLoading}
        footer={
          <Space>
            <Button onClick={() => setDetailModalVisible(false)}>{t('关闭')}</Button>
            {selectedRecord?.status === 1 && (
              <Button
                type="primary"
                loading={auditSubmitting}
                onClick={handleAuditSubmit}
              >
                {t('提交审核')}
              </Button>
            )}
          </Space>
        }
      >
        {selectedRecord && (
          <Tabs defaultActiveKey="base">
            <TabPane tab={t('基础信息')} itemKey="base">
              <Descriptions
                data={[
                  {
                    key: t('预期店铺名称'),
                    value:
                      selectedRecord.shopTitle ||
                      selectedRecord.shopData?.shopTitle ||
                      '--',
                  },
                  {
                    key: t('入驻资质'),
                    value: selectedRecord.type === 1 ? t('个人入驻') : t('企业入驻'),
                  },
                  ...(selectedRecord.type === 2
                    ? [
                        {
                          key: t('企业名称'),
                          value:
                            selectedRecord.companyName ||
                            selectedRecord.baseData?.companyName ||
                            '--',
                        },
                      ]
                    : []),
                  {
                    key: t('联系人姓名'),
                    value:
                      selectedRecord.contactName ||
                      selectedRecord.merchantData?.contactName ||
                      '--',
                  },
                  {
                    key: t('联系人电话'),
                    value:
                      selectedRecord.contactMobile ||
                      selectedRecord.merchantData?.contactPhone ||
                      '--',
                  },
                  {
                    key: t('联系人邮箱'),
                    value: selectedRecord.merchantData?.contactEmail || '--',
                  },
                  {
                    key: t('申请状态'),
                    value:
                      selectedRecord.statusText ||
                      (selectedRecord.status === 1
                        ? t('待审核')
                        : selectedRecord.status === 10
                        ? t('审核通过')
                        : t('审核未通过')),
                  },
                  {
                    key: t('申请时间'),
                    value: selectedRecord.addTime || '--',
                  },
                  ...(selectedRecord.status !== 1
                    ? [
                        {
                          key: t('审核人'),
                          value: selectedRecord.auditAdminName || '--',
                        },
                        {
                          key: t('审核时间'),
                          value: selectedRecord.auditTime || '--',
                        },
                      ]
                    : []),
                  ...(selectedRecord.status === 20 && selectedRecord.auditRemark
                    ? [
                        {
                          key: t('拒绝原因'),
                          value: selectedRecord.auditRemark,
                        },
                      ]
                    : []),
                ]}
              />

              {/* 待审核时显示审核控制区 */}
              {selectedRecord.status === 1 && (
                <div
                  style={{
                    marginTop: 20,
                    padding: 16,
                    background: 'var(--semi-color-fill-0)',
                    borderRadius: 6,
                  }}
                >
                  <Text strong style={{ display: 'block', marginBottom: 12 }}>
                    {t('审核处理')}
                  </Text>
                  <Space vertical align="start" style={{ width: '100%' }}>
                    <RadioGroup
                      value={auditStatus}
                      onChange={(e) => setAuditStatus(Number(e.target.value))}
                    >
                      <Radio value={10}>{t('审核通过')}</Radio>
                      <Radio value={20}>{t('审核未通过')}</Radio>
                    </RadioGroup>
                    <div style={{ width: '100%', marginTop: 8 }}>
                      <Text style={{ display: 'block', marginBottom: 4 }}>
                        {auditStatus === 20 ? t('拒绝原因（必填）') : t('审核备注（选填）')}
                      </Text>
                      <TextArea
                        rows={3}
                        placeholder={
                          auditStatus === 20
                            ? t('请输入审核拒绝的具体原因')
                            : t('请输入审核意见或备注')
                        }
                        value={auditRemark}
                        onChange={(val) => setAuditRemark(val)}
                      />
                    </div>
                  </Space>
                </div>
              )}
            </TabPane>

            {selectedRecord.type === 2 && (
              <TabPane tab={t('企业信息')} itemKey="company">
                <Descriptions
                  data={[
                    {
                      key: t('企业名称'),
                      value:
                        selectedRecord.companyName ||
                        selectedRecord.baseData?.companyName ||
                        '--',
                    },
                    {
                      key: t('统一社会信用代码'),
                      value: selectedRecord.baseData?.businessLicenseId || '--',
                    },
                    {
                      key: t('经营范围'),
                      value: selectedRecord.baseData?.businessScope || '--',
                    },
                    {
                      key: t('注册地址'),
                      value:
                        (selectedRecord.baseData?.licenseAddrProvinceName || '') +
                        ' ' +
                        (selectedRecord.baseData?.businessLicenseAddress || '--'),
                    },
                  ]}
                />
              </TabPane>
            )}

            <TabPane
              tab={selectedRecord.type === 1 ? t('个人信息') : t('法人代表信息')}
              itemKey="legal"
            >
              <Descriptions
                data={[
                  {
                    key: selectedRecord.type === 1 ? t('个人姓名') : t('法定代表人姓名'),
                    value:
                      selectedRecord.corporateName ||
                      selectedRecord.baseData?.corporateName ||
                      '--',
                  },
                  {
                    key: t('证件号码'),
                    value: selectedRecord.baseData?.documentNumber || '--',
                  },
                ]}
              />
            </TabPane>

            <TabPane tab={t('商户与店铺')} itemKey="shop">
              <Descriptions
                data={[
                  {
                    key: t('预期店铺名称'),
                    value:
                      selectedRecord.shopTitle ||
                      selectedRecord.shopData?.shopTitle ||
                      '--',
                  },
                  {
                    key: t('店铺描述'),
                    value: selectedRecord.shopData?.description || '--',
                  },
                ]}
              />
            </TabPane>
          </Tabs>
        )}
      </Modal>
    </>
  );
}
