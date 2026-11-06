import { useEffect, useRef, useState } from "react";
import { RichText, ScrollView, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import Empty from "./src/Empty";
import SearchInput from "./src/SearchInput";
import MaterialPopover from "./src/MaterialPopover";
import MaterialSaveCard from "./src/MaterialSaveCard";
import MaterialChoosePoster from "./src/MaterialChoosePoster";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { materialCategoryList, materialDetail, materialList } from "@/api/salesman/salesman";
import { useSaveTopBoxHeight } from "@/hooks";
import useList from "@/hooks/useList";
import { useConfigStore } from "@/store/config";
import type { MaterialCategoryItem, MaterialListFilterResult } from "@/types/salesman/salesman";
import { copy, getDownloadFileInfo, saveImageToAlbum, staticResource } from "@/utils";
import { imageFormat, pickPic } from "@/utils/format";
import { t } from "@/utils/i18n";
import { navigateBack } from "@/utils/navigation";
import { usePageGuards } from "@/utils/pageMixin";

import { createQrcodePath } from "./src/qrcode";

import "./material.scss";

/**
 * 推广素材库页（自旧 pages/salesman/material.vue 逐行移植）
 * - 展示分销推广素材（图片、文案）
 * - 分类筛选和搜索素材
 * - 一键保存素材到相册
 */
export default function SalesmanMaterial() {
    usePageGuards();

    const { height, contentHeight, contentWidth, statusBarHeight } = useSaveTopBoxHeight(60);
    const h5Domain = useConfigStore((s) => s.baseInfo.h5Domain);
    const icoImg = useConfigStore((s) => s.baseInfo.icoImg);

    const [keyword, setKeyword] = useState("");
    const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
    const [categoryList, setCategoryList] = useState<MaterialCategoryItem[]>([
        {
            categoryId: null,
            categoryName: t("全部")
        }
    ]);

    const filterParamsRef = useRef<{
        keyword: string;
        page: number;
        size: number;
        categoryId: number | null;
    }>({
        keyword: "",
        page: 1,
        size: 10,
        categoryId: null
    });
    const filterParams = filterParamsRef.current;

    const { data: list, isLoading, total, getList, resetState } = useList<MaterialListFilterResult>(materialList, {
        params: filterParams,
        path: {
            dataKey: "records"
        }
    });

    const [showSaveCard, setShowSaveCard] = useState(false);
    const [showChoosePoster, setShowChoosePoster] = useState(false);
    const [currentPics, setCurrentPics] = useState<any[]>([]);
    const [currentData, setCurrentData] = useState<any>({});
    const [qrcodePath, setQrcodePath] = useState("");

    const getMaterialCategoryList = async () => {
        try {
            const result = await materialCategoryList();
            setCategoryList((prev) => [...prev, ...result]);
        } catch (err) {
            console.error(err);
        }
    };

    const getMaterialDetail = async (id: number) => {
        try {
            await materialDetail(id);
        } catch (error) {
            console.error(error);
        }
    };

    const handleChangeList = (item: AnyObject) => {
        filterParams.categoryId = item.categoryId;
        setActiveCategoryId(item.categoryId);
        resetState();
        void getList();
    };

    const handleSearch = () => {
        resetState();
        void getList();
    };

    const handleSearchClear = () => {
        setKeyword("");
        filterParams.keyword = "";
        resetState();
        void getList();
    };

    const handleKeywordChange = (value: string) => {
        setKeyword(value);
        filterParams.keyword = value;
    };

    const handleLink = (url: string) => {
        Taro.navigateTo({
            url
        });
    };

    const swiperImagePreview = (index: number, arr: any) => {
        const images = (arr || []).map((item: any) => imageFormat(item.picUrl || ""));
        Taro.previewImage({
            current: images[index],
            urls: images
        });
    };

    const handleSave = (src: string) => {
        // #ifndef H5
        if (process.env.TARO_ENV === "h5") return;
        const srcFormat = imageFormat(src);
        Taro.showModal({
            title: t("提示"),
            content: t("确定要保存图片吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: async (res) => {
                if (!res.confirm) return;
                const result = await getDownloadFileInfo(srcFormat);
                if (result.statusCode === 200) {
                    saveImageToAlbum(result.tempFilePath)
                        .then(() => {
                            Taro.showToast({
                                title: t("保存成功"),
                                icon: "none"
                            });
                        })
                        .catch((err) => {
                            Taro.showToast({
                                title: t("保存失败"),
                                icon: "none"
                            });
                            console.error(err);
                        });
                }
            }
        });
        // #endif
    };

    const getLink = async (data: any) => {
        const userInfo = Taro.getStorageSync("userInfo") || {};
        const link = data.productId
            ? `${h5Domain}/pages/product/index?id=${data.productId}&salesmanId=${userInfo?.salesman?.salesmanId}`
            : h5Domain;
        const path = await createQrcodePath(link);
        if (path) {
            setQrcodePath(path);
            setShowChoosePoster(true);
        }
    };

    const handleBtn = (type: string, data: any) => {
        void getMaterialDetail(data.id);
        switch (type) {
            case "poster":
                setCurrentData(data);
                void getLink(data);
                break;
            case "friend":
                copy(data.content, () => {
                    setShowSaveCard(true);
                    setCurrentPics(data.pics);
                });
                break;
        }
    };

    // 旧 onLoad(async () => { await getMaterialCategoryList(); getList(); })
    useEffect(() => {
        const init = async () => {
            await getMaterialCategoryList();
            void getList();
        };
        void init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 关闭预览图片（旧 #ifdef H5 || APP；App 端待定，本批仅还原 H5）
    useEffect(() => {
        return () => {
            if (process.env.TARO_ENV === "h5") {
                (Taro as any).closePreviewImage?.();
            }
        };
    }, []);

    return (
        <TigLayout>
            <View className="sticky">
                <View className="material-menu">
                    <View className="search-box" style={{ height: `${height}px` }}>
                        <View className="status-bar" style={{ height: `${statusBarHeight}px` }} />
                        <View className="search-input-box search-input-box--with-back" style={{ height: `${contentHeight}px`, width: contentWidth }}>
                            <View
                                className="search-back"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigateBack();
                                }}
                            >
                                <View className="iconfont icon-houtui" />
                            </View>
                            <View className="input">
                                <SearchInput
                                    value={keyword}
                                    placeholder={t("请输入关键字")}
                                    onChange={handleKeywordChange}
                                    onConfirm={handleSearch}
                                    onClear={handleSearchClear}
                                    customStyle={{ width: "100%", backgroundColor: "#f7f8fa", borderRadius: "36rpx", padding: "10rpx 15rpx" }}
                                />
                            </View>
                        </View>
                    </View>
                    <View className="material-content">
                        <ScrollView className="material-tabs" scrollX={categoryList.length > 5}>
                            <View className="material-tabs-inner">
                                {categoryList.map((item, index) => (
                                    <View
                                        key={index}
                                        className={`material-tab${activeCategoryId === item.categoryId ? " active" : ""}`}
                                        onClick={() => handleChangeList(item)}
                                    >
                                        <Text>{item.categoryName}</Text>
                                        <View className="material-tab__line" />
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </View>
            <View className="material-content">
                <View className="material-list">
                    {list.map((item) => (
                        <View key={item.id} className="material-item">
                            <View className="material-item-content">
                                <View className="material-item-left">
                                    <View className="item-logo">
                                        <Text
                                            className="item-logo-bg"
                                            style={{ backgroundImage: `url(${imageFormat(icoImg)})` }}
                                        />
                                    </View>
                                </View>
                                <View className="material-item-right">
                                    <View className="item-name">{t("分销小助手")}</View>
                                    <View className="item-content">{item.content ? <RichText nodes={item.content} /> : null}</View>
                                    {item.pics ? (
                                        <View className="item-images">
                                            {item.pics.map((img: any, index: number) => (
                                                <View key={img.picId} className="image-box" onClick={() => swiperImagePreview(index, item.pics)}>
                                                    <View
                                                        className="image-longpress"
                                                        onLongPress={(e: any) => {
                                                            e.stopPropagation();
                                                            handleSave(img.picUrl);
                                                        }}
                                                    >
                                                        <TigImage src={img.picUrl} mode="widthFix" />
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    ) : null}
                                    <View className="item-tip">{t("长按图片保存到相册")}</View>
                                    {item.product ? (
                                        <View className="item-product">
                                            <View className="item-product-text">{t("商品：")}</View>
                                            <View
                                                className="item-product-img"
                                                onClick={() => handleLink(`/pages/product/index?id=${item.productId}`)}
                                            >
                                                <TigImage src={pickPic(item.product)} />
                                            </View>
                                        </View>
                                    ) : null}
                                    <View className="item-btn">
                                        <View className="item-sharenum" />
                                        <MaterialPopover
                                            content={
                                                <View className="popover-btns">
                                                    <View className="popover-btns-item" onClick={() => handleBtn("friend", item)}>
                                                        <Text
                                                            className="popover-btns-item-icon icon-1"
                                                            style={{
                                                                backgroundImage: `url(${staticResource("salesman/materialFriends.png")})`
                                                            }}
                                                        />
                                                        {t("发朋友圈")}
                                                    </View>
                                                    <View className="common-line" />
                                                    <View className="popover-btns-item" onClick={() => handleBtn("poster", item)}>
                                                        <Text
                                                            className="popover-btns-item-icon icon-2"
                                                            style={{ backgroundImage: `url(${staticResource("salesman/materialPic.png")})` }}
                                                        />
                                                        {t("生成海报")}
                                                    </View>
                                                </View>
                                            }
                                        >
                                            <View className="item-btn-content">
                                                <Text className="round" />
                                                <Text className="round" />
                                            </View>
                                        </MaterialPopover>
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            </View>
            {!isLoading && total === 0 ? <Empty styles={{ width: "320rpx", height: "320rpx" }} /> : null}
            <MaterialSaveCard modelValue={showSaveCard} currentPics={currentPics} onChange={setShowSaveCard} />
            {showChoosePoster ? (
                <MaterialChoosePoster
                    modelValue={showChoosePoster}
                    currentData={currentData}
                    qrcodePath={qrcodePath}
                    onChange={setShowChoosePoster}
                />
            ) : null}
        </TigLayout>
    );
}