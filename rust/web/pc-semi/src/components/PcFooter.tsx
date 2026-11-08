import Link from 'next/link';
import { getFooterData } from '@/lib/api';
import { imageFormat } from '@/lib/image';
import { navLinkHref, sanitizeLinkUrl } from '@/lib/link';
import CookieSettingsLink from '@/components/CookieSettingsLink';

import { getServerT } from '@/i18n/server';

function articleHref(articleId: unknown): string {
  return `/article/issue/info?articleId=${encodeURIComponent(String(articleId ?? ''))}`;
}

export default async function PcFooter({ showFriendly = false }: { showFriendly?: boolean }) {
    const t = getServerT();
  const { config, bottomNav, friendLinks, helpCategories } = await getFooterData();
  const icp = config?.shopIcpNo as string | undefined;
  const icpUrl = (config?.shopIcpNoUrl as string | undefined) || 'https://beian.miit.gov.cn/';
  const phone = config?.kefuPhone as string | undefined;
  const serviceTime = config?.kefuTime as string | undefined;
  const address = (config?.companyAddress || config?.kefuAddress) as string | undefined;
  const companyTxt = config?.shopCompanyTxt as string | undefined;
  const businessLicense = config?.businessLicense as string | undefined;
  const businessLicenseEnabled = Number(config?.businessLicenseEnabled ?? 1) === 1;
  const businessLicenseType = Array.isArray(config?.businessLicenseType) ? (config.businessLicenseType as string[]) : [];
  const licenseLabel = businessLicenseType.includes('icp') && businessLicenseType.includes('edi')
    ? t('增值电信业务经营许可证(ICP+EDI)：')
    : businessLicenseType.includes('edi')
      ? t('增值电信业务经营许可证(EDI)：')
      : '增值电信业务经营许可证(ICP)：';
  const policeNo = config?.shop110No as string | undefined;
  const policeLink = (config?.shop110Link as string | undefined) || 'https://beian.mps.gov.cn/#/query/webSearch';

  // 技术支持/资质公示图（对齐旧版 PageFooter imgUrl：poweredBy=1 用 poweredByLogo，否则 defaultTechSupport）
  const poweredBy = Number(config?.poweredBy ?? 0);
  const certImgUrl = poweredBy === 1
    ? String(config?.poweredByLogo || '')
    : sanitizeLinkUrl(String(config?.defaultTechSupport || ''));

  return (
    <footer className="pc-footer">
      {/* 语言/货币切换工具条已按需求移除（跨境版原有两个 PcLocaleSelect 并排悬浮在 footer 顶部） */}

      {helpCategories.length ? (
        <div className="pc-footer__help">
          <div className="pc-container pc-footer__help-inner">
            {helpCategories.map((category) => (
              <div key={category.articleCategoryId || category.categorySn} className="pc-footer__help-col">
                <Link href={`/article/issue?categoryId=${encodeURIComponent(String(category.categorySn || ''))}`} className="pc-footer__help-title">
                  {category.articleCategoryName}
                </Link>
                {(category.articles || []).map((article: any) => (
                  <Link key={article.articleId} href={articleHref(article.articleId)} className="pc-footer__help-link">
                    {article.articleTitle}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="pc-footer__bottom">
        <div className="pc-container pc-footer__inner">
          {bottomNav.length ? (
            <nav className="pc-footer__nav">
              {bottomNav.map((item, index) => {
                // 对象型装修链接全量解析 + 协议安全过滤（对齐旧版 CommonLink urlFormat）
                const href = navLinkHref(item) || '/';
                const external = /^https?:\/\//i.test(href);
                return external ? (
                  <a key={item.id || index} href={href} target="_blank" rel="nofollow noreferrer">
                    {item.title}
                  </a>
                ) : (
                  <Link key={item.id || index} href={href}>
                    {item.title}
                  </Link>
                );
              })}
            </nav>
          ) : null}

          {/* Cookie 设置入口（跨境演示站，对齐旧版 PageFooter） */}
          <CookieSettingsLink />

          {showFriendly && friendLinks.length ? (
            <div className="pc-footer__friendly">
              <span>{t('友情链接：')}</span>
              {friendLinks.map((item) => (
                <a key={item.linkId} href={item.linkUrl} target="_blank" rel="nofollow noreferrer">
                  {item.linkTitle}
                </a>
              ))}
            </div>
          ) : null}

          <div className="pc-footer__copy">
            <p>
              {companyTxt ? <span>{companyTxt}｜</span> : null}
              {businessLicenseEnabled && businessLicense ? <span>{licenseLabel}{businessLicense}｜</span> : null}
              {icp ? (
                <a href={icpUrl} target="_blank" rel="nofollow noreferrer">
                  {icp}
                </a>
              ) : null}
              {policeNo ? (
                <>
                  <span>｜</span>
                  <a href={policeLink} target="_blank" rel="nofollow noreferrer">{policeNo}</a>
                </>
              ) : null}
            </p>
            {phone || serviceTime || address ? (
              <p>
                {phone ? <span>客服热线：{phone}</span> : null}
                {serviceTime ? <span>客服时间：{serviceTime}</span> : null}
                {address ? <span>联系地址：{address}</span> : null}
              </p>
            ) : null}
            {companyTxt ? null : <p className="pc-footer__copyright">{t('万物新生 · 退役动力电池循环利用产业服务平台')}</p>}
          </div>

          {certImgUrl ? (
            <div className="pc-footer__cert-img">
              <div
                className="pc-footer__cert-bg"
                style={{ backgroundImage: `url(${imageFormat(certImgUrl)})` }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
