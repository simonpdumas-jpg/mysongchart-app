import React, { useEffect, useLayoutEffect, useState } from 'react';

// Kept separate from App.jsx so the tour is a self-contained overlay: it only
// reads target elements via the data-tour attributes placed on existing UI,
// and never touches the app's own layout, styles, or state beyond the small
// amount of wiring in App.jsx (open/step state + the six data-tour markers).

const STORAGE_KEY = 'mySongChart_hasSeenOnboarding';

export function hasSeenOnboarding() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return true;
  }
}

export function markOnboardingSeen() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // localStorage unavailable (private mode, etc.) - the tour will just
    // re-offer itself next visit, which is an acceptable fallback.
  }
}

export const ONBOARDING_STEPS = [
  {
    target: '[data-tour="lyrics-textarea"]',
    title: 'Paste your lyrics',
    body: "Start here — paste or type your lyrics, with section headers like Verse or Chorus on their own lines.",
    placement: 'right',
  },
  {
    target: '[data-tour="song-info"]',
    title: 'Edit your song info',
    body: "The title, songwriter, and artist are all editable right here — just click and type directly on the chart to change them.",
    placement: 'bottom',
  },
  {
    target: '[data-tour="key-field"]',
    title: 'Set your key',
    body: "Once you set a key, that key's common chords will appear below in “Key Chords” for quick access.",
    placement: 'bottom',
  },
  {
    target: '[data-tour="chord-boxes"]',
    title: 'Add chords to your lyrics',
    body: "Drag a chord onto a box, or just click and type your own — whatever's fastest for you!",
    placement: 'bottom',
  },
  {
    target: '[data-tour="appearance-section"]',
    title: 'Choose a design style',
    body: "Pick how your chart looks — the style and chord color you choose here carry through to your export.",
    placement: 'right',
  },
  {
    target: '[data-tour="export-button"]',
    title: 'Export your chart',
    body: "When you're ready, export a clean PDF or ChordPro file to take with you.",
    placement: 'bottom',
  },
];

const POPOVER_WIDTH = 320;
const POPOVER_MARGIN = 14;
const SPOTLIGHT_PADDING = 8;

// Tracks the current target element's rect, keeping it up to date across
// resize/scroll, and scrolls the target into view (it may be inside one of
// the app's own scrolling columns) when the step changes.
function useTargetRect(selector, isActive) {
  const [rect, setRect] = useState(null);

  useLayoutEffect(() => {
    if (!isActive || !selector) {
      setRect(null);
      return undefined;
    }

    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const el = document.querySelector(selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };

    const el = document.querySelector(selector);
    if (el) {
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    }
    measure();
    // Re-measure once the smooth scroll has likely settled.
    const settleTimer = setTimeout(measure, 350);

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);

    return () => {
      cancelled = true;
      clearTimeout(settleTimer);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [selector, isActive]);

  return rect;
}

function computePopoverStyle(targetRect, preferredPlacement) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const estimatedHeight = 190; // enough room for title/body/footer at this width

  if (!targetRect) {
    // No anchor found (e.g. target not mounted yet) - center on screen
    // rather than failing silently, so the tour never gets visibly stuck.
    return {
      top: Math.max(POPOVER_MARGIN, vh / 2 - estimatedHeight / 2),
      left: Math.max(POPOVER_MARGIN, vw / 2 - POPOVER_WIDTH / 2),
    };
  }

  let top;
  let left;

  if (preferredPlacement === 'right' && targetRect.right + POPOVER_MARGIN + POPOVER_WIDTH <= vw - POPOVER_MARGIN) {
    top = targetRect.top + targetRect.height / 2 - estimatedHeight / 2;
    left = targetRect.right + POPOVER_MARGIN;
  } else if (preferredPlacement === 'left' && targetRect.left - POPOVER_MARGIN - POPOVER_WIDTH >= POPOVER_MARGIN) {
    top = targetRect.top + targetRect.height / 2 - estimatedHeight / 2;
    left = targetRect.left - POPOVER_MARGIN - POPOVER_WIDTH;
  } else if (targetRect.bottom + POPOVER_MARGIN + estimatedHeight <= vh - POPOVER_MARGIN) {
    // bottom (also the fallback when 'right'/'left' don't fit)
    top = targetRect.bottom + POPOVER_MARGIN;
    left = targetRect.left + targetRect.width / 2 - POPOVER_WIDTH / 2;
  } else {
    // top
    top = targetRect.top - POPOVER_MARGIN - estimatedHeight;
    left = targetRect.left + targetRect.width / 2 - POPOVER_WIDTH / 2;
  }

  top = Math.min(Math.max(top, POPOVER_MARGIN), vh - estimatedHeight - POPOVER_MARGIN);
  left = Math.min(Math.max(left, POPOVER_MARGIN), vw - POPOVER_WIDTH - POPOVER_MARGIN);

  return { top, left };
}

