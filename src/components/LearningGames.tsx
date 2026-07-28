import React from 'react';
import { Rocket } from 'lucide-react';

import TimerGame from './games/TimerGame';
import RandomizerGame from './games/RandomizerGame';
import NameSpinnerGame from './games/NameSpinnerGame';
import WhiteboardGame from './games/WhiteboardGame';
import FractionGame from './games/FractionGame';
import FastMathGame from './games/FastMathGame';
import MultiplicationGame from './games/MultiplicationGame';
import GuessTimeGame from './games/GuessTimeGame';
import MoneyGame from './games/MoneyGame';
import GeometryGame from './games/GeometryGame';
import EvenOddGame from './games/EvenOddGame';

interface Game {
  id: string;
  emoji: string;
  title: string;
  description: string;
  color: string;
}

const GAMES: Game[] = [
  { id: 'fraction', emoji: '🍕', title: '១. ល្បែងប្រភាគ', description: 'រៀនពីប្រភាគតាមរយៈការលាបពណ៌រង្វង់នំផាយ។', color: '#EF4444' },
  { id: 'fast-math', emoji: '⚡', title: '២. បូកដកលេខរហ័ស', description: 'គិតលេខឱ្យលឿនមុនពេលអស់ម៉ោង។', color: '#EAB308' },
  { id: 'multiplication', emoji: '✖️', title: '៣. មេគុណ និងចែក', description: 'ហ្វឹកហាត់មេគុណសម្រាប់កុមារ។', color: '#8B5CF6' },
  { id: 'match-word', emoji: '🖼️', title: '៤. ផ្គូផ្គងរូបភាពនិងពាក្យ', description: 'រៀនពាក្យខ្មែរតាមរយៈរូបភាព។', color: '#10B981' },
  { id: 'guess-time', emoji: '⏰', title: '៥. ល្បែងទាយម៉ោង', description: 'រៀនមើលម៉ោង និងនាទីឱ្យបានត្រឹមត្រូវ។', color: '#EF4444' },
  { id: 'money', emoji: '💵', title: '៦. ស្គាល់លុយរៀល', description: 'រៀនរាប់ និងគិតលុយអាប់ជារូបិយបណ្ណខ្មែរ។', color: '#10B981' },
  { id: 'geometry', emoji: '🔺', title: '៧. រាងធរណីមាត្រ', description: 'ស្គាល់រាងផ្សេងៗដូចជា ត្រីកោណ ចតុកោណ។', color: '#EF4444' },
  { id: 'sort-letters', emoji: '🔠', title: '៨. តម្រៀបអក្សរ', description: 'រៀបអក្សរឱ្យចេញជាពាក្យត្រឹមត្រូវ។', color: '#6366F1' },
  { id: 'even-odd', emoji: '🔢', title: '៩. លេខគូ និងសេស', description: 'ញែកឱ្យដាច់រវាងលេខគូ និងលេខសេស។', color: '#06B6D4' },
  { id: 'memory', emoji: '🧠', title: '១០. ល្បែងចងចាំ', description: 'បើកកាតផ្គូផ្គងរូប និងពាក្យដើម្បីហ្វឹកហាត់ការចងចាំ។', color: '#F97316' },
  { id: 'word-wheel', emoji: '🎡', title: '១១. កងវិលចាប់ពាក្យ', description: 'បង្វិលកងដើម្បីរើសរើសពាក្យដោយចៃដន្យ។', color: '#EAB308' },
  { id: 'name-wheel', emoji: '👤', title: '១២. កងវិលចាប់ឈ្មោះ', description: 'បង្វិលកងដើម្បីហៅឈ្មោះសិស្ស។', color: '#0EA5E9' },
  { id: 'group-students', emoji: '👥', title: '១៣. រៀបសិស្សជាក្រុម', description: 'បែងចែកសិស្សជាក្រុមដោយស្វ័យប្រវត្តិ។', color: '#6366F1' },
  { id: 'randomizer', emoji: '🎲', title: '១៤. ចាប់លេខចៃដន្យ', description: 'ចាប់លេខរៀងដោយចៃដន្យ (Randomizer)។', color: '#EF4444' },
  { id: 'timer', emoji: '⏱️', title: '១៥. នាឡិកាកំណត់ម៉ោង', description: 'សម្រាប់កំណត់ពេលធ្វើលំហាត់ក្នុងថ្នាក់។', color: '#3B82F6' },
  { id: 'score-table', emoji: '🏆', title: '១៦. តារាងពិន្ទុកក្រុម', description: 'កត់ត្រា និងបូកពិន្ទុសម្រាប់ក្រុមនីមួយៗ។', color: '#EAB308' },
  { id: 'guess-word', emoji: '📝', title: '១៧. ល្បែងទាយពាក្យ', description: 'ទាយអក្សរដើម្បីបំពេញពាក្យឱ្យបានត្រឹមត្រូវ។', color: '#3B82F6' },
  { id: 'whiteboard', emoji: '✏️', title: '១៨. ក្តារខៀនឌីជីថល', description: 'គូររូប និងសរសេរពន្យល់នៅលើក្តារខៀន។', color: '#EF4444' },
  { id: 'flashcards', emoji: '📇', title: '១៩. ប័ណ្ណពាក្យ', description: 'កាតពាក្យសម្រាប់ទន្ទេញមេរៀន។', color: '#06B6D4' },
  { id: 'find-pairs', emoji: '🔗', title: '២០. ស្វែងរកគូ', description: 'អូសខ្សែភ្ជាប់ពាក្យទៅនឹងរូបភាព។', color: '#EC4899' },
  { id: 'tts', emoji: '🔊', title: '២១. អានអត្ថបទ', description: 'វាយអត្ថបទ ហើយឱ្យកុំព្យូទ័រអានជាសំឡេង។', color: '#84CC16' }
];

