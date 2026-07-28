import React, { useState, useEffect } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';

interface MemoryGameProps {
  onBack: () => void;
}

const EMOJIS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'];

export default function MemoryGame({ onBack }: MemoryGameProps) {
  const [cards, setCards] = useState<{ id: number; emoji: string; isFlipped: boolean; isMatched: boolean }[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isWon, setIsWon] = useState(false);

  const startLevel = () => {
    const shuffledEmojis = [...EMOJIS, ...EMOJIS]
      .sort(() => Math.random() - 0.5)
      .map((emoji, idx) => ({
        id: idx,
        emoji,
        isFlipped: false,
        isMatched: false,
      }));
    
    setCards(shuffledEmojis);
    setFlippedIndices([]);
    setMoves(0);
    setIsWon(false);
    setIsLocked(false);
  };

  useEffect(() => {
    startLevel();
  }, []);

  const handleCardClick = (index: number) => {
    if (isLocked) return;
    if (cards[index].isFlipped || cards[index].isMatched) return;

    const newFlippedIndices = [...flippedIndices, index];
    setFlippedIndices(newFlippedIndices);
    
    setCards(prev => prev.map((card, i) => i === index ? { ...card, isFlipped: true } : card));

    if (newFlippedIndices.length === 2) {
      setIsLocked(true);
      setMoves(m => m + 1);
      
      const [firstIndex, secondIndex] = newFlippedIndices;
      
      if (cards[firstIndex].emoji === cards[secondIndex].emoji) {
        // Match
        setTimeout(() => {
          setCards(prev => {
            const next = prev.map((card, i) => 
              (i === firstIndex || i === secondIndex) 
                ? { ...card, isMatched: true } 
                : card
            );
            if (next.every(c => c.isMatched)) {
              setIsWon(true);
            }
            return next;
          });
          setFlippedIndices([]);
          setIsLocked(false);
        }, 500);
      } else {
        // No match
        setTimeout(() => {
          setCards(prev => prev.map((card, i) => 
            (i === firstIndex || i === secondIndex) 
              ? { ...card, isFlipped: false } 
              : card
          ));
          setFlippedIndices([]);
          setIsLocked(false);
        }, 1000);
      }
    }
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
            <span>🧠</span> ល្បែងចងចាំ
          </h1>
        </div>
        <div className="px-3 py-1 bg-pink-100 text-pink-700 font-bold rounded-full text-sm">
          ចំនួនបើក: {moves} ដង
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 max-w-lg w-full flex flex-col items-center">
          
          {isWon ? (
            <div className="text-center w-full animate-in zoom-in duration-500 py-10">
              <div className="text-7xl mb-6">🏆</div>
              <h2 className="text-3xl font-black text-slate-800 mb-4">ជ័យជំនះ! 🎉</h2>
              <p className="text-slate-500 mb-8">អ្នកប្រើពេល {moves} ដង ដើម្បីស្វែងរករូបដូចគ្នាទាំងអស់។</p>
              
              <button
                onClick={startLevel}
                className="w-full max-w-sm mx-auto py-4 px-6 rounded-xl font-bold text-white bg-pink-500 hover:bg-pink-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-pink-500/30 text-lg"
              >
                <RotateCcw size={24} /> លេងម្តងទៀត
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-xl text-slate-800 font-bold mb-8">ស្វែងរករូបភាពដូចគ្នា</h2>
              
              <div className="grid grid-cols-4 gap-3 md:gap-4 w-full">
                {cards.map((card, idx) => (
                  <div 
                    key={card.id} 
                    className="relative w-full aspect-square perspective-1000 cursor-pointer"
                    onClick={() => handleCardClick(idx)}
                  >
                    <div className={`w-full h-full transition-transform duration-500 preserve-3d relative ${card.isFlipped ? 'rotate-y-180' : ''}`}>
                      
                      {/* Back of card (visible when face down) */}
                      <div className={`absolute w-full h-full backface-hidden rounded-xl shadow-sm border-2 border-slate-200 flex items-center justify-center transition-colors ${card.isFlipped ? '' : 'bg-slate-100 hover:bg-pink-50 hover:border-pink-200'}`}>
                        <span className="text-3xl text-slate-300">?</span>
                      </div>
                      
                      {/* Front of card (visible when face up) */}
                      <div className={`absolute w-full h-full backface-hidden rotate-y-180 rounded-xl shadow-md border-2 flex items-center justify-center text-4xl bg-white ${card.isMatched ? 'border-green-400 bg-green-50' : 'border-pink-400'}`}>
                        <span className={card.isMatched ? 'animate-bounce' : ''}>
                          {card.emoji}
                        </span>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
