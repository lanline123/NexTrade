import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconArrowLeft, IconDelete, IconPlus } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';

const { Text } = Typography;

type MobileModule = {
  moduleIndex: number;
  type: string;
  label: string;
  isShow: boolean;
  module: Record<string, any>;
};

const MOBILE_LIBRARY: Array<{ type: string; label: string; group: string }> = [
  { type: 'imageAd', label: '图片广告', group: '图片' },
  { type: 'imageAd2', label: '图片广告2', group: '图片' },
  { type: 'imageSquareAd', label: '图片魔方', group: '图片' },
  { type: 'slidingImage', label: '大图滑动', group: '图片' },
  { type: 'imageNav', label: '图文导航', group: '导航' },
  { type: 'categoryNav', label: '类目导航', group: '导航' },
  { type: 'catNav', label: '分类导航', group: '导航' },
  { type: 'searchBar', label: '搜索栏', group: '导航' },
  { type: 'notice', label: '公告', group: '辅助' },
  { type: 'imageTextComponent', label: '图文介绍', group: '辅助' },
  { type: 'banner', label: '首焦轮播', group: '商品与营销' },
  { type: 'productA1', label: '商品A1', group: '商品与营销' },
  { type: 'productSlide', label: '商品滑动', group: '商品与营销' },
  { type: 'productGrouping', label: '商品分组', group: '商品与营销' },
  { type: 'seckill', label: '秒杀', group: '商品与营销' },
  { type: 'groupon', label: '拼团', group: '商品与营销' },
  { type: 'videoNumber', label: '视频号', group: '商品与营销' },
];

const pickImages = (module: Record<string, any>): string[] => {
  const list = module.picList || module.bannerContent?.picList || module.categoryList || [];
  if (!Array.isArray(list)) return [];
  return list
    .map((item: any) => item?.picUrl || item?.picThumb || '')
    .filter(Boolean);
};

function MobileModulePreview({ item }: { item: MobileModule }) {
  const m = item.module || {};
  const images = pickImages(m);
  const title = m.title?.titleText || m.name || m.liveTitle || item.label;
  if (images.length) {
    return (
      <div style={{ padding: '6px 8px' }}>
        <img src={images[0]} alt="" style={{ width: '100%', maxHeight: 150, objectFit: 'cover', borderRadius: 6 }} />
        {images.length > 1 ? <div style={{ fontSize: 10, color: '#98a2b3', marginTop: 4 }}>{images.length} 张图</div> : null}
      </div>
    );
  }
  if (item.type === 'categoryNav' || item.type === 'catNav' || item.type === 'imageNav') {
    const cats = Array.isArray(m.categoryList) ? m.categoryList : [];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, padding: 10 }}>
        {(cats.length ? cats : Array.from({ length: 4 })).map((cat: any, index: number) => (
          <div key={index} style={{ textAlign: 'center', fontSize: 11 }}>
            <div style={{ width: 34, height: 34, margin: '0 auto 4px', borderRadius: 17, background: cat?.picUrl ? 'transparent' : '#eef1f5', overflow: 'hidden' }}>
              {cat?.picUrl ? <img src={cat.picUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
            </div>
            <div>{cat?.picTitle || '分类'}</div>
          </div>
        ))}
      </div>
    );
  }
  if (item.type === 'imageTextComponent') {
    return (
      <div style={{ padding: 12 }}>
        {m.picUrl?.picUrl ? <img src={m.picUrl.picUrl} alt="" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 6 }} /> : null}
        <div style={{ fontWeight: 600, marginTop: 8 }}>{m.title || item.label}</div>
        <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>{m.description || ''}</div>
      </div>
    );
  }
  return (
    <div style={{ padding: '14px 10px', background: '#f7f8fa', borderRadius: 6, color: '#646a73', textAlign: 'center', fontSize: 12 }}>
      {item.label || title}{item.type === 'productSlide' || item.type === 'productA1' ? ' · 商品模块' : ''}
    </div>
  );
}

