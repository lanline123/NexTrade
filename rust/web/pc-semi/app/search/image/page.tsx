'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Toast, Typography } from '@douyinfe/semi-ui';

interface SearchRecord {
  productId?: number;
  productName?: string;
  productPrice?: number | string;
  marketPrice?: number | string;
  picThumb?: string;
  seoLink?: string;
}

export default function ImageSearchPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<SearchRecord[]>([]);
  const [searched, setSearched] = useState(false);

  const pick = () => inputRef.current?.click();

  const search = async (file: File) => {
    setLoading(true);
    setSearched(true);
    setRecords([]);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/search/image/search', { method: 'POST', body: form, credentials: 'include' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || (json.code !== undefined && json.code !== 0)) {
        throw new Error(json.msg || json.message || '以图搜图失败');
      }
      const list = json?.data?.records || json?.data?.list || [];
      setRecords(Array.isArray(list) ? list : []);
      if (!list.length) Toast.info({ content: '没有找到相似商品' });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '以图搜图失败' });
    } finally {
      setLoading(false);
    }
  };

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      Toast.warning({ content: '请选择图片文件' });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      Toast.warning({ content: '图片不能超过 4MB' });
      return;
    }
    setPreview(URL.createObjectURL(file));
    search(file);
  };

  return (
    <main className="pc-static-page">
      <div className="pc-container">
        <nav className="pc-breadcrumb">
          <Link href="/">首页</Link><span>/</span><Link href="/search">搜索</Link><span>/</span><span>以图搜图</span>
        </nav>
        <h1 className="pc-cart-title">以图搜图</h1>
        <Card className="pc-image-search">
          <div className="pc-image-search__box" onClick={pick} role="button" tabIndex={0}>
            {preview ? <img src={preview} alt="搜索图片" /> : <span>点击上传商品图片<br /><small>支持 JPG / PNG / BMP，最大 4MB</small></span>}
          </div>
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={onChange} />
          <Button theme="solid" type="primary" loading={loading} onClick={pick}>{loading ? '搜索中...' : '选择图片搜索'}</Button>
        </Card>

        {searched && !loading && records.length ? (
          <>
            <Typography.Title heading={4} style={{ margin: '24px 0 12px' }}>相似商品</Typography.Title>
            <div className="pc-product-grid">
              {records.map((item) => (
                <Link key={item.productId} href={item.seoLink || `/product/${item.productId}`} className="pc-product-grid__card">
                  <div className="pc-product-grid__image">
                    <img src={item.picThumb || ''} alt={item.productName || ''} />
                  </div>
                  <div className="pc-product-grid__name">{item.productName || '商品'}</div>
                  <div className="pc-product-grid__bottom">¥ {Number(item.productPrice || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
