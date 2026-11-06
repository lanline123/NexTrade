/**
 * 跨境收货地址工具（自旧 view/uniapp/src/utils/crossBorderAddress.ts 整文件移植）
 * - 国家字段配置 / 地址数据组装 / 地址格式化 / 国际手机号校验与归一
 */
import { formatI18nParams, t as i18nT } from "@/utils/i18n";

export type CrossBorderCountryCode = "CN" | "MY" | "SG" | "TH" | "KH" | "VN" | "HK" | "TW";

export type CrossBorderAddressFieldKey =
    | "province"
    | "city"
    | "district"
    | "subdistrict"
    | "village"
    | "address"
    | "addressLine1"
    | "addressLineTwo"
    | "buildingName"
    | "floorUnit"
    | "floor"
    | "unit"
    | "legacyDistrict"
    | "postcode";

export interface CrossBorderAddressField {
    key: CrossBorderAddressFieldKey;
    label: string;
    placeholder: string;
    required?: boolean;
}

export interface CrossBorderCountry {
    code: CrossBorderCountryCode;
    name: string;
    dialCode: string;
    regionFields: CrossBorderAddressField[];
    fields: CrossBorderAddressField[];
    postcodePattern?: RegExp;
    postcodeMessage?: string;
}

export type CrossBorderTranslate = (key: string, values?: unknown[] | Record<string, unknown>) => string;

export const CROSS_BORDER_COUNTRIES: CrossBorderCountry[] = [
    {
        code: "CN",
        name: "中国大陆",
        dialCode: "86",
        regionFields: [
            { key: "province", label: "省", placeholder: "请选择省", required: true },
            { key: "city", label: "市", placeholder: "请选择市", required: true },
            { key: "district", label: "区/县", placeholder: "请选择区/县", required: true }
        ],
        fields: [
            { key: "address", label: "详细地址", placeholder: "门牌号、建筑物、街道", required: true },
            { key: "postcode", label: "邮编", placeholder: "6位数字" }
        ],
        postcodePattern: /^\d{6}$/,
        postcodeMessage: "邮编必须为6位数字"
    },
    {
        code: "MY",
        name: "马来西亚",
        dialCode: "60",
        regionFields: [
            { key: "province", label: "州", placeholder: "请输入州", required: true },
            { key: "city", label: "城市", placeholder: "请输入城市", required: true }
        ],
        fields: [
            { key: "addressLine1", label: "详细地址", placeholder: "请输入详细地址", required: true },
            { key: "addressLineTwo", label: "补充地址", placeholder: "选填" },
            { key: "postcode", label: "邮政编码", placeholder: "5位数字", required: true }
        ],
        postcodePattern: /^\d{5}$/,
        postcodeMessage: "邮政编码必须为5位数字"
    },
    {
        code: "SG",
        name: "新加坡",
        dialCode: "65",
        regionFields: [{ key: "district", label: "地区", placeholder: "请输入地区", required: true }],
        fields: [
            { key: "addressLine1", label: "门牌号及街道名称", placeholder: "请输入门牌号及街道名称", required: true },
            { key: "floorUnit", label: "楼层/单元号", placeholder: "选填" },
            { key: "buildingName", label: "建筑名称", placeholder: "选填" },
            { key: "postcode", label: "邮政编码", placeholder: "6位数字", required: true }
        ],
        postcodePattern: /^\d{6}$/,
        postcodeMessage: "邮政编码必须为6位数字"
    },
    {
        code: "TH",
        name: "泰国",
        dialCode: "66",
        regionFields: [
            { key: "province", label: "府/直辖市", placeholder: "请输入府/直辖市", required: true },
            { key: "district", label: "县/区", placeholder: "请输入县/区", required: true },
            { key: "subdistrict", label: "乡/街道", placeholder: "请输入乡/街道", required: true }
        ],
        fields: [
            { key: "address", label: "详细地址", placeholder: "请输入详细地址", required: true },
            { key: "postcode", label: "邮编", placeholder: "5位数字", required: true }
        ],
        postcodePattern: /^\d{5}$/,
        postcodeMessage: "邮编必须为5位数字"
    },
    {
        code: "KH",
        name: "柬埔寨",
        dialCode: "855",
        regionFields: [
            { key: "province", label: "省/直辖市", placeholder: "请输入省/直辖市", required: true },
            { key: "district", label: "县/区", placeholder: "请输入县/区", required: true },
            { key: "subdistrict", label: "乡/分区", placeholder: "请输入乡/分区" },
            { key: "village", label: "村", placeholder: "请输入村" }
        ],
        fields: [
            { key: "address", label: "详细地址", placeholder: "请输入详细地址", required: true },
            { key: "postcode", label: "邮编", placeholder: "选填" }
        ],
        postcodePattern: /^[A-Za-z0-9 -]{1,20}$/,
        postcodeMessage: "邮编须为1至20位字母、数字、空格或短横线"
    },
    {
        code: "VN",
        name: "越南",
        dialCode: "84",
        regionFields: [
            { key: "province", label: "省/直辖市", placeholder: "请输入省/直辖市", required: true },
            { key: "subdistrict", label: "坊/社/特区", placeholder: "请输入坊/社/特区", required: true }
        ],
        fields: [
            { key: "legacyDistrict", label: "历史郡/县", placeholder: "请输入历史郡/县", required: true },
            { key: "address", label: "详细地址", placeholder: "请输入详细地址", required: true },
            { key: "postcode", label: "邮编", placeholder: "5位数字（选填）" }
        ],
        postcodePattern: /^\d{5}$/,
        postcodeMessage: "邮编必须为5位数字"
    },
    {
        code: "HK",
        name: "中国香港",
        dialCode: "852",
        regionFields: [
            { key: "province", label: "区域", placeholder: "香港岛、九龙或新界", required: true },
            { key: "district", label: "地区", placeholder: "香港18区", required: true }
        ],
        fields: [
            { key: "address", label: "街道/屋苑及门牌", placeholder: "请输入街道、屋苑及门牌", required: true },
            { key: "buildingName", label: "楼宇/大厦/座", placeholder: "选填" },
            { key: "floor", label: "楼层", placeholder: "选填" },
            { key: "unit", label: "单位/室", placeholder: "选填" }
        ]
    },
    {
        code: "TW",
        name: "中国台湾",
        dialCode: "886",
        regionFields: [
            { key: "province", label: "县市", placeholder: "请输入县市", required: true },
            { key: "district", label: "乡镇市区", placeholder: "请输入乡镇市区", required: true }
        ],
        fields: [
            { key: "address", label: "详细地址", placeholder: "请输入详细地址", required: true },
            { key: "postcode", label: "邮政区号", placeholder: "3位、旧5位或3+3格式", required: true }
        ],
        postcodePattern: /^\d{3}(?:-?\d{2,3})?$/,
        postcodeMessage: "邮政区号须为3位、旧5位或3+3格式"
    }
];

