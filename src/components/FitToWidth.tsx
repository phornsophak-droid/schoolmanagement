/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useLayoutEffect, useRef, useState } from 'react';

interface FitToWidthProps {
  /** The width the child is designed for (px). The child is never scaled up. */
  designWidth: number;
  /** Whether to shrink to fit the available height. Defaults to true for backward compatibility. */
  fitHeight?: boolean;
  children: React.ReactNode;
}

// Shrinks fixed-width content (e.g. an A4 report card / certificate) to fit the
// viewport WITHOUT reflowing it — the layout stays pixel-identical, just zoomed
// out, the way a PDF looks on a phone.
//
// It fits BOTH dimensions so it works in either orientation:
//   • Portrait — usually width-limited: the card fills the screen width and you
//     scroll down (large, readable).
//   • Landscape — usually height-limited: the whole card shrinks to fit on
//     screen at once and is centered (no endless scrolling).
// On wide screens (scale would be ≥ 1) nothing changes.
//
// The transform/sizing is reset for print via the .rc-fit-* classes (see each
// card's print CSS), so PDF / paper output is always full size.
export default function FitToWidth({ designWidth, fitHeight = true, children }: FitToWidthProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ scale: number; w: number | string; h: number | undefined }>({
    scale: 1, w: '100%', h: undefined,
  });

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const update = () => {
      // `outer` stays full width, so it's a stable gauge of the space available.
      const availW = outer.clientWidth;
      // Space from the card's top to the bottom of the viewport (minus the 16px
      // overlay padding). `top` is set by the toolbar above us, not by our own
      // height, so it stays stable as we resize the frame.
      const top = outer.getBoundingClientRect().top;
      const availH = window.innerHeight - top - 16;
      const natH = inner.offsetHeight; // natural (un-scaled) height — transform doesn't change offsetHeight
      
      let s = availW / designWidth;
      if (fitHeight && availH > 40) {
        s = Math.min(s, availH / natH);
      }
      s = Math.min(1, s);

      if (s >= 1) setFit({ scale: 1, w: '100%', h: undefined });
      else setFit({ scale: s, w: Math.ceil(designWidth * s), h: Math.ceil(natH * s) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(inner);
    // A pure rotation can change height without the observed width changing.
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [designWidth]);

  return (
    <div ref={outerRef} className="rc-fit-outer w-full">
      <div
        className="rc-fit-frame"
        style={{ width: fit.w, height: fit.h, margin: '0 auto', overflow: fit.scale < 1 ? 'hidden' : undefined }}
      >
        <div
          ref={innerRef}
          className="rc-fit-inner"
          style={{ width: designWidth, transformOrigin: 'top left', transform: fit.scale < 1 ? `scale(${fit.scale})` : undefined }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
