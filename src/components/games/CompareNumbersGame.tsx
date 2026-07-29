import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, RotateCcw, Clock } from 'lucide-react';

interface CompareNumbersGameProps {
  onBack: () => void;
}

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);
const SIGNS = ['<', '=', '>'] as const;
type Sign = typeof SIGNS[number];

export default function CompareNumbersGame({ onBack }: CompareNumbersGameProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(45);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [a, setA] = useState(1);
  const [b, setB] = useState(1);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const nextProblem = () => {
    const x = Math.floor(Math.random() * 99) + 1;
    // ~1 in 4 problems is an equality, otherwise a fresh second number.
    const y = Math.random() < 0.25 ? x : Math.floor(Math.random() * 99) + 1;
    setA(x);
    setB(y);
    setFeedback(null);
  };

  const startGame = () => {
    setIsPlaying(true);
    setGameOver(false);
    setScore(0);
    setTimeLeft(45);
    nextProblem();
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0 && isPlaying) {
      setIsPlaying(false);
      setGameOver(true);
    }
    return () => clearInterval(timer);
  }, [isPlaying, timeLeft]);

  const correctSign: Sign = a < b ? '<' : a > b ? '>' : '=';

  const handleAnswer = (s: Sign) => {
    if (!isPlaying || feedback) return;
    if (s === correctSign) {
      setScore(sc => sc + 1);
      setFeedback('correct');
    } else {
      setFeedback('wrong');
    }
    setTimeout(nextProblem, 550);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <span>⚖️</span> ប្រៀបធៀបចំនួន
          </h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full flex flex-col items-center">
          {!isPlaying && !gameOver ? (
            <div className="text-center">
              <div className="w-24 h-24 bg-teal-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">⚖️</div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">ប្រៀបធៀបចំនួន</h2>
              <p className="text-slate-500 mb-8">ជ្រើសសញ្ញា តូចជាង (&lt;) ស្មើ (=) ឬ ធំជាង (&gt;) ឱ្យបានត្រឹមត្រូវ!</p>
              <button onClick={startGame} className="w-full py-4 px-6 rounded-xl font-bold text-white bg-teal-500 hover:bg-teal-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-teal-500/30 text-lg">
                <Play size={24} fill="currentColor" /> ចាប់ផ្តើមលេង
              </button>
            </div>
          ) : gameOver ? (
            <div className="text-center w-full animate-in zoom-in duration-300">
              <div className="text-6xl mb-6">🏆</div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">ចប់ម៉ោង!</h2>
              <p className="text-slate-500 mb-6">ពិន្ទុរបស់អ្នក៖</p>
              <div className="text-6xl font-black text-teal-500 mb-8">{score}</div>
              <button onClick={startGame} className="w-full py-4 px-6 rounded-xl font-bold text-white bg-teal-500 hover:bg-teal-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-teal-500/30 text-lg">
                <RotateCcw size={24} /> លេងម្តងទៀត
              </button>
            </div>
          ) : (
            <div className="w-full text-center">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                <div className="bg-teal-50 px-4 py-2 rounded-xl flex flex-col items-center">
                  <span className="text-xs text-teal-600 font-bold mb-1 uppercase tracking-wider">ពិន្ទុ</span>
                  <span className="text-2xl font-black text-teal-700">{score}</span>
                </div>
                <div className={`px-4 py-2 rounded-xl flex flex-col items-center ${timeLeft <= 10 ? 'bg-red-50' : 'bg-slate-100'}`}>
                  <span className={`text-xs font-bold mb-1 uppercase tracking-wider flex items-center gap-1 ${timeLeft <= 10 ? 'text-red-600' : 'text-slate-500'}`}>
                    <Clock size={12} /> ម៉ោង
                  </span>
                  <span className={`text-2xl font-black ${timeLeft <= 10 ? 'text-red-600 animate-pulse' : 'text-slate-700'}`}>{timeLeft}វ</span>
                </div>
              </div>

              <div className={`flex items-center justify-center gap-4 h-32 mb-10 rounded-2xl transition-colors ${feedback === 'correct' ? 'bg-green-50' : feedback === 'wrong' ? 'bg-red-50' : ''}`}>
                <span className="text-6xl font-black text-slate-800">{toKh(a)}</span>
                <span className="text-5xl font-black text-teal-400 w-14 h-14 flex items-center justify-center rounded-xl border-2 border-dashed border-teal-300">?</span>
                <span className="text-6xl font-black text-slate-800">{toKh(b)}</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {SIGNS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleAnswer(s)}
                    disabled={!!feedback}
                    className="py-6 rounded-2xl font-black text-white bg-orange-500 hover:bg-orange-600 transition-all active:scale-95 shadow-lg shadow-orange-500/30 text-4xl disabled:opacity-60"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-1.5 text-[11px] font-bold text-slate-400">
                <span>តូចជាង</span><span>ស្មើ</span><span>ធំជាង</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
