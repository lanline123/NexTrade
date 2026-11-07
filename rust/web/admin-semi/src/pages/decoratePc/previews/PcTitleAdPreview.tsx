/**
 * PC 文本标题模块 - 预览组件（React 迁移自 5.8.61 旧版
 * `view/admin/src/views/decorate/decorate/editor/modules/pcHome/pc-title-ad/Preview.vue`）
 *
 * DOM / class 与旧版逐行对齐：
 *   .dec-pc-title-ad                     外层（CSS 变量驱动背景/圆角/padding）
 *   .dec-pc-title-ad--align-{1|2}        标题位置（居左/居中）
 *   .dec-pc-title-ad--style-{1|2}        标题风格（风格二：描述更突出）
 *   .dec-pc-title-ad__content            内容区（左右 padding）
 *   .dec-pc-title-ad__empty / __wrap / __inner / __left / __title / __desc / __more
 *
 * 标题右侧区（与旧版一致 + 共享标题设置语义）：
 * - `title.showMore === 1` 时渲染右侧区；
 * - `title.moreType === 2`（共享 `titleMore.ts` 的 MORE_TYPE_COUNTDOWN）时渲染
 *   「倒计时」，否则渲染「查看更多 >」；
 * - 倒计时前缀取 `title.countdownLabel`（缺省 t('倒计时')），时间取
 *   `title.countdownEndTime`（支持秒或毫秒，缺省/已结束时展示 00:00:00 预览态）。
 *
 * 说明：5.8.61 旧版 title-ad Preview.vue 仅实现「查看更多」；倒计时为共享标题
 * 设置（`_shared/ModuleTitleSettings.vue` 的 moreType/countdownLabel）能力，
 * 这里按同一语义补齐，样式对齐首页拼团/秒杀模块的 `.countdown-box`。
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useI18n } from '../../../i18n';
import './pcTitleAd.css';

type AnyRecord = Record<string, any>;

interface PcTitleAdConfig {
  title: AnyRecord;
  frame: AnyRecord;
}

/** 旧版 `pcTitleAdDefaults`（逐字段对齐 index.ts 的 title/frame 默认值）。 */
const DEFAULTS: PcTitleAdConfig = {
  title: {
    showTitle: 1,
    titleStyle: 1,
    titleAlign: 1,
    titleBackground: '',
    titleBackground2: '',
    titleBackgroundPic: { picUrl: '', picThumb: '' },
    titleRadius: 0,
    titleText: '标题内容',
    titleColor: '#2a3145',
    descText: '',
    descColor: '#aaaaaa',
    showMore: 0,
    moreType: 1,
    countdownLabel: '',
    moreLink: { link: '', title: '' },
    moreColor: '#969799',
  },
  frame: {
    textColor: '',
    itemBackgroundColor: '',
    backgroundColor: '#ffffff',
    innerPadding: 0,
    itemHeight: 35,
    itemRadius: 3,
    boxRadius: 0,
    boxPadding: 10,
    leftAndRightPadding: 0,
    boxPaddingTop: 5,
    boxPaddingBottom: 5,
  },
};

function mergeConfig(data: AnyRecord | undefined): PcTitleAdConfig {
  const source = data || {};
  return {
    ...DEFAULTS,
    ...source,
    title: { ...DEFAULTS.title, ...(source.title || {}) },
    frame: { ...DEFAULTS.frame, ...(source.frame || {}) },
  } as PcTitleAdConfig;
}

const pad2 = (n: number): string => String(Math.max(0, n)).padStart(2, '0');

/** 倒计时：endMs 为 0 / 已过期时返回全 0（预览占位 00:00:00）。 */
function useCountdown(endMs: number): { days: number; hours: number; minutes: number; seconds: number } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endMs || endMs <= Date.now()) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [endMs]);
  return useMemo(() => {
    if (!endMs || endMs <= now) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    const remain = Math.floor((endMs - now) / 1000);
    return {
      days: Math.floor(remain / 86400),
      hours: Math.floor((remain % 86400) / 3600),
      minutes: Math.floor((remain % 3600) / 60),
      seconds: remain % 60,
    };
  }, [endMs, now]);
}

