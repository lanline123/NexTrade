import { useEffect, useRef, useState } from "react";
import { Text, Textarea, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigLoadingPage from "@/components/tig/tig-loadingpage";
import LoadingBox from "@/components/loading-box";
import ProductList from "./src/ProductList";
import BuyerShowCloseTip from "./src/BuyerShowCloseTip";
import MediaUpload from "./src/MediaUpload";
import type { MediaItem } from "./src/MediaUpload";
import { buyerShowAdd, getHistoryProduct } from "@/api/buyerShow/buyerShow";
import useList from "@/hooks/useList";
import { getElementRect, redirect } from "@/utils";
import { pxToRpx } from "@/utils/format";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./addBuyerShow.scss";

interface FormData {
    content: string;
    fileList: MediaItem[];
    rangeData: any[];
    buyerShowVideoList?: any[];
    imgList?: any[];
}

/**
 * 发布买家秀页（自旧 addBuyerShow.vue 移植）
 * - 上传图片/视频内容
 * - 编辑文字描述
 * - 关联已购商品
 *
 * 旧 up-form / up-form-item / up-textarea → 基础组件自绘表单行 + Taro Textarea
 * 旧 UploadMedia → 本目录 src/MediaUpload（见补齐依赖说明）
 */
export default function AddBuyerShow() {
    usePageGuards();
    const configStore = useConfigStore();

    const [buyerShowEnabled, setBuyerShowEnabled] = useState<number | undefined>(1);
    useEffect(() => {
        if (configStore.initLoading) {
            setBuyerShowEnabled(configStore.buyerShowEnabled);
        }
    }, [configStore.initLoading, configStore.buyerShowEnabled]);

    const filterParamsRef = useRef({ page: 1, size: 10 });
    const {
        data: products,
        isLoading,
        isLoadMore,
        total,
        getList
    } = useList(getHistoryProduct, {
        params: filterParamsRef.current,
        path: {
            dataKey: "records"
        },
        immediate: true,
        needReachBottom: false
    });

    const [form, setForm] = useState<FormData>({
        content: "",
        fileList: [],
        rangeData: []
    });

    const [productListHeight, setProductListHeight] = useState("");

    // 获取元素尺寸
    const getElementRectFormItem = () => {
        setTimeout(async () => {
            const rects: any = await getElementRect(".formItem", undefined, true);
            const safeRects = Array.isArray(rects) ? rects : rects ? [rects] : [];
            const height = safeRects.reduce((acc: any, cur: any) => {
                return acc + cur.height;
            }, 0);
            // 获取屏幕尺寸
            const screenHeight = Taro.getSystemInfoSync().screenHeight;
            setProductListHeight(`${pxToRpx(screenHeight) - pxToRpx(height) - configStore.navHeight - 260}rpx`);
        }, 0);
    };

    useLoad(() => {
        getElementRectFormItem();
    });

    // 旧 useList 暴露的 reachBottom：手动续页
    const reachBottom = () => {
        const page = filterParamsRef.current.page;
        const maxPage = Math.ceil(total / filterParamsRef.current.size);
        if (page >= maxPage) return;
        filterParamsRef.current.page = page + 1;
        void getList();
    };

    // 点击发布
    const handleClick = () => {
        const rangeData = products.filter((item: any) => item.isChecked).map((item: any) => item.productId);
        if (form.fileList.some((item) => item.uploading)) {
            Taro.showToast({ title: "文件上传中，请稍候", icon: "none" });
            return;
        } else if (!form.fileList.length) {
            Taro.showToast({
                title: t("请上传图片/视频"),
                icon: "none"
            });
            return;
        } else if (!rangeData.length) {
            Taro.showToast({
                title: t("请选择已购买的商品"),
                icon: "none"
            });
            return;
        } else if (!form.content) {
            Taro.showToast({
                title: t("请输入内容"),
                icon: "none"
            });
            return;
        }
        // 视频固定排在素材序列首位，覆盖上传失败重试、中途删除等导致的顺序变动
        const orderedFileList = [
            ...(form.fileList?.filter((item) => item.type === "video") ?? []),
            ...(form.fileList?.filter((item) => item.type !== "video") ?? [])
        ];
        const query: any = {
            ...form,
            rangeData,
            imgList: orderedFileList.filter((item) => item.type === "image"),
            buyerShowVideoList: orderedFileList.filter((item) => item.type === "video")
        };
        delete query.fileList;
        buyerShowAdd(query)
            .then(() => {
                Taro.showToast({
                    title: t("发布成功"),
                    icon: "none"
                });
                redirect({ url: "/pages/buyerShow/index" });
            })
            .catch(() => {});
    };

    if (buyerShowEnabled !== 1) {
        return (
            <TigLayout title={t("新增买家秀")}>
                <BuyerShowCloseTip buyerShowEnabled={buyerShowEnabled} onBuyerShowEnabledChange={setBuyerShowEnabled} />
            </TigLayout>
        );
    }

    return (
        <TigLayout title={t("新增买家秀")}>
            <View className="buyerShowForm">
                <View className="formBox">
                    <View className="formItem">
                        <View className="form-label">{t("上传图片/视频")}</View>
                        <View className="form-value">
                            <MediaUpload
                                mediaList={form.fileList}
                                onMediaListChange={(list) => setForm((prev) => ({ ...prev, fileList: list }))}
                                maxVideoCount={1}
                            />
                        </View>
                    </View>
                    <View className="formItem">
                        <View className="form-label">{t("内容")}</View>
                        <View className="form-value">
                            <View className="textarea-box">
                                <Textarea
                                    className="form-textarea"
                                    value={form.content}
                                    maxlength={500}
                                    placeholder={t("请输入内容（必填）")}
                                    placeholderStyle="background-color: #FAFAFA; padding: 0; color: #9A9A9A; font-size: 24rpx;"
                                    onInput={(event) => setForm((prev) => ({ ...prev, content: event.detail.value }))}
                                />
                                <Text className="textarea-count">{form.content.length}/500</Text>
                            </View>
                        </View>
                    </View>
                    <View className="formItem">
                        <View className="form-label">{t("选择已购买的商品")}</View>
                        <View className="form-value">
                            <ProductList
                                products={products}
                                total={total}
                                productListHeight={productListHeight}
                                onScrollToLower={reachBottom}
                            />
                        </View>
                    </View>
                </View>
            </View>
            <FixedPlaceholder height="120rpx" backgroundColor="#fff">
                <View className="footer">
                    <TigButton2 theme onClick={handleClick}>
                        {t("发布")}
                    </TigButton2>
                </View>
            </FixedPlaceholder>
            <TigLoadingPage modelValue={isLoading} />
            <LoadingBox modelValue={isLoadMore} page={filterParamsRef.current.page} length={products.length} />
        </TigLayout>
    );
}