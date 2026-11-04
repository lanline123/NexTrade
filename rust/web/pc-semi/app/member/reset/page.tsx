import type { Metadata } from 'next';
import ResetPasswordClient from '@/components/ResetPasswordClient';

export const metadata: Metadata = {
  title: '找回密码 · 万物新生',
  description: '通过手机号验证找回并重置密码。',
};

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
