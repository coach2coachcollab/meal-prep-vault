import { useRef, useState, useCallback, useEffect } from "react";

interface PinchZoomImageProps {
  src: string;
  alt: string;
}

export function PinchZoomImage({ src, alt }: PinchZoomImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  // Pinch state
  const pinchRef = useRef({ startDist: 0, startScale: 1 });
  // Pan state
  const panRef = useRef({ startX: 0, startY: 0, lastX: 0, lastY: 0, panning: false });

  const getDistance = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current.startDist = getDistance(e.touches[0], e.touches[1]);
      pinchRef.current.startScale = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      panRef.current = {
        startX: e.touches[0].clientX - translate.x,
        startY: e.touches[0].clientY - translate.y,
        lastX: translate.x,
        lastY: translate.y,
        panning: true,
      };
    }
  }, [scale, translate]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getDistance(e.touches[0], e.touches[1]);
      const newScale = Math.min(5, Math.max(1, pinchRef.current.startScale * (dist / pinchRef.current.startDist)));
      setScale(newScale);
      if (newScale <= 1) setTranslate({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && panRef.current.panning && scale > 1) {
      const x = e.touches[0].clientX - panRef.current.startX;
      const y = e.touches[0].clientY - panRef.current.startY;
      setTranslate({ x, y });
    }
  }, [scale]);

  const handleTouchEnd = useCallback(() => {
    panRef.current.panning = false;
    if (scale <= 1) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    }
  }, [scale]);

  // Double-tap to zoom
  const lastTap = useRef(0);
  const handleDoubleClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (scale > 1) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    } else {
      setScale(2.5);
    }
  }, [scale]);

  const handleTap = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      handleDoubleClick(e);
    }
    lastTap.current = now;
  }, [handleDoubleClick]);

  // Reset on unmount
  useEffect(() => {
    return () => { setScale(1); setTranslate({ x: 0, y: 0 }); };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden touch-none"
      onTouchStart={(e) => { handleTouchStart(e); handleTap(e); }}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="max-w-full max-h-[90vh] object-contain rounded-lg select-none"
        draggable={false}
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transition: scale === 1 ? "transform 0.2s ease-out" : undefined,
        }}
      />
    </div>
  );
}
