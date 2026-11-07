import type { Metadata } from 'next';
import BindMobilePhoneClient from '@/components/BindMobilePhoneClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '绑定手机 · 万物新生', robots: { index: false, follow: false } };

/** 源码 pages/member/BindMobilePhone.vue */
export default function BindMobilePhonePage() {
  return <BindMobilePhoneClient />;
}
