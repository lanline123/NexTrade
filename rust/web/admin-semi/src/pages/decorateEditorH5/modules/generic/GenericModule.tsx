/**
 * 通用装修模块工厂 —— 批量补齐缺失模块 type 的「诚实版」实现。
 *
 * 背景：旧编辑器 121 个模块 type，新编辑器只注册 65 个，44 个整块缺失
 * （mobileMember 11、mobilePro 17、mobileProductDetail 3、search/login、
 * promotion 零散、cateCenter 2 等）。逐个像素级移植体量过大，先按本工厂
 * 注册全部缺失 type：老数据可渲染（不再空白/报错）、基础字段可编辑可保存、
 * 工具栏可选择；预览为类别化占位（hero/grid/list/user/detail/search/text）。
 * 后续可逐模块替换为精确移植版（同 notice）。
 */
import type { ComponentType } from 'react';
import { registerModule } from '../../contract/moduleRegistry';
import { cloneDeep } from '../../contract/sharedDefaults';
import {
  ColorField,
  FrameSettingsField,
  NumberField,
  PicListField,
  RadioRowField,
  SelectField,
  SettingGroup,
  SinglePicField,
  SwitchField,
  TextField,
  TitleSettingsField,
} from '../../shared/settingWidgets';

export interface GenericFieldSpec {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'number' | 'switch' | 'color' | 'select' | 'radio' | 'image' | 'pics' | 'title' | 'frame';
  options?: Array<{ value: number | string; label: string }>;
  min?: number;
  max?: number;
}

export type GenericPreviewKind = 'hero' | 'grid' | 'list' | 'banner' | 'user' | 'detail' | 'search' | 'text';

export interface GenericModuleSpec {
  type: string;
  label: string;
  icon: string;
  url: string;
  platform: string;
  order?: number;
  previewKind: GenericPreviewKind;
  /** 与旧版 defaultModule 的关键字段对齐（完整契约可后补，未知字段透传不丢） */
  defaults: Record<string, any>;
  fields: GenericFieldSpec[];
}

/* ------------------------------ 通用预览 ------------------------------ */

