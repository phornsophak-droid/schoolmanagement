import React, { useState, useEffect } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { playKhmerClip } from '../../lib/khmerSpeech';

interface FindPairsGameProps {
  onBack: () => void;
}

const EMOJIS = [
  '🍎', '🍌', '🍉', '🍇', '🍓', '🍒', '🥭', '🍍', '🥝', '🥥', '🥑', '🍆', '🥔', '🥕', '🌽', '🌶️', '🥒', '🥬', '🥦', '🧄',
  '🧅', '🍄', '🥜', '🍞', '🥐', '🥖', '🥨', '🥯', '🥞', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮',
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆',
  '🚗', '🚕', '🚙', '🚌', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚜', '🏍️', '🚲', '🛴', '🚁', '✈️', '🚀', '🛸', '⛵', '🚢',
  '🌲', '🌳', '🌴', '🌵', '🌿', '🍀', '🍁', '🍂', '🌍', '🌎', '🌏', '🌕', '☀️', '⭐', '☁️', '⛅', '⛈️', '🌧️', '❄️', '🔥',
  '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '🥋', '⛳', '⛸️', '🎣', '🎯', '🎮', '🎲', '🧩', '🎨'
];

export default function FindPairsGame({ onBack }: FindPairsGameProps) {
  const [items, setItems] = useState<{ id: string; emoji: string; isMatched: boolean }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [isWon, setIsWon] = useState(false);

  const [pairCount, setPairCount] = useState(10);

  const startLevel = (count: number = pairCount) => {
    // Select random subset of emojis based on count
    const shuffledPool = [...EMOJIS].sort(() => Math.random() - 0.5).slice(0, count);
    
    // Generate pairs
    const paired = [...shuffledPool, ...shuffledPool]
      .sort(() => Math.random() - 0.5)
      .map((emoji, index) => ({
        id: `${index}-${emoji}`,
        emoji,
        isMatched: false
      }));
      
    setItems(paired);
    setSelectedId(null);
    setScore(0);
    setIsWon(false);
    setPairCount(count);
  };

  useEffect(() => {
    startLevel();
  }, []);

  const handleSelect = (item: { id: string; emoji: string; isMatched: boolean }) => {
    if (item.isMatched) return;

    if (selectedId === null) {
      setSelectedId(item.id);
    } else {
      if (selectedId === item.id) {
        // Unselect if clicking the same one
        setSelectedId(null);
        return;
      }

      const firstItem = items.find(i => i.id === selectedId);
      if (firstItem && firstItem.emoji === item.emoji) {
        // Match!
        playKhmerClip('correct', 'ត្រឹមត្រូវ', { rate: 1.2 });
        setItems(prev => prev.map(p => 
          p.id === selectedId || p.id === item.id 
            ? { ...p, isMatched: true } 
            : p
        ));
        setScore(s => s + 1);
        setSelectedId(null);
        
        // Check win
        setTimeout(() => {
          setItems(currentItems => {
            if (currentItems.every(i => i.isMatched)) {
              setIsWon(true);
            }
            return currentItems;
          });
        }, 100);
      } else {
        // Not a match, reset selection
        setSelectedId(null);
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
            <span>🔍</span> ស្វែងរកគូ
          </h1>
        </div>
        <div className="px-3 py-1 bg-amber-100 text-amber-700 font-bold rounded-full text-sm">
          ពិន្ទុ: {score}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200 max-w-2xl w-full flex flex-col items-center">
          
          {isWon ? (
            <div className="text-center w-full animate-in zoom-in duration-500 py-10">
              <div className="text-7xl mb-6">🎉</div>
              <h2 className="text-3xl font-black text-slate-800 mb-4">អបអរសាទរ!</h2>
              <p className="text-slate-500 mb-8">អ្នកបានស្វែងរកគូរូបភាពទាំងអស់ឃើញហើយ។ ពិន្ទុរបស់អ្នកគឺ {score}។</p>
              
              <button
                onClick={() => startLevel(pairCount)}
                className="w-full max-w-sm mx-auto py-4 px-6 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 text-lg"
              >
                <RotateCcw size={24} /> លេងម្តងទៀត
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="text-xl text-slate-800 font-bold mb-2">ស្វែងរកគូរូបភាព</h2>
                <p className="text-slate-500 mb-4">ចុចលើរូបភាព ២ ដែលដូចគ្នា ដើម្បីលុបវាចេញ។</p>
                
                <div className="flex flex-wrap justify-center gap-2 mb-2">
                  {[
                    { label: 'ងាយ', value: 8 },
                    { label: 'មធ្យម', value: 12 },
                    { label: 'ពិបាក', value: 24 },
                    { label: 'ខ្លាំង', value: 50 },
                    { label: 'កំពូល (១០០គូ)', value: 100 }
                  ].map(lvl => (
                    <button
                      key={lvl.value}
                      onClick={() => startLevel(lvl.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                        pairCount === lvl.value 
                          ? 'bg-amber-500 text-white' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex flex-wrap justify-center gap-2 md:gap-3 w-full">
                {items.map(item => {
                  const isSelected = selectedId === item.id;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      disabled={item.isMatched}
                      className={`rounded-xl flex items-center justify-center transition-all ${
                        pairCount >= 50 ? 'w-8 h-8 text-base md:w-10 md:h-10 md:text-xl' :
                        pairCount >= 24 ? 'w-12 h-12 text-2xl md:w-14 md:h-14 md:text-3xl' :
                        'w-16 h-16 md:w-20 md:h-20 text-4xl'
                      } ${
                        item.isMatched 
                          ? 'opacity-0 scale-50 invisible' 
                          : isSelected 
                            ? 'bg-amber-100 border-4 border-amber-500 scale-110 shadow-md' 
                            : 'bg-white border-2 border-slate-200 hover:border-amber-400 hover:shadow shadow-sm'
                      }`}
                      style={{ transitionDuration: '400ms' }}
                    >
                      {item.emoji}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
