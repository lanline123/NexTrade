import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeaderWithData';
import PcFooter from '@/components/PcFooter';
import ChatClient from '@/components/ChatClient';
import { getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';

/**
 * 客服聊天页。
 * 源码对照：view/pc/pages/chat/index.vue
 *   .im-page#im-body > .im-container
 *     > ChatList（.chat-list-container）
 *     > .chat-main（.chat-header + ChatMessageList + ChatInput）
 *     > ChatRight（.chat-right-container）
 *     > .im-layout > .im-default-box（未选中会话时的空态）
 * 样式：app/chat-page.scss → .pg-chat-index / .pg-chat-list / .pg-chat-message-list
 *        / .pg-chat-input / .pg-chat-right / .pg-chat-emoji
 * 旧版这一页的 .im-container 是满屏三栏，没有站点页头页脚（PcHeader/PcFooter 之前就已
 * 挂在这里做导航，本轮不动）。
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return { title: t('客服消息 · 万物新生'), description: t('与平台或店铺客服在线沟通。') };
}

export default async function ChatPage() {
  const header = await getPcHeader().catch(() => null);

  return (
    <>
      <PcHeader config={header as any} />
      <ChatClient />
      <PcFooter />
    </>
  );
}
