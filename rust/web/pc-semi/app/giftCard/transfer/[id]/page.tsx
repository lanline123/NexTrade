import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getGiftCardDetail, getPcHeader, type GiftCardInfo } from '@/lib/api';
import GiftCardClaimClient from '@/components/GiftCardClaimClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return { title: '礼品卡兑换 · 万物新生' };
}

export default async function GiftCardTransferPage({ params }: PageProps) {
  const sn = decodeURIComponent(params.id);
  const [card, header] = await Promise.all([
    getGiftCardDetail(sn).catch(() => null),
    getPcHeader().catch(() => null),
  ]);
  const group = card?.giftCardGroups || {};
  const products = card?.giftCardProducts || group.giftCardProducts || [];

  return (
    <div className="giftcard-page">
      <PcHeader config={header as any} />
      <main className="giftcard-main">
        <div className="giftcard-container">
          <section className="giftcard-hero">
            <div className="giftcard-visual">
              <img src={card?.imageUrl || group.imageUrl || ''} alt={card?.cardGroupName || '礼品卡'} />
            </div>
            <div className="giftcard-info">
              <span className="giftcard-tag">礼品卡</span>
              <h1>{card?.cardGroupName || group.cardGroupName || '礼品卡兑换'}</h1>
              <p className="giftcard-sn">卡号：{card?.cardNumber || sn}</p>
              {card?.shopTitle ? <p className="giftcard-shop">适用店铺：{card.shopTitle}</p> : null}
              {card?.expiredTime ? <p className="giftcard-expire">有效期至：{String(card.expiredTime)}</p> : null}
              <GiftCardClaimClient giftCardSn={sn} isExchange={card?.isExchange} status={card?.status} />
            </div>
          </section>

          <section className="giftcard-steps">
            <h2>使用方法</h2>
            <div className="giftcard-steps__row">
              <div><b>1</b><span>礼品卡下单</span></div>
              <div><b>2</b><span>礼品卡兑换</span></div>
              <div><b>3</b><span>输入卡号卡密</span></div>
              <div><b>4</b><span>立即兑换</span></div>
            </div>
          </section>

          {products.length ? (
            <section className="giftcard-products">
              <h2>兑换商品</h2>
              <p className="giftcard-products__sub">该兑换卡可兑换商品</p>
              <div className="giftcard-products__grid">
                {products.map((product) => (
                  <Link key={product.productId} href={`/product/${product.productId}`} className="giftcard-product" target="_blank">
                    <div className="giftcard-product__img"><img src={product.picUrl || ''} alt={product.productName || ''} loading="lazy" /></div>
                    <div className="giftcard-product__name">{product.productName}</div>
                    <div className="giftcard-product__price">¥ {Number(product.skuPrice || product.productPrice || 0).toFixed(2)}</div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>
      <PcFooter />
    </div>
  );
}
