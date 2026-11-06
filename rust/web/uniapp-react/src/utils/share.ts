/**
 * 分享工具（自旧 utils/share.ts 30 行移植）
 *
 * 旧实现两个分支：APP-PLUS 走 `plus.share.sendWithSystem`；H5 走 Web Share API + Facebook 兜底。
 * Phase 1 不做 App 端，plus 分支未平移；App 壳形态确定后在此补回（或改接 RN Share 模块）。
 */

interface ShareToFacebookOptions {
    url: string;
    text?: string;
    title?: string;
}

export const shareToFacebook = ({ url, text = "", title = "" }: ShareToFacebookOptions): void => {
    if (process.env.TARO_ENV !== "h5") {
        // 小程序端无对应分享面板：由页面的 useShareAppMessage / button open-type="share" 承担
        return;
    }

    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    if (navigator.share) {
        navigator.share({ title, text: text || url, url }).catch((error: unknown) => {
            if (error instanceof DOMException && error.name === "AbortError") return;
            window.location.href = facebookUrl;
        });
    } else {
        window.open(facebookUrl);
    }
};
