import { useEffect, useState } from "react";
import { Image, Input, Picker, Text, Textarea, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import dayjs from "dayjs";
import { Popup } from "@nutui/nutui-react-taro";

import { applyMerchant, getMerchantInfo } from "@/api/user/merchantEnter";
import SelectRegion from "@/components/region/SelectRegion";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigImage from "@/components/tig/tig-image/TigImage";
import Upload from "@/components/upload/Upload";
import DatetimeItem from "@/pages/user/userCertification/src/DatetimeItem";
import SelectDate from "@/pages/user/userCertification/src/SelectDate";
import type { ApplyDetailItem } from "@/types/user/merchantEnter";
import { isDemo, isO2o, staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import { FormRow, RadioItem } from "./FormRow";
import Steps from "./steps";
import Success from "./success";

import "./personalForm.scss";

interface Props {
    id?: number;
    isReapply?: boolean;
    /** 旧 @send-refresh */
    onSendRefresh?: (id: number) => void;
}

// 回填时跳过 null/undefined，保留表单初始值（[]、""），避免日期组件和校验器拿到 null 导致校验挂起
const withoutNil = (data: Record<string, any> = {}) => Object.fromEntries(Object.entries(data).filter(([, value]) => value !== null && value !== undefined));

/**
 * 个人入驻表单（自旧 pages/user/merchantEnter/src/personalForm.vue 逐行移植）
 * - 步骤：个人信息 → 经营信息 → 审核及公示 → 完成入驻
 * - 旧 up-form / up-input / up-radio / up-datetime-picker / up-action-sheet → 基础组件 + NutUI Popup 等价自绘
 * - 旧 up-form 的 error-type=toast 规则改为逐条校验并 toast 首条错误
 */
export default function PersonalForm({ id = 0, isReapply = false, onSendRefresh }: Props) {
    const [stepList] = useState(() => [t("个人信息"), t("经营信息"), t("审核及公示"), t("完成入驻")]);
    const [currentStep, setCurrentStep] = useState(1);

    const [firstForm, setFirstForm] = useState<any>({
        type: 1,
        certificateValidityPeriod: 1,
        certificateValidityPeriodDate: [] as string[],
        certificateValidityPeriodEnd: "",
        frontOfPhoto: [],
        backOfPhoto: [],
        documentType: 0,
        corporateName: "",
        documentNumber: "",
        birthday: "",
        sex: 1,
        residentialAddress: "",
        supplementaryInformation: []
    });
    const [secondForm, setSecondForm] = useState<any>({
        merchantData: {
            contactName: "",
            contactPhone: "",
            contactEmail: "",
            bankDeposit: "",
            bankBranch: "",
            bankCard: "",
            merchantName: "",
            customerServicePhone: "",
            businessAddress: [] as number[],
            detailedAddress: ""
        },
        shopData: {
            shopTitle: "",
            contactMobile: "",
            description: "",
            shopLogo: []
        }
    });

    const [formData, setFormData] = useState<any>({} as ApplyDetailItem);
    const [loadStatus, setLoadStatus] = useState(true);
    const [sexText, setSexText] = useState("");
    const [certificateValidityPeriodText, setCertificateValidityPeriodText] = useState("");
    const [documentTypeText, setDocumentTypeText] = useState("");
    const [showDocumentType, setShowDocumentType] = useState(false);
    const [showSelectDate, setShowSelectDate] = useState(false);
    const [drteTimeKey, setDrteTimeKey] = useState("");
    const [showSelectRegion, setShowSelectRegion] = useState(false);
    const [regionNames, setRegionNames] = useState("");

    const documentType = [
        { value: 1, name: t("大陆身份证") },
        { value: 2, name: t("护照（限境外人士）") },
        { value: 3, name: t("来往内地通行证（中国香港居民）") },
        { value: 4, name: t("来往内地通行证（中国澳门居民）") },
        { value: 5, name: t("来往大陆通行证（中国台湾居民）") }
    ];

    const updateFirst = (key: string, value: any) => {
        setFirstForm((prev: any) => ({ ...prev, [key]: value }));
    };
    const updateSecondMerchant = (key: string, value: any) => {
        setSecondForm((prev: any) => ({ ...prev, merchantData: { ...prev.merchantData, [key]: value } }));
    };
    const updateSecondShop = (key: string, value: any) => {
        setSecondForm((prev: any) => ({ ...prev, shopData: { ...prev.shopData, [key]: value } }));
    };

    // 旧 up-datetime-picker 的 formatter：Taro Picker 原生面板不支持自定义 formatter
    // TODO(MIGRATION)：如需还原「年/月/日」中文单位，改用 NutUI DatePicker 的 formatter
    const formatter = (type: string, value: string) => {
        if (type === "year") {
            return `${value}${t("年")}`;
        }
        if (type === "month") {
            return `${value}${t("月")}`;
        }
        if (type === "day") {
            return `${value}${t("日")}`;
        }
        return value;
    };
    void formatter;

    const handleShowSelectDate = (key: string) => {
        setShowSelectDate(true);
        setDrteTimeKey(key);
    };
    const handleSelectDateconfirm = (val: string[]) => {
        updateFirst(drteTimeKey, JSON.parse(JSON.stringify(val)));
    };

    const documentTypeSelect = (val: { value: number; name: string }) => {
        updateFirst("documentType", val.value);
        setDocumentTypeText(val.name);
    };
    const getValidity = () => {
        updateFirst("certificateValidityPeriodDate", [new Date().toISOString().split("T")[0], new Date().toISOString().split("T")[0]]);
        updateFirst("certificateValidityPeriodEnd", new Date().toISOString().split("T")[0]);
    };

    /** 旧 firstFormRules（error-type=toast）等价校验 */
    const validateFirstForm = (): string | null => {
        const data = firstForm;
        if (!(data.certificateValidityPeriodDate?.length > 0)) {
            return t("请选择证件有效期!");
        }
        if (!data.birthday) {
            return t("请选择出生日期!");
        }
        if (!(data.frontOfPhoto?.length > 0 && data.frontOfPhoto[0]?.picUrl)) {
            return t("请上传证件正面照");
        }
        if (!(data.backOfPhoto?.length > 0 && data.backOfPhoto[0]?.picUrl)) {
            return t("请上传证件反面照");
        }
        if (!(data.documentType > 0)) {
            return t("请选择证件类型");
        }
        if (!data.corporateName) {
            return t("请输入姓名!");
        }
        if (!data.documentNumber) {
            return t("请输入证件号码!");
        }
        if (!data.residentialAddress) {
            return t("请输入居住地址!");
        }
        return null;
    };

    /** 旧 secondFormRules（error-type=toast）等价校验 */
    const validateSecondForm = (): string | null => {
        const merchant = secondForm.merchantData;
        const shop = secondForm.shopData;
        if (!merchant.contactName) return t("请输入姓名!");
        if (!merchant.contactPhone) return t("请输入手机号码!");
        if (!merchant.contactEmail) return t("请输入常用邮箱!");
        if (!merchant.merchantName) return t("请输入商户名称!");
        if (!merchant.customerServicePhone) return t("请输入客服电话!");
        if (!merchant.bankDeposit) return t("请输入开户银行!");
        if (!merchant.bankBranch) return t("请输入开户支行!");
        if (!merchant.bankCard) return t("请输入银行卡号!");
        if (!shop.shopTitle) return isO2o() ? t("请输入门店名称!") : t("请输入店铺名称!");
        if (!shop.contactMobile) return t("请输入联系电话!");
        if (!(merchant.businessAddress?.length > 0)) return t("请选择经营地址");
        if (!merchant.detailedAddress) return t("请输入详细地址!");
        return null;
    };

    const handleSubmit = async () => {
        if (isDemo()) {
            Taro.showToast({
                title: t("权限不足"),
                icon: "none"
            });
            return;
        }
        try {
            const data = {
                shopTitle: secondForm.shopData.shopTitle,
                type: firstForm.type,
                merchantData: secondForm.merchantData,
                baseData: firstForm,
                shopData: secondForm.shopData
            };
            const result: any = await applyMerchant(data);
            Taro.showToast({
                title: t("提交成功")
            });
            onSendRefresh?.(result.merchantApplyId);
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        }
    };

    const handlBtn = async (val: string) => {
        if (val === "pre") {
            setCurrentStep((step) => step - 1);
            return;
        }
        // 旧实现按 v-if 渲染出哪个表单就校验哪个（step1 → firstForm，step2 → secondForm）
        if (currentStep === 1) {
            const message = validateFirstForm();
            if (message) {
                Taro.showToast({ title: message, icon: "none" });
                return;
            }
        }
        if (currentStep === 2) {
            const message = validateSecondForm();
            if (message) {
                Taro.showToast({ title: message, icon: "none" });
                return;
            }
        }
        if (val === "next") {
            setCurrentStep((step) => step + 1);
        }
        if (val === "submit") {
            await handleSubmit();
        }
    };

    const getDetail = async (applyId: number) => {
        setLoadStatus(true);
        try {
            const result: any = await getMerchantInfo(applyId);
            setFormData(result);
            if (!isReapply) {
                setCurrentStep(result.status === 10 ? stepList.length : stepList.length - 1);
            }
            setSexText(result.baseData.sex == 1 ? t("男") : t("女"));
            setCertificateValidityPeriodText(
                result.baseData.certificateValidityPeriod == 1
                    ? (result.baseData.certificateValidityPeriodDate || []).join("-")
                    : result.baseData.certificateValidityPeriodEnd + " ~ " + t("长期")
            );
            setDocumentTypeText(documentType.find((item) => item.value == result.baseData.documentType)?.name ?? "");
            if (isReapply) {
                setRegionNames(result.merchantData.businessAddressName);
                setFirstForm((prev: any) => ({ ...prev, ...withoutNil(result.baseData) }));
                setSecondForm((prev: any) => ({
                    ...prev,
                    merchantData: { ...prev.merchantData, ...withoutNil(result.merchantData) },
                    shopData: { ...prev.shopData, ...withoutNil(result.shopData) }
                }));
            }
            setFirstForm((prev: any) => ({ ...prev, type: 1 }));
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        } finally {
            setLoadStatus(false);
        }
    };

    useEffect(() => {
        if (id > 0) {
            void getDetail(id);
        }
        // 对应旧 watch(() => props.id, { immediate: true })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const handlReapply = () => {
        Taro.navigateTo({
            url: "/pages/user/merchantEnter/principalType?type=isReapply"
        });
    };

    const showForm = !id || !loadStatus;

    return (
        <View>
            {showForm && (
                <>
                    <Steps currentStep={currentStep - 1} stepList={stepList} />
                    {currentStep == 1 && (
                        <View className="form-box">
                            <FormRow label={`${t("主体类型")}：`}>
                                <View className="type-text">{t("个人")}</View>
                            </FormRow>

                            <FormRow label={`${t("姓名")}：`} required>
                                <Input
                                    className="form-input right"
                                    value={firstForm.corporateName}
                                    placeholder={t("请输入姓名")}
                                    onInput={(e) => updateFirst("corporateName", e.detail.value)}
                                />
                            </FormRow>
                            <FormRow label={`${t("居住地址")}：`} required>
                                <Input
                                    className="form-input right"
                                    value={firstForm.residentialAddress}
                                    placeholder={t("请输入居住地址")}
                                    onInput={(e) => updateFirst("residentialAddress", e.detail.value)}
                                />
                            </FormRow>
                            <FormRow label={`${t("性别")}：`} required>
                                <View className="sex-box">
                                    <View className="radio-group" style={{ width: "485rpx", justifyContent: "end" }}>
                                        <RadioItem
                                            checked={firstForm.sex == 1}
                                            label={t("男")}
                                            style={{ paddingRight: "15rpx" }}
                                            onSelect={() => updateFirst("sex", 1)}
                                        />
                                        <RadioItem checked={firstForm.sex == 2} label={t("女")} onSelect={() => updateFirst("sex", 2)} />
                                    </View>
                                </View>
                            </FormRow>
                            <FormRow label={`${t("出生日期")}：`} required>
                                <Picker
                                    mode="date"
                                    start="1970-01-01"
                                    value={firstForm.birthday || dayjs().format("YYYY-MM-DD")}
                                    onChange={(e) => updateFirst("birthday", dayjs(e.detail.value).format("YYYY-MM-DD"))}
                                >
                                    <DatetimeItem modelValue={firstForm.birthday} />
                                </Picker>
                            </FormRow>
                            <FormRow className="picker-item" label={`${t("证件类型")}：`} required onClick={() => setShowDocumentType(true)}>
                                <View className="select-value">
                                    <Input className="form-input right" value={documentTypeText} disabled placeholder={t("请选择证件类型")} />
                                    <Text className="iconfont-h5 icon-arrowright arrow-right" />
                                </View>
                            </FormRow>
                            <FormRow label={`${t("证件号码")}：`} required>
                                <Input
                                    className="form-input right"
                                    value={firstForm.documentNumber}
                                    placeholder={t("请输入证件号码")}
                                    onInput={(e) => updateFirst("documentNumber", e.detail.value)}
                                />
                            </FormRow>

                            <FormRow className="special-item" labelPosition="top" label={`${t("证件有效期")}：`} required>
                                <View>
                                    <View className="certificate-validity-item">
                                        <View className="radio-group column">
                                            <RadioItem
                                                checked={firstForm.certificateValidityPeriod == 1}
                                                label={t("区间有效")}
                                                onSelect={() => {
                                                    updateFirst("certificateValidityPeriod", 1);
                                                    getValidity();
                                                }}
                                            />
                                        </View>
                                        <View className="validity-item-text">
                                            <DatetimeItem
                                                type={2}
                                                modelValue={firstForm.certificateValidityPeriodDate}
                                                disabled={firstForm.certificateValidityPeriod == 2}
                                                onClick={() => {
                                                    if (!(firstForm.certificateValidityPeriod == 2)) handleShowSelectDate("certificateValidityPeriodDate");
                                                }}
                                            />
                                        </View>
                                    </View>

                                    <View className="certificate-validity-item">
                                        <View className="radio-group column">
                                            <RadioItem
                                                checked={firstForm.certificateValidityPeriod == 2}
                                                label={t("长期有效")}
                                                onSelect={() => {
                                                    updateFirst("certificateValidityPeriod", 2);
                                                    getValidity();
                                                }}
                                            />
                                        </View>

                                        <View className="periodEnd-box">
                                            <Picker
                                                mode="date"
                                                start="1970-01-01"
                                                disabled={firstForm.certificateValidityPeriod == 1}
                                                value={firstForm.certificateValidityPeriodEnd || dayjs().format("YYYY-MM-DD")}
                                                onChange={(e) => {
                                                    if (firstForm.certificateValidityPeriod == 1) return;
                                                    updateFirst("certificateValidityPeriodEnd", dayjs(e.detail.value).format("YYYY-MM-DD"));
                                                }}
                                            >
                                                <DatetimeItem modelValue={firstForm.certificateValidityPeriodEnd} disabled={firstForm.certificateValidityPeriod == 1} />
                                            </Picker>
                                            <View>- {t("长期")}</View>
                                        </View>
                                    </View>
                                </View>
                            </FormRow>

                            <FormRow className="special-item" labelPosition="top" label={`${t("证件照正面")}：`} required>
                                <View className="upload-box">
                                    <Upload modelValue={firstForm.frontOfPhoto} isValueArray onModelValueChange={(value) => updateFirst("frontOfPhoto", value)} />
                                </View>
                            </FormRow>
                            <FormRow className="special-item" labelPosition="top" label={`${t("证件照反面")}:`} required>
                                <View className="upload-box">
                                    <Upload modelValue={firstForm.backOfPhoto} isValueArray onModelValueChange={(value) => updateFirst("backOfPhoto", value)} />
                                </View>
                            </FormRow>
                        </View>
                    )}

                    {currentStep == 2 && (
                        <>
                            <View className="form-box">
                                <View className="form-title">{t("联系人信息")}</View>

                                <FormRow label={`${t("联系人姓名")}：`} required>
                                    <Input
                                        className="form-input right"
                                        value={secondForm.merchantData.contactName}
                                        placeholder={t("请输入姓名")}
                                        onInput={(e) => updateSecondMerchant("contactName", e.detail.value)}
                                    />
                                </FormRow>
                                <FormRow label={`${t("联系人手机")}：`} required>
                                    <Input
                                        className="form-input right"
                                        value={secondForm.merchantData.contactPhone}
                                        placeholder={t("请输入联系人手机")}
                                        onInput={(e) => updateSecondMerchant("contactPhone", e.detail.value)}
                                    />
                                </FormRow>
                                <FormRow label={`${t("常用邮箱")}：`} required>
                                    <Input
                                        className="form-input right"
                                        value={secondForm.merchantData.contactEmail}
                                        placeholder={t("请输入常用邮箱")}
                                        onInput={(e) => updateSecondMerchant("contactEmail", e.detail.value)}
                                    />
                                </FormRow>
                            </View>

                            <View className="form-box">
                                <View className="form-title">{t("结算账户信息")}</View>
                                <FormRow label={`${t("开户银行")}：`} required>
                                    <Input
                                        className="form-input right"
                                        value={secondForm.merchantData.bankDeposit}
                                        placeholder={t("请输入开户银行")}
                                        onInput={(e) => updateSecondMerchant("bankDeposit", e.detail.value)}
                                    />
                                </FormRow>
                                <FormRow label={`${t("开户支行")}：`} required>
                                    <Input
                                        className="form-input right"
                                        value={secondForm.merchantData.bankBranch}
                                        placeholder={t("请输入开户支行")}
                                        onInput={(e) => updateSecondMerchant("bankBranch", e.detail.value)}
                                    />
                                </FormRow>
                                <FormRow label={`${t("银行卡号")}：`} required>
                                    <Input
                                        className="form-input right"
                                        value={secondForm.merchantData.bankCard}
                                        placeholder={t("请输入银行卡号")}
                                        onInput={(e) => updateSecondMerchant("bankCard", e.detail.value)}
                                    />
                                </FormRow>
                            </View>
                            <View className="form-box">
                                <View className="form-title">{t("商户信息")}</View>
                                <FormRow label={`${t("商户名称")}：`} required>
                                    <Input
                                        className="form-input right"
                                        value={secondForm.merchantData.merchantName}
                                        placeholder={t("请输入商户名称")}
                                        onInput={(e) => updateSecondMerchant("merchantName", e.detail.value)}
                                    />
                                </FormRow>
                                <FormRow label={`${t("客服电话")}：`} required>
                                    <Input
                                        className="form-input right"
                                        value={secondForm.merchantData.customerServicePhone}
                                        placeholder={t("请输入客服电话")}
                                        onInput={(e) => updateSecondMerchant("customerServicePhone", e.detail.value)}
                                    />
                                </FormRow>
                                <FormRow className="picker-item" label={`${t("经营地址")}：`} required onClick={() => setShowSelectRegion(true)}>
                                    <View className="select-value">
                                        <Input className="form-input right" value={regionNames} disabled placeholder={t("请选择经营地址")} />
                                        <Text className="iconfont-h5 icon-arrowright arrow-right" />
                                    </View>
                                </FormRow>
                                <FormRow label={`${t("详细地址")}：`} required>
                                    <Input
                                        className="form-input right"
                                        value={secondForm.merchantData.detailedAddress}
                                        placeholder={t("请输入详细地址")}
                                        onInput={(e) => updateSecondMerchant("detailedAddress", e.detail.value)}
                                    />
                                </FormRow>
                            </View>
                            <View className="form-box">
                                <View className="form-title">{isO2o() ? t("门店信息") : t("店铺信息")}</View>

                                <FormRow label={`${isO2o() ? t("门店名称") : t("店铺名称")}：`} required>
                                    <Input
                                        className="form-input right"
                                        value={secondForm.shopData.shopTitle}
                                        placeholder={isO2o() ? t("请输入门店名称") : t("请输入店铺名称")}
                                        onInput={(e) => updateSecondShop("shopTitle", e.detail.value)}
                                    />
                                </FormRow>
                                <FormRow label={`${t("联系电话")}：`} required>
                                    <Input
                                        className="form-input right"
                                        value={secondForm.shopData.contactMobile}
                                        placeholder={t("请输入客服电话")}
                                        onInput={(e) => updateSecondShop("contactMobile", e.detail.value)}
                                    />
                                </FormRow>
                                <FormRow className="textarea" label={`${isO2o() ? t("门店简介") : t("店铺简介")}：`}>
                                    {/* 旧注释：小程序中父组件样式无法作用到 up-textarea 内部，改用原生 textarea 直接设置样式 */}
                                    <Textarea
                                        className="form-textarea form-textarea--fixed"
                                        value={secondForm.shopData.description}
                                        maxlength={-1}
                                        placeholder={isO2o() ? t("请输入门店简介") : t("请输入店铺简介")}
                                        placeholderStyle="text-align: right; color: #c0c4cc"
                                        onInput={(e) => updateSecondShop("description", e.detail.value)}
                                    />
                                </FormRow>
                                <FormRow className="special-item" labelPosition="top" label={`${isO2o() ? t("门店logo") : t("店铺logo")}：`} required>
                                    <View className="upload-box">
                                        <Upload modelValue={secondForm.shopData.shopLogo} isValueArray onModelValueChange={(value) => updateSecondShop("shopLogo", value)} />
                                    </View>
                                </FormRow>
                                <FormRow className="special-item" labelPosition="top" label={`${t("补充信息")}：`}>
                                    <View className="upload-box">
                                        <Upload modelValue={firstForm.supplementaryInformation} limit={3} onModelValueChange={(value) => updateFirst("supplementaryInformation", value)} />
                                    </View>
                                </FormRow>
                            </View>
                        </>
                    )}
                    {currentStep === 3 && (
                        <>
                            <View className="status-box">
                                <View className="status-text">
                                    {formData.status == 1 && (
                                        <View>
                                            {t("申请已受理")}（{formData.addTime}），{t("将在1-3个工作日内完成审核")}。{t("以下为本次申请内容")}：
                                        </View>
                                    )}
                                    {formData.status == 20 && (
                                        <>
                                            <View>
                                                {t("很遗憾")}，{t("您的申请审核")}
                                                <Text className="specaial-text">{t("未通过")}</Text>。
                                            </View>
                                            {formData.auditRemark && (
                                                <View>
                                                    {t("备注")}：{formData.auditRemark}
                                                </View>
                                            )}
                                        </>
                                    )}
                                </View>
                            </View>
                            <View>
                                <View className="form-box">
                                    <View className="form-title">{t("联系人信息")}</View>
                                    <FormRow label={`${t("联系人姓名")}：`}>
                                        <Input className="form-input right" value={formData.merchantData?.contactName} disabled />
                                    </FormRow>
                                    <FormRow label={`${t("手机号")}：`}>
                                        <Input className="form-input right" value={formData.merchantData?.contactPhone} disabled />
                                    </FormRow>
                                    <FormRow label={`${t("常用邮箱")}：`}>
                                        <Input className="form-input right" value={formData.merchantData?.contactEmail} disabled />
                                    </FormRow>
                                    <FormRow label={`${t("性别")}：`}>
                                        <Input className="form-input right" value={sexText} disabled />
                                    </FormRow>
                                    <FormRow label={`${t("居住地址")}：`}>
                                        <View className="input-text">{formData.baseData?.residentialAddress}</View>
                                    </FormRow>
                                </View>
                                <View className="form-box">
                                    <View className="form-title">{t("结算账户信息")}</View>
                                    <FormRow label={`${t("开户银行")}：`}>
                                        <Input className="form-input right" value={formData.merchantData?.bankDeposit} disabled />
                                    </FormRow>
                                    <FormRow label={`${t("开户支行")}：`}>
                                        <Input className="form-input right" value={formData.merchantData?.bankBranch} disabled />
                                    </FormRow>
                                    <FormRow label={`${t("银行卡号")}：`}>
                                        <Input className="form-input right" value={formData.merchantData?.bankCard} disabled />
                                    </FormRow>
                                </View>
                                <View className="form-box">
                                    <View className="form-title">{t("商户信息")}</View>
                                    <FormRow label={`${t("商户名称")}：`}>
                                        <Input className="form-input right" value={formData.merchantData?.merchantName} disabled />
                                    </FormRow>
                                    <FormRow label={`${t("客服电话")}：`}>
                                        <Input className="form-input right" value={formData.merchantData?.customerServicePhone} disabled />
                                    </FormRow>
                                    <FormRow label={`${t("经营地址")}：`}>
                                        <View className="input-text">
                                            {formData.merchantData?.businessAddressName}
                                            {formData.merchantData?.detailedAddress}
                                        </View>
                                    </FormRow>
                                    <FormRow label={`${t("详细地址")}：`}>
                                        <Input className="form-input right" value={formData.merchantData?.detailedAddress} disabled />
                                        <View className="input-text">{formData.merchantData?.detailedAddress}</View>
                                    </FormRow>
                                </View>
                                <View className="form-box">
                                    <View className="form-title">{isO2o() ? t("门店信息") : t("店铺信息")}</View>
                                    <FormRow label={`${isO2o() ? t("门店名称") : t("店铺名称")}：`}>
                                        <Input className="form-input right" value={formData.shopData?.shopTitle} disabled />
                                    </FormRow>
                                    <FormRow label={`${t("联系电话")}：`}>
                                        <Input className="form-input right" value={formData.shopData?.contactMobile} disabled />
                                    </FormRow>
                                    <FormRow label={`${isO2o() ? t("门店简介") : t("店铺简介")}：`}>
                                        <View className="input-text">{formData.shopData?.description}</View>
                                    </FormRow>
                                    {formData.shopData?.shopLogo?.length > 0 && (
                                        <FormRow labelPosition="top" label={`${isO2o() ? t("门店logo") : t("店铺logo")}：`}>
                                            {formData.shopData.shopLogo.map((item: any, index: number) => (
                                                <View className="image-box" key={index}>
                                                    <TigImage src={item.picUrl} mode="aspectFit" preview />
                                                </View>
                                            ))}
                                        </FormRow>
                                    )}
                                </View>
                                <View className="form-box">
                                    <View className="form-title">{t("个人信息")}</View>
                                    <FormRow label={`${t("个人姓名")}：`}>
                                        <Input className="form-input right" value={formData.baseData?.corporateName} disabled />
                                    </FormRow>
                                    <FormRow label={`${t("证件类型")}：`}>
                                        <Input className="form-input right" value={documentTypeText} disabled />
                                    </FormRow>
                                    <FormRow label={`${t("证件号码")}：`}>
                                        <Input className="form-input right" value={formData.baseData?.documentNumber} disabled />
                                    </FormRow>
                                    <FormRow label={`${t("证件有效期")}：`}>
                                        <Input className="form-input right" value={certificateValidityPeriodText} disabled />
                                    </FormRow>
                                </View>
                                <View className="form-box">
                                    <View className="form-title">{t("证件照")}</View>
                                    <FormRow className="noflex" labelPosition="top" label={`${t("证件照正面：")}`}>
                                        {/* 旧注释：小程序中组件样式无法穿透 up-form-item 内部，用自身容器纵向排列 */}
                                        <View className="privacy-photo">
                                            <Image className="image-box" src={staticResource("common/lock@3x.png")} />
                                            <View className="privacy-photo__tip">
                                                <View className="privacy-alert">
                                                    <Text className="iconfont-h5 icon-info privacy-alert-icon" />
                                                    <Text className="privacy-alert-text">{t("为了保护个人隐私信息不泄露，该照片不予展示")}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </FormRow>
                                    <FormRow className="noflex" labelPosition="top" label={`${t("证件照反面：")}`}>
                                        <View className="privacy-photo">
                                            <Image className="image-box" src={staticResource("common/lock@3x.png")} />
                                            <View className="privacy-photo__tip">
                                                <View className="privacy-alert">
                                                    <Text className="iconfont-h5 icon-info privacy-alert-icon" />
                                                    <Text className="privacy-alert-text">{t("为了保护个人隐私信息不泄露，该照片不予展示")}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </FormRow>
                                    {(formData.baseData?.supplementaryInformation?.length ?? 0) > 0 && (
                                        <FormRow labelPosition="top" label={`${t("补充信息")}：`}>
                                            {formData.baseData.supplementaryInformation.map((item: any, index: number) => (
                                                <View className="image-box" key={index}>
                                                    <TigImage src={item.picUrl} mode="aspectFit" preview />
                                                </View>
                                            ))}
                                        </FormRow>
                                    )}
                                </View>
                            </View>
                        </>
                    )}
                    {currentStep == 4 && <Success initialUserInfo={formData.initialUserInfo} />}

                    {currentStep < stepList.length - 1 && (
                        <FixedPlaceholder backgroundColor="#fff">
                            {currentStep == 1 ? (
                                <View className="btn-box">
                                    <TigButton2 theme style={{ width: "100%", fontSize: "28rpx" }} onClick={() => handlBtn("next")}>
                                        {t("下一步")}{" "}
                                    </TigButton2>
                                </View>
                            ) : (
                                <View className="btn-box-tow">
                                    {currentStep > 1 && (
                                        <TigButton2 plain style={{ width: "45%", fontSize: "28rpx" }} onClick={() => handlBtn("pre")}>
                                            {t("上一步")}
                                        </TigButton2>
                                    )}
                                    {currentStep > 1 && currentStep < stepList.length - 2 ? (
                                        <TigButton2 theme style={{ width: "45%", fontSize: "28rpx" }} onClick={() => handlBtn("next")}>
                                            {t("下一步")}
                                        </TigButton2>
                                    ) : (
                                        <TigButton2 theme style={{ width: "45%", fontSize: "28rpx" }} onClick={() => handlBtn("submit")}>
                                            {t("提交")}{" "}
                                        </TigButton2>
                                    )}
                                </View>
                            )}
                        </FixedPlaceholder>
                    )}

                    {formData.status == 20 && !isReapply && (
                        <FixedPlaceholder backgroundColor="#fff">
                            <View className="btn-box">
                                <TigButton2 theme style={{ width: "100%", fontSize: "28rpx" }} onClick={handlReapply}>
                                    {t("重新申请")}{" "}
                                </TigButton2>
                            </View>
                        </FixedPlaceholder>
                    )}
                </>
            )}

            <SelectDate show={showSelectDate} onShowChange={setShowSelectDate} onConfirm={handleSelectDateconfirm} maxYears={new Date().getFullYear() + 100} />

            <Popup visible={showDocumentType} position="bottom" onClose={() => setShowDocumentType(false)}>
                <View className="action-sheet">
                    <View className="action-sheet-title">{t("证件类型")}</View>
                    {documentType.map((item) => (
                        <View
                            className="action-sheet-item"
                            key={item.value}
                            onClick={() => {
                                documentTypeSelect(item);
                                setShowDocumentType(false);
                            }}
                        >
                            {item.name}
                        </View>
                    ))}
                    <View className="action-sheet-cancel" onClick={() => setShowDocumentType(false)}>
                        {t("取消")}
                    </View>
                </View>
            </Popup>

            <SelectRegion
                show={showSelectRegion}
                onShowChange={setShowSelectRegion}
                modelValue={secondForm.merchantData.businessAddress}
                onModelValueChange={(value) => updateSecondMerchant("businessAddress", value)}
                onSendRegionNames={(val) => setRegionNames(val.join(" "))}
            />
        </View>
    );
}