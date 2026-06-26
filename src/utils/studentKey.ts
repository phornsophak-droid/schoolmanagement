/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// A whitespace-insensitive identity key for counting DISTINCT students from score
// records. Khmer data often varies only by spacing (e.g. a grade written with vs
// without a space, hidden zero-width spaces, or double spaces in a name), which
// previously split one student into two counts (481 shown vs 459 real). Normalising
// that away gives the true head-count without merging genuinely different students
// (real grades and different names still differ).

// Zero-width / bidi-format characters, built from code points to keep the source
// ASCII-clean. \s does not match these, so strip them explicitly.
const INVISIBLE = new RegExp(
  '[' + [0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2060, 0xfeff].map(c => String.fromCharCode(c)).join('') + ']',
  'g'
);

export const distinctStudentKey = (name?: string, grade?: string): string => {
  const nameKey = (name || '').toString().replace(INVISIBLE, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const gradeKey = (grade || '').toString().replace(INVISIBLE, '').replace(/\s+/g, '').toLowerCase();
  return `${nameKey}|${gradeKey}`;
};

// Class section letters (ក ខ គ …). A grade typed WITHOUT a section (e.g.
// "ថ្នាក់ទី៣") is a stray/legacy mis-entry when sectioned variants of it
// ("ថ្នាក់ទី៣ក", "ថ្នាក់ទី៣ខ") also exist — those records belong to the real
// sectioned classes. Such a bare grade otherwise shows as a phantom class row and
// inflates the head-count (e.g. 481 vs the real 459). Detect them so callers can
// drop them. A genuinely single-section class like "ថ្នាក់ទី៦" has no variant → kept.
const CLASS_SECTIONS = ['ក', 'ខ', 'គ', 'ឃ', 'ង'];
export const findPhantomGrades = (allGrades: string[]): Set<string> => {
  const norm = (s: string) => (s || '').replace(/\s+/g, '');
  const normSet = new Set(allGrades.map(norm));
  const phantom = new Set<string>();
  allGrades.forEach(g => {
    const n = norm(g);
    if (n && CLASS_SECTIONS.some(sec => normSet.has(n + sec))) phantom.add(g);
  });
  return phantom;
};
