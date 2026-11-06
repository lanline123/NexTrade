import { Fragment, useEffect, useMemo, useState } from "react";
import { Image, Text, View } from "@tarojs/components";

import { designPxToRpx, formatFrame } from "@/components/modules";
import TigImage from "@/components/tig/tig-image/TigImage";
import { pickPic } from "@/utils/format";
import CommonTitle from "@/pages/customPage/modules/commonTitle/index";
import { getHomeGrouponList } from "@/api/home/home";
import { useProductStyle } from "@/hooks/useProductStyle";
import { redirect } from "@/utils";
import { t } from "@/utils/i18n";
import FormatPrice from "@/components/format-price/FormatPrice";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

type GrouponListItem = any & {
    maxGroupNum: number;
};

// 自旧 utils/groupon.ts 平移（仅本模块使用，随模块落地）
export const getMaxGroupNumFromJson = (groupNum: string) => {
    if (!groupNum) {
        return 0;
    }

    try {
        const parsedGroupNum = JSON.parse(groupNum);
        if (!Array.isArray(parsedGroupNum)) {
            return 0;
        }

        return parsedGroupNum.reduce((maxGroupNum: number, item: any) => {
            const currentGroupNum = Number(item?.groupNum);
            if (!Number.isFinite(currentGroupNum)) {
                return maxGroupNum;
            }
            return Math.max(maxGroupNum, currentGroupNum);
        }, 0);
    } catch {
        return 0;
    }
};

