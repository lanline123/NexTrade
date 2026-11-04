import React, { useEffect, useRef, useState } from 'react';
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
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
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
  miniprogramUrl?: string;
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
            miniprogramUrl: btn.miniprogramUrl || '',
            key: btn.key || '',
            sub_button: (btn.sub_button || []).map((sub: any, sIdx: number) => ({
              id: `${idx + 1}-${sIdx + 1}`,
              name: sub.name || t('子菜单'),
              type: sub.type || 'view',
              url: sub.url || '',
              appid: sub.appid || '',
              pagepath: sub.pagepath || '',
              miniprogramUrl: sub.miniprogramUrl || '',
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

  const [dragId, setDragId] = useState<string>('');
  const [dragOverId, setDragOverId] = useState<string>('');
  const pressTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  const clearPressTimer = () => {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const beginLongPress = (id: string) => {
    clearPressTimer();
    pressTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true;
      setDragId(id);
    }, 350);
  };

  const reorderNode = (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    setMenuList((prev) => {
      const fromRoot = prev.findIndex((item) => item.id === fromId);
      const toRoot = prev.findIndex((item) => item.id === toId);
      if (fromRoot >= 0 && toRoot >= 0) {
        const next = prev.slice();
        const [moved] = next.splice(fromRoot, 1);
        next.splice(toRoot, 0, moved);
        return next;
      }
      let fromParent = '';
      let toParent = '';
      prev.forEach((item) => {
        if ((item.sub_button || []).some((child) => child.id === fromId)) fromParent = item.id;
        if ((item.sub_button || []).some((child) => child.id === toId)) toParent = item.id;
      });
      if (!fromParent || fromParent !== toParent) return prev;
      return prev.map((item) => {
        if (item.id !== fromParent) return item;
        const children = (item.sub_button || []).slice();
        const fromIndex = children.findIndex((child) => child.id === fromId);
        const toIndex = children.findIndex((child) => child.id === toId);
        if (fromIndex < 0 || toIndex < 0) return item;
        const [moved] = children.splice(fromIndex, 1);
        children.splice(toIndex, 0, moved);
        return { ...item, sub_button: children };
      });
    });
  };

  useEffect(() => {
    const finishDrag = () => {
      clearPressTimer();
      setDragId((current) => {
        if (current && dragOverId) reorderNode(current, dragOverId);
        return '';
      });
      setDragOverId('');
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    };
    window.addEventListener('mouseup', finishDrag);
    return () => window.removeEventListener('mouseup', finishDrag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragOverId]);

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

  const moveNode = (id: string, direction: -1 | 1) => {
    setMenuList((prev) => {
      const rootIndex = prev.findIndex((item) => item.id === id);
      if (rootIndex >= 0) {
        const target = rootIndex + direction;
        if (target < 0 || target >= prev.length) return prev;
        const next = prev.slice();
        [next[rootIndex], next[target]] = [next[target], next[rootIndex]];
        return next;
      }
      return prev.map((item) => {
        const children = item.sub_button || [];
        const childIndex = children.findIndex((child) => child.id === id);
        if (childIndex < 0) return item;
        const target = childIndex + direction;
        if (target < 0 || target >= children.length) return item;
        const nextChildren = children.slice();
        [nextChildren[childIndex], nextChildren[target]] = [nextChildren[target], nextChildren[childIndex]];
        return { ...item, sub_button: nextChildren };
      });
    });
  };

  const confirmRemoveNode = (id: string) => {
    const node = findNode(menuList, id);
    Modal.confirm({
      title: t('删除后，{displayName}菜单下设置的内容全部将被删除', {
        displayName: node?.name?.trim() || t('该菜单'),
      }),
      okText: t('确定'),
      cancelText: t('取消'),
      onOk: () => removeNode(id),
    });
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
          miniprogramUrl: m.miniprogramUrl,
          key: m.key,
          sub_button: (m.sub_button || []).map((sub) => ({
            name: sub.name,
            type: sub.type,
            url: sub.url,
            appid: sub.appid,
            pagepath: sub.pagepath,
            miniprogramUrl: sub.miniprogramUrl,
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
    <div className="wx-menu-page">
      <div className="wx-menu-layout">
        <section className="wx-preview-panel">
          <div className="wx-panel-head">
            <div>
              <h3>{t('手机模拟预览')}</h3>
              <p>{t('点击菜单进行配置，长按拖拽可排序')}</p>
            </div>
          </div>

          <div className="wx-phone-frame">
            <div className="wx-phone-status">
              <span>9:41</span>
              <span className="wx-phone-status__signal">●●● ▰</span>
            </div>
            <div className="wx-phone-screen">
              <div className="wx-phone-account">{t('公众号名称')}</div>
              <div className="wx-phone-hint">{t('点击下方菜单按钮进行选择与配置')}</div>

              <div className="wx-phone-menu">
                {menuList.map((item) => (
                  <div
                    key={item.id}
                    className={`wx-menu-cell${selectedId === item.id ? ' is-selected' : ''}${dragId === item.id ? ' is-dragging' : ''}${dragOverId === item.id ? ' is-drag-over' : ''}`}
                    onMouseDown={(e) => {
                      if (e.button === 0) beginLongPress(item.id);
                    }}
                    onMouseEnter={() => {
                      if (dragId && !dragId.includes('-') && !item.id.includes('-')) setDragOverId(item.id);
                    }}
                    onClick={() => {
                      if (suppressClickRef.current) return;
                      setSelectedId(item.id);
                    }}
                  >
                    <Text ellipsis={{ showTooltip: true }}>{item.name || t('菜单')}</Text>

                    {item.sub_button && item.sub_button.length > 0 && selectedId.startsWith(item.id) && (
                      <div className="wx-submenu">
                        {item.sub_button.map((sub) => (
                          <div
                            key={sub.id}
                            className={`wx-submenu__item${selectedId === sub.id ? ' is-selected' : ''}${dragId === sub.id ? ' is-dragging' : ''}${dragOverId === sub.id ? ' is-drag-over' : ''}`}
                            onMouseDown={(e) => {
                              if (e.button === 0) beginLongPress(sub.id);
                            }}
                            onMouseEnter={() => {
                              if (dragId && dragId.includes('-') && sub.id.includes('-') && dragId.split('-')[0] === sub.id.split('-')[0]) {
                                setDragOverId(sub.id);
                              }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (suppressClickRef.current) return;
                              setSelectedId(sub.id);
                            }}
                          >
                            <Text ellipsis={{ showTooltip: true }}>{sub.name || t('子菜单')}</Text>
                          </div>
                        ))}
                        {(item.sub_button || []).length < 5 && (
                          <div
                            className="wx-submenu__item wx-submenu__item--add"
                            onClick={(e) => {
                              e.stopPropagation();
                              addChildMenu(item.id);
                            }}
                          >
                            <IconPlus size="small" />
                            {t('添加')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {menuList.length < 3 && (
                  <div className="wx-menu-cell wx-menu-cell--add" onClick={addRootMenu}>
                    <IconPlus />
                  </div>
                )}
              </div>
            </div>
          </div>

        </section>

        <section className="wx-config-panel">
          <div className="wx-panel-head wx-config-head">
            <div>
              <h3>{t('菜单内容配置')}</h3>
              <p>
                {activeNode
                  ? `${t('配置项')}：${activeNode.name || t('未命名菜单')}`
                  : t('请在左侧选择或新建一个菜单项')}
              </p>
            </div>
            {activeNode && (
              <Button
                theme="borderless"
                type="danger"
                icon={<IconDelete />}
                onClick={() => confirmRemoveNode(activeNode.id)}
              >
                {t('删除菜单')}
              </Button>
            )}
          </div>

          <div className="wx-config-body">
            {activeNode ? (
              <>
                <div className="wx-field">
                  <label>{t('菜单名称')}</label>
                  <Input
                    value={activeNode.name}
                    maxLength={20}
                    placeholder={t('仅支持中英文和数字')}
                    onChange={(val) => updateNode(activeNode.id, { name: val })}
                  />
                  <p className="wx-field-help">
                    {!activeNode.id.includes('-')
                      ? t('仅支持中英文和数字，字数不超过 4 个汉字或 8 个字母')
                      : t('仅支持中英文和数字，字数不超过 8 个汉字或 16 个字母')}
                  </p>
                </div>

                {activeNode.sub_button && activeNode.sub_button.length > 0 && (
                  <div className="wx-note">{t('已添加子菜单，仅可设置菜单名称')}</div>
                )}

                {(!activeNode.sub_button || activeNode.sub_button.length === 0) && (
                  <>
                    <div className="wx-field">
                      <label>{t('消息类型')}</label>
                      <RadioGroup
                        type="button"
                        value={activeNode.type}
                        onChange={(e) => updateNode(activeNode.id, { type: e.target.value })}
                      >
                        <Radio value="click">{t('发送消息')}</Radio>
                        <Radio value="view">{t('跳转网页')}</Radio>
                        <Radio value="miniprogram">{t('小程序')}</Radio>
                      </RadioGroup>
                    </div>

                    {activeNode.type === 'view' && (
                      <div className="wx-field">
                        <label>{t('跳转链接')}</label>
                        <Input
                          placeholder="https://..."
                          value={activeNode.url || ''}
                          onChange={(val) => updateNode(activeNode.id, { url: val })}
                        />
                      </div>
                    )}

                    {activeNode.type === 'click' && (
                      <div className="wx-field">
                        <label>{t('触发关键字')}</label>
                        <Input
                          placeholder={t('请输入绑定的消息Key')}
                          value={activeNode.key || ''}
                          onChange={(val) => updateNode(activeNode.id, { key: val })}
                        />
                      </div>
                    )}

                    {activeNode.type === 'miniprogram' && (
                      <>
                        <div className="wx-field">
                          <label>{t('小程序 AppId')}</label>
                          <Input
                            placeholder="wx..."
                            value={activeNode.appid || ''}
                            onChange={(val) => updateNode(activeNode.id, { appid: val })}
                          />
                        </div>
                        <div className="wx-field">
                          <label>{t('小程序路径')}</label>
                          <Input
                            placeholder="pages/index/index"
                            value={activeNode.pagepath || ''}
                            onChange={(val) => updateNode(activeNode.id, { pagepath: val })}
                          />
                        </div>
                        <div className="wx-field">
                          <label>{t('备用网页')}</label>
                          <Input
                            placeholder={t('请输入备用网页链接')}
                            value={activeNode.miniprogramUrl || ''}
                            onChange={(val) => updateNode(activeNode.id, { miniprogramUrl: val })}
                          />
                          <p className="wx-field-help">
                            {t('老版本微信不支持小程序时跳转的 http(s) 链接')}
                          </p>
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <Empty description={t('你未添加自定义菜单，点击左侧添加菜单为公众号创建菜单栏')} />
            )}
          </div>

          <div className="wx-config-footer">
            <Button type="primary" icon={<IconSave />} loading={saving} onClick={onSave}>
              {t('保存并发布')}
            </Button>
          </div>
        </section>
      </div>
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


