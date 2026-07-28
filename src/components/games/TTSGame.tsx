import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, Square, Volume2 } from 'lucide-react';

interface TTSGameProps {
  onBack: () => void;
}

const STORIES = [
  {
    title: 'កូនសិស្សល្អ',
    content: 'រៀងរាល់ព្រឹក សុខាតែងតែក្រោកពីព្រលឹមដើម្បីរៀបចំខ្លួនទៅសាលារៀន។ នាងតែងតែគោរពម៉ោងពេល និងស្តាប់ដំបូន្មានគ្រូជានិច្ច។ សុខាចូលចិត្តអានសៀវភៅ និងជួយមិត្តភក្តិ។'
  },
  {
    title: 'សួនច្បារ',
    content: 'នៅមុខផ្ទះខ្ញុំមានសួនច្បារមួយយ៉ាងស្រស់ស្អាត។ នៅក្នុងសួននោះមានដាំផ្កាចម្រុះពណ៌ដូចជា ផ្កាកូឡាប ផ្កាម្លិះ និងផ្កាឈូករ័ត្ន។ ខ្ញុំតែងតែស្រោចទឹកវារាល់ថ្ងៃ។'
  },
  {
    title: 'ប្រាសាទអង្គរវត្ត',
    content: 'ប្រាសាទអង្គរវត្តគឺជាសម្បត្តិបេតិកភណ្ឌពិភពលោក។ ប្រាសាទនេះមានទីតាំងស្ថិតនៅក្នុងខេត្តសៀមរាប។ ភ្ញៀវទេសចរជាតិនិងអន្តរជាតិរាប់លាននាក់តែងតែទៅទស្សនារៀងរាល់ឆ្នាំ។'
  }
];

export default function TTSGame({ onBack }: TTSGameProps) {
  const [currentStory, setCurrentStory] = useState(STORIES[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [synth, setSynth] = useState<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSynth(window.speechSynthesis);
    }
    
    return () => {
      if (synth) {
        synth.cancel();
      }
    };
  }, [synth]);

  const handlePlay = () => {
    if (!synth) {
      alert('កម្មវិធីរុករករបស់អ្នកមិនគាំទ្រមុខងារអានសំឡេងទេ។');
      return;
    }

    if (isPlaying) {
      synth.cancel();
      setIsPlaying(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(currentStory.content);
    utterance.lang = 'km-KH'; // Try Khmer language
    utterance.rate = 0.9; // Slightly slower
    
    // Fallback if browser doesn't have Khmer
    const voices = synth.getVoices();
    const khmerVoice = voices.find(v => v.lang.includes('km'));
    if (khmerVoice) {
      utterance.voice = khmerVoice;
    }

    utterance.onend = () => {
      setIsPlaying(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
    };

    synth.speak(utterance);
    setIsPlaying(true);
  };

  const nextStory = () => {
    if (synth && isPlaying) synth.cancel();
    setIsPlaying(false);
    const currentIndex = STORIES.findIndex(s => s.title === currentStory.title);
    const nextIndex = (currentIndex + 1) % STORIES.length;
    setCurrentStory(STORIES[nextIndex]);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              if (synth) synth.cancel();
              onBack();
            }}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <span>🗣️</span> អានអត្ថបទ
          </h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-4 py-8">
        <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-slate-200 max-w-2xl w-full flex flex-col">
          
          <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
            <h2 className="text-2xl font-black text-slate-800 text-center flex-1">
              {currentStory.title}
            </h2>
            <Volume2 className="text-slate-300" />
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl mb-8 min-h-64 leading-loose">
            <p className="text-xl text-slate-700 font-medium whitespace-pre-line">
              {currentStory.content}
            </p>
          </div>

          <div className="flex justify-center gap-4 mt-auto">
            <button
              onClick={handlePlay}
              className={`flex items-center justify-center gap-2 py-4 px-8 rounded-full font-bold text-lg transition-all shadow-lg ${
                isPlaying 
                  ? 'bg-red-50 text-red-500 border border-red-200 shadow-red-500/10 hover:bg-red-100' 
                  : 'bg-blue-500 text-white shadow-blue-500/30 hover:bg-blue-600 hover:-translate-y-1'
              }`}
            >
              {isPlaying ? (
                <>
                  <Square fill="currentColor" size={24} /> បញ្ឈប់
                </>
              ) : (
                <>
                  <Play fill="currentColor" size={24} /> ស្តាប់សំឡេង
                </>
              )}
            </button>
            
            <button
              onClick={nextStory}
              className="py-4 px-8 rounded-full font-bold text-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              រឿងបន្ទាប់
            </button>
          </div>
          
          <p className="text-center text-xs text-slate-400 mt-6">
            ចំណាំ៖ សំឡេងអានតម្រូវឱ្យកម្មវិធីរុករក (Browser) របស់អ្នកមានមុខងារអានភាសាខ្មែរ (Khmer TTS)។
          </p>
        </div>
      </main>
    </div>
  );
}
