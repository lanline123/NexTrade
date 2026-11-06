import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { PickerView, PickerViewColumn, View } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";

import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import { t } from "@/utils/i18n";

import "./pickerDatePop.scss";

interface Props {
    /** 对应旧 v-model:modelValue */
    modelValue?: boolean;
    /** 旧 columns：年/月/日三列 */
    columns?: (string | number)[][];
    /** 旧 default-index */
    defaultIndex?: number[];
    /** 对应旧 update:modelValue */
    onChange?: (value: boolean) => void;
    /** 对应旧 @change：{ values, indexs } */
    onValueChange?: (payload: { values: (string | number)[]; indexs: number[] }) => void;
    /** 对应旧 @confirm */
    onConfirm?: () => void;
    children?: ReactNode;
}

/**
 * 日期选择弹窗组件（自旧 pages/salesman/src/pickerDatePop.vue 逐行移植）
 * - 选择开始和结束日期
 * - 弹窗形式展示日历
 * - 旧 tig-popup → NutUI Popup，picker-view → Taro PickerView
 */
export default function PickerDatePop({
    modelValue = false,
    columns = [],
    defaultIndex = [0, 0, 0],
    onChange,
    onValueChange,
    onConfirm,
    children
}: Props) {
    const [innerIndex, setInnerIndex] = useState<number[]>([0, 0, 0]);

    // 旧 watch(() => props.defaultIndex, ..., { immediate: true })
    useEffect(() => {
        if (defaultIndex.length > 0) {
            setInnerIndex(JSON.parse(JSON.stringify(defaultIndex)));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(defaultIndex)]);

    const changeHandler = (e: any) => {
        const indexs: number[] = e.detail.value;
        onValueChange?.({
            values: columns.map((item, index) => item[indexs[index]]),
            indexs
        });
    };

    return (
        <Popup
            visible={modelValue}
            position="bottom"
            zIndex={999}
            closeable={false}
            style={{ backgroundColor: "#fff" }}
            onClose={() => onChange?.(false)}
        >
            <View className="picker-box">
                {children}
                <PickerView indicatorStyle="height: 50px;" value={innerIndex} className="picker-view" onChange={changeHandler}>
                    {columns.map((col, colIndex) => (
                        <PickerViewColumn key={colIndex}>
                            {col.map((item, index) => (
                                <View key={index} className="item">
                                    {item}
                                </View>
                            ))}
                        </PickerViewColumn>
                    ))}
                </PickerView>
                <FixedPlaceholder backgroundColor="#fff">
                    <View className="btn-box">
                        <TigButton2 className="btn" style={{ backgroundColor: "#ff720d", borderColor: "#ff720d", color: "#fff" }} onClick={() => onConfirm?.()}>
                            {t("确定")}
                        </TigButton2>
                    </View>
                </FixedPlaceholder>
            </View>
        </Popup>
    );
}