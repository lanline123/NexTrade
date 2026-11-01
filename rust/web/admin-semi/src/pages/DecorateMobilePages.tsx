import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Tabs,
  TabPane,
  Input,
  Select,
  Tag,
  Typography,
  Modal,
  Spin,
  Space,
  Switch,
  Toast,
  Radio,
  RadioGroup,
  ColorPicker,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';

const { Text, Title } = Typography;

/* =========================================================================
 * 1. ThemeStyle (decorate0 主题风格)
 * 契约对齐: java/view/admin/src/views/decorate/theme/Index.vue
 * labels: 主题风格, 主色调, 风格预设, 保存设置
 * ========================================================================= */
export function ThemeStyle() {
  const [themeColor, setThemeColor] = useState('#165dff');
  const [themePreset, setThemePreset] = useState('classic');

  const onSave = () => {
    Toast.success('主题风格保存成功');
  };

  return (
    <div style={{ padding: 20 }}>
      <Card title="主题风格配置" style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>主色调：</Text>
          <Space>
            <Input value={themeColor} onChange={(v: string) => setThemeColor(v)} style={{ width: 140 }} />
            <div style={{ width: 36, height: 36, background: themeColor, borderRadius: 6, border: '1px solid #ccc' }} />
          </Space>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>风格预设：</Text>
          <RadioGroup value={themePreset} onChange={(e) => setThemePreset(e.target.value)}>
            <Radio value="classic">经典商务蓝</Radio>
            <Radio value="modern">活力活力橙</Radio>
            <Radio value="elegant">优雅尊贵红</Radio>
            <Radio value="fresh">清新自然绿</Radio>
          </RadioGroup>
        </div>

        <Button type="primary" size="large" onClick={onSave}>
          保存设置
        </Button>
      </Card>
    </div>
  );
}

/* =========================================================================
 * 2. MobileDecoratePages (mobileDecorateManage 页面管理)
 * 契约对齐: java/view/admin/src/views/decorate/mobileDecorate/List.vue
 * labels: 页面名称, 发布状态, 更新时间, 操作
 * props: decorateId, status, updateTime, bingdingH5Name
 * ========================================================================= */
