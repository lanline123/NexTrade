import type { ReactNode } from 'react';

/**
 * PC 商品详情页三套布局（结构级还原，不再靠同一份 DOM 换 CSS 类）。
 *
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/item/src/Product.vue
 *   - 经典版 old      → `.container`          （v-else 分支，第 357 行起）
 *   - 国内标准版 new  → `.container-new`      （v-if="isNewUi"，第 50 行起）
 *   - 跨境简约版 overseas → `.container-overseas`（v-else-if="isOverseasUi"，第 149 行起）
 *
 * 三套布局的**结构差异**（这是不能只用 CSS 变体表达的部分）：
 *
 * | 区块 | old 经典版 | new 国内标准版 | overseas 跨境简约版 |
 * |---|---|---|---|
 * | 头部 | CommonCategoryNavigation 面包屑 | 新版顶部条 + ProductHead | 面包屑 + 社交分享 + 素材下载 |
 * | 商品主体 | 左画廊 / 右信息（普通两栏） | 左画廊 + 详情 Tab / 右 sticky 独立滚动 | 左画廊 + 锚点长滚动 / 右 sticky 独立滚动 |
 * | 详情内容 | 下方 Tab（左侧栏 + 内容） | 左栏下方 Tab | 左栏 5 个锚点区块顺序铺开 |
 * | 购买按钮 | 在右信息区内 | 右栏底部固定 + 全局浮动栏 | 右栏底部固定 |
 * | 推荐位 | 猜你喜欢 | 猜你喜欢 | 精选好物轮播（全宽） |
 *
 * 后台切换：装修 → PC端装修 → 商品页风格（productDetailStyleType 1/2/3），
 * 前台 GET /api/common/config/productDetailStyle 下发，?uiStyle=old|new|overseas 可本地预览。
 */

export interface DetailSection {
  key: string;
  label: string;
  content: ReactNode;
}

/** 由 ProductDetailClient 预渲染好的内容块；布局组件只负责结构编排。 */
export interface ProductBlocks {
  /** 面包屑 / 分类导航 */
  crumb: ReactNode;
  /** 顶部分享至（跨境版） */
  shareSocial: ReactNode;
  /** 店铺信息卡 */
  shopCard: ReactNode;
  /** 商品画廊（主图 + 缩略图） */
  gallery: ReactNode;
  /** 画廊下方：商品编号 / 收藏 / 素材下载（经典版） */
  galleryMeta: ReactNode;
  /** 标签 / 商品名 / 卖点 */
  heading: ReactNode;
  /** 秒杀 / 拼团 / 预售 / 优惠券面板 */
  promos: ReactNode;
  /** 价格 / 优惠标签 / 销量 */
  price: ReactNode;
  /** 规格参数 */
  attrs: ReactNode;
  /** SKU 选择 */
  sku: ReactNode;
  /** B2B 阶梯价 */
  wholesale: ReactNode;
  /** 数量选择 */
  qty: ReactNode;
  /** 购买按钮组 */
  actions: ReactNode;
  /** 提示文案 */
  tips: ReactNode;
  /** 服务说明手风琴 */
  services: ReactNode;
  /** Tab 切换式详情内容（经典版 / 国内标准版） */
  tabs: ReactNode;
  /** 锚点长滚动区块（跨境版） */
  sections: DetailSection[];
  /** 经典版左侧栏（竞品 / 相关文章） */
  sideRail: ReactNode;
  /** 底部推荐位 */
  recommend: ReactNode;
  /** 全局固定购买栏 */
  buybar: ReactNode;
  /** 分享弹窗 */
  shareModal: ReactNode;
}

export type ProductUiStyleKey = 'old' | 'new' | 'overseas';

interface LayoutProps {
  blocks: ProductBlocks;
}

interface OverseasLayoutProps extends LayoutProps {
  activeAnchor: string;
  onAnchorClick: (key: string) => void;
}

/**
 * 经典版（源码 .container，第 357-500 行）
 * CommonCategoryNavigation → product_details 左右两栏 → detail_main 左侧栏 + ProductDetailTabs。
 */
export function ClassicLayout({ blocks }: LayoutProps) {
  return (
    <div className="pdp-style pdp-style-old">
      <div className="pds-container pds-container--old">
        {blocks.crumb}
        {blocks.shopCard}

        <div className="pds-old__product">
          <div className="pds-old__extra">
            {blocks.gallery}
            {blocks.galleryMeta}
          </div>
          <div className="pds-old__details">
            {blocks.heading}
            {blocks.promos}
            {blocks.price}
            {blocks.attrs}
            {blocks.sku}
            {blocks.wholesale}
            {blocks.qty}
            {blocks.actions}
            {blocks.tips}
            {blocks.services}
          </div>
        </div>

        <div className="pds-old__main">
          <aside className="pds-old__side">{blocks.sideRail}</aside>
          <div className="pds-old__tabs">{blocks.tabs}</div>
        </div>

        {blocks.recommend}
      </div>
      {blocks.shareModal}
    </div>
  );
}

