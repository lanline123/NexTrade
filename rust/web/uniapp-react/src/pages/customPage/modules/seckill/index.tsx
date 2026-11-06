import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Text, View } from "@tarojs/components";

import { designPxToRpx, formatFrame } from "@/components/modules";
import FormatPrice from "@/components/format-price/FormatPrice";
import TigImage from "@/components/tig/tig-image/TigImage";
import CommonTitle from "@/pages/customPage/modules/commonTitle/index";
import { getHomeSeckill } from "@/api/home/home";
import { useProductStyle } from "@/hooks/useProductStyle";
import { pickPic } from "@/utils/format";
import { redirect } from "@/utils";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

/**
 * 旧 tig-countdown.vue + uni-countdown（uni-ui）等价展开：
 * - 旧 tig-countdown 解析 "YYYY-MM-DD HH:mm:ss" 结束时间，挂载时算一次差值（days/hours/minutes/seconds）；
 * - 差值交给 uni-countdown 内部定时器逐秒递减展示（show-day：days>0 才显示天段，":" 分隔，两位补零）；
 * - React 侧合并为「挂载算一次 + 每秒重算」，口径一致。
 */
function TigCountdown({ endTime }: { endTime: string }) {
    const [timeData, setTimeData] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        /*转时间搓（旧 tig-countdown 注释） */
        const dateStringToTimestamp = (dateString: string) => {
            const dateParts = dateString.split(" ");
            const [year, month, day] = dateParts[0].split("-");
            const [hour, minute, second] = dateParts[1].split(":");
            return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).getTime();
        };
        const countdownInit = () => {
            const endTimestamp = dateStringToTimestamp(endTime);
            const nowTimestamp = new Date().getTime();
            // 计算差值（毫秒）
            const diffMilliseconds = endTimestamp - nowTimestamp;
            if (diffMilliseconds > 0) {
                setTimeData({
                    days: Math.floor(diffMilliseconds / (1000 * 60 * 60 * 24)),
                    hours: Math.floor(diffMilliseconds / (1000 * 60 * 60)) % 24,
                    minutes: Math.floor(diffMilliseconds / (1000 * 60)) % 60,
                    seconds: Math.floor(diffMilliseconds / 1000) % 60
                });
            } else {
                setTimeData({ days: 0, hours: 0, minutes: 0, seconds: 0 });
            }
        };
        countdownInit();
        timerRef.current = setInterval(countdownInit, 1000);
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [endTime]);

    const formatTime = (time: number) => time.toString().padStart(2, "0");

    // tig-countdown 默认 color/splitorColor #fff、fontSize 12（px），在此以容器内联样式还原
    return (
        <View className="tig-countdown" style={{ color: "#fff", fontSize: "12px" }}>
            {timeData.days > 0 && (
                <>
                    <Text className="uni-countdown__number">{formatTime(timeData.days)}</Text>
                    <Text className="uni-countdown__splitor">:</Text>
                </>
            )}
            <Text className="uni-countdown__number">{formatTime(timeData.hours)}</Text>
            <Text className="uni-countdown__splitor">:</Text>
            <Text className="uni-countdown__number">{formatTime(timeData.minutes)}</Text>
            <Text className="uni-countdown__splitor">:</Text>
            <Text className="uni-countdown__number">{formatTime(timeData.seconds)}</Text>
        </View>
    );
}

