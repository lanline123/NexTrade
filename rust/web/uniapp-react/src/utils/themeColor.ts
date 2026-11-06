/**
 * 主题颜色工具（装修商品卡活动标签等按主题色派生浅色背景）
 */

interface RGBA {
    r: number;
    g: number;
    b: number;
    a: number;
}

/** 解析 #hex / rgb() / rgba() */
export const parseColor = (color: string): RGBA | null => {
    const hexMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(color);
    if (hexMatch) {
        return {
            r: parseInt(hexMatch[1], 16),
            g: parseInt(hexMatch[2], 16),
            b: parseInt(hexMatch[3], 16),
            a: hexMatch[4] ? parseInt(hexMatch[4], 16) / 255 : 1
        };
    }

    const rgbaMatch = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i.exec(color);
    if (rgbaMatch) {
        return {
            r: parseInt(rgbaMatch[1]),
            g: parseInt(rgbaMatch[2]),
            b: parseInt(rgbaMatch[3]),
            a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
        };
    }

    return null;
};

export const colorToString = (r: number, g: number, b: number, a: number = 1): string => {
    if (a < 1) {
        return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
    }
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

/**
 * 调整颜色亮度（变浅）
 * @param color 原始颜色
 * @param percent 亮度百分比 (0-1)，值越大越浅
 */
export const adjustBrightness = (color: string, percent: number): string => {
    const rgba = parseColor(color);
    if (!rgba) return color;

    const r = Math.min(255, Math.max(0, Math.round(rgba.r + (255 - rgba.r) * percent)));
    const g = Math.min(255, Math.max(0, Math.round(rgba.g + (255 - rgba.g) * percent)));
    const b = Math.min(255, Math.max(0, Math.round(rgba.b + (255 - rgba.b) * percent)));

    return colorToString(r, g, b, rgba.a);
};
