/**
 * 缺失模块 type 批量注册（诚实版：通用预览 + 字段化设置）。
 *
 * 契约对齐 java view/admin editor/modules 的目录与 type 命名：
 * mobileMember / mobilePro / mobileProductDetail / mobilePromotion /
 * mobileCateCenter / mobileLogin / mobileSearch / mobile 基础注释项。
 * 老数据保存的未知字段由模块索引签名透传，不会丢失；此处 defaults 补的是
 * 渲染与编辑所需的关键字段。已注册的同 type 自动跳过（避免与精确移植版冲突）。
 */
import { getModuleDefinition } from '../../contract/moduleRegistry';
import { registerGenericModule, type GenericFieldSpec } from './GenericModule';

const F = {
  title: { key: 'title', label: '模块标题', kind: 'text' } as GenericFieldSpec,
  text: { key: 'text', label: '文本内容', kind: 'textarea' } as GenericFieldSpec,
  desc: { key: 'description', label: '描述文字', kind: 'text' } as GenericFieldSpec,
  pic: { key: 'pic', label: '图片', kind: 'image' } as GenericFieldSpec,
  pics: { key: 'picList', label: '图片组', kind: 'pics' } as GenericFieldSpec,
  count: (n = 6) => ({ key: 'showCount', label: '展示数量', kind: 'number', min: 1, max: 30 } as GenericFieldSpec),
  color: { key: 'backgroundColor', label: '背景颜色', kind: 'color' } as GenericFieldSpec,
  productTitle: { key: 'productTitle', label: '商品标题', kind: 'text' } as GenericFieldSpec,
  price: { key: 'price', label: '商品价格', kind: 'number', min: 0 } as GenericFieldSpec,
  button: { key: 'buttonText', label: '按钮文字', kind: 'text' } as GenericFieldSpec,
  placeholder: { key: 'placeholder', label: '提示文字', kind: 'text' } as GenericFieldSpec,
  nickname: { key: 'nickname', label: '昵称', kind: 'text' } as GenericFieldSpec,
  frame: { key: 'frame', label: '边框设置', kind: 'frame' } as GenericFieldSpec,
};

function reg(
  type: string,
  label: string,
  icon: string,
  url: string,
  kind: 'hero' | 'grid' | 'list' | 'banner' | 'user' | 'detail' | 'search' | 'text',
  defaults: Record<string, any>,
  fields: GenericFieldSpec[],
  order?: number,
) {
  if (getModuleDefinition(type)) return; // 已有精确实现，跳过
  registerGenericModule({
    type,
    label,
    icon: `<i class="h5-mod-ico">${icon}</i>`,
    url,
    platform: 'mobile',
    order,
    previewKind: kind,
    defaults: { isShow: true, ...defaults },
    fields,
  });
}

/* ==================== mobilePromotion 营销 ==================== */
reg('coupon', '优惠券', '🎫', 'mobilePromotion', 'banner', { title: '领券中心', showCount: 3 }, [F.title, F.pics, F.count()], 30);
reg('groupon', '拼团活动', '👥', 'mobilePromotion', 'grid', { title: '拼团专场', showCount: 6, productTitle: '拼团商品' }, [F.title, F.count(), F.productTitle, F.price], 31);
reg('live', '直播', '📺', 'mobilePromotion', 'banner', { title: '正在直播', showCount: 2 }, [F.title, F.pics], 32);
reg('seckill', '限时秒杀', '⚡', 'mobilePromotion', 'grid', { title: '限时秒杀', showCount: 4, productTitle: '秒杀商品' }, [F.title, F.count(), F.productTitle, F.price], 33);
reg('seckill2', '秒杀（样式2）', '⏱️', 'mobilePromotion', 'grid', { title: '秒杀', showCount: 3, productTitle: '秒杀商品' }, [F.title, F.count(), F.productTitle, F.price], 34);
reg('shopInfo', '店铺信息', '🏬', 'mobilePromotion', 'hero', { title: '店铺名称', description: '店铺简介' }, [F.title, F.desc, F.pic], 35);
reg('videoNumber', '视频号', '🎬', 'mobilePromotion', 'banner', { title: '视频号动态', showCount: 3 }, [F.title, F.pics], 36);

