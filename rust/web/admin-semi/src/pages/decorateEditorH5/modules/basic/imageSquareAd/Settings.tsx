/**
 * 图片魔方 设置（字段对齐 view/admin imageSquareAd/Settings.vue）
 *
 * 布局选择：按 picType 渲染魔方缩略图宫格，点击选中图片位（picIndex），
 * 选中后在下方面板替换该位置图片/编辑链接（对齐 Vue 版 PicList v-model:photo 行为）；
 * 切换模板时按 Vue 版 onPicTypeChange 的 lengthMap 调整 picList 数量。
 */
import { useEffect, useState } from "react";
import { Button, Input, Toast, Upload } from "@douyinfe/semi-ui";
import { IconDelete, IconPlus } from "@douyinfe/semi-icons";
import { SettingGroup, RadioRowField, NumberField, TitleSettingsField, FrameSettingsField } from "../../../shared/settingWidgets";
import { imageFormat } from "../../../shared/format";

const lengthMap: Record<number, number> = { 1: 2, 2: 3, 5: 3, 7: 3, 3: 4, 4: 4, 6: 4 };
const emptyPic = { picId: 0, picThumb: "", picUrl: "", picName: "" };

const boxStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    boxSizing: "border-box",
    border: "1px solid #e0e0e0",
    borderRadius: 2,
    overflow: "hidden",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fafafa"
};

