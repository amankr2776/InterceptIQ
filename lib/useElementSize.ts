'use client';
// InterceptIQ
import { useEffect, useRef, useState } from 'react';

/**
 * Track an element's rendered size.
 *
 * Maps use this to build a viewBox whose aspect ratio matches the container.
 * A fixed square viewBox letterboxes inside a wide panel — the drawing shrinks
 * to fit the shorter dimension and leaves large empty margins, which is why
 * everything rendered small. Matching the aspect makes the map fill the panel
 * and show more geography instead of blank space.
 */
export function useElementSize<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 1000, h: 1000 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0 && r.height > 0) {
        setSize({ w: r.width, h: r.height });
      }
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}
