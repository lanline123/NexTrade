import { getContextHeaders, getToken } from './api';

export interface AdminMsgCount {
  imMsgCount: number;
  customerMsgCount: number;
  orderCount: number;
  unreadMsgCount: number;
  paidOrderCount: number;
  aftersaleCount: number;
  cancelOrderCount: number;
  newOrderMsgCount: number;
  paidOrderMsgCount: number;
  aftersaleMsgCount: number;
  cancelOrderMsgCount: number;
  ts: number;
  version: number;
  adminId: number;
}

interface StreamOptions {
  onCount: (count: AdminMsgCount) => void;
  onError?: (error: unknown) => void;
}

const COUNT_PATH = '/adminapi/msg/adminMsg/msgCount';

function readStartTime(): string {
  return localStorage.getItem('lastOpenTime') || '';
}

export async function fetchUnreadSummary(): Promise<number | null> {
  try {
    const response = await fetch('/adminapi/msg/adminMsg/homeSummary', {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        ...getContextHeaders(),
      },
    });
    if (!response.ok) return null;
    const json = await response.json();
    const count = Number(json?.data?.unreadCount);
    return Number.isFinite(count) ? count : null;
  } catch {
    return null;
  }
}

export async function fetchAdminMsgCount(): Promise<AdminMsgCount | null> {
  const response = await fetch(`${COUNT_PATH}?startTime=${readStartTime()}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      ...getContextHeaders(),
    },
  });
  if (!response.ok) return null;
  const json = await response.json();
  return (json?.data as AdminMsgCount) || null;
}

/**
 * 管理端消息计数 SSE。
 * EventSource 无法携带 Authorization，所以这里用 fetch 流实现，
 * 与跨境版 MsgCount.vue 的做法一致。
 */
export function startAdminMsgStream({ onCount, onError }: StreamOptions): () => void {
  let closed = false;
  let controller: AbortController | null = null;
  let retryTimer: number | null = null;

  const scheduleReconnect = () => {
    if (closed) return;
    retryTimer = window.setTimeout(() => {
      if (!closed) void connect();
    }, 5000);
  };

  const connect = async () => {
    if (closed) return;
    controller?.abort();
    const current = new AbortController();
    controller = current;

    try {
      const response = await fetch(`${COUNT_PATH}?startTime=${readStartTime()}`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
          ...getContextHeaders(),
        },
        signal: current.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`消息 SSE 连接失败：${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!closed && !current.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE 以空行分帧；fetch 流可能把一帧拆成多个 chunk
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() || '';
        for (const frame of frames) {
          const dataLines = frame
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim());
          if (!dataLines.length) continue;
          const raw = dataLines.join('\n');
          try {
            const payload = JSON.parse(raw);
            if (payload?.code === 0 && payload?.data) {
              onCount(payload.data as AdminMsgCount);
            }
          } catch (error) {
            onError?.(error);
          }
        }
      }
      if (!closed) scheduleReconnect();
    } catch (error) {
      if (current.signal.aborted || closed) return;
      onError?.(error);
      scheduleReconnect();
    }
  };

  void connect();

  return () => {
    closed = true;
    if (retryTimer !== null) window.clearTimeout(retryTimer);
    controller?.abort();
    controller = null;
  };
}
