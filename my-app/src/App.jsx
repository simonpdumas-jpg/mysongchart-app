import React, { useState, useRef, useEffect } from 'react';
import { DndContext, useDraggable, useDroppable, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
import html2pdf from 'html2pdf.js';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser, useClerk } from '@clerk/clerk-react';

// --- STRIPE CHECKOUT LINKS ---
const STRIPE_MONTHLY_URL = "https://buy.stripe.com/bJecN6c32g7W8sAbGbbMQ01";
const STRIPE_ANNUAL_URL = "https://buy.stripe.com/aFa7sM3ww5ti38g11xbMQ02";

// --- GLOBAL STYLES ---
const globalStyles = `
  /* Force Cal Sans directly on App Brand Headers */
  .brand-title, .header-title {
    font-family: 'Cal Sans', -apple-system, BlinkMacSystemFont, sans-serif !important;
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
    font-family: 'Cal Sans', sans-serif !important;
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

  @media (max-width: 767px) {
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
      height: calc(100vh - 48px) !important;
      flex: 1 !important;
    }
    .column-center {
      padding: 20px !important;
    }
    .mobile-resizer {
      display: none !important;
    }
  }
`;

// --- THEME ENGINE ---
const getStyles = (isLight, pdfTheme) => {
  let canvasFont = "'Cal Sans', sans-serif";
  let titleFont = "'Cal Sans', sans-serif";

  if (pdfTheme === 'classic') {
    canvasFont = "'Georgia', 'Times New Roman', Times, serif";
    titleFont = "'Georgia', 'Times New Roman', Times, serif";
  } else if (pdfTheme === 'jazz') {
    canvasFont = "'Permanent Marker', cursive";
    titleFont = "'Permanent Marker', cursive";
  } else if (pdfTheme === 'modern') {
    canvasFont = "'Cal Sans', sans-serif";
    titleFont = "'Cal Sans', sans-serif";
  }

  return {
    container: { display: 'flex', height: '100vh', fontFamily: "'Cal Sans', sans-serif", backgroundColor: isLight ? '#f3f4f6' : '#18181b', color: isLight ? '#1f2937' : '#e4e4e7', transition: 'all 0.3s' },
    columnLeft: { padding: '24px', borderRight: `1px solid ${isLight ? '#e5e7eb' : '#27272a'}`, display: 'flex', flexDirection: 'column', height: '100vh', boxSizing: 'border-box', backgroundColor: isLight ? '#ffffff' : '#18181b', overflowY: 'auto' },
    columnCenter: { flex: 1, padding: '40px', overflowY: 'auto', backgroundColor: isLight ? '#ffffff' : '#09090b', fontFamily: canvasFont, position: 'relative' },
    columnRight: { padding: '24px', borderLeft: `1px solid ${isLight ? '#e5e7eb' : '#27272a'}`, backgroundColor: isLight ? '#ffffff' : '#18181b', overflowY: 'auto' },
    header: { marginTop: 0, fontSize: '20px', fontWeight: '600', color: isLight ? '#111827' : '#f4f4f5', letterSpacing: '-0.5px', marginBottom: '16px', fontFamily: "'Cal Sans', sans-serif" },
    subHeader: { fontSize: '14px', fontWeight: '600', color: isLight ? '#6b7280' : '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', marginTop: '16px', fontFamily: "'Cal Sans', sans-serif" },
    label: { fontSize: '13px', color: isLight ? '#4b5563' : '#a1a1aa', marginBottom: '4px', display: 'block', fontWeight: '500', fontFamily: "'Cal Sans', sans-serif", textWrap: 'balance' },
    input: { width: '100%', boxSizing: 'border-box', marginBottom: '10px', padding: '10px', borderRadius: '6px', border: `1px solid ${isLight ? '#d1d5db' : '#3f3f46'}`, backgroundColor: isLight ? '#f9fafb' : '#27272a', color: isLight ? '#111827' : '#f4f4f5', fontSize: '14px', fontFamily: "'Cal Sans', sans-serif" },
    textArea: { width: '100%', boxSizing: 'border-box', display: 'block', marginTop: '0px', minHeight: '160px', height: '200px', maxHeight: 'none', marginBottom: '16px', padding: '12px', borderRadius: '6px', border: `1px solid ${isLight ? '#d1d5db' : '#3f3f46'}`, backgroundColor: isLight ? '#f9fafb' : '#27272a', color: isLight ? '#111827' : '#f4f4f5', fontSize: '14px', resize: 'vertical', lineHeight: '1.5', fontFamily: "'Courier New', Courier, monospace" },
    button: { width: '100%', padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', fontFamily: "'Cal Sans', sans-serif" },
    actionButton: { padding: '8px 12px', whiteSpace: 'nowrap', backgroundColor: isLight ? '#ffffff' : '#27272a', color: isLight ? '#374151' : '#e4e4e7', border: `1px solid ${isLight ? '#d1d5db' : '#3f3f46'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s', fontFamily: "'Cal Sans', sans-serif" },
    builderRow: { display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' },
    miniBtnActive: { flex: 1, minWidth: '32px', padding: '8px 4px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', fontFamily: "'Cal Sans', sans-serif" },
    miniBtnInactive: { flex: 1, minWidth: '32px', padding: '8px 4px', backgroundColor: isLight ? '#f9fafb' : '#27272a', color: isLight ? '#4b5563' : '#a1a1aa', border: `1px solid ${isLight ? '#d1d5db' : '#3f3f46'}`, borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', fontFamily: "'Cal Sans', sans-serif" },
    addBtn: { padding: '8px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', width: '100%', fontFamily: "'Cal Sans', sans-serif" },
    chordToken: { display: 'inline-flex', alignItems: 'center', padding: '6px 10px', margin: '4px', backgroundColor: '#2563eb', color: 'white', borderRadius: '6px', cursor: 'grab', fontWeight: 'bold', fontSize: '14px', userSelect: 'none', gap: '6px', fontFamily: "'Cal Sans', sans-serif" },
    lyricLine: { display: 'flex', flexWrap: 'wrap', width: '100%', marginBottom: '8px', pageBreakInside: 'avoid', breakInside: 'avoid' },
    canvasWord: { display: 'inline-flex', flexDirection: 'column', margin: '0 10px 0 0', minWidth: '20px', cursor: 'pointer', pageBreakInside: 'avoid', breakInside: 'avoid' },
    dropZone: { height: '26px', width: '100%', minWidth: '20px', borderRadius: '4px', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '2px', transition: 'all 0.1s' },
    wordText: { fontSize: '14px', color: isLight ? '#111827' : '#e4e4e7', whiteSpace: 'pre', fontFamily: canvasFont },
    songTitleStyle: { margin: '0 auto 4px auto', fontSize: '32px', lineHeight: '1.15', textAlign: 'center', color: isLight ? '#111827' : '#f4f4f5', fontFamily: titleFont, fontWeight: 'bold', maxWidth: '600px', textWrap: 'balance' },
  };
};

const transposeString = (chord, steps) => {
  if (!chord || steps === 0) return chord;
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
    
    return wasFlat ? flats[newIndex] : sharps[newIndex];
  });
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

const parseSlashRoot = (slashStr) => {
  if (!slashStr || slashStr === '/') return '';
  return slashStr.startsWith('/') ? slashStr.substring(1) : slashStr;
};

const convertRootToStandardLetter = (rootStr, currentKey, transSteps) => {
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

  const useFlats = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm'].includes(cleanKey);
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

const formatChordDisplay = (originalChord, currentKey, transSteps, format) => {
  if (!originalChord) return originalChord;

  if (format === 'letters') {
    return transposeString(originalChord, transSteps);
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

const parseChordStringToStandardLetter = (inputStr, currentKey, transSteps, _currentFormat) => {
  if (!inputStr) return inputStr;

  const { root, suffix, slash } = parseChordInputString(inputStr);

  const parsedRoot = convertRootToStandardLetter(root, currentKey, transSteps);
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
    const parsedSlash = convertRootToStandardLetter(slashRoot, currentKey, transSteps);
    finalSlash = '/' + parsedSlash.note;
  } else if (slash === '/') {
    finalSlash = '/';
  }

  return mainNote + finalSuffix + finalSlash;
};

const getScaleChords = (keyInput) => {
  const cleanKey = (keyInput || 'G').trim();
  const isMinor = cleanKey.endsWith('m');
  const root = cleanKey.replace(/m$/, '');

  const sharps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const flats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  let rootIndex = sharps.indexOf(root);
  let useFlats = false;
  if (rootIndex === -1) {
    rootIndex = flats.indexOf(root);
    useFlats = true;
  }
  if (rootIndex === -1) rootIndex = 7; 

  if (['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm'].includes(cleanKey)) {
      useFlats = true;
  }

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

  if (songTitle) output.push(`{title: ${songTitle}}`);
  if (artist) output.push(`{artist: ${artist}}`);
  if (composer) output.push(`{composer: ${composer}}`);
  
  const activeKey = transposeString(songKey || "G", transSteps);
  if (activeKey) output.push(`{key: ${activeKey}}`);
  if (capo && capo !== "0") output.push(`{capo: ${capo}}`);
  
  output.push('');

  lyricLines.forEach(line => {
    if (line.isSpacer) {
      output.push('');
    } else if (line.isHeader) {
      output.push(`{comment: ${line.text}}`);
    } else if (line.words && line.words.length > 0) {
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
  });

  return output.join('\n');
};

function DraggableChord({ id, text, baseText, onDelete, isCustom }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 100, cursor: 'grabbing', opacity: 0.8 } : undefined;
  
  return (
    <div ref={setNodeRef} style={{ ...getStyles(false, 'modern').chordToken, ...style }} {...listeners} {...attributes}>
      <span>{text}</span>
      {isCustom && (
        <button 
          type="button" 
          className="chord-delete-btn"
          onClick={(e) => { e.stopPropagation(); onDelete(baseText || text); }} 
          style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', padding: '0 2px' }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function DraggableCanvasChord({ wordId, text, isLight, pdfTheme, onFocus }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `canvas-${wordId}`,
    data: { type: 'canvas', sourceWordId: wordId }
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 100, cursor: 'grabbing', opacity: 0.8 } : undefined;
  
  let chordColor = '#1e3a8a';
  if (pdfTheme === 'classic') chordColor = isLight ? '#000000' : '#ffffff';
  if (pdfTheme === 'jazz') chordColor = '#000000'; 

  let fontStyle = "'Cal Sans', sans-serif";
  if (pdfTheme === 'jazz') fontStyle = "'Permanent Marker', cursive";
  if (pdfTheme === 'classic') fontStyle = "'Georgia', 'Times New Roman', Times, serif";

  return (
    <div 
      ref={setNodeRef} 
      {...listeners} 
      {...attributes} 
      onPointerDown={(e) => {
        onFocus(wordId);
        if (listeners?.onPointerDown) listeners.onPointerDown(e);
      }}
      style={{ ...style, color: chordColor, fontSize: '15px', fontWeight: 'bold', fontFamily: fontStyle }}
    >
      {text}
    </div>
  );
}

function DroppableWord({ id, word, assignedChord, isLight, pdfTheme, isFocused, isSelected, onFocus, isBold }) {
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

  return (
    <div className="canvas-word avoid-break" style={styles.canvasWord} onClick={(e) => { e.stopPropagation(); onFocus(id); }}>
      <div ref={setNodeRef} className="drop-zone" style={dropZoneStyle}>
        {assignedChord && (
          <DraggableCanvasChord wordId={id} text={assignedChord} isLight={isLight} pdfTheme={pdfTheme} onFocus={onFocus} />
        )}
      </div>
      <div className="word-text" style={{...styles.wordText, color: isEmptyBeat ? 'transparent' : (isLight ? '#111827' : '#e4e4e7'), fontWeight: isBold ? 'bold' : undefined}}>
        {isEmptyBeat ? '_' : word}
      </div>
    </div>
  );
}

const kbdStyle = (isLight) => ({
  backgroundColor: isLight ? '#f1f5f9' : '#334155',
  color: isLight ? '#0f172a' : '#f8fafc',
  padding: '2px 6px',
  borderRadius: '4px',
  border: `1px solid ${isLight ? '#cbd5e1' : '#475569'}`,
  fontSize: '11px',
  fontFamily: 'monospace',
  fontWeight: 'bold',
});

export default function App() {
  const { user, isSignedIn } = useUser();
  const { openSignIn } = useClerk();

  const [isLightMode, setIsLightMode] = useState(true);
  const [activeMobileTab, setActiveMobileTab] = useState('chart');

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
  const [showPreview, setShowPreview] = useState(false);
  
  const [isPro, setIsPro] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Column Resizing State (in pixels)
  const [leftWidth, setLeftWidth] = useState(270);
  const [rightWidth, setRightWidth] = useState(280);

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

  const [songTitle, setSongTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [composer, setComposer] = useState("");
  
  const [songKey, setSongKey] = useState("G");
  const [capo, setCapo] = useState("0");
  const [transpose, setTranspose] = useState("0");
  
  const transSteps = parseInt(transpose, 10) || 0;
  
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

  const processLinesLogic = (text) => {
    const lines = text.split('\n');
    return lines.map((line, lineIndex) => {
      const trimmed = line.trim();
      if (trimmed === '') return { id: `line-${lineIndex}`, isSpacer: true, isHeader: false, words: [] };
      
      let sanitized = trimmed.replace(/[\u200B-\u200D\uFEFF]/g, '');
      let isBold = false;
      if (sanitized.startsWith('*')) {
        isBold = true;
        sanitized = sanitized.slice(1).trim();
      }
      
      const lower = sanitized.toLowerCase();
      
      const isBracketed = lower.startsWith('[') && lower.endsWith(']');
      const plainHeaders = ['intro', 'chorus', 'bridge', 'outro', 'pre-chorus', 'interlude', 'instrumental', 'tag', 'coda'];
      const isPlainHeader = plainHeaders.some(h => lower === h || lower.startsWith(h + ' ')) || lower.startsWith('verse');

      if (isBracketed || isPlainHeader) {
        let cleanText = sanitized;
        if (isBracketed) cleanText = cleanText.slice(1, -1).trim();
        cleanText = cleanText.replace(/:$/, '').trim(); 
        return { id: `line-${lineIndex}`, isSpacer: false, isHeader: true, text: cleanText, words: [], isBold };
      }

      const splitWords = sanitized.split(/\s+/).filter(w => w.length > 0);
      const wordObjects = splitWords.map((word, wordIndex) => ({ id: `word-${lineIndex}-${wordIndex}`, text: word }));
      return { id: `line-${lineIndex}`, isSpacer: false, isHeader: false, words: wordObjects, isBold };
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
    document.title = "MySongChart";
  }, []);

  useEffect(() => {
    if (user) {
      if (user.publicMetadata?.isPro) {
        setIsPro(true);
      } else {
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
              }
            })
            .catch((err) => console.error('Error syncing purchase:', err));
        }
      }
    } else {
      setIsPro(false);
    }
  }, [user]);

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
        setLyricLines(processLinesLogic(data.inputText || ""));
      } catch (e) {
        console.error("Failed to parse auto-saved session", e);
      }
    }
  }, []);

  // Auto-save state to localStorage on every change
  useEffect(() => {
    const sessionData = { songTitle, artist, composer, songKey, capo, transpose, inputText, chordMap, customPalette, pdfTheme, displayFormat };
    localStorage.setItem('mySongChart_activeSession', JSON.stringify(sessionData));
  }, [songTitle, artist, composer, songKey, capo, transpose, inputText, chordMap, customPalette, pdfTheme, displayFormat]);

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
      localStorage.removeItem('mySongChart_activeSession');
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
      openSignIn();
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
      openSignIn();
      return;
    }
    const userEmail = user?.primaryEmailAddress?.emailAddress;
    const userId = user?.id;
    const emailParam = `?prefilled_email=${encodeURIComponent(userEmail)}&client_reference_id=${userId}`;
    window.location.href = `${STRIPE_ANNUAL_URL}${emailParam}`;
  };

  const handleSaveSession = () => {
    const sessionData = { songTitle, artist, composer, songKey, capo, transpose, inputText, chordMap, customPalette, pdfTheme, displayFormat };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sessionData));
    const downloadNode = document.createElement('a');
    downloadNode.setAttribute("href", dataStr);
    downloadNode.setAttribute("download", `${songTitle || "Untitled_Chart"}.json`);
    document.body.appendChild(downloadNode);
    downloadNode.click();
    downloadNode.remove();
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

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveSession();
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
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

      // Wipe selected chords
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedWordIds.length > 0) {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          saveSnapshot();
          setChordMap(prev => {
            const newMap = { ...prev };
            selectedWordIds.forEach(id => {
              delete newMap[id];
            });
            return newMap;
          });
          setSelectedWordIds([]);
        }
      }

      if (e.key === 'Escape') {
        if (showPreview) setShowPreview(false);
        if (showUpgradeModal) setShowUpgradeModal(false);
        if (showHelpModal) setShowHelpModal(false);
        setSelectedWordIds([]);
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [showPreview, showUpgradeModal, showHelpModal, songTitle, artist, composer, songKey, capo, transpose, inputText, chordMap, customPalette, pdfTheme, displayFormat, history, redoStack, selectedWordIds]);

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
        const displayed = transposeString(stored, transSteps);
        if (displayed) navigator.clipboard.writeText(displayed);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        navigator.clipboard.readText().then(text => {
          if (text) {
            saveSnapshot();
            setChordMap(prev => {
              const newStored = parseChordStringToStandardLetter(text.trim(), songKey, transSteps, displayFormat);
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
          const currentDisplayed = formatChordDisplay(currentStored, songKey, transSteps, displayFormat) || '';
          const newDisplayed = currentDisplayed.slice(0, -1);
          if (newDisplayed === '') {
            const newMap = { ...prev };
            delete newMap[focusedWordId];
            return newMap;
          }
          const newStored = parseChordStringToStandardLetter(newDisplayed, songKey, transSteps, displayFormat);
          return { ...prev, [focusedWordId]: newStored };
        });
        return;
      }

      if (/^[a-zA-Z0-9#/+\-()]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        saveSnapshot();
        setChordMap(prev => {
          const currentStored = prev[focusedWordId] || '';
          const currentDisplayed = formatChordDisplay(currentStored, songKey, transSteps, displayFormat) || '';
          let char = e.key;
          if (currentDisplayed.length === 0 && /[a-z]/i.test(char)) {
            if (displayFormat === 'letters' || displayFormat === 'solfege') {
              char = char.toUpperCase();
            }
          }
          const newDisplayed = currentDisplayed + char;
          const newStored = parseChordStringToStandardLetter(newDisplayed, songKey, transSteps, displayFormat);
          return { ...prev, [focusedWordId]: newStored };
        });
      }
    };

    window.addEventListener('keydown', handleTyping);
    return () => window.removeEventListener('keydown', handleTyping);
  }, [focusedWordId, lyricLines, transSteps, chordMap]);

  useEffect(() => {
    setLyricLines(processLinesLogic(inputText));
  }, []);

  const processLyrics = () => {
    saveSnapshot();
    setLyricLines(processLinesLogic(inputText));
    setFocusedWordId(null);
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
    const currentScale = getScaleChords(songKey);
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

    const blob = new Blob([chordProContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${songTitle ? songTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'chart'}.pro`;
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

  const scaleChords = getScaleChords(songKey);

  const getThemeFont = (theme) => {
    if (theme === 'classic') return "'Georgia', 'Times New Roman', Times, serif";
    if (theme === 'jazz') return "'Permanent Marker', cursive";
    return "'Cal Sans', -apple-system, BlinkMacSystemFont, sans-serif";
  };

  return (
    <>
      <style>{globalStyles}</style>
      <div className="app-container" style={styles.container}>
        
        <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleLoadSession} />

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
                fontSize: '14px',
                fontWeight: 'bold',
                fontFamily: "'Cal Sans', sans-serif",
                color: activeMobileTab === tab ? '#3b82f6' : (isLightMode ? '#6b7280' : '#a1a1aa'),
                borderBottom: activeMobileTab === tab ? '3px solid #3b82f6' : 'none',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'lyrics' ? '📝 Lyrics' : tab === 'chart' ? '📊 Chart' : '🎨 Palette'}
            </button>
          ))}
        </div>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          
          {/* LEFT COLUMN */}
          <div className={`column-left ${activeMobileTab === 'lyrics' ? 'mobile-show-active' : 'mobile-hide'}`} style={{ ...styles.columnLeft, width: `${leftWidth}px` }} onClick={() => setFocusedWordId(null)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="brand-title" style={{...styles.header, margin: 0, lineHeight: '1'}}>MySongChart</h2>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button type="button" style={{ padding: '6px 12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', fontFamily: "'Cal Sans', sans-serif", whiteSpace: 'nowrap' }}>
                      Sign In
                    </button>
                  </SignInButton>
                </SignedOut>

                <SignedIn>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </div>
            </div>            
            <label style={styles.label}>Song Title</label>
            <input type="text" className="styled-input" style={styles.input} value={songTitle} onChange={e => setSongTitle(e.target.value)} placeholder="e.g. Nothing's Gonna Stop Us Now" />
            
            <label style={styles.label}>Artist</label>
            <input type="text" className="styled-input" style={styles.input} value={artist} onChange={e => setArtist(e.target.value)} placeholder="e.g. Starship" />
            
            <label style={styles.label}>Songwriter(s)</label>
            <input type="text" className="styled-input" style={styles.input} value={composer} onChange={e => setComposer(e.target.value)} placeholder="e.g. Albert Hammond, Diane Warren" />

            <label style={styles.label}>Design Style</label>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
              <button type="button" onClick={() => setPdfTheme('modern')} style={pdfTheme === 'modern' ? styles.miniBtnActive : styles.miniBtnInactive}>Modern</button>
              <button type="button" onClick={() => setPdfTheme('classic')} style={pdfTheme === 'classic' ? styles.miniBtnActive : styles.miniBtnInactive}>Classic</button>
              <button type="button" onClick={() => setPdfTheme('jazz')} style={pdfTheme === 'jazz' ? styles.miniBtnActive : styles.miniBtnInactive}>Jazz</button>
            </div>

            <div style={{ padding: '14px', backgroundColor: isLightMode ? '#eff6ff' : '#27272a', borderRadius: '8px', marginBottom: '16px', border: '1px solid #3b82f6', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', color: isLightMode ? '#1e40af' : '#60a5fa' }}>
                {isPro ? '✨ Pro Tier Active' : '🔒 Free Plan (Watermarked PDFs)'}
              </div>
              <div style={{ fontSize: '12px', color: isLightMode ? '#4b5563' : '#a1a1aa', marginBottom: '12px', textWrap: 'balance', lineHeight: '1.3' }}>
                {isPro ? 'Unlimited charts, transposing, ChordPro exports & clean PDFs active.' : 'Upgrade to Pro for ChordPro exports, transposing & clean PDFs.'}
              </div>
              {!isPro ? (
                <button 
                  type="button" 
                  onClick={() => setShowUpgradeModal(true)} 
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', fontFamily: "'Cal Sans', sans-serif" }}
                >
                  Upgrade to Pro
                </button>
              ) : (
                <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>
                  ✓ Subscription Active
                </div>
              )}
            </div>

            <label style={styles.label}>Paste your lyrics</label>
            <div style={{ fontSize: '12px', color: isLightMode ? '#6b7280' : '#a1a1aa', marginBottom: '6px', lineHeight: '1.3' }}>
              Add section headers (e.g. Verse, Chorus) on separate lines.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', position: 'relative' }}>
              <textarea style={styles.textArea} value={inputText} onChange={e => setInputText(e.target.value)} />
            </div>
            
            <button type="button" style={styles.button} onClick={processLyrics}>Map Lyrics to Canvas</button>
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
              <button type="button" className="top-action-btn" style={styles.actionButton} onClick={handleNewChart}>
                ➕ New
              </button>
              <button type="button" className="top-action-btn" style={styles.actionButton} onClick={() => fileInputRef.current.click()}>
                📂 Load
              </button>
              <button type="button" className="top-action-btn" style={styles.actionButton} onClick={() => setShowPreview(true)} title="Shortcut: Cmd+E / Ctrl+E">
                📤 Export
              </button>
              <div style={{ width: '1px', height: '20px', backgroundColor: isLightMode ? '#d1d5db' : '#3f3f46', margin: '0 4px' }} />
              <button 
                type="button" 
                className="top-action-btn" 
                style={{ 
                  ...styles.actionButton,
                  padding: '8px 12px',
                  opacity: history.length === 0 ? 0.5 : 1, 
                  cursor: history.length === 0 ? 'not-allowed' : 'pointer',
                }} 
                onClick={handleUndo}
                disabled={history.length === 0}
                title="Undo (⌘Z)"
              >
                ↩️
              </button>
              <button 
                type="button" 
                className="top-action-btn" 
                style={{ 
                  ...styles.actionButton,
                  padding: '8px 12px',
                  opacity: redoStack.length === 0 ? 0.5 : 1, 
                  cursor: redoStack.length === 0 ? 'not-allowed' : 'pointer',
                }} 
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                title="Redo (⌘Shift+Z)"
              >
                ↪️
              </button>
            </div>            
            <div style={{ paddingBottom: '12px', marginBottom: '20px', borderBottom: `2px solid ${isLightMode ? '#e5e7eb' : '#27272a'}` }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '6px' }}>
                <h1 style={{ ...styles.songTitleStyle, fontFamily: getThemeFont(pdfTheme) }}>
                  {songTitle || "Nothing's Gonna Stop Us Now"}
                </h1>
                <div style={{ fontStyle: 'italic', fontSize: '13px', color: isLightMode ? '#4b5563' : '#a1a1aa', textAlign: 'center', lineHeight: '1.2', fontFamily: getThemeFont(pdfTheme) }}>
                  <div>Songwriter(s): {composer || "Albert Hammond, Diane Warren"}</div>
                  {(artist || "Starship") !== (composer || "Albert Hammond, Diane Warren") && (
                    <div style={{ marginTop: '1px' }}>Performed by {artist || "Starship"}</div>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'center', fontSize: '15px', fontWeight: 'bold', fontFamily: getThemeFont(pdfTheme) }}>
                <div>Key - {transposeString(songKey || "G", transSteps)}</div>
                {capo && capo !== "0" && <div style={{ fontSize: '13px', fontWeight: 'normal', marginTop: '2px', color: '#4b5563' }}>Capo {capo}</div>}
              </div>
            </div>
            
            {lyricLines.length === 0 ? (
              <p style={{ color: isLightMode ? '#9ca3af' : '#a1a1aa', textAlign: 'center', marginTop: '40px' }}>Paste your lyrics on the left and click "Map" to start charting.</p>
            ) : (
              <div style={{ width: '100%' }}>
                {lyricLines.map(line => (
                  line.isSpacer ? (
                    <div key={line.id} style={{ height: '16px', width: '100%' }}></div>
                  ) : line.isHeader ? (
                    <div key={line.id} style={{ width: '100%', textAlign: 'left', fontWeight: 'bold', fontSize: '16px', marginTop: '24px', marginBottom: '8px', color: isLightMode ? '#1f2937' : '#f4f4f5', fontFamily: getThemeFont(pdfTheme) }}>
                      {line.text}
                    </div>
                  ) : (
                    <div key={line.id} className="lyric-line avoid-break" style={styles.lyricLine}>
                      {line.words.map(w => {
                        const originalChord = chordMap[w.id];
                        const displayChord = formatChordDisplay(originalChord, songKey, transSteps, displayFormat);

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
                            isBold={line.isBold}
                          />
                        );
                      })}
                    </div>
                  )
                ))}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '8px' }}>
              <h2 className="header-title" style={{ ...styles.header, margin: 0, fontSize: '18px', whiteSpace: 'nowrap' }}>
                Chord Palette
              </h2>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button 
                  type="button" 
                  onClick={() => setShowHelpModal(true)} 
                  style={{ background: 'none', border: `1px solid ${isLightMode ? '#d1d5db' : '#3f3f46'}`, color: isLightMode ? '#111827' : '#e4e4e7', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                  title="Quick Guide & Help"
                >
                  ❓
                </button>

                <button 
                  type="button" 
                  onClick={() => setIsLightMode(!isLightMode)} 
                  style={{ background: 'none', border: `1px solid ${isLightMode ? '#d1d5db' : '#3f3f46'}`, color: isLightMode ? '#111827' : '#e4e4e7', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                  title="Toggle Dark/Light Mode"
                >
                  {isLightMode ? '🌙' : '☀️'}
                </button>
              </div>
            </div>

            <label style={styles.label}>Display Format</label>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setDisplayFormat('letters')} style={displayFormat === 'letters' ? styles.miniBtnActive : styles.miniBtnInactive}>Letters</button>
              <button type="button" onClick={() => setDisplayFormat('numbers')} style={displayFormat === 'numbers' ? styles.miniBtnActive : styles.miniBtnInactive}>Numbers</button>
              <button type="button" onClick={() => setDisplayFormat('roman')} style={displayFormat === 'roman' ? styles.miniBtnActive : styles.miniBtnInactive}>Roman</button>
              <button type="button" onClick={() => setDisplayFormat('solfege')} style={displayFormat === 'solfege' ? styles.miniBtnActive : styles.miniBtnInactive}>Do Re Mi</button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Key</label>
                <input 
                  type="text" 
                  style={{...styles.input, marginBottom: 0}} 
                  value={songKey} 
                  onChange={e => {
                    saveSnapshot();
                    setSongKey(e.target.value);
                    setTranspose("0");
                  }} 
                  placeholder="G" 
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Capo</label>
                <input type="number" style={{...styles.input, marginBottom: 0}} value={capo} onChange={e => { saveSnapshot(); setCapo(e.target.value); }} placeholder="0" />
              </div>
              <div style={{ flex: 1 }} onClick={() => { if (!isPro) setShowUpgradeModal(true); }}>
                <label style={{ ...styles.label, color: !isPro ? '#9ca3af' : (isLightMode ? '#4b5563' : '#a1a1aa') }}>
                  {!isPro ? '🔒 Transpose' : 'Transpose'}
                </label>
                <select 
                  disabled={!isPro}
                  style={{
                    ...styles.input, 
                    marginBottom: 0, 
                    padding: '9px',
                    opacity: !isPro ? 0.6 : 1,
                    cursor: !isPro ? 'not-allowed' : 'pointer'
                  }} 
                  value={transpose} 
                  onChange={e => { saveSnapshot(); setTranspose(e.target.value); }}
                >
                  {Array.from({ length: 25 }, (_, i) => i - 12).map(num => (
                    <option key={num} value={num}>{num > 0 ? `+${num}` : num}</option>
                  ))}
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
                  text={formatChordDisplay(chord, songKey, transSteps, displayFormat)} 
                  baseText={chord} 
                  isCustom={false} 
                />
              ))}
              {customPalette.map(chord => (
                <DraggableChord 
                  key={`custom-${chord}`} 
                  id={chord} 
                  text={formatChordDisplay(chord, songKey, transSteps, displayFormat)} 
                  baseText={chord} 
                  isCustom={true} 
                  onDelete={deleteCustomChord} 
                />
              ))}
            </div>

            <div style={{ backgroundColor: isLightMode ? '#f9fafb' : '#27272a', border: `1px solid ${isLightMode ? '#e5e7eb' : 'transparent'}`, padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
              <h3 style={{...styles.subHeader, marginTop: 0}}>Custom Builder</h3>
              
              <label style={styles.label}>Root Note</label>
              <div style={styles.builderRow}>
                {baseLetters.map(r => (
                  <button type="button" key={r} onClick={() => setBRoot(r)} style={bRoot === r ? styles.miniBtnActive : styles.miniBtnInactive}>
                    {formatChordDisplay(r, songKey, transSteps, displayFormat)}
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
                      {formatChordDisplay(b, songKey, transSteps, displayFormat)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                <div style={{ flex: 1, textAlign: 'center', fontSize: '18px', fontWeight: 'bold', color: isLightMode ? '#111827' : 'white', backgroundColor: isLightMode ? '#ffffff' : '#18181b', padding: '8px', borderRadius: '4px', border: `1px solid ${isLightMode ? '#d1d5db' : '#3f3f46'}` }}>
                  {formatChordDisplay(builtChordAbsolute, songKey, transSteps, displayFormat)}
                </div>
                <div style={{ flex: 1 }}>
                  <button type="button" onClick={addCustomChord} style={styles.addBtn}>+ Add</button>
                </div>
              </div>
            </div>

          </div>

        </DndContext>

        {/* --- HELP CENTER MODAL --- */}
        {showHelpModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: isLightMode ? '#ffffff' : '#1e293b', color: isLightMode ? '#0f172a' : '#f8fafc', borderRadius: '16px', padding: '28px', maxWidth: '540px', width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative', textAlign: 'left' }}>
              
              <button 
                type="button" 
                onClick={() => setShowHelpModal(false)}
                style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#9ca3af' }}
              >
                ✕
              </button>

              <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px', fontFamily: "'Cal Sans', sans-serif", display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 20px 0' }}>
                <span>❓</span> Quick Start Guide
              </h2>

              <div style={{ fontSize: '13px', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Section 1 */}
                <div style={{ borderBottom: `1px solid ${isLightMode ? '#f1f5f9' : '#334155'}`, paddingBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#2563eb', margin: '0 0 8px 0', fontFamily: "'Cal Sans', sans-serif" }}>
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
                      <strong>Bold Lines:</strong> Start any lyric line with an asterisk (<code style={kbdStyle(isLightMode)}>*</code>) in the text box to render that entire line in bold text on the chart.
                    </li>
                  </ul>
                </div>

                {/* Section 2 */}
                <div style={{ borderBottom: `1px solid ${isLightMode ? '#f1f5f9' : '#334155'}`, paddingBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#2563eb', margin: '0 0 8px 0', fontFamily: "'Cal Sans', sans-serif" }}>
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
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#2563eb', margin: '0 0 8px 0', fontFamily: "'Cal Sans', sans-serif" }}>
                    3. Custom Builder
                  </h3>
                  <p style={{ margin: 0, color: isLightMode ? '#475569' : '#cbd5e1' }}>
                    Use the right sidebar to assemble custom roots, extensions (<code style={kbdStyle(isLightMode)}>sus4</code>, <code style={kbdStyle(isLightMode)}>maj7</code>), and slash bass notes (<code style={kbdStyle(isLightMode)}>/F#</code>), then click <strong>+ Add</strong>.
                  </p>
                </div>

                {/* Section 4 */}
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#2563eb', margin: '0 0 10px 0', fontFamily: "'Cal Sans', sans-serif" }}>
                    4. Keyboard Shortcuts
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '12px', color: isLightMode ? '#475569' : '#cbd5e1' }}>
                    <div><kbd style={kbdStyle(isLightMode)}>⌘ + Z</kbd> : Undo</div>
                    <div><kbd style={kbdStyle(isLightMode)}>⌘ + Shift + Z</kbd> : Redo</div>
                    <div><kbd style={kbdStyle(isLightMode)}>⌘ + A</kbd> : Select All Chords</div>
                    <div><kbd style={kbdStyle(isLightMode)}>Backspace / Delete</kbd> : Remove Selected Chords</div>
                    <div><kbd style={kbdStyle(isLightMode)}>⌘ + E</kbd> : Export Chart</div>
                    <div><kbd style={kbdStyle(isLightMode)}>⌘ + S</kbd> : Save Session</div>
                    <div><kbd style={kbdStyle(isLightMode)}>⌘ + C / V</kbd> : Copy/Paste Chord</div>
                    <div><kbd style={kbdStyle(isLightMode)}>Esc</kbd> : Deselect / Close</div>
                  </div>
                </div>

              </div>

              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                style={{ marginTop: '24px', width: '100%', padding: '10px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', fontFamily: "'Cal Sans', sans-serif" }}
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
                style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#9ca3af' }}
              >
                ✕
              </button>
              
              <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a', marginBottom: '6px', fontFamily: "'Cal Sans', sans-serif" }}>
                Upgrade to MySongChart Pro
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px', lineHeight: '1.4' }}>
                Unlock key transposing, ChordPro exports, watermark-free PDF downloads, and access to all design themes.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ border: '2px solid #2563eb', borderRadius: '12px', padding: '16px', backgroundColor: '#eff6ff', position: 'relative' }}>
                  <span style={{ position: 'absolute', top: '-10px', right: '14px', backgroundColor: '#2563eb', color: '#ffffff', fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px' }}>
                    SAVE 33%
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '15px' }}>Annual Billing</span>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: '#2563eb' }}>$39.99<span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal' }}>/yr</span></span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>Billed as $39.99/year upfront (~$3.33/mo).</p>
                  <button
                    type="button"
                    onClick={handleUpgradeAnnual}
                    style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', fontFamily: "'Cal Sans', sans-serif" }}
                  >
                    Get Annual Plan (Best Value)
                  </button>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', backgroundColor: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '15px' }}>Monthly Billing</span>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>$4.99<span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal' }}>/mo</span></span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>Pay month-to-month. Cancel anytime.</p>
                  <button
                    type="button"
                    onClick={handleUpgradeMonthly}
                    style={{ width: '100%', padding: '10px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', fontFamily: "'Cal Sans', sans-serif" }}
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
                <span style={{ fontWeight: '600', fontSize: '16px' }}>
                  Export Chart ({pdfTheme.toUpperCase()} Style) {!isPro && '— 🔒 Free Preview'}
                </span>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setShowPreview(false)} style={{ padding: '8px 16px', backgroundColor: '#e5e5eb', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Cancel (Esc)</button>
                  <button type="button" onClick={handleExportChordPro} style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>{!isPro && '🔒 '}Export ChordPro</button>
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
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔒</div>
                      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Preview Blurred</h3>
                      <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '16px', lineHeight: '1.4', textWrap: 'balance' }}>
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
                          fontSize: '14px',
                          width: '100%',
                          fontFamily: "'Cal Sans', sans-serif"
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
                            <div>Songwriter(s): {composer || "Albert Hammond, Diane Warren"}</div>
                            {(artist || "Starship") !== (composer || "Albert Hammond, Diane Warren") && (
                              <div style={{ marginTop: '1px' }}>Performed by {artist || "Starship"}</div>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '15px', fontWeight: 'bold', color: '#111827', fontFamily: getThemeFont(pdfTheme) }}>
                          <div>Key - {transposeString(songKey || "G", transSteps)}</div>
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
                              const displayChord = formatChordDisplay(originalChord, songKey, transSteps, displayFormat);
                              const isEmptyBeat = w.text === '_';
                              let chordColor = '#1e3a8a';
                              if (pdfTheme === 'classic') chordColor = '#000000';
                              if (pdfTheme === 'jazz') chordColor = '#000000'; 

                              return (
                                <div key={w.id} className="canvas-word" style={{ display: 'inline-flex', flexDirection: 'column', margin: '0 10px 0 0', minWidth: isEmptyBeat ? '30px' : '18px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                  <div style={{ height: '18px', width: '100%', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '1px' }}>
                                    {displayChord && (
                                      <span style={{ color: chordColor, fontSize: '14px', fontWeight: 'bold', fontFamily: getThemeFont(pdfTheme) }}>
                                        {displayChord}
                                      </span>
                                    )}
                                  </div>
                                  <div className="word-text" style={{ fontSize: '12pt', color: isEmptyBeat ? 'transparent' : '#111827', whiteSpace: 'pre', fontFamily: getThemeFont(pdfTheme), fontWeight: line.isBold ? 'bold' : undefined }}>
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
                        fontFamily: "'Cal Sans', sans-serif"
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
    </>
  );
}