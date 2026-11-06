// TODO(B2-1b)：随抽屉/筛选批次移植（对应旧 pages/search/components/search-result/header-overseas.vue）
// 渲染 null 保持 props 形状，保证本批可编译。

interface Props {
    keyword: string;
    scrollLeft: number;
    // 店铺内搜索时透传给以图搜图
    shopId?: number | string;
    onToSearch?: () => void;
}

export default function HeaderOverseas(_props: Props) {
    return null;
}
