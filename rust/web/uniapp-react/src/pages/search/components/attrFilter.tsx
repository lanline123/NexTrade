import type { attrsListData } from "@/types/search/search";

// TODO(B2-1b)：随抽屉/筛选批次移植（对应旧 pages/search/components/attrFilter.vue）
// 渲染 null 保持 props 形状，保证本批可编译。

interface Props {
    attrItem?: attrsListData;
    /** 当前属性已选中的值 */
    selectedValues?: string[];
    total?: number;
    isLoading?: boolean;
    onChange?: (value: string) => void;
    onAttrReset?: () => void;
    onClose?: () => void;
}

export default function AttrFilter(_props: Props) {
    return null;
}