export default function OnboardingTour({ isOpen, stepIndex, isLightMode, onNext, onBack, onSkip }) {
  const step = ONBOARDING_STEPS[stepIndex];
  const targetRect = useTargetRect(step?.target, isOpen);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onSkip]);

  if (!isOpen || !step) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;
  const popoverPos = computePopoverStyle(targetRect, step.placement);

  const bg = isLightMode ? '#ffffff' : '#27272a';
  const text = isLightMode ? '#111827' : '#f4f4f5';
  const subtleText = isLightMode ? '#4b5563' : '#a1a1aa';
  const border = isLightMode ? '#e5e7eb' : '#3f3f46';

  return (
    <>
      {/* Full-viewport click blocker so the tour can't be interacted around */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'transparent' }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Spotlight ring + dimmed backdrop (box-shadow spread trick, purely
          decorative - the blocker above already handles interaction). */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            top: targetRect.top - SPOTLIGHT_PADDING,
            left: targetRect.left - SPOTLIGHT_PADDING,
            width: targetRect.width + SPOTLIGHT_PADDING * 2,
            height: targetRect.height + SPOTLIGHT_PADDING * 2,
            borderRadius: '10px',
            boxShadow: '0 0 0 3px #3b82f6, 0 0 0 9999px rgba(0, 0, 0, 0.6)',
            zIndex: 3001,
            pointerEvents: 'none',
            transition: 'top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease',
          }}
        />
      )}
      {!targetRect && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3001, background: 'rgba(0, 0, 0, 0.6)', pointerEvents: 'none' }} />
      )}

      {/* Popover card */}
      <div
        role="dialog"
        aria-label={step.title}
        style={{
          position: 'fixed',
          top: popoverPos.top,
          left: popoverPos.left,
          width: `${POPOVER_WIDTH}px`,
          backgroundColor: bg,
          color: text,
          borderRadius: '10px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
          border: `1px solid ${border}`,
          padding: '18px',
          zIndex: 3002,
          fontFamily: "'Cal Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          boxSizing: 'border-box',
          transition: 'top 0.2s ease, left 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
          <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, lineHeight: '1.25' }}>{step.title}</h3>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Close tutorial"
            title="Close tutorial"
            style={{ background: 'none', border: 'none', color: subtleText, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', padding: '2px 4px', lineHeight: '1', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: '0 0 16px 0', fontSize: '0.9375rem', lineHeight: '1.45', color: subtleText }}>
          {step.body}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <span style={{ fontSize: '0.8125rem', color: subtleText, fontWeight: 600, whiteSpace: 'nowrap' }}>
            Step {stepIndex + 1} of {ONBOARDING_STEPS.length}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onSkip}
              style={{ background: 'none', border: 'none', color: subtleText, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', padding: '4px 2px', textDecoration: 'underline' }}
            >
              Skip
            </button>
            {!isFirst && (
              <button
                type="button"
                onClick={onBack}
                style={{ padding: '6px 12px', backgroundColor: 'transparent', color: text, border: `1px solid ${border}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 700 }}
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={onNext}
              style={{ padding: '6px 14px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 700 }}
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
