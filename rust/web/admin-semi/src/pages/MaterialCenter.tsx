import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import {
  Button,
  Checkbox,
  Dropdown,
  Input,
  Modal,
  Pagination,
  Radio,
  RadioGroup,
  Select,
  Space,
  Spin,
  TextArea,
  Toast,
} from '@douyinfe/semi-ui';
import {
  IconDelete,
  IconDownload,
  IconEdit,
  IconLink,
  IconMore,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconUpload,
} from '@douyinfe/semi-icons';
import { apiGet, apiPost, apiUpload, clearToken, getContextHeaders, getToken, isDemo } from '../api';
import { useI18n } from '../i18n';
import { AiEraseDialog, AiTranslateDialog, ensureAiImageEnabled } from './components/AiImageDialogs';
import './material-center.css';

/**
 * 素材中心：对应旧版 content/material-center/Index.vue 及其子组件。
 * 图片分组走 /setting/gallery/*（gallery 表），视频分组走 /setting/galleryVideo/*（gallery_video 表）。
 * 页面为自绘网格 + 抽屉式弹窗集合，不使用 ListPage（旧版即为分组树 + 网格，无表格列）。
 */

type MaterialTab = 'image' | 'video';

interface GroupNode {
  id: number;
  parentId: number;
  name: string;
  count: number;
  children: GroupNode[];
}

interface PicItem {
  picId: number;
  galleryId?: number;
  picName?: string;
  picUrl?: string;
  picThumb?: string;
  picSize?: number | string;
  picWidth?: number;
  picHeight?: number;
  fileType?: string;
  addTime?: string | number;
}

interface VideoItem {
  id: number;
  galleryId?: number;
  videoName?: string;
  videoUrl?: string;
  videoCover?: string;
  videoFirstFrame?: string;
  format?: string;
  duration?: string;
  size?: string;
  addTime?: string | number;
  description?: string;
  source?: string;
}

type MaterialItem = PicItem | VideoItem;

interface RawGalleryNode {
  id?: number;
  galleryId?: number;
  parentId?: number;
  name?: string;
  galleryName?: string;
  picCount?: number;
  children?: RawGalleryNode[];
}

interface RawVideoNode {
  id?: number;
  parentId?: number;
  name?: string;
  children?: RawVideoNode[];
}

/** 与旧版对齐的筛选字段（sortMode/format/source 均带「全部」空值选项，Semi Select 无 clearable） */
const FILTERS = [
  { field: 'keyword', label: '素材名称', type: 'input' as const, width: 200 },
  { field: 'sortMode', label: '排序', type: 'select' as const, width: 156 },
  { field: 'format', label: '全部格式', type: 'select' as const, width: 130 },
  { field: 'source', label: '全部来源', type: 'select' as const, width: 130 },
];

const SORT_OPTIONS = [
  { label: '按更新时间排序', value: 'desc' },
  { label: '时间从先到后', value: 'asc' },
  { label: '按名称排序', value: 'name' },
];

const FORMAT_VALUES = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];

const FORMAT_OPTIONS = [
  { label: '全部格式', value: '' },
  ...FORMAT_VALUES.map((item) => ({ label: item === 'webp' ? 'WebP' : item.toUpperCase(), value: item })),
];

const SOURCE_OPTIONS = [
  { label: '全部来源', value: '' },
  { label: '本地上传', value: 'local' },
  { label: '外部链接', value: 'external' },
];

const PAGE_SIZE_OPTS = [30, 50, 100];

const itemId = (item: MaterialItem, tab: MaterialTab) =>
  tab === 'image' ? (item as PicItem).picId : (item as VideoItem).id;

const materialUrl = (item: MaterialItem, tab: MaterialTab) => {
  if (tab === 'image') {
    const pic = item as PicItem;
    return pic.picUrl || pic.picThumb || '';
  }
  return (item as VideoItem).videoUrl || '';
};

