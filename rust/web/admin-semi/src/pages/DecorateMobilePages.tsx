import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Tabs,
  TabPane,
  Input,
  TextArea,
  InputNumber,
  Select,
  Tag,
  Typography,
  Modal,
  Table,
  Spin,
  Space,
  Switch,
  Toast,
  Radio,
  RadioGroup,
  ColorPicker,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { THEME_PALETTES } from './themePalettes';

const { Text, Title } = Typography;

function formatDecorateTime(value: any): string {
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
 * 1. ThemeStyle (decorate0 主题风格)
 * 契约对齐: java/view/admin/src/views/decorate/themeStyle/Info.vue
 * ========================================================================= */
type ThemeVars = Record<string, string>;

const paletteVars = (item: Record<string, any>): ThemeVars => {
  const { themeId: _themeId, check: _check, ...vars } = item;
  return vars as ThemeVars;
};

function buildCustomVars(main: string, vice: string): ThemeVars {
  return {
    '--general': main,
    '--main-bg': main,
    '--main-bg-gradient': main,
    '--main-text': '#ffffff',
    '--vice-bg': vice,
    '--vice-text': main,
    '--icon': main,
    '--price': main,
    '--tag-text': main,
    '--tag-bg': vice,
    '--primary-light-3': main,
    '--primary-light-5': main,
    '--primary-light-7': vice,
    '--primary-light-8': vice,
    '--primary-light-9': vice,
    '--primary-dark-2': main,
    '--ump-main-bg': main,
    '--ump-main-text': '#ffffff',
    '--ump-vice-bg': vice,
    '--ump-vice-text': main,
    '--ump-icon': main,
    '--ump-price': main,
    '--ump-tag-text': main,
    '--ump-tag-bg': vice,
    '--ump-coupon-bg': '#ffffff',
    '--ump-border': vice,
    '--ump-start-bg': main,
    '--ump-end-bg': main,
  };
}

export function ThemeStyle() {
  const [mode, setMode] = useState<1 | 2>(1);
  const [themeId, setThemeId] = useState(0);
  const [vars, setVars] = useState<ThemeVars>(paletteVars(THEME_PALETTES[0] as any));
  const [customMain, setCustomMain] = useState('#4a90e2');
  const [customVice, setCustomVice] = useState('#D6E9FC');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importCode, setImportCode] = useState('');

  const load = () => {
    setLoading(true);
    apiGet<any>('/setting/config/themeStyleSettings')
      .then((result) => {
        const raw = result?.themeStyle;
        const parsed: ThemeVars = typeof raw === 'string' ? JSON.parse(raw) : raw || {};
        if (!parsed || !parsed['--main-bg']) return;
        const matched = THEME_PALETTES.find(
          (item) => (item as any)['--main-bg'] === parsed['--main-bg'] && (item as any)['--vice-bg'] === parsed['--vice-bg'],
        );
        setVars(parsed);
        setThemeId(matched ? Number((matched as any).themeId) : 0);
        setMode(matched ? 1 : 2);
        setCustomMain(parsed['--main-bg'] || '#4a90e2');
        setCustomVice(parsed['--vice-bg'] || '#D6E9FC');
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const pickPalette = (item: Record<string, any>) => {
    setMode(1);
    setThemeId(Number(item.themeId));
    setVars(paletteVars(item));
  };

  const changeCustom = (main: string, vice: string) => {
    setMode(2);
    setThemeId(0);
    setCustomMain(main);
    setCustomVice(vice);
    setVars(buildCustomVars(main, vice));
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiPost('/setting/config/saveThemeStyle', { themeStyle: JSON.stringify({ ...vars, themeId }) });
      Toast.success('操作成功');
      load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const importCodeValue = () => {
    try {
      const parsed = JSON.parse(importCode);
      const next = parsed?.themeStyle ? JSON.parse(parsed.themeStyle) : parsed;
      if (!next || !next['--main-bg']) throw new Error('配色码格式不正确');
      setVars(next as ThemeVars);
      setThemeId(Number(next.themeId) || 0);
      setMode(Number(next.themeId) ? 1 : 2);
      setCustomMain(next['--main-bg']);
      setCustomVice(next['--vice-bg'] || next['--main-bg']);
      setImportOpen(false);
      setImportCode('');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '配色码格式不正确');
    }
  };

  const mainStyle: React.CSSProperties = {
    color: vars['--main-text'],
    background: vars['--main-bg'],
  };
  const priceStyle: React.CSSProperties = { color: vars['--price'] };
  const viceStyle: React.CSSProperties = { color: vars['--vice-text'], background: vars['--vice-bg'] };

  return (
    <div style={{ padding: 20 }}>
      <Card title="主题风格" loading={loading}>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div style={{ width: 520 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <b>配色方案</b>
              <RadioGroup value={mode} onChange={(e) => setMode(Number(e.target.value) as 1 | 2)}>
                <Radio value={1}>系统配色</Radio>
                <Radio value={2}>自定义配色</Radio>
              </RadioGroup>
            </div>

            {mode === 1 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
                {THEME_PALETTES.map((item) => {
                  const p = item as Record<string, any>;
                  const active = themeId === p.themeId;
                  return (
                    <div
                      key={p.themeId}
                      onClick={() => pickPalette(p)}
                      style={{
                        cursor: 'pointer',
                        border: `2px solid ${active ? '#1456f0' : 'transparent'}`,
                        borderRadius: 6,
                        overflow: 'hidden',
                        width: 72,
                      }}
                    >
                      <div style={{ height: 24, background: p['--main-bg'] }} />
                      <div style={{ height: 24, background: p['--vice-bg'] }} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  主题颜色
                  <input
                    type="color"
                    value={customMain}
                    onChange={(e) => changeCustom(e.target.value, customVice)}
                    style={{ width: 40, height: 32, border: 0, background: 'transparent' }}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  辅助颜色
                  <input
                    type="color"
                    value={customVice}
                    onChange={(e) => changeCustom(customMain, e.target.value)}
                    style={{ width: 40, height: 32, border: 0, background: 'transparent' }}
                  />
                </label>
              </div>
            )}

            <Space style={{ marginTop: 20 }}>
              <Button onClick={() => setImportOpen(true)}>导入配色码</Button>
              <Button theme="solid" type="primary" loading={saving} onClick={save}>保存</Button>
            </Space>
          </div>

          <div style={{ flex: 1, minWidth: 360 }}>
            <h3 style={{ margin: '0 0 12px' }}>预览效果</h3>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ width: 210, border: '1px solid #eee', borderRadius: 8, padding: 14, background: '#fff' }}>
                <div style={{ fontSize: 20, fontWeight: 700, ...priceStyle }}>¥395.00</div>
                <div style={{ color: '#999', fontSize: 12, margin: '8px 0' }}>由本系统配送并提供售后服务</div>
                <Space>
                  <span style={{ ...viceStyle, padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>9折</span>
                  <span style={{ ...viceStyle, padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>满100-10</span>
                </Space>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <span style={{ ...viceStyle, flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 4 }}>加入购物车</span>
                  <span style={{ ...mainStyle, flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 4 }}>立即购买</span>
                </div>
              </div>
              <div style={{ width: 210, border: '1px solid #eee', borderRadius: 8, padding: 14, background: '#fff' }}>
                <div style={{ fontSize: 20, fontWeight: 700, ...priceStyle }}>¥231.10</div>
                <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
                  <span style={{ border: `1px solid ${vars['--main-bg']}`, color: vars['--general'], padding: '2px 10px', borderRadius: 4, fontSize: 12 }}>金色</span>
                  <span style={{ border: `1px solid ${vars['--main-bg']}`, color: vars['--general'], padding: '2px 10px', borderRadius: 4, fontSize: 12 }}>XS</span>
                </div>
                <div style={{ color: '#39bf3e', marginBottom: 10 }}>充足</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ ...viceStyle, flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 4 }}>加入购物车</span>
                  <span style={{ ...mainStyle, flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 4 }}>立即购买</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Modal title="导入配色码" visible={importOpen} onCancel={() => setImportOpen(false)} onOk={importCodeValue}>
        <Text type="secondary">请把配色码粘贴在此处</Text>
        <TextArea
          value={importCode}
          onChange={(v: string) => setImportCode(v)}
          autosize={{ minRows: 6, maxRows: 12 }}
          placeholder='{"--main-bg":"#4a90e2", ...}'
          style={{ marginTop: 8 }}
        />
      </Modal>
    </div>
  );
}

/* =========================================================================
 * 2. MobileDecoratePages (mobileDecorateManage 页面管理)
 * 契约对齐: java/view/admin/src/views/decorate/mobileDecorate/List.vue
 * labels: 页面名称, 发布状态, 更新时间, 操作
 * props: decorateId, status, updateTime, bingdingH5Name
 * ========================================================================= */
export function MobileDecoratePages({
  decorateType = 1,
  pageType,
  defaultName = '首页微页面',
  editPage = 'mobileDecorateEditor',
  returnPage,
}: {
  decorateType?: number;
  pageType?: number;
  defaultName?: string;
  editPage?: string;
  returnPage?: string;
} = {}) {
  const columns: ColumnConfig<any>[] = [
    { title: 'ID', dataIndex: 'decorateId', width: 80 },
    {
      title: '页面名称',
      dataIndex: 'decorateName',
      width: 180,
      render: (v: any, row: any) => v || row?.bingdingH5Name || defaultName,
    },
    {
      title: '发布状态',
      dataIndex: 'status',
      width: 110,
      render: (s: any) => <Tag color={s === 1 ? 'green' : 'grey'}>{s === 1 ? '已发布' : '草稿'}</Tag>,
    },
    { title: '更新时间', dataIndex: 'updateTime', width: 170, render: (v: any) => formatDecorateTime(v) },
  ];

  return (
    <div>
      <ListPage
        api="/decorate/decorate/list"
        query={{ decorateType, ...(pageType ? { pageType } : {}) }}
        rowKey="decorateId"
        columns={columns}
        showEdit={false}
        rowActions={(row: any) => (
          <Space>
            <Button
              theme="borderless"
              type="primary"
              size="small"
              onClick={() => {
                const idKey = (editPage === 'pcDecorateEditor' || editPage === 'mobileDecorateEditor') ? 'id' : 'decorateId';
                window.location.href = `${window.location.origin}/?page=${editPage}&${idKey}=${row.decorateId}${returnPage ? `&from=${returnPage}` : ''}`;
              }}
            >
              装修
            </Button>
            <Button
              theme="borderless"
              size="small"
              onClick={async () => {
                try {
                  await apiPost('/decorate/decorate/copy', { id: row.decorateId });
                  Toast.success('操作成功');
                  window.location.reload();
                } catch (error) {
                  Toast.error(error instanceof Error ? error.message : '复制失败');
                }
              }}
            >
              复制
            </Button>
          </Space>
        )}
        filters={[
          { field: 'decorateName', label: '页面名称', type: 'input' },
        ]}
        drawer={{
          title: '新建移动端页面',
          addText: '新建页面',
          width: 600,
          createApi: '/decorate/decorate/create',
          updateApi: '/decorate/decorate/update',
          deleteApi: '/decorate/decorate/del',
          sections: [
            {
              key: 'basic',
              title: '基础信息',
              fields: [
                { field: 'decorateName', label: '页面名称', type: 'input', required: true },
              ],
            },
          ],
        }}
      />
    </div>
  );
}

/* =========================================================================
 * 3. MobileSplashAd (mobileSplashAdManage / mobileSplashAdManage2 开屏广告)
 * 契约对齐: java/view/admin/src/views/decorate/mobileDecorate/SplashAd.vue
 * labels: 开屏广告, 添加素材, 最大等待时长, 跳转
 * props: state, autoReturnGoods, materialImg, materialVideo, maxWaitTime, redirectType, redirectUrl
 * ========================================================================= */
export function MobileSplashAd() {
  const [config, setConfig] = useState<any>({
    state: 0,
    materialType: 0,
    materialImg: '',
    materialVideo: '',
    maxWaitTime: 5,
    redirectType: 0,
    redirectUrl: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    apiGet<any>('/decorate/decorateDiscrete/detail', { decorateSn: 'openAdvertising' })
      .then((result) => {
        const data = result?.data || result;
        if (data && typeof data === 'object') {
          setConfig((prev: any) => ({ ...prev, ...data }));
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiPost('/decorate/decorateDiscrete/update', {
        decorateSn: 'openAdvertising',
        decorateName: '开屏广告',
        data: config,
      });
      Toast.success('提交成功');
      load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '提交失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <Card title="开屏广告" loading={loading}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 900 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <Text strong style={{ width: 140, flexShrink: 0 }}>开屏广告</Text>
            <div>
              <RadioGroup value={config.state} onChange={(e) => setConfig({ ...config, state: Number(e.target.value) })}>
                <Radio value={1}>开启</Radio>
                <Radio value={0}>关闭</Radio>
              </RadioGroup>
              <div style={{ color: '#999', marginTop: 6 }}>
                该功能仅支持微信小程序和 APP，开启进入商城首页时出现一段品牌图片/视频，等待播放后进入。
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <Text strong style={{ width: 140, flexShrink: 0 }}>添加素材</Text>
            <div style={{ flex: 1 }}>
              <RadioGroup
                value={config.materialType}
                disabled={config.state === 0}
                onChange={(e) => setConfig({ ...config, materialType: Number(e.target.value) })}
              >
                <Radio value={0}>图片</Radio>
                <Radio value={1}>视频</Radio>
              </RadioGroup>
              {config.materialType === 0 ? (
                <Input
                  value={config.materialImg}
                  disabled={config.state === 0}
                  onChange={(v: string) => setConfig({ ...config, materialImg: v })}
                  placeholder="建议尺寸 1080*1920，请输入图片 URL"
                  style={{ marginTop: 10 }}
                />
              ) : (
                <Input
                  value={config.materialVideo}
                  disabled={config.state === 0}
                  onChange={(v: string) => setConfig({ ...config, materialVideo: v })}
                  placeholder="格式 mp4，请输入视频 URL"
                  style={{ marginTop: 10 }}
                />
              )}
              <div style={{ color: '#999', marginTop: 6 }}>
                {config.materialType === 0
                  ? '建议尺寸1080*1920，格式jpg/png/gif，单张图片文件大小限制以内'
                  : '格式mp4，单个视频文件大小限制5M以内'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Text strong style={{ width: 140, flexShrink: 0 }}>最大等待时长</Text>
            <span>播放</span>
            <InputNumber
              value={config.maxWaitTime}
              disabled={config.state === 0}
              min={1}
              onChange={(v) => setConfig({ ...config, maxWaitTime: Number(v ?? 5) })}
              style={{ width: 100 }}
            />
            <span>秒后自动进入商城首页</span>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <Text strong style={{ width: 140, flexShrink: 0 }}>跳转</Text>
            <div style={{ flex: 1 }}>
              <RadioGroup
                value={config.redirectType}
                disabled={config.state === 0}
                onChange={(e) => setConfig({ ...config, redirectType: Number(e.target.value) })}
              >
                <Radio value={0}>不跳转</Radio>
                <Radio value={1}>整体跳转</Radio>
              </RadioGroup>
              {config.redirectType === 1 ? (
                <Input
                  value={config.redirectUrl}
                  disabled={config.state === 0}
                  onChange={(v: string) => setConfig({ ...config, redirectUrl: v })}
                  placeholder="请输入跳转链接"
                  style={{ marginTop: 10 }}
                />
              ) : null}
            </div>
          </div>

          <div>
            <Button theme="solid" type="primary" loading={saving} onClick={save}>提 交</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* =========================================================================
 * 4. MobileNav (mobileNavManage 主导航栏)
 * 契约对齐: java/view/admin/src/views/decorate/mobileDecorate/Nav.vue
 * labels: 导航名称, 发布状态, 更新时间, 操作
 * props: decorateId, status, updateTime
 * ========================================================================= */
type NavItem = {
  picTitle?: string;
  picUrl?: string;
  picThumb?: string;
  picActiveUrl?: string;
  picActiveThumb?: string;
  picLink?: any;
};

type NavModule = {
  navName: string;
  backgroundColorType: number;
  backgroundColor: string;
  cornerStyle: number;
  iconColorType: number;
  selectedTextColor: string;
  unselectedTextColor: string;
  navList: NavItem[];
};

const defaultNavList: NavItem[] = [
  { picTitle: '首页', picLink: { link: '/', title: '首页' }, picUrl: '', picThumb: '', picActiveUrl: '', picActiveThumb: '' },
  { picTitle: '我的', picLink: { link: 'member', title: '会员中心' }, picUrl: '', picThumb: '', picActiveUrl: '', picActiveThumb: '' },
];

const newNavModule = (): NavModule => ({
  navName: '',
  backgroundColorType: 1,
  backgroundColor: '#FFFFFF',
  cornerStyle: 1,
  iconColorType: 1,
  selectedTextColor: '#FF1616',
  unselectedTextColor: '#757575',
  navList: defaultNavList.map((item) => ({ ...item })),
});

function MobileNavEditor({ id, onBack }: { id: number; onBack: () => void }) {
  const [module, setModule] = useState<NavModule>(newNavModule);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiGet<any>('/decorate/decorate/detail', { id, decorateType: 1, parentId: 0, localeId: 0 })
      .then((result) => {
        const data = result?.data || {};
        const navList = Array.isArray(data.navList) && data.navList.length ? data.navList : defaultNavList;
        setModule({ ...newNavModule(), ...data, navName: data.navName || result?.decorateTitle || '', navList });
      })
      .catch((error) => Toast.error(error instanceof Error ? error.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [id]);

  const updateItem = (index: number, patch: Partial<NavItem>) => {
    setModule((prev) => ({
      ...prev,
      navList: prev.navList.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  };

  const save = async () => {
    if (!module.navName.trim()) {
      Toast.error('请填写导航名称');
      return;
    }
    setSaving(true);
    try {
      let currentId = id;
      if (!currentId) {
        const created: any = await apiPost('/decorate/decorate/create', {
          decorateType: 1,
          pageType: 7,
          decorateTitle: module.navName,
        });
        currentId = Number(created?.decorateId || created?.id || 0);
        if (!currentId) throw new Error('创建失败');
      }
      await apiPost('/decorate/decorate/publish', {
        id: currentId,
        parentId: 0,
        localeId: 0,
        data: module,
      });
      await apiPost('/decorate/decorate/updateField', {
        id: currentId,
        field: 'decorateTitle',
        val: module.navName,
      }).catch(() => undefined);
      Toast.success('保存并发布成功');
      onBack();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const bg = module.backgroundColorType === 2 ? module.backgroundColor || '#FFFFFF' : '#FFFFFF';
  const radius = module.cornerStyle === 2 ? '8px 8px 0 0' : module.cornerStyle === 3 ? '16px 16px 0 0' : '0';
  const selectedColor = module.iconColorType === 2 ? module.selectedTextColor || '#FF1616' : '#FF1616';
  const unselectedColor = module.iconColorType === 2 ? module.unselectedTextColor || '#757575' : '#757575';

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <div style={{ width: 375, flexShrink: 0, border: '1px solid #e5e6eb', borderRadius: 8, overflow: 'hidden', background: '#f7f8fa' }}>
        <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderBottom: '1px solid #eee' }}>页面标题</div>
        <div style={{ height: 420 }} />
        <div style={{ background: bg, borderRadius: radius, padding: '8px 4px', display: 'flex', justifyContent: 'space-around' }}>
          {module.navList.map((item, index) => (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 52 }}>
              {item.picUrl ? <img src={index === 0 ? item.picActiveUrl || item.picUrl : item.picUrl} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} /> : <span style={{ width: 28, height: 28, borderRadius: 6, background: '#eef1f5' }} />}
              <span style={{ fontSize: 12, color: index === 0 ? selectedColor : unselectedColor }}>{item.picTitle || '菜单'}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #e5e6eb', borderRadius: 8, padding: 20 }}>
        {loading ? <Spin /> : (
          <>
            <div style={{ fontWeight: 600, marginBottom: 14 }}>基础设置</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ width: 90, color: '#646a73' }}>导航名称</span>
              <Input value={module.navName} maxLength={15} onChange={(v: string) => setModule({ ...module, navName: v })} style={{ width: 320 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ width: 90, color: '#646a73' }}>导航背景色</span>
              <RadioGroup value={module.backgroundColorType} onChange={(e) => setModule({ ...module, backgroundColorType: Number(e.target.value) })}>
                <Radio value={1}>系统色</Radio>
                <Radio value={2}>自定义颜色</Radio>
              </RadioGroup>
              {module.backgroundColorType === 2 ? <input type="color" value={module.backgroundColor} onChange={(e) => setModule({ ...module, backgroundColor: e.target.value })} /> : null}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ width: 90, color: '#646a73' }}>背景圆角</span>
              <RadioGroup value={module.cornerStyle} onChange={(e) => setModule({ ...module, cornerStyle: Number(e.target.value) })}>
                <Radio value={1}>直角</Radio>
                <Radio value={2}>圆角</Radio>
                <Radio value={3}>大圆角</Radio>
              </RadioGroup>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ width: 90, color: '#646a73' }}>文字配色</span>
              <RadioGroup value={module.iconColorType} onChange={(e) => setModule({ ...module, iconColorType: Number(e.target.value) })}>
                <Radio value={1}>系统配色</Radio>
                <Radio value={2}>自定义配置</Radio>
              </RadioGroup>
              {module.iconColorType === 2 ? (
                <Space>
                  <span>选中</span><input type="color" value={module.selectedTextColor} onChange={(e) => setModule({ ...module, selectedTextColor: e.target.value })} />
                  <span>未选</span><input type="color" value={module.unselectedTextColor} onChange={(e) => setModule({ ...module, unselectedTextColor: e.target.value })} />
                </Space>
              ) : null}
            </div>

            <div style={{ fontWeight: 600, margin: '18px 0 10px' }}>菜单设置</div>
            {module.navList.map((item, index) => (
              <div key={index} style={{ border: '1px solid #eef0f3', borderRadius: 6, padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Input value={item.picTitle || ''} placeholder="菜单名称" onChange={(v: string) => updateItem(index, { picTitle: v })} style={{ width: 140 }} />
                  <Input value={item.picUrl || ''} placeholder="未选中图标 URL" onChange={(v: string) => updateItem(index, { picUrl: v })} style={{ width: 220 }} />
                  <Input value={item.picActiveUrl || ''} placeholder="选中图标 URL" onChange={(v: string) => updateItem(index, { picActiveUrl: v })} style={{ width: 220 }} />
                  <Input value={typeof item.picLink === 'string' ? item.picLink : item.picLink?.link || ''} placeholder="跳转链接" onChange={(v: string) => updateItem(index, { picLink: { link: v, title: item.picTitle || '' } })} style={{ width: 200 }} />
                </div>
              </div>
            ))}
            <Space>
              <Button disabled={module.navList.length >= 5} onClick={() => setModule({ ...module, navList: [...module.navList, { picTitle: '', picUrl: '', picActiveUrl: '', picLink: { link: '' } }] })}>添加菜单</Button>
              <Button onClick={onBack}>返回列表</Button>
              <Button theme="solid" type="primary" loading={saving} onClick={save}>保存并发布</Button>
            </Space>
          </>
        )}
      </div>
    </div>
  );
}

export function MobileNav() {
  const [editId, setEditId] = useState<number | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    apiGet<any>('/decorate/decorate/list', { decorateType: 1, pageType: 7, page: 1, size: 50 })
      .then((result) => setRows(result?.records || result?.list || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (editId !== null) {
    return <MobileNavEditor id={editId} onBack={() => { setEditId(null); load(); }} />;
  }

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <Space>
            <Button onClick={load} loading={loading}>刷新</Button>
            <Button theme="solid" type="primary" onClick={() => setEditId(0)}>新增导航</Button>
          </Space>
        </div>
        <Table
          dataSource={rows}
          rowKey="decorateId"
          pagination={false}
          columns={[
            { title: '导航名称', dataIndex: 'decorateTitle', render: (v: any, row: any) => v || row.decorateName || '主导航栏' },
            { title: '发布状态', dataIndex: 'status', render: (v: any) => <Tag color={v === 1 ? 'green' : 'grey'}>{v === 1 ? '已发布' : '未发布'}</Tag> },
            { title: '更新时间', dataIndex: 'updateTime', render: (v: any) => formatDecorateTime(v) },
            {
              title: '操作',
              render: (_: any, row: any) => (
                <Space>
                  <Button theme="borderless" size="small" onClick={() => setEditId(Number(row.decorateId))}>编辑</Button>
                  <Button theme="borderless" size="small" onClick={async () => { await apiPost('/decorate/decorate/copy', { id: row.decorateId }); Toast.success('操作成功'); load(); }}>复制</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

/* =========================================================================
 * 5. ClassifyDecorate (classifyManage 分类页)
 * 契约对齐: java/view/admin/src/views/decorate/mobileDecorate/Classify.vue
 * labels: 页面样式：
 * props: type
 * ========================================================================= */
export function ClassifyDecorate() {
  const [type, setType] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const base = import.meta.env.BASE_URL;

  const styles = [
    { value: 1, title: '样式1', img: `${base}admin-assets/classify1.png` },
    { value: 2, title: '样式2', img: `${base}admin-assets/classify2.png` },
    { value: 3, title: '样式3', img: `${base}admin-assets/classify3.png` },
  ];

  const load = () => {
    setLoading(true);
    apiGet<any>('/setting/config/categoryDecorateSettings')
      .then((result) => setType(Number(result?.productCategoryDecorateType) || 1))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async (nextType = type) => {
    setSaving(true);
    try {
      await apiPost('/setting/config/saveCategoryDecorate', { productCategoryDecorateType: nextType });
      Toast.success('操作成功');
      setType(nextType);
      load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <Card title="移动端分类页样式" loading={loading}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32 }}>
          {styles.map((item) => (
            <div key={item.value} style={{ width: 260, textAlign: 'center', cursor: 'pointer' }} onClick={() => setType(item.value)}>
              <img
                src={item.img}
                alt={item.title}
                style={{
                  width: '100%',
                  borderRadius: 10,
                  border: `2px solid ${type === item.value ? 'var(--semi-color-primary)' : '#eee'}`,
                  marginBottom: 10,
                }}
              />
              <div style={{ color: type === item.value ? 'var(--semi-color-primary)' : undefined }}>{item.title}</div>
            </div>
          ))}
        </div>
        <Space style={{ marginTop: 24 }}>
          <Button theme="solid" type="primary" loading={saving} onClick={() => save()}>保 存</Button>
          <Button loading={saving} onClick={() => save(1)}>重 置</Button>
        </Space>
      </Card>
    </div>
  );
}

/* =========================================================================
 * 6. MobileUserDecorate (mobileUserManage 会员首页)
 * 契约对齐: java/view/admin/src/views/decorate/mobileDecorate/user/User.vue
 * labels: 会员首页, 资产模块, 订单模块, 工具栏配置
 * ========================================================================= */
export function MobileUserDecorate() {
  const [toolList, setToolList] = useState<any[]>([
    { type: 'bannerList', label: '广告位', module: { bannerList: { picUrl: '' } } },
    { type: 'menus', label: '用户服务', module: { menuType: 1, menuList: [] } },
  ]);
  const [menus, setMenus] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const bannerModule = toolList.find((item) => item.type === 'bannerList')?.module || { bannerList: { picUrl: '' } };
  const menuModule = toolList.find((item) => item.type === 'menus')?.module || { menuType: 1, menuList: [] };

  const setBanner = (picUrl: string) => {
    setToolList((prev) => prev.map((item) => item.type === 'bannerList' ? { ...item, module: { ...item.module, bannerList: { ...item.module?.bannerList, picUrl } } } : item));
  };
  const setMenusModule = (patch: Record<string, any>) => {
    setToolList((prev) => prev.map((item) => item.type === 'menus' ? { ...item, module: { ...item.module, ...patch } } : item));
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      apiGet<any>('/decorate/decorateDiscrete/detail', { decorateSn: 'memberDecorate' }),
      apiGet<any>('/decorate/decorateDiscrete/memberDecorateData'),
    ])
      .then(([detail, data]) => {
        const remote = detail?.data;
        if (Array.isArray(remote) && remote.length) setToolList(remote);
        const list = data?.menus || data?.data?.menus || [];
        setMenus(Array.isArray(list) ? list : []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiPost('/decorate/decorateDiscrete/update', { decorateSn: 'memberDecorate', data: toolList });
      await apiPost('/setting/config/saveMemberCenterDecorate', { useNewMemberCenter: 0 }).catch(() => undefined);
      Toast.success('保存成功，已应用旧版个人中心');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const addMenu = (menu: any) => {
    const current = menuModule.menuList || [];
    if (current.some((item: any) => item.picTitle === menu.picTitle)) return;
    setMenusModule({ menuList: [...current, { ...menu }] });
  };
  const removeMenu = (index: number) => {
    const current = menuModule.menuList || [];
    setMenusModule({ menuList: current.filter((_: any, i: number) => i !== index) });
  };

  return (
    <div style={{ padding: 20 }}>
      <Card title="会员中心首页装修" loading={loading}>
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
          <div style={{ width: 375, flexShrink: 0, border: '1px solid #e5e6eb', borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(90deg,#fcf6fc,#f3f3fe)', padding: 8 }}>
            <div style={{ height: 120, borderRadius: 8, overflow: 'hidden', background: '#dfe7f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#98a2b3' }}>
              {bannerModule.bannerList?.picUrl ? <img src={bannerModule.bannerList.picUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '广告位'}
            </div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: menuModule.menuType === 2 ? 'repeat(3,1fr)' : 'repeat(4,1fr)', gap: 8 }}>
              {(menuModule.menuList || []).map((item: any, index: number) => (
                <div key={index} style={{ background: '#fff', borderRadius: 8, padding: '10px 4px', textAlign: 'center', fontSize: 12 }}>
                  {item.picUrl ? <img src={item.picUrl} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} /> : <div style={{ width: 22, height: 22, margin: '0 auto', background: '#eef1f5', borderRadius: 4 }} />}
                  <div style={{ marginTop: 6 }}>{item.picTitle || '服务'}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>广告图设置</div>
            <Input
              value={bannerModule.bannerList?.picUrl || ''}
              placeholder="广告图 URL"
              onChange={setBanner}
              style={{ marginBottom: 18 }}
            />
            {bannerModule.bannerList?.picUrl ? <img src={bannerModule.bannerList.picUrl} alt="" style={{ maxWidth: 260, maxHeight: 140, objectFit: 'contain', marginBottom: 18 }} /> : null}

            <div style={{ fontWeight: 600, margin: '18px 0 10px' }}>我的服务设置</div>
            <RadioGroup value={menuModule.menuType} onChange={(e) => setMenusModule({ menuType: Number(e.target.value) })}>
              <Radio value={1}>列表版</Radio>
              <Radio value={2}>九宫格版</Radio>
            </RadioGroup>

            <div style={{ fontWeight: 600, margin: '16px 0 8px' }}>默认模块</div>
            <Space wrap>
              {menus.map((menu: any, index: number) => (
                <Tag key={index} style={{ cursor: 'pointer' }} onClick={() => addMenu(menu)}>{menu.picTitle}</Tag>
              ))}
            </Space>

            <div style={{ fontWeight: 600, margin: '16px 0 8px' }}>已添加模块</div>
            <Space wrap>
              {(menuModule.menuList || []).map((item: any, index: number) => (
                <Tag key={index} onClose={() => removeMenu(index)} closable>{item.picTitle || '模块'}</Tag>
              ))}
            </Space>

            <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
              <Button onClick={load}>刷新</Button>
              <Button theme="solid" type="primary" loading={saving} onClick={save}>保存</Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* =========================================================================
 * 7. MobileUserOverseas (mobileuserUserOverseasManage 会员首页海外版)
 * ========================================================================= */
export function MobileUserOverseas() {
  return (
    <div>
      <div style={{ padding: '16px 20px 0', color: '#646a73', fontSize: 13 }}>海外版会员首页装修，配置与会员首页共用同一套数据。</div>
      <MobileUserDecorate />
    </div>
  );
}

/* =========================================================================
 * 8. MobileSearchStyle (mobileSearchStyleManage 搜索风格)
 * ========================================================================= */
export function MobileSearchStyle() {
  const [styleType, setStyleType] = useState(1);
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiGet<any>('/setting/config/mobileSearchStyleSettings')
      .then((result) => setStyleType(Number(result?.mobileSearchStyleType) || 1))
      .catch(() => undefined);
  };

  useEffect(load, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiPost('/setting/config/saveMobileSearchStyle', { mobileSearchStyleType: styleType });
      Toast.success('操作成功');
      load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <Card title="移动端搜索风格" style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>搜索框形状：</Text>
          <RadioGroup value={styleType} onChange={(e) => setStyleType(Number(e.target.value))}>
            <Radio value={1}>圆角胶囊风格</Radio>
            <Radio value={2}>直角极简风格</Radio>
          </RadioGroup>
        </div>
        <Button type="primary" loading={saving} onClick={save}>保存配置</Button>
      </Card>
    </div>
  );
}

/* =========================================================================
 * 9. MobileCatNav (mobileCatNavManage 分类导航)
 * 契约对齐: java/view/admin/src/views/decorate/mobileCatNav/List.vue
 * labels: 首页分类栏名称, 分类颜色, 是否显示, 排序, 操作, 主导航, 顶部小导航, 底部导航, 侧边导航
 * props: categoryName, isShow, sortOrder
 * ========================================================================= */
export function MobileCatNav() {
  const columns: ColumnConfig<any>[] = [
    { title: '首页分类栏名称', dataIndex: 'categoryName', width: 200, render: (v: any, row: any) => v || `分类 ${row.categoryId || ''}` },
    {
      title: '分类颜色',
      dataIndex: 'catColor',
      width: 110,
      render: (c: any) => <div style={{ width: 22, height: 22, background: c || '#ff5000', borderRadius: 4, border: '1px solid #eee' }} />,
    },
    {
      title: '是否显示',
      dataIndex: 'isShow',
      width: 110,
      render: (v: any, row: any) => (
        <Switch
          size="small"
          checked={Number(v) === 1}
          onChange={async (checked) => {
            await apiPost('/decorate/mobileCatNav/updateField', {
              id: row.mobileCatNavId,
              field: 'isShow',
              val: checked ? 1 : 0,
            });
            Toast.success('操作成功');
          }}
        />
      ),
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 110,
      render: (v: any, row: any) => (
        <InputNumber
          size="small"
          value={Number(v) || 0}
          style={{ width: 80 }}
          onChange={async (next) => {
            await apiPost('/decorate/mobileCatNav/updateField', {
              id: row.mobileCatNavId,
              field: 'sortOrder',
              val: Number(next ?? 0),
            });
            Toast.success('操作成功');
          }}
        />
      ),
    },
  ];

  return (
    <div>
      <ListPage
        api="/decorate/mobileCatNav/list"
        rowKey="mobileCatNavId"
        columns={columns}
        filters={[{ field: 'categoryName', label: '首页分类栏名称', type: 'input' }]}
        drawer={{
          title: '分类导航配置',
          addText: '添加首页分类栏',
          width: 680,
          createApi: '/decorate/mobileCatNav/create',
          updateApi: '/decorate/mobileCatNav/update',
          detailApi: '/decorate/mobileCatNav/detail',
          deleteApi: '/decorate/mobileCatNav/del',
          idField: 'mobileCatNavId',
          toPayload: (values) => {
            const splitIds = (value: unknown) =>
              typeof value === 'string'
                ? value.split(/[,，\s]+/).map((item) => Number(item)).filter((item) => item > 0)
                : Array.isArray(value) ? value : [];
            const imgUrl = typeof values.imgUrl === 'string'
              ? values.imgUrl.split(/\s+/).map((item) => item.trim()).filter(Boolean)
              : values.imgUrl;
            return {
              ...values,
              categoryId: Number(values.categoryId) || 0,
              childCatIds: splitIds(values.childCatIds),
              brandIds: splitIds(values.brandIds),
              imgUrl: Array.isArray(imgUrl) ? imgUrl : [],
              isShow: Number(values.isShow) ? 1 : 0,
              sortOrder: Number(values.sortOrder) || 50,
            };
          },
          sections: [
            {
              key: 'basic',
              title: '基础配置',
              fields: [
                {
                  field: 'categoryId',
                  label: '选择分类',
                  type: 'select',
                  required: true,
                  optionsApi: '/product/category/list',
                  optionsParams: { page: 1, size: 300 },
                  optionLabel: 'categoryName',
                  optionValue: 'categoryId',
                },
                { field: 'catColor', label: '分类颜色', type: 'input', placeholder: '#FF5000' },
                { field: 'imgUrl', label: '分类banner', type: 'textarea', placeholder: '每行一个图片 URL，建议比例 2:1' },
                { field: 'childCatIds', label: '推荐子分类', type: 'textarea', placeholder: '分类ID，逗号分隔' },
                { field: 'brandIds', label: '推荐品牌', type: 'textarea', placeholder: '品牌ID，逗号分隔' },
                { field: 'sortOrder', label: '排序', type: 'number' },
                { field: 'isShow', label: '是否显示', type: 'switch', initValue: 1 },
              ],
            },
          ],
        }}
      />
    </div>
  );
}

