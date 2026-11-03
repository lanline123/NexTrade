import { useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Image,
  Input,
  Modal,
  Space,
  Switch,
  Tabs,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiPost, isDemo } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import ImageUploader from '../components/ImageUploader';
import type { ColumnConfig } from '../framework/types';

const { Text } = Typography;

interface CommentRow {
  commentId: number;
  userId?: number;
  username?: string;
  avatar?: string;
  productId?: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  content?: string;
  commentRank?: number;
  addTime?: string;
  isTop?: number;
  isRecommend?: number;
  isShowed?: number;
  sortOrder?: number;
  showPics?: Array<{ picThumb?: string; picUrl?: string }>;
  commentTag?: string[];
  replies?: Array<{ commentId: number; username?: string; content?: string; addTime?: string }>;
}

function CommentSwitch({
  row,
  field,
  value,
}: {
  row: CommentRow;
  field: 'isTop' | 'isRecommend';
  value?: number;
}) {
  const { t } = useI18n();
  const [checked, setChecked] = useState(value === 1);
  const toggle = async (next: boolean) => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持操作') });
      return;
    }
    try {
      await apiPost('/product/comment/updateField', {
        id: row.commentId,
        field,
        val: next ? 1 : 0,
      });
      setChecked(next);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('更新失败') });
    }
  };
  return <Switch checked={checked} onChange={toggle} size="small" />;
}

const buildColumns = (
  t: (key: string, params?: Record<string, string | number>) => string,
): ColumnConfig<CommentRow>[] => [
  {
    title: t('用户名称'),
    dataIndex: 'username',
    width: 160,
    render: (value: string, record) => (
      <Space>
        <Avatar src={record.avatar} size="small">
          {(value || 'U').slice(0, 1)}
        </Avatar>
        <span>{value || '-'}</span>
      </Space>
    ),
  },
  {
    title: t('评论对象'),
    dataIndex: 'productName',
    width: 240,
    render: (value: string, record) => (
      <Space>
        {record.picThumb && <Image src={record.picThumb} width={40} height={40} />}
        <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 170 }}>
          {value || '-'}
        </Text>
      </Space>
    ),
  },
  {
    title: t('评价内容'),
    dataIndex: 'content',
    width: 240,
    render: (value: string) => (
      <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 220 }}>
        {value || '-'}
      </Text>
    ),
  },
  {
    title: t('晒单'),
    dataIndex: 'showPics',
    width: 200,
    render: (value: CommentRow['showPics']) => (
      <Space>
        {(value || []).slice(0, 4).map((pic, index) => (
          <Image
            key={`${pic.picThumb || pic.picUrl}-${index}`}
            src={pic.picThumb || pic.picUrl}
            width={40}
            height={40}
          />
        ))}
        {!value?.length && '-'}
      </Space>
    ),
  },
  {
    title: t('评论等级'),
    dataIndex: 'commentRank',
    width: 100,
    render: (value: number) => t('{count}星', { count: value || 0 }),
  },
  { title: t('评论日期'), dataIndex: 'addTime', width: 170 },
  {
    title: t('是否置顶'),
    dataIndex: 'isTop',
    width: 100,
    render: (value: number, record) => (
      <CommentSwitch row={record} field="isTop" value={value} />
    ),
  },
  {
    title: t('是否推荐'),
    dataIndex: 'isRecommend',
    width: 100,
    render: (value: number, record) => (
      <CommentSwitch row={record} field="isRecommend" value={value} />
    ),
  },
  { title: t('排序'), dataIndex: 'sortOrder', width: 80 },
];

