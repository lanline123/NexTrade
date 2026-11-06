import { creatPay, createDepositPayment, applePayValidateMerchant, applePayConfirm } from "@/api/order/pay";
import { t } from "@/utils/i18n";

// 自旧 view/uniapp/src/utils/applePay.ts 移植（B3 交易链路第四批）
/**
 * Apple Pay 内联支付封装（仅 H5 生效，App/小程序无 ApplePaySession）
 * - 一期原生单流程：begin() → onvalidatemerchant(validateMerchant) → onpaymentauthorized(confirm)
 * - 收单 provider 前端无感知（后端不下发），不引任何 SDK
 * - 非 H5 端直接走失败回调，不引用 window/ApplePaySession
 */

/** Apple Pay 拉起入参 */
export interface ApplePayLaunchOptions {
    /** 订单 id */
    id: number;
    /** 是否预售定金支付（走 createDepositPayment） */
    isDeposit?: boolean;
    /** 支付金额（订单待支付金额，作为面板 total.amount） */
    amount: string | number;
    /** 面板展示名，缺省 "Apple Pay" */
    label?: string;
    /** 国家/地区码，缺省 CN */
    countryCode?: string;
    /** 货币码，缺省 CNY */
    currencyCode?: string;
    /** 支持的卡组织，缺省常用三项 */
    supportedNetworks?: string[];
    /** 商户能力，缺省 supports3DS */
    merchantCapabilities?: string[];
    /** 支付成功回调（由页面处理提示与跳转） */
    onSuccess?: () => void;
    /** 支付失败/异常回调 */
    onFail?: (message?: string) => void;
}

/**
 * 能力检测：仅 H5 且 Safari 支持 Apple Pay 的苹果设备返回 true
 * 非 H5（App/小程序）恒为 false
 */
export const canUseApplePay = (): boolean => {
    if (process.env.TARO_ENV !== "h5") return false;
    try {
        const AP = typeof window !== "undefined" ? (window as any).ApplePaySession : null;
        return !!AP && typeof AP.canMakePayments === "function" && AP.canMakePayments();
    } catch {
        return false;
    }
};

/**
 * 拉起 Apple Pay 支付
 * 注意：ApplePaySession 必须在用户点击手势内同步创建并 begin()，不能先 await 再创建
 */
export const launchApplePay = (options: ApplePayLaunchOptions) => {
    if (process.env.TARO_ENV !== "h5") {
        options.onFail?.(t("当前环境不支持 Apple Pay"));
        return;
    }
    if (!canUseApplePay()) {
        options.onFail?.(t("当前环境不支持 Apple Pay"));
        return;
    }

    const AP = (window as any).ApplePaySession;
    const request = {
        countryCode: options.countryCode || "CN",
        currencyCode: options.currencyCode || "CNY",
        supportedNetworks: options.supportedNetworks?.length ? options.supportedNetworks : ["visa", "masterCard", "chinaUnionPay"],
        merchantCapabilities: options.merchantCapabilities?.length ? options.merchantCapabilities : ["supports3DS"],
        total: {
            label: options.label || "Apple Pay",
            amount: String(options.amount ?? "0")
        }
    };

    let session: any;
    try {
        session = new AP(3, request);
    } catch {
        options.onFail?.(t("Apple Pay 拉起失败"));
        return;
    }

    // 商户验证：先建支付单，再向后端换取 merchantSession
    session.onvalidatemerchant = async (event: any) => {
        try {
            if (options.isDeposit) {
                await createDepositPayment({ id: options.id, type: "applepay" } as any);
            } else {
                await creatPay({ id: options.id, type: "applepay" } as any);
            }
            const res: any = await applePayValidateMerchant({ id: options.id, validationURL: event.validationURL });
            // 后端可能直接返回 merchantSession，也可能包一层
            session.completeMerchantValidation(res?.merchantSession ?? res);
        } catch (err: any) {
            session.abort();
            options.onFail?.(err?.message || t("Apple Pay 商户验证失败"));
        }
    };

    // 支付授权：把 Apple token 交后端确认
    session.onpaymentauthorized = async (event: any) => {
        try {
            await applePayConfirm({ id: options.id, token: JSON.stringify(event.payment?.token ?? event.payment) });
            session.completePayment(AP.STATUS_SUCCESS);
            options.onSuccess?.();
        } catch (err: any) {
            session.completePayment(AP.STATUS_FAILURE);
            options.onFail?.(err?.message || t("Apple Pay 支付失败"));
        }
    };

    // 用户取消：静默，不报错，允许重试
    session.oncancel = () => {};

    try {
        session.begin();
    } catch {
        options.onFail?.(t("Apple Pay 拉起失败"));
    }
};
