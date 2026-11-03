import { useRef, useState } from 'react';
import { Button, Toast } from '@douyinfe/semi-ui';
import { apiUpload } from '../api';
import { useI18n } from '../i18n';

interface CertFileUploadProps {
  /** 0/1 标记：证书是否已上传（文件本身保存在服务端）。 */
  value: unknown;
  /** 上传接口的 type 参数，与旧版 /setting/config/uploadFile?type=N 契约一致。 */
  uploadType: number;
  fileHint: string;
  onChange: (next: number) => void;
}

/** 支付证书文件上传控件（.pem/.cer/.key），上传成功后置 1。 */
export default function CertFileUpload({ value, uploadType, fileHint, onChange }: CertFileUploadProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const uploaded = Number(value) === 1;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      await apiUpload(`/setting/config/uploadFile?type=${uploadType}`, file);
      onChange(1);
      Toast.success({ content: t('上传成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('证书文件格式不正确') });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="cert-file-upload" data-widget="cert-file-upload">
      <Button loading={uploading} onClick={() => inputRef.current?.click()}>
        {uploaded ? t('重新上传') : t('点击上传')}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".pem,.cer,.key"
        style={{ display: 'none' }}
        onChange={(event) => upload(event.target.files?.[0])}
      />
      <span className="cert-file-hint">{fileHint}</span>
    </div>
  );
}
