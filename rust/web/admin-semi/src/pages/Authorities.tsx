import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Input,
  InputNumber,
  Modal,
  Popover,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconDelete, IconEdit, IconPlus, IconRefresh } from '@douyinfe/semi-icons';
import { apiGet, apiPost, isDemo } from '../api';
import { useI18n } from '../i18n';
import FormDrawer from '../framework/FormDrawer';
import IcoPicker from '../components/IcoPicker';
import type { FormDrawerConfig } from '../framework/types';
import './authorities.css';

const { Text } = Typography;

/**
 * 权限目录：对应旧版 authority/authority/List.vue + Info.vue。
 * 目录/菜单/按钮三级权限树，支持按层级懒加载、下级钻取、行内编辑（PopForm 等价交互）、
 * 显示开关（updateField）、添加权限/子目录、编辑、删除、批量删除。
 * 树形展示沿用 Categories.tsx 的自绘展开方案（每层经 /authority/authority/list?parentId= 懒加载）。
 */

/** 细分权限（后端兼容 authName/authSn 与 auth_name/auth_sn 两种历史格式） */
interface AuthorityChildAuth {
  authName?: string;
  auth_name?: string;
  authSn?: string;
  auth_sn?: string;
}

/** /authority/authority/list 返回的 AuthorityDTO */
interface AuthorityRow {
  authorityId: number;
  authoritySn?: string;
  authorityName?: string;
  parentId?: number;
  sortOrder?: number;
  /** 子级数量（Java 为数量而非布尔） */
  hasChildren?: number;
  isShow?: number;
  childAuth?: AuthorityChildAuth[] | null;
  /** 路由地址：旧版 List.vue/Info.vue 均已注释该列/表单项，后端（含 updateField 白名单 route_link）仍支持，为对齐旧版 UI 保持隐藏 */
  routeLink?: string | null;
  authorityIco?: string | null;
  isSystem?: number;
  adminType?: string;
  /** 前端附加 */
  key?: string;
  depth?: number;
  children?: AuthorityRow[];
}

/** /authority/authority/getAllAuthority 返回的树节点（Hutool Tree 平铺结构） */
interface AuthorityTreeNode {
  id?: number;
  name?: string;
  authorityId?: number;
  authorityName?: string;
  children?: AuthorityTreeNode[];
}

interface AuthorityOption {
  label: string;
  value: number;
}

const PAGE_SIZE = 15;

const ADMIN_TYPE_TABS = [
  { tab: '管理后台', itemKey: 'admin' },
  { tab: '店铺后台', itemKey: 'shop' },
];

const EMPTY_FORM = {
  authorityName: '',
  authoritySn: '',
  parentId: 0,
  authorityIco: '',
  sortOrder: 0,
  adminType: 'admin',
  isShow: 1,
  childAuth: [] as Array<{ authName: string; authSn: string }>,
};

/** childAuth 归一化为 { authName, authSn }（兼容下划线历史数据） */
const childAuthList = (values: Partial<AuthorityRow>): Array<{ authName: string; authSn: string }> =>
  ((values.childAuth || []) as AuthorityChildAuth[]).map((item) => ({
    authName: String(item.authName ?? item.auth_name ?? ''),
    authSn: String(item.authSn ?? item.auth_sn ?? ''),
  }));

const withDepth = (row: AuthorityRow, depth: number): AuthorityRow => ({
  ...row,
  key: String(row.authorityId),
  depth,
  children: undefined,
});

/** 上级分类选项：getAllAuthority 树拍平，用全角空格缩进表达层级 */
const flattenAuthorityTree = (nodes: AuthorityTreeNode[], depth = 0, out: AuthorityOption[] = []) => {
  nodes.forEach((node) => {
    const label = String(node.authorityName ?? node.name ?? '').trim();
    const id = Number(node.authorityId ?? node.id ?? 0);
    if (id > 0 && label) out.push({ label: `${'　'.repeat(depth)}${label}`, value: id });
    if (node.children?.length && depth < 5) flattenAuthorityTree(node.children, depth + 1, out);
  });
  return out;
};

