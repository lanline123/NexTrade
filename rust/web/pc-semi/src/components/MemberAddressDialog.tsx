'use client';

/**
 * 收货地址编辑弹窗（地区级联）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/components/member/address/DialogEditRegion.vue
 *          + java-b2b2c-overseas-v5.8.61/view/pc/pages/member/address/EditRegion.vue
 *
 * 旧版 DialogEditRegion.vue 是「把 EditRegion.vue 页面表单包进 el-dialog」的懒加载壳：
 * - 点击 → 首次挂载 EditRegion 表单 → el-dialog 打开；
 * - 表单提交成功 → emit('okCallback', result, data)，壳层关闭弹窗。
 * EditRegion.vue 表单字段：收货人 / 所在地区（SelectRegion 三级级联）/ 详细地址 /
 * 手机号码 / 固定电话 / 邮箱地址。
 *
 * 字段补齐（本文件相对旧版额外补的）：
 * - 详细地址最少 3 字校验（旧版 EditRegion.vue:16 `{ min: 3, message: '收货人地址过短' }`）；
 * - 收货人 maxlength=20 / 详细地址 maxlength=100 / 手机 maxlength=20 / 邮箱 maxlength=50
 *   （旧版 EditRegion.vue 各 Input 的 maxlength 属性）。
 *
 * 后端契约：
 * - GET  /sys/region/getRegionListByRegionId?regionId=  省/市/区三级（routes/system/region_client.rs）
 * - GET  /user/address/detail?id=                        编辑回显
 * - POST /user/address/create | /user/address/update     新增 / 修改
 */
import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';

export interface AddressFormValue {
  consignee: string;
  mobile: string;
  mobileAreaCode: string;
  telephone: string;
  email: string;
  address: string;
  regionIds: number[];
}

interface Region {
  regionId: number;
  regionName: string;
  parentId?: number;
  level?: number;
}

interface AddressDetail {
  addressId?: number;
  consignee?: string;
  mobile?: string;
  mobileAreaCode?: string;
  telephone?: string;
  email?: string;
  address?: string;
  regionIds?: number[];
  regionNames?: string[];
}

const EMPTY_FORM: AddressFormValue = {
  consignee: '',
  mobile: '',
  mobileAreaCode: '',
  telephone: '',
  email: '',
  address: '',
  regionIds: [],
};

/** 旧版 EditRegion.vue：详细地址最少 3 字 */
const ADDRESS_MIN_LENGTH = 3;

