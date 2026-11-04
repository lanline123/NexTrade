import type { CSSProperties } from 'react';
import { useI18n } from '../../../i18n';
import './pcNotice.css';

function pickImage(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value.picUrl || value.picThumb || '');
}

export default function PcNoticePreview({ data }: { data: Record<string, any> }) {
  const { t } = useI18n();
  const frame = data.frame || {};
  const text = String(data.text ?? '').trim();
  const icon = pickImage(data.icoPic);
  return (
    <div
      className="dec-pc-notice"
      style={{
        '--dec-box-padding': `${Number(frame.boxPadding ?? 10)}px`,
        '--dec-box-padding-top': `${Number(frame.boxPaddingTop ?? 5)}px`,
        '--dec-box-padding-bottom': `${Number(frame.boxPaddingBottom ?? 5)}px`,
        '--dec-box-radius': `${Number(frame.boxRadius ?? 0)}px`,
        '--dec-bg-color': frame.backgroundColor || '#ffffff',
        '--dec-item-bg-color': frame.itemBackgroundColor || '#fff8e6',
        '--dec-item-height': `${Number(frame.itemHeight ?? 35)}px`,
        '--dec-item-radius': `${Number(frame.itemRadius ?? 4)}px`,
        '--dec-text-color': frame.textColor || '#555555',
      } as CSSProperties}
    >
      <div className="dec-pc-notice__wrapper">
        {!text ? (
          <div className="dec-pc-notice__empty">
            <div className="dec-pc-notice__empty-text">{t('点击添加通知公告')}</div>
          </div>
        ) : (
          <div className="dec-pc-notice__content">
            {icon ? (
              <div className="dec-pc-notice__icon">
                <img className="dec-pc-notice__icon-img" src={icon} alt="" />
              </div>
            ) : null}
            <div className="dec-pc-notice__text" title={text}>{text}</div>
          </div>
        )}
      </div>
    </div>
  );
}
