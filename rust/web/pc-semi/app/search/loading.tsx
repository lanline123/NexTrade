/**
 * /search 首屏骨架屏 —— 照抄旧版 pages/search/components/SearchSkeleton.vue 的模板。
 *
 * 旧版 search.vue 的用法（第 18 / 95 行）：
 *   <div class="container" :class="{ 'container--initial-loading': showInitialSkeleton }">
 *       …商品列表…
 *       <SearchSkeleton v-if="showInitialSkeleton" />
 *   </div>
 *   showInitialSkeleton = 当前 tab 是商品 && 商品列表还没首次加载完
 *
 * 新版是服务端渲染页面，没有“客户端首次加载”这个状态，对应的是 App Router 的
 * loading.tsx（服务端数据还没到时先渲染这一份）。所以这里保留旧版的两层壳
 * .search-page.mp-search > .page-body > .container.container--initial-loading，
 * 里面逐字放 SearchSkeleton.vue 的结构。
 */
export default function SearchLoading() {
  return (
    <main className="search-page mp-search">
      <div className="page-body">
        <div className="container container--initial-loading">
          <div className="search-page-skeleton" aria-hidden="true">
            <div className="search-page-skeleton__category-row">
              {Array.from({ length: 7 }).map((_, index) => (
                <div className="search-page-skeleton__category-card" key={`category-${index}`}>
                  <div className="search-page-skeleton__category-image" />
                  <div className="search-page-skeleton__category-text" />
                </div>
              ))}
            </div>
            <div className="search-page-skeleton__tabs-row">
              <div className="search-page-skeleton__tabs-left">
                <div className="search-page-skeleton__tab" />
                <div className="search-page-skeleton__tab search-page-skeleton__tab--short" />
              </div>
              <div className="search-page-skeleton__pager" />
            </div>
            <div className="search-page-skeleton__sort-row">
              {Array.from({ length: 6 }).map((_, index) => (
                <div className="search-page-skeleton__sort-chip" key={`sort-${index}`} />
              ))}
            </div>
            <div className="search-page-skeleton__goods-grid">
              {Array.from({ length: 8 }).map((_, index) => (
                <div className="search-page-skeleton__goods-card" key={`goods-${index}`}>
                  <div className="search-page-skeleton__goods-image" />
                  <div className="search-page-skeleton__goods-line search-page-skeleton__goods-line--title" />
                  <div className="search-page-skeleton__goods-line" />
                  <div className="search-page-skeleton__goods-line search-page-skeleton__goods-line--short" />
                  <div className="search-page-skeleton__goods-footer">
                    <div className="search-page-skeleton__price" />
                    <div className="search-page-skeleton__button" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
