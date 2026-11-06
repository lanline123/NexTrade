import { useMemo } from "react";
import { View } from "@tarojs/components";

import { useConfigStore } from "@/store/config";
import { isUrl } from "@/utils";
import { baseUrl } from "@/utils/requestBaseUrl";

import "./TigCopyright.scss";

/**
 * 版权/技术支持图片（自旧 components/tig/tig-copyright/tig-copyright.vue 移植）
 * - poweredBy == 0 时展示 poweredByLogo，否则展示 defaultTechSupport
 */
export default function TigCopyright() {
    const defaultTechSupport = useConfigStore((s) => s.defaultTechSupport);
    const poweredBy = useConfigStore((s) => s.poweredBy);
    const poweredByLogo = useConfigStore((s) => s.poweredByLogo);

    const imgUrl = useMemo(() => {
        const urlFormat = (url: string) => {
            if (!url) {
                return "";
            }
            if (isUrl(url)) {
                return url;
            }
            const origin = process.env.TARO_ENV === "h5" ? window.location.origin : "";
            return `${baseUrl ? baseUrl : origin}${url}`;
        };

        let url = urlFormat(defaultTechSupport);
        if (poweredBy == 0) {
            url = poweredByLogo;
        }

        return url;
    }, [defaultTechSupport, poweredBy, poweredByLogo]);

    if (!imgUrl) return null;

    return (
        <View className="copyright">
            <View className="copyright-bg" style={{ backgroundImage: `url(${imgUrl})` }} />
        </View>
    );
}