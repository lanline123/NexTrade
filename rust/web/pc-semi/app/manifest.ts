import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '万物新生 · 退役动力电池循环利用产业服务平台',
    short_name: '万物新生',
    description: '退役动力电池循环利用产业服务平台，安全合规、高效协同、绿色循环。',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#165dff',
    icons: [
      {
        src: '/icon.png',
        sizes: '500x500',
        type: 'image/png',
      },
    ],
  };
}