function formatNum(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export default function PcTitleAdPreview({ data }: { data: Record<string, any> }) {
  const { t } = useI18n();
  const config = mergeConfig(data);
  const title = config.title || {};
  const frame = config.frame || {};

  const hasTitleText = String(title.titleText ?? '').trim().length > 0;

  const align = Number(title.titleAlign ?? 1);
  const titleStyle = Number(title.titleStyle ?? 1);
  const className = [
    'dec-pc-title-ad',
    `dec-pc-title-ad--align-${align}`,
    `dec-pc-title-ad--style-${titleStyle}`,
  ].join(' ');

  const cssVars = {
    '--dec-bg-color': frame.backgroundColor ?? '#ffffff',
    '--dec-box-radius': `${frame.boxRadius ?? 0}px`,
    '--dec-box-padding': `${frame.boxPadding ?? 10}px`,
    '--dec-box-padding-top': `${frame.boxPaddingTop ?? 5}px`,
    '--dec-box-padding-bottom': `${frame.boxPaddingBottom ?? 5}px`,
    '--dec-inner-padding': `${frame.leftAndRightPadding ?? frame.innerPadding ?? 0}px`,
    '--dec-left-right-padding': `${frame.leftAndRightPadding ?? 0}px`,
  } as CSSProperties & Record<string, string>;

  // 标题容器背景：双色渐变 / 单色 / 无
  const bg1 = String(title.titleBackground ?? '');
  const bg2 = String(title.titleBackground2 ?? '');
  const radius = Number(title.titleRadius ?? 0);
  let titleBackground = '';
  if (bg1 && bg2) {
    titleBackground = `linear-gradient(to right, ${bg1}, ${bg2})`;
  } else if (bg1) {
    titleBackground = bg1;
  }
  const titleContainerStyle: CSSProperties = {
    borderRadius: `${Number.isFinite(radius) ? radius : 0}px`,
    background: titleBackground || undefined,
  };

  // 标题右侧区：showMore 总开关 + moreType（1 查看更多 / 2 倒计时）
  const showMore = Number(title.showMore) === 1;
  const moreType = Number(title.moreType ?? 0);
  const isCountdown = showMore && moreType === 2;
  const showMoreLink = showMore && !isCountdown;

  const rawEnd = Number(title.countdownEndTime ?? 0);
  const endMs = rawEnd > 0 ? (rawEnd > 1e12 ? rawEnd : rawEnd * 1000) : 0;
  const countdown = useCountdown(endMs);
  const countdownLabel = String(title.countdownLabel ?? '').trim() || t('倒计时');
  const moreHref = title.moreLink?.link || 'javascript:;';

  return (
    <div className={className} style={cssVars}>
      <div className="dec-pc-title-ad__content">
        {!hasTitleText ? (
          <div className="dec-pc-title-ad__empty">
            <div className="dec-pc-title-ad__empty-text">{t('点击添加标题')}</div>
          </div>
        ) : (
          <div className="dec-pc-title-ad__wrap">
            <div className="dec-pc-title-ad__inner" style={titleContainerStyle}>
              <div className="dec-pc-title-ad__left">
                <div
                  className="dec-pc-title-ad__title"
                  style={{ color: title.titleColor || undefined }}
                >
                  {title.titleText}
                </div>
                {title.descText ? (
                  <div
                    className="dec-pc-title-ad__desc"
                    style={{ color: title.descColor || undefined }}
                  >
                    {title.descText}
                  </div>
                ) : null}
              </div>

              {isCountdown ? (
                <div
                  className="dec-pc-title-ad__countdown"
                  style={{ color: title.moreColor || undefined }}
                >
                  <div className="countdown-box">
                    <span className="countdown-text">{countdownLabel}: </span>
                    {countdown.days > 0 && (
                      <>
                        <span
                          className={`countdown-item${String(countdown.days).length > 2 ? ' days' : ''}`}
                        >
                          {countdown.days}
                        </span>
                        <span className="countdown-separator-text">{t('天')}</span>
                      </>
                    )}
                    <span className="countdown-item">{formatNum(countdown.hours)}</span>
                    <span className="countdown-separator">:</span>
                    <span className="countdown-item">{formatNum(countdown.minutes)}</span>
                    <span className="countdown-separator">:</span>
                    <span className="countdown-item">{formatNum(countdown.seconds)}</span>
                  </div>
                </div>
              ) : showMoreLink ? (
                <a
                  className="dec-pc-title-ad__more"
                  href={moreHref}
                  style={{ color: title.moreColor || undefined }}
                >
                  <span>{t('查看更多')}</span>
                  <span className="dec-pc-title-ad__more-arrow">&gt;</span>
                </a>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
