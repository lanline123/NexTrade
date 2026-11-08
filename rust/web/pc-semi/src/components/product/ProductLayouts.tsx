'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
  /** 跨境版专用：主图右上角的收藏心形（源码 overseas/Thumb.vue:39 .collection） */
  collectButton?: ReactNode;
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
  /** B2B 批量采购 Tab（单品采购 / 批量采购），非 B2B 场景为 null */
  b2bTab?: ReactNode;
  /** 带价附加属性（attr_type=2），无则 null */
  extraAttrBlock?: ReactNode;
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
 *
 * 逐行对照 Product.vue：358 `.container` → 360 CommonCategoryNavigation（crumb）→ 377 `.shop-info`
 * → 380 `.product_details.flex.justify-between`
 *      → 381 `.extra_details` → 382 `.thumb`（ProductThumb）+ 385 `.share_wish.flex`
 *          （386 `.product-number` / 388 `.product-tools` → 390 `.iconfont-pc.collect.ico-color`）
 *      → 400 `.details` → 415 `<div>` → 416 `.product_name` + 428 ProductInfo(`.product_info`)
 * → 454 `.detail_main.flex` → 456 `.lyecs_side`（竞品/相关文章）+ 489 ProductDetailTabs
 *
 * 注意：`.shop-box` / `.btn-box` / `.shareWidth` / `.shareTitle` / `.shareGold` 在旧版里是
 * 被注释掉的模板块（457-477、361-376、387 行），所以这里不渲染。
 */
