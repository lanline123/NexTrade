import { useMemo } from "react";
import { View } from "@tarojs/components";

import { formatFrame } from "@/components/modules";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function WhiteLine({ module }: Props) {
    const { frame } = module;

    const frameFormat = useMemo(() => {
        return formatFrame(frame ?? {});
    }, [frame]);

    return (
        <View
            className={`module-ad-con  module-white_line ad-style__${module.lineType} ad-line_style__${module.lineStyle}`}
        >
            <View className="white-line-warp" style={frameFormat.boxPadding + frameFormat.boxPaddingTop + frameFormat.boxPaddingBottom}>
                <View className="white-line-con" style={frameFormat.backgroundColor + " " + frameFormat.boxRadius}>
                    <View className="white-line-item">
                        <View className="item-content">
                            <View className="item-line" />
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}
