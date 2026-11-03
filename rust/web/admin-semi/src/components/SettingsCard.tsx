import type { ReactNode } from 'react';
import { Card } from '@douyinfe/semi-ui';

export default function SettingsCard({
  icon,
  title,
  description,
  count,
  children,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  count?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card
      className="base-settings-card"
      title={
        <div className="base-settings-card__title">
          {icon ? <span className="base-settings-card__icon">{icon}</span> : null}
          <span className="base-settings-card__title-text">
            <strong>{title}</strong>
            {description ? <small>{description}</small> : null}
          </span>
        </div>
      }
      headerExtraContent={
        count ? <span className="base-settings-card__count">{count}</span> : null
      }
    >
      {children}
    </Card>
  );
}
