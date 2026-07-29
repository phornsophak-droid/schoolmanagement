import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';

interface MoneyGameProps {
  onBack: () => void;
}

// All Cambodian Riel banknotes in circulation (៥០ ដល់ ២០០០០០ រៀល). The `color`
// is only a fallback block shown when the real photo (public/assets/money/N.jpg)
// is missing; when the photo loads it covers the block.
const NOTES = [
  { value: 50, color: 'bg-lime-600', label: '៥០ ៛', image: '/assets/money/50.jpg' },
  { value: 100, color: 'bg-red-500', label: '១០០ ៛', image: '/assets/money/100.jpg' },
  { value: 200, color: 'bg-green-600', label: '២០០ ៛', image: '/assets/money/200.jpg' },
  { value: 500, color: 'bg-red-600', label: '៥០០ ៛', image: '/assets/money/500.jpg' },
  { value: 1000, color: 'bg-indigo-600', label: '១០០០ ៛', image: '/assets/money/1000.jpg' },
  { value: 2000, color: 'bg-emerald-600', label: '២០០០ ៛', image: '/assets/money/2000.jpg' },
  { value: 5000, color: 'bg-amber-700', label: '៥០០០ ៛', image: '/assets/money/5000.jpg' },
  { value: 10000, color: 'bg-purple-600', label: '១០០០០ ៛', image: '/assets/money/10000.jpg' },
  { value: 15000, color: 'bg-teal-600', label: '១៥០០០ ៛', image: '/assets/money/15000.jpg' },
  { value: 20000, color: 'bg-blue-700', label: '២០០០០ ៛', image: '/assets/money/20000.jpg' },
  { value: 30000, color: 'bg-orange-600', label: '៣០០០០ ៛', image: '/assets/money/30000.jpg' },
  { value: 50000, color: 'bg-green-700', label: '៥០០០០ ៛', image: '/assets/money/50000.jpg' },
  { value: 100000, color: 'bg-teal-700', label: '១០០០០០ ៛', image: '/assets/money/100000.jpg' },
  { value: 200000, color: 'bg-fuchsia-700', label: '២០០០០០ ៛', image: '/assets/money/200000.jpg' },
];

export default function MoneyGame({ onBack }: MoneyGameProps) {
  const [currentNotes, setCurrentNotes] = useState<{ value: number; color: string; label: string; image: string; x: number; y: number; rot: number }[]>([]);
  const [targetTotal, setTargetTotal] = useState(0);
  const [options, setOptions] = useState<number[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);

  const generateProblem = () => {
    // Generate 2 to 5 random notes
    const numNotes = Math.floor(Math.random() * 4) + 2;
    const generatedNotes = [];
    let total = 0;

    for (let i = 0; i < numNotes; i++) {
      const noteDef = NOTES[Math.floor(Math.random() * NOTES.length)];
      total += noteDef.value;
      generatedNotes.push({
        ...noteDef,
        x: Math.random() * 40 - 20, // -20 to 20px offset
        y: Math.random() * 40 - 20,
        rot: Math.random() * 30 - 15, // -15 to 15deg rotation
      });
    }

    setCurrentNotes(generatedNotes);
    setTargetTotal(total);

    // Generate options. Wrong answers = "miscounted one of the notes in the pile"
    // (total ± the value of a note that is actually shown), so distractors stay in
    // scale whether the pile is tiny (៥០៛) or large (២០០០០០៛).
    const noteValues = generatedNotes.map(n => n.value);
    const opts = new Set<number>([total]);
    let guard = 0;
    while (opts.size < 4 && guard++ < 60) {
      const v = noteValues[Math.floor(Math.random() * noteValues.length)];
      const wrong = total + (Math.random() < 0.5 ? -v : v);
      if (wrong > 0 && wrong !== total) opts.add(wrong);
    }
    // Rare fallback (e.g. a pile of two identical smallest notes) — top up to 4.
    let pad = 1;
    while (opts.size < 4) { const w = total + pad * 50; if (w > 0 && w !== total) opts.add(w); pad++; }

    setOptions(Array.from(opts).sort((a, b) => a - b));
    setSelectedOption(null);
    setIsCorrect(false);
  };

  useEffect(() => {
    generateProblem();
  }, []);

  const handleSelect = (opt: number) => {
    if (selectedOption !== null) return;
    
    setSelectedOption(opt);
    
    if (opt === targetTotal) {
      setIsCorrect(true);
      setScore(s => s + 1);
      setTimeout(() => {
        generateProblem();
      }, 1500);
    } else {
      setIsCorrect(false);
      setTimeout(() => {
        setSelectedOption(null);
      }, 1500);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <span>💵</span> ស្គាល់លុយរៀល
          </h1>
        </div>
        <div className="px-3 py-1 bg-green-100 text-green-700 font-bold rounded-full text-sm">
          ពិន្ទុ: {score}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200 max-w-lg w-full flex flex-col items-center text-center">
          
          <h2 className="text-xl text-slate-800 font-bold mb-8">
            តើលុយទាំងអស់មានចំនួនប៉ុន្មាន?
          </h2>

          {/* Notes are laid out side by side (flex-wrap), not stacked, so pupils can
              see every note and add them all up. A tiny tilt keeps it lively. */}
          <div className="mb-12 w-full min-h-48 flex flex-wrap items-center justify-center gap-3 bg-slate-100 rounded-xl border border-slate-200 p-4">
            {currentNotes.map((note, idx) => (
              <div
                key={idx}
                className={`relative w-28 sm:w-32 h-16 ${note.color} rounded-md shadow-md flex items-center justify-center border-2 border-white/20 overflow-hidden shrink-0`}
                style={{ transform: `rotate(${note.rot * 0.25}deg)` }}
              >
                <img
                  src={note.image}
                  alt={note.label}
                  className="absolute inset-0 w-full h-full object-cover z-10"
                  onError={(e) => {
                    // Fallback to color block if image doesn't exist
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="w-full h-full m-1 border border-white/30 rounded flex items-center justify-center relative z-0">
                  <span className="text-white font-bold text-sm sm:text-base drop-shadow-md">
                    {note.label}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 w-full">
            {options.map((opt, i) => {
              const isSelected = selectedOption === opt;
              const isActuallyCorrect = opt === targetTotal;
              
              let btnClass = "py-4 px-6 rounded-2xl font-black text-xl transition-all border-2 ";
              
              if (selectedOption === null) {
                btnClass += "bg-white border-slate-200 text-slate-700 hover:border-green-500 hover:text-green-600 shadow-sm";
              } else if (isActuallyCorrect) {
                btnClass += "bg-green-50 border-green-500 text-green-600 scale-105 shadow-md";
              } else if (isSelected && !isCorrect) {
                btnClass += "bg-red-50 border-red-500 text-red-600 animate-shake";
              } else {
                btnClass += "bg-slate-50 border-slate-100 text-slate-300 opacity-50";
              }

              return (
                <button
                  key={i}
                  onClick={() => handleSelect(opt)}
                  disabled={selectedOption !== null}
                  className={btnClass}
                >
                  <div className="flex items-center justify-center gap-2">
                    {opt.toLocaleString()} ៛
                    {selectedOption !== null && isActuallyCorrect && <Check size={24} />}
                    {isSelected && !isActuallyCorrect && <X size={24} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
