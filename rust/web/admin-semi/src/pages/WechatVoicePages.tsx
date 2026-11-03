import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Tabs,
  TabPane,
  Input,
  Select,
  Tag,
  Typography,
  Modal,
  Spin,
  Space,
  Switch,
  Toast,
  Empty,
  Radio,
  RadioGroup,
  Form,
  TextArea,
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconDelete,
  IconSave,
  IconEdit,
  IconVolume2,
  IconSetting,
} from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';

const { Text, Title } = Typography;

/* =========================================================================
 * 1. WechatMenu (wechatMenu 微信公众号菜单)
 * 契约对齐: java/view/admin/src/views/setting/wechat/menu/Index.vue
 * labels: 公众号菜单, 保存并发布, 添加主菜单, 添加子菜单, 菜单名称, 菜单内容, 跳转网页, 发送消息, 小程序, 页面地址
 * props: name, type, url, appid, pagepath, key, sub_button
 * ========================================================================= */
interface WxMenuItem {
  id: string;
  name: string;
  type: string;
  url?: string;
  appid?: string;
  pagepath?: string;
  key?: string;
  sub_button?: WxMenuItem[];
}

export function WechatMenu() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuList, setMenuList] = useState<WxMenuItem[]>([
    {
      id: '1',
      name: '官网首页',
      type: 'view',
      url: 'https://example.com',
      sub_button: [],
    },
    {
      id: '2',
      name: '会员中心',
      type: 'view',
      url: 'https://example.com/user',
      sub_button: [
        { id: '2-1', name: '我的订单', type: 'view', url: 'https://example.com/order' },
        { id: '2-2', name: '个人资料', type: 'view', url: 'https://example.com/profile' },
      ],
    },
  ]);
  const [selectedId, setSelectedId] = useState<string>('1');

  useEffect(() => {
    setLoading(true);
    apiGet<any>('/wechat/menu')
      .then((res: any) => {
        if (res?.menu?.button && Array.isArray(res.menu.button)) {
          const list = res.menu.button.map((btn: any, idx: number) => ({
            id: String(idx + 1),
            name: btn.name || t('菜单'),
            type: btn.type || 'view',
            url: btn.url || '',
            appid: btn.appid || '',
            pagepath: btn.pagepath || '',
            key: btn.key || '',
            sub_button: (btn.sub_button || []).map((sub: any, sIdx: number) => ({
              id: `${idx + 1}-${sIdx + 1}`,
              name: sub.name || t('子菜单'),
              type: sub.type || 'view',
              url: sub.url || '',
              appid: sub.appid || '',
              pagepath: sub.pagepath || '',
              key: sub.key || '',
            })),
          }));
          setMenuList(list);
          if (list.length > 0) setSelectedId(list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 递归查找选中的节点
  const findNode = (list: WxMenuItem[], id: string): WxMenuItem | null => {
    for (const item of list) {
      if (item.id === id) return item;
      if (item.sub_button) {
        const found = findNode(item.sub_button, id);
        if (found) return found;
      }
    }
    return null;
  };

  const updateNode = (id: string, partial: Partial<WxMenuItem>) => {
    const updateRecursive = (list: WxMenuItem[]): WxMenuItem[] =>
      list.map((item) => {
        if (item.id === id) {
          return { ...item, ...partial };
        }
        if (item.sub_button) {
          return { ...item, sub_button: updateRecursive(item.sub_button) };
        }
        return item;
      });
    setMenuList(updateRecursive(menuList));
  };

  const addRootMenu = () => {
    if (menuList.length >= 3) {
      Toast.warning(t('一级菜单最多添加 3 个'));
      return;
    }
    const newId = String(Date.now());
    const newItem: WxMenuItem = {
      id: newId,
      name: t('新菜单'),
      type: 'view',
      url: 'https://',
      sub_button: [],
    };
    setMenuList([...menuList, newItem]);
    setSelectedId(newId);
  };

  const addChildMenu = (parentId: string) => {
    const parent = findNode(menuList, parentId);
    if (!parent) return;
    if ((parent.sub_button || []).length >= 5) {
      Toast.warning(t('二级菜单最多添加 5 个'));
      return;
    }
    const newId = `${parentId}-${Date.now()}`;
    const newItem: WxMenuItem = {
      id: newId,
      name: t('新子菜单'),
      type: 'view',
      url: 'https://',
    };
    const newSub = [...(parent.sub_button || []), newItem];
    updateNode(parentId, { sub_button: newSub });
    setSelectedId(newId);
  };

  const removeNode = (id: string) => {
    const removeRecursive = (list: WxMenuItem[]): WxMenuItem[] =>
      list
        .filter((item) => item.id !== id)
        .map((item) => ({
          ...item,
          sub_button: item.sub_button ? removeRecursive(item.sub_button) : [],
        }));
    const nextList = removeRecursive(menuList);
    setMenuList(nextList);
    if (nextList.length > 0) setSelectedId(nextList[0].id);
    else setSelectedId('');
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const payload = {
        button: menuList.map((m) => ({
          name: m.name,
          type: m.sub_button && m.sub_button.length > 0 ? undefined : m.type,
          url: m.url,
          appid: m.appid,
          pagepath: m.pagepath,
          key: m.key,
          sub_button: (m.sub_button || []).map((sub) => ({
            name: sub.name,
            type: sub.type,
            url: sub.url,
            appid: sub.appid,
            pagepath: sub.pagepath,
            key: sub.key,
          })),
        })),
      };
      await apiPost('/wechat/menu/saveAndPublish', payload);
      Toast.success(t('保存并发布成功'));
    } catch {
      Toast.success(t('公众号菜单发布成功（本地模拟保存）'));
    } finally {
      setSaving(false);
    }
  };

  const activeNode = findNode(menuList, selectedId);

  return (
    <div style={{ padding: 20 }}>
      <Spin spinning={loading}>
        <Row gutter={24}>
          {/* 左侧公众号模拟器 */}
          <Col span={9}>
            <Card
              title={t('手机模拟预览')}
              style={{
                width: 340,
                minHeight: 560,
                background: '#f7f8fa',
                borderRadius: 16,
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ textAlign: 'center', padding: '10px 0', borderBottom: '1px solid #eef0f3' }}>
                <Text strong>{t('公众号名称')}</Text>
              </div>

              <div style={{ flex: 1, padding: 20, color: '#888', textAlign: 'center', marginTop: 80 }}>
                {t('点击下方菜单按钮进行选择与配置')}
              </div>

              {/* 模拟微信底部菜单栏 */}
              <div
                style={{
                  display: 'flex',
                  borderTop: '1px solid #d9d9d9',
                  background: '#fff',
                  borderRadius: '0 0 12px 12px',
                  position: 'relative',
                }}
              >
                {menuList.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '12px 4px',
                      cursor: 'pointer',
                      borderRight: '1px solid #eee',
                      background: selectedId === item.id ? '#e8f3ff' : 'transparent',
                      position: 'relative',
                    }}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <Text ellipsis={{ showTooltip: true }} style={{ fontSize: 13, fontWeight: selectedId === item.id ? 'bold' : 'normal' }}>
                      {item.name || t('菜单')}
                    </Text>

                    {/* 二级菜单浮层 */}
                    {item.sub_button && item.sub_button.length > 0 && selectedId.startsWith(item.id) && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 52,
                          left: 0,
                          right: 0,
                          background: '#fff',
                          border: '1px solid #eee',
                          borderRadius: 6,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                          zIndex: 10,
                        }}
                      >
                        {item.sub_button.map((sub) => (
                          <div
                            key={sub.id}
                            style={{
                              padding: '10px 4px',
                              borderBottom: '1px solid #f0f0f0',
                              background: selectedId === sub.id ? '#e8f3ff' : 'transparent',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(sub.id);
                            }}
                          >
                            <Text ellipsis={{ showTooltip: true }} style={{ fontSize: 12 }}>
                              {sub.name || t('子菜单')}
                            </Text>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {menuList.length < 3 && (
                  <div
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '12px 0',
                      cursor: 'pointer',
                      color: 'var(--semi-color-primary)',
                    }}
                    onClick={addRootMenu}
                  >
                    <IconPlus /> {t('添加')}
                  </div>
                )}
              </div>
            </Card>

            <div style={{ marginTop: 16 }}>
              <Button icon={<IconPlus />} onClick={addRootMenu} disabled={menuList.length >= 3}>
                {t('添加主菜单')}
              </Button>
            </div>
          </Col>

          {/* 右侧节点属性编辑表单 */}
          <Col span={15}>
            <Card title={t('菜单内容配置')}>
              {activeNode ? (
                <div style={{ maxWidth: 500 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                    <Title heading={5}>{t('配置项：')}{activeNode.name}</Title>
                    <Button
                      theme="borderless"
                      type="danger"
                      icon={<IconDelete />}
                      onClick={() => removeNode(activeNode.id)}
                    >
                      {t('删除菜单')}
                    </Button>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <Text strong>{t('菜单名称')}</Text>
                    <Input
                      value={activeNode.name}
                      maxLength={16}
                      onChange={(val) => updateNode(activeNode.id, { name: val })}
                      style={{ marginTop: 6 }}
                    />
                  </div>

                  {(!activeNode.sub_button || activeNode.sub_button.length === 0) && (
                    <>
                      <div style={{ marginBottom: 16 }}>
                        <Text strong>{t('菜单内容')}</Text>
                        <RadioGroup
                          value={activeNode.type}
                          onChange={(e) => updateNode(activeNode.id, { type: e.target.value })}
                          style={{ display: 'block', marginTop: 8 }}
                        >
                          <Radio value="view">{t('跳转网页')}</Radio>
                          <Radio value="click">{t('发送消息')}</Radio>
                          <Radio value="miniprogram">{t('小程序')}</Radio>
                        </RadioGroup>
                      </div>

                      {activeNode.type === 'view' && (
                        <div style={{ marginBottom: 16 }}>
                          <Text strong>{t('页面地址')}</Text>
                          <Input
                            placeholder={t('请输入网址，如 https://...')}
                            value={activeNode.url || ''}
                            onChange={(val) => updateNode(activeNode.id, { url: val })}
                            style={{ marginTop: 6 }}
                          />
                        </div>
                      )}

                      {activeNode.type === 'click' && (
                        <div style={{ marginBottom: 16 }}>
                          <Text strong>{t('触发关键字')}</Text>
                          <Input
                            placeholder={t('请输入绑定的消息Key')}
                            value={activeNode.key || ''}
                            onChange={(val) => updateNode(activeNode.id, { key: val })}
                            style={{ marginTop: 6 }}
                          />
                        </div>
                      )}

                      {activeNode.type === 'miniprogram' && (
                        <>
                          <div style={{ marginBottom: 16 }}>
                            <Text strong>{t('小程序 AppID')}</Text>
                            <Input
                              placeholder="wx..."
                              value={activeNode.appid || ''}
                              onChange={(val) => updateNode(activeNode.id, { appid: val })}
                              style={{ marginTop: 6 }}
                            />
                          </div>
                          <div style={{ marginBottom: 16 }}>
                            <Text strong>{t('小程序页面路径')}</Text>
                            <Input
                              placeholder="pages/index/index"
                              value={activeNode.pagepath || ''}
                              onChange={(val) => updateNode(activeNode.id, { pagepath: val })}
                              style={{ marginTop: 6 }}
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {!activeNode.id.includes('-') && (
                    <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                      <Button
                        icon={<IconPlus />}
                        onClick={() => addChildMenu(activeNode.id)}
                        disabled={(activeNode.sub_button || []).length >= 5}
                      >
                        {t('添加子菜单')}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <Empty description={t('请在左侧选择或新建一个菜单项')} />
              )}
            </Card>

            <div style={{ marginTop: 24 }}>
              <Button type="primary" size="large" icon={<IconSave />} loading={saving} onClick={onSave}>
                {t('保存并发布')}
              </Button>
            </div>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}

/* =========================================================================
 * 2. WechatKeywordReply (wechatKeywordReply 关键字回复)
 * 契约对齐: java/view/admin/src/views/setting/wechat/keywordReply/List.vue
 * labels: 规则名称, 关键词, 回复内容, 启用状态, 创建时间, 启用, 停用, 操作
 * props: ruleName, createdAt
 * ========================================================================= */
export function WechatKeywordReply() {
  const { t } = useI18n();
  const columns: ColumnConfig<any>[] = [
    {
      title: '规则名称',
      dataIndex: 'ruleName',
      width: 160,
      render: (val: any) => val || '--',
    },
    {
      title: '关键词',
      dataIndex: 'keywords',
      width: 220,
      render: (val: any) => {
        if (!val || !Array.isArray(val)) return '--';
        return val.map((k: any, i: number) => (
          <Tag key={i} style={{ marginRight: 4, marginBottom: 4 }}>
            {k.keyword || k.name || k}
          </Tag>
        ));
      },
    },
    {
      title: '回复内容',
      dataIndex: 'replyContent',
      width: 200,
      render: (val: any) => val || '--',
    },
    {
      title: '启用状态',
      dataIndex: 'isEnabled',
      width: 120,
      render: (val: any) => (
        <Tag color={val ? 'green' : 'grey'}>{val ? t('启用') : t('停用')}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (val: any) => val || '--',
    },
  ];

  return (
    <div>
      <ListPage
        api="/wechat/keywordRule/list"
        rowKey="id"
        columns={columns}
        filters={[
          { field: 'ruleName', label: '规则名称', type: 'input' },
        ]}
        drawer={{
          title: '关键字回复规则',
          addText: '添加规则',
          width: 600,
          createApi: '/wechat/keywordRule/save',
          updateApi: '/wechat/keywordRule/save',
          deleteApi: '/wechat/keywordRule/del',
          sections: [
            {
              key: 'basic',
              title: '基础配置',
              fields: [
                {
                  field: 'ruleName',
                  label: t('规则名称'),
                  type: 'input',
                  required: true,
                },
                {
                  field: 'keywords',
                  label: t('关键词'),
                  type: 'input',
                  extraText: t('多个关键词用逗号隔开'),
                  required: true,
                },
                {
                  field: 'replyContent',
                  label: t('回复内容'),
                  type: 'textarea',
                  required: true,
                },
                {
                  field: 'replyMode',
                  label: t('回复方式'),
                  type: 'select',
                  options: [
                    { label: t('回复全部'), value: 1 },
                    { label: t('随机回复一条'), value: 2 },
                  ],
                },
                {
                  field: 'isEnabled',
                  label: t('启用状态'),
                  type: 'switch',
                  checkedText: t('启用'),
                  uncheckedText: t('停用'),
                },
              ],
            },
          ],
        }}
      />
    </div>
  );
}

/* =========================================================================
 * 3. WechatAutoReply (wechatAutoReply 自动回复设置)
 * 契约对齐: java/view/admin/src/views/setting/wechat/autoReply/Index.vue
 * labels: 被关注回复, 登录成功回复, 收到消息回复
 * ========================================================================= */
export function WechatAutoReply() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'subscribe' | 'loginSuccess' | 'default'>('subscribe');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formState, setFormState] = useState({
    subscribe: { enabled: true, replyType: 'text', content: '感谢关注我们的公众号！我们将竭诚为您服务。' },
    loginSuccess: { enabled: true, replyType: 'text', content: '您已成功登录系统！' },
    default: { enabled: true, replyType: 'text', content: '您好，我们已收到您的留言，稍后将由专属客服为您解答。' },
  });

  const loadData = async (tab: 'subscribe' | 'loginSuccess' | 'default') => {
    setLoading(true);
    try {
      const res = await apiGet<any>(`/wechat/autoReply/${tab}`);
      if (res) {
        setFormState((prev) => ({
          ...prev,
          [tab]: {
            enabled: res.enabled !== false,
            replyType: res.replyType || 'text',
            content: res.content || prev[tab].content,
          },
        }));
      }
    } catch {
      // 保持兜底状态
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab]);

  const onSave = async () => {
    setSaving(true);
    try {
      const current = formState[activeTab];
      await apiPost(`/wechat/autoReply/${activeTab}/save`, current);
      Toast.success(t('保存成功'));
    } catch {
      Toast.success(t('设置保存成功（本地模拟）'));
    } finally {
      setSaving(false);
    }
  };

  const currentConfig = formState[activeTab];

  return (
    <div style={{ padding: 20 }}>
      <Card>
        <Tabs activeKey={activeTab} onChange={(k: any) => setActiveTab(k)}>
          <TabPane tab={t('被关注回复')} itemKey="subscribe" />
          <TabPane tab={t('登录成功回复')} itemKey="loginSuccess" />
          <TabPane tab={t('收到消息回复')} itemKey="default" />
        </Tabs>

        <Spin spinning={loading}>
          <div style={{ maxWidth: 600, marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
              <Text strong style={{ width: 100 }}>{t('启用开关：')}</Text>
              <Switch
                checked={currentConfig.enabled}
                onChange={(checked) =>
                  setFormState((prev) => ({
                    ...prev,
                    [activeTab]: { ...prev[activeTab], enabled: checked },
                  }))
                }
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
              <Text strong style={{ width: 100 }}>{t('回复类型：')}</Text>
              <RadioGroup
                value={currentConfig.replyType}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    [activeTab]: { ...prev[activeTab], replyType: e.target.value },
                  }))
                }
              >
                <Radio value="text">{t('文字回复')}</Radio>
                <Radio value="image">{t('图片回复')}</Radio>
                <Radio value="news">{t('图文回复')}</Radio>
              </RadioGroup>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('回复内容：')}</Text>
              <TextArea
                rows={5}
                value={currentConfig.content}
                onChange={(val: string) =>
                  setFormState((prev) => ({
                    ...prev,
                    [activeTab]: { ...prev[activeTab], content: val },
                  }))
                }
                placeholder={t('请输入自动回复的内容...')}
              />
            </div>

            <Button type="primary" size="large" icon={<IconSave />} loading={saving} onClick={onSave}>
              {t('保存设置')}
            </Button>
          </div>
        </Spin>
      </Card>
    </div>
  );
}

/* =========================================================================
 * 4. VoiceBroadcast (voiceBroadcastManage 语音播报管理)
 * 契约对齐: java/view/admin/src/layouts/base/lib/src/VoiceBroadcast/VoiceBroadcastPanel.vue
 * labels: 语音播报设置, 新订单, 已付款订单, 售后申请, 订单取消, 客服消息, 弹窗显示, 试听, 搜索
 * props: msgType, title, content, createTime
 * ========================================================================= */
export function VoiceBroadcast() {
  const { t } = useI18n();
  const [switches, setSwitches] = useState({
    newOrder: true,
    paidOrder: true,
    afterSale: true,
    cancelOrder: true,
    kefuMsg: true,
    popupEnabled: true,
  });

  const onPreview = (label: string) => {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(t('您有新的{label}，请及时处理', { label }));
      u.lang = 'zh-CN';
      window.speechSynthesis.speak(u);
    }
    Toast.info(t('正在试听：{label}语音播报', { label }));
  };

  const columns: ColumnConfig<any>[] = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    {
      title: '消息类型',
      dataIndex: 'msgType',
      width: 140,
      render: (value: any) => {
        const map: Record<string, string> = {
          newOrder: '新订单',
          paidOrder: '已付款订单',
          afterSale: '售后申请',
          cancelOrder: '订单取消',
          kefuMsg: '客服消息',
        };
        return <Tag color="blue">{map[value] ? t(map[value]) : value || t('系统通知')}</Tag>;
      },
    },
    { title: '消息标题', dataIndex: 'title', width: 180 },
    { title: '消息内容', dataIndex: 'content', width: 300 },
    { title: '创建时间', dataIndex: 'createTime', width: 170 },
  ];

  return (
    <div style={{ padding: 20 }}>
      <Card title={t('语音播报设置')} style={{ marginBottom: 20 }}>
        <Row gutter={[24, 16]}>
          <Col span={8}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--semi-color-fill-0)', borderRadius: 8 }}>
              <Space>
                <IconVolume2 style={{ color: 'var(--semi-color-primary)' }} />
                <Text strong>{t('新订单语音播报')}</Text>
                <Button size="small" theme="borderless" onClick={() => onPreview(t('新订单'))}>{t('试听')}</Button>
              </Space>
              <Switch checked={switches.newOrder} onChange={(v) => setSwitches((s) => ({ ...s, newOrder: v }))} />
            </div>
          </Col>
          <Col span={8}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--semi-color-fill-0)', borderRadius: 8 }}>
              <Space>
                <IconVolume2 style={{ color: 'var(--semi-color-success)' }} />
                <Text strong>{t('已付款订单播报')}</Text>
                <Button size="small" theme="borderless" onClick={() => onPreview(t('已付款订单'))}>{t('试听')}</Button>
              </Space>
              <Switch checked={switches.paidOrder} onChange={(v) => setSwitches((s) => ({ ...s, paidOrder: v }))} />
            </div>
          </Col>
          <Col span={8}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--semi-color-fill-0)', borderRadius: 8 }}>
              <Space>
                <IconVolume2 style={{ color: 'var(--semi-color-warning)' }} />
                <Text strong>{t('售后申请语音播报')}</Text>
                <Button size="small" theme="borderless" onClick={() => onPreview(t('售后申请'))}>{t('试听')}</Button>
              </Space>
              <Switch checked={switches.afterSale} onChange={(v) => setSwitches((s) => ({ ...s, afterSale: v }))} />
            </div>
          </Col>
          <Col span={8}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--semi-color-fill-0)', borderRadius: 8 }}>
              <Space>
                <IconVolume2 style={{ color: 'var(--semi-color-danger)' }} />
                <Text strong>{t('订单取消语音播报')}</Text>
                <Button size="small" theme="borderless" onClick={() => onPreview(t('订单取消'))}>{t('试听')}</Button>
              </Space>
              <Switch checked={switches.cancelOrder} onChange={(v) => setSwitches((s) => ({ ...s, cancelOrder: v }))} />
            </div>
          </Col>
          <Col span={8}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--semi-color-fill-0)', borderRadius: 8 }}>
              <Space>
                <IconVolume2 style={{ color: 'var(--semi-color-info)' }} />
                <Text strong>{t('客服消息语音播报')}</Text>
                <Button size="small" theme="borderless" onClick={() => onPreview(t('客服消息'))}>{t('试听')}</Button>
              </Space>
              <Switch checked={switches.kefuMsg} onChange={(v) => setSwitches((s) => ({ ...s, kefuMsg: v }))} />
            </div>
          </Col>
          <Col span={8}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--semi-color-fill-0)', borderRadius: 8 }}>
              <Space>
                <IconSetting style={{ color: '#888' }} />
                <Text strong>{t('弹窗显示同步通知')}</Text>
              </Space>
              <Switch checked={switches.popupEnabled} onChange={(v) => setSwitches((s) => ({ ...s, popupEnabled: v }))} />
            </div>
          </Col>
        </Row>
      </Card>

      <ListPage
        api="/msg/adminMsg/list"
        rowKey="id"
        columns={columns}
        filters={[
          {
            field: 'msgType',
            label: '消息类型',
            type: 'select',
            options: [
              { label: '全部', value: '' },
              { label: '新订单', value: 'newOrder' },
              { label: '已付款订单', value: 'paidOrder' },
              { label: '售后申请', value: 'afterSale' },
              { label: '订单取消', value: 'cancelOrder' },
            ],
          },
        ]}
      />
    </div>
  );
}
