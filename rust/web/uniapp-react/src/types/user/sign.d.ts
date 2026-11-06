export interface SignInfoResponse {
    days: SignDay[];
    record: number;
    isSign: number;
    signPoints: number;
    recommendGoods: ProductInfo[];
}
export type SignInfo = SignInfoResponse;
export interface SignDay { dayNum: number; name: string; points: number; sortOrder?: number; }
export interface ProductInfo { productId: number; productName: string; productPrice: number | string; [key: string]: any; }