function GenericPreview({ data, spec }: { data: Record<string, any>; spec: GenericModuleSpec }) {
  const m = data ?? {};
  const title: string = m.title?.text ?? m.title ?? m.text ?? spec.label;
  const pic: string | undefined = m.pic?.picUrl ?? (typeof m.pic === 'string' ? m.pic : undefined) ?? m.imageUrl ?? m.bgPic?.picUrl;

  const shell: React.CSSProperties = {
    margin: 8,
    borderRadius: 8,
    background: '#fff',
    overflow: 'hidden',
    border: '1px solid #f0f0f0',
  };

  const head = title ? <div style={{ padding: '10px 12px', fontSize: 14, fontWeight: 600, color: '#333' }}>{String(title)}</div> : null;

  switch (spec.previewKind) {
    case 'user':
      return (
        <div style={shell}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'linear-gradient(120deg,#5a7bf0,#8f6ef0)' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff3', overflow: 'hidden' }}>
              {pic && <img src={pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ color: '#fff' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{String(m.nickname ?? '会员昵称')}</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>{String(m.description ?? '欢迎回来')}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', padding: '10px 4px' }}>
            {Array.from({ length: Number(m.showCount ?? 4) }, (_, i) => (
              <div key={i} style={{ textAlign: 'center', padding: 6 }}>
                <div style={{ width: 22, height: 22, margin: '0 auto 4px', borderRadius: 6, background: '#f0f2f8' }} />
                <div style={{ fontSize: 10, color: '#888' }}>{['订单', '钱包', '服务', '账户'][i % 4]}</div>
              </div>
            ))}
          </div>
        </div>
      );
    case 'grid':
      return (
        <div style={shell}>
          {head}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, padding: '0 10px 10px' }}>
            {Array.from({ length: Number(m.showCount ?? 6) }, (_, i) => (
              <div key={i} style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid #f5f5f5' }}>
                <div style={{ height: 70, background: pic ? `url(${pic}) center/cover` : '#f6f7fa' }} />
                <div style={{ padding: '4px 6px', fontSize: 10, color: '#666' }}>{String(m.productTitle ?? '商品占位')}</div>
                <div style={{ padding: '0 6px 6px', fontSize: 11, color: '#df4544', fontWeight: 600 }}>¥{Number(m.price ?? 99).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      );
    case 'banner':
      return (
        <div style={shell}>
          {head}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 10px 10px' }}>
            {Array.from({ length: Number(m.showCount ?? 3) }, (_, i) => (
              <div key={i} style={{ flexShrink: 0, width: 120, borderRadius: 6, overflow: 'hidden', border: '1px solid #f5f5f5' }}>
                <div style={{ height: 80, background: pic ? `url(${pic}) center/cover` : '#f6f7fa' }} />
                <div style={{ padding: 5, fontSize: 10, color: '#666' }}>{String(m.productTitle ?? '推荐位')}</div>
              </div>
            ))}
          </div>
        </div>
      );
    case 'list':
      return (
        <div style={shell}>
          {head}
          {Array.from({ length: Number(m.showCount ?? 3) }, (_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderTop: '1px solid #f7f7f7' }}>
              <div style={{ width: 44, height: 44, borderRadius: 4, background: pic ? `url(${pic}) center/cover` : '#f6f7fa', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#333' }}>{String(m.itemTitle ?? `${spec.label}条目 ${i + 1}`)}</div>
                <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{String(m.itemDesc ?? '')}</div>
              </div>
              <span style={{ color: '#ccc' }}>›</span>
            </div>
          ))}
        </div>
      );
    case 'detail':
      return (
        <div style={shell}>
          <div style={{ height: 150, background: pic ? `url(${pic}) center/cover` : 'linear-gradient(120deg,#e8ecf6,#f6f0ea)' }} />
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{String(m.productTitle ?? m.title?.text ?? '商品详情')}</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{String(m.description ?? '商品介绍占位文字')}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ color: '#df4544', fontWeight: 700, fontSize: 16 }}>¥{Number(m.price ?? 199).toFixed(2)}</span>
              <span style={{ background: '#df4544', color: '#fff', fontSize: 12, borderRadius: 14, padding: '4px 14px' }}>{String(m.buttonText ?? '立即购买')}</span>
            </div>
          </div>
        </div>
      );
    case 'search':
      return (
        <div style={{ ...shell, padding: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f6fa', borderRadius: 16, padding: '8px 12px' }}>
            <span style={{ color: '#999' }}>🔍</span>
            <span style={{ color: '#bbb', fontSize: 12 }}>{String(m.placeholder ?? '搜索商品')}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {['综合', '销量', '价格', '新品'].map((chip) => (
              <span key={chip} style={{ fontSize: 11, color: '#666', background: '#f5f6fa', borderRadius: 10, padding: '3px 10px' }}>{chip}</span>
            ))}
          </div>
        </div>
      );
    case 'text':
      return (
        <div style={{ ...shell, padding: 12 }}>
          <div style={{ fontSize: 13, color: '#444', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{String(m.text ?? m.richText ?? title ?? '文本内容')}</div>
        </div>
      );
    case 'hero':
    default:
      return (
        <div style={{ ...shell, minHeight: 90, background: pic ? `url(${pic}) center/cover` : 'linear-gradient(120deg,#dbe4ff,#ffe6f0)' }}>
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: pic ? '#fff' : '#333', textShadow: pic ? '0 1px 4px rgba(0,0,0,.4)' : undefined }}>{String(title)}</div>
            {m.description ? <div style={{ fontSize: 11, color: pic ? '#ffffffcc' : '#888', marginTop: 4 }}>{String(m.description)}</div> : null}
          </div>
        </div>
      );
  }
}

/* ------------------------------ 通用设置 ------------------------------ */

function GenericSettings({ data, onChange, spec }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void; spec: GenericModuleSpec }) {
  return (
    <div className="h5-editor-settings-body">
      <SettingGroup title={`${spec.label}设置`}>
        {spec.fields.map((f) => {
          switch (f.kind) {
            case 'textarea':
              return <TextField key={f.key} data={data} onChange={onChange} field={f.key} label={f.label} />;
            case 'number':
              return <NumberField key={f.key} data={data} onChange={onChange} field={f.key} label={f.label} min={f.min} max={f.max} />;
            case 'switch':
              return <SwitchField key={f.key} data={data} onChange={onChange} field={f.key} label={f.label} />;
            case 'color':
              return <ColorField key={f.key} data={data} onChange={onChange} field={f.key} label={f.label} />;
            case 'select':
              return <SelectField key={f.key} data={data} onChange={onChange} field={f.key} label={f.label} options={f.options ?? []} />;
            case 'radio':
              return <RadioRowField key={f.key} data={data} onChange={onChange} field={f.key} label={f.label} options={f.options ?? []} />;
            case 'image':
              return <SinglePicField key={f.key} data={data} onChange={onChange} field={f.key} label={f.label} />;
            case 'pics':
              return <PicListField key={f.key} data={data} onChange={onChange} field={f.key} label={f.label} />;
            case 'title':
              return <TitleSettingsField key={f.key} data={data} onChange={onChange} field={f.key} label={f.label} />;
            case 'frame':
              return <FrameSettingsField key={f.key} data={data} onChange={onChange} field={f.key} label={f.label} />;
            case 'text':
            default:
              return <TextField key={f.key} data={data} onChange={onChange} field={f.key} label={f.label} />;
          }
        })}
      </SettingGroup>
    </div>
  );
}

export function registerGenericModule(spec: GenericModuleSpec) {
  const Preview: ComponentType<any> = (props) => <GenericPreview {...props} spec={spec} />;
  const Settings: ComponentType<any> = (props) => <GenericSettings {...props} spec={spec} />;
  registerModule({
    type: spec.type,
    label: spec.label,
    icon: spec.icon,
    url: spec.url,
    platform: spec.platform,
    order: spec.order,
    visible: spec.order !== undefined,
    preview: async () => ({ default: Preview }),
    settings: async () => ({ default: Settings }),
    getDefaultValue: () => cloneDeep(spec.defaults),
  });
}
