import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Taro, { useDidShow, useRouter } from "@tarojs/taro";
import { Image, Input, PickerView, PickerViewColumn, ScrollView, Text, View } from "@tarojs/components";
import { Picker, Popup } from "@nutui/nutui-react-taro";

import SelectRegion from "@/components/region/SelectRegion";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigMobileAreacode from "@/components/tig/tig-mobile-areacode/TigMobileAreacode";
import { getCountryList, getRegionListByRegionId, type ChildRegion, type CountryRegion } from "@/api/region";
import { addAddressData, delAddress, getAddressData, getAddressTagList, updateAddressData } from "@/api/user/address";
import { isO2o, isOverseas, staticResource } from "@/utils";
import {
    CROSS_BORDER_COUNTRIES,
    buildCrossBorderAddressData,
    emptyCrossBorderAddressFields,
    formatCrossBorderAddress,
    getCrossBorderAddressDataFieldKey,
    getCrossBorderCountry,
    normalizeInternationalMobile,
    validateInternationalMobile,
    type CrossBorderAddressField,
    type CrossBorderAddressFieldKey,
    type CrossBorderCountry
} from "@/utils/crossBorderAddress";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";
import { isPostcodeValid } from "./utils/postcode";

import "./editRegion.scss";

/**
 * 地址编辑页（自旧 pages/address/editRegion.vue 移植）
 * - 新增或编辑收货地址
 * - 省市区三级联动选择（国内）/ 国家 + 动态地区层级（跨境）
 * - 表单校验收货人、手机号、详细地址
 * - 支持设为默认地址、地址标签
 *
 * 迁移说明：旧 up-form / up-input / up-switch / uni-easyinput / up-picker 均按原视觉以
 * Taro 基础组件 + 自绘等价重写；校验规则逐条落在 validateForm()（原 rules 表）。
 */
interface AddressForm {
    consignee: string;
    regionIds: number[];
    address: string;
    postcode: string;
    mobile: string;
    telephone: string;
    email: string;
    regionNames: string;
    isDefault: number;
    mobileAreaCode?: string;
    addressTag: string;
    positionAddress?: string;
    latitude?: number;
    longitude?: number;
    countryCode?: string;
}

type CountryOption = CrossBorderCountry & {
    id: string;
    regionId?: number;
    labelName: string;
    regionName: string;
    mobileAreaCode: string;
    flagUrl: string;
};

type DynamicRegionMode = "pending" | "loading" | "select" | "text" | "error";
type DynamicRegionLevel = CrossBorderAddressField & { mode: DynamicRegionMode; options: ChildRegion[]; selectedId: string; parentId: string };

interface FormItemProps {
    label: string;
    required?: boolean;
    error?: string;
    className?: string;
    children: ReactNode;
}

/** 旧 up-form-item 的 label 顶部 + 输入区结构等价重写（类名沿用 u-form-item，复刻原 scoped 样式） */
function FormItem({ label, required = false, error = "", className = "", children }: FormItemProps) {
    return (
        <View className={`u-form-item ${className} ${required ? "form-item--required" : "form-item--optional"}`}>
            <View className="u-form-item__body">
                <View className="u-form-item__body__left">
                    <View className="u-form-item__body__left__content__label">{label}</View>
                </View>
                <View className="u-form-item__body__right">
                    {required && <View className="icon">*</View>}
                    <View className="u-input__content">{children}</View>
                    {!!error && <View className="u-form-item__body__right__message">{error}</View>}
                </View>
            </View>
        </View>
    );
}

