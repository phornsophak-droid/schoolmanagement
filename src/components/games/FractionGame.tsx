import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, RefreshCw } from 'lucide-react';

interface FractionGameProps {
  onBack: () => void;
}

export default function FractionGame({ onBack }: FractionGameProps) {
  const [targetNumerator, setTargetNumerator] = useState(1);
  const [targetDenominator, setTargetDenominator] = useState(2);
  const [selectedSlices, setSelectedSlices] = useState<number[]>([]);
  const [isCorrect, setIsCorrect] = useState(false);
  const [level, setLevel] = useState(1);

  const generateLevel = () => {
    let denom = Math.floor(Math.random() * 5) + 2; // 2 to 6
    if (level > 3) denom = Math.floor(Math.random() * 7) + 2; // 2 to 8
    if (level > 6) denom = Math.floor(Math.random() * 9) + 2; // 2 to 10
    
    let num = Math.floor(Math.random() * (denom - 1)) + 1; // 1 to denom-1
    
    setTargetDenominator(denom);
    setTargetNumerator(num);
    setSelectedSlices([]);
    setIsCorrect(false);
  };

  useEffect(() => {
    generateLevel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const toggleSlice = (index: number) => {
    if (isCorrect) return;
    
    let newSelected;
    if (selectedSlices.includes(index)) {
      newSelected = selectedSlices.filter(i => i !== index);
    } else {
      newSelected = [...selectedSlices, index];
    }
    
    setSelectedSlices(newSelected);
    
    if (newSelected.length === targetNumerator) {
      setIsCorrect(true);
    }
  };

  const getSlices = () => {
    const slices = [];
    const angle = 360 / targetDenominator;
    const radius = 100;
    const cx = 120;
    const cy = 120;

    for (let i = 0; i < targetDenominator; i++) {
      const startAngle = (i * angle - 90) * (Math.PI / 180);
      const endAngle = ((i + 1) * angle - 90) * (Math.PI / 180);
      
      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(endAngle);
      const y2 = cy + radius * Math.sin(endAngle);

      // if denominator is 1, it's a full circle, but we restrict denominator >= 2
      const largeArcFlag = angle > 180 ? 1 : 0;
      
      const pathData = [
        `M ${cx} ${cy}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ');

      const isSelected = selectedSlices.includes(i);

      slices.push(
        <path
          key={i}
          d={pathData}
          fill={isSelected ? '#EF4444' : '#F8FAFC'}
          stroke="#94A3B8"
          strokeWidth="2"
          className="cursor-pointer transition-colors hover:opacity-80"
          onClick={() => toggleSlice(i)}
        />
      );
    }
    return slices;
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
            <span>🍕</span> ល្បែងប្រភាគ
          </h1>
        </div>
        <div className="px-3 py-1 bg-blue-100 text-blue-700 font-bold rounded-full text-sm">
          កម្រិត {level}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full flex flex-col items-center text-center">
          
          <h2 className="text-xl text-slate-600 font-medium mb-6">
            សូមលាបពណ៌ <strong className="text-2xl text-red-500 mx-2">{targetNumerator}/{targetDenominator}</strong> នៃរង្វង់
          </h2>

          <div className="relative mb-8">
            <svg width="240" height="240" viewBox="0 0 240 240" className="drop-shadow-md">
              <circle cx="120" cy="120" r="100" fill="#fff" stroke="#94A3B8" strokeWidth="2" />
              {getSlices()}
            </svg>
            
            {isCorrect && (
              <div className="absolute inset-0 flex items-center justify-center animate-in fade-in zoom-in duration-300">
                <div className="bg-green-500 text-white rounded-full p-4 shadow-lg flex items-center justify-center">
                  <Check size={48} strokeWidth={3} />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4 w-full">
            <button
              onClick={() => setSelectedSlices([])}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} /> លុបពណ៌ចេញ
            </button>
            
            <button
              onClick={() => {
                if (isCorrect) setLevel(l => l + 1);
              }}
              disabled={!isCorrect}
              className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                isCorrect 
                  ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/20 translate-y-0' 
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'
              }`}
            >
              កម្រិតបន្ទាប់
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
