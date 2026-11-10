import type { Metadata } from 'next';
import Link from 'next/link';
import MemberAuthGuard from '@/components/MemberAuthGuard';
import GrouponCountdown from '@/components/GrouponCountdown';
import { getGrouponRecordDetail, getShopDetail } from '@/lib/api';

import { getServerT } from '@/i18n/server';
import { formatPrice } from '@/lib/currency';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '邀请好友参团 · 万物新生' };

/**
 * 邀请好友参团。
 * 源码对照：view/pc/pages/joining/groupByInvited.vue（<template> 类名逐条照抄）
 * 样式：app/join-page.scss → .pg-joining-group-by-invited
 *
 *   .page
 *     > .content
 *         > .product-section.card-box > .product-info > .product-image + .product-details
 *         > .group-status-section.card-box > .status-info(.remaining-members/.countdown)
 *                                      + .group-content > .group-content-item × N（或 .empty-state）
 *         > .process-section.card-box > h3.section-title + .group-steps > .group-steps-content
 *         > .store-section.card-box > .store-info > .store-logo + .store-actions
 *     > .bottom-nav > .nav-left > .nav-item × 2 + .nav-right > .el-button
 *
 * 旧版这一页没有站点页头页脚，只有底部操作条，所以这里不挂 PcHeader/PcFooter。
 */
export default async function GroupInvitePage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const t = getServerT();
  const raw = searchParams?.id;
  const recordId = Number(Array.isArray(raw) ? raw[0] : raw) || 0;
  const detail = recordId ? await getGrouponRecordDetail(recordId).catch(() => null) : null;
  const shop = detail?.shopId ? await getShopDetail(Number(detail.shopId)).catch(() => null) : null;
  const joinUsers = detail?.joinUsers || [];
  const joined = Number(detail?.joinNumCount || joinUsers.length || 0);
  const required = Number(detail?.minGroupNum || 0);
  const remain = Math.max(0, required - joined);
  const joinStatus = Number(detail?.joinStatus ?? 0);
  const productHref = `/product/${detail?.productId || ''}?grouponPromotionRecordId=${recordId}`;

  const placeholders = remain > 0 && joinStatus === 1 ? Array.from({ length: remain }) : [];

  return (
    <MemberAuthGuard>
      <div className="pg-joining-group-by-invited">
        <div className="page">
          <div className="content">
            {/* 产品信息区域 */}
            <div className="product-section card-box">
              <div className="product-info">
                <div className="product-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={detail?.grouponImage || detail?.picThumb || ''} alt={detail?.productName || ''} />
                </div>
                <div className="product-details">
                  <div className="product-details-top">
                    <h1 className="product-title">{detail?.productName || t('拼团商品')}</h1>
                    <div className="group-tag">
                      <span className="el-tag tag">
                        {required}
                        {t('人团')}
                      </span>
                      <span className="joined-count">
                        {t('已有')}
                        {joined}
                        {t('人参团')}
                      </span>
                    </div>
                  </div>
                  <div className="price-info">
                    <span className="group-price">
                      {t('拼团价')}:
                      <span className="groupPriceCom">{formatPrice(Number(detail?.minGrouponPrice || 0))}</span>
                    </span>
                    <span className="original-price">
                      <span style={{ fontSize: 16, color: '#999', textDecoration: 'line-through' }}>{formatPrice(Number(detail?.productPrice || 0))}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 拼团状态区域 */}
            <div className="group-status-section card-box">
              <div className="status-info">
                <div className="remaining-members">
                  <span className="remaining-text">
                    <span>{detail?.joinStatusDesc || ''}</span>
                    {joinStatus === 1 ? (
                      <span>
                        ,{t('还差')}
                        <span style={{ color: 'var(--main-bg)' }}>{joined >= required ? 0 : required - joined}</span>
                        {t('人成团')}
                      </span>
                    ) : null}
                  </span>
                </div>
                {joinStatus === 1 && detail?.endTime ? (
                  <div className="countdown">
                    <span className="countdown-text">
                      <GrouponCountdown endTime={detail.endTime as string | number} />
                    </span>
                  </div>
                ) : null}
              </div>

              {joinUsers.length > 0 || required > 0 ? (
                <div className="group-content">
                  {joinUsers.map((user, index) => (
                    <div className="group-content-item" key={`${user.userId || index}`}>
                      <div className="group-content-item-image">
                        <div className="group-content-item-image-img">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={user.avatar || '/assets/images/common/avatar.png'} alt={user.nickname || ''} />
                        </div>
                        {user.leader ? <div className="group-content-item-image-mask">{t('团长')}</div> : null}
                      </div>
                      <div className="group-content-item-bottom">
                        <span>{user.nickname || t('匿名用户')}</span>
                      </div>
                    </div>
                  ))}
                  {placeholders.map((_, index) => (
                    <div className="group-content-item" key={`placeholder-${index}`}>
                      <div className="group-content-item-image">
                        <div className="group-content-item-image-img" />
                      </div>
                      <div className="group-content-item-bottom">
                        <span>{t('待加入')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>{t('暂无拼团数据')}</p>
                </div>
              )}
            </div>

            {/* 拼团流程区域 */}
            <div className="process-section card-box">
              <h3 className="section-title">{t('拼团流程')}</h3>
              <div className="group-steps">
                <div className="group-steps-content">
                  <div className="group-steps-item">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/images/group/group_open.png" alt="" />
                    <span>{t('1.开团/参加')}</span>
                  </div>
                  <span className="step-dots">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </span>
                  <div className="group-steps-item">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/images/group/group_invite.png" alt="" />
                    <span>{t('2.邀友参团')}</span>
                  </div>
                  <span className="step-dots">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </span>
                  <div className="group-steps-item">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/images/group/group_done.png" alt="" />
                    <span>{t('3.人满成团')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 门店信息区域（旧版 shopInfo.shopId !== 0 才出） */}
            {detail?.shopId ? (
              <div className="store-section card-box">
                <div className="store-info">
                  <div className="store-logo">
                    <div className="img-box">
                      {shop?.shopLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={shop.shopLogo} alt="" />
                      ) : (
                        <p>T</p>
                      )}
                    </div>
                    <div className="store-name">{detail.shopTitle || shop?.shopTitle || '--'}</div>
                  </div>
                  <div className="store-actions">
                    <Link href={`/shop/${detail.shopId}`} className="el-button action-btn">
                      <span className="iconfont-pc icon-guanli" />
                      <span>{t('进店逛逛')}</span>
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* 底部导航栏 */}
          <div className="bottom-nav">
            <div className="nav-left">
              <Link href="/member/joining/list" target="_blank">
                <div className="nav-item">
                  <div className="nav-item-img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/images/group/group_snap.png" alt="" />
                  </div>
                  <span>{t('我的拼团')}</span>
                </div>
              </Link>
              {detail?.shopId ? (
                <Link href={`/shop/${detail.shopId}`}>
                  <div className="nav-item">
                    <div className="nav-item-img">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/assets/images/group/group_store.png" alt="" />
                    </div>
                    <span>{t('门店')}</span>
                  </div>
                </Link>
              ) : null}
            </div>
            <div className="nav-right">
              {joinStatus === 1 ? (
                <Link href={productHref} className="el-button el-button--primary" style={{ width: '100%' }}>
                  {t('去参团')}
                </Link>
              ) : (
                <span className="el-button el-button--primary is-disabled" style={{ width: '100%' }}>
                  {t('去参团')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </MemberAuthGuard>
  );
}
