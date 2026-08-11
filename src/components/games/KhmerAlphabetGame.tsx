import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Volume2, Play, Star, RotateCcw, HelpCircle, Trophy } from 'lucide-react';
import { speakKhmer, primeVoices, playKhmerClip } from '../../lib/khmerSpeech';

interface KhmerAlphabetGameProps {
  onBack: () => void;
}

type TabType = 'consonants' | 'subscript_consonants' | 'dependent_vowels' | 'independent_vowels';
type ModeType = 'learn' | 'quiz';
type DifficultyType = 'easy' | 'medium' | 'hard';

interface LetterItem {
  char: string;
  name: string;
  latin: string;
  type?: 'O' | 'U';
  // Explicit recorded-clip key. Used when the char alone is ambiguous — e.g. the
  // independent vowel «អ» shares its char with the consonant «អ» (c33), so it
  // carries its own key here instead of colliding in AUDIO_KEYS.
  audioKey?: string;
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

const SUBSCRIPT_CONSONANTS: LetterItem[] = [
  { char: '្ក', name: 'ជើង ក', latin: 'ka', type: 'O' }, { char: '្ខ', name: 'ជើង ខ', latin: 'kha', type: 'O' }, { char: '្គ', name: 'ជើង គ', latin: 'ko', type: 'U' }, { char: '្ឃ', name: 'ជើង ឃ', latin: 'kho', type: 'U' }, { char: '្ង', name: 'ជើង ង', latin: 'ngo', type: 'U' },
  { char: '្ច', name: 'ជើង ច', latin: 'ca', type: 'O' }, { char: '្ឆ', name: 'ជើង ឆ', latin: 'cha', type: 'O' }, { char: '្ជ', name: 'ជើង ជ', latin: 'co', type: 'U' }, { char: '្ឈ', name: 'ជើង ឈ', latin: 'cho', type: 'U' }, { char: '្ញ', name: 'ជើង ញ', latin: 'nho', type: 'U' },
  { char: '្ដ', name: 'ជើង ដ', latin: 'da', type: 'O' }, { char: '្ឋ', name: 'ជើង ឋ', latin: 'tha', type: 'O' }, { char: '្ឌ', name: 'ជើង ឌ', latin: 'do', type: 'U' }, { char: '្ឍ', name: 'ជើង ឍ', latin: 'tho', type: 'U' }, { char: '្ណ', name: 'ជើង ណ', latin: 'na', type: 'O' },
  { char: '្ត', name: 'ជើង ត', latin: 'ta', type: 'O' }, { char: '្ថ', name: 'ជើង ថ', latin: 'tha', type: 'O' }, { char: '្ទ', name: 'ជើង ទ', latin: 'to', type: 'U' }, { char: '្ធ', name: 'ជើង ធ', latin: 'tho', type: 'U' }, { char: '្ន', name: 'ជើង ន', latin: 'no', type: 'U' },
  { char: '្ប', name: 'ជើង ប', latin: 'ba', type: 'O' }, { char: '្ផ', name: 'ជើង ផ', latin: 'pha', type: 'O' }, { char: '្ព', name: 'ជើង ព', latin: 'po', type: 'U' }, { char: '្ភ', name: 'ជើង ភ', latin: 'pho', type: 'U' }, { char: '្ម', name: 'ជើង ម', latin: 'mo', type: 'U' },
  { char: '្យ', name: 'ជើង យ', latin: 'yo', type: 'U' }, { char: '្រ', name: 'ជើង រ', latin: 'ro', type: 'U' }, { char: '្ល', name: 'ជើង ល', latin: 'lo', type: 'U' }, { char: '្វ', name: 'ជើង វ', latin: 'vo', type: 'U' },
  { char: '្ស', name: 'ជើង ស', latin: 'sa', type: 'O' }, { char: '្ហ', name: 'ជើង ហ', latin: 'ha', type: 'O' }, { char: '្អ', name: 'ជើង អ', latin: 'a', type: 'O' }
];

const DEPENDENT_VOWELS: LetterItem[] = [
  { char: '◌ា', name: 'ស្រៈ អា', latin: 'a' }, { char: '◌ិ', name: 'ស្រៈ អិ', latin: 'e' }, { char: '◌ី', name: 'ស្រៈ អី', latin: 'ei' }, { char: '◌ឹ', name: 'ស្រៈ អឹ', latin: 'oe' }, { char: '◌ឺ', name: 'ស្រៈ អឺ', latin: 'eu' }, 
  { char: '◌ុ', name: 'ស្រៈ អុ', latin: 'o' }, { char: '◌ូ', name: 'ស្រៈ អូ', latin: 'ou' }, { char: '◌ួ', name: 'ស្រៈ អួ', latin: 'u' }, { char: '◌ើ', name: 'ស្រៈ អើ', latin: 'ae' }, { char: '◌ឿ', name: 'ស្រៈ អឿ', latin: 'ea' }, 
  { char: '◌ៀ', name: 'ស្រៈ អៀ', latin: 'ie' }, { char: '◌េ', name: 'ស្រៈ អេ', latin: 'e' }, { char: '◌ែ', name: 'ស្រៈ អែ', latin: 'ae' }, { char: '◌ៃ', name: 'ស្រៈ អៃ', latin: 'ai' }, { char: '◌ោ', name: 'ស្រៈ អោ', latin: 'o' }, 
  { char: '◌ៅ', name: 'ស្រៈ អៅ', latin: 'ao' }, { char: '◌ុំ', name: 'ស្រៈ អុំ', latin: 'om' }, { char: '◌ំ', name: 'ស្រៈ អំ', latin: 'am' }, { char: '◌ាំ', name: 'ស្រៈ អាំ', latin: 'am' }, { char: '◌ះ', name: 'ស្រៈ អះ', latin: 'ah' }, 
  { char: '◌ុះ', name: 'ស្រៈ អុះ', latin: 'oh' }, { char: '◌េះ', name: 'ស្រៈ អេះ', latin: 'eh' }, { char: '◌ោះ', name: 'ស្រៈ អោះ', latin: 'aoh' }
];

// Standard 15-letter recitation of ស្រៈពេញតួ: អ អា ឥ ឦ ឧ ឩ ឪ ឫ ឬ ឭ ឮ ឯ ឰ ឱ ឳ.
// «អ» and «អា» share chars with the consonant អ / អា, so each carries an explicit audioKey.
const INDEPENDENT_VOWELS: LetterItem[] = [
  { char: 'អ', name: 'ស្រៈ អ', latin: 'a', audioKey: 'iv01' }, { char: 'អា', name: 'ស្រៈ អា', latin: 'aa', audioKey: 'iv02' },
  { char: 'ឥ', name: 'ស្រៈ ឥ', latin: 'e', audioKey: 'iv03' }, { char: 'ឦ', name: 'ស្រៈ ឦ', latin: 'ei', audioKey: 'iv04' }, { char: 'ឧ', name: 'ស្រៈ ឧ', latin: 'o', audioKey: 'iv05' }, { char: 'ឩ', name: 'ស្រៈ ឩ', latin: 'ou', audioKey: 'iv06' }, { char: 'ឪ', name: 'ស្រៈ ឪ', latin: 'ov', audioKey: 'iv07' },
  { char: 'ឫ', name: 'ស្រៈ ឫ', latin: 'rue', audioKey: 'iv08' }, { char: 'ឬ', name: 'ស្រៈ ឬ', latin: 'rueu', audioKey: 'iv09' }, { char: 'ឭ', name: 'ស្រៈ ឭ', latin: 'lue', audioKey: 'iv10' }, { char: 'ឮ', name: 'ស្រៈ ឮ', latin: 'lueu', audioKey: 'iv11' }, { char: 'ឯ', name: 'ស្រៈ ឯ', latin: 'ae', audioKey: 'iv12' },
  { char: 'ឰ', name: 'ស្រៈ ឰ', latin: 'ai', audioKey: 'iv13' }, { char: 'ឱ', name: 'ស្រៈ ឱ', latin: 'ao', audioKey: 'iv14' }, { char: 'ឳ', name: 'ស្រៈ ឳ', latin: 'aou', audioKey: 'iv15' }
];

// Stable audio-clip key per letter, by its unique char — matches the recorded files
// in /public/audio/km/ (c01…c33 consonants, cj01…cj33 subscript/coeng,
// dv01…dv23 dependent vowels, iv01…iv13 independent vowels).
// See /public/audio/km/RECORDING-LIST.md.
const AUDIO_KEYS: Map<string, string> = (() => {
  const m = new Map<string, string>();
  const pad = (n: number) => String(n).padStart(2, '0');
  CONSONANTS.forEach((l, i) => m.set(l.char, `c${pad(i + 1)}`));
  SUBSCRIPT_CONSONANTS.forEach((l, i) => m.set(l.char, `cj${pad(i + 1)}`));
  DEPENDENT_VOWELS.forEach((l, i) => m.set(l.char, `dv${pad(i + 1)}`));
  // INDEPENDENT_VOWELS carry an explicit audioKey (iv01…iv15) on each item to
  // avoid the «អ» char colliding with the consonant «អ» (c33).
  return m;
})();

// Helper to shuffle array
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export default function KhmerAlphabetGame({ onBack }: KhmerAlphabetGameProps) {
  const [mode, setMode] = useState<ModeType>('learn');
  const [activeTab, setActiveTab] = useState<TabType>('consonants');
  const [difficulty, setDifficulty] = useState<DifficultyType>('easy');
  
  // Learn Mode State
  const [activeLetter, setActiveLetter] = useState<LetterItem | null>(null);
  
  // Quiz Mode State
  const [quizState, setQuizState] = useState<'idle' | 'playing'>('idle');
  const [score, setScore] = useState(0);
  const [targetLetter, setTargetLetter] = useState<LetterItem | null>(null);
  const [quizOptions, setQuizOptions] = useState<LetterItem[]>([]);
  const [wrongLetter, setWrongLetter] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    primeVoices();
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const getActiveData = useCallback(() => {
    switch (activeTab) {
      case 'consonants': return CONSONANTS;
      case 'subscript_consonants': return SUBSCRIPT_CONSONANTS;
      case 'dependent_vowels': return DEPENDENT_VOWELS;
      case 'independent_vowels': return INDEPENDENT_VOWELS;
    }
  }, [activeTab]);

  // Play a letter's sound: prefer the recorded clip (works on every device), fall
  // back to TTS text if the clip isn't recorded yet.
  const playSound = useCallback((letter: LetterItem, onEnd?: () => void) => {
    let textToSpeak = letter.name;
    // For single letters (consonants), add "អក្សរ" so the TTS fallback reads it better.
    if (textToSpeak.length === 1 && !textToSpeak.includes('ស្រៈ')) {
      textToSpeak = `អក្សរ ${textToSpeak}`;
    }
    const opts = {
      rate: 0.9,
      onStart: () => setIsPlaying(true),
      onEnd: () => { setIsPlaying(false); onEnd?.(); },
      onError: () => { setIsPlaying(false); onEnd?.(); },
    };
    const key = letter.audioKey || AUDIO_KEYS.get(letter.char);
    if (key) playKhmerClip(key, textToSpeak, opts);
    else speakKhmer(textToSpeak, opts);
  }, []);

  const handlePlayLearnSound = (letter: LetterItem) => {
    setActiveLetter(letter);
    playSound(letter);
  };

  const generateQuiz = useCallback((immediatePlay: boolean = false) => {
    setIsGenerating(true);
    const data = getActiveData();
    const target = data[Math.floor(Math.random() * data.length)];
    
    let optionsCount = data.length;
    if (difficulty === 'easy') optionsCount = Math.min(4, data.length);
    else if (difficulty === 'medium') optionsCount = Math.min(12, data.length);
    
    let options = [target];
    const available = data.filter(d => d.char !== target.char);
    const shuffledAvailable = shuffleArray(available);
    
    while (options.length < optionsCount && shuffledAvailable.length > 0) {
      options.push(shuffledAvailable.pop()!);
    }
    
    setTargetLetter(target);
    setQuizOptions(shuffleArray(options));
    setShowCelebration(false);
    setWrongLetter(null);
    setIsGenerating(false);

    if (immediatePlay) {
      playSound(target);
    } else {
      setTimeout(() => {
        playSound(target);
      }, 500);
    }
  }, [getActiveData, difficulty, playSound]);

  // Handle mode or tab change
  useEffect(() => {
    if (mode === 'quiz') {
      if (quizState === 'playing') {
        generateQuiz(false);
      }
    } else {
      setScore(0);
      setActiveLetter(null);
      setQuizState('idle');
    }
  }, [mode, activeTab, difficulty, generateQuiz, quizState]);

  const handleQuizClick = (letter: LetterItem) => {
    if (showCelebration || isGenerating || !targetLetter) return;

    if (letter.char === targetLetter.char) {
      // Correct
      setShowCelebration(true);
      setScore(s => s + 10);
      playKhmerClip('correct', 'ត្រឹមត្រូវល្អណាស់', { rate: 1.1 });

      setTimeout(() => {
        generateQuiz();
      }, 2500);
    } else {
      // Wrong
      setWrongLetter(letter.char);
      setScore(s => Math.max(0, s - 2));
      playKhmerClip('wrong', 'មិនទាន់ត្រូវទេ ស្តាប់ម្តងទៀត', { rate: 1.1 });

      setTimeout(() => setWrongLetter(null), 800);
      setTimeout(() => {
        if (targetLetter) playSound(targetLetter.name);
      }, 2000);
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
            <span className="text-2xl">🔠</span> អក្ខរក្រមខ្មែរ
          </h1>
        </div>

        {/* Mode Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
          <button
            onClick={() => setMode('learn')}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
              mode === 'learn' ? 'bg-white text-blue-600 shadow' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <HelpCircle size={16} /> រៀនអាន
          </button>
          <button
            onClick={() => setMode('quiz')}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
              mode === 'quiz' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Trophy size={16} /> លេងហ្គេមទាយអក្សរ
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 md:p-8 max-w-6xl mx-auto w-full">
        {/* Tabs for choosing letter category */}
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: 'consonants', label: 'ព្យញ្ជនៈ', icon: 'កខ' },
            { id: 'subscript_consonants', label: 'ជើងព្យញ្ជនៈ', icon: '្ក្ខ' },
            { id: 'dependent_vowels', label: 'ស្រៈនិស្ស័យ', icon: 'ាិី' },
            { id: 'independent_vowels', label: 'ស្រៈពេញតួ', icon: 'ឥឦ' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-md scale-[1.02]' 
                  : 'bg-transparent text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {mode === 'quiz' && (
          <div className="mb-6 flex flex-wrap items-center justify-between bg-orange-50 p-4 rounded-2xl border border-orange-100 shadow-sm gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-orange-900">កម្រិត៖</span>
              <div className="flex bg-white rounded-lg p-1 border border-orange-200">
                {[
                  { id: 'easy', label: 'ងាយ' },
                  { id: 'medium', label: 'មធ្យម' },
                  { id: 'hard', label: 'ពិបាក' }
                ].map(diff => (
                  <button
                    key={diff.id}
                    onClick={() => setDifficulty(diff.id as DifficultyType)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      difficulty === diff.id ? 'bg-orange-500 text-white' : 'text-slate-500 hover:bg-orange-50'
                    }`}
                  >
                    {diff.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-xl font-black text-orange-600">
                <Star className="fill-orange-500 text-orange-500 animate-pulse" />
                ពិន្ទុ៖ {score}
              </div>
              
              <button
                onClick={() => targetLetter && playSound(targetLetter.name)}
                className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white transition-all shadow-md active:scale-95 ${
                  isPlaying ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
                }`}
              >
                {isPlaying ? <Volume2 className="animate-pulse" size={20} /> : <RotateCcw size={20} />}
                ស្តាប់ម្ដងទៀត
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Grid */}
          <div className="flex-1 relative">
            
            {showCelebration && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-sm rounded-3xl animate-in fade-in duration-300">
                <div className="flex flex-col items-center animate-bounce">
                  <span className="text-8xl mb-4">🎉</span>
                  <h2 className="text-4xl font-black text-green-600 font-hanuman">ត្រឹមត្រូវល្អណាស់!</h2>
                  <div className="mt-4 text-6xl font-hanuman text-blue-600">{targetLetter?.char}</div>
                </div>
              </div>
            )}

            <div className={`grid gap-3 md:gap-4 ${
              (mode === 'quiz' ? quizOptions : getActiveData()).length <= 4 ? 'grid-cols-2 max-w-lg mx-auto' :
              (mode === 'quiz' ? quizOptions : getActiveData()).length <= 12 ? 'grid-cols-3 md:grid-cols-4' :
              activeTab === 'consonants' ? 'grid-cols-4 md:grid-cols-5' : 
              activeTab === 'subscript_consonants' ? 'grid-cols-4 md:grid-cols-5' : 
              activeTab === 'dependent_vowels' ? 'grid-cols-4 md:grid-cols-6' : 
              'grid-cols-3 md:grid-cols-5'
            }`}>
              {mode === 'quiz' && quizState === 'idle' ? (
                <div className="col-span-full flex flex-col items-center justify-center py-20">
                  <div className="w-24 h-24 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <Trophy size={48} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">ត្រៀមខ្លួនរួចរាល់ឬនៅ?</h2>
                  <p className="text-slate-500 mb-8 max-w-md text-center">ស្តាប់សំឡេងអានតួអក្សរ រួចចុចជ្រើសរើសតួអក្សរដែលត្រឹមត្រូវឱ្យបានលឿន!</p>
                  <button
                    onClick={() => {
                      setQuizState('playing');
                      setScore(0);
                      generateQuiz(true);
                    }}
                    className="flex items-center gap-3 bg-orange-500 hover:bg-orange-600 text-white px-10 py-4 rounded-full font-black text-xl shadow-lg shadow-orange-500/30 hover:-translate-y-1 transition-all active:scale-95"
                  >
                    <Play fill="currentColor" size={24} /> ចាប់ផ្តើមលេង
                  </button>
                </div>
              ) : (mode === 'quiz' ? quizOptions : getActiveData()).map((letter, idx) => (
                <button
                  key={`${mode}-${letter.char}-${idx}`}
                  onClick={() => mode === 'learn' ? handlePlayLearnSound(letter) : handleQuizClick(letter)}
                  className={`
                    aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 md:gap-2 transition-all group
                    hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-500/20
                    ${mode === 'learn' && activeLetter?.char === letter.char 
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md shadow-blue-500/10 scale-105' 
                      : mode === 'quiz' && wrongLetter === letter.char
                      ? 'border-red-500 bg-red-50 text-red-600 animate-[shake_0.5s_ease-in-out]'
                      : 'border-slate-200 bg-white hover:border-blue-300 text-slate-800'
                    }
                  `}
                >
                  <span className={`text-5xl md:text-6xl lg:text-7xl font-hanuman transition-transform group-hover:scale-110 ${letter.type === 'O' ? 'text-rose-600' : letter.type === 'U' ? 'text-indigo-600' : ''}`}>
                    {letter.char}
                  </span>
                  {mode === 'learn' && (
                    <span className={`text-xs md:text-sm font-medium ${activeLetter?.char === letter.char ? 'text-blue-600' : 'text-slate-400'}`}>
                      {letter.latin}
                    </span>
                  )}
                </button>
              ))}
            </div>
            
            {(activeTab === 'consonants' || activeTab === 'subscript_consonants') && mode === 'learn' && (
              <div className="mt-6 flex justify-center gap-6 text-sm font-medium">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-rose-600"></span> ពួក "អ" (O)</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-indigo-600"></span> ពួក "អ៊" (U)</div>
              </div>
            )}
          </div>

          {/* Side Panel for Active Letter (Only in Learn Mode) */}
          {mode === 'learn' && (
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
                      onClick={() => handlePlayLearnSound(activeLetter)}
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
          )}
        </div>
      </main>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
        }
      `}</style>
    </div>
  );
}
