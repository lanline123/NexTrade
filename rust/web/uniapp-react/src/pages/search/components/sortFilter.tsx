// TODO(B2-1b)：随抽屉/筛选批次移植（对应旧 pages/search/components/sortFilter.vue）
// 渲染 null 保持 props 形状，保证本批可编译。

export interface SortRadioOption {
    label: string;
    value: string;
    sort: string;
}

interface Props {
    onSortChange?: (val: SortRadioOption) => void;
}

export default function SortFilter(_props: Props) {
    return null;
}
