import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, RotateCcw } from 'lucide-react';
import { speakKhmer, playKhmerClip } from '../../lib/khmerSpeech';

interface MatchWordGameProps {
  onBack: () => void;
}

const DICTIONARY = [
  // Fruits & Vegetables
  { id: 1, image: '🍎', word: 'ផ្លែប៉ោម' },
  { id: 2, image: '🍌', word: 'ចេក' },
  { id: 3, image: '🍉', word: 'ឪឡឹក' },
  { id: 4, image: '🍇', word: 'ទំពាំងបាយជូរ' },
  { id: 5, image: '🍓', word: 'ស្ត្របឺរី' },
  { id: 6, image: '🥭', word: 'ស្វាយ' },
  { id: 7, image: '🍍', word: 'ម្នាស់' },
  { id: 8, image: '🥥', word: 'ដូង' },
  { id: 9, image: '🥑', word: 'ផ្លែប័រ' },
  { id: 10, image: '🥕', word: 'ការ៉ុត' },
  { id: 11, image: '🌽', word: 'ពោត' },
  { id: 12, image: '🍅', word: 'ប៉េងប៉ោះ' },
  { id: 13, image: '🥔', word: 'ដំឡូងបារាំង' },
  { id: 14, image: '🍆', word: 'ត្រប់' },
  { id: 15, image: '🌶️', word: 'ម្ទេស' },

  // Animals
  { id: 16, image: '🐕', word: 'ឆ្កែ' },
  { id: 17, image: '🐈', word: 'ឆ្មា' },
  { id: 18, image: '🐘', word: 'ដំរី' },
  { id: 19, image: '🐒', word: 'ស្វា' },
  { id: 20, image: '🐅', word: 'ខ្លា' },
  { id: 21, image: '🦁', word: 'តោ' },
  { id: 22, image: '🐄', word: 'គោ' },
  { id: 23, image: '🐖', word: 'ជ្រូក' },
  { id: 24, image: '🐎', word: 'សេះ' },
  { id: 25, image: '🐓', word: 'មាន់' },
  { id: 26, image: '🦆', word: 'ទា' },
  { id: 27, image: '🐦', word: 'បក្សី' },
  { id: 28, image: '🐟', word: 'ត្រី' },
  { id: 29, image: '🐢', word: 'អណ្តើក' },
  { id: 30, image: '🐍', word: 'ពស់' },
  { id: 31, image: '🐊', word: 'ក្រពើ' },
  { id: 32, image: '🦋', word: 'មេអំបៅ' },
  { id: 33, image: '🐝', word: 'ឃ្មុំ' },
  { id: 34, image: '🐜', word: 'ស្រមោច' },

  // Vehicles
  { id: 35, image: '🚗', word: 'ឡាន' },
  { id: 36, image: '🚕', word: 'តាក់ស៊ី' },
  { id: 37, image: '🚌', word: 'ឡានក្រុង' },
  { id: 38, image: '🚑', word: 'រថយន្តសង្គ្រោះ' },
  { id: 39, image: '🚒', word: 'ឡានទឹក' },
  { id: 40, image: '🚓', word: 'ឡានប៉ូលិស' },
  { id: 41, image: '🚜', word: 'ត្រាក់ទ័រ' },
  { id: 42, image: '🚲', word: 'កង់' },
  { id: 43, image: '🏍️', word: 'ម៉ូតូ' },
  { id: 44, image: '🚂', word: 'រថភ្លើង' },
  { id: 45, image: '✈️', word: 'យន្តហោះ' },
  { id: 46, image: '🚁', word: 'ឧទ្ធម្ភាគចក្រ' },
  { id: 47, image: '⛵', word: 'ទូកក្តោង' },
  { id: 48, image: '🚢', word: 'កប៉ាល់' },
  
  // Nature & Weather
  { id: 49, image: '🌳', word: 'ដើមឈើ' },
  { id: 50, image: '🌴', word: 'ដើមដូង' },
  { id: 51, image: '🌸', word: 'ផ្កា' },
  { id: 52, image: '☀️', word: 'ព្រះអាទិត្យ' },
  { id: 53, image: '🌙', word: 'ព្រះច័ន្ទ' },
  { id: 54, image: '⭐', word: 'ផ្កាយ' },
  { id: 55, image: '☁️', word: 'ពពក' },
  { id: 56, image: '🌧️', word: 'ភ្លៀង' },
  { id: 57, image: '⚡', word: 'រន្ទះ' },
  { id: 58, image: '❄️', word: 'ព្រិល' },
  { id: 59, image: '🔥', word: 'ភ្លើង' },
  { id: 60, image: '💧', word: 'ទឹក' },
  { id: 61, image: '🌊', word: 'រលក' },
  { id: 62, image: '🌈', word: 'ឥន្ទធនូ' },
  { id: 63, image: '⛰️', word: 'ភ្នំ' },

  // Food & Drinks
  { id: 64, image: '🍞', word: 'នំប៉័ង' },
  { id: 65, image: '🥚', word: 'ស៊ុត' },
  { id: 66, image: '🧀', word: 'ឈីស' },
  { id: 67, image: '🥩', word: 'សាច់' },
  { id: 68, image: '🍗', word: 'ភ្លៅមាន់' },
  { id: 69, image: '🍔', word: 'ប៊ឺហ្គឺ' },
  { id: 70, image: '🍟', word: 'ដំឡូងបំពង' },
  { id: 71, image: '🍕', word: 'ភីហ្សា' },
  { id: 72, image: '🍜', word: 'គុយទាវ' },
  { id: 73, image: '🍚', word: 'បាយ' },
  { id: 74, image: '🍰', word: 'នំខេក' },
  { id: 75, image: '🍦', word: 'ការ៉េម' },
  { id: 76, image: '🍫', word: 'សូកូឡា' },
  { id: 77, image: '🍬', word: 'ស្ករគ្រាប់' },
  { id: 78, image: '🥛', word: 'ទឹកដោះគោ' },
  { id: 79, image: '☕', word: 'កាហ្វេ' },
  { id: 80, image: '🍵', word: 'តែ' },
  { id: 81, image: '🧃', word: 'ទឹកផ្លែឈើ' },

  // Objects & School Supplies
  { id: 82, image: '📖', word: 'សៀវភៅ' },
  { id: 83, image: '✏️', word: 'ខ្មៅដៃ' },
  { id: 84, image: '🖊️', word: 'ប៊ិច' },
  { id: 85, image: '📏', word: 'បន្ទាត់' },
  { id: 86, image: '✂️', word: 'កន្ត្រៃ' },
  { id: 87, image: '🎒', word: 'កាបូប' },
  { id: 88, image: '🖍️', word: 'ក្រមួនពណ៌' },
  { id: 89, image: '🗑️', word: 'ធុងសំរាម' },
  { id: 90, image: '🪑', word: 'កៅអី' },
  { id: 91, image: '🛏️', word: 'គ្រែ' },
  { id: 92, image: '🚪', word: 'ទ្វារ' },
  { id: 93, image: '🪟', word: 'បង្អួច' },
  { id: 94, image: '🔑', word: 'សោ' },
  { id: 95, image: '☂️', word: 'ឆ័ត្រ' },
  { id: 96, image: '⏰', word: 'នាឡិកា' },

  // Electronics
  { id: 97, image: '📱', word: 'ទូរស័ព្ទ' },
  { id: 98, image: '💻', word: 'កុំព្យូទ័រ' },
  { id: 99, image: '📺', word: 'ទូរទស្សន៍' },
  { id: 100, image: '📷', word: 'កាមេរ៉ា' },
  { id: 101, image: '🔋', word: 'ថ្ម' },
  { id: 102, image: '💡', word: 'អំពូលភ្លើង' },

  // Clothing
  { id: 103, image: '👕', word: 'អាវយឺត' },
  { id: 104, image: '👖', word: 'ខោ' },
  { id: 105, image: '👗', word: 'រ៉ូប' },
  { id: 106, image: '🧥', word: 'អាវធំ' },
  { id: 107, image: '👟', word: 'ស្បែកជើង' },
  { id: 108, image: '🧢', word: 'មួក' },
  { id: 109, image: '👓', word: 'វ៉ែនតា' },
  { id: 110, image: '🧤', word: 'ស្រោមដៃ' },
  
  // Body Parts
  { id: 111, image: '👁️', word: 'ភ្នែក' },
  { id: 112, image: '👂', word: 'ត្រចៀក' },
  { id: 113, image: '👃', word: 'ច្រមុះ' },
  { id: 114, image: '👄', word: 'មាត់' },
  { id: 115, image: '🦷', word: 'ធ្មេញ' },
  { id: 116, image: '🖐️', word: 'ដៃ' },
  { id: 117, image: '🦵', word: 'ជើង' },
  { id: 118, image: '🦶', word: 'ប្រអប់ជើង' },
  { id: 119, image: '🧠', word: 'ខួរក្បាល' },
  { id: 120, image: '🫀', word: 'បេះដូង' },
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
        playKhmerClip('correct', 'ត្រឹមត្រូវ', { rate: 1.2 });
        setMatchedIds(prev => [...prev, selectedImageId]);
        setScore(s => s + 1);
        setSelectedImageId(null);
        setSelectedWordId(null);
      } else {
        // Wrong
        playKhmerClip('wrong', 'មិនត្រឹមត្រូវ', { rate: 1.2 });
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
                      onClick={() => {
                        setSelectedImageId(item.id);
                        speakKhmer(item.word);
                      }}
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
                      onClick={() => {
                        setSelectedWordId(item.id);
                        speakKhmer(item.word);
                      }}
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
