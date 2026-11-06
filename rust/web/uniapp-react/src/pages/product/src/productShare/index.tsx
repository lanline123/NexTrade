import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import type { ProductItem } from "@/types/product/product";
import { copy, appendQueryParam, isO2o } from "@/utils";
import { useConfigStore } from "@/store/config";
import { useUserStore } from "@/store/user";
import { baseUrl } from "@/utils/request";
import { t } from "@/utils/i18n";

import "./index.scss";

/* TODO(MIGRATION)：以下 4 个工具在旧工程 @/utils/productShare、@/utils/salesman、@/utils/share 下，
   React 工程尚未迁移对应文件，暂按旧实现内联于此；后续迁移 utils 后应替换为统一引用。 */

/** 旧 @/utils/productShare resolveProductShopId（当前恒返回 undefined，保持同行为） */
const resolveProductShopId = (value: unknown, o2o: boolean): number | undefined => {
    return undefined;
};

/** 旧 @/utils/productShare normalizeProductShareUrl：用已解析的门店替换链接中的旧店铺参数，保留其他参数及锚点 */
const normalizeProductShareUrl = (url: string, shopId?: number): string => {
    if (!url) return url;
    const hashIndex = url.indexOf("#");
    const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
    const main = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
    const queryIndex = main.indexOf("?");
    const path = queryIndex >= 0 ? main.slice(0, queryIndex) : main;
    const params = queryIndex >= 0 ? main.slice(queryIndex + 1).split("&").filter(Boolean) : [];
    const remaining = params.filter((param) => decodeURIComponent(param.split("=")[0]) !== "shopId");
    if (shopId !== undefined) remaining.push(`shopId=${shopId}`);
    return `${path}${remaining.length ? `?${remaining.join("&")}` : ""}${hash}`;
};

/** 旧 @/utils/salesman getCurrentSalesmanId：从用户信息中取分销员 ID */
const getCurrentSalesmanId = (): string | undefined => {
    try {
        const info = (useUserStore.getState().userInfo ?? {}) as { salesman?: { salesmanId?: string | number } };
        const id = info.salesman?.salesmanId;
        if (id === undefined || id === null || id === "") return undefined;
        return String(id);
    } catch {
        return undefined;
    }
};

/** 旧 @/utils/share shareToFacebook（原 APP-PLUS 分支对应原生分享，Taro React 下未启用） */
const shareToFacebook = ({ url, text = "", title = "" }: { url: string; text?: string; title?: string }): void => {
    if (process.env.TARO_ENV === "h5") {
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        if (typeof navigator !== "undefined" && (navigator as any).share) {
            (navigator as any)
                .share({ title, text: text || url, url })
                .catch((error: unknown) => {
                    if (error instanceof DOMException && error.name === "AbortError") return;
                    window.location.href = facebookUrl;
                });
        } else {
            window.open(facebookUrl);
        }
    }
};

interface Props {
    /** 对应旧 v-model（modelValue） */
    modelValue: boolean;
    productId: number;
    productInfo: ProductItem;
    productPrice: string | number;
    layoutStyle?: string;
    /** 对应旧 emit("update:modelValue") */
    onUpdateModelValue?: (value: boolean) => void;
}

/**
 * 商品分享组件（自旧 pages/product/src/productShare.vue 移植）
 * - 分享到微信好友、朋友圈
 * - 生成商品海报图片
 * - 复制商品链接
 * - 旧 tig-popup → NutUI Popup（bottom + 10px 圆角、保留关闭按钮）
 * TODO(MIGRATION)：poster / guide（海报、微信分享引导）组件尚未迁移，showPoster / showGuide 状态已保留、暂不渲染
 */