/**
 * 国内标准版（源码 .container-new，第 50-147 行）
 * 顶部条 + ProductHead → product_details 左栏（画廊 + ProductDetailNew）/ 右栏 sticky 独立滚动
 * （el-scrollbar max-height calc(100vh - 24px)）→ 右栏底部 FloatBuyBar 购买区。
 */
export function ModernLayout({ blocks }: LayoutProps) {
  return (
    <div className="pdp-style pdp-style-new">
      <div className="pds-new__topbar">
        <div className="pds-new__topbar-inner">
          <span className="pds-new__topbar-brand">商城</span>
          <span className="pds-new__topbar-sep" />
          <span className="pds-new__topbar-label">商品详情</span>
        </div>
      </div>
      <div className="pds-container pds-container--new">
        {blocks.shopCard}

        <div className="pds-new__product">
          <div className="pds-new__left">
            {blocks.gallery}
            <div className="pds-new__tabs">{blocks.tabs}</div>
          </div>
          <div className="pds-new__right">
            <div className="pds-new__scroll">
              <div className="pds-new__details">
                {blocks.heading}
                {blocks.promos}
                {blocks.price}
                {blocks.attrs}
                {blocks.sku}
                {blocks.wholesale}
                {blocks.qty}
                {blocks.tips}
                {blocks.services}
              </div>
            </div>
            <div className="pds-new__actions">{blocks.actions}</div>
          </div>
        </div>

        {blocks.recommend}
      </div>
      {blocks.buybar}
      {blocks.shareModal}
    </div>
  );
}

/**
 * 跨境简约版（源码 .container-overseas，第 149-355 行）
 * flex_csb（分类导航 + 分享至 + 素材下载）→ OverseasShopInfo → product_details：
 *   左 752px：OverseasThumb + 吸顶锚点 Tab + 5 个 goods_desc 长滚动区块
 *   右 496px sticky：独立滚动的 OverseasProductInfo + 底部固定 #overseas-product-buy-actions
 * 末尾 ProdSwiper「精选好物」。
 */
export function OverseasLayout({ blocks, activeAnchor, onAnchorClick }: OverseasLayoutProps) {
  return (
    <div className="pdp-style pdp-style-overseas">
      <div className="pds-container pds-container--overseas">
        <div className="pds-os__top">{blocks.crumb}{blocks.shareSocial}</div>
        {blocks.shopCard}

        <div className="pds-os__product">
          <div className="pds-os__left">
            {blocks.gallery}

            <nav className="pds-os__anchors" aria-label="商品详情锚点">
              {blocks.sections.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  className={activeAnchor === section.key ? 'is-active' : ''}
                  onClick={() => onAnchorClick(section.key)}
                >
                  {section.label}
                </button>
              ))}
            </nav>

            {blocks.sections.map((section) => (
              <section key={section.key} id={`pds-sec-${section.key}`} className="pds-os__section">
                <h2 className="pds-os__section-title">{section.label}</h2>
                {section.content}
              </section>
            ))}
          </div>

          <div className="pds-os__right">
            <div className="pds-os__scroll">
              <div className="pds-os__details">
                {blocks.heading}
                {blocks.promos}
                {blocks.price}
                {blocks.attrs}
                {blocks.sku}
                {blocks.wholesale}
                {blocks.qty}
                {blocks.tips}
                {blocks.services}
              </div>
            </div>
            <div className="pds-os__actions">{blocks.actions}</div>
          </div>
        </div>
      </div>

      {blocks.recommend}
      {blocks.shareModal}
    </div>
  );
}

/** 统一入口：按后台下发的风格选择结构，而不是只换一个 CSS 类。 */
export function ProductLayout({
  uiStyle,
  blocks,
  activeAnchor,
  onAnchorClick,
}: LayoutProps & {
  uiStyle: ProductUiStyleKey;
  activeAnchor: string;
  onAnchorClick: (key: string) => void;
}) {
  if (uiStyle === 'old') return <ClassicLayout blocks={blocks} />;
  if (uiStyle === 'new') return <ModernLayout blocks={blocks} />;
  return <OverseasLayout blocks={blocks} activeAnchor={activeAnchor} onAnchorClick={onAnchorClick} />;
}
