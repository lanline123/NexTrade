import { useState } from "react";
import Taro from "@tarojs/taro";

/** storage 同步 hook（自旧 hooks/useStorageData.ts 移植） */
export default function useStorageData<T = any>(key: string) {
    const [data, setData] = useState<T | null>(() => (Taro.getStorageSync(key) || null) as T | null);

    function setStorageData(value: any) {
        setData(value);
        Taro.setStorageSync(key, value);
    }

    return {
        data,
        setStorageData
    };
}
