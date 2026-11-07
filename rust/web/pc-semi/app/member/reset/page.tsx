import type { Metadata } from 'next';

import { getServerT } from '@/i18n/server';
import ResetPasswordClient from '@/components/ResetPasswordClient';

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
  title: t('找回密码 · 万物新生'),
  description: t('通过手机号验证找回并重置密码。'),
};
}

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
