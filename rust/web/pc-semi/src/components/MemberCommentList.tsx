'use client';

/**
 * 会员评价列表（已评价订单的商品评价卡片流）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/components/member/comment/CommentList.vue
 *
 * 旧版 CommentList.vue 在 pages/member/comment/List.vue 的「已评价」Tab 里渲染：
 * - 每条评价卡片：评价星级（icon-star-N）+ 评价时间 + 评价标签（commentTag）；
 * - 商品缩略图 + 商品名 + 评价正文（content）+ 晒单图片（showPics，可点击预览）；
 * - 客服答复区块（reply.content + reply.addTime）。
 *
 * 后端契约：`GET /user/comment/list`（routes/catalog/comment.rs）返回 CommentVO：
 * commentId / commentRank / content / commentTag[] / showPics[] / replies[] /
 * productName / productSn / picThumb / addTime / username / isAnonymous / avatar。
 */
import Link from 'next/link';
import { Image } from '@douyinfe/semi-ui';

import { useTranslation } from 'react-i18next';

export interface MemberCommentItem {
  commentId?: number;
  productId?: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  commentRank?: number;
  content?: string;
  addTime?: string;
  username?: string;
  isAnonymous?: number;
  avatar?: string;
  commentTag?: string[];
  showPics?: Array<{ picUrl?: string; picThumb?: string }>;
  replies?: Array<{ commentId?: number; content?: string; addTime?: string; kefuName?: string }>;
  kefuName?: string;
}

export default function MemberCommentList({ comments }: { comments: MemberCommentItem[] }) {
  const { t } = useTranslation();

  return (
    <div className="member-comment-list">
      {comments.map((item, index) => {
        const author = Number(item.isAnonymous) === 1 ? t('匿名用户') : item.username || t('会员');
        const pics = (item.showPics || []).map((pic) => pic.picUrl || pic.picThumb || '').filter(Boolean);
        const rank = Math.min(5, Math.max(0, Number(item.commentRank || 0)));
        return (
          <article className="member-comment-list__card" key={item.commentId || index}>
            <header className="member-comment-list__head">
              <div className="member-comment-list__option">
                <span>{t('评价')}：</span>
                <span className={`member-comment-list__star is-${rank}`} aria-label={t('评分 {v} 星', { v: rank })}>
                  {'★'.repeat(rank)}
                  {'☆'.repeat(5 - rank)}
                </span>
                <span className="member-comment-list__time">{item.addTime || ''}</span>
              </div>
              <div className="member-comment-list__tags">
                {(item.commentTag || []).map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </header>
            <div className="member-comment-list__body">
              <Link
                className="member-comment-list__thumb"
                href={item.productId ? `/product/${item.productId}` : '/search'}
                target="_blank"
                title={item.productName || ''}
              >
                <img src={item.picThumb || ''} alt={item.productName || ''} />
              </Link>
              <div className="member-comment-list__main">
                <div className="member-comment-list__product">[{t('商品评论')}] {item.productName || ''}</div>
                {item.content ? <div className="member-comment-list__content">{item.content}</div> : null}
                {pics.length ? (
                  <div className="member-comment-list__pics">
                    {pics.map((src, picIndex) => (
                      <Image
                        key={src + picIndex}
                        className="member-comment-list__pic"
                        src={src}
                        width={80}
                        height={80}
                        preview={{ src: pics, currentIndex: picIndex }}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </div>
                ) : null}
                {(item.replies || []).map((reply, replyIndex) => (
                  <div className="member-comment-list__reply" key={reply.commentId || replyIndex}>
                    <span className="member-comment-list__reply-name">{reply.kefuName || item.kefuName || t('客服答复')}：</span>
                    <span className="member-comment-list__reply-text">{reply.content || ''}</span>
                    <span className="member-comment-list__reply-time">{reply.addTime || ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
