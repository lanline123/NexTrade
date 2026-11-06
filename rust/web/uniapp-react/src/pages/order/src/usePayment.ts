/**
 * B3 交易链路第四批（pay/cashier/payStatus）已将完整移植版上移到 @/hooks/usePayment
 * （自旧 view/uniapp/src/hooks/usePayment.ts 逐行移植：创建支付单 → 分端拉起收银台 → 轮询支付状态）。
 * 本文件保留为兼容出口，供结算页（B3-2a/2b）既有导入路径继续使用。
 */
export { usePayment, PAYMENT_TEXT_MAP } from "@/hooks/usePayment";
export type { StartPayOptions } from "@/hooks/usePayment";
