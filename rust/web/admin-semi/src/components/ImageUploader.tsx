import { useRef, useState } from 'react';
import { Toast } from '@douyinfe/semi-ui';
import { IconClose, IconPlus } from '@douyinfe/semi-icons';
import { apiUpload, isDemo } from '../api';
import { useI18n } from '../i18n';

interface ImageUploaderProps {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  single?: boolean;
}

interface UploadResult {
  picUrl: string;
  picThumb?: string;
}

export default function ImageUploader({ value, onChange, max = 9, single = false }: ImageUploaderProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持上传图片') });
      return;
    }
    inputRef.current?.click();
  };

  const upload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const limit = single ? 1 : max;
    const remaining = limit - value.length;
    if (remaining <= 0) {
      Toast.warning({ content: t('最多上传 {count} 张图片', { count: limit }) });
      return;
    }
    setUploading(true);
    try {
      const next = [...value];
      for (const file of Array.from(files).slice(0, remaining)) {
        const result = await apiUpload<UploadResult>('/setting/galleryPic/uploadImg?galleryId=0', file);
        if (result?.picUrl) next.push(result.picUrl);
      }
      onChange(next);
      Toast.success({ content: t('图片上传成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('图片上传失败') });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const setMain = (index: number) => {
    if (index === 0) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.unshift(item);
    onChange(next);
  };

  return (
    <div className="image-uploader">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => upload(event.target.files)}
      />
      <div className="image-uploader-list">
        {value.map((url, index) => (
          <div className="image-uploader-item" key={`${url}-${index}`}>
            <img src={url} alt={t('图片 {index}', { index: index + 1 })} />
            {!single && index === 0 && <span className="image-main-badge">{t('主图')}</span>}
            <div className="image-uploader-actions">
              {!single && index !== 0 && (
                <button type="button" onClick={() => setMain(index)}>
                  {t('设为主图')}
                </button>
              )}
              <button type="button" className="is-danger" onClick={() => remove(index)}>
                <IconClose size="small" />
              </button>
            </div>
          </div>
        ))}
        {value.length < (single ? 1 : max) && (
          <button type="button" className="image-uploader-add" onClick={pick} disabled={uploading}>
            <IconPlus />
            <span>{uploading ? t('上传中...') : t('上传图片')}</span>
          </button>
        )}
      </div>
      <div className="image-uploader-tip">
        {single
          ? t('支持 JPG / PNG / WebP，单张图片。')
          : t('支持 JPG / PNG / WebP，最多 {count} 张；第一张作为商品主图，可通过“设为主图”调整顺序。', {
              count: max,
            })}
      </div>
    </div>
  );
}
