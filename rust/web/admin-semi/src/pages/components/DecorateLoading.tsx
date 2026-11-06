import { useI18n } from '../../i18n';

/**
 * 装修编辑器加载态：
 * 骨架屏模拟三栏编辑器结构，中央品牌加载动画提示当前进度。
 */
export default function DecorateLoading({ title }: { title?: string }) {
  const { t } = useI18n();
  const cards = Array.from({ length: 6 });
  const fields = Array.from({ length: 7 });

  return (
    <div className="deco-loading" role="status" aria-live="polite" aria-label={title || t('加载装修数据...')}>
      <div className="deco-loading-top">
        <span className="deco-loading-logo">N</span>
        <span className="deco-loading-bar deco-loading-bar--title" />
        <span className="deco-loading-chip" />
        <span className="deco-loading-chip deco-loading-chip--soft" />
        <span className="deco-loading-top-space" />
        <span className="deco-loading-bar deco-loading-bar--button" />
        <span className="deco-loading-bar deco-loading-bar--button deco-loading-bar--primary" />
      </div>

      <div className="deco-loading-body">
        <aside className="deco-loading-side">
          <div className="deco-loading-side-title">
            <span className="deco-loading-bar deco-loading-bar--side" />
            <span className="deco-loading-dot" />
          </div>
          <div className="deco-loading-grid">
            {cards.map((_, index) => (
              <div className="deco-loading-card" key={index}>
                <span className="deco-loading-card-icon" />
                <span className="deco-loading-card-label" />
              </div>
            ))}
          </div>
        </aside>

        <main className="deco-loading-main">
          <div className="deco-loading-canvas">
            <span className="deco-loading-canvas-bar" />
            <span className="deco-loading-canvas-hero" />
            <div className="deco-loading-canvas-grid">
              {cards.slice(0, 4).map((_, index) => (
                <span className="deco-loading-canvas-tile" key={index} />
              ))}
            </div>
            <span className="deco-loading-canvas-block" />
          </div>
        </main>

        <aside className="deco-loading-props">
          <span className="deco-loading-bar deco-loading-bar--prop-title" />
          <div className="deco-loading-prop-list">
            {fields.map((_, index) => (
              <div className="deco-loading-prop" key={index}>
                <span className="deco-loading-bar deco-loading-bar--prop-label" />
                <span className="deco-loading-bar deco-loading-bar--prop-control" />
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="deco-loading-overlay">
        <div className="deco-loading-dialog">
          <span className="deco-loading-spinner">
            <span className="deco-loading-spinner-core">N</span>
          </span>
          <strong>{title || t('加载装修数据...')}</strong>
          <span className="deco-loading-hint">{t('正在准备画布与模块...')}</span>
        </div>
      </div>
    </div>
  );
}
