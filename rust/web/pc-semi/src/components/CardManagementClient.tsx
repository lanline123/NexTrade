'use client';

/**
 * 卡管理（提现账户）（/member/account/cardmanagement）
 *
 * 源码对照：
 * - 列表：view/pc/pages/member/account/CardManagement.vue
 * - 弹窗：view/pc/pages/member/account/src/InfoCard.vue
 *
 * 类名逐条照抄旧版模板，列表落在 `.mp-account-card` 下、弹窗落在 `.mp-account-infocard` 下
 * （两层样式都由 scripts/gen-member-pages-scss.mjs 从旧版 <style scoped> 抽取，见 app/member-pages.scss）。
 *
 *   .info-row.mp-account-card
 *     > .title-or-tabs > .tag-and-input > .tig-tabs
 *     > .account-detail-content
 *         > .flex.justify-between.mb10
 *             > .el-radio-group(.el-radio-button > .el-radio-button__inner ×3)
 *             > .info-card > .cu > button.mp-el-button--primary
 *         > .table > table > thead.table-header > th.header-cell … tbody > tr.body-tr
 *             > td > .flex.justify-center.align-center > span.font-color(编辑) ｜ span.font-color(删除)
 *         > .no-result > span（空态）
 *
 *   .info-card.mp-account-infocard
 *     > .cu（触发区）
 *     > Modal = el-dialog：「新增卡片 / 编辑卡片」 > el-form.form-body(label-suffix="：" label-width="auto")
 *         el-form-item：卡类型(.el-radio-group) / 真实姓名 / 身份证号 / 账号 / 银行卡详情(textarea)
 *         footer：.dialog-footer > 保存
 *
 * 请求层保持原样（list / accountDetail / createAccount / updateAccount / delAccount 全未改）。
 */

