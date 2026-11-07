'use client';

/**
 * 我的优惠券（PC 会员中心）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/coupon/List.vue
 * 卡片：components/member/coupon/CouponCard.vue → 新版 MemberCouponCard.tsx
 * 删除确认：components/member/DeleteRecord.vue → 新版 MemberDeleteConfirm.tsx
 *
 * 旧版页面要素：
 * - 优惠券码手动添加（addCoupon）+ 删除（delCoupon）+ 「领取更多优惠券」外链；
 * - 每张券用 CouponCard 渲染（面额/折扣、名称、有效期、使用状态按钮）。
 *
 * 后端契约：
 * - GET  /user/coupon/list    我已领取的券（routes/marketing/coupon.rs → UserCouponVO）
 * - POST /user/coupon/claim   券码兑换
 * - POST /user/coupon/del     删除已领取券
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';
import MemberCouponCard, { MemberCouponCardData } from '@/components/MemberCouponCard';
import MemberDeleteConfirm from '@/components/MemberDeleteConfirm';

import { useTranslation } from 'react-i18next';

export default function CouponClient() {
    const { t } = useTranslation();
    const [rows, setRows] = useState<MemberCouponCardData[]>([]);
    const [couponSn, setCouponSn] = useState('');
    const [tab, setTab] = useState('all');
    const [loading, setLoading] = useState(true);
    const [needLogin, setNeedLogin] = useState(false);
    /** 待删除的券 id */
    const [deleteId, setDeleteId] = useState(0);

    const load = () => {
        setLoading(true);
        apiGet<{ records?: MemberCouponCardData[] }>('user/coupon/list', { page: 1, size: 20 })
            .then((result) => setRows(result.records || []))
            .catch((error) => {
                const message = error instanceof Error ? error.message : '';
                setNeedLogin(message.includes('登录') || message.includes('401'));
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []);

    const claim = async () => {
        const value = couponSn.trim();
        if (!value) {
            Toast.warning({ content: '请输入优惠券码' });
            return;
        }
        try {
            // 后端 `POST /user/coupon/claim` 的入参是 `UserCouponClaimDTO.couponId`（必填 i32，
            // 见 crates/core/src/models/marketing/coupon.rs），旧版 PC 传的是 `couponSn`，
            // 与 Java `UserCouponClaimParam.couponId` 一致 —— 两者都只认主键。
            // 这里兼容两种输入：纯数字按 couponId 领取，非数字按券码提交（由后端返回参数错误）。
            const numeric = Number(value);
            const payload = Number.isFinite(numeric) && /^\d+$/.test(value)
                ? { couponId: numeric }
                : { couponSn: value };
            await apiPost('user/coupon/claim', payload);
            Toast.success({ content: '领取成功' });
            setCouponSn('');
            load();
        } catch (error) {
            Toast.error({ content: error instanceof Error ? error.message : '领取失败' });
        }
    };

    const couponState = (coupon: MemberCouponCardData): string => {
        const name = coupon.statusName || '';
        if (name.includes('过期')) return 'expired';
        if (name.includes('已使用') || name.includes('使用')) return 'used';
        if (name.includes('未')) return 'unused';
        if (coupon.status === 2) return 'used';
        if (coupon.status === 3) return 'expired';
        return 'unused';
    };

    const visibleRows = rows.filter((coupon) => tab === 'all' || couponState(coupon) === tab);

    const remove = async () => {
        if (!deleteId) return;
        try {
            await apiPost('user/coupon/del', { id: deleteId });
            Toast.success({ content: '删除成功' });
            setDeleteId(0);
            load();
        } catch (error) {
            Toast.error({ content: error instanceof Error ? error.message : '删除失败' });
        }
    };

    if (needLogin) {
        return (
            <Card className="cart-state">
                <h2>{t('登录后查看优惠券')}</h2>
                <Link href="/login?redirect=/member/coupon">
                    <Button theme="solid" type="primary" size="large">{t('去登录')}</Button>
                </Link>
            </Card>
        );
    }

    return (
        <div className="member-coupon">
            <div className="member-coupon__toolbar">
                <div className="member-coupon__claim">
                    <Input value={couponSn} onChange={setCouponSn} placeholder={t('输入优惠券码')} />
                    <Button theme="solid" type="primary" onClick={claim}>{t('兑换')}</Button>
                </div>
                <Link href="/coupon/list">{t('领取更多优惠券 →')}</Link>
            </div>

            <div className="member-coupon__tabs">
                {[
                    { key: 'all', label: '全部' },
                    { key: 'unused', label: '未使用' },
                    { key: 'used', label: '已使用' },
                    { key: 'expired', label: '已过期' },
                ].map((item) => (
                    <button key={item.key} type="button" className={tab === item.key ? 'is-active' : ''} onClick={() => setTab(item.key)}>
                        {item.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <Card className="member-card">{t('优惠券加载中...')}</Card>
            ) : visibleRows.length ? (
                <div className="member-coupon__list">
                    {visibleRows.map((coupon) => (
                        <div className="member-coupon__item" key={coupon.id}>
                            <MemberCouponCard coupon={coupon} />
                            <button type="button" className="member-coupon__del" onClick={() => setDeleteId(coupon.id ?? 0)}>
                                {t('删除')}
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <Card className="member-card">{t('您还没有优惠券')}</Card>
            )}

            {/* 删除优惠券二次确认（DeleteRecord 对照） */}
            <MemberDeleteConfirm
                visible={Boolean(deleteId)}
                text={t('您确认要删除该优惠券吗？')}
                onCancel={() => setDeleteId(0)}
                onConfirm={remove}
            />
        </div>
    );
}
