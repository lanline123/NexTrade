/**
 * ICO 图标选择器（IcoPicker）：对应原版 SelectIco 图标选择器。
 *
 * 原理与旧版一致：读取全局设置 `icoDefinedCss`（iconfont CSS 地址），
 * 拉取 CSS 文本并解析 `.icon-xxx` 类名，弹出图标网格供选择；
 * 未配置图标库时可手动输入图标 class。
 */

import { useState } from 'react';
import { Button, Empty, Input, Modal, Spin, Toast } from '@douyinfe/semi-ui';
import { apiGet } from '../api';
import { useI18n } from '../i18n';

interface IcoPickerProps {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function IcoPicker({ value, onChange, disabled }: IcoPickerProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [icons, setIcons] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');

  const loadIcons = async () => {
    setLoading(true);
    try {
      const config = await apiGet<any>('/setting/config/globalSettings');
      const cssUrl = config?.icoDefinedCss || config?.ico_defined_css || '';
      if (!cssUrl) {
        setIcons([]);
        Toast.warning({ content: t('未配置图标库地址（全局设置 → 自定义ico图标库）') });
        return;
      }
      const cssUrlFixed = cssUrl.startsWith('//') ? `https:${cssUrl}` : cssUrl;
      const response = await fetch(cssUrlFixed);
      const cssText = await response.text();
      const names = new Set<string>();
      const regex = /\.icon-([a-zA-Z0-9_-]+)/g;
      let match = regex.exec(cssText);
      while (match) {
        names.add(match[1]);
        match = regex.exec(cssText);
      }
      setIcons(Array.from(names).sort());
      if (!names.size) {
        Toast.warning({ content: t('图标库解析失败，请检查图标库地址') });
      }
    } catch (error) {
      setIcons([]);
      Toast.error({ content: error instanceof Error ? error.message : t('图标库加载失败') });
    } finally {
      setLoading(false);
    }
  };

  const open = () => {
    setVisible(true);
    if (!icons.length) loadIcons();
  };

  const filtered = icons.filter((name) => !keyword.trim() || name.includes(keyword.trim()));

  return (
    <div className="ico-picker">
      <Input
        value={value || ''}
        disabled={disabled}
        placeholder={t('ICO编码（可手动输入或点选图标）')}
        onChange={(next) => onChange(next)}
        suffix={
          !disabled ? (
            <Button size="small" theme="borderless" onClick={open}>
              {t('选择图标')}
            </Button>
          ) : null
        }
      />
      <Modal
        title={t('选择图标')}
        visible={visible}
        footer={null}
        onCancel={() => setVisible(false)}
        width={640}
      >
        <Spin spinning={loading}>
          <Input
            placeholder={t('搜索图标名')}
            value={keyword}
            showClear
            onClear={() => setKeyword('')}
            onChange={setKeyword}
            style={{ marginBottom: 12 }}
          />
          {filtered.length ? (
            <div className="ico-grid">
              {filtered.map((name) => (
                <div
                  key={name}
                  className={`ico-item${value === name ? ' is-active' : ''}`}
                  onClick={() => {
                    onChange(name);
                    setVisible(false);
                  }}
                >
                  <em className={`icon icon-${name}`} />
                  <span>{name}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty description={t('暂无图标数据')} />
          )}
        </Spin>
      </Modal>
    </div>
  );
}
