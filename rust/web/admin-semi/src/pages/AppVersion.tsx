import { useEffect, useRef, useState } from 'react';
import { Button, Card, Form, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost, apiUpload } from '../api';
import { useI18n } from '../i18n';

function UploadButton({
  accept,
  onUploaded,
}: {
  accept: string;
  onUploaded: (url: string) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const url = await apiUpload<string>('/setting/appVersion/uploadFile', file);
      if (url) onUploaded(url);
      Toast.success({ content: t('上传成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('上传失败') });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = '';
        }}
      />
      <Button size="small" loading={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? t('上传中') : t('上传')}
      </Button>
    </>
  );
}

export default function AppVersion() {
  const { t } = useI18n();
  const [formApi, setFormApi] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<Record<string, any>>('/setting/appVersion/detail')
      .then((result) => formApi?.setValues(result || {}, { isOverride: true }))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [formApi]);

  const submit = async () => {
    if (!formApi) return;
    try {
      const values = await formApi.validate();
      setSaving(true);
      await apiPost('/setting/appVersion/update', values);
      Toast.success({ content: t('保存成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="table-card" shadows="hover">
      <div className="app-version-header">
        <h3>{t('APP版本')}</h3>
        <p>{t('配置 Android / iOS 版本号与热更新包下载地址。')}</p>
      </div>
      <Form
        getFormApi={setFormApi}
        labelPosition="left"
        labelAlign="right"
        labelWidth={140}
        className="product-form app-version-form"
        initValues={{}}
      >
        <Form.Input field="androidVersion" label={t('Android版本号')} placeholder={t('如 1.0.0')} />
        <Form.Input
          field="androidLink"
          label={t('Android下载链接')}
          placeholder={t('上传 APK / WGT 或填写下载地址')}
          suffix={
            formApi ? (
              <UploadButton
                accept=".apk,.wgt"
                onUploaded={(url) => formApi.setValue('androidLink', url)}
              />
            ) : null
          }
        />
        <Form.Input field="iosVersion" label={t('iOS版本号')} placeholder={t('如 1.0.0')} />
        <Form.Input
          field="iosLink"
          label={t('iOS下载链接')}
          placeholder={t('上传 WGT 或填写下载地址')}
          suffix={
            formApi ? (
              <UploadButton
                accept=".wgt"
                onUploaded={(url) => formApi.setValue('iosLink', url)}
              />
            ) : null
          }
        />
        <div className="app-version-actions">
          <Button theme="solid" type="primary" loading={saving || loading} onClick={submit}>
            {t('保存')}
          </Button>
        </div>
      </Form>
    </Card>
  );
}
