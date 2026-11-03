import { useEffect, useRef, useState } from 'react';
import { Spin, Typography } from '@douyinfe/semi-ui';
import { IconMapPin } from '@douyinfe/semi-icons';
import { apiGet } from '../api';
import { useI18n } from '../i18n';

const { Text } = Typography;

interface MapSettings {
  mapProvider?: string;
  amapJsKey?: string;
  amapJsSecret?: string;
  tiandituJsTk?: string;
}

type LngLat = [number, number];

function hasUsableKey(value?: string) {
  const key = String(value || '').trim();
  return Boolean(key && key !== '0');
}

export default function DeliveryRadiusMap({
  center,
  radius,
  onChangeRadius,
}: {
  center?: LngLat;
  radius: number;
  onChangeRadius: (radius: number) => void;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;

    const loadAmap = (key: string, secret: string) => new Promise<any>((resolve, reject) => {
      const existing = (window as any).AMap;
      if (existing) {
        resolve(existing);
        return;
      }
      if (secret) {
        (window as any)._AMapSecurityConfig = { securityJsCode: secret };
      }
      const script = document.createElement('script');
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.CircleEditor`;
      script.async = true;
      script.onload = () => resolve((window as any).AMap);
      script.onerror = () => reject(new Error(t('地图加载失败')));
      document.head.appendChild(script);
    });

    const init = async () => {
      setLoading(true);
      setError('');
      try {
        const settings = await apiGet<MapSettings>('/setting/config/mapSettings').catch(() => null);
        if (disposed) return;
        if (!hasUsableKey(settings?.amapJsKey)) {
          setError(t('未配置高德地图 JS Key，请先在「地图设置」中配置'));
          return;
        }
        if (!center || !Number.isFinite(center[0]) || !Number.isFinite(center[1]) || (!center[0] && !center[1])) {
          setError(t('门店未设置经纬度，请先在门店信息中完善地址'));
          return;
        }
        const AMap = await loadAmap(String(settings?.amapJsKey), String(settings?.amapJsSecret || ''));
        if (disposed || !containerRef.current) return;
        const map = new AMap.Map(containerRef.current, {
          center,
          zoom: 14,
          viewMode: '2D',
        });
        mapRef.current = map;
        const circle = new AMap.Circle({
          center,
          radius: Math.max(Number(radius) || 1000, 1),
          strokeColor: '#165dff',
          strokeWeight: 2,
          strokeOpacity: 0.8,
          strokeStyle: 'dashed',
          fillColor: '#165dff',
          fillOpacity: 0.08,
        });
        map.add(circle);
        circleRef.current = circle;
        map.setFitView([circle]);
        const editor = new AMap.CircleEditor(map, circle);
        editor.open();
        const syncRadius = () => {
          const next = Math.round(Number(circle.getRadius()) || 0);
          if (next > 0) onChangeRadius(next);
        };
        editor.on('adjust', syncRadius);
        editor.on('end', syncRadius);
        editorRef.current = editor;
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : t('地图加载失败'));
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    void init();
    return () => {
      disposed = true;
      editorRef.current?.close?.();
      editorRef.current = null;
      circleRef.current = null;
      mapRef.current?.destroy?.();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.[0], center?.[1]]);

  useEffect(() => {
    if (circleRef.current && radius > 0) {
      circleRef.current.setRadius(radius);
    }
  }, [radius]);

  return (
    <div className="delivery-radius-map">
      {loading && (
        <div className="delivery-radius-map__state">
          <Spin />
        </div>
      )}
      {!loading && error && (
        <div className="delivery-radius-map__state">
          <span className="delivery-radius-map__icon"><IconMapPin /></span>
          <Text type="tertiary">{error}</Text>
        </div>
      )}
      <div ref={containerRef} className="delivery-radius-map__canvas" style={{ display: error ? 'none' : 'block' }} />
    </div>
  );
}
