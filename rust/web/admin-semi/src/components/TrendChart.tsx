import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useI18n } from '../i18n';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

interface TrendChartProps {
  data?: number[];
  labels?: string[];
  height?: number;
  name?: string;
  yAxisPrefix?: string;
  /** 线条/面积主色（默认主题蓝 #165dff） */
  color?: string;
  /** 数值单位：追加在 tooltip 数值与 y 轴标签之后（如 '万'、'件'）。缺省时 ¥ 前缀按旧行为追加 '万'，显式传 '' 可关闭 */
  unit?: string;
  /** 是否显示底部图例 */
  legend?: boolean;
}

export default function TrendChart({
  data = [18.2, 22.6, 20.4, 28.8, 25.2, 34.6, 31.8],
  labels,
  height = 268,
  name,
  yAxisPrefix = '¥',
  color = '#165dff',
  unit,
  legend = false,
}: TrendChartProps) {
  const { t } = useI18n();
  const resolvedLabels = labels ?? [
    t('周一'),
    t('周二'),
    t('周三'),
    t('周四'),
    t('周五'),
    t('周六'),
    t('周日'),
  ];
  const resolvedName = name ?? t('成交额');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const resolvedUnit = unit !== undefined ? unit : yAxisPrefix === '¥' ? t('万') : '';
    const chart = echarts.init(containerRef.current);
    chart.setOption({
      grid: { left: 8, right: 16, top: 24, bottom: legend ? 30 : 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1c1f23',
        borderWidth: 0,
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: (params: any) => {
          const item = Array.isArray(params) ? params[0] : params;
          const valueText = `${yAxisPrefix === '¥' ? '¥ ' : ''}${item.value}${resolvedUnit ? ' ' + resolvedUnit : ''}`;
          return `${item.axisValue}<br/>${resolvedName}：${valueText}`;
        },
      },
      legend: legend
        ? { data: [resolvedName], left: 'center', bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: '#8a94a6' } }
        : undefined,
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: resolvedLabels,
        axisLine: { lineStyle: { color: '#e5e9f0' } },
        axisTick: { show: false },
        axisLabel: { color: '#8a94a6', fontSize: 12, margin: 14 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#eef1f6', type: 'dashed' } },
        axisLabel: {
          color: '#8a94a6',
          fontSize: 12,
          formatter:
            unit !== undefined
              ? `${yAxisPrefix}{value}${unit}`
              : yAxisPrefix === '¥'
                ? `${yAxisPrefix}{value}${t('万')}`
                : '{value}',
        },
      },
      series: [
        {
          name: resolvedName,
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          showSymbol: false,
          data,
          lineStyle: { width: 3, color },
          itemStyle: { color, borderColor: '#fff', borderWidth: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: `${color}47` },
              { offset: 1, color: `${color}05` },
            ]),
          },
        },
      ],
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [data, labels, name, yAxisPrefix, color, unit, legend, t]);

  return <div ref={containerRef} style={{ width: '100%', height }} />;
}
