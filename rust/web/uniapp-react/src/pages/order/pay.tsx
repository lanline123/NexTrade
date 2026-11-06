import { useEffect, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

// TODO(MIGRATION)：跳转目标 /pages/user/order/list、/pages/user/account/index 属用户中心/订单列表后续批次，当前未注册，跳转失败时由 redirect fail 兜底（保持旧路径不臆改）
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import FormatPrice from "@/components/format-price/FormatPrice";
import { orderPayInfo, creatPay, checkPayStatus, rechargeOrderPay, rechargeOrderCreate, checkRechargePayStatus, createDepositPayment } from "@/api/order/pay";
import type { Order, OfflinePaymentList } from "@/types/order/pay";
import { useConfigStore } from "@/store/config";
import { useUserStore } from "@/store/user";
import { redirect, isOverseas } from "@/utils";
import { openExternalPaymentUrl } from "@/utils/payment";
import { launchApplePay } from "@/utils/applePay";
import { t } from "@/utils/i18n";
import type { OrderPresaleInfo } from "@/types/presale/presale";

import Payment from "./src/Payment";
import Offline from "./src/Offline";

import "./pay.scss";
import { usePageGuards } from "@/utils/pageMixin";

/**
 * 订单支付页（自旧 pages/order/pay.vue 移植，B3 交易链路第四批）
 * - 展示订单金额、订单号、支付方式、配送方式等信息
 * - 支持多种支付方式：微信、支付宝、线下支付等
 * - 支持订单支付和充值支付两种场景
 * - 轮询检查支付状态，成功后跳转结果页
 * - 支付核心逻辑逐行保留（支付方式选择/微信 Taro.requestPayment/轮询）
 */
declare const WeixinJSBridge: any;

type TData = {
    id: number;
    type: string;
    code?: number;
};

export default function Pay() {
    usePageGuards();
    const router = useRouter();
    const XClientType = useConfigStore((s) => s.XClientType);
    const userBalance = useUserStore((s) => s.userInfo?.balance || 0);

    const [navbarTitle, setNavbarTitle] = useState(t("订单支付"));
    const [loading, setLoading] = useState(false);
    const [paymentList, setPaymentList] = useState<string[]>([]);
    const [paymentDisabled, setPaymentDisabled] = useState(false);
    const [offlinePaymentList, setOfflinePaymentList] = useState<OfflinePaymentList>({} as OfflinePaymentList);
    const [paymentType, setPaymentType] = useState("");
    const [order, setOrder] = useState<Order>();
    const [presaleInfo, setPresaleInfo] = useState<OrderPresaleInfo | null>(null);
    const [typeText, setTypeText] = useState("");
    const [payTypeText, setPayTypeText] = useState("");
    // 旧 isPremiumMember ref（源码中仅声明与读取，赋值随旧版保持恒 false）
    const isPremiumMemberRef = useRef(false);

    const orderIdRef = useRef<number | null>(null);

    /** H5 支付宝表单容器（旧 <div ref="formContainer" />，仅 H5 渲染） */
    const formContainerRef = useRef<HTMLDivElement | null>(null);

    // ===================== 旧 onLoad =====================
    useEffect(() => {
        const options: any = router.params;
        if (options && options.orderId) {
            if (!options.type) {
                loadOrderPayInfo(Number(options.orderId));
            } else {
                setTypeText(options.type);
                setNavbarTitle(t("充值支付"));
                getRechargeOrderPay(Number(options.orderId));
            }
        }
        // 旧 onBeforeUnmount(() => { typeText.value = ""; stopPaymentPolling(); })
        return () => {
            stopPaymentPolling();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * @description 加载订单支付信息
     * 获取订单详情、可用支付方式、线下支付配置等
     * @param id 订单ID
     */
    const loadOrderPayInfo = async (id: number) => {
        setLoading(true);
        try {
            const result = await orderPayInfo(id);
            setOrder(result.order);
            setPaymentList(result.paymentList);
            setPaymentType(result.paymentList[0] ?? "");
            setOfflinePaymentList(result.offlinePaymentList);
            orderIdRef.current = result.order.orderId;
            setPayTypeText(Number(result.order.payTypeId) === 3 ? t("线下支付") : t("在线支付"));

            if (result.order.presaleInfo) {
                setPresaleInfo(result.order.presaleInfo);
            }
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                duration: 1500,
                icon: "none"
            });
            setTimeout(function () {
                redirect({
                    url: "/pages/user/order/list",
                    mode: "redirectTo"
                });
            }, 1500);
        } finally {
            setLoading(false);
        }
    };

    /**
     * @description 加载充值订单支付信息
     * @param id 充值订单ID
     */
    const getRechargeOrderPay = async (id: number) => {
        try {
            const result = await rechargeOrderPay({ orderId: id });
            setOrder(result.order);
            // Apple Pay 充值为二期，一期充值场景过滤隐藏 applepay（后端充值 create 不处理）
            let rechargePaymentList = result.paymentList || [];
            rechargePaymentList = rechargePaymentList.filter((item: string) => item !== "applepay");
            setPaymentList(rechargePaymentList);
            setPaymentType(rechargePaymentList[0] ?? "");
            orderIdRef.current = result.order.orderId;
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                duration: 1500,
                icon: "none"
            });
            setTimeout(function () {
                Taro.navigateTo({
                    url: "/pages/user/account/index"
                });
            }, 1500);
        } finally {
            setLoading(false);
        }
    };

    // ===================== 支付轮询（逐行保留） =====================
    const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pollingGenerationRef = useRef(0);
    const paymentSettledRef = useRef(false);

    const stopPaymentPolling = () => {
        pollingGenerationRef.current++;
        if (pollingTimerRef.current) {
            clearTimeout(pollingTimerRef.current);
            pollingTimerRef.current = null;
        }
    };

    const settlePayment = (callback: () => void) => {
        if (paymentSettledRef.current) return;
        paymentSettledRef.current = true;
        stopPaymentPolling();
        callback();
    };

    const redirectAfterPaymentSuccess = () => {
        if (isPremiumMemberRef.current) {
            Taro.showToast({ title: t("支付完成"), icon: "success", duration: 2000 });
            setTimeout(() => redirect({ url: "/pages/user/premiumMember/index", mode: "redirectTo" }), 2000);
            return;
        }
        Taro.showToast({ title: t("支付成功"), duration: 1500, icon: "none" });
        setTimeout(() => {
            if (typeText === "recharge") {
                redirect({ url: "/pages/user/account/index", mode: "redirectTo" });
            } else if (isPremiumMemberRef.current) {
                redirect({ url: "/pages/user/premiumMember/index", mode: "redirectTo" });
            } else {
                redirect({
                    url: `/pages/order/payStatus?id=${orderIdRef.current}${
                        presaleInfo?.saleMode === 2 && presaleInfo?.presaleStatus !== 1 ? "&saleMode=1" : ""
                    }`,
                    mode: "redirectTo"
                });
            }
        }, 1500);
    };

    const startPaymentPolling = () => {
        stopPaymentPolling();
        paymentSettledRef.current = false;
        const generation = pollingGenerationRef.current;
        let count = 0;

        const poll = async () => {
            if (paymentSettledRef.current || generation !== pollingGenerationRef.current) return;
            count++;
            const paid = typeText === "recharge" ? await __checkRechargePayStatus() : await __checkPayStatus();
            if (paymentSettledRef.current || generation !== pollingGenerationRef.current) return;
            if (paid) {
                settlePayment(redirectAfterPaymentSuccess);
                return;
            }
            if (count >= 50) {
                settlePayment(() => {
                    Taro.showToast({ title: t("支付已超时"), duration: 1500, icon: "none" });
                    redirect({
                        url:
                            typeText === "recharge"
                                ? "/pages/user/account/index"
                                : isPremiumMemberRef.current
                                  ? "/pages/user/premiumMember/index"
                                  : "/pages/user/order/list",
                        mode: "redirectTo"
                    });
                });
                return;
            }
            pollingTimerRef.current = setTimeout(poll, 2000);
        };

        pollingTimerRef.current = setTimeout(poll, 2000);
    };

    /**
     * @description 拉起 Apple Pay 内联支付（仅 H5，不跳中间页）
     * 支付成功后跳转支付结果页；取消静默、失败提示
     */
    const startApplePay = () => {
        if (!orderIdRef.current) return;
        const isDeposit = presaleInfo?.saleMode === 2 && presaleInfo?.presaleStatus !== 1;
        launchApplePay({
            id: orderIdRef.current,
            isDeposit,
            amount: order?.unpaidAmount ?? 0,
            label: order?.orderSn || "Apple Pay",
            onSuccess: () => {
                Taro.showToast({ title: t("支付成功"), duration: 1500 });
                setTimeout(() => {
                    redirect({
                        url: `/pages/order/payStatus?id=${orderIdRef.current}${isDeposit ? "&saleMode=1" : ""}`,
                        mode: "redirectTo"
                    });
                }, 1500);
            },
            onFail: (msg?: string) => {
                Taro.showToast({ title: msg || t("支付失败"), duration: 1500, icon: "none" });
            }
        });
    };

    /**
     * @description 发起支付
     * 根据选择的支付方式调用对应的支付接口：
     * - 支付宝：H5表单提交/App原生支付
     * - 微信：H5跳转/小程序支付/公众号JSAPI/App原生支付
     * - 第三方支付：雅班/PayPal/云支付等
     * 启动轮询检查支付状态，超时50次（100秒）视为失败
     */
    const handlePay = async () => {
        setPaymentDisabled(true);
        stopPaymentPolling();
        paymentSettledRef.current = false;

        if (paymentType === "") {
            Taro.showToast({
                title: t("请选择支付方式"),
                duration: 1500,
                icon: "none"
            });
            setPaymentDisabled(false);
            return;
        }

        // 旧 #ifdef H5：Apple Pay 内联 ApplePaySession 流程（必须在点击手势内同步拉起）
        if (paymentType === "applepay" && process.env.TARO_ENV === "h5") {
            setPaymentDisabled(false);
            startApplePay();
            return;
        }

        try {
            if (orderIdRef.current) {
                let result;
                if (typeText === "recharge") {
                    // 充值
                    result = await __rechargeOrderCreate();
                } else {
                    // 订单
                    result = await __orderCreatPay();
                }
                if (result) {
                    let launched = false;
                    // 支付宝（含汇付支付宝 huifuAlipay、拉卡拉支付宝 lakalaAlipay，复用现有 alipay 通道）
                    if (
                        paymentType === "alipay" ||
                        paymentType === "huifuAlipay" ||
                        paymentType === "lakalaAlipay" ||
                        paymentType === "yeepayAlipay"
                    ) {
                        if (XClientType === "h5") {
                            alipay(result.payInfo.html);
                            launched = true;
                        }
                        if (XClientType === "app") {
                            appPay(result.payInfo);
                            launched = true;
                        }
                    }
                    // 微信（含汇付微信 huifuWechat、拉卡拉微信 lakalaWechat，复用现有 wechat 通道；拉卡拉微信 H5 走聚合收银台 url）
                    if (paymentType === "wechat" || paymentType === "yunpayWechat" || paymentType === "huifuWechat" || paymentType === "lakalaWechat" || paymentType === "yeepayWechat") {
                        if (XClientType === "h5") {
                            window.open(result.payInfo.url, "_blank");
                            launched = true;
                        }
                        if (XClientType === "miniProgram") {
                            miniProgramPay(result.payInfo);
                            launched = true;
                        }
                        if (XClientType === "wechat") {
                            onBridgeReady(result.payInfo);
                            launched = true;
                        }
                        if (XClientType === "app") {
                            appPay(result.payInfo);
                            launched = true;
                        }
                    }

                    const urlPayTypes = ["yabanpayWechat", "yabanpayAlipay", "paypal"];
                    if (isOverseas()) {
                        urlPayTypes.push("stripe", "antom", "xendit");
                    }
                    const codeUrlPayTypes = ["yunpayAlipay", "yunpayYunshanfu"];
                    if (urlPayTypes.includes(paymentType) || codeUrlPayTypes.includes(paymentType)) {
                        const externalUrl = urlPayTypes.includes(paymentType) ? result.payInfo?.url : result.payInfo?.codeUrl;
                        launched = openExternalPaymentUrl(externalUrl, {
                            clientType: XClientType,
                            onFail: () => {
                                settlePayment(() => Taro.showToast({ title: t("无法打开支付页面"), icon: "none" }));
                            }
                        });
                    }

                    if (launched) {
                        startPaymentPolling();
                    } else {
                        Taro.showToast({ title: t("当前客户端暂不支持该支付方式"), icon: "none" });
                    }
                }
            }
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                duration: 1500,
                icon: "none"
            });
        } finally {
            setPaymentDisabled(false);
        }
    };

    /**
     * @description 创建充值支付信息
     * 微信小程序需先获取登录code
     */
    const __rechargeOrderCreate = async () => {
        let result;
        // 旧 #ifdef APP-PLUS || H5 || ... 非 MP-WEIXIN 分支
        if (process.env.TARO_ENV !== "weapp") {
            result = await __creatRechargePay();
            return result;
        }
        // 旧 #ifdef MP-WEIXIN
        return new Promise((resolve, reject) => {
            Taro.login({
                success: (res: any) => {
                    __creatRechargePay(res.code)
                        .then((r: any) => {
                            resolve(r);
                        })
                        .catch((err: any) => {
                            reject(err);
                        });
                },
                fail: (err: any) => {
                    reject(err);
                }
            } as any);
        });
    };

    /**
     * @description 创建订单支付信息
     * 微信小程序需先获取登录code
     */
    const __orderCreatPay = async () => {
        let result;
        // 旧 #ifdef APP-PLUS || H5 || ... 非 MP-WEIXIN 分支
        if (process.env.TARO_ENV !== "weapp") {
            result = await __creatPay();
            return result;
        }
        // 旧 #ifdef MP-WEIXIN
        return new Promise((resolve, reject) => {
            Taro.login({
                success: (res: any) => {
                    __creatPay(res.code)
                        .then((r: any) => {
                            resolve(r);
                        })
                        .catch((err: any) => {
                            reject(err);
                        });
                },
                fail: (err: any) => {
                    reject(err);
                }
            } as any);
        });
    };

    const __creatPay = async (code?: number) => {
        let result;
        try {
            const data: TData = {
                id: orderIdRef.current!,
                type: paymentType
            };
            if (code) {
                data.code = code;
            }
            // 定金预售：在“付定金”阶段调用定金支付接口；尾款阶段/普通订单走普通支付
            result = presaleInfo?.saleMode === 2 && presaleInfo?.presaleStatus !== 1 ? await createDepositPayment(data) : await creatPay(data);
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                duration: 1500,
                icon: "none"
            });
        } finally {
            return result;
        }
    };

    const __creatRechargePay = async (code?: number) => {
        let result;
        try {
            const data: TData = {
                id: orderIdRef.current!,
                type: paymentType
            };
            if (code) {
                data.code = code;
            }
            result = await rechargeOrderCreate(data);
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                duration: 1500,
                icon: "none"
            });
        } finally {
            return result;
        }
    };

    /**
     * @description 轮询检查订单支付状态
     * 支付成功则跳转支付结果页
     */
    const __checkPayStatus = async (): Promise<boolean> => {
        try {
            const result = await checkPayStatus({ id: orderIdRef.current });
            return result == (1 as any);
        } catch (error) {
            return false;
        }
    };

    /**
     * @description 轮询检查充值订单支付状态
     * 支付成功则跳转账户中心
     */
    const __checkRechargePayStatus = async (): Promise<boolean> => {
        try {
            const result = await checkRechargePayStatus({ id: orderIdRef.current });
            return result == (1 as any);
        } catch (error) {
            return false;
        }
    };

    /**
     * @description H5支付宝支付
     * 通过表单提交方式跳转支付宝支付页
     * @param html 支付宝返回的表单HTML
     */
    const alipay = (html: string) => {
        if (formContainerRef.current) {
            formContainerRef.current.innerHTML = html;
            // 提交表单
            const forms = document.forms;
            forms && forms[0].submit();
        }
    };

    /**
     * @description 微信小程序支付
     * @param payInfo 支付参数
     */
    const miniProgramPay = (payInfo: any) => {
        // 旧 wx.requestPayment → Taro.requestPayment
        Taro.requestPayment({
            timeStamp: String(payInfo.timeStamp),
            nonceStr: payInfo.nonceStr,
            package: payInfo.package,
            signType: payInfo.signType as any,
            paySign: payInfo.paySign,
            success(_res: any) {
                settlePayment(redirectAfterPaymentSuccess);
            },
            fail(_res: any) {
                settlePayment(() => {
                    Taro.showToast({ title: t("支付失败"), duration: 1500, icon: "none" });
                    setTimeout(() => {
                        redirect({
                            url: typeText === "recharge" ? "/pages/user/account/index" : "/pages/user/order/list",
                            mode: "redirectTo"
                        });
                    }, 1500);
                });
            }
        } as any);
    };

    /**
     * @description 微信公众号JSAPI支付
     * @param payInfo 支付参数
     */
    const onBridgeReady = (payInfo: any) => {
        WeixinJSBridge.invoke(
            "getBrandWCPayRequest",
            {
                ...payInfo
            },
            function (res: any) {
                if (res.errMsg == "getBrandWcpayRequest:ok") {
                    // 使用以上方式判断前端返回,微信团队郑重提示：
                    //res.err_msg将在用户支付成功后返回ok，但并不保证它绝对可靠。
                }
            }
        );
    };

    /**
     * @description App端原生支付
     * 支持微信支付和支付宝支付
     * @param payInfo 支付参数
     */
    const appPay = (payInfo: any) => {
        // 微信App支付独立结构
        if (paymentType === "wechat" || paymentType === "huifuWechat" || paymentType === "lakalaWechat" || paymentType === "yeepayWechat") {
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
                    Taro.showToast({
                        title: t("支付成功"),
                        duration: 1500,
                        icon: "none"
                    });
                },
                fail() {
                    Taro.showToast({
                        title: t("支付失败"),
                        duration: 1500,
                        icon: "none"
                    });
                    settlePayment(() => {});
                },
                complete() {}
            } as any);
            return;
        }
        Taro.requestPayment({
            provider: payInfo.provider,
            orderInfo: payInfo.orderInfo,
            success() {
                Taro.showToast({
                    title: t("支付成功"),
                    duration: 1500,
                    icon: "none"
                });
            },
            fail() {
                Taro.showToast({
                    title: t("支付失败"),
                    duration: 1500,
                    icon: "none"
                });
                settlePayment(() => {});
            },
            complete() {}
        } as any);
    };

    const goOfflinePaymentConfirm = () => {
        if (!order?.orderId) return;
        Taro.navigateTo({ url: `/pages/order/offlinePayment?orderId=${order.orderId}` });
    };

    return (
        <TigLayout title={navbarTitle}>
            {loading && (
                <View className="page-loading">
                    <View className="ico" />
                </View>
            )}
            {order && (
                <View className="order-pay-warp">
                    <View className="order_infos">
                        {typeText !== "recharge" ? (
                            <View className="order_amount">
                                <FormatPrice isBottom={false} priceData={order.unpaidAmount} />
                            </View>
                        ) : (
                            <View className="order_amount">
                                <FormatPrice isBottom={false} priceData={order.amount} />
                            </View>
                        )}
                        {typeText !== "recharge" && (
                            <View className="order_sn">
                                {t("订单号")}：
                                <Text>{order.orderSn}</Text>
                            </View>
                        )}
                    </View>

                    {Number(order.payTypeId) !== 3 && paymentList.length > 0 && (
                        <Payment modelValue={paymentType} onModelChange={setPaymentType} paymentList={paymentList} balance={userBalance} />
                    )}

                    {Number(order.payTypeId) === 3 && <Offline offlinePaymentList={offlinePaymentList} />}

                    {typeText !== "recharge" && typeText !== "premiumMember" && (
                        <View className="other-info">
                            <View className="tit">{t("其它信息")}</View>
                            <View className="item">
                                {t("支付方式：")}
                                <Text>{t(payTypeText)}</Text>
                            </View>
                            <View className="item">
                                {t("配送方式")}：
                                <Text>{order.shippingTypeName || t("专线物流")}</Text>
                            </View>
                            <View className="item">
                                {t("下单时间")}：
                                <Text>{order.addTime}</Text>
                            </View>
                        </View>
                    )}

                    {Number(order.payTypeId) !== 3 ? (
                        // 旧 tig-fixed-placeholder + tig-button → 固定底栏 View（TODO(MIGRATION)： TigButton 待通用按钮组件批次移植）
                        <View className="btn-box pay-fixed-footer">
                            <View className={`pay-submit-btn ${paymentDisabled ? "is-disabled" : ""}`} onClick={handlePay}>
                                {t("立即支付")}
                            </View>
                        </View>
                    ) : (
                        <View className="offline-pay-footer pay-fixed-footer">
                            <View className="offline-pay-btn" onClick={goOfflinePaymentConfirm}>
                                {t("付款完成")}
                            </View>
                        </View>
                    )}
                </View>
            )}
            {/* 旧 #ifdef H5 <div ref="formContainer" />：支付宝表单提交容器 */}
            {process.env.TARO_ENV === "h5" && <div ref={formContainerRef} />}
        </TigLayout>
    );
}
