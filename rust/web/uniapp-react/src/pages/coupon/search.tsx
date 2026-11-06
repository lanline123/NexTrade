import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { SearchBar } from "@nutui/nutui-react-taro";

import { t } from "@/utils/i18n";

import "./search.scss";
import { usePageGuards } from "@/utils/pageMixin";

/**
 * 优惠券搜索页（自旧 pages/coupon/search.vue 移植）
 * - 搜索优惠券（结果通过 eventCenter 回传给详情页）
 * - 显示/清理搜索历史
 */
export default function CouponSearch() {
    usePageGuards();
    const [keyword, setKeyword] = useState("");
    const [searchHistory, setSearchHistory] = useState<any[]>([]);

    // 对应旧 onLoad
    useEffect(() => {
        const history = Taro.getStorageSync("couponSearchHistory");
        if (history) {
            setSearchHistory(history);
        }
    }, []);

    const handleCustom = () => {
        if (keyword) {
            const nextHistory = [keyword, ...searchHistory];
            let deduped = Array.from(new Set(nextHistory));
            if (deduped.length > 10) {
                deduped = deduped.slice(0, 10);
            }
            setSearchHistory(deduped);
            Taro.setStorageSync("couponSearchHistory", deduped);
            Taro.navigateBack({
                success: () => {
                    Taro.eventCenter.trigger("coupon-search-return", keyword);
                }
            });
        } else {
            Taro.navigateBack({
                success: () => {
                    Taro.eventCenter.trigger("coupon-search-return", "");
                }
            });
        }
    };

    const clearHistory = () => {
        setSearchHistory([]);
        Taro.removeStorageSync("couponSearchHistory");
    };

    const searchKeywords = (item: any) => {
        Taro.navigateBack({
            success: () => {
                Taro.eventCenter.trigger("coupon-search-return", item);
            }
        });
    };

    return (
        <View className="coupon-search">
            <SearchBar
                value={keyword}
                shape="square"
                onChange={(value) => setKeyword(value)}
                onSearch={handleCustom}
                right={
                    <View className="coupon-search-action" onClick={handleCustom}>
                        {t("取消")}
                    </View>
                }
            />
            {searchHistory.length > 0 && (
                <View className="search_init_box">
                    <View className="search_history_box">
                        <View className="title">
                            {t("搜索历史")}
                            <View className="clear_history" onClick={clearHistory}>
                                <Text className="iconfont-h5 icon-shanchu" />
                            </View>
                        </View>
                        <View className="list acea-row">
                            {searchHistory.map((item, index) => (
                                <View className="item" key={`${item}-${index}`} onClick={() => searchKeywords(item)}>
                                    {item}
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}