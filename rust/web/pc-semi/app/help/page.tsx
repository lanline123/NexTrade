import { redirect } from 'next/navigation';

/**
 * /help 是旧版没有的路由（旧版帮助中心就是 /article/issue）。
 * 之前这里是 4 条硬编码 FAQ 的占位页，与旧站内容对不上；
 * 现在统一跳到真正的帮助中心，避免出现第二套内容。
 */
export const dynamic = 'force-dynamic';

export default function HelpRedirectPage(): never {
  redirect('/article/issue');
}
