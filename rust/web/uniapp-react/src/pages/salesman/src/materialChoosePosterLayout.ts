export const POSTER_CONTAINER_WIDTH = 300;
export const POSTER_FOOTER_HEIGHT = 90;

export const calculateProportionalHeight = (originalWidth: number, originalHeight: number, containerWidth = POSTER_CONTAINER_WIDTH): number => {
    if (!Number.isFinite(originalWidth) || originalWidth <= 0 || !Number.isFinite(originalHeight) || originalHeight < 0) {
        return 0;
    }
    return (originalHeight * containerWidth) / originalWidth;
};

export const getPosterCanvasSize = (originalWidth: number, originalHeight: number) => ({
    width: POSTER_CONTAINER_WIDTH,
    height: calculateProportionalHeight(originalWidth, originalHeight) + POSTER_FOOTER_HEIGHT
});