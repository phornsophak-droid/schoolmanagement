import React, { useState } from 'react';
import { X, Dices } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function RandomizerGame({ onBack }: { onBack: () => void }) {
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(40);
  const [result, setResult] = useState<number | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  const generateRandom = () => {
    if (min >= max) return;
    
    setIsSpinning(true);
    
    // Fake spinning effect
    let spins = 0;
    const interval = setInterval(() => {
      setResult(Math.floor(Math.random() * (max - min + 1)) + min);
      spins++;
      if (spins > 15) {
        clearInterval(interval);
        setResult(Math.floor(Math.random() * (max - min + 1)) + min);
        setIsSpinning(false);
      }
    }, 100);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 relative">
      <button onClick={onBack} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200">
        <X size={24} className="text-slate-600" />
      </button>
      
      <h2 className="text-2xl font-bold text-slate-800 mb-8 flex items-center gap-3">
        ចាប់លេខរៀងចៃដន្យ <Dices className="text-red-500" />
      </h2>
      
      <div className="flex gap-4 mb-12">
        <div className="flex flex-col items-center">
          <label className="text-sm font-bold text-slate-500 mb-2">ចាប់ពីលេខ</label>
          <input 
            type="number" 
            value={min} 
            onChange={(e) => setMin(Number(e.target.value))}
            className="text-center w-24 h-14 text-2xl font-bold rounded-xl border-2 border-slate-200 focus:border-red-500"
          />
        </div>
        <div className="text-2xl font-bold text-slate-400 mt-10">-</div>
        <div className="flex flex-col items-center">
          <label className="text-sm font-bold text-slate-500 mb-2">ដល់លេខ</label>
          <input 
            type="number" 
            value={max} 
            onChange={(e) => setMax(Number(e.target.value))}
            className="text-center w-24 h-14 text-2xl font-bold rounded-xl border-2 border-slate-200 focus:border-red-500"
          />
        </div>
      </div>

      <div className="h-48 flex items-center justify-center mb-10">
        <AnimatePresence mode="wait">
          {result !== null ? (
            <motion.div
              key={result}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className={`text-8xl font-black tabular-nums ${isSpinning ? 'text-slate-400' : 'text-red-500 drop-shadow-md'}`}
            >
              {result}
            </motion.div>
          ) : (
            <div className="text-slate-300 text-6xl font-black">?</div>
          )}
        </AnimatePresence>
      </div>

      <button 
        onClick={generateRandom}
        disabled={isSpinning}
        className="px-10 py-5 bg-red-500 text-white text-2xl font-black rounded-2xl shadow-lg hover:bg-red-600 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
      >
        ចាប់ផ្តើម (Randomize)
      </button>
    </div>
  );
}