function Box({ src, selected, onClick }: { src?: string; selected: boolean; onClick: () => void }) {
    return (
        <div
            style={{ ...boxStyle, ...(selected ? { borderColor: "#155bd4", boxShadow: "0 0 0 1px #155bd4 inset" } : null) }}
            onClick={onClick}
        >
            {src ? <img src={imageFormat(src)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        </div>
    );
}

export default function ImageSquareAdSettings({ data, onChange }: { data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
    const picList: any[] = Array.isArray(data?.picList) ? data.picList : [];
    const [picIndex, setPicIndex] = useState(0);

    // 对齐 Vue 版 onPicTypeChange：切换模板时重置选中位并按 lengthMap 调整 picList 数量
    useEffect(() => {
        setPicIndex(0);
        const length = lengthMap[Number(data?.picType)] || 2;
        if (picList.length === length) return;
        let next: any[];
        if (length >= picList.length) {
            next = [...picList, ...Array.from({ length: length - picList.length }, () => ({ ...emptyPic }))];
        } else {
            next = picList.slice(0, length); // 与 Vue 版 splice(-(now - length)) 一致：从尾部裁剪
        }
        onChange({ picList: next });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data?.picType]);

    const setPic = (index: number, patch: Record<string, any>) => {
        const next = [...picList];
        next[index] = { ...next[index], ...patch };
        onChange({ picList: next });
    };

    // 选中位图片（对齐 Vue 版 PicList :isMultiple="false" v-model:photo）
    const uploadProps = {
        action: "/adminapi/file/uploadImage",
        onSuccess: (body: any) => {
            const url = body?.data?.url || body?.url;
            if (!url) {
                Toast.error("上传失败");
                return;
            }
            setPic(Math.min(picIndex, picList.length - 1), { picUrl: url, picThumb: url });
        },
        onError: () => Toast.error("上传失败")
    };

    const currentItem = picList[Math.min(picIndex, picList.length - 1)];
    const showLayoutGrid = [1, 2, 3].includes(Number(data?.picType)) || ([4, 5, 6, 7].includes(Number(data?.picType)) && picList.length === lengthMap[Number(data?.picType)]);

    return (
        <div className="h5-editor-settings-body">
            <SettingGroup title="选择模板">
                <RadioRowField
                    data={data}
                    onChange={onChange}
                    field="picType"
                    label="选择模板"
                    options={[
                        { value: 1, label: "一行两个" },
                        { value: 2, label: "一行三个" },
                        { value: 3, label: "一行四个" },
                        { value: 4, label: "左二右二" },
                        { value: 5, label: "左一右二" },
                        { value: 6, label: "左一右三" },
                        { value: 7, label: "上一下二" }
                    ]}
                />
            </SettingGroup>
            <SettingGroup title="选择布局">
                {showLayoutGrid && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {[1, 2, 3].includes(Number(data?.picType)) && (
                            <div style={{ display: "flex", gap: 6 }}>
                                {picList.map((item, index) => (
                                    <Box key={index} src={item?.picThumb} selected={picIndex === index} onClick={() => setPicIndex(index)} />
                                ))}
                            </div>
                        )}
                        {Number(data?.picType) === 4 && picList.length === 4 && (
                            <div style={{ display: "flex", gap: 6 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    <Box src={picList[0]?.picThumb} selected={picIndex === 0} onClick={() => setPicIndex(0)} />
                                    <Box src={picList[1]?.picThumb} selected={picIndex === 1} onClick={() => setPicIndex(1)} />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    <Box src={picList[2]?.picThumb} selected={picIndex === 2} onClick={() => setPicIndex(2)} />
                                    <Box src={picList[3]?.picThumb} selected={picIndex === 3} onClick={() => setPicIndex(3)} />
                                </div>
                            </div>
                        )}
                        {Number(data?.picType) === 5 && picList.length === 3 && (
                            <div style={{ display: "flex", gap: 6 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    <Box src={picList[0]?.picThumb} selected={picIndex === 0} onClick={() => setPicIndex(0)} />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    <Box src={picList[1]?.picThumb} selected={picIndex === 1} onClick={() => setPicIndex(1)} />
                                    <Box src={picList[2]?.picThumb} selected={picIndex === 2} onClick={() => setPicIndex(2)} />
                                </div>
                            </div>
                        )}
                        {Number(data?.picType) === 7 && picList.length === 3 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <div style={{ display: "flex", gap: 6 }}>
                                    <Box src={picList[0]?.picThumb} selected={picIndex === 0} onClick={() => setPicIndex(0)} />
                                </div>
                                <div style={{ display: "flex", gap: 6 }}>
                                    <Box src={picList[1]?.picThumb} selected={picIndex === 1} onClick={() => setPicIndex(1)} />
                                    <Box src={picList[2]?.picThumb} selected={picIndex === 2} onClick={() => setPicIndex(2)} />
                                </div>
                            </div>
                        )}
                        {Number(data?.picType) === 6 && picList.length === 4 && (
                            <div style={{ display: "flex", gap: 6 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    <Box src={picList[0]?.picThumb} selected={picIndex === 0} onClick={() => setPicIndex(0)} />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <Box src={picList[1]?.picThumb} selected={picIndex === 1} onClick={() => setPicIndex(1)} />
                                    </div>
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <Box src={picList[2]?.picThumb} selected={picIndex === 2} onClick={() => setPicIndex(2)} />
                                        <Box src={picList[3]?.picThumb} selected={picIndex === 3} onClick={() => setPicIndex(3)} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </SettingGroup>
            <SettingGroup title="添加图片">
                {picList.length > 1 && currentItem ? (
                    <>
                        {currentItem.picThumb || currentItem.picUrl ? (
                            <div className="h5-editor-pic-row" style={{ marginBottom: 8 }}>
                                <img src={imageFormat(currentItem.picThumb || currentItem.picUrl)} alt="" />
                                <Button
                                    size="small"
                                    type="danger"
                                    icon={<IconDelete />}
                                    onClick={() => setPic(picIndex, { picUrl: "", picThumb: "" })}
                                />
                            </div>
                        ) : null}
                        <Upload {...(uploadProps as any)} accept="image/*" showUploadList={false}>
                            <Button size="small" icon={<IconPlus />} style={{ marginBottom: 8 }}>
                                替换第 {picIndex + 1} 张图片
                            </Button>
                        </Upload>
                        <Input
                            size="small"
                            placeholder="跳转链接，如 /pages/product/index?id=1"
                            value={currentItem.picLink?.link ?? ""}
                            onChange={(v: string) => {
                                const link = { ...(currentItem.picLink || { title: "" }), link: v };
                                setPic(picIndex, { picLink: link });
                            }}
                        />
                    </>
                ) : (
                    <div style={{ fontSize: 12, color: "#999" }}>请先选择布局并选中图片位后编辑</div>
                )}
            </SettingGroup>
            <SettingGroup title="图片设置">
                <NumberField data={data} onChange={onChange} field="imgPadding" label="图片边距" suffix="px" max={30} />
            </SettingGroup>
            <TitleSettingsField data={data} onChange={onChange} />
            <FrameSettingsField data={data} onChange={onChange} />
        </div>
    );
}
