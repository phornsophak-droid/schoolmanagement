import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, RotateCcw, Clock } from 'lucide-react';

interface EvenOddGameProps {
  onBack: () => void;
}

export default function EvenOddGame({ onBack }: EvenOddGameProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [currentNumber, setCurrentNumber] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [animationClass, setAnimationClass] = useState('');

  const generateProblem = () => {
    const num = Math.floor(Math.random() * 99) + 1; // 1 to 99
    setCurrentNumber(num);
    setAnimationClass('animate-in zoom-in duration-300');
    setTimeout(() => setAnimationClass(''), 300);
  };

  const startGame = () => {
    setIsPlaying(true);
    setGameOver(false);
    setScore(0);
    setTimeLeft(30);
    generateProblem();
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(t => t - 1);
      }, 1000);
    } else if (timeLeft === 0 && isPlaying) {
      setIsPlaying(false);
      setGameOver(true);
    }
    return () => clearInterval(timer);
  }, [isPlaying, timeLeft]);

  const handleGuess = (isEvenGuess: boolean) => {
    if (!isPlaying) return;

    const isActuallyEven = currentNumber % 2 === 0;

    if (isEvenGuess === isActuallyEven) {
      setScore(s => s + 1);
    }
    
    generateProblem();
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
            <span>🔢</span> លេខគូ និងសេស
          </h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full flex flex-col items-center">
          
          {!isPlaying && !gameOver ? (
            <div className="text-center">
              <div className="w-24 h-24 bg-cyan-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
                🔢
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">លេខគូ និងសេស</h2>
              <p className="text-slate-500 mb-8">អ្នកមានពេល ៣០ វិនាទី ដើម្បីចុចរើសលេខគូ ឬសេសឱ្យបានលឿននិងត្រឹមត្រូវ!</p>
              
              <button
                onClick={startGame}
                className="w-full py-4 px-6 rounded-xl font-bold text-white bg-cyan-500 hover:bg-cyan-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30 text-lg"
              >
                <Play size={24} fill="currentColor" /> ចាប់ផ្តើមលេង
              </button>
            </div>
          ) : gameOver ? (
            <div className="text-center w-full animate-in zoom-in duration-300">
              <div className="text-6xl mb-6">🏆</div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">ចប់ម៉ោង!</h2>
              <p className="text-slate-500 mb-6">ពិន្ទុរបស់អ្នក៖</p>
              
              <div className="text-6xl font-black text-cyan-500 mb-8">
                {score}
              </div>
              
              <button
                onClick={startGame}
                className="w-full py-4 px-6 rounded-xl font-bold text-white bg-cyan-500 hover:bg-cyan-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30 text-lg"
              >
                <RotateCcw size={24} /> លេងម្តងទៀត
              </button>
            </div>
          ) : (
            <div className="w-full text-center">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                <div className="bg-cyan-50 px-4 py-2 rounded-xl flex flex-col items-center">
                  <span className="text-xs text-cyan-600 font-bold mb-1 uppercase tracking-wider">ពិន្ទុ</span>
                  <span className="text-2xl font-black text-cyan-700">{score}</span>
                </div>
                
                <div className={`px-4 py-2 rounded-xl flex flex-col items-center ${timeLeft <= 10 ? 'bg-red-50' : 'bg-slate-100'}`}>
                  <span className={`text-xs font-bold mb-1 uppercase tracking-wider flex items-center gap-1 ${timeLeft <= 10 ? 'text-red-600' : 'text-slate-500'}`}>
                    <Clock size={12} /> ម៉ោង
                  </span>
                  <span className={`text-2xl font-black ${timeLeft <= 10 ? 'text-red-600 animate-pulse' : 'text-slate-700'}`}>
                    {timeLeft}វ
                  </span>
                </div>
              </div>

              <div className="mb-12 relative flex items-center justify-center h-32">
                <div className={`text-8xl font-black text-slate-800 ${animationClass}`}>
                  {currentNumber}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleGuess(true)}
                  className="py-6 rounded-2xl font-black text-white bg-indigo-500 hover:bg-indigo-600 transition-all active:scale-95 shadow-lg shadow-indigo-500/30 text-2xl"
                >
                  លេខគូ
                </button>
                <button
                  onClick={() => handleGuess(false)}
                  className="py-6 rounded-2xl font-black text-white bg-orange-500 hover:bg-orange-600 transition-all active:scale-95 shadow-lg shadow-orange-500/30 text-2xl"
                >
                  លេខសេស
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