export function ClassicLayout({ blocks }: LayoutProps) {
  return (
    <div className="pdp-style pdp-style-old mp-item">
      <div className="container">
        {blocks.crumb}
        {blocks.shopCard}

        <div className="product_details flex justify-between">
          <div className="extra_details">
            <div className="thumb">{blocks.gallery}</div>
            {blocks.galleryMeta}
          </div>
          <div className="details">
            <div className="mp-product-info">
              {blocks.heading}
              <div className="product_info">
                {blocks.promos}
                {blocks.price}
                {blocks.b2bTab}
                {/* 旧版 ProductInfo 的 .actions 包裹规格/数量/属性/购买按钮，
                    生成样式（.number-box/.add_cart/.buy-btn）都嵌在 .actions 下 */}
                <div className="actions">
                  {blocks.sku}
                  {blocks.extraAttrBlock}
                  {blocks.attrs}
                  {blocks.wholesale}
                  {blocks.qty}
                  {blocks.actions}
                </div>
                {blocks.tips}
                {blocks.services}
              </div>
            </div>
          </div>
        </div>

        <div className="detail_main flex">
          <div className="lyecs_side">{blocks.sideRail}</div>
          {blocks.tabs}
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
  const { t } = useTranslation();
  return (
    <div className="pdp-style pdp-style-new">
      <div className="pds-new__topbar">
        <div className="pds-new__topbar-inner">
          <span className="pds-new__topbar-brand">{t('商城')}</span>
          <span className="pds-new__topbar-sep" />
          <span className="pds-new__topbar-label">{t('商品详情')}</span>
        </div>
      </div>
      <div className="pds-container pds-container--new container-new">
        {blocks.shopCard}

        <div className="pds-new__product">
          <div className="pds-new__left">
            {blocks.gallery}
            <div className="pds-new__tabs">{blocks.tabs}</div>
          </div>
          <div className="pds-new__right">
            <div className="pds-new__scroll">
              {/* 旧版 container-new 的信息区是 .product_info.new-ui（ProductInfo.vue 根），
                  生成样式挂在 .mp-product-info 下，这里对齐同样的包裹结构 */}
              <div className="pds-new__details mp-product-info">
                <div className="product_info new-ui">
                  {blocks.heading}
                  {blocks.promos}
                  {blocks.price}
                  {/* 原版 ProductInfo.vue 的 .actions 包裹层（规格 / 数量 / 属性 / 服务），
                      core-pages.scss 中 .actions .number-box / .actions .product-sku 等规则
                      都依赖这一层；缺了它数量行会竖排、SKU 与属性间距全丢。 */}
                  <div className="actions">
                    {blocks.attrs}
                    {blocks.b2bTab}
                    {blocks.sku}
                    {blocks.extraAttrBlock}
                    {blocks.wholesale}
                    {blocks.qty}
                    {blocks.tips}
                    {blocks.services}
                  </div>
                </div>
              </div>
            </div>
            <div className="pds-new__actions" id="float-buy-bar">{blocks.actions}</div>
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
  const { t } = useTranslation();
  return (
    <div className="pdp-style pdp-style-overseas">
      <div className="pds-container pds-container--overseas container-overseas">
        <div className="pds-os__top">{blocks.crumb}{blocks.shareSocial}</div>
        {blocks.shopCard}

        <div className="pds-os__product">
          <div className="pds-os__left">
            {/* 源码 overseas/Thumb.vue .flex.image_wid：左侧竖排缩略图 + 624px 主图，
                收藏心形浮在主图右上角，故画廊外层需要定位上下文 */}
            <div className="pds-os__gallery-wrap">
              {blocks.gallery}
              {blocks.collectButton}
            </div>

            <nav className="pds-os__anchors" aria-label={t('商品详情锚点')}>
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
              {/* 旧版 container-overseas 的信息区是独立组件 overseas/ProductInfo.vue（根 .product_info），
                  其样式已由 gen-core-pages 生成到 .mp-product-info-overseas 下，这里对齐包裹结构 */}
              <div className="pds-os__details mp-product-info-overseas">
                <div className="product_info">
                  {blocks.heading}
                  {blocks.promos}
                  {blocks.price}
                  {/* 对齐原版 overseas/ProductInfo.vue 第 258 行 .actions 包裹层：
                      core-pages.scss 的 .actions .number-box{display:flex} 等规则依赖它，
                      缺了会让「数量」标题与步进器上下堆叠。 */}
                  <div className="actions">
                    {blocks.attrs}
                    {blocks.b2bTab}
                    {blocks.sku}
                    {blocks.extraAttrBlock}
                    {blocks.wholesale}
                    {blocks.qty}
                    {blocks.tips}
                    {blocks.services}
                  </div>
                </div>
              </div>
            </div>
            <div className="pds-os__actions" id="overseas-product-buy-actions">{blocks.actions}</div>
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

/**
 * 三套加载骨架（源码 pages/item/src/ProductSkeleton.vue：
 * 第 9 行 new / 第 75 行 overseas / 第 140 行 old 各自独立结构）。
 * 服务端 Suspense 与客户端加载态共用，避免三套版式在等待期显示同一份占位。
 */
export function ProductSkeleton({ uiStyle }: { uiStyle: ProductUiStyleKey }) {
  const bar = (width: string, height = 16) => <div className="pds-skeleton__block" style={{ width, height }} />;
  if (uiStyle === 'new') {
    return (
      <div className="pds-skeleton pds-skeleton--new pdp-style pdp-style-new">
        <div className="pds-new__topbar"><div className="pds-skeleton__row">{bar('180px', 20)}</div></div>
        <div className="pds-skeleton__row" style={{ marginTop: 20 }}>
          <div style={{ flex: 1 }}>{bar('100%', 360)}{bar('70%')}{bar('40%')}</div>
          <div style={{ flex: '0 0 420px' }}>{bar('80%', 28)}{bar('60%')}{bar('100%', 120)}{bar('100%', 44)}</div>
        </div>
      </div>
    );
  }
  if (uiStyle === 'overseas') {
    return (
      <div className="pds-skeleton pds-skeleton--overseas pdp-style pdp-style-overseas">
        {bar('40%', 12)}
        <div className="pds-skeleton__row" style={{ marginTop: 20 }}>
          <div style={{ flex: '0 0 752px' }}>{bar('100%', 460)}{bar('100%', 40)}{bar('100%', 220)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>{bar('90%', 28)}{bar('70%')}{bar('100%', 160)}{bar('100%', 48)}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="pds-skeleton pds-skeleton--old pdp-style pdp-style-old">
      {bar('30%', 12)}
      <div className="pds-skeleton__row" style={{ marginTop: 20 }}>
        <div style={{ flex: '0 0 420px' }}>{bar('100%', 380)}{bar('80%')}</div>
        <div style={{ flex: 1 }}>{bar('90%', 28)}{bar('60%')}{bar('100%', 120)}{bar('100%', 44)}</div>
      </div>
      <div className="pds-skeleton__row" style={{ marginTop: 20 }}>
        <div style={{ flex: '0 0 220px' }}>{bar('100%', 220)}</div>
        <div style={{ flex: 1 }}>{bar('100%', 220)}</div>
      </div>
    </div>
  );
}