export default function Seckill({ module }: Props) {
    const { frame } = module;

    const frameFormat = useMemo(() => {
        return formatFrame(frame ?? {});
    }, [frame]);

    const allFormat = useMemo(() => {
        return {
            backgroundColor: `background-color: ${module.backgroundColor};`,
            boxPadding: `margin-left: ${designPxToRpx(module.boxPadding)};margin-right: ${designPxToRpx(module.boxPadding)};`,
            boxPaddingBottom: `margin-bottom: ${designPxToRpx(module.boxPaddingBottom)};`,
            boxPaddingTop: `margin-top: ${designPxToRpx(module.boxPaddingTop)};`,
            boxRadius: `border-radius: ${designPxToRpx(module.boxRadius)};`,
            innerPadding: `padding: ${designPxToRpx(module.innerPadding)};`,
            goodsPadding: `padding: ${designPxToRpx(module.goodsPadding)};`
        };
    }, [module]);

    const className = useMemo(() => {
        switch (module.style) {
            case 1:
                return "big";
            case 2:
                return "small flex-end";
            case 5:
                return "list flex-end";
            case 6:
                return "small flex-end";
            default:
                return "";
        }
    }, [module.style]);

    // 旧 uni.navigateTo → redirect（默认 navigateTo 模式）
    const buy = (id: any) => {
        redirect({ url: "/pages/product/index?id=" + id });
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
                style={frameFormat.boxPadding + frameFormat.boxPaddingTop + frameFormat.boxPaddingBottom}
            >
                <View
                    className="module-ad-content"
                    style={
                        frameFormat.backgroundColor +
                        " " +
                        frameFormat.boxRadius +
                        allFormat.backgroundColor +
                        allFormat.boxPadding +
                        allFormat.boxPaddingBottom +
                        allFormat.boxPaddingTop +
                        allFormat.boxRadius +
                        allFormat.innerPadding
                    }
                >
                    {module.title.showTitle == 1 && <CommonTitle module={module.title} />}

                    <View className="goods-ad-warp">
                        <View className="goods-ad-con">
                            {seckillList.map((item: any) => (
                                <View key={item.productId} className="goods-ad-item">
                                    <View className="item-content" style={allFormat.goodsPadding}>
                                        <View className="item-con">
                                            <View className="item-photo">
                                                {/* 旧 navigator :url → View onClick + redirect */}
                                                <View
                                                    className="item-image-a"
                                                    onClick={() => redirect({ url: "/pages/product/index?id=" + item.productId })}
                                                >
                                                    <TigImage src={pickPic(item)} mode={module?.style == 6 ? "aspectFill" : "widthFix"} />
                                                </View>
                                                <View className={"cap-seckill-goods__tag " + className}>
                                                    {module?.style == 1 && <Text className="cap-seckill-goods__tag-title"> {t("秒杀")} </Text>}
                                                    <TigCountdown endTime={item.seckkillData.seckillEndTime} />
                                                </View>
                                                {styleMap[item.productId]?.borderImage && (
                                                    <Image
                                                        className="product-style-border"
                                                        src={styleMap[item.productId].borderImage}
                                                        mode="scaleToFill"
                                                    />
                                                )}
                                            </View>
                                            <View className="item-info">
                                                {module.showName && (
                                                    <View className="item-name">
                                                        <View
                                                            className="item-name-a"
                                                            onClick={() => redirect({ url: "/pages/product/index?id=" + item.productId })}
                                                        >
                                                            {item.productName ?? ""}
                                                        </View>
                                                    </View>
                                                )}
                                                {module.showPrice ? (
                                                    <View className="item-action">
                                                        <View className="item-price">
                                                            <FormatPrice
                                                                fontStyle={{ fontSize: "32rpx" }}
                                                                currencyStyle={{
                                                                    fontSize: "22rpx"
                                                                }}
                                                                decimalsStyle={{
                                                                    fontSize: "24rpx"
                                                                }}
                                                                priceData={item.seckillPrice}
                                                            />
                                                        </View>
                                                        <View className="item-buy">
                                                            <View className="buy-btn" onClick={() => buy(item.productId)}>
                                                                {module.buyBtnStyle == 5 || module.buyBtnStyle == 6 ? (
                                                                    <View>{t("购买")}</View>
                                                                ) : module.buyBtnStyle == 7 || module.buyBtnStyle == 8 ? (
                                                                    <View>{t("马上抢")}</View>
                                                                ) : (
                                                                    <View className="iconfont-h5" />
                                                                )}
                                                            </View>
                                                        </View>
                                                    </View>
                                                ) : (
                                                    <View className="blank" style={{ height: "20rpx" }} />
                                                )}
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
