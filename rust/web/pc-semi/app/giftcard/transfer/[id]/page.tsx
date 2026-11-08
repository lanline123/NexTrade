import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import GiftCardCard from '@/components/GiftCardCard';
import GiftCardClaimClient from '@/components/GiftCardClaimClient';
import { getGiftCardDetail, getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}

/**
 * 礼品卡转赠领取页。
 * 源码对照：view/pc/pages/giftcard/transfer/[id].vue —— <template> 类名逐条照抄
 * 样式：app/exchange-page.scss → .pg-giftcard-transfer / .pg-giftcard-card / .pg-giftcard-product-item / .pg-giftcard-actions
 *
 *   .info-row > .gift-card-container
 *     > .card-info > .card-wrapper > giftCard(card-size="large", show-actions)   → GiftCardCard
 *     > .use-step.group > .use-step-header.group-header(.line.left/.group-title/.line.right) + .use-step-content
 *         > .use-step-item(.icon > img.img + .text) × 4，之间插 .next-icon > .iconfont-pc.icon-a-gengduo20
 *     > .products.group > .group-header + .group-sub-header + .product-box > div > productItem
 *     > .exchange-flow.group > .group-header + .group-sub-header + .flows
 *         > .flow(1 文字说明) / .flow-second > .flow.flow2 + .flow.flow3 / .flow-third > .flow.flow4
 *   > .flex.align-center.justify-center.actions-container > .actions > giftCardActions(show-transfer=false)
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return { title: t('礼品卡兑换 · 万物新生') };
}

const USE_STEPS = [
  { icon: 'cart', text: '礼品卡下单' },
  { icon: 'exchange', text: '礼品卡兑换' },
  { icon: 'card', text: '输入卡号卡密' },
  { icon: 'product', text: '立即兑换' },
];

export default async function GiftCardTransferPage({ params }: PageProps) {
  const t = getServerT();
  const sn = decodeURIComponent(params.id);
  const [card, header] = await Promise.all([
    getGiftCardDetail(sn).catch(() => null),
    getPcHeader().catch(() => null),
  ]);
  const group = card?.giftCardGroups || {};
  const products = card?.giftCardProducts || group.giftCardProducts || [];

  return (
    <div className="pg-giftcard-transfer">
      <PcHeader config={header as any} />

      <div className="container">
        <div className="info-row">
          <div className="gift-card-container">
            {card ? (
              <div className="card-info">
                <div className="card-wrapper">
                  <div className="pg-giftcard-card">
                    <GiftCardCard
                      cardInfo={{
                        cardNumber: card.cardNumber || sn,
                        cardPassword: (card as any).cardPassword || '',
                        shopTitle: card.shopTitle || '',
                        cardGroupName: card.cardGroupName || (group as { cardGroupName?: string }).cardGroupName || '',
                        expiredTime: card.expiredTime as number | string | undefined,
                      }}
                      cardSize="large"
                      showActions
                      statusText={String(card.statusText || '')}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="use-step group">
              <div className="use-step-header group-header">
                <div className="line left" />
                <div className="group-title">{t('使用方法')}</div>
                <div className="line right" />
              </div>
              <div className="use-step-content">
                {USE_STEPS.map((step, index) => (
                  <div key={step.icon} style={{ display: 'contents' }}>
                    <div className={`use-step-item step-${index + 1}`}>
                      <div className="icon">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="img" src={`/assets/images/giftCard/${step.icon}.png`} alt="" />
                      </div>
                      <div className="text">{t(step.text)}</div>
                    </div>
                    {index < USE_STEPS.length - 1 ? (
                      <div className="next-icon">
                        <div className="iconfont-pc icon-a-gengduo20" />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {products.length ? (
              <div className="products group">
                <div className="group-header">
                  <div className="line left" />
                  <div className="group-title">{t('兑换商品')}</div>
                  <div className="line right" />
                </div>
                <div className="group-sub-header">{t('该兑换卡可兑换商品')}</div>
                <div className="product-box">
                  {products.map((product) => (
                    <div key={product.productId}>
                      <div className="pg-giftcard-product-item">
                        <div className="product-item">
                          <div className="product-img">
                            <Link href={`/product/${product.productId}`} target="_blank">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img className="img" src={product.picUrl || ''} alt={product.productName || ''} loading="lazy" />
                            </Link>
                          </div>
                          <div className="product-info">
                            <Link href={`/product/${product.productId}`} target="_blank">
                              <div className="product-name line1">{product.productName}</div>
                            </Link>
                            <div className="product-price">
                              <span className="product-price-num">¥{Number(product.skuPrice || product.productPrice || 0).toFixed(2)}</span>
                              <div className="product-num">x1</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="exchange-flow group">
              <div className="group-header">
                <div className="line left" />
                <div className="group-title">{t('兑换流程')}</div>
                <div className="line right" />
              </div>
              <div className="group-sub-header">{t('该兑换卡可兑换商品')}</div>
              <div className="flows">
                <div className="flow">
                  <div className="flow-title">
                    <div className="flow-no">1</div>
                    <div className="flow-title-text">{t('购买礼品卡')}</div>
                  </div>
                  <div className="flow-content">
                    <div className="flow-tips">
                      {t('在商城选择所需购买的礼品卡，点击立即购买，并支付订单。 支付成功后，礼品卡需在礼品卡兑换中兑换才可使用')}
                    </div>
                  </div>
                </div>
                <div className="flow-second">
                  <div className="flow flow2">
                    <div className="flow-title">
                      <div className="flow-no">2</div>
                      <div className="flow-title-text">{t('礼品卡兑换')}</div>
                    </div>
                    <div className="flow-content">
                      <div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="img" src="/assets/images/giftCard/flow2.png" alt="" />
                      </div>
                    </div>
                  </div>
                  <div className="flow flow3">
                    <div className="flow-title">
                      <div className="flow-no">3</div>
                      <div className="flow-title-text">{t('使用礼品卡')}</div>
                    </div>
                    <div className="flow-content">
                      <div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="img" src="/assets/images/giftCard/flow3.png" alt="" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flow-third">
                  <div className="flow flow4">
                    <div className="flow-title">
                      <div className="flow-no">4</div>
                      <div className="flow-title-text">{t('礼品卡支付')}</div>
                    </div>
                    <div className="flow-content">
                      <div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="img" src="/assets/images/giftCard/flow4.png" alt="" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* giftCardActions(show-transfer="false")：只有「兑换」按钮 + 弹窗，实际领取交给 GiftCardClaimClient */}
        <div className="flex align-center justify-center actions-container">
          <div className="actions">
            <div className="pg-giftcard-actions">
              <GiftCardClaimClient giftCardSn={sn} isExchange={card?.isExchange} status={card?.status} />
            </div>
          </div>
        </div>
      </div>

      <PcFooter />
    </div>
  );
}
