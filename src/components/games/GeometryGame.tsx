import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';

interface GeometryGameProps {
  onBack: () => void;
}

const SHAPES = [
  { id: 'circle', name: 'រង្វង់', render: (color: string) => <circle cx="100" cy="100" r="80" fill={color} /> },
  { id: 'square', name: 'ការ៉េ', render: (color: string) => <rect x="20" y="20" width="160" height="160" fill={color} rx="12" /> },
  { id: 'triangle', name: 'ត្រីកោណ', render: (color: string) => <polygon points="100,20 180,170 20,170" fill={color} strokeLinejoin="round" strokeWidth="10" stroke={color} /> },
  { id: 'rectangle', name: 'ចតុកោណកែង', render: (color: string) => <rect x="10" y="50" width="180" height="100" fill={color} rx="12" /> },
  { id: 'pentagon', name: 'បញ្ចកោណ', render: (color: string) => <polygon points="100,20 195,85 160,180 40,180 5,85" fill={color} strokeLinejoin="round" strokeWidth="10" stroke={color} /> },
  { id: 'hexagon', name: 'ឆកោណ', render: (color: string) => <polygon points="100,10 180,55 180,145 100,190 20,145 20,55" fill={color} strokeLinejoin="round" strokeWidth="10" stroke={color} /> },
  { id: 'star', name: 'ផ្កាយ', render: (color: string) => <polygon points="100,10 128,68 190,77 145,121 156,183 100,153 44,183 55,121 10,77 72,68" fill={color} strokeLinejoin="round" strokeWidth="10" stroke={color} /> },
];

const COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

export default function GeometryGame({ onBack }: GeometryGameProps) {
  const [targetShape, setTargetShape] = useState(SHAPES[0]);
  const [shapeColor, setShapeColor] = useState(COLORS[0]);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);

  const generateProblem = () => {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    
    setTargetShape(shape);
    setShapeColor(color);

    // Generate options
    const opts = new Set([shape.name]);
    while (opts.size < 4) {
      const wrongShape = SHAPES[Math.floor(Math.random() * SHAPES.length)].name;
      opts.add(wrongShape);
    }
    
    setOptions(Array.from(opts).sort(() => Math.random() - 0.5));
    setSelectedOption(null);
    setIsCorrect(false);
  };

  useEffect(() => {
    generateProblem();
  }, []);

  const handleSelect = (opt: string) => {
    if (selectedOption !== null) return;
    
    setSelectedOption(opt);
    
    if (opt === targetShape.name) {
      setIsCorrect(true);
      setScore(s => s + 1);
      setTimeout(() => {
        generateProblem();
      }, 1500);
    } else {
      setIsCorrect(false);
      setTimeout(() => {
        setSelectedOption(null);
      }, 1500);
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
            <span>🔺</span> រាងធរណីមាត្រ
          </h1>
        </div>
        <div className="px-3 py-1 bg-red-100 text-red-700 font-bold rounded-full text-sm">
          ពិន្ទុ: {score}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full flex flex-col items-center text-center">
          
          <h2 className="text-xl text-slate-800 font-bold mb-8">
            តើរូបរាងនេះហៅថាអ្វី?
          </h2>

          <div className="relative mb-10 p-6 bg-slate-100 rounded-2xl border border-slate-200 animate-in zoom-in duration-300">
            <svg width="200" height="200" viewBox="0 0 200 200" className="drop-shadow-lg">
              {targetShape.render(shapeColor)}
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full">
            {options.map((opt, i) => {
              const isSelected = selectedOption === opt;
              const isActuallyCorrect = opt === targetShape.name;
              
              let btnClass = "py-4 px-3 rounded-2xl font-bold text-lg transition-all border-2 ";
              
              if (selectedOption === null) {
                btnClass += "bg-white border-slate-200 text-slate-700 hover:border-red-500 hover:text-red-600 shadow-sm";
              } else if (isActuallyCorrect) {
                btnClass += "bg-green-50 border-green-500 text-green-600 scale-105 shadow-md";
              } else if (isSelected && !isCorrect) {
                btnClass += "bg-red-50 border-red-500 text-red-600 animate-shake";
              } else {
                btnClass += "bg-slate-50 border-slate-100 text-slate-300 opacity-50";
              }

              return (
                <button
                  key={i}
                  onClick={() => handleSelect(opt)}
                  disabled={selectedOption !== null}
                  className={btnClass}
                >
                  <div className="flex items-center justify-center gap-2 text-center">
                    {opt}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
