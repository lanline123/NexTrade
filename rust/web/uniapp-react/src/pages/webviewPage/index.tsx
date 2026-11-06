import { WebView } from "@tarojs/components";
import { useRouter } from "@tarojs/taro";

import { usePageGuards } from "@/utils/pageMixin";

/** 外链落地页：小程序用 web-view，H5 端 Taro 会渲染 iframe */
export default function WebviewPage() {
    usePageGuards();
    const router = useRouter();
    const url = decodeURIComponent(router.params.url || "");

    if (!url) {
        return null;
    }
    return <WebView src={url} />;
}
