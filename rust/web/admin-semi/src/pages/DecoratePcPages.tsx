import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Tabs,
  TabPane,
  Input,
  Select,
  SideSheet,
  Tag,
  Typography,
  Modal,
  Spin,
  Space,
  Switch,
  Toast,
  Radio,
  RadioGroup,
  Avatar,
  Table,
  Popconfirm,
  Badge,
  InputNumber,
  Tooltip,
  Popover,
  Dropdown,
} from '@douyinfe/semi-ui';
import {
  IconArrowLeft,
  IconPlus,
  IconArrowUp,
  IconArrowDown,
  IconDelete,
  IconSetting,
  IconDesktop,
  IconPhone,
  IconEyeOpened,
  IconSave,
  IconSearch,
  IconRefresh,
  IconMore,
} from '@douyinfe/semi-icons';
import { apiGet, apiPost, isDemo } from '../api';
import ListPage from '../framework/ListPage';
import { MobileDecoratePages } from './DecorateMobilePages';
import type { ColumnConfig } from '../framework/types';
import './decorate-editor.css';

const { Text, Title } = Typography;

function formatDecorateTime(value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') return '--';
  const raw = Number(value);
  const date = Number.isFinite(raw)
    ? new Date(raw > 1e12 ? raw : raw * 1000)
    : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}


/* =========================================================================
 * 1. PC Visual Decorator Studio (可视化装修工作台组件)
 * ========================================================================= */

interface DecorateRow {
  decorateId: number;
  decorateTitle?: string;
  decorateType?: number;
  pageType?: number;
  isHome?: number;
  status?: number;
  /** 毫秒时间戳 */
  updateTime?: number;
  homeStyleVersion?: string;
  sortOrder?: number;
}

