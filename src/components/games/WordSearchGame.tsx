import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, RotateCcw, CheckCircle2, Trophy } from 'lucide-react';
import { playKhmerClip, speakKhmer } from '../../lib/khmerSpeech';

interface WordSearchGameProps {
  onBack: () => void;
}

const LEVELS = [
  { level: 1, words: ['សី', 'សោ', 'សេះ', 'សួរ', 'ហូរ', 'ហើរ', 'ហោះ'] },
  { level: 2, words: ['ដី', 'ដៃ', 'ដុំ', 'ដំ', 'ដាំ', 'ដុះ', 'ដូរ', 'ដើរ'] },
  { level: 3, words: ['កា', 'កោ', 'តៅ', 'ថៃ', 'ថ្នាំ', 'ថេរ', 'ចំណេះ', 'ចំណាំ'] },
  { level: 4, words: ['អគារ', 'បរិវេណ', 'អនាម័យ', 'ព័ទ្ធ', 'ជានិច្ច', 'ពាក្យស្លោក'] },
  { level: 5, words: ['សរសរ', 'សរសើរ', 'ហូរហែរ', 'សំណួរ', 'សមាគម', 'ស្ថិរភាព'] }
];

const KHMER_CONSONANTS = ['ក','ខ','គ','ឃ','ង','ច','ឆ','ជ','ឈ','ញ','ដ','ឋ','ឌ','ឍ','ណ','ត','ថ','ទ','ធ','ន','ប','ផ','ព','ភ','ម','យ','រ','ល','វ','ស','ហ','ឡ','អ'];
const KHMER_VOWELS = ['', '', '', 'ា', 'ិ', 'ី', 'ឹ', 'ឺ', 'ុ', 'ូ', 'ួ', 'ើ', 'ឿ', 'ៀ', 'េ', 'ែ', 'ៃ', 'ោ', 'ៅ', 'ុំ', 'ំ', 'ាំ', 'ះ', 'ុះ'];

// Helper to split a word into its grapheme clusters
function segmentKhmer(word: string): string[] {
  if (!window.Intl || !Intl.Segmenter) {
    // Fallback if Segmenter is not supported (very rare in modern browsers)
    return word.split('');
  }
  const segmenter = new Intl.Segmenter('km', { granularity: 'grapheme' });
  return Array.from(segmenter.segment(word)).map(s => s.segment);
}

function generateGrid(words: string[], size: number = 10) {
  const grid: (string | null)[][] = Array(size).fill(null).map(() => Array(size).fill(null));
  
  // Try to place each word
  words.forEach(word => {
    const graphemes = segmentKhmer(word);
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 200) {
      attempts++;
      const dir = Math.floor(Math.random() * 4); 
      // 0: right, 1: down, 2: diag-down-right, 3: diag-up-right
      let dr = 0, dc = 0;
      if (dir === 0) dc = 1;
      else if (dir === 1) dr = 1;
      else if (dir === 2) { dr = 1; dc = 1; }
      else if (dir === 3) { dr = -1; dc = 1; }
      
      const r = Math.floor(Math.random() * size);
      const c = Math.floor(Math.random() * size);
      
      const endR = r + dr * (graphemes.length - 1);
      const endC = c + dc * (graphemes.length - 1);
      
      if (endR >= 0 && endR < size && endC >= 0 && endC < size) {
        let conflict = false;
        for (let i = 0; i < graphemes.length; i++) {
          const cellR = r + dr * i;
          const cellC = c + dc * i;
          if (grid[cellR][cellC] !== null && grid[cellR][cellC] !== graphemes[i]) {
            conflict = true;
            break;
          }
        }
        if (!conflict) {
          for (let i = 0; i < graphemes.length; i++) {
            grid[r + dr * i][c + dc * i] = graphemes[i];
          }
          placed = true;
        }
      }
    }
  });
  
  // Fill empty cells
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === null) {
        const cons = KHMER_CONSONANTS[Math.floor(Math.random() * KHMER_CONSONANTS.length)];
        const vow = KHMER_VOWELS[Math.floor(Math.random() * KHMER_VOWELS.length)];
        grid[r][c] = cons + vow;
      }
    }
  }
  
  return grid as string[][];
}

