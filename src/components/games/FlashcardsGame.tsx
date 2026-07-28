import React, { useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

interface FlashcardsGameProps {
  onBack: () => void;
}

const CARDS = [
  { id: 1, front: '🐘', back: 'សត្វដំរី', desc: 'សត្វធំជាងគេនៅលើគោក មានប្រមោយវែង។' },
  { id: 2, front: '🐅', back: 'សត្វខ្លា', desc: 'សត្វសាហាវ មានឆ្នូតពណ៌ខ្មៅនិងលឿង។' },
  { id: 3, front: '🏫', back: 'សាលារៀន', desc: 'ទីកន្លែងសម្រាប់សិស្សានុសិស្សរៀនសូត្រ។' },
  { id: 4, front: '🏥', back: 'មន្ទីរពេទ្យ', desc: 'ទីកន្លែងសម្រាប់ព្យាបាលអ្នកជំងឺ។' },
  { id: 5, front: '🚑', back: 'រថយន្តសង្គ្រោះ', desc: 'ឡានសម្រាប់ដឹកអ្នកជំងឺទៅមន្ទីរពេទ្យបន្ទាន់។' },
  { id: 6, front: '👮', back: 'ប៉ូលិស', desc: 'អ្នកការពារសន្តិសុខសណ្តាប់ធ្នាប់សង្គម។' },
  { id: 7, front: '👨‍🏫', back: 'គ្រូបង្រៀន', desc: 'អ្នកផ្តល់ចំណេះដឹងដល់សិស្ស។' },
  { id: 8, front: '🇰🇭', back: 'ទង់ជាតិកម្ពុជា', desc: 'ទង់ជាតិមាន៣ពណ៌ គឺខៀវ ក្រហម និងរូបប្រាសាទអង្គរវត្តនៅកណ្តាល។' },
];

export default function FlashcardsGame({ onBack }: FlashcardsGameProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleNext = () => {
    if (currentIndex < CARDS.length - 1) {
      setIsFlipped(false);
      setTimeout(() => {
        setCurrentIndex(c => c + 1);
      }, 150);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => {
        setCurrentIndex(c => c - 1);
      }, 150);
    }
  };

  const currentCard = CARDS[currentIndex];

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
            <span>📇</span> ប័ណ្ណពាក្យ (Flashcards)
          </h1>
        </div>
        <div className="px-3 py-1 bg-violet-100 text-violet-700 font-bold rounded-full text-sm">
          {currentIndex + 1} / {CARDS.length}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        
        <div className="text-center mb-8">
          <h2 className="text-xl text-slate-800 font-bold">រៀនពាក្យថ្មីៗ</h2>
          <p className="text-slate-500">ចុចលើប័ណ្ណដើម្បីមើលអត្ថន័យ</p>
        </div>

        {/* Flashcard container */}
        <div 
          className="relative w-full max-w-sm h-80 perspective-1000 mb-10 cursor-pointer"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div className={`w-full h-full transition-transform duration-500 preserve-3d relative ${isFlipped ? 'rotate-y-180' : ''}`}>
            
            {/* Front of card */}
            <div className="absolute w-full h-full backface-hidden bg-white border-2 border-slate-200 rounded-3xl shadow-lg flex flex-col items-center justify-center p-8">
              <div className="text-9xl mb-4 drop-shadow-md">
                {currentCard.front}
              </div>
              <div className="text-slate-400 font-medium flex items-center gap-2 mt-4">
                <RotateCcw size={16} /> ចុចដើម្បីបង្វិល
              </div>
            </div>
            
            {/* Back of card */}
            <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-violet-500 border-2 border-violet-400 rounded-3xl shadow-lg flex flex-col items-center justify-center p-8 text-center text-white">
              <h3 className="text-4xl font-black mb-6 leading-tight">
                {currentCard.back}
              </h3>
              <div className="w-16 h-1 bg-violet-300 rounded-full mb-6"></div>
              <p className="text-lg font-medium text-violet-100 leading-relaxed">
                {currentCard.desc}
              </p>
            </div>

          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6 w-full max-w-sm justify-between">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-white border border-slate-200 shadow-sm text-slate-700 hover:bg-slate-50 hover:text-violet-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={28} />
          </button>
          
          <div className="flex gap-2">
            {CARDS.map((_, idx) => (
              <div 
                key={idx}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentIndex ? 'bg-violet-500 w-6' : 'bg-slate-300'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={currentIndex === CARDS.length - 1}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-violet-500 border border-violet-500 shadow-md shadow-violet-500/30 text-white hover:bg-violet-600 disabled:opacity-30 disabled:shadow-none disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={28} />
          </button>
        </div>
      </main>
    </div>
  );
}