export default function Comments() {
  const { t } = useI18n();
  const columns = buildColumns(t);
  const [tab, setTab] = useState('all');
  const [reloadKey, setReloadKey] = useState(0);
  const [replyRow, setReplyRow] = useState<CommentRow | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const listQuery = useMemo(() => ({ isShowed: tab === 'pics' ? 1 : -1 }), [tab]);

  const submitReply = async () => {
    if (!replyRow || !replyContent.trim()) {
      Toast.warning({ content: t('请输入回复内容') });
      return;
    }
    try {
      await apiPost('/product/comment/replyComment', {
        commentId: replyRow.commentId,
        content: replyContent.trim(),
      });
      Toast.success({ content: t('回复成功') });
      setReplyRow(null);
      setReplyContent('');
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('回复失败') });
    }
  };

  return (
    <>
      <div className="content-tabs">
        <Tabs
          type="button"
          activeKey={tab}
          onChange={setTab}
          tabList={[
            { tab: t('全部评价'), itemKey: 'all' },
            { tab: t('有晒单'), itemKey: 'pics' },
          ]}
        />
      </div>

      <ListPage<CommentRow>
        key={`${tab}-${reloadKey}`}
        api="/product/comment/list"
        rowKey="commentId"
        pageSize={10}
        actionWidth={180}
        selectable
        batchActions={(rows, clear) => (
          <Button
            size="small"
            onClick={() => {
              Modal.confirm({
                title: t('批量删除商品评价'),
                content: t('确定删除选中的 {count} 条评价？', { count: rows.length }),
                onOk: async () => {
                  try {
                    await apiPost('/product/comment/batch', {
                      ids: rows.map((row) => row.commentId),
                      type: 'del',
                    });
                    Toast.success({ content: t('批量删除成功') });
                    clear();
                    setReloadKey((key) => key + 1);
                  } catch (error) {
                    Toast.error({ content: error instanceof Error ? error.message : t('批量删除失败') });
                  }
                },
              });
            }}
          >
            {t('批量删除')}
          </Button>
        )}
        query={listQuery}
        filters={[
          {
            field: 'keyword',
            label: '评价内容',
            type: 'input',
            placeholder: '请输入评价内容',
            width: 260,
          },
        ]}
        columns={columns}
        rowActions={(record) => (
          <Space spacing={2}>
            <Tag color={record.replies?.length ? 'green' : 'grey'} size="small">
              {record.replies?.length ? t('已回复') : t('未回复')}
            </Tag>
            <Text
              link
              size="small"
              onClick={() => {
                setReplyRow(record);
                setReplyContent('');
              }}
            >
              {t('回复')}
            </Text>
          </Space>
        )}
        drawer={{
          title: '用户评论',
          addText: '添加用户评论',
          width: 700,
          labelWidth: 'auto',
          inputWidth: 480,
          createApi: '/product/comment/create',
          updateApi: '/product/comment/update',
          detailApi: '/product/comment/detail',
          deleteApi: '/product/comment/del',
          idField: 'commentId',
          sections: [
            {
              key: 'basic',
              title: '评价信息',
              fields: [
                {
                  field: 'productId',
                  label: t('评论商品'),
                  type: 'select',
                  required: true,
                  optionsApi: '/product/product/list',
                  optionsParams: { page: 1, pageSize: 100 },
                  optionLabel: 'productName',
                  optionValue: 'productId',
                  placeholder: t('请选择评论商品'),
                },
                {
                  field: 'username',
                  label: t('会员名称'),
                  required: true,
                  placeholder: t('请输入会员名称'),
                },
                {
                  field: 'avatar',
                  label: t('会员头像'),
                  type: 'custom',
                  render: ({ formApi, values }) => (
                    <ImageUploader
                      value={values.avatar ? [values.avatar] : []}
                      onChange={(urls) => formApi?.setValue('avatar', urls[0] || '')}
                      max={1}
                    />
                  ),
                },
                {
                  field: 'commentRank',
                  label: t('评论星级'),
                  type: 'radio',
                  initValue: 5,
                  options: [1, 2, 3, 4, 5].map((value) => ({
                    label: t('{count}星', { count: value }),
                    value,
                  })),
                },
                {
                  field: 'commentTag',
                  label: t('标签'),
                  placeholder: t('多个标签用逗号分隔'),
                },
                {
                  field: 'content',
                  label: t('评论内容'),
                  type: 'textarea',
                  required: true,
                },
                {
                  field: 'showPics',
                  label: t('晒单'),
                  type: 'custom',
                  render: ({ formApi, values }) => (
                    <ImageUploader
                      value={(values.showPics || []).map(
                        (item: Record<string, any>) => item.picThumb || item.picUrl,
                      )}
                      onChange={(urls) =>
                        formApi?.setValue(
                          'showPics',
                          urls.map((url) => ({ picThumb: url, picUrl: url })),
                        )
                      }
                      max={9}
                    />
                  ),
                },
                { field: 'sortOrder', label: t('排序'), type: 'number', initValue: 50 },
                {
                  field: 'isRecommend',
                  label: t('是否推荐'),
                  type: 'switch',
                  initValue: 0,
                  checkedText: t('推荐'),
                  uncheckedText: t('不推荐'),
                },
                {
                  field: 'isTop',
                  label: t('是否置顶'),
                  type: 'switch',
                  initValue: 0,
                  checkedText: t('置顶'),
                  uncheckedText: t('不置顶'),
                },
              ],
            },
          ],
          toPayload: (values) => ({
            ...values,
            commentTag:
              typeof values.commentTag === 'string'
                ? values.commentTag
                    .split(',')
                    .map((item: string) => item.trim())
                    .filter(Boolean)
                : values.commentTag || [],
            isRecommend: values.isRecommend ? 1 : 0,
            isTop: values.isTop ? 1 : 0,
            sortOrder: Number(values.sortOrder ?? 50),
          }),
        }}
      />

      <Modal
        title={t('回复评论')}
        visible={Boolean(replyRow)}
        onCancel={() => setReplyRow(null)}
        width={520}
        footer={
          <Space>
            <Button onClick={() => setReplyRow(null)}>{t('取消')}</Button>
            <Button theme="solid" type="primary" onClick={submitReply}>
              {t('提交回复')}
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 10 }}>{t('评论：')}{replyRow?.content}</div>
        <TextArea
          value={replyContent}
          onChange={setReplyContent}
          rows={4}
          placeholder={t('请输入回复内容')}
        />
      </Modal>
    </>
  );
}
