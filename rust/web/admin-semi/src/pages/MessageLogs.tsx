import { useEffect, useState } from 'react';
import { Button, Checkbox, Empty, Input, Modal, Select, Space, Tag, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import { LinkField, type LinkValue } from '../components/LinkPicker';
import type { ColumnConfig, FormDrawerConfig } from '../framework/types';

interface MessageLogRow {
  messageLogId: number;
  messageTitle?: string;
  messageContent?: string;
  messageLink?: string;
  sendTypeName?: string;
  messageType?: number;
  statusName?: string;
  sendTime?: string;
  isRecall?: number;
}

interface SendUserTarget {
  scope: number;
  userIds: number[];
  users: Array<{ userId: number; username?: string; mobile?: string }>;
  rankIds: number[];
  tagIds: number[];
  tagMatchMode: number;
}

const EMPTY_TARGET: SendUserTarget = { scope: 0, userIds: [], users: [], rankIds: [], tagIds: [], tagMatchMode: 0 };

/**
 * 发送会员选择器（旧版 components/SendUserSelector/index.vue）：
 * - 全部会员 / 部分会员；
 * - 部分会员支持 指定会员 / 会员标签 / 会员等级，三者互斥；
 * - 标签支持「满足任一/满足全部」。
 */
function MessageAudienceSelector({ value, onChange }: { value: SendUserTarget; onChange: (next: SendUserTarget) => void }) {
  const { t } = useI18n();
  const [scope, setScope] = useState<number>(Number(value?.scope ?? 0));
  const [tab, setTab] = useState<'user' | 'tag' | 'rank'>('user');
  const [ranks, setRanks] = useState<Array<{ label: string; value: number }>>([]);
  const [rankIds, setRankIds] = useState<number[]>(value?.rankIds || []);
  const [groups, setGroups] = useState<Array<{ groupId: number; groupName: string }>>([]);
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [tagsByGroup, setTagsByGroup] = useState<Record<number, Array<{ label: string; value: number }>>>({});
  const [tagIds, setTagIds] = useState<number[]>(value?.tagIds || []);
  const [tagMatchMode, setTagMatchMode] = useState<number>(Number(value?.tagMatchMode ?? 0));
  const [userOptions, setUserOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [userIds, setUserIds] = useState<number[]>(value?.userIds || []);
  const [userMap, setUserMap] = useState<Record<number, { userId: number; username?: string; mobile?: string }>>({});
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    apiGet<any>('/user/userRank/list')
      .then((result) => {
        const list = Array.isArray(result) ? result : result?.list || result?.records || [];
        setRanks((list || []).map((item: any) => ({ label: String(item.rankName || item.rank_name || item.rankId || item.rank_id), value: Number(item.rankId ?? item.rank_id ?? 0) })));
      })
      .catch(() => setRanks([]));
    apiGet<any>('/user/memberTagGroup/list')
      .then((result) => {
        const list = Array.isArray(result) ? result : result?.list || result?.records || [];
        setGroups((list || []).map((item: any) => ({ groupId: Number(item.groupId ?? item.group_id ?? 0), groupName: String(item.groupName || item.group_name || '') })));
      })
      .catch(() => setGroups([]));
  }, []);

  const emit = (next: Partial<SendUserTarget>) => {
    const base: SendUserTarget = {
      scope,
      userIds: tab === 'user' ? userIds : [],
      users: tab === 'user' ? userIds.map((id) => userMap[id] || { userId: id }) : [],
      rankIds: tab === 'rank' ? rankIds : [],
      tagIds: tab === 'tag' ? tagIds : [],
      tagMatchMode: tab === 'tag' ? tagMatchMode : 0,
    };
    onChange({ ...base, ...next });
  };

  const changeScope = (next: number) => {
    setScope(next);
    onChange({ ...EMPTY_TARGET, scope: next });
    if (next === 0) {
      setUserIds([]);
      setRankIds([]);
      setTagIds([]);
      setGroupIds([]);
    }
  };

  const changeTab = (next: 'user' | 'tag' | 'rank') => {
    setTab(next);
    onChange({ scope: 1, userIds: next === 'user' ? userIds : [], users: next === 'user' ? userIds.map((id) => userMap[id] || { userId: id }) : [], rankIds: next === 'rank' ? rankIds : [], tagIds: next === 'tag' ? tagIds : [], tagMatchMode: next === 'tag' ? tagMatchMode : 0 });
  };

  const searchUsers = async (keyword: string) => {
    setSearching(true);
    try {
      const result = await apiGet<any>('/user/user/list', { keyword, page: 1, size: 20 });
      const list = Array.isArray(result) ? result : result?.list || result?.records || [];
      const map = { ...userMap };
      const options = (list || []).map((item: any) => {
        const id = Number(item.userId ?? item.user_id ?? item.id);
        map[id] = { userId: id, username: String(item.username || item.memberName || item.member_name || ''), mobile: String(item.mobile || '') };
        return { label: `${item.username || item.memberName || item.member_name || item.mobile || `会员${id}`}${item.mobile ? `（${item.mobile}）` : ''}`, value: id };
      });
      setUserMap(map);
      setUserOptions(options);
    } catch {
      setUserOptions([]);
    } finally {
      setSearching(false);
    }
  };

  const toggleGroup = async (groupId: number, checked: boolean) => {
    const next = checked ? [...groupIds, groupId] : groupIds.filter((id) => id !== groupId);
    setGroupIds(next);
    if (checked && !tagsByGroup[groupId]) {
      try {
        const result = await apiGet<any>('/user/memberTag/listByGroup', { groupId });
        const list = Array.isArray(result) ? result : result?.list || result?.records || [];
        setTagsByGroup((prev) => ({
          ...prev,
          [groupId]: (list || []).map((item: any) => ({ label: String(item.tagName || item.tag_name || item.name || item.id), value: Number(item.id ?? item.tagId ?? item.tag_id) })),
        }));
      } catch {
        setTagsByGroup((prev) => ({ ...prev, [groupId]: [] }));
      }
    }
    if (!checked) {
      const removedTags = (tagsByGroup[groupId] || []).map((item) => item.value);
      const kept = tagIds.filter((id) => !removedTags.includes(id));
      setTagIds(kept);
      onChange({ scope: 1, userIds: [], users: [], rankIds: [], tagIds: kept, tagMatchMode });
    }
  };

  const activeTabBtn = (key: 'user' | 'tag' | 'rank', label: string) => (
    <Button key={key} theme={tab === key ? 'solid' : 'borderless'} type={tab === key ? 'primary' : 'tertiary'} size="small" onClick={() => changeTab(key)}>
      {label}
    </Button>
  );

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button theme={scope === 0 ? 'solid' : 'borderless'} type={scope === 0 ? 'primary' : 'tertiary'} size="small" onClick={() => changeScope(0)}>
          {t('全部会员')}
        </Button>
        <Button theme={scope === 1 ? 'solid' : 'borderless'} type={scope === 1 ? 'primary' : 'tertiary'} size="small" onClick={() => changeScope(1)}>
          {t('部分会员')}
        </Button>
      </Space>
      {scope === 1 ? (
        <div>
          <Space style={{ marginBottom: 12 }}>
            {activeTabBtn('user', t('指定会员'))}
            {activeTabBtn('tag', t('会员标签'))}
            {activeTabBtn('rank', t('会员等级'))}
          </Space>
          {tab === 'user' ? (
            <Select
              multiple
              filter
              remote
              placeholder={t('输入会员名/手机号搜索')}
              loading={searching}
              optionList={userOptions}
              value={userIds}
              onSearch={(keyword) => void searchUsers(keyword)}
              onChange={(value) => {
                const ids = (value as number[]) || [];
                setUserIds(ids);
                onChange({ scope: 1, userIds: ids, users: ids.map((id) => userMap[id] || { userId: id }), rankIds: [], tagIds: [], tagMatchMode: 0 });
              }}
              style={{ width: '100%' }}
            />
          ) : null}
          {tab === 'rank' ? (
            <Select
              multiple
              placeholder={t('选择会员等级')}
              optionList={ranks}
              value={rankIds}
              onChange={(value) => {
                const ids = (value as number[]) || [];
                setRankIds(ids);
                onChange({ scope: 1, userIds: [], users: [], rankIds: ids, tagIds: [], tagMatchMode: 0 });
              }}
              style={{ width: '100%' }}
            />
          ) : null}
          {tab === 'tag' ? (
            <div>
              <Space style={{ marginBottom: 8 }}>
                <span>{t('标签匹配方式')}</span>
                <Select
                  value={tagMatchMode}
                  optionList={[{ label: t('满足任一'), value: 0 }, { label: t('满足全部'), value: 1 }]}
                  onChange={(next) => {
                    const mode = Number(next || 0);
                    setTagMatchMode(mode);
                    onChange({ scope: 1, userIds: [], users: [], rankIds: [], tagIds, tagMatchMode: mode });
                  }}
                  style={{ width: 140 }}
                />
              </Space>
              {groups.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {groups.map((group) => (
                    <div key={group.groupId}>
                      <Checkbox checked={groupIds.includes(group.groupId)} onChange={(event) => void toggleGroup(group.groupId, Boolean(event.target.checked))}>
                        {group.groupName}
                      </Checkbox>
                      {groupIds.includes(group.groupId) ? (
                        <Select
                          multiple
                          placeholder={t('选择该组标签')}
                          optionList={tagsByGroup[group.groupId] || []}
                          value={tagIds.filter((id) => (tagsByGroup[group.groupId] || []).some((tag) => tag.value === id))}
                          onChange={(value) => {
                            const groupTagIds = (value as number[]) || [];
                            const otherTagIds = tagIds.filter((id) => !(tagsByGroup[group.groupId] || []).some((tag) => tag.value === id));
                            const next = [...otherTagIds, ...groupTagIds];
                            setTagIds(next);
                            onChange({ scope: 1, userIds: [], users: [], rankIds: [], tagIds: next, tagMatchMode });
                          }}
                          style={{ width: '100%', marginTop: 6 }}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <Empty description={t('暂无会员标签')} />
              )}
            </div>
          ) : null}
          <div style={{ marginTop: 8, color: 'var(--semi-color-text-2)', fontSize: 12 }}>
            {t('注：指定会员、会员标签、会员等级三者互斥，切换方式会清空已选内容。')}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** 站内信：对应旧版 user/messageLog/List.vue + Info.vue。 */
export default function MessageLogs() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => setReloadKey((key) => key + 1);

  const recallMessage = (row: MessageLogRow) => {
    Modal.confirm({
      title: t('确认要撤回该条消息吗？'),
      onOk: async () => {
        try {
          await apiPost('/user/userMessageLog/recall', { id: row.messageLogId });
          Toast.success({ content: t('撤回成功') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('撤回失败') });
        }
      },
    });
  };

  const deleteMessage = (row: MessageLogRow) => {
    Modal.confirm({
      title: t('确认删除该条消息吗？'),
      onOk: async () => {
        try {
          await apiPost('/user/userMessageLog/del', { id: row.messageLogId });
          Toast.success({ content: t('删除成功') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
      },
    });
  };

  const columns: ColumnConfig<MessageLogRow>[] = [
    { title: '标题', dataIndex: 'messageTitle', width: 180, render: (value: string) => <span>{value || '-'}</span> },
    { title: '内容', dataIndex: 'messageContent', width: 240, render: (value: string) => <span>{value || '-'}</span> },
    {
      title: 'h5链接',
      dataIndex: 'messageLink',
      width: 150,
      render: (value: string) => (value ? <a href={value} target="_blank" rel="noreferrer">{value}</a> : null),
    },
    {
      title: 'pc链接',
      dataIndex: 'messageLink',
      width: 150,
      render: (value: string) => (value ? <a href={value} target="_blank" rel="noreferrer">{value}</a> : null),
    },
    { title: '发送类型', dataIndex: 'sendTypeName', width: 100, render: (value: string) => <Tag>{value || '-'}</Tag> },
    {
      title: '发送状态',
      dataIndex: 'messageType',
      width: 100,
      render: (value: number, row: MessageLogRow) => (
        <span style={{ color: Number(value) === 0 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)' }}>{row.statusName || '-'}</span>
      ),
    },
    { title: '发送日期', dataIndex: 'sendTime', width: 160 },
  ];

  const drawer: FormDrawerConfig = {
    title: '发送站内信',
    addText: '发送站内信',
    width: 660,
    labelWidth: 110,
    createApi: '/user/userMessageLog/create',
    sections: [
      {
        key: 'basic',
        title: '消息信息',
        fields: [
          { field: 'messageTitle', label: t('标题'), type: 'input', required: true },
          { field: 'messageContent', label: t('内容'), type: 'textarea', required: true },
          {
            field: 'messageLinkValue',
            label: t('链接'),
            type: 'custom',
            span: 24,
            render: ({ formApi, values }) => (
              <LinkField
                value={values.messageLinkValue as LinkValue}
                onChange={(next) => {
                  formApi.setValue('messageLinkValue', next);
                  formApi.setValue('messageLink', (next && (next.link || next.path)) || '');
                }}
                placeholder={t('请选择跳转链接（可选）')}
              />
            ),
          },
          {
            field: 'sendUserTarget',
            label: t('发送会员'),
            type: 'custom',
            initValue: EMPTY_TARGET,
            span: 24,
            render: ({ formApi, values }) => (
              <MessageAudienceSelector
                value={(values.sendUserTarget as SendUserTarget) || EMPTY_TARGET}
                onChange={(next) => formApi.setValue('sendUserTarget', next)}
              />
            ),
          },
        ],
      },
    ],
    toPayload: (values) => {
      if (!String(values.messageTitle || '').trim()) throw new Error(t('标题不能为空!'));
      if (!String(values.messageContent || '').trim()) throw new Error(t('内容不能为空!'));
      const target = (values.sendUserTarget as SendUserTarget) || EMPTY_TARGET;
      const payload: Record<string, unknown> = { ...values, sendUserTarget: target, userIds: '', userRank: 0 };
      if (target.scope === 0) return { ...payload, sendUserType: 0 };
      if (target.userIds.length === 1) return { ...payload, sendUserType: 1, userIds: String(target.userIds[0]) };
      if (target.userIds.length > 1) {
        return { ...payload, sendUserType: 3, userIds: target.users.map((user) => user.username ?? '').join(',') };
      }
      if (target.tagIds.length > 0) return { ...payload, sendUserType: 4 };
      if (target.rankIds.length > 0) return { ...payload, sendUserType: 2, userRank: target.rankIds[0] };
      return { ...payload, sendUserType: 0 };
    },
  };

  return (
    <ListPage<MessageLogRow>
      key={reloadKey}
      api="/user/userMessageLog/list"
      rowKey="messageLogId"
      pageSize={10}
      selectable
      actionWidth={150}
      columns={columns}
      batchActions={(rows, clear) => (
        <Button
          size="small"
          onClick={() => {
            Modal.confirm({
              title: t('您确认要批量撤回所选数据吗？'),
              onOk: async () => {
                try {
                  await apiPost('/user/userMessageLog/batch', { ids: rows.map((row) => row.messageLogId), type: 'recall' });
                  Toast.success({ content: t('批量撤回成功') });
                  clear();
                  reload();
                } catch (error) {
                  Toast.error({ content: error instanceof Error ? error.message : t('批量撤回失败') });
                }
              },
            });
          }}
        >
          {t('批量撤回')}
        </Button>
      )}
      rowActions={(row) => (
        <Space spacing={2}>
          {Number(row.isRecall ?? 0) === 0 ? (
            <Button theme="borderless" type="danger" size="small" onClick={() => recallMessage(row)}>{t('撤回')}</Button>
          ) : null}
          <Button theme="borderless" type="danger" size="small" onClick={() => deleteMessage(row)}>{t('删除')}</Button>
        </Space>
      )}
      drawer={drawer}
    />
  );
}