export default function WordSearchGame({ onBack }: WordSearchGameProps) {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [grid, setGrid] = useState<string[][]>([]);
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set());
  
  const [selectedStart, setSelectedStart] = useState<{r: number, c: number} | null>(null);
  const [hoverEnd, setHoverEnd] = useState<{r: number, c: number} | null>(null);

  const levelData = LEVELS[currentLevel];
  const size = 10;

  const initGame = useCallback(() => {
    setGrid(generateGrid(levelData.words, size));
    setFoundWords([]);
    setFoundCells(new Set());
    setSelectedStart(null);
    setHoverEnd(null);
  }, [levelData]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const getLineCells = (r1: number, c1: number, r2: number, c2: number) => {
    const dr = r2 - r1;
    const dc = c2 - c1;
    if (dr === 0 && dc === 0) return [{r: r1, c: c1}];
    
    if (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) {
      const steps = Math.max(Math.abs(dr), Math.abs(dc));
      const stepR = dr / steps;
      const stepC = dc / steps;
      
      const cells = [];
      for (let i = 0; i <= steps; i++) {
        cells.push({ r: r1 + i * stepR, c: c1 + i * stepC });
      }
      return cells;
    }
    return null; // Not a straight line
  };

  const handleCellClick = (r: number, c: number) => {
    if (!selectedStart) {
      setSelectedStart({r, c});
      playKhmerClip('tap', '', { volume: 0.5 });
    } else {
      if (selectedStart.r === r && selectedStart.c === c) {
        setSelectedStart(null); // Deselect
        return;
      }
      
      const line = getLineCells(selectedStart.r, selectedStart.c, r, c);
      if (line) {
        const wordFormed = line.map(cell => grid[cell.r][cell.c]).join('');
        const reversedFormed = line.map(cell => grid[cell.r][cell.c]).reverse().join('');
        
        let matchedWord = levelData.words.find(w => {
          const segs = segmentKhmer(w).join('');
          return segs === wordFormed || segs === reversedFormed;
        });

        if (matchedWord && !foundWords.includes(matchedWord)) {
          // Found!
          setFoundWords(prev => [...prev, matchedWord!]);
          setFoundCells(prev => {
            const next = new Set(prev);
            line.forEach(cell => next.add(`${cell.r},${cell.c}`));
            return next;
          });
          playKhmerClip('correct', 'ត្រឹមត្រូវ', { rate: 1.2 });
          speakKhmer(matchedWord);
        } else {
          // Wrong
          playKhmerClip('wrong', 'មិនត្រឹមត្រូវ', { rate: 1.2 });
        }
      } else {
        playKhmerClip('wrong', '', { volume: 0.5 });
      }
      setSelectedStart(null);
      setHoverEnd(null);
    }
  };

  const isLevelComplete = foundWords.length === levelData.words.length;

  useEffect(() => {
    if (isLevelComplete && foundWords.length > 0) {
      playKhmerClip('win', 'អបអរសាទរ អ្នកឈ្នះហើយ!', { rate: 1.1 });
    }
  }, [isLevelComplete]);

  const nextLevel = () => {
    if (currentLevel < LEVELS.length - 1) {
      setCurrentLevel(prev => prev + 1);
    } else {
      setCurrentLevel(0); // Loop back
    }
  };

  // Determine which cells are in the current drawing line
  const currentLine = useMemo(() => {
    if (!selectedStart || !hoverEnd) return new Set<string>();
    const line = getLineCells(selectedStart.r, selectedStart.c, hoverEnd.r, hoverEnd.c);
    if (!line) return new Set<string>();
    return new Set(line.map(cell => `${cell.r},${cell.c}`));
  }, [selectedStart, hoverEnd]);

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <span>🔎</span> ស្វែងរកពាក្យ
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-blue-100 text-blue-700 font-bold rounded-full text-sm">
            កម្រិត {currentLevel + 1}
          </div>
          <button 
            onClick={initGame}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
            title="លេងសារថ្មី"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 flex flex-col lg:flex-row items-center lg:items-start gap-8 justify-center">
        {/* Game Grid */}
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 shrink-0">
          <div 
            className="grid gap-1 md:gap-2"
            style={{ 
              gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
              width: 'min(90vw, 500px)',
              height: 'min(90vw, 500px)'
            }}
          >
            {grid.map((row, r) => (
              row.map((cell, c) => {
                const key = `${r},${c}`;
                const isFound = foundCells.has(key);
                const isStart = selectedStart?.r === r && selectedStart?.c === c;
                const isLine = currentLine.has(key);
                
                let bgClass = "bg-slate-50 hover:bg-blue-50";
                let textClass = "text-slate-700";
                
                if (isFound) {
                  bgClass = "bg-green-100 border-green-300 shadow-inner";
                  textClass = "text-green-800 font-bold";
                } else if (isStart) {
                  bgClass = "bg-blue-500 shadow-md ring-2 ring-blue-300 ring-offset-2";
                  textClass = "text-white font-bold";
                } else if (isLine) {
                  bgClass = "bg-blue-200";
                  textClass = "text-blue-900";
                }

                return (
                  <button
                    key={key}
                    onClick={() => handleCellClick(r, c)}
                    onMouseEnter={() => selectedStart && setHoverEnd({r, c})}
                    className={`
                      ${bgClass} ${textClass}
                      border border-slate-200 rounded-lg md:rounded-xl
                      flex items-center justify-center
                      text-lg md:text-2xl
                      transition-all duration-200 select-none
                    `}
                  >
                    {cell}
                  </button>
                );
              })
            ))}
          </div>
        </div>

        {/* Word List */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 w-full lg:w-80 shrink-0">
          <h2 className="font-bold text-xl text-slate-800 mb-4 pb-2 border-b border-slate-100">
            ពាក្យត្រូវស្វែងរក
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            {levelData.words.map(word => {
              const found = foundWords.includes(word);
              return (
                <div 
                  key={word}
                  className={`
                    flex items-center gap-3 p-3 rounded-xl transition-all
                    ${found ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-700'}
                  `}
                >
                  {found ? <CheckCircle2 size={20} className="text-green-500" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-300" />}
                  <span className={`text-lg ${found ? 'font-bold line-through opacity-70' : 'font-medium'}`}>
                    {word}
                  </span>
                </div>
              );
            })}
          </div>

          {isLevelComplete && (
            <div className="mt-8 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4">
              <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-3">
                <Trophy size={32} />
              </div>
              <h3 className="font-bold text-xl text-slate-800 mb-4">ជយោ! ឈ្នះហើយ</h3>
              <button
                onClick={nextLevel}
                className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                លេងកម្រិតបន្ទាប់
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
