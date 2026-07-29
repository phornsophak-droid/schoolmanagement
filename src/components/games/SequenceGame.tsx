import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, RotateCcw, Clock } from 'lucide-react';

interface SequenceGameProps {
  onBack: () => void;
}

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);
const STEPS = [1, 2, 3, 5, 10];

interface Problem { seq: number[]; hidden: number; answer: number; choices: number[]; }

const makeProblem = (): Problem => {
  const step = STEPS[Math.floor(Math.random() * STEPS.length)];
  const start = Math.floor(Math.random() * 10) + 1;
  const seq = Array.from({ length: 5 }, (_, i) => start + i * step);
  const hidden = Math.floor(Math.random() * 3) + 1; // hide index 1..3 (not the ends)
  const answer = seq[hidden];
  const set = new Set<number>([answer]);
  while (set.size < 4) {
    const v = answer + (Math.floor(Math.random() * 5) - 2) * step;
    if (v > 0 && v !== answer) set.add(v);
    if (set.size < 4 && Math.random() < 0.3) set.add(answer + (Math.random() < 0.5 ? 1 : -1));
  }
  const choices = [...set].filter(v => v > 0).slice(0, 4).sort(() => Math.random() - 0.5);
  return { seq, hidden, answer, choices };
};

export default function SequenceGame({ onBack }: SequenceGameProps) {
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

  const handleAnswer = (v: number) => {
    if (!isPlaying || feedback) return;
    if (v === problem.answer) {
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
            <span>➡️</span> បំពេញលេខបន្ត
          </h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full flex flex-col items-center">
          {!isPlaying && !gameOver ? (
            <div className="text-center">
              <div className="w-24 h-24 bg-violet-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">➡️</div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">បំពេញលេខបន្ត</h2>
              <p className="text-slate-500 mb-8">មើលលំដាប់លេខ រួចរកលេខដែលបាត់ ឱ្យបានត្រឹមត្រូវ ក្នុង ៤៥ វិនាទី!</p>
              <button onClick={startGame} className="w-full py-4 px-6 rounded-xl font-bold text-white bg-violet-500 hover:bg-violet-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-violet-500/30 text-lg">
                <Play size={24} fill="currentColor" /> ចាប់ផ្តើមលេង
              </button>
            </div>
          ) : gameOver ? (
            <div className="text-center w-full animate-in zoom-in duration-300">
              <div className="text-6xl mb-6">🏆</div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">ចប់ម៉ោង!</h2>
              <p className="text-slate-500 mb-6">ពិន្ទុរបស់អ្នក៖</p>
              <div className="text-6xl font-black text-violet-500 mb-8">{score}</div>
              <button onClick={startGame} className="w-full py-4 px-6 rounded-xl font-bold text-white bg-violet-500 hover:bg-violet-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-violet-500/30 text-lg">
                <RotateCcw size={24} /> លេងម្តងទៀត
              </button>
            </div>
          ) : (
            <div className="w-full text-center">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                <div className="bg-violet-50 px-4 py-2 rounded-xl flex flex-col items-center">
                  <span className="text-xs text-violet-600 font-bold mb-1 uppercase tracking-wider">ពិន្ទុ</span>
                  <span className="text-2xl font-black text-violet-700">{score}</span>
                </div>
                <div className={`px-4 py-2 rounded-xl flex flex-col items-center ${timeLeft <= 10 ? 'bg-red-50' : 'bg-slate-100'}`}>
                  <span className={`text-xs font-bold mb-1 uppercase tracking-wider flex items-center gap-1 ${timeLeft <= 10 ? 'text-red-600' : 'text-slate-500'}`}>
                    <Clock size={12} /> ម៉ោង
                  </span>
                  <span className={`text-2xl font-black ${timeLeft <= 10 ? 'text-red-600 animate-pulse' : 'text-slate-700'}`}>{timeLeft}វ</span>
                </div>
              </div>

              <div className={`flex flex-wrap items-center justify-center gap-2 min-h-28 mb-10 p-3 rounded-2xl transition-colors ${feedback === 'correct' ? 'bg-green-50' : feedback === 'wrong' ? 'bg-red-50' : ''}`}>
                {problem.seq.map((n, i) => (
                  i === problem.hidden ? (
                    <span key={i} className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center rounded-2xl border-2 border-dashed border-violet-300 text-violet-400 text-3xl font-black">?</span>
                  ) : (
                    <span key={i} className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center rounded-2xl bg-slate-100 text-slate-800 text-2xl md:text-3xl font-black">{toKh(n)}</span>
                  )
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {problem.choices.map(v => (
                  <button
                    key={v}
                    onClick={() => handleAnswer(v)}
                    disabled={!!feedback}
                    className="py-6 rounded-2xl font-black text-white bg-indigo-500 hover:bg-indigo-600 transition-all active:scale-95 shadow-lg shadow-indigo-500/30 text-3xl disabled:opacity-60"
                  >
                    {toKh(v)}
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
