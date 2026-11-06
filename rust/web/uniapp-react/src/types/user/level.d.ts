export interface Right {
    name: string;
    showName: string;
    icon: string;
    value: string;
    describe: string;
    isChecked: number;
}

export interface Rank {
    rankId: number;
    rankName: string;
    minGrowthPoints: number;
    maxGrowthPoints: number;
    discount: string;
    showPrice: number;
    rankType: number;
    rankIco: string;
    rankBg: string;
    rankPoint: string;
    freeShipping: number;
    rankCardType: number;
    rights: Right[];
    rankLevel: string;
}

export interface RightUnion extends Partial<Right> {
    iconImg?: string;
    rightName?: string;
}
