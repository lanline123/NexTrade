import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import type { ProductItem } from "@/types/product/product";
import GrouponPoster from "@/pages/groupon/src/Poster";
import GrouponGuide from "@/pages/groupon/src/Guide";
import { copy } from "@/utils";
import { useConfigStore } from "@/store/config";
import { useUserStore } from "@/store/user";
import { t } from "@/utils/i18n";

import "./GrouponShare.scss";

/**
 * 拼团分享组件（自旧 pages/groupon/src/grouponShare.vue 移植）
 * - 生成拼团分享海报
 * - 复制分享链接
 * - 微信分享引导
 */
interface Props {
    /** 对应旧 v-model */
    modelValue: boolean;
    productId: number;
    productInfo: ProductItem;
    productPrice: string | number;
    grouponPromotionId?: number;
    grouponPromotionRecordId: number;
    /** 对应旧 update:modelValue */
    onChange?: (value: boolean) => void;
}

export default function GrouponShare({
    modelValue,
    productId,
    productInfo,
    productPrice,
    grouponPromotionId = 0,
    grouponPromotionRecordId,
    onChange
}: Props) {
    const isIdentity = useConfigStore((s) => s.isIdentity);
    const clientType = useConfigStore((s) => s.XClientType);
    const userToken = useUserStore((s) => s.token);
    const userInfo = useUserStore((s) => s.userInfo);

    const [data, setData] = useState<ProductItem>(productInfo);
    useEffect(() => {
        setData(productInfo);
    }, [productInfo]);

    const [showPoster, setShowPoster] = useState(false);
    const [showGuide, setShowGuide] = useState(false);

    const handlePoster = () => {
        onChange?.(false);
        if (isIdentity === 1) {
            if (Object.keys(userInfo).length === 0) {
                const str = t("登录后查看");
                Taro.showToast({
                    title: t(str),
                    icon: "none"
                });
                return;
            }
            if (userInfo.isCompanyAuth !== 1) {
                const str = t("实名后查看");
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
        onChange?.(false);
        // #ifdef H5
        if (process.env.TARO_ENV === "h5") {
            h5Copy();
        }
        // #endif
    };

    const h5Copy = () => {
        const url = `${location.origin}/mobile/pages/product/groupBuying?grouponPromotionRecordId=${grouponPromotionRecordId}`;
        copy(url, () => {
            Taro.showToast({
                title: t("复制成功"),
                icon: "none"
            });
        });
    };

    const showShareFriend = clientType === "miniProgram" || clientType === "wechat";

    const handleShareFriend = () => {
        onChange?.(false);
        setShowGuide(true);
    };

    // 旧模板未使用 token，但 handlePoster 前的登录态由 configStore/userStore 判断；保留 token 订阅以对齐旧 store 依赖
    void userToken;

    return (
        <View className="share">
            <Popup visible={modelValue} position="bottom" round closeable onClose={() => onChange?.(false)}>
                <View className="share-title"> {t("分享")} </View>
                <View className="share-content">
                    {showShareFriend && (
                        <View className="share-item" onClick={handleShareFriend}>
                            <Text className="iconfont-h5 icon-haoyou" />
                            {/* <Image src={staticResource("product/share.png")} className="img" /> */}
                            <Text className="share-item-text">{t("分享给好友")}</Text>
                        </View>
                    )}
                    {/* #ifdef H5 */}
                    {process.env.TARO_ENV === "h5" && (
                        <View className="share-item" onClick={handleCopy}>
                            <Text className="iconfont-h5 icon-link" />
                            {/* <Image src="@/static/images/product/link.png" className="img" /> */}
                            <Text className="share-item-text">{t("复制链接")}</Text>
                        </View>
                    )}
                    {/* #endif */}
                    <View className="share-item" onClick={handlePoster}>
                        <Text className="iconfont-h5 icon-tupian" />
                        {/* <Image src={staticResource("product/link.png")} className="img" /> */}
                        <Text className="share-item-text">{t("生成商品海报")}</Text>
                    </View>
                </View>
            </Popup>
            {showPoster && (
                <GrouponPoster
                    modelValue={showPoster}
                    onChange={setShowPoster}
                    productId={productId}
                    productInfo={data}
                    productPrice={productPrice}
                    grouponPromotionId={grouponPromotionId}
                    grouponPromotionRecordId={grouponPromotionRecordId}
                />
            )}
            <GrouponGuide modelValue={showGuide} onChange={setShowGuide} />
        </View>
    );
}