/** 行内编辑单元格（对应旧版 PopForm：展示值 + 编辑小图标 + 气泡内输入确认） */
function InlineEditCell({
  label,
  value,
  inputType = 'text',
  onSave,
}: {
  label: string;
  value: string | number | null | undefined;
  inputType?: 'text' | 'integer';
  onSave: (next: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));

  useEffect(() => {
    if (visible) setDraft(String(value ?? ''));
  }, [visible, value]);

  const confirm = async () => {
    const next = draft.trim();
    if (inputType === 'text' && !next) {
      Toast.warning({ content: t('{label}不能为空', { label }) });
      return;
    }
    if (inputType === 'integer' && !/^-?\d+$/.test(next)) {
      Toast.warning({ content: t('{label}须为整数', { label }) });
      return;
    }
    const ok = await onSave(next);
    if (ok) setVisible(false);
  };

  const renderInput = () =>
    inputType === 'integer' ? (
      <InputNumber
        value={draft === '' ? undefined : Number(draft)}
        onChange={(next) => setDraft(next === undefined || next === '' ? '' : String(next))}
        style={{ width: 180 }}
      />
    ) : (
      <Input value={draft} onChange={setDraft} style={{ width: 220 }} />
    );

  return (
    <span className="auth-inline">
      <span className="auth-inline-value" title={label}>
        {value === '' || value === null || value === undefined ? '-' : String(value)}
      </span>
      <Popover
        trigger="click"
        visible={visible}
        onClickOutToClose
        onVisibleChange={setVisible}
        showArrow
        content={
          <div className="auth-inline-pop">
            <div className="auth-inline-title">{label}</div>
            {renderInput()}
            <Space>
              <Button size="small" onClick={() => setVisible(false)}>
                {t('取消')}
              </Button>
              <Button size="small" theme="solid" type="primary" onClick={confirm}>
                {t('确认')}
              </Button>
            </Space>
          </div>
        }
      >
        <Button
          theme="borderless"
          size="small"
          icon={<IconEdit />}
          className="auth-inline-trigger"
          aria-label={t('编辑{label}', { label })}
        />
      </Popover>
    </span>
  );
}

/** 是否显示开关（updateField isShow，失败回滚） */
function ShowSwitch({
  value,
  onSave,
}: {
  value?: number;
  onSave: (next: 0 | 1) => Promise<boolean>;
}) {
  const [checked, setChecked] = useState(Number(value) === 1);

  useEffect(() => {
    setChecked(Number(value) === 1);
  }, [value]);

  const toggle = async (next: boolean) => {
    const target: 0 | 1 = next ? 1 : 0;
    setChecked(next);
    const ok = await onSave(target);
    if (!ok) setChecked(Number(value) === 1);
  };

  return <Switch checked={checked} size="small" onChange={toggle} />;
}

