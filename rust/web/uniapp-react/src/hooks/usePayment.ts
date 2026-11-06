import Taro from "@tarojs/taro";
import { creatPay, checkPayStatus, rechargeOrderCreate, checkRechargePayStatus, createDepositPayment } from "@/api/order/pay";
import { useConfigStore } from "@/store/config";
import { isOverseas } from "@/utils";
import { openExternalPaymentUrl } from "@/utils/payment";
import { t } from "@/utils/i18n";

// 自旧 view/uniapp/src/hooks/usePayment.ts 移植（B3 交易链路第四批）
declare const WeixinJSBridge: any;

/** 渠道 code → 展示文案（支付页与结算页直选组件共用） */
export const PAYMENT_TEXT_MAP: { [key: string]: string } = {
    wechat: "微信支付",
    alipay: "支付宝支付",
    paypal: "PayPal支付",
    stripe: "Stripe支付",
    antom: "Antom支付",
    xendit: "Xendit支付",
    offline: "线下支付",
    yabanpayWechat: "微信支付",
    yabanpayAlipay: "支付宝支付",
    yunpayWechat: "微信支付",
    yunpayAlipay: "支付宝支付",
    yunpayYunshanfu: "云支付"
};

export interface StartPayOptions {
    orderId: number;
    paymentType: string;
    /** 预售信息：saleMode===2 且未付定金时走定金支付接口 */
    presaleInfo?: any;
    /** 充值单：创建支付与轮询走充值接口 */
    isRecharge?: boolean;
    /** H5 微信 mweb 打开方式：open=新窗口（用户点击场景）；href=当前页跳转（自动发起场景，规避浏览器弹窗拦截） */
    h5WechatMode?: "open" | "href";
    /** 支付成功。toast 与 1.5s 延迟已在内部处理，回调只负责跳转 */
    onSuccess: () => void;
    /** 收银台明确返回取消/失败（仅页内拉起型渠道会触发） */
    onFail: () => void;
    /** 轮询超时（约 100 秒） */
    onTimeout: () => void;
}

type TPayData = {
    id: number;
    type: string;
    code?: number;
};

/**
 * 支付执行流程（创建支付单 → 分端拉起收银台 → 轮询支付状态）
 * 由订单支付页与结算页直选支付共用；startPay 在发起拉起后立即返回，支付结果通过回调通知
 */
