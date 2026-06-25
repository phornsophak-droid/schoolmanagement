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
