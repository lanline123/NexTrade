import { useMemo } from "react";
import { View } from "@tarojs/components";

import { designPxToRpx } from "@/components/modules";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function WhiteBlank({ module }: Props) {
    const styleFormat = useMemo(() => {
        return {
            backgroundColor: `background-color: ${module.backgroundColor};`,
            height: `height: ${designPxToRpx(module.blankHeight)};`
        };
    }, [module]);

    return (
        <View className="module-ad-con module-image_hotarea">
            <View className="module-ad-content">
                <View style={styleFormat.backgroundColor + styleFormat.height} />
            </View>
        </View>
    );
}
