/**
 * HTML 转义（用于防止把用户输入当作 HTML 解析导致的 XSS）
 */
export function escapeHtml(input: unknown): string {
    const str = String(input ?? "");
    if (!str) return "";
    // 注意：顺序很重要，必须先转义 &
    return str.replace(/[&<>"'`]/g, (ch) => {
        switch (ch) {
            case "&":
                return "&amp;";
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case '"':
                return "&quot;";
            case "'":
                return "&#39;";
            case "`":
                return "&#96;";
            default:
                return ch;
        }
    });
}