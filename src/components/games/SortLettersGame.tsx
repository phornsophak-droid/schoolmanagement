import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, RotateCcw } from 'lucide-react';

interface SortLettersGameProps {
  onBack: () => void;
}

const WORDS = [
  'សាលារៀន', 'កូនសិស្ស', 'គ្រូបង្រៀន', 'សៀវភៅ', 
  'ខ្មៅដៃ', 'កាបូប', 'តុរៀន', 'ក្ដារខៀន', 
  'កុំព្យូទ័រ', 'បណ្ណាល័យ'
];

export default function SortLettersGame({ onBack }: SortLettersGameProps) {
  const [targetWord, setTargetWord] = useState('');
  const [scrambledLetters, setScrambledLetters] = useState<{ id: string; letter: string; used: boolean }[]>([]);
  const [currentGuess, setCurrentGuess] = useState<{ id: string; letter: string }[]>([]);
  const [isCorrect, setIsCorrect] = useState(false);
  const [wrongMatch, setWrongMatch] = useState(false);
  const [score, setScore] = useState(0);

  const startLevel = () => {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    setTargetWord(word);
    
    // Split into characters (Khmer has complex syllables but for this simple game we split by code point)
    const chars = Array.from(word);
    const shuffled = chars
      .map((letter, i) => ({ id: `${i}-${letter}`, letter, used: false, rand: Math.random() }))
      .sort((a, b) => a.rand - b.rand);
      
    setScrambledLetters(shuffled);
    setCurrentGuess([]);
    setIsCorrect(false);
    setWrongMatch(false);
  };

  useEffect(() => {
    startLevel();
  }, []);

  const handleSelectLetter = (item: { id: string; letter: string; used: boolean }) => {
    if (item.used || isCorrect) return;
    
    // Mark as used
    setScrambledLetters(prev => prev.map(p => p.id === item.id ? { ...p, used: true } : p));
    
    const newGuess = [...currentGuess, { id: item.id, letter: item.letter }];
    setCurrentGuess(newGuess);
    
    // Check if full
    if (newGuess.length === targetWord.length) {
      const guessedWord = newGuess.map(g => g.letter).join('');
      if (guessedWord === targetWord) {
        setIsCorrect(true);
        setScore(s => s + 10);
      } else {
        setWrongMatch(true);
        setTimeout(() => {
          // Reset guess
          setCurrentGuess([]);
          setScrambledLetters(prev => prev.map(p => ({ ...p, used: false })));
          setWrongMatch(false);
        }, 800);
      }
    }
  };

  const handleRemoveLetter = (index: number) => {
    if (isCorrect) return;
    
    const itemToRemove = currentGuess[index];
    const newGuess = [...currentGuess];
    newGuess.splice(index, 1);
    setCurrentGuess(newGuess);
    
    // Mark as unused
    setScrambledLetters(prev => prev.map(p => p.id === itemToRemove.id ? { ...p, used: false } : p));
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
            <span>🔠</span> តម្រៀបអក្សរ
          </h1>
        </div>
        <div className="px-3 py-1 bg-indigo-100 text-indigo-700 font-bold rounded-full text-sm">
          ពិន្ទុ: {score}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200 max-w-2xl w-full flex flex-col items-center text-center">
          
          <h2 className="text-xl text-slate-800 font-bold mb-8">
            តម្រៀបអក្សរឱ្យបានត្រឹមត្រូវ
          </h2>

          <div className={`flex flex-wrap justify-center gap-2 mb-12 min-h-16 ${wrongMatch ? 'animate-shake' : ''}`}>
            {Array.from({ length: targetWord.length }).map((_, i) => {
              const guessedItem = currentGuess[i];
              
              return (
                <div 
                  key={i}
                  onClick={() => guessedItem && handleRemoveLetter(i)}
                  className={`w-14 h-16 rounded-xl flex items-center justify-center text-2xl font-bold border-2 transition-all cursor-pointer ${
                    guessedItem 
                      ? isCorrect 
                        ? 'bg-green-100 border-green-500 text-green-700 shadow-md scale-105'
                        : wrongMatch 
                          ? 'bg-red-100 border-red-500 text-red-700'
                          : 'bg-white border-indigo-500 text-indigo-700 shadow-sm' 
                      : 'bg-slate-100 border-slate-200 border-dashed text-slate-400'
                  }`}
                >
                  {guessedItem ? guessedItem.letter : ''}
                </div>
              );
            })}
          </div>

          {!isCorrect ? (
            <div className="flex flex-wrap justify-center gap-3 w-full max-w-md">
              {scrambledLetters.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleSelectLetter(item)}
                  disabled={item.used}
                  className={`w-14 h-16 rounded-xl flex items-center justify-center text-2xl font-bold transition-all border-2 ${
                    item.used 
                      ? 'bg-slate-100 border-slate-200 text-slate-300 opacity-50 cursor-not-allowed scale-95' 
                      : 'bg-white border-slate-300 text-slate-700 hover:border-indigo-400 hover:text-indigo-600 shadow-sm hover:-translate-y-1 hover:shadow'
                  }`}
                >
                  {item.letter}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center w-full animate-in zoom-in duration-300 mt-4">
              <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} strokeWidth={4} />
              </div>
              <p className="text-green-600 font-bold text-xl mb-6">ត្រឹមត្រូវ!</p>
              
              <button
                onClick={startLevel}
                className="w-full max-w-xs mx-auto py-3 px-6 rounded-xl font-bold text-white bg-indigo-500 hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30"
              >
                លេងពាក្យបន្ទាប់
              </button>
            </div>
          )}
          
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => {
                setCurrentGuess([]);
                setScrambledLetters(prev => prev.map(p => ({ ...p, used: false })));
              }}
              disabled={isCorrect || currentGuess.length === 0}
              className="py-2 px-4 rounded-lg font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RotateCcw size={16} /> រៀបឡើងវិញ
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
