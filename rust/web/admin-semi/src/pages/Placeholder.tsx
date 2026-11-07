import { Banner, Card, Typography } from '@douyinfe/semi-ui';
import { pageTitles } from '../config/adminMenu';

const { Title, Text } = Typography;

/**
 * 未迁移页面占位。
 *
 * 菜单入口按原版保留，但此页面**没有任何列表、表单或接口调用**。
 * 之前这里写着「列表页 / 表单抽屉 / 接口接入 / PageSpec 审计」四张能力卡，
 * 会让验收方误以为功能已迁移；现改为如实展示缺失状态与路由 key。
 */
export default function Placeholder({ page }: { page: string }) {
  const title = pageTitles[page] || page;
  return (
    <Card>
      <Title heading={3} style={{ margin: 0 }}>
        {title}
      </Title>
      <Text type="tertiary" style={{ display: 'block', marginTop: 8 }}>
        路由 key：<code>{page}</code>
      </Text>
      <Banner
        type="warning"
        style={{ marginTop: 16 }}
        description="该菜单入口按原版保留，但页面尚未迁移：当前没有列表数据、表单抽屉或后端接口调用。请以差距报告为准排期补齐，不要计入已完成功能。"
      />
    </Card>
  );
}
