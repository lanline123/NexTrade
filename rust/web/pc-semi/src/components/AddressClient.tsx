'use client';

/**
 * 收货地址管理（对照旧版 `view/pc/pages/member/address/List.vue` + `EditRegion.vue`）。
 *
 * 视觉/结构对齐原版：
 * - 内容区白底圆角 8px，标题行 72px 高（「地址」18px 粗体 + 白底红边「添加新地址」）；
 * - 两列卡片网格（gap 8px），卡片边框 1px #e0e1e5、padding 15px、圆角 4px，
 *   默认地址卡片边框跟随主题色（--main-bg）；
 * - 卡内：收货人 / 手机号（无效地址标记）、地区+详细地址（两行省略）、邮箱 / 固定电话、
 *   「默认地址」方形勾选 + 编辑 / 删除图标；
 * - 分页右对齐、「暂无收货地址」空状态图（/assets/images/empty-box.png）；
 * - 新增 / 编辑弹窗：收货人、所在地区、详细地址、手机号码、固定电话、邮箱地址，
 *   底部「确认修改地址 / 取消」。
 *
 * 弹窗拆分：新增 / 编辑表单已抽到独立组件
 * `MemberAddressDialog`（源码对照 components/member/address/DialogEditRegion.vue），
 * 删除二次确认用 `MemberDeleteConfirm`（源码对照 components/member/DeleteRecord.vue）。
 *
 * 数据接口（对齐旧版 api/user/address.ts）：
 * - GET  user/address/list     列表
 * - GET  user/address/detail   编辑回显（?id=）
 * - POST user/address/create   新增
 * - POST user/address/update   修改
 * - POST user/address/setSelected 设为默认
 * - POST user/address/del      删除
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import Edit from '@icon-park/react/es/icons/Edit';
import Delete from '@icon-park/react/es/icons/Delete';
import Plus from '@icon-park/react/es/icons/Plus';
import { apiGet, apiPost } from '@/lib/client-api';
import MemberAddressDialog from '@/components/MemberAddressDialog';
import MemberDeleteConfirm from '@/components/MemberDeleteConfirm';

import { useTranslation } from 'react-i18next';
interface Address {
  addressId: number;
  consignee?: string;
  mobile?: string;
  mobileAreaCode?: string;
  telephone?: string;
  email?: string;
  regionName?: string;
  regionNames?: string[];
  regionIds?: number[];
  address?: string;
  formattedAddress?: string;
  fullAddress?: string;
  isSelected?: number;
  isDefault?: number;
  isInvalid?: number;
}

const PAGE_SIZE = 10;

export default function AddressClient() {
    const { t } = useTranslation();
    const [rows, setRows] = useState<Address[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [needLogin, setNeedLogin] = useState(false);
    /** 新增 / 编辑弹窗可见性 */
    const [open, setOpen] = useState(false);
    /** 0 = 新增；>0 = 编辑 */
    const [editingId, setEditingId] = useState(0);
    /** 删除确认弹窗 */
    const [deleteId, setDeleteId] = useState(0);

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const load = (nextPage = page) => {
        setLoading(true);
        apiGet<{ records?: Address[]; total?: number }>('user/address/list', { page: nextPage, size: PAGE_SIZE })
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

    useEffect(() => {
        load(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const goPage = (nextPage: number) => {
        setPage(nextPage);
        load(nextPage);
    };

    const openCreate = () => {
        setEditingId(0);
        setOpen(true);
    };

    const openEdit = (address: Address) => {
        setEditingId(address.addressId);
        setOpen(true);
    };

    const setDefault = async (addressId: number) => {
        try {
            await apiPost('user/address/setSelected', { id: addressId });
            Toast.success({ content: '操作成功' });
            load(page);
        } catch (error) {
            Toast.error({ content: error instanceof Error ? error.message : '设置失败' });
        }
    };

    const remove = async () => {
        if (!deleteId) return;
        try {
            await apiPost('user/address/del', { id: deleteId });
            Toast.success({ content: '删除成功' });
            setDeleteId(0);
            const nextPage = rows.length === 1 && page > 1 ? page - 1 : page;
            setPage(nextPage);
            load(nextPage);
        } catch (error) {
            Toast.error({ content: error instanceof Error ? error.message : '删除失败' });
        }
    };

    const regionText = (address: Address) => {
        if (address.formattedAddress) return address.formattedAddress;
        if (address.fullAddress) return address.fullAddress;
        const names = (address.regionNames || []).join(' ') || address.regionName || '';
        return [names, address.address].filter(Boolean).join(' ');
    };

    const pageNumbers = (): number[] => {
        if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
        const start = Math.max(1, Math.min(page - 2, pages - 4));
        return Array.from({ length: 5 }, (_, index) => start + index);
    };

    if (needLogin) {
        return (
            <div className="member-address__login-state">
                <h2>{t('登录后管理收货地址')}</h2>
                <p>{t('请先登录账号再添加或修改地址。')}</p>
                <Link href="/login?redirect=/member/address">
                    <Button theme="solid" type="primary" size="large">{t('去登录')}</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="info-row mp-address-list">
            <div className="title-or-tabs">
                <span className="card-title">{t('地址')}</span>
                <Button className="btn new-address" icon={<Plus size={14} />} onClick={openCreate}>{t('添加新地址')}</Button>
            </div>

            <div className="address-info">
                <div className="card-list">
                    {loading ? (
                        <div className="no-result">{t('加载中...')}</div>
                    ) : rows.length ? (
                        <>
                            {rows.map((address) => {
                                const selected = Number(address.isSelected) === 1;
                                return (
                                    <ul key={address.addressId} className={`card${selected ? ' selected' : ''}`}>
                                        <li className="first">
                                            <div className="top-info">
                                                <div className="name">{address.consignee || '-'}</div>
                                                <div className="mobile">
                                                    <span>
                                                        {address.mobileAreaCode ? `+${address.mobileAreaCode} ` : ''}
                                                        {address.mobile || '-'}
                                                    </span>
                                                    {Number(address.isInvalid) === 1 ? <span className="invalid-tag">{t('无效地址')}</span> : null}
                                                </div>
                                            </div>
                                            <div className="address">{regionText(address) || '-'}</div>
                                            <div className="other">
                                                <div>{address.email || '-'}</div>
                                                <div>{address.telephone || '-'}</div>
                                            </div>
                                            <div className="bottom-operation">
                                                <div className="is-default">
                                                    <button
                                                        type="button"
                                                        className={`mp-checkbox${selected ? ' is-checked' : ''}`}
                                                        aria-pressed={selected}
                                                        onClick={() => {
                                                            if (!selected) void setDefault(address.addressId);
                                                        }}
                                                    >
                                                        <span className="mp-checkbox__box" aria-hidden="true" />
                                                        <span className="mp-checkbox__label">{t('默认地址')}</span>
                                                    </button>
                                                </div>
                                                <div className="operation">
                                                    <button type="button" className="btn-link" title={t('编辑')} aria-label={t('编辑')} onClick={() => openEdit(address)}>
                                                        <Edit size={20} />
                                                    </button>
                                                    <button type="button" className="btn-link" title={t('删除')} aria-label={t('删除')} onClick={() => setDeleteId(address.addressId)}>
                                                        <Delete size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    </ul>
                                );
                            })}
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
                            <img className="empty-img" src="/assets/images/empty-box.png" alt="" />
                            <div className="empty-text">{t('暂无收货地址')}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* 新增 / 编辑收货地址（DialogEditRegion + EditRegion 对照） */}
            <MemberAddressDialog
                visible={open}
                addressId={editingId}
                onClose={() => setOpen(false)}
                onSuccess={() => load(page)}
            />

            {/* 删除地址二次确认（DeleteRecord 对照） */}
            <MemberDeleteConfirm
                visible={Boolean(deleteId)}
                text={t('您确认要删除该地址吗？')}
                onCancel={() => setDeleteId(0)}
                onConfirm={remove}
            />
        </div>
    );
}
