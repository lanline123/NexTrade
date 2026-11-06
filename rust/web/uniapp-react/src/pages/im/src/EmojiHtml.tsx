import { useMemo } from "react";
import { RichText } from "@tarojs/components";

import { renderTextWithEmojiHtml } from "./renderTextWithEmoji";

import "./EmojiHtml.scss";

interface Props {
    content?: string;
    /** 透传到根节点（对齐旧 Vue class 透传语义） */
    className?: string;
}

/**
 * 表情 HTML 渲染组件（自旧 pages/im/src/emojiHtml.vue 移植）
 * - 将表情代码 [xxx] 转换为表情图片，普通文本做 HTML 转义并保留换行
 */
export default function EmojiHtml({ content = "", className = "" }: Props) {
    const html = useMemo(() => renderTextWithEmojiHtml(content), [content]);

    return <RichText nodes={html} className={["emoji-html", className].filter(Boolean).join(" ")} />;
}