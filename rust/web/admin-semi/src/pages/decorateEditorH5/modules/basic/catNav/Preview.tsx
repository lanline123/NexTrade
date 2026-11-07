/**
 * 分类导航 预览（移植自 view/admin editor/modules/mobile/catNav/Preview.vue）
 *
 * 类名与 Vue 版逐一致（catnav-main / catnav-logo / default-search / catnav-menu），
 * 分类数据实时拉取（/decorate/mobileCatNav/list，isShow=1，首位固定「推荐」）。
 */
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../../../../api";
import { cssText, imageFormat } from "../../../shared/format";
import { mergeDefaultModule, formatFrame } from "../../../contract/sharedDefaults";
import { catNavDefaults } from "./index";

import { useI18n } from '../../../../../i18n';
import "./Preview.css";

export default function CatNavPreview({ data }: { data: Record<string, any> }) {
    const { t } = useI18n();
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, catNavDefaults);
        return merged;
    }, [data]);

    const [catNavList, setCatNavList] = useState<Array<{ categoryName: string; mobileCatNavId: number }>>([]);
    useEffect(() => {
        let alive = true;
        apiGet<{ records?: any[] }>('/decorate/mobileCatNav/list', { paging: 0, isShow: 1 })
            .then((result) => {
                if (!alive) return;
                setCatNavList([{ categoryName: t('推荐'), mobileCatNavId: 0 }, ...(result.records || [])]);
            })
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, []);

    const frameFormat = formatFrame(module.frame ?? {});
    const mainStyle = {
        backgroundColor: module.backgroundColor || undefined,
        paddingTop: `${module.boxPaddingTop ?? 5}px`,
        paddingBottom: `${module.boxPaddingBottom ?? 5}px`,
        backgroundImage: module.navBackgroundPic?.picUrl ? `url('${imageFormat(module.navBackgroundPic.picUrl)}')` : undefined,
        backgroundRepeat: 'no-repeat' as const,
        backgroundPosition: 'center center',
    };

    return (
        <div className="catnav-main module-ad-con module-cat_nav" style={mainStyle}>
            <img
                className="catnav-logo"
                style={{ height: `${module.logoHeight ?? 0}px` }}
                src={imageFormat(module.logoPic?.picUrl || '')}
                alt=""
            />
            <div className="default-search" style={{ paddingRight: `${module.boxPadding ?? 10}px`, paddingLeft: `${module.boxPadding ?? 10}px` }}>
                <div className="default-search-config catnav-search" style={{ backgroundColor: module.itemBackgroundColor || '#fff', borderRadius: `${module.itemRadius ?? 3}px` }}>
                    <svg viewBox="0 0 1024 1024" width="18" height="18" fill="#999" style={{ marginLeft: 10, flexShrink: 0 }}>
                        <path d="M448 768A320 320 0 1 0 448 128a320 320 0 0 0 0 640z m297.6 43.3a448 448 0 1 1 66.7-66.7l194 194a48 48 0 0 1-67.9 67.9l-192.8-195.2z" />
                    </svg>
                    <div className="catnav-search-text" style={{ color: module.searchTextColor || undefined }}>
                        {module.searchText || t('搜索商品')}
                    </div>
                </div>
            </div>
            <div className="catnav-menu">
                <ul className="catnav-flex">
                    {catNavList.map((item, index) => (
                        <li className="catnav-menu-item" key={item.mobileCatNavId} style={{ width: `${module.itemWidth ?? 50}%` }}>
                            <div className={index === 0 ? 'active' : ''} style={{ color: module.textColor || undefined }}>
                                {item.categoryName}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
