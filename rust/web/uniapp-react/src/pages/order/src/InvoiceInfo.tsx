import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Popup } from "@nutui/nutui-react-taro";
import { Image, Input, ScrollView, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { getCheckInvoice, getInvoiceStatus } from "@/api/order/invoice";
import { useConfigStore } from "@/store/config";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./InvoiceInfo.scss";

/**
 * 发票信息组件（自旧 pages/order/src/invoiceInfo.vue 移植）
 * - 支持普通发票（个人/企业）和增值税专用发票
 * - 弹窗填写发票抬头、纳税人识别号等开票信息
 * - 增值税专用发票需先申请资质审核
 * - 旧 uni-forms / uni-easyinput / up-radio → Taro Input + 自绘表单行与单选圆点
 */

interface FormState {
    /** 抬头类型：1 个人 / 2 企业 */
    titleType: number;
    /** 发票类型：1 普通发票 / 2 增值税专用发票 */
    invoiceType: number;
    companyName: string;
    mobile: string;
    email: string;
    companyCode: string;
    companyAddress: string;
    companyPhone: string;
    companyBank: string;
    companyAccount: string;
}

interface Props {
    /** 旧 props.getAddressInfo：收货地址信息（影响纸质发票可选性） */
    getAddressInfo?: any;
    /** 旧 v-model:invoiceInfo */
    invoiceInfo?: any;
    /** 旧 @update:invoiceInfo */
    onInvoiceInfoChange?: (value: any) => void;
    /** 旧 @change */
    onChange?: () => void;
}

const FORM_FIELDS = ["companyName", "mobile", "email", "companyCode", "companyAddress", "companyPhone", "companyBank", "companyAccount"] as const;

const EMPTY_FORM: FormState = {
    titleType: 1,
    invoiceType: 1,
    companyName: "",
    mobile: "",
    email: "",
    companyCode: "",
    companyAddress: "",
    companyPhone: "",
    companyBank: "",
    companyAccount: ""
};

const EMPTY_TEXT_FIELDS = {
    companyName: "",
    mobile: "",
    email: "",
    companyCode: "",
    companyAddress: "",
    companyPhone: "",
    companyBank: "",
    companyAccount: ""
};

/** 兼容历史开票信息的返回格式：{ item }、对象或下单时保存的 JSON 字符串 */
const parseInvoiceData = (result: any) => {
    let data = result?.item ?? result;
    if (typeof data === "string") {
        try {
            data = JSON.parse(data);
        } catch (error) {
            return null;
        }
    }
    return data && typeof data === "object" ? data : null;
};

/** 表单行（对齐旧 uni-forms-item：label 宽 170rpx + 必填星号 + 错误提示） */
function FormItem({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
    return (
        <View className="form-item">
            <View className="form-label">
                {required && <Text className="is-required">*</Text>}
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
        <View className="invoiceInfo-content-item">
            <View className="item-label">{label}</View>
            <View className="item-value">{value}</View>
        </View>
    );
}

export default function InvoiceInfo({ getAddressInfo = {}, invoiceInfo = {}, onInvoiceInfoChange, onChange }: Props) {
    const invoiceAdded = useConfigStore((s) => s.invoiceAdded);

    const [formState, setFormState] = useState<FormState>(EMPTY_FORM);
    /** 同步镜像：保存/恢复缓存与接口回调需要立即读到最新值（等价旧 reactive 同步语义） */
    const formRef = useRef<FormState>(EMPTY_FORM);
    const formCache = useRef<Record<string, Record<string, string>>>({});
    const currentFormKey = useRef("1-1");

    const [invoiceStatus, setInvoiceStatus] = useState(false);
    const [show, setShow] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const setForm = (next: FormState) => {
        formRef.current = next;
        setFormState(next);
    };
    const patchForm = (patch: Partial<FormState>) => {
        setForm({ ...formRef.current, ...patch });
    };

    // 增值税专用发票固定为企业抬头，不区分抬头类型
    const getFormKey = () => (formRef.current.invoiceType === 2 ? "2" : `1-${formRef.current.titleType}`);

    const saveFormCache = () => {
        const cur = formRef.current;
        formCache.current[currentFormKey.current] = FORM_FIELDS.reduce<Record<string, string>>((acc, key) => ({ ...acc, [key]: cur[key] }), {});
    };

    const clearFormState = () => {
        setForm({ ...formRef.current, ...EMPTY_TEXT_FIELDS });
    };

    // 恢复该类型已填写的内容，没有时返回 false
    const restoreFormCache = () => {
        currentFormKey.current = getFormKey();
        const cache = formCache.current[currentFormKey.current];
        if (cache) setForm({ ...formRef.current, ...cache });
        else clearFormState();
        return !!cache;
    };

    const __getInvoiceStatus = async () => {
        try {
            const result = await getInvoiceStatus();
            if (result && Object.keys(result).length > 0) {
                setInvoiceStatus(true);

                if (formRef.current.invoiceType === 2) {
                    patchForm({
                        companyCode: (result as any).companyCode,
                        companyAddress: (result as any).companyAddress,
                        companyPhone: (result as any).companyPhone,
                        companyBank: (result as any).companyBank,
                        companyAccount: (result as any).companyAccount,
                        companyName: (result as any).companyName
                    });
                }
            } else {
                setInvoiceStatus(false);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const __getCheckInvoice = async () => {
        const invoiceType = formRef.current.invoiceType;
        const titleType = formRef.current.titleType;
        try {
            const result = await getCheckInvoice({ invoiceType, titleType });
            // 请求期间用户已切换发票类型或抬头，丢弃过期结果
            if (invoiceType !== formRef.current.invoiceType || titleType !== formRef.current.titleType) return;

            let data = parseInvoiceData(result);
            // 接口可能返回最近一次任意类型的开票信息，类型不一致时不回填
            if (data && data.invoiceType && Number(data.invoiceType) !== invoiceType) data = null;
            if (data && data.titleType && Number(data.titleType) !== titleType) data = null;

            if (data) {
                const next: Partial<FormState> = {
                    companyName: data.companyName || "",
                    mobile: data.mobile || "",
                    email: data.email || ""
                };
                if (titleType === 2) {
                    next.companyCode = data.companyCode || "";
                    next.companyAddress = data.companyAddress || "";
                    next.companyPhone = data.companyPhone || "";
                    next.companyBank = data.companyBank || "";
                    next.companyAccount = data.companyAccount || "";
                }
                patchForm(next);
            } else if (formRef.current.titleType === 1) {
                const address = (getAddressInfo || {}) as any;
                patchForm({
                    companyName: address.consignee || "",
                    mobile: address.mobile || "",
                    email: address.email || ""
                });
            }
        } catch (error) {
            console.error(error);
        }
    };

    // 旧 watch(show==true)：拉取资质状态；父级尚无发票信息时回填最近一次开票信息
    useEffect(() => {
        if (!show) return;
        void __getInvoiceStatus();
        if (Object.keys(invoiceInfo || {}).length === 0) {
            void __getCheckInvoice();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show]);

    // 切换个人/企业抬头时恢复已填写内容；未填写过时回填该抬头类型最近一次的开票信息
    const radioChange = (name: number) => {
        if (name === formRef.current.titleType) return;
        saveFormCache();
        patchForm({ titleType: name });
        if (!restoreFormCache()) void __getCheckInvoice();
    };

    const handleInvoiceType = (type: number) => {
        if (type === formRef.current.invoiceType) return;
        saveFormCache();
        patchForm({ invoiceType: type });
        const restored = restoreFormCache();
        if (type === 1) {
            if (!restored) void __getCheckInvoice();
        } else {
            // 增票资质信息以最新审核结果为准，每次切换都刷新；手机、邮箱保留已填写内容
            void __getInvoiceStatus();
        }
    };

    // 旧 uni-forms 校验：个人/企业名称必填，企业抬头时纳税人识别号必填
    const validate = () => {
        const next: Record<string, string> = {};
        const cur = formRef.current;
        if (cur.invoiceType === 1) {
            if (!cur.companyName.trim()) {
                next.companyName = cur.titleType === 1 ? t("个人名称不能为空") : t("企业名称不能为空");
            }
            if (cur.titleType === 2 && !cur.companyCode.trim()) {
                next.companyCode = t("纳税人识号不能为空!");
            }
        }
        return next;
    };

    const onCancel = () => {
        setShow(false);
        onInvoiceInfoChange?.({});
    };

    const onSubmit = () => {
        const nextErrors = validate();
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            console.log("表单错误信息：", nextErrors);
            return;
        }
        onInvoiceInfoChange?.({ ...formRef.current });
        setShow(false);
    };

    const handleApply = () => {
        Taro.navigateTo({ url: "/pages/user/invoiceManagement/index?type=invoice" });
    };

    const typeCodeText = formState.invoiceType === 1 ? t("普通发票") : formState.invoiceType === 2 ? t("增值税专用发票") : t("不开发票");
    const disabled = formState.invoiceType === 2 && !invoiceStatus;

    const inputValue = (key: keyof FormState) => formState[key] as string;
    const inputProps = (key: keyof FormState) => ({
        value: inputValue(key),
        placeholderStyle: "color:#c0c4cc;font-size:26rpx",
        onInput: (e: any) => patchForm({ [key]: e.detail.value } as Partial<FormState>)
    });

    return (
        <View className="invoice-info">
            <View className="invoice">
                <View className="invoice-title">{t("发票")}</View>
                <View className="invoice-content" onClick={() => setShow(true)}>
                    <View className="invoice-text">{typeCodeText}</View>
                    <Image lazyLoad className="more-ico" src={staticResource("common/more.png")} />
                </View>
            </View>

            {/* 旧 tig-popup（默认 bottom、白底）→ NutUI Popup */}
            <Popup visible={show} onClose={() => setShow(false)} style={{ backgroundColor: "#fff" } as any}>
                <ScrollView scrollY className="invoice-popup-content">
                    <View className="invoice-popup-box">
                        <View className="popup-title title">{t("发票")}</View>
                        <View className="invoice-typemenu">
                            <View
                                className={`invoice-typemenu-item${formState.invoiceType === 1 ? " active" : ""}`}
                                onClick={() => handleInvoiceType(1)}
                            >
                                {t("普通发票")}
                            </View>
                            {invoiceAdded === 1 && (
                                <View
                                    className={`invoice-typemenu-item${formState.invoiceType === 2 ? " active" : ""}`}
                                    onClick={() => handleInvoiceType(2)}
                                >
                                    {t("增值税专用发票")}
                                </View>
                            )}
                            <View className="invoice-explain">
                                我公司依法开具发票，请您按照税法规定使用发票。根据现行税收政策，部分公司提供数电票,
                                数电（专用发票）法律效力与现有增值税专用发票相同;如商品由第三方卖家销售，发票类型和内容将由该卖家决定，发票由卖家开具并提供。如您为企业采购，需要多单合并开具或批量提交发票可注册企业用户；
                                <Text className="special-text">{t("使用礼品卡支付部分的金额，不支持开发票")}</Text>
                            </View>
                        </View>

                        <View className="invoice-formState">
                            {formState.invoiceType === 1 ? (
                                <>
                                    <FormItem label={t("发票抬头")} required>
                                        <View className="item-layout">
                                            <View className="radio-item" onClick={() => radioChange(1)}>
                                                <View className={`radio-dot${formState.titleType === 1 ? " active" : ""}`} />
                                                <Text className="radio-label">{t("个人")}</Text>
                                            </View>
                                            <View className="radio-item" onClick={() => radioChange(2)}>
                                                <View className={`radio-dot${formState.titleType === 2 ? " active" : ""}`} />
                                                <Text className="radio-label">{t("企业")}</Text>
                                            </View>
                                        </View>
                                    </FormItem>
                                    {formState.titleType === 1 ? (
                                        <FormItem label={t("个人名称")} required error={errors.companyName}>
                                            <Input className="form-input" placeholder={t("请输入个人名称")} {...inputProps("companyName")} />
                                        </FormItem>
                                    ) : (
                                        <>
                                            <FormItem label={t("企业名称")} required error={errors.companyName}>
                                                <Input className="form-input" placeholder={t("请输入企业名称")} {...inputProps("companyName")} />
                                            </FormItem>
                                            <FormItem label={t("纳税人识号")} required error={errors.companyCode}>
                                                <Input className="form-input" placeholder={t("请输入纳税人识号")} {...inputProps("companyCode")} />
                                            </FormItem>
                                            <FormItem label={t("单位地址")}>
                                                <Input className="form-input" placeholder={t("请输入单位地址")} {...inputProps("companyAddress")} />
                                            </FormItem>
                                            <FormItem label={t("单位电话")}>
                                                <Input className="form-input" placeholder={t("请输入单位电话")} {...inputProps("companyPhone")} />
                                            </FormItem>
                                            <FormItem label={t("开户银行")}>
                                                <Input className="form-input" placeholder={t("请输入开户银行")} {...inputProps("companyBank")} />
                                            </FormItem>
                                            <FormItem label={t("银行账户")}>
                                                <Input className="form-input" placeholder={t("请输入银行账户")} {...inputProps("companyAccount")} />
                                            </FormItem>
                                        </>
                                    )}
                                    <FormItem label={t("收票人手机")}>
                                        <Input className="form-input" placeholder={t("请输入收票人手机")} {...inputProps("mobile")} />
                                    </FormItem>
                                    <FormItem label={t("收票人邮箱")}>
                                        <Input className="form-input" placeholder={t("请输入收票人邮箱")} {...inputProps("email")} />
                                    </FormItem>
                                </>
                            ) : formState.invoiceType === 2 && invoiceStatus ? (
                                <>
                                    <ReadonlyItem label={t("单位名称")} value={formState.companyName} />
                                    <ReadonlyItem label={t("纳税人识号")} value={formState.companyCode} />
                                    <ReadonlyItem label={t("单位地址")} value={formState.companyAddress} />
                                    <ReadonlyItem label={t("单位电话")} value={formState.companyPhone} />
                                    <ReadonlyItem label={t("开户银行")} value={formState.companyBank} />
                                    <ReadonlyItem label={t("银行账户")} value={formState.companyAccount} />
                                    <FormItem label={t("收票人手机")}>
                                        <Input className="form-input" placeholder={t("请输入收票人手机")} {...inputProps("mobile")} />
                                    </FormItem>
                                    <FormItem label={t("收票人邮箱")}>
                                        <Input className="form-input" placeholder={t("请输入收票人邮箱")} {...inputProps("email")} />
                                    </FormItem>
                                </>
                            ) : (
                                <View className="notPass">
                                    <View>
                                        {t("您还未通过增票资质申请，暂时无法开具增值税专用发票")}
                                        <Text className="notPassBtn" onClick={handleApply}>
                                            {t("去申请")}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* 旧 tig-fixed-placeholder → 弹层内固定底栏 */}
                        <View className="fixed-placeholder">
                            <View className="btn-box">
                                <View className={`btn btn--plain${disabled ? " disabled" : ""}`} onClick={() => !disabled && onCancel()}>
                                    {t("暂不开票")}
                                </View>
                                <View className={`btn${disabled ? " disabled" : ""}`} onClick={() => !disabled && onSubmit()}>
                                    {t("提交")}
                                </View>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </Popup>
        </View>
    );
}