import React, { useState, useEffect } from 'react';
import { ArrowLeft, Volume2, Play } from 'lucide-react';

interface KhmerAlphabetGameProps {
  onBack: () => void;
}

type TabType = 'consonants' | 'dependent_vowels' | 'independent_vowels';

interface LetterItem {
  char: string;
  name: string;
  latin: string;
  type?: 'O' | 'U';
}

const CONSONANTS: LetterItem[] = [
  { char: 'ក', name: 'ក', latin: 'ka', type: 'O' }, { char: 'ខ', name: 'ខ', latin: 'kha', type: 'O' }, { char: 'គ', name: 'គ', latin: 'ko', type: 'U' }, { char: 'ឃ', name: 'ឃ', latin: 'kho', type: 'U' }, { char: 'ង', name: 'ង', latin: 'ngo', type: 'U' },
  { char: 'ច', name: 'ច', latin: 'ca', type: 'O' }, { char: 'ឆ', name: 'ឆ', latin: 'cha', type: 'O' }, { char: 'ជ', name: 'ជ', latin: 'co', type: 'U' }, { char: 'ឈ', name: 'ឈ', latin: 'cho', type: 'U' }, { char: 'ញ', name: 'ញ', latin: 'nho', type: 'U' },
  { char: 'ដ', name: 'ដ', latin: 'da', type: 'O' }, { char: 'ឋ', name: 'ឋ', latin: 'tha', type: 'O' }, { char: 'ឌ', name: 'ឌ', latin: 'do', type: 'U' }, { char: 'ឍ', name: 'ឍ', latin: 'tho', type: 'U' }, { char: 'ណ', name: 'ណ', latin: 'na', type: 'O' },
  { char: 'ត', name: 'ត', latin: 'ta', type: 'O' }, { char: 'ថ', name: 'ថ', latin: 'tha', type: 'O' }, { char: 'ទ', name: 'ទ', latin: 'to', type: 'U' }, { char: 'ធ', name: 'ធ', latin: 'tho', type: 'U' }, { char: 'ន', name: 'ន', latin: 'no', type: 'U' },
  { char: 'ប', name: 'ប', latin: 'ba', type: 'O' }, { char: 'ផ', name: 'ផ', latin: 'pha', type: 'O' }, { char: 'ព', name: 'ព', latin: 'po', type: 'U' }, { char: 'ភ', name: 'ភ', latin: 'pho', type: 'U' }, { char: 'ម', name: 'ម', latin: 'mo', type: 'U' },
  { char: 'យ', name: 'យ', latin: 'yo', type: 'U' }, { char: 'រ', name: 'រ', latin: 'ro', type: 'U' }, { char: 'ល', name: 'ល', latin: 'lo', type: 'U' }, { char: 'វ', name: 'វ', latin: 'vo', type: 'U' },
  { char: 'ស', name: 'ស', latin: 'sa', type: 'O' }, { char: 'ហ', name: 'ហ', latin: 'ha', type: 'O' }, { char: 'ឡ', name: 'ឡ', latin: 'la', type: 'O' }, { char: 'អ', name: 'អ', latin: 'a', type: 'O' }
];

