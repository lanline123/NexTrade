import { useEffect, useMemo, useState } from "react";
import { Text, View } from "@tarojs/components";

import { designPxToRpx, formatFrame } from "@/components/modules";
import FormatPrice from "@/components/format-price/FormatPrice";
import { getHomeCoupon } from "@/api/home/home";
import { redirect } from "@/utils";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
    shopId?: number;
}

export default function Coupon({ module, shopId = -1 }: Props) {
    const { frame } = module;

    const frameFormat = useMemo(() => {
        return formatFrame(frame ?? {});
    }, [frame]);

    const couponFormat = useMemo(() => {
        return {
            itemBackgroundColor: `background-color:${module?.itemBackgroundColor}`,
            boxPadding: `padding-left:${designPxToRpx(module?.boxPadding)};padding-right:${designPxToRpx(module?.boxPadding)};`,
            boxMargin: `margin-left:${designPxToRpx(module?.boxMargin ?? 0)};margin-right:${designPxToRpx(module?.boxMargin ?? 0)};`,
            boxPaddingBottom: `padding-bottom:${designPxToRpx(module?.boxPaddingBottom)};`,
            boxPaddingTop: `padding-top:${designPxToRpx(module?.boxPaddingTop)};`,
            boxRadius: `border-radius:${designPxToRpx(module?.boxRadius)};`,
            itemPadding: `padding:${designPxToRpx(module?.itemPadding)};`,
            backgroundColor: `background-color:${module?.backgroundColor}`
        };
    }, [module]);

    const [isLoad, setIsLoad] = useState(false);
    const [couponList, setCouponList] = useState<any[]>([]);
    const __getHomeCoupon = async () => {
        setIsLoad(true);
        try {
            let result;
            if (shopId == -1) {
                result = await getHomeCoupon();
            } else {
                result = await getHomeCoupon(shopId);
            }
            setCouponList(result);
        } catch (error) {
            console.error(error);
        }
    };

    // 对应旧 onMounted
    useEffect(() => {
        void __getHomeCoupon();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧版 uni.navigateTo → redirect（默认 navigateTo 模式）
    const handleCoupon = (id: number) => {
        const url = shopId > -1 ? `/pages/coupon/detail?id=${id}&shopId=${shopId}` : `/pages/coupon/detail?id=${id}`;
        redirect({ url });
    };

    return (
        couponList?.length > 0 && (
            <View
                className={`module-ad-con module-image_hotarea ad-color_style__${module?.colorStyle}`}
                style={frameFormat.boxPaddingTop + frameFormat.boxPaddingBottom + couponFormat.boxMargin}
            >
                <View
                    className="module-ad-content"
                    style={frameFormat.backgroundColor + " " + frameFormat.boxRadius + couponFormat.boxRadius + couponFormat.backgroundColor}
                >
                    <View
                        className="coupon-ad-warp"
                        style={couponFormat.boxPadding + couponFormat.boxPaddingBottom + couponFormat.boxPaddingTop}
                    >
                        {module?.showTitle == 1 && (
                            <View className="coupon-title">
                                <View className="coupon-title-text">
                                    <View className="coupon-maintitle">{t(module.title)}</View>
                                    <View className="coupon-title-con">{t(module.desc)}</View>
                                </View>
                                <View>
                                    {/* 旧 navigator :url → View onClick + redirect */}
                                    <View
                                        className="more-box flex align-center"
                                        onClick={() =>
                                            redirect({
                                                url: shopId == -1 ? "/pages/coupon/index" : `/pages/coupon/index?shopId=${shopId}`
                                            })
                                        }
                                    >
                                        <Text className="more">{t("更多")}</Text>
                                        <Text className="iconfont-h5 icon-youjiantou" />
                                    </View>
                                </View>
                            </View>
                        )}
                        <View className="coupon-con">
                            {couponList.map((item: any) => (
                                <View
                                    key={item.couponId}
                                    className="coupon-item"
                                    style={couponFormat.itemPadding}
                                    onClick={() => handleCoupon(item.couponId)}
                                >
                                    <View className="item-coupon-con">
                                        <View className="coupon-money">
                                            {item.couponType == 2 ? (
                                                <>
                                                    <View className="zhekou"> {item.couponDiscount}</View>
                                                    <View className="zhe">{t("折")}</View>
                                                </>
                                            ) : (
                                                <FormatPrice
                                                    showText={false}
                                                    fontStyle={{ fontSize: "46rpx" }}
                                                    currencyStyle={{ fontSize: "24rpx" }}
                                                    decimalsStyle={{ fontSize: "32rpx" }}
                                                    priceData={item.couponMoney}
                                                />
                                            )}
                                        </View>
                                        <View className="coupon-name">
                                            <View className="coupon-name-text">{item.couponName}</View>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
            </View>
        )
    );
}
