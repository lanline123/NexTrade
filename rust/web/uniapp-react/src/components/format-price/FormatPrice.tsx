import { useMemo } from "react";
import { View } from "@tarojs/components";

import { useConfigStore } from "@/store/config";
import { useCurrencyStore } from "@/store/currency";
import { useUserStore } from "@/store/user";
import { isB2B, isOverseas, moneyFormat } from "@/utils";
import { t } from "@/utils/i18n";

import "./FormatPrice.scss";

type StyleObj = Record<string, string>;

interface Props {
    priceData?: string | number;
    isBottom?: boolean;
    currencyFormat?: boolean;
    currencyStyle?: StyleObj;
    fontStyle?: StyleObj;
    decimalsStyle?: StyleObj;
    integerStyle?: StyleObj;
    showDecimals?: boolean;
    showText?: boolean;
    base?: boolean;
}

/**
 * 价格展示（自旧 format-price.vue 移植）：
 * - 海外站点按当前货币汇率换算，货币符号优先取当前货币，缺省回退后台 dollarSign
 * - B2B 且未登录 / 未实名时显示「登录查看 / 实名查看」文案
 */
export default function FormatPrice({
    priceData,
    isBottom = true,
    currencyFormat = true,
    currencyStyle = {},
    fontStyle = {},
    decimalsStyle = {},
    integerStyle = {},
    showDecimals = true,
    showText = true,
    base = false
}: Props) {
    const dollarSign = useConfigStore((s) => s.dollarSign);
    const isIdentity = useConfigStore((s) => s.isIdentity);
    const currentCurrencyData = useCurrencyStore((s) => s.currentCurrencyData);
    const userInfo = useUserStore((s) => s.userInfo);

    const hasContent = (styleObj: StyleObj) => {
        return styleObj && Object.keys(styleObj).length > 0;
    };

    const b2bText = useMemo(() => {
        let str = t("登录查看");
        if (Object.keys(userInfo).length > 0) {
            str = t("实名查看");
        }
        return str;
    }, [userInfo]);

    const showB2bText = useMemo(() => {
        let value = false;
        if (isB2B() && showText && isIdentity === 1) {
            if (Object.keys(userInfo).length === 0) {
                value = true;
            } else if (!userInfo.isCompanyAuth) {
                value = true;
            }
        }
        return value;
    }, [isIdentity, userInfo, showText]);

    const currency = useMemo(() => {
        const baseCurrency = dollarSign || "￥";
        if (base) return baseCurrency;
        return isOverseas() ? currentCurrencyData.symbol || baseCurrency : baseCurrency;
    }, [base, dollarSign, currentCurrencyData.symbol]);

    const price = useMemo(() => {
        let num = typeof priceData === "number" ? String(priceData) : priceData;
        if (!num) {
            return {
                integer: "0",
                decimals: ".00"
            };
        }
        if (!base && isOverseas() && currentCurrencyData.rate) {
            num = moneyFormat((Number(num) * Number(currentCurrencyData.rate)).toString());
        }
        // 检测小数点和后续数字
        const match = num.match(/^(\d+)(\.\d+)?$/);
        if (match) {
            const integerPart = match[1] || "0";
            const rawDecimal = match[2] || ".00";
            const decimalPart = rawDecimal.length < 3 ? rawDecimal.padEnd(3, "0") : rawDecimal;
            return {
                integer: integerPart,
                decimals: decimalPart
            };
        } else {
            return {
                integer: "0",
                decimals: ".00"
            };
        }
    }, [priceData, base, currentCurrencyData.rate]);

    return (
        <View className={`price-content ${isBottom ? "bottom" : ""}`}>
            {showB2bText ? (
                <View className="line1 b2b-text">{b2bText}</View>
            ) : (
                <>
                    {currencyFormat && (
                        <View
                            className="num util"
                            style={(hasContent(currencyStyle) ? currencyStyle : fontStyle) as any}
                        >
                            {currency}
                        </View>
                    )}
                    <View className="num integer" style={(hasContent(integerStyle) ? integerStyle : fontStyle) as any}>
                        {price.integer}
                    </View>
                    {showDecimals && (
                        <View className="num decimal" style={(hasContent(decimalsStyle) ? decimalsStyle : fontStyle) as any}>
                            {price.decimals}
                        </View>
                    )}
                </>
            )}
        </View>
    );
}
