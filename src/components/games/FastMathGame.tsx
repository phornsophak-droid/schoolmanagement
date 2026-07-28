import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, RotateCcw, Clock } from 'lucide-react';

interface FastMathGameProps {
  onBack: () => void;
}

export default function FastMathGame({ onBack }: FastMathGameProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [operator, setOperator] = useState('+');
  const [answer, setAnswer] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const generateProblem = () => {
    const isAdd = Math.random() > 0.5;
    const max = 20;
    
    if (isAdd) {
      setOperator('+');
      setNum1(Math.floor(Math.random() * max) + 1);
      setNum2(Math.floor(Math.random() * max) + 1);
    } else {
      setOperator('-');
      const n1 = Math.floor(Math.random() * max) + 5;
      const n2 = Math.floor(Math.random() * n1);
      setNum1(n1);
      setNum2(n2);
    }
  };

  const startGame = () => {
    setIsPlaying(true);
    setGameOver(false);
    setScore(0);
    setTimeLeft(60);
    generateProblem();
    setAnswer('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPlaying || answer.trim() === '') return;

    const numAnswer = parseInt(answer);
    const correct = operator === '+' ? num1 + num2 : num1 - num2;

    if (numAnswer === correct) {
      setScore(s => s + 1);
    } else {
      // Penalty for wrong answer? Optional
    }
    
    setAnswer('');
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
            <span>⚡</span> បូកដកលេខរហ័ស
          </h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full flex flex-col items-center">
          
          {!isPlaying && !gameOver ? (
            <div className="text-center">
              <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
                ⚡
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">បូកដកលេខរហ័ស</h2>
              <p className="text-slate-500 mb-8">អ្នកមានពេល ៦០ វិនាទី ដើម្បីគិតលេខឱ្យបានច្រើនបំផុត។ តើអ្នកអាចធ្វើបានប៉ុន្មាន?</p>
              
              <button
                onClick={startGame}
                className="w-full py-4 px-6 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 text-lg"
              >
                <Play size={24} fill="currentColor" /> ចាប់ផ្តើមលេង
              </button>
            </div>
          ) : gameOver ? (
            <div className="text-center w-full animate-in zoom-in duration-300">
              <div className="text-6xl mb-6">🏆</div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">ចប់ម៉ោង!</h2>
              <p className="text-slate-500 mb-6">អ្នកឆ្លើយត្រូវចំនួន៖</p>
              
              <div className="text-6xl font-black text-blue-500 mb-8">
                {score} <span className="text-2xl text-slate-400 font-medium">សំនួរ</span>
              </div>
              
              <button
                onClick={startGame}
                className="w-full py-4 px-6 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 text-lg"
              >
                <RotateCcw size={24} /> លេងម្តងទៀត
              </button>
            </div>
          ) : (
            <div className="w-full">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                <div className="bg-blue-50 px-4 py-2 rounded-xl flex flex-col items-center">
                  <span className="text-xs text-blue-600 font-bold mb-1 uppercase tracking-wider">ពិន្ទុ</span>
                  <span className="text-2xl font-black text-blue-700">{score}</span>
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

              <div className="text-6xl font-black text-slate-800 flex items-center justify-center gap-4 mb-8">
                <span>{num1}</span>
                <span className="text-4xl text-blue-500">{operator}</span>
                <span>{num2}</span>
                <span className="text-4xl text-slate-300">=</span>
              </div>

              <form onSubmit={handleSubmit} className="flex gap-3">
                <input
                  ref={inputRef}
                  type="number"
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  className="flex-1 text-center text-3xl font-bold p-4 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all"
                  placeholder="?"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-6 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30"
                >
                  ឆ្លើយ
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
