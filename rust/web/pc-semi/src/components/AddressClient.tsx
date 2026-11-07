'use client';

/**
 * 收货地址管理（对照旧版 `view/pc/pages/member/address/List.vue` + `EditRegion.vue`）。
 *
 * 视觉/结构对齐原版：
 * - 内容区白底圆角 8px，标题行 72px 高（「地址」18px 粗体 + 白底红边「添加新地址」）；
 * - 两列卡片网格（gap 8px），卡片边框 1px #e0e1e5、padding 15px、圆角 4px，
 *   默认地址卡片边框跟随主题色（--main-bg）；
 * - 卡内：收货人 / 手机号（无效地址标记）、地区+详细地址（两行省略）、邮箱 / 固定电话、
 *   「默认地址」方形勾选 + 编辑 / 删除图标；
 * - 分页右对齐、「暂无收货地址」空状态图（/assets/images/empty-box.png）；
 * - 新增 / 编辑弹窗：收货人、所在地区、详细地址、手机号码、固定电话、邮箱地址，
 *   底部「确认修改地址 / 取消」。
 *
 * 数据接口（对齐旧版 api/user/address.ts）：
 * - GET  user/address/list     列表
 * - GET  user/address/detail   编辑回显（?id=）
 * - POST user/address/create   新增
 * - POST user/address/update   修改
 * - POST user/address/setSelected 设为默认
 * - POST user/address/del      删除
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Input, Modal, Select, Toast } from '@douyinfe/semi-ui';
import Edit from '@icon-park/react/es/icons/Edit';
import Delete from '@icon-park/react/es/icons/Delete';
import Plus from '@icon-park/react/es/icons/Plus';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface Address {
  addressId: number;
  consignee?: string;
  mobile?: string;
  mobileAreaCode?: string;
  telephone?: string;
  email?: string;
  regionName?: string;
  regionNames?: string[];
  regionIds?: number[];
  address?: string;
  formattedAddress?: string;
  fullAddress?: string;
  isSelected?: number;
  isDefault?: number;
  isInvalid?: number;
}

interface Region {
  regionId: number;
  regionName: string;
  parentId?: number;
  level?: number;
}

const EMPTY_FORM = {
  consignee: '',
  mobile: '',
  mobileAreaCode: '',
  telephone: '',
  email: '',
  address: '',
};

const PAGE_SIZE = 10;

export default function AddressClient() {
    const { t } = useTranslation();
  const [rows, setRows] = useState<Address[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [provinces, setProvinces] = useState<Region[]>([]);
  const [cities, setCities] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<Region[]>([]);
  const [regionIds, setRegionIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = (nextPage = page) => {
    setLoading(true);
    apiGet<{ records?: Address[]; total?: number }>('user/address/list', { page: nextPage, size: PAGE_SIZE })
      .then((result) => {
        setRows(result.records || []);
        setTotal(Number(result.total || 0));
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        setNeedLogin(message.includes('登录') || message.includes('401'));
      })
      .finally(() => setLoading(false));
  };

  const loadProvinces = () => {
    apiGet<Region[]>('sys/region/getRegionListByRegionId', { regionId: 1 })
      .then((result) => setProvinces(result || []))
      .catch(() => undefined);
  };

  useEffect(() => {
    load(1);
    loadProvinces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goPage = (nextPage: number) => {
    setPage(nextPage);
    load(nextPage);
  };

  const openCreate = () => {
    setEditingId(0);
    setForm(EMPTY_FORM);
    setRegionIds([]);
    setCities([]);
    setDistricts([]);
    setOpen(true);
  };

  const loadChildren = async (parentId: number): Promise<Region[]> => {
    const list = await apiGet<Region[]>('sys/region/getRegionListByRegionId', { regionId: parentId }).catch(() => []);
    return list || [];
  };

  const openEdit = async (address: Address) => {
    setEditingId(address.addressId);
    setForm({
      consignee: address.consignee || '',
      mobile: address.mobile || '',
      mobileAreaCode: address.mobileAreaCode || '',
      telephone: address.telephone || '',
      email: address.email || '',
      address: address.address || '',
    });
    setRegionIds(address.regionIds || []);
    setCities([]);
    setDistricts([]);
    setOpen(true);

    // 旧版编辑弹窗走 detail 接口回显（列表 VO 不一定带 regionIds）
    const detail = await apiGet<Address>('user/address/detail', { id: address.addressId }).catch(() => null);
    const current = detail || address;
    setForm({
      consignee: current.consignee || '',
      mobile: current.mobile || '',
      mobileAreaCode: current.mobileAreaCode || '',
      telephone: current.telephone || '',
      email: current.email || '',
      address: current.address || '',
    });
    const ids = current.regionIds || address.regionIds || [];
    setRegionIds(ids);
    if (ids[0]) {
      setCities(await loadChildren(ids[0]));
      if (ids[1]) setDistricts(await loadChildren(ids[1]));
    }
  };

  const onProvince = async (value: number) => {
    setRegionIds([value]);
    setCities([]);
    setDistricts([]);
    setCities(await loadChildren(value));
  };

  const onCity = async (value: number) => {
    setRegionIds((current) => [current[0], value]);
    setDistricts([]);
    setDistricts(await loadChildren(value));
  };

  const onDistrict = (value: number) => {
    setRegionIds((current) => [current[0], current[1], value]);
  };

  const save = async () => {
    if (!form.consignee.trim() || !form.mobile.trim() || !regionIds.length || !form.address.trim()) {
      Toast.warning({ content: '请填写收货人、手机号、地区和详细地址' });
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        regionIds,
        addressId: editingId || undefined,
      };
      await apiPost(editingId ? 'user/address/update' : 'user/address/create', body);
      Toast.success({ content: '保存成功' });
      setOpen(false);
      load(page);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (addressId: number) => {
    try {
      await apiPost('user/address/setSelected', { id: addressId });
      Toast.success({ content: '操作成功' });
      load(page);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '设置失败' });
    }
  };

  const remove = (addressId: number) => {
    Modal.confirm({
      title: '删除地址',
      content: '确认删除该收货地址？',
      onOk: async () => {
        try {
          await apiPost('user/address/del', { id: addressId });
          Toast.success({ content: '删除成功' });
          const nextPage = rows.length === 1 && page > 1 ? page - 1 : page;
          setPage(nextPage);
          load(nextPage);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : '删除失败' });
        }
      },
    });
  };

  const regionText = (address: Address) => {
    if (address.formattedAddress) return address.formattedAddress;
    if (address.fullAddress) return address.fullAddress;
    const names = (address.regionNames || []).join(' ') || address.regionName || '';
    return [names, address.address].filter(Boolean).join(' ');
  };

  const pageNumbers = (): number[] => {
    if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
    const start = Math.max(1, Math.min(page - 2, pages - 4));
    return Array.from({ length: 5 }, (_, index) => start + index);
  };

  if (needLogin) {
    return (
      <div className="member-address__login-state">
        <h2>{t('登录后管理收货地址')}</h2>
        <p>{t('请先登录账号再添加或修改地址。')}</p>
        <Link href="/login?redirect=/member/address">
          <Button theme="solid" type="primary" size="large">{t('去登录')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="member-address">
      <div className="member-address__head">
        <span className="member-address__title">{t('地址')}</span>
        <Button className="member-address__add" icon={<Plus size={14} />} onClick={openCreate}>{t('添加新地址')}</Button>
      </div>

      {loading ? (
        <div className="member-address__loading">{t('加载中...')}</div>
      ) : rows.length ? (
        <>
          <ul className="member-address__list">
            {rows.map((address) => {
              const selected = Number(address.isSelected) === 1;
              return (
                <li key={address.addressId} className={`member-address__card${selected ? ' is-selected' : ''}`}>
                  <div className="member-address__top">
                    <div className="member-address__name">{address.consignee || '-'}</div>
                    <div className="member-address__mobile">
                      <span>
                        {address.mobileAreaCode ? `+${address.mobileAreaCode} ` : ''}
                        {address.mobile || '-'}
                      </span>
                      {Number(address.isInvalid) === 1 ? <span className="member-address__invalid">{t('无效地址')}</span> : null}
                    </div>
                  </div>
                  <div className="member-address__region">{regionText(address) || '-'}</div>
                  <div className="member-address__other">
                    <div>{address.email || '-'}</div>
                    <div>{address.telephone || '-'}</div>
                  </div>
                  <div className="member-address__bottom">
                    <button
                      type="button"
                      className={`member-address__default${selected ? ' is-checked' : ''}`}
                      aria-pressed={selected}
                      onClick={() => {
                        if (!selected) void setDefault(address.addressId);
                      }}
                    >
                      <span className="member-address__default-box" aria-hidden="true" />
                      <span>{t('默认地址')}</span>
                    </button>
                    <div className="member-address__ops">
                      <button type="button" className="member-address__op" title={t('编辑')} aria-label={t('编辑')} onClick={() => void openEdit(address)}>
                        <Edit size={20} />
                      </button>
                      <button type="button" className="member-address__op" title={t('删除')} aria-label={t('删除')} onClick={() => remove(address.addressId)}>
                        <Delete size={20} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {pages > 1 ? (
            <div className="member-address__pager">
              <button
                type="button"
                className="member-address__page-btn"
                disabled={page <= 1}
                aria-label={t('上一页')}
                onClick={() => goPage(page - 1)}
              >
                ‹
              </button>
              {pageNumbers().map((number) => (
                <button
                  type="button"
                  key={number}
                  className={`member-address__page-btn${number === page ? ' is-active' : ''}`}
                  onClick={() => goPage(number)}
                >
                  {number}
                </button>
              ))}
              <button
                type="button"
                className="member-address__page-btn"
                disabled={page >= pages}
                aria-label={t('下一页')}
                onClick={() => goPage(page + 1)}
              >
                ›
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="member-address__empty">
          <img className="member-address__empty-img" src="/assets/images/empty-box.png" alt="" />
          <div className="member-address__empty-text">{t('暂无收货地址')}</div>
        </div>
      )}

      <Modal
        title={editingId ? t('编辑收货地址') : '添加收货地址'}
        visible={open}
        onCancel={() => setOpen(false)}
        width={880}
        maskClosable
        footer={
          <div className="member-address__modal-footer">
            <Button className="member-address__modal-ok" loading={saving} onClick={() => void save()}>{t('确认修改地址')}</Button>
            <Button className="member-address__modal-cancel" onClick={() => setOpen(false)}>{t('取消')}</Button>
          </div>
        }
      >
        <div className="member-address__form">
          <div className="member-address__field">
            <label className="member-address__label">{t('收货人：')}</label>
            <Input
              className="member-address__input"
              value={form.consignee}
              onChange={(value) => setForm((current) => ({ ...current, consignee: value }))}
              placeholder={t('请您填写收货人姓名')}
              maxLength={20}
            />
          </div>
          <div className="member-address__field">
            <label className="member-address__label">{t('所在地区：')}</label>
            <div className="member-address__region-select">
              <Select value={regionIds[0]} placeholder={t('省份')} onChange={(value) => void onProvince(Number(value))} showClear={false}>
                {provinces.map((item) => <Select.Option key={item.regionId} value={item.regionId}>{item.regionName}</Select.Option>)}
              </Select>
              <Select value={regionIds[1]} placeholder={t('城市')} onChange={(value) => void onCity(Number(value))} showClear={false} disabled={!cities.length}>
                {cities.map((item) => <Select.Option key={item.regionId} value={item.regionId}>{item.regionName}</Select.Option>)}
              </Select>
              <Select value={regionIds[2]} placeholder={t('区县')} onChange={(value) => onDistrict(Number(value))} showClear={false} disabled={!districts.length}>
                {districts.map((item) => <Select.Option key={item.regionId} value={item.regionId}>{item.regionName}</Select.Option>)}
              </Select>
            </div>
          </div>
          <div className="member-address__field">
            <label className="member-address__label">{t('详细地址：')}</label>
            <Input
              className="member-address__input"
              value={form.address}
              onChange={(value) => setForm((current) => ({ ...current, address: value }))}
              placeholder={t('请您填写详细收货地址')}
              maxLength={100}
            />
          </div>
          <div className="member-address__field">
            <label className="member-address__label">{t('手机号码：')}</label>
            <Input
              className="member-address__input"
              value={form.mobile}
              onChange={(value) => setForm((current) => ({ ...current, mobile: value }))}
              placeholder={t('请您填写收货人手机号码')}
              maxLength={20}
            />
          </div>
          <div className="member-address__field">
            <label className="member-address__label">{t('固定电话：')}</label>
            <Input
              className="member-address__input"
              value={form.telephone}
              onChange={(value) => setForm((current) => ({ ...current, telephone: value }))}
              maxLength={20}
            />
          </div>
          <div className="member-address__field">
            <label className="member-address__label">{t('邮箱地址：')}</label>
            <Input
              className="member-address__input"
              value={form.email}
              onChange={(value) => setForm((current) => ({ ...current, email: value }))}
              maxLength={50}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}