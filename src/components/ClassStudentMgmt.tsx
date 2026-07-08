/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  Check, 
  Search, 
  GraduationCap, 
  Users, 
  UserPlus, 
  AlertTriangle,
  Info,
  Download,
  Upload,
  FileSpreadsheet,
  School,
  ArrowUpDown
} from 'lucide-react';
import { StudentScore, SchoolUser, afterHoursSubject } from '../types';
import { calculateStudentFields, generateUniqueId } from '../mockData';
import { distinctStudentKey, findPhantomGrades, baseStudentName } from '../utils/studentKey';
import { syncUpsertSetting } from '../lib/supabase';
import { useT } from '../i18n';
import * as XLSX from 'xlsx';

// Helper to normalize grade names by stripping whitespace and converting digits to standard Khmer
function normalizeGradeName(g: string | undefined | null): string {
  if (!g) return '';
  return String(g)
    .replace(/[\s\u00A0\uFEFF\u200B]/g, '') // remove all spaces and zero-width characters
    .replace(/1/g, '១')
    .replace(/2/g, '២')
    .replace(/3/g, '៣')
    .replace(/4/g, '៤')
    .replace(/5/g, '៥')
    .replace(/6/g, '៦')
    .trim();
}

// Class-category split: "extra" (after-hours skill classes) vs "general" (មត្តេយ្យ–ទី៦).
const EXTRA_CLASS_KEYWORDS = ['GRADE','គ្លេស', 'ភាសាអង់គ្លេស', 'អង់គ្លេស', 'គំនូរ', 'កុំព្យូទ័រ', 'កីឡា', 'អប់រំកាយ', 'អប់រំសុខភាព'];
const isExtraClass = (grade: string) => EXTRA_CLASS_KEYWORDS.some(k => (grade || '').includes(k));
// The subject keyword inside an after-hours class name, used to group its sections (3A, 3B...).
const getSubjectKey = (grade: string) => EXTRA_CLASS_KEYWORDS.find(k => (grade || '').includes(k)) || '';

interface ClassStudentMgmtProps {
  students: StudentScore[];
  grades: string[];
  onSaveStudents: (updatedList: StudentScore[]) => void;
  onAddGrade: (newGrade: string) => void;
  onDeleteGrade: (gradeToDelete: string) => void;
  onRenameGrade: (oldName: string, newName: string) => void;
  currentUser?: SchoolUser | null;
}

