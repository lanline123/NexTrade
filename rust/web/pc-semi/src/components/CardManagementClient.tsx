'use client';

/**
 * 卡管理（提现账户）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/account/CardManagement.vue
 * 卡片弹窗：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/account/src/InfoCard.vue
 *
 * 旧版字段与交互：
 * - 卡类型 tab（银行卡 / 支付宝 / 微信）；列表列：真实姓名 / 身份证号码 / 账户号码 / 银行卡详情 / 操作；
 * - 新增 / 编辑卡片弹窗（InfoCard.vue）：卡类型、真实姓名（必填）、身份证号（必填 + 正则校验）、
 *   账户号码（必填 + 银行卡号 ≥6 位正则）、银行卡详情（仅银行卡类型）；
 * - 删除走 DeleteRecord.vue 二次确认。
 *
 * 本次补齐的字段（旧版有、新版缺）：
 * - 编辑已绑定的卡（旧版 act="edit" 走 accountDetail 回显 + updateAccount 提交；
 *   Rust 后端 `user/withdrawApply/accountDetail` 与 `user/withdrawApply/updateAccount` 均已实现）。
 *
 * 后端契约：
 * - GET  /user/withdrawApply/list?accountType=  列表
 * - GET  /user/withdrawApply/accountDetail?accountId=  编辑回显
 * - POST /user/withdrawApply/createAccount  新增
 * - POST /user/withdrawApply/updateAccount  修改（必带 accountId）
 * - POST /user/withdrawApply/delAccount    删除
 */
