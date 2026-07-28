import React, { useState } from 'react';
import { X, UserPlus, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { initialStudents } from '../../mockData';

export default function NameSpinnerGame({ onBack }: { onBack: () => void }) {
  const [names, setNames] = useState<string[]>(
    initialStudents.slice(0, 15).map(s => s.name)
  );
  const [newName, setNewName] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const addName = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim() && !names.includes(newName.trim())) {
      setNames([...names, newName.trim()]);
      setNewName('');
    }
  };

  const removeName = (nameToRemove: string) => {
    setNames(names.filter(n => n !== nameToRemove));
  };

  const spin = () => {
    if (names.length === 0 || isSpinning) return;
    
    setIsSpinning(true);
    setSelectedName(null);
    
    // Calculate new rotation
    const spins = 5; // number of full rotations
    const randomAngle = Math.random() * 360;
    const totalRotation = rotation + (spins * 360) + randomAngle;
    
    setRotation(totalRotation);

    // Calculate which name won based on the final angle
    // The top of the wheel is at 270 degrees in standard circle math, or 0 degrees if we rotate the container.
    // Let's just calculate it based on the visual rotation.
    setTimeout(() => {
      const normalizedRotation = totalRotation % 360;
      // Wheel slices are distributed evenly
      const sliceAngle = 360 / names.length;
      // Subtracting from 360 because it rotates clockwise
      const winningAngle = (360 - normalizedRotation) % 360;
      
      const winningIndex = Math.floor(winningAngle / sliceAngle);
      setSelectedName(names[winningIndex]);
      setIsSpinning(false);
    }, 5000); // 5s transition
  };

  return (
    <div className="flex flex-col md:flex-row h-full">
      <button onClick={onBack} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 z-10">
        <X size={24} className="text-slate-600" />
      </button>

      {/* Sidebar for managing names */}
      <div className="w-full md:w-80 bg-white border-r border-slate-200 p-6 flex flex-col h-full overflow-hidden">
        <h3 className="font-bold text-lg mb-4 text-slate-800">បញ្ជីឈ្មោះសិស្ស ({names.length})</h3>
        
        <form onSubmit={addName} className="flex gap-2 mb-4">
          <input 
            type="text" 
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="បញ្ចូលឈ្មោះថ្មី..."
            className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-500"
          />
          <button type="submit" className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            <UserPlus size={18} />
          </button>
        </form>

        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          {names.map((name, i) => (
            <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg group">
              <span className="text-sm font-medium text-slate-700">{name}</span>
              <button 
                onClick={() => removeName(name)}
                className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Wheel Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 relative overflow-hidden">
        
        {selectedName && !isSpinning && (
          <motion.div 
            initial={{ scale: 0.5, opacity: 0, y: -50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="absolute top-20 bg-emerald-500 text-white px-8 py-4 rounded-2xl shadow-xl z-20 text-center"
          >
            <p className="text-sm font-medium opacity-90 mb-1">អបអរសាទរ!</p>
            <h2 className="text-3xl font-black">{selectedName}</h2>
          </motion.div>
        )}

        <div className="relative w-80 h-80 md:w-96 md:h-96 mb-12">
          {/* Pointer */}
          <div className="absolute -right-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-slate-800 rotate-45 z-10 clip-triangle" 
               style={{ clipPath: 'polygon(0 50%, 100% 0, 100% 100%)' }}>
          </div>

          {/* Wheel */}
          <motion.div 
            className="w-full h-full rounded-full border-4 border-slate-300 shadow-xl overflow-hidden relative bg-white"
            animate={{ rotate: rotation }}
            transition={{ duration: 5, ease: [0.15, 0.9, 0.2, 1] }} // smooth deceleration
          >
            {names.map((name, i) => {
              const sliceAngle = 360 / names.length;
              const rotationAngle = i * sliceAngle;
              const color = `hsl(${(i * 360) / names.length}, 70%, 60%)`;
              
              return (
                <div 
                  key={i}
                  className="absolute top-0 right-1/2 w-1/2 h-full origin-right flex items-center justify-end px-4 border-b border-white/20"
                  style={{
                    transform: `rotate(${rotationAngle}deg)`,
                    backgroundColor: color,
                    clipPath: names.length > 2 ? `polygon(100% 50%, 0 ${50 - (50 * Math.tan((sliceAngle/2) * Math.PI / 180))}%, 0 ${50 + (50 * Math.tan((sliceAngle/2) * Math.PI / 180))}%)` : 'none',
                  }}
                >
                  <span className="text-white font-bold text-sm transform -rotate-180 drop-shadow-md truncate w-32 text-right">
                    {name}
                  </span>
                </div>
              );
            })}
          </motion.div>
        </div>

        <button 
          onClick={spin}
          disabled={isSpinning || names.length === 0}
          className="flex items-center gap-2 px-12 py-5 bg-blue-600 text-white text-2xl font-black rounded-full shadow-lg hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
        >
          <RefreshCw size={28} className={isSpinning ? 'animate-spin' : ''} />
          បង្វិលកង (Spin)
        </button>
      </div>
    </div>
  );
}
