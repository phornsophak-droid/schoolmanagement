import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, RotateCcw, Clock } from 'lucide-react';

interface PatternGameProps {
  onBack: () => void;
}

const SHAPES = ['🔴', '🔵', '🟡', '🟢', '🔺', '⭐', '❤️', '🟣'];

interface Problem { shown: string[]; answer: string; choices: string[]; }

const makeProblem = (): Problem => {
  const pool = [...SHAPES].sort(() => Math.random() - 0.5);
  const unitLen = Math.random() < 0.5 ? 2 : 3;
  const unit = pool.slice(0, unitLen);
  const repeats = unitLen === 2 ? 3 : 2; // total shown 6
  const full: string[] = [];
  for (let r = 0; r < repeats; r++) full.push(...unit);
  full.push(unit[0]); // start the next cycle so the answer is unit[1]
  const shown = full.slice(0, full.length); // e.g. 🔴🔵🔴🔵🔴🔵🔴 → next is 🔵
  const answer = unit[1 % unitLen];
  const set = new Set<string>([answer]);
  for (const s of pool) { if (set.size >= 3) break; set.add(s); }
  const choices = [...set].sort(() => Math.random() - 0.5);
  return { shown, answer, choices };
};

export default function PatternGame({ onBack }: PatternGameProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(45);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [problem, setProblem] = useState<Problem>(makeProblem);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const nextProblem = () => { setProblem(makeProblem()); setFeedback(null); };

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

  const handleAnswer = (s: string) => {
    if (!isPlaying || feedback) return;
    if (s === problem.answer) {
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
            <span>🔷</span> លំនាំបន្ត
          </h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full flex flex-col items-center">
          {!isPlaying && !gameOver ? (
            <div className="text-center">
              <div className="w-24 h-24 bg-sky-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">🔷</div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">លំនាំបន្ត</h2>
              <p className="text-slate-500 mb-8">មើលលំនាំរូបភាព រួចទាយថាតើរូបអ្វីនៅបន្ទាប់ ក្នុង ៤៥ វិនាទី!</p>
              <button onClick={startGame} className="w-full py-4 px-6 rounded-xl font-bold text-white bg-sky-500 hover:bg-sky-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-sky-500/30 text-lg">
                <Play size={24} fill="currentColor" /> ចាប់ផ្តើមលេង
              </button>
            </div>
          ) : gameOver ? (
            <div className="text-center w-full animate-in zoom-in duration-300">
              <div className="text-6xl mb-6">🏆</div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">ចប់ម៉ោង!</h2>
              <p className="text-slate-500 mb-6">ពិន្ទុរបស់អ្នក៖</p>
              <div className="text-6xl font-black text-sky-500 mb-8">{score}</div>
              <button onClick={startGame} className="w-full py-4 px-6 rounded-xl font-bold text-white bg-sky-500 hover:bg-sky-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-sky-500/30 text-lg">
                <RotateCcw size={24} /> លេងម្តងទៀត
              </button>
            </div>
          ) : (
            <div className="w-full text-center">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                <div className="bg-sky-50 px-4 py-2 rounded-xl flex flex-col items-center">
                  <span className="text-xs text-sky-600 font-bold mb-1 uppercase tracking-wider">ពិន្ទុ</span>
                  <span className="text-2xl font-black text-sky-700">{score}</span>
                </div>
                <div className={`px-4 py-2 rounded-xl flex flex-col items-center ${timeLeft <= 10 ? 'bg-red-50' : 'bg-slate-100'}`}>
                  <span className={`text-xs font-bold mb-1 uppercase tracking-wider flex items-center gap-1 ${timeLeft <= 10 ? 'text-red-600' : 'text-slate-500'}`}>
                    <Clock size={12} /> ម៉ោង
                  </span>
                  <span className={`text-2xl font-black ${timeLeft <= 10 ? 'text-red-600 animate-pulse' : 'text-slate-700'}`}>{timeLeft}វ</span>
                </div>
              </div>

              <div className={`flex flex-wrap items-center justify-center gap-1.5 min-h-24 mb-10 p-3 rounded-2xl transition-colors ${feedback === 'correct' ? 'bg-green-50' : feedback === 'wrong' ? 'bg-red-50' : ''}`}>
                {problem.shown.map((s, i) => (
                  <span key={i} className="text-3xl md:text-4xl">{s}</span>
                ))}
                <span className="w-11 h-11 md:w-12 md:h-12 flex items-center justify-center rounded-2xl border-2 border-dashed border-sky-300 text-sky-400 text-2xl font-black">?</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {problem.choices.map(s => (
                  <button
                    key={s}
                    onClick={() => handleAnswer(s)}
                    disabled={!!feedback}
                    className="py-6 rounded-2xl bg-slate-100 hover:bg-slate-200 transition-all active:scale-95 shadow text-4xl disabled:opacity-60"
                  >
                    {s}
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
