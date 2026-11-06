export interface ThemeStyleFormResult {
    item: ThemeStyleFormState;
    color: ColorList[];
}

export interface ThemeStyleFormState {
    themeId?: number;
    color1?: string;
    color2?: string;
    color3?: string;
    color4?: string;
}

export interface ColorList {
    themeId: number;
    check?: boolean;
    color1?: string;
    color2?: string;
    color3?: string;
    color4?: string;
}