export default function MobileDecorateEditor({ decorateId, onExit }: { decorateId: number; onExit: () => void }) {
  const [title, setTitle] = useState('');
  const [pageModule, setPageModule] = useState<Record<string, any>>({});
  const [moduleList, setModuleList] = useState<MobileModule[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);

  useEffect(() => {
    if (!decorateId) return;
    setLoading(true);
    apiGet<any>('/decorate/decorate/detail', { id: decorateId, decorateType: 1, parentId: 0, localeId: 0 })
      .then((result) => {
        setTitle(result?.decorateTitle || '');
        const data = result?.data || {};
        setPageModule(data.pageModule || {});
        setModuleList(Array.isArray(data.moduleList) ? data.moduleList.map((item: any, index: number) => ({
          moduleIndex: item.moduleIndex ?? Date.now() + index,
          type: item.type,
          label: item.label || item.type,
          isShow: item.isShow !== false,
          module: item.module || {},
        })) : []);
      })
      .catch((error) => Toast.error(error instanceof Error ? error.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [decorateId]);

  const active = activeIndex >= 0 ? moduleList[activeIndex] : null;

  const updateActive = (patch: Partial<MobileModule>) => {
    if (!active) return;
    setModuleList((prev) => prev.map((item, index) => (index === activeIndex ? { ...item, ...patch } : item)));
  };
  const updateField = (key: string, value: any) => {
    if (!active) return;
    updateActive({ module: { ...active.module, [key]: value } });
  };

  const addModule = (type: string, label: string) => {
    const item: MobileModule = {
      moduleIndex: Date.now(),
      type,
      label,
      isShow: true,
      module: {},
    };
    setModuleList((prev) => [...prev, item]);
    setActiveIndex(moduleList.length);
  };

  const save = async (mode: 'draft' | 'publish') => {
    setSaving(mode);
    try {
      await apiPost(mode === 'draft' ? '/decorate/decorate/saveDraft' : '/decorate/decorate/publish', {
        id: decorateId,
        decorateType: 1,
        pageType: 1,
        localeId: 0,
        parentId: 0,
        data: { pageModule, moduleList },
      });
      Toast.success(mode === 'draft' ? '草稿已保存' : '发布成功');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f5f7fa' }}>
      <div style={{ height: 60, background: '#fff', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderBottom: '1px solid #e5e6eb' }}>
        <Button icon={<IconArrowLeft />} onClick={onExit}>返回列表</Button>
        <Input value={title} onChange={setTitle} style={{ width: 200 }} />
        <Tag color="blue">移动端装修</Tag>
        <div style={{ flex: 1 }} />
        <Button loading={saving === 'draft'} onClick={() => save('draft')}>保存草稿</Button>
        <Button theme="solid" type="primary" loading={saving === 'publish'} onClick={() => save('publish')}>保存并发布</Button>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ width: 220, background: '#fff', borderRight: '1px solid #e5e6eb', overflow: 'auto', padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>移动端模块</div>
          {MOBILE_LIBRARY.map((item) => (
            <div
              key={item.type}
              onClick={() => addModule(item.type, item.label)}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', marginBottom: 6, borderRadius: 6, background: '#f7f8fa', cursor: 'pointer', fontSize: 13 }}
            >
              <span>{item.label}</span>
              <span style={{ color: '#98a2b3' }}>{item.group}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          <div style={{ width: 375, background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.08)', overflow: 'hidden' }}>
            <div style={{ height: 44, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0', fontWeight: 600 }}>{title || '移动端页面'}</div>
            <div style={{ minHeight: 600, background: pageModule.backgroundColor || '#fff' }}>
              {loading ? <div style={{ padding: 20, color: '#98a2b3' }}>加载中...</div> : moduleList.map((item, index) => (
                <div
                  key={item.moduleIndex}
                  onClick={() => setActiveIndex(index)}
                  style={{
                    position: 'relative',
                    opacity: item.isShow ? 1 : 0.45,
                    outline: activeIndex === index ? '2px solid #1456f0' : '1px dashed transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, background: '#1456f0', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: '0 0 4px 0' }}>{item.label}</div>
                  <MobileModulePreview item={item} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ width: 300, background: '#fff', borderLeft: '1px solid #e5e6eb', overflow: 'auto', padding: 14 }}>
          {active ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <b>{active.label}</b>
                <Button icon={<IconDelete />} theme="borderless" type="danger" size="small" onClick={() => { setModuleList((prev) => prev.filter((_, i) => i !== activeIndex)); setActiveIndex(-1); }} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <span style={{ width: 80, color: '#646a73' }}>显示</span>
                <Switch checked={active.isShow} onChange={(checked) => updateActive({ isShow: checked })} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <span style={{ width: 80, color: '#646a73' }}>模块名称</span>
                <Input value={active.label} onChange={(value: string) => updateActive({ label: value })} />
              </div>
              {Object.entries(active.module || {})
                .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
                .slice(0, 30)
                .map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ width: 96, color: '#646a73', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }} title={key}>{key}</span>
                    {typeof value === 'boolean' ? (
                      <Switch checked={value} onChange={(checked) => updateField(key, checked)} />
                    ) : typeof value === 'number' ? (
                      <InputNumber value={value} onChange={(next) => updateField(key, Number(next ?? 0))} style={{ width: 150 }} />
                    ) : key.toLowerCase().includes('color') ? (
                      <input type="color" value={String(value) || '#ffffff'} onChange={(e) => updateField(key, e.target.value)} />
                    ) : (
                      <Input value={String(value)} onChange={(next: string) => updateField(key, next)} style={{ width: 160 }} />
                    )}
                  </div>
                ))}
            </>
          ) : (
            <>
              <b>页面设置</b>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
                <span style={{ width: 80, color: '#646a73' }}>页面标题</span>
                <Input value={title} onChange={setTitle} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <span style={{ width: 80, color: '#646a73' }}>背景色</span>
                <input type="color" value={pageModule.backgroundColor || '#ffffff'} onChange={(e) => setPageModule({ ...pageModule, backgroundColor: e.target.value })} />
              </div>
              <div style={{ color: '#98a2b3', fontSize: 12 }}>点击画布中的模块编辑属性</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
