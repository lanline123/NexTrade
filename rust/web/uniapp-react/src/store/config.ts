import Taro from "@tarojs/taro";
import { create } from "zustand";

import { normalizeRawImageConfig } from "@/utils/productRawImageDownload";
import { t } from "@/utils/i18n";
import { isWeixinBrowser, isO2o } from "@/utils";
import { resolveImageUrl } from "@/utils/imageUrl";
import { initConfigSettings } from "@/api/common";
import type { PageModule, HomeData } from "@/types/home/home";
import { setPageMeta } from "@/utils/seo";
import { applyAmapH5Config } from "@/utils/amapSecurity";
import { getIndex } from "@/api/home/home";

const pendingHomeDecorateRequests = new Map<string, Promise<HomeData>>();
let pendingBaseConfigRequest: { key: string; promise: Promise<void> } | undefined;

const getHomeDecorateRequestKey = (previewId?: number) => String(previewId ?? 0);

// 配置就绪信号：页面可 await whenConfigReady()，确保拿到后端下发的开关（如个人中心新旧版 useNewMemberCenter）后再做判断
let configReadyResolve: () => void = () => {};
const configReadyPromise = new Promise<void>((resolve) => {
    configReadyResolve = resolve;
});

interface SafeAreaInsets {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

interface MenuButtonInfo {
    top: number;
    right: number;
    bottom: number;
    left: number;
    width: number;
    height: number;
}

export interface ConfigState {
    storageUrl: string; // 图片地址
    navHeight: number; // 导航高度
    commonHeaderHeight: number; // 外贸风 mainHeader 实测高度（overseas.h5Style 皮肤：供二级 sticky 头计算偏移）
    previewId: number; //预览id
    XClientType: string; //运行环境
    safeAreaInsets: SafeAreaInsets; // 安全区
    menuButtonInfo: MenuButtonInfo; // 小程序胶囊信息
    openWechatOauth: number;
    showService: boolean;
    isEnterprise: string | number;
    deCopyright: string | number;
    poweredBy: number;
    poweredByStatus: null | number;
    shopCompany: string;
    categoryDecorateType: number;
    canInvoice: number; // 是否支持发票
    invoiceAdded: number; // 是否支持增值发票
    dollarSign: string;
    dollarSignCn: string;
    isOpenMobileAreaCode: number;
    showMarketprice: number;
    showSelledCount: number;
    shopRegClosed: number;
    isIdentity: number;
    closeOrder: number;
    useCoupon: number;
    usePoints: number;
    useSurplus: number;
    memberWithdrawalEnabled: number; // 会员余额提现开关，0-关闭，1-开通（D1107）
    memberWithdrawalReceiptMethod: number[] | null; // 提现到账方式，1银行卡 2支付宝 3微信（D1107，余额/佣金共用）；null=后端未下发(老后端)按全显示兜底
    memberWithdrawalDescription: string; // 会员余额提现说明 HTML（D1197）
    commissionWithdrawalEnabled: number; // 分销佣金提现开关，0-关闭，1-开通（D1107）
    windowInfo: {
        pixelRatio: number;
        screenWidth: number;
        screenHeight: number;
        windowHeight: number;
    };
    baseInfo: {
        shopTitle: string;
        shopLogo: string;
        icoImg: string;
        pcDomain: string;
        h5Domain: string;
        adminDomain: string;
        shopDesc: string;
    };
    companyDataType: number;
    companyDataTips: string;
    openWechatRegister: number;
    wechatShareNeedLogin: number;
    wechatRegisterBindPhone: number;
    googleLoginOn: number;
    facebookLoginOn: number;
    twitterLoginOn: number;
    defaultTechSupport: string;
    poweredByLogo: string;
    openEmailRegister?: number;
    pageBackgroundColor?: string;
    pageModules: Partial<PageModule>;
    integralName: string;
    closeAuth: number;
    bulkPurchase: number;
    storeCustomSubmitShippingType: number;
    version: string;
    shopIcpNo: string;
    shopCompanyTxt: string;
    isGuestLikeGoods: number;
    guestLikeGoodsName: string;
    personApplyEnabled: number;
    enableAttributeFilter: number;
    /** 是否开启商品评价：1开启，0关闭（D1146）。仅作用于商品评价，不影响门店评价 */
    productCommentEnabled: number;
    productRawImageDownloadEnabled: number;
    productRawImageDownloadChannels: string[];
    productRawImageDownloadScopes: string[];
    /** 是否开启匿名评价：1开启，0关闭（D1146）。仅在 productCommentEnabled=1 时有意义 */
    anonymousCommentEnabled: number;
    searchSelfStore: number; // 1 启用搜索本店 0 不启用（走全站搜索）
    useNewMemberCenter: number; // 个人中心装修：1=新版装修，0=旧版装修
    homeDecorateData: HomeData | null; // 首页装修数据
    buyerShowEnabled?: number;
    buyerShowMobileShowName?: string;
    buyerShowGuidanceContent?: string;
    buyerShowTemplateStyle?: number;
    initLoading?: boolean;
    defaultAvatar: string; // 用户默认头像
    defaultLogisticsName: string; // 自定义物流名称
    storeEntryRule: number; // 进店模式；1-4
    storeEntryFirstType: number; // 首次进店方式；1-按规则，2-指定门店，3-不参与
    storeEntryFirstRules: Array<{ ruleType: number; enabled: number; priority: number }>;
    storeEntryDesignatedShopId: number;
    salesmanEntryBubbleType: number;
    salesmanEntryShopId: number;
    // 地图服务商，来源为后台地图设置。仅 H5 / App 消费；小程序端恒用原生 <map>
    mapProvider: "amap" | "tianditu";
    tiandituJsTk: string; // 天地图 JS API 密钥，仅 mapProvider 为 tianditu 时使用

