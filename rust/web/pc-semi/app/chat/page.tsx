import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeaderWithData';
import PcFooter from '@/components/PcFooter';
import ChatClient from '@/components/ChatClient';
import { getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '在线客服 · 万物新生', robots: { index: false, follow: false } };

export default async function ChatPage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <div className="chat-page">
      <PcHeader config={header as any} />
      <main className="chat-main-wrap">
        <div className="pc-container">
          <h1 className="pc-cart-title">在线客服</h1>
          <ChatClient />
        </div>
      </main>
      <PcFooter />
    </div>
  );
}
