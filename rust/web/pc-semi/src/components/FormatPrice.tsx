'use client';

import { splitCurrencyPrice } from '@/lib/currency';

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
  /** 覆盖币种符号（默认跟随当前换币设置） */
  currency?: string;
  /** 整数段字号：旧版用 `:fontStyle="{ fontSize: '24px', fontWeight: '400' }"` 传进来 */
  fontSize?: string;
  fontWeight?: number | string;
  className?: string;
}

export default function FormatPrice({ value, currency, fontSize, fontWeight, className }: FormatPriceProps) {
  const parts = splitCurrencyPrice(value);
  const symbol = currency || parts.symbol;
  const decimals = parts.decimals === '.00' ? '' : parts.decimals;
  const fontStyle = fontSize || fontWeight ? { fontSize, fontWeight } : undefined;
  const rootStyle = fontStyle || undefined;

  return (
    <div className={`price align-bottom${className ? ` ${className}` : ''}`} style={rootStyle}>
      <div className="util align-bottom">{symbol}</div>
      <div className="num">{parts.integer}</div>
      {decimals ? <div className="num decimal">{decimals}</div> : null}
    </div>
  );
}
