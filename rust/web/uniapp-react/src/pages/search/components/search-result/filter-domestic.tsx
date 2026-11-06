// TODO(B2-1b)：随抽屉/筛选批次移植（对应旧 pages/search/components/search-result/filter-domestic.vue）
// 渲染 null 保持 props 形状，保证本批可编译。

export interface SortTabItem {
    label: string;
    value: string;
    order?: string;
}

interface Props {
    tabList: SortTabItem[];
    tabIndex: string;
    onChangeTab?: (item: SortTabItem) => void;
    onShowDrawer?: () => void;
}

export default function FilterDomestic(_props: Props) {
    return null;
}
