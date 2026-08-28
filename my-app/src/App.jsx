import React, { useState, useRef, useEffect } from 'react';
import { DndContext, useDraggable, useDroppable, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
import html2pdf from 'html2pdf.js';
import { SignedIn, SignedOut, SignUpButton, UserButton, useUser, useClerk } from '@clerk/clerk-react';
import OnboardingTour, { ONBOARDING_STEPS, hasSeenOnboarding, markOnboardingSeen } from './Onboarding.jsx';
import { HelpCircle, Compass, Download, Undo2, Redo2 } from 'lucide-react';
import { useSupabaseClient, listCharts, loadChart, saveChart, deleteChart } from './supabaseClient.js';

const LockIcon = ({ size = 12, style = {}, className = "" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
  >
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const SparklesIcon = ({ size = 14, style = {}, className = "" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
  >
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5z" />
    <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
  </svg>
);

// Reads a query param from the current URL without pulling in a router library.
const getQueryParam = (name) => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
};

// Strips a query param from the URL bar without reloading the page,
// so refreshing the page doesn't re-trigger onboarding logic.
const removeQueryParam = (name) => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete(name);
  window.history.replaceState({}, '', url.toString());
};


// --- STRIPE CHECKOUT LINKS ---
const STRIPE_MONTHLY_URL = "https://buy.stripe.com/bJecN6c32g7W8sAbGbbMQ01";
const STRIPE_ANNUAL_URL = "https://buy.stripe.com/fZu00k5EEbRG7owcKfbMQ00";

// Explicit fallback stack used everywhere 'Cal Sans' / 'Jost' is set, so text
// still renders consistently across Chrome/Safari/Firefox if the webfont is
// slow to load or blocked, instead of drifting to each OS's generic default.
const FONT_STACK_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// --- GLOBAL STYLES ---
const globalStyles = `
  /* Force Cal Sans directly on App Brand Headers */
  .brand-title, .header-title {
    font-family: 'Cal Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
    font-weight: 600 !important;
  }

  .pdf-export-mode .drop-zone {
    border-color: transparent !important;
    background-color: transparent !important;
    height: 16px !important; 
    margin-bottom: 0px !important;
    box-shadow: none !important;
  }
  .pdf-export-mode .chord-delete-btn {
    display: none !important;
  }
  .pdf-export-mode .lyric-line {
    margin-bottom: 6px !important; 
  }
  .pdf-export-mode .canvas-word {
    margin-right: 8px !important;
  }
  .pdf-export-mode .word-text {
    font-size: 11pt !important;
  }
  .avoid-break {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .top-action-btn:hover {
    background-color: #10b981 !important;
    color: white !important;
    border-color: #10b981 !important;
  }
  .styled-input::placeholder {
    font-style: italic;
    color: #9ca3af;
    opacity: 0.8;
  }
  .floating-action-btn {
    transition: background-color 0.2s;
  }
  .floating-action-btn:hover:not(:disabled) {
    background-color: rgba(120, 120, 120, 0.2) !important;
  }

  /* Title/Artist/Songwriter editable fields on the chart: invisible until
     hovered/focused so they read as plain text, not form fields. */
  .inline-editable-input {
    border: none;
    border-bottom: 1px solid transparent;
    background-color: transparent;
    outline: none;
    padding: 2px 6px;
    border-radius: 4px;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }
  .inline-editable-input::placeholder {
    color: inherit;
    opacity: 0.45;
  }
  .inline-editable-input:hover {
    background-color: rgba(59, 130, 246, 0.08);
  }
  .inline-editable-input:focus {
    background-color: rgba(59, 130, 246, 0.1);
    border-bottom-color: #3b82f6;
  }

  /* Diagonal Background Watermark for Free Tier Export */
  .watermark-overlay {
    position: absolute;
    top: 140px; /* Positioned right below header divider line */
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
  }

  .watermark-overlay span {
    font-family: 'Cal Sans', ${FONT_STACK_SANS} !important;
    font-size: 78pt;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.08); /* Soft, subtle opacity behind text */
    transform: rotate(-35deg);
    white-space: nowrap;
    user-select: none;
  }

  .chart-content-layer {
    position: relative;
    z-index: 10;
  }

  /* Covers phones through tablet portrait/landscape (iPad portrait ~820px,
     landscape ~1180px stays above this and gets the desktop 3-column
     layout - the fixed-width sidebars don't leave enough room for the
     center canvas column below this width). */
  @media (max-width: 1024px) {
    .app-container {
      flex-direction: column !important;
    }
    .mobile-tab-bar {
      display: flex !important;
    }
    .mobile-hide {
      display: none !important;
    }
    .mobile-show-active {
      display: flex !important;
      flex-direction: column !important;
      width: 100% !important;
      flex: 1 !important;
    }
    .column-center {
      padding: 20px !important;
    }
    .mobile-resizer {
      display: none !important;
    }
    .mobile-desktop-banner {
      display: flex !important;
    }
    .top-header-bar {
      padding: 10px 12px !important;
    }
    .header-controls {
      gap: 6px !important;
    }
  }
`;


// --- THEME ENGINE ---
const getStyles = (isLight, pdfTheme) => {
  let canvasFont = `'Cal Sans', ${FONT_STACK_SANS}`;
  let titleFont = `'Cal Sans', ${FONT_STACK_SANS}`;
  let spacingStyle = {};

  if (pdfTheme === 'classic-studio') {
    canvasFont = "'Roboto Mono', 'SFMono-Regular', Consolas, 'Courier New', Courier, monospace";
    titleFont = "'Roboto Mono', 'SFMono-Regular', Consolas, 'Courier New', Courier, monospace";
  } else if (pdfTheme === 'real-book') {
    canvasFont = "'Architects Daughter', 'Caveat', cursive";
    titleFont = "'Architects Daughter', 'Caveat', cursive";
  } else if (pdfTheme === 'elegance') {
    canvasFont = "'Lora', Georgia, 'Times New Roman', serif";
    titleFont = "'Lora', Georgia, 'Times New Roman', serif";
  } else if (pdfTheme === 'minimalist') {
    canvasFont = `'Jost', ${FONT_STACK_SANS}`;
    titleFont = `'Jost', ${FONT_STACK_SANS}`;
    spacingStyle = {
      marginRight: '6px',
      marginBottom: '4px',
    };
  } else {
    // default: modern
    canvasFont = `'Cal Sans', ${FONT_STACK_SANS}`;
    titleFont = `'Cal Sans', ${FONT_STACK_SANS}`;
  }

  return {
    container: { display: 'flex', flexDirection: 'column', height: '100vh', maxHeight: '100vh', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}`, backgroundColor: isLight ? '#f3f4f6' : '#18181b', color: isLight ? '#1f2937' : '#e4e4e7', transition: 'all 0.3s' },
    topHeaderBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, padding: '10px 24px', gap: '12px', borderBottom: `1px solid ${isLight ? '#e5e7eb' : '#27272a'}`, backgroundColor: isLight ? '#ffffff' : '#18181b' },
    columnLeft: { padding: '24px', borderRight: `1px solid ${isLight ? '#e5e7eb' : '#27272a'}`, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, boxSizing: 'border-box', backgroundColor: isLight ? '#ffffff' : '#18181b', overflowY: 'auto' },
    columnCenter: { flex: 1, minWidth: 0, height: '100%', minHeight: 0, boxSizing: 'border-box', paddingTop: '24px', paddingRight: '28px', paddingBottom: '36px', paddingLeft: '28px', overflowY: 'auto', backgroundColor: isLight ? '#ffffff' : '#09090b', fontFamily: canvasFont, position: 'relative' },
    columnRight: { padding: '24px', height: '100%', minHeight: 0, boxSizing: 'border-box', borderLeft: `1px solid ${isLight ? '#e5e7eb' : '#27272a'}`, backgroundColor: isLight ? '#ffffff' : '#18181b', overflowY: 'auto' },
    header: { marginTop: 0, fontSize: '1.375rem', fontWeight: '600', color: isLight ? '#111827' : '#f4f4f5', letterSpacing: '-0.5px', marginBottom: '16px', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` },
    subHeader: { fontSize: '1rem', fontWeight: '600', color: isLight ? '#6b7280' : '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', marginTop: '16px', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` },
    label: { fontSize: '0.9375rem', color: isLight ? '#4b5563' : '#a1a1aa', marginBottom: '4px', display: 'block', fontWeight: '500', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}`, textWrap: 'balance' },
    input: { width: '100%', boxSizing: 'border-box', marginBottom: '10px', padding: '10px', borderRadius: '6px', border: `1px solid ${isLight ? '#d1d5db' : '#3f3f46'}`, backgroundColor: isLight ? '#f9fafb' : '#27272a', color: isLight ? '#111827' : '#f4f4f5', fontSize: '1rem', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` },
    textArea: { width: '100%', boxSizing: 'border-box', display: 'block', flex: '1 1 auto', minHeight: '140px', padding: '12px', borderRadius: '6px', border: `1px solid ${isLight ? '#d1d5db' : '#3f3f46'}`, backgroundColor: isLight ? '#f9fafb' : '#27272a', color: isLight ? '#111827' : '#f4f4f5', fontSize: '1rem', resize: 'vertical', lineHeight: '1.5', fontFamily: "'Courier New', Courier, monospace" },
    button: { width: '100%', padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem', fontWeight: '600', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` },
    actionButton: { padding: '8px 12px', whiteSpace: 'nowrap', backgroundColor: isLight ? '#ffffff' : '#27272a', color: isLight ? '#374151' : '#e4e4e7', border: `1px solid ${isLight ? '#d1d5db' : '#3f3f46'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.9375rem', fontWeight: '600', transition: 'all 0.2s', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` },
    builderRow: { display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' },
    miniBtnActive: { flex: 1, minWidth: '32px', padding: '8px 4px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 'bold', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` },
    miniBtnInactive: { flex: 1, minWidth: '32px', padding: '8px 4px', backgroundColor: isLight ? '#f9fafb' : '#27272a', color: isLight ? '#4b5563' : '#a1a1aa', border: `1px solid ${isLight ? '#d1d5db' : '#3f3f46'}`, borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 'bold', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` },
    addBtn: { padding: '8px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9375rem', fontWeight: 'bold', width: '100%', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` },
    chordToken: { display: 'inline-flex', alignItems: 'center', padding: '6px 10px', margin: '4px', backgroundColor: '#2563eb', color: 'white', borderRadius: '6px', cursor: 'grab', fontWeight: 'bold', fontSize: '1rem', userSelect: 'none', gap: '6px', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` },
    lyricLine: { display: 'flex', flexWrap: 'wrap', width: '100%', marginBottom: pdfTheme === 'minimalist' ? '6px' : '11px', pageBreakInside: 'avoid', breakInside: 'avoid' },
    canvasWord: { display: 'inline-flex', flexDirection: 'column', margin: pdfTheme === 'minimalist' ? '0 8px 0 0' : '0 13px 0 0', minWidth: '24px', cursor: 'pointer', pageBreakInside: 'avoid', breakInside: 'avoid', ...spacingStyle },
    dropZone: { height: pdfTheme === 'minimalist' ? '27px' : '32px', width: '100%', minWidth: '24px', borderRadius: '4px', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '2px', transition: 'all 0.1s' },
    wordText: { fontSize: pdfTheme === 'minimalist' ? '1.0625rem' : '1.25rem', color: isLight ? '#111827' : '#e4e4e7', whiteSpace: 'pre', fontFamily: canvasFont, fontWeight: 400 },
    // clamp() scales the title down smoothly as the viewport narrows
    // (below ~520px wide it's shrinking; above that it's the full desktop
    // size) rather than clipping at a fixed 2.125rem - textOverflow/nowrap
    // below is the fallback for whatever's still too long even at the
    // clamped minimum, so long titles truncate with "..." instead of just
    // silently disappearing off the edge of the <input> (which can't wrap).
    songTitleStyle: { margin: '0 auto 4px auto', fontSize: 'clamp(1.25rem, 6.5vw, 2.125rem)', lineHeight: '1.15', textAlign: 'center', color: isLight ? '#111827' : '#f4f4f5', fontFamily: titleFont, fontWeight: 700, maxWidth: '600px', textWrap: 'balance', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' },
  };
};

const transposeString = (chord, steps, preferFlats = null) => {
  if (!chord) return chord;
  if (steps === 0 && preferFlats === null) return chord;
  const sharps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const flats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  return chord.replace(/[A-G][#b]?/g, (match) => {
    let index = sharps.indexOf(match);
    let wasFlat = false;
    if (index === -1) {
      index = flats.indexOf(match);
      wasFlat = true;
    }
    if (index === -1) return match;

    let newIndex = (index + steps) % 12;
    if (newIndex < 0) newIndex += 12;

    const useFlat = preferFlats !== null ? preferFlats : wasFlat;
    return useFlat ? flats[newIndex] : sharps[newIndex];
  });
};

const transposeStoredChord = (chord, steps, preferFlats = null) => {
  if (!chord || steps === 0) return chord;
  const { root, suffix, slash } = parseChordInputString(chord);

  const transposedRoot = transposeString(root, steps, preferFlats);
  let transposedSlash = '';
  if (slash && slash !== '/') {
    const slashRoot = parseSlashRoot(slash);
    transposedSlash = '/' + transposeString(slashRoot, steps, preferFlats);
  } else if (slash === '/') {
    transposedSlash = '/';
  }

  return transposedRoot + suffix + transposedSlash;
};

const getSemitoneDifference = (oldKey, newKey) => {
  if (!oldKey || !newKey) return 0;
  
  const cleanOld = oldKey.trim().replace(/m$/, '');
  const cleanNew = newKey.trim().replace(/m$/, '');

  const sharps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const flats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  let oldIdx = sharps.indexOf(cleanOld);
  if (oldIdx === -1) oldIdx = flats.indexOf(cleanOld);

  let newIdx = sharps.indexOf(cleanNew);
  if (newIdx === -1) newIdx = flats.indexOf(cleanNew);

  if (oldIdx === -1 || newIdx === -1) return 0;

  let diff = (newIdx - oldIdx) % 12;
  if (diff < -6) diff += 12;
  if (diff > 6) diff -= 12;
  return diff;
};

const parseChordInputString = (inputStr) => {
  if (!inputStr) return { root: '', suffix: '', slash: '' };

  // Break into main part and optional slash bass part
  let mainPart = inputStr;
  let slash = '';
  const slashIdx = inputStr.indexOf('/');
  if (slashIdx !== -1) {
    mainPart = inputStr.substring(0, slashIdx);
    slash = inputStr.substring(slashIdx); // e.g. "/B"
  }

  // Extract root note / degree from mainPart
  let root = '';
  let suffix = '';

  // 1. Try Roman Numerals (e.g., biii, bii, #iv, etc.)
  const romanMatch = mainPart.match(/^([b#]?(?:iii|III|ii|II|iv|IV|vii|VII|vi|VI|v|V|i|I))/);
  if (romanMatch) {
    root = romanMatch[1];
    suffix = mainPart.substring(root.length);
  } else {
    // 2. Try Solfège (case-insensitive)
    const solfegeMatch = mainPart.match(/^(Sol|Do|Ra|Re|Me|Mi|Fa|Se|Le|La|Te|Ti)/i);
    if (solfegeMatch) {
      root = solfegeMatch[1];
      suffix = mainPart.substring(root.length);
    } else {
      // 3. Try Numbers
      const numbersMatch = mainPart.match(/^([b#]?[1-7])/);
      if (numbersMatch) {
        root = numbersMatch[1];
        suffix = mainPart.substring(root.length);
      } else {
        // 4. Try Letters
        const letterMatch = mainPart.match(/^([A-G][#b]?)/);
        if (letterMatch) {
          root = letterMatch[1];
          suffix = mainPart.substring(root.length);
        } else {
          // Fallback if no match
          root = mainPart;
          suffix = '';
        }
      }
    }
  }

  // Normalize suffix
  let normalizedSuffix = suffix;
  if (normalizedSuffix === 'M7' || normalizedSuffix === 'MAJ7') {
    normalizedSuffix = 'maj7';
  } else if (normalizedSuffix === 'min7') {
    normalizedSuffix = 'm7';
  } else if (normalizedSuffix === 'sus') {
    normalizedSuffix = 'sus4';
  }

  return { root, suffix: normalizedSuffix, slash };
};

// Renders a chord/scale-degree string (e.g. "G7", "5m7", "vi7", "Sol7") with
// its quality/extension suffix set smaller and raised, standard chord-chart
// notation - and disambiguates e.g. Numbers-mode "5" + "7" from misreading
// as "57". parseChordInputString already auto-detects root vs suffix across
// all four display formats (Roman/Solfège/Numbers/Letters), so it doubles as
// a generic splitter for any already-formatted chord display string.
//
// Plain minor ("m" with nothing else) reads as a basic triad quality, same
// as an unmarked major, so it stays full-size and inline - not superscript.
// A leading 'm' combined with a real extension (m7, m9, ...) still splits:
// the 'm' stays inline with the root, only the extension after it is raised
// (e.g. "Am7" -> "Am" full-size + a small raised "7"). Everything else -
// 7, maj7, sus2, sus4, dim, aug, 9, 11, etc. - is a genuine quality/extension
// beyond a basic major/minor triad and is superscripted in full. Same
// startsWith('m') && !startsWith('maj') test formatChordDisplay already uses
// to detect a minor suffix, reused here for consistency.
const ChordLabel = ({ text }) => {
  if (!text) return null;
  const { root, suffix, slash } = parseChordInputString(text);
  const isMinorPrefixed = suffix.startsWith('m') && !suffix.startsWith('maj');
  const inlineSuffix = isMinorPrefixed ? 'm' : '';
  const superSuffix = isMinorPrefixed ? suffix.substring(1) : suffix;
  return (
    <>
      {root}
      {inlineSuffix}
      {superSuffix && <sup style={{ fontSize: '0.65em' }}>{superSuffix}</sup>}
      {slash}
    </>
  );
};

const parseSlashRoot = (slashStr) => {
  if (!slashStr || slashStr === '/') return '';
  return slashStr.startsWith('/') ? slashStr.substring(1) : slashStr;
};

const convertRootToStandardLetter = (rootStr, currentKey, transSteps, preferFlats = null) => {
  if (!rootStr) return { note: '', isMinorRoman: false };

  const sharps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const flats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  let cleanKey = (currentKey || 'G').trim();
  let isMinorKey = cleanKey.endsWith('m');
  let keyRoot = cleanKey.replace(/m$/, '');

  let rootIndex = sharps.indexOf(keyRoot);
  if (rootIndex === -1) rootIndex = flats.indexOf(keyRoot);
  if (rootIndex === -1) rootIndex = 0;

  let calcIndex = rootIndex;
  if (isMinorKey) {
    calcIndex = (rootIndex + 3) % 12;
  }

  const defaultUseFlats = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm'].includes(cleanKey);
  const useFlats = preferFlats !== null ? preferFlats : defaultUseFlats;
  const scale = useFlats ? flats : sharps;
  const getNoteFromIndex = (idx) => scale[(idx + 12) % 12];

  // 1. Try Roman
  const romanMap = {
    'i': 0, 'bii': 1, '#i': 1, 'ii': 2, 'biii': 3, '#ii': 3, 'iii': 4, 'iv': 5, '#iv': 6, 'bv': 6, 'v': 7, 'bvi': 8, '#v': 8, 'vi': 9, 'bvii': 10, '#vi': 10, 'vii': 11
  };
  const lowerRoot = rootStr.toLowerCase();
  if (romanMap[lowerRoot] !== undefined) {
    const interval = romanMap[lowerRoot];
    let noteIndex = (rootIndex + interval) % 12;
    let standardLetter = getNoteFromIndex(noteIndex);
    return { note: standardLetter, isMinorRoman: rootStr === lowerRoot };
  }

  // 2. Try Solfege
  const solfegeMap = {
    'do': 0, 'ra': 1, 're': 2, 'me': 3, 'mi': 4, 'fa': 5, 'se': 6, 'sol': 7, 'le': 8, 'la': 9, 'te': 10, 'ti': 11
  };
  if (solfegeMap[lowerRoot] !== undefined) {
    const interval = solfegeMap[lowerRoot];
    let noteIndex = (calcIndex + interval) % 12;
    return { note: getNoteFromIndex(noteIndex), isMinorRoman: false };
  }

  // 3. Try Numbers
  const numbersMap = {
    '1': 0, '#1': 1, 'b2': 1, '2': 2, '#2': 3, 'b3': 3, '3': 4, '4': 5, '#4': 6, 'b5': 6, '5': 7, '#5': 8, 'b6': 8, '6': 9, '#6': 10, 'b7': 10, '7': 11
  };
  if (numbersMap[rootStr] !== undefined) {
    const interval = numbersMap[rootStr];
    let noteIndex = (calcIndex + interval) % 12;
    return { note: getNoteFromIndex(noteIndex), isMinorRoman: false };
  }

  // 4. Try Letters
  let noteIndex = sharps.indexOf(rootStr);
  if (noteIndex === -1) noteIndex = flats.indexOf(rootStr);
  if (noteIndex !== -1) {
    let untransposedIndex = (noteIndex - transSteps + 12) % 12;
    return { note: getNoteFromIndex(untransposedIndex), isMinorRoman: false };
  }

  return { note: rootStr, isMinorRoman: false };
};

const formatRootDisplay = (root, currentKey, format, suffix) => {
  if (!root) return '';

  const sharps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const flats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  let cleanKey = (currentKey || 'G').trim();
  let isMinorKey = cleanKey.endsWith('m');
  let keyRoot = cleanKey.replace(/m$/, '');

  let rootIndex = sharps.indexOf(keyRoot);
  if (rootIndex === -1) rootIndex = flats.indexOf(keyRoot);
  if (rootIndex === -1) rootIndex = 0;

  let calcIndex = rootIndex;
  if ((format === 'numbers' || format === 'solfege') && isMinorKey) {
    calcIndex = (rootIndex + 3) % 12;
  }

  const numbers = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
  const solfege = ['Do', 'Ra', 'Re', 'Me', 'Mi', 'Fa', 'Se', 'Sol', 'Le', 'La', 'Te', 'Ti'];

  let noteIndex = sharps.indexOf(root);
  if (noteIndex === -1) noteIndex = flats.indexOf(root);
  if (noteIndex === -1) return root;

  let isMinorChord = suffix && suffix.startsWith('m') && !suffix.startsWith('maj');
  let isDim = suffix && suffix.startsWith('dim');

  if (format === 'roman') {
    let interval = (noteIndex - rootIndex + 12) % 12;
    let base = '';
    
    if (isMinorKey) {
      const minMap = {0: 'I', 1: 'bII', 2: 'II', 3: 'III', 4: '#III', 5: 'IV', 6: 'bV', 7: 'V', 8: 'VI', 9: '#VI', 10: 'VII', 11: '#VII'};
      base = minMap[interval];
    } else {
      const majMap = {0: 'I', 1: 'bII', 2: 'II', 3: 'bIII', 4: 'III', 5: 'IV', 6: 'bV', 7: 'V', 8: 'bVI', 9: 'VI', 10: 'bVII', 11: 'VII'};
      base = majMap[interval];
    }

    if (isMinorChord || isDim) {
      base = base.toLowerCase();
    }
    
    return base;
  } else {
    let interval = (noteIndex - calcIndex + 12) % 12;
    let arr = format === 'numbers' ? numbers : solfege;
    return arr[interval];
  }
};

const formatChordDisplay = (originalChord, currentKey, transSteps, format, preferFlats = null) => {
  if (!originalChord) return originalChord;

  if (format === 'letters') {
    return transposeString(originalChord, transSteps, preferFlats);
  }

  const { root, suffix, slash } = parseChordInputString(originalChord);

  let displayRoot = formatRootDisplay(root, currentKey, format, suffix);
  let displaySuffix = suffix;

  if (format === 'roman') {
    let isMinorChord = suffix.startsWith('m') && !suffix.startsWith('maj');
    if (isMinorChord) {
      displaySuffix = suffix.substring(1);
    }
  }

  let displaySlash = '';
  if (slash && slash !== '/') {
    const slashRoot = parseSlashRoot(slash);
    const formattedSlashRoot = formatRootDisplay(slashRoot, currentKey, format, '');
    displaySlash = '/' + formattedSlashRoot;
  } else if (slash === '/') {
    displaySlash = '/';
  }

  return displayRoot + displaySuffix + displaySlash;
};

const parseChordStringToStandardLetter = (inputStr, currentKey, transSteps, _currentFormat, preferFlats = null) => {
  if (!inputStr) return inputStr;

  const { root, suffix, slash } = parseChordInputString(inputStr);

  const parsedRoot = convertRootToStandardLetter(root, currentKey, transSteps, preferFlats);
  let mainNote = parsedRoot.note;
  let finalSuffix = suffix;

  if (parsedRoot.isMinorRoman) {
    if (!finalSuffix.startsWith('m') && !finalSuffix.startsWith('dim') && !finalSuffix.startsWith('maj')) {
      finalSuffix = 'm' + finalSuffix;
    }
  }

  let finalSlash = '';
  if (slash && slash !== '/') {
    const slashRoot = parseSlashRoot(slash);
    const parsedSlash = convertRootToStandardLetter(slashRoot, currentKey, transSteps, preferFlats);
    finalSlash = '/' + parsedSlash.note;
  } else if (slash === '/') {
    finalSlash = '/';
  }

  return mainNote + finalSuffix + finalSlash;
};

// Determines whether a key's diatonic/derived chords should default to flat
// spelling (e.g. Eb, Bbm) vs sharp (e.g. C#, F#m), absent any explicit override.
const getKeyDefaultPrefersFlats = (keyInput) => {
  const cleanKey = (keyInput || 'G').trim();
  const root = cleanKey.replace(/m$/, '');

  const sharps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const flats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  let useFlats = sharps.indexOf(root) === -1 && flats.indexOf(root) !== -1;

  if (['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm'].includes(cleanKey)) {
    useFlats = true;
  }

  return useFlats;
};

const getScaleChords = (keyInput, preferFlatsOverride = null) => {
  const cleanKey = (keyInput || 'G').trim();
  const isMinor = cleanKey.endsWith('m');
  const root = cleanKey.replace(/m$/, '');

  const sharps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const flats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  let rootIndex = sharps.indexOf(root);
  if (rootIndex === -1) rootIndex = flats.indexOf(root);
  if (rootIndex === -1) rootIndex = 7;

  let useFlats = preferFlatsOverride !== null ? preferFlatsOverride : getKeyDefaultPrefersFlats(keyInput);

  const scale = useFlats ? flats : sharps;
  const intervals = isMinor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const qualities = isMinor ? ['m', 'dim', '', 'm', 'm', '', ''] : ['', 'm', 'm', '', '', 'm', 'dim'];

  return intervals.map((interval, i) => {
    const noteIndex = (rootIndex + interval) % 12;
    return scale[noteIndex] + qualities[i];
  });
};

// --- CHORDPRO FORMATTING ENGINE ---
const generateChordProText = ({ songTitle, artist, composer, songKey, capo, transSteps, displayFormat, lyricLines, chordMap }) => {
  let output = [];

  if (songTitle && songTitle.trim() !== '') output.push(`{title: ${songTitle.trim()}}`);
  if (artist && artist.trim() !== '') output.push(`{artist: ${artist.trim()}}`);
  if (composer && composer.trim() !== '') output.push(`{composer: ${composer.trim()}}`);
  
  const activeKey = transposeString(songKey || "G", transSteps);
  if (activeKey && activeKey.trim() !== '') output.push(`{key: ${activeKey.trim()}}`);
  if (capo && capo !== "0" && capo.trim() !== '') output.push(`{capo: ${capo.trim()}}`);
  
  output.push('');

  lyricLines.forEach(line => {
    if (line.isSpacer) {
      output.push('');
    } else if (line.isHeader) {
      output.push(`{comment: ${line.text}}`);
    } else if (line.words && line.words.length > 0) {
      // Check if this line is purely beat spaces (e.g. only contains empty beat spaces '_' or chords)
      const hasActualLyrics = line.words.some(w => w.text !== '_');

      if (!hasActualLyrics) {
        // Standalone chord line: write as space-separated bracketed chords
        let standaloneParts = [];
        line.words.forEach(w => {
          const originalChord = chordMap[w.id];
          const displayChord = formatChordDisplay(originalChord, songKey, transSteps, displayFormat);
          if (displayChord) {
            standaloneParts.push(`[${displayChord}]`);
          }
        });
        if (standaloneParts.length > 0) {
          output.push(standaloneParts.join(' '));
        }
      } else {
        // Standard inline chord formatting: [G]Words go [C]here
        let lineText = '';
        line.words.forEach(w => {
          const originalChord = chordMap[w.id];
          const displayChord = formatChordDisplay(originalChord, songKey, transSteps, displayFormat);
          
          if (displayChord) {
            lineText += `[${displayChord}]`;
          }
          
          if (w.text !== '_') {
            lineText += w.text + ' ';
          }
        });
        output.push(lineText.trimEnd());
      }
    }
  });

  return output.join('\n');
};

function DraggableChord({ id, text, baseText, onDelete, isCustom, onChordClick }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 100, cursor: 'grabbing', opacity: 0.8 } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ ...getStyles(false, 'modern').chordToken, ...style }}
      {...listeners}
      {...attributes}
      onPointerUp={(e) => {
        // dnd-kit's PointerSensor calls preventDefault() on pointerdown, which
        // suppresses the native click event entirely — so click-to-assign has
        // to hook pointerup instead. `transform` becomes a {x:0,y:0,...}
        // object the instant a drag activates (even before any movement), so
        // a real click is one where it's either unset or reports zero delta.
        // Deliberately not calling stopPropagation here: dnd-kit's own
        // PointerSensor listens for pointerup on `document`, and stopping
        // propagation would keep the native event from ever reaching it,
        // leaving its internal drag session stuck "active" and silently
        // swallowing every click elsewhere on the page afterward.
        if (e.target.closest('.chord-delete-btn')) return;
        const noMovement = !transform || (transform.x === 0 && transform.y === 0);
        if (noMovement) {
          onChordClick?.(id);
        }
      }}
    >
      <span><ChordLabel text={text} /></span>
      {isCustom && (
        <button
          type="button"
          className="chord-delete-btn"
          // Native click never fires here for the same reason noted above
          // (dnd-kit's preventDefault on pointerdown applies to the whole
          // draggable, including this nested button), so delete happens on
          // pointerup too. onClick is kept for keyboard activation (Enter/
          // Space), which doesn't go through a pointerdown at all.
          onClick={(e) => { e.stopPropagation(); onDelete(baseText || text); }}
          onPointerUp={() => onDelete(baseText || text)}
          style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', padding: '0 2px' }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function DraggableCanvasChord({ wordId, text, isLight, pdfTheme, onFocus, chordAccentColor, isPro }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `canvas-${wordId}`,
    data: { type: 'canvas', sourceWordId: wordId }
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 100, cursor: 'grabbing', opacity: 0.8 } : undefined;
  
  // Free users default to Black/Onyx in light mode, White in dark mode (so
  // chords stay legible against either background). Pro users use their
  // selected chordAccentColor, which itself defaults the same way.
  let chordColor = isPro ? chordAccentColor : (isLight ? '#111827' : '#ffffff');

  let fontStyle = `'Cal Sans', ${FONT_STACK_SANS}`;
  if (pdfTheme === 'classic-studio') fontStyle = "'Roboto Mono', 'SFMono-Regular', Consolas, 'Courier New', Courier, monospace";
  if (pdfTheme === 'real-book') fontStyle = "'Architects Daughter', 'Caveat', cursive";
  if (pdfTheme === 'elegance') fontStyle = "'Lora', Georgia, 'Times New Roman', serif";
  if (pdfTheme === 'minimalist') fontStyle = `'Jost', ${FONT_STACK_SANS}`;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onPointerDown={(e) => {
        onFocus(wordId);
        if (listeners?.onPointerDown) listeners.onPointerDown(e);
      }}
      style={{ ...style, color: chordColor, fontSize: pdfTheme === 'minimalist' ? '1.125rem' : '1.375rem', fontWeight: 700, fontFamily: fontStyle }}
    >
      <ChordLabel text={text} />
    </div>
  );
}

function DroppableWord({ id, word, assignedChord, isLight, pdfTheme, isFocused, isSelected, onFocus, isBold, isItalic, isUnderline, chordAccentColor, isPro }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const styles = getStyles(isLight, pdfTheme);
  const isEmptyBeat = word === '_';

  const highlight = isOver || isFocused || isSelected;
  const activeBg = isFocused || isSelected;

  const dropZoneStyle = {
    ...styles.dropZone,
    border: `2px ${isSelected ? 'solid' : 'dashed'} ${highlight ? '#3b82f6' : (isLight ? '#d1d5db' : '#3f3f46')}`,
    backgroundColor: isOver ? (isLight ? '#f3f4f6' : '#27272a') : (activeBg ? (isLight ? '#e0f2fe' : '#1e3a8a') : 'transparent'),
    boxShadow: activeBg ? '0 0 0 2px rgba(59, 130, 246, 0.4)' : 'none'
  };

  const inputRef = useRef(null);

  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFocused]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    
    if (val === '') {
      // Backspace pressed
      const event = new KeyboardEvent('keydown', {
        key: 'Backspace',
        bubbles: true,
        cancelable: true
      });
      window.dispatchEvent(event);
    } else if (val === '  ') {
      // Space pressed
      const event = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
        cancelable: true
      });
      window.dispatchEvent(event);
    } else if (val.length > 1) {
      const char = val.slice(1);
      if (/^[a-zA-Z0-9#/+\-()]$/.test(char)) {
        const event = new KeyboardEvent('keydown', {
          key: char,
          bubbles: true,
          cancelable: true
        });
        window.dispatchEvent(event);
      } else if (char === '\n') {
        const event = new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true
        });
        window.dispatchEvent(event);
      }
    }
    
    if (inputRef.current) {
      inputRef.current.value = ' ';
    }
  };

  const handleInputKeyDown = (e) => {
    // If we type some standard special non-character key that isn't handled by onChange,
    // like Enter or Escape, we can let them bubble, but just to be safe, we can handle them
    if (e.key === 'Enter') {
      e.preventDefault();
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true
      });
      window.dispatchEvent(event);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true
      });
      window.dispatchEvent(event);
    }
  };

  return (
    <div className="canvas-word avoid-break" style={{ ...styles.canvasWord, position: 'relative' }} onClick={(e) => { e.stopPropagation(); onFocus(id); }}>
      {isFocused && (
        <input
          ref={inputRef}
          type="text"
          defaultValue=" "
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck="false"
          style={{
            position: 'absolute',
            opacity: 0,
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            padding: 0,
            margin: 0,
            border: 'none',
            outline: 'none',
            zIndex: 10,
            cursor: 'pointer',
            background: 'transparent'
          }}
        />
      )}
      <div ref={setNodeRef} className="drop-zone" style={dropZoneStyle}>
        {assignedChord && (
          <DraggableCanvasChord 
            wordId={id} 
            text={assignedChord} 
            isLight={isLight} 
            pdfTheme={pdfTheme} 
            onFocus={onFocus} 
            chordAccentColor={chordAccentColor}
            isPro={isPro}
          />
        )}
      </div>
      {/* font-weight: bold and font-style: italic alone silently do nothing
          on several of this app's theme fonts (Cal Sans ships only one
          static 600 weight and no italic; Architects Daughter only 400,
          no italic either - confirmed via their actual @font-face
          declarations) - the browser has no bold/italic face to select
          and font-synthesis is disabled globally (index.css) for
          cross-browser consistency anyway. -webkit-text-stroke and a
          manual skew both fake the effect directly at the glyph level
          regardless of which faces the active theme's font actually has,
          so Cmd+B / Cmd+I reliably render visibly across every theme.
          text-decoration (underline) isn't a font-style variant, so it
          doesn't have this problem and needs no workaround. */}
      <div className="word-text" style={{...styles.wordText, color: isEmptyBeat ? 'transparent' : (isLight ? '#111827' : '#e4e4e7'), fontWeight: isBold ? 'bold' : undefined, WebkitTextStroke: isBold ? '0.6px currentColor' : undefined, transform: isItalic ? 'skewX(-12deg)' : undefined, textDecoration: isUnderline ? 'underline' : undefined}}>
        {isEmptyBeat ? '_' : word}
      </div>
    </div>
  );
}

// Canonical value is always the sharp spelling (matching the app's internal
// storage convention); the label shows both spellings so it reads fine
// regardless of the sharp/flat preference used elsewhere in the UI.
const KEY_OPTIONS = [
  { value: 'A', label: 'A' },
  { value: 'A#', label: 'A#/Bb' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'C#', label: 'C#/Db' },
  { value: 'D', label: 'D' },
  { value: 'D#', label: 'D#/Eb' },
  { value: 'E', label: 'E' },
  { value: 'F', label: 'F' },
  { value: 'F#', label: 'F#/Gb' },
  { value: 'G', label: 'G' },
  { value: 'G#', label: 'G#/Ab' },
];

const kbdStyle = (isLight) => ({
  backgroundColor: isLight ? '#f1f5f9' : '#334155',
  color: isLight ? '#0f172a' : '#f8fafc',
  padding: '2px 6px',
  borderRadius: '4px',
  border: `1px solid ${isLight ? '#cbd5e1' : '#475569'}`,
  fontSize: '0.8125rem',
  fontFamily: 'monospace',
  fontWeight: 'bold',
});

// A text input that looks like plain text until the user hovers/focuses it,
// then reveals normal editable-field chrome (Notion/Google Docs style title
// editing). Typography (font/size/color/alignment) is passed in via `style`
// so it matches whatever it's replacing; interactive chrome (background/
// border on hover/focus) lives in the `.inline-editable-input` CSS class in
// globalStyles, since inline styles can't express :hover/:focus.
function InlineEditableField({ value, onChange, placeholder, ariaLabel, style, autoSize }) {
  // The HTML `size` attribute (not a CSS width) sizes a text input to N
  // characters intrinsically, identically across Chrome/Safari/Firefox, so
  // short fields (e.g. "Starship") don't render as a wide guessed box and
  // long ones (e.g. a full songwriter credit line) don't get clipped.
  const sizeAttr = autoSize ? Math.max((value || placeholder || '').length, 3) : undefined;

  return (
    <input
      type="text"
      className="inline-editable-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoComplete="off"
      size={sizeAttr}
      style={style}
    />
  );
}

export default function App() {
  const { user, isSignedIn } = useUser();
  const { openSignUp, openSignIn } = useClerk();

  // Track whether we've detected a ?session_id= param from a Stripe redirect,
  // so we know to auto-prompt sign-up and verify the purchase once authenticated.
  const [pendingCheckoutSessionId, setPendingCheckoutSessionId] = useState(() => getQueryParam('session_id'));


  const [isLightMode, setIsLightMode] = useState(true);
  const [activeMobileTab, setActiveMobileTab] = useState('chart');
  const [showMobileDesktopNotice, setShowMobileDesktopNotice] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('mySongChart_dismissedMobileNotice') !== 'true';
  });

  const dismissMobileDesktopNotice = () => {
    setShowMobileDesktopNotice(false);
    localStorage.setItem('mySongChart_dismissedMobileNotice', 'true');
  };


  const pointerSensor = useSensor(PointerSensor);
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200,
      tolerance: 6,
    },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  const [selectedWordIds, setSelectedWordIds] = useState([]);
  const [pdfTheme, setPdfTheme] = useState('modern');
  const [displayFormat, setDisplayFormat] = useState('letters');
  const [chordAccentColor, setChordAccentColor] = useState('#111827');
  const [showPreview, setShowPreview] = useState(false);
  
  const [isPro, setIsPro] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [pendingKeyChange, setPendingKeyChange] = useState(null);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  const supabase = useSupabaseClient();
  const [showChartsModal, setShowChartsModal] = useState(false);
  const [currentChartId, setCurrentChartId] = useState(null);
  const [savedCharts, setSavedCharts] = useState([]);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [chartsError, setChartsError] = useState(null);
  const [isSavingChart, setIsSavingChart] = useState(false);
  const [chartSavedNotice, setChartSavedNotice] = useState(false);

  useEffect(() => {
    if (!hasSeenOnboarding()) {
      setShowOnboarding(true);
    }
  }, []);

  const startOnboarding = () => {
    setOnboardingStep(0);
    setShowOnboarding(true);
  };

  const closeOnboarding = () => {
    setShowOnboarding(false);
    markOnboardingSeen();
  };

  // Column Resizing State (in pixels)
  const [leftWidth, setLeftWidth] = useState(380);
  const [rightWidth, setRightWidth] = useState(400);

  const handleMouseDownLeft = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;

    const handleMouseMove = (moveEvent) => {
      const newWidth = Math.min(Math.max(startWidth + (moveEvent.clientX - startX), 180), 1000);
      setLeftWidth(newWidth);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseDownRight = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;

    const handleMouseMove = (moveEvent) => {
      // Safe minimum limit (260px) keeps headers and buttons cleanly separated
      const newWidth = Math.min(Math.max(startWidth - (moveEvent.clientX - startX), 260), 1000);
      setRightWidth(newWidth);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const styles = getStyles(isLightMode, pdfTheme);
  const fileInputRef = useRef(null);
  const lyricsTextareaRef = useRef(null);

  const [songTitle, setSongTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [composer, setComposer] = useState("");
  
  const [songKey, setSongKey] = useState("G");
  const [capo, setCapo] = useState("0");
  const [transpose, setTranspose] = useState("0");
  const [preferFlats, setPreferFlats] = useState(null);

  const transSteps = parseInt(transpose, 10) || 0;

  const isMinorKey = (songKey || 'G').trim().endsWith('m');
  const keyRootLetter = (songKey || 'G').trim().replace(/m$/, '');

  const AMBIGUOUS_ROOTS = ['C#', 'D#', 'F#', 'G#', 'A#', 'Db', 'Eb', 'Gb', 'Ab', 'Bb'];
  const isAmbiguousRoot = (note) => AMBIGUOUS_ROOTS.includes(note);

  const effectiveKey = transposeString(songKey || "G", transSteps, preferFlats);
  const effectiveKeyRoot = effectiveKey.replace(/m$/, '');
  const showPreferFlatsToggle = isAmbiguousRoot(effectiveKeyRoot);
  const activePrefersFlats = preferFlats !== null ? preferFlats : effectiveKeyRoot.includes('b');

  useEffect(() => {
    setPreferFlats(null);
  }, [songKey, transpose]);
  
  const [inputText, setInputText] = useState("Verse 1\nLookin' in your eyes, I see a paradise _ _\nThis world that I found is too good to be true _\nStanding here beside you, want so much to give you _\nThis love in my heart that I'm feeling for you _\n\nChorus\nAnd we can build this dream together _ _\nStanding strong forever _\nNothing's gonna stop us now _");
  
  const [lyricLines, setLyricLines] = useState([]);
  const [chordMap, setChordMap] = useState({});
  
  const [bRoot, setBRoot] = useState('G');
  const [bQual, setBQual] = useState(''); 
  const [bBass, setBBass] = useState(''); 
  const [customPalette, setCustomPalette] = useState([]);

  const baseLetters = ['A', 'Bb', 'B', 'C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab'];
  const advancedQualities = ['m', '7', 'm7', 'maj7', 'sus2', 'sus4', 'dim', 'aug', '9', '11'];
  
  const builtChordAbsolute = `${bRoot}${bQual}${bBass ? '/' + bBass : ''}`;

  const [focusedWordId, setFocusedWordId] = useState(null);
  const [isAltPressed, setIsAltPressed] = useState(false);

  // --- UNDO / REDO HISTORY ENGINE ---
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Parses inline <b>/<i>/<u> markers (written into the textarea by the
  // Cmd+B / Cmd+I / Cmd+U shortcuts below) into a flat list of words, each
  // carrying its own isBold/isItalic/isUnderline flags. Tags never appear
  // inside a word's own text, and a tag can never split a whitespace-free
  // run into two separate words - the canvas treats one word as one chord
  // slot, so formatting always resolves to whole-word granularity even if a
  // tag was hand-edited to land mid-word (its flags just apply to the whole
  // merged word from that point on).
  const parseFormattedWords = (text) => {
    const parts = text.split(/(<\/?[biu]>)/i);
    let bold = false, italic = false, underline = false;
    const words = [];
    let pending = null;

    const flushPending = () => {
      if (pending && pending.text.length > 0) words.push(pending);
      pending = null;
    };

    for (const part of parts) {
      if (!part) continue;
      const tagMatch = /^<(\/?)([biu])>$/i.exec(part);
      if (tagMatch) {
        const closing = tagMatch[1] === '/';
        const type = tagMatch[2].toLowerCase();
        if (type === 'b') bold = !closing;
        else if (type === 'i') italic = !closing;
        else if (type === 'u') underline = !closing;
        continue;
      }
      const pieces = part.split(/(\s+)/);
      for (const piece of pieces) {
        if (piece === '') continue;
        if (/^\s+$/.test(piece)) {
          flushPending();
          continue;
        }
        if (pending) {
          pending.text += piece;
        } else {
          pending = { text: piece, isBold: bold, isItalic: italic, isUnderline: underline };
        }
      }
    }
    flushPending();
    return words;
  };

  const processLinesLogic = (text) => {
    const lines = text.split('\n');
    return lines.map((line, lineIndex) => {
      const trimmed = line.trim();
      if (trimmed === '') return { id: `line-${lineIndex}`, isSpacer: true, isHeader: false, words: [] };

      const sanitized = trimmed.replace(/[\u200B-\u200D\uFEFF]/g, '');
      const lower = sanitized.toLowerCase();

      const isBracketed = lower.startsWith('[') && lower.endsWith(']');
      const plainHeaders = ['intro', 'chorus', 'bridge', 'outro', 'pre-chorus', 'interlude', 'instrumental', 'tag', 'coda'];
      const isPlainHeader = plainHeaders.some(h => lower === h || lower.startsWith(h + ' ')) || lower.startsWith('verse');

      if (isBracketed || isPlainHeader) {
        let cleanText = sanitized;
        if (isBracketed) cleanText = cleanText.slice(1, -1).trim();
        cleanText = cleanText.replace(/:$/, '').trim();
        cleanText = cleanText.replace(/<\/?[biu]>/gi, '');
        return { id: `line-${lineIndex}`, isSpacer: false, isHeader: true, text: cleanText, words: [] };
      }

      const wordObjects = parseFormattedWords(sanitized).map((word, wordIndex) => ({
        id: `word-${lineIndex}-${wordIndex}`,
        text: word.text,
        isBold: word.isBold,
        isItalic: word.isItalic,
        isUnderline: word.isUnderline,
      }));
      return { id: `line-${lineIndex}`, isSpacer: false, isHeader: false, words: wordObjects };
    });
  };

  // Save current state snapshot before making changes
  const saveSnapshot = () => {
    const snapshot = { songTitle, artist, composer, songKey, capo, transpose, inputText, chordMap, customPalette, pdfTheme, displayFormat };
    setHistory((prev) => [...prev, snapshot]);
    setRedoStack([]); // Clear redo stack on new action
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    const currentState = { songTitle, artist, composer, songKey, capo, transpose, inputText, chordMap, customPalette, pdfTheme, displayFormat };

    setRedoStack((prev) => [...prev, currentState]);
    setHistory((prev) => prev.slice(0, prev.length - 1));

    // Restore previous state
    setSongTitle(previousState.songTitle || "");
    setArtist(previousState.artist || "");
    setComposer(previousState.composer || "");
    setSongKey(previousState.songKey || "G");
    setCapo(previousState.capo || "0");
    setTranspose(previousState.transpose || "0");
    setInputText(previousState.inputText || "");
    setChordMap(previousState.chordMap || {});
    setCustomPalette(previousState.customPalette || []);
    if (previousState.pdfTheme) setPdfTheme(previousState.pdfTheme);
    if (previousState.displayFormat) setDisplayFormat(previousState.displayFormat);
    setLyricLines(processLinesLogic(previousState.inputText || ""));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    const currentState = { songTitle, artist, composer, songKey, capo, transpose, inputText, chordMap, customPalette, pdfTheme, displayFormat };

    setHistory((prev) => [...prev, currentState]);
    setRedoStack((prev) => prev.slice(0, prev.length - 1));

    // Restore next state
    setSongTitle(nextState.songTitle || "");
    setArtist(nextState.artist || "");
    setComposer(nextState.composer || "");
    setSongKey(nextState.songKey || "G");
    setCapo(nextState.capo || "0");
    setTranspose(nextState.transpose || "0");
    setInputText(nextState.inputText || "");
    setChordMap(nextState.chordMap || {});
    setCustomPalette(nextState.customPalette || []);
    if (nextState.pdfTheme) setPdfTheme(nextState.pdfTheme);
    if (nextState.displayFormat) setDisplayFormat(nextState.displayFormat);
    setLyricLines(processLinesLogic(nextState.inputText || ""));
  };

  useEffect(() => {
    document.title = "MySongChart - App";
  }, []);


  // Global Pro status check: unlocks all Pro features anywhere in the app the
  // moment either legacy `isPro` or the new `stripeRole: 'pro'` flag is found
  // on the Clerk user's publicMetadata.
  const checkIsProFromMetadata = (metadata) => {
    return !!(metadata?.isPro === true || metadata?.stripeRole === 'pro');
  };

  useEffect(() => {
    if (user) {
      if (checkIsProFromMetadata(user.publicMetadata)) {
        setIsPro(true);
      } else if (pendingCheckoutSessionId) {
        // New paid user just signed up after a Stripe redirect. Verify the
        // checkout session server-side and mark them Pro immediately.
        fetch('/api/sync-purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, sessionId: pendingCheckoutSessionId }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.isPro) {
              setIsPro(true);
              user.reload?.();
            } else {
              setIsLightMode(true);
            }
          })
          .catch((err) => console.error('Error verifying checkout session:', err))
          .finally(() => {
            removeQueryParam('session_id');
            setPendingCheckoutSessionId(null);
          });
      } else {
        // Fallback: user is logged in but not marked Pro yet. Check if their
        // email matches a past Stripe purchase (e.g. they paid before making
        // an account, and the webhook couldn't find a Clerk user to match).
        const userEmail = user.primaryEmailAddress?.emailAddress;
        if (userEmail) {
          fetch('/api/sync-purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, email: userEmail }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.isPro) {
                setIsPro(true);
                user.reload?.();
              } else {
                setIsLightMode(true);
              }
            })
            .catch((err) => console.error('Error syncing purchase:', err));
        } else {
          setIsLightMode(true);
        }
      }
    } else {
      setIsPro(false);
      setIsLightMode(true);
      // Not signed in yet but arrived with a session_id (fresh Stripe redirect).
      // Auto-open the Sign Up modal so they can create an account to claim Pro.
      if (pendingCheckoutSessionId) {
        openSignUp();
      }
    }
  }, [user, pendingCheckoutSessionId]);


  useEffect(() => {
    if (!isPro) {
      setIsLightMode(true);
    }
  }, [isPro]);

  // The default chord color (the first, unlabeled-custom swatch) tracks the
  // theme so it's always legible: black on light backgrounds, white on dark.
  // Only auto-flips when the current color IS still one of those two
  // defaults, so a deliberately picked color (Red/Blue/Green/Yellow) is
  // left alone when the user switches theme.
  useEffect(() => {
    setChordAccentColor(prev => {
      if (prev === '#111827' || prev === '#ffffff') {
        return isLightMode ? '#111827' : '#ffffff';
      }
      return prev;
    });
  }, [isLightMode]);

  // Load saved chart state on app startup
  useEffect(() => {
    const savedSession = localStorage.getItem('mySongChart_activeSession');
    if (savedSession) {
      try {
        const data = JSON.parse(savedSession);
        setSongTitle(data.songTitle || "");
        setArtist(data.artist || "");
        setComposer(data.composer || "");
        setSongKey(data.songKey || "G");
        setCapo(data.capo || "0");
        setTranspose(data.transpose || "0");
        setInputText(data.inputText || "");
        setChordMap(data.chordMap || {});
        setCustomPalette(data.customPalette || []);
        if (data.pdfTheme) setPdfTheme(data.pdfTheme);
        if (data.displayFormat) setDisplayFormat(data.displayFormat);
        if (data.chordAccentColor) setChordAccentColor(data.chordAccentColor);
        setLyricLines(processLinesLogic(data.inputText || ""));
      } catch (e) {
        console.error("Failed to parse auto-saved session", e);
      }
    }
  }, []);

  // Auto-save state to localStorage on every change
  useEffect(() => {
    const sessionData = { songTitle, artist, composer, songKey, capo, transpose, inputText, chordMap, customPalette, pdfTheme, displayFormat, chordAccentColor };
    localStorage.setItem('mySongChart_activeSession', JSON.stringify(sessionData));
  }, [songTitle, artist, composer, songKey, capo, transpose, inputText, chordMap, customPalette, pdfTheme, displayFormat, chordAccentColor]);

  const handleNewChart = () => {
    if (window.confirm("Start a new chart? This will clear all lyrics and placed chords.")) {
      saveSnapshot();
      setSongTitle("");
      setArtist("");
      setComposer("");
      setSongKey("G");
      setCapo("0");
      setTranspose("0");
      setInputText("");
      setLyricLines([]);
      setChordMap({});
      setCustomPalette([]);
      setCurrentChartId(null);
      localStorage.removeItem('mySongChart_activeSession');
    }
  };

  const handleOpenChartsModal = () => {
    if (!isPro) {
      setShowUpgradeModal(true);
      return;
    }
    setShowChartsModal(true);
    if (supabase) refreshChartsList();
  };

  const refreshChartsList = async () => {
    if (!supabase) return;
    setChartsLoading(true);
    setChartsError(null);
    try {
      const rows = await listCharts(supabase, user.id);
      setSavedCharts(rows);
    } catch (err) {
      console.error('Failed to load charts', err);
      setChartsError("Couldn't load your charts. Please try again.");
    } finally {
      setChartsLoading(false);
    }
  };

  const handleSaveChart = async () => {
    setIsSavingChart(true);
    setChartsError(null);
    try {
      const chartData = { songTitle, artist, composer, songKey, capo, transpose, inputText, chordMap, customPalette, pdfTheme, displayFormat, chordAccentColor };
      const newId = await saveChart(supabase, user.id, {
        chartId: currentChartId,
        title: songTitle || 'Untitled Chart',
        artist: artist || '',
        chartData,
      });
      setCurrentChartId(newId);
      setChartSavedNotice(true);
      setTimeout(() => setChartSavedNotice(false), 2000);
      await refreshChartsList();
    } catch (err) {
      console.error('Failed to save chart', err);
      setChartsError("Couldn't save this chart. Please try again.");
    } finally {
      setIsSavingChart(false);
    }
  };

  const handleLoadChart = async (chart) => {
    setChartsError(null);
    try {
      const row = await loadChart(supabase, chart.id);
      const data = row.chart_data;
      saveSnapshot();
      setSongTitle(data.songTitle || "");
      setArtist(data.artist || "");
      setComposer(data.composer || "");
      setSongKey(data.songKey || "G");
      setCapo(data.capo || "0");
      setTranspose(data.transpose || "0");
      setInputText(data.inputText || "");
      setChordMap(data.chordMap || {});
      setCustomPalette(data.customPalette || []);
      if (data.pdfTheme) setPdfTheme(data.pdfTheme);
      if (data.displayFormat) setDisplayFormat(data.displayFormat);
      if (data.chordAccentColor) setChordAccentColor(data.chordAccentColor);
      setLyricLines(processLinesLogic(data.inputText || ""));
      setCurrentChartId(row.id);
      setShowChartsModal(false);
    } catch (err) {
      console.error('Failed to load chart', err);
      setChartsError("Couldn't load that chart. Please try again.");
    }
  };

  const handleDeleteChart = async (chart) => {
    if (!window.confirm(`Delete "${chart.title || 'Untitled Chart'}"? This can't be undone.`)) return;
    setChartsError(null);
    try {
      await deleteChart(supabase, chart.id);
      if (currentChartId === chart.id) setCurrentChartId(null);
      await refreshChartsList();
    } catch (err) {
      console.error('Failed to delete chart', err);
      setChartsError("Couldn't delete that chart. Please try again.");
    }
  };

  const handleClearAllChords = () => {
    if (Object.keys(chordMap).length === 0) return;
    if (window.confirm("Are you sure you want to clear all placed chords from this chart?")) {
      saveSnapshot();
      setChordMap({});
    }
  };

  const handleUpgradeMonthly = () => {
    if (!isSignedIn) {
      setShowUpgradeModal(false);
      openSignUp();
      return;
    }
    const userEmail = user?.primaryEmailAddress?.emailAddress;
    const userId = user?.id;
    const emailParam = `?prefilled_email=${encodeURIComponent(userEmail)}&client_reference_id=${userId}`;
    window.location.href = `${STRIPE_MONTHLY_URL}${emailParam}`;
  };

  const handleUpgradeAnnual = () => {
    if (!isSignedIn) {
      setShowUpgradeModal(false);
      openSignUp();
      return;
    }
    const userEmail = user?.primaryEmailAddress?.emailAddress;
    const userId = user?.id;
    const emailParam = `?prefilled_email=${encodeURIComponent(userEmail)}&client_reference_id=${userId}`;
    window.location.href = `${STRIPE_ANNUAL_URL}${emailParam}`;
  };

  useEffect(() => {
    const handleGlobalShortcuts = (e) => {
      // Undo: Cmd+Z / Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          handleUndo();
        }
      }

      // Redo: Cmd+Shift+Z / Ctrl+Shift+Z or Cmd+Y
      if (((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y')) {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          handleRedo();
        }
      }

      // Save to My Charts: Cmd+S / Ctrl+S (Pro only - matches the "My Charts"
      // toolbar button's gating exactly)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!isPro) {
          setShowUpgradeModal(true);
        } else {
          handleSaveChart();
        }
      }

      // Export Chart: Cmd+Shift+E / Ctrl+Shift+E (moved off plain Cmd+E, which
      // is now free for other uses)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setShowPreview((prev) => !prev);
      }

      // Select All Chords: Cmd+A / Ctrl+A
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          const placedChordIds = Object.keys(chordMap).filter(id => chordMap[id]);
          setSelectedWordIds(placedChordIds);
        }
      }

      // Wipe selected chords on Backspace/Delete or Enter/Return
      if ((e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter') && selectedWordIds.length > 0) {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          e.stopPropagation();
          if (document.activeElement) {
            document.activeElement.blur();
          }
          saveSnapshot();
          setChordMap(prev => {
            const newMap = { ...prev };
            selectedWordIds.forEach(id => {
              delete newMap[id];
            });
            return newMap;
          });
          setSelectedWordIds([]);
          setFocusedWordId(null);
        }
      }

      if (e.key === 'Escape') {
        if (showPreview) setShowPreview(false);
        if (showUpgradeModal) setShowUpgradeModal(false);
        if (showHelpModal) setShowHelpModal(false);
        if (showChartsModal) setShowChartsModal(false);
        setSelectedWordIds([]);
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts, true);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts, true);
  }, [showPreview, showUpgradeModal, showHelpModal, showChartsModal, songTitle, artist, composer, songKey, capo, transpose, inputText, chordMap, customPalette, pdfTheme, displayFormat, history, redoStack, selectedWordIds, isPro, chordAccentColor, currentChartId, user, supabase]);

  useEffect(() => {
    const down = (e) => { if (e.key === 'Alt') setIsAltPressed(true); };
    const up = (e) => { if (e.key === 'Alt') setIsAltPressed(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    if (!focusedWordId) return;

    const handleTyping = (e) => {
      const allIds = lyricLines.flatMap(line => line.isSpacer || line.isHeader ? [] : line.words.map(w => w.id));
      const currentIndex = allIds.indexOf(focusedWordId);

      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentIndex !== -1) {
          if ((e.key === ' ' && e.shiftKey) || e.key === 'ArrowLeft') {
            if (currentIndex > 0) setFocusedWordId(allIds[currentIndex - 1]);
          } else {
            if (currentIndex < allIds.length - 1) setFocusedWordId(allIds[currentIndex + 1]);
            else setFocusedWordId(null);
          }
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setFocusedWordId(null);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const parts = focusedWordId.split('-');
        const currentLineIndex = parseInt(parts[1], 10);
        
        let foundNextParagraph = false;
        let targetWordId = null;
        
        for (let i = currentLineIndex + 1; i < lyricLines.length; i++) {
          const line = lyricLines[i];
          if (line.isSpacer || line.isHeader) {
            foundNextParagraph = true; 
          } else if (foundNextParagraph && line.words.length > 0) {
            targetWordId = line.words[0].id;
            break;
          }
        }
        
        if (targetWordId) {
          setFocusedWordId(targetWordId);
        } else {
          setFocusedWordId(null); 
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        const stored = chordMap[focusedWordId] || '';
        const displayed = transposeString(stored, transSteps, preferFlats);
        if (displayed) navigator.clipboard.writeText(displayed);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        navigator.clipboard.readText().then(text => {
          if (text) {
            saveSnapshot();
            setChordMap(prev => {
              const newStored = parseChordStringToStandardLetter(text.trim(), songKey, transSteps, displayFormat, preferFlats);
              return { ...prev, [focusedWordId]: newStored };
            });
          }
        });
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        const currentStored = chordMap[focusedWordId] || '';
        if (currentStored.length === 0) {
          if (currentIndex > 0) setFocusedWordId(allIds[currentIndex - 1]);
          return;
        }

        saveSnapshot();
        setChordMap(prev => {
          const currentDisplayed = formatChordDisplay(currentStored, songKey, transSteps, displayFormat, preferFlats) || '';
          const newDisplayed = currentDisplayed.slice(0, -1);
          if (newDisplayed === '') {
            const newMap = { ...prev };
            delete newMap[focusedWordId];
            return newMap;
          }
          const newStored = parseChordStringToStandardLetter(newDisplayed, songKey, transSteps, displayFormat, preferFlats);
          return { ...prev, [focusedWordId]: newStored };
        });
        return;
      }

      if (/^[a-zA-Z0-9#/+\-()]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        saveSnapshot();
        setChordMap(prev => {
          const currentStored = prev[focusedWordId] || '';
          const currentDisplayed = formatChordDisplay(currentStored, songKey, transSteps, displayFormat, preferFlats) || '';
          let char = e.key;
          if (currentDisplayed.length === 0 && /[a-z]/i.test(char)) {
            if (displayFormat === 'letters' || displayFormat === 'solfege') {
              char = char.toUpperCase();
            }
          }
          const newDisplayed = currentDisplayed + char;
          const newStored = parseChordStringToStandardLetter(newDisplayed, songKey, transSteps, displayFormat, preferFlats);
          return { ...prev, [focusedWordId]: newStored };
        });
      }
    };

    window.addEventListener('keydown', handleTyping);
    return () => window.removeEventListener('keydown', handleTyping);
  }, [focusedWordId, lyricLines, transSteps, chordMap, songKey, displayFormat, preferFlats]);

  useEffect(() => {
    setLyricLines(processLinesLogic(inputText));
  }, []);

  const processLyrics = () => {
    saveSnapshot();
    setLyricLines(processLinesLogic(inputText));
    setFocusedWordId(null);
  };

  // Cmd/Ctrl+B, +I, +U in the lyrics textarea: wrap the current selection in
  // <b>/<i>/<u> (or strip the tag if that line's slice of the selection is
  // already exactly wrapped, so the shortcut toggles). The selection is
  // first snapped out to whole-word boundaries - the canvas renders one
  // word as one chord slot, so formatting can't apply to just part of a
  // word - then re-selected after the edit so pressing the same shortcut
  // again toggles it back off, and a second shortcut (e.g. Cmd+I right
  // after Cmd+B) stacks onto the same span instead of needing to re-select
  // it. A selection spanning multiple lines gets its own tag pair wrapped
  // around each line's slice (see below) rather than one pair around the
  // whole thing, since the canvas parser resolves formatting per line.
  const applyLyricsFormatting = (tag) => {
    const textarea = lyricsTextareaRef.current;
    if (!textarea) return;
    const value = textarea.value;
    let start = textarea.selectionStart;
    let end = textarea.selectionEnd;

    // Collapsed cursor: expand to the word it's sitting in, if any.
    if (start === end) {
      while (start > 0 && !/\s/.test(value[start - 1])) start--;
      while (end < value.length && !/\s/.test(value[end])) end++;
      if (start === end) return; // cursor is in whitespace/empty line - nothing to format
    } else {
      // Snap a partial selection out to the words it touches.
      while (start > 0 && !/\s/.test(value[start - 1])) start--;
      while (end < value.length && !/\s/.test(value[end])) end++;
    }

    const selected = value.slice(start, end);
    const openTag = `<${tag}>`;
    const closeTag = `</${tag}>`;

    // A selection can span multiple lines (e.g. a whole verse), but the
    // parser resolves <b>/<i>/<u> independently per line - a tag opened on
    // one line and only closed on a later one would silently do nothing
    // past the first line's closing newline. Wrap (or unwrap) each line's
    // own slice of the selection separately instead, skipping blank lines,
    // so every line ends up with its own complete, self-contained pair.
    const replacement = selected.split('\n').map((segment) => {
      if (segment.trim() === '') return segment;
      if (segment.startsWith(openTag) && segment.endsWith(closeTag)) {
        return segment.slice(openTag.length, segment.length - closeTag.length);
      }
      return `${openTag}${segment}${closeTag}`;
    }).join('\n');

    const newValue = value.slice(0, start) + replacement + value.slice(end);
    setInputText(newValue);
    // Restore focus + selection on the next tick, once React has applied
    // the new value to the DOM textarea.
    requestAnimationFrame(() => {
      if (!lyricsTextareaRef.current) return;
      lyricsTextareaRef.current.focus();
      lyricsTextareaRef.current.setSelectionRange(start, start + replacement.length);
    });
  };

  // Click-to-assign: clicking a palette chord fills it into whichever chord
  // box is currently selected, alongside the existing drag-and-drop flow.
  const handleChordClick = (chordId) => {
    if (!focusedWordId) return;
    saveSnapshot();
    setChordMap(prev => ({ ...prev, [focusedWordId]: chordId }));
  };

  // Selecting a key from the dropdown behaves exactly like typing it into
  // the old text field did: re-derive placed chords by the semitone diff.
  // Changing the Key field is ambiguous whenever chords are already placed:
  // it could mean "transpose what I've charted" or "I mistyped the key label
  // and the chords I already typed are correct as-is." With no chords on the
  // canvas there's nothing that transposing could disturb, so that case still
  // applies instantly - only the ambiguous case is deferred to a prompt.
  const handleKeySelect = (newKey) => {
    if (Object.keys(chordMap).length > 0) {
      setPendingKeyChange(newKey);
      return;
    }
    saveSnapshot();
    setSongKey(newKey);
    setTranspose("0");
  };

  const confirmTransposeToNewKey = () => {
    const newKey = pendingKeyChange;
    if (!newKey) return;
    saveSnapshot();
    const diff = getSemitoneDifference(songKey, newKey);
    const targetPrefersFlats = getKeyDefaultPrefersFlats(newKey);
    setChordMap(prev => {
      const newMap = {};
      Object.keys(prev).forEach(id => {
        const originalChord = prev[id];
        if (originalChord) {
          newMap[id] = transposeStoredChord(originalChord, diff, targetPrefersFlats);
        }
      });
      return newMap;
    });
    setSongKey(newKey);
    setTranspose("0");
    setPendingKeyChange(null);
  };

  const confirmRelabelKeyOnly = () => {
    const newKey = pendingKeyChange;
    if (!newKey) return;
    saveSnapshot();
    setSongKey(newKey);
    setTranspose("0");
    setPendingKeyChange(null);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    saveSnapshot(); // Save history state before drag action

    if (active.data?.current?.type === 'canvas') {
      const sourceWordId = active.data.current.sourceWordId;
      const draggedText = chordMap[sourceWordId];
      
      setChordMap(prev => {
        const newMap = { ...prev };
        newMap[over.id] = draggedText;
        if (!isAltPressed && sourceWordId !== over.id) {
          delete newMap[sourceWordId];
        }
        return newMap;
      });
    } else {
      setChordMap(prev => ({ ...prev, [over.id]: active.id }));
    }
  };

  const addCustomChord = () => {
    const chord = builtChordAbsolute;
    const currentScale = getScaleChords(songKey, preferFlats);
    if (chord && !currentScale.includes(chord) && !customPalette.includes(chord)) {
      saveSnapshot();
      setCustomPalette([...customPalette, chord]);
    }
  };

  const deleteCustomChord = (chordToRemove) => {
    saveSnapshot();
    setCustomPalette(customPalette.filter(c => c !== chordToRemove));
  };

  const handleLoadSession = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        saveSnapshot();
        setSongTitle(data.songTitle || "");
        setArtist(data.artist || "");
        setComposer(data.composer || "");
        setSongKey(data.songKey || "G");
        setCapo(data.capo || "0");
        setTranspose(data.transpose || "0");
        setInputText(data.inputText || "");
        setChordMap(data.chordMap || {});
        setCustomPalette(data.customPalette || []);
        if (data.pdfTheme) setPdfTheme(data.pdfTheme);
        if (data.displayFormat) setDisplayFormat(data.displayFormat);
        setLyricLines(processLinesLogic(data.inputText || ""));
      } catch (err) {
        alert("Error loading session file.");
      }
    };
    reader.readAsText(file);
    event.target.value = null; 
  };

  const handleExportChordPro = () => {
    if (!isPro) {
      setShowUpgradeModal(true);
      return;
    }

    const chordProContent = generateChordProText({
      songTitle,
      artist,
      composer,
      songKey,
      capo,
      transSteps,
      displayFormat,
      lyricLines,
      chordMap
    });

    const blob = new Blob([chordProContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${songTitle ? songTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'chart'}.chordpro`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    if (!isPro && pdfTheme !== 'classic') {
      alert("Free plan users can preview all styles, but PDF downloads are restricted to the Classic theme. Upgrade to Pro ($4.99/mo) for Modern & Jazz PDF downloads.");
      setPdfTheme('classic');
      return;
    }

    const element = document.getElementById('pdf-preview-content');
    if (!element) return;
    
    element.classList.add('pdf-export-mode');

    const opt = {
      margin:       [0.5, 0.5, 0.8, 0.5], 
      filename:     `${songTitle || 'Chart'}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, backgroundColor: '#ffffff' },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
      pagebreak:    { mode: ['css', 'legacy'], avoid: '.avoid-break' } 
    };

    html2pdf().set(opt).from(element).save().then(() => {
      element.classList.remove('pdf-export-mode');
      setShowPreview(false);
    });
  };

  const scaleChords = getScaleChords(songKey, preferFlats);

  const getThemeFont = (theme) => {
    if (theme === 'classic-studio') return "'Roboto Mono', 'SFMono-Regular', Consolas, 'Courier New', Courier, monospace";
    if (theme === 'real-book') return "'Architects Daughter', 'Caveat', cursive";
    if (theme === 'elegance') return "'Lora', Georgia, 'Times New Roman', serif";
    if (theme === 'minimalist') return `'Jost', ${FONT_STACK_SANS}`;
    return `'Cal Sans', ${FONT_STACK_SANS}`;
  };

  return (
    <>
      <style>{globalStyles}</style>
      <div className="app-container" style={styles.container}>

        <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleLoadSession} />

        {/* TOP HEADER BAR: global app chrome, sits above the three-column layout */}
        <div className="top-header-bar" style={styles.topHeaderBar}>
          <h2 className="brand-title" style={{...styles.header, margin: 0, lineHeight: '1'}}>MySongChart</h2>

          <div className="header-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SignedOut>
              <SignUpButton mode="modal">
                <button type="button" style={{ padding: '6px 12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 'bold', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}`, whiteSpace: 'nowrap' }}>
                  Sign Up
                </button>
              </SignUpButton>
            </SignedOut>

            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>

            <button
              type="button"
              onClick={startOnboarding}
              style={{ background: 'none', border: `1px solid ${isLightMode ? '#d1d5db' : '#3f3f46'}`, color: isLightMode ? '#111827' : '#e4e4e7', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Show tutorial again"
            >
              <Compass size={16} strokeWidth={2.25} color="#0D9488" />
            </button>

            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              style={{ background: 'none', border: `1px solid ${isLightMode ? '#d1d5db' : '#3f3f46'}`, color: isLightMode ? '#111827' : '#e4e4e7', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Quick Guide & Help"
            >
              <HelpCircle size={16} strokeWidth={2.25} color="#DC2626" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isPro) {
                  setShowUpgradeModal(true);
                  setIsLightMode(true);
                } else {
                  setIsLightMode(!isLightMode);
                }
              }}
              style={{ background: 'none', border: `1px solid ${isLightMode ? '#d1d5db' : '#3f3f46'}`, color: isLightMode ? '#111827' : '#e4e4e7', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Toggle Dark/Light Mode"
            >
              {!isPro && <LockIcon size={11} style={{ opacity: 0.6 }} />}
              {isLightMode ? '🌙' : '☀️'}
            </button>
          </div>
        </div>

        {/* MOBILE-ONLY: Best on desktop notice, dismissible, non-blocking */}
        {showMobileDesktopNotice && (
          <div
            className="mobile-desktop-banner"
            style={{
              display: 'none',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              borderBottom: '1px solid #fde68a',
              padding: '8px 14px',
              fontSize: '0.875rem',
              fontFamily: `'Cal Sans', ${FONT_STACK_SANS}`,
              flexShrink: 0,
              zIndex: 150,
              width: '100%',
              boxSizing: 'border-box',
              alignSelf: 'stretch',
            }}
          >

            <span style={{ lineHeight: '1.3' }}>
              🖥️ MySongChart works best on desktop. Mobile support is limited.
            </span>
            <button
              type="button"
              onClick={dismissMobileDesktopNotice}
              aria-label="Dismiss"
              style={{
                background: 'none',
                border: 'none',
                color: '#92400e',
                fontSize: '1.125rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                flexShrink: 0,
                padding: '0 2px',
                lineHeight: '1',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* MOBILE TAB BAR */}

        <div 
          className="mobile-tab-bar" 
          style={{ 
            display: 'none', 
            justifyContent: 'space-around', 
            alignItems: 'center', 
            backgroundColor: isLightMode ? '#ffffff' : '#18181b', 
            borderBottom: `1px solid ${isLightMode ? '#e5e7eb' : '#27272a'}`,
            height: '48px',
            flexShrink: 0,
            zIndex: 100,
          }}
        >
          {['lyrics', 'chart', 'palette'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveMobileTab(tab)}
              style={{
                flex: 1,
                height: '100%',
                border: 'none',
                background: 'none',
                fontSize: '1rem',
                fontWeight: 'bold',
                fontFamily: `'Cal Sans', ${FONT_STACK_SANS}`,
                color: activeMobileTab === tab ? '#3b82f6' : (isLightMode ? '#6b7280' : '#a1a1aa'),
                borderBottom: activeMobileTab === tab ? '3px solid #3b82f6' : 'none',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'lyrics' ? 'Lyrics' : tab === 'chart' ? 'Canvas' : 'Palette'}
            </button>
          ))}
        </div>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="columns-row" style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* LEFT COLUMN */}
          <div className={`column-left ${activeMobileTab === 'lyrics' ? 'mobile-show-active' : 'mobile-hide'}`} style={{ ...styles.columnLeft, width: `${leftWidth}px` }} onClick={() => setFocusedWordId(null)}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', marginBottom: '12px' }}>
              <h2 className="header-title" style={{ ...styles.header, margin: '0 0 12px 0', fontSize: '1.25rem', textAlign: 'center', flexShrink: 0 }}>Paste your lyrics</h2>
              <div style={{ fontSize: '0.875rem', color: isLightMode ? '#6b7280' : '#a1a1aa', marginBottom: '6px', lineHeight: '1.3', textAlign: 'center', flexShrink: 0 }}>
                Add section headers (e.g. Verse, Chorus) on separate lines.
              </div>
              <textarea
                data-tour="lyrics-textarea"
                ref={lyricsTextareaRef}
                style={styles.textArea}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    processLyrics();
                    return;
                  }
                  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'b') {
                    e.preventDefault();
                    applyLyricsFormatting('b');
                    return;
                  }
                  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'i') {
                    e.preventDefault();
                    applyLyricsFormatting('i');
                    return;
                  }
                  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'u') {
                    e.preventDefault();
                    applyLyricsFormatting('u');
                    return;
                  }
                }}
              />
            </div>

            <button type="button" style={{ ...styles.button, marginBottom: '24px', flexShrink: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '6px' }} onClick={processLyrics} title="Shortcut: Cmd+Enter / Ctrl+Enter">
              <span>Map Lyrics to Canvas</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'rgba(255, 255, 255, 0.75)' }}>(⌘ + Enter)</span>
            </button>

            <h2 data-tour="appearance-section" className="header-title" style={{ ...styles.header, margin: '0 0 12px 0', fontSize: '1.25rem', textAlign: 'center', flexShrink: 0 }}>Appearance</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  type="button" 
                  onClick={() => setPdfTheme('modern')} 
                  style={pdfTheme === 'modern' ? styles.miniBtnActive : styles.miniBtnInactive}
                >
                  Modern
                </button>
                <button 
                  type="button" 
                  onClick={() => setPdfTheme('classic-studio')} 
                  style={pdfTheme === 'classic-studio' ? styles.miniBtnActive : styles.miniBtnInactive}
                >
                  Classic Studio
                </button>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  type="button" 
                  onClick={() => {
                    if (isPro) {
                      setPdfTheme('real-book');
                    } else {
                      setShowUpgradeModal(true);
                    }
                  }} 
                  style={{
                    ...(pdfTheme === 'real-book' ? styles.miniBtnActive : styles.miniBtnInactive),
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    opacity: !isPro ? 0.8 : 1,
                  }}
                >
                  {!isPro && <LockIcon size={10} style={{ opacity: 0.6 }} />}
                  <span>Real Book</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    if (isPro) {
                      setPdfTheme('elegance');
                    } else {
                      setShowUpgradeModal(true);
                    }
                  }} 
                  style={{
                    ...(pdfTheme === 'elegance' ? styles.miniBtnActive : styles.miniBtnInactive),
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    opacity: !isPro ? 0.8 : 1,
                  }}
                >
                  {!isPro && <LockIcon size={10} style={{ opacity: 0.6 }} />}
                  <span>Elegance</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    if (isPro) {
                      setPdfTheme('minimalist');
                    } else {
                      setShowUpgradeModal(true);
                    }
                  }} 
                  style={{
                    ...(pdfTheme === 'minimalist' ? styles.miniBtnActive : styles.miniBtnInactive),
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    opacity: !isPro ? 0.8 : 1,
                  }}
                >
                  {!isPro && <LockIcon size={10} style={{ opacity: 0.6 }} />}
                  <span>Minimalist</span>
                </button>
              </div>
            </div>

            {/* Pro Chord Accent Color Selector */}
            <div style={{ flexShrink: 0 }}>
              <label style={{ ...styles.label, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                {!isPro && <LockIcon size={11} style={{ opacity: 0.6 }} />} Chord Accent Color
              </label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                {[
                  { name: isLightMode ? 'Black' : 'White', value: isLightMode ? '#111827' : '#ffffff' },
                  { name: 'Red', value: '#DC2626' },
                  { name: 'Blue', value: '#2563EB' },
                  { name: 'Green', value: '#16A34A' },
                  { name: 'Yellow', value: '#EAB308' }
                ].map((color) => {
                  const defaultChordColor = isLightMode ? '#111827' : '#ffffff';
                  const isSelected = isPro ? chordAccentColor === color.value : color.value === defaultChordColor;
                  return (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => {
                        if (isPro) {
                          setChordAccentColor(color.value);
                        } else {
                          setShowUpgradeModal(true);
                        }
                      }}
                      title={color.name}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: color.value,
                        border: isSelected 
                          ? `3px solid ${isLightMode ? '#3b82f6' : '#60a5fa'}` 
                          : `1px solid ${isLightMode ? '#d1d5db' : '#4b5563'}`,
                        cursor: 'pointer',
                        padding: 0,
                        boxShadow: isSelected ? '0 0 4px rgba(59, 130, 246, 0.5)' : 'none',
                        transition: 'transform 0.1s',
                        transform: isSelected ? 'scale(1.1)' : 'scale(1)'
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* LEFT RESIZE HANDLE */}
          <div
            className="mobile-resizer"
            onMouseDown={handleMouseDownLeft}
            style={{
              width: '8px',
              cursor: 'col-resize',
              backgroundColor: 'transparent',
              zIndex: 10,
              marginRight: '-4px',
              marginLeft: '-4px',
            }}
            title="Drag to resize left panel"
          />

          {/* CENTER CANVAS COLUMN */}
          <div className={`column-center ${activeMobileTab === 'chart' ? 'mobile-show-active' : 'mobile-hide'}`} style={{ ...styles.columnCenter, flex: 1 }} onClick={() => setFocusedWordId(null)}>

            <div id="action-bar" style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', flexWrap: 'wrap', width: '100%' }}>
              <button type="button" className="top-action-btn" style={{ ...styles.actionButton, flex: 1, maxWidth: '140px', textAlign: 'center' }} onClick={handleNewChart}>
                ➕ New
              </button>
              <button type="button" className="top-action-btn" style={{ ...styles.actionButton, flex: 1, maxWidth: '140px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={handleOpenChartsModal} title="Shortcut: Cmd+S / Ctrl+S">
                {!isPro && <LockIcon size={11} style={{ opacity: 0.6 }} />} 📁 My Charts
              </button>
              <button data-tour="export-button" type="button" className="top-action-btn" style={{ ...styles.actionButton, flex: 1, maxWidth: '140px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={() => setShowPreview(true)} title="Shortcut: Cmd+Shift+E / Ctrl+Shift+E">
                <Download size={16} strokeWidth={2.25} /> Export
              </button>
              <div style={{ width: '1px', height: '20px', backgroundColor: isLightMode ? '#d1d5db' : '#3f3f46', margin: '0 4px' }} />
              <button
                type="button"
                className="top-action-btn"
                style={{
                  ...styles.actionButton,
                  flex: 1,
                  maxWidth: '140px',
                  padding: '8px 12px',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: history.length === 0 ? 0.5 : 1,
                  cursor: history.length === 0 ? 'not-allowed' : 'pointer',
                }}
                onClick={handleUndo}
                disabled={history.length === 0}
                title="Undo (⌘Z)"
              >
                <Undo2 size={16} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                className="top-action-btn"
                style={{
                  ...styles.actionButton,
                  flex: 1,
                  maxWidth: '140px',
                  padding: '8px 12px',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: redoStack.length === 0 ? 0.5 : 1,
                  cursor: redoStack.length === 0 ? 'not-allowed' : 'pointer',
                }}
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                title="Redo (⌘Shift+Z)"
              >
                <Redo2 size={16} strokeWidth={2.25} />
              </button>
            </div>

            <div data-tour="song-info" style={{ paddingBottom: '12px', marginBottom: '24px', borderBottom: `2px solid ${isLightMode ? '#e5e7eb' : '#27272a'}` }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '6px' }}>
                <InlineEditableField
                  value={songTitle}
                  onChange={setSongTitle}
                  placeholder="Nothing's Gonna Stop Us Now"
                  ariaLabel="Song title"
                  style={{ ...styles.songTitleStyle, fontFamily: getThemeFont(pdfTheme), width: '100%', display: 'block' }}
                />
                <div style={{ fontStyle: 'italic', fontSize: '0.9375rem', color: isLightMode ? '#4b5563' : '#a1a1aa', textAlign: 'center', lineHeight: '1.2', fontFamily: getThemeFont(pdfTheme), width: '100%', maxWidth: '600px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <span>Written by</span>
                    <InlineEditableField
                      value={composer}
                      onChange={setComposer}
                      placeholder="Albert Hammond, Diane Warren"
                      ariaLabel="Written by"
                      autoSize
                      style={{ fontStyle: 'italic', fontSize: '0.9375rem', color: 'inherit', fontFamily: 'inherit', textAlign: 'center', maxWidth: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1px' }}>
                    <span>Performed by</span>
                    <InlineEditableField
                      value={artist}
                      onChange={setArtist}
                      placeholder="Starship"
                      ariaLabel="Artist"
                      autoSize
                      style={{ fontStyle: 'italic', fontSize: '0.9375rem', color: 'inherit', fontFamily: 'inherit', textAlign: 'center', maxWidth: '100%' }}
                    />
                  </div>
                </div>
              </div>

              {showPreferFlatsToggle && (
                <div className="mobile-hide" style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setPreferFlats(false)}
                    title="Prefer sharp spelling"
                    style={{
                      padding: '2px 10px',
                      fontSize: '0.875rem',
                      fontWeight: 'bold',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      border: `1px solid ${isLightMode ? '#d1d5db' : '#3f3f46'}`,
                      backgroundColor: !activePrefersFlats ? '#3b82f6' : (isLightMode ? '#f9fafb' : '#27272a'),
                      color: !activePrefersFlats ? 'white' : (isLightMode ? '#4b5563' : '#a1a1aa'),
                    }}
                  >
                    ♯
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferFlats(true)}
                    title="Prefer flat spelling"
                    style={{
                      padding: '2px 10px',
                      fontSize: '0.875rem',
                      fontWeight: 'bold',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      border: `1px solid ${isLightMode ? '#d1d5db' : '#3f3f46'}`,
                      backgroundColor: activePrefersFlats ? '#3b82f6' : (isLightMode ? '#f9fafb' : '#27272a'),
                      color: activePrefersFlats ? 'white' : (isLightMode ? '#4b5563' : '#a1a1aa'),
                    }}
                  >
                    ♭
                  </button>
                </div>
              )}

              <div style={{ textAlign: 'center', fontSize: '1.0625rem', fontWeight: 'bold', fontFamily: getThemeFont(pdfTheme) }}>
                <div>Key - {transposeString(songKey || "G", transSteps, preferFlats)}</div>
                {capo && capo !== "0" && <div style={{ fontSize: '0.9375rem', fontWeight: 'normal', marginTop: '2px', color: '#4b5563' }}>Capo {capo}</div>}
              </div>
            </div>

            {lyricLines.length === 0 ? (
              <p style={{ color: isLightMode ? '#9ca3af' : '#a1a1aa', textAlign: 'center', marginTop: '40px' }}>Paste your lyrics on the left and click "Map" to start charting.</p>
            ) : (
              <div style={{ width: '100%' }}>
                {(() => { const firstWordLineId = lyricLines.find(l => !l.isSpacer && !l.isHeader)?.id; return lyricLines.map(line => (
                  line.isSpacer ? (
                    <div key={line.id} style={{ height: '16px', width: '100%' }}></div>
                  ) : line.isHeader ? (
                    <div key={line.id} style={{ width: '100%', textAlign: 'left', fontWeight: 'bold', fontSize: '1.125rem', marginTop: '24px', marginBottom: '8px', color: isLightMode ? '#1f2937' : '#f4f4f5', fontFamily: getThemeFont(pdfTheme) }}>
                      {line.text}
                    </div>
                  ) : (
                    <div key={line.id} data-tour={line.id === firstWordLineId ? 'chord-boxes' : undefined} className="lyric-line avoid-break" style={styles.lyricLine}>
                      {line.words.map(w => {
                        const originalChord = chordMap[w.id];
                        const displayChord = formatChordDisplay(originalChord, songKey, transSteps, displayFormat, preferFlats);

                        return (
                          <DroppableWord
                            key={w.id} 
                            id={w.id} 
                            word={w.text} 
                            assignedChord={displayChord} 
                            isLight={isLightMode} 
                            pdfTheme={pdfTheme}
                            isFocused={focusedWordId === w.id}
                            isSelected={selectedWordIds.includes(w.id)}
                            onFocus={(wordId) => {
                              setFocusedWordId(wordId);
                              setSelectedWordIds([]);
                            }}
                            isBold={w.isBold}
                            isItalic={w.isItalic}
                            isUnderline={w.isUnderline}
                            chordAccentColor={chordAccentColor}
                            isPro={isPro}
                          />
                        );
                      })}
                    </div>
                  )
                )); })()}
              </div>
            )}
          </div>

          {/* RIGHT RESIZE HANDLE */}
          <div
            className="mobile-resizer"
            onMouseDown={handleMouseDownRight}
            style={{
              width: '8px',
              cursor: 'col-resize',
              backgroundColor: 'transparent',
              zIndex: 10,
              marginRight: '-4px',
              marginLeft: '-4px',
            }}
            title="Drag to resize right panel"
          />

          {/* RIGHT PALETTE COLUMN */}
          <div className={`column-right ${activeMobileTab === 'palette' ? 'mobile-show-active' : 'mobile-hide'}`} style={{ ...styles.columnRight, width: `${rightWidth}px` }} onClick={() => setFocusedWordId(null)}>

            <div style={{ padding: '14px', backgroundColor: isLightMode ? '#eff6ff' : '#27272a', borderRadius: '8px', border: '1px solid #3b82f6', textAlign: 'center', flexShrink: 0, marginBottom: '24px' }}>
              <div style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '6px', color: isLightMode ? '#1e40af' : '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {isPro ? (<><SparklesIcon size={14} /> Pro Tier Active</>) : 'Free Plan (Watermarked PDFs)'}
              </div>
              <div style={{ fontSize: '0.875rem', color: isLightMode ? '#4b5563' : '#a1a1aa', marginBottom: '12px', textWrap: 'balance', lineHeight: '1.3' }}>
                {isPro ? 'Unlimited charts, transposing, ChordPro exports & clean PDFs active.' : 'Upgrade to Pro for ChordPro exports, transposing & clean PDFs.'}
              </div>
              {!isPro ? (
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(true)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.9375rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` }}
                >
                  Upgrade to Pro
                </button>
              ) : (
                <div style={{ fontSize: '0.8125rem', color: '#10b981', fontWeight: 'bold' }}>
                  ✓ Subscription Active
                </div>
              )}
            </div>

            <h2 className="header-title" style={{ ...styles.header, margin: '0 0 24px 0', fontSize: '1.25rem', textAlign: 'center' }}>
              Chord Palette
            </h2>

            <label style={styles.label}>Display Format</label>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setDisplayFormat('letters')} style={displayFormat === 'letters' ? styles.miniBtnActive : styles.miniBtnInactive}>Letters</button>
              <button type="button" onClick={() => setDisplayFormat('numbers')} style={displayFormat === 'numbers' ? styles.miniBtnActive : styles.miniBtnInactive}>Numbers</button>
              <button type="button" onClick={() => setDisplayFormat('roman')} style={displayFormat === 'roman' ? styles.miniBtnActive : styles.miniBtnInactive}>Roman</button>
              <button type="button" onClick={() => setDisplayFormat('solfege')} style={displayFormat === 'solfege' ? styles.miniBtnActive : styles.miniBtnInactive}>Do Re Mi</button>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
              <div data-tour="key-field" style={{ flex: '1 1 78px' }}>
                <label style={styles.label}>Key</label>
                <select
                  style={{...styles.input, marginBottom: 0, padding: '9px 4px'}}
                  value={KEY_OPTIONS.some(k => k.value === keyRootLetter) ? keyRootLetter : 'G'}
                  onChange={e => handleKeySelect(e.target.value + (isMinorKey ? 'm' : ''))}
                >
                  {KEY_OPTIONS.map(k => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '0 1 68px' }}>
                <label style={styles.label}>Mode</label>
                <select
                  style={{...styles.input, marginBottom: 0, padding: '9px 4px'}}
                  value={isMinorKey ? 'minor' : 'major'}
                  onChange={e => handleKeySelect(keyRootLetter + (e.target.value === 'minor' ? 'm' : ''))}
                >
                  <option value="major">Maj</option>
                  <option value="minor">Min</option>
                </select>
              </div>
              <div style={{ flex: '0 1 56px' }}>
                <label style={styles.label}>Capo</label>
                <select
                  style={{...styles.input, marginBottom: 0, padding: '9px 4px'}}
                  value={capo}
                  onChange={e => { saveSnapshot(); setCapo(e.target.value); }}
                >
                  {Array.from({ length: 12 }, (_, i) => i).map(fret => (
                    <option key={fret} value={String(fret)}>{fret}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 96px' }} onClick={() => { if (!isPro) setShowUpgradeModal(true); }}>
                <label style={{ ...styles.label, color: !isPro ? '#9ca3af' : (isLightMode ? '#4b5563' : '#a1a1aa'), display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {!isPro && <LockIcon size={11} style={{ opacity: 0.6 }} />} Transpose
                </label>
                <select
                  disabled={!isPro}
                  style={{
                    ...styles.input,
                    marginBottom: 0,
                    padding: '9px 4px',
                    opacity: !isPro ? 0.6 : 1,
                    cursor: !isPro ? 'not-allowed' : 'pointer'
                  }}
                  value={transpose}
                  onChange={e => { saveSnapshot(); setTranspose(e.target.value); }}
                >
                  {Array.from({ length: 25 }, (_, i) => i - 12).map(num => {
                    const resultingKeyName = transposeString(songKey || "G", num, preferFlats);
                    return (
                      <option key={num} value={num}>{num > 0 ? `+${num}` : num} ({resultingKeyName})</option>
                    );
                  })}
                </select>
              </div>
            </div>

            <h3 style={{...styles.subHeader, marginTop: 0}}>
              {displayFormat === 'letters' ? `Key Chords (${songKey})` : (displayFormat === 'numbers' ? 'Nashville Numbers' : (displayFormat === 'roman' ? 'Roman Numerals' : 'Solfège'))} & Custom
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '24px' }}>
              {scaleChords.map(chord => (
                <DraggableChord
                  key={`scale-${chord}`}
                  id={chord}
                  text={formatChordDisplay(chord, songKey, transSteps, displayFormat, preferFlats)}
                  baseText={chord}
                  isCustom={false}
                  onChordClick={handleChordClick}
                />
              ))}
              {customPalette.map(chord => (
                <DraggableChord
                  key={`custom-${chord}`}
                  id={chord}
                  text={formatChordDisplay(chord, songKey, transSteps, displayFormat, preferFlats)}
                  baseText={chord}
                  isCustom={true}
                  onDelete={deleteCustomChord}
                  onChordClick={handleChordClick}
                />
              ))}
            </div>

            <div style={{ backgroundColor: isLightMode ? '#f9fafb' : '#27272a', border: `1px solid ${isLightMode ? '#e5e7eb' : 'transparent'}`, padding: '16px', borderRadius: '8px' }}>
              <h3 style={{...styles.subHeader, marginTop: 0}}>Custom Builder</h3>
              
              <label style={styles.label}>Root Note</label>
              <div style={styles.builderRow}>
                {baseLetters.map(r => (
                  <button type="button" key={r} onClick={() => setBRoot(r)} style={bRoot === r ? styles.miniBtnActive : styles.miniBtnInactive}>
                    {formatChordDisplay(r, songKey, transSteps, displayFormat, preferFlats)}
                  </button>
                ))}
              </div>

              <label style={styles.label}>Quality & Extensions</label>
              <div style={styles.builderRow}>
                {advancedQualities.map(q => (
                  <button type="button" key={q} onClick={() => setBQual(bQual === q ? '' : q)} style={bQual === q ? styles.miniBtnActive : styles.miniBtnInactive}>{q}</button>
                ))}
              </div>

              <div style={{ width: '100%', marginTop: '8px', marginBottom: '12px' }}>
                <label style={styles.label}>Bass Note (/)</label>
                <select value={bBass} onChange={e => setBBass(e.target.value)} style={{...styles.input, marginBottom: 0, padding: '8px'}}>
                  <option value="">None</option>
                  {baseLetters.map(b => (
                    <option key={b} value={b}>
                      {formatChordDisplay(b, songKey, transSteps, displayFormat, preferFlats)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                <div style={{ flex: 1, textAlign: 'center', fontSize: '1.25rem', fontWeight: 'bold', color: isLightMode ? '#111827' : 'white', backgroundColor: isLightMode ? '#ffffff' : '#18181b', padding: '8px', borderRadius: '4px', border: `1px solid ${isLightMode ? '#d1d5db' : '#3f3f46'}` }}>
                  <ChordLabel text={formatChordDisplay(builtChordAbsolute, songKey, transSteps, displayFormat, preferFlats)} />
                </div>
                <div style={{ flex: 1 }}>
                  <button type="button" onClick={addCustomChord} style={styles.addBtn}>+ Add</button>
                </div>
              </div>
            </div>

          </div>

        </div>
        </DndContext>

        {/* --- MY CHARTS MODAL --- */}
        {showChartsModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: isLightMode ? '#ffffff' : '#1e293b', color: isLightMode ? '#0f172a' : '#f8fafc', borderRadius: '16px', padding: '28px', maxWidth: '540px', width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative', textAlign: 'left' }}>

              <button
                type="button"
                onClick={() => setShowChartsModal(false)}
                style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#9ca3af' }}
              >
                ✕
              </button>

              <h2 style={{ fontSize: '1.375rem', fontWeight: 'bold', marginBottom: '20px', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}`, display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 20px 0' }}>
                <span>📁</span> My Charts
              </h2>

              {!supabase ? (
                <div style={{ color: isLightMode ? '#6b7280' : '#a1a1aa', fontSize: '0.9375rem', textAlign: 'center', padding: '20px 0' }}>
                  Cloud save isn't available right now. Please try again shortly.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '20px', borderBottom: `1px solid ${isLightMode ? '#f1f5f9' : '#334155'}` }}>
                    <button
                      type="button"
                      onClick={handleSaveChart}
                      disabled={isSavingChart}
                      style={{ padding: '10px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: isSavingChart ? 'default' : 'pointer', fontWeight: 'bold', opacity: isSavingChart ? 0.7 : 1, fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` }}
                    >
                      {isSavingChart ? 'Saving…' : currentChartId ? 'Save Current Chart' : 'Save as New Chart'}
                    </button>
                  </div>

                  {chartsError && (
                    <div style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '16px' }}>{chartsError}</div>
                  )}

              {chartsLoading ? (
                <div style={{ color: isLightMode ? '#6b7280' : '#a1a1aa', fontSize: '0.9375rem', textAlign: 'center', padding: '20px 0' }}>Loading your charts…</div>
              ) : savedCharts.length === 0 ? (
                <div style={{ color: isLightMode ? '#6b7280' : '#a1a1aa', fontSize: '0.9375rem', textAlign: 'center', padding: '20px 0' }}>No saved charts yet. Save your current chart to get started.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {savedCharts.map(chart => (
                    <div
                      key={chart.id}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${chart.id === currentChartId ? '#3b82f6' : (isLightMode ? '#e5e7eb' : '#3f3f46')}`, backgroundColor: isLightMode ? '#f9fafb' : '#27272a' }}
                    >
                      <button
                        type="button"
                        onClick={() => handleLoadChart(chart)}
                        style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
                      >
                        <div style={{ fontWeight: 'bold', fontSize: '0.9375rem' }}>{chart.title || 'Untitled Chart'}</div>
                        <div style={{ fontSize: '0.8125rem', color: isLightMode ? '#6b7280' : '#a1a1aa' }}>
                          {chart.artist ? `${chart.artist} — ` : ''}Updated {new Date(chart.updated_at).toLocaleString()}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteChart(chart)}
                        title="Delete chart"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '1rem', padding: '4px' }}
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                </div>
              )}
                </>
              )}
            </div>
          </div>
        )}

        {/* --- KEY CHANGE PROMPT (transpose vs. relabel-only) --- */}
        {pendingKeyChange && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: isLightMode ? '#ffffff' : '#1e293b', color: isLightMode ? '#0f172a' : '#f8fafc', borderRadius: '16px', padding: '28px', maxWidth: '440px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', textAlign: 'left' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 12px 0', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` }}>
                Update Key
              </h2>
              <p style={{ fontSize: '0.9375rem', lineHeight: '1.5', color: isLightMode ? '#475569' : '#cbd5e1', margin: '0 0 20px 0' }}>
                You're changing the key from <strong>{songKey}</strong> to <strong>{pendingKeyChange}</strong>, and this chart already has chords placed. What would you like to do?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  onClick={confirmTransposeToNewKey}
                  style={{ padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` }}
                >
                  Transpose existing chords to {pendingKeyChange}
                </button>
                <button
                  type="button"
                  onClick={confirmRelabelKeyOnly}
                  style={{ padding: '12px', backgroundColor: isLightMode ? '#f9fafb' : '#27272a', color: isLightMode ? '#111827' : '#e4e4e7', border: `1px solid ${isLightMode ? '#d1d5db' : '#3f3f46'}`, borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` }}
                >
                  Just update the key label (don't change chords)
                </button>
                <button
                  type="button"
                  onClick={() => setPendingKeyChange(null)}
                  style={{ padding: '8px', background: 'none', border: 'none', color: isLightMode ? '#6b7280' : '#a1a1aa', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- HELP CENTER MODAL --- */}
        {showHelpModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: isLightMode ? '#ffffff' : '#1e293b', color: isLightMode ? '#0f172a' : '#f8fafc', borderRadius: '16px', padding: '28px', maxWidth: '540px', width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative', textAlign: 'left' }}>
              
              <button 
                type="button" 
                onClick={() => setShowHelpModal(false)}
                style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#9ca3af' }}
              >
                ✕
              </button>

              <h2 style={{ fontSize: '1.375rem', fontWeight: 'bold', marginBottom: '20px', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}`, display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 20px 0' }}>
                <span>❓</span> Quick Start Guide
              </h2>

              <div style={{ fontSize: '0.9375rem', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Section 1 */}
                <div style={{ borderBottom: `1px solid ${isLightMode ? '#f1f5f9' : '#334155'}`, paddingBottom: '16px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#2563eb', margin: '0 0 8px 0', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` }}>
                    1. Lyric Mapping & Section Headers
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', color: isLightMode ? '#475569' : '#cbd5e1' }}>
                    <li>
                      <strong>Section Headers:</strong> Type <code style={kbdStyle(isLightMode)}>Verse 1</code>, <code style={kbdStyle(isLightMode)}>Chorus</code>, or <code style={kbdStyle(isLightMode)}>Bridge</code> on its own line to build bold dividers.
                    </li>
                    <li>
                      <strong>Beat Spacers:</strong> Put underscores (<code style={kbdStyle(isLightMode)}>_</code>) in lyrics to create blank chord boxes for empty measures.
                    </li>
                    <li>
                      <strong>Bold, Italic & Underline:</strong> Select a word (or several) in the text box and press <code style={kbdStyle(isLightMode)}>⌘B</code>, <code style={kbdStyle(isLightMode)}>⌘I</code>, or <code style={kbdStyle(isLightMode)}>⌘U</code> to style it on the chart. Press the same shortcut again to remove it.
                    </li>
                  </ul>
                </div>

                {/* Section 2 */}
                <div style={{ borderBottom: `1px solid ${isLightMode ? '#f1f5f9' : '#334155'}`, paddingBottom: '16px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#2563eb', margin: '0 0 8px 0', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` }}>
                    2. Adding & Typing Chords
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', color: isLightMode ? '#475569' : '#cbd5e1' }}>
                    <li><strong>Drag & Drop:</strong> Drag chord pills directly onto words or spacers on the chart.</li>
                    <li><strong>Type Directly:</strong> Click any word to highlight it, then type chords (e.g. <code style={kbdStyle(isLightMode)}>G</code>, <code style={kbdStyle(isLightMode)}>Am7</code>) on your keyboard.</li>
                    <li><strong>Navigate:</strong> Press <code style={kbdStyle(isLightMode)}>Space</code> or <code style={kbdStyle(isLightMode)}>→</code> to move to the next word, or <code style={kbdStyle(isLightMode)}>Enter</code> for the next section.</li>
                    <li><strong>Select All & Delete:</strong> Press <code style={kbdStyle(isLightMode)}>⌘A</code> (or <code style={kbdStyle(isLightMode)}>Ctrl+A</code>) outside text boxes to highlight all placed chords, then press <code style={kbdStyle(isLightMode)}>Backspace</code> or <code style={kbdStyle(isLightMode)}>Delete</code> to remove them all.</li>
                  </ul>
                </div>

                {/* Section 3 */}
                <div style={{ borderBottom: `1px solid ${isLightMode ? '#f1f5f9' : '#334155'}`, paddingBottom: '16px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#2563eb', margin: '0 0 8px 0', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` }}>
                    3. Custom Builder
                  </h3>
                  <p style={{ margin: 0, color: isLightMode ? '#475569' : '#cbd5e1' }}>
                    Use the right sidebar to assemble custom roots, extensions (<code style={kbdStyle(isLightMode)}>sus4</code>, <code style={kbdStyle(isLightMode)}>maj7</code>), and slash bass notes (<code style={kbdStyle(isLightMode)}>/F#</code>), then click <strong>+ Add</strong>.
                  </p>
                </div>

                {/* Section 4 */}
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#2563eb', margin: '0 0 10px 0', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` }}>
                    4. Keyboard Shortcuts
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '0.875rem', color: isLightMode ? '#475569' : '#cbd5e1' }}>
                    <div><kbd style={kbdStyle(isLightMode)}>⌘ + Enter</kbd> : Map Lyrics to Canvas</div>
                    <div><kbd style={kbdStyle(isLightMode)}>⌘ + Z</kbd> : Undo</div>
                    <div><kbd style={kbdStyle(isLightMode)}>⌘ + Shift + Z</kbd> : Redo</div>
                    <div><kbd style={kbdStyle(isLightMode)}>⌘ + A</kbd> : Select All Chords</div>
                    <div><kbd style={kbdStyle(isLightMode)}>Backspace / Delete</kbd> : Remove Selected Chords</div>
                    <div><kbd style={kbdStyle(isLightMode)}>⌘ + Shift + E</kbd> : Export Chart</div>
                    <div><kbd style={kbdStyle(isLightMode)}>⌘ + S</kbd> : Save Session</div>
                    <div><kbd style={kbdStyle(isLightMode)}>⌘ + C / V</kbd> : Copy/Paste Chord</div>
                    <div><kbd style={kbdStyle(isLightMode)}>⌘ + B</kbd> : Bold Selected Word(s)</div>
                    <div><kbd style={kbdStyle(isLightMode)}>⌘ + I</kbd> : Italicize Selected Word(s)</div>
                    <div><kbd style={kbdStyle(isLightMode)}>⌘ + U</kbd> : Underline Selected Word(s)</div>
                    <div><kbd style={kbdStyle(isLightMode)}>Esc</kbd> : Deselect / Close</div>
                  </div>
                </div>

              </div>

              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                style={{ marginTop: '24px', width: '100%', padding: '10px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9375rem', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` }}
              >
                Got it!
              </button>

            </div>
          </div>
        )}

        {/* STRIPE UPGRADE MODAL */}
        {showUpgradeModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '28px', maxWidth: '440px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative' }}>
              <button 
                type="button" 
                onClick={() => setShowUpgradeModal(false)}
                style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#9ca3af' }}
              >
                ✕
              </button>
              
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a', marginBottom: '6px', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` }}>
                Upgrade to MySongChart Pro
              </h2>
              <p style={{ fontSize: '0.9375rem', color: '#64748b', marginBottom: '20px', lineHeight: '1.4' }}>
                Unlock key transposing, ChordPro exports, watermark-free PDF downloads, and access to all design themes.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <button
                  type="button"
                  onClick={() => { setShowUpgradeModal(false); openSignIn(); }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: 'transparent',
                    color: '#2563eb',
                    border: 'none',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: `'Cal Sans', ${FONT_STACK_SANS}`,
                    textAlign: 'center',
                  }}
                >
                  Already a Pro subscriber? Sign In
                </button>

                <div style={{ border: '2px solid #2563eb', borderRadius: '12px', padding: '16px', backgroundColor: '#eff6ff', position: 'relative' }}>
                  <span style={{ position: 'absolute', top: '-10px', right: '14px', backgroundColor: '#2563eb', color: '#ffffff', fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px' }}>
                    SAVE 33%
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '1.0625rem' }}>Annual Billing</span>
                    <span style={{ fontSize: '1.375rem', fontWeight: '800', color: '#2563eb' }}>$39.99<span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 'normal' }}>/yr</span></span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '12px' }}>Billed as $39.99/year upfront (~$3.33/mo).</p>
                  <button
                    type="button"
                    onClick={handleUpgradeAnnual}
                    style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9375rem', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` }}
                  >
                    Get Annual Plan (Best Value)
                  </button>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', backgroundColor: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '1.0625rem' }}>Monthly Billing</span>
                    <span style={{ fontSize: '1.375rem', fontWeight: 'bold', color: '#0f172a' }}>$4.99<span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 'normal' }}>/mo</span></span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '12px' }}>Pay month-to-month. Cancel anytime.</p>
                  <button
                    type="button"
                    onClick={handleUpgradeMonthly}
                    style={{ width: '100%', padding: '10px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9375rem', fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` }}
                  >
                    Get Monthly Plan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EXPORT CHART PREVIEW MODAL */}
        {showPreview && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: '#ffffff', color: '#111827', width: '100%', maxWidth: '800px', height: '85vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
              
              <div style={{ padding: '16px 24px', backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Export Chart ({pdfTheme.toUpperCase()} Style) {!isPro && (<><span>—</span> <LockIcon size={13} style={{ opacity: 0.7 }} /> <span>Free Preview</span></>)}
                </span>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setShowPreview(false)} style={{ padding: '8px 16px', backgroundColor: '#e5e5eb', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Cancel (Esc)</button>
                  <button type="button" onClick={handleExportChordPro} style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>{!isPro && <LockIcon size={12} />}Export ChordPro</button>
                  <button type="button" onClick={handleExportPDF} style={{ padding: '8px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Confirm & Download PDF</button>
                </div>
              </div>

              <div style={{ flex: 1, padding: '40px', overflowY: 'auto', backgroundColor: '#ffffff', position: 'relative' }}>
                
                {!isPro && (
                  <div style={{
                    position: 'absolute',
                    top: '40%',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    backgroundColor: 'rgba(255, 255, 255, 0.55)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 50,
                    padding: '20px',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      backgroundColor: '#1E293B',
                      color: '#FFFFFF',
                      padding: '24px 32px',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                      maxWidth: '420px'
                    }}>
                      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}><LockIcon size={28} /></div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '8px' }}>Preview Blurred</h3>
                      <p style={{ fontSize: '0.9375rem', color: '#94A3B8', marginBottom: '16px', lineHeight: '1.4', textWrap: 'balance' }}>
                        Upgrade to <strong>Pro</strong> to view full unblurred previews and download clean, watermark-free PDFs.
                      </p>
                      <button 
                        type="button" 
                        onClick={() => { setShowPreview(false); setShowUpgradeModal(true); }} 
                        style={{
                          backgroundColor: '#10B981',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '10px 20px',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          width: '100%',
                          fontFamily: `'Cal Sans', ${FONT_STACK_SANS}`
                        }}>
                        Unlock Full Preview & Clean PDFs
                      </button>
                    </div>
                  </div>
                )}

                <div id="pdf-preview-content" className="pdf-export-mode" style={{ backgroundColor: '#ffffff', color: '#111827', position: 'relative', minHeight: '100%' }}>
                  
                  {!isPro && (
                    <div className="watermark-overlay">
                      <span>MySongChart</span>
                    </div>
                  )}

                  <div className="chart-content-layer">
                    <div className="avoid-break" style={{ paddingBottom: '12px', marginBottom: '20px', borderBottom: '2px solid #111827' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                          <h1 style={{ margin: '0 0 6px 0', fontSize: '32px', textAlign: 'left', fontFamily: getThemeFont(pdfTheme), fontWeight: 'bold', lineHeight: '1.15' }}>
                            {songTitle || "Nothing's Gonna Stop Us Now"}
                          </h1>
                          <div style={{ fontStyle: 'italic', fontSize: '13px', color: '#4b5563', lineHeight: '1.2', fontFamily: getThemeFont(pdfTheme) }}>
                            <div>Written by {composer || "Albert Hammond, Diane Warren"}</div>
                            {(artist || "Starship") !== (composer || "Albert Hammond, Diane Warren") && (
                              <div style={{ marginTop: '1px' }}>Performed by {artist || "Starship"}</div>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '15px', fontWeight: 'bold', color: '#111827', fontFamily: getThemeFont(pdfTheme) }}>
                          <div>Key - {transposeString(songKey || "G", transSteps, preferFlats)}</div>
                          {capo && capo !== "0" && <div style={{ fontSize: '13px', fontWeight: 'normal', marginTop: '2px', color: '#4b5563' }}>Capo {capo}</div>}
                        </div>
                      </div>
                    </div>

                    <div style={{ width: '100%', fontFamily: getThemeFont(pdfTheme) }}>
                      {lyricLines.map(line => (
                        line.isSpacer ? (
                          <div key={line.id} style={{ height: '16px', width: '100%' }}></div>
                        ) : line.isHeader ? (
                          <div key={line.id} className="avoid-break" style={{ width: '100%', textAlign: 'left', fontWeight: 'bold', fontSize: '15px', marginTop: '18px', marginBottom: '6px', color: '#111827', letterSpacing: '0.5px', textTransform: 'uppercase', fontFamily: getThemeFont(pdfTheme) }}>
                            {line.text}
                          </div>
                        ) : (
                          <div key={line.id} className="lyric-line avoid-break" style={{ display: 'flex', flexWrap: 'wrap', width: '100%', marginBottom: '8px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                            {line.words.map(w => {
                              const originalChord = chordMap[w.id];
                              const displayChord = formatChordDisplay(originalChord, songKey, transSteps, displayFormat, preferFlats);
                              const isEmptyBeat = w.text === '_';
                              // Export always renders on a white page, so the
                              // dark-mode default (white chords) has to fall
                              // back to black here regardless of what's
                              // showing live in the app; a deliberately picked
                              // custom color still exports as chosen.
                              let chordColor = isPro ? (chordAccentColor === '#ffffff' ? '#111827' : chordAccentColor) : '#111827';

                              return (
                                <div key={w.id} className="canvas-word" style={{ display: 'inline-flex', flexDirection: 'column', margin: pdfTheme === 'minimalist' ? '0 6px 0 0' : '0 10px 0 0', minWidth: isEmptyBeat ? (pdfTheme === 'minimalist' ? '22px' : '30px') : '18px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                  <div style={{ height: pdfTheme === 'minimalist' ? '14px' : '18px', width: '100%', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '1px' }}>
                                    {displayChord && (
                                      <span style={{ color: chordColor, fontSize: pdfTheme === 'minimalist' ? '12px' : '14px', fontWeight: 'bold', fontFamily: getThemeFont(pdfTheme) }}>
                                        {displayChord}
                                      </span>
                                    )}
                                  </div>
                                  <div className="word-text" style={{ fontSize: pdfTheme === 'minimalist' ? '10pt' : '12pt', color: isEmptyBeat ? 'transparent' : '#111827', whiteSpace: 'pre', fontFamily: getThemeFont(pdfTheme), fontWeight: w.isBold ? 'bold' : undefined, WebkitTextStroke: w.isBold ? '0.6px currentColor' : undefined, transform: w.isItalic ? 'skewX(-12deg)' : undefined, textDecoration: w.isUnderline ? 'underline' : undefined }}>
                                    {isEmptyBeat ? '_' : w.text}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )
                      ))}
                    </div>

                    {!isPro && (
                      <div style={{
                        marginTop: '40px',
                        paddingTop: '12px',
                        borderTop: '1px solid #E5E7EB',
                        textAlign: 'center',
                        fontSize: '11px',
                        color: '#9CA3AF',
                        fontFamily: `'Cal Sans', ${FONT_STACK_SANS}`
                      }}>
                        Created with MySongChart.com (Free Plan) • Upgrade to Pro to remove watermark
                      </div>
                    )}
                  </div>

                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      <OnboardingTour
        isOpen={showOnboarding}
        stepIndex={onboardingStep}
        isLightMode={isLightMode}
        onNext={() => {
          if (onboardingStep >= ONBOARDING_STEPS.length - 1) {
            closeOnboarding();
          } else {
            setOnboardingStep(onboardingStep + 1);
          }
        }}
        onBack={() => setOnboardingStep(Math.max(0, onboardingStep - 1))}
        onSkip={closeOnboarding}
      />

      {/* Global save confirmation - covers Cmd+S saving directly with the
          My Charts modal closed, not just saving from inside the modal. */}
      {chartSavedNotice && (
        <div style={{ position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#16a34a', color: 'white', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.875rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)', zIndex: 3000, fontFamily: `'Cal Sans', ${FONT_STACK_SANS}` }}>
          ✓ Chart saved
        </div>
      )}
    </>
  );
}