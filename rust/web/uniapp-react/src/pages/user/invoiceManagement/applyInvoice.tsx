import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Input, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useRouter } from "@tarojs/taro";

import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getCheckInvoice, getInvoiceStatus } from "@/api/order/invoice";
import { getOrderInvoiceDetail, orderInvoiceInsert, orderInvoiceUpdate } from "@/api/user/invoiceManagemen";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./applyInvoice.scss";

interface FormState {
    /** 抬头类型 */
    titleType: number;
    /** 发票类型 */
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

const FORM_FIELDS = ["companyName", "mobile", "email", "companyCode", "companyAddress", "companyPhone", "companyBank", "companyAccount"] as const;

// 检查是否包含中文字符
const checkChinese = (value: string): boolean => {
    if (!value) return true; // 空值由 required 验证处理
    const chineseRegex = /[\u4e00-\u9fa5]/;
    return !chineseRegex.test(value);
};

// 邮箱格式验证
const validateEmail = (value: string): boolean => {
    if (!value) return true; // 空值由 required 验证处理
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
};

// 兼容历史开票信息的返回格式：{ item }、对象或下单时保存的 JSON 字符串
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

/** 只读信息行（增值税专用发票资质回填） */
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
 * 发票申请页（自旧 pages/user/invoiceManagement/applyInvoice.vue 移植）
 * - 支持普通发票（个人/企业）和增值税专用发票
 * - 填写发票抬头、纳税人识别号等开票信息
 * - 增值税专用发票需先通过增票资质审核
 */
export default function ApplyInvoice() {
    usePageGuards();

    const router = useRouter();

    const [formState, setFormState] = useState<FormState>(EMPTY_FORM);
    /** 同步镜像：缓存/回填/提交需要立即读到最新值（等价旧 reactive 同步语义） */
    const formMirrorRef = useRef<FormState>(EMPTY_FORM);
    formMirrorRef.current = formState;
    const setForm = (next: FormState) => {
        formMirrorRef.current = next;
        setFormState(next);
    };

    // 已填写内容按「发票类型-抬头类型」暂存，来回切换时恢复，避免被其他订单的历史信息覆盖
    const formCacheRef = useRef<Record<string, Record<string, string>>>({});
    const currentFormKeyRef = useRef("1-1");
    // 普通发票上次选择的抬头类型，从增值税专用发票切回时恢复
    const lastNormalTitleTypeRef = useRef(1);

    const [invoiceStatus, setInvoiceStatus] = useState(false);
    const invoiceStatusDataRef = useRef<any>(null);

    const [orderId, setOrderId] = useState<any>(0);
    const [submitStatus, setSubmitStatus] = useState("insert");
    const [errors, setErrors] = useState<Record<string, string>>({});

    const getFormKey = () => `${formMirrorRef.current.invoiceType}-${formMirrorRef.current.titleType}`;

    const saveFormCache = () => {
        const cur = formMirrorRef.current;
        formCacheRef.current[currentFormKeyRef.current] = FORM_FIELDS.reduce<Record<string, string>>((acc, key) => ({ ...acc, [key]: cur[key] }), {});
    };

    const clearFormState = () => {
        setForm({ ...formMirrorRef.current, ...EMPTY_TEXT_FIELDS });
    };

    /** 按当前抬头类型回填开票信息；个人抬头只回填名称、手机、邮箱 */
    const fillFormState = (data: any) => {
        const cur = formMirrorRef.current;
        const next: FormState = {
            ...cur,
            companyName: data.companyName || "",
            mobile: data.mobile || "",
            email: data.email || ""
        };
        if (cur.titleType === 1) {
            setForm(next);
            return;
        }
        next.companyCode = data.companyCode || "";
        next.companyAddress = data.companyAddress || "";
        next.companyPhone = data.companyPhone || "";
        next.companyBank = data.companyBank || "";
        next.companyAccount = data.companyAccount || "";
        setForm(next);
    };

    const __getInvoiceStatus = async () => {
        try {
            const result: any = await getInvoiceStatus();
            if (result && Object.keys(result).length > 0) {
                setInvoiceStatus(true);
                invoiceStatusDataRef.current = result;
            } else {
                setInvoiceStatus(false);
                invoiceStatusDataRef.current = null;
            }
        } catch (error) {
            console.error(error);
        }
    };

    const __getCheckInvoice = async () => {
        const invoiceType = formMirrorRef.current.invoiceType;
        const titleType = formMirrorRef.current.titleType;
        try {
            const result: any = await getCheckInvoice({ invoiceType, titleType });
            // 请求期间用户已切换发票类型或抬头，丢弃过期结果
            if (invoiceType !== formMirrorRef.current.invoiceType || titleType !== formMirrorRef.current.titleType) return;

            const data = parseInvoiceData(result);
            if (!data) return;
            // 接口可能返回最近一次任意类型的开票信息，类型不一致时不回填
            if (data.invoiceType && Number(data.invoiceType) !== invoiceType) return;
            if (data.titleType && Number(data.titleType) !== titleType) return;
            fillFormState(data);
        } catch (error) {
            console.error(error);
        }
    };

    // 切换后恢复该类型已填写的内容；没有填写过时才回填最近一次的开票信息
    const restoreFormState = () => {
        currentFormKeyRef.current = getFormKey();
        const cache = formCacheRef.current[currentFormKeyRef.current];
        if (cache) {
            setForm({ ...formMirrorRef.current, ...cache });
            return;
        }
        clearFormState();
        void __getCheckInvoice();
    };

    const handleTitleType = (name: number) => {
        saveFormCache();
        setForm({ ...formMirrorRef.current, titleType: name });
        restoreFormState();
    };

    // 重新申请时，按订单回填已提交的发票申请信息
    const __getOrderInvoiceDetail = async (id: any) => {
        try {
            const result: any = await getOrderInvoiceDetail(id);
            if (!result) return;
            const invoiceType = Number(result.invoiceType) || 1;
            const titleType = invoiceType === 2 ? 2 : Number(result.titleType) || 1;
            if (invoiceType === 1) lastNormalTitleTypeRef.current = titleType;
            const next: FormState = {
                ...formMirrorRef.current,
                invoiceType,
                titleType
            };
            currentFormKeyRef.current = `${invoiceType}-${titleType}`;
            formMirrorRef.current = next;
            fillFormState(result);
        } catch (error) {
            console.error(error);
            void __getCheckInvoice();
        }
    };

    const handleInvoiceType = (type: number) => {
        if (type === formMirrorRef.current.invoiceType) return;
        saveFormCache();
        if (formMirrorRef.current.invoiceType === 1) lastNormalTitleTypeRef.current = formMirrorRef.current.titleType;
        const next: FormState = {
            ...formMirrorRef.current,
            invoiceType: type
        };
        if (type === 2) {
            next.titleType = 2;
            // 旧 reactive 赋值后 getFormKey() 立即得到 "2-2"；此处镜像尚未写入，直接按目标值取键
            currentFormKeyRef.current = "2-2";
            // 当选择增值税专用发票且已通过资质审核时，使用资质数据填充表单
            if (invoiceStatus && invoiceStatusDataRef.current) {
                next.companyName = invoiceStatusDataRef.current.companyName || "";
                next.companyCode = invoiceStatusDataRef.current.companyCode || "";
                next.companyAddress = invoiceStatusDataRef.current.companyAddress || "";
                next.companyPhone = invoiceStatusDataRef.current.companyPhone || "";
                next.companyBank = invoiceStatusDataRef.current.companyBank || "";
                next.companyAccount = invoiceStatusDataRef.current.companyAccount || "";
                next.mobile = invoiceStatusDataRef.current.mobile || "";
                next.email = invoiceStatusDataRef.current.email || "";
                setForm(next);
                return;
            }
        } else {
            next.titleType = lastNormalTitleTypeRef.current;
        }
        setForm(next);
        restoreFormState();
    };

    const validate = (): Record<string, string> => {
        const cur = formMirrorRef.current;
        const next: Record<string, string> = {};

        if (cur.invoiceType === 1) {
            if (!cur.companyName.trim()) {
                next.companyName = cur.titleType === 1 ? t("个人名称不能为空") : t("企业名称不能为空");
            }
            if (cur.titleType === 2) {
                if (!cur.companyCode.trim()) {
                    next.companyCode = t("纳税人识号不能为空!");
                } else if (!checkChinese(cur.companyCode)) {
                    next.companyCode = t("纳税人识号格式不正确");
                }
                if (cur.companyPhone && !checkChinese(cur.companyPhone)) {
                    next.companyPhone = t("单位电话格式不正确");
                }
                if (cur.companyAccount && !/^\d{1,20}$/.test(cur.companyAccount)) {
                    next.companyAccount = t("银行账户格式不正确");
                }
            }
        }
        if (cur.mobile && !/^\d{11}$/.test(cur.mobile)) {
            next.mobile = t("手机号格式不正确");
        }
        if (cur.email) {
            // 检查是否包含中文；只允许字母、数字、@、.、_、-
            const chineseRegex = /[\u4e00-\u9fa5]/;
            const validEmailRegex = /^[a-zA-Z0-9@._-]+$/;
            if (chineseRegex.test(cur.email) || !validEmailRegex.test(cur.email) || !validateEmail(cur.email)) {
                next.email = t("请输入正确的邮箱格式");
            }
        }
        return next;
    };

    const __orderInvoiceInsert = async () => {
        try {
            const data = {
                ...formMirrorRef.current,
                id: orderId
            };
            await orderInvoiceInsert(data);
            Taro.redirectTo({
                url: "/pages/user/invoiceManagement/index?type=list"
            });
        } catch (error) {
            console.error(error);
        }
    };

    const __orderInvoiceUpdate = async () => {
        try {
            const data = {
                ...formMirrorRef.current,
                id: orderId
            };
            await orderInvoiceUpdate(data);
            Taro.redirectTo({
                url: "/pages/user/invoiceManagement/index?type=list"
            });
        } catch (error) {
            console.error(error);
        }
    };

    const onSubmit = () => {
        const nextErrors = validate();
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            console.log("表单错误信息：", nextErrors);
            return;
        }
        if (submitStatus === "insert") {
            void __orderInvoiceInsert();
        } else {
            void __orderInvoiceUpdate();
        }
    };

