import emojiElements from "./emojiElements";
import { escapeHtml } from "@/utils/escapeHtml";

const EMOJI_BASE_URL = "https://oss.tigshop.com/official/emoji/";

const emojiIdByName = new Map<string, string>(emojiElements.map((e) => [e.name, e.id]));

/** 普通文本：先做 HTML 转义，再把换行转成 <br/>（rich-text 不一定正确渲染 \n） */
function escapeTextWithBr(text: string): string {
    return escapeHtml(text).replace(/\r\n|\r|\n/g, "<br/>");
}

/**
 * 把消息文本渲染为 rich-text 可用的 HTML 字符串：
 * - 普通文本全部做 HTML 转义（防 XSS），并保留换行
 * - 仅把形如 [微笑] 的已知表情替换为 <img class="emoji" ... />
 * - 未知的 [xxx] 当作普通文本展示（保留括号，转义）
 */
export function renderTextWithEmojiHtml(input: unknown): string {
    const text = String(input ?? "");
    if (!text) return "";

    const reg = /\[([^[\]]+)\]/g;
    let out = "";
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = reg.exec(text)) !== null) {
        const full = match[0]; // [微笑]
        const name = match[1]; // 微笑

        // 匹配前的普通文本（必须转义）
        out += escapeTextWithBr(text.slice(lastIndex, match.index));

        const id = emojiIdByName.get(name);
        if (id) {
            out += `<img class="emoji" src="${EMOJI_BASE_URL}${id}.png" />`;
        } else {
            // 不是已知表情：当作普通文本展示（保留括号），必须转义
            out += escapeTextWithBr(full);
        }

        lastIndex = match.index + full.length;
    }

    // 末尾剩余普通文本
    out += escapeTextWithBr(text.slice(lastIndex));
    return out;
}