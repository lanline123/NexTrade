'use client';

/**
 * 以图搜图入口（源码：view/pc/components/imageSearch/ImageSearchEntry.vue）
 *
 * React + Semi 版：入口按钮 + 悬停/点击触发的浮层面板（源码为 el-popover）。
 * 能力开关读取 `/api/search/imageSearch/capabilities`（enabled/pcEnabled/shopEnabled/formats）；
 * 店铺内入口额外要求 shopEnabled。
 *
 * 源码把选中的图片交给结果页上传检索；本仓库结果页 `/search/image` 自带选图上传流程，
 * 故提交时跳转结果页（本地暂存预览 dataURL 供后续接入，见 remaining gaps）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Camera from '@icon-park/react/es/icons/Camera';

import { useTranslation } from 'react-i18next';
interface Capabilities {
  enabled?: boolean;
  pcEnabled?: boolean;
  shopEnabled?: boolean;
  formats?: string[];
}

const DEFAULT_FORMATS = ['JPEG', 'PNG', 'WEBP', 'BMP', 'GIF'];
const PENDING_PREVIEW_KEY = 'pcImageSearchPendingPreview';

function formatMime(formats: string[]): string {
  const mimeMap: Record<string, string> = {
    JPEG: 'image/jpeg',
    JPG: 'image/jpeg',
    PNG: 'image/png',
    WEBP: 'image/webp',
    BMP: 'image/bmp',
    GIF: 'image/gif',
    TIFF: 'image/tiff',
  };
  const list = formats.map((format) => mimeMap[format]).filter(Boolean);
  return list.length ? list.join(',') : 'image/*';
}

function isSupportedFile(file: File, formats: string[]): boolean {
  const name = file.name.toLowerCase();
  const extMap: Record<string, string[]> = {
    JPEG: ['.jpg', '.jpeg'],
    JPG: ['.jpg', '.jpeg'],
    PNG: ['.png'],
    WEBP: ['.webp'],
    BMP: ['.bmp'],
    GIF: ['.gif'],
    TIFF: ['.tif', '.tiff'],
  };
  return formats.some((format) => (extMap[format] || []).some((ext) => name.endsWith(ext)));
}

export default function PcImageSearchEntry({ shopId }: { shopId?: number | string }) {
    const { t } = useTranslation();
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const triggerRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/search/imageSearch/capabilities', { credentials: 'include' })
      .then((response) => response.json())
      .then((json) => {
        if (!cancelled) setCapabilities((json?.data || null) as Capabilities | null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const available = Boolean(
    capabilities?.enabled && capabilities?.pcEnabled && (shopId === undefined || capabilities?.shopEnabled !== false),
  );
  const formats = capabilities?.formats && capabilities.formats.length ? capabilities.formats : DEFAULT_FORMATS;

  const acceptFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      if (files.length > 1) {
        setErrorMessage('一次只能使用一张图片');
        return;
      }
      const next = files[0];
      if (!isSupportedFile(next, formats)) {
        setErrorMessage(t('图片格式不支持，请使用 {f} 格式', { f: formats.join(' / ') }));
        return;
      }
      if (next.size === 0) {
        setErrorMessage('无法读取图片，请更换图片');
        return;
      }
      setFile(next);
      setErrorMessage('');
      setPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(next);
      });
    },
    [formats],
  );

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    const images = files.filter((item) => item.type.startsWith('image/') || isSupportedFile(item, formats));
    if (images.length === 0) {
      setErrorMessage('请选择图片文件');
      return;
    }
    acceptFiles(images);
  };

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const images = Array.from(event.clipboardData?.files ?? []).filter((item) => item.type.startsWith('image/'));
    if (images.length === 0) return;
    event.preventDefault();
    acceptFiles(images);
  };

  const submit = () => {
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          if (typeof reader.result === 'string') sessionStorage.setItem(PENDING_PREVIEW_KEY, reader.result);
        } catch {
          /* 忽略暂存失败 */
        }
        window.location.href = '/search/image';
      };
      reader.readAsDataURL(file);
    } catch {
      window.location.href = '/search/image';
    }
  };

  if (!available) return null;

  return (
    <span ref={triggerRef} className="image-search-entry" style={{ position: 'relative' }}>
      <button
        type="button"
        className="image-search-entry__btn"
        aria-label={t('以图搜图')}
        aria-expanded={open}
        title={t('上传和粘贴图片搜同款')}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <Camera size={18} />
      </button>

      {open ? (
        <div
          ref={panelRef}
          className="image-search-popper"
          onPaste={onPaste}
          role="dialog"
          aria-label={t('上传图片搜索')}
        >
          <div className="image-search-panel" tabIndex={-1}>
            <div className="image-search-panel__header">
              <span className="image-search-panel__title">{t('上传图片搜索')}</span>
              <button type="button" className="image-search-panel__close" aria-label={t('关闭')} onClick={() => setOpen(false)}>
                ×
              </button>
            </div>

            {!file ? (
              <>
                <div
                  className={`image-search-panel__drop${dragging ? ' image-search-panel__drop--active' : ''}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setDragging(false);
                  }}
                  onDrop={onDrop}
                >
                  <Camera className="image-search-panel__drop-icon" size={32} />
                  <p className="image-search-panel__drop-text">{t('粘贴图片到此处')}</p>
                </div>
                {errorMessage ? (
                  <p className="image-search-panel__error" role="alert">
                    {errorMessage}
                  </p>
                ) : null}
                <div className="image-search-panel__actions">
                  <button type="button" className="image-search-panel__btn image-search-panel__btn--primary" onClick={() => inputRef.current?.click()}>{t('上传图片')}</button>
                </div>
              </>
            ) : (
              <>
                <div className="image-search-panel__preview">
                  {previewUrl ? (
                    <img className="image-search-panel__image" src={previewUrl} alt={t('待搜索的图片')} />
                  ) : (
                    <div className="image-search-panel__file">
                      <Camera className="image-search-panel__drop-icon" size={32} />
                      <span className="image-search-panel__file-name">{file.name}</span>
                    </div>
                  )}
                </div>
                {errorMessage ? (
                  <p className="image-search-panel__error" role="alert">
                    {errorMessage}
                  </p>
                ) : null}
                <div className="image-search-panel__actions">
                  <button type="button" className="image-search-panel__btn image-search-panel__btn--primary" onClick={submit}>{t('搜索')}</button>
                </div>
              </>
            )}

            <input
              ref={inputRef}
              type="file"
              className="image-search-panel__input"
              accept={formatMime(formats)}
              tabIndex={-1}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const input = event.target;
                acceptFiles(Array.from(input.files ?? []));
                input.value = '';
              }}
            />
          </div>
        </div>
      ) : null}
    </span>
  );
}