export default function ClassStudentMgmt({
  students,
  grades,
  onSaveStudents,
  onAddGrade,
  onDeleteGrade,
  onRenameGrade,
  currentUser
}: ClassStudentMgmtProps) {
  const { t } = useT();
  // Tabs
  const [activeTab, setActiveTab] = useState<'classes' | 'students'>('students');

  // Load initial teacher mappings, save in state
  const [customTeachers, setCustomTeachers] = useState<Record<string, { name: string; bg: string; text: string; desc: string }>>(() => {
    const defaultTeachers = {
      'មត្តេយ្យ ១': { name: 'អ្នកគ្រូ យាប់ សុខ', bg: 'bg-gradient-to-tr from-violet-600 to-pink-500', text: 'យ', desc: 'គ្រូបន្ទុកថ្នាក់បង្រៀន និងគ្រប់គ្រងសិស្សថ្នាក់មត្តេយ្យ ១' },
      'មត្តេយ្យ ២': { name: 'អ្នកគ្រូ ច្រឹល កែវ', bg: 'bg-gradient-to-tr from-pink-600 to-rose-500', text: 'ច', desc: 'គ្រូបន្ទុកថ្នាក់បង្រៀន និងគ្រប់គ្រងសិស្សថ្នាក់មត្តេយ្យ ២' },
      'ថ្នាក់ទី ១ក': { name: 'លោកគ្រូ ជឹម អ៊ន', bg: 'bg-gradient-to-tr from-blue-600 to-sky-500', text: 'ជ', desc: 'គ្រូបន្ទុកថ្នាក់បង្រៀន និងគ្រប់គ្រងសិស្សថ្នាក់ទី ១ក' },
      'ថ្នាក់ទី ១ខ': { name: 'អ្នកគ្រូ រ៉ន គឹមលៀង', bg: 'bg-gradient-to-tr from-purple-600 to-pink-500', text: 'រ', desc: 'គ្រូបន្ទុកថ្នាក់បង្រៀន និងគ្រប់គ្រងសិស្សថ្នាក់ទី ១ខ' },
      'ថ្នាក់ទី ២ក': { name: 'លោកគ្រូ ហុង ហ៊ីម', bg: 'bg-gradient-to-tr from-rose-600 to-orange-500', text: 'ហ', desc: 'គ្រូបន្ទុកថ្នាក់បង្រៀន និងគ្រប់គ្រងសិស្សថ្នាក់ទី ២ក' },
      'ថ្នាក់ទី ២ខ': { name: 'លោកគ្រូ ហុង ហ៊ីម', bg: 'bg-gradient-to-tr from-rose-600 to-orange-500', text: 'ហ', desc: 'គ្រូបន្ទុកថ្នាក់បង្រៀន និងគ្រប់គ្រងសិស្សថ្នាក់ទី ២ខ' },
      'ថ្នាក់ទី ៣ក': { name: 'លោកគ្រូ ឆន ក្រឹម', bg: 'bg-gradient-to-tr from-amber-600 to-yellow-500', text: 'ឆ', desc: 'គ្រូបន្ទុកថ្នាក់បង្រៀន និងគ្រប់គ្រងសិស្សថ្នាក់ទី ៣ក' },
      'ថ្នាក់ទី ៣ខ': { name: 'លោកគ្រូ ឆន ក្រឹម', bg: 'bg-gradient-to-tr from-amber-600 to-yellow-500', text: 'ឆ', desc: 'គ្រូបន្ទុកថ្នាក់បង្រៀន និងគ្រប់គ្រងសិស្សថ្នាក់ទី ៣ខ' },
      'ថ្នាក់ទី ៤ក': { name: 'លោកគ្រូ សាត គ្រី', bg: 'bg-gradient-to-tr from-teal-600 to-emerald-500', text: 'ស', desc: 'គ្រូបន្ទុកថ្នាក់បង្រៀន និងគ្រប់គ្រងសិស្សថ្នាក់ទី ៤ក' },
      'ថ្នាក់ទី ៤ខ': { name: 'លោកគ្រូ ថាវ សុផាត', bg: 'bg-gradient-to-tr from-sky-600 to-indigo-500', text: 'ថ', desc: 'គ្រូបន្ទុកថ្នាក់បង្រៀន និងគ្រប់គ្រងសិស្សថ្នាក់ទី ៤ខ' },
      'ថ្នាក់ទី ៥ក': { name: 'លោកគ្រូ គឺ អ៊ុនតាក់', bg: 'bg-gradient-to-tr from-violet-600 to-indigo-500', text: 'គ', desc: 'គ្រូបន្ទុកថ្នាក់បង្រៀន និងគ្រប់គ្រងសិស្សថ្នាក់ទី ៥ក' },
      'ថ្នាក់ទី ៥ខ': { name: 'លោកគ្រូ ចែម ណាក់', bg: 'bg-gradient-to-tr from-pink-600 to-red-500', text: 'ច', desc: 'គ្រូបន្ទុកថ្នាក់បង្រៀន និងគ្រប់គ្រងសិស្សថ្នាក់ទី ៥ខ' },
      'ថ្នាក់ទី ៦': { name: 'លោកគ្រូ ស៊ុំ សំណាង', bg: 'bg-gradient-to-tr from-pink-600 to-red-500', text: 'ស', desc: 'គ្រូបន្ទុកថ្នាក់បង្រៀន និងគ្រប់គ្រងសិស្សថ្នាក់ទី ៦' },
      'ថ្នាក់ភាសាអង់គ្លេស': { name: 'លោកគ្រូ យ៉ន យ៉ាវ', bg: 'bg-gradient-to-tr from-cyan-600 to-teal-500', text: 'យ', desc: 'គ្រូបន្ទុកថ្នាក់បង្រៀនភាសាអង់គ្លេស' },
      'ថ្នាក់គំនូរ': { name: 'អ្នកគ្រូ នី ចន្ទី', bg: 'bg-gradient-to-tr from-fuchsia-600 to-pink-500', text: 'ន', desc: 'គ្រូបន្ទុកថ្នាក់បង្រៀនជំនាញគំនូរ' },
      'ថ្នាក់កីឡា និងអប់រំកាយ': { name: 'លោកគ្រូ គឺ អ៊ុនតាក់', bg: 'bg-gradient-to-tr from-emerald-600 to-emerald-400', text: 'គ', desc: 'គ្រូបន្ទុកថ្នាក់បង្រៀនកីឡា និងអប់រំកាយ' },
      'ថ្នាក់អប់រំសុខភាព': { name: 'អ្នកគ្រូ ហេង គីមឡាង', bg: 'bg-gradient-to-tr from-sky-600 to-sky-300', text: 'ហ', desc: 'គ្រូបន្ទុកថ្នាក់បង្រៀនអប់រំសុខភាព' }
    };

    try {
      const saved = localStorage.getItem('school_custom_teachers_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        // If it doesn't contain 'មត្តេយ្យ ១', reset cache to new default list
        if (!parsed['មត្តេយ្យ ១']) {
          localStorage.setItem('school_custom_teachers_v2', JSON.stringify(defaultTeachers));
          return defaultTeachers;
        }
        return parsed;
      }
    } catch (e) {}
    
    localStorage.setItem('school_custom_teachers_v2', JSON.stringify(defaultTeachers));
    return defaultTeachers;
  });

  // State for customizing teacher profile
  const [isEditingTeacher, setIsEditingTeacher] = useState(false);
  const [teacherEditName, setTeacherEditName] = useState('');
  const [teacherEditDesc, setTeacherEditDesc] = useState('');
  const [teacherEditGrade, setTeacherEditGrade] = useState('');

  // Search/Filters states
  const [classSearch, setClassSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>('default');
  const [selectedGroup, setSelectedGroup] = useState<string>('ទាំងអស់'); // group filter (after-hours)
  // Teacher access scope. A general teacher is locked to their one class; an
  // after-hours teacher (e.g. English) may pick among their subject's sections.
  const isTeacher = currentUser?.role === 'teacher';
  const isExtraTeacher = isTeacher && isExtraClass(currentUser!.grade || '');
  const teacherGradeOptions = isExtraTeacher
    ? grades.filter(g => afterHoursSubject(g) === afterHoursSubject(currentUser!.grade))
    : (isTeacher ? [currentUser!.grade] : []);
  // Whether a teacher may view/edit a given class: their own class, or — for an
  // after-hours teacher — any section of the subject they teach.
  const teacherCanAccessGrade = (g: string) => {
    if (!isTeacher) return true;
    if (isExtraTeacher) return afterHoursSubject(g) === afterHoursSubject(currentUser!.grade);
    return g === currentUser!.grade;
  };

  // Who may ADD / EDIT students in a class: the principal (any class), or an
  // after-hours teacher (English, drawing, …) in their own class — they enrol
  // their own students. General-class rosters stay principal-only (official data).
  const canManageStudents = (g: string) =>
    currentUser?.role === 'principal' || (isExtraTeacher && teacherCanAccessGrade(g));

  const [selectedRosterGrade, setSelectedRosterGrade] = useState<string>(
    isTeacher ? (teacherGradeOptions[0] || currentUser!.grade) : (grades[0] || 'ថ្នាក់ទី៦')
  );

  // Class category (general / extra) — scopes the KPI cards, grade dropdown, roster & class list.
  const [classCategory, setClassCategory] = useState<'general' | 'extra'>(() => {
    const g = isTeacher ? currentUser!.grade : (grades[0] || '');
    return isExtraClass(g) ? 'extra' : 'general';
  });
  const inCat = (grade: string) => (classCategory === 'extra' ? isExtraClass(grade) : !isExtraClass(grade));
  const categoryGrades = grades.filter(g => inCat(g));

  // Hidden file input ref for CSV IMPORT
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create/Edit Class states
  const [newClassName, setNewClassName] = useState('');
  const [editingClassName, setEditingClassName] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Create/Edit Student states
  const [isStudentFormOpen, setIsStudentFormOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentFormName, setStudentFormName] = useState('');
  const [studentFormGender, setStudentFormGender] = useState<'ប្រុស' | 'ស្រី'>('ប្រុស');
  const [studentFormGrade, setStudentFormGrade] = useState<string>(grades[0] || 'ថ្នាក់ទី៦');
  const [studentFormStatus, setStudentFormStatus] = useState<'ធម្មតា' | 'រៀនយឺត' | 'បោះបង់'>('ធម្មតា');
  const [studentFormGroup, setStudentFormGroup] = useState<string>(''); // ក្រុម (after-hours classes)
  // Student profile fields (stored in extra_data, cloud-synced).
  const [studentFormId, setStudentFormId] = useState('');       // អត្តលេខ
  const [studentFormDob, setStudentFormDob] = useState('');     // ថ្ងៃខែឆ្នាំកំណើត
  const [studentFormFather, setStudentFormFather] = useState(''); // ឈ្មោះឪពុក
  const [studentFormMother, setStudentFormMother] = useState(''); // ឈ្មោះម្តាយ
  const [studentFormAddress, setStudentFormAddress] = useState(''); // អាសយដ្ឋាន
  const [studentFormPhone, setStudentFormPhone] = useState('');   // លេខទំនាក់ទំនង

  // Stray sectionless grades (e.g. "ថ្នាក់ទី៣" when ៣ក/៣ខ exist) are hidden from
  // the counts & rosters so the head-count matches reality (459, not 481). This is
  // DISPLAY-ONLY — mutation handlers below still use the full `students` prop, so
  // those records are never deleted, just not shown.
  const phantomGrades = useMemo(() => findPhantomGrades(students.map(s => s.grade)), [students]);
  const visibleStudents = useMemo(() => students.filter(s => !phantomGrades.has(s.grade)), [students, phantomGrades]);

  // Fill blank id/dob from the student's other records:
  //   • អត្តលេខ — from THIS class's own score list (the after-hours class has its own
  //     A00x ids), preferring the June (មិថុនា) month; keyed by name+grade+group.
  //   • ថ្ងៃខែឆ្នាំកំណើត — from the student's GENERAL (non-after-hours) class record,
  //     matched by base name (dob is shared across all their classes).
  const lookups = useMemo(() => {
    const idByClass = new Map<string, { id: string; june: boolean }>(); // name|grade|group
    const idByBase = new Map<string, { id: string; june: boolean }>();  // base name (any class)
    const dobByBase = new Map<string, string>();
    for (const s of students) {
      const sid = (s as any).studentId;
      const june = s.month === 'មិថុនា';
      if (sid) {
        const ckey = `${s.name.trim()}|${s.grade}|${s.group || ''}`;
        const c = idByClass.get(ckey); if (!c || (june && !c.june)) idByClass.set(ckey, { id: sid, june });
        const bkey = baseStudentName(s.name);
        const b = idByBase.get(bkey); if (!b || (june && !b.june)) idByBase.set(bkey, { id: sid, june });
      }
      if (s.dob && !isExtraClass(s.grade)) {
        const base = baseStudentName(s.name);
        if (!dobByBase.has(base)) dobByBase.set(base, s.dob);
      }
    }
    return { idByClass, idByBase, dobByBase };
  }, [students]);
  // Prefer THIS class's id, then the record's own, then ANY of the student's other
  // records — so every student gets an id filled in.
  const resolvedId = (p: StudentScore) =>
    lookups.idByClass.get(`${p.name.trim()}|${p.grade}|${p.group || ''}`)?.id
    || p.studentId
    || lookups.idByBase.get(baseStudentName(p.name))?.id
    || '';
  const resolvedDob = (p: StudentScore) => p.dob || lookups.dobByBase.get(baseStudentName(p.name)) || '';

  // Stats calculation — count UNIQUE students (by name+grade, not monthly records),
  // scoped to the selected class category. Matches the Dashboard totals.
  const categoryProfiles = useMemo(() => {
    const map = new Map<string, StudentScore>();
    visibleStudents.forEach(s => {
      if (!inCat(s.grade)) return;
      const key = distinctStudentKey(s.name, s.grade);
      if (!map.has(key)) map.set(key, s);
    });
    return Array.from(map.values());
  }, [visibleStudents, classCategory]);
  const totalStudents = categoryProfiles.length;
  const femaleStudents = categoryProfiles.filter(s => s.gender === 'ស្រី').length;
  const maleStudents = categoryProfiles.filter(s => s.gender === 'ប្រុស').length;
  
  // Dynamic map count of students per grade
  const gradeStats = useMemo(() => {
    const stats: Record<string, { total: number; female: number; male: number }> = {};
    grades.forEach(g => {
      stats[g] = { total: 0, female: 0, male: 0 };
    });
    const seen = new Set<string>();
    visibleStudents.forEach(s => {
      const key = distinctStudentKey(s.name, s.grade);
      if (seen.has(key)) return; // count each student once, not per-month
      seen.add(key);
      if (stats[s.grade]) {
        stats[s.grade].total += 1;
        if (s.gender === 'ស្រី') stats[s.grade].female += 1;
        else stats[s.grade].male += 1;
      }
    });
    return stats;
  }, [grades, visibleStudents]);

  // Unique list of unique student profiles (since they may have records across multiple months, unique by Name & Grade)
  const uniqueStudentProfiles = useMemo(() => {
    const map = new Map<string, StudentScore>();
    visibleStudents.forEach(s => {
      const key = distinctStudentKey(s.name, s.grade);
      if (!map.has(key)) {
        map.set(key, s);
      }
    });
    return Array.from(map.values());
  }, [visibleStudents]);

  // Filter students profile list
  const filteredProfiles = useMemo(() => {
    let list = uniqueStudentProfiles.filter(s => inCat(s.grade));

    if (selectedRosterGrade !== 'ទាំងអស់') {
      list = list.filter(s => s.grade === selectedRosterGrade);
    }

    if (classCategory === 'extra' && selectedGroup !== 'ទាំងអស់') {
      list = list.filter(s => (s.group || '') === (selectedGroup === '(គ្មានក្រុម)' ? '' : selectedGroup));
    }

    if (studentSearch.trim()) {
      const query = studentSearch.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(query));
    }

    if (sortOrder === 'asc') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'km'));
    } else if (sortOrder === 'desc') {
      list = [...list].sort((a, b) => b.name.localeCompare(a.name, 'km'));
    }

    return list;
  }, [uniqueStudentProfiles, selectedRosterGrade, studentSearch, sortOrder, classCategory, selectedGroup]);

  // Distinct groups within the current class scope (for the group filter dropdown).
  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    let hasUngrouped = false;
    uniqueStudentProfiles.forEach(s => {
      if (!inCat(s.grade)) return;
      if (selectedRosterGrade !== 'ទាំងអស់' && s.grade !== selectedRosterGrade) return;
      const g = (s.group || '').trim();
      if (g) set.add(g); else hasUngrouped = true;
    });
    const list = Array.from(set).sort((a, b) => a.localeCompare(b, 'km'));
    return hasUngrouped ? [...list, '(គ្មានក្រុម)'] : list;
  }, [uniqueStudentProfiles, selectedRosterGrade, classCategory]);

  const handleAddClassLocal = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role === 'teacher') {
      alert('គណនីគ្រូមិនមានសិទ្ធិកែប្រែព័ត៌មានឡើយ!');
      return;
    }
    const val = newClassName.trim();
    if (!val) return;
    onAddGrade(val);
    setNewClassName('');
  };

  const handleStartRenameClass = (g: string) => {
    if (currentUser?.role === 'teacher') return;
    setEditingClassName(g);
    setRenameValue(g);
  };

  const handleSaveRenameClass = (oldName: string) => {
    if (currentUser?.role === 'teacher') return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    if (trimmed === oldName) {
      setEditingClassName(null);
      return;
    }
    if (grades.includes(trimmed)) {
      alert('ឈ្មោះថ្នាក់រៀននេះមានរួចរាល់ហើយ!');
      return;
    }
    onRenameGrade(oldName, trimmed);
    setEditingClassName(null);
  };

  // Student Actions
  const handleOpenAddStudent = () => {
    setEditingStudentId(null);
    setStudentFormName('');
    setStudentFormGender('ប្រុស');
    setStudentFormGrade(selectedRosterGrade !== 'ទាំងអស់' ? selectedRosterGrade : (grades[0] || 'ថ្នាក់ទី៦'));
    setStudentFormStatus('ធម្មតា');
    setStudentFormGroup('');
    setStudentFormId(''); setStudentFormDob(''); setStudentFormFather('');
    setStudentFormMother(''); setStudentFormAddress(''); setStudentFormPhone('');
    setIsStudentFormOpen(true);
  };

  const handleOpenEditStudent = (profile: StudentScore) => {
    setEditingStudentId(profile.id);
    setStudentFormName(profile.name);
    setStudentFormGender(profile.gender);
    setStudentFormGrade(profile.grade);
    setStudentFormStatus(profile.status || 'ធម្មតា');
    setStudentFormGroup(profile.group || '');
    setStudentFormId(profile.studentId || ''); setStudentFormDob(profile.dob || '');
    setStudentFormFather(profile.fatherName || ''); setStudentFormMother(profile.motherName || '');
    setStudentFormAddress(profile.address || ''); setStudentFormPhone(profile.phone || '');
    setIsStudentFormOpen(true);
  };

  const handleSaveStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role === 'teacher') {
      if (!teacherCanAccessGrade(studentFormGrade)) {
        alert(`លោកអ្នកមានសិទ្ធិចុះឈ្មោះ ឬកែប្រែព័ត៌មានសិស្សបានតែក្នុងថ្នាក់ ${currentUser.grade} របស់លោកអ្នកប៉ុណ្ណោះ!`);
        return;
      }
    }
    const name = studentFormName.trim();
    if (!name) {
      alert('សូមបញ្ចូលឈ្មោះសិស្ស!');
      return;
    }

    if (editingStudentId) {
      // Find the old student profile details from the id
      const targetOldStudent = uniqueStudentProfiles.find(s => s.id === editingStudentId);
      if (targetOldStudent) {
        // Edit mode: rename/regender/regrade student in ALL records they have across any month
        const updated = students.map(s => {
          if (s.name.trim() === targetOldStudent.name.trim() && s.grade === targetOldStudent.grade) {
            // Update this record
            const payload = {
              ...s,
              name: name,
              gender: studentFormGender,
              grade: studentFormGrade,
              group: studentFormGroup.trim() || undefined,
              status: studentFormStatus,
              studentId: studentFormId.trim() || undefined,
              dob: studentFormDob.trim() || undefined,
              fatherName: studentFormFather.trim() || undefined,
              motherName: studentFormMother.trim() || undefined,
              address: studentFormAddress.trim() || undefined,
              phone: studentFormPhone.trim() || undefined,
            };
            return calculateStudentFields(payload);
          }
          return s;
        });
        onSaveStudents(updated);
        alert('បានធ្វើបច្ចុប្បន្នភាពព័ត៌មានសិស្សដោយជោគជ័យ ចំពោះគ្រប់ខែសិក្សាទាំងអស់!');
      }
    } else {
      if (!canManageStudents(studentFormGrade)) {
         alert('លោកអ្នកមានសិទ្ធិចុះឈ្មោះសិស្សបានតែក្នុងថ្នាក់របស់លោកអ្នកប៉ុណ្ណោះ។');
         return;
      }
      
      // Create new student profile
      // Check if student with same name/grade already exists
      const exists = uniqueStudentProfiles.some(s => s.name.toLowerCase() === name.toLowerCase() && s.grade === studentFormGrade);
      if (exists) {
        alert('សិស្សឈ្មោះនេះមានគណនីក្នុងថ្នាក់រៀបចំរួចហើយ!');
        return;
      }

      // Add a clean initial student score record in current default active month (e.g. 'មេសា')
      const payload: Omit<StudentScore, 'khmerAvg' | 'mathAvg' | 'overallAvg' | 'gradeLetter' | 'result'> = {
        id: generateUniqueId(),
        name,
        gender: studentFormGender,
        grade: studentFormGrade,
        group: studentFormGroup.trim() || undefined,
        status: studentFormStatus,
        studentId: studentFormId.trim() || undefined,
        dob: studentFormDob.trim() || undefined,
        fatherName: studentFormFather.trim() || undefined,
        motherName: studentFormMother.trim() || undefined,
        address: studentFormAddress.trim() || undefined,
        phone: studentFormPhone.trim() || undefined,
        month: 'មេសា',
        khmer: { listening: null, writing: null, reading: null, speaking: null },
        math: { numbers: null, measurement: null, geometry: null, algebra: null, statistics: null },
        science: null,
        socialStudies: null,
        physicalEducation: null,
        health: null,
        lifeSkills: null,
        foreignLanguage: null
      };
      
      const updated = [...students, calculateStudentFields(payload)];
      onSaveStudents(updated);
      alert(`បានចុះឈ្មោះសិស្សថ្មី «${name}» ចូលក្នុងប្រព័ន្ធសម្រាប់ «មេសា»! អ្នកអាចបញ្ចូលពិន្ទុបន្ថែមក្នុងសៀវភៅពិន្ទុ។`);
    }

    setIsStudentFormOpen(false);
  };

  const handleDeleteStudentProfile = (profile: StudentScore) => {
    if (currentUser?.role === 'teacher') {
      if (!teacherCanAccessGrade(profile.grade)) {
        alert(`លោកអ្នកមានសិទ្ធិលុបសិស្សបានតែក្នុងថ្នាក់ ${currentUser.grade} របស់លោកអ្នកប៉ុណ្ណោះ!`);
        return;
      }
    }
    if (window.confirm(`តើអ្នកពិតជាចង់លុបសិស្សឈ្មោះ «${profile.name}» ពីក្នុងគណនីថ្នាក់ ${profile.grade} នេះមែនទេ? រាល់ពិន្ទុគ្រប់ខែនឹងត្រូវលុបចោលទាំងអស់!`)) {
      const updated = students.filter(s => !(s.name.trim() === profile.name.trim() && s.grade === profile.grade));
      onSaveStudents(updated);
    }
  };

  const handleClearAllStudentsInActiveGrade = () => {
    if (currentUser?.role === 'teacher') {
      if (!teacherCanAccessGrade(selectedRosterGrade)) {
        alert(`លោកអ្នកមានសិទ្ធិលុបសិស្សបានតែក្នុងថ្នាក់ ${currentUser.grade} របស់លោកអ្នកប៉ុណ្ណោះ!`);
        return;
      }
    }
    if (selectedRosterGrade === 'ទាំងអស់') {
      alert('សូមជ្រើសរើសថ្នាក់ជាក់លាក់មួយជាមុនសិន ដើម្បីលុបសិស្សទាំងអស់!');
      return;
    }
    if (window.confirm(`តើលោកអ្នកពិតជាចង់លុបសិស្សទាំងអស់ក្នុងថ្នាក់ «${selectedRosterGrade}» មែនទេ? ទិន្នន័យពិន្ទុ និងគណនីទាំងអស់របស់ពួកគេនៅក្នុងថ្នាក់នេះនឹងត្រូវលុបចោលទាំងស្រុង!`)) {
      const remainingStudents = students.filter(s => s.grade !== selectedRosterGrade);
      onSaveStudents(remainingStudents);
      alert(`បានលុបសិស្សទាំងអស់ក្នុងថ្នាក់ «${selectedRosterGrade}» រួចរាល់ហើយ។`);
    }
  };

  // Delete every student of the SELECTED group within the active class.
  const handleClearGroupInActiveGrade = () => {
    if (!canManageStudents(selectedRosterGrade)) {
      alert(`លោកអ្នកមានសិទ្ធិលុបសិស្សបានតែក្នុងថ្នាក់របស់លោកអ្នកប៉ុណ្ណោះ!`);
      return;
    }
    if (selectedRosterGrade === 'ទាំងអស់' || selectedGroup === 'ទាំងអស់') {
      alert('សូមជ្រើសរើសថ្នាក់ និងក្រុមជាក់លាក់ជាមុនសិន ដើម្បីលុបតាមក្រុម!');
      return;
    }
    const grp = selectedGroup === '(គ្មានក្រុម)' ? '' : selectedGroup;
    if (window.confirm(`តើលោកអ្នកពិតជាចង់លុបសិស្សទាំងអស់ក្នុងក្រុម «${selectedGroup}» នៃថ្នាក់ «${selectedRosterGrade}» មែនទេ? ទិន្នន័យពិន្ទុ និងគណនីរបស់ពួកគេនឹងត្រូវលុបចោលទាំងស្រុង!`)) {
      const remaining = students.filter(s => !(s.grade === selectedRosterGrade && (s.group || '') === grp));
      onSaveStudents(remaining);
      alert(`បានលុបសិស្សក្នុងក្រុម «${selectedGroup}» រួចរាល់ហើយ។`);
    }
  };

  const handleClearAllStudentsGlobally = () => {
    if (currentUser?.role === 'teacher') {
      alert('លោកអ្នកមានសិទ្ធិលុបសិស្សបានតែក្នុងថ្នាក់របស់លោកអ្នកប៉ុណ្ណោះ! សូមជ្រើសរើសថ្នាក់ជាក់លាក់របស់លោកអ្នកដើម្បីលុប។');
      return;
    }
    if (window.confirm('🚨 ព្រមាន៖ តើលោកអ្នកពិតជាចង់លុបឈ្មោះសិស្សទាំងអស់គ្នាក្នុងសាលា (គ្រប់ថ្នាក់រៀនទាំងអស់) មែនទេ? ទិន្នន័យព័ត៌មាន និងពិន្ទុសិស្សទាំងអស់ក្នុងគ្រប់ខែនឹងត្រូវលុបចោលទាំងស្រុងពីក្នុងឧបករណ៍នេះ!')) {
      onSaveStudents([]);
      alert('បានលុបឈ្មោះសិស្សទាំងអស់គ្នាក្នុងសាលារួចរាល់ហើយ!');
    }
  };

  const handleAddSampleStudents = () => {
    if (currentUser?.role === 'teacher') {
      if (!teacherCanAccessGrade(selectedRosterGrade)) {
        alert(`លោកអ្នកមានសិទ្ធិបន្ថែមសិស្សគំរូបានតែក្នុងថ្នាក់ ${currentUser.grade} របស់លោកអ្នកប៉ុណ្ណោះ!`);
        return;
      }
    }
    if (selectedRosterGrade === 'ទាំងអស់') {
      alert('សូមជ្រើសរើសថ្នាក់ជាក់លាក់មួយជាមុនសិន ដើម្បីបន្ថែមសិស្សគំរូ!');
      return;
    }
    const sampleNames = [
      { name: 'សួង សុភ័ក្ត្រ', gender: 'ស្រី' as const },
      { name: 'ម៉ែន ស៊ីណាត', gender: 'ប្រុស' as const },
      { name: 'ឈិន ដានី', gender: 'ស្រី' as const },
      { name: 'ឃុន រតនា', gender: 'ប្រុស' as const }
    ];

    let countAdded = 0;
    const recordsToAdd: StudentScore[] = [];

    sampleNames.forEach(item => {
      const exists = uniqueStudentProfiles.some(s => s.name === item.name && s.grade === selectedRosterGrade);
      if (!exists) {
        const payload = {
          id: generateUniqueId(),
          name: item.name,
          gender: item.gender,
          grade: selectedRosterGrade,
          month: 'មេសា',
          khmer: { listening: 6.5, writing: 7.2, reading: 7.0, speaking: 6.8 },
          math: { numbers: 7.0, measurement: 6.5, geometry: 6.0, algebra: 7.5, statistics: 6.8 },
          science: 7.5,
          socialStudies: 7.0,
          physicalEducation: 8.0,
          health: 7.5,
          lifeSkills: 8.0,
          foreignLanguage: 6.0
        };
        recordsToAdd.push(calculateStudentFields(payload));
        countAdded++;
      }
    });

    if (countAdded > 0) {
      onSaveStudents([...students, ...recordsToAdd]);
      alert(`បានបន្ថែមសិស្សគំរូចំនួន ${countAdded} នាក់ ទៅក្នុង ${selectedRosterGrade} ដោយស្វ័យប្រវត្តិ!`);
    } else {
      alert('សិស្សគំរូទាំងនេះមានគណនីរួចរាល់នៅក្នុងថ្នាក់នេះហើយ!');
    }
  };

  // Helper to open teacher editor
  const handleOpenEditTeacher = () => {
    const info = getTeacherForGrade(selectedRosterGrade);
    setTeacherEditName(info.name);
    setTeacherEditDesc(info.desc);
    setTeacherEditGrade(selectedRosterGrade);
    setIsEditingTeacher(true);
  };

  // Helper to save customized teacher info
  const handleSaveTeacherLocal = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...customTeachers,
      [teacherEditGrade]: {
        name: teacherEditName.trim() || 'លោកគ្រូ/អ្នកគ្រូ គ្រូបន្ទុកថ្នាក់',
        desc: teacherEditDesc.trim() || 'គ្រូទទួលបន្ទុកផ្ដល់ការអប់រំ និងតាមដានការអភិវឌ្ឍន៍សិស្ស។',
        bg: customTeachers[teacherEditGrade]?.bg || 'bg-gradient-to-tr from-sky-600 to-indigo-500',
        text: (teacherEditName.trim() ? teacherEditName.trim()[0] : 'គ')
      }
    };
    setCustomTeachers(updated);
    try {
      localStorage.setItem('school_custom_teachers_v2', JSON.stringify(updated));
      syncUpsertSetting('school_custom_teachers_v2', updated).catch(console.error);
    } catch (err) {}
    setIsEditingTeacher(false);
    alert('បានកែប្រែព័ត៌មានគ្រូថ្នាក់រៀននេះដោយជោគជ័យ!');
  };

  // Helper to resolve teacher name based on selected grade
  const getTeacherForGrade = (g: string) => {
    if (g === 'ទាំងអស់') {
      const pInfo = customTeachers['principal'] || {
        name: 'លោកនាយក ឃឹម សុភ័ក្ត្រ',
        bg: 'bg-gradient-to-tr from-emerald-600 to-yellow-500',
        text: 'ន',
        desc: 'គ្រប់គ្រងដឹកនាំសាលារៀនទាំងមូល និងតាមដានរបាយការណ៍សាលាជាប្រចាំខែ'
      };
      return {
        name: pInfo.name,
        role: 'នាយកសាលាបឋមសិក្សា',
        avatarBg: pInfo.bg,
        avatarText: pInfo.text,
        desc: pInfo.desc
      };
    }

    if (currentUser && currentUser.role === 'teacher' && currentUser.grade === g) {
      const customT = customTeachers[g];
      return {
        name: customT ? customT.name : currentUser.name,
        role: 'គ្រូបន្ទុកថ្នាក់ (គណនីបច្ចុប្បន្ន)',
        avatarBg: currentUser.avatarBg || 'bg-indigo-600',
        avatarText: customT ? customT.text : currentUser.name[0],
        desc: customT ? customT.desc : `អ្នកគ្រប់គ្រង និងកត់ត្រាពិន្ទុសិស្សថ្នាក់ ${g} នេះផ្ទាល់។`
      };
    }

    const customT = customTeachers[g];
    if (customT) {
      return {
        name: customT.name,
        role: 'គ្រូបន្ទុកថ្នាក់',
        avatarBg: customT.bg,
        avatarText: customT.text,
        desc: customT.desc
      };
    }

    return {
      name: 'លោកគ្រូ/អ្នកគ្រូ គ្រូបន្ទុកថ្នាក់',
      role: 'គ្រូបន្ទុកថ្នាក់រៀន',
      avatarBg: 'bg-slate-600',
      avatarText: 'គ',
      desc: 'គ្រូទទួលបន្ទុកផ្ដល់ការអប់រំ និងតាមដានការអភិវឌ្ឍន៍សិស្ស។'
    };
  };

  // Excel (.csv UTF-8 compatible) Generation & Download
  const handleExportCSV = (exportTemplate = false) => {
    let listToExport = filteredProfiles;
    
    if (exportTemplate) {
      const tplGrade = selectedRosterGrade !== 'ទាំងអស់' ? selectedRosterGrade : (grades[0] || 'ថ្នាក់ទី៦');
      listToExport = [
        { id: '1', name: 'សុខ ម៉ារីហ្សា', gender: 'ស្រី', grade: tplGrade, group: classCategory === 'extra' ? 'A' : undefined, status: 'ធម្មតា' } as any,
        { id: '2', name: 'លី ម៉េងហួរ', gender: 'ប្រុស', grade: tplGrade, group: classCategory === 'extra' ? 'B' : undefined, status: 'ធម្មតា' } as any
      ];
    }

    // After-hours classes get an extra ក្រុម column.
    const withGroup = classCategory === 'extra';
    const headers = withGroup ? "ល.រ,ឈ្មោះសិស្ស,ភេទ,ថ្នាក់,ក្រុម,ស្ថានភាព" : "ល.រ,ឈ្មោះសិស្ស,ភេទ,ថ្នាក់,ស្ថានភាព";
    const rows = listToExport.map((s, idx) => {
      const statusStr = s.status || 'ធម្មតា';
      return withGroup
        ? `${idx + 1},"${s.name}","${s.gender}","${s.grade}","${s.group || ''}","${statusStr}"`
        : `${idx + 1},"${s.name}","${s.gender}","${s.grade}","${statusStr}"`;
    });
    
    // We prepend the UTF-8 Byte Order Mark (BOM) so Microsoft Excel on Windows/macOS correctly parses Khmer font!
    const csvContent = "\uFEFF" + [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportTemplate 
      ? `គំរូតារាងបញ្ជីឈ្មោះសិស្ស_${selectedRosterGrade}.csv` 
      : `បញ្ជីឈ្មោះសិស្ស_${selectedRosterGrade}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Local Excel/CSV parser from computer supporting XLS, XLSX and CSV
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (currentUser?.role !== 'principal') {
      alert('មានតែនាយកសាលាប៉ុណ្ណោះ ដែលមានសិទ្ធិនាំចូលបញ្ជីឈ្មោះសិស្សថ្មីពីរុក្ខកាសែត (Excel) បាន។');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const isCsv = file.name.toLowerCase().endsWith('.csv');
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let rows: any[][] = [];

        if (isCsv) {
          const text = event.target?.result as string;
          // Clean BOM (\uFEFF) and zero-width spaces (\u200B) if present at start
          const cleanText = text.replace(/[\uFEFF\u200B\u200D]/g, '');
          
          let isSheetJSValid = false;
          try {
            const workbook = XLSX.read(cleanText, { type: 'string' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            if (worksheet) {
              const parsed = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
              if (parsed && parsed.length > 0 && parsed.some(r => r && r.length > 1)) {
                rows = parsed;
                isSheetJSValid = true;
              }
            }
          } catch (err) {
            console.warn("SheetJS failed to parse CSV string, falling back to manual delimiter split.", err);
          }

          // Fallback manual parser if SheetJS did not parse multiple columns or rows properly
          if (!isSheetJSValid || !rows || rows.length <= 1) {
            const lines = cleanText.split(/\r?\n/).filter(line => line.trim().length > 0);
            
            // Auto-detect localized Excel delimiters: comma, semicolon, or tab character
            let delimiter = ',';
            const sampleLines = lines.slice(0, 5);
            let commaCount = 0;
            let semicolonCount = 0;
            let tabCount = 0;
            sampleLines.forEach(l => {
              commaCount += (l.match(/,/g) || []).length;
              semicolonCount += (l.match(/;/g) || []).length;
              tabCount += (l.match(/\t/g) || []).length;
            });
            
            if (semicolonCount > commaCount && semicolonCount > tabCount) {
              delimiter = ';';
            } else if (tabCount > commaCount && tabCount > semicolonCount) {
              delimiter = '\t';
            }

            rows = lines.map(line => {
              const result = [];
              let current = '';
              let inQuotes = false;
              for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                  inQuotes = !inQuotes;
                } else if (char === delimiter && !inQuotes) {
                  result.push(current);
                  current = '';
                } else {
                  current += char;
                }
              }
              result.push(current);
              return result;
            }).filter(r => r.some(cell => cell.trim().length > 0));
          }
        } else {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const data = new Uint8Array(arrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          if (worksheet) {
            rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
          }
        }

        if (!rows || rows.length <= 1) {
          alert("សន្លឹកកិច្ចការគ្មានទិន្នន័យឡើយ!");
          return;
        }

        const newStudentsList: StudentScore[] = [];
        let importCount = 0;
        let duplicateCount = 0;
        let rejectedTeacherCount = 0;

        // Identify header index and column indices dynamically with a high-durability scoring system
        // This avoids false positives from top-positioned document title/banner text!
        let startIndex = 0;
        let nameIndex = -1;
        let genderIndex = -1;
        let gradeIndex = -1;
        let serialIndex = -1;
        let statusIndex = -1;
        let groupIndex = -1;

        let bestHeaderRowIndex = -1;
        let bestHeaderScore = 0;
        let bestNameIdx = -1;
        let bestGenderIdx = -1;
        let bestGradeIdx = -1;
        let bestSerialIdx = -1;
        let bestStatusIdx = -1;
        let bestGroupIdx = -1;

        for (let i = 0; i < Math.min(rows.length, 15); i++) {
          const rowVals = rows[i];
          if (!rowVals || !Array.isArray(rowVals)) continue;
          
          let tempNameIdx = -1;
          let tempGenderIdx = -1;
          let tempGradeIdx = -1;
          let tempSerialIdx = -1;
          let tempStatusIdx = -1;
          let tempGroupIdx = -1;
          let score = 0;

          for (let c = 0; c < rowVals.length; c++) {
            const val = String(rowVals[c] ?? '')
              .replace(/[\uFEFF\u200B\u200D]/g, '')
              .replace(/\s+/g, ' ')
              .trim();
            const valLower = val.toLowerCase();
            
            // Cells in title banners are typically very long sentences. Real headers are short labels.
            if (val.length > 30) continue;

            if (val === "ឈ្មោះ" || valLower === "name" || valLower === "fullname" || val === "ឈ្មោះសិស្ស" || val === "គោត្តនាម" || val === "នាមខ្លួន" || val.includes("ឈ្មោះសិស្ស")) {
              if (tempNameIdx === -1) {
                tempNameIdx = c;
                score += 2; // high-weight factor for student name column
              }
            } else if (val === "ភេទ" || valLower === "gender" || valLower === "sex" || valLower === "g") {
              if (tempGenderIdx === -1) {
                tempGenderIdx = c;
                score += 1;
              }
            } else if (val.includes("ថ្នាក់") || valLower === "grade" || valLower === "class" || valLower === "c") {
              if (tempGradeIdx === -1) {
                tempGradeIdx = c;
                score += 1;
              }
            } else if (val === "ល.រ" || val === "លរ" || valLower === "no" || valLower === "n°" || valLower === "id") {
              if (tempSerialIdx === -1) {
                tempSerialIdx = c;
                score += 1;
              }
            } else if (val === "ស្ថានភាព" || valLower === "status") {
              if (tempStatusIdx === -1) {
                tempStatusIdx = c;
                score += 1;
              }
            } else if (val === "ក្រុម" || valLower === "group" || valLower === "grp") {
              if (tempGroupIdx === -1) {
                tempGroupIdx = c;
                score += 1;
              }
            }
          }

          if (score > bestHeaderScore) {
            bestHeaderScore = score;
            bestHeaderRowIndex = i;
            bestNameIdx = tempNameIdx;
            bestGenderIdx = tempGenderIdx;
            bestGradeIdx = tempGradeIdx;
            bestSerialIdx = tempSerialIdx;
            bestStatusIdx = tempStatusIdx;
            bestGroupIdx = tempGroupIdx;
          }
        }

        if (bestHeaderRowIndex !== -1 && bestHeaderScore >= 2) {
          startIndex = bestHeaderRowIndex + 1;
          if (bestNameIdx !== -1) nameIndex = bestNameIdx;
          if (bestGenderIdx !== -1) genderIndex = bestGenderIdx;
          if (bestGradeIdx !== -1) gradeIndex = bestGradeIdx;
          if (bestSerialIdx !== -1) serialIndex = bestSerialIdx;
          if (bestStatusIdx !== -1) statusIndex = bestStatusIdx;
          if (bestGroupIdx !== -1) groupIndex = bestGroupIdx;
        } else {
          // If no row scored a match, default to index 0 and rely on statistical column-classification helper below
          startIndex = 0;
        }

        // Gather statistical counts for each column in the rows to auto-detect if indices are missing
        const colStats: Record<number, {
          isNumeric: number;
          isGender: number;
          isGrade: number;
          isStatus: number;
          isText: number;
          totalValid: number;
        }> = {};

        const testRowsLimit = Math.min(rows.length, startIndex + 15);
        for (let i = startIndex; i < testRowsLimit; i++) {
          const rowVals = rows[i];
          if (!rowVals || !Array.isArray(rowVals)) continue;
          for (let c = 0; c < rowVals.length; c++) {
            const cellVal = String(rowVals[c] ?? '').replace(/[\uFEFF\u200B]/g, '').trim();
            if (!cellVal) continue;

            if (!colStats[c]) {
              colStats[c] = { isNumeric: 0, isGender: 0, isGrade: 0, isStatus: 0, isText: 0, totalValid: 0 };
            }

            colStats[c].totalValid++;

            // If it is simple digits (Serial No / Index No), count it
            if (/^\d+$/.test(cellVal) && parseInt(cellVal, 10) < 150) {
              colStats[c].isNumeric++;
            }

            // If it is a gender indicator
            const cellLower = cellVal.toLowerCase();
            if (cellVal === 'ប្រុស' || cellVal === 'ស្រី' || cellVal === 'm' || cellVal === 'f' || cellLower === 'male' || cellLower === 'female' || cellVal.includes('ស្រី') || cellVal === 'M' || cellVal === 'F') {
              colStats[c].isGender++;
            }

            // If it is a status indicator
            if (cellVal === 'ធម្មតា' || cellVal === 'រៀនយឺត' || cellVal === 'បោះបង់' || cellLower === 'normal' || cellLower === 'slow' || cellLower === 'dropout') {
              colStats[c].isStatus++;
            }

            // If it is grade
            if (cellVal.includes('ថ្នាក់') || cellVal.includes('មត្តេយ្យ') || grades.includes(cellVal)) {
              colStats[c].isGrade++;
            }

            // General text (names are usually text greater than 1 char without numbers)
            if (cellVal.length >= 2 && !/^\d+$/.test(cellVal)) {
              colStats[c].isText++;
            }
          }
        }

        const allColumns = Object.keys(colStats).map(Number);

        // If the matched name index is actually a numeric serial column, reset it to inspect other columns
        if (nameIndex !== -1 && colStats[nameIndex] && colStats[nameIndex].isNumeric > colStats[nameIndex].isText) {
          nameIndex = -1;
        }

        // 1. Assign Gender column
        if (genderIndex === -1) {
          let maxGenderCount = 0;
          let bestGenderCol = -1;
          for (const c of allColumns) {
            if (colStats[c].isGender > maxGenderCount) {
              maxGenderCount = colStats[c].isGender;
              bestGenderCol = c;
            }
          }
          if (maxGenderCount > 0) {
            genderIndex = bestGenderCol;
          }
        }

        // 2. Assign Grade column
        if (gradeIndex === -1) {
          let maxGradeCount = 0;
          let bestGradeCol = -1;
          for (const c of allColumns) {
            if (c === genderIndex) continue;
            if (colStats[c].isGrade > maxGradeCount) {
              maxGradeCount = colStats[c].isGrade;
              bestGradeCol = c;
            }
          }
          if (maxGradeCount > 0) {
            gradeIndex = bestGradeCol;
          }
        }

        // 3. Assign Serial column
        if (serialIndex === -1) {
          let maxNumericCount = 0;
          let bestNumericCol = -1;
          for (const c of allColumns) {
            if (c === genderIndex || c === gradeIndex) continue;
            if (colStats[c].isNumeric > maxNumericCount) {
              maxNumericCount = colStats[c].isNumeric;
              bestNumericCol = c;
            }
          }
          if (maxNumericCount > 0) {
            serialIndex = bestNumericCol;
          }
        }

        // 4. Assign Status column
        if (statusIndex === -1) {
          let maxStatusCount = 0;
          let bestStatusCol = -1;
          for (const c of allColumns) {
            if (c === genderIndex || c === gradeIndex || c === serialIndex) continue;
            if (colStats[c].isStatus > maxStatusCount) {
              maxStatusCount = colStats[c].isStatus;
              bestStatusCol = c;
            }
          }
          if (maxStatusCount > 0) {
            statusIndex = bestStatusCol;
          }
        }

        // 5. Assign Name column
        if (nameIndex === -1) {
          let maxTextCount = 0;
          let bestNameCol = -1;
          for (const c of allColumns) {
            if (c === genderIndex || c === gradeIndex || c === serialIndex || c === statusIndex) continue;
            if (colStats[c].isText > maxTextCount) {
              maxTextCount = colStats[c].isText;
              bestNameCol = c;
            }
          }
          if (maxTextCount > 0) {
            nameIndex = bestNameCol;
          }
        }

        // Fallbacks if columns are completely empty / unresolved
        if (nameIndex === -1) {
          nameIndex = (serialIndex === 0) ? 1 : 0;
        }
        if (genderIndex === -1) {
          genderIndex = (nameIndex === 0) ? 1 : 2;
        }
        if (gradeIndex === -1) {
          gradeIndex = 3;
        }

        for (let i = startIndex; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !Array.isArray(row) || row.length === 0) continue;

          const rawName = String(row[nameIndex] ?? '')
            .replace(/[\uFEFF\u200B]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (!rawName) continue;

          // Skip if the parsed name is actually a header leftover or blank noise
          if (rawName === "ឈ្មោះ" || rawName === "ឈ្មោះសិស្ស" || rawName.toLowerCase() === "name" || rawName.includes("បឋមសិក្សា") || rawName.includes("បញ្ជីរាយនាម") || rawName === "ល.រ" || rawName === "លរ") {
            continue;
          }

          const rawGender = String(row[genderIndex] ?? '')
            .replace(/[\uFEFF\u200B]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          let rawGrade = String(row[gradeIndex] ?? '')
            .replace(/[\uFEFF\u200B]/g, '')
            .replace(/\s+/g, ' ')
            .trim() || selectedRosterGrade;

          // Standardize gender string
          let gender: 'ប្រុស' | 'ស្រី' = 'ប្រុស';
          if (rawGender === 'ស្រី' || rawGender === 'F' || rawGender === 'Female' || rawGender === 'female' || rawGender.includes('ស្រី') || rawGender.includes('ស្រ')) {
            gender = 'ស្រី';
          }

          // Validate grade setting with smart normalization (Khmer digits / spaces)
          let gradeVal = rawGrade;
          if (gradeVal === 'ទាំងអស់' || !grades.includes(gradeVal)) {
            const normRaw = normalizeGradeName(rawGrade);
            const matchedGrade = grades.find(g => normalizeGradeName(g) === normRaw);
            if (matchedGrade) {
              gradeVal = matchedGrade;
            } else {
              gradeVal = selectedRosterGrade !== 'ទាំងអស់' ? selectedRosterGrade : (grades[0] || 'ថ្នាក់ទី៦');
            }
          }

          // Role check: Teachers can only import into their own class/sections!
          if (currentUser?.role === 'teacher' && !teacherCanAccessGrade(gradeVal)) {
            rejectedTeacherCount++;
            continue;
          }

          // Check for duplication
          const isDuplicate = uniqueStudentProfiles.some(s => s.name.toLowerCase() === rawName.toLowerCase() && s.grade === gradeVal) 
            || newStudentsList.some(s => s.name.toLowerCase() === rawName.toLowerCase() && s.grade === gradeVal);

          if (isDuplicate) {
            duplicateCount++;
            continue;
          }

          // Parse status if present
          let statusVal: 'ធម្មតា' | 'រៀនយឺត' | 'បោះបង់' = 'ធម្មតា';
          if (statusIndex !== -1) {
            const rawStatus = String(row[statusIndex] ?? '').replace(/[\uFEFF\u200B]/g, '').trim();
            const rawStatusLower = rawStatus.toLowerCase();
            if (rawStatus.includes('យឺត') || rawStatusLower.includes('slow')) {
              statusVal = 'រៀនយឺត';
            } else if (rawStatus.includes('បោះ') || rawStatus.includes('បង់') || rawStatusLower.includes('drop') || rawStatusLower.includes('leave') || rawStatusLower.includes('left')) {
              statusVal = 'បោះបង់';
            }
          }

          // Parse group if present (after-hours classes)
          const groupVal = groupIndex !== -1
            ? String(row[groupIndex] ?? '').replace(/[﻿​]/g, '').trim() || undefined
            : undefined;

          // Add clean record with default score template
          const payload = {
            id: generateUniqueId(),
            name: rawName,
            gender: gender,
            grade: gradeVal,
            group: groupVal,
            status: statusVal,
            month: 'មេសា', // default fallback
            khmer: { listening: null, writing: null, reading: null, speaking: null },
            math: { numbers: null, measurement: null, geometry: null, algebra: null, statistics: null },
            science: null,
            socialStudies: null,
            physicalEducation: null,
            health: null,
            lifeSkills: null,
            foreignLanguage: null
          };

          newStudentsList.push(calculateStudentFields(payload));
          importCount++;
        }

        if (rejectedTeacherCount > 0) {
          alert(`លោកអ្នកគឺជាគ្រូបន្ទុកថ្នាក់ ដូច្នេះប្រព័ន្ធបានច្រានចោលសិស្សចំនួន ${rejectedTeacherCount} នាក់ដែលមិនស្ថិតក្នុង ${currentUser?.grade} របស់លោកអ្នក!`);
        }

        if (importCount > 0) {
          // Compute summary breakdown by class to notify the user
          const classCounts: Record<string, number> = {};
          newStudentsList.forEach(s => {
            classCounts[s.grade] = (classCounts[s.grade] || 0) + 1;
          });
          const summaryStr = Object.entries(classCounts)
            .map(([cl, count]) => `👉 ${cl} ៖ ចំនួន ${count} នាក់`)
            .join("\n");

          onSaveStudents([...students, ...newStudentsList]);
          alert(`បាននាំចូលសិស្សចំនួន ${importCount} នាក់ ពីក្នុងកុំព្យូទ័រដោយជោគជ័យ!\n\nថ្នាក់ដែលបានបញ្ចូលទៅក្នុង៖\n${summaryStr}${duplicateCount > 0 ? `\n\n(សិស្សជាន់គ្នាសម្រេចរំលងចំនួន ${duplicateCount} នាក់)` : ""}`);
        } else {
          // Beautiful diagnostic info for the user so they can instantly see why it failed!
          const diagnostics = [
            `📊 របាយការណ៍វិភាគបច្ចេកទេសនៃឯកសាររបស់លោកអ្នក៖`,
            `--------------------------------------------------`,
            `• ចំនួនជួរដេកសរុបក្នុងឯកសារ ៖ ${rows.length} ជួរ`,
            `• ជួរដេកចាប់ផ្ដើមអានទិន្នន័យសិស្ស (startIndex) ៖ ជួរទី ${startIndex + 1}`,
            `• ជួរឈរឈ្មោះសិស្ស (Name Column) ៖ ${nameIndex === -1 ? 'រកមិនឃើញ' : 'ជួរឈរទី ' + (nameIndex + 1)}`,
            `• ជួរឈរភេទ (Gender Column) ៖ ${genderIndex === -1 ? 'រកមិនឃើញ' : 'ជួរឈរទី ' + (genderIndex + 1)}`,
            `• ជួរឈរថ្នាក់រៀន (Grade Column) ៖ ${gradeIndex === -1 ? 'រកមិនឃើញ' : 'ជួរឈរទី ' + (gradeIndex + 1)}`,
            `• ចំនួនសិស្សជាន់គ្នាដែលប្រព័ន្ធសម្រេចរំលង (Is Duplicate) ៖ ${duplicateCount} នាក់`,
            `• ចំនួនសិស្សខុសថ្នាក់ដែលប្រព័ន្ធច្រានចោល (Wrong class for teachers) ៖ ${rejectedTeacherCount} នាក់`
          ].join("\n");

          alert(`មិនឃើញមានទិន្នន័យសិស្សថ្មីត្រូវបាននាំចូលទេ!\n\n${diagnostics}\n\n💡 ដំណោះស្រាយ៖ សូមប្រាកដថាឯកសាររបស់អ្នកមានឈ្មោះជួរឈរច្បាស់លាស់ (ល.រ, ឈ្មោះសិស្ស, ភេទ, ថ្នាក់, ស្ថានភាព) ហើយឈ្មោះសិស្សថ្មីទាំងនោះមិនទាន់មាននៅក្នុងប្រព័ន្ធនៅឡើយទេ។`);
        }
      } catch (err) {
        console.error(err);
        alert("ការនាំចូលបានបរាជ័យ! សូមពិនិត្យមើលថាឯកសារនោះពិតជាប្រភេទ Excel (.xlsx) ឬ CSV ត្រឹមត្រូវ។");
      }
    };

    if (isCsv) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
    e.target.value = '';
  };

  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Assigned teacher of the current viewing roster
  const activeTeacherInfo = useMemo(() => {
    return getTeacherForGrade(selectedRosterGrade);
  }, [selectedRosterGrade, currentUser]);

  return (
    <div className="space-y-6">
      {/* Class-category selector (general / extra) — scopes every card, list & dropdown below */}
      {currentUser?.role !== 'teacher' && (
        <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-2xl shadow-3xs border border-slate-200 w-full">
          <button
            onClick={() => {
              setClassCategory('general');
              setSelectedRosterGrade(grades.find(g => !isExtraClass(g)) || 'ទាំងអស់');
              setStudentSearch('');
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${classCategory === 'general' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {t('dash.cat.general')}
          </button>
          <button
            onClick={() => {
              setClassCategory('extra');
              setSelectedRosterGrade(grades.find(g => isExtraClass(g)) || 'ទាំងអស់');
              setStudentSearch('');
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${classCategory === 'extra' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {t('dash.cat.extra')}
          </button>
        </div>
      )}

      {/* Overview stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-3xs border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold">
            <GraduationCap size={24} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">{t('cls.stat.classes')}</span>
            <span className="text-2xl font-black text-slate-800 font-sans tracking-tight">{categoryGrades.length} {t('common.classesUnit')}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-3xs border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
            <Users size={24} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">{t('cls.stat.students')}</span>
            <span className="text-2xl font-black text-slate-800 font-sans tracking-tight">{totalStudents} {t('common.persons')}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-3xs border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold text-lg font-sans">
            ស្រី
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">{t('cls.stat.female')}</span>
            <span className="text-2xl font-black text-slate-800 font-sans tracking-tight">{femaleStudents} {t('common.persons')}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-3xs border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold text-lg font-sans">
            ប្រុស
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">{t('cls.stat.male')}</span>
            <span className="text-2xl font-black text-slate-800 font-sans tracking-tight">{maleStudents} {t('common.persons')}</span>
          </div>
        </div>
      </div>

      {/* Main Tab selectors controller */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Header navigation bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-xl w-fit text-xs font-semibold text-slate-600">
            <button
              onClick={() => setActiveTab('students')}
              className={`px-4 py-2 rounded-lg transition-all ${
                activeTab === 'students' 
                  ? 'bg-white text-slate-850 shadow-xs scale-100 font-bold' 
                  : 'hover:text-slate-800'
              }`}
            >
              {t('cls.tab.students')} ({uniqueStudentProfiles.filter(s => inCat(s.grade)).length})
            </button>
            <button
              id="tab_class_listings"
              onClick={() => setActiveTab('classes')}
              className={`px-4 py-2 rounded-lg transition-all ${
                activeTab === 'classes' 
                  ? 'bg-white text-slate-850 shadow-xs scale-100 font-bold' 
                  : 'hover:text-slate-800'
              }`}
            >
              {t('cls.tab.classes')} ({categoryGrades.length})
            </button>
          </div>

          <p className="text-[11px] text-slate-400 font-medium font-sans bg-slate-100 py-1 px-2.5 rounded-lg border border-slate-200 flex items-center gap-1.5">
            <School size={12} className="text-slate-500" />
            Cambodia Community School Platform
          </p>
        </div>

        <div className="p-6">
          {/* Tab 1: Manage Classes Tab */}
          {activeTab === 'classes' && (
            <div className="space-y-6">
              {currentUser?.role === 'teacher' && (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3 text-xs text-amber-700">
                  <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                  <div className="space-y-1">
                    <p className="font-extrabold flex items-center gap-1">{t('cls.readonly.title')}</p>
                    <p className="leading-relaxed text-[11px] font-medium">
                      លោកអ្នកកំពុងតភ្ជាប់ជា <span className="font-bold">{t('cls.classTeacher')}</span>។ លោកអ្នកអាចត្រឹមតែពិនិត្យមើលបញ្ជីថ្នាក់រៀន និងស្ថិតិសិស្សបានប៉ុណ្ណោះ។ មានតែ <span className="font-bold">{t('cls.principal')}</span> ប៉ុណ្ណោះដែលអាចបង្កើត កែប្រែ ឬលុបថ្នាក់រៀនបាន។
                    </p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Form to insert new class */}
                <div className="lg:col-span-1 border border-indigo-100 bg-indigo-50/10 p-5 rounded-2xl space-y-4">
                  {currentUser?.role === 'teacher' ? (
                    <div className="space-y-3">
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <AlertTriangle size={16} className="text-amber-500" />
                        ការបញ្ជាក់អំពីសិទ្ធិ
                      </h3>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                        គណនីគ្រូបន្ទុកថ្នាក់ មិនមានសិទ្ធិបង្កើត ឬកែប្រែថ្នាក់រៀនបានឡើយ។ មានតែគណនីនាយកសាលា ទើបអាចគ្រប់គ្រងព័ត៌មានរចនាសម្ព័ន្ធថ្នាក់រៀនទាំងនេះបាន។
                      </p>
                      <div className="h-px bg-slate-100" />
                      <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-[10px] text-indigo-700 leading-relaxed space-y-1">
                        <span className="font-bold">{t('cls.allowed')}</span>
                        <p>{t('cls.readonly.desc')}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <Plus size={16} className="text-indigo-600" />
                        {t('cls.form.newClass')}
                      </h3>
                      
                      <form onSubmit={handleAddClassLocal} className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">{t('cls.form.className')}</label>
                          <input
                            type="text"
                            required
                            value={newClassName}
                            onChange={(e) => setNewClassName(e.target.value)}
                            placeholder="ឧ. ថ្នាក់ទី៦អា, ថ្នាក់ទី៧..."
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-medium text-slate-800"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full bg-indigo-600 text-white font-semibold py-2 rounded-lg text-xs leading-none hover:bg-indigo-700 transition-colors shadow-xs"
                        >
                          {t('cls.form.addClass')}
                        </button>
                      </form>

                      <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-1 text-[11px] text-indigo-700 leading-relaxed">
                        <div className="font-bold flex items-center gap-1"><Info size={12} />ការណែនាំ៖</div>
                        <p>{t('cls.classNameHelp')}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Display current classes/grades with students statistics */}
                <div className="lg:col-span-2 space-y-3">
                  <h3 className="font-bold text-slate-800 text-sm">{t('cls.currentClasses')}</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto p-1 text-xs">
                    {categoryGrades.map((g) => {
                      const stats = gradeStats[g] || { total: 0, female: 0, male: 0 };
                      const isEditingThis = editingClassName === g;

                      return (
                        <div 
                          key={g} 
                          className="p-4 bg-white border border-slate-150 rounded-xl shadow-3xs flex flex-col justify-between gap-3 hover:border-slate-300 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            {isEditingThis ? (
                              <div className="flex items-center gap-1 w-full max-w-[120px]">
                                <input
                                  type="text"
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  className="px-2 py-1 text-xs border border-indigo-300 rounded outline-none w-full font-bold"
                                />
                                <button
                                  onClick={() => handleSaveRenameClass(g)}
                                  className="p-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => setEditingClassName(null)}
                                  className="p-1 bg-slate-50 text-slate-400 hover:text-slate-600 rounded"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                                📚 {g}
                              </span>
                            )}

                            {currentUser?.role !== 'teacher' ? (
                              <div className="flex items-center gap-1">
                                {!isEditingThis && (
                                  <button
                                    onClick={() => handleStartRenameClass(g)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-50"
                                    title="កែឈ្មោះថ្នាក់"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                )}
                                <button
                                  onClick={() => onDeleteGrade(g)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-50"
                                  title="លុបថ្នាក់"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-450 text-slate-400 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5">
                                មើលតែប៉ុណ្ណោះ
                              </span>
                            )}
                          </div>

                          <div className="space-y-1.5 pt-2 border-t border-slate-50">
                            <div className="flex justify-between items-center text-slate-500 text-[11px]">
                              <span>{t('cls.totalStudents')}</span>
                              <span className="font-black text-slate-700">{stats.total} នាក់</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-400 text-[10px]">
                              <span>ស្រី៖ <strong className="text-emerald-600 font-bold">{stats.female} នាក់</strong></span>
                              <span>ប្រុស៖ <strong className="text-slate-600 font-bold">{stats.male} នាក់</strong></span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Tab 2: Manage Student Roster with Teacher Info & Excel operations inside */}
          {activeTab === 'students' && (
            <div className="space-y-6">
              {currentUser?.role === 'teacher' && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3 text-xs text-blue-700 animate-fadeIn">
                  <Info className="text-blue-500 shrink-0 mt-0.5" size={16} />
                  <div className="space-y-1">
                    <p className="font-extrabold flex items-center gap-1">{t('cls.classroomMode')}</p>
                    <p className="leading-relaxed text-[11px] font-medium">
                      លោកអ្នកកំពុងតភ្ជាប់ជា <span className="font-bold">«គ្រូបន្ទុកថ្នាក់ {currentUser.grade}»</span>។ លោកអ្នកមានសិទ្ធពេញលេញក្នុងការកែសម្រួល និងលុបឈ្មោះសិស្សានុសិស្ស ក៏ដូចជាកែប្រែព័ត៌មានគ្រូ និងសិស្សនៅក្នុង <span className="font-bold">{currentUser.grade}</span> របស់លោកអ្នកផ្ទាល់។ (ការចុះឈ្មោះសិស្សថ្មី តម្រូវឱ្យនាយកជាអ្នកបញ្ចូល)
                    </p>
                  </div>
                </div>
              )}
              
              {/* TWO COLUMN GRID : LEFT (Student List & excel buttons) / RIGHT (Teacher Profile Details & Stats) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* COLUMN 1 & Column 2: Student Filter, List & CSV integration buttons */}
                <div className="lg:col-span-2 space-y-4">
                  
                  {/* CSV import/export control bar */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <FileSpreadsheet size={16} className="text-emerald-600" />
                        {t('cls.io.title')}
                      </span>
                      <p className="text-slate-400 text-[10px] leading-relaxed">
                        អ្នកអាចទាញយកឈ្មោះសិស្សបច្ចុប្បន្នទុកជាឯកសារ Excel {currentUser?.role === 'principal' ? 'ឬបញ្ចូលឯកសារសិស្សថ្មីពីកុំព្យូទ័ររបស់អ្នក។' : '។'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleExportCSV(false)}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg font-semibold transition-all inline-flex items-center gap-1 shadow-3xs"
                        title="ទាញយកបញ្ជីឈ្មោះជាទម្រង់ excel"
                      >
                        <Download size={13} />
                        {t('cls.io.downloadList')}
                      </button>

                      {currentUser?.role === 'principal' && (
                        <button
                          onClick={handleTriggerFileInput}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80 rounded-lg font-semibold transition-all inline-flex items-center gap-1 shadow-3xs"
                          title="បញ្ចូលបញ្ជីឈ្មោះពីកុំព្យូទ័ររបស់អ្នក"
                        >
                          <Upload size={13} />
                          {t('cls.io.import')}
                        </button>
                      )}

                      {/* Hidden File input selector */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportCSV}
                        accept=".csv, .xlsx, .xls"
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* Filter and dynamic roster count controls */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-150">
                    <div className="flex items-center gap-2 flex-wrap text-slate-700">
                      <span className="text-xs font-bold text-slate-600">ថ្នាក់៖{isTeacher && !isExtraTeacher && ' 🔒'}</span>
                      <select
                        value={selectedRosterGrade}
                        onChange={(e) => setSelectedRosterGrade(e.target.value)}
                        disabled={isTeacher && !isExtraTeacher}
                        className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-blue-500 font-semibold disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                      >
                        {isTeacher ? (
                          // General teacher → only their class; extra teacher → their subject's sections.
                          teacherGradeOptions.map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))
                        ) : (
                          <>
                            <option value="ទាំងអស់">{t('cls.allClasses')}</option>
                            {categoryGrades.map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </>
                        )}
                      </select>

                      {/* Group filter — only for after-hours classes that have groups. */}
                      {classCategory === 'extra' && availableGroups.length > 0 && (
                        <>
                          <span className="text-xs font-bold text-slate-600">{t('cls.groupLabel')}</span>
                          <select
                            value={selectedGroup}
                            onChange={(e) => setSelectedGroup(e.target.value)}
                            className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-indigo-700 outline-none focus:border-blue-500 font-semibold"
                          >
                            <option value="ទាំងអស់">{t('cls.allGroups')}</option>
                            {availableGroups.map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </>
                      )}

                      <div className="relative">
                        <input
                          type="text"
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                          placeholder={t('cls.search')}
                          className="pl-7 pr-3.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 outline-none focus:border-blue-500 text-xs font-medium"
                        />
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                      </div>
                      <button
                        onClick={() => setSortOrder(prev => prev === 'default' ? 'asc' : prev === 'asc' ? 'desc' : 'default')}
                        className={`px-2.5 py-1 flex items-center justify-center gap-1 border rounded-lg text-xs font-semibold transition-all ${
                          sortOrder !== 'default' 
                            ? 'bg-blue-50 text-blue-700 border-blue-200' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                        title="រៀបតាមលំដាប់អក្សរឈ្មោះ"
                      >
                        <ArrowUpDown size={12} />
                        {sortOrder === 'asc' ? 'ក-អ' : sortOrder === 'desc' ? 'អ-ក' : 'លំដាប់លេខ'}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {selectedRosterGrade !== 'ទាំងអស់' ? (
                        currentUser?.role === 'principal' && (
                          <>
                            <button
                              onClick={handleAddSampleStudents}
                              className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/50 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1"
                            >
                              {t('cls.addSample')}
                            </button>

                            <button
                              onClick={handleClearAllStudentsInActiveGrade}
                              className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/50 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1"
                              title="លុបសិស្សទាំងអស់ក្នុងថ្នាក់រៀននេះ"
                            >
                              🗑️ លុបសិស្សទាំងអស់
                            </button>
                          </>
                        )
                      ) : (
                        currentUser?.role === 'principal' && (
                          <button
                            onClick={handleClearAllStudentsGlobally}
                            className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/50 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1"
                            title="លុបឈ្មោះសិស្សទាំងអស់គ្នាក្នុងសាលា"
                          >
                            🗑️ លុបសិស្សទាំងអស់គ្នាក្នុងសាលា
                          </button>
                        )
                      )}

                      {selectedRosterGrade !== 'ទាំងអស់' && selectedGroup !== 'ទាំងអស់' && canManageStudents(selectedRosterGrade) && (
                        <button
                          onClick={handleClearGroupInActiveGrade}
                          className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/50 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1"
                          title={`លុបសិស្សក្នុងក្រុម ${selectedGroup}`}
                        >
                          🗑️ លុបក្រុម {selectedGroup}
                        </button>
                      )}

                      {canManageStudents(selectedRosterGrade) && (
                        <button
                          onClick={handleOpenAddStudent}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1 shadow-2xs"
                        >
                          <UserPlus size={12} />
                          ចុះឈ្មោះសិស្ស
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Helper option to export sample blank Excel/CSV template */}
                  <div className="flex items-center justify-between px-3 text-[11px] text-slate-400 bg-slate-50/50 py-1.5 rounded-lg border border-slate-100 leading-none">
                    <span>{t('cls.importHint')}</span>
                    <button
                      onClick={() => handleExportCSV(true)}
                      className="text-blue-600 hover:underline font-bold"
                    >
                      {t('cls.io.downloadTemplate')}
                    </button>
                  </div>

                  {/* Student registration form (pop over modal-like) */}
                  {isStudentFormOpen && (
                    <div className="p-4 border border-blue-50 bg-blue-50/10 rounded-xl space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between pb-1.5 border-b border-blue-100/50">
                        <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                          <UserPlus size={14} className="text-blue-600" />
                          {editingStudentId ? 'កែសម្រួលព័ត៌មានផ្ទាល់ខ្លួនរបស់សិស្ស' : 'ចុះឈ្មោះសិស្សថ្មីចូលរៀន'}
                        </h4>
                        <button onClick={() => setIsStudentFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                          <X size={14} />
                        </button>
                      </div>

                      {/* Import/Download Excel template helpers inside student registration */}
                      {!editingStudentId && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white rounded-lg border border-blue-100 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1 text-slate-650 font-medium">
                            <FileSpreadsheet size={13} className="text-emerald-600 animate-pulse" /> 
                            ទាញយកគំរូ ឬចុចនាំចូលបញ្ជីសិស្សពី Excel (.csv) ៖
                          </span>
                          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            <button
                              type="button"
                              onClick={() => handleExportCSV(true)}
                              className="text-indigo-600 hover:underline font-bold flex items-center gap-0.5"
                            >
                              <Download size={11} /> {t('cls.io.downloadTemplate')}
                            </button>
                            {currentUser?.role === 'principal' && (
                              <>
                                <span className="text-slate-350">|</span>
                                <button
                                  type="button"
                                  onClick={handleTriggerFileInput}
                                  className="text-emerald-700 hover:underline font-bold flex items-center gap-0.5"
                                >
                                  <Upload size={11} /> នាំចូលពី Excel
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      <form onSubmit={handleSaveStudentSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-medium">
                        <div>
                          <label className="block text-slate-500 mb-1">{t('common.studentName')}</label>
                          <input
                            type="text"
                            required
                            value={studentFormName}
                            onChange={(e) => setStudentFormName(e.target.value)}
                            placeholder="ឧ. សួង ចណ្ដា"
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-500 mb-1">{t('common.gender')}</label>
                          <select
                            value={studentFormGender}
                            onChange={(e) => setStudentFormGender(e.target.value as 'ប្រុស' | 'ស្រី')}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                          >
                            <option value="ប្រុស">{t('common.male')}</option>
                            <option value="ស្រី">{t('common.female')}</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-500 mb-1">{t('cls.col.class')}</label>
                          <select
                            disabled={currentUser?.role === 'teacher'}
                            value={studentFormGrade}
                            onChange={(e) => setStudentFormGrade(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white disabled:bg-slate-50 disabled:text-slate-400 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                          >
                            {categoryGrades.map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-500 mb-1">{t('cls.col.status')}</label>
                          <select
                            value={studentFormStatus}
                            onChange={(e) => setStudentFormStatus(e.target.value as 'ធម្មតា' | 'រៀនយឺត' | 'បោះបង់')}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                          >
                            <option value="ធម្មតា">{t('cls.status.normal')}</option>
                            <option value="រៀនយឺត">{t('cls.status.slow')}</option>
                            <option value="បោះបង់">{t('cls.status.dropout')}</option>
                          </select>
                        </div>

                        {/* Group — only for after-hours classes, which split each class into groups. */}
                        {isExtraClass(studentFormGrade) && (
                          <div>
                            <label className="block text-slate-500 mb-1">{t('cls.form.group')}</label>
                            <input
                              type="text"
                              value={studentFormGroup}
                              onChange={(e) => setStudentFormGroup(e.target.value)}
                              placeholder="ឧ. ក្រុម ១, A, ..."
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-slate-500 mb-1">អត្តលេខ</label>
                          <input type="text" value={studentFormId} onChange={(e) => setStudentFormId(e.target.value)} placeholder="ឧ. 1004" className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">ថ្ងៃខែឆ្នាំកំណើត</label>
                          <input type="text" value={studentFormDob} onChange={(e) => setStudentFormDob(e.target.value)} placeholder="ថ្ងៃ/ខែ/ឆ្នាំ" className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">ឈ្មោះឪពុក</label>
                          <input type="text" value={studentFormFather} onChange={(e) => setStudentFormFather(e.target.value)} placeholder="ឈ្មោះឪពុក" className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">ឈ្មោះម្តាយ</label>
                          <input type="text" value={studentFormMother} onChange={(e) => setStudentFormMother(e.target.value)} placeholder="ឈ្មោះម្តាយ" className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-slate-500 mb-1">អាសយដ្ឋាន</label>
                          <input type="text" value={studentFormAddress} onChange={(e) => setStudentFormAddress(e.target.value)} placeholder="ភូមិ ឃុំ ស្រុក ខេត្ត" className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-slate-500 mb-1">លេខទំនាក់ទំនង</label>
                          <input type="text" value={studentFormPhone} onChange={(e) => setStudentFormPhone(e.target.value)} placeholder="ឧ. 012 345 678" className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
                        </div>

                        <div className="sm:col-span-4 pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setIsStudentFormOpen(false)}
                            className="px-3 py-1.5 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-lg font-bold"
                          >
                            បោះបង់
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs whitespace-nowrap"
                          >
                            {editingStudentId ? 'កែប្រែ' : 'ចុះឈ្មោះសិស្ស'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Roster profiles student directory listings */}
                  <div className="overflow-x-auto border border-slate-150 rounded-xl bg-white shadow-3xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-500">
                          <th className="px-4 py-3 text-center sticky left-0 z-10 bg-slate-50 shadow-[3px_0_5px_-2px_rgba(0,0,0,0.08)] w-12">ល.រ</th>
                          <th className="px-4 py-3 text-center whitespace-nowrap">អត្តលេខ</th>
                          <th className="px-4 py-3 whitespace-nowrap">{t('common.studentName')}</th>
                          <th className="px-4 py-3 text-center">{t('common.gender')}</th>
                          <th className="px-4 py-3 text-center">{t('cls.col.class')}</th>
                          {classCategory === 'extra' && <th className="px-4 py-3 text-center">{t('cls.col.group')}</th>}
                          <th className="px-4 py-3 text-center whitespace-nowrap">ថ្ងៃខែឆ្នាំកំណើត</th>
                          <th className="px-4 py-3 text-center">{t('cls.col.status')}</th>
                          <th className="px-4 py-3 text-right">{t('common.action')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-slate-700">
                        {filteredProfiles.length > 0 ? (
                          filteredProfiles.map((p, index) => {
                            return (
                              <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 text-center sticky left-0 z-10 bg-white shadow-[3px_0_5px_-2px_rgba(0,0,0,0.08)]">
                                  <span className="w-7 h-7 bg-indigo-50 text-indigo-650 rounded-full inline-flex items-center justify-center font-sans font-black text-[11px] border border-indigo-100">
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center font-sans text-slate-700 whitespace-nowrap">{resolvedId(p) || <span className="text-slate-300">-</span>}</td>
                                <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">{p.name}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    p.gender === 'ស្រី'
                                      ? 'bg-rose-50 border border-pink-100 text-rose-600'
                                      : 'bg-blue-50 border border-blue-100 text-blue-600'
                                  }`}>
                                    {p.gender}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center font-sans font-bold text-slate-500">{p.grade}</td>
                                {classCategory === 'extra' && (
                                  <td className="px-4 py-3 text-center font-bold text-indigo-600">
                                    {p.group ? <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-50 border border-indigo-100">{p.group}</span> : <span className="text-slate-300">-</span>}
                                  </td>
                                )}
                                <td className="px-4 py-3 text-center text-slate-600 whitespace-nowrap">{resolvedDob(p) || <span className="text-slate-300">-</span>}</td>
                                <td className="px-4 py-3 text-center">
                                  {p.status === 'រៀនយឺត' ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-105 text-amber-700">
                                      រៀនយឺត
                                    </span>
                                  ) : p.status === 'បោះបង់' ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 border border-rose-105 text-rose-700">
                                      បោះបង់
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-105 text-emerald-700">
                                      ធម្មតា
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {canManageStudents(p.grade) ? (
                                    <div className="flex items-center justify-end gap-1.5 animate-fadeIn">
                                      <button
                                        onClick={() => handleOpenEditStudent(p)}
                                        className="p-1 px-2 border border-slate-200 rounded hover:bg-indigo-50/20 text-indigo-750 hover:text-indigo-850 hover:border-indigo-120 transition-colors font-semibold inline-flex items-center gap-1 text-[10px]"
                                      >
                                        <Edit3 size={11} className="text-indigo-650" /> កែប្រែ
                                      </button>
                                      <button
                                        onClick={() => handleDeleteStudentProfile(p)}
                                        className="p-1 text-rose-550 border border-transparent rounded hover:bg-rose-50 hover:border-rose-100 text-rose-500 transition-colors font-semibold inline-flex items-center"
                                        title="លុបសិស្ស"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded px-2 py-1 select-none">
                                      មើលតែប៉ុណ្ណោះ
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={classCategory === 'extra' ? 9 : 8} className="px-4 py-12 text-center text-slate-400 font-medium">
                              <AlertTriangle size={32} className="mx-auto text-amber-500 mb-2" />
                              គ្មានគណនីសិស្សដែលស្វែងរកក្នុង {selectedRosterGrade !== 'ទាំងអស់' ? selectedRosterGrade : 'ប្រព័ន្ធ'} ឡើយ។
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                </div>

                {/* COLUMN 3: Teacher Information Widget & Classroom Status Widget */}
                <div className="lg:col-span-1 space-y-5">
                  
                  {/* Teacher Account Information Card (ព័ត៌មានគ្រូ) */}
                  <div className="bg-white border border-slate-150 rounded-2xl shadow-3xs p-5 space-y-4">
                    <div className="pb-3 border-b border-slate-100">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block mb-0.5">{t('cls.teacherInfo')}</span>
                      <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                        👤 គ្រូបន្ទុកថ្នាក់ទទួលខុសត្រូវ
                      </h3>
                    </div>

                    <div className="flex items-start gap-3.5">
                      <div className={`w-12 h-12 ${activeTeacherInfo.avatarBg} text-white font-black text-lg rounded-xl flex items-center justify-center shadow-sm shrink-0`}>
                        {activeTeacherInfo.avatarText}
                      </div>
                      
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-800 text-xs leading-tight">{activeTeacherInfo.name}</h4>
                        <span className="px-2 py-0.5 font-bold text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full inline-block">
                          {activeTeacherInfo.role}
                        </span>
                        
                        {/* Classroom badge */}
                        <p className="text-[11px] text-slate-405 text-slate-500 pt-1 font-semibold">
                          ថ្នាក់៖ <strong className="text-slate-800">{selectedRosterGrade}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-550/10 bg-slate-50 rounded-xl space-y-1 text-[11px] text-slate-600 leading-relaxed">
                      <p className="font-medium">
                        {activeTeacherInfo.desc}
                      </p>
                    </div>

                    {/* Active educator login indicator details if available */}
                    {currentUser && (
                      <div className="text-[10px] bg-indigo-50/50 border border-indigo-100/30 p-2.5 rounded-lg flex flex-col gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <span className="text-slate-500 font-medium">អ្នកកំពុងភ្ជាប់ក្នុងប្រព័ន្ធជា៖ <strong>{currentUser.name}</strong> ({currentUser.role === 'principal' ? 'នាយក' : 'គ្រូ'}) </span>
                        </div>
                        
                        {/* Edit teacher button if principal */}
                        {currentUser?.role === 'principal' && (
                          <button
                            onClick={handleOpenEditTeacher}
                            className="w-full mt-1.5 py-1.5 px-3 bg-white hover:bg-slate-50 text-indigo-750 hover:text-indigo-850 border border-slate-200 hover:border-slate-300 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                            title="កែសម្រួលប្រវត្តិរូប និងព័ត៌មានរបស់លោកគ្រូ-អ្នកគ្រូ"
                            type="button"
                          >
                            <Edit3 size={11} className="text-indigo-600" />
                            កែប្រែព័ត៌មានគ្រូ
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Classroom Status Detail Card (ព័ត៌មានថ្នាក់រៀន) */}
                  <div className="bg-white border border-slate-150 rounded-2xl shadow-3xs p-5 space-y-4">
                    <div className="pb-3 border-b border-slate-100">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-0.5">{t('cls.classStats')}</span>
                      <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                        📊 ស្ថានភាពថ្នាក់៖ {selectedRosterGrade}
                      </h3>
                    </div>

                    {/* Dynamically calculated stats for current grade */}
                    {(() => {
                      const activeGrade = selectedRosterGrade;
                      const hasSpecificGrade = activeGrade !== 'ទាំងអស់';
                      
                      let totalInCurrent = 0;
                      let femaleInCurrent = 0;
                      let maleInCurrent = 0;

                      if (hasSpecificGrade) {
                        const gradeProfiles = uniqueStudentProfiles.filter(s => s.grade === activeGrade);
                        totalInCurrent = gradeProfiles.length;
                        femaleInCurrent = gradeProfiles.filter(s => s.gender === 'ស្រី').length;
                        maleInCurrent = gradeProfiles.filter(s => s.gender === 'ប្រុស').length;
                      } else {
                        totalInCurrent = uniqueStudentProfiles.length;
                        femaleInCurrent = uniqueStudentProfiles.filter(s => s.gender === 'ស្រី').length;
                        maleInCurrent = uniqueStudentProfiles.filter(s => s.gender === 'ប្រុស').length;
                      }

                      const femalePct = totalInCurrent > 0 ? Math.round((femaleInCurrent / totalInCurrent) * 100) : 0;
                      const malePct = totalInCurrent > 0 ? Math.round((maleInCurrent / totalInCurrent) * 100) : 0;

                      return (
                        <div className="space-y-3.5 text-xs">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-slate-50 p-2.5 rounded-xl text-center">
                              <span className="text-[10px] font-semibold text-slate-400 block mb-1">{t('common.total')}</span>
                              <strong className="text-slate-800 font-sans text-sm font-black">{totalInCurrent} នាក់</strong>
                            </div>
                            <div className="bg-rose-50/50 p-2.5 rounded-xl text-center">
                              <span className="text-[10px] font-semibold text-slate-40 block mb-1 text-slate-400">{t('cls.footFemale')}</span>
                              <strong className="text-rose-600 font-sans text-sm font-black">{femaleInCurrent} នាក់</strong>
                            </div>
                            <div className="bg-blue-50/50 p-2.5 rounded-xl text-center">
                              <span className="text-[10px] font-semibold text-slate-400 block mb-1">{t('cls.footMale')}</span>
                              <strong className="text-blue-600 font-sans text-sm font-black">{maleInCurrent} នាក់</strong>
                            </div>
                          </div>

                          {/* Dynamic Progress indicator showing proportion */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex justify-between font-bold text-[10px] text-slate-400">
                              <span>សមាមាត្រសិស្សស្រី ({femalePct}%)</span>
                              <span>សមាមាត្រសិស្សប្រុស ({malePct}%)</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                              <div 
                                className="bg-rose-500 rounded-l h-full" 
                                style={{ width: `${femalePct}%` }}
                              />
                              <div 
                                className="bg-blue-500 rounded-r h-full" 
                                style={{ width: `${malePct}%` }}
                              />
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100 space-y-2 text-[11px] text-slate-500 font-semibold font-sans">
                            <div className="flex justify-between items-center">
                              <span>{t('cls.academicYear')}</span>
                              <span className="text-slate-800">២០២៥ - ២០២៦</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>{t('cls.org')}</span>
                              <span className="text-slate-800">{t('cls.orgName')}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                  </div>

                </div>

              </div>

            </div>
          )}

          {/* Teacher Editor Modal overlay */}
          {isEditingTeacher && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
              <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-2xl w-full max-w-md space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                    📝 កែប្រែព័ត៌មានគ្រូ ({teacherEditGrade === 'principal' ? 'នាយកសាលា' : teacherEditGrade})
                  </span>
                  <button 
                    type="button"
                    onClick={() => setIsEditingTeacher(false)} 
                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-650 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSaveTeacherLocal} className="space-y-4 text-xs font-semibold">
                  <div>
                    <label className="block text-slate-500 mb-1">{t('cls.teacherNameLabel')}</label>
                    <input
                      type="text"
                      required
                      value={teacherEditName}
                      onChange={(e) => setTeacherEditName(e.target.value)}
                      placeholder="ឧ. លោកគ្រូ សុខ វិបុល"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-800 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">{t('cls.bioLabel')}</label>
                    <textarea
                      required
                      rows={3}
                      value={teacherEditDesc}
                      onChange={(e) => setTeacherEditDesc(e.target.value)}
                      placeholder="ឧ. គ្រូបន្ទុកថ្នាក់បង្រៀន និងគ្រប់គ្រងសិស្ស..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-800 font-medium leading-relaxed"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 font-bold">
                    <button
                      type="button"
                      onClick={() => setIsEditingTeacher(false)}
                      className="px-3 py-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-lg"
                    >
                      បោះបង់
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                    >
                      រក្សាទុកព័ត៌មាន
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
