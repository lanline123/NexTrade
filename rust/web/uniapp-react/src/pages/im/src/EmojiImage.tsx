import { useMemo } from "react";

import TigImage from "@/components/tig/tig-image/TigImage";
import emojiElements from "./emojiElements";

import "./EmojiImage.scss";

interface Props {
    name?: string;
    id?: string | number;
    /** 透传到根节点（对齐旧 Vue class 透传语义） */
    className?: string;
}

/**
 * 表情图片组件（自旧 pages/im/src/emojiImage.vue 移植）
 * - 根据表情名称显示对应图片
 */
export default function EmojiImage({ name = "", id = "", className = "" }: Props) {
    const imgSrcId = useMemo(() => {
        // 使用函数
        if (id) {
            return String(id);
        }
        return emojiElements.find((element) => element.name === name)?.id;
    }, [id, name]);

    const imgSrc = imgSrcId !== undefined ? "https://oss.tigshop.com/official/emoji/" + imgSrcId + ".png" : "";

    if (!imgSrc) return null;
    return <TigImage src={imgSrc} className={["emoji-image", className].filter(Boolean).join(" ")} />;
}