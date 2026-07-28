import React, { useState, useRef } from 'react';
import { ArrowLeft, Play, Settings } from 'lucide-react';

interface WordWheelGameProps {
  onBack: () => void;
}

const DEFAULT_WORDS = [
  'សាលារៀន', 'មន្ទីរពេទ្យ', 'គ្រូបង្រៀន', 'សិស្សានុសិស្ស', 
  'បណ្ណាល័យ', 'សៀវភៅ', 'វចនានុក្រម', 'កុំព្យូទ័រ', 
  'ប្រទេសកម្ពុជា', 'អរិយធម៌', 'វប្បធម៌', 'ប្រវត្តិសាស្ត្រ'
];

const COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981', 
  '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', 
  '#D946EF', '#E11D48'
];

export default function WordWheelGame({ onBack }: WordWheelGameProps) {
  const [words, setWords] = useState<string[]>(DEFAULT_WORDS);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [textInput, setTextInput] = useState(DEFAULT_WORDS.join('\n'));
  
  const wheelRef = useRef<HTMLDivElement>(null);

  const spinWheel = () => {
    if (isSpinning || words.length === 0) return;
    
    setIsSpinning(true);
    setSelectedWord(null);
    
    // Calculate new rotation
    const spins = Math.floor(Math.random() * 5) + 5; // 5 to 10 full spins
    const randomDegree = Math.floor(Math.random() * 360);
    const newRotation = rotation + (spins * 360) + randomDegree;
    
    setRotation(newRotation);
    
    // Calculate which word wins
    setTimeout(() => {
      setIsSpinning(false);
      
      const actualRotation = newRotation % 360;
      const sliceAngle = 360 / words.length;
      
      // The pointer is at the top (270 degrees in standard circle or 0 in our CSS rotation)
      // Because we rotate the wheel clockwise, the winning slice is calculated backwards
      const adjustedRotation = (360 - actualRotation + 90) % 360;
      const winningIndex = Math.floor(adjustedRotation / sliceAngle) % words.length;
      
      setSelectedWord(words[winningIndex]);
    }, 4000); // 4 seconds animation
  };

  const saveSettings = () => {
    const newWords = textInput.split('\n').map(n => n.trim()).filter(n => n.length > 0);
    if (newWords.length >= 2) {
      setWords(newWords);
      setShowSettings(false);
      setRotation(0);
      setSelectedWord(null);
    } else {
      alert('សូមបញ្ចូលពាក្យយ៉ាងហោចណាស់ ២ ជួរ។');
    }
  };

  // SVG Wheel rendering
  const renderWheel = () => {
    if (words.length === 0) return null;
    
    const sliceAngle = 360 / words.length;
    
    return (
      <svg width="300" height="300" viewBox="0 0 300 300" className="drop-shadow-lg">
        {words.map((word, i) => {
          const startAngle = (i * sliceAngle - 90) * (Math.PI / 180);
          const endAngle = ((i + 1) * sliceAngle - 90) * (Math.PI / 180);
          
          const x1 = 150 + 150 * Math.cos(startAngle);
          const y1 = 150 + 150 * Math.sin(startAngle);
          const x2 = 150 + 150 * Math.cos(endAngle);
          const y2 = 150 + 150 * Math.sin(endAngle);
          
          const largeArcFlag = sliceAngle > 180 ? 1 : 0;
          
          const pathData = [
            `M 150 150`,
            `L ${x1} ${y1}`,
            `A 150 150 0 ${largeArcFlag} 1 ${x2} ${y2}`,
            'Z'
          ].join(' ');
          
          const color = COLORS[i % COLORS.length];
          
          // Text rotation and position
          const textAngle = (i * sliceAngle + sliceAngle / 2 - 90);
          const textRadius = 85;
          const tx = 150 + textRadius * Math.cos(textAngle * (Math.PI / 180));
          const ty = 150 + textRadius * Math.sin(textAngle * (Math.PI / 180));

          return (
            <g key={i}>
              <path d={pathData} fill={color} stroke="#fff" strokeWidth="2" />
              <text 
                x={tx} 
                y={ty} 
                fill="white" 
                fontSize={words.length > 15 ? "10" : "14"} 
                fontWeight="bold" 
                textAnchor="middle" 
                alignmentBaseline="middle"
                transform={`rotate(${textAngle + 90}, ${tx}, ${ty})`}
                className="drop-shadow-md"
              >
                {word.length > 10 ? word.substring(0, 10) + '...' : word}
              </text>
            </g>
          );
        })}
        {/* Center dot */}
        <circle cx="150" cy="150" r="15" fill="white" className="drop-shadow-sm" />
        <circle cx="150" cy="150" r="10" fill="#334155" />
      </svg>
    );
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
            <span>🎡</span> កងវិលចាប់ពាក្យ
          </h1>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
        >
          <Settings size={20} />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        
        {showSettings ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full animate-in slide-in-from-top-4 duration-300">
            <h2 className="text-lg font-bold text-slate-800 mb-4">កែសម្រួលបញ្ជីពាក្យ</h2>
            <p className="text-sm text-slate-500 mb-4">សូមបញ្ចូលពាក្យ (មួយជួរ សម្រាប់ពាក្យមួយ)</p>
            <textarea
              className="w-full h-64 p-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none font-medium mb-4"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                បោះបង់
              </button>
              <button
                onClick={saveSettings}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors"
              >
                រក្សាទុក
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full max-w-md">
            
            {/* The Wheel */}
            <div className="relative mb-12 mt-8">
              {/* Pointer indicator */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-10 drop-shadow-md">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="#334155">
                  <path d="M12 2L22 20H2L12 2Z" transform="rotate(180 12 12)" />
                </svg>
              </div>
              
              <div 
                ref={wheelRef}
                className="transition-transform ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                style={{ 
                  transform: `rotate(${rotation}deg)`,
                  transitionDuration: isSpinning ? '4s' : '0s'
                }}
              >
                {renderWheel()}
              </div>
            </div>

            {/* Selected Word Display */}
            <div className="h-24 flex items-center justify-center w-full mb-8">
              {selectedWord ? (
                <div className="animate-in zoom-in slide-in-from-bottom-4 duration-500 bg-amber-100 text-amber-700 px-8 py-4 rounded-2xl shadow-sm border border-amber-200 text-center">
                  <div className="text-sm font-bold text-amber-500 mb-1 uppercase tracking-wider">ពាក្យដែលបានរើស</div>
                  <div className="text-3xl font-black">{selectedWord}</div>
                </div>
              ) : (
                <div className="text-slate-400 font-medium">ចុចប៊ូតុងខាងក្រោមដើម្បីបង្វិលកង</div>
              )}
            </div>

            {/* Spin Button */}
            <button
              onClick={spinWheel}
              disabled={isSpinning || words.length < 2}
              className="w-full py-4 px-6 rounded-2xl font-black text-white bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 text-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSpinning ? (
                'កំពុងបង្វិល...'
              ) : (
                <>
                  <Play fill="currentColor" /> បង្វិលកង
                </>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