export default function EditRegion() {
    usePageGuards();

    const router = useRouter();
    const isOverseasMode = isOverseas();

    // ===== 页面级可变状态（对齐旧 setup 中的 reactive/ref） =====
    const [rev, setRev] = useState(0);
    const rerender = () => setRev((v) => v + 1);
    void rev;

    const formRef = useRef<AddressForm>({
        consignee: "",
        regionIds: [] as number[],
        address: "",
        postcode: "",
        mobile: "",
        telephone: "",
        email: "",
        regionNames: "",
        isDefault: 0,
        mobileAreaCode: "86",
        addressTag: "",
        positionAddress: "",
        countryCode: "CN"
    });

    const [title, setTitle] = useState(t("添加地址"));
    const [id, setId] = useState<any>(null);
    const addIsSelectedRef = useRef(0);
    const isCheckRef = useRef(false);

    /** 国家根节点；未选择国家时为空，地区选择器按原有接口取数 */
    const [selectedCountryRootId, setSelectedCountryRootId] = useState<number | undefined>(undefined);

    const countryOptionsRef = useRef<CountryOption[]>([]);
    const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);
    const countryIndexRef = useRef(0);
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [countryPickerIndex, setCountryPickerIndex] = useState<number[]>([0]);
    const [countryLabel, setCountryLabel] = useState("");

    const [isDefault, setIsDefault] = useState(false);
    const DEFAULT_ADDRESS_TAGS = ["家", "公司", "学校"];
    const [presetTags, setPresetTags] = useState<string[]>([...DEFAULT_ADDRESS_TAGS]);
    const presetTagsRef = useRef<string[]>([...DEFAULT_ADDRESS_TAGS]);
    const [isCustomTag, setIsCustomTag] = useState(false);
    const [customTag, setCustomTag] = useState("");

    const crossBorderFieldsRef = useRef<Record<CrossBorderAddressFieldKey, string>>(emptyCrossBorderAddressFields());
    const dynamicRegionLevelsRef = useRef<DynamicRegionLevel[]>([]);
    const regionRequestVersionRef = useRef(0);
    const [showDynamicRegionPicker, setShowDynamicRegionPicker] = useState(false);
    const [activeDynamicRegionIndex, setActiveDynamicRegionIndex] = useState(0);

    const [showSelectRegion, setShowSelectRegion] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // ===== 跨境地址计算属性（旧 computed：均从可变 ref 读取） =====
    const getCurrentCountry = (): CountryOption => {
        const countryCode = formRef.current.countryCode;
        const found = countryOptionsRef.current.find((country) => country.code === countryCode);
        if (found) return found;
        const country = getCrossBorderCountry(countryCode);
        return {
            ...country,
            id: "",
            regionName: country.name,
            labelName: t(country.name),
            mobileAreaCode: country.dialCode,
            flagUrl: staticResource(`country-flags/${String(countryCode || "CN").toLowerCase()}.svg`)
        } as CountryOption;
    };

    const currentCountry = getCurrentCountry();

    const getActiveDynamicRegionLevel = () => dynamicRegionLevelsRef.current[activeDynamicRegionIndex];
    const activeDynamicRegionLevel = getActiveDynamicRegionLevel();

    const hasDynamicRegionSelector = dynamicRegionLevelsRef.current.some((level) => level.mode !== "text");
    const textDynamicRegionLevels = dynamicRegionLevelsRef.current.filter((level) => level.mode === "text");
    const hasRequiredDynamicRegion = dynamicRegionLevelsRef.current.some((level) => level.required && level.mode !== "text");

    const getDynamicRegionDisplayText = () =>
        dynamicRegionLevelsRef.current
            .filter((level) => level.mode !== "text")
            .map((level) => crossBorderFieldsRef.current[level.key])
            .filter(Boolean)
            .join(" ");
    const dynamicRegionDisplayText = getDynamicRegionDisplayText();

    const visibleDynamicRegionLevels = dynamicRegionLevelsRef.current.flatMap((level, index) => {
        if (level.mode === "text") return [];
        if (index === 0) return [{ level, index }];
        const previous = dynamicRegionLevelsRef.current[index - 1];
        return previous?.mode === "select" && Boolean(previous.selectedId) && level.mode === "select" ? [{ level, index }] : [];
    });
    const currentCountryFlagUrl = currentCountry.flagUrl || staticResource(`country-flags/${currentCountry.code.toLowerCase()}.svg`);

    const getRegionOptionId = (option?: ChildRegion) => String(option?.regionId || "");

    const createDynamicRegionLevels = () =>
        currentCountry.regionFields.map((field) => ({ ...field, mode: "pending" as DynamicRegionMode, options: [] as ChildRegion[], selectedId: "", parentId: "" }));

    const resetDynamicRegionLevelsAfter = (index: number) =>
        dynamicRegionLevelsRef.current.slice(index + 1).forEach((child) => {
            child.mode = "pending";
            child.options = [];
            child.selectedId = "";
            child.parentId = "";
            crossBorderFieldsRef.current[child.key] = "";
        });

    const setTextRegionLevels = (index: number) =>
        dynamicRegionLevelsRef.current.slice(index).forEach((child) => {
            child.mode = "text";
            child.options = [];
            child.selectedId = "";
            child.parentId = "";
        });

    // 子级接口无数据时，当前节点即为叶子节点，不再展示无意义的后续层级。
    const removeDynamicRegionLevelsAfter = (index: number) => {
        dynamicRegionLevelsRef.current.slice(index + 1).forEach((child) => {
            crossBorderFieldsRef.current[child.key] = "";
        });
        dynamicRegionLevelsRef.current.splice(index + 1);
        setActiveDynamicRegionIndex((prev) => Math.min(prev, Math.max(0, dynamicRegionLevelsRef.current.length - 1)));
    };

    const loadDynamicRegionLevel = async (
        index: number,
        parentId: string,
        restoreIds: string[] = [],
        restoreNames: string[] = [],
        requestVersion = regionRequestVersionRef.current
    ): Promise<void> => {
        const level = dynamicRegionLevelsRef.current[index];
        if (!level || requestVersion !== regionRequestVersionRef.current) return;
        level.mode = "loading";
        level.parentId = parentId;
        rerender();
        try {
            const options = (await getRegionListByRegionId(parentId)) as unknown as ChildRegion[];
            if (requestVersion !== regionRequestVersionRef.current) return;
            if (!options.length) {
                if (index === 0) setTextRegionLevels(index);
                else {
                    crossBorderFieldsRef.current[level.key] = "";
                    dynamicRegionLevelsRef.current.splice(index);
                }
                rerender();
                return;
            }
            level.options = options;
            level.mode = "select";
            const selected = options.find((option) => getRegionOptionId(option) === String(restoreIds[index] || ""));
            level.selectedId = getRegionOptionId(selected);
            crossBorderFieldsRef.current[level.key] = selected?.regionName || String(restoreNames[index] || "");
            if (selected && dynamicRegionLevelsRef.current[index + 1])
                await loadDynamicRegionLevel(index + 1, level.selectedId, restoreIds, restoreNames, requestVersion);
            else resetDynamicRegionLevelsAfter(index);
            rerender();
        } catch (error) {
            level.mode = "error";
            Taro.showToast({ title: t("地区加载失败，请重试"), icon: "none" });
            console.error(error);
            rerender();
        }
    };

    const initializeDynamicRegions = async (restoreIds: string[] = [], restoreNames: string[] = []) => {
        regionRequestVersionRef.current += 1;
        dynamicRegionLevelsRef.current = createDynamicRegionLevels();
        setActiveDynamicRegionIndex(0);
        const firstLevel = dynamicRegionLevelsRef.current[0];
        if (!firstLevel) return;
        const country = getCurrentCountry();
        const root = String(country.regionId || country.id || "");
        if (!root || !Number.isFinite(Number(root)) || Number(root) <= 0) {
            firstLevel.mode = "error";
            Taro.showToast({ title: t("当前地区暂不支持添加地址，请联系客服解决"), icon: "none" });
            rerender();
            return;
        }
        await loadDynamicRegionLevel(0, root, restoreIds, restoreNames, regionRequestVersionRef.current);
    };

    const selectDynamicRegionOption = async (option: ChildRegion) => {
        const level = getActiveDynamicRegionLevel();
        if (!level) return;
        level.selectedId = getRegionOptionId(option);
        crossBorderFieldsRef.current[level.key] = option.regionName;
        formRef.current.regionIds[activeDynamicRegionIndex] = Number(option.regionId);
        formRef.current.regionIds.splice(activeDynamicRegionIndex + 1);
        resetDynamicRegionLevelsAfter(activeDynamicRegionIndex);
        const nextIndex = activeDynamicRegionIndex + 1;
        if (dynamicRegionLevelsRef.current[nextIndex]) {
            await loadDynamicRegionLevel(nextIndex, level.selectedId);
            if (dynamicRegionLevelsRef.current[nextIndex]?.mode === "select") setActiveDynamicRegionIndex(nextIndex);
            else {
                removeDynamicRegionLevelsAfter(activeDynamicRegionIndex);
                setShowDynamicRegionPicker(false);
            }
        } else {
            removeDynamicRegionLevelsAfter(activeDynamicRegionIndex);
            setShowDynamicRegionPicker(false);
        }
        formRef.current.regionNames = getDynamicRegionDisplayText();
        rerender();
    };

    const openDynamicRegionPicker = () => {
        const index = dynamicRegionLevelsRef.current.findIndex((level) => level.mode === "select" && !level.selectedId);
        setActiveDynamicRegionIndex(index >= 0 ? index : 0);
        setShowDynamicRegionPicker(true);
    };

    const retryActiveDynamicRegion = async () => {
        const level = getActiveDynamicRegionLevel();
        if (level?.parentId) await loadDynamicRegionLevel(activeDynamicRegionIndex, level.parentId);
        else await initializeDynamicRegions();
    };

    const dynamicRegionTabLabel = (level: DynamicRegionLevel) => crossBorderFieldsRef.current[level.key] || t("请选择");

    const activateDynamicRegionLevel = (index: number) => {
        if (index <= 0 || dynamicRegionLevelsRef.current[index - 1]?.selectedId) setActiveDynamicRegionIndex(index);
    };

    const hasUnresolvedRequiredDynamicRegion = () =>
        dynamicRegionLevelsRef.current.some(
            (level) =>
                level.required && (level.mode === "pending" || level.mode === "loading" || level.mode === "error" || (level.mode === "select" && !level.selectedId))
        );

    const showContactExtras = isOverseasMode ? currentCountry.code === "CN" : true;

    // ===== 国家列表 / 标签 =====
    const loadCountries = async () => {
        if (!isOverseas()) return;
        try {
            const regions: CountryRegion[] = (await getCountryList()) || [];
            // 国家选择器以接口返回结果为准。CROSS_BORDER_COUNTRIES 只负责提供字段、校验等前端配置，
            // 不把接口没有返回的国家补回列表，避免后端只开放一个国家时页面仍显示多个。
            const nextOptions = regions
                .map((region): CountryOption | null => {
                    const code = String(region.standardCode || "").toUpperCase() as CrossBorderCountry["code"];
                    const country = CROSS_BORDER_COUNTRIES.find((item) => item.code === code);
                    if (!country) return null;
                    return {
                        ...country,
                        id: String(region.regionId || country.code),
                        regionId: region.regionId,
                        regionName: region.regionName || country.name,
                        labelName: t(region.regionName || country.name),
                        mobileAreaCode: String(region.mobileAreaCode || country.dialCode).replace(/\D/g, "") || country.dialCode,
                        flagUrl: staticResource(`country-flags/${country.code.toLowerCase()}.svg`)
                    };
                })
                .filter((country): country is CountryOption => Boolean(country));
            countryOptionsRef.current = nextOptions;
            setCountryOptions(nextOptions);

            const current = nextOptions.findIndex((item) => item.code === String(formRef.current.countryCode || "CN").toUpperCase());
            countryIndexRef.current = current >= 0 ? current : 0;
            const selected = nextOptions[countryIndexRef.current];
            if (selected && !formRef.current.countryCode) formRef.current.countryCode = selected.code;
            // 接口未返回区号时按当前国家设置默认值；已有用户选择必须保留。
            if (selected && !String(formRef.current.mobileAreaCode || "").trim()) formRef.current.mobileAreaCode = selected.mobileAreaCode;
            setSelectedCountryRootId(selected?.regionId);
            setCountryLabel(selected?.labelName || t(getCrossBorderCountry(formRef.current.countryCode).name));
            rerender();
        } catch (error) {
            console.error("获取国家列表失败:", error);
        }
    };

    const loadAddressTags = async () => {
        try {
            const result = await getAddressTagList();
            if (Array.isArray(result) && result.length > 0) {
                presetTagsRef.current = result;
                setPresetTags(result);
            }
        } catch (error) {
            console.error("获取地址标签失败:", error);
        }
    };

    const selectCountry = (selected: CountryOption | undefined, index: number) => {
        if (!selected) return;
        countryIndexRef.current = index;
        setCountryLabel(selected.labelName);
        formRef.current.countryCode = selected.code;
        formRef.current.mobileAreaCode = selected.mobileAreaCode;
        formRef.current.regionIds = [];
        formRef.current.regionNames = "";
        crossBorderFieldsRef.current = emptyCrossBorderAddressFields();
        setSelectedCountryRootId(selected.regionId);
        void initializeDynamicRegions();
        setShowCountryPicker(false);
        rerender();
    };

    const openCountryPicker = () => {
        const selectedIndex = countryOptionsRef.current.findIndex((country) => country.code === formRef.current.countryCode);
        setCountryPickerIndex([Math.max(0, selectedIndex)]);
        setShowCountryPicker(true);
    };

    const handleCountryPickerChange = (event: any) => {
        const selectedIndex = Number(event.detail?.value?.[0] ?? 0);
        setCountryPickerIndex([Math.min(Math.max(selectedIndex, 0), Math.max(countryOptionsRef.current.length - 1, 0))]);
    };

    const readCountryPickerIndexFromView = () => {
        const content = document.querySelector(".country-picker-view .uni-picker-view-content") as HTMLElement | null;
        const indicator = document.querySelector(".country-picker-view .uni-picker-view-indicator") as HTMLElement | null;
        const itemHeight = indicator?.offsetHeight || 0;
        const offset = Number(/translateY\((-?[\d.]+)px\)/.exec(content?.style.transform || "")?.[1]);
        if (!itemHeight || !Number.isFinite(offset)) return null;
        return Math.round(Math.abs(offset) / itemHeight);
    };

    const confirmCountryPicker = () => {
        let index = countryPickerIndex[0] ?? 0;
        if (process.env.TARO_ENV === "h5") {
            const indexFromView = readCountryPickerIndexFromView();
            if (indexFromView !== null) index = indexFromView;
        }
        index = Math.min(Math.max(index, 0), Math.max(countryOptionsRef.current.length - 1, 0));
        selectCountry(countryOptionsRef.current[index], index);
    };

    const handleCountryConfirm = (selectedOptions: any[], selectedValue?: (string | number | null)[]) => {
        // 旧 up-picker key-name="labelName" 直接回传选项对象；NutUI Picker 回传 {label,value}，按 value(=国家 id) 映射回国家配置
        const value = selectedValue?.[0] ?? selectedOptions?.[0]?.value;
        const index = countryOptionsRef.current.findIndex((country) => String(country.id) === String(value) || country.code === String(value));
        selectCountry(countryOptionsRef.current[Math.max(index, 0)], Math.max(index, 0));
    };

    // ===== 地址标签 =====
    const selectPresetTag = (tag: string) => {
        setIsCustomTag(false);
        setCustomTag("");
        formRef.current.addressTag = formRef.current.addressTag === tag ? "" : tag;
        rerender();
    };

    const handleCustomTag = () => {
        setIsCustomTag(true);
        formRef.current.addressTag = customTag;
        rerender();
    };

    const handleCustomTagInput = (value: string) => {
        setCustomTag(value);
        formRef.current.addressTag = value;
    };

    // ===== 表单校验（原 up-form rules 逐条平移） =====
    const clearError = (key: string) => {
        setErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const validateForm = () => {
        const form = formRef.current;
        const nextErrors: Record<string, string> = {};

        // rules.consignee
        if (!String(form.consignee || "").trim()) nextErrors.consignee = t("请您填写收货人姓名");

        // rules.regionNames（跨境：仅地区选择器渲染时才校验，未渲染的表单项不参与校验）
        if (isOverseasMode) {
            if (hasDynamicRegionSelector && (hasUnresolvedRequiredDynamicRegion() || (form.regionIds.length < 1 && !String(form.regionNames || "").trim()))) {
                nextErrors.regionNames = t("请选择所在地区");
            }
        } else if (!String(form.regionNames || "").trim() || form.regionIds.length < 1) {
            nextErrors.regionNames = t("请选择所在地区");
        }

        // rules.address（仅国内表单渲染）
        if (!isOverseasMode && !String(form.address || "").trim()) nextErrors.address = t("请您填写详细收货地址");

        // rules.postcode
        if (isOverseasMode) {
            const field = currentCountry.fields.find((item) => item.key === "postcode");
            const value = String(crossBorderFieldsRef.current.postcode || "");
            if (field?.required && !value.trim()) nextErrors.postcode = t("请您填写邮政编码");
            else if (value && currentCountry.postcodePattern && !currentCountry.postcodePattern.test(value.trim())) {
                nextErrors.postcode = t(currentCountry.postcodeMessage || "邮编格式不正确");
            }
        } else if (!isPostcodeValid(form.postcode, isOverseasMode)) {
            nextErrors.postcode = t("请您填写邮政编码");
        }

        // rules.mobile
        const mobileValue = String(form.mobile || "");
        if (!mobileValue.trim()) {
            nextErrors.mobile = t("请您填写收货人手机号码");
        } else if (isOverseas()) {
            const message = validateInternationalMobile(form.countryCode, mobileValue, form.mobileAreaCode, t);
            if (message) nextErrors.mobile = message;
        } else {
            const regex = /^(?:(?:\+|00)86)?1[3-9]\d{9}$/;
            if (!regex.test(mobileValue)) nextErrors.mobile = t("请输入正确的手机号码");
        }

        // dynamicFieldRules：文本型地区层 + 当前国家字段（未渲染的字段不参与校验）
        if (isOverseasMode) {
            textDynamicRegionLevels.forEach((level) => {
                if (level.required && !String(crossBorderFieldsRef.current[level.key] || "").trim()) nextErrors[level.key] = t(level.placeholder);
            });
            currentCountry.fields.forEach((field) => {
                if (field.required && !String(crossBorderFieldsRef.current[field.key] || "").trim()) nextErrors[field.key] = t(field.placeholder);
            });
        }

        return nextErrors;
    };

    const handleMobileAreaCodeChange = (value: string | number) => {
        formRef.current.mobileAreaCode = String(value || "").replace(/\D/g, "");
        // 旧 formRef.validateField("mobile")：区号变化后同步刷新该字段错误
        if (formRef.current.mobile) clearError("mobile");
        rerender();
    };

    // ===== 页面装载（旧 onLoad） =====
    useEffect(() => {
        void loadAddressTags();
        if (isOverseasMode) {
            void loadCountries().then(() => initializeDynamicRegions());
        }

        const option: any = router.params;
        if (option) {
            addIsSelectedRef.current = Number(option.isSelected) === 1 ? 1 : 0;

            if (option.id) {
                setTitle(t("编辑地址"));
                setId(option.id);
                void __getAddressData(option.id);
            }

            if (option.type && option.type === "check") {
                isCheckRef.current = true;
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧 onShow 里 formRef.setRules(rules)：规则已内聚到 validateForm，无需重复挂载
    useDidShow(() => {
        // 旧 nextTick(() => formRef.value?.setRules?.(rules)) 的等价空实现
    });

    const __getAddressData = async (addressId?: any) => {
        try {
            const result: any = await getAddressData({ id: addressId ?? id });
            const { regionNames } = result;
            const form = formRef.current;
            Object.assign(form, result);
            form.postcode = result.postcode ?? "";
            form.regionNames = Array.isArray(regionNames) ? regionNames.join(" ") : String(regionNames || "");
            if (!form.mobileAreaCode) {
                form.mobileAreaCode = "86";
            }
            if (isOverseasMode) {
                // 区号为空时交给国家列表回填该国默认值
                form.mobileAreaCode = String(result.mobileAreaCode || result.addressData?.mobileAreaCode || "").replace(/\D/g, "");
                Object.keys(crossBorderFieldsRef.current).forEach((key) => {
                    const fieldKey = key as CrossBorderAddressFieldKey;
                    crossBorderFieldsRef.current[fieldKey] = String(
                        (result as any)[fieldKey] || result.addressData?.[getCrossBorderAddressDataFieldKey(fieldKey)] || ""
                    );
                });
                getCurrentCountry().regionFields.forEach((field, index) => {
                    crossBorderFieldsRef.current[field.key] = String(
                        (Array.isArray(regionNames) ? regionNames[index] : "") || crossBorderFieldsRef.current[field.key] || ""
                    );
                });
                crossBorderFieldsRef.current.postcode = String(result.postcode || result.addressData?.postcode || "");
                if (!crossBorderFieldsRef.current.address && result.address) crossBorderFieldsRef.current.address = result.address;
                if (!crossBorderFieldsRef.current.addressLine1 && result.address && getCurrentCountry().code !== "CN")
                    crossBorderFieldsRef.current.addressLine1 = result.address;
                await loadCountries();
                await initializeDynamicRegions(
                    Array.isArray(result.regionIds) ? result.regionIds.map(String) : [],
                    Array.isArray(regionNames) ? regionNames : []
                );
            }
            setIsDefault(form.isDefault === 1);
            if (form.addressTag && !presetTagsRef.current.includes(form.addressTag)) {
                setIsCustomTag(true);
                setCustomTag(form.addressTag);
            }
            rerender();
        } catch (error) {
            console.error(error);
        }
    };

    const getRegionNames = async (val: string[]) => {
        const regionNames = val.join(" ");
        formRef.current.regionNames = regionNames;
        rerender();
    };

    const handleShowSelectRegion = () => {
        setShowSelectRegion(true);
    };

    const buildAddressPayload = () => {
        const form = formRef.current;
        if (isOverseasMode) {
            const country = getCurrentCountry();
            const regionNames = country.regionFields.map((field) => String(crossBorderFieldsRef.current[field.key] || "").trim()).filter(Boolean);
            return {
                consignee: String(form.consignee || "").trim(),
                mobile: normalizeInternationalMobile(form.countryCode, String(form.mobile || ""), form.mobileAreaCode),
                mobileAreaCode: String(form.mobileAreaCode || country.mobileAreaCode || country.dialCode),
                countryCode: country.code,
                regionIds: form.regionIds,
                regionNames,
                address: formatCrossBorderAddress(country.code, crossBorderFieldsRef.current),
                postcode: String(crossBorderFieldsRef.current.postcode || "").trim(),
                addressTag: form.addressTag,
                isDefault: isDefault ? 1 : 0,
                addressData: buildCrossBorderAddressData(country.code, crossBorderFieldsRef.current),
                ...(country.code === "CN" ? { telephone: form.telephone, email: form.email } : {})
            };
        }
        return { ...form, isDefault: isDefault ? 1 : 0 };
    };

    const onSubmit = () => {
        if (isCustomTag) {
            formRef.current.addressTag = customTag;
        }
        const nextErrors = validateForm();
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            console.log("表单错误信息：", nextErrors);
            return;
        }
        formRef.current.postcode = formRef.current.postcode.trim();
        formRef.current.isDefault = isDefault ? 1 : 0;
        if (id) {
            void edit();
        } else {
            void add();
        }
    };

    const add = async () => {
        setIsLoading(true);
        try {
            await addAddressData({
                ...buildAddressPayload(),
                ...(addIsSelectedRef.current === 1 ? { isSelected: 1 } : {})
            });
            Taro.showToast({
                title: t("添加地址成功"),
                icon: "none",
                duration: 1000
            });

            setTimeout(() => {
                Taro.navigateBack({
                    success: function () {
                        Taro.eventCenter.trigger("refreshData"); // 发送刷新信号
                        setIsLoading(false);
                    }
                });
            }, 1000);
        } catch (error: any) {
            console.error(error);
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1000
            });
            setIsLoading(false);
        }
    };

    const edit = async () => {
        setIsLoading(true);
        try {
            // 后端 user/address/update 用 addressId 定位记录，id 保留以兼容旧调用
            await updateAddressData({ id, addressId: id, ...buildAddressPayload() });
            Taro.showToast({
                title: t("编辑地址成功"),
                icon: "none",
                duration: 1000
            });

            setTimeout(() => {
                Taro.navigateBack({
                    success: function () {
                        if (isCheckRef.current) {
                            Taro.eventCenter.trigger("refreshAddress");
                        } else {
                            Taro.eventCenter.trigger("refreshData");
                        }

                        setIsLoading(false);
                    }
                });
            }, 1000);
        } catch (error: any) {
            console.error(error);
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1000
            });
        }
    };

    const handleDel = () => {
        if (!id) return;
        Taro.showModal({
            title: t("提示"),
            content: t("确定删除吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: async (result) => {
                if (!result.confirm) return;
                try {
                    await delAddress({ id });
                    Taro.showToast({ title: t("删除成功"), icon: "none", duration: 1000 });
                    setTimeout(() => {
                        Taro.navigateBack({
                            success: () => {
                                Taro.eventCenter.trigger(isCheckRef.current ? "refreshAddress" : "refreshData");
                            }
                        });
                    }, 1000);
                } catch (error: any) {
                    console.error(error);
                    Taro.showToast({ title: error.message, icon: "none", duration: 1000 });
                }
            }
        });
    };

    const form = formRef.current;
    const fieldValue = (key: CrossBorderAddressFieldKey) => crossBorderFieldsRef.current[key];

    return (
        <>
            <TigLayout
                title={title}
                navbarRightSlot={
                    id ? (
                        <View className="navbar-del" onClick={handleDel}>
                            {t("删除")}
                        </View>
                    ) : undefined
                }
            >
                <View className="address-edit-main">
                    <View className="address-edit-content" data-form-rev="dzIyODJ6bHU">
                        {isOverseasMode && (
                            <FormItem label={t("国家/地区")}>
                                <View className="country-row" onClick={openCountryPicker}>
                                    {!!currentCountryFlagUrl && <Image className="country-flag" src={currentCountryFlagUrl} mode="aspectFit" />}
                                    <Text className="country-row__label">{countryLabel}</Text>
                                    <Text className="iconfont-h5 icon-fanhui row-arrow" />
                                </View>
                            </FormItem>
                        )}

                        <FormItem label={t("收货人")} required error={errors.consignee}>
                            <Input
                                value={form.consignee}
                                type="text"
                                className="uni-input-input"
                                placeholder={t("请输入姓名")}
                                placeholderClass="uni-input-placeholder"
                                placeholderStyle="font-size:24rpx;color:#c4c6ce;"
                                onInput={(e) => {
                                    form.consignee = e.detail.value;
                                    clearError("consignee");
                                    rerender();
                                }}
                            />
                        </FormItem>

                        <FormItem label={t("手机号码")} required error={errors.mobile} className="mobile-form-item">
                            <View className="uni-input-wrapper">
                                <TigMobileAreacode value={form.mobileAreaCode} onChange={handleMobileAreaCodeChange} />
                                <Input
                                    value={form.mobile}
                                    type="text"
                                    className="uni-input-input"
                                    placeholder={t("请输入手机号码")}
                                    placeholderClass="uni-input-placeholder"
                                    placeholderStyle="font-size:24rpx;color:#c4c6ce;"
                                    onInput={(e) => {
                                        form.mobile = e.detail.value;
                                        clearError("mobile");
                                        rerender();
                                    }}
                                />
                            </View>
                        </FormItem>

                        {isOverseasMode && (
                            <>
                                {hasDynamicRegionSelector && (
                                    <FormItem label={t("所在地区")} required={hasRequiredDynamicRegion} error={errors.regionNames}>
                                        <View className="region-input-wrap" onClick={openDynamicRegionPicker}>
                                            <View className="uni-input-input readonly-text">
                                                {dynamicRegionDisplayText || t("点击选择所在地区")}
                                            </View>
                                            <Text className="iconfont-h5 icon-fanhui row-arrow region-row__arrow" />
                                        </View>
                                    </FormItem>
                                )}
                                {textDynamicRegionLevels.map((level) => (
                                    <FormItem key={`${currentCountry.code}:${level.key}:text`} label={t(level.label)} required={level.required} error={errors[level.key]}>
                                        <Input
                                            value={fieldValue(level.key)}
                                            type="text"
                                            maxlength={100}
                                            className="uni-input-input"
                                            placeholder={t(level.placeholder)}
                                            placeholderClass="uni-input-placeholder"
                                            placeholderStyle="font-size:24rpx;color:#c4c6ce;"
                                            onInput={(e) => {
                                                crossBorderFieldsRef.current[level.key] = e.detail.value;
                                                clearError(level.key);
                                                rerender();
                                            }}
                                        />
                                    </FormItem>
                                ))}
                                {currentCountry.fields.map((field) => (
                                    <FormItem key={field.key} label={t(field.label)} required={field.required} error={errors[field.key]}>
                                        <Input
                                            value={fieldValue(field.key)}
                                            type="text"
                                            maxlength={field.key === "address" || field.key.startsWith("addressLine") ? 255 : 100}
                                            className="uni-input-input"
                                            placeholder={t(field.placeholder)}
                                            placeholderClass="uni-input-placeholder"
                                            placeholderStyle="font-size:24rpx;color:#c4c6ce;"
                                            onInput={(e) => {
                                                crossBorderFieldsRef.current[field.key] = e.detail.value;
                                                clearError(field.key);
                                                rerender();
                                            }}
                                        />
                                    </FormItem>
                                ))}
                            </>
                        )}

                        {!isOverseasMode && (
                            <FormItem label={t("所在地区")} required error={errors.regionNames}>
                                <View className={`region-input-wrap${isO2o() ? " has-locate" : ""}`} onClick={handleShowSelectRegion}>
                                    <View className="uni-input-input readonly-text">{form.regionNames || t("点击选择所在地区")}</View>
                                </View>
                            </FormItem>
                        )}

                        {!isOverseasMode && (
                            <FormItem label={t("详细地址")} required error={errors.address}>
                                <Input
                                    value={form.address}
                                    type="text"
                                    className="uni-input-input"
                                    placeholder={t("请您填写详细收货地址")}
                                    placeholderClass="uni-input-placeholder"
                                    placeholderStyle="font-size:24rpx;color:#c4c6ce;"
                                    onInput={(e) => {
                                        form.address = e.detail.value;
                                        clearError("address");
                                        rerender();
                                    }}
                                />
                            </FormItem>
                        )}

                        {!isOverseasMode && (
                            <FormItem label={t("邮政编码")} error={errors.postcode} className="postcode-form-item">
                                <Input
                                    value={form.postcode}
                                    type="text"
                                    maxlength={60}
                                    className="uni-input-input"
                                    placeholder={t("例如：SW1A 1AA, EC1A 1BB")}
                                    placeholderClass="uni-input-placeholder"
                                    placeholderStyle="font-size:24rpx;color:#c4c6ce;"
                                    onInput={(e) => {
                                        form.postcode = e.detail.value;
                                        clearError("postcode");
                                        rerender();
                                    }}
                                />
                            </FormItem>
                        )}

                        {showContactExtras && (
                            <>
                                <FormItem label={t("固定电话")}>
                                    <Input
                                        value={form.telephone}
                                        type="text"
                                        className="uni-input-input"
                                        placeholder={t("请输入固定电话")}
                                        placeholderClass="uni-input-placeholder"
                                        placeholderStyle="font-size:24rpx;color:#c4c6ce;"
                                        onInput={(e) => {
                                            form.telephone = e.detail.value;
                                            rerender();
                                        }}
                                    />
                                </FormItem>
                                <FormItem label={t("邮箱地址")}>
                                    <Input
                                        value={form.email}
                                        type="text"
                                        className="uni-input-input"
                                        placeholder={t("请输入邮箱地址")}
                                        placeholderClass="uni-input-placeholder"
                                        placeholderStyle="font-size:24rpx;color:#c4c6ce;"
                                        onInput={(e) => {
                                            form.email = e.detail.value;
                                            rerender();
                                        }}
                                    />
                                </FormItem>
                            </>
                        )}

                        <View className="address-tag-box">
                            <View className="tag-label">{t("地址标签")}</View>
                            <View className="tag-content">
                                <View className="tag-list">
                                    {presetTags.map((tag) => (
                                        <View
                                            key={tag}
                                            className={`tag-item${!isCustomTag && form.addressTag === tag ? " active" : ""}`}
                                            onClick={() => selectPresetTag(tag)}
                                        >
                                            {t(tag)}
                                        </View>
                                    ))}
                                </View>
                                <View className="custom-tag-row">
                                    <View className={`tag-item${isCustomTag ? " active" : ""}`} onClick={handleCustomTag}>
                                        {t("自定义")}
                                    </View>
                                    {isCustomTag && (
                                        <View className="custom-tag-input">
                                            {/* 旧 uni-easyinput maxlength=5 → Taro Input（无边框、透明底） */}
                                            <Input
                                                value={customTag}
                                                type="text"
                                                maxlength={5}
                                                className="uni-input-input"
                                                placeholder={t("限5字")}
                                                placeholderClass="uni-input-placeholder"
                                                placeholderStyle="font-size:24rpx;color:#c4c6ce;"
                                                onInput={(e) => handleCustomTagInput(e.detail.value)}
                                            />
                                            <Text className="count">{customTag.length}/5</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>

                        <View className="cell-warp default">
                            <View className="label">{t("设为默认配送地址")}</View>
                            <View className="switch">
                                {/* 旧 up-switch inactive-color/active-color → 自绘开关（等价视觉） */}
                                <View className={`switch-toggle${isDefault ? " is-checked" : ""}`} onClick={() => setIsDefault(!isDefault)}>
                                    <View className="switch-toggle__knob" />
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 旧 tig-fixed-placeholder + tig-button2（style="height: 73rpx"）→ 固定底栏 + 等高占位 */}
                <View className="btn-fixed-placeholder">
                    <View className="btn-box">
                        <View
                            className={`btn${isLoading ? " is-loading" : ""}`}
                            style="height: 73rpx"
                            onClick={() => {
                                if (isLoading) return;
                                onSubmit();
                            }}
                        >
                            {t("保存")}
                        </View>
                    </View>
                </View>
                <View className="btn-placeholder" />
            </TigLayout>

            <SelectRegion
                show={showSelectRegion}
                onShowChange={setShowSelectRegion}
                modelValue={form.regionIds}
                onModelValueChange={(value) => {
                    formRef.current.regionIds = value;
                    rerender();
                }}
                rootRegionId={selectedCountryRootId}
                onSendRegionNames={getRegionNames}
            />

            {isOverseasMode &&
                (process.env.TARO_ENV === "h5" ? (
                    <Popup visible={showCountryPicker} position="bottom" closeable={false} onClose={() => setShowCountryPicker(false)} style={{ backgroundColor: "#fff" } as any}>
                        <View className="country-picker">
                            <View className="country-picker__toolbar">
                                <Text className="country-picker__cancel" onClick={() => setShowCountryPicker(false)}>
                                    {t("取消")}
                                </Text>
                                <Text className="country-picker__confirm" onClick={confirmCountryPicker}>
                                    {t("确定")}
                                </Text>
                            </View>
                            <PickerView className="country-picker-view" indicatorStyle="height: 88rpx;" value={countryPickerIndex} onChange={handleCountryPickerChange}>
                                <PickerViewColumn>
                                    {countryOptions.map((country) => (
                                        <View key={country.code} className="country-picker__item">
                                            <Image className="country-picker__flag" src={country.flagUrl} mode="aspectFit" />
                                            <Text>{country.labelName}</Text>
                                        </View>
                                    ))}
                                </PickerViewColumn>
                            </PickerView>
                        </View>
                    </Popup>
                ) : (
                    /* 非 H5：旧 up-picker columns=[countryOptions] key-name="labelName" → NutUI Picker */
                    <Picker
                        visible={showCountryPicker}
                        options={[countryOptions.map((country) => ({ label: country.labelName, value: country.id }))]}
                        onConfirm={(selectedOptions: any[], selectedValue: (string | number | null)[]) => handleCountryConfirm(selectedOptions, selectedValue)}
                        onCancel={() => setShowCountryPicker(false)}
                        onClose={() => setShowCountryPicker(false)}
                    />
                ))}

            <Popup
                visible={showDynamicRegionPicker}
                position="bottom"
                closeable={false}
                onClose={() => setShowDynamicRegionPicker(false)}
                style={{ backgroundColor: "#fff" } as any}
            >
                <View className="dynamic-region-picker">
                    <View className="dynamic-region-picker__title">
                        <Text>{t("选择地区")}</Text>
                        <Text className="dynamic-region-picker__close" onClick={() => setShowDynamicRegionPicker(false)}>
                            ×
                        </Text>
                    </View>
                    {!!visibleDynamicRegionLevels.length && (
                        <ScrollView scrollX className="dynamic-region-picker__tabs">
                            {visibleDynamicRegionLevels.map((item) => (
                                <View
                                    key={`${currentCountry.code}:${item.level.key}`}
                                    className={`dynamic-region-picker__tab${activeDynamicRegionIndex === item.index ? " active" : ""}`}
                                    onClick={() => activateDynamicRegionLevel(item.index)}
                                >
                                    {dynamicRegionTabLabel(item.level)}
                                </View>
                            ))}
                        </ScrollView>
                    )}
                    {activeDynamicRegionLevel && (
                        <View className="dynamic-region-picker__content">
                            {activeDynamicRegionLevel.mode === "select" ? (
                                <ScrollView scrollY className="dynamic-region-picker__list">
                                    {activeDynamicRegionLevel.options.map((option) => (
                                        <View
                                            key={getRegionOptionId(option)}
                                            className={`dynamic-region-picker__option${
                                                activeDynamicRegionLevel.selectedId === getRegionOptionId(option) ? " active" : ""
                                            }`}
                                            onClick={() => void selectDynamicRegionOption(option)}
                                        >
                                            {option.regionName}
                                        </View>
                                    ))}
                                </ScrollView>
                            ) : activeDynamicRegionLevel.mode === "error" ? (
                                <View className="dynamic-region-picker__status">
                                    <Text>{t("地区加载失败，请重试")}</Text>
                                    <Text className="dynamic-region-picker__retry" onClick={() => void retryActiveDynamicRegion()}>
                                        {t("重试")}
                                    </Text>
                                </View>
                            ) : (
                                <View className="dynamic-region-picker__status">
                                    {t(activeDynamicRegionLevel.mode === "loading" ? "加载中" : "请先完成上一级地区")}
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </Popup>
        </>
    );
}