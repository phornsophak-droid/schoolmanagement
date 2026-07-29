import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, RotateCcw, Clock } from 'lucide-react';

interface ColorsGameProps {
  onBack: () => void;
}

interface Color { name: string; hex: string; }
const COLORS: Color[] = [
  { name: 'ក្រហម', hex: '#EF4444' },
  { name: 'ខៀវ', hex: '#3B82F6' },
  { name: 'លឿង', hex: '#EAB308' },
  { name: 'បៃតង', hex: '#22C55E' },
  { name: 'ទឹកក្រូច', hex: '#F97316' },
  { name: 'ស្វាយ', hex: '#8B5CF6' },
  { name: 'ផ្កាឈូក', hex: '#EC4899' },
  { name: 'ត្នោត', hex: '#92400E' },
  { name: 'ខ្មៅ', hex: '#1F2937' },
  { name: 'ប្រផេះ', hex: '#9CA3AF' },
];

export default function ColorsGame({ onBack }: ColorsGameProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(45);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [target, setTarget] = useState<Color>(COLORS[0]);
  const [choices, setChoices] = useState<Color[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const nextProblem = () => {
    const pool = [...COLORS].sort(() => Math.random() - 0.5);
    const answer = pool[0];
    const opts = [answer, ...pool.slice(1, 4)].sort(() => Math.random() - 0.5);
    setTarget(answer);
    setChoices(opts);
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

  const handleAnswer = (c: Color) => {
    if (!isPlaying || feedback) return;
    if (c.name === target.name) {
      setScore(s => s + 1);
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
            <span>🎨</span> ស្គាល់ពណ៌
          </h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full flex flex-col items-center">
          {!isPlaying && !gameOver ? (
            <div className="text-center">
              <div className="w-24 h-24 bg-pink-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">🎨</div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">ស្គាល់ពណ៌</h2>
              <p className="text-slate-500 mb-8">មើលពណ៌ រួចចុចឈ្មោះពណ៌ឱ្យបានត្រឹមត្រូវ ក្នុងរយៈពេល ៤៥ វិនាទី!</p>
              <button onClick={startGame} className="w-full py-4 px-6 rounded-xl font-bold text-white bg-pink-500 hover:bg-pink-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-pink-500/30 text-lg">
                <Play size={24} fill="currentColor" /> ចាប់ផ្តើមលេង
              </button>
            </div>
          ) : gameOver ? (
            <div className="text-center w-full animate-in zoom-in duration-300">
              <div className="text-6xl mb-6">🏆</div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">ចប់ម៉ោង!</h2>
              <p className="text-slate-500 mb-6">ពិន្ទុរបស់អ្នក៖</p>
              <div className="text-6xl font-black text-pink-500 mb-8">{score}</div>
              <button onClick={startGame} className="w-full py-4 px-6 rounded-xl font-bold text-white bg-pink-500 hover:bg-pink-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-pink-500/30 text-lg">
                <RotateCcw size={24} /> លេងម្តងទៀត
              </button>
            </div>
          ) : (
            <div className="w-full text-center">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                <div className="bg-pink-50 px-4 py-2 rounded-xl flex flex-col items-center">
                  <span className="text-xs text-pink-600 font-bold mb-1 uppercase tracking-wider">ពិន្ទុ</span>
                  <span className="text-2xl font-black text-pink-700">{score}</span>
                </div>
                <div className={`px-4 py-2 rounded-xl flex flex-col items-center ${timeLeft <= 10 ? 'bg-red-50' : 'bg-slate-100'}`}>
                  <span className={`text-xs font-bold mb-1 uppercase tracking-wider flex items-center gap-1 ${timeLeft <= 10 ? 'text-red-600' : 'text-slate-500'}`}>
                    <Clock size={12} /> ម៉ោង
                  </span>
                  <span className={`text-2xl font-black ${timeLeft <= 10 ? 'text-red-600 animate-pulse' : 'text-slate-700'}`}>{timeLeft}វ</span>
                </div>
              </div>

              <div className={`flex items-center justify-center h-36 mb-8 rounded-2xl transition-colors ${feedback === 'correct' ? 'bg-green-50' : feedback === 'wrong' ? 'bg-red-50' : ''}`}>
                <div
                  className="w-28 h-28 rounded-full shadow-inner border-4 border-white ring-1 ring-slate-200 animate-in zoom-in duration-200"
                  style={{ backgroundColor: target.hex }}
                />
              </div>

              <p className="text-slate-500 font-semibold mb-4">នេះជាពណ៌អ្វី?</p>
              <div className="grid grid-cols-2 gap-4">
                {choices.map(c => (
                  <button
                    key={c.name}
                    onClick={() => handleAnswer(c)}
                    disabled={!!feedback}
                    className="py-5 rounded-2xl font-black text-white bg-indigo-500 hover:bg-indigo-600 transition-all active:scale-95 shadow-lg shadow-indigo-500/30 text-2xl disabled:opacity-60"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