/* ==================== mobilePro 高级 ==================== */
reg('banner', '轮播Banner', '🖼️', 'mobilePro', 'hero', { title: '', pic: '', showCount: 1 }, [F.pic, F.pics, F.title], 40);
reg('bannerA2', '轮播Banner(样式2)', '🖼️', 'mobilePro', 'hero', { title: '', pic: '' }, [F.pic, F.title], 41);
reg('categoryNav', '分类导航', '🧭', 'mobilePro', 'banner', { title: '分类导航', showCount: 4 }, [F.title, F.pics, F.count()], 42);
reg('categoryNavA1', '分类导航(样式1)', '🧭', 'mobilePro', 'banner', { title: '分类导航', showCount: 4 }, [F.title, F.pics], 43);
reg('categoryNavA2', '分类导航(样式2)', '🧭', 'mobilePro', 'banner', { title: '分类导航', showCount: 5 }, [F.title, F.pics], 44);
reg('categoryNavA3', '分类导航(样式3)', '🧭', 'mobilePro', 'banner', { title: '分类导航', showCount: 8 }, [F.title, F.pics], 45);
reg('categoryRec', '分类推荐', '🗂️', 'mobilePro', 'grid', { title: '分类推荐', showCount: 6 }, [F.title, F.count()], 46);
reg('categoryRecA1', '分类推荐(样式1)', '🗂️', 'mobilePro', 'grid', { title: '分类推荐', showCount: 4 }, [F.title, F.count()], 47);
reg('comboSuggestions', '组合建议', '💡', 'mobilePro', 'grid', { title: '组合推荐', showCount: 3, productTitle: '组合商品' }, [F.title, F.count(), F.productTitle, F.price], 48);
reg('countdown', '倒计时', '⏰', 'mobilePro', 'hero', { title: '限时活动', description: '距活动结束还有', backgroundColor: '#df4544' }, [F.title, F.desc, F.color, F.pic], 49);
reg('customProduct', '自定义商品', '🛍️', 'mobilePro', 'grid', { title: '', showCount: 6, productTitle: '商品', price: 99 }, [F.title, F.count(), F.productTitle, F.price], 50);
reg('groupSliding', '分组滑动', '滑动分组', 'mobilePro', 'banner', { title: '分组推荐', showCount: 4 }, [F.title, F.count()], 51);
reg('imageShowcase', '图片展示', '🏞️', 'mobilePro', 'hero', { title: '', pic: '' }, [F.pic, F.pics], 52);
reg('imageTextComponent', '图文组件', '📝', 'mobilePro', 'list', { title: '图文详情', showCount: 2, itemTitle: '图文条目' }, [F.title, F.count(), F.pic], 53);
reg('limitedSpecial', '限量特惠', '🔥', 'mobilePro', 'grid', { title: '限量特惠', showCount: 4, productTitle: '特惠商品', price: 59 }, [F.title, F.count(), F.productTitle, F.price], 54);
reg('mixedNotice', '混合公告', '📢', 'mobilePro', 'list', { title: '公告', showCount: 3, itemTitle: '公告条目' }, [F.title, F.count()], 55);
reg('mixedProductDisplay', '混合商品展示', '🧩', 'mobilePro', 'grid', { title: '商品推荐', showCount: 6, productTitle: '商品' }, [F.title, F.count(), F.productTitle, F.price], 56);
reg('newcomerCombo', '新人专享', '🎁', 'mobilePro', 'grid', { title: '新人专享礼包', showCount: 3, productTitle: '专享商品', price: 9.9 }, [F.title, F.count(), F.productTitle, F.price], 57);
reg('noticeA2', '公告(样式2)', '📢', 'mobilePro', 'text', { text: '公告内容', backgroundColor: '#fff7e6' }, [F.text, F.color], 58);
reg('noticeA3', '公告(样式3)', '📢', 'mobilePro', 'text', { text: '公告内容' }, [F.text, F.color], 59);
reg('productA1', '商品(样式A1)', '🛒', 'mobilePro', 'grid', { title: '热销推荐', showCount: 6, productTitle: '商品', price: 128 }, [F.title, F.count(), F.productTitle, F.price, F.pic], 60);
reg('productCarousel', '商品轮播', '🎠', 'mobilePro', 'banner', { title: '商品轮播', showCount: 4, productTitle: '商品', price: 88 }, [F.title, F.count(), F.productTitle, F.price], 61);
reg('productGrouping', '商品分组', '🗃️', 'mobilePro', 'grid', { title: '商品分组', showCount: 6, productTitle: '商品' }, [F.title, F.count()], 62);
reg('productSlide', '商品滑动', '➡️', 'mobilePro', 'banner', { title: '商品推荐', showCount: 3, productTitle: '商品', price: 66 }, [F.title, F.count(), F.productTitle, F.price], 63);
reg('shopTips', '店铺提示', '💬', 'mobilePro', 'text', { text: '店铺公告提示' }, [F.text, F.color], 64);
reg('slideLargeImage', '大图滑动', '🌌', 'mobilePro', 'hero', { title: '', pic: '' }, [F.pic, F.pics], 65);
reg('slidingImage', '图片滑动', '🎞️', 'mobilePro', 'banner', { title: '', showCount: 3 }, [F.pics, F.count()], 66);
reg('specialOffer', '特价专区', '💰', 'mobilePro', 'grid', { title: '特价专区', showCount: 4, productTitle: '特价商品', price: 39 }, [F.title, F.count(), F.productTitle, F.price], 67);
reg('storeNav', '店铺导航', '🧭', 'mobilePro', 'banner', { title: '店铺导航', showCount: 4 }, [F.title, F.pics], 68);
reg('storeOrderCard', '店铺订单卡', '🧾', 'mobilePro', 'list', { title: '我的订单', showCount: 3, itemTitle: '待付款订单' }, [F.title, F.count()], 69);
reg('tagNav', '标签导航', '🏷️', 'mobilePro', 'banner', { title: '标签导航', showCount: 5 }, [F.title, F.count()], 70);

