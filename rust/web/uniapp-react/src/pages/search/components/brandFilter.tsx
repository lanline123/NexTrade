import type { Brand } from "@/types/search/search";

// TODO(B2-1b)：随抽屉/筛选批次移植（对应旧 pages/search/components/brandFilter.vue）
// 渲染 null 保持 props 形状，保证本批可编译。

interface Props {
    brandList?: Brand[];
    /** v-model:brandIds */
    brandIds?: number[];
    onBrandIdsChange?: (next: number[]) => void;
    total?: number;
    isLoading?: boolean;
    onChange?: () => void;
    onBrandReset?: () => void;
    onClose?: () => void;
}

export default function BrandFilter(_props: Props) {
    return null;
}
