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
  School
} from 'lucide-react';
import { StudentScore, SchoolUser } from '../types';
import { calculateStudentFields, generateUniqueId } from '../mockData';

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
  const [selectedRosterGrade, setSelectedRosterGrade] = useState<string>(
    currentUser?.role === 'teacher' ? currentUser.grade : (grades[0] || 'ថ្នាក់ទី៦')
  );

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

  // Stats calculation
  const totalStudents = students.length;
  const femaleStudents = students.filter(s => s.gender === 'ស្រី').length;
  const maleStudents = students.filter(s => s.gender === 'ប្រុស').length;
  
  // Dynamic map count of students per grade
  const gradeStats = useMemo(() => {
    const stats: Record<string, { total: number; female: number; male: number }> = {};
    grades.forEach(g => {
      stats[g] = { total: 0, female: 0, male: 0 };
    });
    students.forEach(s => {
      if (stats[s.grade]) {
        stats[s.grade].total += 1;
        if (s.gender === 'ស្រី') stats[s.grade].female += 1;
        else stats[s.grade].male += 1;
      }
    });
    return stats;
  }, [grades, students]);

  // Unique list of unique student profiles (since they may have records across multiple months, unique by Name & Grade)
  const uniqueStudentProfiles = useMemo(() => {
    const map = new Map<string, StudentScore>();
    students.forEach(s => {
      const key = `${s.name.trim()}_${s.grade}`;
      if (!map.has(key)) {
        map.set(key, s);
      }
    });
    return Array.from(map.values());
  }, [students]);

  // Filter students profile list
  const filteredProfiles = useMemo(() => {
    let list = uniqueStudentProfiles;
    
    if (selectedRosterGrade !== 'ទាំងអស់') {
      list = list.filter(s => s.grade === selectedRosterGrade);
    }
    
    if (studentSearch.trim()) {
      const query = studentSearch.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(query));
    }
    
    return list;
  }, [uniqueStudentProfiles, selectedRosterGrade, studentSearch]);

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
    setIsStudentFormOpen(true);
  };

  const handleOpenEditStudent = (profile: StudentScore) => {
    setEditingStudentId(profile.id);
    setStudentFormName(profile.name);
    setStudentFormGender(profile.gender);
    setStudentFormGrade(profile.grade);
    setIsStudentFormOpen(true);
  };

  const handleSaveStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role === 'teacher') {
      if (studentFormGrade !== currentUser.grade) {
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
              grade: studentFormGrade
            };
            return calculateStudentFields(payload);
          }
          return s;
        });
        onSaveStudents(updated);
        alert('បានធ្វើបច្ចុប្បន្នភាពព័ត៌មានសិស្សដោយជោគជ័យ ចំពោះគ្រប់ខែសិក្សាទាំងអស់!');
      }
    } else {
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
        month: 'មេសា',
        khmer: { listening: 0, writing: 0, reading: 0, speaking: 0 },
        math: { numbers: 0, measurement: 0, geometry: 0, algebra: 0, statistics: 0 },
        science: 0,
        socialStudies: 0,
        physicalEducation: 0,
        health: 0,
        lifeSkills: 0,
        foreignLanguage: 0
      };
      
      const updated = [...students, calculateStudentFields(payload)];
      onSaveStudents(updated);
      alert(`បានចុះឈ្មោះសិស្សថ្មី «${name}» ចូលក្នុងប្រព័ន្ធសម្រាប់ «មេសា»! អ្នកអាចបញ្ចូលពិន្ទុបន្ថែមក្នុងសៀវភៅពិន្ទុ។`);
    }

    setIsStudentFormOpen(false);
  };

  const handleDeleteStudentProfile = (profile: StudentScore) => {
    if (currentUser?.role === 'teacher') {
      if (profile.grade !== currentUser.grade) {
        alert(`លោកអ្នកមានសិទ្ធិលុបសិស្សបានតែក្នុងថ្នាក់ ${currentUser.grade} របស់លោកអ្នកប៉ុណ្ណោះ!`);
        return;
      }
    }
    if (window.confirm(`តើអ្នកពិតជាចង់លុបសិស្សឈ្មោះ «${profile.name}» ពីក្នុងគណនីថ្នាក់ ${profile.grade} នេះមែនទេ? រាល់ពិន្ទុគ្រប់ខែនឹងត្រូវលុបចោលទាំងអស់!`)) {
      const updated = students.filter(s => !(s.name.trim() === profile.name.trim() && s.grade === profile.grade));
      onSaveStudents(updated);
    }
  };

  const handleAddSampleStudents = () => {
    if (currentUser?.role === 'teacher') {
      if (selectedRosterGrade !== currentUser.grade) {
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
      listToExport = [
        { id: '1', name: 'សុខ ម៉ារីហ្សា', gender: 'ស្រី', grade: selectedRosterGrade !== 'ទាំងអស់' ? selectedRosterGrade : (grades[0] || 'ថ្នាក់ទី៦') } as any,
        { id: '2', name: 'លី ម៉េងហួរ', gender: 'ប្រុស', grade: selectedRosterGrade !== 'ទាំងអស់' ? selectedRosterGrade : (grades[0] || 'ថ្នាក់ទី៦') } as any
      ];
    }

    const headers = "ល.រ,ឈ្មោះសិស្ស,ភេទ,ថ្នាក់";
    const rows = listToExport.map((s, idx) => {
      return `${idx + 1},"${s.name}","${s.gender}","${s.grade}"`;
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

  // Local Excel/CSV parser from computer
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      if (lines.length <= 1) {
        alert("ឯកសារគ្មានទិន្នន័យឡើយ!");
        return;
      }

      const newStudentsList: StudentScore[] = [];
      let importCount = 0;
      let duplicateCount = 0;
      let rejectedTeacherCount = 0;

      // Identify header index
      const startIdx = (lines[0].includes("ឈ្មោះ") || lines[0].includes("Name") || lines[0].includes("ភេទ") || lines[0].includes("ល.រ")) ? 1 : 0;

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        let cols = line.split(',');
        if (cols.length < 2) {
          cols = line.split(';');
        }
        if (cols.length < 2) {
          cols = line.split('\t');
        }

        if (cols.length >= 2) {
          let nameIndex = 0;
          let genderIndex = 1;
          let gradeIndex = 2;

          // If first column is just a number (like sequence row sequence No.)
          if (/^\d+$/.test(cols[0].trim()) && cols.length >= 3) {
            nameIndex = 1;
            genderIndex = 2;
            gradeIndex = 3;
          }

          const rawName = cols[nameIndex]?.trim().replace(/^["']|["']$/g, '');
          const rawGender = cols[genderIndex]?.trim().replace(/^["']|["']$/g, '');
          let rawGrade = cols[gradeIndex]?.trim().replace(/^["']|["']$/g, '') || selectedRosterGrade;

          if (!rawName) continue;

          // Standardize gender string
          let gender: 'ប្រុស' | 'ស្រី' = 'ប្រុស';
          if (rawGender === 'ស្រី' || rawGender === 'F' || rawGender === 'Female' || rawGender === 'female' || rawGender.includes('ស្រី') || rawGender.includes('ស្រ')) {
            gender = 'ស្រី';
          }

          // Validate grade setting
          let gradeVal = rawGrade;
          if (gradeVal === 'ទាំងអស់' || !grades.includes(gradeVal)) {
            gradeVal = selectedRosterGrade !== 'ទាំងអស់' ? selectedRosterGrade : (grades[0] || 'ថ្នាក់ទី៦');
          }

          // Role check: Teachers can only import into their own grade!
          if (currentUser?.role === 'teacher' && gradeVal !== currentUser.grade) {
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

          // Add clean record
          const payload = {
            id: generateUniqueId(),
            name: rawName,
            gender: gender,
            grade: gradeVal,
            month: 'មេសា', // default fallback
            khmer: { listening: 0, writing: 0, reading: 0, speaking: 0 },
            math: { numbers: 0, measurement: 0, geometry: 0, algebra: 0, statistics: 0 },
            science: 0,
            socialStudies: 0,
            physicalEducation: 0,
            health: 0,
            lifeSkills: 0,
            foreignLanguage: 0
          };

          newStudentsList.push(calculateStudentFields(payload));
          importCount++;
        }
      }

      if (rejectedTeacherCount > 0) {
        alert(`លោកអ្នកគឺជាគ្រូបន្ទុកថ្នាក់ ដូច្នេះប្រព័ន្ធបានច្រានចោលសិស្សចំនួន ${rejectedTeacherCount} នាក់ដែលមិនស្ថិតក្នុង ${currentUser.grade} របស់លោកអ្នក!`);
      }

      if (importCount > 0) {
        onSaveStudents([...students, ...newStudentsList]);
        alert(`បាននាំចូលសិស្សចំនួន ${importCount} នាក់ ពីក្នុងកុំព្យូទ័រដោយជោគជ័យ!${duplicateCount > 0 ? ` (ឈ្មោះជាន់គ្នា ${duplicateCount} នាក់ត្រូវបានរំលង)` : ""}`);
      } else {
        alert("មិនឃើញមានទិន្នន័យសិស្សថ្មីទេ។ សូមប្រាកដថាឯកសារ CSV ឬ Excel format របស់អ្នកមានរចនាសម្ព័ន្ធត្រឹមត្រូវ (ល.រ, ឈ្មោះសិស្ស, ភេទ, ថ្នាក់)។");
      }
    };
    reader.readAsText(file);
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
      {/* Overview stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-3xs border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold">
            <GraduationCap size={24} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">ថ្នាក់រៀនសរុប</span>
            <span className="text-2xl font-black text-slate-800 font-sans tracking-tight">{grades.length} ថ្នាក់</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-3xs border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
            <Users size={24} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">សិស្សសរុបរាល់ខែ</span>
            <span className="text-2xl font-black text-slate-800 font-sans tracking-tight">{totalStudents} នាក់</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-3xs border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold text-lg font-sans">
            ស្រី
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">សិស្សស្រី</span>
            <span className="text-2xl font-black text-slate-800 font-sans tracking-tight">{femaleStudents} នាក់</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-3xs border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold text-lg font-sans">
            ប្រុស
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">សិស្សប្រុស</span>
            <span className="text-2xl font-black text-slate-800 font-sans tracking-tight">{maleStudents} នាក់</span>
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
              👤 បញ្ជីឈ្មោះ និងគ្រប់គ្រងសិស្ស ({uniqueStudentProfiles.length})
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
              📚 គ្រប់គ្រងថ្នាក់រៀន ({grades.length})
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
                    <p className="font-extrabold flex items-center gap-1">សិទ្ធិមើលបញ្ជីឈ្មោះតែប៉ុណ្ណោះ (Read-Only Mode)</p>
                    <p className="leading-relaxed text-[11px] font-medium">
                      លោកអ្នកកំពុងតភ្ជាប់ជា <span className="font-bold">«គ្រូបន្ទុកថ្នាក់»</span>។ លោកអ្នកអាចត្រឹមតែពិនិត្យមើលបញ្ជីថ្នាក់រៀន និងស្ថិតិសិស្សបានប៉ុណ្ណោះ។ មានតែ <span className="font-bold">«នាយកសាលា»</span> ប៉ុណ្ណោះដែលអាចបង្កើត កែប្រែ ឬលុបថ្នាក់រៀនបាន។
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
                        <span className="font-bold">💡 អនុញ្ញាត៖</span>
                        <p>លោកអ្នកអាចចូលទៅកាន់ផ្ចាំ «សៀវភៅពិន្ទុ» ដើម្បីបំពេញពិន្ទុសិស្ស ឬ «របាយការណ៍វេទមន្ត» ដើម្បីបញ្ចូលនិងកែសម្រួលរបាយការណ៍សិក្សា។</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <Plus size={16} className="text-indigo-600" />
                        បង្កើតថ្នាក់រៀនថ្មី
                      </h3>
                      
                      <form onSubmit={handleAddClassLocal} className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">ឈ្មោះថ្នាក់រៀន</label>
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
                          បន្ថែមថ្នាក់រៀន
                        </button>
                      </form>

                      <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-1 text-[11px] text-indigo-700 leading-relaxed">
                        <div className="font-bold flex items-center gap-1"><Info size={12} />ការណែនាំ៖</div>
                        <p>ឈ្មោះថ្នាក់ដែលបង្កើតរួច នឹងអាចជ្រើសរើសបាននៅគ្រប់ផ្នែកទាំងអស់នៃកម្មវិធី រួមមានសៀវភៅពិន្ទុ និងរបាយការណ៍សាលា។</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Display current classes/grades with students statistics */}
                <div className="lg:col-span-2 space-y-3">
                  <h3 className="font-bold text-slate-800 text-sm">បញ្ជីថ្នាក់រៀនបច្ចុប្បន្ន</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto p-1 text-xs">
                    {grades.map((g) => {
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
                              <span>ចំនួនសិស្សសរុបរាល់ខែ៖</span>
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
                    <p className="font-extrabold flex items-center gap-1">សិទ្ធិគ្រប់គ្រងសិស្សថ្នាក់រៀនផ្ទាល់ខ្លួន (Classroom Management Mode)</p>
                    <p className="leading-relaxed text-[11px] font-medium">
                      លោកអ្នកកំពុងតភ្ជាប់ជា <span className="font-bold">«គ្រូបន្ទុកថ្នាក់ {currentUser.grade}»</span>។ លោកអ្នកមានសិទ្ធពេញលេញក្នុងការចុះឈ្មោះសិស្សថ្មី កែសម្រួល និងលុបឈ្មោះសិស្សានុសិស្ស ក៏ដូចជាកែប្រែព័ត៌មានគ្រូ និងសិស្សនៅក្នុង <span className="font-bold">{currentUser.grade}</span> របស់លោកអ្នកផ្ទាល់។
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
                        ការទាញយក និង បញ្ចូលបញ្ជីឈ្មោះសិស្ស (Excel .csv)
                      </span>
                      <p className="text-slate-400 text-[10px] leading-relaxed">
                        អ្នកអាចទាញយកឈ្មោះសិស្សបច្ចុប្បន្នទុកជាឯកសារ Excel ឬបញ្ចូលឯកសារសិស្សថ្មីពីកុំព្យូទ័ររបស់អ្នក។
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleExportCSV(false)}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg font-semibold transition-all inline-flex items-center gap-1 shadow-3xs"
                        title="ទាញយកបញ្ជីឈ្មោះជាទម្រង់ excel"
                      >
                        <Download size={13} />
                        ទាញយកតារាងឈ្មោះ
                      </button>

                      <button
                        onClick={handleTriggerFileInput}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80 rounded-lg font-semibold transition-all inline-flex items-center gap-1 shadow-3xs"
                        title="បញ្ចូលបញ្ជីឈ្មោះពីកុំព្យូទ័ររបស់អ្នក"
                      >
                        <Upload size={13} />
                        នាំចូលពីកុំព្យូទ័រ
                      </button>

                      {/* Hidden CSV File input selector */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportCSV}
                        accept=".csv"
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* Filter and dynamic roster count controls */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-150">
                    <div className="flex items-center gap-2 flex-wrap text-slate-700">
                      <span className="text-xs font-bold text-slate-600">ថ្នាក់៖</span>
                      <select
                        value={selectedRosterGrade}
                        onChange={(e) => setSelectedRosterGrade(e.target.value)}
                        className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-blue-500 font-semibold"
                      >
                        <option value="ទាំងអស់">គ្រប់ថ្នាក់ទាំងអស់</option>
                        {grades.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>

                      <div className="relative">
                        <input
                          type="text"
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                          placeholder="ស្វែងរកតាមឈ្មោះ..."
                          className="pl-7 pr-3.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 outline-none focus:border-blue-500 text-xs font-medium"
                        />
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {selectedRosterGrade !== 'ទាំងអស់' && (
                        <button
                          onClick={handleAddSampleStudents}
                          className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/50 rounded-lg text-xs font-semibold transition-all"
                        >
                          💡 បន្ថែមសិស្សគំរូ
                        </button>
                      )}

                      <button
                        onClick={handleOpenAddStudent}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1 shadow-2xs"
                      >
                        <UserPlus size={12} />
                        ចុះឈ្មោះសិស្ស
                      </button>
                    </div>
                  </div>

                  {/* Helper option to export sample blank Excel/CSV template */}
                  <div className="flex items-center justify-between px-3 text-[11px] text-slate-400 bg-slate-50/50 py-1.5 rounded-lg border border-slate-100 leading-none">
                    <span>💡 គន្លឹះ៖ ដើម្បីនាំចូលបានត្រឹមត្រូវ សូមប្រាកដថាជួរឈរមានទម្រង់ (ល.រ, ឈ្មោះសិស្ស, ភេទ, ថ្នាក់)។</span>
                    <button
                      onClick={() => handleExportCSV(true)}
                      className="text-blue-600 hover:underline font-bold"
                    >
                      ទាញយកគំរូ Excel (.csv)
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
                              <Download size={11} /> ទាញយកគំរូ Excel (.csv)
                            </button>
                            <span className="text-slate-350">|</span>
                            <button
                              type="button"
                              onClick={handleTriggerFileInput}
                              className="text-emerald-700 hover:underline font-bold flex items-center gap-0.5"
                            >
                              <Upload size={11} /> នាំចូលពី Excel
                            </button>
                          </div>
                        </div>
                      )}

                      <form onSubmit={handleSaveStudentSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-medium">
                        <div>
                          <label className="block text-slate-500 mb-1">ឈ្មោះសិស្ស</label>
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
                          <label className="block text-slate-500 mb-1">ភេទ</label>
                          <select
                            value={studentFormGender}
                            onChange={(e) => setStudentFormGender(e.target.value as 'ប្រុស' | 'ស្រី')}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                          >
                            <option value="ប្រុស">ប្រុស</option>
                            <option value="ស្រី">ស្រី</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-500 mb-1">ថ្នាក់សិក្សា</label>
                          <select
                            disabled={currentUser?.role === 'teacher'}
                            value={studentFormGrade}
                            onChange={(e) => setStudentFormGrade(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white disabled:bg-slate-50 disabled:text-slate-400 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                          >
                            {grades.map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-3 pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
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
                          <th className="px-4 py-3">ឈ្មោះសិស្ស</th>
                          <th className="px-4 py-3 text-center">ភេទ</th>
                          <th className="px-4 py-3 text-center">ថ្នាក់សិក្សា</th>
                          <th className="px-4 py-3 text-center">ស្ថានភាព</th>
                          <th className="px-4 py-3 text-right">សកម្មភាព</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-slate-700">
                        {filteredProfiles.length > 0 ? (
                          filteredProfiles.map((p) => {
                            return (
                              <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 font-bold text-slate-800 flex items-center gap-2">
                                  <span className="w-7 h-7 bg-indigo-50 text-indigo-650 rounded-full flex items-center justify-center font-sans font-black text-[11px] border border-indigo-100">
                                    {p.name[0]}
                                  </span>
                                  {p.name}
                                </td>
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
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-700">
                                    ធម្មតា / កំពុងរៀន
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {currentUser?.role === 'principal' || (currentUser?.role === 'teacher' && p.grade === currentUser.grade) ? (
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
                            <td colSpan={5} className="px-4 py-12 text-center text-slate-400 font-medium">
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
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block mb-0.5">ព័ត៌មានគ្រូ ឬ គ្រូបន្ទុកថ្នាក់</span>
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
                        
                        {/* Edit teacher button if principal or if current user is the teacher of this class */}
                        {(currentUser?.role === 'principal' || (currentUser?.role === 'teacher' && currentUser.grade === selectedRosterGrade)) && (
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
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-0.5">ស្ថិតិ និង ព័ត៌មានថ្នាក់រៀន</span>
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
                              <span className="text-[10px] font-semibold text-slate-400 block mb-1">សរុប</span>
                              <strong className="text-slate-800 font-sans text-sm font-black">{totalInCurrent} នាក់</strong>
                            </div>
                            <div className="bg-rose-50/50 p-2.5 rounded-xl text-center">
                              <span className="text-[10px] font-semibold text-slate-40 block mb-1 text-slate-400">ស្រី (F)</span>
                              <strong className="text-rose-600 font-sans text-sm font-black">{femaleInCurrent} នាក់</strong>
                            </div>
                            <div className="bg-blue-50/50 p-2.5 rounded-xl text-center">
                              <span className="text-[10px] font-semibold text-slate-400 block mb-1">ប្រុស (M)</span>
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
                              <span>ឆ្នាំសិក្សា / Academic Year:</span>
                              <span className="text-slate-800">២០២៥ - ២០២៦</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>រដ្ឋបាលខេត្ត៖</span>
                              <span className="text-slate-800">ខេត្តកណ្ដាល</span>
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
                    <label className="block text-slate-500 mb-1">ឈ្មោះគ្រូបន្ទុកថ្នាក់</label>
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
                    <label className="block text-slate-500 mb-1">ជីវប្រវត្តិសង្ខេប / ព័ត៌មានលម្អិត</label>
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