export default function MemberAddressDialog({
  visible,
  addressId,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  /** 0 表示新增；>0 表示编辑（走 detail 回显） */
  addressId?: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<AddressFormValue>(EMPTY_FORM);
  const [provinces, setProvinces] = useState<Region[]>([]);
  const [cities, setCities] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<Region[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadChildren = useCallback(async (parentId: number): Promise<Region[]> => {
    const list = await apiGet<Region[]>('sys/region/getRegionListByRegionId', { regionId: parentId }).catch(() => []);
    return Array.isArray(list) ? list : [];
  }, []);

  const loadProvinces = useCallback(async () => {
    const list = await apiGet<Region[]>('sys/region/getRegionListByRegionId', { regionId: 1 }).catch(() => []);
    setProvinces(Array.isArray(list) ? list : []);
  }, []);

  const reset = useCallback(() => {
    setForm(EMPTY_FORM);
    setCities([]);
    setDistricts([]);
  }, []);

  useEffect(() => {
    if (!visible) return;
    reset();
    void loadProvinces();
  }, [visible, reset, loadProvinces]);

  // 编辑模式：拉详情回显并按级联补齐市 / 区
  useEffect(() => {
    if (!visible || !addressId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const detail = await apiGet<AddressDetail>('user/address/detail', { id: addressId }).catch(() => null);
        if (cancelled) return;
        const current = detail || {};
        const ids = current.regionIds || [];
        setForm({
          consignee: current.consignee || '',
          mobile: current.mobile || '',
          mobileAreaCode: current.mobileAreaCode || '',
          telephone: current.telephone || '',
          email: current.email || '',
          address: current.address || '',
          regionIds: ids,
        });
        if (ids[0]) {
          const cityList = await loadChildren(ids[0]);
          if (cancelled) return;
          setCities(cityList);
          if (ids[1]) {
            const districtList = await loadChildren(ids[1]);
            if (cancelled) return;
            setDistricts(districtList);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, addressId, loadChildren]);

  const onProvince = async (value: number) => {
    setForm((current) => ({ ...current, regionIds: [value] }));
    setDistricts([]);
    setCities(await loadChildren(value));
  };

  const onCity = async (value: number) => {
    setForm((current) => ({ ...current, regionIds: [current.regionIds[0], value] }));
    setDistricts(await loadChildren(value));
  };

  const onDistrict = (value: number) => {
    setForm((current) => ({ ...current, regionIds: [current.regionIds[0], current.regionIds[1], value] }));
  };

  const save = async () => {
    const { consignee, mobile, address, regionIds } = form;
    if (!consignee.trim()) return Toast.warning({ content: t('请您填写收货人姓名') });
    if (!regionIds.length) return Toast.warning({ content: t('请选择收货人所在地区') });
    if (!address.trim()) return Toast.warning({ content: t('请您填写详细收货地址') });
    if (address.trim().length < ADDRESS_MIN_LENGTH) return Toast.warning({ content: t('收货人地址过短') });
    if (!mobile.trim()) return Toast.warning({ content: t('请您填写收货人手机号码') });

    setSaving(true);
    try {
      const body = { ...form, regionIds, addressId: addressId || undefined };
      await apiPost(addressId ? 'user/address/update' : 'user/address/create', body);
      Toast.success({ content: t('操作成功') });
      onClose();
      onSuccess();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={addressId ? t('编辑收货地址') : t('添加收货地址')}
      visible={visible}
      width={880}
      maskClosable
      onCancel={onClose}
      footer={
        <div className="member-address-dialog__footer">
          <Button theme="solid" type="primary" loading={saving} onClick={() => void save()}>{t('确认修改地址')}</Button>
          <Button onClick={onClose}>{t('取消')}</Button>
        </div>
      }
    >
      <div className="member-address-dialog__form">
        <div className="member-address-dialog__field">
          <label className="member-address-dialog__label">{t('收货人：')}</label>
          <Input
            className="member-address-dialog__input"
            value={form.consignee}
            onChange={(value) => setForm((current) => ({ ...current, consignee: value }))}
            placeholder={t('请您填写收货人姓名')}
            maxLength={20}
          />
        </div>
        <div className="member-address-dialog__field">
          <label className="member-address-dialog__label">{t('所在地区：')}</label>
          <div className="member-address-dialog__region">
            <Select value={form.regionIds[0]} placeholder={t('省份')} onChange={(value) => void onProvince(Number(value))} showClear={false}>
              {provinces.map((item) => <Select.Option key={item.regionId} value={item.regionId}>{item.regionName}</Select.Option>)}
            </Select>
            <Select value={form.regionIds[1]} placeholder={t('城市')} onChange={(value) => void onCity(Number(value))} showClear={false} disabled={!cities.length}>
              {cities.map((item) => <Select.Option key={item.regionId} value={item.regionId}>{item.regionName}</Select.Option>)}
            </Select>
            <Select value={form.regionIds[2]} placeholder={t('区县')} onChange={(value) => onDistrict(Number(value))} showClear={false} disabled={!districts.length}>
              {districts.map((item) => <Select.Option key={item.regionId} value={item.regionId}>{item.regionName}</Select.Option>)}
            </Select>
          </div>
        </div>
        <div className="member-address-dialog__field">
          <label className="member-address-dialog__label">{t('详细地址：')}</label>
          <Input
            className="member-address-dialog__input"
            value={form.address}
            onChange={(value) => setForm((current) => ({ ...current, address: value }))}
            placeholder={t('请您填写详细收货地址')}
            maxLength={100}
          />
        </div>
        <div className="member-address-dialog__field">
          <label className="member-address-dialog__label">{t('手机号码：')}</label>
          <Input
            className="member-address-dialog__input"
            value={form.mobile}
            onChange={(value) => setForm((current) => ({ ...current, mobile: value }))}
            placeholder={t('请您填写收货人手机号码')}
            maxLength={20}
          />
        </div>
        <div className="member-address-dialog__field">
          <label className="member-address-dialog__label">{t('固定电话：')}</label>
          <Input
            className="member-address-dialog__input"
            value={form.telephone}
            onChange={(value) => setForm((current) => ({ ...current, telephone: value }))}
            maxLength={20}
          />
        </div>
        <div className="member-address-dialog__field">
          <label className="member-address-dialog__label">{t('邮箱地址：')}</label>
          <Input
            className="member-address-dialog__input"
            value={form.email}
            onChange={(value) => setForm((current) => ({ ...current, email: value }))}
            maxLength={50}
          />
        </div>
      </div>
    </Modal>
  );
}
