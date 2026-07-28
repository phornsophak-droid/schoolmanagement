import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, RotateCcw } from 'lucide-react';

interface MatchWordGameProps {
  onBack: () => void;
}

const DICTIONARY = [
  { id: 1, image: '🍎', word: 'ផ្លែប៉ោម' },
  { id: 2, image: '🐕', word: 'សត្វឆ្កែ' },
  { id: 3, image: '🐈', word: 'សត្វឆ្មា' },
  { id: 4, image: '🚗', word: 'ឡាន' },
  { id: 5, image: '🏠', word: 'ផ្ទះ' },
  { id: 6, image: '🌳', word: 'ដើមឈើ' },
  { id: 7, image: '☀️', word: 'ព្រះអាទិត្យ' },
  { id: 8, image: '🌙', word: 'ព្រះច័ន្ទ' },
  { id: 9, image: '📖', word: 'សៀវភៅ' },
  { id: 10, image: '✏️', word: 'ខ្មៅដៃ' },
  { id: 11, image: '🐘', word: 'សត្វដំរី' },
  { id: 12, image: '🐒', word: 'សត្វស្វា' },
];

export default function MatchWordGame({ onBack }: MatchWordGameProps) {
  const [images, setImages] = useState<any[]>([]);
  const [words, setWords] = useState<any[]>([]);
  
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [selectedWordId, setSelectedWordId] = useState<number | null>(null);
  
  const [matchedIds, setMatchedIds] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [wrongMatch, setWrongMatch] = useState(false);

  const startLevel = () => {
    // Pick 4 random pairs
    const shuffledDict = [...DICTIONARY].sort(() => Math.random() - 0.5);
    const selectedPairs = shuffledDict.slice(0, 4);
    
    setImages([...selectedPairs].sort(() => Math.random() - 0.5));
    setWords([...selectedPairs].sort(() => Math.random() - 0.5));
    
    setSelectedImageId(null);
    setSelectedWordId(null);
    setMatchedIds([]);
    setWrongMatch(false);
  };

  useEffect(() => {
    startLevel();
  }, [level]);

  useEffect(() => {
    if (selectedImageId !== null && selectedWordId !== null) {
      if (selectedImageId === selectedWordId) {
        // Match!
        setMatchedIds(prev => [...prev, selectedImageId]);
        setScore(s => s + 10);
        setSelectedImageId(null);
        setSelectedWordId(null);
      } else {
        // Wrong
        setWrongMatch(true);
        setTimeout(() => {
          setSelectedImageId(null);
          setSelectedWordId(null);
          setWrongMatch(false);
        }, 800);
      }
    }
  }, [selectedImageId, selectedWordId]);

  const levelComplete = matchedIds.length === 4;

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
            <span>🖼️</span> ផ្គូផ្គងរូបភាពនិងពាក្យ
          </h1>
        </div>
        <div className="px-3 py-1 bg-emerald-100 text-emerald-700 font-bold rounded-full text-sm">
          កម្រិត {level}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200 max-w-2xl w-full flex flex-col items-center">
          
          <div className="flex w-full justify-between items-center mb-8">
            <h2 className="text-xl text-slate-800 font-bold">
              ផ្គូផ្គងរូបភាព ទៅនឹងពាក្យ
            </h2>
            <div className="text-emerald-600 font-bold">
              ពិន្ទុ៖ {score}
            </div>
          </div>

          {!levelComplete ? (
            <div className="flex justify-between w-full gap-4 md:gap-12 relative">
              
              {/* Images Column */}
              <div className="flex flex-col gap-4 flex-1">
                {images.map(item => {
                  const isSelected = selectedImageId === item.id;
                  const isMatched = matchedIds.includes(item.id);
                  const isWrong = isSelected && wrongMatch;
                  
                  let btnClass = "h-24 rounded-2xl text-5xl flex items-center justify-center transition-all border-4 ";
                  
                  if (isMatched) {
                    btnClass += "bg-slate-100 border-slate-200 opacity-50 scale-95";
                  } else if (isWrong) {
                    btnClass += "bg-red-100 border-red-500 animate-shake";
                  } else if (isSelected) {
                    btnClass += "bg-emerald-100 border-emerald-500 scale-105 shadow-md";
                  } else {
                    btnClass += "bg-white border-slate-200 hover:border-emerald-300 shadow-sm hover:shadow";
                  }

                  return (
                    <button
                      key={`img-${item.id}`}
                      disabled={isMatched}
                      onClick={() => setSelectedImageId(item.id)}
                      className={btnClass}
                    >
                      {item.image}
                    </button>
                  );
                })}
              </div>

              {/* Words Column */}
              <div className="flex flex-col gap-4 flex-1">
                {words.map(item => {
                  const isSelected = selectedWordId === item.id;
                  const isMatched = matchedIds.includes(item.id);
                  const isWrong = isSelected && wrongMatch;
                  
                  let btnClass = "h-24 rounded-2xl text-xl font-bold flex items-center justify-center transition-all border-4 ";
                  
                  if (isMatched) {
                    btnClass += "bg-emerald-50 border-emerald-200 text-emerald-400 opacity-50 scale-95";
                  } else if (isWrong) {
                    btnClass += "bg-red-100 border-red-500 text-red-600 animate-shake";
                  } else if (isSelected) {
                    btnClass += "bg-emerald-100 border-emerald-500 text-emerald-700 scale-105 shadow-md";
                  } else {
                    btnClass += "bg-white border-slate-200 text-slate-700 hover:border-emerald-300 shadow-sm hover:shadow";
                  }

                  return (
                    <button
                      key={`word-${item.id}`}
                      disabled={isMatched}
                      onClick={() => setSelectedWordId(item.id)}
                      className={btnClass}
                    >
                      {item.word}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center w-full animate-in zoom-in duration-500 py-10">
              <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check size={48} strokeWidth={4} />
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-4">អស្ចារ្យណាស់! 🎉</h2>
              <p className="text-slate-500 mb-8">អ្នកបានផ្គូផ្គងត្រឹមត្រូវទាំងអស់។</p>
              
              <button
                onClick={() => setLevel(l => l + 1)}
                className="w-full max-w-sm mx-auto py-4 px-6 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 text-lg"
              >
                បន្តទៅកម្រិតបន្ទាប់
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