import { useEffect, useState } from 'react';
import { Modal, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';
import MemberDeleteConfirm from '@/components/MemberDeleteConfirm';
import MemberAccountTabs from '@/components/MemberAccountTabs';

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
    const [form, setForm] = useState({ accountType: 1, accountName: '', accountNo: '', bankName: '', identity: '' });
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

    /** 旧版 InfoCard.vue act="add"：卡类型默认为当前列表的类型 */
    const openCreate = () => {
        setEditingId(0);
        setForm({ accountType: type, accountName: '', accountNo: '', bankName: '', identity: '' });
        setDialog(-1);
    };

    /** 旧版 InfoCard.vue show()：编辑模式走 getAccount({ accountId }) 回显 */
    const openEdit = async (item: AccountCard) => {
        setEditingId(item.accountId);
        setDialog(item.accountId);
        const detail = await apiGet<AccountCard>('user/withdrawApply/accountDetail', { accountId: item.accountId }).catch(() => null);
        const current = detail || item;
        setForm({
            accountType: current.accountType || 1,
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
        const formType = editingId ? form.accountType : type;
        if (!accountName) return Toast.error({ content: t('请输入真实姓名') });
        if (!identity) return Toast.error({ content: t('请输入身份证号') });
        if (!IDENTITY_REGEXP.test(identity)) return Toast.error({ content: t('请输入正确的身份证号码') });
        if (!accountNo) return Toast.error({ content: t('请输入{type}号', { type: t(TYPE_LABELS[formType]) }) });
        if (formType === 1 && !ACCOUNT_NO_REGEXP.test(accountNo)) return Toast.error({ content: t('请输入正确的银行卡号') });

        setSaving(true);
        try {
            const payload = {
                accountType: formType,
                accountName,
                accountNo,
                identity,
                bankName: formType === 1 ? form.bankName.trim() : '',
            };
            if (editingId) {
                await apiPost('user/withdrawApply/updateAccount', { accountId: editingId, ...payload });
            } else {
                await apiPost('user/withdrawApply/createAccount', payload);
            }
            Toast.success({ content: t('操作成功') });
            setDialog(0);
            setForm({ accountType: 1, accountName: '', accountNo: '', bankName: '', identity: '' });
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

    const accountPlaceholder = t(TYPE_LABELS[editingId ? form.accountType : type] || '银行卡');

    return (
        <div className="info-row mp-account-card">
            <MemberAccountTabs current="/member/account/cardmanagement" />

            <div className="account-detail-content">
                <div className="flex justify-between mb10">
                    <div className="el-radio-group">
                        {[1, 2, 3].map((value) => (
                            <div key={value} className="el-radio-button">
                                <button
                                    type="button"
                                    className={`el-radio-button__inner${type === value ? ' is-active' : ''}`}
                                    onClick={() => setType(value)}
                                >
                                    {t(TYPE_LABELS[value])}
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="info-card mp-account-infocard">
                        <span className="cu">
                            <button type="button" className="mp-el-button mp-el-button--primary" onClick={openCreate}>
                                {t('添加新卡')}
                            </button>
                        </span>
                    </div>
                </div>

                <div className="table">
                    {rows.length > 0 ? (
                        <table>
                            <thead className="table-header">
                                <tr>
                                    <th className="header-cell">{t('真实姓名')}</th>
                                    <th className="header-cell">{t('身份证号码')}</th>
                                    <th className="header-cell">{t('账户号码')}</th>
                                    {type === 1 ? <th className="header-cell">{t('银行卡详情')}</th> : null}
                                    <th className="header-cell" style={{ width: 130 }}>{t('操作')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((item) => (
                                    <tr key={item.accountId} className="body-tr">
                                        <td>{item.accountName}</td>
                                        <td>{item.identity}</td>
                                        <td>{mask(item.accountNo)}</td>
                                        {type === 1 ? <td>{item.bankName || '--'}</td> : null}
                                        <td>
                                            <div className="flex justify-center align-center">
                                                <div className="info-card mp-account-infocard">
                                                    <span className="cu" onClick={() => void openEdit(item)}>
                                                        <span className="font-color">{t('编辑')}</span>
                                                    </span>
                                                </div>
                                                ｜
                                                <span className="font-color" style={{ cursor: 'pointer' }} onClick={() => setDeleteId(item.accountId)}>
                                                    {t('删除')}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="no-result">
                            {loading ? null : <span>{t('暂无卡片')}</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* 新增 / 编辑卡片（InfoCard.vue 对照：el-dialog + el-form.form-body） */}
            <Modal
                title={editingId ? t('编辑卡片') : t('新增卡片')}
                visible={dialog !== 0}
                onCancel={() => setDialog(0)}
                footer={(
                    <div className="dialog-footer">
                        <button type="button" className="mp-el-button mp-el-button--primary" disabled={saving} onClick={() => void submit()}>
                            {t('保存')}
                        </button>
                    </div>
                )}
                width={600}
            >
                <div className="info-card mp-account-infocard">
                    <div className="el-form form-body mp-el-form--auto">
                        <div className="el-form-item">
                            <label className="el-form-item__label">{t('卡类型')}：</label>
                            <div className="el-form-item__content">
                                <div className="el-radio-group">
                                    {[1, 2, 3].map((value) => (
                                        <div key={value} className="el-radio-button">
                                            <button
                                                type="button"
                                                className={`el-radio-button__inner${(editingId ? form.accountType : type) === value ? ' is-active' : ''}`}
                                                onClick={() => {
                                                    if (editingId) setForm({ ...form, accountType: value, accountName: '', accountNo: '', bankName: '', identity: '' });
                                                    else setType(value);
                                                }}
                                            >
                                                {t(TYPE_LABELS[value])}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="el-form-item">
                            <label className="el-form-item__label">{t('真实姓名')}：</label>
                            <div className="el-form-item__content">
                                <input className="el-input__inner" value={form.accountName} onChange={(event) => setForm({ ...form, accountName: event.target.value })} placeholder={t('请输入真实姓名')} />
                            </div>
                        </div>
                        <div className="el-form-item">
                            <label className="el-form-item__label">{t('身份证号')}：</label>
                            <div className="el-form-item__content">
                                <input className="el-input__inner" value={form.identity} maxLength={18} onChange={(event) => setForm({ ...form, identity: event.target.value })} placeholder={t('请输入身份证号')} />
                            </div>
                        </div>
                        <div className="el-form-item">
                            <label className="el-form-item__label">{`${accountPlaceholder}${t('号')}`}：</label>
                            <div className="el-form-item__content">
                                <input className="el-input__inner" value={form.accountNo} onChange={(event) => setForm({ ...form, accountNo: event.target.value })} placeholder={`${t('请输入')}${accountPlaceholder}`} />
                            </div>
                        </div>
                        {(editingId ? form.accountType : type) === 1 ? (
                            <div className="el-form-item">
                                <label className="el-form-item__label">{t('银行卡详情')}：</label>
                                <div className="el-form-item__content">
                                    <textarea className="el-textarea__inner" rows={4} value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} placeholder={t('请输入银行卡详情')} />
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            </Modal>

            {/* 删除卡片二次确认（DeleteRecord 对照） */}
            <MemberDeleteConfirm
                visible={Boolean(deleteId)}
                text={t('您确认要删除该卡片吗？')}
                onCancel={() => setDeleteId(0)}
                onConfirm={remove}
            />
        </div>
    );
}
