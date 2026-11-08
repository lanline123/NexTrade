'use client';

/**
 * 帮助中心「自助服务」的 8 个图标。
 *
 * 旧版（view/pc/pages/article/issue/Index.vue:264-294）用的是切图
 * `/assets/images/help/selfS_{ones,twos,...,eights}.png`（65×65 透明底）：
 *   发货物流 / 退货退款 / 售后进度 / 手机号修改 / 订单评价 / 密码修改 / 积分查询 / 优惠券查询
 * 仓库里没有这些 png，也不便新增二进制资源，这里改用项目已有的 @icon-park/react
 * （与头部搜索框同一个图标库）挑语义最接近的线性图标，尺寸/描边按旧图块比例放大。
 *
 * 客户端组件的原因：icon-park 的图标内部用 React context 取默认配置，
 * 不能在 Server Component 里直接渲染，所以单独包一层。
 */
import Truck from '@icon-park/react/es/icons/Truck';
import Return from '@icon-park/react/es/icons/Return';
import Timeline from '@icon-park/react/es/icons/Timeline';
import Phone from '@icon-park/react/es/icons/Phone';
import Comment from '@icon-park/react/es/icons/Comment';
import Lock from '@icon-park/react/es/icons/Lock';
import Wallet from '@icon-park/react/es/icons/Wallet';
import Coupon from '@icon-park/react/es/icons/Coupon';

export type SelfServiceIconName =
  | 'logistics'
  | 'refund'
  | 'after-sale'
  | 'phone'
  | 'comment'
  | 'password'
  | 'point'
  | 'coupon';

const ICONS = {
  logistics: Truck,
  refund: Return,
  'after-sale': Timeline,
  phone: Phone,
  comment: Comment,
  password: Lock,
  point: Wallet,
  coupon: Coupon,
} as const;

export default function SelfServiceIcon({ name, size = 34 }: { name: SelfServiceIconName; size?: number }) {
  const Icon = ICONS[name] ?? Truck;
  return (
    <span className="left_info" aria-hidden="true">
      <Icon theme="outline" size={size} strokeWidth={3} fill="currentColor" />
    </span>
  );
}
