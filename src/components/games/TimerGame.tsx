import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, X } from 'lucide-react';

export default function TimerGame({ onBack }: { onBack: () => void }) {
  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(minutes * 60 + seconds);

  useEffect(() => {
    setTimeLeft(minutes * 60 + seconds);
  }, [minutes, seconds]);

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggleTimer = () => {
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(minutes * 60 + seconds);
  };

  const displayMins = Math.floor(timeLeft / 60);
  const displaySecs = timeLeft % 60;

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 relative">
      <button onClick={onBack} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200">
        <X size={24} className="text-slate-600" />
      </button>
      
      <h2 className="text-2xl font-bold text-slate-800 mb-8">នាឡិកាកំណត់ម៉ោង (Timer)</h2>
      
      {!isActive && timeLeft === minutes * 60 + seconds ? (
        <div className="flex gap-4 mb-8">
          <div className="flex flex-col items-center">
            <label className="text-sm text-slate-500 mb-2">នាទី</label>
            <input 
              type="number" 
              min="0" 
              max="60"
              value={minutes} 
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="text-center w-24 h-16 text-3xl font-bold rounded-xl border-2 border-slate-200 focus:border-blue-500"
            />
          </div>
          <div className="text-4xl font-bold text-slate-300 mt-8">:</div>
          <div className="flex flex-col items-center">
            <label className="text-sm text-slate-500 mb-2">វិនាទី</label>
            <input 
              type="number" 
              min="0" 
              max="59"
              value={seconds} 
              onChange={(e) => setSeconds(Number(e.target.value))}
              className="text-center w-24 h-16 text-3xl font-bold rounded-xl border-2 border-slate-200 focus:border-blue-500"
            />
          </div>
        </div>
      ) : (
        <div className="text-8xl font-black text-slate-800 tracking-tighter mb-12 tabular-nums">
          {String(displayMins).padStart(2, '0')}:{String(displaySecs).padStart(2, '0')}
        </div>
      )}

      <div className="flex gap-4">
        <button 
          onClick={toggleTimer}
          className={`flex items-center gap-2 px-8 py-4 rounded-2xl text-xl font-bold text-white transition-transform hover:scale-105 ${isActive ? 'bg-amber-500' : 'bg-blue-600'}`}
        >
          {isActive ? <><Pause size={24} /> ផ្អាក</> : <><Play size={24} /> ចាប់ផ្តើម</>}
        </button>
        
        <button 
          onClick={resetTimer}
          className="flex items-center gap-2 px-8 py-4 rounded-2xl text-xl font-bold text-slate-600 bg-slate-200 transition-transform hover:scale-105 hover:bg-slate-300"
        >
          <RotateCcw size={24} /> សារឡើងវិញ
        </button>
      </div>
    </div>
  );
}