export default function LearningGames() {
  const [activeGame, setActiveGame] = React.useState<string | null>(null);

  if (activeGame === 'timer') return <TimerGame onBack={() => setActiveGame(null)} />;
  if (activeGame === 'randomizer') return <RandomizerGame onBack={() => setActiveGame(null)} />;
  if (activeGame === 'name-wheel') return <NameSpinnerGame onBack={() => setActiveGame(null)} />;
  if (activeGame === 'whiteboard') return <WhiteboardGame onBack={() => setActiveGame(null)} />;
  if (activeGame === 'fraction') return <FractionGame onBack={() => setActiveGame(null)} />;
  if (activeGame === 'fast-math') return <FastMathGame onBack={() => setActiveGame(null)} />;
  if (activeGame === 'multiplication') return <MultiplicationGame onBack={() => setActiveGame(null)} />;
  if (activeGame === 'guess-time') return <GuessTimeGame onBack={() => setActiveGame(null)} />;
  if (activeGame === 'money') return <MoneyGame onBack={() => setActiveGame(null)} />;
  if (activeGame === 'geometry') return <GeometryGame onBack={() => setActiveGame(null)} />;
  if (activeGame === 'even-odd') return <EvenOddGame onBack={() => setActiveGame(null)} />;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-3 flex items-center justify-center gap-3">
          មជ្ឈមណ្ឌលល្បែងសិក្សា <Rocket className="text-blue-500" size={32} />
        </h1>
        <p className="text-slate-500 font-medium">ជ្រើសរើសល្បែងខាងក្រោមដើម្បីចាប់ផ្តើមរៀន និងលេងយ៉ាងសប្បាយរីករាយ</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {GAMES.map((game) => (
          <button
            key={game.id}
            onClick={() => {
              const availableGames = ['timer', 'randomizer', 'name-wheel', 'whiteboard', 'fraction', 'fast-math', 'multiplication', 'guess-time', 'money', 'geometry', 'even-odd'];
              if (availableGames.includes(game.id)) {
                setActiveGame(game.id);
              } else {
                alert('ហ្គេមនេះកំពុងស្ថិតក្នុងការអភិវឌ្ឍន៍ (Coming soon)');
              }
            }}
            className="flex items-start text-left gap-4 bg-white p-5 rounded-2xl border-l-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group"
            style={{ borderLeftColor: game.color }}
          >
            <div className="text-3xl group-hover:scale-110 transition-transform flex-shrink-0">
              {game.emoji}
            </div>
            <div>
              <h3 className="font-bold text-sm md:text-base mb-1" style={{ color: game.color }}>
                {game.title}
              </h3>
              <p className="text-[11px] md:text-xs text-slate-500 leading-relaxed">
                {game.description}
              </p>
            </div>
          </button>
        ))}
      </div>
      
      <div className="mt-12 text-center text-xs text-slate-400 font-medium">
        អភិវឌ្ឍន៍ដោយ Antigravity AI សម្រាប់កុមារកម្ពុជា ❤️
      </div>
    </div>
  );
}
