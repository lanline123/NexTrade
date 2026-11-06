import { useEffect, useMemo, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useUnload } from "@tarojs/taro";
import { Swipe } from "@nutui/nutui-react-taro";

import EmptyBox from "@/components/empty-box/EmptyBox";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { delAccount, getAccountNoList } from "@/api/user/account";
import type { AccountInfo, AccountNoFilterParams } from "@/types/user/account";
import { useI18nStore } from "@/store/i18n";
import { maskNumber } from "@/utils";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./list.scss";

/**
 * 卡管理（自旧 pages/user/account/cardManagement/list.vue 移植）
 * - 银行卡 / 支付宝 / 微信三种账户切换
 * - 左滑编辑/删除，右上角添加账号
 */
export default function AccountList() {
    usePageGuards();

    const langCode = useI18nStore((s) => s.langCode);

    const tabs = useMemo(
        () => [
            { title: t("银行卡"), accountType: 1 },
            { title: t("支付宝"), accountType: 2 },
            { title: t("微信"), accountType: 3 }
        ],
        [langCode]
    );

    const [activeTab, setActiveTab] = useState(1);
    const [loaded, setLoaded] = useState(false);
    const [loadend, setLoadend] = useState(false);
    // 旧 reactive filterParams：原地维护查询参数
    const [filterParams, setFilterParams] = useState<AccountNoFilterParams>({
        // 初使化用于查询的参数
        page: 1,
        accountType: 1
    });
    const [filterState, setFilterState] = useState<AccountInfo[]>([]);

    // 供事件回调读取最新参数（等价旧响应式对象）
    const filterParamsRef = { current: filterParams };
    filterParamsRef.current = filterParams;

    const __getAccountNoList = async () => {
        if (filterParamsRef.current.page > 1) {
            setLoaded(true);
        } else {
            setLoadend(false);
            Taro.showLoading({
                title: t("加载中")
            });
        }
        try {
            const result = await getAccountNoList({ ...filterParamsRef.current });
            setFilterState((result as any)?.records || []);
        } catch (error: any) {
            console.error(error.message);
        } finally {
            Taro.hideLoading();
            setLoaded(false);
            setLoadend(true);
        }
    };

    const actionClick = async (value: number) => {
        if (value === activeTab) return;
        setActiveTab(value);
        setFilterParams((prev) => ({ ...prev, page: 1, accountType: value }));
        // setState 异步，直接以新参数请求，避免读到旧值
        await __getAccountNoListWithParams({ page: 1, accountType: value });
    };

    /** 用显式参数取数（切换 tab 时避免 setState 未生效） */
    const __getAccountNoListWithParams = async (params: AccountNoFilterParams) => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            const result = await getAccountNoList({ ...params });
            setFilterState((result as any)?.records || []);
        } catch (error: any) {
            console.error(error.message);
        } finally {
            Taro.hideLoading();
            setLoaded(false);
            setLoadend(true);
        }
    };

    const __editAccountNo = (id: number) => {
        console.log(id);
        Taro.navigateTo({
            url: `/pages/user/account/edit?id=${id}`
        });
    };

    const __addAccountNo = () => {
        Taro.navigateTo({
            url: `/pages/user/account/edit?accountType=${activeTab}`
        });
    };

    const __delAccount = (data: AccountInfo, index: number) => {
        Taro.showModal({
            title: t("提示"),
            content: t("确定删除这个账户吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: async (res) => {
                if (res.confirm) {
                    await deleteAcNo(data, index);
                }
            }
        });
    };

    const deleteAcNo = async (data: AccountInfo, index: number) => {
        try {
            const result = await delAccount({ ...data });
            void result;
            setFilterState((prev) => prev.filter((_, idx) => idx !== index));
            Taro.showToast({
                title: t("操作成功"),
                icon: "success"
            });
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1000
            });
        }
    };

    // 旧 onLoad：接收 accountType，并监听编辑页返回刷新事件
    useEffect(() => {
        const pages = Taro.getCurrentPages();
        const current: any = pages[pages.length - 1];
        const option = (current?.options || {}) as any;
        if (option?.accountType) {
            const type = Number(option.accountType);
            setActiveTab(type);
            setFilterParams((prev) => ({ ...prev, accountType: type }));
            void __getAccountNoListWithParams({ page: 1, accountType: type });
        } else {
            void __getAccountNoList();
        }

        const refreshHandler = (data: any) => {
            const type = data?.type;
            setActiveTab(type);
            setFilterParams((prev) => ({ ...prev, accountType: type }));
            void __getAccountNoListWithParams({ page: 1, accountType: type });
        };
        Taro.eventCenter.on("refreshData", refreshHandler);
        return () => {
            Taro.eventCenter.off("refreshData", refreshHandler);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧 onUnload：移除事件监听（useEffect cleanup 已覆盖，保留双保险）
    useUnload(() => {
        Taro.eventCenter.off("refreshData");
    });

    return (
        <TigLayout title={t("卡管理")}>
            <View className="card-main" data-list-rev="eXIyMjgyaGQ">
                <View className="head-tabs-box">
                    <View className="tabs">
                        <View className="tabs-left">
                            {tabs.map((tab, index) => (
                                <View key={index} className={`tab${activeTab === tab.accountType ? " active" : ""}`} onClick={() => actionClick(tab.accountType)}>
                                    {t(tab.title)}
                                </View>
                            ))}
                        </View>
                        <View className="clear-unread" onClick={__addAccountNo}>
                            <Text>{t("添加账号")}</Text>
                            <Text className="iconfont-h5 icon-auth" style="font-size: 36rpx; color: #999" />
                        </View>
                    </View>
                </View>

                {filterState.length > 0 ? (
                    <View className="card-list">
                        {filterState.map((item, index) => (
                            <View className="move-item" key={`${item.accountId}-${index}`}>
                                <Swipe
                                    name={item.accountId}
                                    rightAction={
                                        <View className="card-move-box">
                                            <View className="btn-edit" onClick={() => __editAccountNo(item.accountId)}>
                                                <Text>{t("编辑")}</Text>
                                            </View>
                                            <View className="btn-del" onClick={() => __delAccount(item, index)}>
                                                <Text>{t("删除")}</Text>
                                            </View>
                                        </View>
                                    }
                                >
                                    <View className="mitem">
                                        <View className="card">
                                            <View className="txt-item">
                                                <View className="tit">{t("真实姓名")}</View>
                                                <View className="txt">{item.accountName}</View>
                                            </View>
                                            <View className="txt-item">
                                                <View className="tit">{t("身份证号码")}</View>
                                                <View className="txt">{maskNumber(item.identity)}</View>
                                            </View>
                                            <View className="txt-item">
                                                <View className="tit">{t("账户号码")}</View>
                                                <View className="txt">{maskNumber(item.accountNo)}</View>
                                            </View>
                                            {filterParams.accountType === 1 ? (
                                                <View className="txt-item">
                                                    <View className="tit">{t("银行卡详情")}</View>
                                                    <View className="txt">{item.bankName}</View>
                                                </View>
                                            ) : null}
                                        </View>
                                    </View>
                                </Swipe>
                            </View>
                        ))}
                    </View>
                ) : null}

                {filterState.length === 0 && loadend ? (
                    <View className="card-empty">
                        <EmptyBox height="100%" background="transparent" mode="list" icon="common/data_empty.png" text={t("暂无数据")} />
                    </View>
                ) : null}
            </View>
        </TigLayout>
    );
}