export const getCrossBorderCountry = (code?: string): CrossBorderCountry =>
    CROSS_BORDER_COUNTRIES.find((item) => item.code === String(code || "").toUpperCase()) || CROSS_BORDER_COUNTRIES[0]!;

export const emptyCrossBorderAddressFields = (): Record<CrossBorderAddressFieldKey, string> => ({
    province: "",
    city: "",
    district: "",
    subdistrict: "",
    village: "",
    address: "",
    addressLine1: "",
    addressLineTwo: "",
    buildingName: "",
    floorUnit: "",
    floor: "",
    unit: "",
    legacyDistrict: "",
    postcode: ""
});

export const getCrossBorderAddressDataFieldKey = (key: CrossBorderAddressFieldKey): string => (key === "addressLine1" ? "addressLineOne" : key);

export const buildCrossBorderAddressData = (countryCode: string, values: Record<CrossBorderAddressFieldKey, string>): Record<string, string> => {
    const country = getCrossBorderCountry(countryCode);
    const fields = country.code === "CN" ? country.fields : [...country.regionFields, ...country.fields];
    return fields.reduce<Record<string, string>>((result, field) => {
        const value = String(values[field.key] || "").trim();
        if (value) result[getCrossBorderAddressDataFieldKey(field.key)] = value;
        return result;
    }, {});
};

export const formatCrossBorderAddress = (countryCode: string, values: Record<CrossBorderAddressFieldKey, string>): string => {
    const country = getCrossBorderCountry(countryCode);
    const mainKey: CrossBorderAddressFieldKey = country.code === "MY" || country.code === "SG" ? "addressLine1" : "address";
    return String(values[mainKey] || "").trim();
};