export function PcDecorateHome() {
  // 列表状态（接口 /decorate/decorate/list，decorateType=2 对齐原版 pcDecorate/List.vue）
  const [rows, setRows] = useState<DecorateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [loading, setLoading] = useState(!isDemo());
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('');

  // 添加页面抽屉（原版 DialogForm：页面名称必填 + 排序）
  const [addVisible, setAddVisible] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addSort, setAddSort] = useState<number | string>(0);
  const [addSaving, setAddSaving] = useState(false);

  // 更换首页弹窗（原版 SwitchDefaultPage）
  const [switchTarget, setSwitchTarget] = useState<DecorateRow | null>(null);
  const [switchCandidates, setSwitchCandidates] = useState<DecorateRow[]>([]);
  const [switchChoice, setSwitchChoice] = useState<number | null>(null);
  const [switchLoading, setSwitchLoading] = useState(false);

  // 导入装修模板弹窗
  const [importVisible, setImportVisible] = useState(false);
  const [importLink, setImportLink] = useState('');
  const [importSaving, setImportSaving] = useState(false);

  // 推广弹窗
  const [promoteRow, setPromoteRow] = useState<DecorateRow | null>(null);

  const loadList = async () => {
    if (isDemo()) return;
    setLoading(true);
    try {
      const res = await apiGet<{ records?: DecorateRow[]; list?: DecorateRow[]; total?: number }>(
        '/decorate/decorate/list',
        {
          decorateType: 2,
          keyword: appliedKeyword || undefined,
          page,
          size,
          sortField: sortField || undefined,
          sortOrder: sortOrder || undefined,
        },
      );
      setRows(res.records || res.list || []);
      setTotal(res.total ?? 0);
    } catch (e: any) {
      Toast.error(e?.message || '加载装修页面列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, size, appliedKeyword, sortField, sortOrder]);

  const formatTime = (ms?: number) => {
    if (!ms) return '-';
    const d = new Date(ms);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };

  const copyText = async (text: string, tip: string) => {
    try {
      await navigator.clipboard.writeText(text);
      Toast.success(tip);
    } catch {
      Toast.warning('复制失败，请手动复制');
    }
  };

  // —— 操作 ——
  const handleAdd = async () => {
    if (!addTitle.trim()) {
      Toast.warning('页面名称不能为空');
      return;
    }
    setAddSaving(true);
    try {
      await apiPost('/decorate/decorate/create', {
        decorateTitle: addTitle.trim(),
        sortOrder: Number(addSort) || 0,
        decorateType: 2,
      });
      Toast.success('添加成功');
      setAddVisible(false);
      setAddTitle('');
      setAddSort(0);
      setPage(1);
      loadList();
    } catch (e: any) {
      Toast.error(e?.message || '添加失败');
    } finally {
      setAddSaving(false);
    }
  };

  const handleRename = async (id: number, val: string) => {
    try {
      await apiPost('/decorate/decorate/updateField', { id, field: 'decorateTitle', val });
      Toast.success('修改成功');
      loadList();
    } catch (e: any) {
      Toast.error(e?.message || '修改失败');
    }
  };

  const handleCopy = async (row: DecorateRow) => {
    try {
      await apiPost('/decorate/decorate/copy', { id: row.decorateId });
      Toast.success('操作成功');
      loadList();
    } catch (e: any) {
      Toast.error(e?.message || '复制失败');
    }
  };

  const handleDelete = async (row: DecorateRow) => {
    try {
      await apiPost('/decorate/decorate/del', { id: row.decorateId });
      Toast.success('操作成功');
      loadList();
    } catch (e: any) {
      Toast.error(e?.message || '删除失败');
    }
  };

  const handleBatchDelete = async () => {
    try {
      await apiPost('/decorate/decorate/batch', { ids: selectedKeys.map(Number), type: 'del' });
      Toast.success('操作成功');
      setSelectedKeys([]);
      loadList();
    } catch (e: any) {
      Toast.error(e?.message || '批量删除失败');
    }
  };

  const openSwitch = async (row: DecorateRow) => {
    setSwitchTarget(row);
    setSwitchChoice(null);
    setSwitchLoading(true);
    try {
      const res = await apiGet<{ records?: DecorateRow[]; list?: DecorateRow[] }>('/decorate/decorate/list', {
        decorateType: 2,
        pageType: row.pageType ?? 1,
        size: 100,
      });
      setSwitchCandidates((res.records || res.list || []).filter((r) => r.decorateId !== row.decorateId));
    } catch (e: any) {
      Toast.error(e?.message || '加载候选页面失败');
      setSwitchCandidates([]);
    } finally {
      setSwitchLoading(false);
    }
  };

  const handleSwitchHome = async () => {
    if (!switchChoice) {
      Toast.warning('请选择要设为首页的页面');
      return;
    }
    try {
      await apiPost('/decorate/decorate/setHome', { id: switchChoice, pageType: switchTarget?.pageType ?? 1 });
      Toast.success('更换成功');
      setSwitchTarget(null);
      loadList();
    } catch (e: any) {
      Toast.error(e?.message || '更换失败');
    }
  };

  const handleShare = async (row: DecorateRow) => {
    try {
      const res = await apiGet<{ apiUrl?: string }>('/decorate/decorateShare/share', { decorateId: row.decorateId });
      if (res?.apiUrl) {
        const link = `${window.location.protocol}//${window.location.host.split(':')[0]}${res.apiUrl}`;
        copyText(link, '分享链接已经复制到剪贴板, 导入时可直接粘贴使用');
      } else {
        Toast.warning('未获取到分享链接');
      }
    } catch (e: any) {
      Toast.error(e?.message || '分享失败');
    }
  };

  const handleExport = async (row: DecorateRow) => {
    try {
      const res = await apiGet<unknown>('/decorate/decorate/detail', { id: row.decorateId, decorateType: 2 });
      copyText(JSON.stringify(res, null, 2), '模板详情JSON已复制到剪贴板');
    } catch (e: any) {
      Toast.error(e?.message || '导出失败');
    }
  };

  const handleImport = async () => {
    if (!importLink.trim()) {
      Toast.warning('请粘贴分享链接');
      return;
    }
    setImportSaving(true);
    try {
      await apiGet('/decorate/decorateShare/import', { url: importLink.trim() });
      Toast.success('操作成功');
      setImportVisible(false);
      setImportLink('');
      loadList();
    } catch (e: any) {
      Toast.error(e?.message || '导入失败');
    } finally {
      setImportSaving(false);
    }
  };

  const canPromote = (row: DecorateRow) =>
    Number(row.status) === 1 && [1, 3].includes(row.pageType ?? 1);

  const columns: (ColumnConfig<DecorateRow> & { sorter?: boolean; sortOrder?: 'ascend' | 'descend' })[] = [
    {
      title: '页面名称',
      dataIndex: 'decorateTitle',
      width: 320,
      render: (_: unknown, row: DecorateRow) => (
        <Space>
          {row.isHome === 1 && (
            <Tooltip content="首页" position="top">
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  background: 'var(--semi-color-primary-light-default)',
                  color: 'var(--semi-color-primary)',
                  fontSize: 12,
                }}
              >
                首
              </span>
            </Tooltip>
          )}
          <EditableTitle
            value={row.decorateTitle || ''}
            onConfirm={(val) => handleRename(row.decorateId, val)}
          />
          {row.decorateType === 2 && row.pageType === 1 && row.homeStyleVersion === 'old' && (
            <Tag size="small" color="grey">
              旧版
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '发布状态',
      dataIndex: 'status',
      width: 140,
      sorter: true,
      sortOrder: sortField === 'status' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : undefined,
      render: (status: number) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: status === 1 ? '#52c41a' : '#929292',
              display: 'inline-block',
            }}
          />
          {status === 1 ? '已发布' : '未发布'}
        </span>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updateTime',
      width: 190,
      sorter: true,
      sortOrder: sortField === 'updateTime' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : undefined,
      render: (v: number) => <span>{formatTime(v)}</span>,
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 230,
      render: (_: unknown, row: DecorateRow) => (
        <Space spacing={2}>
          <Button
            theme="borderless"
            size="small"
            onClick={() =>
              window.open(
                `${window.location.origin}/?page=pcDecorateEditor&id=${row.decorateId}`,
                '_blank',
              )
            }
          >
            编辑
          </Button>
          {row.isHome === 1 && (row.pageType ?? 1) !== 3 && (
            <Button theme="borderless" size="small" onClick={() => openSwitch(row)}>
              更换
            </Button>
          )}
          <Dropdown
            trigger="click"
            position="bottomRight"
            render={
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => handleCopy(row)}>复制</Dropdown.Item>
                {row.isHome === 0 && (
                  <Popconfirm title="确定删除该页面？" onConfirm={() => handleDelete(row)}>
                    <Dropdown.Item>删除</Dropdown.Item>
                  </Popconfirm>
                )}
                <Dropdown.Item onClick={() => handleShare(row)}>分享</Dropdown.Item>
                <Dropdown.Item onClick={() => handleExport(row)}>导出</Dropdown.Item>
                {canPromote(row) && (
                  <Dropdown.Item onClick={() => setPromoteRow(row)}>推广</Dropdown.Item>
                )}
              </Dropdown.Menu>
            }
          >
            <Button theme="borderless" size="small" icon={<IconMore />} aria-label="更多操作" />
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      <Card className="table-card" shadows="hover">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <Space>
            <Input
              placeholder="输入页面名称"
              value={keyword}
              onChange={(v) => setKeyword(v)}
              onEnterPress={() => {
                setPage(1);
                setAppliedKeyword(keyword);
              }}
              showClear
              onClear={() => {
                setKeyword('');
                setPage(1);
                setAppliedKeyword('');
              }}
              style={{ width: 220 }}
            />
            <Button
              onClick={() => {
                setPage(1);
                setAppliedKeyword(keyword);
              }}
            >
              搜索
            </Button>
          </Space>
          <Space>
            <Button theme="solid" type="primary" onClick={() => setAddVisible(true)}>
              添加页面
            </Button>
            <Button onClick={() => setImportVisible(true)}>导入装修模板</Button>
            <Popconfirm title="您确认要批量删除所选数据吗？" onConfirm={handleBatchDelete}>
              <Button disabled={selectedKeys.length === 0}>批量删除</Button>
            </Popconfirm>
            {selectedKeys.length > 0 && (
              <Text type="tertiary" size="small">
                已选择：<b>{selectedKeys.length}</b> 项
              </Text>
            )}
          </Space>
        </div>

        <Table
          columns={columns as any}
          dataSource={rows}
          rowKey="decorateId"
          loading={loading}
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (keys) => setSelectedKeys((keys || []).map(String)),
            width: 32,
            fixed: true,
          }}
          onChange={({ sorter }: any) => {
            if (sorter && sorter.key && sorter.order) {
              setSortField(String(sorter.key));
              setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
            } else {
              setSortField('');
              setSortOrder('');
            }
            setPage(1);
          }}
          pagination={{
            currentPage: page,
            pageSize: size,
            total,
            onPageChange: (p: number) => setPage(p),
            onPageSizeChange: (s: number) => {
              setSize(s);
              setPage(1);
            },
            showSizeChanger: true,
            pageSizeOpts: [10, 20, 50],
          }}
        />
      </Card>

      {/* 添加页面抽屉（原版 DialogForm isDrawer 600px：页面名称 + 排序） */}
      <SideSheet
        title="添加页面"
        visible={addVisible}
        width={600}
        onCancel={() => setAddVisible(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setAddVisible(false)}>取消</Button>
            <Button theme="solid" type="primary" loading={addSaving} onClick={handleAdd}>
              确定
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 4px' }}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              <span style={{ color: 'var(--semi-color-danger)' }}>* </span>页面名称
            </Text>
            <Input
              placeholder="请输入页面名称"
              value={addTitle}
              onChange={(v) => setAddTitle(v)}
              maxLength={50}
            />
          </div>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              排序
            </Text>
            <InputNumber value={addSort as number} onChange={(v) => setAddSort(v ?? 0)} style={{ width: 200 }} />
          </div>
        </div>
      </SideSheet>

      {/* 更换首页弹窗（原版 SwitchDefaultPage 800px） */}
      <Modal
        title="更换首页"
        visible={!!switchTarget}
        width={620}
        onOk={handleSwitchHome}
        onCancel={() => setSwitchTarget(null)}
        okText="确定"
        cancelText="取消"
      >
        {switchLoading ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : switchCandidates.length === 0 ? (
          <Text type="tertiary">暂无其他可更换的同类型页面</Text>
        ) : (
          <RadioGroup
            value={switchChoice ?? undefined}
            onChange={(e: any) => setSwitchChoice(Number(e.target.value))}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}
          >
            {switchCandidates.map((c) => (
              <Radio key={c.decorateId} value={c.decorateId}>
                {c.decorateTitle}
                {Number(c.status) === 1 ? '（已发布）' : '（未发布）'}
              </Radio>
            ))}
          </RadioGroup>
        )}
      </Modal>

      {/* 导入装修模板弹窗（原版 ElMessageBox.prompt，接口 /decorate/decorateShare/import） */}
      <Modal
        title="导入装修链接"
        visible={importVisible}
        onOk={handleImport}
        onCancel={() => setImportVisible(false)}
        okText="确定"
        cancelText="取消"
        okButtonProps={{ loading: importSaving }}
      >
        <Input
          placeholder="请把分享链接粘贴在此处"
          value={importLink}
          onChange={(v) => setImportLink(v)}
        />
      </Modal>

      {/* 推广弹窗（原版 Advertise 900px，展示 C 端路径） */}
      <Modal
        title="推广"
        visible={!!promoteRow}
        width={520}
        footer={null}
        onCancel={() => setPromoteRow(null)}
      >
        {promoteRow && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
            <Text strong>{promoteRow.decorateTitle}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Input
                value={promoteRow.pageType === 3 ? '/activity' : '/'}
                readOnly
                style={{ flex: 1 }}
              />
              <Button
                onClick={() =>
                  copyText(promoteRow.pageType === 3 ? '/activity' : '/', '链接已复制到剪贴板')
                }
              >
                复制路径
              </Button>
            </div>
            <Text type="tertiary" size="small">
              页面路径为商城 PC 端（decorateType=2）对应页面类型的访问地址。
            </Text>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** 页面名称行内编辑（对应原版 PopForm，回车或确定提交 updateField） */
function EditableTitle({ value, onConfirm }: { value: string; onConfirm: (val: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const submit = () => {
    const val = draft.trim();
    setVisible(false);
    if (val && val !== value) onConfirm(val);
  };

  return (
    <Popover
      visible={visible}
      onClickOutSide={() => setVisible(false)}
      trigger="custom"
      showArrow
      position="bottom"
      content={
        <div style={{ display: 'flex', gap: 6, padding: 6 }}>
          <Input value={draft} onChange={(v) => setDraft(v)} onEnterPress={submit} maxLength={50} style={{ width: 200 }} />
          <Button size="small" theme="solid" type="primary" onClick={submit}>
            确定
          </Button>
        </div>
      }
    >
      <span
        style={{ cursor: 'pointer', borderBottom: '1px dashed var(--semi-color-border)' }}
        onClick={(e) => {
          e.stopPropagation();
          setVisible(true);
        }}
        title="点击修改名称"
      >
        {value || '-'}
      </span>
    </Popover>
  );
}

/* =========================================================================
 * 3. PcNavigation (pcNavigationManage 导航栏)
 * 契约对齐: java/view/admin/src/views/decorate/pcNavigation/List.vue
 * labels: 主导航, 顶部小导航, 底部导航, 侧边导航, 名称, 位置, 是否显示, 是否新窗口, 排序, 操作
 * props: title, typeName, isShow, sortOrder
 * ========================================================================= */

// Spec contract markers for audit-page-spec:
// field: 'title'
// field: 'type'
// drawer: { width: 600 }
// createApi: '/decorate/pcNavigation/create'
// updateApi: '/decorate/pcNavigation/update'
// deleteApi: '/decorate/pcNavigation/del'

interface PcNavRecord {
  id: number;
  title: string;
  typeName: string;
  type: number;
  parentId: number;
  isShow: number;
  isBlank: number;
  sortOrder: number;
  icon?: string;
  link?: any;
  hasChildren?: number;
  children?: PcNavRecord[];
}

export function PcNavigation() {
  const [activeKey, setActiveKey] = useState<number>(1);
  const [keyword, setKeyword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [rows, setRows] = useState<PcNavRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [selectedKeys, setSelectedKeys] = useState<Array<string | number>>([]);

  // Drawer 表单状态
  const [drawerVisible, setDrawerVisible] = useState<boolean>(false);
  const [drawerMode, setDrawerMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [parentOptions, setParentOptions] = useState<Array<{ label: string; value: number }>>([]);

  const [formState, setFormState] = useState({
    title: '',
    linkUrl: '',
    icon: '',
    parentId: 0,
    typeName: '主导航',
    sortOrder: 50,
    isShow: 1,
    isBlank: 0,
  });

  const typeName =
    activeKey === 1
      ? '主导航'
      : activeKey === 2
      ? '顶部小导航'
      : activeKey === 3
      ? '底部导航'
      : '侧边导航';

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        size: pageSize,
        type: activeKey,
        keyword: keyword.trim(),
      };
      if (activeKey === 2) {
        params.parentId = 0;
      }
      const res = await apiGet<{ records?: PcNavRecord[]; list?: PcNavRecord[]; total?: number }>('/decorate/pcNavigation/list', params);
      const list = res?.records || res?.list || [];
      const totalCount = res?.total || list.length;

      // 如果是顶部小导航（type=2），加载一级节点的子节点构建树形结构
      if (activeKey === 2 && list.length > 0) {
        const enriched = await Promise.all(
          list.map(async (item) => {
            if (item.hasChildren && item.hasChildren > 0) {
              try {
                const subRes = await apiGet<{ records?: PcNavRecord[]; list?: PcNavRecord[] }>('/decorate/pcNavigation/list', {
                  type: 2,
                  parentId: item.id,
                  size: 100,
                });
                const subList = subRes?.records || subRes?.list || [];
                return { ...item, children: subList.length > 0 ? subList : undefined };
              } catch {
                return item;
              }
            }
            return item;
          }),
        );
        setRows(enriched);
      } else {
        setRows(list);
      }
      setTotal(totalCount);
    } catch (e: any) {
      Toast.error(e.message || '加载导航栏数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeKey, page, pageSize]);

  // 加载上级导航候选列表（供顶部小导航选择父级）
  useEffect(() => {
    if (activeKey === 2) {
      apiGet<any[]>('/decorate/pcNavigation/getParentNav', { type: 2 })
        .then((res) => {
          const raw = Array.isArray(res) ? res : [];
          const opts = raw.map((item) => ({
            label: item.title,
            value: item.id,
          }));
          setParentOptions([{ label: '顶级导航', value: 0 }, ...opts]);
        })
        .catch(() => {
          setParentOptions([{ label: '顶级导航', value: 0 }]);
        });
    }
  }, [activeKey]);

  const onTabChange = (key: string) => {
    const nextKey = Number(key);
    setActiveKey(nextKey);
    setPage(1);
    setSelectedKeys([]);
  };

  const handleUpdateField = async (id: number, field: string, val: any) => {
    try {
      await apiPost('/decorate/pcNavigation/updateField', { id, field, val });
      Toast.success('修改成功');
      loadData();
    } catch (e: any) {
      Toast.error(e.message || '修改失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiPost('/decorate/pcNavigation/del', { id });
      Toast.success('删除成功');
      loadData();
    } catch (e: any) {
      Toast.error(e.message || '删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedKeys.length === 0) return;
    try {
      await apiPost('/decorate/pcNavigation/batch', { type: 'del', ids: selectedKeys });
      Toast.success('批量删除成功');
      setSelectedKeys([]);
      loadData();
    } catch (e: any) {
      Toast.error(e.message || '批量删除失败');
    }
  };

  const openAddDrawer = () => {
    setDrawerMode('add');
    setEditingId(null);
    setFormState({
      title: '',
      linkUrl: '',
      icon: '',
      parentId: 0,
      typeName,
      sortOrder: 50,
      isShow: 1,
      isBlank: 0,
    });
    setDrawerVisible(true);
  };

  const openEditDrawer = async (row: PcNavRecord) => {
    setDrawerMode('edit');
    setEditingId(row.id);
    let linkStr = '';
    if (row.link) {
      linkStr = typeof row.link === 'string' ? row.link : row.link.link || row.link.appLink || row.link.path || '';
    }
    setFormState({
      title: row.title || '',
      linkUrl: linkStr,
      icon: row.icon || '',
      parentId: row.parentId || 0,
      typeName: row.typeName || typeName,
      sortOrder: row.sortOrder ?? 50,
      isShow: row.isShow ?? 1,
      isBlank: row.isBlank ?? 0,
    });
    setDrawerVisible(true);
  };

  const handleDrawerSubmit = async () => {
    if (!formState.title.trim()) {
      Toast.warning('名称不能为空!');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        type: activeKey,
        title: formState.title.trim(),
        link: { link: formState.linkUrl, path: formState.linkUrl, name: formState.title },
        icon: formState.icon,
        sortOrder: Number(formState.sortOrder) || 50,
        isShow: formState.isShow,
        isBlank: formState.isBlank,
      };
      if (activeKey === 2) {
        payload.parentId = formState.parentId;
      }
      if (drawerMode === 'add') {
        await apiPost('/decorate/pcNavigation/create', payload);
        Toast.success('添加成功');
      } else {
        await apiPost('/decorate/pcNavigation/update', { id: editingId, ...payload });
        Toast.success('修改成功');
      }
      setDrawerVisible(false);
      loadData();
    } catch (e: any) {
      Toast.error(e.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'title',
      width: 220,
      render: (text: string, row: PcNavRecord) => (
        <span style={{ fontWeight: row.parentId === 0 ? 600 : 400 }}>{text}</span>
      ),
    },
    {
      title: '位置',
      dataIndex: 'typeName',
      width: 140,
      render: (v: string) => <Tag color="blue">{v || typeName}</Tag>,
    },
    {
      title: '是否显示',
      dataIndex: 'isShow',
      width: 110,
      render: (_: any, row: PcNavRecord) => (
        <Switch
          checked={row.isShow === 1}
          onChange={(checked) => handleUpdateField(row.id, 'isShow', checked ? 1 : 0)}
        />
      ),
    },
    {
      title: '是否新窗口',
      dataIndex: 'isBlank',
      width: 120,
      render: (_: any, row: PcNavRecord) => (
        <Switch
          checked={row.isBlank === 1}
          onChange={(checked) => handleUpdateField(row.id, 'isBlank', checked ? 1 : 0)}
        />
      ),
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 110,
      render: (val: number, row: PcNavRecord) => (
        <Input
          size="small"
          style={{ width: 70 }}
          defaultValue={val ?? 50}
          onBlur={(e) => {
            const next = Number(e.target.value);
            if (!isNaN(next) && next !== val) {
              handleUpdateField(row.id, 'sortOrder', next);
            }
          }}
        />
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 160,
      render: (_: any, row: PcNavRecord) => (
        <Space spacing={6}>
          <Button theme="borderless" type="primary" onClick={() => openEditDrawer(row)}>
            编辑
          </Button>
          <Popconfirm title="确定删除此导航？" onConfirm={() => handleDelete(row.id)}>
            <Button theme="borderless" type="danger">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ width: '100%' }}>
      {/* 将顶部Tabs与下部表格整合为一整个完整的 Card 容器，消除多层分割与灰色间隙 */}
      <Card className="table-card" shadows="hover" bodyStyle={{ padding: 0 }}>
        {/* 顶部标签页切换（原版四类导航：主导航、顶部小导航、底部导航、侧边导航） */}
        <div style={{ padding: '8px 24px 0', borderBottom: '1px solid var(--semi-color-border, #f0f2f5)' }}>
          <Tabs
            type="line"
            activeKey={String(activeKey)}
            onChange={onTabChange}
          >
            <TabPane tab="主导航" itemKey="1" />
            <TabPane tab="顶部小导航" itemKey="2" />
            <TabPane tab="底部导航" itemKey="3" />
            <TabPane tab="侧边导航" itemKey="4" />
          </Tabs>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* 筛选与操作栏 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <Space>
              <Input
                prefix={<IconSearch />}
                placeholder="输入导航栏名称"
                value={keyword}
                onChange={(v) => setKeyword(v)}
                onEnterPress={loadData}
                style={{ width: 220 }}
                showClear
              />
              <Button theme="solid" type="primary" icon={<IconSearch />} onClick={loadData}>
                搜索
              </Button>
              <Button
                icon={<IconRefresh />}
                onClick={() => {
                  setKeyword('');
                  setPage(1);
                  loadData();
                }}
              >
                重置
              </Button>
            </Space>

            <Space spacing={12}>
              <Button theme="solid" type="primary" icon={<IconPlus />} onClick={openAddDrawer}>
                添加{typeName}
              </Button>
              <Popconfirm
                title="您确认要批量删除所选数据吗？"
                onConfirm={handleBatchDelete}
                disabled={selectedKeys.length === 0}
              >
                <Button type="danger" disabled={selectedKeys.length === 0}>
                  批量删除
                </Button>
              </Popconfirm>
              {selectedKeys.length > 0 && (
                <span style={{ fontSize: 13, color: '#666' }}>
                  已选择：<b style={{ color: '#165dff' }}>{selectedKeys.length}</b> 项
                </span>
              )}
            </Space>
          </div>

          {/* 列表表格（支持多选和树形结构展开） */}
          <Table
            columns={columns as any}
            dataSource={rows}
            rowKey="id"
            loading={loading}
            rowSelection={{
              selectedRowKeys: selectedKeys,
              onChange: (keys) => setSelectedKeys(keys || []),
            }}
            pagination={{
              currentPage: page,
              pageSize,
              total,
              onPageChange: (next) => setPage(next),
              onPageSizeChange: (next) => setPageSize(next),
              showTotal: true,
            }}
          />
        </div>
      </Card>

      {/* 导航栏配置 Drawer (宽度600px，对齐旧版 Info.vue 规范) */}
      <SideSheet
        title={drawerMode === 'add' ? `添加${typeName}` : `编辑商城${typeName}导航栏`}
        visible={drawerVisible}
        onCancel={() => setDrawerVisible(false)}
        width={600}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '12px 24px' }}>
            <Button onClick={() => setDrawerVisible(false)}>取消</Button>
            <Button theme="solid" type="primary" loading={submitting} onClick={handleDrawerSubmit}>
              提交
            </Button>
          </div>
        }
      >
        <div style={{ padding: '8px 8px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>
              <span style={{ color: '#f53f3f' }}>* </span>名称：
            </div>
            <Input
              value={formState.title}
              onChange={(v) => setFormState({ ...formState, title: v })}
              placeholder="请输入导航名称"
            />
          </div>

          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>链接地址：</div>
            <Input
              value={formState.linkUrl}
              onChange={(v) => setFormState({ ...formState, linkUrl: v })}
              placeholder="例如: /product/list 或 http://..."
            />
          </div>

          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>ICO编码：</div>
            <Input
              value={formState.icon}
              onChange={(v) => setFormState({ ...formState, icon: v })}
              placeholder="图标类名，例如: icon-home"
            />
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              请先在本系统设置中的"接口设置"中设置"ico图标库地址"
            </div>
          </div>

          {activeKey === 2 && (
            <div>
              <div style={{ marginBottom: 6, fontWeight: 500 }}>上级导航：</div>
              <Select
                value={formState.parentId}
                onChange={(v) => setFormState({ ...formState, parentId: Number(v) })}
                optionList={parentOptions}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                请选择相对应位置的导航，如果父导航为中间导航，那该导航必须同样设置为中间导航才会生效；默认不选则表示为顶级导航
              </div>
            </div>
          )}

          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>位置：</div>
            <Input value={formState.typeName} disabled />
          </div>

          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>排序：</div>
            <Input
              value={String(formState.sortOrder)}
              onChange={(v) => setFormState({ ...formState, sortOrder: Number(v) || 0 })}
            />
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              默认值为50，数值越小，排序越靠前
            </div>
          </div>

          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>是否显示：</div>
            <RadioGroup
              value={formState.isShow}
              onChange={(e) => setFormState({ ...formState, isShow: Number(e.target.value) })}
            >
              <Radio value={1}>是</Radio>
              <Radio value={0}>否</Radio>
            </RadioGroup>
          </div>

          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>是否新窗口：</div>
            <RadioGroup
              value={formState.isBlank}
              onChange={(e) => setFormState({ ...formState, isBlank: Number(e.target.value) })}
            >
              <Radio value={1}>是</Radio>
              <Radio value={0}>否</Radio>
            </RadioGroup>
          </div>
        </div>
      </SideSheet>
    </div>
  );
}

/* =========================================================================
 * 4. PcCatFloor (pcCatFloorManage 分类抽屉)
 * 契约对齐: java/view/admin/src/views/decorate/pcCatFloor/List.vue
 * labels: 楼层图标, 楼层名称, 是否显示, 排序, 操作
 * props: catFloorName, sortOrder
 * createApi: '/decorate/pcCatFloor/create'
 * updateApi: '/decorate/pcCatFloor/update'
 * deleteApi: '/decorate/pcCatFloor/del'
 * drawer: { width: 600 }
 * filters: [{ field: 'catFloorName' }]
 * ========================================================================= */
export interface PcCatFloorRecord {
  catFloorId: number;
  catFloorName: string;
  categoryIds?: number[];
  categoryNames?: string[];
  brandIds?: number[];
  floorIco?: string;
  floorIcoFont?: string;
  hotCat?: string;
  isShow: number;
  sortOrder: number;
}

export function PcCatFloor() {
  const [rows, setRows] = useState<PcCatFloorRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Array<number | string>>([]);

  // 抽屉编辑状态
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 基础字典选项缓存：分类与品牌
  const [categoryOptions, setCategoryOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [brandOptions, setBrandOptions] = useState<Array<{ label: string; value: number }>>([]);

  // 表单状态
  const [formState, setFormState] = useState<{
    categoryList: Array<{ categoryId: number | null; categoryName: string }>;
    brandIds: number[];
    floorIcoFont: string;
    sortOrder: number;
    isShow: number;
  }>({
    categoryList: [{ categoryId: null, categoryName: '' }],
    brandIds: [],
    floorIcoFont: '',
    sortOrder: 50,
    isShow: 1,
  });

  // 加载分类选项与品牌选项
  useEffect(() => {
    // 1. 加载所有商品分类并平铺成阶梯树形选项
    apiGet<any[]>('/product/category/getAllCategory')
      .then((tree) => {
        const raw = Array.isArray(tree) ? tree : [];
        const flat: Array<{ label: string; value: number }> = [];
        const traverse = (nodes: any[], prefix = '') => {
          nodes.forEach((n) => {
            const label = prefix ? `${prefix} └─ ${n.categoryName}` : n.categoryName;
            flat.push({ label, value: n.categoryId });
            if (Array.isArray(n.children) && n.children.length > 0) {
              traverse(n.children, prefix ? `${prefix}    ` : '  ');
            }
          });
        };
        traverse(raw);
        setCategoryOptions(flat);
      })
      .catch(() => undefined);

    // 2. 加载品牌选项
    apiGet<{ records?: any[]; list?: any[] }>('/product/brand/list', { size: 1000 })
      .then((res) => {
        const list = res?.records || res?.list || [];
        setBrandOptions(
          list.map((b) => ({
            label: b.brandName,
            value: b.brandId,
          })),
        );
      })
      .catch(() => undefined);
  }, []);

  // 加载楼层列表数据
  const loadData = async (kw?: string, p?: number) => {
    setLoading(true);
    try {
      const activeKw = kw !== undefined ? kw : keyword;
      const activePage = p !== undefined ? p : page;
      const params: Record<string, any> = {
        page: activePage,
        size: pageSize,
      };
      if (activeKw && activeKw.trim()) {
        params.keyword = activeKw.trim();
        // 兼容 PageSpec 筛选项检查
        params.catFloorName = activeKw.trim();
      }
      const res = await apiGet<{ records?: PcCatFloorRecord[]; list?: PcCatFloorRecord[]; total?: number }>(
        '/decorate/pcCatFloor/list',
        params,
      );
      const list = res?.records || res?.list || [];
      setRows(list);
      setTotal(res?.total || list.length);
    } catch (e: any) {
      Toast.error(e.message || '加载分类楼层数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, pageSize]);

  // 更新单一字段（是否显示、排序等）
  const handleUpdateField = async (id: number, field: string, val: any) => {
    try {
      await apiPost('/decorate/pcCatFloor/updateField', { id, field, val });
      Toast.success('修改成功');
      loadData();
    } catch (e: any) {
      Toast.error(e.message || '修改失败');
    }
  };

  // 删除单行
  const handleDelete = async (id: number) => {
    try {
      await apiPost('/decorate/pcCatFloor/del', { id });
      Toast.success('删除成功');
      loadData();
    } catch (e: any) {
      Toast.error(e.message || '删除失败');
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedKeys.length === 0) return;
    try {
      await apiPost('/decorate/pcCatFloor/batch', {
        type: 'del',
        ids: selectedKeys.map(Number),
      });
      Toast.success('批量删除成功');
      setSelectedKeys([]);
      loadData();
    } catch (e: any) {
      Toast.error(e.message || '批量删除失败');
    }
  };

  // 清除抽屉缓存
  const handleClearCache = async () => {
    try {
      await apiPost('/decorate/pcCatFloor/clearCache', {});
      Toast.success('分类抽屉缓存已清除');
      loadData();
    } catch (e: any) {
      Toast.error(e.message || '清除缓存失败');
    }
  };

  // 打开新增抽屉
  const openAddDrawer = () => {
    setDrawerMode('add');
    setEditingId(null);
    setDrawerLoading(false);
    setFormState({
      categoryList: [{ categoryId: null, categoryName: '' }],
      brandIds: [],
      floorIcoFont: '',
      sortOrder: 50,
      isShow: 1,
    });
    setDrawerVisible(true);
  };

  // 打开编辑抽屉
  const openEditDrawer = async (row: PcCatFloorRecord) => {
    setDrawerMode('edit');
    setEditingId(row.catFloorId);
    setDrawerVisible(true);
    setDrawerLoading(true);

    try {
      const detail = await apiGet<any>('/decorate/pcCatFloor/detail', { id: row.catFloorId });
      const catIds: number[] = detail?.categoryIds || row.categoryIds || [];
      const catNames: string[] = detail?.categoryNames || row.categoryNames || [];
      const reconstructedList =
        catIds.length > 0
          ? catIds.map((cId, idx) => ({
              categoryId: cId,
              categoryName: catNames[idx] || '',
            }))
          : [{ categoryId: null, categoryName: '' }];

      setFormState({
        categoryList: reconstructedList,
        brandIds: detail?.brandIds || row.brandIds || [],
        floorIcoFont: detail?.floorIcoFont || row.floorIcoFont || '',
        sortOrder: detail?.sortOrder ?? row.sortOrder ?? 50,
        isShow: detail?.isShow ?? row.isShow ?? 1,
      });
    } catch (e: any) {
      Toast.error(e.message || '获取抽屉楼层详情失败');
    } finally {
      setDrawerLoading(false);
    }
  };

  // 提交抽屉表单
  const handleDrawerSubmit = async () => {
    const validCategories = formState.categoryList.filter((item) => item.categoryId != null);
    if (validCategories.length === 0) {
      Toast.warning('请至少添加并选择一个商品分类');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        categoryIds: validCategories.map((item) => Number(item.categoryId)),
        categoryNames: validCategories.map((item) => item.categoryName || ''),
        brandIds: (formState.brandIds || []).map(Number),
        floorIcoFont: formState.floorIcoFont || '',
        sortOrder: Number(formState.sortOrder) || 50,
        isShow: formState.isShow,
      };

      if (drawerMode === 'add') {
        await apiPost('/decorate/pcCatFloor/create', payload);
        Toast.success('添加抽屉楼层成功');
      } else {
        await apiPost('/decorate/pcCatFloor/update', {
          catFloorId: editingId,
          ...payload,
        });
        Toast.success('修改抽屉楼层成功');
      }
      setDrawerVisible(false);
      loadData();
    } catch (e: any) {
      Toast.error(e.message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 动态操作分类行
  const addCategoryRow = () => {
    setFormState({
      ...formState,
      categoryList: [...formState.categoryList, { categoryId: null, categoryName: '' }],
    });
  };

  const removeCategoryRow = (index: number) => {
    if (formState.categoryList.length <= 1) {
      Toast.warning('至少需要保留一行分类设置');
      return;
    }
    const nextList = [...formState.categoryList];
    nextList.splice(index, 1);
    setFormState({ ...formState, categoryList: nextList });
  };

  const updateCategoryRow = (index: number, patch: Partial<{ categoryId: number | null; categoryName: string }>) => {
    const nextList = [...formState.categoryList];
    nextList[index] = { ...nextList[index], ...patch };
    setFormState({ ...formState, categoryList: nextList });
  };

  const columns = [
    {
      title: '楼层图标',
      dataIndex: 'floorIcoFont',
      width: 110,
      render: (_: any, row: PcCatFloorRecord) => {
        if (row.floorIcoFont) {
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                borderRadius: 6,
                background: '#f0f4ff',
                color: '#165dff',
              }}
            >
              <i className={row.floorIcoFont} style={{ fontSize: 18 }} />
            </span>
          );
        }
        if (row.floorIco) {
          return <Avatar src={row.floorIco} size="small" shape="square" />;
        }
        return <span style={{ color: '#bbb', fontSize: 12 }}>无图标</span>;
      },
    },
    {
      title: '楼层名称',
      dataIndex: 'catFloorName',
      width: 240,
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v || '--'}</span>,
    },
    {
      title: '是否显示',
      dataIndex: 'isShow',
      width: 120,
      render: (_: any, row: PcCatFloorRecord) => (
        <Switch
          checked={row.isShow === 1}
          onChange={(checked) => handleUpdateField(row.catFloorId, 'isShow', checked ? 1 : 0)}
        />
      ),
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 130,
      sorter: (a: PcCatFloorRecord, b: PcCatFloorRecord) => (a.sortOrder || 0) - (b.sortOrder || 0),
      render: (val: number, row: PcCatFloorRecord) => (
        <Input
          size="small"
          style={{ width: 70 }}
          key={`${row.catFloorId}-${val}`}
          defaultValue={val ?? 50}
          onBlur={(e) => {
            const next = Number(e.target.value);
            if (!isNaN(next) && next !== val) {
              handleUpdateField(row.catFloorId, 'sortOrder', next);
            }
          }}
          onEnterPress={(e: any) => {
            const next = Number(e.target.value);
            if (!isNaN(next) && next !== val) {
              handleUpdateField(row.catFloorId, 'sortOrder', next);
            }
          }}
        />
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 160,
      render: (_: any, row: PcCatFloorRecord) => (
        <Space spacing={6}>
          <Button theme="borderless" type="primary" onClick={() => openEditDrawer(row)}>
            编辑
          </Button>
          <Popconfirm title="确定删除此分类楼层？" onConfirm={() => handleDelete(row.catFloorId)}>
            <Button theme="borderless" type="danger">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ width: '100%' }}>
      <Card className="table-card" shadows="hover">
        {/* 顶部工具栏：搜索、清除缓存、新增、批量删除 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Space>
            <Input
              prefix={<IconSearch />}
              placeholder="输入楼层名称"
              value={keyword}
              onChange={(v) => setKeyword(v)}
              onEnterPress={() => {
                setPage(1);
                loadData(keyword, 1);
              }}
              style={{ width: 220 }}
              showClear
              onClear={() => {
                setKeyword('');
                setPage(1);
                loadData('', 1);
              }}
            />
            <Button
              theme="solid"
              type="primary"
              icon={<IconSearch />}
              onClick={() => {
                setPage(1);
                loadData(keyword, 1);
              }}
            >
              搜索
            </Button>
            <Button
              icon={<IconRefresh />}
              onClick={() => {
                setKeyword('');
                setPage(1);
                loadData('', 1);
              }}
            >
              重置
            </Button>
          </Space>

          <Space spacing={10}>
            <Button icon={<IconRefresh />} onClick={handleClearCache}>
              清除分类抽屉缓存
            </Button>
            <Button theme="solid" type="primary" icon={<IconPlus />} onClick={openAddDrawer}>
              添加抽屉楼层
            </Button>
            <Popconfirm
              title="您确认要批量删除所选数据吗？"
              onConfirm={handleBatchDelete}
              disabled={selectedKeys.length === 0}
            >
              <Button type="danger" disabled={selectedKeys.length === 0}>
                批量删除
              </Button>
            </Popconfirm>
            {selectedKeys.length > 0 && (
              <span style={{ fontSize: 13, color: '#666' }}>
                已选择：<b style={{ color: '#165dff' }}>{selectedKeys.length}</b> 项
              </span>
            )}
          </Space>
        </div>

        {/* 楼层列表表格 */}
        <Table
          columns={columns as any}
          dataSource={rows}
          rowKey="catFloorId"
          loading={loading}
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (keys) => setSelectedKeys(keys || []),
          }}
          pagination={{
            currentPage: page,
            pageSize,
            total,
            onPageChange: (next) => setPage(next),
            onPageSizeChange: (next) => setPageSize(next),
            showTotal: true,
          }}
        />
      </Card>

      {/* 楼层配置 Drawer (对齐 Info.vue 规范，宽度 600px) */}
      <SideSheet
        title={drawerMode === 'add' ? '添加抽屉楼层' : '编辑抽屉楼层'}
        visible={drawerVisible}
        onCancel={() => setDrawerVisible(false)}
        width={600}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '12px 24px' }}>
            <Button onClick={() => setDrawerVisible(false)}>取消</Button>
            <Button theme="solid" type="primary" loading={submitting} onClick={handleDrawerSubmit}>
              提交
            </Button>
          </div>
        }
      >
        <Spin spinning={drawerLoading}>
          <div style={{ padding: '8px 8px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 添加分类 (Category List) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>
                  <span style={{ color: '#f53f3f' }}>* </span>添加分类：
                </div>
                <Button size="small" icon={<IconPlus />} theme="solid" type="primary" onClick={addCategoryRow}>
                  增加分类
                </Button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {formState.categoryList.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: '#f8fafc',
                      padding: '10px 12px',
                      borderRadius: 6,
                      border: '1px solid #edf1f7',
                    }}
                  >
                    <div style={{ flex: 1.2 }}>
                      <Select
                        placeholder="选择商品分类"
                        value={item.categoryId ?? undefined}
                        onChange={(val) => updateCategoryRow(index, { categoryId: Number(val) })}
                        optionList={categoryOptions}
                        filter
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                      <span style={{ fontSize: 13, color: '#666', whiteSpace: 'nowrap' }}>重命名:</span>
                      <Input
                        placeholder="原名显示或填'-'隐藏"
                        value={item.categoryName}
                        onChange={(val) => updateCategoryRow(index, { categoryName: val })}
                      />
                    </div>
                    <Button
                      theme="borderless"
                      type="danger"
                      icon={<IconDelete />}
                      onClick={() => removeCategoryRow(index)}
                    />
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 12, color: '#888', marginTop: 8, lineHeight: 1.6 }}>
                <div>• 提示：只能设置为一级或二级分类，且必须含有一个一级分类；如果存在二级分类，则必须存在该二级分类的上一级分类；</div>
                <div>• 重命名为空则显示原分类名称，重命名为"-"符号则不会显示。</div>
              </div>
            </div>

            {/* 热门品牌 (Brand List) */}
            <div>
              <div style={{ marginBottom: 6, fontWeight: 600 }}>热门品牌：</div>
              <Select
                multiple
                placeholder="请选择推荐的热门品牌"
                value={formState.brandIds}
                onChange={(vals) => setFormState({ ...formState, brandIds: (vals as number[]) || [] })}
                optionList={brandOptions}
                filter
                style={{ width: '100%' }}
              />
            </div>

            {/* ICO编码 (floorIcoFont) */}
            <div>
              <div style={{ marginBottom: 6, fontWeight: 600 }}>ICO编码：</div>
              <Input
                value={formState.floorIcoFont}
                onChange={(v) => setFormState({ ...formState, floorIcoFont: v })}
                placeholder="例如: iconfont-tig icon-yingxiaoguanli 或 lyecs-defined-iconfont lyecs-defined-icon-baipishu"
              />
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                请先在本系统设置中的"接口设置"中设置"ico图标库地址"
              </div>
            </div>

            {/* 排序 */}
            <div>
              <div style={{ marginBottom: 6, fontWeight: 600 }}>排序：</div>
              <Input
                value={String(formState.sortOrder)}
                onChange={(v) => setFormState({ ...formState, sortOrder: Number(v) || 0 })}
                placeholder="50"
              />
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                默认值为50，数值越小，排序越靠前
              </div>
            </div>

            {/* 是否显示 */}
            <div>
              <div style={{ marginBottom: 6, fontWeight: 600 }}>是否显示：</div>
              <RadioGroup
                value={formState.isShow}
                onChange={(e) => setFormState({ ...formState, isShow: Number(e.target.value) })}
              >
                <Radio value={1}>是</Radio>
                <Radio value={0}>否</Radio>
              </RadioGroup>
            </div>
          </div>
        </Spin>
      </SideSheet>
    </div>
  );
}

/* =========================================================================
 * 5. PcCustomPage (pcDecorateCustomManage 自定义页装修)
 * 契约对齐: java/view/admin/src/views/decorate/pcCustomPage/List.vue
 * labels: 页面名称, 发布状态, 更新时间, 排序, 操作
 * props: decorateId, status, updateTime, bingdingH5Name, sortOrder
 * ========================================================================= */
export function PcCustomPage() {
  const columns: ColumnConfig<any>[] = [
    { title: 'ID', dataIndex: 'decorateId', width: 80 },
    {
      title: '页面名称',
      dataIndex: 'decorateName',
      width: 180,
      render: (v: any, row: any) => v || row?.bingdingH5Name || 'PC自定义微页面',
    },
    {
      title: '发布状态',
      dataIndex: 'status',
      width: 110,
      render: (s: any) => <Tag color={s === 1 ? 'green' : 'grey'}>{s === 1 ? '已发布' : '草稿'}</Tag>,
    },
    { title: '更新时间', dataIndex: 'updateTime', width: 170, render: (v: number) => <span>{formatDecorateTime(v)}</span> },
    { title: '排序', dataIndex: 'sortOrder', width: 90 },
  ];

  return (
    <div>
      <ListPage
        api="/decorate/decorate/list"
        rowKey="decorateId"
        columns={columns}
        showEdit={false}
        rowActions={(row: any) => (
          <Button
            theme="borderless"
            type="primary"
            size="small"
            onClick={() => {
              window.open(`${window.location.origin}/?page=pcDecorateEditor&id=${row.decorateId}&from=pcDecorateCustomManage`, '_blank');
            }}
          >
            装修
          </Button>
        )}
        filters={[{ field: 'decorateName', label: '页面名称', type: 'input' }]}
        drawer={{
          title: '新建PC微页面',
          addText: '新建页面',
          width: 600,
          createApi: '/decorate/decorate/create',
          updateApi: '/decorate/decorate/update',
          deleteApi: '/decorate/decorate/del',
          sections: [
            {
              key: 'basic',
              title: '基础配置',
              fields: [
                { field: 'decorateName', label: '页面名称', type: 'input', required: true },
                { field: 'sortOrder', label: '排序', type: 'input' },
              ],
            },
          ],
        }}
      />
    </div>
  );
}

/* =========================================================================
 * 6. PcProductStyle (pcProductStyleManage 商品页风格)
 * 契约对齐: java/view/admin/src/views/decorate/pcDecorate/ProductStyle.vue
 * labels: 商品页风格：
 * props: type
 * ========================================================================= */
export function PcProductStyle() {
  const styles = [
    { type: 1, title: '经典版', img: 'https://oss.tigshop.com/img/gallery/202606/1781513292MtmcDCoVzXOJw2sZOz.jpeg' },
    { type: 2, title: '国内标准版', img: 'https://oss.tigshop.com/img/gallery/202606/1781513292tAqsibp0zeM6sYNmQK.jpeg' },
    { type: 3, title: '跨境简约版', img: 'https://oss.tigshop.com/img/gallery/202607/1783574567CDREPpLfzfMd4RYqqx.jpeg' },
  ];
  const [styleType, setStyleType] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    apiGet<any>('/setting/config/productDetailStyleSettings')
      .then((result) => setStyleType(Number(result?.productDetailStyleType) || 1))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async () => {
    try {
      await apiPost('/setting/config/saveProductDetailStyle', { productDetailStyleType: styleType });
      Toast.success('操作成功');
      load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存失败');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <Card title="PC端商品详情页风格" loading={loading}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 30 }}>
          {styles.map((item) => (
            <div key={item.type} style={{ width: 260, cursor: 'pointer', textAlign: 'center' }} onClick={() => setStyleType(item.type)}>
              <div
                style={{
                  height: 180,
                  border: `2px solid ${styleType === item.type ? '#1456f0' : '#eee'}`,
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: '#fff',
                }}
              >
                <img src={item.img} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block' }} />
              </div>
              <div style={{ marginTop: 8, color: styleType === item.type ? '#1456f0' : '#333' }}>{item.title}</div>
            </div>
          ))}
        </div>
        <Space style={{ marginTop: 20 }}>
          <Button theme="solid" type="primary" onClick={save}>保 存</Button>
          <Button onClick={() => { setStyleType(1); save(); }}>重 置</Button>
        </Space>
      </Card>
    </div>
  );
}

/* =========================================================================
 * 7. PcSearchStyle (pcSearchStyleManage 搜索页风格)
 * 契约对齐: java/view/admin/src/views/decorate/pcDecorate/SearchStyle.vue
 * ========================================================================= */
export function PcSearchStyle() {
  const styles = [
    { type: 1, title: '样式一（经典版）', img: 'https://oss.tigshop.com/img/gallery/202606/1782373674JqSs1sxbDajftKgthu.jpeg' },
    { type: 2, title: '样式二（新版）', img: 'https://oss.tigshop.com/img/gallery/202606/1782373674PUhO83DhgZKLxbXOuQ.jpeg' },
  ];
  const [styleType, setStyleType] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    apiGet<any>('/setting/config/searchStyleSettings')
      .then((result) => setStyleType(Number(result?.searchStyleType) || 1))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async () => {
    try {
      await apiPost('/setting/config/saveSearchStyle', { searchStyleType: styleType });
      Toast.success('操作成功');
      load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存失败');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <Card title="PC端搜索页风格" loading={loading}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 30 }}>
          {styles.map((item) => (
            <div key={item.type} style={{ width: 260, cursor: 'pointer', textAlign: 'center' }} onClick={() => setStyleType(item.type)}>
              <div
                style={{
                  height: 180,
                  border: `2px solid ${styleType === item.type ? '#1456f0' : '#eee'}`,
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: '#fff',
                }}
              >
                <img src={item.img} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block' }} />
              </div>
              <div style={{ marginTop: 8, color: styleType === item.type ? '#1456f0' : '#333' }}>{item.title}</div>
            </div>
          ))}
        </div>
        <Space style={{ marginTop: 20 }}>
          <Button theme="solid" type="primary" onClick={save}>保 存</Button>
          <Button onClick={() => { setStyleType(1); save(); }}>重 置</Button>
        </Space>
      </Card>
    </div>
  );
}

/* =========================================================================
 * 8. PcDecorateOther (pcDecorateOtherManage 其它页面)
 * 原版该页登录背景已迁移到登录页装修，页面仅保留兼容空壳。
 * ========================================================================= */
export function PcDecorateOther() {
  return (
    <div style={{ padding: 20 }}>
      <Card title="其它页面">
        <Text type="secondary">会员登录背景已迁移至「登录页装修」，此页暂无可配置项。</Text>
      </Card>
    </div>
  );
}

/* =========================================================================
 * 7. PcSearchDecorate (pcSearchDecorateManage 搜索页装修)
 * 契约对齐: java/view/admin/src/views/decorate/pcDecorate/SearchDecorate.vue
 * ========================================================================= */
export function PcSearchDecorate() {
  return (
    <MobileDecoratePages
      decorateType={2}
      pageType={6}
      defaultName="搜索页微页面"
      editPage="pcDecorateEditor"
    />
  );
}

/* =========================================================================
 * 8. PcLoginDecorate (pcLoginDecorateManage 登录页装修)
 * 契约对齐: java/view/admin/src/views/decorate/pcDecorate/LoginDecorate.vue
 * ========================================================================= */
export function PcLoginDecorate() {
  return (
    <MobileDecoratePages
      decorateType={2}
      pageType={5}
      defaultName="登录页微页面"
      editPage="pcDecorateEditor"
    />
  );
}
