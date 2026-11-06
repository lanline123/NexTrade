import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import Taro from "@tarojs/taro";

import { commonLog } from "@/api/common";

interface Props {
    productId?: number | string;
    shopId?: number | string;
    shopCategoryId?: number | string;
    immediateLog?: boolean;
}

interface IFilterParams {
    productId?: string | number;
    shopId?: string | number;
    shopCategoryId?: string | number;
    isNew?: number;
    click?: number;
}

export interface TigStatisticLogRef {
    __commonLog: () => Promise<void>;
}

const diffDate = (date1: string, date2: string): boolean => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diff = Math.abs(d1.getTime() - d2.getTime());
    const oneDay = 24 * 60 * 60 * 1000;
    return diff >= oneDay;
};

/**
 * 通用统计埋点（自旧 tig-statistic-log.vue 移植）。
 * 页面通过 ref 调用 __commonLog() 触发额外埋点（对应旧 layoutRef.handleLog()）。
 */
const TigStatisticLog = forwardRef<TigStatisticLogRef, Props>(function TigStatisticLog(
    { productId, shopId, shopCategoryId, immediateLog = true },
    ref
) {
    const filterParams = useRef<IFilterParams>({});

    const __commonLog = async () => {
        if (productId) filterParams.current.productId = productId;
        if (shopId) filterParams.current.shopId = shopId;
        if (shopCategoryId) filterParams.current.shopCategoryId = shopCategoryId;
        try {
            await commonLog(filterParams.current);
        } catch (error) {
            console.error(error);
        }
    };

    const updateVisitor = () => {
        const currentDate = (() => {
            const date = new Date();
            return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        })();
        const lastDate = Taro.getStorageSync("lastDate");
        if (!lastDate || diffDate(currentDate, lastDate)) {
            filterParams.current.isNew = 1;
            Taro.setStorageSync("untranslatedCache", JSON.stringify([]));
        } else {
            filterParams.current.click = 1;
        }
        Taro.setStorageSync("lastDate", currentDate);
    };

    useImperativeHandle(ref, () => ({
        __commonLog
    }));

    useEffect(() => {
        updateVisitor();
        if (immediateLog) {
            void __commonLog();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
});

export default TigStatisticLog;
