'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Toast } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';
import { useTranslation } from 'react-i18next';
import {
  canDownloadRawImages,
  fetchRawImageArchive,
  rawImageDownloadUrl,
  saveRawImageBlob,
  type RawImageConfig,
} from '@/lib/rawImageDownload';

/**
 * 商品详情页「素材下载」按钮。
 *
 * 对应 Java `view/pc/components/product/RawImageDownloadButton.vue` +
 * `composables/useProductRawImageDownload.ts`：
 * 从 initConfigSettings 读总开关与渠道白名单，登录后打包下载商品原图。
 */
interface Props {
  productId: number;
  shopId?: number;
  nearestShopId?: number;
}

const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function RawImageDownloadButton({ productId, shopId, nearestShopId }: Props) {
    const { t } = useTranslation();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    apiGet<RawImageConfig>('common/config/initConfigSettings')
      .then((config) => {
        if (active) setVisible(canDownloadRawImages(config || {}, 'pc'));
      })
      .catch(() => {
        if (active) setVisible(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const download = async () => {
    if (busy || !productId) return;
    const token = localStorage.getItem('accessToken');
    if (!token) {
      Toast.warning({ content: '请先登录后下载商品原图' });
      router.push('/login');
      return;
    }
    setBusy(true);
    const controller = new AbortController();
    try {
      const url = rawImageDownloadUrl('/api', { id: productId, shopId, nearestShopId });
      const headers: Record<string, string> = {
        'X-Client-Type': 'pc',
        Authorization: `Bearer ${token}`,
      };
      const { blob, filename } = await fetchRawImageArchive(url, headers, controller.signal, productId);
      const cleanup = saveRawImageBlob(blob, filename);
      window.setTimeout(cleanup, 60_000);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '素材下载失败，请重试' });
    } finally {
      setBusy(false);
    }
  };

  if (!visible || !productId) return null;
  return (
    <Button
      size="large"
      icon={<DownloadIcon />}
      loading={busy}
      disabled={busy}
      title={t('下载商品原图压缩包')}
      onClick={() => void download()}
    >{t('素材下载')}</Button>
  );
}
