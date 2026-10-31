'use client';

import PcHeader from '@/components/PcHeader';
import { DecorateRenderer } from '@/decorate/components/modules';
import type { DecorateModule } from '@/decorate/types';

const IMG = 'https://nlatstore.cn-qingdao.oss.aliyuncs.com/img/gallery/202511/1763604611KwC30o8HhzqJ3jOLfI.jpeg';

const MODULES: DecorateModule[] = [
  {
    type: 'pc-notice',
    isShow: true,
    moduleIndex: 1,
    module: { noticeTitle: '平台公告', noticeList: [{ picTitle: '新版 PC 商城装修模块视觉回归' }, { picTitle: '退役动力电池循环利用产业服务平台' }] },
  },
  {
    type: 'pc-image-nav',
    isShow: true,
    moduleIndex: 2,
    module: { items: Array.from({ length: 8 }).map((_, index) => ({ picUrl: IMG, picTitle: `导航 ${index + 1}`, picLink: '/search' })) },
  },
  {
    type: 'pc-home-quick-nav',
    isShow: true,
    moduleIndex: 3,
    module: { items: Array.from({ length: 6 }).map((_, index) => ({ picThumb: IMG, picTitle: `快捷入口 ${index + 1}`, picLink: '/search' })) },
  },
  {
    type: 'pc-image-ad',
    isShow: true,
    moduleIndex: 4,
    module: { picType: 1, picList: [{ picUrl: IMG, picLink: '/search', picTitle: '广告位' }] },
  },
  {
    type: 'pc-group-banner',
    isShow: true,
    moduleIndex: 5,
    module: { banners: [{ picUrl: IMG, picLink: '/search' }, { picUrl: IMG, picLink: '/search' }] },
  },
  {
    type: 'pc-product-group',
    isShow: true,
    moduleIndex: 6,
    module: {
      groupTitle: { showTitle: 1 },
      productGroups: [
        { title: '破碎分选', sourceType: 'productGroup', productGroupId: 23 },
        { title: '湿法冶金', sourceType: 'productGroup', productGroupId: 25 },
      ],
    },
  },
  {
    type: 'pc-home-coupon',
    isShow: true,
    moduleIndex: 7,
    module: { title: '领券中心', desc: '先领券再下单', showTitle: 1 },
  },
  {
    type: 'pc-home-seckill',
    isShow: true,
    moduleIndex: 8,
    module: { title: { titleText: '限时秒杀', descText: '每日限时低价' } },
  },
  {
    type: 'pc-home-groupon',
    isShow: true,
    moduleIndex: 9,
    module: { title: { titleText: '拼团活动', descText: '邀请好友一起拼' } },
  },
];

const CONTRACT_MODULES: DecorateModule[] = [
  {
    type: 'pcBanner',
    isShow: true,
    moduleIndex: 101,
    module: {
      bannerStyle: 1,
      picList: [{ picUrl: IMG, picLink: '/search', picTitle: '主 Banner' }],
      picList2: [{ picUrl: IMG, picLink: '/search', picTitle: '小图' }],
      picList3: [{ picUrl: IMG, picLink: '/search', picTitle: '图标' }],
    },
  },
  {
    type: 'pcBanner2',
    isShow: true,
    moduleIndex: 102,
    module: { picList: [{ picUrl: IMG, picLink: '/search' }, { picUrl: IMG, picLink: '/search' }] },
  },
  {
    type: 'pcGroupBanner',
    isShow: true,
    moduleIndex: 103,
    module: { number: 2, picList: [{ picUrl: IMG, picLink: '/search' }, { picUrl: IMG, picLink: '/search' }] },
  },
  { type: 'pcSeckill', isShow: true, moduleIndex: 104, module: { seckillTitle: '限时秒杀' } },
  { type: 'pcCoupon', isShow: true, moduleIndex: 105, module: {} },
  {
    type: 'pcGroupon',
    isShow: true,
    moduleIndex: 106,
    module: { title: '拼团活动', grouponActivityItem: [] },
  },
  {
    type: 'pcCatProductNormal',
    isShow: true,
    moduleIndex: 107,
    module: { categoryId: 1, title: '分类商品-普通', picList: [{ picUrl: IMG }], picList2: [] },
  },
  {
    type: 'pcCatProductWide',
    isShow: true,
    moduleIndex: 108,
    module: { categoryId: [1], title: '分类商品-宽屏', productIds: [], picList: [{ picUrl: IMG }] },
  },
  {
    type: 'pcCatProductSimple',
    isShow: true,
    moduleIndex: 109,
    module: { title: '分类商品-简约', productSelectType: 1, productCategoryId: 1, productNumber: 4 },
  },
  {
    type: 'pcRecommendProduct',
    isShow: true,
    moduleIndex: 110,
    module: { titleName: '推荐商品', products: { productNumber: 4, productIds: [] } },
  },
  {
    type: 'pcImageAd',
    isShow: true,
    moduleIndex: 111,
    module: { picType: 1, picList: [{ picUrl: IMG, picLink: '/search', picTitle: '图片广告' }] },
  },
  {
    type: 'pcCustomAd1',
    isShow: true,
    moduleIndex: 112,
    module: { picList: [{ picUrl: IMG }], picList2: [{ picUrl: IMG }], picList3: [] },
  },
  {
    type: 'pcCustomAd2',
    isShow: true,
    moduleIndex: 113,
    module: { linkList: [{ linkTitle: '链接一', link: '/search' }], picList: [{ picUrl: IMG }], picList2: [], picList3: [] },
  },
  {
    type: 'pcCategoryNav',
    isShow: true,
    moduleIndex: 114,
    module: { titleName: '热门分类', rowNum: 2 },
  },
  {
    type: 'pcCategoryNav3',
    isShow: true,
    moduleIndex: 115,
    module: { titleText: '分类导航 3', showMore: 1, showMoreText: '查看更多', moreLink: '/search' },
  },
  { type: 'pcCatWide', isShow: true, moduleIndex: 116, module: { catIds: [1, 2] } },
];

const ALL_MODULES = [...MODULES, ...CONTRACT_MODULES];

export default function DecoratePreview() {
  return (
    <>
      <PcHeader />
      <main className="pc-container" style={{ padding: '16px 0 60px' }}>
        <h1 className="pc-cart-title">装修模块视觉回归</h1>
        <DecorateRenderer modules={ALL_MODULES} />
      </main>
    </>
  );
}