import { useEffect, useState } from 'react';
import { Button, Card, Modal, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';
import MemberDeleteConfirm from '@/components/MemberDeleteConfirm';

import { useTranslation } from 'react-i18next';
interface AccountCard {
  accountId: number;
  accountType: number;
  accountName?: string;
  identity?: string;
  accountNo?: string;
  bankName?: string;
}

const TYPE_LABELS: Record<number, string> = { 1: '银行卡', 2: '支付宝', 3: '微信' };

/** 旧版 InfoCard.vue identityRules：身份证号正则 */
const IDENTITY_REGEXP = /^[1-9]\d{5}[1-9]\d{3}((0\d)|(1[0-2]))(([0|1|2]\d)|3[0-1])\d{3}([0-9]|X)$/;
/** 旧版 InfoCard.vue accountNoRules：银行卡号 ≥6 位数字 */
const ACCOUNT_NO_REGEXP = /^\d{6,}$/;

function mask(value?: string): string {
  if (!value) return '-';
  if (value.length < 7) return value;
  return `${value.slice(0, 2)}${'*'.repeat(value.length - 6)}${value.slice(-4)}`;
}

export default function CardManagementClient() {
    const { t } = useTranslation();
    const [type, setType] = useState(1);
    const [rows, setRows] = useState<AccountCard[]>([]);
    const [loading, setLoading] = useState(true);
    /** 卡片弹窗：0 = 关闭；>0 = 编辑该卡；-1 = 新增 */
    const [dialog, setDialog] = useState<0 | number | -1>(0);
    const [editingId, setEditingId] = useState(0);
    const [form, setForm] = useState({ accountName: '', accountNo: '', bankName: '', identity: '' });
    const [saving, setSaving] = useState(false);
    /** 待删除的卡 id */
    const [deleteId, setDeleteId] = useState(0);

    const load = () => {
        setLoading(true);
        apiGet<{ records?: AccountCard[] }>('user/withdrawApply/list', { page: 1, accountType: type })
            .then((result) => setRows(Array.isArray(result?.records) ? result.records : []))
            .catch(() => setRows([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, [type]);

    const openCreate = () => {
        setEditingId(0);
        setForm({ accountName: '', accountNo: '', bankName: '', identity: '' });
        setDialog(-1);
    };

    /** 旧版 InfoCard.vue show()：编辑模式走 getAccount({ accountId }) 回显 */
    const openEdit = async (item: AccountCard) => {
        setEditingId(item.accountId);
        setDialog(item.accountId);
        const detail = await apiGet<AccountCard>('user/withdrawApply/accountDetail', { accountId: item.accountId }).catch(() => null);
        const current = detail || item;
        setForm({
            accountName: current.accountName || '',
            accountNo: current.accountNo || '',
            bankName: current.bankName || '',
            identity: current.identity || '',
        });
    };

    const submit = async () => {
        const accountName = form.accountName.trim();
        const accountNo = form.accountNo.trim();
        const identity = form.identity.trim();
        if (!accountName) return Toast.error({ content: t('请输入真实姓名') });
        if (!identity) return Toast.error({ content: t('请输入身份证号') });
        if (!IDENTITY_REGEXP.test(identity)) return Toast.error({ content: t('请输入正确的身份证号码') });
        if (!accountNo) return Toast.error({ content: t('请输入{type}账号', { type: t(TYPE_LABELS[type]) }) });
        if (type === 1 && !ACCOUNT_NO_REGEXP.test(accountNo)) return Toast.error({ content: t('请输入正确的银行卡号') });

        setSaving(true);
        try {
            const payload = {
                accountType: type,
                accountName,
                accountNo,
                identity,
                bankName: type === 1 ? form.bankName.trim() : '',
            };
            if (editingId) {
                await apiPost('user/withdrawApply/updateAccount', { accountId: editingId, ...payload });
            } else {
                await apiPost('user/withdrawApply/createAccount', payload);
            }
            Toast.success({ content: t('操作成功') });
            setDialog(0);
            setForm({ accountName: '', accountNo: '', bankName: '', identity: '' });
            load();
        } catch (error) {
            Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!deleteId) return;
        try {
            await apiPost('user/withdrawApply/delAccount', { accountId: deleteId });
            Toast.success({ content: t('已删除') });
            setDeleteId(0);
            load();
        } catch (error) {
            Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
    };

    return (
        <Card className="member-card" loading={loading}>
            <div className="card-tabs">
                {[1, 2, 3].map((value) => (
                    <button key={value} type="button" className={type === value ? 'is-active' : ''} onClick={() => setType(value)}>{t(TYPE_LABELS[value])}</button>
                ))}
                <Button theme="solid" type="primary" onClick={openCreate}>{t('添加新卡')}</Button>
            </div>
            <table className="account-table">
                <thead><tr><th>{t('真实姓名')}</th><th>{t('身份证号码')}</th><th>{t('账户号码')}</th>{type === 1 ? <th>{t('银行卡详情')}</th> : null}<th>{t('操作')}</th></tr></thead>
                <tbody>
                    {rows.map((item) => (
                        <tr key={item.accountId}>
                            <td>{item.accountName || '-'}</td>
                            <td>{mask(item.identity)}</td>
                            <td>{mask(item.accountNo)}</td>
                            {type === 1 ? <td>{item.bankName || '-'}</td> : null}
                            <td>
                                {/* 旧版 InfoCard.vue act="edit"：编辑已绑定的卡 */}
                                <button type="button" className="link-primary" onClick={() => void openEdit(item)}>{t('编辑')}</button>
                                <button type="button" className="link-danger" onClick={() => setDeleteId(item.accountId)}>{t('删除')}</button>
                            </td>
                        </tr>
                    ))}
                    {!rows.length ? <tr><td colSpan={type === 1 ? 5 : 4} className="account-empty">{t('暂无卡片')}</td></tr> : null}
                </tbody>
            </table>

            {/* 新增 / 编辑卡片（InfoCard.vue 对照） */}
            <Modal
                title={editingId ? t('编辑卡片') : t('新增卡片')}
                visible={dialog !== 0}
                onCancel={() => setDialog(0)}
                onOk={() => void submit()}
                confirmLoading={saving}
                okText={t('保存')}
                width={600}
            >
                <div className="security-form">
                    {!editingId ? (
                        <>
                            <label>{t('卡类型')}</label>
                            <div className="card-type-group">
                                {[1, 2, 3].map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={type === value ? 'is-active' : ''}
                                        onClick={() => setType(value)}
                                    >
                                        {t(TYPE_LABELS[value])}
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : null}
                    <label>{t('真实姓名')}</label>
                    <input value={form.accountName} onChange={(event) => setForm({ ...form, accountName: event.target.value })} placeholder={t('请输入真实姓名')} />
                    <label>{t('身份证号')}</label>
                    <input value={form.identity} maxLength={18} onChange={(event) => setForm({ ...form, identity: event.target.value })} placeholder={t('请输入身份证号')} />
                    <label>{t(TYPE_LABELS[type])}{t('号')}</label>
                    <input value={form.accountNo} onChange={(event) => setForm({ ...form, accountNo: event.target.value })} placeholder={t('请输入{type}账号', { type: t(TYPE_LABELS[type]) })} />
                    {type === 1 ? (
                        <>
                            <label>{t('银行卡详情')}</label>
                            <input value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} placeholder={t('请输入银行卡详情')} />
                        </>
                    ) : null}
                </div>
            </Modal>

            {/* 删除卡片二次确认（DeleteRecord 对照） */}
            <MemberDeleteConfirm
                visible={Boolean(deleteId)}
                text={t('您确认要删除该卡片吗？')}
                onCancel={() => setDeleteId(0)}
                onConfirm={remove}
            />
        </Card>
    );
}
