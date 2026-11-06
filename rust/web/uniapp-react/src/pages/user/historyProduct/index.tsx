import { useEffect, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { delHistoryProduct, historyProductList } from "@/api/user/historyProduct";
import { useProductStyle } from "@/hooks/useProductStyle";
import { useI18nStore } from "@/store/i18n";
import type { HistoryProductList } from "@/types/user/historyProduct";
import { staticResource } from "@/utils";
import { pickPic } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./index.scss";

/**
 * 浏览记录页（自旧 pages/user/historyProduct/index.vue 逐行移植）
 * - 展示用户浏览过的商品列表（双列网格）
 * - 支持管理模式：全选、批量删除
 * - 点击商品跳转商品详情
 */
export default function HistoryProduct() {
    usePageGuards();

    // 订阅语言，切换语言时重算 t() 文案
    const langCode = useI18nStore((s) => s.langCode);
    void langCode;

    const [loading, setLoading] = useState(true);
    const [historyList, setHistoryList] = useState<HistoryProductList[]>([]);
    const { styleMap } = useProductStyle(historyList);
    const [checkboxValue, setCheckboxValue] = useState<number[]>([]);
    const [edit, setEdit] = useState(false);
    const [allChecked, setAllChecked] = useState(false);

    const checkboxChange = (val: number[]) => {
        if (val.length == historyList.length) {
            setAllChecked(true);
        } else {
            setAllChecked(false);
        }
    };

    const handleAll = () => {
        const next = !allChecked;
        setAllChecked(next);
        if (next) {
            setCheckboxValue(historyList.map((item) => item.productId));
            return;
        }
        setCheckboxValue([]);
    };

    const handleDel = async () => {
        try {
            await delHistoryProduct(checkboxValue);
            Taro.showToast({
                title: t("删除成功"),
                icon: "none"
            });
            void getHistoryProductList();
        } catch (error) {
            console.error(error);
        }
    };

    const getHistoryProductList = async () => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            const result: any = await historyProductList();
            setHistoryList(result);
            if (allChecked) {
                setCheckboxValue(result.map((item: HistoryProductList) => item.productId));
                return;
            }
        } catch (error) {
            console.error(error);
        } finally {
            Taro.hideLoading();
            setLoading(false);
        }
    };

    // 旧 setup 顶层直接调用 getHistoryProductList()
    useEffect(() => {
        void getHistoryProductList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLink = (id: number, shopId?: number) => {
        if (edit) return;
        let url = `/pages/product/index?id=${id}`;
        if (shopId && shopId > 0) {
            url += `&shopId=${shopId}`;
        }
        Taro.redirectTo({ url });
    };

    /** 勾选/取消某个商品（旧 up-checkbox-group v-model） */
    const handleItemCheck = (productId: number) => {
        const next = checkboxValue.includes(productId)
            ? checkboxValue.filter((id) => id !== productId)
            : [...checkboxValue, productId];
        setCheckboxValue(next);
        checkboxChange(next);
    };

    return (
        <TigLayout title={t("浏览记录")}>
            {historyList.length > 0 && (
                <View className="history-product">
                    {historyList.map((item) => (
                        <View className="history-product-item" key={item.productId} onClick={() => handleLink(item.productId, item.shopId)}>
                            <View className="history-product-item-top">
                                <View className="img-box">
                                    <TigImage src={pickPic(item)} mode="aspectFill" />
                                    {styleMap[item.productId]?.borderImage && (
                                        <Image
                                            className="product-style-border"
                                            src={styleMap[item.productId].borderImage}
                                            mode="scaleToFill"
                                        />
                                    )}
                                </View>
                            </View>
                            <View className="history-product-item-bottom">
                                <View className="detail line2">{item.productName}</View>
                                <View className="price">
                                    <FormatPrice
                                        fontStyle={{
                                            fontSize: "32rpx"
                                        }}
                                        currencyStyle={{
                                            fontSize: "22rpx"
                                        }}
                                        decimalsStyle={{
                                            fontSize: "25rpx"
                                        }}
                                        priceData={item.price}
                                    />
                                </View>
                            </View>
                            {edit && (
                                <View
                                    className="item-btn"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        handleItemCheck(item.productId);
                                    }}
                                >
                                    <View className="btn-box">
                                        <View
                                            className={`tig-check-circle${checkboxValue.includes(item.productId) ? " is-checked" : ""}`}
                                        />
                                    </View>
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            )}

            {!loading && historyList.length == 0 && (
                <View className="empty-box">
                    <View className="pictrue">
                        <Image src={staticResource("common/data_empty.png")} />
                    </View>
                    <View className="txt">{t("暂无浏览记录！")}</View>
                </View>
            )}

            <FixedPlaceholder backgroundColor="#fff">
                <View className="footer-box">
                    {!edit ? (
                        <View className="footer-text">
                            <View className="footer-num">
                                {t("共")}
                                <Text className="num">{historyList.length}</Text>
                                {t("件商品")}
                            </View>
                            <View className="footer-text-btn">
                                <TigButton2 className="btn" theme onClick={() => setEdit(true)}>
                                    {t("管理")}
                                </TigButton2>
                            </View>
                        </View>
                    ) : (
                        <View className="footer-edit">
                            <View className="all-check" onClick={handleAll}>
                                <View className={`tig-check-circle all-check-circle${allChecked ? " is-checked" : ""}`} />
                                <Text>{t("全选")}</Text>
                            </View>
                            <View className="edit-btn">
                                <TigButton2 className="btn" plain onClick={() => setEdit(false)}>
                                    {t("取消")}
                                </TigButton2>
                                <TigButton2 className="btn" theme disabled={!checkboxValue.length} onClick={handleDel}>
                                    {t("删除")}
                                </TigButton2>
                            </View>
                        </View>
                    )}
                </View>
            </FixedPlaceholder>
        </TigLayout>
    );
}