export function MobileDecoratePages() {
  const columns: ColumnConfig<any>[] = [
    { title: 'ID', dataIndex: 'decorateId', width: 80 },
    {
      title: '页面名称',
      dataIndex: 'decorateName',
      width: 180,
      render: (v: any, row: any) => v || row?.bingdingH5Name || '首页微页面',
    },
    {
      title: '发布状态',
      dataIndex: 'status',
      width: 110,
      render: (s: any) => <Tag color={s === 1 ? 'green' : 'grey'}>{s === 1 ? '已发布' : '草稿'}</Tag>,
    },
    { title: '更新时间', dataIndex: 'updateTime', width: 170 },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 140,
      render: () => (
        <Space>
          <Button theme="borderless" type="primary">装修</Button>
          <Button theme="borderless" type="danger">删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <ListPage
        api="/decorate/decorate/list"
        query={{ decorateType: 1 }}
        rowKey="decorateId"
        columns={columns}
        filters={[
          { field: 'decorateName', label: '页面名称', type: 'input' },
        ]}
        drawer={{
          title: '新建移动端页面',
          addText: '新建页面',
          width: 600,
          createApi: '/decorate/decorate/create',
          updateApi: '/decorate/decorate/update',
          deleteApi: '/decorate/decorate/del',
          sections: [
            {
              key: 'basic',
              title: '基础信息',
              fields: [
                { field: 'decorateName', label: '页面名称', type: 'input', required: true },
              ],
            },
          ],
        }}
      />
    </div>
  );
}

/* =========================================================================
 * 3. MobileSplashAd (mobileSplashAdManage / mobileSplashAdManage2 开屏广告)
 * 契约对齐: java/view/admin/src/views/decorate/mobileDecorate/SplashAd.vue
 * labels: 开屏广告, 添加素材, 最大等待时长, 跳转
 * props: state, autoReturnGoods, materialImg, materialVideo, maxWaitTime, redirectType, redirectUrl
 * ========================================================================= */
export function MobileSplashAd() {
  const [config, setConfig] = useState({
    state: 1,
    autoReturnGoods: 0,
    materialImg: 'https://img.tigshop.com/ad/splash.jpg',
    materialVideo: '',
    maxWaitTime: 5,
    redirectType: 'url',
    redirectUrl: 'https://',
  });

  const onSave = () => {
    Toast.success('开屏广告配置保存成功');
  };

  return (
    <div style={{ padding: 20 }}>
      <Card title="开屏广告设置" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <Text strong style={{ width: 120 }}>开屏广告开关：</Text>
          <Switch checked={config.state === 1} onChange={(c) => setConfig({ ...config, state: c ? 1 : 0 })} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>最大等待时长(秒)：</Text>
          <Input
            value={String(config.maxWaitTime)}
            onChange={(v: string) => setConfig({ ...config, maxWaitTime: Number(v || 5) })}
            style={{ width: 200 }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>添加素材(图片/视频)：</Text>
          <Input
            value={config.materialImg}
            placeholder="输入广告图片URL"
            onChange={(v: string) => setConfig({ ...config, materialImg: v })}
            style={{ marginBottom: 8 }}
          />
          <Input
            value={config.materialVideo}
            placeholder="可选：视频素材URL"
            onChange={(v: string) => setConfig({ ...config, materialVideo: v })}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>跳转链接：</Text>
          <Input
            value={config.redirectUrl}
            placeholder="https://..."
            onChange={(v: string) => setConfig({ ...config, redirectUrl: v })}
          />
        </div>

        <Button type="primary" size="large" onClick={onSave}>
          保存设置
        </Button>
      </Card>
    </div>
  );
}

/* =========================================================================
 * 4. MobileNav (mobileNavManage 主导航栏)
 * 契约对齐: java/view/admin/src/views/decorate/mobileDecorate/Nav.vue
 * labels: 导航名称, 发布状态, 更新时间, 操作
 * props: decorateId, status, updateTime
 * ========================================================================= */
export function MobileNav() {
  const columns: ColumnConfig<any>[] = [
    { title: 'ID', dataIndex: 'decorateId', width: 80 },
    { title: '导航名称', dataIndex: 'decorateName', width: 180, render: (v: any) => v || '主导航栏' },
    {
      title: '发布状态',
      dataIndex: 'status',
      width: 110,
      render: (s: any) => <Tag color={s === 1 ? 'green' : 'grey'}>{s === 1 ? '已发布' : '草稿'}</Tag>,
    },
    { title: '更新时间', dataIndex: 'updateTime', width: 170 },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 140,
      render: () => (
        <Space>
          <Button theme="borderless" type="primary">编辑</Button>
          <Button theme="borderless" type="danger">删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <ListPage
        api="/decorate/decorate/list"
        query={{ decorateType: 2 }}
        rowKey="decorateId"
        columns={columns}
        filters={[
          { field: 'decorateName', label: '导航名称', type: 'input' },
        ]}
      />
    </div>
  );
}

/* =========================================================================
 * 5. ClassifyDecorate (classifyManage 分类页)
 * 契约对齐: java/view/admin/src/views/decorate/mobileDecorate/Classify.vue
 * labels: 页面样式：
 * props: type
 * ========================================================================= */
export function ClassifyDecorate() {
  const [styleType, setStyleType] = useState('1');

  return (
    <div style={{ padding: 20 }}>
      <Card title="移动端分类页样式">
        <div style={{ marginBottom: 20 }}>
          <Text strong>页面样式：</Text>
          <RadioGroup value={styleType} onChange={(e) => setStyleType(e.target.value)} style={{ marginTop: 12 }}>
            <Radio value="1">左侧一级分类 + 右侧两级商品图文</Radio>
            <Radio value="2">大图网格样式</Radio>
            <Radio value="3">多级抽屉联动样式</Radio>
          </RadioGroup>
        </div>
        <Button type="primary" onClick={() => Toast.success('分类页样式保存成功')}>
          保存样式
        </Button>
      </Card>
    </div>
  );
}

/* =========================================================================
 * 6. MobileUserDecorate (mobileUserManage 会员首页)
 * 契约对齐: java/view/admin/src/views/decorate/mobileDecorate/user/User.vue
 * labels: 会员首页, 资产模块, 订单模块, 工具栏配置
 * ========================================================================= */
export function MobileUserDecorate() {
  return (
    <div style={{ padding: 20 }}>
      <Card title="会员中心首页装修" style={{ maxWidth: 640 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
          自由配置会员个人中心的背景图、会员卡信息展示、资产入口与常用工具菜单。
        </Text>
        <Space vertical align="start">
          <Button type="primary" onClick={() => Toast.info('进入会员中心可视化画布')}>
            进入可视化画布装修
          </Button>
        </Space>
      </Card>
    </div>
  );
}

/* =========================================================================
 * 7. MobileUserOverseas (mobileuserUserOverseasManage 会员首页海外版)
 * ========================================================================= */
export function MobileUserOverseas() {
  return (
    <div style={{ padding: 20 }}>
      <Card title="海外版会员首页装修" style={{ maxWidth: 640 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
          适配国际化多语言与海外地址格式的会员个人中心配置。
        </Text>
        <Button type="primary" onClick={() => Toast.info('进入海外版画布装修')}>
          进入可视化画布装修
        </Button>
      </Card>
    </div>
  );
}

/* =========================================================================
 * 8. MobileSearchStyle (mobileSearchStyleManage 搜索风格)
 * ========================================================================= */
export function MobileSearchStyle() {
  const [style, setStyle] = useState('round');
  return (
    <div style={{ padding: 20 }}>
      <Card title="移动端搜索风格" style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>搜索框形状：</Text>
          <RadioGroup value={style} onChange={(e) => setStyle(e.target.value)}>
            <Radio value="round">圆角胶囊风格</Radio>
            <Radio value="square">直角极简风格</Radio>
          </RadioGroup>
        </div>
        <Button type="primary" onClick={() => Toast.success('搜索风格已更新')}>
          保存配置
        </Button>
      </Card>
    </div>
  );
}

/* =========================================================================
 * 9. MobileCatNav (mobileCatNavManage 分类导航)
 * 契约对齐: java/view/admin/src/views/decorate/mobileCatNav/List.vue
 * labels: 首页分类栏名称, 分类颜色, 是否显示, 排序, 操作, 主导航, 顶部小导航, 底部导航, 侧边导航
 * props: categoryName, isShow, sortOrder
 * ========================================================================= */
export function MobileCatNav() {
  const columns: ColumnConfig<any>[] = [
    { title: '首页分类栏名称', dataIndex: 'categoryName', width: 180 },
    {
      title: '分类颜色',
      dataIndex: 'categoryColor',
      width: 120,
      render: (c: any) => <div style={{ width: 24, height: 24, background: c || '#ff5000', borderRadius: 4 }} />,
    },
    {
      title: '是否显示',
      dataIndex: 'isShow',
      width: 110,
      render: (v: any) => <Tag color={v ? 'green' : 'grey'}>{v ? '显示' : '隐藏'}</Tag>,
    },
    { title: '排序', dataIndex: 'sortOrder', width: 90 },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 140,
      render: () => (
        <Space>
          <Button theme="borderless" type="primary">编辑</Button>
          <Button theme="borderless" type="danger">删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <ListPage
        api="/decorate/mobileCatNav/list"
        rowKey="id"
        columns={columns}
        filters={[
          { field: 'categoryName', label: '首页分类栏名称', type: 'input' },
        ]}
        drawer={{
          title: '分类导航配置',
          addText: '添加分类导航',
          width: 600,
          createApi: '/decorate/mobileCatNav/create',
          updateApi: '/decorate/mobileCatNav/update',
          deleteApi: '/decorate/mobileCatNav/del',
          sections: [
            {
              key: 'basic',
              title: '基础配置',
              fields: [
                { field: 'categoryName', label: '首页分类栏名称', type: 'input', required: true },
                { field: 'categoryColor', label: '分类颜色', type: 'input' },
                { field: 'isShow', label: '是否显示', type: 'switch' },
                { field: 'sortOrder', label: '排序', type: 'input' },
              ],
            },
          ],
        }}
      />
    </div>
  );
}
