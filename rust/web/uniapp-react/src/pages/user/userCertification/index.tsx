import { useEffect, useRef, useState } from "react";
import { Image, Input, Picker, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";
import dayjs from "dayjs";

import SelectRegion from "@/components/region/SelectRegion";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigImageUpload from "@/components/tig/tig-image-upload/TigImageUpload";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { applyApply, getApplyInfo, getMyApply } from "@/api/user/userCertification";
import { useConfigStore } from "@/store/config";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";
import DatetimeItem from "./src/DatetimeItem";
import SelectDate from "./src/SelectDate";
import Steps from "./src/Steps";

import "./index.scss";

interface FormRowProps {
    label?: string;
    required?: boolean;
    labelPosition?: "left" | "top";
    className?: string;
    children?: any;
    onClick?: (e: any) => void;
}

/** 旧 up-form-item（label-position/required）自绘 */
function FormRow({ label, required = false, labelPosition = "left", className = "", children, onClick }: FormRowProps) {
    return (
        <View className={`form-row${labelPosition === "top" ? " is-top" : ""}${className ? ` ${className}` : ""}`} onClick={onClick}>
            {label !== undefined && (
                <View className="form-row-label">
                    {required && <Text className="form-required">*</Text>}
                    <Text>{label}</Text>
                </View>
            )}
            <View className="form-row-content">{children}</View>
        </View>
    );
}

interface RadioItemProps {
    checked?: boolean;
    label: string;
    style?: any;
    onSelect?: () => void;
}

/** 旧 up-radio（circle 形状、主题色）自绘 */
function RadioItem({ checked = false, label, style, onSelect }: RadioItemProps) {
    return (
        <View className="radio-item" style={style} onClick={() => onSelect?.()}>
            <View className={`radio-dot${checked ? " checked" : ""}`}>{checked && <View className="radio-dot-inner" />}</View>
            <Text className="radio-label">{label}</Text>
        </View>
    );
}

/**
 * 实名认证页（自旧 pages/user/userCertification/index.vue 逐行移植）
 * - 支持个人/企业两种主体类型认证
 * - 填写姓名、证件类型、证件号码、证件有效期、证件照等
 * - 企业认证额外需要企业名称、注册地址、营业执照等
 * - 提交后进入审核流程，可查看审核状态
 */
export default function UserCertification() {
    usePageGuards();

    const companyDataType = useConfigStore((s) => s.companyDataType);
    const companyDataTips = useConfigStore((s) => s.companyDataTips);

    const [currentStep, setCurrentStep] = useState(1);
    const stepList = useRef<string[]>([t("资料填写"), t("审核及公示")]);

    const [formState, setFormState] = useState<any>({
        type: useConfigStore.getState().companyDataType == 1 ? 2 : 1,
        status: 0,
        companyData: {
            frontOfPhoto: [],
            backOfPhoto: [],
            licenseAddrProvince: [],
            supplementaryInformation: [],
            businessLicenseImg: [],
            // sex: 1,
            operatingTermType: 1,
            operatingTermTypeDate: [] as string[],
            operatingTermTypeEnd: "",
            certificateValidityPeriod: 1,
            certificateValidityPeriodDate: [] as string[],
            certificateValidityPeriodEnd: ""
        }
    });

    const [loadStatus, setLoadStatus] = useState(false);
    const [certificateValidityPeriodText, setCertificateValidityPeriodText] = useState("");
    const [documentTypeText, setDocumentTypeText] = useState("");
    const [showDocumentType, setShowDocumentType] = useState(false);

    const [showDatetime, setShowDatetime] = useState(false);
    const [drteTimeKey, setDrteTimeKey] = useState("");
    const [showSelectDate, setShowSelectDate] = useState(false);

    const [showRegisteredAddress, setShowRegisteredAddress] = useState(false);
    const [registeredAddress, setRegisteredAddress] = useState("");

    // 旧 apply ref 仅记录最近一次 getMyApply 结果
    const applyRef = useRef<any>({ id: 0, status: 0, type: 0 });

    const documentType = useRef([
        { value: 1, name: t("大陆身份证") },
        { value: 2, name: t("护照（限境外人士）") },
        { value: 3, name: t("来往内地通行证（中国香港居民）") },
        { value: 4, name: t("来往内地通行证（中国澳门居民）") },
        { value: 5, name: t("来往大陆通行证（中国台湾居民）") }
    ]).current;

    const updateFormState = (patch: Record<string, any>) => {
        setFormState((prev: any) => ({ ...prev, ...patch }));
    };

    const updateCompanyData = (key: string, value: any) => {
        setFormState((prev: any) => ({ ...prev, companyData: { ...prev.companyData, [key]: value } }));
    };

    // 旧 up-datetime-picker 的 formatter（Taro Picker 原生日期面板不支持自定义 formatter，保留函数备查）
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

    const handleShowDatetime = (key: string) => {
        setDrteTimeKey(key);
        setShowDatetime(true);
    };
    void showDatetime;
    void handleShowDatetime;

    const getBirthday = (key: string, value?: any) => {
        if (value) {
            updateCompanyData(key, dayjs(value).format("YYYY-MM-DD"));
        }
        setShowDatetime(false);
    };

    const handleShowSelectDate = (key: string) => {
        setShowSelectDate(true);
        setDrteTimeKey(key);
    };
    const handleSelectDateconfirm = (val: string[]) => {
        updateCompanyData(drteTimeKey, JSON.parse(JSON.stringify(val)));
    };

    const documentTypeSelect = (val: { value: number; name: string }) => {
        updateCompanyData("documentType", val.value);
        setDocumentTypeText(val.name);
    };

    const getValidity = (_e?: any) => {
        // 旧实现同时绑定在「证件有效期」与「营业期限」两组 radio 上，均只重置证件有效期字段；此处逐行保留
        // TODO(MIGRATION)：营业期限变化应重置 operatingTermTypeDate/End，待产品确认
        updateCompanyData("certificateValidityPeriodDate", [
            new Date().toISOString().split("T")[0],
            new Date().toISOString().split("T")[0]
        ]);
        updateCompanyData("certificateValidityPeriodEnd", new Date().toISOString().split("T")[0]);
    };

    /** 旧 up-form rules（error-type=toast）等价校验，返回第一条错误文案 */
    const validateForm = (): string | null => {
        const data = formState.companyData;
        if (!(data.certificateValidityPeriodDate?.length > 0 || data.certificateValidityPeriodEnd)) {
            return t("请选择证件有效期!");
        }
        if (!data.contactPhone) {
            return t("请输入手机号码!");
        }
        if (!/^1[3456789]\d{9}$/.test(data.contactPhone)) {
            return t("请输入有效的手机号码");
        }
        if (!data.birthday) {
            return t("请选择出生日期!");
        }
        if (!(data.frontOfPhoto?.length > 0 && data.frontOfPhoto[0].picUrl)) {
            return t("请上传证件正面照");
        }
        if (!(data.backOfPhoto?.length > 0 && data.backOfPhoto[0].picUrl)) {
            return t("请上传证件反面照");
        }
        if (formState.type == 2 && !(data.businessLicenseImg?.length > 0 && data.businessLicenseImg[0].picUrl)) {
            return t("请上传营业执照照");
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
        if (formState.type == 2) {
            if (!data.companyName) {
                return t("请输入企业名称!");
            }
            if (!data.licenseAddrProvince || data.licenseAddrProvince.length === 0) {
                return t("请选择注册地址");
            }
            if (!data.businessLicenseAddress) {
                return t("请输入详细地址!");
            }
            if (!data.businessScope) {
                return t("请输入经营范围!");
            }
            if (!data.businessLicenseId) {
                return t("请输入统一社会信用代码!");
            }
            if (!(data.operatingTermTypeDate?.length > 0 || data.operatingTermTypeEnd)) {
                return t("请选择营业期限!");
            }
        }
        return null;
    };

    const getData = async (id: number) => {
        try {
            const result: any = await getApplyInfo(id);
            setCertificateValidityPeriodText(
                result.companyData.certificateValidityPeriod == 1
                    ? result.companyData.certificateValidityPeriodDate.join(" ～  ")
                    : result.companyData.certificateValidityPeriodEnd + " ～  " + t("长期")
            );
            setDocumentTypeText(documentType.find((item) => item.value == result.companyData.documentType)?.name!);
            setFormState((prev: any) => Object.assign({}, prev, result));
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        }
    };

    const getDetail = async () => {
        setLoadStatus(true);
        try {
            const result: any = await getMyApply();
            if (result && result.id) {
                setCurrentStep(2);
                applyRef.current = Object.assign({}, applyRef.current, result);
                await getData(applyRef.current.id);
            }
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        } finally {
            setLoadStatus(false);
        }
    };

    const handleSubmit = async () => {
        const message = validateForm();
        if (message) {
            Taro.showToast({
                title: message,
                icon: "none"
            });
            return;
        }
        try {
            await applyApply(formState);
            Taro.showToast({
                title: t("提交成功")
            });
            await getDetail();
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        }
    };

    const handlBtn = async (_val: string) => {
        void _val;
        void handleSubmit();
    };

    const handleShowRegisteredAddress = () => {
        setShowRegisteredAddress(true);
    };

    const getregisteredAddress = (val: string[]) => {
        setRegisteredAddress(val.join(" "));
    };

    const handlReapply = () => {
        setFormState((prev: any) => ({
            ...prev,
            type: companyDataType == 1 ? 2 : 1,
            status: 0
        }));
    };

    useEffect(() => {
        void getDetail();
        // 仅挂载执行一次（对应旧 onMounted）
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** 单日期 Picker 公共属性（旧 up-datetime-picker mode=date、min-date=1） */
    const datePickerProps = {
        mode: "date" as const,
        start: "1970-01-01"
    };

    return (
        <TigLayout title={t("实名认证")}>
            <Steps currentStep={currentStep - 1} stepList={stepList.current} />
            {!loadStatus && (
                <>
                    {formState.status == 0 && (
                        <View className="form-box">
                            <View className="form-list">
                                <FormRow label={`${t("主体类型")}：`} required>
                                    <View className="sex-box">
                                        <View className="radio-group" style={{ width: "485rpx", justifyContent: "end" }}>
                                            {companyDataType != 1 && (
                                                <RadioItem
                                                    checked={formState.type == 1}
                                                    label={t("个人")}
                                                    style={{ paddingRight: "15rpx" }}
                                                    onSelect={() => updateFormState({ type: 1 })}
                                                />
                                            )}
                                            <RadioItem checked={formState.type == 2} label={t("企业")} onSelect={() => updateFormState({ type: 2 })} />
                                        </View>
                                    </View>
                                </FormRow>
                                {formState.type == 1 && (
                                    <FormRow label={`${t("姓名")}：`} required>
                                        <Input
                                            className="form-input right"
                                            value={formState.companyData.corporateName || ""}
                                            placeholder={t("请输入姓名")}
                                            onInput={(e) => updateCompanyData("corporateName", e.detail.value)}
                                        />
                                    </FormRow>
                                )}
                                {formState.type == 2 && (
                                    <FormRow label={`${t("法人姓名")}：`} required>
                                        <Input
                                            className="form-input right"
                                            value={formState.companyData.corporateName || ""}
                                            placeholder={t("请输入姓名")}
                                            onInput={(e) => updateCompanyData("corporateName", e.detail.value)}
                                        />
                                    </FormRow>
                                )}
                                <FormRow label={`${t("联系人手机")}：`} required>
                                    <Input
                                        className="form-input right"
                                        value={formState.companyData.contactPhone || ""}
                                        placeholder={t("请输入联系人手机")}
                                        onInput={(e) => updateCompanyData("contactPhone", e.detail.value)}
                                    />
                                </FormRow>
                                <FormRow label={`${t("居住地址")}：`} required>
                                    <Input
                                        className="form-input right"
                                        value={formState.companyData.residentialAddress || ""}
                                        placeholder={t("请输入居住地址")}
                                        onInput={(e) => updateCompanyData("residentialAddress", e.detail.value)}
                                    />
                                </FormRow>
                                <FormRow label={`${t("出生日期")}：`} required>
                                    <Picker
                                        {...datePickerProps}
                                        value={formState.companyData.birthday || dayjs().format("YYYY-MM-DD")}
                                        onChange={(e) => getBirthday("birthday", e.detail.value)}
                                    >
                                        <DatetimeItem
                                            modelValue={formState.companyData.birthday}
                                            onClick={() => setDrteTimeKey("birthday")}
                                        />
                                    </Picker>
                                </FormRow>
                                <FormRow label={`${t("证件类型")}：`} required onClick={() => setShowDocumentType(true)}>
                                    <View className="select-value">
                                        <Input
                                            className="form-input right"
                                            value={documentTypeText}
                                            disabled
                                            placeholder={t("请选择证件类型")}
                                        />
                                        <Text className="iconfont-h5 icon-arrowright arrow-right" />
                                    </View>
                                </FormRow>
                                <FormRow label={`${t("证件号码")}：`} required>
                                    <Input
                                        className="form-input right"
                                        value={formState.companyData.documentNumber || ""}
                                        placeholder={t("请输入证件号码")}
                                        onInput={(e) => updateCompanyData("documentNumber", e.detail.value)}
                                    />
                                </FormRow>

                                <FormRow label={`${t("证件有效期")}：`} required labelPosition="top" className="special-item">
                                    <View>
                                        <View className="certificate-validity-item">
                                            <View className="radio-group column">
                                                <RadioItem
                                                    checked={formState.companyData.certificateValidityPeriod == 1}
                                                    label={t("区间有效")}
                                                    onSelect={() => {
                                                        // 旧 up-radio-group @change 仅在值变化时触发
                                                        if (formState.companyData.certificateValidityPeriod != 1) {
                                                            updateCompanyData("certificateValidityPeriod", 1);
                                                            getValidity();
                                                        }
                                                    }}
                                                />
                                            </View>
                                            <View className="validity-item-text">
                                                <DatetimeItem
                                                    type={2}
                                                    modelValue={formState.companyData.certificateValidityPeriodDate}
                                                    disabled={formState.companyData.certificateValidityPeriod == 2}
                                                    onClick={() => {
                                                        if (!(formState.companyData.certificateValidityPeriod == 2)) {
                                                            handleShowSelectDate("certificateValidityPeriodDate");
                                                        }
                                                    }}
                                                />
                                            </View>
                                        </View>

                                        <View className="certificate-validity-item">
                                            <View className="radio-group column">
                                                <RadioItem
                                                    checked={formState.companyData.certificateValidityPeriod == 2}
                                                    label={t("长期有效")}
                                                    onSelect={() => {
                                                        if (formState.companyData.certificateValidityPeriod != 2) {
                                                            updateCompanyData("certificateValidityPeriod", 2);
                                                            getValidity();
                                                        }
                                                    }}
                                                />
                                            </View>
                                            <View className="period_end-box">
                                                <Picker
                                                    {...datePickerProps}
                                                    value={
                                                        formState.companyData.certificateValidityPeriodEnd ||
                                                        dayjs().format("YYYY-MM-DD")
                                                    }
                                                    onChange={(e) =>
                                                        getBirthday("certificateValidityPeriodEnd", e.detail.value)
                                                    }
                                                >
                                                    <DatetimeItem
                                                        modelValue={formState.companyData.certificateValidityPeriodEnd}
                                                        disabled={formState.companyData.certificateValidityPeriod == 1}
                                                        onClick={() => setDrteTimeKey("certificateValidityPeriodEnd")}
                                                    />
                                                </Picker>
                                                <View>- {t("长期")}</View>
                                            </View>
                                        </View>
                                    </View>
                                </FormRow>

                                <FormRow label={`${t("证件照正面")}：`} required labelPosition="top" className="special-item">
                                    <View className="upload-box">
                                        <TigImageUpload
                                            limit={1}
                                            modelValue={formState.companyData.frontOfPhoto || []}
                                            onModelValueChange={(list) => updateCompanyData("frontOfPhoto", list)}
                                        />
                                    </View>
                                </FormRow>
                                <FormRow label={`${t("证件照反面")}:`} required labelPosition="top" className="special-item">
                                    <View className="upload-box">
                                        <TigImageUpload
                                            limit={1}
                                            modelValue={formState.companyData.backOfPhoto || []}
                                            onModelValueChange={(list) => updateCompanyData("backOfPhoto", list)}
                                        />
                                    </View>
                                </FormRow>
                                {formState.type == 2 && (
                                    <>
                                        <FormRow label={`${t("企业名称")}：`} required>
                                            <Input
                                                className="form-input right"
                                                value={formState.companyData.companyName || ""}
                                                placeholder={t("请输入企业名称")}
                                                onInput={(e) => updateCompanyData("companyName", e.detail.value)}
                                            />
                                        </FormRow>
                                        <FormRow label={`${t("注册地址")}：`} required onClick={handleShowRegisteredAddress}>
                                            <View className="select-value">
                                                <Input
                                                    className="form-input right"
                                                    value={registeredAddress}
                                                    disabled
                                                    placeholder={t("请选择注册地址")}
                                                />
                                                <Text className="iconfont-h5 icon-arrowright arrow-right" />
                                            </View>
                                        </FormRow>
                                        <FormRow label={`${t("详细地址")}：`} required>
                                            <Input
                                                className="form-input right"
                                                value={formState.companyData.businessLicenseAddress || ""}
                                                placeholder={t("请输入详细地址")}
                                                onInput={(e) => updateCompanyData("businessLicenseAddress", e.detail.value)}
                                            />
                                        </FormRow>
                                        <FormRow label={`${t("经营范围")}：`} required>
                                            <Input
                                                className="form-input right"
                                                value={formState.companyData.businessScope || ""}
                                                placeholder={t("请输入经营范围")}
                                                onInput={(e) => updateCompanyData("businessScope", e.detail.value)}
                                            />
                                        </FormRow>
                                        <FormRow label={`${t("社会信用代码")}：`} required>
                                            <Input
                                                className="form-input right"
                                                value={formState.companyData.businessLicenseId || ""}
                                                placeholder={t("请输入统一社会信用代码")}
                                                onInput={(e) => updateCompanyData("businessLicenseId", e.detail.value)}
                                            />
                                        </FormRow>
                                        <FormRow label={`${t("营业期限")}：`} required labelPosition="top" className="special-item">
                                            <View>
                                                <View className="certificate-validity-item">
                                                    <View className="radio-group column">
                                                        <RadioItem
                                                            checked={formState.companyData.operatingTermType == 1}
                                                            label={t("区间有效")}
                                                            onSelect={() => {
                                                                if (formState.companyData.operatingTermType != 1) {
                                                                    updateCompanyData("operatingTermType", 1);
                                                                    getValidity();
                                                                }
                                                            }}
                                                        />
                                                    </View>
                                                    <View className="validity-item-text">
                                                        <DatetimeItem
                                                            type={2}
                                                            modelValue={formState.companyData.operatingTermTypeDate}
                                                            disabled={formState.companyData.operatingTermType == 2}
                                                            onClick={() => {
                                                                if (!(formState.companyData.operatingTermType == 2)) {
                                                                    handleShowSelectDate("operatingTermTypeDate");
                                                                }
                                                            }}
                                                        />
                                                    </View>
                                                </View>
                                                <View className="certificate-validity-item">
                                                    <View className="radio-group column">
                                                        <RadioItem
                                                            checked={formState.companyData.operatingTermType == 2}
                                                            label={t("长期有效")}
                                                            onSelect={() => {
                                                                if (formState.companyData.operatingTermType != 2) {
                                                                    updateCompanyData("operatingTermType", 2);
                                                                    getValidity();
                                                                }
                                                            }}
                                                        />
                                                    </View>
                                                    <View className="period_end-box">
                                                        <Picker
                                                            {...datePickerProps}
                                                            value={
                                                                formState.companyData.operatingTermTypeEnd ||
                                                                dayjs().format("YYYY-MM-DD")
                                                            }
                                                            onChange={(e) =>
                                                                getBirthday("operatingTermTypeEnd", e.detail.value)
                                                            }
                                                        >
                                                            <DatetimeItem
                                                                modelValue={formState.companyData.operatingTermTypeEnd}
                                                                disabled={formState.companyData.operatingTermType == 1}
                                                                onClick={() => setDrteTimeKey("operatingTermTypeEnd")}
                                                            />
                                                        </Picker>
                                                        <View>- {t("长期")}</View>
                                                    </View>
                                                </View>
                                            </View>
                                        </FormRow>
                                        <FormRow label={`${t("营业执照")}：`} required labelPosition="top" className="special-item">
                                            <View className="upload-box">
                                                <TigImageUpload
                                                    limit={1}
                                                    modelValue={formState.companyData.businessLicenseImg || []}
                                                    onModelValueChange={(list) => updateCompanyData("businessLicenseImg", list)}
                                                />
                                            </View>
                                        </FormRow>
                                    </>
                                )}
                            </View>
                        </View>
                    )}

                    {formState.status != 0 && (
                        <>
                            <View className="status-box">
                                <View className="status-text">
                                    {formState.status == 1 && (
                                        <View>
                                            {t("申请已受理")}（{formState.addTime}），{t("将在")} {companyDataTips || 3} {t("个工作日内完成审核")}
                                            。{t("以下为本次申请内容")}：
                                        </View>
                                    )}
                                    {formState.status == 2 && (
                                        <>
                                            <View>
                                                {t(" 恭喜您")}，{t("您的申请审核")}
                                                <Text className="specaial-text">{t("已通过")}</Text>。
                                            </View>
                                            {formState.auditRemark && (
                                                <View>
                                                    {" "}
                                                    {t("备注")}：{formState.auditRemark}{" "}
                                                </View>
                                            )}
                                        </>
                                    )}
                                    {formState.status == 3 && (
                                        <>
                                            <View>
                                                {t("很遗憾")}，{t("您的申请审核")}
                                                <Text className="specaial-text">{t("未通过")}</Text>。
                                            </View>
                                            {formState.auditRemark && (
                                                <View>
                                                    {t("备注")}：{formState.auditRemark}
                                                </View>
                                            )}
                                        </>
                                    )}
                                </View>
                            </View>
                            <View className="form-box">
                                <View className="form-title">{t("个人信息")}</View>
                                <FormRow label={formState.type == 1 ? `${t("个人姓名")}：` : `${t("法人姓名")}：`}>
                                    <View className="form-input-text right">{formState.companyData.corporateName}</View>
                                </FormRow>
                                <FormRow label={`${t("证件类型")}：`}>
                                    <View className="form-input-text right">{documentTypeText}</View>
                                </FormRow>
                                <FormRow label={`${t("证件号码")}：`}>
                                    <View className="form-input-text right">{formState.companyData.documentNumber}</View>
                                </FormRow>
                                <FormRow label={`${t("出生日期")}：`}>
                                    <View className="form-input-text right">{formState.companyData.birthday}</View>
                                </FormRow>
                                <FormRow label={`${t("证件有效期")}：`}>
                                    <View className="form-input-text right">{certificateValidityPeriodText}</View>
                                </FormRow>
                                <FormRow label={`${t("手机号")}：`}>
                                    <View className="form-input-text right">{formState.companyData.contactPhone}</View>
                                </FormRow>
                                <FormRow label={`${t("居住地址")}：`}>
                                    <View className="input-text">{formState.companyData.residentialAddress}</View>
                                </FormRow>
                            </View>
                            <View className="form-box">
                                <View className="form-title">{t("证件照")}</View>
                                <FormRow label={`${t("证件照正面：")}`} labelPosition="top" className="noflex">
                                    <Image className="image-box" src={staticResource("common/lock@3x.png")} />
                                    <View style={{ paddingTop: "10rpx", width: "100%" }}>
                                        <View className="alert-box">
                                            <Text className="alert-icon">!</Text>
                                            <Text className="alert-desc">{t("为了保护个人隐私信息不泄露，该照片不予展示")}</Text>
                                        </View>
                                    </View>
                                </FormRow>
                                <FormRow label={`${t("证件照反面：")}`} labelPosition="top" className="noflex">
                                    <Image className="image-box" src={staticResource("common/lock@3x.png")} />
                                    <View style={{ paddingTop: "10rpx" }}>
                                        <View className="alert-box">
                                            <Text className="alert-icon">!</Text>
                                            <Text className="alert-desc">{t("为了保护个人隐私信息不泄露，该照片不予展示")}</Text>
                                        </View>
                                    </View>
                                </FormRow>
                            </View>
                            {formState.type == 2 && (
                                <View className="form-box">
                                    <View className="form-title">{t("企业信息")}</View>
                                    <FormRow label={`${t("企业名称")}：`}>
                                        <View className="form-input-text right">{formState.companyData.companyName}</View>
                                    </FormRow>
                                    <FormRow label={`${t("注册地址")}：`}>
                                        <View className="input-text">
                                            {(formState.companyData.licenseAddrProvinceName ||
                                                formState.companyData.businessLicenseAddress) && (
                                                <View className="input-content">
                                                    {formState.companyData.licenseAddrProvinceName +
                                                        formState.companyData.businessLicenseAddress}
                                                </View>
                                            )}
                                        </View>
                                    </FormRow>
                                    <FormRow label={`${t("经营范围")}：`}>
                                        <View className="input-text">
                                            <View className="input-content">{formState.companyData.businessScope}</View>
                                        </View>
                                    </FormRow>
                                    <FormRow label={`${t("社会信用代码")}：`}>
                                        <View className="form-input-text right">{formState.companyData.businessLicenseId}</View>
                                    </FormRow>
                                    <FormRow label={`${t("营业期限")}：`}>
                                        <View className="type-text" style={{ fontSize: "15px" }}>
                                            {formState.companyData.operatingTermType == 1 ? (
                                                <>
                                                    {formState.companyData.operatingTermTypeDate[0] + " ～  " + formState.companyData.operatingTermTypeDate[1]}
                                                </>
                                            ) : (
                                                <>
                                                    {" "}
                                                    {formState.companyData.operatingTermTypeEnd} ～{t("长期")}{" "}
                                                </>
                                            )}
                                        </View>
                                    </FormRow>
                                    {formState.companyData.businessLicenseImg.length > 0 && (
                                        <FormRow label={`${t("营业执照")}：`} labelPosition="top">
                                            {formState.companyData.businessLicenseImg.map((item: any, index: number) => (
                                                <TigImage className="image-box" key={index} src={item.picUrl} />
                                            ))}
                                        </FormRow>
                                    )}
                                </View>
                            )}
                        </>
                    )}
                </>
            )}

            {/* 旧 up-datetime-picker 共用弹层已由各字段外层 Taro Picker 替代，showDatetime 仅作状态保留 */}
            <SelectDate show={showSelectDate} onShowChange={setShowSelectDate} onConfirm={handleSelectDateconfirm} />

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
                show={showRegisteredAddress}
                onShowChange={setShowRegisteredAddress}
                modelValue={formState.companyData.licenseAddrProvince}
                onModelValueChange={(value) => updateCompanyData("licenseAddrProvince", value)}
                onSendRegionNames={getregisteredAddress}
            />

            {!loadStatus && (formState.status == 0 || formState.status == 3) && (
                <View className="fixed-placeholder">
                    <View className="fixed-content" style={{ backgroundColor: "#fff" }}>
                        <View className="btn-box">
                            {formState.status == 0 && (
                                <TigButton2 theme className="btn" onClick={() => handlBtn("next")}>
                                    {t("提交")}{" "}
                                </TigButton2>
                            )}
                            {formState.status == 3 && (
                                <TigButton2 theme className="btn" onClick={handlReapply}>
                                    {t("重新申请")}{" "}
                                </TigButton2>
                            )}
                        </View>
                    </View>
                    <View className="fixed-placeholder-pad" />
                </View>
            )}
        </TigLayout>
    );
}