import type { MetadataRoute } from 'next';

const BASE = (process.env.PC_SITE_URL || 'https://battery.recy.cc').replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/member/',
          '/order/',
          '/cart',
          '/chat',
          '/install',
          '/join/intro',
          '/joining/groupByInvited',
          '/preview/',
          '/oauth/',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
