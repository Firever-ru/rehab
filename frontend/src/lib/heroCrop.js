// Shared crop geometry used by both the admin crop editor and the live
// homepage hero image. Everything is computed in real image pixels so the
// two stay pixel-for-pixel consistent, unlike CSS object-fit/object-position
// (which can't express an arbitrary 2-axis pan — see CHANGES.md).

export function targetAspect(mode) {
  return mode === 'mobile' ? 9 / 16 : 16 / 9;
}

// The largest rectangle with the given aspect ratio that fits entirely
// inside a naturalW x naturalH image, i.e. the crop at zoom = 100%.
export function maxCoverRect(naturalW, naturalH, aspect) {
  if (naturalW / naturalH > aspect) {
    const h = naturalH;
    return { w: h * aspect, h };
  }
  const w = naturalW;
  return { w, h: w / aspect };
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// stored position_x/position_y (0-100) + zoom (100-220) -> crop rectangle
// in natural image pixels: { left, top, width, height }.
export function cropRectFromPosition(naturalW, naturalH, mode, positionX, positionY, zoom) {
  const aspect = targetAspect(mode);
  const base = maxCoverRect(naturalW, naturalH, aspect);
  const width = clamp((base.w * 100) / zoom, 1, naturalW);
  const height = clamp((base.h * 100) / zoom, 1, naturalH);
  const maxOffX = Math.max(0, naturalW - width);
  const maxOffY = Math.max(0, naturalH - height);
  const left = maxOffX * (clamp(positionX, 0, 100) / 100);
  const top = maxOffY * (clamp(positionY, 0, 100) / 100);
  return { left, top, width, height };
}

// crop rectangle (natural px) -> stored position_x/position_y/zoom.
export function positionFromCropRect(naturalW, naturalH, mode, rect) {
  const aspect = targetAspect(mode);
  const base = maxCoverRect(naturalW, naturalH, aspect);
  const zoom = Math.round(clamp((base.w / rect.width) * 100, 100, 220));
  const maxOffX = Math.max(0, naturalW - rect.width);
  const maxOffY = Math.max(0, naturalH - rect.height);
  const positionX = maxOffX > 0 ? Math.round(clamp((rect.left / maxOffX) * 100, 0, 100)) : 50;
  const positionY = maxOffY > 0 ? Math.round(clamp((rect.top / maxOffY) * 100, 0, 100)) : 50;
  return { positionX, positionY, zoom };
}

// The smallest crop rectangle allowed for a given natural size/mode — caps
// how far a corner handle can zoom in (mirrors the zoom<=220 backend limit).
export function minCropSize(naturalW, naturalH, mode) {
  const aspect = targetAspect(mode);
  const base = maxCoverRect(naturalW, naturalH, aspect);
  return { w: (base.w * 100) / 220, h: (base.h * 100) / 220 };
}
