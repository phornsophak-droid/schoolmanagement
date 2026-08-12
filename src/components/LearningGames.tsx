import React from 'react';
import { Rocket, ArrowLeft, Maximize, Minimize } from 'lucide-react';

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
import MatchWordGame from './games/MatchWordGame';
import SortLettersGame from './games/SortLettersGame';
import WordWheelGame from './games/WordWheelGame';
import GuessWordGame from './games/GuessWordGame';
import FlashcardsGame from './games/FlashcardsGame';
import TTSGame from './games/TTSGame';
import MemoryGame from './games/MemoryGame';
import FindPairsGame from './games/FindPairsGame';
import GroupStudentsGame from './games/GroupStudentsGame';
import ScoreTableGame from './games/ScoreTableGame';
import CountingGame from './games/CountingGame';
import CompareNumbersGame from './games/CompareNumbersGame';
import SequenceGame from './games/SequenceGame';
import PatternGame from './games/PatternGame';
import ColorsGame from './games/ColorsGame';
import KhmerAlphabetGame from './games/KhmerAlphabetGame';
import KhmerReadingGame from './games/KhmerReadingGame';

interface Game {
  id: string;
  emoji: string;
  title: string;
  description: string;
  color: string;
}

const GAMES: Game[] = [
  { id: 'memory', emoji: '🧠', title: '១. ល្បែងចងចាំ', description: 'បើកកាតផ្គូផ្គងរូប និងពាក្យដើម្បីហ្វឹកហាត់ការចងចាំ។', color: '#F97316' },
  { id: 'word-wheel', emoji: '🎡', title: '២. កងវិលចាប់ពាក្យ', description: 'បង្វិលកងដើម្បីរើសរើសពាក្យដោយចៃដន្យ។', color: '#EAB308' },
  { id: 'name-wheel', emoji: '👤', title: '៣. កងវិលចាប់ឈ្មោះ', description: 'បង្វិលកងដើម្បីហៅឈ្មោះសិស្ស។', color: '#0EA5E9' },
  { id: 'match-word', emoji: '🖼️', title: '៤. ផ្គូផ្គងរូបភាពនិងពាក្យ', description: 'រៀនពាក្យខ្មែរតាមរយៈរូបភាព។', color: '#10B981' },
  { id: 'group-students', emoji: '👥', title: '៥. រៀបសិស្សជាក្រុម', description: 'បែងចែកសិស្សជាក្រុមដោយស្វ័យប្រវត្តិ។', color: '#6366F1' },
  { id: 'even-odd', emoji: '🔢', title: '៦. លេខគូ និងសេស', description: 'ញែកឱ្យដាច់រវាងលេខគូ និងលេខសេស។', color: '#06B6D4' },
  { id: 'randomizer', emoji: '🎲', title: '៧. ចាប់លេខចៃដន្យ', description: 'ចាប់លេខរៀងដោយចៃដន្យ (Randomizer)។', color: '#EF4444' },
  { id: 'timer', emoji: '⏱️', title: '៨. នាឡិកាកំណត់ម៉ោង', description: 'សម្រាប់កំណត់ពេលធ្វើលំហាត់ក្នុងថ្នាក់។', color: '#3B82F6' },
  { id: 'score-table', emoji: '🏆', title: '៩. តារាងពិន្ទុកក្រុម', description: 'កត់ត្រា និងបូកពិន្ទុសម្រាប់ក្រុមនីមួយៗ។', color: '#EAB308' },
  { id: 'guess-time', emoji: '⏰', title: '១០. ល្បែងទាយម៉ោង', description: 'រៀនមើលម៉ោង និងនាទីឱ្យបានត្រឹមត្រូវ។', color: '#EF4444' },
  { id: 'sequence', emoji: '➡️', title: '១១. បំពេញលេខបន្ត', description: 'រកលេខដែលបាត់ក្នុងលំដាប់លេខ។', color: '#8B5CF6' },
  { id: 'pattern', emoji: '🔷', title: '១២. លំនាំបន្ត', description: 'ទាយរូបភាពដែលនៅបន្ទាប់ក្នុងលំនាំ។', color: '#0EA5E9' },
  { id: 'colors', emoji: '🎨', title: '១៣. ស្គាល់ពណ៌', description: 'មើលពណ៌ ហើយចុចឈ្មោះពណ៌ឱ្យត្រូវ។', color: '#EC4899' },
  { id: 'guess-word', emoji: '📝', title: '១៤. ល្បែងទាយពាក្យ', description: 'ទាយអក្សរដើម្បីបំពេញពាក្យឱ្យបានត្រឹមត្រូវ។', color: '#3B82F6' },
  { id: 'whiteboard', emoji: '✏️', title: '១៥. ក្តារខៀនឌីជីថល', description: 'គូររូប និងសរសេរពន្យល់នៅលើក្តារខៀន។', color: '#EF4444' },
  { id: 'khmer-alphabet', emoji: '🔠', title: '១៦. អក្ខរក្រមខ្មែរ', description: 'រៀនអាន និងស្គាល់តួអក្សរខ្មែរ (ព្យញ្ជនៈ និងស្រៈ) ជាមួយនឹងហ្គេមទាយអក្សរ', color: '#3B82F6' },
  { id: 'sort-letters', emoji: '🔠', title: '១៧. តម្រៀបអក្សរ', description: 'រៀបអក្សរឱ្យចេញជាពាក្យត្រឹមត្រូវ។', color: '#6366F1' },
  { id: 'khmer-reading', emoji: '📚', title: '១៨. ល្បែងអានពាក្យ', description: 'ជួយពង្រឹងការអាន ការផ្គូផ្គង និងការប្រកបពាក្យខ្មែរតាមរយៈរូបភាព និងសំឡេង', color: '#F59E0B' },
  { id: 'money', emoji: '💵', title: '១៩. ស្គាល់លុយរៀល', description: 'រៀនរាប់ និងគិតលុយអាប់ជារូបិយបណ្ណខ្មែរ។', color: '#10B981' },
  { id: 'multiplication', emoji: '✖️', title: '២០. មេគុណ និងចែក', description: 'ហ្វឹកហាត់មេគុណសម្រាប់កុមារ។', color: '#8B5CF6' },
  { id: 'geometry', emoji: '🔺', title: '២១. រាងធរណីមាត្រ', description: 'ស្គាល់រាងផ្សេងៗដូចជា ត្រីកោណ ចតុកោណ។', color: '#EF4444' },
  { id: 'flashcards', emoji: '📇', title: '២២. ប័ណ្ណពាក្យ', description: 'កាតពាក្យសម្រាប់ទន្ទេញមេរៀន។', color: '#06B6D4' },
  { id: 'find-pairs', emoji: '🔗', title: '២៣. ស្វែងរកគូ', description: 'អូសខ្សែភ្ជាប់ពាក្យទៅនឹងរូបភាព។', color: '#EC4899' },
  { id: 'tts', emoji: '🔊', title: '២៤. អានអត្ថបទ', description: 'វាយអត្ថបទ ហើយឱ្យកុំព្យូទ័រអានជាសំឡេង។', color: '#84CC16' },
  { id: 'counting', emoji: '🍎', title: '២៥. រាប់ចំនួន', description: 'រាប់រូបភាព ហើយចុចលេខឱ្យបានត្រឹមត្រូវ។', color: '#EF4444' },
  { id: 'compare-numbers', emoji: '⚖️', title: '២៦. ប្រៀបធៀបចំនួន', description: 'ជ្រើសសញ្ញា < = > សម្រាប់ចំនួនពីរ។', color: '#14B8A6' },
  { id: 'fraction', emoji: '🍕', title: '២៧. ល្បែងប្រភាគ', description: 'រៀនពីប្រភាគតាមរយៈការលាបពណ៌រង្វង់នំផាយ។', color: '#EF4444' },
  { id: 'fast-math', emoji: '⚡', title: '២៨. បូកដកលេខរហ័ស', description: 'គិតលេខឱ្យលឿនមុនពេលអស់ម៉ោង។', color: '#EAB308' }
];