const DEPENDENT_VOWELS: LetterItem[] = [
  { char: '◌ា', name: 'ស្រៈ អា', latin: 'a' }, { char: '◌ិ', name: 'ស្រៈ អិ', latin: 'e' }, { char: '◌ី', name: 'ស្រៈ អី', latin: 'ei' }, { char: '◌ឹ', name: 'ស្រៈ អឹ', latin: 'oe' }, { char: '◌ឺ', name: 'ស្រៈ អឺ', latin: 'eu' }, 
  { char: '◌ុ', name: 'ស្រៈ អុ', latin: 'o' }, { char: '◌ូ', name: 'ស្រៈ អូ', latin: 'ou' }, { char: '◌ួ', name: 'ស្រៈ អួ', latin: 'u' }, { char: '◌ើ', name: 'ស្រៈ អើ', latin: 'ae' }, { char: '◌ឿ', name: 'ស្រៈ អឿ', latin: 'ea' }, 
  { char: '◌ៀ', name: 'ស្រៈ អៀ', latin: 'ie' }, { char: '◌េ', name: 'ស្រៈ អេ', latin: 'e' }, { char: '◌ែ', name: 'ស្រៈ អែ', latin: 'ae' }, { char: '◌ៃ', name: 'ស្រៈ អៃ', latin: 'ai' }, { char: '◌ោ', name: 'ស្រៈ អោ', latin: 'o' }, 
  { char: '◌ៅ', name: 'ស្រៈ អៅ', latin: 'ao' }, { char: '◌ុំ', name: 'ស្រៈ អុំ', latin: 'om' }, { char: '◌ំ', name: 'ស្រៈ អំ', latin: 'am' }, { char: '◌ាំ', name: 'ស្រៈ អាំ', latin: 'am' }, { char: '◌ះ', name: 'ស្រៈ អះ', latin: 'ah' }, 
  { char: '◌ុះ', name: 'ស្រៈ អុះ', latin: 'oh' }, { char: '◌េះ', name: 'ស្រៈ អេះ', latin: 'eh' }, { char: '◌ោះ', name: 'ស្រៈ អោះ', latin: 'aoh' }
];

const INDEPENDENT_VOWELS: LetterItem[] = [
  { char: 'ឥ', name: 'ស្រៈ ឥ', latin: 'e' }, { char: 'ឦ', name: 'ស្រៈ ឦ', latin: 'ei' }, { char: 'ឧ', name: 'ស្រៈ ឧ', latin: 'o' }, { char: 'ឩ', name: 'ស្រៈ ឩ', latin: 'ou' }, { char: 'ឪ', name: 'ស្រៈ ឪ', latin: 'ov' }, 
  { char: 'ឫ', name: 'ស្រៈ ឫ', latin: 'rue' }, { char: 'ឬ', name: 'ស្រៈ ឬ', latin: 'rueu' }, { char: 'ឭ', name: 'ស្រៈ ឭ', latin: 'lue' }, { char: 'ឮ', name: 'ស្រៈ ឮ', latin: 'lueu' }, { char: 'ឯ', name: 'ស្រៈ ឯ', latin: 'ae' }, 
  { char: 'ឰ', name: 'ស្រៈ ឰ', latin: 'ai' }, { char: 'ឱ', name: 'ស្រៈ ឱ', latin: 'ao' }, { char: 'ឳ', name: 'ស្រៈ ឳ', latin: 'aou' }
];

