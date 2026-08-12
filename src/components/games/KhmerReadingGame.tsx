import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Play, Star, Image as ImageIcon, FormInput, Type } from 'lucide-react';

interface KhmerReadingGameProps {
  onBack: () => void;
}

type ModeType = 'match' | 'spell' | 'fill';

interface VocabItem {
  word: string;
  emoji: string;
  clusters: string[];
  blankPart: string;
  blankOptions: string[];
}

const VOCABULARY: VocabItem[] = [
  { word: "សៀវភៅ", emoji: "📖", clusters: ["សៀ", "វ", "ភៅ"], blankPart: "ភៅ", blankOptions: ["ភៅ", "កៅ", "ចៅ", "សៅ"] },
  { word: "ប៉ោម", emoji: "🍎", clusters: ["ប៉ោ", "ម"], blankPart: "ប៉ោ", blankOptions: ["ប៉ោ", "ពោ", "ម៉ោ", "កោ"] },
  { word: "សាលា", emoji: "🏫", clusters: ["សា", "លា"], blankPart: "សា", blankOptions: ["សា", "កា", "ចា", "បា"] },
  { word: "កុមារ", emoji: "🧒", clusters: ["កុ", "មា", "រ"], blankPart: "កុ", blankOptions: ["កុ", "ចុ", "តុ", "មុ"] },
  { word: "កង់", emoji: "🚲", clusters: ["ក", "ង់"], blankPart: "ង់", blankOptions: ["ង់", "ង", "ម", "ន់"] },
  { word: "ឆ្កែ", emoji: "🐕", clusters: ["ឆ្ក", "ែ"], blankPart: "ឆ្ក", blankOptions: ["ឆ្ក", "ឆ្ម", "ឆ្ង", "ឆ្ប"] },
  { word: "ឆ្មា", emoji: "🐈", clusters: ["ឆ្ម", "ា"], blankPart: "ា", blankOptions: ["ា", "ី", "េ", "ែ"] },
  { word: "ទូក", emoji: "🚤", clusters: ["ទូ", "ក"], blankPart: "ទូ", blankOptions: ["ទូ", "ចូ", "ដូ", "រូ"] },
  { word: "ផ្ទះ", emoji: "🏠", clusters: ["ផ្ទ", "ះ"], blankPart: "ផ្ទ", blankOptions: ["ផ្ទ", "ផ្ត", "ផ្ក", "ផ្ល"] },
  { word: "ទឹក", emoji: "💧", clusters: ["ទឹ", "ក"], blankPart: "ទឹ", blankOptions: ["ទឹ", "ទី", "ទុ", "ទាំ"] },
  { word: "ចេក", emoji: "🍌", clusters: ["ចេ", "ក"], blankPart: "ចេ", blankOptions: ["ចេ", "ចែ", "ចោ", "ចៅ"] },
  { word: "មាន់", emoji: "🐓", clusters: ["មា", "ន់"], blankPart: "ន់", blankOptions: ["ន់", "ន", "ម", "រ"] },
  { word: "ត្រី", emoji: "🐟", clusters: ["ត្រ", "ី"], blankPart: "ត្រ", blankOptions: ["ត្រ", "ព្រ", "ក្រ", "ស្រ"] },
  { word: "សេះ", emoji: "🐎", clusters: ["សេ", "ះ"], blankPart: "សេ", blankOptions: ["សេ", "សែ", "សោ", "សុំ"] },
  { word: "ដំរី", emoji: "🐘", clusters: ["ដំ", "រី"], blankPart: "ដំ", blankOptions: ["ដំ", "ចាំ", "តំ", "បាំ"] },
  { word: "ឡាន", emoji: "🚗", clusters: ["ឡា", "ន"], blankPart: "ឡា", blankOptions: ["ឡា", "រា", "លា", "ទា"] },
  { word: "យន្តហោះ", emoji: "✈️", clusters: ["យ", "ន្ត", "ហោះ"], blankPart: "ហោះ", blankOptions: ["ហោះ", "ចុះ", "ណាស់", "តោះ"] },
  { word: "ប៊ិច", emoji: "🖊️", clusters: ["ប៊ិ", "ច"], blankPart: "ប៊ិ", blankOptions: ["ប៊ិ", "ប៊ី", "បា", "ប៉ិ"] },
  { word: "ខ្មៅដៃ", emoji: "✏️", clusters: ["ខ្មៅ", "ដៃ"], blankPart: "ខ្មៅ", blankOptions: ["ខ្មៅ", "ខៀវ", "ស", "ក្រហម"] },
  { word: "កាបូប", emoji: "🎒", clusters: ["កា", "បូ", "ប"], blankPart: "បូ", blankOptions: ["បូ", "តូ", "នូ", "មូ"] },
];

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export default function KhmerReadingGame({ onBack }: KhmerReadingGameProps) {
  const [mode, setMode] = useState<ModeType>('match');
  const [gameState, setGameState] = useState<'idle' | 'playing'>('idle');
  const [score, setScore] = useState(0);
  const [targetWord, setTargetWord] = useState<VocabItem | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [wrongAnswer, setWrongAnswer] = useState<string | null>(null);

  // Mode 1: Match state
  const [matchOptions, setMatchOptions] = useState<VocabItem[]>([]);

  // Mode 2: Spell state
  const [spellOptions, setSpellOptions] = useState<string[]>([]);
  const [spellCurrent, setSpellCurrent] = useState<string[]>([]);

  // Mode 3: Fill state
  const [fillOptions, setFillOptions] = useState<string[]>([]);

  const generateGame = useCallback(() => {
    const target = VOCABULARY[Math.floor(Math.random() * VOCABULARY.length)];
    setTargetWord(target);
    setShowCelebration(false);
    setWrongAnswer(null);

    if (mode === 'match') {
      const options = [target];
      const available = VOCABULARY.filter(v => v.word !== target.word);
      const shuffledAvailable = shuffleArray(available);
      while (options.length < 4 && shuffledAvailable.length > 0) {
        options.push(shuffledAvailable.pop()!);
      }
      setMatchOptions(shuffleArray(options));
    } else if (mode === 'spell') {
      setSpellOptions(shuffleArray(target.clusters));
      setSpellCurrent([]);
    } else if (mode === 'fill') {
      setFillOptions(shuffleArray(target.blankOptions));
    }
  }, [mode]);

  useEffect(() => {
    if (gameState === 'playing') {
      generateGame();
    }
  }, [gameState, mode, generateGame]);

  const handleCorrect = () => {
    setShowCelebration(true);
    setScore(s => s + 1);
    
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
      const successSpeech = new SpeechSynthesisUtterance('ត្រឹមត្រូវល្អណាស់');
      successSpeech.lang = 'km-KH';
      window.speechSynthesis.speak(successSpeech);
    }

    setTimeout(() => {
      generateGame();
    }, 2000);
  };

  const handleWrong = (answer: string) => {
    setWrongAnswer(answer);

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
      const wrongSpeech = new SpeechSynthesisUtterance('មិនទាន់ត្រូវទេ សាកម្តងទៀត');
      wrongSpeech.lang = 'km-KH';
      window.speechSynthesis.speak(wrongSpeech);
    }

    setTimeout(() => setWrongAnswer(null), 800);
  };

  // Handlers for specific modes
  const handleMatchClick = (item: VocabItem) => {
    if (showCelebration) return;
    if (item.word === targetWord?.word) {
      handleCorrect();
    } else {
      handleWrong(item.word);
    }
  };

  const handleSpellClick = (cluster: string, idx: number) => {
    if (showCelebration) return;
    const newCurrent = [...spellCurrent, cluster];
    const newOptions = spellOptions.filter((_, i) => i !== idx);
    setSpellCurrent(newCurrent);
    setSpellOptions(newOptions);

    if (newOptions.length === 0) {
      if (newCurrent.join('') === targetWord?.word) {
        handleCorrect();
      } else {
        handleWrong('spell');
        setTimeout(() => {
          setSpellOptions(shuffleArray(targetWord?.clusters || []));
          setSpellCurrent([]);
        }, 800);
      }
    }
  };

  const handleFillClick = (opt: string) => {
    if (showCelebration) return;
    if (opt === targetWord?.blankPart) {
      handleCorrect();
    } else {
      handleWrong(opt);
    }
  };

  const playTTS = (text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'km-KH';
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 p-4 flex flex-wrap items-center justify-between sticky top-0 z-10 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <span className="text-2xl">📚</span> ល្បែងអានពាក្យ
          </h1>
        </div>

        {/* Mode Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner overflow-x-auto max-w-full">
          <button
            onClick={() => { setMode('match'); setGameState('idle'); }}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
              mode === 'match' ? 'bg-white text-blue-600 shadow' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ImageIcon size={16} /> ផ្គូផ្គងរូប
          </button>
          <button
            onClick={() => { setMode('spell'); setGameState('idle'); }}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
              mode === 'spell' ? 'bg-white text-green-600 shadow' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FormInput size={16} /> ប្រកបពាក្យ
          </button>
          <button
            onClick={() => { setMode('fill'); setGameState('idle'); }}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
              mode === 'fill' ? 'bg-white text-purple-600 shadow' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Type size={16} /> បំពេញអក្សរ
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 md:p-8 max-w-4xl mx-auto w-full relative">
        {gameState === 'idle' ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
            <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 shadow-inner ${
              mode === 'match' ? 'bg-blue-100 text-blue-500' :
              mode === 'spell' ? 'bg-green-100 text-green-500' :
              'bg-purple-100 text-purple-500'
            }`}>
              {mode === 'match' ? <ImageIcon size={64} /> : mode === 'spell' ? <FormInput size={64} /> : <Type size={64} />}
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-4 font-hanuman">
              {mode === 'match' ? 'ល្បែងផ្គូផ្គងពាក្យ' : mode === 'spell' ? 'ល្បែងប្រកបពាក្យ' : 'ល្បែងបំពេញអក្សរ'}
            </h2>
            <p className="text-slate-500 mb-8 max-w-md text-lg">
              {mode === 'match' ? 'អានពាក្យខាងលើ រួចជ្រើសរើសរូបភាពឱ្យបានត្រឹមត្រូវ!' : 
               mode === 'spell' ? 'មើលរូបភាព រួចទាញតួអក្សរមកតម្រៀបគ្នាឱ្យត្រូវជាពាក្យ!' : 
               'ជ្រើសរើសតួអក្សរយកមកបំពេញចន្លោះឱ្យបានត្រឹមត្រូវ!'}
            </p>
            <button
              onClick={() => {
                setGameState('playing');
                setScore(0);
                if (mode === 'match') {
                  const data = VOCABULARY[Math.floor(Math.random() * VOCABULARY.length)];
                  playTTS(data.word);
                }
              }}
              className={`flex items-center gap-3 text-white px-10 py-4 rounded-full font-black text-xl shadow-lg hover:-translate-y-1 transition-all active:scale-95 ${
                mode === 'match' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' :
                mode === 'spell' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/30' :
                'bg-purple-600 hover:bg-purple-700 shadow-purple-500/30'
              }`}
            >
              <Play fill="currentColor" size={24} /> ចាប់ផ្តើមលេង
            </button>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Header: Score and TTS */}
            <div className="mb-6 flex flex-wrap items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-4">
              <div className="flex items-center gap-2 text-2xl font-black text-amber-500">
                <Star className="fill-amber-500 text-amber-500" />
                ពិន្ទុ៖ {score}
              </div>
              
              <button
                onClick={() => targetWord && playTTS(targetWord.word)}
                className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white transition-all shadow-md active:scale-95 bg-indigo-600 hover:bg-indigo-700"
              >
                ស្តាប់ពាក្យ
              </button>
            </div>

            {showCelebration && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-sm rounded-3xl animate-in fade-in duration-300">
                <div className="flex flex-col items-center animate-bounce">
                  <span className="text-8xl mb-4">🎉</span>
                  <h2 className="text-4xl font-black text-green-600 font-hanuman">ត្រឹមត្រូវល្អណាស់!</h2>
                  <div className="mt-4 text-5xl font-hanuman text-blue-600 flex items-center gap-4">
                    {targetWord?.word} <span className="text-6xl">{targetWord?.emoji}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Game Content */}
            {mode === 'match' && targetWord && (
              <div className="flex-1 flex flex-col items-center">
                <div className="bg-blue-50 border-2 border-blue-200 rounded-3xl p-8 mb-10 w-full max-w-md text-center shadow-inner">
                  <h3 className="text-6xl font-black text-blue-800 font-hanuman">{targetWord.word}</h3>
                </div>
                <div className="grid grid-cols-2 gap-6 w-full max-w-lg">
                  {matchOptions.map(opt => (
                    <button
                      key={opt.word}
                      onClick={() => handleMatchClick(opt)}
                      className={`aspect-square bg-white rounded-3xl border-4 text-8xl flex items-center justify-center shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all ${
                        wrongAnswer === opt.word ? 'border-red-500 bg-red-50 animate-[shake_0.5s_ease-in-out]' : 'border-slate-100 hover:border-blue-300'
                      }`}
                    >
                      {opt.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === 'spell' && targetWord && (
              <div className="flex-1 flex flex-col items-center">
                <div className="text-9xl mb-10 animate-pulse-slow">{targetWord.emoji}</div>
                
                {/* Current spelled word */}
                <div className="flex gap-2 mb-12 h-20">
                  {targetWord.clusters.map((_, i) => (
                    <div key={`box-${i}`} className="w-20 h-20 rounded-2xl border-4 border-dashed border-slate-300 bg-slate-100 flex items-center justify-center text-4xl font-black text-green-700 font-hanuman shadow-inner">
                      {spellCurrent[i] || ''}
                    </div>
                  ))}
                </div>

                {/* Options to pick from */}
                <div className="flex flex-wrap gap-4 justify-center">
                  {spellOptions.map((opt, i) => (
                    <button
                      key={`opt-${i}`}
                      onClick={() => handleSpellClick(opt, i)}
                      className={`px-8 py-6 bg-white rounded-2xl border-4 border-slate-200 text-4xl font-black text-slate-700 shadow-md hover:-translate-y-2 hover:shadow-xl hover:border-green-400 transition-all font-hanuman ${
                        wrongAnswer === 'spell' ? 'animate-[shake_0.5s_ease-in-out] border-red-500 bg-red-50' : ''
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === 'fill' && targetWord && (
              <div className="flex-1 flex flex-col items-center">
                <div className="text-8xl mb-8">{targetWord.emoji}</div>
                
                <div className="bg-purple-50 border-2 border-purple-200 rounded-3xl px-12 py-8 mb-12 flex items-center gap-4 text-6xl font-black text-purple-900 font-hanuman shadow-inner">
                  {targetWord.word.replace(targetWord.blankPart, '')}
                  <span className="w-24 border-b-8 border-purple-400 inline-block translate-y-2"></span>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                  {fillOptions.map(opt => (
                    <button
                      key={opt}
                      onClick={() => handleFillClick(opt)}
                      className={`py-6 bg-white rounded-2xl border-4 text-4xl font-black text-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all font-hanuman ${
                        wrongAnswer === opt ? 'border-red-500 bg-red-50 animate-[shake_0.5s_ease-in-out]' : 'border-slate-200 hover:border-purple-400'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </main>
      
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
        }
        .animate-pulse-slow {
          animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