export default function Groupon({ module }: Props) {
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
            case "1":
                return "big";
            case "2":
                return "small flex-end";
            case "5":
                return "list flex-end";
            case "6":
                return "small flex-end";
            default:
                return "";
        }
    }, [module.style]);

    const groupPirceStyle = useMemo(() => {
        if (module.style != 3) {
            return {
                fontSize: "32rpx"
            };
        } else {
            return {
                fontSize: "28rpx"
            };
        }
    }, [module.style]);

    const groupCurrencyStyle = useMemo(() => {
        if (module.style != 3) {
            return {
                fontSize: "24rpx"
            };
        } else {
            return {
                fontSize: "22rpx"
            };
        }
    }, [module.style]);

    /*转时间搓 */
    const dateStringToTimestamp = (dateString: any) => {
        const dateParts = dateString.split(" ");
        const [year, month, day] = dateParts[0].split("-");
        const [hour, minute, second] = dateParts[1].split(":");
        const date = new Date(year, month - 1, day, hour, minute, second);
        return date.getTime();
    };

    /**
     * 团是否结束了
     */
    const isActivityEnd = (item: any) => {
        // 不是待成团的状态，拼团结束了
        const endTime = dateStringToTimestamp(item.endTime);
        return endTime < new Date().getTime();
    };

    // 旧 uni.navigateTo("/pages/product/index?id=") → redirect（与 seckill React 版同口径，进商品详情后再走规格/拼团购买链路）
    // TODO(MIGRATION)：如需装修页内直接唤起拼团下单，可挂 Specification 弹层（forwardRef handleShowPopup/refresh）替代跳转
    const buy = (id: any) => {
        redirect({ url: "/pages/product/index?id=" + id });
    };

    const [grouponItemList, setGrouponItemList] = useState<GrouponListItem[]>([]);
    const { styleMap } = useProductStyle(grouponItemList);

    const getData = async (filterParams: any) => {
        try {
            const result = await getHomeGrouponList(filterParams);
            // 过滤掉拼团活动结束的
            const records = result.records.filter((item: any) => {
                return !isActivityEnd(item);
            });
            setGrouponItemList(
                records.map((item: any) => ({
                    ...item,
                    maxGroupNum: getMaxGroupNumFromJson(item.groupNum)
                }))
            );
        } catch (error) {
            console.error(error);
        }
    };

    // 对应旧 onMounted + reactive filterParams：React 用 effect 内局部参数对象，挂载时构建一次
    useEffect(() => {
        if (module.grouponActivityItem) {
            const filterParams = {
                //初始化用于查询的参数
                page: 1,
                size: 20,
                sortField: "",
                keyword: "",
                sortOrder: "",
                grouponPromotionId: 0
            };
            filterParams.grouponPromotionId = module.grouponActivityItem.grouponPromotionId;
            // 根据模式设置显示的参数
            if (module.style < 5) {
                filterParams.size = Number(module.style);
            } else if (module.style === 5) {
                // 大图模式
                filterParams.size = 1;
            }
            void getData(filterParams);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        grouponItemList && grouponItemList?.length > 0 && (
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
                        {grouponItemList.map((item: any) => (
                            <Fragment key={item.productId}>
                                {!isActivityEnd(item) && (
                                    <View className="goods-ad-item">
                                        <View className="item-content" style={allFormat.goodsPadding}>
                                            <View className="item-con">
                                                <View className="item-photo">
                                                    {/* 旧 navigator :url → View onClick + redirect */}
                                                    <View
                                                        className="item-image-a"
                                                        onClick={() => redirect({ url: "/pages/product/index?id=" + item.productId })}
                                                    >
                                                        <TigImage src={pickPic(item)} mode="widthFix" />
                                                    </View>
                                                    {(module.style < 3 || module.style == 5) && (
                                                        <View className={"cap-seckill-goods__tag " + className}>
                                                            {module?.style == 1 && <Text className="cap-seckill-goods__tag-title"> {t("拼团")} </Text>}
                                                            {/* 旧模板的倒计时分支（tig-countdown）被注释未启用，保持注释不迁移 */}
                                                        </View>
                                                    )}
                                                    {styleMap[item.productId]?.borderImage && (
                                                        <Image
                                                            className="product-style-border"
                                                            src={styleMap[item.productId].borderImage}
                                                            mode="scaleToFill"
                                                        />
                                                    )}
                                                </View>
                                                <View className="item-info">
                                                    <View className="item-name">
                                                        {module.showName && (
                                                            <View className="item-name-a line2">
                                                                <View className="group-num">
                                                                    <Text className="group-num-text">
                                                                        {item.maxGroupNum || 0}
                                                                        {t("人团")}
                                                                    </Text>
                                                                </View>
                                                                <View
                                                                    className="item-name-link"
                                                                    onClick={() => redirect({ url: "/pages/product/index?id=" + item.productId })}
                                                                >
                                                                    {item.productName ?? ""}
                                                                </View>
                                                            </View>
                                                        )}
                                                        {(module.style == 1 || module.style == 5) && module.grouponActivityItem.productBrief && (
                                                            <View className="item-brief product-desc">
                                                                <Text>{item.productBrief} </Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    {module.showPrice ? (
                                                        <View className="item-action">
                                                            <View className="item-price">
                                                                <FormatPrice
                                                                    fontStyle={groupPirceStyle as any}
                                                                    currencyStyle={groupCurrencyStyle as any}
                                                                    decimalsStyle={groupCurrencyStyle as any}
                                                                    priceData={item.minGrouponPrice}
                                                                />
                                                                {(module.style == 1 || module.style == 5) && (
                                                                    <View style={{ marginLeft: "8rpx" }}>
                                                                        <FormatPrice
                                                                            fontStyle={{ fontSize: "20rpx", color: "#ccc", textDecoration: "line-through" } as any}
                                                                            currencyStyle={{ fontSize: "18rpx", color: "#ccc", textDecoration: "line-through" } as any}
                                                                            decimalsStyle={{ fontSize: "18rpx", color: "#ccc", textDecoration: "line-through" } as any}
                                                                            priceData={item.productPrice}
                                                                        />
                                                                    </View>
                                                                )}
                                                            </View>
                                                            <View className="item-buy">
                                                                <View className="buy-btn" data-id={item.productId} onClick={() => buy(item.productId)}>
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
                                )}
                            </Fragment>
                        ))}
                    </View>
                </View>
            </View>
        )
    );
}
