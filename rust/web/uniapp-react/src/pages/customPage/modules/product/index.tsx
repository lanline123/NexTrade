import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Swiper, SwiperItem, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { designPxToDevicePx, designPxToRpx, formatFrame } from "@/components/modules";
import FormatPrice from "@/components/format-price/FormatPrice";
import TigImage from "@/components/tig/tig-image/TigImage";
import { getProductsList } from "@/api/common";
import CommonTitle from "@/pages/customPage/modules/commonTitle/index";
import { useProductStyle } from "@/hooks/useProductStyle";
import { productImage, pickPic, urlFormat } from "@/utils/format";
import { redirect, delay, getElementRect } from "@/utils";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
    shopId?: number;
}

// 对应旧 nextTick：状态更新后的渲染时机
const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export default function Product({ module, shopId = -1 }: Props) {
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

    const paramsValueMap: { [key: number]: string[] } = {
        1: ["productIds"],
        2: ["productCategoryId", "productNumber"],
        3: ["productTag", "productNumber"]
    };
    const paramsKeyMap: { [key: string]: string } = {
        productIds: "ids",
        productCategoryId: "categoryId",
        productNumber: "size",
        productTag: "introType"
    };
    const [productList, setProductList] = useState<any[]>([]);
    const { styleMap } = useProductStyle(productList);

    // ========== 瀑布流（仅"一行两个"且开启瀑布流时生效，按列高分配实现真瀑布流） ==========
    const rootRef = useRef<any>(null);
    const isWaterfall = useMemo(() => Number(module.style) === 2 && Number(module.waterfall) === 1, [module.style, module.waterfall]);
    const [columnList, setColumnList] = useState<any[][]>([[], []]);
    const columnListRef = useRef<any[][]>([[], []]);
    const waterfallTaskIdRef = useRef(0);
    const distributeWaterfall = async (items: any[]) => {
        waterfallTaskIdRef.current++;
        const taskId = waterfallTaskIdRef.current;
        columnListRef.current = [[], []];
        setColumnList([[], []]);
        await nextTick();
        const columnHeights = [0, 0];
        const fallbackHeight = designPxToDevicePx(300);
        for (let i = 0; i < items.length; i++) {
            if (taskId !== waterfallTaskIdRef.current) return;
            let idx: number;
            if (columnHeights[0] === columnHeights[1]) {
                // 高度相等（含首次测高失败两列都为 0）时按已渲染数量交替，避免全堆一列
                idx = columnListRef.current[0].length > columnListRef.current[1].length ? 1 : 0;
            } else {
                idx = columnHeights[0] < columnHeights[1] ? 0 : 1;
            }
            columnListRef.current[idx].push(items[i]);
            setColumnList([columnListRef.current[0], columnListRef.current[1]]);
            await delay(80);
            await nextTick();
            if (taskId !== waterfallTaskIdRef.current) return;
            try {
                const rect: any = await getElementRect(`#wf-col-${idx}`, rootRef.current);
                columnHeights[idx] = rect?.height || columnHeights[idx] + fallbackHeight;
            } catch {
                columnHeights[idx] += fallbackHeight;
            }
        }
    };
    useEffect(() => {
        if (isWaterfall && productList && productList.length) {
            distributeWaterfall(productList);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productList, isWaterfall]);

    const _getproductList = async () => {
        let param: any = {};
        if (typeof module.products === "object") {
            if (module.products.productSelectType) {
                const type = module.products.productSelectType;
                const keys = paramsValueMap[type];
                if (type == 1) {
                    param[paramsKeyMap[keys[0]]] = module.products.productIds.join(",");
                    param.size = module.products.productIds.length;
                } else {
                    param.page = 1;
                    keys.forEach((key) => {
                        param[paramsKeyMap[key]] = module.products[key];
                    });
                }
            }
        }
        if (shopId && shopId != -1) {
            param.shopId = shopId;
        }
        try {
            const result = await getProductsList(param);
            setProductList(result.records);
        } catch (error) {
            console.log(error);
        }
    };
    useEffect(() => {
        void _getproductList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [swiperList, setSwiperList] = useState<any[]>([]);
    const [swiperBottom, setSwiperBottom] = useState(designPxToDevicePx(15));
    const updateSwiperBottom = () => {
        setSwiperBottom(designPxToDevicePx(15));
    };
    useEffect(() => {
        Taro.onWindowResize(updateSwiperBottom);
        return () => {
            Taro.offWindowResize(updateSwiperBottom);
        };
    }, []);
    const getSwiperList = () => {
        if (module.style == 7 && productList) {
            const list: any[] = [];
            const swiperListNum = Math.ceil(productList.length / 3);
            for (let index = 0; index < swiperListNum; index++) {
                list.push(productList.slice(index * 3, (index + 1) * 3));
            }
            setSwiperList(list);
        } else {
            setSwiperList([]);
        }
    };
    useEffect(() => {
        getSwiperList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [module.style, productList]);

    const [current, setCurrent] = useState(0);
    const selectColor = useMemo(() => {
        return module.swiperPageColor || "#333";
    }, [module.swiperPageColor]);

    return (
        productList.length > 0 && (
            <View
                ref={rootRef as any}
                className={`module-ad-con module-goods_ad ad-style__${module.style} ad-buy_btn_style__${module.buyBtnStyle} ad-goods_style__${module.goodsStyle} ad-goods_radio_style__${module.goodsRadioStyle} ad-text_align__${module.textAlign} ad-text_weight__${module.textWeight} ad-goods_name_row__${module.goodsNameRow} ad-goods_name_padding__${module.goodsNamePadding} ad-goods-title_style__${module.title?.titleStyle}${
                    isWaterfall ? " ad-waterfall__1" : ""
                }`}
                style={frameFormat.boxPadding + frameFormat.boxPaddingTop + frameFormat.boxPaddingBottom}
            >
                <View
                    className={`module-ad-content ad-goods-waterfall-${module.waterfall}`}
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
                    {productList.length > 0 && (
                        <>
                            {module.style == 7 ? (
                                <View className="goods-ad-warp">
                                    <View className="goods-ad-con">
                                        <View
                                            className={`goods-ad-swiper ${module.picPageType == 3 ? "uni-swiper-dot-box" : ""}`}
                                            // 旧 tig-swiper 等价展开：height=480rpx、circular、autoplay 默认 true、interval 3000
                                            style={{ height: "480rpx" }}
                                        >
                                            <Swiper
                                                circular
                                                indicatorDots={false}
                                                autoplay
                                                interval={3000}
                                                duration={500}
                                                style={{ height: "100%" }}
                                                onChange={(e: any) => setCurrent(e.detail.current)}
                                            >
                                                {swiperList.map((item, key) => (
                                                    <SwiperItem key={key}>
                                                        {item.map((subItem: any, index: number) => (
                                                            <View key={index} className="goods-ad-item">
                                                                <View className="item-content" style={allFormat.goodsPadding}>
                                                                    <View className="item-con">
                                                                        <View className="item-photo">
                                                                            <View
                                                                                className="item-image-a"
                                                                                onClick={() =>
                                                                                    redirect({
                                                                                        url: urlFormat({ path: "product", data: { id: subItem.productId } })
                                                                                    })
                                                                                }
                                                                            >
                                                                                <Image src={productImage(subItem)} mode="widthFix" />
                                                                            </View>
                                                                            {styleMap[subItem.productId]?.borderImage && (
                                                                                <Image
                                                                                    className="product-style-border"
                                                                                    src={styleMap[subItem.productId].borderImage}
                                                                                    mode="scaleToFill"
                                                                                />
                                                                            )}
                                                                        </View>
                                                                        <View className="item-info">
                                                                            {module.showName && (
                                                                                <View className="item-name">
                                                                                    <View
                                                                                        className="item-name-a"
                                                                                        onClick={() =>
                                                                                            redirect({
                                                                                                url: urlFormat({ path: "product", data: { id: subItem.productId } })
                                                                                            })
                                                                                        }
                                                                                    >
                                                                                        <Text>{subItem.productName ?? ""}</Text>
                                                                                    </View>
                                                                                    {module.showBrief && (
                                                                                        <View
                                                                                            className="item-brief"
                                                                                            onClick={() =>
                                                                                                redirect({
                                                                                                    url: urlFormat({ path: "product", data: { id: subItem.productId } })
                                                                                                })
                                                                                            }
                                                                                        >
                                                                                            {t(subItem.productBrief ?? "商品描述")}
                                                                                        </View>
                                                                                    )}
                                                                                </View>
                                                                            )}
                                                                            {module?.showPrice && (
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
                                                                                            priceData={
                                                                                                subItem.deliveryMode === 2 ? subItem.cyclePrice : subItem.productPrice
                                                                                            }
                                                                                        />
                                                                                    </View>
                                                                                    <View className="item-buy" />
                                                                                </View>
                                                                            )}
                                                                        </View>
                                                                    </View>
                                                                </View>
                                                            </View>
                                                        ))}
                                                    </SwiperItem>
                                                ))}
                                            </Swiper>
                                            {module.picPageType == 3 && (
                                                <View className="swiper-pagination-con" style={{ bottom: swiperBottom + "px" }}>
                                                    {swiperList.map((_, key) => (
                                                        <View
                                                            key={key}
                                                            className={`swiper-pagination ${current === key ? "active" : ""}`}
                                                            style={current === key ? { backgroundColor: selectColor } : {}}
                                                        />
                                                    ))}
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            ) : isWaterfall ? (
                                <View className="goods-ad-warp">
                                    <View className="goods-ad-con">
                                        {columnList.map((col, colIndex) => (
                                            <View id={`wf-col-${colIndex}`} key={`wf-col-${colIndex}`} className="goods-ad-col">
                                                {col.map((item: any) => (
                                                    <View key={item.productId} className="goods-ad-item">
                                                        <View className="item-content" style={allFormat.goodsPadding}>
                                                            <View className="item-con">
                                                                <View className="item-photo">
                                                                    <View
                                                                        className="item-image-a"
                                                                        onClick={() =>
                                                                            redirect({ url: urlFormat({ path: "product", data: { id: item.productId } }) })
                                                                        }
                                                                    >
                                                                        <TigImage src={pickPic(item)} mode="widthFix" />
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
                                                                                onClick={() =>
                                                                                    redirect({ url: urlFormat({ path: "product", data: { id: item.productId } }) })
                                                                                }
                                                                            >
                                                                                <Text> {t(item.productName ?? "商品名称")} </Text>
                                                                            </View>
                                                                        </View>
                                                                    )}
                                                                    {module.showPrice ? (
                                                                        <View className="item-action">
                                                                            <View className="item-price">
                                                                                <FormatPrice
                                                                                    fontStyle={{ fontSize: "32rpx" }}
                                                                                    currencyStyle={{ fontSize: "22rpx", position: "relative", top: "-3rpx" }}
                                                                                    priceData={item.deliveryMode === 2 ? item.cyclePrice : item.productPrice}
                                                                                />
                                                                            </View>
                                                                            <View
                                                                                className="item-buy"
                                                                                onClick={() => redirect({ url: `/pages/product/index?id=${item.productId}` })}
                                                                            >
                                                                                <View className="buy-btn">
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
                                        ))}
                                    </View>
                                </View>
                            ) : (
                                <View className="goods-ad-warp">
                                    <View className="goods-ad-con">
                                        {productList.map((item: any) => (
                                            <View key={item.productId} className="goods-ad-item">
                                                <View className="item-content" style={allFormat.goodsPadding}>
                                                    <View className="item-con">
                                                        <View className="item-photo">
                                                            <View
                                                                className="item-image-a"
                                                                onClick={() => redirect({ url: urlFormat({ path: "product", data: { id: item.productId } }) })}
                                                            >
                                                                <TigImage src={pickPic(item)} mode="widthFix" />
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
                                                                        onClick={() =>
                                                                            redirect({ url: urlFormat({ path: "product", data: { id: item.productId } }) })
                                                                        }
                                                                    >
                                                                        <Text> {t(item.productName ?? "商品名称")} </Text>
                                                                    </View>
                                                                </View>
                                                            )}
                                                            {module.showPrice ? (
                                                                <View className="item-action">
                                                                    <View className="item-price">
                                                                        <FormatPrice
                                                                            fontStyle={{ fontSize: "32rpx" }}
                                                                            currencyStyle={{ fontSize: "22rpx", position: "relative", top: "-3rpx" }}
                                                                            priceData={item.deliveryMode === 2 ? item.cyclePrice : item.productPrice}
                                                                        />
                                                                    </View>
                                                                    <View
                                                                        className="item-buy"
                                                                        onClick={() => redirect({ url: `/pages/product/index?id=${item.productId}` })}
                                                                    >
                                                                        <View className="buy-btn">
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
                            )}
                        </>
                    )}
                </View>
            </View>
        )
    );
}
