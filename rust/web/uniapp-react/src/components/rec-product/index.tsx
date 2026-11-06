import { useEffect, useMemo, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { getSignList } from "@/api/user/sign";
import FormatPrice from "@/components/format-price/FormatPrice";
import { useProductStyle } from "@/hooks/useProductStyle";
import type { SignInfo } from "@/types/user/sign";
import { productImage } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    url: string;
}

/**
 * 签到推荐商品（自旧 components/rec-product/index.vue 逐行移植）
 * - 展示签到接口返回的推荐商品（标题 + 四宫格）
 * - 商品图右下角叠加生效样式边框
 */
export default function RecProduct({ url }: Props) {
    const [signInfo, setSignInfo] = useState<SignInfo>({
        signPoints: 0,
        record: 0,
        isSign: 0,
        days: [],
        recommendGoods: []
    });

    const recommendList = useMemo(() => signInfo?.recommendGoods || [], [signInfo.recommendGoods]);
    const { styleMap } = useProductStyle(recommendList);

    const __getSignList = async () => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            const result: any = await getSignList(url);
            setSignInfo((prev) => ({ ...prev, ...result }));
        } catch (error) {
            console.error(error);
        } finally {
            Taro.hideLoading();
        }
    };

    const toProductPage = (params: any) => {
        Taro.navigateTo({ url: "/pages/product/index?id=" + params.productId });
    };

    useEffect(() => {
        void __getSignList();
        // 对应旧 onMounted，仅执行一次
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <View className="recgoods-box">
            <View className="title">
                <View className="bg" />
                <View className="moregoods" onClick={() => Taro.navigateTo({ url: "/pages/search/index" })}>
                    {t("查看更多")} <Text className="iconfont icon-xiangyou" />
                </View>
            </View>
            <View className="wrap-goods">
                {signInfo.recommendGoods.map((item, index) => (
                    <View className="item" key={index} onClick={() => toProductPage(item)}>
                        <View className="rec-img-wrap">
                            <Image className="rec-img" mode="widthFix" src={productImage(item as any)} />
                            {styleMap[item.productId]?.borderImage && (
                                <Image className="product-style-border" mode="scaleToFill" src={styleMap[item.productId].borderImage} />
                            )}
                        </View>
                        <View className="info">
                            <View className="name">{item.productName}</View>
                            <View className="price">
                                <FormatPrice priceData={item.productPrice} />
                            </View>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}