interface LearningGamesProps {
  onBack?: () => void;
}

export default function LearningGames({ onBack }: LearningGamesProps) {
  const [activeGame, setActiveGame] = React.useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
      document.exitFullscreen();
    }
  };

  const getGameComponent = () => {
    switch (activeGame) {
      case 'timer': return <TimerGame onBack={() => setActiveGame(null)} />;
      case 'randomizer': return <RandomizerGame onBack={() => setActiveGame(null)} />;
      case 'name-wheel': return <NameSpinnerGame onBack={() => setActiveGame(null)} />;
      case 'whiteboard': return <WhiteboardGame onBack={() => setActiveGame(null)} />;
      case 'fraction': return <FractionGame onBack={() => setActiveGame(null)} />;
      case 'fast-math': return <FastMathGame onBack={() => setActiveGame(null)} />;
      case 'multiplication': return <MultiplicationGame onBack={() => setActiveGame(null)} />;
      case 'guess-time': return <GuessTimeGame onBack={() => setActiveGame(null)} />;
      case 'money': return <MoneyGame onBack={() => setActiveGame(null)} />;
      case 'geometry': return <GeometryGame onBack={() => setActiveGame(null)} />;
      case 'even-odd': return <EvenOddGame onBack={() => setActiveGame(null)} />;
      case 'match-word': return <MatchWordGame onBack={() => setActiveGame(null)} />;
      case 'sort-letters': return <SortLettersGame onBack={() => setActiveGame(null)} />;
      case 'word-wheel': return <WordWheelGame onBack={() => setActiveGame(null)} />;
      case 'guess-word': return <GuessWordGame onBack={() => setActiveGame(null)} />;
      case 'flashcards': return <FlashcardsGame onBack={() => setActiveGame(null)} />;
      case 'tts': return <TTSGame onBack={() => setActiveGame(null)} />;
      case 'memory': return <MemoryGame onBack={() => setActiveGame(null)} />;
      case 'find-pairs': return <FindPairsGame onBack={() => setActiveGame(null)} />;
      case 'group-students': return <GroupStudentsGame onBack={() => setActiveGame(null)} />;
      case 'score-table': return <ScoreTableGame onBack={() => setActiveGame(null)} />;
      case 'counting': return <CountingGame onBack={() => setActiveGame(null)} />;
      case 'compare-numbers': return <CompareNumbersGame onBack={() => setActiveGame(null)} />;
      case 'sequence': return <SequenceGame onBack={() => setActiveGame(null)} />;
      case 'pattern': return <PatternGame onBack={() => setActiveGame(null)} />;
      case 'colors': return <ColorsGame onBack={() => setActiveGame(null)} />;
      case 'khmer-alphabet': return <KhmerAlphabetGame onBack={() => setActiveGame(null)} />;
      case 'khmer-reading': return <KhmerReadingGame onBack={() => setActiveGame(null)} />;
      default: return null;
    }
  };

  const GameNode = getGameComponent();
  if (GameNode) {
    return (
      <div className="relative group w-full min-h-screen bg-slate-50">
        {GameNode}
        <button
          onClick={toggleFullscreen}
          className="fixed bottom-6 right-6 p-3 bg-slate-800/50 hover:bg-slate-800 text-white rounded-full shadow-xl backdrop-blur transition-all z-[9999] opacity-30 hover:opacity-100 group-hover:opacity-100"
          title="បិទ/បើក Full Screen"
        >
          {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
        </button>
      </div>
    );
  }

  return (
    <div className={`p-4 md:p-8 max-w-7xl mx-auto min-h-screen ${onBack ? 'bg-transparent' : 'bg-slate-50/50'}`}>
      <div className="text-center mb-10 relative">
        {onBack && (
          <button 
            onClick={onBack}
            className="absolute left-0 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft size={24} />
          </button>
        )}
        <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-3 flex items-center justify-center gap-3">
          មជ្ឈមណ្ឌលល្បែងសិក្សា <Rocket className="text-blue-500" size={32} />
        </h1>
        <p className="text-slate-500 font-medium">ល្បែងអប់រំ និងឧបករណ៍ជំនួយការបង្រៀនសម្រាប់គ្រូ</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {GAMES.map((game) => (
          <button
            key={game.id}
            onClick={() => {
              const availableGames = [
                'timer', 'randomizer', 'name-wheel', 'whiteboard', 
                'fraction', 'fast-math', 'multiplication', 'guess-time', 'money', 'geometry', 'even-odd',
                'match-word', 'sort-letters', 'word-wheel', 'guess-word', 'flashcards', 'tts',
                'memory', 'find-pairs', 'group-students', 'score-table',
                'counting', 'compare-numbers', 'sequence', 'pattern', 'colors', 'khmer-alphabet', 'khmer-reading'
              ];
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
