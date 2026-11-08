'use client';

/**
 * 我的优惠券（PC 会员中心）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/coupon/List.vue
 * 卡片：components/member/coupon/CouponCard.vue → 新版 MemberCouponCard.tsx
 *
 * 旧版页面要素（与旧版 DOM 一一对应）：
 * - 标题行 `.title-or-tabs.bw`：card-title「我的优惠券」+ 右侧「领取更多优惠券」
 *   外链（iconfont-pc icon-wodeyouhuiquan 图标 + 文案，新标签页打开 /coupon/list）；
 * - `.coupon-item-list` 两列栅格，CouponCard 直接作栅格子项；
 * - `.el-page` 分页（旧版 filterParams size=10）；
 * - 空态：empty-box.png + 「您还没有优惠券」。
 *
 * 注意：旧版 List.vue 里 import 的 addCoupon / delCoupon / DeleteRecord 以及
 * form.couponSn、addCouponFun 均未被模板使用（死代码，旧版页面没有券码兑换输入框、
 * 也没有删除按钮），新版保持同样的可见行为，不渲染这些入口。
 *
 * 后端契约：
 * - GET /user/coupon/list → PageResult<UserCouponVO>（records/total）；
 *   startDate/endDate 为秒级时间戳，卡片内用 formatDateTime 格式化。
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';
import MemberCouponCard, { MemberCouponCardData } from '@/components/MemberCouponCard';

import { useTranslation } from 'react-i18next';

export default function CouponClient() {
    const { t } = useTranslation();
    const [rows, setRows] = useState<MemberCouponCardData[]>([]);
    const [loading, setLoading] = useState(true);
    const [needLogin, setNeedLogin] = useState(false);
    /** 页码 / 每页条数 / 总数（旧版 filterParams：page=1, size=10） */
    const [page, setPage] = useState(1);
    const [size] = useState(10);
    const [total, setTotal] = useState(0);

    const load = (nextPage = page) => {
        setLoading(true);
        apiGet<{ records?: MemberCouponCardData[]; total?: number }>('user/coupon/list', { page: nextPage, size })
            .then((result) => {
                setRows(result.records || []);
                setTotal(Number(result.total || 0));
            })
            .catch((error) => {
                const message = error instanceof Error ? error.message : '';
                setNeedLogin(message.includes('登录') || message.includes('401'));
            })
            .finally(() => setLoading(false));
    };

    const goPage = (nextPage: number) => {
        setPage(nextPage);
        load(nextPage);
    };

    const pages = Math.max(1, Math.ceil(total / size));

    /** 旧版 Pagination 的页码：最多 5 个，当前页居中 */
    const pageNumbers = () => {
        const count = Math.min(5, pages);
        const start = Math.max(1, Math.min(page - 2, pages - count + 1));
        return Array.from({ length: count }, (_, index) => start + index);
    };

    useEffect(() => {
        load(1);
    }, []);

    if (needLogin) {
        return (
            <Card className="cart-state">
                <h2>{t('登录后查看优惠券')}</h2>
                <Link href="/login?redirect=/member/coupon/list">
                    <Button theme="solid" type="primary" size="large">{t('去登录')}</Button>
                </Link>
            </Card>
        );
    }

    return (
        <div className="info-row mp-coupon-list">
            <div className="title-or-tabs bw">
                <span className="card-title">{t('我的优惠券')}</span>
                <Link href="/coupon/list" target="_blank">
                    <i className="iconfont-pc icon-wodeyouhuiquan" />
                    {t('领取更多优惠券')}
                </Link>
            </div>

            <div className="coupon-list">
                <div className="coupon-item-list">
                    {total > 0 ? (
                        <>
                            {rows.map((coupon) => (
                                <MemberCouponCard key={coupon.id} coupon={coupon} />
                            ))}
                            {pages > 1 ? (
                                <div className="el-page">
                                    <div className="pagination">
                                        <button type="button" disabled={page <= 1} aria-label={t('上一页')} onClick={() => goPage(page - 1)}>
                                            {'<'}
                                        </button>
                                        {pageNumbers().map((number) => (
                                            <button
                                                type="button"
                                                key={number}
                                                className={number === page ? 'is-active' : ''}
                                                onClick={() => goPage(number)}
                                            >
                                                {number}
                                            </button>
                                        ))}
                                        <button type="button" disabled={page >= pages} aria-label={t('下一页')} onClick={() => goPage(page + 1)}>
                                            {'>'}
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <div className="no-result">
                            {loading ? null : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <img className="empty-img" src="/assets/images/empty-box.png" alt="" />
                                    <div className="empty-text">{t('您还没有优惠券')}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
