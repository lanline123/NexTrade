import { create } from "zustand";

export interface CatnavState {
    navLeft: number;
    showCatNav: number;
    currentCatnavId: number;
    catColor: string;
    setNavLeft: (val: number) => void;
    setShowCatNav: (val: number) => void;
    setCurrentCatnavId: (val: number) => void;
    setCatColor: (val: string) => void;
    reset: () => void;
}

export const usecatnavStore = create<CatnavState>((set) => ({
    navLeft: 0,
    showCatNav: 0,
    currentCatnavId: 0,
    catColor: "",
    setNavLeft: (val) => set({ navLeft: val }),
    setShowCatNav: (val) => set({ showCatNav: val }),
    setCurrentCatnavId: (val) => set({ currentCatnavId: val }),
    setCatColor: (val) => set({ catColor: val }),
    reset: () => set({ navLeft: 0, showCatNav: 0, currentCatnavId: 0, catColor: "" })
}));
