import { forwardRef, useEffect, useState } from "react";
import { View, Text } from "@tarojs/components";

import { Picker } from "@nutui/nutui-react-taro";

import { getmobileAreaCode } from "@/api/common";
import type { MobileAreaCodeList } from "@/types/common";
import { t } from "@/utils/i18n";

import "./TigMobileAreacode.scss";

interface Props {
    labelStyle?: Record<string, string | number>;
    nameStyle?: Record<string, string | number>;
    boxStyle?: Record<string, string | number>;
    iconStyle?: Record<string, string | number>;
    placeholder?: string;
    value?: string;
    onChange?: (code: string) => void;
}

/**
 * 手机区号选择（自旧 components/tig/tig-mobile-areacode/tig-mobile-areacode.vue 移植）
 * - 拉取区号列表、默认 86 / isDefault / 第一项兜底
 * - 原 uview up-picker → NutUI Picker
 */
const TigMobileAreacode = forwardRef<any, Props>(function TigMobileAreacode(
    { labelStyle = {}, nameStyle = {}, boxStyle = {}, iconStyle = {}, placeholder = "", value, onChange },
    ref
) {
    const DEFAULT_MOBILE_AREA_CODE = "86";

    const [show, setShow] = useState(false);
    const [list, setList] = useState<MobileAreaCodeList[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [currentData, setCurrentData] = useState<MobileAreaCodeList>({} as MobileAreaCodeList);

    const syncCurrentData = (valueArg?: string, currentList?: MobileAreaCodeList[]) => {
        const data = currentList ?? list;
        if (data.length === 0) return;
        const targetCode = valueArg ?? value;
        const matchedItem = data.find((item) => String(item.code) === String(targetCode));
        const defaultItem = data.find((item) => String(item.code) === DEFAULT_MOBILE_AREA_CODE) || data.find((item) => item.isDefault === 1) || data[0];
        const selectedItem = matchedItem || defaultItem;
        setCurrentData(selectedItem || ({} as MobileAreaCodeList));
        if (!matchedItem && selectedItem && String(value) !== String(selectedItem.code)) {
            onChange?.(selectedItem.code);
        }
    };

    const getmobileAreaCodeList = async () => {
        setLoading(true);
        try {
            const result = await getmobileAreaCode();
            result.map((item: any) => {
                item.labelName = `${item.label} (${item.name})`;
            });
            setList(result);
            syncCurrentData(undefined, result);
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void getmobileAreaCodeList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        syncCurrentData(value);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const handleClick = () => {
        setShow(true);
    };

    const handleConfirm = (selectedOptions: any[], selectedValue: (string | number | null)[]) => {
        setCurrentData(selectedOptions[0] as MobileAreaCodeList);
        onChange?.(String(selectedValue[0]));
        setShow(false);
    };

    return (
        <View className="areacode-box" style={boxStyle as any} onClick={handleClick}>
            <View className="areacode-box-text">
                <View className="text-label" style={labelStyle as any}>
                    {" "}
                    {currentData?.label}{" "}
                </View>
                {/* <view class="text-name" :style="nameStyle"> {{ currentData.name ? `(${$t(currentData.name)})` : "" }}</view> */}
                {/* nameStyle 原 vue 传入但该行注释未启用；保留透传通道（见 props.nameStyle） */}
            </View>
            <Text className="iconfont-h5 icon-arrowdown" style={iconStyle as any} />

            {/* 原 uview up-picker :columns="[list]" key-name="labelName" → NutUI Picker options；取消/确认按钮文案走 NutUI locale */}
            <Picker
                visible={show}
                title={placeholder}
                defaultValue={[value ?? DEFAULT_MOBILE_AREA_CODE]}
                options={[list.map((item) => ({ label: item.labelName || String(item.label), value: String(item.code) }))]}
                onConfirm={handleConfirm}
                onCancel={() => setShow(false)}
                onClose={() => setShow(false)}
            />
        </View>
    );
});

export default TigMobileAreacode;
