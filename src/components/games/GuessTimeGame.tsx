import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';

interface GuessTimeGameProps {
  onBack: () => void;
}

export default function GuessTimeGame({ onBack }: GuessTimeGameProps) {
  const [targetHour, setTargetHour] = useState(12);
  const [targetMinute, setTargetMinute] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);

  const generateOptions = (hour: number, minute: number) => {
    const correct = `${hour}:${minute.toString().padStart(2, '0')}`;
    const opts = new Set([correct]);
    
    while (opts.size < 4) {
      const h = Math.floor(Math.random() * 12) + 1;
      const m = Math.floor(Math.random() * 12) * 5; // Multiples of 5
      opts.add(`${h}:${m.toString().padStart(2, '0')}`);
    }
    
    // Shuffle
    return Array.from(opts).sort(() => Math.random() - 0.5);
  };

  const generateProblem = () => {
    const h = Math.floor(Math.random() * 12) + 1;
    const m = Math.floor(Math.random() * 12) * 5; // Multiples of 5
    
    setTargetHour(h);
    setTargetMinute(m);
    setOptions(generateOptions(h, m));
    setSelectedOption(null);
    setIsCorrect(false);
  };

  useEffect(() => {
    generateProblem();
  }, []);

  const handleSelect = (opt: string) => {
    if (selectedOption !== null) return; // already answered
    
    setSelectedOption(opt);
    const correct = `${targetHour}:${targetMinute.toString().padStart(2, '0')}`;
    
    if (opt === correct) {
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

  // Clock calculations
  // Minute hand: 360deg / 60min = 6deg per minute
  // Hour hand: 360deg / 12hr = 30deg per hour + (minute / 60) * 30deg
  const minuteAngle = targetMinute * 6;
  const hourAngle = (targetHour % 12) * 30 + (targetMinute / 60) * 30;

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
            <span>⏰</span> ល្បែងទាយម៉ោង
          </h1>
        </div>
        <div className="px-3 py-1 bg-blue-100 text-blue-700 font-bold rounded-full text-sm">
          ពិន្ទុ: {score}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full flex flex-col items-center text-center">
          
          <h2 className="text-xl text-slate-800 font-bold mb-8">
            តើនាឡិកានេះចង្អុលម៉ោងប៉ុន្មាន?
          </h2>

          {/* Clock SVG */}
          <div className="relative mb-10 bg-slate-100 rounded-full shadow-inner p-4">
            <svg width="200" height="200" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="95" fill="white" stroke="#334155" strokeWidth="6" />
              
              {/* Hour markers */}
              {[...Array(12)].map((_, i) => {
                const angle = (i * 30 - 90) * (Math.PI / 180);
                const x1 = 100 + 80 * Math.cos(angle);
                const y1 = 100 + 80 * Math.sin(angle);
                const x2 = 100 + 90 * Math.cos(angle);
                const y2 = 100 + 90 * Math.sin(angle);
                return (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748B" strokeWidth="4" strokeLinecap="round" />
                );
              })}

              {/* Minute markers */}
              {[...Array(60)].map((_, i) => {
                if (i % 5 === 0) return null; // skip hour markers
                const angle = (i * 6 - 90) * (Math.PI / 180);
                const x1 = 100 + 85 * Math.cos(angle);
                const y1 = 100 + 85 * Math.sin(angle);
                const x2 = 100 + 90 * Math.cos(angle);
                const y2 = 100 + 90 * Math.sin(angle);
                return (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
                );
              })}

              {/* Hour hand */}
              <line 
                x1="100" y1="100" 
                x2={100 + 50 * Math.cos((hourAngle - 90) * Math.PI / 180)} 
                y2={100 + 50 * Math.sin((hourAngle - 90) * Math.PI / 180)} 
                stroke="#1E293B" strokeWidth="8" strokeLinecap="round" 
              />
              
              {/* Minute hand */}
              <line 
                x1="100" y1="100" 
                x2={100 + 75 * Math.cos((minuteAngle - 90) * Math.PI / 180)} 
                y2={100 + 75 * Math.sin((minuteAngle - 90) * Math.PI / 180)} 
                stroke="#3B82F6" strokeWidth="6" strokeLinecap="round" 
              />

              {/* Center dot */}
              <circle cx="100" cy="100" r="6" fill="#EF4444" />
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full">
            {options.map((opt, i) => {
              const isSelected = selectedOption === opt;
              const isActuallyCorrect = opt === `${targetHour}:${targetMinute.toString().padStart(2, '0')}`;
              
              let btnClass = "py-4 px-6 rounded-2xl font-black text-2xl transition-all border-2 ";
              
              if (selectedOption === null) {
                btnClass += "bg-white border-slate-200 text-slate-700 hover:border-blue-500 hover:text-blue-600 shadow-sm";
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
                    {opt}
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