    // 旧 onLoad：重新申请回填该订单已提交的信息，首次申请回填最近一次开票信息
    useEffect(() => {
        const options = (router.params || {}) as any;
        const type = options.type || "insert";
        const id = options.orderId || 0;
        setSubmitStatus(type);
        setOrderId(id);
        if (type === "update" && id) {
            void __getOrderInvoiceDetail(id);
        } else {
            void __getCheckInvoice();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧 onShow
    useDidShow(() => {
        void __getInvoiceStatus();
    });

    const handleApply = () => {
        Taro.redirectTo({
            url: "/pages/user/invoiceManagement/index?type=invoice"
        });
    };

    const inputProps = (key: keyof FormState) => ({
        value: String(formState[key] ?? ""),
        placeholderStyle: "color:#c0c4cc;font-size:26rpx",
        onInput: (e: any) => setForm({ ...formMirrorRef.current, [key]: e.detail.value } as FormState)
    });

    const disabled = formState.invoiceType === 2 && !invoiceStatus;

    return (
        <TigLayout title={t("发票申请")}>
            <View className="invoice-popup-content">
                <View className="invoice-typemenu">
                    <View className="invoice-explain">
                        {t("我公司依法开具发票，请您按照税法规定使用发票。根据现行税收政策，部分公司提供数电票")},
                        {t(
                            "数电（专用发票）法律效力与现有增值税专用发票相同;如商品由第三方卖家销售，发票类型和内容将由该卖家决定，发票由卖家开具并提供。如您为企业采购，需要多单合并开具或批量提交发票可注册企业用户"
                        )}
                        ；
                        <Text className="main-color">{t("使用礼品卡支付部分的金额，不支持开发票")}</Text>
                    </View>
                    <View className={`invoice-typemenu-item${formState.invoiceType === 1 ? " active" : ""}`} onClick={() => handleInvoiceType(1)}>
                        {t("普通发票")}
                    </View>
                    <View className={`invoice-typemenu-item${formState.invoiceType === 2 ? " active" : ""}`} onClick={() => handleInvoiceType(2)}>
                        {t("增值税专用发票")}
                    </View>
                </View>

                <View className="invoice-formState">
                    {formState.invoiceType === 1 ? (
                        <>
                            <FormItem label={t("发票抬头")} required>
                                <View className="item-layout">
                                    <View className="radio-item" onClick={() => handleTitleType(1)}>
                                        <View className={`radio-dot${formState.titleType === 1 ? " active" : ""}`} />
                                        <Text className="radio-label">{t("个人")}</Text>
                                    </View>
                                    <View className="radio-item" onClick={() => handleTitleType(2)}>
                                        <View className={`radio-dot${formState.titleType === 2 ? " active" : ""}`} />
                                        <Text className="radio-label">{t("企业")}</Text>
                                    </View>
                                </View>
                            </FormItem>
                            {formState.titleType == 1 ? (
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
                                    <FormItem label={t("单位电话")} error={errors.companyPhone}>
                                        <Input className="form-input" placeholder={t("请输入单位电话")} {...inputProps("companyPhone")} />
                                    </FormItem>
                                    <FormItem label={t("开户银行")}>
                                        <Input className="form-input" placeholder={t("请输入开户银行")} {...inputProps("companyBank")} />
                                    </FormItem>
                                    <FormItem label={t("银行账户")} error={errors.companyAccount}>
                                        <Input className="form-input" placeholder={t("请输入银行账户")} {...inputProps("companyAccount")} />
                                    </FormItem>
                                </>
                            )}
                            <FormItem label={t("收票人手机")} error={errors.mobile}>
                                <Input className="form-input" placeholder={t("请输入收票人手机")} {...inputProps("mobile")} />
                            </FormItem>
                            <FormItem label={t("收票人邮箱")} error={errors.email}>
                                <Input className="form-input" placeholder={t("请输入收票人邮箱")} {...inputProps("email")} />
                            </FormItem>
                        </>
                    ) : formState.invoiceType === 2 && invoiceStatus ? (
                        <>
                            <ReadonlyItem label={t("单位名称")} value={formState.companyName} />
                            <ReadonlyItem label={t("纳税人识别码")} value={formState.companyCode} />
                            <ReadonlyItem label={t("注册地址")} value={formState.companyAddress} />
                            <ReadonlyItem label={t("注册电话")} value={formState.companyPhone} />
                            <ReadonlyItem label={t("开户银行")} value={formState.companyBank} />
                            <ReadonlyItem label={t("银行账户")} value={formState.companyAccount} />
                            <FormItem label={t("收票人手机")} error={errors.mobile}>
                                <Input className="form-input" placeholder={t("请输入收票人手机")} {...inputProps("mobile")} />
                            </FormItem>
                            <FormItem label={t("收票人邮箱")} error={errors.email}>
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
            </View>

            {/* 旧 tig-fixed-placeholder（background #fff）→ 固定底栏 + 等高占位 */}
            <View className="btn-fixed-placeholder">
                <View className="btn-box">
                    <TigButton2 className="btn" theme disabled={disabled} onClick={onSubmit}>
                        {t("提交")}
                    </TigButton2>
                </View>
            </View>
            <View className="btn-placeholder" />
        </TigLayout>
    );
}