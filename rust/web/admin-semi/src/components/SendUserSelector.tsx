/**
 * 发送人群圈选组件（SendUserSelector）：对应原版 components/SendUserSelector。
 *
 * - 全部会员 / 部分会员 两级范围
 * - 部分会员支持「指定会员」「会员标签」「会员等级」三种方式（互斥，切换清空）
 * - 指定会员走 /user/user/list 搜索；会员标签复用 TagFilter；会员等级走 /user/userRank/list
 *
 * getResult() 返回 SendUserTarget 契约（scope/userIds/users/rankIds/tagIds/tagMatchMode），
 * 由调用方按后端 DTO（memberRange / memberMarks / sendUserTarget）组装提交载荷。
 */

import { useEffect, useState } from 'react';
import { Avatar, Button, Input, Modal, Radio, RadioGroup, Space, Spin, Table, Tag, Toast } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { apiGet } from '../api';
import { useI18n } from '../i18n';
import TagFilter from '../framework/TagFilter';

export interface SendUserTargetUser {
  userId: number;
  username: string;
  mobile?: string;
}

export interface SendUserTarget {
  /** 发送范围：0-全部会员，1-部分会员 */
  scope: number;
  userIds: number[];
  users: SendUserTargetUser[];
  rankIds: number[];
  tagIds: number[];
  /** 标签匹配模式：0-满足任一，1-满足全部 */
  tagMatchMode: number;
}

type TabKey = 'user' | 'tag' | 'rank';

interface UserRow {
  userId?: number;
  username?: string;
  mobile?: string;
  avatar?: string;
}

