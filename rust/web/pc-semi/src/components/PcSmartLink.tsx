'use client';

/**
 * 站内/站外链接渲染（源码 CommonLink / NuxtLink 行为对齐）
 * - 站内路径用 next/link 客户端跳转
 * - 站外 / 锚点 / mailto / tel 用原生 a（新窗口）
 * - 空链接降级为不可跳转的 a
 */
import Link from 'next/link';

export default function PcSmartLink({
  href,
  className,
  children,
  onClick,
  target,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  target?: string;
}) {
  if (!href || href === '#') {
    return (
      <a className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  if (/^(?:https?:)?\/\//i.test(href) || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return (
      <a className={className} href={href} target={target || '_blank'} rel="noreferrer" onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link className={className} href={href} onClick={onClick}>
      {children}
    </Link>
  );
}
