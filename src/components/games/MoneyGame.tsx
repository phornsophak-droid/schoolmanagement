import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';

interface MoneyGameProps {
  onBack: () => void;
}

const NOTES = [
  { value: 100, color: 'bg-orange-600', label: '១០០ ៛' },
  { value: 500, color: 'bg-red-600', label: '៥០០ ៛' },
  { value: 1000, color: 'bg-blue-600', label: '១០០០ ៛' },
  { value: 2000, color: 'bg-green-600', label: '២០០០ ៛' },
  { value: 5000, color: 'bg-green-700', label: '៥០០០ ៛' },
];

export default function MoneyGame({ onBack }: MoneyGameProps) {
  const [currentNotes, setCurrentNotes] = useState<{ value: number; color: string; label: string; x: number; y: number; rot: number }[]>([]);
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

    // Generate options
    const opts = new Set([total]);
    while (opts.size < 4) {
      // Generate plausible wrong answers
      const wrongBase = total + (Math.floor(Math.random() * 5) - 2) * 500;
      if (wrongBase > 0 && wrongBase !== total) {
        opts.add(wrongBase);
      }
    }
    
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

          <div className="relative mb-12 w-full h-48 flex items-center justify-center bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
            {currentNotes.map((note, idx) => (
              <div 
                key={idx}
                className={`absolute w-40 h-20 ${note.color} rounded-md shadow-md flex items-center justify-center border-2 border-white/20`}
                style={{ 
                  transform: `translate(${note.x}px, ${note.y}px) rotate(${note.rot}deg)`,
                  zIndex: idx 
                }}
              >
                <div className="w-full h-full m-1 border border-white/30 rounded flex items-center justify-center">
                  <span className="text-white font-bold text-xl drop-shadow-md">
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
