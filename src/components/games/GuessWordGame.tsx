import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, RotateCcw } from 'lucide-react';

interface GuessWordGameProps {
  onBack: () => void;
}

const WORDS = [
  { hint: 'សត្វចិញ្ចឹមយាមផ្ទះ', word: 'ឆ្កែ' },
  { hint: 'សត្វចិញ្ចឹមចាប់កណ្តុរ', word: 'ឆ្មា' },
  { hint: 'ទីកន្លែងសម្រាប់រៀនសូត្រ', word: 'សាលារៀន' },
  { hint: 'អ្វីដែលយើងជិះទៅធ្វើការ', word: 'ឡាន' },
  { hint: 'របស់សម្រាប់សរសេរ', word: 'ខ្មៅដៃ' },
  { hint: 'របស់សម្រាប់អាន', word: 'សៀវភៅ' },
  { hint: 'ផ្លែឈើពណ៌ក្រហមមានរាងមូល', word: 'ប៉ោម' },
  { hint: 'សត្វមានប្រមោយវែង', word: 'ដំរី' },
];

// Helper to shuffle array
const shuffle = (arr: any[]) => [...arr].sort(() => Math.random() - 0.5);

export default function GuessWordGame({ onBack }: GuessWordGameProps) {
  const [targetWord, setTargetWord] = useState('');
  const [hint, setHint] = useState('');
  const [lettersOptions, setLettersOptions] = useState<{ id: string; letter: string; used: boolean }[]>([]);
  const [currentGuess, setCurrentGuess] = useState<(string | null)[]>([]);
  const [isCorrect, setIsCorrect] = useState(false);
  const [wrongMatch, setWrongMatch] = useState(false);
  const [score, setScore] = useState(0);

  const startLevel = () => {
    const item = WORDS[Math.floor(Math.random() * WORDS.length)];
    setTargetWord(item.word);
    setHint(item.hint);
    
    // Split the word into array of characters
    const chars = Array.from(item.word);
    setCurrentGuess(new Array(chars.length).fill(null));
    
    // Create options (correct letters + some random letters)
    let options = [...chars];
    const extraLetters = 'កខគឃងចឆជឈញដឋឌឍណតថទធនបផពភមយរលវសហឡអឥឦឧឨឩឪឫឬឭឮឯឰឱឲឳាិីឹឺុូួើឿៀេែៃោៅំះៈ៉៊់៌៍៎៏័៑ធ';
    
    // Add 4-6 random letters
    const numExtras = Math.floor(Math.random() * 3) + 4;
    for (let i = 0; i < numExtras; i++) {
      options.push(extraLetters[Math.floor(Math.random() * extraLetters.length)]);
    }
    
    // Shuffle options and map to objects
    const shuffledOptions = shuffle(options).map((letter, i) => ({
      id: `${i}-${letter}`,
      letter,
      used: false
    }));
    
    setLettersOptions(shuffledOptions);
    setIsCorrect(false);
    setWrongMatch(false);
  };

  useEffect(() => {
    startLevel();
  }, []);

  const handleSelectLetter = (option: { id: string; letter: string; used: boolean }) => {
    if (option.used || isCorrect) return;

    // Find first empty slot
    const emptyIndex = currentGuess.findIndex(g => g === null);
    if (emptyIndex === -1) return; // Full

    // Mark option as used
    setLettersOptions(prev => prev.map(p => p.id === option.id ? { ...p, used: true } : p));
    
    // Update guess
    const newGuess = [...currentGuess];
    newGuess[emptyIndex] = option.letter;
    setCurrentGuess(newGuess);
    
    // Check if full
    if (!newGuess.includes(null)) {
      const guessedWord = newGuess.join('');
      if (guessedWord === targetWord) {
        setIsCorrect(true);
        setScore(s => s + 1);
      } else {
        setWrongMatch(true);
        setTimeout(() => {
          // Reset guess
          setCurrentGuess(new Array(targetWord.length).fill(null));
          setLettersOptions(prev => prev.map(p => ({ ...p, used: false })));
          setWrongMatch(false);
        }, 800);
      }
    }
  };

  const handleRemoveLetter = (index: number) => {
    if (isCorrect || currentGuess[index] === null) return;
    
    const letterToRemove = currentGuess[index];
    
    // Update guess
    const newGuess = [...currentGuess];
    newGuess[index] = null;
    setCurrentGuess(newGuess);
    
    // Mark option as unused (find the first used option that matches the letter)
    let found = false;
    setLettersOptions(prev => prev.map(p => {
      if (!found && p.used && p.letter === letterToRemove) {
        found = true;
        return { ...p, used: false };
      }
      return p;
    }));
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
            <span>📝</span> ល្បែងទាយពាក្យ
          </h1>
        </div>
        <div className="px-3 py-1 bg-blue-100 text-blue-700 font-bold rounded-full text-sm">
          ពិន្ទុ: {score}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200 max-w-2xl w-full flex flex-col items-center text-center">
          
          <h2 className="text-sm font-bold text-blue-500 uppercase tracking-wider mb-2">តម្រុយ៖</h2>
          <p className="text-xl text-slate-800 font-bold mb-8 bg-blue-50 px-6 py-3 rounded-2xl border border-blue-100">
            "{hint}"
          </p>

          <div className={`flex flex-wrap justify-center gap-2 mb-12 min-h-16 ${wrongMatch ? 'animate-shake' : ''}`}>
            {currentGuess.map((guess, i) => (
              <div 
                key={i}
                onClick={() => guess !== null && handleRemoveLetter(i)}
                className={`w-14 h-16 rounded-xl flex items-center justify-center text-2xl font-bold border-2 transition-all ${
                  guess !== null ? 'cursor-pointer' : ''
                } ${
                  guess !== null 
                    ? isCorrect 
                      ? 'bg-green-100 border-green-500 text-green-700 shadow-md scale-105'
                      : wrongMatch 
                        ? 'bg-red-100 border-red-500 text-red-700'
                        : 'bg-white border-blue-500 text-blue-700 shadow-sm' 
                    : 'bg-slate-100 border-slate-200 border-dashed text-slate-400'
                }`}
              >
                {guess || ''}
              </div>
            ))}
          </div>

          {!isCorrect ? (
            <div className="flex flex-wrap justify-center gap-3 w-full max-w-md">
              {lettersOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => handleSelectLetter(option)}
                  disabled={option.used}
                  className={`w-14 h-16 rounded-xl flex items-center justify-center text-2xl font-bold transition-all border-2 ${
                    option.used 
                      ? 'bg-slate-100 border-slate-200 text-slate-300 opacity-50 cursor-not-allowed scale-95' 
                      : 'bg-white border-slate-300 text-slate-700 hover:border-blue-400 hover:text-blue-600 shadow-sm hover:-translate-y-1 hover:shadow'
                  }`}
                >
                  {option.letter}
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
                className="w-full max-w-xs mx-auto py-3 px-6 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30"
              >
                លេងពាក្យបន្ទាប់
              </button>
            </div>
          )}
          
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => {
                setCurrentGuess(new Array(targetWord.length).fill(null));
                setLettersOptions(prev => prev.map(p => ({ ...p, used: false })));
              }}
              disabled={isCorrect || currentGuess.every(g => g === null)}
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