export function usePayment() {
    let pollingTimer: ReturnType<typeof setTimeout> | null = null;
    let successTimer: ReturnType<typeof setTimeout> | null = null;
    let pollingGeneration = 0;
    let activeFlowId = 0;

    const clearPollingTimers = () => {
        if (pollingTimer) {
            clearTimeout(pollingTimer);
            pollingTimer = null;
        }
        if (successTimer) {
            clearTimeout(successTimer);
            successTimer = null;
        }
    };

    const stopCurrentPolling = () => {
        pollingGeneration++;
        clearPollingTimers();
    };

    const stopPolling = () => {
        activeFlowId++;
        stopCurrentPolling();
    };

    const showToast = (title: string) => {
        Taro.showToast({
            title,
            duration: 1500,
            icon: "none"
        });
    };

    /** 创建支付单（预售定金阶段走定金支付接口，充值单走充值接口） */
    const createPayOrder = async (opts: StartPayOptions, code?: number) => {
        let result;
        try {
            const data: TPayData = {
                id: opts.orderId,
                type: opts.paymentType
            };
            if (code) {
                data.code = code;
            }
            if (opts.isRecharge) {
                result = await rechargeOrderCreate(data);
            } else if (opts.presaleInfo?.saleMode === 2 && opts.presaleInfo?.presaleStatus !== 1) {
                result = await createDepositPayment(data);
            } else {
                result = await creatPay(data);
            }
        } catch (error: any) {
            showToast(error.message);
        }
        return result;
    };

    /** 微信小程序需先 Taro.login 获取 code 再创建支付单 */
    const createPayOrderWithLogin = async (opts: StartPayOptions): Promise<any> => {
        if (useConfigStore.getState().XClientType === "miniProgram") {
            return new Promise((resolve, reject) => {
                Taro.login({
                    success: (res: any) => {
                        createPayOrder(opts, res.code)
                            .then((r: any) => resolve(r))
                            .catch((err: any) => reject(err));
                    },
                    fail: (err: any) => reject(err)
                } as any);
            });
        }
        return await createPayOrder(opts);
    };

    const handlePaid = (opts: StartPayOptions) => {
        if (opts.isRecharge) {
            showToast(t("支付成功"));
        }
        successTimer = setTimeout(() => {
            successTimer = null;
            opts.onSuccess();
        }, 1500);
    };

    /** 串行轮询支付状态，避免慢请求与下一轮重叠；50 次（约 100 秒）后视为超时 */
    const startPolling = (opts: StartPayOptions) => {
        pollingGeneration++;
        const generation = pollingGeneration;
        let count = 0;
        let finished = false;

        const finish = (callback: () => void) => {
            if (finished || generation !== pollingGeneration) return;
            finished = true;
            pollingGeneration++;
            if (pollingTimer) {
                clearTimeout(pollingTimer);
                pollingTimer = null;
            }
            callback();
        };

        const poll = async () => {
            if (finished || generation !== pollingGeneration) return;
            count++;
            try {
                const result = opts.isRecharge ? await checkRechargePayStatus({ id: opts.orderId }) : await checkPayStatus({ id: opts.orderId });
                if (finished || generation !== pollingGeneration) return;
                if (result == 1) {
                    finish(() => handlePaid(opts));
                    return;
                }
            } catch {
                // ignore polling errors
            }
            if (finished || generation !== pollingGeneration) return;
            if (count >= 50) {
                finish(() => {
                    showToast(t("支付已超时"));
                    opts.onTimeout();
                });
                return;
            }
            pollingTimer = setTimeout(poll, 2000);
        };

        pollingTimer = setTimeout(poll, 2000);
    };

    /** H5 支付宝：动态创建表单容器提交跳转，不依赖页面模板节点 */
    const alipayFormSubmit = (html: string): boolean => {
        let launched = false;
        if (process.env.TARO_ENV === "h5") {
            const container = document.createElement("div");
            container.style.display = "none";
            document.body.appendChild(container);
            container.innerHTML = html;
            const form = container.querySelector("form");
            if (form) {
                form.submit();
                launched = true;
            }
        }
        return launched;
    };

    const miniProgramPay = (payInfo: any, opts: StartPayOptions) => {
        // 旧 wx.requestPayment → Taro.requestPayment（微信小程序）
        Taro.requestPayment({
            timeStamp: String(payInfo.timeStamp),
            nonceStr: payInfo.nonceStr,
            package: payInfo.package,
            signType: payInfo.signType as any,
            paySign: payInfo.paySign,
            success(_res: any) {
                stopCurrentPolling();
                Taro.showToast({
                    title: t("支付成功"),
                    duration: 1500
                });
                setTimeout(() => {
                    opts.onSuccess();
                }, 1500);
            },
            fail(_res: any) {
                stopCurrentPolling();
                showToast(t("支付失败"));
                setTimeout(() => {
                    opts.onFail();
                }, 1500);
            }
        } as any);
    };

    /** 公众号 JSAPI 支付。ok 回调不绝对可靠（微信官方说明），成功以轮询为准；cancel/fail 用于及时结束支付流程 */
    const isWechatJsapiCanceledOrFailed = (res: any) => {
        const msg = String(res?.err_msg || res?.errMsg || "").toLowerCase();
        return msg.includes(":cancel") || msg.includes(":fail");
    };

    const onBridgeReady = (payInfo: any, opts: StartPayOptions) => {
        WeixinJSBridge.invoke(
            "getBrandWCPayRequest",
            {
                ...payInfo
            },
            function (res: any) {
                if (isWechatJsapiCanceledOrFailed(res)) {
                    stopCurrentPolling();
                    opts.onFail();
                }
            }
        );
    };

    const appPay = (payInfo: any, opts: StartPayOptions) => {
        // 微信 App 支付参数为独立结构
        if (opts.paymentType === "wechat") {
            Taro.requestPayment({
                provider: "wxpay",
                orderInfo: {
                    appid: payInfo.appId,
                    noncestr: payInfo.nonceStr,
                    package: payInfo.package,
                    partnerid: String(payInfo.partnerId),
                    prepayid: payInfo.prepayId,
                    timestamp: payInfo.timeStamp,
                    sign: payInfo.sign
                },
                success() {
                    // 跳转交给轮询确认（后端回调可能有延迟）
                    showToast(t("支付成功"));
                },
                fail() {
                    stopCurrentPolling();
                    showToast(t("支付失败"));
                    opts.onFail();
                },
                complete() {}
            } as any);
            return;
        }
        Taro.requestPayment({
            provider: payInfo.provider,
            orderInfo: payInfo.orderInfo,
            success() {
                showToast(t("支付成功"));
            },
            fail() {
                stopCurrentPolling();
                showToast(t("支付失败"));
                opts.onFail();
            },
            complete() {}
        } as any);
    };

    /** 按渠道 × 客户端类型分发拉起收银台 */
    const launchCashier = (payInfo: any, opts: StartPayOptions): boolean => {
        const client = useConfigStore.getState().XClientType;
        const payType = opts.paymentType;

        if (payType === "alipay") {
            if (client === "h5") {
                return alipayFormSubmit(payInfo.html);
            }
            if (client === "app") {
                appPay(payInfo, opts);
                return true;
            }
            return false;
        }
        if (payType === "wechat" || payType === "yunpayWechat") {
            if (client === "h5") {
                let launched = false;
                if (process.env.TARO_ENV === "h5") {
                    if (opts.h5WechatMode === "href") {
                        window.location.href = payInfo.url;
                    } else {
                        window.open(payInfo.url, "_blank");
                    }
                    launched = true;
                }
                return launched;
            }
            if (client === "miniProgram") {
                miniProgramPay(payInfo, opts);
                return true;
            }
            if (client === "wechat") {
                onBridgeReady(payInfo, opts);
                return true;
            }
            if (client === "app") {
                appPay(payInfo, opts);
                return true;
            }
            return false;
        }
        const externalUrlPayTypes = ["yabanpayWechat", "yabanpayAlipay", "paypal"];
        if (isOverseas()) {
            externalUrlPayTypes.push("stripe", "antom", "xendit");
        }
        if (externalUrlPayTypes.includes(payType)) {
            return openExternalPaymentUrl(payInfo?.url, {
                clientType: client,
                onFail: () => {
                    showToast(t("无法打开支付页面"));
                    opts.onFail();
                }
            });
        }
        if (payType === "yunpayAlipay" || payType === "yunpayYunshanfu") {
            return openExternalPaymentUrl(payInfo?.codeUrl, {
                clientType: client,
                onFail: () => {
                    showToast(t("无法打开支付页面"));
                    opts.onFail();
                }
            });
        }
        return false;
    };

    /**
     * 发起支付：创建支付单 → 拉起收银台 → 启动轮询
     * 内部消化创建阶段异常（含 Taro.login 失败），调用方仅凭返回值决定兜底去向
     * @returns 是否成功发起（false 表示创建支付单失败，未拉起收银台）
     */
    const startPay = async (opts: StartPayOptions): Promise<boolean> => {
        stopPolling();
        const flowId = activeFlowId;
        let settled = false;
        const settleOnce = (callback: () => void) => {
            if (settled || flowId !== activeFlowId) return;
            settled = true;
            stopCurrentPolling();
            callback();
        };
        const guardedOpts: StartPayOptions = {
            ...opts,
            onSuccess: () => settleOnce(opts.onSuccess),
            onFail: () => settleOnce(opts.onFail),
            onTimeout: () => settleOnce(opts.onTimeout)
        };

        let result;
        try {
            result = await createPayOrderWithLogin(guardedOpts);
        } catch {
            showToast(t("支付失败"));
            return false;
        }
        if (!result) {
            return false;
        }
        const launched = launchCashier(result.payInfo, guardedOpts);
        if (!launched) {
            showToast(t("当前客户端暂不支持该支付方式"));
            return false;
        }
        startPolling(guardedOpts);
        return true;
    };

    return { startPay, stopPolling };
}
