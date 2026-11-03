import { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Empty, Input, Modal, Spin, Tag, Toast } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';

/**
 * 选择组织弹窗 —— 复刻跨境版 components/merchant/src/IndexSelectShop.vue。
 *
 * 数据源：GET  /adminapi/merchant/shop/myShop?sortField=lastLoginTime
 *   返回 { shop: { records }, vendor: { records }, userinfo, defaultPosShopId }
 * 切换：  POST /adminapi/merchant/shop/choose
 *   入参 { adminType, id }（Rust LoginChooseParam），返回 { shopView, authorities }
 * 新建：  POST /adminapi/merchant/shop/create        （店铺 shopType=1 / 门店 shopType=2）
 *         POST /adminapi/supplyChain/supplier/create （供应商）
 *   仅店铺管理员可见按钮：checkIsAdmin 为 true 且 adminType==='shop'
 *
 * 选中后：
 *   1. 先调 choose 让后端确认身份并下发权限位
 *   2. 写 localStorage adminType / shopId / vendorId / shopType
 *   3. 整页 reload，菜单权限由 App 按新身份重新拉取（对齐原版 location.reload）
 */

interface ShopRow {
  shopId: number;
  shopTitle: string;
  shopType?: number;
  shopLogo?: string | null;
}

interface VendorRow {
  vendorId: number;
  vendorName: string;
  gysLogo?: string | null;
}

interface UserInfo {
  adminId?: number;
  username?: string;
  adminType?: string;
  avatar?: string | null;
}

interface MyShopResult {
  shop?: { records?: ShopRow[] };
  vendor?: { records?: VendorRow[] };
  userinfo?: UserInfo;
}

