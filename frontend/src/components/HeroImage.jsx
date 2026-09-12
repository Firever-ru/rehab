import { useEffect, useRef, useState } from 'react';
import { cropRectFromPosition } from '../lib/heroCrop.js';

// Renders the hero photo by explicitly positioning/sizing it (left/top/
// width/height in px), computed from the real crop rectangle chosen in the
// admin panel — not CSS object-fit/object-position, which cannot express an
// arbitrary 2-axis pan (see CHANGES.md). This keeps the live site pixel-
// consistent with the admin crop editor on any screen size.
export default function HeroImage({ src, alt, desktop, mobile }) {
  const boxRef = useRef(null);
  const [natural, setNatural] = useState(null);
  const [box, setBox] = useState(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 800px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setBox({ w: rect.width, h: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setNatural(null);
  }, [src]);

  const crop = isMobile ? mobile : desktop;
  let imgStyle = { opacity: 0 };
  if (natural && box && box.w > 0 && box.h > 0) {
    const rect = cropRectFromPosition(
      natural.w,
      natural.h,
      isMobile ? 'mobile' : 'desktop',
      crop.positionX,
      crop.positionY,
      crop.zoom
    );
    const scale = Math.max(box.w / rect.width, box.h / rect.height);
    imgStyle = {
      position: 'absolute',
      left: -rect.left * scale,
      top: -rect.top * scale,
      width: natural.w * scale,
      height: natural.h * scale,
      maxWidth: 'none',
      maxHeight: 'none',
      opacity: 1,
    };
  }

  return (
    <div className="hero-image-box" ref={boxRef}>
      <img
        src={src}
        alt={alt}
        className="hero-image"
        style={imgStyle}
        onLoad={(e) => setNatural({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
      />
    </div>
  );
}