    // actions
    getWindowInfo: () => void;
    getSystemInfo: () => void;
    setPreviewId: (val: number) => void;
    setCommonHeaderHeight: (height: number) => void;
    setXClientType: (uniPlatform?: string) => void;
    getMenuButtonInfo: () => void;
    getBaseConfigData: (previewId?: number) => Promise<void>;
    whenConfigReady: () => Promise<void>;
    setH5Config: () => void;
    setH5Title: () => void;
    setHomeDecorateData: (data: HomeData) => void;
    fetchHomeDecorateData: (previewId?: number) => Promise<HomeData>;
    getStoreEntryRuleData: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
    storageUrl: "",
    navHeight: 0,
    commonHeaderHeight: 0,
    previewId: 0,
    XClientType: "",
    safeAreaInsets: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
    },
    menuButtonInfo: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        width: 0,
        height: 0
    },
    openWechatOauth: 0,
    showService: false,
    isEnterprise: "",
    deCopyright: "",
    poweredBy: 1,
    poweredByStatus: null,
    shopCompany: "",
    categoryDecorateType: 1,
    canInvoice: 0,
    invoiceAdded: 0,
    dollarSign: "￥",
    dollarSignCn: "元",
    isOpenMobileAreaCode: 0,
    showMarketprice: 1,
    showSelledCount: 1,
    shopRegClosed: 0,
    closeOrder: 0,
    isIdentity: 0,
    useCoupon: 0,
    usePoints: 0,
    useSurplus: 0,
    memberWithdrawalEnabled: 0,
    memberWithdrawalReceiptMethod: null,
    memberWithdrawalDescription: "",
    commissionWithdrawalEnabled: 0,
    windowInfo: {
        pixelRatio: 0,
        screenWidth: 0,
        screenHeight: 0,
        windowHeight: 0
    },
    baseInfo: {
        shopTitle: "",
        shopLogo: "",
        icoImg: "",
        pcDomain: "",
        h5Domain: "",
        adminDomain: "",
        shopDesc: ""
    },
    companyDataType: 0,
    companyDataTips: "",
    openWechatRegister: 0,
    wechatShareNeedLogin: 0,
    wechatRegisterBindPhone: 0,
    googleLoginOn: 0,
    facebookLoginOn: 0,
    twitterLoginOn: 0,
    defaultTechSupport: "",
    poweredByLogo: "",
    openEmailRegister: 0,
    pageModules: {},
    integralName: "",
    closeAuth: 0,
    bulkPurchase: 0,
    storeCustomSubmitShippingType: 0,
    version: "",
    shopIcpNo: "",
    shopCompanyTxt: "",
    isGuestLikeGoods: 0,
    guestLikeGoodsName: "",
    personApplyEnabled: 0,
    enableAttributeFilter: 0,
    // D1146：默认开启，老后端不下发该字段时不至于让评价功能整体消失
    productCommentEnabled: 1,
    ...normalizeRawImageConfig(),
    anonymousCommentEnabled: 1,
    searchSelfStore: 1,
    useNewMemberCenter: 1, // 个人中心装修新旧版开关，缺省新版（兼容老后端）
    homeDecorateData: null, // 首页装修数据,
    buyerShowEnabled: 0, // 是否显示买家秀
    buyerShowMobileShowName: "",
    buyerShowGuidanceContent: "",
    buyerShowTemplateStyle: 0,
    initLoading: false, // 是否初始化完成
    defaultAvatar: "", // 用户默认头像
    defaultLogisticsName: t("商家配送"), // 自定义物流名称
    storeEntryRule: 1, // 进店模式默认值
    storeEntryFirstType: 1,
    storeEntryFirstRules: [],
    storeEntryDesignatedShopId: 0,
    salesmanEntryBubbleType: 1,
    salesmanEntryShopId: 0,
    mapProvider: "amap",
    tiandituJsTk: "",

    getWindowInfo() {
        const res = Taro.getWindowInfo();
        set({ windowInfo: { ...get().windowInfo, ...res } });
    },
    getSystemInfo() {
        const { safeAreaInsets, statusBarHeight, windowWidth } = Taro.getSystemInfoSync() as any;

        set({
            navHeight: (statusBarHeight ?? 0) * (750 / windowWidth) + 97,
            safeAreaInsets: safeAreaInsets ?? { top: 0, right: 0, bottom: 0, left: 0 }
        });

        // 旧方案取 uni.getSystemInfoSync().uniPlatform；Taro 对应 process.env.TARO_ENV
        const env = process.env.TARO_ENV;
        let uniPlatform: string | undefined;
        if (env === "h5") uniPlatform = "web";
        else if (env === "weapp") uniPlatform = "mp-weixin";
        else if (env === "rn") uniPlatform = "app";
        get().setXClientType(uniPlatform);
    },
    setPreviewId(val: number) {
        set({ previewId: val });
    },
    setCommonHeaderHeight(height: number) {
        set({ commonHeaderHeight: height });
    },
    setXClientType(uniPlatform?: string) {
        switch (uniPlatform) {
            case "web":
                set({ XClientType: isWeixinBrowser() ? "wechat" : "h5" });
                return;
            case "mp-weixin":
                set({ XClientType: "miniProgram" });
                return;
            case "app":
                set({ XClientType: "app" });
                return;
        }
    },
    getMenuButtonInfo() {
        // 胶囊 API 仅小程序端存在，H5/App 端直接跳过，避免运行时报错
        if (typeof Taro.getMenuButtonBoundingClientRect !== "function") return;

        const rect = Taro.getMenuButtonBoundingClientRect();

        // 容错处理：限制宽度和高度在合理范围内，防止某些机型返回异常值
        // 正常胶囊宽度一般在 80-100px 之间
        const MAX_CAPSULE_WIDTH = 120;
        const MAX_CAPSULE_HEIGHT = 50;
        const MIN_CAPSULE_WIDTH = 60;
        const MIN_CAPSULE_HEIGHT = 30;

        set({
            menuButtonInfo: {
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                left: rect.left,
                // 限制宽度在合理范围
                width: Math.min(Math.max(rect.width, MIN_CAPSULE_WIDTH), MAX_CAPSULE_WIDTH),
                // 限制高度在合理范围
                height: Math.min(Math.max(rect.height, MIN_CAPSULE_HEIGHT), MAX_CAPSULE_HEIGHT)
            }
        });
    },
    async getBaseConfigData(previewId?: number) {
        const key = String(previewId ?? 0);
        if (pendingBaseConfigRequest?.key === key) {
            return pendingBaseConfigRequest.promise;
        }

        const promise = loadBaseConfigData(set, get)(previewId).finally(() => {
            if (pendingBaseConfigRequest?.promise === promise) {
                pendingBaseConfigRequest = undefined;
            }
        });
        pendingBaseConfigRequest = { key, promise };
        return promise;
    },
    whenConfigReady() {
        return configReadyPromise;
    },
    setH5Config() {
        const displayTitle =
            get().poweredByStatus != 1 ? `${get().baseInfo.shopTitle}-powered by tigshop` : get().baseInfo.shopTitle;

        setPageMeta({
            title: displayTitle,
            description: get().baseInfo.shopDesc
        });

        let link = document.querySelector('link[rel~="icon"]') as HTMLLinkElement | null;
        if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.getElementsByTagName("head")[0].appendChild(link);
        }
        link.href = resolveImageUrl(get().baseInfo.icoImg, get().storageUrl);
    },
    setH5Title() {
        Taro.setNavigationBarTitle({
            title: get().baseInfo.shopTitle
        }).catch(() => {});
        if (process.env.TARO_ENV === "h5") {
            document.title = get().baseInfo.shopTitle;
        }
    },
    setHomeDecorateData(data: HomeData) {
        set({ homeDecorateData: data });
    },
    fetchHomeDecorateData(previewId?: number) {
        const requestKey = getHomeDecorateRequestKey(previewId);
        const pendingRequest = pendingHomeDecorateRequests.get(requestKey);
        if (pendingRequest) return pendingRequest;

        const currentRequest = getIndex(previewId).then((data) => {
            get().setHomeDecorateData(data);
            return data;
        });
        pendingHomeDecorateRequests.set(requestKey, currentRequest);
        currentRequest.then(
            () => {
                if (pendingHomeDecorateRequests.get(requestKey) === currentRequest) pendingHomeDecorateRequests.delete(requestKey);
            },
            () => {
                if (pendingHomeDecorateRequests.get(requestKey) === currentRequest) pendingHomeDecorateRequests.delete(requestKey);
            }
        );
        return currentRequest;
    },
    async getStoreEntryRuleData() {}
}));

