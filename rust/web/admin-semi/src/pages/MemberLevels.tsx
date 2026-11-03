import { useEffect, useState } from 'react';
import { Button, Card, Image, InputNumber, Table, Toast, Typography } from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import FormDrawer from '../framework/FormDrawer';
import type { FormDrawerConfig } from '../framework/types';
import ImageUploader from '../components/ImageUploader';

const { Text } = Typography;

interface RankRow {
  id?: number;
  rankLevel?: number;
  rankName?: string;
  rankLogo?: string;
}

const LEVEL_NAMES = ['Vip1', 'Vip2', 'Vip3', 'Vip4', 'Vip5', 'Vip6', 'Vip7', 'Vip8', 'Vip9', 'Vip10'];

/** 会员等级：对应旧版 user/levelManage/List.vue + Info.vue（批量编辑等级表）。 */
export default function MemberLevels() {
  const { t } = useI18n();
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerInitial, setDrawerInitial] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const loadList = () => {
    setLoading(true);
    apiGet<any>('/user/userRank/list', { page: 1, size: 50 })
      .then((result) => {
        setRows(result?.userRank?.records || result?.records || []);
      })
      .catch((error) => Toast.error({ content: error.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const reload = () => setReloadKey((key) => key + 1);

  const openEdit = async () => {
    try {
      const result = await apiGet<any>('/user/userRank/list', { page: 1, size: 50 });
      const data: RankRow[] = result?.userRank?.records || result?.records || [];
      setDrawerMode(data.length ? 'edit' : 'create');
      setDrawerInitial({ data: data.map((row) => ({ ...row })) });
      setDrawerOpen(true);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    }
  };

  const drawerConfig: FormDrawerConfig = {
    createApi: '/user/userRank/create',
    title: '会员等级',
    width: 640,
    labelWidth: 90,
    sections: [
      {
        key: 'levels',
        title: '等级设置（最多 10 级）',
        fields: [
          {
            field: 'data',
            label: t('等级列表'),
            type: 'custom',
            render: ({ formApi, values }) => {
              const data: RankRow[] = values.data || [];
              return (
                <div className="member-level-rows">
                  {data.map((row, index) => (
                    <div className="member-level-row" key={index}>
                      <span className="member-level-badge">vip{row.rankLevel ?? index + 1}</span>
                      <ImageUploader
                        single
                        value={row.rankLogo ? [row.rankLogo] : []}
                        onChange={(urls) => {
                          const next = [...data];
                          next[index] = { ...row, rankLogo: urls[0] || '' };
                          formApi?.setValue('data', next);
                        }}
                        max={1}
                      />
                      <InputNumber
                        style={{ width: 220 }}
                        value={row.rankName}
                        onChange={(next) => {
                          const nextRows = [...data];
                          nextRows[index] = { ...row, rankName: String(next ?? '') };
                          formApi?.setValue('data', nextRows);
                        }}
                      />
                      {data.length > 1 ? (
                        <Button
                          theme="borderless"
                          type="danger"
                          size="small"
                          onClick={() => formApi?.setValue('data', data.filter((_, i) => i !== index))}
                        >
                          {t('删除')}
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {data.length < 10 ? (
                    <Button
                      theme="borderless"
                      type="primary"
                      icon={<IconPlus />}
                      onClick={() => {
                        const next = [...data];
                        next.push({
                          rankLevel: data.length + 1,
                          rankName: LEVEL_NAMES[data.length] ?? `Vip${data.length + 1}`,
                          rankLogo: '',
                        });
                        formApi?.setValue('data', next);
                      }}
                    >
                      {t('添加等级')}
                    </Button>
                  ) : null}
                </div>
              );
            },
          },
        ],
      },
    ],
    toPayload: (values) => {
      const data = (values.data || []).map((row: RankRow, index: number) => ({
        ...row,
        rankLevel: row.rankLevel ?? index + 1,
      }));
      if (data.some((row: RankRow) => !String(row.rankName || '').trim())) {
        throw new Error(t('请填写所有等级名称'));
      }
      return { data };
    },
  };

  const columns = [
    {
      title: t('等级'),
      dataIndex: 'rankLevel',
      width: 120,
      render: (value: number) => <span className="member-level-badge">vip{value}</span>,
    },
    {
      title: t('会员图标'),
      dataIndex: 'rankLogo',
      width: 140,
      render: (value: string) =>
        value ? <Image src={value} height={20} /> : <span>-</span>,
    },
    {
      title: t('会员名称'),
      dataIndex: 'rankName',
      render: (value: string) => <span>{value || '-'}</span>,
    },
  ];

  return (
    <div className="member-levels-page">
      <Card shadows="hover">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <Text strong>{t('会员等级')}</Text>
          <Button theme="solid" type="primary" onClick={openEdit}>
            {t('编辑等级')}
          </Button>
        </div>
        <Table
          loading={loading}
          rowKey="rankLevel"
          dataSource={rows}
          columns={columns as never}
          pagination={false}
          empty={loading ? null : <Text type="tertiary">{t('暂无数据')}</Text>}
        />
      </Card>

      <FormDrawer
        visible={drawerOpen}
        mode={drawerMode}
        initialValues={drawerInitial}
        config={drawerConfig}
        saving={saving}
        onCancel={() => setDrawerOpen(false)}
        onSubmit={async (payload) => {
          setSaving(true);
          try {
            await apiPost(drawerMode === 'edit' ? '/user/userRank/update' : '/user/userRank/create', payload);
            Toast.success({ content: t('操作成功') });
            setDrawerOpen(false);
            reload();
          } catch (error) {
            Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}
