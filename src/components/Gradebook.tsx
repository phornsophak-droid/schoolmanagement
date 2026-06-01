/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  Check, 
  UserPlus, 
  FolderLock, 
  Search, 
  GraduationCap, 
  HelpCircle 
} from 'lucide-react';
import { StudentScore, KhmerScore, MathScore, SchoolUser } from '../types';
import { calculateStudentFields, clampScore, rankStudents, generateUniqueId } from '../mockData';

interface GradebookProps {
  students: StudentScore[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  selectedGrade: string;
  setSelectedGrade: (grade: string) => void;
  onSaveStudents: (updatedList: StudentScore[]) => void;
  currentUser?: SchoolUser | null;
  grades?: string[];
  onAddGrade?: (newGrade: string) => void;
  onDeleteGrade?: (gradeToDelete: string) => void;
}

const MONTHS_LIST = [
  'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 
  'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
];

const DEFAULT_GRADES_LIST = [
  'ថ្នាក់ទី១', 'ថ្នាក់ទី២', 'ថ្នាក់ទី៣', 'ថ្នាក់ទី៤', 'ថ្នាក់ទី៥', 'ថ្នាក់ទី៦'
];

export default function Gradebook({
  students,
  selectedMonth,
  setSelectedMonth,
  selectedGrade,
  setSelectedGrade,
  onSaveStudents,
  currentUser,
  grades,
  onAddGrade,
  onDeleteGrade
}: GradebookProps) {
  const gradesList = grades || DEFAULT_GRADES_LIST;
  const [newClassName, setNewClassName] = useState('');
  const [isClassManagerOpen, setIsClassManagerOpen] = useState(false);
  // Lock grade selection to teacher's grade if teacher role
  useEffect(() => {
    if (currentUser && currentUser.role === 'teacher') {
      setSelectedGrade(currentUser.grade);
    }
  }, [currentUser, setSelectedGrade]);

  // UI states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');


  // Form states
  const [formName, setFormName] = useState('');
  const [formGender, setFormGender] = useState<'ប្រុស' | 'ស្រី'>('ប្រុស');
  const [formGrade, setFormGrade] = useState('ថ្នាក់ទី៦');
  const [formMonth, setFormMonth] = useState('មេសា');

  // Sub-subjects Khmer
  const [khmerListening, setKhmerListening] = useState('0');
  const [khmerWriting, setKhmerWriting] = useState('0');
  const [khmerReading, setKhmerReading] = useState('0');
  const [khmerSpeaking, setKhmerSpeaking] = useState('0');

  // Sub-subjects Math
  const [mathNumbers, setMathNumbers] = useState('0');
  const [mathMeasurement, setMathMeasurement] = useState('0');
  const [mathGeometry, setMathGeometry] = useState('0');
  const [mathAlgebra, setMathAlgebra] = useState('0');
  const [mathStatistics, setMathStatistics] = useState('0');

  // Other fields
  const [science, setScience] = useState('0');
  const [socialStudies, setSocialStudies] = useState('0');
  const [physicalEducation, setPhysicalEducation] = useState('0');
  const [health, setHealth] = useState('0');
  const [lifeSkills, setLifeSkills] = useState('0');
  const [foreignLanguage, setForeignLanguage] = useState('0');

  // Filter students based on top filter selections
  const filteredStudents = useMemo(() => {
    // 1. Month / Grade filter
    let list = students.filter(student => {
      const matchMonth = selectedMonth === 'ទាំងអស់' ? true : student.month === selectedMonth;
      const matchGrade = selectedGrade === 'ទាំងអស់' ? true : student.grade === selectedGrade;
      return matchMonth && matchGrade;
    });

    // 2. Search query filter
    if (searchTerm.trim() !== '') {
      list = list.filter(student => student.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // 3. Compute rankings inside the filtered group
    return rankStudents(list);
  }, [students, selectedMonth, selectedGrade, searchTerm]);

  // Open form for creating new student
  const handleOpenCreateForm = () => {
    setEditingStudentId(null);
    setFormName('');
    setFormGender('ប្រុស');
    setFormGrade(currentUser && currentUser.role === 'teacher' ? currentUser.grade : (selectedGrade === 'ទាំងអស់' ? (gradesList[0] || 'ថ្នាក់ទី៦') : selectedGrade));
    setFormMonth(selectedMonth === 'ទាំងអស់' ? 'មេសា' : selectedMonth);
    
    // reset scores
    setKhmerListening('0');
    setKhmerWriting('0');
    setKhmerReading('0');
    setKhmerSpeaking('0');
    setMathNumbers('0');
    setMathMeasurement('0');
    setMathGeometry('0');
    setMathAlgebra('0');
    setMathStatistics('0');
    setScience('0');
    setSocialStudies('0');
    setPhysicalEducation('0');
    setHealth('0');
    setLifeSkills('0');
    setForeignLanguage('0');
    
    setIsFormOpen(true);
  };

  // Open form to edit student scores
  const handleEditClick = (student: StudentScore) => {
    setEditingStudentId(student.id);
    setFormName(student.name);
    setFormGender(student.gender);
    setFormGrade(student.grade);
    setFormMonth(student.month);

    // Populate score fields
    setKhmerListening(student.khmer.listening.toString());
    setKhmerWriting(student.khmer.writing.toString());
    setKhmerReading(student.khmer.reading.toString());
    setKhmerSpeaking(student.khmer.speaking.toString());

    setMathNumbers(student.math.numbers.toString());
    setMathMeasurement(student.math.measurement.toString());
    setMathGeometry(student.math.geometry.toString());
    setMathAlgebra(student.math.algebra.toString());
    setMathStatistics(student.math.statistics.toString());

    setScience(student.science.toString());
    setSocialStudies(student.socialStudies.toString());
    setPhysicalEducation(student.physicalEducation.toString());
    setHealth(student.health.toString());
    setLifeSkills(student.lifeSkills.toString());
    setForeignLanguage(student.foreignLanguage.toString());

    setIsFormOpen(true);
  };

  // Action: Save or Update student
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      alert('សូមបញ្ចូលឈ្មោះសិស្ស!');
      return;
    }

    const payload: Omit<StudentScore, 'khmerAvg' | 'mathAvg' | 'overallAvg' | 'gradeLetter' | 'result'> = {
      id: editingStudentId || generateUniqueId(),
      name: formName.trim(),
      gender: formGender,
      grade: formGrade,
      month: formMonth,
      khmer: {
        listening: clampScore(parseFloat(khmerListening) || 0),
        writing: clampScore(parseFloat(khmerWriting) || 0),
        reading: clampScore(parseFloat(khmerReading) || 0),
        speaking: clampScore(parseFloat(khmerSpeaking) || 0),
      },
      math: {
        numbers: clampScore(parseFloat(mathNumbers) || 0),
        measurement: clampScore(parseFloat(mathMeasurement) || 0),
        geometry: clampScore(parseFloat(mathGeometry) || 0),
        algebra: clampScore(parseFloat(mathAlgebra) || 0),
        statistics: clampScore(parseFloat(mathStatistics) || 0),
      },
      science: clampScore(parseFloat(science) || 0),
      socialStudies: clampScore(parseFloat(socialStudies) || 0),
      physicalEducation: clampScore(parseFloat(physicalEducation) || 0),
      health: clampScore(parseFloat(health) || 0),
      lifeSkills: clampScore(parseFloat(lifeSkills) || 0),
      foreignLanguage: clampScore(parseFloat(foreignLanguage) || 0)
    };

    const calculatedPayload = calculateStudentFields(payload);

    let updatedList: StudentScore[];
    if (editingStudentId) {
      // Edit
      updatedList = students.map(s => s.id === editingStudentId ? calculatedPayload : s);
    } else {
      // Add
      updatedList = [...students, calculatedPayload];
    }

    onSaveStudents(updatedList);
    setIsFormOpen(false);
    setEditingStudentId(null);
  };

  // Action: Delete Student
  const handleDeleteClick = (id: string, name: string) => {
    if (window.confirm(`តើអ្នកពិតជាចង់លុបពិន្ទុរបស់សិស្សឈ្មោះ «${name}» ឬទេ?`)) {
      const updated = students.filter(s => s.id !== id);
      onSaveStudents(updated);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Top Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 tracking-tight">សៀវភៅតាមដាន និងគ្រប់គ្រងពិន្ទុសិស្ស</h2>
          <p className="text-sm text-slate-500 mt-1">
            បញ្ចូលពិន្ទុសិស្សតាមមុខវិជ្ជា គណនាមធ្យមភាគ និងចំណាត់ថ្នាក់ស្វ័យប្រវត្តិ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsClassManagerOpen(!isClassManagerOpen)}
            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
              isClassManagerOpen
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10'
                : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100/80'
            }`}
          >
            <Plus size={16} />
            គ្រប់គ្រង/បន្ថែមថ្នាក់
          </button>

          <button
            id="btn_add_student_score"
            onClick={handleOpenCreateForm}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white font-semibold hover:bg-blue-700 rounded-xl text-sm transition-all shadow-md shadow-blue-500/10"
          >
            <UserPlus size={16} />
            បញ្ចូលពិន្ទុសិស្សថ្មី
          </button>
        </div>
      </div>

      {/* Dynamic Class Manager Panel */}
      {isClassManagerOpen && (
        <div id="class_manager_panel" className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-indigo-50">
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <GraduationCap className="text-indigo-600" size={18} />
              គ្រប់គ្រង និងបន្ថែមថ្នាក់រៀនក្នុងប្រព័ន្ធ
            </h3>
            <button
              type="button"
              onClick={() => setIsClassManagerOpen(false)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Input Column */}
            <div className="md:col-span-1 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-xs font-bold text-slate-600 block flex items-center gap-1">បន្ថែមថ្នាក់ថ្មី</span>
              <div className="space-y-2">
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="ឧ. ថ្នាក់ទី៦អា, ថ្នាក់ទី៧..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-medium text-slate-800 placeholder-slate-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newClassName.trim()) {
                      alert('សូមបញ្ចូលឈ្មោះថ្នាក់រៀនថ្មី!');
                      return;
                    }
                    if (onAddGrade) {
                      onAddGrade(newClassName.trim());
                      setNewClassName('');
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                >
                  <Plus size={14} />
                  បន្ថែមថ្នាក់ចូលប្រព័ន្ធ
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                * បន្ទាប់ពីបន្ថែមថ្នាក់ថ្មីរួច អ្នកនឹងអាចជ្រើសរើសថ្នាក់នេះនៅពេលបញ្ចូលពិន្ទុសិស្ស ឬរៀបចំរបាយការណ៍ប្រចាំខែ។
              </p>
            </div>

            {/* List Column */}
            <div className="md:col-span-2 space-y-3">
              <span className="text-xs font-bold text-slate-600 block">បញ្ជីថ្នាក់រៀនបច្ចុប្បន្ន ({gradesList.length} ថ្នាក់)</span>
              <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto p-1 text-xs">
                {gradesList.map((g) => {
                  return (
                    <div
                      key={g}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 shadow-3xs hover:border-indigo-200 transition-all hover:bg-indigo-50/20"
                    >
                      <span className="font-sans font-medium">{g}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (onDeleteGrade) {
                            onDeleteGrade(g);
                          }
                        }}
                        className="text-slate-400 hover:text-rose-550 hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded transition-colors"
                        title="លុបថ្នាក់នេះ"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sliding/Responsive Score Entry Form Modal or Inline Section */}
      {isFormOpen && (
        <div id="gradebook_form_container" className="bg-white p-6 rounded-2xl border border-blue-100 shadow-md space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-blue-50">
            <h3 className="font-semibold text-slate-800 text-base flex items-center gap-1.5">
              <GraduationCap className="text-blue-600" size={20} />
              {editingStudentId ? `កែសម្រួលពិន្ទុរបស់សិស្ស៖ ${formName}` : 'បញ្ចូលពិន្ទុសិស្សថ្មី'}
            </h3>
            <button
              onClick={() => setIsFormOpen(false)}
              className="p-1 px-2.5 text-sm bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg border border-slate-100 transition-colors"
            >
              <X size={16} className="inline mr-1" />បិទ
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: General Student Specs */}
            <div className="space-y-4 p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
              <h4 className="font-medium text-slate-700 text-sm border-b border-slate-100 pb-2">១. ព័ត៌មានផ្ទាល់ខ្លួន</h4>
              
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">ឈ្មោះសិស្ស</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ឧ. ចាន់ ដារ៉ា"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-medium text-slate-800 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">ភេទ</label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as 'ប្រុស' | 'ស្រី')}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-medium text-slate-800"
                  >
                    <option value="ប្រុស">ប្រុស</option>
                    <option value="ស្រី">ស្រី</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">ថ្នាក់សិក្សា</label>
                  <select
                    disabled={currentUser?.role === 'teacher'}
                    value={formGrade}
                    onChange={(e) => setFormGrade(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-500 border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-medium text-slate-800"
                  >
                    {gradesList.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">សម្រាប់ខែ</label>
                <select
                  value={formMonth}
                  onChange={(e) => setFormMonth(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-medium text-slate-800"
                >
                  {MONTHS_LIST.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2.5 text-xs text-blue-700/90 leading-relaxed">
                  <HelpCircle size={18} className="flex-shrink-0 text-blue-500" />
                  <div>
                    <span className="font-semibold block mb-0.5">ការកំណត់ពិន្ទុ៖</span>
                    ពិន្ទុរង និងពិន្ទុមុខវិជ្ជានីមួយៗត្រូវស្ថិតនៅចន្លោះពីគំនិត ០ ដល់ ១០ ជានិច្ច។ មធ្យមភាគប្រចាំខែរួម និងចំណាត់ថ្នាក់នឹងត្រូវរៀបចំដោយម៉ាស៊ីនស្វ័យប្រវត្ត។
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Key split subjects with sub-scores */}
            <div className="space-y-5 p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
              <h4 className="font-medium text-slate-700 text-sm border-b border-slate-100 pb-2">២. ភាសាខ្មែរ និងគណិតវិទ្យា (ពិន្ទុរង)</h4>
              
              {/* Khmer Box */}
              <div className="p-3 bg-white border border-slate-200/60 rounded-xl space-y-3">
                <span className="text-xs font-bold text-blue-600 block">ភាសាខ្មែរ (៤ ផ្នែករង)</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">សមត្ថភាពស្ដាប់</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      required
                      value={khmerListening}
                      onChange={(e) => setKhmerListening(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">សមត្ថភាពនិយាយ</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      required
                      value={khmerSpeaking}
                      onChange={(e) => setKhmerSpeaking(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">សមត្ថភាពអាន</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      required
                      value={khmerReading}
                      onChange={(e) => setKhmerReading(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">សមត្ថភាពសរសេរ</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      required
                      value={khmerWriting}
                      onChange={(e) => setKhmerWriting(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Math Box */}
              <div className="p-3 bg-white border border-slate-200/60 rounded-xl space-y-2.5">
                <span className="text-xs font-bold text-blue-600 block">គណិតវិទ្យា (៥ ផ្នែករង)</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">ចំនួន</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      required
                      value={mathNumbers}
                      onChange={(e) => setMathNumbers(e.target.value)}
                      className="w-full px-2 py-1.25 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">រង្វាស់រង្វាល់</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      required
                      value={mathMeasurement}
                      onChange={(e) => setMathMeasurement(e.target.value)}
                      className="w-full px-2 py-1.25 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">ធរណីមាត្រ</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      required
                      value={mathGeometry}
                      onChange={(e) => setMathGeometry(e.target.value)}
                      className="w-full px-2 py-1.25 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">ពិជគណិត</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      required
                      value={mathAlgebra}
                      onChange={(e) => setMathAlgebra(e.target.value)}
                      className="w-full px-2 py-1.25 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-400 mb-0.5">ស្ថិតិ</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      required
                      value={mathStatistics}
                      onChange={(e) => setMathStatistics(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Secondary Subjects */}
            <div className="space-y-4 p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
              <h4 className="font-medium text-slate-700 text-sm border-b border-slate-100 pb-2">៣. មុខវិជ្ជាបន្ថែមទាំង ៦</h4>
              
              <div className="grid grid-cols-2 gap-4 text-xs font-medium text-slate-600">
                <div>
                  <label className="block text-slate-500 mb-1">វិទ្យាសាស្ត្រ</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    required
                    value={science}
                    onChange={(e) => setScience(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">សិក្សាសង្គម</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    required
                    value={socialStudies}
                    onChange={(e) => setSocialStudies(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">កាយ-កីឡា</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    required
                    value={physicalEducation}
                    onChange={(e) => setPhysicalEducation(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">សុខភាព</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    required
                    value={health}
                    onChange={(e) => setHealth(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">បំណិនជីវិត</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    required
                    value={lifeSkills}
                    onChange={(e) => setLifeSkills(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">ភាសាបរទេស</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    required
                    value={foreignLanguage}
                    onChange={(e) => setForeignLanguage(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-center"
                  />
                </div>
              </div>

              {/* Form Save Button Action */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingStudentId(null);
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl text-sm font-semibold transition-colors"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  id="btn_submit_score"
                  className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-semibold transition-colors shadow-md shadow-blue-600/15"
                >
                  <Check size={16} />
                  {editingStudentId ? 'ធ្វើបច្ចុប្បន្នភាព' : 'រក្សាទុកទិន្នន័យ'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* List Filter Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-800 text-base">តារាងឈ្មោះ និងពិន្ទុសិស្ស</h3>
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-md font-mono text-xs border border-slate-200">
              សរុប {filteredStudents.length} នាក់
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Local Search input */}
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ស្វែងរកតាមឈ្មោះសិស្ស..."
                className="pl-8 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 outline-none focus:border-blue-500 transition-all text-xs"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            </div>

            {/* Quick selectors matching the upper selections */}
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-2 py-1 text-[11px] bg-white border-none text-slate-600 outline-none font-medium"
              >
                <option value="ទាំងអស់">គ្រប់ខែ</option>
                {MONTHS_LIST.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              {currentUser?.role === 'teacher' ? (
                <span className="px-3 py-1 text-[11px] bg-blue-50 text-blue-700/90 font-bold border-l border-slate-200 font-sans">
                  ថ្នាក់៖ {currentUser.grade} 🔒
                </span>
              ) : (
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="px-2 py-1 text-[11px] bg-white border-none text-slate-600 outline-none font-medium"
                >
                  <option value="ទាំងអស់">គ្រប់ថ្នាក់</option>
                  {gradesList.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable grid student table listing */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500">
                <th className="px-4 py-3 text-center">លេខរៀង/ចំណាត់ថ្នាក់</th>
                <th className="px-4 py-3">ឈ្មោះសិស្ស</th>
                <th className="px-4 py-3 text-center">ភេទ</th>
                <th className="px-4 py-3 text-center">ថ្នាក់សិក្សា</th>
                <th className="px-4 py-3 text-center">ខែ</th>
                <th className="px-4 py-3 text-center">ភាសាខ្មែរ (មធ្យម)</th>
                <th className="px-4 py-3 text-center">គណិត (មធ្យម)</th>
                <th className="px-4 py-3 text-center">វិទ្យាសាស្ត្រ</th>
                <th className="px-4 py-3 text-center">សិក្សាសង្គម</th>
                <th className="px-4 py-3 text-center">មធ្យមភាគរួម</th>
                <th className="px-4 py-3 text-center">និទ្ទេស</th>
                <th className="px-4 py-3 text-center">លទ្ធផល</th>
                <th className="px-4 py-3 text-right">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((st) => {
                  let badgeColors = 'bg-rose-50 text-rose-600 border-rose-200';
                  if (st.result === 'ជាប់') {
                    badgeColors = 'bg-emerald-50 text-emerald-600 border-emerald-200';
                  }

                  let gradeColor = 'text-slate-500';
                  if (st.gradeLetter === 'A') gradeColor = 'text-blue-600 font-bold';
                  else if (st.gradeLetter === 'B') gradeColor = 'text-blue-500 font-bold';
                  else if (st.gradeLetter === 'C') gradeColor = 'text-emerald-600 font-bold';

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-center font-semibold font-mono text-slate-500">
                        {st.ranking ? `${st.ranking}` : '-'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{st.name}</td>
                      <td className="px-4 py-3 text-center">{st.gender}</td>
                      <td className="px-4 py-3 text-center text-slate-500">{st.grade}</td>
                      <td className="px-4 py-3 text-center text-slate-500 font-medium">{st.month}</td>
                      <td className="px-4 py-3 text-center font-mono">
                        {st.khmerAvg} 
                        <span className="text-[9px] text-slate-400 block">
                          ({st.khmer.listening}/{st.khmer.writing}/{st.khmer.reading}/{st.khmer.speaking})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        {st.mathAvg}
                        <span className="text-[9px] text-slate-400 block">
                          ({st.math.numbers}/{st.math.measurement}/{st.math.geometry}/{st.math.algebra}/{st.math.statistics})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-500">{st.science}</td>
                      <td className="px-4 py-3 text-center font-mono text-slate-500">{st.socialStudies}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-blue-600 bg-blue-50/10">
                        {st.overallAvg}
                      </td>
                      <td className={`px-4 py-3 text-center ${gradeColor}`}>{st.gradeLetter}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 border text-[10px] font-bold rounded-full ${badgeColors}`}>
                          {st.result}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEditClick(st)}
                            className="p-1 px-1.5 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-800 transition-all font-medium inline-flex items-center gap-1 text-[10px]"
                            title="កែសម្រួលដាំពិន្ទុ"
                          >
                            <Edit3 size={11} /> កែ
                          </button>
                          <button
                            onClick={() => handleDeleteClick(st.id, st.name)}
                            className="p-1 text-rose-500 border border-transparent rounded hover:border-rose-100 hover:bg-rose-50 transition-all"
                            title="លុបពិន្ទុ"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-slate-400 font-medium">
                    <FolderLock size={32} className="mx-auto text-slate-300 mb-2" />
                    គ្មានគណនីសិស្ស ឬពិន្ទុត្រូវនឹងការជ្រើសរើសរបស់អ្នកទេ សូមចុច «បញ្ចូលពិន្ទុសិស្សថ្មី» ដើម្បីបន្ថែម!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