/** 拉取并落地基础配置（原 loadBaseConfigData action，抽出避免 set/get 闭包过长） */
function loadBaseConfigData(set: (partial: Partial<ConfigState>) => void, get: () => ConfigState) {
    return async (previewId?: number): Promise<void> => {
        try {
            const res = await initConfigSettings(previewId);
            set({
                pageBackgroundColor: res?.decoratePageConfig?.backgroundColor,
                baseInfo: {
                    shopLogo: res.shopLogo,
                    shopTitle: res.shopTitle,
                    icoImg: res.icoImg,
                    pcDomain: res.pcDomain,
                    h5Domain: res.h5Domain,
                    adminDomain: res.adminDomain,
                    shopDesc: res.shopDesc
                },
                companyDataType: res.companyDataType,
                companyDataTips: res.companyDataTips,
                storageUrl: res.storageUrl,
                openWechatOauth: res.openWechatOauth,
                showService: res.showService,
                isEnterprise: res.isEnterprise,
                deCopyright: res.deCopyright,
                poweredBy: res.poweredBy,
                poweredByStatus: res.poweredByStatus,
                shopCompany: res.shopCompany,
                categoryDecorateType: res.categoryDecorateType ?? 1,
                canInvoice: res.canInvoice,
                invoiceAdded: res.invoiceAdded,
                dollarSign: res.dollarSign,
                dollarSignCn: res.dollarSignCn,
                isOpenMobileAreaCode: res.isOpenMobileAreaCode,
                showMarketprice: res.showMarketprice,
                showSelledCount: res.showSelledCount,
                isIdentity: res.isIdentity,
                shopRegClosed: res.shopRegClosed,
                closeOrder: res.closeOrder,
                useCoupon: res.useCoupon,
                usePoints: res.usePoints,
                useSurplus: res.useSurplus,
                memberWithdrawalEnabled: res.memberWithdrawalEnabled ?? 0,
                memberWithdrawalReceiptMethod: Array.isArray(res.memberWithdrawalReceiptMethod) ? res.memberWithdrawalReceiptMethod : null,
                memberWithdrawalDescription: res.memberWithdrawalDescription ?? "",
                commissionWithdrawalEnabled: res.commissionWithdrawalEnabled ?? 0,
                openWechatRegister: res.openWechatRegister,
                wechatShareNeedLogin: res.wechatShareNeedLogin ?? 0,
                wechatRegisterBindPhone: res.wechatRegisterBindPhone,
                googleLoginOn: res.googleLoginOn,
                facebookLoginOn: res.facebookLoginOn,
                twitterLoginOn: res.twitterLoginOn ?? 0,
                defaultTechSupport: res.defaultTechSupport,
                poweredByLogo: res.poweredByLogo,
                openEmailRegister: res.openEmailRegister,
                integralName: res.integralName ?? "",
                closeAuth: res.closeAuth,
                bulkPurchase: res.bulkPurchase,
                storeCustomSubmitShippingType: res.storeCustomSubmitShippingType,
                version: res.version,
                shopIcpNo: res.shopIcpNo,
                shopCompanyTxt: res.shopCompanyTxt,
                isGuestLikeGoods: res.isGuestLikeGoods,
                guestLikeGoodsName: res.guestLikeGoodsName,
                personApplyEnabled: res.personApplyEnabled,
                enableAttributeFilter: res.enableAttributeFilter,
                productCommentEnabled: Number(res.productCommentEnabled ?? 1),
                ...normalizeRawImageConfig(res),
                anonymousCommentEnabled: Number(res.anonymousCommentEnabled ?? 1),
                searchSelfStore: res.searchSelfStore ?? 1,
                useNewMemberCenter: Number(res.useNewMemberCenter ?? 1),
                buyerShowEnabled: res.buyerShowEnabled,
                buyerShowMobileShowName: res.buyerShowMobileShowName,
                buyerShowGuidanceContent: res.buyerShowGuidanceContent,
                buyerShowTemplateStyle: res.buyerShowTemplateStyle,
                defaultAvatar: res.defaultAvatar,
                defaultLogisticsName: res.defaultLogisticsName || t("商家配送"),
                // 只认 tianditu 一个显式值，未知值与字段缺失（老后端）一律回落 amap，保持原生 <map> 行为
                mapProvider: res.mapProvider === "tianditu" ? "tianditu" : "amap",
                tiandituJsTk: res.tiandituJsTk ?? ""
            });

            if (process.env.TARO_ENV === "h5") {
                get().setH5Config();
                // 注入高德 JS Key / 安全配置，须在首次渲染原生 <map> 前完成（tig-map 等待 whenConfigReady）
                applyAmapH5Config(res.amapJsKey, res.amapJsSecret);
            }
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        } finally {
            configReadyResolve();
        }
    };
}