export default function KhmerAlphabetGame({ onBack }: KhmerAlphabetGameProps) {
  const [activeTab, setActiveTab] = useState<TabType>('consonants');
  const [activeLetter, setActiveLetter] = useState<LetterItem | null>(null);
  const [synth, setSynth] = useState<SpeechSynthesis | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSynth(window.speechSynthesis);
    }
    return () => {
      if (synth) synth.cancel();
    };
  }, [synth]);

  const handlePlaySound = (letter: LetterItem) => {
    setActiveLetter(letter);
    
    if (!synth) return;
    synth.cancel();

    // Use just the letter character itself or its spoken name
    const utterance = new SpeechSynthesisUtterance(letter.name.replace('ស្រៈ ', ''));
    utterance.lang = 'km-KH';
    utterance.rate = 0.8;
    
    const voices = synth.getVoices();
    const khmerVoice = voices.find(v => v.lang.includes('km'));
    if (khmerVoice) {
      utterance.voice = khmerVoice;
    }

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    synth.speak(utterance);
  };

  const getActiveData = () => {
    switch (activeTab) {
      case 'consonants': return CONSONANTS;
      case 'dependent_vowels': return DEPENDENT_VOWELS;
      case 'independent_vowels': return INDEPENDENT_VOWELS;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <span className="text-2xl">🔠</span> អក្ខរក្រមខ្មែរ
          </h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 md:p-8 max-w-6xl mx-auto w-full">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
          {[
            { id: 'consonants', label: 'ព្យញ្ជនៈ ៣៣តួ', icon: '📝' },
            { id: 'dependent_vowels', label: 'ស្រៈនិស្ស័យ', icon: '〰️' },
            { id: 'independent_vowels', label: 'ស្រៈពេញតួ', icon: '🔤' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]' 
                  : 'bg-transparent text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Grid */}
          <div className="flex-1">
            <div className={`grid gap-3 md:gap-4 ${
              activeTab === 'consonants' ? 'grid-cols-4 md:grid-cols-5' : 
              activeTab === 'dependent_vowels' ? 'grid-cols-4 md:grid-cols-6' : 
              'grid-cols-3 md:grid-cols-5'
            }`}>
              {getActiveData().map((letter, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePlaySound(letter)}
                  className={`
                    aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 md:gap-2 transition-all group
                    hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-500/20
                    ${activeLetter?.char === letter.char 
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md shadow-blue-500/10' 
                      : 'border-slate-200 bg-white hover:border-blue-300 text-slate-800'
                    }
                  `}
                >
                  <span className={`text-4xl md:text-5xl lg:text-6xl font-hanuman transition-transform group-hover:scale-110 ${letter.type === 'O' ? 'text-rose-600' : letter.type === 'U' ? 'text-indigo-600' : ''}`}>
                    {letter.char}
                  </span>
                  <span className={`text-xs md:text-sm font-medium ${activeLetter?.char === letter.char ? 'text-blue-600' : 'text-slate-400'}`}>
                    {letter.latin}
                  </span>
                </button>
              ))}
            </div>
            
            {activeTab === 'consonants' && (
              <div className="mt-6 flex justify-center gap-6 text-sm font-medium">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-rose-600"></span> ពួក "អ" (O)</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-indigo-600"></span> ពួក "អ៊" (U)</div>
              </div>
            )}
          </div>

          {/* Side Panel for Active Letter */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 sticky top-24 flex flex-col items-center text-center">
              {activeLetter ? (
                <>
                  <div className={`w-32 h-32 md:w-48 md:h-48 rounded-3xl flex items-center justify-center mb-6 shadow-inner ${
                    activeLetter.type === 'O' ? 'bg-rose-50 border border-rose-100 text-rose-600' : 
                    activeLetter.type === 'U' ? 'bg-indigo-50 border border-indigo-100 text-indigo-600' : 
                    'bg-slate-50 border border-slate-100 text-slate-700'
                  }`}>
                    <span className="text-7xl md:text-9xl font-hanuman">{activeLetter.char}</span>
                  </div>
                  <h2 className="text-3xl font-black text-slate-800 mb-2 font-hanuman">
                    {activeLetter.name}
                  </h2>
                  <p className="text-lg text-slate-500 font-medium mb-8">
                    [{activeLetter.latin}]
                  </p>
                  <button
                    onClick={() => handlePlaySound(activeLetter)}
                    className={`flex items-center gap-2 px-8 py-4 rounded-full font-bold text-white transition-all w-full justify-center text-lg ${
                      isPlaying 
                        ? 'bg-blue-400 scale-95 shadow-inner' 
                        : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30 hover:-translate-y-1'
                    }`}
                  >
                    {isPlaying ? <Volume2 className="animate-pulse" size={24} /> : <Play size={24} />}
                    {isPlaying ? 'កំពុងអាន...' : 'ស្តាប់សំឡេង'}
                  </button>
                </>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 opacity-60">
                  <Volume2 size={64} className="mb-4" />
                  <p className="font-medium text-lg">សូមចុចលើតួអក្សរ</p>
                  <p className="text-sm">ដើម្បីស្តាប់ការបញ្ចេញសំឡេង</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
