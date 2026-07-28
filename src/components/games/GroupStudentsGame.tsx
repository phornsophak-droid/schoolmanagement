import React, { useState } from 'react';
import { ArrowLeft, Users, Shuffle } from 'lucide-react';

interface GroupStudentsGameProps {
  onBack: () => void;
}

export default function GroupStudentsGame({ onBack }: GroupStudentsGameProps) {
  const [studentNames, setStudentNames] = useState(
    'សុខា\nមករា\nចាន់ថា\nតុលា\nឧសភា\nវីរៈ\nបុប្ផា\nរំដួល\nសំណាង\nសិរី'
  );
  const [numGroups, setNumGroups] = useState<number>(3);
  const [groups, setGroups] = useState<string[][]>([]);

  const generateGroups = () => {
    // 1. Get and clean names
    const names = studentNames
      .split('\n')
      .map(n => n.trim())
      .filter(n => n.length > 0);
      
    if (names.length === 0) {
      alert('សូមបញ្ចូលឈ្មោះសិស្សយ៉ាងហោចណាស់ម្នាក់!');
      return;
    }
    
    if (numGroups < 1 || numGroups > names.length) {
      alert('ចំនួនក្រុមមិនត្រឹមត្រូវ!');
      return;
    }

    // 2. Shuffle names
    const shuffled = [...names].sort(() => Math.random() - 0.5);

    // 3. Divide into groups
    const newGroups: string[][] = Array.from({ length: numGroups }, () => []);
    
    shuffled.forEach((name, index) => {
      newGroups[index % numGroups].push(name);
    });

    setGroups(newGroups);
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
            <span>👥</span> រៀបសិស្សជាក្រុម
          </h1>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Controls Panel */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-fit lg:col-span-1">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Users size={24} className="text-blue-500" /> ការកំណត់
            </h2>
            
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-600 mb-2">
                បញ្ជីឈ្មោះសិស្ស (មួយជួរ សម្រាប់ឈ្មោះមួយ)
              </label>
              <textarea
                value={studentNames}
                onChange={(e) => setStudentNames(e.target.value)}
                className="w-full h-64 p-4 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-0 resize-none font-medium text-slate-700"
                placeholder="ឧទាហរណ៍៖&#10;សុខា&#10;មករា&#10;ចាន់ថា"
              />
              <div className="text-right text-sm text-slate-400 mt-2 font-medium">
                ចំនួនសរុប៖ {studentNames.split('\n').filter(n => n.trim().length > 0).length} នាក់
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-bold text-slate-600 mb-2">
                ចំនួនក្រុមដែលចង់បែងចែក
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={numGroups}
                onChange={(e) => setNumGroups(parseInt(e.target.value) || 1)}
                className="w-full p-4 text-xl font-bold border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-0 text-center"
              />
            </div>

            <button
              onClick={generateGroups}
              className="w-full py-4 px-6 rounded-xl font-black text-white bg-blue-500 hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 text-lg mt-auto"
            >
              <Shuffle size={24} /> ចាប់ផ្តើមបែងចែកក្រុម
            </button>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2">
            {groups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {groups.map((group, idx) => (
                  <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="bg-blue-50 border-b border-blue-100 p-4 flex items-center justify-between">
                      <h3 className="font-black text-blue-800 text-lg">
                        ក្រុមទី {idx + 1}
                      </h3>
                      <span className="bg-blue-200 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
                        {group.length} នាក់
                      </span>
                    </div>
                    <ul className="p-2 flex-1">
                      {group.map((member, mIdx) => (
                        <li 
                          key={mIdx} 
                          className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors text-slate-700 font-medium"
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-400">
                            {mIdx + 1}
                          </div>
                          {member}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <Users size={64} className="mb-4 opacity-50" />
                <p className="text-lg font-medium">ចុចប៊ូតុង "ចាប់ផ្តើមបែងចែកក្រុម" ដើម្បីបង្ហាញលទ្ធផល</p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
