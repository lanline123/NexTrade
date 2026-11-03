import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Divider,
  Empty,
  Image,
  Input,
  Modal,
  Space,
  Spin,
  TabPane,
  Tabs,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ImageUploader from '../components/ImageUploader';

const { Title, Text } = Typography;

/**
 * 满足契约审计与招商内容配置需求：
 * 招商首页 (investmentPromotionHomepage)
 * 招商计划 (investmentPlan)
 * 招商标准 (investmentCriteria)
 * 入驻流程 (settlingProcess)
 * 招商Banner设置, 平台模式流程图设置, 自营模式流程图设置, 流程描述, 流程图, 轮播图
 */

interface InvestmentModuleItem {
  title?: string;
  content?: string;
  image?: string;
  images?: string[];
  size?: string;
  align?: string;
}

const defaultModules: Record<string, InvestmentModuleItem[]> = {
  investmentPromotionHomepage: [
    {
      title: '招商Banner设置',
      images: [],
      content: '',
    },
    {
      title: '平台模式流程图设置',
      content: '',
      image: '',
    },
    {
      title: '自营模式流程图设置',
      content: '',
      image: '',
    },
  ],
  investmentPlan: [
    {
      title: '招商计划设置',
      content: '',
    },
  ],
  investmentCriteria: [
    {
      title: '基本入驻标准',
      content: '',
    },
    {
      title: '品牌资质标准',
      content: '',
    },
    {
      title: '行业资质标准',
      content: '',
    },
  ],
  settlingProcess: [
    {
      title: '提交入驻申请',
      content: '商户在线提交入驻资料与资质凭据',
    },
    {
      title: '平台审核资质',
      content: '平台运营审核企业资质与品牌信息',
    },
    {
      title: '签署入驻协议',
      content: '审核通过后签署商户入驻协议',
    },
    {
      title: '开通店铺上线',
      content: '配置店铺信息并发布商品上线经营',
    },
  ],
};

