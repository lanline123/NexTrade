import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Input, Text, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { Picker } from "@nutui/nutui-react-taro";

import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getAccount, updateAccount } from "@/api/user/account";
import type { AccountData } from "@/types/user/account";
import { useI18nStore } from "@/store/i18n";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./edit.scss";

/** 表单行（对齐旧 uni-forms-item：label 宽 170rpx + 必填星号 + 错误提示） */
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

/**
 * 添加/编辑提现账号（自旧 pages/user/account/cardManagement/edit.vue 移植）
 * - 银行卡 / 支付宝 / 微信三种类型
 * - 真实姓名、身份证号、账号（银行卡还需银行详情）
 */
export default function AccountEdit() {
    usePageGuards();

    const router = useRouter();
    const langCode = useI18nStore((s) => s.langCode);

    const [id, setId] = useState<any>();
    const [navbarTitle, setNavbarTitle] = useState(t("添加账号"));
    const [selectedAccountType, setSelectedAccountType] = useState(0);
    const accountTypeList = useMemo(() => [t("银行卡"), t("支付宝"), t("微信")], [langCode]);

    const [formState, setFormState] = useState<AccountData>({
        accountType: 1
    });
    /** 同步镜像：校验与提交需要立即读到最新值 */
    const formMirrorRef = useRef<AccountData>(formState);
    formMirrorRef.current = formState;
    const setForm = (next: AccountData) => {
        formMirrorRef.current = next;
        setFormState(next);
    };

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showTypePicker, setShowTypePicker] = useState(false);

    const accountPlaceholder = useMemo(() => {
        switch (formState.accountType) {
            case 1:
                return t("银行卡");
            case 2:
                return t("支付宝");
            case 3:
                return t("微信");
            default:
                return "";
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formState.accountType, langCode]);

    const resetForm = (accountType: number) => {
        setErrors({});
        setForm({
            accountName: "",
            identity: "",
            accountNo: "",
            accountType,
            bankName: ""
        });
    };

    const acTypeChange = (index: number) => {
        setSelectedAccountType(index);
        resetForm(Number(index) + 1);
    };

    const __getAccount = async () => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            const result: any = await getAccount({ accountId: id });
            setSelectedAccountType(Number(result.accountType) - 1);
            setForm({ ...formMirrorRef.current, ...result });
        } catch (error: any) {
            console.error(error.message);
        } finally {
            Taro.hideLoading();
        }
    };

    // 旧 onLoad
    useEffect(() => {
        const option = (router.params || {}) as any;
        if (option.id) {
            setId(option.id);
            setNavbarTitle(t("编辑账号"));
            void __getAccount();
        } else if (option.accountType) {
            const type = Number(option.accountType);
            setSelectedAccountType(type - 1);
            setForm({ ...formMirrorRef.current, accountType: type });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const validate = (): Record<string, string> => {
        const next: Record<string, string> = {};
        const cur = formMirrorRef.current;
        if (!cur.accountName) {
            next.accountName = t("请输入真实姓名");
        }
        if (!cur.identity) {
            next.identity = t("请输入身份证号码");
        } else {
            const regex = /^[1-9]\d{5}[1-9]\d{3}((0\d)|(1[0-2]))(([0|1|2]\d)|3[0-1])\d{3}([0-9]|X)$/;
            if (!regex.test(String(cur.identity))) {
                next.identity = t("请输入正确的身份证号码");
            }
        }
        if (!cur.accountNo) {
            next.accountNo = t("请输入正确的{0}账号", { 0: accountPlaceholder });
        } else if (cur.accountType === 1 && !/^\d{6,}$/.test(String(cur.accountNo))) {
            next.accountNo = t("请输入正确的{0}账号", { 0: accountPlaceholder });
        }
        return next;
    };

    const onSubmit = () => {
        const nextErrors = validate();
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            console.error("表单错误信息：", nextErrors);
            return;
        }
        if (id) {
            void edit();
        } else {
            void add();
        }
    };

    const add = async () => {
        try {
            const result: any = await updateAccount({ ...formMirrorRef.current }, "createAccount");
            void result;
            Taro.showToast({
                title: t("添加成功"),
                icon: "success",
                duration: 1000
            });
            setTimeout(() => {
                Taro.navigateBack({
                    success: () => {
                        // 发送刷新信号
                        Taro.eventCenter.trigger("refreshData", { type: formMirrorRef.current.accountType });
                    }
                });
            }, 1000);
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1000
            });
        }
    };

    const edit = async () => {
        try {
            const result: any = await updateAccount({ ...formMirrorRef.current }, "updateAccount");
            if (result?.message) {
                Taro.showToast({
                    title: result.message,
                    icon: "success",
                    duration: 1000
                });
            }
            setTimeout(() => {
                Taro.navigateBack({
                    success: () => {
                        // 发送刷新信号
                        Taro.eventCenter.trigger("refreshData", { type: formMirrorRef.current.accountType });
                    }
                });
            }, 1000);
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1000
            });
        }
    };

    const inputProps = (key: keyof AccountData) => ({
        value: String(formState[key] ?? ""),
        placeholderStyle: "color:#c0c4cc;font-size:26rpx;text-align:right",
        onInput: (e: any) => setForm({ ...formMirrorRef.current, [key]: e.detail.value } as AccountData)
    });

    return (
        <TigLayout title={navbarTitle}>
            <View className="card-edit-main">
                <View className="card-edit-content" data-form-rev="aGpwbTIyODI">
                    {/* 旧 uni-forms-item：卡片类型（新增可选 / 编辑只读） */}
                    <FormItem label={t("卡片类型")} required>
                        {!id ? (
                            <View className="card-idx picker-arrow" onClick={() => setShowTypePicker(true)}>
                                {accountTypeList[selectedAccountType]}
                            </View>
                        ) : (
                            <Input className="form-input disabled" value={accountPlaceholder} disabled />
                        )}
                    </FormItem>

                    <FormItem label={t("真实姓名")} required error={errors.accountName}>
                        <Input className="form-input" placeholder={t("请输入真实姓名")} {...inputProps("accountName")} />
                    </FormItem>

                    <FormItem label={t("身份证号")} required error={errors.identity}>
                        <Input className="form-input" placeholder={t("请输入身份证号码")} {...inputProps("identity")} />
                    </FormItem>

                    <FormItem label={t("{0}号", { 0: accountPlaceholder })} required error={errors.accountNo}>
                        <Input className="form-input" placeholder={t("请输入{0}账号", { 0: accountPlaceholder })} {...inputProps("accountNo")} />
                    </FormItem>

                    {formState.accountType === 1 ? (
                        <FormItem label={t("银行卡详情")}>
                            <Input className="form-input" placeholder={t("请输入银行卡详情")} {...inputProps("bankName")} />
                        </FormItem>
                    ) : null}
                </View>
            </View>

            {/* 旧 tig-fixed-placeholder（background #fff）→ 固定底栏 + 等高占位 */}
            <View className="btn-fixed-placeholder">
                <View className="btn-box">
                    <TigButton2 className="btn" theme onClick={onSubmit}>
                        {id ? t("保存修改") : t("新增账号")}
                    </TigButton2>
                </View>
            </View>
            <View className="btn-placeholder" />

            {/* 旧 uni picker mode="selector" → NutUI Picker */}
            <Picker
                visible={showTypePicker}
                options={[accountTypeList.map((label, index) => ({ label, value: index }))]}
                onConfirm={(selectedOptions: any[], selectedValue?: (string | number | null)[]) => {
                    const index = Number(selectedValue?.[0] ?? selectedOptions?.[0]?.value ?? 0);
                    setShowTypePicker(false);
                    acTypeChange(index);
                }}
                onCancel={() => setShowTypePicker(false)}
                onClose={() => setShowTypePicker(false)}
            />
        </TigLayout>
    );
}