export default function SendUserSelector({
  value,
  onChange,
}: {
  value?: SendUserTarget;
  onChange?: (target: SendUserTarget) => void;
}) {
  const { t } = useI18n();
  const [scope, setScope] = useState<number>(value?.scope ?? 0);
  const [tab, setTab] = useState<TabKey>('user');
  // 指定会员
  const [users, setUsers] = useState<SendUserTargetUser[]>(value?.users || []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [userRows, setUserRows] = useState<UserRow[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userLoading, setUserLoading] = useState(false);
  // 会员标签
  const [tagIds, setTagIds] = useState<number[]>(value?.tagIds || []);
  const [tagMatchMode, setTagMatchMode] = useState<number>(value?.tagMatchMode ?? 0);
  // 会员等级
  const [ranks, setRanks] = useState<SendUserTargetUser[]>(value?.rankIds?.map((id) => ({ userId: id, username: `等级${id}` })) || []);
  const [rankRows, setRankRows] = useState<Array<{ rankId: number; rankName: string }>>([]);
  const [rankPickerOpen, setRankPickerOpen] = useState(false);

  useEffect(() => {
    apiGet<any>('/user/userRank/list', { page: 1, size: 50 })
      .then((result) => {
        const records = result?.userRank?.records || result?.records || [];
        setRankRows(records.map((row: any) => ({ rankId: row.rankId, rankName: row.rankName || `等级${row.rankId}` })));
      })
      .catch(() => undefined);
  }, []);

  const searchUsers = (page = 1) => {
    setUserPage(page);
    setUserLoading(true);
    apiGet<any>('/user/user/list', { page, size: 10, keyword: keyword.trim() || undefined })
      .then((result) => {
        setUserRows(result?.records || []);
        setUserTotal(Number(result?.total || 0));
      })
      .catch((error) => Toast.error({ content: error?.message || t('加载会员失败') }))
      .finally(() => setUserLoading(false));
  };

  const emit = (next?: Partial<SendUserTarget>) => {
    const target: SendUserTarget = {
      scope,
      userIds: tab === 'user' && scope === 1 ? users.map((item) => item.userId) : [],
      users: tab === 'user' && scope === 1 ? users : [],
      rankIds: tab === 'rank' && scope === 1 ? ranks.map((item) => item.userId) : [],
      tagIds: tab === 'tag' && scope === 1 ? tagIds : [],
      tagMatchMode,
      ...next,
    };
    onChange?.(target);
  };

  const switchScope = (next: number) => {
    setScope(next);
    if (next === 0) {
      setUsers([]);
      setTagIds([]);
      setRanks([]);
      emit({ scope: 0, userIds: [], users: [], tagIds: [], rankIds: [] });
    } else {
      emit({ scope: 1 });
    }
  };

  const switchTab = (next: TabKey) => {
    setTab(next);
    // 三者互斥：切换方式清空其它已选
    setUsers(next === 'user' ? users : []);
    setTagIds(next === 'tag' ? tagIds : []);
    setRanks(next === 'rank' ? ranks : []);
    emit();
  };

  const addUser = (row: UserRow) => {
    if (!row.userId) return;
    if (users.some((item) => item.userId === row.userId)) return;
    const next = [...users, { userId: row.userId, username: row.username || `#${row.userId}`, mobile: row.mobile }];
    setUsers(next);
    emit({ userIds: next.map((item) => item.userId), users: next });
  };

  const removeUser = (userId: number) => {
    const next = users.filter((item) => item.userId !== userId);
    setUsers(next);
    emit({ userIds: next.map((item) => item.userId), users: next });
  };

  const toggleRank = (rankId: number, rankName: string) => {
    const exists = ranks.some((item) => item.userId === rankId);
    const next = exists ? ranks.filter((item) => item.userId !== rankId) : [...ranks, { userId: rankId, username: rankName }];
    setRanks(next);
    emit({ rankIds: next.map((item) => item.userId) });
  };

  const tabCount = (key: TabKey) => {
    if (key === 'user') return users.length;
    if (key === 'tag') return tagIds.length;
    return ranks.length;
  };

  return (
    <div className="send-user-selector">
      <RadioGroup value={scope} onChange={(event) => switchScope(Number(event.target.value))}>
        <Radio value={0}>{t('全部会员')}</Radio>
        <Radio value={1}>{t('部分会员')}</Radio>
      </RadioGroup>

      {scope === 1 && (
        <div className="send-user-selector-body">
          <Space style={{ marginBottom: 10 }}>
            {(['user', 'tag', 'rank'] as TabKey[]).map((key) => (
              <Button
                key={key}
                size="small"
                theme={tab === key ? 'solid' : 'borderless'}
                type={tab === key ? 'primary' : 'tertiary'}
                onClick={() => switchTab(key)}
              >
                {key === 'user' ? t('指定会员') : key === 'tag' ? t('会员标签') : t('会员等级')}
                {tabCount(key) > 0 ? ` (${tabCount(key)})` : ''}
              </Button>
            ))}
          </Space>

          {tab === 'user' && (
            <div>
              <Button size="small" onClick={() => { setPickerOpen(true); searchUsers(1); }}>
                {t('选择会员')}
              </Button>
              <div style={{ marginTop: 8 }}>
                {users.map((item) => (
                  <Tag
                    key={item.userId}
                    closable
                    onClose={() => removeUser(item.userId)}
                    style={{ marginBottom: 4 }}
                  >
                    {item.username}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {tab === 'tag' && (
            <div>
              <RadioGroup
                value={tagMatchMode}
                onChange={(event) => setTagMatchMode(Number(event.target.value))}
                style={{ marginBottom: 8 }}
              >
                <Radio value={0}>{t('满足任一标签')}</Radio>
                <Radio value={1}>{t('满足全部标签')}</Radio>
              </RadioGroup>
              <TagFilter
                value={tagIds}
                onChange={(next) => {
                  setTagIds(next as number[]);
                  emit({ tagIds: next as number[] });
                }}
                width={320}
              />
            </div>
          )}

          {tab === 'rank' && (
            <div>
              <Button size="small" onClick={() => setRankPickerOpen(true)}>
                {t('选择等级')}
              </Button>
              <div style={{ marginTop: 8 }}>
                {ranks.map((item) => (
                  <Tag key={item.userId} style={{ marginBottom: 4 }}>
                    {item.username}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          <div className="send-user-selector-note">{t('注：指定会员、会员标签、会员等级三者互斥，一次只能按其中一种方式圈选，切换方式会清空已选内容')}</div>
        </div>
      )}

      {/* 指定会员选择弹窗 */}
      <Modal
        title={t('选择会员')}
        visible={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        footer={null}
        width={640}
      >
        <Space style={{ marginBottom: 10 }}>
          <Input
            prefix={<IconSearch />}
            style={{ width: 240 }}
            placeholder={t('搜索会员名称 / 手机号')}
            value={keyword}
            showClear
            onClear={() => setKeyword('')}
            onChange={setKeyword}
            onEnterPress={() => searchUsers(1)}
          />
          <Button theme="solid" type="primary" onClick={() => searchUsers(1)}>
            {t('搜索')}
          </Button>
        </Space>
        <Table<UserRow>
          loading={userLoading}
          dataSource={userRows}
          rowKey="userId"
          pagination={{ currentPage: userPage, pageSize: 10, total: userTotal, onChange: (next) => searchUsers(next) }}
          columns={[
            {
              title: t('会员'),
              dataIndex: 'username',
              render: (value: string, record: UserRow) => (
                <Space>
                  <Avatar size="extra-small" src={record.avatar} alt="">
                    {(value || '?').slice(0, 1)}
                  </Avatar>
                  <span>{value || '--'}</span>
                </Space>
              ),
            },
            { title: t('手机号'), dataIndex: 'mobile', width: 140, render: (v: string) => v || '--' },
            {
              title: t('操作'),
              width: 80,
              render: (_v: unknown, record: UserRow) =>
                users.some((item) => item.userId === record.userId) ? (
                  <Tag color="blue">{t('已选')}</Tag>
                ) : (
                  <Button size="small" onClick={() => addUser(record)}>
                    {t('添加')}
                  </Button>
                ),
            },
          ] as any}
        />
      </Modal>

      {/* 会员等级选择弹窗 */}
      <Modal
        title={t('选择等级')}
        visible={rankPickerOpen}
        onCancel={() => setRankPickerOpen(false)}
        footer={null}
        width={480}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {rankRows.map((rank) => {
            const selected = ranks.some((item) => item.userId === rank.rankId);
            return (
              <Tag
                key={rank.rankId}
                color={selected ? 'blue' : 'white'}
                style={{ cursor: 'pointer' }}
                onClick={() => toggleRank(rank.rankId, rank.rankName)}
              >
                {rank.rankName}
              </Tag>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

void Spin;