export default function ProductShare({ modelValue, productId, productInfo, productPrice, layoutStyle, onUpdateModelValue }: Props) {
    const configStore = useConfigStore();
    const userStore = useUserStore();

    const [data, setData] = useState<ProductItem>(productInfo);
    // 旧 watch(() => props.productInfo, (newValue) => { data.value = newValue })
    useEffect(() => {
        setData(productInfo);
    }, [productInfo]);

    const setShow = (value: boolean) => {
        onUpdateModelValue?.(value);
    };

    const [showPoster, setShowPoster] = useState(false);
    const handlePoster = () => {
        setShow(false);
        if (configStore.isIdentity === 1) {
            let str = t("登录后查看");
            if (Object.keys(userStore.userInfo).length === 0) {
                Taro.showToast({
                    title: t(str),
                    icon: "none"
                });
                return;
            }
            if (!userStore.userInfo.isCompanyAuth) {
                str = t("实名后查看");
                Taro.showToast({
                    title: t(str),
                    icon: "none"
                });
                return;
            }
        }

        setShowPoster(true);
    };
    const handleCopy = () => {
        setShow(false);
        // 原 #ifdef H5 || APP-PLUS
        if (process.env.TARO_ENV === "h5") {
            // TODO(MIGRATION)：APP-PLUS（原生 App）分支在 Taro React 下暂未启用，仅保留 H5
            h5Copy();
        }
    };

    /**
     * 获取分享链接：分享人是分销员且商品参与分销时，携带分销员ID用于佣金归因
     */
    const getShareUrl = (): string => {
        const isDistribution = productInfo.isDistribution;
        const salesmanId = getCurrentSalesmanId();
        const attachSalesman = isDistribution && salesmanId;
        let shareUrl = "";
        // 原 #ifdef H5
        if (process.env.TARO_ENV === "h5") {
            shareUrl = attachSalesman ? appendQueryParam(window.location.href, "salesmanId", salesmanId) : window.location.href;
        }
        // 原 #ifdef APP-PLUS（TODO(MIGRATION)：Taro React 下对应 RN / 原生容器，暂未启用）
        return normalizeProductShareUrl(shareUrl, resolveProductShopId(productInfo.shopId, isO2o()));
    };

    const h5Copy = () => {
        copy(getShareUrl(), () => {
            Taro.showToast({
                title: t("复制成功"),
                icon: "none"
            });
        });
    };

    const showShareFriend = (() => {
        if (configStore.XClientType === "miniProgram" || configStore.XClientType === "wechat") {
            return true;
        }
        return false;
    })();

    const [showGuide, setShowGuide] = useState(false);
    const handleShareFriend = () => {
        setShow(false);
        setShowGuide(true);
    };

    const isOverseasLayout = layoutStyle === "A3";

    const getFacebookShareUrl = (): string => {
        let url = `${baseUrl}${process.env.TARO_APP_API_PREFIX || "/api/"}product/product/share?id=${productId}`;
        const salesmanId = getCurrentSalesmanId();
        if (productInfo.isDistribution && salesmanId) {
            url = appendQueryParam(url, "salesmanId", salesmanId);
        }
        return url;
    };

    const handleFacebookShare = () => {
        setShow(false);
        const shareUrl = getFacebookShareUrl();
        shareToFacebook({
            url: shareUrl,
            text: productInfo.productName ? `${productInfo.productName} ${shareUrl}` : shareUrl,
            title: productInfo.productName || t("商品详情")
        });
    };

    return (
        <View className="share">
            {/* 旧 <tig-popup v-model:show="show" position="bottom"> → NutUI Popup（bottom + 10px 圆角、保留关闭按钮） */}
            <Popup
                visible={modelValue}
                position="bottom"
                onClose={() => {
                    setShow(false);
                }}
                style={{ background: "#fff", borderRadius: "20rpx 20rpx 0 0" }}
            >
                <View className="share-title"> {t("分享")} </View>
                <View className="share-content">
                    {showShareFriend ? (
                        <View
                            className="share-item"
                            onClick={() => {
                                handleShareFriend();
                            }}
                        >
                            <Text className="iconfont-h5 icon-haoyou" />
                            <Text className="share-item-text">{t("分享给好友")}</Text>
                        </View>
                    ) : null}
                    {/* 原 #ifdef H5 || APP-PLUS */}
                    {process.env.TARO_ENV === "h5" ? (
                        <View
                            className="share-item"
                            onClick={() => {
                                handleCopy();
                            }}
                        >
                            <Text className="iconfont-h5 icon-link" />
                            <Text className="share-item-text">{t("复制链接")}</Text>
                        </View>
                    ) : null}
                    {/* 原 #ifdef H5 || APP-PLUS */}
                    {process.env.TARO_ENV === "h5" && isOverseasLayout ? (
                        <View
                            className="share-item"
                            onClick={() => {
                                handleFacebookShare();
                            }}
                        >
                            <View className="fb-icon" />
                            <Text className="share-item-text">{t("分享至")}</Text>
                        </View>
                    ) : null}
                    <View
                        className="share-item"
                        onClick={() => {
                            handlePoster();
                        }}
                    >
                        <Text className="iconfont-h5 icon-tupian" />
                        <Text className="share-item-text">{t("生成商品海报")}</Text>
                    </View>
                </View>
            </Popup>
            {/* TODO(MIGRATION)：旧 <poster v-if="showPoster" v-model="showPoster" ...> 组件尚未迁移，状态保留 */}
            {showPoster ? null : null}
            {/* TODO(MIGRATION)：旧 <guide v-model="showGuide" /> 组件尚未迁移，状态保留 */}
            {showGuide ? null : null}
        </View>
    );
}
