import React, { useState } from 'react';
import { ArrowLeft, Plus, Minus, Trophy, UserPlus, Trash2 } from 'lucide-react';

interface ScoreTableGameProps {
  onBack: () => void;
}

interface Group {
  id: string;
  name: string;
  score: number;
  color: string;
}

const COLORS = ['bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500'];

export default function ScoreTableGame({ onBack }: ScoreTableGameProps) {
  const [groups, setGroups] = useState<Group[]>([
    { id: '1', name: 'ក្រុមទី ១', score: 0, color: COLORS[0] },
    { id: '2', name: 'ក្រុមទី ២', score: 0, color: COLORS[1] },
  ]);

  const addGroup = () => {
    if (groups.length >= 8) {
      alert('មិនអាចបន្ថែមលើសពី ៨ ក្រុមបានទេ');
      return;
    }
    const newId = Date.now().toString();
    const newName = `ក្រុមទី ${groups.length + 1}`;
    const newColor = COLORS[groups.length % COLORS.length];
    
    setGroups([...groups, { id: newId, name: newName, score: 0, color: newColor }]);
  };

  const removeGroup = (id: string) => {
    setGroups(groups.filter(g => g.id !== id));
  };

  const updateScore = (id: string, amount: number) => {
    setGroups(groups.map(g => {
      if (g.id === id) {
        return { ...g, score: Math.max(0, g.score + amount) };
      }
      return g;
    }));
  };

  const updateName = (id: string, newName: string) => {
    setGroups(groups.map(g => {
      if (g.id === id) {
        return { ...g, name: newName };
      }
      return g;
    }));
  };

  // Find max score
  const maxScore = Math.max(...groups.map(g => g.score), 1);

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
            <span>🏆</span> តារាងពិន្ទុកក្រុម
          </h1>
        </div>
        <button
          onClick={addGroup}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 font-bold rounded-full hover:bg-indigo-100 transition-colors"
        >
          <UserPlus size={18} /> បន្ថែមក្រុម
        </button>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map(group => (
            <div key={group.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
              
              {/* Leader Indicator */}
              {group.score > 0 && group.score === maxScore && (
                <div className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                  <Trophy size={12} /> នាំមុខគេ
                </div>
              )}

              {/* Group Header */}
              <div className={`${group.color} p-6 pb-8 text-white relative`}>
                <button 
                  onClick={() => removeGroup(group.id)}
                  className="absolute top-4 left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm"
                  title="លុបក្រុមនេះ"
                >
                  <Trash2 size={16} />
                </button>
                
                <input
                  type="text"
                  value={group.name}
                  onChange={(e) => updateName(group.id, e.target.value)}
                  className="w-full text-center text-2xl font-black bg-transparent border-none focus:outline-none focus:ring-0 text-white placeholder-white/50 mt-6"
                  placeholder="ឈ្មោះក្រុម"
                />
              </div>

              {/* Score Area */}
              <div className="flex-1 p-6 flex flex-col items-center justify-center -mt-6">
                <div className="bg-white w-32 h-32 rounded-full shadow-lg border-4 border-slate-50 flex items-center justify-center z-10 mb-6">
                  <span className={`text-6xl font-black ${group.color.replace('bg-', 'text-')}`}>
                    {group.score}
                  </span>
                </div>

                {/* Controls */}
                <div className="grid grid-cols-4 gap-2 w-full">
                  <button
                    onClick={() => updateScore(group.id, -5)}
                    className="p-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-bold transition-colors flex items-center justify-center flex-col gap-1"
                  >
                    <Minus size={16} /> <span className="text-sm">5</span>
                  </button>
                  <button
                    onClick={() => updateScore(group.id, -1)}
                    className="p-3 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 font-bold transition-colors flex items-center justify-center flex-col gap-1"
                  >
                    <Minus size={16} /> <span className="text-sm">1</span>
                  </button>
                  <button
                    onClick={() => updateScore(group.id, 1)}
                    className="p-3 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 font-bold transition-colors flex items-center justify-center flex-col gap-1"
                  >
                    <Plus size={16} /> <span className="text-sm">1</span>
                  </button>
                  <button
                    onClick={() => updateScore(group.id, 5)}
                    className="p-3 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold transition-colors flex items-center justify-center flex-col gap-1"
                  >
                    <Plus size={16} /> <span className="text-sm">5</span>
                  </button>
                </div>
              </div>

            </div>
          ))}

          {groups.length === 0 && (
            <div className="col-span-full h-64 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <Trophy size={64} className="mb-4 opacity-30" />
              <p className="text-lg font-medium">សូមចុច "បន្ថែមក្រុម" ដើម្បីចាប់ផ្តើម</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
