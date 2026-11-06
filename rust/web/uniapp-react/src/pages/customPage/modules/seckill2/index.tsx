import { useEffect, useMemo, useState } from "react";
import { Image, Text, View } from "@tarojs/components";

import { designPxToRpx, formatFrame } from "@/components/modules";
import CommonTitle from "@/pages/customPage/modules/commonTitle/index";
import CommonCountdown from "@/pages/customPage/modules/commonCountdown/index";
import { getHomeSeckill } from "@/api/home/home";
import { redirect } from "@/utils";
import { isShowB2bPriceText } from "@/utils/b2bPrice";
import { useProductStyle } from "@/hooks/useProductStyle";
import TigImage from "@/components/tig/tig-image/TigImage";
import FormatPrice from "@/components/format-price/FormatPrice";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function Seckill2({ module }: Props) {
    const { frame } = module;

    const frameFormat = useMemo(() => {
        return formatFrame(frame ?? {});
    }, [frame]);

    // 旧 computed 一次性读取（非响应式依赖），React 侧挂载时求值一次
    const showB2bText = useMemo(() => isShowB2bPriceText(), []);

    const allFormat = useMemo(() => {
        return {
            backgroundColor: `background-color: ${module.backgroundColor};`,
            boxPadding: `margin-left: ${designPxToRpx(module.boxPadding)};margin-right: ${designPxToRpx(module.boxPadding)};`,
            boxPaddingBottom: `margin-bottom: ${designPxToRpx(module.boxPaddingBottom)};`,
            boxPaddingTop: `margin-top: ${designPxToRpx(module.boxPaddingTop)};`,
            boxRadius: `border-radius: ${designPxToRpx(module.boxRadius)};`,
            innerPadding: `padding: ${designPxToRpx(module.innerPadding)};`
        };
    }, [module]);

    const itemContentStyle = useMemo(() => {
        return `${module.style == 10 ? "padding-left" : "padding"}: ${designPxToRpx(module.goodsPadding)};`;
    }, [module.style, module.goodsPadding]);

    const goodsConStyle = useMemo(() => {
        let str = "";

        if (module.style == 10) {
            str += `display: flex; overflow: hidden;overflow-x: auto;flex-wrap: nowrap;padding-bottom: 20rpx;`;
        }

        return str;
    }, [module.style]);

    const adItemStyle = useMemo(() => {
        return module.style == 10 ? `width: ${100 / 3}%;flex-shrink: 0;flex-grow: 0;` : "";
    }, [module.style]);

    const getDiscount = (currentPrice: number, originalPrice: number) => {
        if (originalPrice === 0 || currentPrice >= originalPrice) {
            return 0;
        }

        const discountPercentage = ((originalPrice - currentPrice) / originalPrice) * 100;

        return Math.floor(discountPercentage * 10) / 10;
    };

    const [seckillList, setSeckillList] = useState<any[]>([]);
    const { styleMap } = useProductStyle(seckillList);
    const getData = async () => {
        try {
            const result = await getHomeSeckill();
            setSeckillList(result.records);
        } catch (error) {
            console.error(error);
        }
    };

    // 对应旧 onMounted
    useEffect(() => {
        void getData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getTime = useMemo(() => {
        return seckillList[0] ? new Date(seckillList[0].seckkillData.seckillEndTime).getTime() : 0;
    }, [seckillList]);

    return (
        seckillList && seckillList?.length > 0 && (
            <View
                className={
                    "module-ad-con module-goods_ad module-seckill-goods_ad ad-style__" +
                    module?.style +
                    " ad-buy_btn_style__" +
                    module?.buyBtnStyle +
                    " ad-goods_style__" +
                    module?.goodsStyle +
                    " ad-goods_radio_style__" +
                    module?.goodsRadioStyle +
                    " ad-text_align__" +
                    module?.textAlign +
                    " ad-text_weight__" +
                    module?.textWeight +
                    " ad-goods_name_row__" +
                    module?.goodsNameRow +
                    " ad-goods_name_padding__" +
                    module?.goodsNamePadding
                }
                style={frameFormat.boxPadding + frameFormat.boxPaddingTop + frameFormat.boxPaddingBottom + allFormat.backgroundColor}
            >
                <View
                    className="module-ad-content"
                    style={
                        frameFormat.backgroundColor +
                        " " +
                        frameFormat.boxRadius +
                        allFormat.boxPadding +
                        allFormat.boxPaddingBottom +
                        allFormat.boxPaddingTop +
                        allFormat.boxRadius +
                        allFormat.innerPadding
                    }
                >
                    {/* 旧版将「距结束」倒计时通过 #more 插槽传入 commonTitle（旧组件未定义插槽出口、未渲染）；React 版以 more prop 补齐 */}
                    <CommonTitle
                        module={module.title}
                        more={
                            module.title.showTitle == 1 ? (
                                <View onClick={() => redirect({ url: "/pages/seckill/list" })}>
                                    <CommonCountdown countdownType="specifyTime" specifyTime={getTime}>
                                        {(timeData) => (
                                            <View className="countdown-box">
                                                <Text className="countdown-text">{t("距结束")}</Text>
                                                {/* 旧 v-if="days && Number(days) > 0"：days 为 0 时整段隐藏（JSX 需避免渲染数字 0） */}
                                                {Number(timeData.days) > 0 && (
                                                    <>
                                                        <Text className={`countdown-item ${String(timeData.days).length > 2 ? "days" : ""}`}>
                                                            {timeData.days}
                                                        </Text>
                                                        <Text className="countdown-separator-text">{t("天")}</Text>
                                                    </>
                                                )}
                                                <Text className="countdown-item">{timeData.hours}</Text>
                                                <Text className="countdown-separator">:</Text>
                                                <Text className="countdown-item">{timeData.minutes}</Text>
                                                <Text className="countdown-separator">:</Text>
                                                <Text className="countdown-item">{timeData.seconds}</Text>
                                                <Text className="iconfont-h5 icon-youjiantou" />
                                            </View>
                                        )}
                                    </CommonCountdown>
                                </View>
                            ) : null
                        }
                    />

                    <View className="goods-ad-warp">
                        <View className="goods-ad-con" style={goodsConStyle}>
                            {seckillList.map((item: any) => (
                                <View key={item.productId} className="goods-ad-item" style={adItemStyle}>
                                    <View className="item-content" style={itemContentStyle}>
                                        {/* 旧 navigator :url → View onClick + redirect */}
                                        <View
                                            className="item-image-a"
                                            onClick={() => redirect({ url: "/pages/product/index?id=" + item.productId })}
                                        >
                                            <View className="item-con">
                                                <View className="item-photo">
                                                    <TigImage src={item.picUrl} mode="widthFix" />

                                                    {styleMap[item.productId]?.borderImage && (
                                                        <Image
                                                            className="product-style-border"
                                                            src={styleMap[item.productId].borderImage}
                                                            mode="scaleToFill"
                                                        />
                                                    )}

                                                    <View className="item-photo-bg" style={{ backgroundColor: module.imageBackgroundColor }} />
                                                </View>
                                                <View className="item-info">
                                                    {module.showName == 1 && (
                                                        <View className="item-name">
                                                            <View
                                                                className="item-name-a"
                                                                onClick={() => redirect({ url: "/pages/product/index?id=" + item.productId })}
                                                            >
                                                                {item.productName ?? ""}
                                                            </View>
                                                        </View>
                                                    )}
                                                    <View className="tips">
                                                        {t("优惠{0}%", {
                                                            0: getDiscount(Number(item.seckillPrice), Number(item.marketPrice))
                                                        })}
                                                    </View>
                                                    {module.showPrice ? (
                                                        <View className="item-action">
                                                            <View className="item-price">
                                                                <FormatPrice
                                                                    fontStyle={{ fontSize: "32rpx", fontWeight: "bold" }}
                                                                    currencyStyle={{
                                                                        fontSize: "24rpx",
                                                                        fontWeight: "bold"
                                                                    }}
                                                                    decimalsStyle={{
                                                                        fontSize: "24rpx",
                                                                        fontWeight: "bold"
                                                                    }}
                                                                    priceData={item.seckillPrice}
                                                                />
                                                                {module.style == 10 && !showB2bText && (
                                                                    <View className="price-through">
                                                                        <FormatPrice
                                                                            fontStyle={{ textDecoration: "line-through" }}
                                                                            priceData={item.orgProductPrice}
                                                                            showDecimals={false}
                                                                        />
                                                                    </View>
                                                                )}
                                                            </View>
                                                        </View>
                                                    ) : null}
                                                </View>
                                            </View>
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
