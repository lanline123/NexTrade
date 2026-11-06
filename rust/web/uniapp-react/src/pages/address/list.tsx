import { useEffect, useMemo, useRef, useState } from "react";
import Taro from "@tarojs/taro";
import { Text, View } from "@tarojs/components";

import EmptyBox from "@/components/empty-box/EmptyBox";
import LoadingBox from "@/components/loading-box";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigLoadingPage from "@/components/tig/tig-loadingpage/index";
import Checkbox from "@/pages/cart/src/Checkbox";
import { delAddress, getAddressList, selectedAddress, updateAddressData } from "@/api/user/address";
import type { AddressFilterResult } from "@/types/user/address";
import useList from "@/hooks/useList";
import { useThemeStore } from "@/store/theme";
import { copy, isOverseas, mobileConceal, prevRoute } from "@/utils";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./list.scss";

/**
 * 收货地址列表页（自旧 pages/address/list.vue 移植）
 * - 展示用户所有收货地址
 * - 勾选「默认地址」写入 isDefault；点击卡片设置当前选中地址 isSelected
 * - 订单结算时可选择地址返回
 */
export default function AddressList() {
    usePageGuards();

    const themeStyle = useThemeStore((s) => s.themeStyle);
    const hexToRgba = useThemeStore((s) => s.hexToRgba);

    const selectedItemBg = useMemo(() => hexToRgba(themeStyle["--general"], 0.1), [themeStyle, hexToRgba]);

    const isOverseasMode = isOverseas();

    /** 带国际区号的完整手机号，优先使用服务端拼好的值 */
    const getCrossBorderMobile = (item: AddressFilterResult) => item.internationalMobile || `+${item.mobileAreaCode || ""}${item.mobile || ""}`;

    const displayMobile = (item: AddressFilterResult) => {
        if (isOverseasMode) return getCrossBorderMobile(item);
        return mobileConceal(item.mobile);
    };

    const copyMobile = (item: AddressFilterResult) => {
        if (isOverseasMode) return getCrossBorderMobile(item);
        return item.mobile;
    };

    const displayAddress = (item: AddressFilterResult) => {
        if (isOverseasMode) return item.formattedAddress || item.fullAddress || [item.regionName, item.address].filter(Boolean).join(" ");
        return [item.regionName, item.address].filter(Boolean).join(" ");
    };

    // 旧 reactive filterParams：useList 会原地改写分页字段
    const filterParams = useRef({
        page: 1,
        size: 10
    });
    const [isSelectingAddress, setIsSelectingAddress] = useState(false);
    // 旧 up-radio-group v-model="isDefaultId"：选中项的 addressId
    const [isDefaultId, setIsDefaultId] = useState<number | undefined>(undefined);
    const isDefaultIdRef = useRef<number | undefined>(undefined);
    // 旧实现直接改写列表项的 isDefault；React 下用版本号触发一次派生排序/勾选重算
    const [listVersion, setListVersion] = useState(0);

    const {
        getList,
        data: addressList,
        isLoadMore,
        isLoading
    } = useList<AddressFilterResult>(getAddressList as any, {
        params: filterParams.current,
        path: {
            dataKey: "records"
        },
        immediate: true,
        manageData: (data: any) => {
            if (isOverseasMode) data.sort((left: any, right: any) => Number(right.isSelected === 1) - Number(left.isSelected === 1));
            const id = data.find((item: any) => item.isDefault === 1)?.addressId;
            isDefaultIdRef.current = id;
            setIsDefaultId(id);
        }
    });

    const displayAddressList = useMemo(
        () =>
            isSelectingAddress ? addressList : [...addressList].sort((left, right) => Number(right.isDefault === 1) - Number(left.isDefault === 1)),
        // listVersion 参与依赖：默认地址切换后列表项就地改写，需要重算排序
        [isSelectingAddress, addressList, listVersion]
    );

    // 旧 onLoad：结算页进入时打标，并注册地址刷新全局事件
    useEffect(() => {
        const page = prevRoute();
        setIsSelectingAddress(page === "pages/order/check");
        if (page === "pages/order/check") {
            Taro.setStorageSync("link", true);
        } else {
            Taro.removeStorageSync("link");
        }
        const refreshData = () => {
            filterParams.current.page = 1;
            void getList();
        };
        // 旧 uni.$on("refreshData") → Taro.eventCenter.on
        Taro.eventCenter.on("refreshData", refreshData);

        // 旧 onUnload
        return () => {
            Taro.eventCenter.off("refreshData", refreshData);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDel = (id: number) => {
        console.log("handleDel", id);
        Taro.showModal({
            title: t("提示"),
            content: t("确定删除吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: async (res) => {
                if (res.confirm) {
                    void __delAddress(id);
                }
            }
        });
    };

    const __delAddress = async (id: number) => {
        try {
            await delAddress({ id });

            Taro.showToast({
                title: t("删除成功"),
                icon: "none"
            });

            filterParams.current.page = 1;
            void getList();
        } catch (error) {
            console.error(error);
        }
    };

    const handleEdit = (id: number) => {
        void Taro.navigateTo({
            url: "/pages/address/editRegion?id=" + id
        });
    };

    const handleAdd = () => {
        const isFirstAddress = addressList.length === 0;
        void Taro.navigateTo({
            url: isFirstAddress ? "/pages/address/editRegion?isSelected=1" : "/pages/address/editRegion"
        });
    };

    const handleSetDefault = async (addressId: number) => {
        if (!addressId) return;
        const current = addressList.find((item) => item.addressId === addressId);
        if (current?.isDefault === 1) return;

        const prevDefaultId = addressList.find((item) => item.isDefault === 1)?.addressId;
        // 旧 v-model 先写入选中项，再触发 @change
        isDefaultIdRef.current = addressId;
        setIsDefaultId(addressId);
        Taro.showLoading({
            title: t("切换中")
        });
        try {
            await updateAddressData({ id: addressId, addressId, isDefault: 1 });
            addressList.forEach((item) => {
                item.isDefault = item.addressId === addressId ? 1 : 0;
            });
            isDefaultIdRef.current = addressId;
            setListVersion((v) => v + 1);
        } catch (error: any) {
            console.error(error);
            isDefaultIdRef.current = prevDefaultId;
            setIsDefaultId(prevDefaultId);
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        } finally {
            Taro.hideLoading();
        }
    };

    const handleSelectAddress = (id: number) => {
        void __selectedAddress(id);
    };

    const copyTips = () => {
        Taro.showToast({
            title: t("复制成功"),
            icon: "none"
        });
    };

    const __selectedAddress = async (id: number) => {
        Taro.showLoading({
            title: t("切换中")
        });
        const page = prevRoute();
        try {
            await selectedAddress({ id });

            if (page && page === "pages/order/check") {
                Taro.eventCenter.trigger("refreshAddress");
                Taro.navigateBack();
                return;
            }

            filterParams.current.page = 1;
            void getList();
        } catch (error: any) {
            console.error(error);
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        } finally {
            Taro.hideLoading();
        }
    };

    return (
        <TigLayout title={t("收货地址")}>
            <View className="address-list" data-list-rev="YnUyMjgybmQ">
                {/* 旧 up-radio-group placement="column" → 逐个地址项内自绘「默认地址」单选（Checkbox shape=square） */}
                {displayAddressList.map((item) => (
                    <View
                        key={item.addressId}
                        className={`address-item${item.isSelected === 1 ? " is-selected" : ""}`}
                        style={item.isSelected === 1 ? { backgroundColor: selectedItemBg } : undefined}
                    >
                        <View className="address-item-content" onClick={() => handleSelectAddress(item.addressId)}>
                            <View className="address-item-middle">
                                <View className="user-info">
                                    <View className="name">{item.consignee}</View>
                                    {item.addressTag && <View className="address-tag">{item.addressTag}</View>}
                                    <View className="phone">{displayMobile(item)}</View>
                                    {/* 跨境无效地址标记：数据驱动（后端返回 isInvalid 才展示），国内构建整段裁切 */}
                                    {item.isInvalid && <View className="invalid-tag">{t("无效地址")}</View>}
                                </View>
                                <View className="address-desc">
                                    <View className="txt">{displayAddress(item)}</View>
                                    <View
                                        className="copy"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            copy(item.consignee + copyMobile(item) + displayAddress(item), copyTips);
                                        }}
                                    >
                                        {t("复制")}
                                    </View>
                                </View>
                            </View>
                            <View className="operation">
                                <View className="address-check" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox shape="square" checked={item.addressId === isDefaultId} onChange={() => handleSetDefault(item.addressId)} />
                                    <Text className="u-radio__text">{t("默认地址")}</Text>
                                </View>
                                <View className="btn-wrap">
                                    <View
                                        className="icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEdit(item.addressId);
                                        }}
                                    >
                                        <Text className="iconfont-h5 icon-edit" />
                                    </View>
                                    <View
                                        className="icon del"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDel(item.addressId);
                                        }}
                                    >
                                        <Text className="iconfont-h5 icon-delete" />
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                ))}
            </View>

            {!isLoadMore && !isLoading && addressList.length === 0 && (
                <View className="address-empty">
                    <EmptyBox centerContent height="100%" background="transparent" mode="list" text={t("暂无地址！")} />
                </View>
            )}

            <LoadingBox modelValue={isLoadMore} page={filterParams.current.page} length={addressList.length} />

            {/* 旧 tig-fixed-placeholder + tig-button2（style="height: 73rpx"）→ 固定底栏 + 等高占位（等价重写） */}
            {/* TODO(MIGRATION)：tig-button2 尚无 React 版，按主题色实底按钮等价重写 */}
            <View className="btn-fixed-placeholder">
                <View className="btn-box">
                    <View className="btn" style="height: 73rpx" onClick={handleAdd}>
                        <Text className="iconfont-h5 icon-jia" style="margin-right: 10rpx" />
                        {t("添加新地址")}
                    </View>
                </View>
            </View>
            <View className="btn-placeholder" />

            <TigLoadingPage modelValue={isLoading} />
        </TigLayout>
    );
}