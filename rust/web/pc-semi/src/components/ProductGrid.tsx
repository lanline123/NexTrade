'use client';

import Link from 'next/link';
import { Toast } from '@douyinfe/semi-ui';
import ShoppingCart from '@icon-park/react/es/icons/ShoppingCart';
import { apiPost } from '@/lib/client-api';
import type { ProductListItem } from '@/lib/api';

function money(value: unknown): string {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface ProductGridProps {
  products: ProductListItem[];
  /** 搜索装修 showSales：true 时展示已售数量（默认展示库存）。 */
  showSales?: boolean;
  /** 搜索装修 showShopTag：为 true 且商品带店铺信息时展示店铺标签。 */
  showShopTag?: boolean;
}

async function addToCartQuick(productId: number) {
  try {
    await apiPost('cart/cart/addToCart', { id: productId, number: 1 });
    Toast.success({ content: '已加入购物车' });
  } catch (error) {
    Toast.error({ content: error instanceof Error ? error.message : '加入购物车失败' });
  }
}

export default function ProductGrid({ products, showSales = false, showShopTag = false }: ProductGridProps) {
  return (
    <div className="pc-product-grid">
      {products.map((product) => {
        const extra = product as ProductListItem & {
          sales?: number | string;
          virtualSales?: number | string;
          shopTitle?: string;
          shopName?: string;
          shopId?: number | string;
        };
        const sales = Number(extra.sales ?? extra.virtualSales ?? 0);
        const shopTitle = extra.shopTitle || extra.shopName || '';
        return (
          <Link key={product.productId} href={`/product/${product.productId}`} className="pc-product-grid__card">
            <div className="pc-product-grid__image">
              <img src={product.picThumb || product.picUrl || ''} alt={product.productName || ''} loading="lazy" />
              {showShopTag && shopTitle ? <span className="pc-product-grid__shop-tag">{shopTitle}</span> : null}
              <button
                type="button"
                className="pc-product-grid__quick"
                aria-label="加入购物车"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void addToCartQuick(Number(product.productId));
                }}
              >
                <ShoppingCart size={16} />
              </button>
            </div>
            <div className="pc-product-grid__body">
              <div className="pc-product-grid__name">{product.productName}</div>
              {product.brief ? <div className="pc-product-grid__brief">{product.brief}</div> : null}
              <div className="pc-product-grid__bottom">
                <b>
                  <small>¥</small> {money(product.productPrice)}
                </b>
                <span>{showSales ? `已售 ${sales}` : `库存 ${product.productStock ?? 0}`}</span>
              </div>
            </div>
          </Link>
        );
      })}
      {!products.length ? <div className="pc-list-empty">没有找到商品</div> : null}
    </div>
  );
}