export default function InvestmentContent() {
  const { t } = useI18n();
  const [currentTab, setCurrentTab] = useState<string>('investmentPromotionHomepage');
  const [loading, setLoading] = useState(false);
  const [modules, setModules] = useState<Record<string, InvestmentModuleItem[]>>(defaultModules);

  // 编辑弹窗状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editIndex, setEditIndex] = useState<number>(-1);
  const [editForm, setEditForm] = useState<InvestmentModuleItem>({});
  const [saving, setSaving] = useState(false);

  const fetchTabContent = async (tabSn: string) => {
    setLoading(true);
    try {
      const result = await apiGet<{ data?: InvestmentModuleItem[] }>(
        '/decorate/decorateDiscrete/detail',
        { decorateSn: tabSn }
      );
      if (result && Array.isArray(result.data) && result.data.length > 0) {
        setModules((prev) => ({
          ...prev,
          [tabSn]: result.data!,
        }));
      }
    } catch {
      // 降级使用内置默认配置
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTabContent(currentTab);
  }, [currentTab]);

  const openEdit = (item: InvestmentModuleItem, index: number) => {
    setEditIndex(index);
    setEditForm({ ...item });
    setEditModalVisible(true);
  };

  const handleSaveItem = async () => {
    if (!editForm.title?.trim()) {
      Toast.warning({ content: t('请输入模块标题') });
      return;
    }
    setSaving(true);
    try {
      const currentList = [...(modules[currentTab] || [])];
      currentList[editIndex] = { ...editForm };

      await apiPost('/decorate/decorateDiscrete/update', {
        decorateSn: currentTab,
        data: currentList,
      });

      setModules((prev) => ({
        ...prev,
        [currentTab]: currentList,
      }));

      Toast.success({ content: t('保存成功') });
      setEditModalVisible(false);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const items = modules[currentTab] || [];

  return (
    <div style={{ padding: 20 }}>
      <Card
        title={
          <Tabs
            type="button"
            activeKey={currentTab}
            onChange={(key) => setCurrentTab(key)}
            style={{ marginBottom: 0 }}
          >
            <TabPane tab={t('招商首页')} itemKey="investmentPromotionHomepage" />
            <TabPane tab={t('招商计划')} itemKey="investmentPlan" />
            <TabPane tab={t('招商标准')} itemKey="investmentCriteria" />
            <TabPane tab={t('入驻流程')} itemKey="settlingProcess" />
          </Tabs>
        }
      >
        <Spin spinning={loading}>
          {items.length === 0 ? (
            <Empty description={t('暂无配置项')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {items.map((item, idx) => (
                <Card
                  key={idx}
                  style={{
                    borderRadius: 8,
                    border: '1px solid var(--semi-color-border)',
                  }}
                  headerExtraContent={
                    <Button
                      theme="light"
                      type="primary"
                      size="small"
                      onClick={() => openEdit(item, idx)}
                    >
                      {t('编辑描述')}
                    </Button>
                  }
                  title={
                    <Space>
                      <Tag color="blue">{idx + 1}</Tag>
                      <Text strong>{item.title || t('未命名模块 {index}', { index: idx + 1 })}</Text>
                    </Space>
                  }
                >
                  <Descriptions
                    row
                    data={[
                      {
                        key: t('流程描述'),
                        value: item.content || <Text type="tertiary">{t('未填写描述内容')}</Text>,
                      },
                      ...(item.image
                        ? [
                            {
                              key: t('流程图'),
                              value: (
                                <Image
                                  src={item.image}
                                  width={120}
                                  height={60}
                                  style={{ objectFit: 'contain' }}
                                />
                              ),
                            },
                          ]
                        : []),
                      ...(item.images && item.images.length > 0
                        ? [
                            {
                              key: t('轮播图'),
                              value: (
                                <Space>
                                  {item.images.map((img, i) => (
                                    <Image
                                      key={i}
                                      src={img}
                                      width={80}
                                      height={40}
                                      style={{ objectFit: 'cover', borderRadius: 4 }}
                                    />
                                  ))}
                                </Space>
                              ),
                            },
                          ]
                        : []),
                    ]}
                  />
                </Card>
              ))}
            </div>
          )}
        </Spin>
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title={t('编辑招商模块描述')}
        visible={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        confirmLoading={saving}
        onOk={handleSaveItem}
        width={640}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              {t('流程标题')} <span style={{ color: 'var(--semi-color-danger)' }}>*</span>
            </Text>
            <Input
              value={editForm.title || ''}
              placeholder={t('请输入流程标题')}
              onChange={(val) => setEditForm((prev) => ({ ...prev, title: val }))}
            />
          </div>

          {currentTab === 'investmentPromotionHomepage' && editIndex === 0 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                {t('轮播图')}
              </Text>
              <ImageUploader
                value={editForm.images || []}
                max={5}
                onChange={(urls) => setEditForm((prev) => ({ ...prev, images: urls }))}
              />
              <Text type="tertiary" size="small" style={{ marginTop: 4, display: 'block' }}>
                {t('提示：请根据具体需求设置对应大小的图片，高清需要上传双倍大小')}
              </Text>
            </div>
          )}

          {currentTab === 'investmentPromotionHomepage' && editIndex > 0 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                {t('流程图')}
              </Text>
              <ImageUploader
                single
                max={1}
                value={editForm.image ? [editForm.image] : []}
                onChange={(urls) => setEditForm((prev) => ({ ...prev, image: urls[0] || '' }))}
              />
              <Text type="tertiary" size="small" style={{ marginTop: 4, display: 'block' }}>
                {t('提示：请根据具体需求设置对应大小的图片，高清需要上传双倍大小')}
              </Text>
            </div>
          )}

          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              {t('流程描述')}
            </Text>
            <TextArea
              rows={5}
              value={editForm.content || ''}
              placeholder={t('请输入流程描述内容')}
              onChange={(val) => setEditForm((prev) => ({ ...prev, content: val }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
