import { useEffect, useRef, useState } from "react";
import { Popup } from "@nutui/nutui-react-taro";
import { ScrollView, View } from "@tarojs/components";

import { getRegionByIds, getRegionListByRegionId } from "@/api/region";
import { t } from "@/utils/i18n";

import "./SelectRegion.scss";

interface Props {
    /** 旧 v-model:show */
    show?: boolean;
    onShowChange?: (show: boolean) => void;
    /** 旧 v-model（地区 ID 链） */
    modelValue?: number[];
    onModelValueChange?: (value: number[]) => void;
    /** 旧 height */
    height?: string;
    /** 国家根节点；传入后按接口逐级懒加载，不把根节点写入 regionIds */
    rootRegionId?: number | string;
    /** 旧 @send-region-names */
    onSendRegionNames?: (names: string[]) => void;
}

/**
 * 省市区选择弹层（自旧 components/region/selectRegion.vue 移植）
 * - 默认按 getRegionByIds 一次性取整条地区链
 * - 传入 rootRegionId 时从国家根节点开始逐级懒加载
 * - 旧 tig-popup → NutUI Popup（bottom）
 */
export default function SelectRegion({
    show = false,
    onShowChange,
    modelValue = [],
    onModelValueChange,
    height = "60vh",
    rootRegionId,
    onSendRegionNames
}: Props) {
    const [regionList, setRegionList] = useState<any[][]>([]);
    const [showIndex, setShowIndex] = useState(0);

    // 旧实现直接改写 props.modelValue 数组；React 下以引用镜像承接同一份选择链
    const idsRef = useRef<number[]>(modelValue);
    idsRef.current = modelValue;

    // 内部选择后父级会以新数组回传；记录最近一次已取数的键，避免重复请求
    const lastFetchKeyRef = useRef("");

    const hasRoot = rootRegionId !== undefined && rootRegionId !== null;

    /** 取地区层级链（rootRegionId 分支逐级懒加载；否则一次性取整链） */
    const fetchLevels = async (ids: any[]): Promise<any[][]> => {
        try {
            if (hasRoot) {
                const levels: any[] = [];
                let parentId: number | string = rootRegionId as number | string;
                for (const selectedId of ids) {
                    const children = await getRegionListByRegionId(parentId);
                    levels.push(children || []);
                    if (!children?.some((item: any) => Number(item.regionId) === Number(selectedId))) break;
                    parentId = selectedId;
                }
                const next = await getRegionListByRegionId(parentId);
                levels.push(next || []);
                return levels;
            }
            let idsParam = "";
            if (ids.length > 0) {
                idsParam = ids.join(",");
            }
            const result = await getRegionByIds(idsParam);
            return result as any as any[][];
        } catch (error) {
            console.error("Error fetching regions:", error);
            return [];
        }
    };

    const getRegions = async (ids: any[] = idsRef.current) => {
        const levels = await fetchLevels(ids);
        if (!levels.length) return;
        setRegionList(levels);

        if (hasRoot) {
            setShowIndex(Math.max(0, levels.length - 1));
            return;
        }
        if (levels.length > 1) {
            if (levels[levels.length - 1].length > 0) {
                setShowIndex(levels.length - 1);
            } else {
                setShowIndex(levels.length - 2);
            }
        } else {
            setShowIndex(0);
        }
    };

    // 旧 watch(() => props.modelValue, immediate: true)
    useEffect(() => {
        const fetchKey = `${(modelValue || []).join(",")}|${String(rootRegionId)}`;
        if (fetchKey === lastFetchKeyRef.current) return;
        lastFetchKeyRef.current = fetchKey;
        if (modelValue) {
            void getRegions(modelValue);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modelValue, rootRegionId]);

    const regionSelected = (regionId: any) => {
        return idsRef.current.includes(regionId);
    };

    /** 旧 computed regionNames：按层级取已选地区名，未选层显示「请选择地区」 */
    const computeNames = (levels: any[][], ids: any[]): string[] => {
        const res: any = [];
        levels.forEach((item: any, index) => {
            if (item.length > 0) {
                let selected = false;
                item.forEach((region: any) => {
                    if (ids.includes(region.regionId)) {
                        res[index] = region.regionName;
                        selected = true;
                    }
                });
                if (selected == false) {
                    res[index] = t("请选择地区");
                }
            }
        });
        return res;
    };

    const onSelect = async (index: number, regionId: any) => {
        if (!idsRef.current) return;
        const nextIds = [...idsRef.current];
        if (index >= 0 && index <= nextIds.length) {
            nextIds[index] = regionId;
            nextIds.splice(index + 1);
        }
        idsRef.current = nextIds;
        lastFetchKeyRef.current = `${nextIds.join(",")}|${String(rootRegionId)}`;
        onModelValueChange?.(nextIds);
        const levels = await fetchLevels(nextIds);
        setRegionList(levels);

        if (levels.length == index + 1 || levels[index + 1]?.length == 0) {
            onShowChange?.(false);
            onSendRegionNames?.(computeNames(levels, nextIds));
        } else {
            setShowIndex(index + 1);
        }
    };

    const regionNames = computeNames(regionList, idsRef.current);

    return (
        <Popup visible={show} position="bottom" onClose={() => onShowChange?.(false)}>
            <View className="select-region-main region-panel-Y2IyMjgyZWU" style={{ height }}>
                <View className="popup-title">{t("选择地区")}</View>
                <View className="content">
                    <View className="region-menu">
                        {regionNames.map((item, index) => (
                            <View
                                key={index}
                                className={`region-menu-item${showIndex === index ? " active" : ""}`}
                                onClick={() => setShowIndex(index)}
                            >
                                {item ? item : t("请选择")}
                            </View>
                        ))}
                    </View>
                    {regionList.map((item, index) =>
                        showIndex === index ? (
                            <ScrollView key={index} scrollY className="region-list">
                                {item.map((region: any) => (
                                    <View
                                        key={region.regionId}
                                        className={`region-list-item${regionSelected(region.regionId) ? " active" : ""}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            void onSelect(index, region.regionId);
                                        }}
                                    >
                                        {region.regionName}
                                    </View>
                                ))}
                            </ScrollView>
                        ) : null
                    )}
                </View>
            </View>
        </Popup>
    );
}