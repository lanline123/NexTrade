'use client';

import { useEffect, useMemo, useState } from 'react';

function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export default function PcMobilePage() {
  const [h5Domain, setH5Domain] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch('/api/common/config/base')
      .then((response) => response.json())
      .then((json) => setH5Domain(String(json?.data?.h5Domain || '')))
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const h5Url = useMemo(() => {
    if (!ready) return '';
    const params = new URLSearchParams(window.location.search);
    const src = params.get('src') || '';
    const path = params.get('path') || '';
    params.delete('src');
    params.delete('path');
    const query = params.toString();

    if (src) {
      try {
        const allowOrigins = [window.location.origin];
        if (h5Domain) allowOrigins.push(new URL(h5Domain).origin);
        if (allowOrigins.includes(new URL(src).origin)) return src;
      } catch {
        // fall through
      }
    }
    const base = h5Domain ? `${h5Domain}${path}` : `${window.location.origin}/mobile${path}`;
    return query ? `${base}?${query}` : base;
  }, [ready, h5Domain]);

  useEffect(() => {
    if (!h5Url) return;
    if (isMobileDevice()) window.location.replace(h5Url);
  }, [h5Url]);

  if (!ready || !h5Url) return null;
  return <iframe src={h5Url} className="pc-mobile-iframe" title="移动端预览" allowFullScreen />;
}
