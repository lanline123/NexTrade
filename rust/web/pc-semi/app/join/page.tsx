import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeaderWithData';
import PcFooter from '@/components/PcFooter';
import { getJoinData, getPcHeader, type JoinNavItem } from '@/lib/api';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';

/**
 * 招商入驻首页。
 * 源码对照：view/pc/pages/join/index.vue（<template> 类名逐条照抄）
 * 样式：app/join-page.scss → .pg-join-index
 *
 * 结构：
 *   .banner-warp（轮播图）
 *   .zs-info   > .container > h2.com__title + .zs-info__wrap > .cooperation-col × 4
 *   .ms-info   > .container > h2.com__title + .mode-list(.mode-col.mode-1/.mode-2) + .mode-detail > .mode-detail-content
 */
interface PageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

function read(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
    title: t('招商入驻 · 万物新生'),
    description: t('招商计划、合作模式、招商标准与入驻入口。'),
  };
}

export default async function JoinPage({ searchParams }: PageProps) {
  const t = getServerT();
  const [items, header] = await Promise.all([
    getJoinData().catch(() => [] as JoinNavItem[]),
    getPcHeader().catch(() => null),
  ]);
  const banner = items[0];
  const platformMode = items[1];
  const selfMode = items[2];
  const tab = read(searchParams?.mode) === '2' ? 2 : 1;
  const active = tab === 2 ? selfMode : platformMode;

  const COOPERATION = [
    {
      imageClass: 'plan',
      title: t('招商计划'),
      desc: t('查询发布的热招类目和品牌'),
      button: t('查看招商计划'),
      href: '/join/plan',
      primary: false,
    },
    {
      imageClass: 'mode',
      title: t('合作模式'),
      desc: `${t('了解可以合作那些模式，各模式的优势和区别')}。`,
      button: t('查看合作模式'),
      href: '/join?mode=1#mode',
      primary: false,
    },
    {
      imageClass: 'standard',
      title: t('招商标准'),
      desc: t('查询自身行业所需要提交的资质'),
      button: t('查看招商标准'),
      href: '/join/standard',
      primary: false,
    },
    {
      imageClass: 'join',
      title: t('我要入驻'),
      desc: t('我已了解所有内容，需要立即入驻'),
      button: t('立即入驻'),
      href: '/join/intro',
      primary: true,
    },
  ];

  return (
    <div className="pg-join-index">
      <PcHeader config={header as any} />
      {/* 旧版 CommonHeader(title="招商入驻") + joinHeader：招商专用头部导航见 /join/joinheader */}
      <div className="banner-warp">
        {banner?.images?.length ? (
          <ul className="banner-list">
            {banner.images.map((image, index) => (
              <li key={index}>
                <a href={image.picLink || '#'} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="item-img" src={image.picUrl || image.picThumb || ''} alt={banner.title || t('招商 Banner')} />
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="zs-info">
        <div className="container">
          <h2 className="com__title">{t('我要合作')}</h2>
          <div className="zs-info__wrap">
            {COOPERATION.map((item) => (
              <div className="cooperation-col" key={item.imageClass}>
                <div className={`cooperation-image ${item.imageClass}`} />
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
                <Link href={item.href} className={`cooperation-button${item.primary ? ' active' : ''}`} target="_blank">
                  {item.button}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ms-info" id="mode">
        <div className="container">
          <h2 className="com__title">{t('我要合作')}</h2>
          <div className="mode-list">
            <Link href="/join?mode=1#mode" className={`mode-col mode-1${tab === 1 ? ' current' : ''}`}>
              <span>{t('平台模式')}</span>
            </Link>
            <Link href="/join?mode=2#mode" className={`mode-col mode-2${tab === 2 ? ' current' : ''}`}>
              <span>{t('自营模式')}</span>
            </Link>
          </div>
          <div className="mode-detail">
            <div className="mode-detail-content">
              <div className="mode-detail-pic">
                {active?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={active.image} alt={active.title || ''} />
                ) : null}
              </div>
              <h3>{active?.title}</h3>
              <span className="content" dangerouslySetInnerHTML={{ __html: active?.content || '' }} />
              <Link href="/" className="learn-more">
                {t('了解详情')}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <PcFooter />
    </div>
  );
}
