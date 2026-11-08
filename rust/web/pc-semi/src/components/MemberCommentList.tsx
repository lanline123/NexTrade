'use client';

/**
 * 会员评价卡片流（已评价 / 已晒单）—— Semi Design 现代化版
 * 源码对照：view/pc/components/member/comment/CommentList.vue
 *
 * 功能 1:1 保留：星级、评价标签、商品行、评价内容、晒图、客服答复。
 * 现代化：金色图标星级（Semi Rating disabled 态会整体变灰）、评价标签 Tag 化、
 * Semi Image 晒图（内置点击预览，替换原手写遮罩 lightbox）、客服答复浅底块。
 *
 * ⚠️ 保护标记（见 docs/pc-parity-notes.md「现代化保护区」）：本组件是用户指定的
 * Semi 现代化最终形态，请勿在后续轮次中回退为 .mp-comment-card 旧版复刻结构。
 */
import Link from 'next/link';
import { IconStar, IconStarStroked } from '@douyinfe/semi-icons';
import { Image, Tag } from '@douyinfe/semi-ui';

import { useTranslation } from 'react-i18next';

/** 只读星级：实心/描边图标行，保持金色观感 */
function StarRank({ rank }: { rank: number }) {
  return (
    <span className="mcl-stars" aria-label={`${rank}`}>
      {[1, 2, 3, 4, 5].map((star) =>
        star <= rank ? (
          <IconStar key={star} size="small" className="mcl-stars__on" />
        ) : (
          <IconStarStroked key={star} size="small" className="mcl-stars__off" />
        ),
      )}
    </span>
  );
}

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
  reply?: { commentId?: number; content?: string; addTime?: string; kefuName?: string };
  kefuName?: string;
}

export default function MemberCommentList({ comments }: { comments: MemberCommentItem[] }) {
  const { t } = useTranslation();

  return (
    <div className="mcl">
      {comments.map((item, index) => {
        const rank = Math.min(5, Math.max(0, Number(item.commentRank || 0)));
        const pics = (item.showPics || []).map((pic) => pic.picUrl || pic.picThumb || '').filter(Boolean);
        const reply = (item.replies && item.replies[0]) || item.reply;
        return (
          <div className="mcl-card" key={item.commentId || index}>
            {/* 头：商品 + 星级 + 时间 */}
            <div className="mcl-card__head">
              <Link
                className="mcl-card__product"
                href={item.productId ? `/product/${item.productId}` : '/search'}
                target="_blank"
                title={item.productName || ''}
              >
                <img className="mcl-card__pic" src={item.picThumb || ''} alt={item.productName || ''} loading="lazy" />
                <span className="mcl-card__pname">[{t('商品评论')}] {item.productName}</span>
              </Link>
              <div className="mcl-card__meta">
                <StarRank rank={rank} />
                {item.addTime ? <span className="mcl-card__time">{item.addTime}</span> : null}
              </div>
            </div>

            {/* 评价内容 */}
            <div className="mcl-card__body">
              {item.content ? <div className="mcl-card__content">{item.content}</div> : null}
              {(item.commentTag || []).length ? (
                <div className="mcl-card__tags">
                  {(item.commentTag || []).map((tag) => (
                    <Tag size="small" color="grey" key={tag}>{tag}</Tag>
                  ))}
                </div>
              ) : null}
              {pics.length ? (
                <div className="mcl-card__pics">
                  {pics.map((src, picIndex) => (
                    <Image key={`${src}-${picIndex}`} width={80} height={80} src={src} alt="" style={{ borderRadius: 8 }} />
                  ))}
                </div>
              ) : null}
              {reply ? (
                <div className="mcl-card__reply">
                  <span className="mcl-card__reply-name">{t('客服答复')}：</span>
                  <span className="mcl-card__reply-text">{reply.content}</span>
                  {reply.addTime ? <span className="mcl-card__reply-time">{reply.addTime}</span> : null}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
