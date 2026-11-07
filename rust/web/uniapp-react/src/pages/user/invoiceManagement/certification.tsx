import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Input, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import { createUserInvoice, getUserInvoice, updateUserInvoice } from "@/api/user/invoiceManagemen";
import type { UserInvoiceFormState } from "@/types/user/invoiceManagement";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./certification.scss";

/** 表单行（对齐旧 uni-forms-item：label 宽 180rpx + 必填星号 + 错误提示） */
function FormItem({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
    return (
        <View className="form-item">
            <View className="form-label">
                {required ? <Text className="is-required">*</Text> : null}
                <Text className="form-label-text">{`${label}:`}</Text>
            </View>
            <View className="form-control">
                {children}
                {error ? <View className="form-error">{error}</View> : null}
            </View>
        </View>
    );
}

/** 只读信息行（增票资质展示） */
function ReadonlyItem({ label, value }: { label: string; value?: string }) {
    return (
        <View className="form-item">
            <View className="form-label">
                <Text className="form-label-text">{`${label}:`}</Text>
            </View>
            <View className="form-control">
                <View className="disabled-text">{value}</View>
            </View>
        </View>
    );
}

/**
 * 增票资质（自旧 pages/user/invoiceManagement/src/certification.vue 移植）
 * - 展示资质状态与说明
 * - 填写/修改增值税专用发票资质信息并提交审核
 */
export default function Certification() {
    usePageGuards();

    // 检查是否包含中文字符
    const checkChinese = (value: string): boolean => {
        if (!value) return true; // 空值由 required 验证处理
        const chineseRegex = /[\u4e00-\u9fa5]/;
        return !chineseRegex.test(value);
    };

    const [formState, setFormState] = useState<UserInvoiceFormState>({});
    const [editFormState, setEditFormState] = useState<UserInvoiceFormState>({});
    const [showEdit, setShowEdit] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // 旧 isConfirm：旧版模板中协议勾选整块被注释（certification.vue:82-83 <!-- <view class="agreement-box"> -->），
    // 属旧端有意停用的死代码，按 parity 原则不渲染，仅保留状态占位
    const [isConfirm] = useState(false);
    void isConfirm;

    const editMirrorRef = useRef<UserInvoiceFormState>({});
    editMirrorRef.current = editFormState;
    const setEditForm = (next: UserInvoiceFormState) => {
        editMirrorRef.current = next;
        setEditFormState(next);
    };

    const __getUserInvoice = async () => {
        try {
            const result: any = await getUserInvoice();
            setFormState((prev) => ({ ...prev, ...(result || {}) }));
        } catch (error: any) {
            void error;
        }
    };

    // 旧 onMounted
    useEffect(() => {
        void __getUserInvoice();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleShowEdit = () => {
        const next = JSON.parse(JSON.stringify(formState || {}));
        setEditForm(next);
        setErrors({});
        setShowEdit(true);
    };

    const formatText = (() => {
        switch (formState.status) {
            case 0:
                return t("未申请专用发票");
            case 1:
                return t("审核通过");
            case 2:
                return t("已申请，待审核");
            case 3:
                return t("审核未通过");
            default:
                return "";
        }
    })();

    const validate = (): Record<string, string> => {
        const cur = editMirrorRef.current;
        const next: Record<string, string> = {};
        if (!cur.companyName) {
            next.companyName = t("单位名称不能为空!");
        }
        if (!cur.companyCode) {
            next.companyCode = t("纳税人识别码不能为空!");
        } else if (!checkChinese(String(cur.companyCode))) {
            next.companyCode = t("纳税人识别码格式不正确");
        }
        if (!cur.companyAddress) {
            next.companyAddress = t("注册地址不能为空!");
        }
        if (!cur.companyPhone) {
            next.companyPhone = t("注册电话不能为空!");
        } else if (!/^\d{11}$/.test(String(cur.companyPhone))) {
            next.companyPhone = t("注册电话格式不正确");
        }
        if (!cur.companyBank) {
            next.companyBank = t("开户银行不能为空!");
        }
        if (!cur.companyAccount) {
            next.companyAccount = t("银行账户不能为空!");
        } else if (!/^\d{1,20}$/.test(String(cur.companyAccount))) {
            next.companyAccount = t("银行账户格式不正确");
        }
        return next;
    };

    const onSubmit = () => {
        const nextErrors = validate();
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            console.log("表单错误信息：", nextErrors);
            return;
        }
        void __updateUserInvoice();
    };

    const __updateUserInvoice = async () => {
        try {
            const cur = editMirrorRef.current;
            cur.isConfirm = 1;
            cur.titleType = 2;
            cur.invoiceType = 1;
            cur.isAdd = cur.status == 0 ? 1 : 0;
            setEditForm({ ...cur });
            if (cur.invoiceId) {
                await updateUserInvoice({ id: cur.invoiceId, ...cur });
            } else {
                await createUserInvoice(cur);
            }
            Taro.showToast({
                title: t("提交成功"),
                icon: "none"
            });
            void __getUserInvoice();
            setShowEdit(false);
        } catch (error: any) {
            console.log("error", error);
        }
    };

    const inputProps = (key: keyof UserInvoiceFormState) => ({
        value: String(editFormState[key] ?? ""),
        placeholderStyle: "color:#c0c4cc;font-size:26rpx",
        onInput: (e: any) => setEditForm({ ...editMirrorRef.current, [key]: e.detail.value } as UserInvoiceFormState)
    });

    if (Object.keys(formState).length === 0) {
        return null;
    }

    return (
        <View className="certification safe-padding">
            <View className="tip-box">
                <View className="tig-title"> {t("温馨提示")} </View>
                <View>
                    {t("首次开具增值税专用发票")}，{t("请添加资质后并提交")}。
                </View>
                <View>{t("我们会在一个工作日内完成审核工作")}。</View>
                <View>
                    1.{t("补发流程")}：
                    <Text className="specaial-text">
                        {t("资质未审核通过")}-{t("登录会员中心")}→{t("增票资质")}→{t("填写资质信息")}→{t("提交")}。
                    </Text>
                </View>
                <View>
                    2. {t("资质审核结果查询时间")}：<Text className="specaial-text">{t("资质上传一到两个工作日后即可查询")}。</Text>
                </View>
                <View> 3. {t("注意有效增值税专用发票开票资质仅为一个")}。</View>
            </View>
            <View className="status-box">
                <View className="status-text">
                    <View> {t("您的增票资质状态")}：</View>
                    <View className="specaial-text">{formatText}</View>
                </View>
            </View>
            <View className="certification-content">
                {showEdit ? (
                    <View className="content-title">
                        {t("填写增票资质信息")}
                        <Text className="specaial-text">（{t("所有信息均为必填")}）</Text>
                    </View>
                ) : Object.keys(formState).length > 0 ? (
                    <View className="content-title"> {t("增票资质信息")}</View>
                ) : null}

                <View>
                    {showEdit ? (
                        <View>
                            <FormItem label={t("单位名称")} required error={errors.companyName}>
                                <Input className="form-input" placeholder={t("请输入单位名称")} {...inputProps("companyName")} />
                            </FormItem>
                            <FormItem label={t("纳税人识别码")} required error={errors.companyCode}>
                                <Input className="form-input" placeholder={t("请输入纳税人识别码")} {...inputProps("companyCode")} />
                            </FormItem>
                            <FormItem label={t("注册地址")} required error={errors.companyAddress}>
                                <Input className="form-input" placeholder={t("请输入注册地址")} {...inputProps("companyAddress")} />
                            </FormItem>
                            <FormItem label={t("注册电话")} required error={errors.companyPhone}>
                                <Input className="form-input" placeholder={t("请输入注册电话")} {...inputProps("companyPhone")} />
                            </FormItem>
                            <FormItem label={t("开户银行")} required error={errors.companyBank}>
                                <Input className="form-input" placeholder={t("请输入开户银行")} {...inputProps("companyBank")} />
                            </FormItem>
                            <FormItem label={t("银行账户")} required error={errors.companyAccount}>
                                <Input className="form-input" placeholder={t("请输入银行账户")} {...inputProps("companyAccount")} />
                            </FormItem>
                            {/* 旧注释保留：agreement-box（协议勾选，旧版已注释停用，非遗漏） */}
                        </View>
                    ) : formState.status === 0 ? (
                        <View className="empty-text">{t("暂无增票资质信息")}!</View>
                    ) : (
                        <View className="readonly">
                            <ReadonlyItem label={t("单位名称")} value={formState.companyName} />
                            <ReadonlyItem label={t("纳税人识别码")} value={formState.companyCode} />
                            <ReadonlyItem label={t("注册地址")} value={formState.companyAddress} />
                            <ReadonlyItem label={t("注册电话")} value={formState.companyPhone} />
                            <ReadonlyItem label={t("开户银行")} value={formState.companyBank} />
                            <ReadonlyItem label={t("银行账户")} value={formState.companyAccount} />
                        </View>
                    )}
                </View>
            </View>

            {/* 旧 tig-fixed-placeholder（background #fff）→ 固定底栏 + 等高占位 */}
            <View className="btn-fixed-placeholder">
                <View className="btn-box">
                    {showEdit ? (
                        <>
                            <TigButton2 className="btn" plain onClick={() => setShowEdit(false)}>
                                {t("取消")}
                            </TigButton2>
                            <TigButton2 className="btn" theme onClick={onSubmit}>
                                {t("提交")}
                            </TigButton2>
                        </>
                    ) : (
                        <TigButton2 className="btn" theme onClick={handleShowEdit}>
                            {formState.status === 0 ? t("添加增票资质") : t("修改并重新审核")}
                        </TigButton2>
                    )}
                </View>
            </View>
            <View className="btn-placeholder" />
        </View>
    );
}