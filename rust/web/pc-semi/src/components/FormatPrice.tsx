'use client';

/**
 * 价格展示（对照旧版 `view/pc/components/format/Price.vue`）
 *
 * 旧版 DOM：`div.price.align-bottom > div.util(币种符号) + div.num(整数) + div.num.decimal(小数)`
 * 三段各带自己的字号，价格样式在 member.less 的 `.price` 系列里定义（baseline 对齐）。
 * 这里只搬结构，不引入任何新样式。
 */
export interface FormatPriceProps {
  /** 金额，字符串或数字 */
  value: number | string | undefined;
  /** 币种符号，默认 ¥ */
  currency?: string;
  /** 整数段字号：旧版用 `:fontStyle="{ fontSize: '24px', fontWeight: '400' }"` 传进来 */
  fontSize?: string;
  fontWeight?: number | string;
  className?: string;
}

/** 与后端金额一致：保留两位小数，去掉末尾 0 */
function splitPriceParts(value: number | string | undefined): { integer: string; decimals: string } {
  const numeric = Number(value ?? 0);
  const safe = Number.isFinite(numeric) ? numeric : 0;
  const [integer = '0', decimals = ''] = safe.toFixed(2).split('.');
  return { integer, decimals: decimals === '00' ? '' : decimals };
}

export default function FormatPrice({ value, currency = '¥', fontSize, fontWeight, className }: FormatPriceProps) {
  const { integer, decimals } = splitPriceParts(value);
  const fontStyle = fontSize || fontWeight ? { fontSize, fontWeight } : undefined;
  const rootStyle = fontStyle || undefined;

  return (
    <div className={`price align-bottom${className ? ` ${className}` : ''}`} style={rootStyle}>
      <div className="util align-bottom">{currency}</div>
      <div className="num">{integer}</div>
      {decimals ? <div className="num decimal">{decimals}</div> : null}
    </div>
  );
}