const formatBytes = (size?: number | string) => {
  if (size === undefined || size === null || size === '' || Number(size) === 0) return '';
  const bytes = typeof size === 'string' ? Number.parseFloat(size) : size;
  if (!Number.isFinite(bytes) || bytes <= 0) return typeof size === 'string' ? String(size) : '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};

const formatDate = (value?: string | number | null, withTime = true) => {
  if (value === undefined || value === null || value === '') return '';
  const raw = String(value);
  if (!/^\d+$/.test(raw)) return raw;
  const date = new Date(Number(raw) * 1000);
  if (Number.isNaN(date.getTime())) return raw;
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (!withTime) return day;
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

const extractFileName = (url: string) => {
  try {
    const name = new URL(url).pathname.split('/').pop() || '';
    return name || '外部图片';
  } catch {
    return '外部图片';
  }
};

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value.trim());

const copyText = async (text: string) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const downloadUrlAsFile = async (url: string, filename: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('下载失败，请检查资源跨域配置');
  saveBlob(await res.blob(), filename);
};

/** batchDownload 返回 zip 二进制流，apiPost 会按 JSON 解析，这里单独走 fetch */
const postForBlob = async (path: string, body: unknown, filename: string) => {
  const res = await fetch(`/adminapi${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...getContextHeaders(),
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error('登录已过期，请重新登录');
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.msg || '请求失败');
  }
  saveBlob(await res.blob(), filename);
};

const ensureNotDemo = (t: (key: string) => string) => {
  if (isDemo()) {
    Toast.warning({ content: t('演示模式不支持该操作') });
    return false;
  }
  return true;
};

const readVideoDuration = (file: File) =>
  new Promise<string>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = objectUrl;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(formatDuration(video.duration));
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve('');
    };
  });

const videoNameFromFile = (file: File) => {
  const base = file.name.replace(/\.[^.]+$/, '');
  return (base || file.name).slice(0, 20);
};

const normalizeGalleryNodes = (nodes: RawGalleryNode[]): GroupNode[] =>
  (nodes || []).map((node) => ({
    id: Number(node.galleryId ?? node.id ?? 0),
    parentId: Number(node.parentId ?? 0),
    name: node.galleryName || node.name || '',
    count: Number(node.picCount ?? 0),
    children: normalizeGalleryNodes(node.children || []),
  }));

const normalizeVideoNodes = (nodes: RawVideoNode[]): GroupNode[] =>
  (nodes || []).map((node) => ({
    id: Number(node.id ?? 0),
    parentId: Number(node.parentId ?? 0),
    name: node.name || '',
    count: 0,
    children: normalizeVideoNodes(node.children || []),
  }));

const filterGroups = (nodes: GroupNode[], keyword: string): GroupNode[] => {
  const key = keyword.trim().toLowerCase();
  if (!key) return nodes;
  const result: GroupNode[] = [];
  nodes.forEach((node) => {
    const children = node.children.length ? filterGroups(node.children, keyword) : [];
    if (node.name.toLowerCase().includes(key) || children.length) {
      result.push({ ...node, children });
    }
  });
  return result;
};

const collectExpandable = (nodes: GroupNode[]): number[] => {
  const ids: number[] = [];
  const walk = (list: GroupNode[]) => {
    list.forEach((node) => {
      if (node.children.length) {
        ids.push(node.id);
        walk(node.children);
      }
    });
  };
  walk(nodes);
  return ids;
};

const isSameOrDescendant = (nodes: GroupNode[], ancestorId: number, targetId: number): boolean => {
  for (const node of nodes) {
    if (node.id === ancestorId) {
      const found = (list: GroupNode[]): boolean =>
        list.some((item) => item.id === targetId || found(item.children));
      return found([node]);
    }
    if (node.children.length) {
      const hit = isSameOrDescendant(node.children, ancestorId, targetId);
      if (hit) return true;
    }
  }
  return false;
};

export default function MaterialCenter() {
  const { t } = useI18n();
  const [tab, setTab] = useState<MaterialTab>('image');
  const [groups, setGroups] = useState<GroupNode[]>([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [albumId, setAlbumId] = useState(0);

  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState<{ keyword: string; sortMode: string; format: string; source: string }>({
    keyword: '',
    sortMode: 'desc',
    format: '',
    source: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  // 拖拽上传
  const [dropActive, setDropActive] = useState(false);
  const [dropUploading, setDropUploading] = useState(false);
  const [dropText, setDropText] = useState('');

  // 分组新增 / 重命名
  const [albumFormOpen, setAlbumFormOpen] = useState(false);
  const [albumForm, setAlbumForm] = useState<{ mode: 'add' | 'rename'; id: number; parentId: number; name: string }>({
    mode: 'add',
    id: 0,
    parentId: 0,
    name: '',
  });
  const [albumSaving, setAlbumSaving] = useState(false);

  // 分组删除（策略：仅删分组 / 连素材一起删）
  const [albumDeleteOpen, setAlbumDeleteOpen] = useState(false);
  const [albumDeleteTarget, setAlbumDeleteTarget] = useState<{ id: number; name: string }>({ id: 0, name: '' });
  const [deleteMode, setDeleteMode] = useState('only_group');
  const [albumDeleting, setAlbumDeleting] = useState(false);

  // 分组管理（素材转移）
  const [manageOpen, setManageOpen] = useState(false);
  const [manageSource, setManageSource] = useState<number | undefined>(undefined);
  const [manageTarget, setManageTarget] = useState<number | undefined>(undefined);
  const [manageMode, setManageMode] = useState('move_and_delete');
  const [manageSaving, setManageSaving] = useState(false);

  // 移动到（选中素材转移分组）
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<number | undefined>(undefined);
  const [transferSaving, setTransferSaving] = useState(false);

  // 上传图片
  const [uploadImgOpen, setUploadImgOpen] = useState(false);
  const [uploadGalleryId, setUploadGalleryId] = useState(0);
  const [uploadFiles, setUploadFiles] = useState<Array<{ file: File; url: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // 上传视频
  const [uploadVideoOpen, setUploadVideoOpen] = useState(false);
  const [videoForm, setVideoForm] = useState<{
    videoUrl: string;
    videoName: string;
    videoCover: string;
    galleryId: number;
    format: string;
    duration: string;
    size: string;
  }>({ videoUrl: '', videoName: '', videoCover: '', galleryId: 0, format: '', duration: '', size: '' });
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoSaving, setVideoSaving] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoCoverInputRef = useRef<HTMLInputElement>(null);

  // 外部图片 / 外部视频
  const [extImgOpen, setExtImgOpen] = useState(false);
  const [extImgForm, setExtImgForm] = useState<{ galleryId: number; picUrl: string }>({ galleryId: 0, picUrl: '' });
  const [extImgSaving, setExtImgSaving] = useState(false);
  const [extVideoOpen, setExtVideoOpen] = useState(false);
  const [extVideoForm, setExtVideoForm] = useState<{ galleryId: number; videoUrl: string; videoName: string; videoCover: string }>({
    galleryId: 0,
    videoUrl: '',
    videoName: '',
    videoCover: '',
  });
  const [extVideoSaving, setExtVideoSaving] = useState(false);
  const extVideoCoverInputRef = useRef<HTMLInputElement>(null);
  const [extCoverUploading, setExtCoverUploading] = useState(false);

  // 预览（下标驱动，支持上一个/下一个）
  const [previewIndex, setPreviewIndex] = useState(-1);

  // AI图片处理（v5.8.61：翻译 / 智能消除，仅图片 tab）
  const [aiDialog, setAiDialog] = useState<{ mode: 'translate' | 'erase'; item: PicItem } | null>(null);

  // 编辑素材
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<{ id: number; name: string; galleryId: number; description: string; videoCover: string }>({
    id: 0,
    name: '',
    galleryId: 0,
    description: '',
    videoCover: '',
  });
  const [editOriginal, setEditOriginal] = useState<Record<string, any>>({});
  const [editSaving, setEditSaving] = useState(false);
  const editCoverInputRef = useRef<HTMLInputElement>(null);

  const reload = () => setReloadKey((key) => key + 1);

  // ——— 分组树 ———
  useEffect(() => {
    if (isDemo()) return;
    let alive = true;
    const loadTree = async () => {
      try {
        if (tab === 'image') {
          const result = await apiGet<{ records?: RawGalleryNode[] }>('/setting/gallery/tree', { type: 'image' });
          const tree = normalizeGalleryNodes(result?.records || []);
          if (alive) {
            setGroups(tree);
            setExpandedIds(collectExpandable(tree));
          }
        } else {
          // 视频分组在 gallery_video 表，/setting/gallery/tree 只读 gallery 表，必须走 getAllCategory
          const result = await apiGet<RawVideoNode[]>('/setting/galleryVideo/getAllCategory');
          const tree = normalizeVideoNodes(result || []);
          if (alive) {
            setGroups(tree);
            setExpandedIds(collectExpandable(tree));
          }
        }
      } catch (error) {
        if (alive) Toast.error({ content: error instanceof Error ? error.message : t('加载分组失败') });
      }
    };
    loadTree();
    return () => {
      alive = false;
    };
  }, [tab, reloadKey]);

  // ——— 素材列表 ———
  useEffect(() => {
    if (isDemo()) return;
    let alive = true;
    const loadMaterials = async () => {
      setLoading(true);
      try {
        const albumFilter =
          albumId > 0 ? (tab === 'image' ? { galleryId: albumId } : { id: albumId }) : {};
        const isNameSort = query.sortMode === 'name';
        if (tab === 'image') {
          const result = await apiGet<any>('/setting/galleryPic/list', {
            ...albumFilter,
            page,
            size: pageSize,
            sortField: isNameSort ? 'picName' : undefined,
            sortOrder: isNameSort ? 'asc' : query.sortMode,
            keyword: query.keyword || undefined,
            format: query.format || undefined,
            source: query.source || undefined,
          });
          const records = (result?.galleryPicPage?.records || []).filter(
            (item: PicItem) => item.picThumb || item.picUrl,
          );
          if (alive) {
            setItems(records);
            setTotal(result?.galleryPicPage?.total || 0);
          }
        } else {
          const result = await apiGet<any>('/setting/galleryVideoInfo/list', {
            ...albumFilter,
            page,
            size: pageSize,
            sortField: isNameSort ? 'videoName' : undefined,
            sortOrder: isNameSort ? 'asc' : query.sortMode,
            keyword: query.keyword || undefined,
            source: query.source || undefined,
          });
          if (alive) {
            setItems(result?.galleryVideoInfoPage?.records || []);
            setTotal(result?.galleryVideoInfoPage?.total || 0);
          }
        }
      } catch (error) {
        if (alive) Toast.error({ content: error instanceof Error ? error.message : t('加载素材失败') });
      } finally {
        if (alive) setLoading(false);
      }
    };
    loadMaterials();
    return () => {
      alive = false;
    };
  }, [tab, albumId, page, pageSize, query, reloadKey]);

  const filteredGroups = useMemo(() => filterGroups(groups, groupSearch), [groups, groupSearch]);

  /** 分组下拉选项（扁平 + 全角空格缩进，对齐旧版 tree-select check-strictly） */
  const groupOptions = useMemo(() => {
    const flat: Array<{ label: string; value: number; disabled?: boolean }> = [
      { label: tab === 'image' ? t('全部图片') : t('全部视频'), value: 0 },
    ];
    const walk = (nodes: GroupNode[], depth: number) => {
      nodes.forEach((node) => {
        flat.push({ label: `${'　'.repeat(depth)}${node.name}`, value: node.id });
        if (node.children.length) walk(node.children, depth + 1);
      });
    };
    walk(groups, 0);
    return flat;
  }, [groups, tab, t]);

  const currentAlbumName = useMemo(() => {
    if (albumId === 0) return tab === 'image' ? t('全部图片') : t('全部视频');
    const find = (nodes: GroupNode[]): string => {
      for (const node of nodes) {
        if (node.id === albumId) return node.name;
        const child = node.children.length ? find(node.children) : '';
        if (child) return child;
      }
      return '';
    };
    return find(groups);
  }, [groups, albumId, tab, t]);

  const isAllSelected = items.length > 0 && items.every((item) => selectedIds.includes(itemId(item, tab)));
  const isIndeterminate = selectedIds.length > 0 && !isAllSelected;
  const previewItem = previewIndex >= 0 ? items[previewIndex] : undefined;

  // ——— 交互 ———
  const switchTab = (next: MaterialTab) => {
    if (next === tab) return;
    setTab(next);
    setAlbumId(0);
    setPage(1);
    setSelectedIds([]);
    setKeyword('');
    setGroupSearch('');
    setQuery({ keyword: '', sortMode: 'desc', format: '', source: '' });
    setPreviewIndex(-1);
  };

  const handleAlbumSelect = (id: number) => {
    setAlbumId(id);
    setPage(1);
    setSelectedIds([]);
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : current.concat(id),
    );
  };

  const search = () => {
    setQuery((current) => ({ ...current, keyword }));
    setPage(1);
  };

  const resetFilters = () => {
    setKeyword('');
    setQuery({ keyword: '', sortMode: 'desc', format: '', source: '' });
    setPage(1);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : current.concat(id),
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? items.map((item) => itemId(item, tab)) : []);
  };

  // 上传图片弹窗：选中文件及其预览地址（对象 URL 存 state，避免渲染期反复创建）

  // ——— 分组新增 / 重命名 ———
  const openAlbumForm = (mode: 'add' | 'rename', parentId: number, id = 0, name = '') => {
    setAlbumForm({ mode, id, parentId, name });
    setAlbumFormOpen(true);
  };

  const submitAlbumForm = async () => {
    const name = albumForm.name.trim();
    if (!name) {
      Toast.warning({ content: t('请输入分组名称') });
      return;
    }
    setAlbumSaving(true);
    try {
      if (tab === 'image') {
        await apiPost(
          albumForm.mode === 'add' ? '/setting/gallery/create' : '/setting/gallery/update',
          albumForm.mode === 'add'
            ? { parentId: albumForm.parentId || 0, galleryName: name }
            : { id: albumForm.id, parentId: albumForm.parentId || 0, galleryName: name },
        );
      } else {
        await apiPost(
          albumForm.mode === 'add' ? '/setting/galleryVideo/create' : '/setting/galleryVideo/update',
          albumForm.mode === 'add'
            ? { parentId: albumForm.parentId || 0, name }
            : { id: albumForm.id, name },
        );
      }
      Toast.success({ content: t('保存成功') });
      setAlbumFormOpen(false);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setAlbumSaving(false);
    }
  };

  // ——— 分组删除 ———
  const openAlbumDelete = (node: GroupNode) => {
    setAlbumDeleteTarget({ id: node.id, name: node.name });
    setDeleteMode('only_group');
    setAlbumDeleteOpen(true);
  };

  const submitAlbumDelete = async () => {
    if (!albumDeleteTarget.id) return;
    setAlbumDeleting(true);
    try {
      const payload = { id: albumDeleteTarget.id, deleteMode };
      await apiPost(tab === 'image' ? '/setting/gallery/del' : '/setting/galleryVideo/del', payload);
      Toast.success({ content: t('删除成功') });
      setAlbumDeleteOpen(false);
      if (isSameOrDescendant(groups, albumDeleteTarget.id, albumId)) {
        setAlbumId(0);
        setPage(1);
        setSelectedIds([]);
      }
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    } finally {
      setAlbumDeleting(false);
    }
  };

  // ——— 分组管理（素材转移） ———
  const openManage = () => {
    setManageSource(undefined);
    setManageTarget(undefined);
    setManageMode('move_and_delete');
    setManageOpen(true);
  };

  const submitManage = async () => {
    if (manageSource === undefined || manageTarget === undefined) {
      Toast.warning({ content: t('请选择需要转移的分组和目标分组') });
      return;
    }
    if (String(manageSource) === String(manageTarget)) {
      Toast.warning({ content: t('转移分组和目标分组不能相同') });
      return;
    }
    setManageSaving(true);
    try {
      await apiPost('/setting/gallery/move', {
        sourceId: manageSource,
        targetId: manageTarget,
        mode: manageMode,
        type: tab,
      });
      Toast.success({ content: t('分组转移成功') });
      setManageOpen(false);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('分组转移失败') });
    } finally {
      setManageSaving(false);
    }
  };

  // ——— 移动到 ———
  const openTransfer = () => {
    if (!selectedIds.length) return;
    setTransferTarget(undefined);
    setTransferOpen(true);
  };

  const submitTransfer = async () => {
    if (transferTarget === undefined) {
      Toast.warning({ content: t('请选择目标分组') });
      return;
    }
    setTransferSaving(true);
    try {
      await apiPost('/setting/galleryPic/transfer', {
        ids: selectedIds,
        targetGalleryId: transferTarget,
        type: tab,
      });
      Toast.success({ content: t('移动成功') });
      setTransferOpen(false);
      setSelectedIds([]);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('移动失败') });
    } finally {
      setTransferSaving(false);
    }
  };

  // ——— 删除素材 ———
  const confirmDeleteOne = (item: MaterialItem) => {
    Modal.confirm({
      title: t('确认删除该{type}吗?', { type: tab === 'image' ? t('图片') : t('视频') }),
      onOk: async () => {
        try {
          await apiPost(
            tab === 'image' ? '/setting/galleryPic/del' : '/setting/galleryVideoInfo/del',
            { id: itemId(item, tab) },
          );
          Toast.success({ content: t('删除成功') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
      },
    });
  };

  const confirmBatchDelete = () => {
    if (!selectedIds.length) return;
    Modal.confirm({
      title: t('确认批量删除已选中的 {count} 个素材吗？', { count: selectedIds.length }),
      onOk: async () => {
        try {
          await apiPost('/setting/galleryPic/batchDel', { ids: selectedIds, type: tab });
          Toast.success({ content: t('删除成功') });
          setSelectedIds([]);
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('批量删除失败') });
        }
      },
    });
  };

  // ——— 批量下载（zip 二进制） ———
  const handleBatchDownload = async () => {
    if (!selectedIds.length) return;
    if (!ensureNotDemo(t)) return;
    try {
      await postForBlob(
        '/setting/galleryPic/batchDownload',
        { ids: selectedIds, type: tab },
        `${tab === 'image' ? '图片' : '视频'}素材.zip`,
      );
      Toast.success({ content: t('下载成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('下载失败') });
    }
  };

  // ——— 单个下载 / 复制链接 ———
  const downloadOne = async (item: MaterialItem) => {
    const url = materialUrl(item, tab);
    if (!url) return;
    const name =
      tab === 'image'
        ? (item as PicItem).picName || 'image'
        : (item as VideoItem).videoName || 'video';
    try {
      await downloadUrlAsFile(url, name);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('下载失败，请检查资源跨域配置') });
    }
  };

  const copyOne = async (item: MaterialItem) => {
    try {
      await copyText(materialUrl(item, tab));
      Toast.success({ content: t('链接已复制') });
    } catch {
      Toast.error({ content: t('复制失败') });
    }
  };

  // ——— 导出链接（旧版 xlsx，本页无 xlsx 依赖，降级为带 BOM 的 CSV） ———
  const handleExportLinks = () => {
    const selected = items.filter((item) => selectedIds.includes(itemId(item, tab)));
    if (!selected.length) return;
    const escape = (value: unknown) => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    let head: string[];
    let rows: string[][];
    if (tab === 'image') {
      head = [t('图片名称'), t('格式'), t('尺寸'), t('大小'), t('上传时间'), t('图片链接地址')];
      rows = selected.map((item) => {
        const pic = item as PicItem;
        return [
          pic.picName || '',
          (pic.fileType || pic.picName?.split('.').pop() || '').toUpperCase(),
          pic.picWidth && pic.picHeight ? `${pic.picWidth} x ${pic.picHeight}` : '',
          formatBytes(pic.picSize),
          formatDate((pic as any).createTime ?? pic.addTime),
          pic.picUrl || pic.picThumb || '',
        ];
      });
    } else {
      head = [t('视频名称'), t('上传时间'), t('格式'), t('大小'), t('时长'), t('视频链接地址')];
      rows = selected.map((item) => {
        const video = item as VideoItem;
        return [
          video.videoName || '',
          formatDate(video.addTime),
          (video.format || '').toUpperCase(),
          video.size || '',
          video.duration || '',
          video.videoUrl || '',
        ];
      });
    }
    const csv = [head, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
    saveBlob(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }), `${tab === 'image' ? '图片' : '视频'}素材链接.csv`);
    Toast.success({ content: t('导出成功') });
  };

  // ——— 预览 ———
  const openPreview = (item: MaterialItem) => {
    const index = items.findIndex((row) => itemId(row, tab) === itemId(item, tab));
    setPreviewIndex(index);
  };

  // ——— AI图片处理入口（原版对商品图/业务图触发 AI翻译/AI擦除；素材中心对图片项提供同样入口） ———
  const openAiDialog = async (mode: 'translate' | 'erase', item: MaterialItem) => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持该操作') });
      return;
    }
    if (!(await ensureAiImageEnabled())) return;
    setAiDialog({ mode, item: item as PicItem });
  };

  const aiDialogImageUrl = aiDialog
    ? aiDialog.item.picUrl || aiDialog.item.picThumb || ''
    : '';

  const handleAiDialogOk = () => {
    // 与原版一致：结果不回写素材库记录；后端已把结果图上传至素材库（未分组），
    // 这里刷新列表让新图可见，并交回结果 URL
    setAiDialog(null);
    reload();
  };

  // ——— 编辑素材 ———
  const openEdit = async (item: MaterialItem) => {
    try {
      if (tab === 'image') {
        const detail = await apiGet<PicItem | null>('/setting/galleryPic/detail', { id: (item as PicItem).picId });
        const base = detail || (item as PicItem);
        setEditOriginal(base as unknown as Record<string, any>);
        setEditForm({
          id: base.picId,
          name: base.picName || '',
          galleryId: base.galleryId || 0,
          description: '',
          videoCover: '',
        });
      } else {
        const detail = await apiGet<any>('/setting/galleryVideoInfo/detail', { id: (item as VideoItem).id });
        const base = detail || (item as VideoItem);
        setEditOriginal(base);
        setEditForm({
          id: base.id,
          name: base.videoName || '',
          galleryId: base.galleryId || 0,
          description: base.description || '',
          videoCover: base.videoCover || '',
        });
      }
      setEditOpen(true);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载详情失败') });
    }
  };

  const submitEdit = async () => {
    const name = editForm.name.trim();
    if (!name) {
      Toast.warning({ content: tab === 'image' ? t('请输入图片名称') : t('请输入视频名称') });
      return;
    }
    setEditSaving(true);
    try {
      if (tab === 'image') {
        await apiPost('/setting/galleryPic/updateField', { id: editForm.id, field: 'picName', val: name });
        if (String(editForm.galleryId || 0) !== String(editOriginal.galleryId ?? 0)) {
          await apiPost('/setting/galleryPic/transfer', {
            ids: [editForm.id],
            targetGalleryId: editForm.galleryId || 0,
            type: 'image',
          });
        }
      } else {
        await apiPost('/setting/galleryVideoInfo/update', {
          ...editOriginal,
          id: editForm.id,
          videoName: name,
          galleryId: [editForm.galleryId || 0],
          videoCover: editForm.videoCover,
          description: editForm.description,
        });
      }
      Toast.success({ content: t('保存成功') });
      setEditOpen(false);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setEditSaving(false);
    }
  };

  // ——— 上传图片弹窗 ———
  const openUploadImage = () => {
    setUploadGalleryId(albumId || 0);
    setUploadFiles([]);
    setUploadImgOpen(true);
  };

  const addUploadFiles = (list: FileList | null) => {
    if (!list || !list.length) return;
    const images = Array.from(list).filter((file) => file.type.startsWith('image/'));
    if (!images.length) {
      Toast.warning({ content: t('请选择图片文件') });
      return;
    }
    setUploadFiles((current) =>
      current.concat(images.map((file) => ({ file, url: URL.createObjectURL(file) }))),
    );
  };

  const removeUploadFile = (index: number) => {
    setUploadFiles((current) => {
      const [removed] = current[index] ? [current[index]] : [];
      if (removed) URL.revokeObjectURL(removed.url);
      return current.filter((_, i) => i !== index);
    });
  };

  const submitUploadImage = async () => {
    if (!uploadFiles.length) {
      Toast.warning({ content: t('请先选择要上传的图片') });
      return;
    }
    if (!ensureNotDemo(t)) return;
    setUploading(true);
    let success = 0;
    let fail = 0;
    try {
      for (const entry of uploadFiles) {
        try {
          await apiUpload(`/setting/galleryPic/uploadImg?galleryId=${uploadGalleryId || 0}`, entry.file);
          success += 1;
        } catch {
          fail += 1;
        }
      }
      if (fail === 0) {
        Toast.success({ content: t('全部上传成功') });
        setUploadImgOpen(false);
      } else if (success > 0) {
        Toast.warning({ content: t('上传完成，成功 {success} 个，失败 {fail} 个', { success, fail }) });
      } else {
        Toast.error({ content: t('上传失败') });
      }
      if (success > 0) {
        setUploadFiles([]);
        reload();
      }
    } finally {
      setUploading(false);
    }
  };

  // ——— 上传视频弹窗 ———
  const openUploadVideo = () => {
    setVideoForm({
      videoUrl: '',
      videoName: '',
      videoCover: '',
      galleryId: albumId || 0,
      format: '',
      duration: '',
      size: '',
    });
    setUploadVideoOpen(true);
  };

  const pickVideoFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.mp4')) {
      Toast.error({ content: t('不支持该格式的视频文件，仅支持 .mp4') });
      return;
    }
    if (!ensureNotDemo(t)) return;
    setVideoUploading(true);
    try {
      const data = await apiUpload<Record<string, any>>('/setting/galleryVideoInfo/uploadVideo', file);
      const duration = await readVideoDuration(file);
      setVideoForm((current) => ({
        ...current,
        ...data,
        videoUrl: data?.videoUrl || current.videoUrl,
        videoName: current.videoName || videoNameFromFile(file),
        format: data?.format || '',
        duration,
        size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      }));
      Toast.success({ content: t('视频上传成功！') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('视频上传失败') });
    } finally {
      setVideoUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const submitUploadVideo = async () => {
    if (!videoForm.videoUrl) {
      Toast.warning({ content: t('请上传本地视频!') });
      return;
    }
    const name = videoForm.videoName.trim();
    if (!name) {
      Toast.warning({ content: t('视频名称不能为空') });
      return;
    }
    if (name.length > 20) {
      Toast.warning({ content: t('视频名称不能超过20个字') });
      return;
    }
    setVideoSaving(true);
    try {
      await apiPost('/setting/galleryVideoInfo/create', {
        videoUrl: videoForm.videoUrl,
        videoName: name,
        videoCover: videoForm.videoCover,
        galleryId: [videoForm.galleryId || 0],
        format: videoForm.format,
        duration: videoForm.duration,
        size: videoForm.size,
        source: 'upload',
      });
      Toast.success({ content: t('操作成功') });
      setUploadVideoOpen(false);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('上传视频失败') });
    } finally {
      setVideoSaving(false);
    }
  };

  // ——— 外部图片 / 外部视频 ———
  const openExtImage = () => {
    setExtImgForm({ galleryId: albumId || 0, picUrl: '' });
    setExtImgOpen(true);
  };

  const submitExtImage = async () => {
    const url = extImgForm.picUrl.trim();
    if (!url) {
      Toast.warning({ content: t('请输入图片的网络地址') });
      return;
    }
    if (!isHttpUrl(url)) {
      Toast.warning({ content: t('请输入以 http:// 或 https:// 开头的网络地址') });
      return;
    }
    setExtImgSaving(true);
    try {
      await apiPost('/setting/galleryPic/createFromExternal', {
        picUrl: url,
        picThumb: url,
        picName: extractFileName(url),
        galleryId: extImgForm.galleryId || 0,
        source: 'external',
      });
      Toast.success({ content: t('添加外部图片成功') });
      setExtImgOpen(false);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('添加外部图片失败') });
    } finally {
      setExtImgSaving(false);
    }
  };

  const openExtVideo = () => {
    setExtVideoForm({ galleryId: albumId || 0, videoUrl: '', videoName: '', videoCover: '' });
    setExtVideoOpen(true);
  };

  const pickExtVideoCover = async (file: File | undefined | null) => {
    if (!file) return;
    if (!ensureNotDemo(t)) return;
    setExtCoverUploading(true);
    try {
      const result = await apiUpload<{ picUrl?: string }>('/setting/galleryPic/uploadImg?galleryId=0', file);
      if (result?.picUrl) {
        setExtVideoForm((current) => ({ ...current, videoCover: result.picUrl as string }));
      }
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('封面上传失败') });
    } finally {
      setExtCoverUploading(false);
      if (extVideoCoverInputRef.current) extVideoCoverInputRef.current.value = '';
    }
  };

  const submitExtVideo = async () => {
    const url = extVideoForm.videoUrl.trim();
    if (!url) {
      Toast.warning({ content: t('请输入视频文件的网络地址') });
      return;
    }
    if (!isHttpUrl(url)) {
      Toast.warning({ content: t('请输入以 http:// 或 https:// 开头的网络地址') });
      return;
    }
    if (!extVideoForm.videoName.trim()) {
      Toast.warning({ content: t('请输入视频名称') });
      return;
    }
    setExtVideoSaving(true);
    try {
      await apiPost('/setting/galleryVideoInfo/create', {
        videoUrl: url,
        videoName: extVideoForm.videoName.trim().slice(0, 20),
        galleryId: [extVideoForm.galleryId || 0],
        videoCover: extVideoForm.videoCover,
        source: 'external',
        duration: '',
        size: '',
        format: '',
      });
      Toast.success({ content: t('添加外部视频成功') });
      setExtVideoOpen(false);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('添加外部视频失败') });
    } finally {
      setExtVideoSaving(false);
    }
  };

  // ——— 拖拽上传（落到当前分组） ———
  const handleDroppedFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    if (!ensureNotDemo(t)) return;
    const list = Array.from(files).filter((file) =>
      tab === 'image' ? file.type.startsWith('image/') : file.name.toLowerCase().endsWith('.mp4'),
    );
    if (!list.length) {
      Toast.warning({ content: tab === 'image' ? t('请拖入图片文件') : t('请拖入 .mp4 视频文件') });
      return;
    }
    const totalCount = list.length;
    let success = 0;
    let fail = 0;
    setDropUploading(true);
    try {
      for (let i = 0; i < list.length; i += 1) {
        const file = list[i];
        setDropText(totalCount > 1 ? t('正在上传 {current}/{total}', { current: i + 1, total: totalCount }) : t('正在上传'));
        try {
          if (tab === 'image') {
            await apiUpload(`/setting/galleryPic/uploadImg?galleryId=${albumId || 0}`, file);
          } else {
            const data = await apiUpload<Record<string, any>>('/setting/galleryVideoInfo/uploadVideo', file);
            const duration = await readVideoDuration(file);
            setDropText(totalCount > 1 ? t('正在保存 {current}/{total}', { current: i + 1, total: totalCount }) : t('正在保存'));
            await apiPost('/setting/galleryVideoInfo/create', {
              ...data,
              videoName: videoNameFromFile(file),
              duration,
              size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
              videoCover: '',
              galleryId: [albumId || 0],
              source: 'upload',
            });
          }
          success += 1;
        } catch {
          fail += 1;
        }
      }
    } finally {
      setDropUploading(false);
      setDropText('');
    }
    if (success > 0) reload();
    if (fail === 0 && success > 0) {
      Toast.success({ content: t('全部上传成功') });
    } else if (success > 0) {
      Toast.warning({ content: t('上传完成，成功 {success} 个，失败 {fail} 个', { success, fail }) });
    } else {
      Toast.error({ content: t('上传失败') });
    }
  };

  /** 分组排序（对齐旧版拖拽排序：POST /setting/gallery/sort {ids, type}，此处用上移/下移表达）。 */
  const moveGroup = (node: GroupNode, direction: 'up' | 'down', siblings: GroupNode[]) => {
    const index = siblings.findIndex((item) => item.id === node.id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;
    const ids = siblings.map((item) => item.id);
    [ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]];
    apiPost('/setting/gallery/sort', { ids, type: tab === 'video' ? 2 : 1 })
      .then(() => {
        Toast.success({ content: t('排序成功') });
        setReloadKey((key) => key + 1);
      })
      .catch((error) => Toast.error({ content: error instanceof Error ? error.message : t('排序失败') }));
  };

  // ——— 渲染：分组树 ———
  const renderTreeNodes = (nodes: GroupNode[], depth: number): ReactNode =>
    nodes.map((node) => (
      <div key={node.id}>
        <div
          className={`mc-tree-node${albumId === node.id ? ' is-active' : ''}`}
          style={{ paddingLeft: 12 + depth * 18 }}
          onClick={() => handleAlbumSelect(node.id)}
        >
          <span
            className={`mc-tree-arrow${expandedIds.includes(node.id) ? ' is-expanded' : ''}${
              node.children.length ? '' : ' is-leaf'
            }`}
            onClick={(event) => {
              event.stopPropagation();
              toggleExpand(node.id);
            }}
          />
          <span className="mc-tree-name" title={node.name}>
            {node.name}
            {node.count > 0 ? <span className="mc-tree-count">{node.count}</span> : null}
          </span>
          <Dropdown
            trigger="click"
            position="bottomRight"
            menu={[
              { node: 'item', name: t('添加子分组'), onClick: () => openAlbumForm('add', node.id) },
              { node: 'item', name: t('重命名'), onClick: () => openAlbumForm('rename', node.id, node.parentId || 0, node.name) },
              { node: 'item', name: t('上移'), onClick: () => moveGroup(node, 'up', nodes) },
              { node: 'item', name: t('下移'), onClick: () => moveGroup(node, 'down', nodes) },
              { node: 'item', name: t('删除'), onClick: () => openAlbumDelete(node) },
            ]}
          >
            <span className="mc-tree-more" onClick={(event) => event.stopPropagation()}>
              <IconMore size="small" />
            </span>
          </Dropdown>
        </div>
        {expandedIds.includes(node.id) && node.children.length ? renderTreeNodes(node.children, depth + 1) : null}
      </div>
    ));

  // ——— 渲染：素材卡片 ———
  const renderCard = (item: MaterialItem) => {
    const id = itemId(item, tab);
    const isVideo = tab === 'video';
    const name = isVideo ? (item as VideoItem).videoName || '' : (item as PicItem).picName || '';
    const thumb = isVideo
      ? (item as VideoItem).videoCover || (item as VideoItem).videoFirstFrame || ''
      : (item as PicItem).picThumb || (item as PicItem).picUrl || '';
    const pic = item as PicItem;
    const video = item as VideoItem;
    const meta = isVideo
      ? [video.format?.toUpperCase(), video.size, video.duration].filter(Boolean).join(' · ')
      : [
          pic.fileType?.toUpperCase() || pic.picName?.split('.').pop()?.toUpperCase() || '',
          formatBytes(pic.picSize),
          formatDate(pic.addTime, false),
        ]
          .filter(Boolean)
          .join(' · ');
    const selected = selectedIds.includes(id);
    return (
      <li key={id} className={`mc-card${selected ? ' is-selected' : ''}`}>
        <div className="mc-thumb" onClick={() => openPreview(item)}>
          {isVideo && !thumb ? (
            <video src={video.videoUrl} muted preload="metadata" className="mc-thumb-media" />
          ) : (
            <img src={thumb} alt={name} className="mc-thumb-img" loading="lazy" />
          )}
          {isVideo ? <span className="mc-play-badge" /> : null}
        </div>
        <div className="mc-card-info">
          <div className="mc-card-top">
            <span className="mc-card-name" title={name}>
              {name}
            </span>
            <Checkbox
              checked={selected}
              onChange={() => toggleSelect(id)}
              onClick={(event: ReactMouseEvent<HTMLElement>) => event.stopPropagation()}
              aria-label={t('选择素材')}
            />
          </div>
          <span className="mc-card-meta" title={meta}>
            {meta}
          </span>
        </div>
        <div className="mc-card-actions">
          <Button theme="borderless" size="small" icon={<IconEdit />} title={t('编辑')} onClick={() => openEdit(item)} />
          <Button theme="borderless" size="small" icon={<IconDownload />} title={t('下载')} onClick={() => downloadOne(item)} />
          <Button theme="borderless" size="small" icon={<IconLink />} title={t('复制链接')} onClick={() => copyOne(item)} />
          {isVideo ? null : (
            <Dropdown
              trigger="click"
              position="bottomRight"
              menu={[
                { node: 'item', name: t('AI翻译'), onClick: () => openAiDialog('translate', item) },
                { node: 'item', name: t('AI擦除'), onClick: () => openAiDialog('erase', item) },
              ]}
            >
              <Button theme="borderless" size="small" icon={<IconMore />} title={t('AI图片处理')} />
            </Dropdown>
          )}
          <Button
            theme="borderless"
            type="danger"
            size="small"
            icon={<IconDelete />}
            title={t('删除')}
            onClick={() => confirmDeleteOne(item)}
          />
        </div>
      </li>
    );
  };

  const renderFilter = (filter: (typeof FILTERS)[number]) => {
    if (filter.type === 'input') {
      return (
        <Input
          key={filter.field}
          prefix={<IconSearch />}
          placeholder={tab === 'image' ? t('图片名称') : t('视频名称')}
          value={keyword}
          onChange={setKeyword}
          onEnterPress={search}
          showClear
          onClear={search}
          style={{ width: filter.width }}
        />
      );
    }
    if (filter.field === 'sortMode') {
      return (
        <Select
          key={filter.field}
          value={query.sortMode}
          optionList={SORT_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
          onChange={(next) => {
            setQuery((current) => ({ ...current, sortMode: String(next) }));
            setPage(1);
          }}
          style={{ width: filter.width }}
        />
      );
    }
    if (filter.field === 'format') {
      if (tab !== 'image') return null;
      return (
        <Select
          key={filter.field}
          value={query.format}
          optionList={FORMAT_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
          onChange={(next) => {
            setQuery((current) => ({ ...current, format: String(next) }));
            setPage(1);
          }}
          style={{ width: filter.width }}
        />
      );
    }
    return (
      <Select
        key={filter.field}
        value={query.source}
        optionList={SOURCE_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
        onChange={(next) => {
          setQuery((current) => ({ ...current, source: String(next) }));
          setPage(1);
        }}
        style={{ width: filter.width }}
      />
    );
  };

  const previewPic = previewItem as PicItem | undefined;
  const previewVideo = previewItem as VideoItem | undefined;
  const previewUrl = previewItem ? materialUrl(previewItem, tab) : '';
  const previewName = previewItem
    ? tab === 'image'
      ? previewPic?.picName || t('素材预览')
      : previewVideo?.videoName || t('素材预览')
    : '';

  return (
    <div className="mc-page">
      <div className="mc-tabs">
        <span className={`mc-tab${tab === 'image' ? ' is-active' : ''}`} onClick={() => switchTab('image')}>
          {t('图片')}
        </span>
        <span className={`mc-tab${tab === 'video' ? ' is-active' : ''}`} onClick={() => switchTab('video')}>
          {t('视频')}
        </span>
      </div>

      <div className="mc-global-actions">
        {tab === 'image' ? (
          <Space>
            <Button theme="solid" type="primary" icon={<IconUpload />} onClick={openUploadImage}>
              {t('上传图片')}
            </Button>
            <Button onClick={openExtImage}>{t('添加外部链接')}</Button>
          </Space>
        ) : (
          <Space>
            <Button theme="solid" type="primary" icon={<IconUpload />} onClick={openUploadVideo}>
              {t('上传视频')}
            </Button>
            <Button onClick={openExtVideo}>{t('添加外部链接')}</Button>
          </Space>
        )}
      </div>

      <div className="mc-body">
        <aside className="mc-sidebar">
          <div className="mc-sidebar-header">
            <span className="mc-sidebar-title">{tab === 'image' ? t('图片分组') : t('视频分组')}</span>
            <a className="mc-sidebar-manage" onClick={openManage}>
              {t('分组管理')}
            </a>
          </div>
          <div className="mc-sidebar-search">
            <Input placeholder={t('搜索分组')} value={groupSearch} onChange={setGroupSearch} showClear />
          </div>
          <div className="mc-sidebar-tree">
            <div className={`mc-tree-node is-root${albumId === 0 ? ' is-active' : ''}`} onClick={() => handleAlbumSelect(0)}>
              <span className="mc-tree-arrow is-expanded" />
              <span className="mc-tree-name">{tab === 'image' ? t('全部图片') : t('全部视频')}</span>
              <Dropdown
                trigger="click"
                position="bottomRight"
                menu={[{ node: 'item', name: t('添加子分组'), onClick: () => openAlbumForm('add', 0) }]}
              >
                <span className="mc-tree-more" onClick={(event) => event.stopPropagation()}>
                  <IconMore size="small" />
                </span>
              </Dropdown>
            </div>
            {renderTreeNodes(filteredGroups, 1)}
          </div>
        </aside>

        <div className="mc-content-wrapper">
          <main className="mc-content">
            <div className="mc-toolbar">
              <Space wrap>
                {FILTERS.map((filter) => renderFilter(filter))}
                <Button theme="solid" type="primary" icon={<IconSearch />} onClick={search}>
                  {t('搜索')}
                </Button>
                <Button onClick={resetFilters}>{t('重置')}</Button>
                <Button icon={<IconRefresh />} onClick={reload}>
                  {t('刷新')}
                </Button>
              </Space>
            </div>

            <div className="mc-batch-bar">
              <Checkbox
                checked={isAllSelected}
                indeterminate={isIndeterminate}
                onChange={(event) => handleSelectAll(Boolean(event.target.checked))}
              >
                {t('全选')}
              </Checkbox>
              <span className="mc-batch-info">
                {t('共{total}条，已选{selected}条', { total, selected: selectedIds.length })}
              </span>
              <Space spacing={8}>
                <Button size="small" disabled={!selectedIds.length} onClick={handleBatchDownload}>
                  {t('批量下载')}
                </Button>
                <Button size="small" disabled={!selectedIds.length} onClick={confirmBatchDelete}>
                  {t('批量删除')}
                </Button>
                <Button size="small" disabled={!selectedIds.length} onClick={openTransfer}>
                  {t('移动到')}
                </Button>
                <Button size="small" disabled={!selectedIds.length} onClick={handleExportLinks}>
                  {t('导出链接')}
                </Button>
              </Space>
            </div>

            {dropUploading ? <div className="mc-drop-tip">{dropText}</div> : null}

            <div
              className={`mc-dropzone${dropActive ? ' is-dragover' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDropActive(true);
              }}
              onDragLeave={() => setDropActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDropActive(false);
                handleDroppedFiles(event.dataTransfer.files);
              }}
            >
              <Spin spinning={loading}>
                {items.length ? (
                  <ul className="mc-grid">{items.map((item) => renderCard(item))}</ul>
                ) : !loading ? (
                  <div className="mc-empty">{t('暂无素材')}</div>
                ) : null}
              </Spin>
            </div>

            <div className="mc-pagination">
              <Pagination
                total={total}
                currentPage={page}
                pageSize={pageSize}
                showTotal
                showSizeChanger
                pageSizeOpts={PAGE_SIZE_OPTS}
                onPageChange={(next) => setPage(next)}
                onPageSizeChange={(next) => {
                  setPageSize(next);
                  setPage(1);
                }}
              />
            </div>
          </main>
        </div>
      </div>

      {/* 分组新增 / 重命名 */}
      <Modal
        title={albumForm.mode === 'add' ? t('新建分组') : t('重命名分组')}
        visible={albumFormOpen}
        okText={t('确定')}
        confirmLoading={albumSaving}
        onOk={submitAlbumForm}
        onCancel={() => setAlbumFormOpen(false)}
        width={420}
      >
        <div className="mc-album-form">
          <label className="mc-form-label">
            {t('分组名称')} <span className="mc-form-required">*</span>
          </label>
          <Input
            maxLength={20}
            value={albumForm.name}
            placeholder={t('请输入分组名称')}
            onChange={(next) => setAlbumForm((current) => ({ ...current, name: next }))}
            onEnterPress={submitAlbumForm}
          />
        </div>
      </Modal>

      {/* 分组删除（策略选择） */}
      <Modal
        title={t('删除分组')}
        visible={albumDeleteOpen}
        okText={t('确定')}
        confirmLoading={albumDeleting}
        onOk={submitAlbumDelete}
        onCancel={() => setAlbumDeleteOpen(false)}
        width={520}
      >
        <div className="mc-album-delete">
          <div className="mc-album-delete-tip">{t('即将对当前分组进行删除')}</div>
          <div className="mc-album-delete-label">{t('请选择删除策略')}</div>
          <RadioGroup value={deleteMode} onChange={(event) => setDeleteMode(event.target.value)}>
            <div className="mc-radio-block">
              <Radio value="only_group">
                <div>
                  <div className="mc-radio-title">{t('仅删除分组(推荐)')}</div>
                  <div className="mc-radio-desc">{t('仅删除分组，组内的素材会移出分组，仍可在全部列表中找到')}</div>
                </div>
              </Radio>
            </div>
            <div className="mc-radio-block">
              <Radio value="group_and_files">
                <div>
                  <div className="mc-radio-title">{t('删除分组及组内素材')}</div>
                  <div className="mc-radio-desc">{t('分组及组内素材将会一并删除，删除不会对已使用图片的业务产生影响。')}</div>
                </div>
              </Radio>
            </div>
          </RadioGroup>
        </div>
      </Modal>

      {/* 分组管理（素材转移） */}
      <Modal
        title={t('分组管理')}
        visible={manageOpen}
        okText={t('确定')}
        confirmLoading={manageSaving}
        onOk={submitManage}
        onCancel={() => setManageOpen(false)}
        width={640}
      >
        <div className="mc-manage-form">
          <div className="mc-form-row">
            <label className="mc-form-label-inline">{t('素材转移')}</label>
            <span>{t('将')}</span>
            <Select
              placeholder={t('请选择')}
              value={manageSource}
              optionList={groupOptions}
              onChange={(next) => setManageSource(Number(next))}
              style={{ width: 200 }}
            />
            <span>{t('移动至')}</span>
            <Select
              placeholder={t('请选择')}
              value={manageTarget}
              optionList={groupOptions}
              onChange={(next) => setManageTarget(Number(next))}
              style={{ width: 200 }}
            />
          </div>
          <div className="mc-form-row">
            <label className="mc-form-label-inline">{t('转移方式')}</label>
            <RadioGroup value={manageMode} onChange={(event) => setManageMode(event.target.value)}>
              <div className="mc-radio-block">
                <Radio value="move_and_delete">
                  <div>
                    <div className="mc-radio-title">{t('移动素材并删除分组')}</div>
                    <div className="mc-radio-desc">{t('原分组及其下级分组将从原目录被删除')}</div>
                  </div>
                </Radio>
              </div>
              <div className="mc-radio-block">
                <Radio value="move_and_keep">
                  <div>
                    <div className="mc-radio-title">{t('移动素材，保留原分组')}</div>
                    <div className="mc-radio-desc">{t('原分组及其下级分组的所有素材将被直接合并，并移动至新分组目录下')}</div>
                  </div>
                </Radio>
              </div>
            </RadioGroup>
          </div>
        </div>
      </Modal>

      {/* 移动到 */}
      <Modal
        title={t('移动到')}
        visible={transferOpen}
        okText={t('确认移动')}
        confirmLoading={transferSaving}
        onOk={submitTransfer}
        onCancel={() => setTransferOpen(false)}
        width={460}
      >
        <div className="mc-transfer-form">
          <p>{t('已选择{count}个素材，请选择目标分组：', { count: selectedIds.length })}</p>
          <Select
            placeholder={t('请选择')}
            value={transferTarget}
            optionList={groupOptions.map((option) => ({
              ...option,
              disabled: String(option.value) === String(albumId),
            }))}
            onChange={(next) => setTransferTarget(Number(next))}
            style={{ width: '100%' }}
          />
        </div>
      </Modal>

      {/* 上传图片 */}
      <Modal
        title={t('上传图片')}
        visible={uploadImgOpen}
        okText={t('确定')}
        confirmLoading={uploading}
        onOk={submitUploadImage}
        onCancel={() => setUploadImgOpen(false)}
        width={600}
      >
        <div className="mc-upload-form">
          <div className="mc-form-row">
            <label className="mc-form-label-inline">{t('上传至分组')}</label>
            <Select
              value={uploadGalleryId}
              optionList={groupOptions}
              onChange={(next) => setUploadGalleryId(Number(next))}
              style={{ width: 320 }}
            />
          </div>
          <div className="mc-form-row">
            <label className="mc-form-label-inline">{t('上传图片')}</label>
            <div>
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => {
                  addUploadFiles(event.target.files);
                  event.target.value = '';
                }}
              />
              <div className="mc-upload-dragger" onClick={() => uploadInputRef.current?.click()}>
                <IconPlus size="large" />
                <div className="mc-upload-text">{t('点击或将文件拖拽到这里上传')}</div>
                {uploadFiles.length ? <div className="mc-upload-count">({t('{count}张', { count: uploadFiles.length })})</div> : null}
              </div>
              {uploadFiles.length ? (
                <div className="mc-upload-previews">
                  {uploadFiles.map((entry, index) => (
                    <div key={`${entry.file.name}-${index}`} className="mc-upload-preview">
                      <img src={entry.url} alt={entry.file.name} />
                      <span className="mc-upload-status">{t('待上传')}</span>
                      <span
                        className="mc-upload-remove"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeUploadFile(index);
                        }}
                      >
                        ×
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mc-upload-notice">
                <div>{t('注意： 1. 图片上传支持bmp、png、jpeg、jpg、gif、svg、webp格式；')}</div>
                <div style={{ paddingLeft: 42 }}>{t('2. 大小限制以系统存储设置为准。')}</div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* 上传视频 */}
      <Modal
        title={t('上传视频')}
        visible={uploadVideoOpen}
        okText={t('确定')}
        confirmLoading={videoSaving}
        onOk={submitUploadVideo}
        onCancel={() => setUploadVideoOpen(false)}
        width={700}
      >
        <div className="mc-upload-form">
          <div className="mc-form-row">
            <label className="mc-form-label-inline">{t('本地视频')}</label>
            <div>
              <input
                ref={videoInputRef}
                type="file"
                accept=".mp4,video/*"
                hidden
                onChange={(event) => pickVideoFile(event.target.files?.[0])}
              />
              {videoForm.videoUrl ? (
                <div className="mc-video-preview">
                  <video src={videoForm.videoUrl} controls />
                  <span className="mc-video-remove" onClick={() => setVideoForm((current) => ({ ...current, videoUrl: '', duration: '', size: '', format: '' }))}>
                    ×
                  </span>
                </div>
              ) : (
                <div className="mc-upload-dragger mc-upload-dragger-video" onClick={() => videoInputRef.current?.click()}>
                  <IconPlus size="large" />
                  <div className="mc-upload-text">{videoUploading ? t('视频上传中...') : t('可拖拽文件上传')}</div>
                </div>
              )}
              <div className="mc-upload-notice">{t('视频大小不超过系统限制，时长5秒-5分钟以内，建议时长15-190秒，支持的视频文件类型 .mp4。')}</div>
            </div>
          </div>
          <div className="mc-form-row">
            <label className="mc-form-label-inline">{t('视频名称')}</label>
            <Input
              maxLength={20}
              value={videoForm.videoName}
              placeholder={t('20个字以内')}
              style={{ width: 320 }}
              onChange={(next) => setVideoForm((current) => ({ ...current, videoName: next }))}
            />
          </div>
          <div className="mc-form-row">
            <label className="mc-form-label-inline">{t('所在视频分组')}</label>
            <Select
              value={videoForm.galleryId}
              optionList={groupOptions}
              onChange={(next) => setVideoForm((current) => ({ ...current, galleryId: Number(next) }))}
              style={{ width: 320 }}
            />
          </div>
          <div className="mc-form-row">
            <label className="mc-form-label-inline">{t('视频封面')}</label>
            <div>
              <input
                ref={videoCoverInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  event.preventDefault();
                  // 封面上传复用图片上传端点
                  const file = event.target.files?.[0];
                  if (!file) return;
                  apiUpload<{ picUrl?: string }>('/setting/galleryPic/uploadImg?galleryId=0', file)
                    .then((result) => {
                      if (result?.picUrl) {
                        setVideoForm((current) => ({ ...current, videoCover: result.picUrl as string }));
                        Toast.success({ content: t('封面上传成功') });
                      }
                    })
                    .catch((error) => Toast.error({ content: error instanceof Error ? error.message : t('封面上传失败') }))
                    .finally(() => {
                      if (videoCoverInputRef.current) videoCoverInputRef.current.value = '';
                    });
                }}
              />
              {videoForm.videoCover ? (
                <span className="mc-cover-thumb">
                  <img src={videoForm.videoCover} alt={t('视频封面')} />
                  <span
                    className="mc-upload-remove"
                    onClick={() => setVideoForm((current) => ({ ...current, videoCover: '' }))}
                  >
                    ×
                  </span>
                </span>
              ) : (
                <Button icon={<IconPlus />} loading={videoUploading} onClick={() => videoCoverInputRef.current?.click()}>
                  {t('上传封面')}
                </Button>
              )}
              <div className="mc-upload-notice">{t('如果不添加封面，系统会默认截取视频的第一个画面作为封面。')}</div>
            </div>
          </div>
        </div>
      </Modal>

      {/* 外部图片 */}
      <Modal
        title={t('添加外部链接')}
        visible={extImgOpen}
        okText={t('确定')}
        confirmLoading={extImgSaving}
        onOk={submitExtImage}
        onCancel={() => setExtImgOpen(false)}
        width={540}
      >
        <div className="mc-upload-form">
          <div className="mc-form-row">
            <label className="mc-form-label-inline">{t('所在分组')}</label>
            <Select
              value={extImgForm.galleryId}
              optionList={groupOptions}
              onChange={(next) => setExtImgForm((current) => ({ ...current, galleryId: Number(next) }))}
              style={{ width: 320 }}
            />
          </div>
          <div className="mc-form-row">
            <label className="mc-form-label-inline">{t('外部链接')}</label>
            <div>
              <Input
                value={extImgForm.picUrl}
                placeholder={t('请输入图片的网络地址')}
                style={{ width: 320 }}
                onChange={(next) => setExtImgForm((current) => ({ ...current, picUrl: next }))}
              />
              <div className="mc-upload-notice">
                {t('需要填写单张图片的网络地址，格式支持 bmp/jpg/png/gif，不支持 webp/svg；不能填百度图片搜索结果页这种"页面地址"')}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* 外部视频 */}
      <Modal
        title={t('添加外部视频链接')}
        visible={extVideoOpen}
        okText={t('确定')}
        confirmLoading={extVideoSaving}
        onOk={submitExtVideo}
        onCancel={() => setExtVideoOpen(false)}
        width={540}
      >
        <div className="mc-upload-form">
          <div className="mc-form-row">
            <label className="mc-form-label-inline">{t('上传至分组')}</label>
            <Select
              value={extVideoForm.galleryId}
              optionList={groupOptions}
              onChange={(next) => setExtVideoForm((current) => ({ ...current, galleryId: Number(next) }))}
              style={{ width: 320 }}
            />
          </div>
          <div className="mc-form-row">
            <label className="mc-form-label-inline">{t('外部视频地址')}</label>
            <div>
              <Input
                value={extVideoForm.videoUrl}
                placeholder={t('请输入视频文件的网络地址')}
                style={{ width: 320 }}
                onChange={(next) => setExtVideoForm((current) => ({ ...current, videoUrl: next }))}
              />
              <div className="mc-upload-notice">
                {t('需要填写视频文件的网络地址，格式支持 mp4/flv/webm/avi；不能填视频网站播放页这种"页面地址"')}
              </div>
            </div>
          </div>
          <div className="mc-form-row">
            <label className="mc-form-label-inline">{t('视频名称')}</label>
            <Input
              maxLength={20}
              value={extVideoForm.videoName}
              placeholder={t('20个字以内')}
              style={{ width: 320 }}
              onChange={(next) => setExtVideoForm((current) => ({ ...current, videoName: next }))}
            />
          </div>
          <div className="mc-form-row">
            <label className="mc-form-label-inline">{t('视频封面')}</label>
            <div>
              <input
                ref={extVideoCoverInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => pickExtVideoCover(event.target.files?.[0])}
              />
              {extVideoForm.videoCover ? (
                <span className="mc-cover-thumb">
                  <img src={extVideoForm.videoCover} alt={t('视频封面')} />
                  <span
                    className="mc-upload-remove"
                    onClick={() => setExtVideoForm((current) => ({ ...current, videoCover: '' }))}
                  >
                    ×
                  </span>
                </span>
              ) : (
                <Button icon={<IconPlus />} loading={extCoverUploading} onClick={() => extVideoCoverInputRef.current?.click()}>
                  {t('上传封面')}
                </Button>
              )}
              <div className="mc-upload-notice">{t('建议尺寸：800*800px，支持 jpg/gif/png 格式。')}</div>
            </div>
          </div>
        </div>
      </Modal>

      {/* 素材预览 */}
      <Modal
        title={null}
        visible={Boolean(previewItem)}
        footer={null}
        width={900}
        onCancel={() => setPreviewIndex(-1)}
        closeOnEsc
      >
        {previewItem ? (
          <div className="mc-preview">
            <div className="mc-preview-main">
              {tab === 'image' ? (
                <img src={previewUrl} alt={previewName} />
              ) : (
                <video src={previewUrl} controls autoPlay />
              )}
              {previewIndex > 0 ? (
                <button className="mc-preview-arrow is-left" onClick={() => setPreviewIndex((current) => Math.max(0, current - 1))} />
              ) : null}
              {previewIndex < items.length - 1 ? (
                <button
                  className="mc-preview-arrow is-right"
                  onClick={() => setPreviewIndex((current) => Math.min(items.length - 1, current + 1))}
                />
              ) : null}
            </div>
            <div className="mc-preview-info">
              <h3 className="mc-preview-heading">{tab === 'image' ? t('图片标题') : t('视频标题')}</h3>
              <p className="mc-preview-filename">{previewName}</p>
              <h4 className="mc-preview-subheading">{t('基本信息')}</h4>
              <div className="mc-preview-row">
                <span className="mc-preview-label">{t('分组：')}</span>
                <span>{currentAlbumName || (tab === 'image' ? t('全部图片') : t('全部视频'))}</span>
              </div>
              {tab === 'image' ? (
                <>
                  <div className="mc-preview-row">
                    <span className="mc-preview-label">{t('尺寸：')}</span>
                    <span>{previewPic?.picWidth && previewPic?.picHeight ? `${previewPic.picWidth} x ${previewPic.picHeight}` : '-'}</span>
                  </div>
                  <div className="mc-preview-row">
                    <span className="mc-preview-label">{t('大小：')}</span>
                    <span>{formatBytes(previewPic?.picSize) || '-'}</span>
                  </div>
                </>
              ) : (
                <>
                  {previewVideo?.format ? (
                    <div className="mc-preview-row">
                      <span className="mc-preview-label">{t('格式：')}</span>
                      <span>{previewVideo.format.toUpperCase()}</span>
                    </div>
                  ) : null}
                  {previewVideo?.duration ? (
                    <div className="mc-preview-row">
                      <span className="mc-preview-label">{t('时长：')}</span>
                      <span>{previewVideo.duration}</span>
                    </div>
                  ) : null}
                </>
              )}
              <div className="mc-preview-row">
                <span className="mc-preview-label">{t('上传时间：')}</span>
                <span>
                  {formatDate(
                    tab === 'image' ? (previewPic as any)?.createTime ?? previewPic?.addTime : previewVideo?.addTime,
                  ) || '-'}
                </span>
              </div>
              <div className="mc-preview-actions">
                <Button theme="solid" type="primary" onClick={() => downloadOne(previewItem as MaterialItem)}>
                  {tab === 'image' ? t('下载原图') : t('下载原视频')}
                </Button>
                <Button onClick={() => previewUrl && window.open(previewUrl, '_blank', 'noopener,noreferrer')}>
                  {tab === 'image' ? t('查看原图') : t('查看原视频')}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* 编辑素材 */}
      <Modal
        title={tab === 'image' ? t('编辑图片') : t('编辑视频')}
        visible={editOpen}
        okText={t('保存')}
        confirmLoading={editSaving}
        onOk={submitEdit}
        onCancel={() => setEditOpen(false)}
        width={520}
      >
        <div className="mc-upload-form">
          <div className="mc-form-row">
            <label className="mc-form-label-inline">{tab === 'image' ? t('图片名称') : t('视频名称')}</label>
            <Input
              value={editForm.name}
              style={{ width: 300 }}
              onChange={(next) => setEditForm((current) => ({ ...current, name: next }))}
            />
          </div>
          <div className="mc-form-row">
            <label className="mc-form-label-inline">{t('所属分组')}</label>
            <Select
              value={editForm.galleryId}
              optionList={groupOptions}
              onChange={(next) => setEditForm((current) => ({ ...current, galleryId: Number(next) }))}
              style={{ width: 300 }}
            />
          </div>
          {tab === 'video' ? (
            <>
              <div className="mc-form-row">
                <label className="mc-form-label-inline">{t('视频封面')}</label>
                <div>
                  <input
                    ref={editCoverInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      apiUpload<{ picUrl?: string }>('/setting/galleryPic/uploadImg?galleryId=0', file)
                        .then((result) => {
                          if (result?.picUrl) {
                            setEditForm((current) => ({ ...current, videoCover: result.picUrl as string }));
                            Toast.success({ content: t('封面上传成功') });
                          }
                        })
                        .catch((error) => Toast.error({ content: error instanceof Error ? error.message : t('封面上传失败') }))
                        .finally(() => {
                          if (editCoverInputRef.current) editCoverInputRef.current.value = '';
                        });
                    }}
                  />
                  {editForm.videoCover ? (
                    <span className="mc-cover-thumb">
                      <img src={editForm.videoCover} alt={t('视频封面')} />
                      <span
                        className="mc-upload-remove"
                        onClick={() => setEditForm((current) => ({ ...current, videoCover: '' }))}
                      >
                        ×
                      </span>
                    </span>
                  ) : (
                    <Button icon={<IconPlus />} onClick={() => editCoverInputRef.current?.click()}>
                      {t('上传封面')}
                    </Button>
                  )}
                </div>
              </div>
              <div className="mc-form-row">
                <label className="mc-form-label-inline">{t('简介')}</label>
                <TextArea
                  value={editForm.description}
                  style={{ width: 300 }}
                  onChange={(next) => setEditForm((current) => ({ ...current, description: next }))}
                />
              </div>
            </>
          ) : null}
        </div>
      </Modal>
      {/* AI图片处理（v5.8.61） */}
      <AiTranslateDialog
        visible={aiDialog?.mode === 'translate'}
        imageUrl={aiDialogImageUrl}
        onCancel={() => setAiDialog(null)}
        onOk={handleAiDialogOk}
      />
      <AiEraseDialog
        visible={aiDialog?.mode === 'erase'}
        imageUrl={aiDialogImageUrl}
        onCancel={() => setAiDialog(null)}
        onOk={handleAiDialogOk}
      />
    </div>
  );
}
