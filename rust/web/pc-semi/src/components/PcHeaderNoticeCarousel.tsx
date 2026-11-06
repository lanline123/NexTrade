'use client';

/**
 * 顶部条公告轮播（源码：PcHeaderPreview.vue 的 .pc-carousel / PcHeaderTopBarRuntime.vue 同一结构）
 *
 * 行为与源码逐项对齐：
 * - 单组公告 > 1 条时，整组变成固定宽度的竖向滚动模块（.pc-carousel，可视高度 40px，overflow hidden）
 * - 宽度 = 组内最长文案宽度 + 20（最小 150px），不再随文案抖动
 * - 每 3.4s 向上滚动一格：先 0.4s 线性位移，再停留 3s
 * - 末尾追加第一条作为占位，滚到占位后关掉过渡无动画复位到 0，形成无缝循环
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import PcSmartLink from '@/components/PcSmartLink';

export interface HeaderNoticeView {
  pic: string;
  title: string;
  desc: string;
  href: string;
}

/** 单条高度：与顶部条 40px 行高一致，位移步长即 40px */
const ITEM_HEIGHT = 40;
const PAUSE_MS = 3000;
const MOVE_MS = 400;
const INTERVAL_MS = PAUSE_MS + MOVE_MS;
const MIN_WIDTH = 150;

function NoticeContent({
  notice,
  titleColor,
  descColor,
  measure,
}: {
  notice: HeaderNoticeView;
  titleColor: string;
  descColor: string;
  measure?: boolean;
}) {
  return (
    <>
      {notice.pic ? (
        <img className="img" src={notice.pic} alt="" />
      ) : (
        <span className="pc-icon pc-icon--check img" aria-hidden="true" />
      )}
      <div className={`txt${measure ? ' secound-txt' : ''}`}>
        <div className="title" style={{ color: titleColor }}>
          {notice.title}
        </div>
        <div className="sub-title" style={{ color: descColor }}>
          {notice.desc}
        </div>
      </div>
    </>
  );
}

export default function PcHeaderNoticeCarousel({
  notices,
  titleColor,
  descColor,
}: {
  notices: HeaderNoticeView[];
  titleColor: string;
  descColor: string;
}) {
  const count = notices.length;
  const signature = notices.map((item) => `${item.title}|${item.desc}`).join('~');
  const [width, setWidth] = useState(MIN_WIDTH);
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);

  // 追加首条作为占位（无缝循环），文案不一致时重新计算宽度
  const items = count > 1 ? [...notices, notices[0]] : notices;

  useLayoutEffect(() => {
    const root = viewportRef.current;
    if (!root || count <= 1) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('.secound-txt'));
    let maxWidth = MIN_WIDTH;
    nodes.forEach((node) => {
      const value = Math.ceil(node.getBoundingClientRect().width);
      if (value > maxWidth) maxWidth = value;
    });
    setWidth(maxWidth + 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, count]);

  // 定时向上滚动
  useEffect(() => {
    setIndex(0);
    setAnimate(true);
    if (count <= 1) return undefined;
    const timer = window.setInterval(() => {
      setAnimate(true);
      setIndex((prev) => prev + 1);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, signature]);

  // 滚到末尾占位后，关过渡复位到 0
  useEffect(() => {
    if (count <= 1 || index < count) return undefined;
    const timer = window.setTimeout(() => {
      setAnimate(false);
      setIndex(0);
    }, MOVE_MS);
    return () => window.clearTimeout(timer);
  }, [index, count]);

  // 复位落帧后再恢复过渡，避免出现回弹闪动
  useEffect(() => {
    if (animate) return undefined;
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => setAnimate(true));
    });
    return () => {
      window.cancelAnimationFrame(outer);
      if (inner) window.cancelAnimationFrame(inner);
    };
  }, [animate]);

  if (count <= 1) {
    const only = notices[0];
    if (!only) return null;
    const content = <NoticeContent notice={only} titleColor={titleColor} descColor={descColor} />;
    return (
      <div className="tag-wrap-inner">
        {only.href ? <PcSmartLink href={only.href}>{content}</PcSmartLink> : content}
      </div>
    );
  }

  return (
    <div className="pc-carousel" ref={viewportRef} style={{ width: `${width}px` }}>
      <div
        className="pc-carousel__container"
        style={{
          transform: `translateY(-${index * ITEM_HEIGHT}px)`,
          transition: animate ? `transform ${MOVE_MS}ms linear` : 'none',
        }}
      >
        {items.map((notice, itemIndex) => {
          const content = (
            <NoticeContent notice={notice} titleColor={titleColor} descColor={descColor} measure />
          );
          return (
            <div className="pc-carousel__item tag-wrap-inner" key={`${notice.title}-${itemIndex}`} aria-hidden={itemIndex >= count}>
              {notice.href ? <PcSmartLink href={notice.href}>{content}</PcSmartLink> : content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