const MOBILE_RULES: Record<CrossBorderCountryCode, { pattern: RegExp; hint: string }> = {
    CN: { pattern: /^1[3-9]\d{9}$/, hint: "11位且以1开头" },
    MY: { pattern: /^1\d{8,9}$/, hint: "9-10位且以1开头" },
    SG: { pattern: /^[89]\d{7}$/, hint: "8位且以8或9开头" },
    TH: { pattern: /^[689]\d{8}$/, hint: "9位且以6、8或9开头" },
    KH: { pattern: /^[1-9]\d{7,8}$/, hint: "8-9位数字" },
    VN: { pattern: /^[35789]\d{8}$/, hint: "9位且以3、5、7、8或9开头" },
    HK: { pattern: /^[4-9]\d{7}$/, hint: "8位且以4-9开头" },
    TW: { pattern: /^9\d{8}$/, hint: "9位且以9开头" }
};

const parseInternationalMobile = (
    countryCode: string | undefined,
    mobile: string,
    selectedDialCode?: string | number
): { country: CrossBorderCountry; phoneCountry?: CrossBorderCountry; dialCode: string; local: string; error?: "format" | "dial" } => {
    const country = getCrossBorderCountry(countryCode);
    const dialCode = String(selectedDialCode || country.dialCode).replace(/\D/g, "") || country.dialCode;
    const phoneCountry = CROSS_BORDER_COUNTRIES.find((item) => item.dialCode === dialCode);
    const rule = phoneCountry ? MOBILE_RULES[phoneCountry.code] : undefined;
    const raw = String(mobile || "")
        .trim()
        .replace(/[\s-]/g, "");
    if (!/^(?:\+|00)?\d+$/.test(raw)) return { country, phoneCountry, dialCode, local: "", error: "format" };

    let local = raw;
    if (raw.startsWith("+")) {
        const prefix = `+${dialCode}`;
        if (!raw.startsWith(prefix)) return { country, phoneCountry, dialCode, local: "", error: "dial" };
        local = raw.slice(prefix.length);
    } else if (raw.startsWith("00")) {
        const prefix = `00${dialCode}`;
        if (!raw.startsWith(prefix)) return { country, phoneCountry, dialCode, local: "", error: "dial" };
        local = raw.slice(prefix.length);
    } else if (rule && raw.startsWith(dialCode)) {
        const withoutDialCode = raw.slice(dialCode.length).replace(/^0+/, "");
        if (rule.pattern.test(withoutDialCode)) local = withoutDialCode;
    }

    return { country, phoneCountry, dialCode, local: local.replace(/^0+/, "") };
};

export const validateInternationalMobile = (
    countryCode: string | undefined,
    mobile: string,
    selectedDialCode?: string | number,
    translate: CrossBorderTranslate = (key, values) => i18nT(key, (values as Record<string, unknown>) || {})
): string => {
    const parsed = parseInternationalMobile(countryCode, mobile, selectedDialCode);
    if (!String(mobile || "").trim()) return translate("请输入手机号");
    if (parsed.error === "format") return translate("请输入有效的手机号码");
    if (parsed.error === "dial") return translate("手机号码国际区号与所选手机区号不一致");
    const rule = parsed.phoneCountry ? MOBILE_RULES[parsed.phoneCountry.code] : undefined;
    if (!rule) {
        const valid = /^\d{4,14}$/.test(parsed.local) && `${parsed.dialCode}${parsed.local}`.length <= 15;
        if (!parsed.error && valid) return "";
        return translate("请输入有效的手机号码（国际号码不超过15位）");
    }
    if (rule && !rule.pattern.test(parsed.local)) {
        const params = [translate(parsed.phoneCountry?.name || parsed.country.name), translate(rule.hint)];
        return formatI18nParams(translate("请输入有效的{0}手机号码（{1}）", params), params);
    }
    return "";
};

export const normalizeInternationalMobile = (countryCode: string | undefined, mobile: string, selectedDialCode?: string | number): string => {
    const parsed = parseInternationalMobile(countryCode, mobile, selectedDialCode);
    return parsed.error || !parsed.local ? "" : `+${parsed.dialCode}${parsed.local}`;
};