interface SelectShopModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SelectShopModal({ visible, onClose }: SelectShopModalProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [shopList, setShopList] = useState<ShopRow[]>([]);
  const [vendorList, setVendorList] = useState<VendorRow[]>([]);
  const [userinfo, setUserinfo] = useState<UserInfo>({});
  const [keyword, setKeyword] = useState('');
  const [switching, setSwitching] = useState(false);
  /** 新建态：'' 列表态；'shop' 新建店铺；'store' 新建门店；'vendor' 新建供应商 */
  const [createMode, setCreateMode] = useState<'' | 'shop' | 'store' | 'vendor'>('');
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  /** 是否店铺管理员 —— 决定「新建店铺 / 新建门店」按钮是否显示（对齐原版 checkIsAdmin） */
  const [isShopAdmin, setIsShopAdmin] = useState(false);

  const adminType = (() => {
    try {
      return localStorage.getItem('adminType') || '';
    } catch {
      return '';
    }
  })();
  /** 当前组织类型：1=店铺 2=门店 3=自提点（原版 getShopType()） */
  const currentShopType = (() => {
    try {
      return Number(localStorage.getItem('shopType')) || 0;
    } catch {
      return 0;
    }
  })();

  const loadLists = () => {
    setLoading(true);
    return apiGet<MyShopResult>('/merchant/shop/myShop', { sortField: 'lastLoginTime' })
      .then((result) => {
        setShopList(result?.shop?.records || []);
        setVendorList(result?.vendor?.records || []);
        setUserinfo(result?.userinfo || {});
      })
      .catch(() => {
        setShopList([]);
        setVendorList([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!visible) return;
    setKeyword('');
    setCreateMode('');
    setCreateName('');
    void loadLists();
    // 原版 IndexSelectShop onMounted：检查当前账号是否店铺管理员
    apiGet<{ isAdmin?: boolean }>('/merchant/adminUserShop/checkIsAdmin')
      .then((result) => setIsShopAdmin(result?.isAdmin === true))
      .catch(() => setIsShopAdmin(false));
  }, [visible]);

  /** 原版 canShowCreateShopBtn / canShowCreateStoreBtn */
  const canShowCreateShopBtn = adminType === 'shop' && currentShopType === 1 && isShopAdmin;
  const canShowCreateStoreBtn = adminType === 'shop' && currentShopType === 2 && isShopAdmin;

  /**
   * 新建店铺 / 门店 / 供应商（对齐原版 IndexSelectShop::onSubmit）。
   * 店铺走 shopType=1，门店走 shopType=2，供应商走 supplyChain/supplier/create。
   */
  const submitCreate = async () => {
    const name = createName.trim();
    if (!name) {
      Toast.warning(
        createMode === 'vendor'
          ? t('供应商名称不能为空')
          : createMode === 'store'
            ? t('门店名称不能为空')
            : t('店铺名称不能为空'),
      );
      return;
    }
    setCreating(true);
    try {
      if (createMode === 'vendor') {
        await apiPost('/supplyChain/supplier/create', { vendorName: name });
      } else if (createMode === 'store') {
        await apiPost('/merchant/shop/create', { shopTitle: name, shopType: 2 });
      } else {
        await apiPost('/merchant/shop/create', { shopTitle: name, shopType: 1 });
      }
      Toast.success(t('创建成功'));
      setCreateMode('');
      setCreateName('');
      // 原版 emit('changeShopList') → 重新拉一次列表
      await loadLists();
    } catch (error) {
      Toast.error((error as Error)?.message || t('创建失败'));
    } finally {
      setCreating(false);
    }
  };

  const normalized = keyword.trim().toLocaleLowerCase();
  const match = (name?: string) =>
    !normalized || String(name ?? '').toLocaleLowerCase().includes(normalized);

  const showAdmin = userinfo.adminType === 'admin' && match(`${t('管理后台')} ${userinfo.username ?? ''}`);
  const filteredShops = useMemo(() => shopList.filter((item) => match(item.shopTitle)), [shopList, normalized]);
  const filteredVendors = useMemo(() => vendorList.filter((item) => match(item.vendorName)), [vendorList, normalized]);
  const hasResults = showAdmin || filteredShops.length > 0 || filteredVendors.length > 0;

  /**
   * 切换组织。对齐跨境版 SelectShop.vue::toIndex / utils/util.ts。
   *
   * pos 入口语义（原版 utils/util.ts:302-304）：
   *   「localStorage 跨标签页共享，只能存门店真实身份；
   *     收银台的 pos 身份由 request 按路径逐请求施加」
   *   → 即 posEntry 时 adminType 仍写 shop，只是切换后跳 /pos 而不是后台首页。
   *
   * choose 接口入参是 `{ adminType, id }`（Rust LoginChooseParam / Java LoginChooseDTO），
   * 注意不是 `{ type, shopId }` —— 传错字段后端不报错但也不会真正切换（shopView 恒 false）。
   */
  const switchTo = async (id: number, type: 'admin' | 'shop' | 'store' | 'vendor', posEntry = false) => {
    setSwitching(true);
    const realType = posEntry ? 'shop' : type;
    try {
      // 1) 先让后端确认身份并下发该组织的权限位（原版 toIndex 第一步也是走这个接口）
      const chosen = await apiPost<{ shopView?: boolean; authorities?: string[] }>(
        '/merchant/shop/choose',
        { adminType: realType, id: realType === 'admin' ? '' : String(id) },
      );

      // 2) 写本地身份（与原版 toIndex 一致：先清 shopId/vendorId 再按类型回填）
      localStorage.setItem('adminType', realType);
      localStorage.removeItem('shopId');
      localStorage.removeItem('vendorId');
      localStorage.removeItem('shopTitle');
      localStorage.removeItem('shopType');
      if (realType === 'shop' || realType === 'store') {
        localStorage.setItem('shopId', String(id));
        const hit = shopList.find((item) => item.shopId === id);
        if (hit?.shopTitle) localStorage.setItem('shopTitle', hit.shopTitle);
        // shopType 供原版 getShopType() 语义使用，也决定「新建店铺/门店」按钮显隐
        localStorage.setItem('shopType', String(hit?.shopType ?? (realType === 'store' ? 2 : 1)));
      }
      if (realType === 'vendor') {
        localStorage.setItem('vendorId', String(id));
      }
      // 后端下发的权限位缓存起来，供菜单/按钮级权限使用
      if (Array.isArray(chosen?.authorities)) {
        localStorage.setItem('admin_authorities', JSON.stringify(chosen.authorities));
      }
      if (typeof chosen?.shopView === 'boolean') {
        localStorage.setItem('admin_shop_view', chosen.shopView ? '1' : '0');
      }

      // 3) 切换组织后重新计时，避免「新订单」角标沿用上一个组织的窗口
      localStorage.setItem('lastOpenTime', String(Math.floor(Date.now() / 1000)));
      onClose();

      // 4) POS 收银台入口（对齐原版 toIndex 的 posEntry 分支语义）
      //
      //    原版此处是 router.push('/pos')，但经核查原版该分支实际不可用：
      //      - src/router/index.ts 里 POS 路由的 import 是注释掉的
      //      - 线上 admin 产物中不存在 path:"/pos" 路由定义
      //      - /admin/pos/ 只是 SPA fallback，与 /admin/ 同一入口
      //    本项目后台自带「收银工作台」页（pos0 → PosWorkbench），
      //    所以这里直接跳该页，而不是打开一个并不存在的独立 POS 应用。
      if (posEntry) {
        window.location.replace(`${window.location.pathname}?page=pos0`);
        return;
      }
      // 5) 普通切换：整页重载，菜单权限由 App 按新身份重新拉取（对齐原版 location.reload）
      window.location.reload();
    } catch (error) {
      setSwitching(false);
      Toast.error((error as Error)?.message || t('切换组织失败'));
    }
  };

  const labelOfShopType = (shopType?: number) => {
    if (shopType === 2) return { text: t('门店'), color: 'green' as const };
    if (shopType === 3) return { text: t('自提点'), color: 'orange' as const };
    return { text: t('店铺'), color: 'blue' as const };
  };

  return (
    <Modal
      title={
        createMode === 'shop'
          ? t('新增店铺')
          : createMode === 'store'
            ? t('新增门店')
            : createMode === 'vendor'
              ? t('新增供应商')
              : t('选择组织')
      }
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={880}
      bodyStyle={{ padding: '0 20px 20px' }}
    >
      {createMode === '' ? (
        <>
          <div className="select-shop-head">
            <Input
              prefix={<IconSearch />}
              value={keyword}
              placeholder={t('请输入组织名称')}
              showClear
              onChange={setKeyword}
              style={{ width: 300 }}
            />
          </div>

          <Spin spinning={loading}>
            <div className="select-shop-list">
              {!loading && !hasResults ? (
                <Empty description={t('暂无搜索结果')} style={{ padding: 60 }} />
              ) : (
                <>
                  {showAdmin && (
                    <button
                      type="button"
                      className="select-shop-item"
                      disabled={switching}
                      onClick={() => void switchTo(0, 'admin')}
                    >
                      <Avatar color="blue" size="large">管</Avatar>
                      <div className="select-shop-name">
                        <span className="select-shop-title">
                          {t('管理后台')}
                          {userinfo.username ? `（${userinfo.username}）` : ''}
                        </span>
                      </div>
                    </button>
                  )}
                  {filteredShops.map((item) => {
                    const label = labelOfShopType(item.shopType);
                    return (
                      <div className="select-shop-cell" key={`shop-${item.shopId}`}>
                        <button
                          type="button"
                          className="select-shop-item"
                          disabled={switching}
                          onClick={() => void switchTo(item.shopId, item.shopType === 2 ? 'store' : 'shop')}
                        >
                          {item.shopLogo ? (
                            <img className="select-shop-logo" src={item.shopLogo} alt="" />
                          ) : (
                            <Avatar color="blue" size="large">店</Avatar>
                          )}
                          <div className="select-shop-name">
                            <Tag color={label.color} size="small">{label.text}</Tag>
                            <span className="select-shop-title">{item.shopTitle}</span>
                          </div>
                        </button>
                        {/* POS 收银台入口（对齐原版 toIndex 的 posEntry 分支）：
                            以店铺真实身份进入收银台，不改变后台身份语义 */}
                        <button
                          type="button"
                          className="select-shop-pos-btn"
                          disabled={switching}
                          title={t('以该店铺身份进入收银台')}
                          onClick={() => void switchTo(item.shopId, 'shop', true)}
                        >
                          {t('进入收银台')}
                        </button>
                      </div>
                    );
                  })}
                  {filteredVendors.map((item) => (
                    <button
                      type="button"
                      key={`vendor-${item.vendorId}`}
                      className="select-shop-item"
                      disabled={switching}
                      onClick={() => void switchTo(item.vendorId, 'vendor')}
                    >
                      {item.gysLogo ? (
                        <img className="select-shop-logo" src={item.gysLogo} alt="" />
                      ) : (
                        <Avatar color="purple" size="large">供</Avatar>
                      )}
                      <div className="select-shop-name">
                        <Tag color="purple" size="small">{t('供应商')}</Tag>
                        <span className="select-shop-title">{item.vendorName}</span>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          </Spin>

          {/* 新建入口：仅店铺管理员可见（对齐原版 canShowCreateShopBtn / canShowCreateStoreBtn） */}
          {(canShowCreateShopBtn || canShowCreateStoreBtn) && (
            <div className="select-shop-create-btns">
              {canShowCreateShopBtn && (
                <Button type="primary" onClick={() => setCreateMode('shop')}>
                  {t('新建店铺')}
                </Button>
              )}
              {canShowCreateStoreBtn && (
                <Button type="primary" onClick={() => setCreateMode('store')}>
                  {t('新建门店')}
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        /* 新建态表单（对齐原版 IndexSelectShop 的 createMode 分支） */
        <div className="select-shop-create">
          <div className="select-shop-create-row">
            <span className="select-shop-create-label">
              {createMode === 'vendor'
                ? t('供应商名称')
                : createMode === 'store'
                  ? t('门店名称')
                  : t('店铺名称')}
            </span>
            <Input
              value={createName}
              onChange={setCreateName}
              onEnterPress={() => void submitCreate()}
              placeholder={
                createMode === 'vendor'
                  ? t('供应商名称不能为空')
                  : createMode === 'store'
                    ? t('门店名称不能为空')
                    : t('店铺名称不能为空')
              }
              style={{ width: 320 }}
            />
          </div>
          <div className="select-shop-create-btns">
            <Button type="primary" loading={creating} onClick={() => void submitCreate()}>
              {t('创建')}
            </Button>
            <Button
              onClick={() => {
                setCreateMode('');
                setCreateName('');
              }}
            >
              {t('取消')}
            </Button>
          </div>
        </div>
      )}

      {switching && (
        <div className="select-shop-switching">
          <Button loading type="primary">{t('正在切换组织')}</Button>
        </div>
      )}
    </Modal>
  );
}