/* ==================== mobileMember 会员页 ==================== */
reg('userInfo', '会员信息', '👤', 'mobileMember', 'user', { nickname: '会员昵称', description: '欢迎回来', showCount: 4 }, [F.nickname, F.desc, F.pic], 80);
reg('userInfoV2', '会员信息(样式2)', '👤', 'mobileMember', 'user', { nickname: '会员昵称', description: '欢迎回来', showCount: 4 }, [F.nickname, F.desc, F.pic], 81);
reg('userInfo3', '会员信息(样式3)', '👤', 'mobileMember', 'user', { nickname: '会员昵称', description: '欢迎回来', showCount: 4 }, [F.nickname, F.desc, F.pic], 82);
reg('orderEntry', '订单入口', '📦', 'mobileMember', 'list', { title: '我的订单', showCount: 4, itemTitle: '待付款' }, [F.title, F.count()], 83);
reg('orderEntryV2', '订单入口(样式2)', '📦', 'mobileMember', 'list', { title: '我的订单', showCount: 4, itemTitle: '待发货' }, [F.title, F.count()], 84);
reg('myWallet', '我的钱包', '👛', 'mobileMember', 'hero', { title: '我的钱包', description: '余额/积分一览' }, [F.title, F.desc], 85);
reg('myWalletV2', '我的钱包(样式2)', '👛', 'mobileMember', 'hero', { title: '我的钱包', description: '余额/积分一览' }, [F.title, F.desc], 86);
reg('adImage', '会员广告图', '🖼️', 'mobileMember', 'hero', { title: '', pic: '' }, [F.pic], 87);
reg('myService', '我的服务', '🛎️', 'mobileMember', 'banner', { title: '我的服务', showCount: 8 }, [F.title, F.count()], 88);
reg('account', '账户信息', '💳', 'mobileMember', 'list', { title: '账户管理', showCount: 3, itemTitle: '账户明细' }, [F.title, F.count()], 89);
reg('fixedFunctionalArea', '固定功能区域', '🧰', 'mobileMember', 'banner', { title: '常用功能', showCount: 4 }, [F.title, F.count()], 90);

/* ==================== mobileProductDetail 商品详情 ==================== */
reg('productDetailA1', '商品详情(样式A1)', '📄', 'mobileProductDetail', 'detail', { productTitle: '商品标题', description: '商品介绍', price: 199, buttonText: '立即购买' }, [F.productTitle, F.desc, F.price, F.button, F.pic], 95);
reg('productDetailA2', '商品详情(样式A2)', '📄', 'mobileProductDetail', 'detail', { productTitle: '商品标题', description: '商品介绍', price: 199, buttonText: '立即购买' }, [F.productTitle, F.desc, F.price, F.button, F.pic], 96);
reg('productDetailA3', '商品详情(样式A3)', '📄', 'mobileProductDetail', 'detail', { productTitle: '商品标题', description: '商品介绍', price: 199, buttonText: '立即购买' }, [F.productTitle, F.desc, F.price, F.button, F.pic], 97);

/* ==================== mobileCateCenter / mobileLogin / mobileSearch ==================== */
reg('cateCenterV1', '分类中心(样式1)', '🗃️', 'mobileCateCenter', 'list', { title: '分类中心', showCount: 5, itemTitle: '分类' }, [F.title, F.count()], 100);
reg('cateCenterV2', '分类中心(样式2)', '🗃️', 'mobileCateCenter', 'list', { title: '分类中心', showCount: 6, itemTitle: '分类' }, [F.title, F.count()], 101);
reg('mobileLogin', '登录入口', '🔑', 'mobileLogin', 'user', { nickname: 'Hi，欢迎登录', description: '登录后享受会员权益' }, [F.nickname, F.desc], 102);
reg('mobileSearchResult', '搜索结果', '🔍', 'mobileSearch', 'search', { placeholder: '搜索商品' }, [F.placeholder], 103);

/* ==================== mobile 基础（老数据兼容） ====================
 * product / product2 / searchBar / searchBar2 / catNav 已精确移植（modules/basic/*），
 * registerGenericModule 对已注册 type 自动跳过，这里不再保留占位注册。 */