export default function Authorities() {
  const { t } = useI18n();
  const [activeKey, setActiveKey] = useState('admin');
  const [parentChain, setParentChain] = useState<number[]>([0]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: string; order: string }>({ field: 'sortOrder', order: '' });
  const [rows, setRows] = useState<AuthorityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(!isDemo());
  const [reloadKey, setReloadKey] = useState(0);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const expandedRef = useRef<Set<number>>(new Set());
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerInitial, setDrawerInitial] = useState<Record<string, any>>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [createParentId, setCreateParentId] = useState(0);
  const [saving, setSaving] = useState(false);
  const [parentOptions, setParentOptions] = useState<AuthorityOption[]>([]);

  const parentId = parentChain[parentChain.length - 1] || 0;
  const reload = () => setReloadKey((key) => key + 1);

  const clearTreeView = () => {
    setExpanded(new Set());
    expandedRef.current = new Set();
    setSelectedKeys([]);
    setPage(1);
  };

  // 上级分类选项（按当前后台类型取全量权限树）
  useEffect(() => {
    if (isDemo()) return;
    let alive = true;
    apiGet<AuthorityTreeNode[]>('/authority/authority/getAllAuthority', { adminType: activeKey })
      .then((tree) => {
        if (alive) {
          setParentOptions([{ label: t('顶级目录'), value: 0 }, ...flattenAuthorityTree(tree || [])]);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [activeKey]);

  const loadChildrenOf = async (targetParentId: number, depth: number): Promise<AuthorityRow[]> => {
    const result = await apiGet<{ records: AuthorityRow[]; total: number }>('/authority/authority/list', {
      page: 1,
      size: 100,
      parentId: targetParentId,
      adminType: activeKey,
      sortField: sort.field || 'sortOrder',
      sortOrder: sort.order || undefined,
    });
    return (result.records || []).map((row) => withDepth(row, depth));
  };

  const attachExpandedChildren = async (nodes: AuthorityRow[], depth: number): Promise<void> => {
    for (const node of nodes) {
      if (!expandedRef.current.has(node.authorityId)) continue;
      if (Number(node.hasChildren) <= 0) continue;
      const children = await loadChildrenOf(node.authorityId, depth + 1);
      node.children = children;
      await attachExpandedChildren(children, depth + 1);
    }
  };

  useEffect(() => {
    if (isDemo()) {
      setRows([]);
      setTotal(0);
      return;
    }
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const result = await apiGet<{ records: AuthorityRow[]; total: number }>(
          '/authority/authority/list',
          {
            page,
            size: PAGE_SIZE,
            parentId,
            adminType: activeKey,
            sortField: sort.field || 'sortOrder',
            sortOrder: sort.order || undefined,
          },
        );
        if (!alive) return;
        const roots = (result.records || []).map((row) => withDepth(row, 0));
        await attachExpandedChildren(roots, 0);
        if (!alive) return;
        setRows(roots);
        setTotal(result.total || 0);
      } catch (error) {
        if (alive) Toast.error({ content: error instanceof Error ? error.message : t('权限列表加载失败') });
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, parentChain, activeKey, sort, reloadKey]);

  const attachChildRows = (
    nodes: AuthorityRow[],
    targetId: number,
    children: AuthorityRow[],
  ): AuthorityRow[] =>
    nodes.map((node) => {
      if (node.authorityId === targetId) return { ...node, children };
      if (node.children?.length) {
        return { ...node, children: attachChildRows(node.children, targetId, children) };
      }
      return node;
    });

  const toggleExpand = async (row: AuthorityRow) => {
    const id = row.authorityId;
    const willExpand = !expanded.has(id);
    const next = new Set(expanded);
    if (willExpand) next.add(id);
    else next.delete(id);
    setExpanded(next);
    expandedRef.current = next;
    if (!willExpand || row.children?.length) return;
    try {
      const children = await loadChildrenOf(id, (row.depth || 0) + 1);
      setRows((current) => attachChildRows(current, id, children));
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载子级失败') });
    }
  };

  /** 进入下级（对应旧版 childCat） */
  const drillDown = (row: AuthorityRow) => {
    setParentChain((chain) => [...chain, row.authorityId]);
    clearTreeView();
  };

  /** 返回上一级（对应旧版 backToParentCat） */
  const backToParent = () => {
    setParentChain((chain) => (chain.length > 1 ? chain.slice(0, -1) : [0]));
    clearTreeView();
  };

  const applyField = async (row: AuthorityRow, field: string, val: unknown): Promise<boolean> => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持操作') });
      return false;
    }
    try {
      await apiPost('/authority/authority/updateField', { id: row.authorityId, field, val });
      Toast.success({ content: t('修改成功') });
      reload();
      return true;
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('修改失败') });
      return false;
    }
  };

  const removeAuthority = (row: AuthorityRow) => {
    Modal.confirm({
      title: t('确认删除该权限吗？'),
      content: t('「{name}」删除后不可恢复，存在子级时将无法删除。', { name: String(row.authorityName || row.authorityId) }),
      onOk: async () => {
        if (isDemo()) {
          Toast.warning({ content: t('演示模式不支持操作') });
          return;
        }
        try {
          await apiPost('/authority/authority/del', { id: row.authorityId });
          Toast.success({ content: t('删除成功') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
      },
    });
  };

  const visibleRows = useMemo(() => {
    const out: AuthorityRow[] = [];
    const walk = (nodes: AuthorityRow[], depth: number) => {
      nodes.forEach((node) => {
        out.push({ ...node, depth });
        if (expanded.has(node.authorityId) && node.children?.length) walk(node.children, depth + 1);
      });
    };
    walk(rows, 0);
    return out;
  }, [rows, expanded]);

  const selectedRows = useMemo(
    () => visibleRows.filter((row) => selectedKeys.includes(row.key || '')),
    [visibleRows, selectedKeys],
  );

  const batchDelete = () => {
    if (!selectedRows.length) return;
    Modal.confirm({
      title: t('您确认要批量删除所选数据吗？'),
      content: t('将删除选中的 {count} 个权限，存在子级的会被后端拒绝。', { count: selectedRows.length }),
      onOk: async () => {
        if (isDemo()) {
          Toast.warning({ content: t('演示模式不支持操作') });
          return;
        }
        try {
          await apiPost('/authority/authority/batch', {
            ids: selectedRows.map((row) => row.authorityId),
            type: 'del',
          });
          Toast.success({ content: t('批量删除成功') });
          setSelectedKeys([]);
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('批量删除失败') });
        }
      },
    });
  };

  const openCreate = (targetParentId: number) => {
    setDrawerMode('create');
    setEditingId(null);
    setCreateParentId(targetParentId);
    setDrawerInitial({ ...EMPTY_FORM, parentId: targetParentId, adminType: activeKey });
    setDrawerOpen(true);
  };

  const openEdit = async (row: AuthorityRow) => {
    setDrawerMode('edit');
    setEditingId(row.authorityId);
    setCreateParentId(row.authorityId);
    try {
      const detail = await apiGet<AuthorityRow>('/authority/authority/detail', { id: row.authorityId });
      setDrawerInitial({ ...EMPTY_FORM, ...(detail || row), childAuth: childAuthList(detail || row) });
    } catch {
      setDrawerInitial({ ...EMPTY_FORM, ...row, childAuth: childAuthList(row) });
    }
    setDrawerOpen(true);
  };

  const saveAuthority = async (payload: Record<string, any>) => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持操作') });
      return;
    }
    setSaving(true);
    try {
      if (drawerMode === 'edit' && editingId) {
        await apiPost('/authority/authority/update', { ...payload, authorityId: editingId });
        Toast.success({ content: t('更新成功') });
      } else {
        await apiPost('/authority/authority/create', payload);
        Toast.success({ content: t('创建成功') });
      }
      setDrawerOpen(false);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const drawerConfig: FormDrawerConfig = useMemo(
    () => ({
      // create 模式展示"添加权限"；edit 模式由 FormDrawer 追加"编辑"前缀
      title: drawerMode === 'create' ? '添加权限' : '权限',
      addText: '添加权限',
      width: 580,
      labelWidth: 130,
      createApi: '/authority/authority/create',
      updateApi: '/authority/authority/update',
      idField: 'authorityId',
      sections: [
        {
          key: 'basic',
          title: '基础信息',
          fields: [
            {
              field: 'authorityName',
              label: t('权限名称'),
              type: 'input',
              required: true,
              placeholder: t('请输入权限名称'),
            },
            {
              field: 'authoritySn',
              label: t('唯一编号'),
              type: 'input',
              required: true,
              placeholder: t('请输入唯一编号'),
              extraText: t('只能为英文字母，推荐小驼峰，非目录权限则以Manage结尾，如：productManage'),
              rules: [
                { required: true, message: t('唯一编号不能为空!') },
                {
                  validator: (_rule: unknown, value: string) => !value || /^[a-zA-Z]+$/.test(value),
                  message: t('只能输入英文字母'),
                },
              ],
            },
            // 旧版 Info.vue 的"路由地址"(routeLink)表单项与 List.vue 的路由地址列均已注释，
            // 后端仍支持（updateField 白名单含 route_link），此处保持与旧版一致不展示。
            {
              field: 'parentId',
              label: t('上级分类'),
              type: 'custom',
              render: ({ formApi, values, mode }) => (
                <Select
                  placeholder={t('请选择上级权限')}
                  filter
                  optionList={parentOptions.filter((option) => option.value !== editingId)}
                  value={Number(values.parentId ?? 0)}
                  disabled={mode === 'create' && !createParentId}
                  style={{ width: 360 }}
                  onChange={(next) => formApi?.setValue('parentId', Number(next ?? 0))}
                />
              ),
            },
            {
              field: 'authorityIco',
              label: t('ICO编码'),
              type: 'custom',
              render: ({ formApi, values }) => (
                <IcoPicker
                  value={values.authorityIco}
                  onChange={(next) => formApi?.setValue('authorityIco', next)}
                />
              ),
              extraText: t('请先在本系统设置中的"全局设置"中设置"ico图标库地址"'),
            },
            { field: 'sortOrder', label: t('排序'), type: 'number', initValue: 0 },
            {
              field: 'adminType',
              label: t('权限所属系统'),
              type: 'radio',
              disabled: true,
              options: [
                { label: t('管理后台'), value: 'admin' },
                { label: t('店铺后台'), value: 'shop' },
              ],
            },
            {
              field: 'isShow',
              label: t('是否显示'),
              type: 'radio',
              initValue: 1,
              options: [
                { label: t('是'), value: 1 },
                { label: t('否'), value: 0 },
              ],
            },
            {
              field: 'childAuth',
              label: t('细分权限'),
              type: 'custom',
              render: ({ formApi, values }) => {
                const items = childAuthList(values as Partial<AuthorityRow>);
                const update = (next: Array<{ authName: string; authSn: string }>) =>
                  formApi?.setValue('childAuth', next);
                return (
                  <div className="auth-child-list">
                    {items.map((item, index) => (
                      <div className="auth-child-row" key={index}>
                        <span className="auth-child-label">{t('权限名称：')}</span>
                        <Input
                          value={item.authName}
                          placeholder={t('权限名称')}
                          style={{ width: 120 }}
                          onChange={(next) =>
                            update(
                              items.map((it, i) => (i === index ? { ...it, authName: next } : it)),
                            )
                          }
                        />
                        <span className="auth-child-label">{t('权限编码：')}</span>
                        <Input
                          value={item.authSn}
                          placeholder={t('权限编码')}
                          style={{ width: 150 }}
                          onChange={(next) =>
                            update(
                              items.map((it, i) => (i === index ? { ...it, authSn: next } : it)),
                            )
                          }
                        />
                        <Button
                          type="danger"
                          theme="borderless"
                          size="small"
                          icon={<IconDelete />}
                          onClick={() => update(items.filter((_, i) => i !== index))}
                        />
                      </div>
                    ))}
                    <Button size="small" onClick={() => update([...items, { authName: '', authSn: '' }])}>
                      {t('新增细分权限')}
                    </Button>
                  </div>
                );
              },
            },
          ],
        },
      ],
      toPayload: (values, mode) => ({
        authorityName: String(values.authorityName ?? '').trim(),
        authoritySn: String(values.authoritySn ?? '').trim(),
        parentId: Number(values.parentId ?? 0),
        authorityIco: String(values.authorityIco ?? ''),
        sortOrder: Number(values.sortOrder ?? 0),
        adminType: String(values.adminType ?? 'admin'),
        isShow: Number(values.isShow ?? 1),
        childAuth: childAuthList(values as Partial<AuthorityRow>).filter(
          (item) => item.authName || item.authSn,
        ),
        ...(mode === 'edit' && editingId ? { authorityId: editingId } : {}),
      }),
    }),
    [drawerMode, editingId, createParentId, parentOptions, t],
  );

  const sortOrderFor = (field: string): 'ascend' | 'descend' | false => {
    if (sort.field !== field || !sort.order) return false;
    return sort.order === 'asc' ? 'ascend' : 'descend';
  };

  const columns = [
    {
      title: t('权限名称'),
      dataIndex: 'authorityName',
      width: 280,
      render: (_: unknown, row: AuthorityRow) => (
        <div className="auth-name-cell" style={{ paddingLeft: (row.depth || 0) * 22 }}>
          {Number(row.hasChildren) > 0 ? (
            <button
              type="button"
              className="category-expand-btn"
              onClick={() => toggleExpand(row)}
              aria-label={expanded.has(row.authorityId) ? t('收起') : t('展开')}
            >
              {expanded.has(row.authorityId) ? '−' : '+'}
            </button>
          ) : (
            <span className="category-expand-placeholder" />
          )}
          {Number(row.hasChildren) > 0 ? (
            <span className="auth-name-link" title={t('查看下级')} onClick={() => drillDown(row)}>
              {row.authorityName || '-'}
            </span>
          ) : (
            <span className="auth-name-text" title={t('权限名称')}>
              {row.authorityName || '-'}
            </span>
          )}
          <InlineEditCell
            label={t('权限名称')}
            value={row.authorityName}
            onSave={(next) => applyField(row, 'authorityName', next)}
          />
        </div>
      ),
    },
    {
      title: t('权限图标'),
      dataIndex: 'authorityIco',
      width: 130,
      render: (_: unknown, row: AuthorityRow) => (
        <span className="auth-icon-text" title={t('权限图标：{ico}', { ico: row.authorityIco || '-' })}>
          {row.authorityIco || '-'}
        </span>
      ),
    },
    {
      title: t('唯一编码'),
      dataIndex: 'authoritySn',
      width: 200,
      render: (_: unknown, row: AuthorityRow) => (
        <InlineEditCell
          label={t('唯一编码')}
          value={row.authoritySn}
          onSave={(next) => applyField(row, 'authoritySn', next)}
        />
      ),
    },
    {
      title: t('细分权限'),
      dataIndex: 'childAuth',
      width: 180,
      render: (_: unknown, row: AuthorityRow) => {
        const items = childAuthList(row).filter((item) => item.authName);
        return (
          <span className="auth-child-tags" title={t('细分权限')}>
            {items.length ? items.map((item) => item.authName).join('，') : '-'}
          </span>
        );
      },
    },
    {
      title: t('是否显示'),
      dataIndex: 'isShow',
      width: 100,
      sorter: true,
      sortOrder: sortOrderFor('isShow'),
      render: (value: number, row: AuthorityRow) => (
        <ShowSwitch value={value} onSave={(next) => applyField(row, 'isShow', next)} />
      ),
    },
    {
      title: t('排序'),
      dataIndex: 'sortOrder',
      width: 110,
      sorter: true,
      sortOrder: sortOrderFor('sortOrder'),
      render: (_: unknown, row: AuthorityRow) => (
        <InlineEditCell
          label={t('排序')}
          inputType="integer"
          value={row.sortOrder}
          onSave={(next) => applyField(row, 'sortOrder', Number(next))}
        />
      ),
    },
    {
      title: t('操作'),
      dataIndex: 'actions',
      width: 220,
      fixed: 'right' as const,
      render: (_: unknown, row: AuthorityRow) => (
        <Space spacing={2}>
          <Button theme="borderless" size="small" onClick={() => openEdit(row)}>
            {t('编辑')}
          </Button>
          <Button theme="borderless" size="small" onClick={() => openCreate(row.authorityId)}>
            {t('添加子目录')}
          </Button>
          <Button theme="borderless" type="danger" size="small" onClick={() => removeAuthority(row)}>
            {t('删除')}
          </Button>
        </Space>
      ),
    },
  ] as any;

  return (
    <div className="authorities-page">
      <Card className="table-card" shadows="hover">
        <Tabs
          type="button"
          size="small"
          activeKey={activeKey}
          onChange={(key: string) => {
            setActiveKey(key);
            setParentChain([0]);
            clearTreeView();
          }}
          tabList={ADMIN_TYPE_TABS.map((item) => ({ ...item, tab: t(item.tab) }))}
        />
        <div className="table-toolbar">
          <Space>
            {parentId > 0 && <Button onClick={backToParent}>{t('返回上一级')}</Button>}
            <Text type="tertiary">{t('共 {count} 项', { count: total })}</Text>
          </Space>
          <Space>
            <Button icon={<IconRefresh />} loading={loading} onClick={reload}>
              {t('刷新')}
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<IconPlus />}
              onClick={() => openCreate(parentId)}
            >
              {t('添加权限')}
            </Button>
          </Space>
        </div>

        {selectedRows.length > 0 && (
          <div className="batch-floating-bar">
            <span>{t('已选择 {count} 项', { count: selectedRows.length })}</span>
            <Button size="small" onClick={batchDelete}>
              {t('批量删除')}
            </Button>
            <Button size="small" theme="borderless" onClick={() => setSelectedKeys([])}>
              {t('取消选择')}
            </Button>
          </div>
        )}

        <Table
          loading={loading}
          dataSource={visibleRows}
          rowKey="key"
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (keys: any, rows: any) => {
              void rows;
              setSelectedKeys(((keys || []) as any[]).map(String));
            },
          }}
          onChange={({ sorter, extra }: any) => {
            if (extra?.changeType !== 'sorter') return;
            const field = String(sorter?.dataIndex || '');
            const order = sorter?.order === 'ascend' ? 'asc' : sorter?.order === 'descend' ? 'desc' : '';
            setSort({ field: order ? field : 'sortOrder', order });
            setPage(1);
          }}
          scroll={{ x: 1100 }}
          pagination={{
            currentPage: page,
            pageSize: PAGE_SIZE,
            total,
            formatPageText: false,
            onChange: (next: number) => setPage(next),
          }}
          columns={columns}
        />
      </Card>

      <FormDrawer
        visible={drawerOpen}
        mode={drawerMode}
        initialValues={drawerInitial}
        config={drawerConfig}
        saving={saving}
        onCancel={() => setDrawerOpen(false)}
        onSubmit={saveAuthority}
      />
    </div>
  );
}
