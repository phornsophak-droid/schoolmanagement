export function transliterateKhmerName(name: string): string {
  if (!name) return '';

  const map: Record<string, string> = {
    'ក': 'k', 'ខ': 'kh', 'គ': 'k', 'ឃ': 'kh', 'ង': 'ng',
    'ច': 'ch', 'ឆ': 'chh', 'ជ': 'ch', 'ឈ': 'chh', 'ញ': 'nh',
    'ដ': 'd', 'ឋ': 'th', 'ឌ': 'd', 'ឍ': 'th', 'ណ': 'n',
    'ត': 't', 'ថ': 'th', 'ទ': 't', 'ធ': 'th', 'ន': 'n',
    'ប': 'b', 'ផ': 'ph', 'ព': 'p', 'ភ': 'ph', 'ម': 'm',
    'យ': 'y', 'រ': 'r', 'ល': 'l', 'វ': 'v',
    'ស': 's', 'ហ': 'h', 'ឡ': 'l', 'អ': 'a',
    
    // Subscripts (jeung)
    '្ក': 'k', '្ខ': 'kh', '្គ': 'k', '្ឃ': 'kh', '្ង': 'ng',
    '្ច': 'ch', '្ឆ': 'chh', '្ជ': 'ch', '្ឈ': 'chh', '្ញ': 'nh',
    '្ដ': 'd', '្ឋ': 'th', '្ឌ': 'd', '្ឍ': 'th', '្ណ': 'n',
    '្ត': 't', '្ថ': 'th', '្ទ': 't', '្ធ': 'th', '្ន': 'n',
    '្ប': 'b', '្ផ': 'ph', '្ព': 'p', '្ភ': 'ph', '្ម': 'm',
    '្យ': 'y', '្រ': 'r', '្ល': 'l', '្វ': 'v',
    '្ស': 's', '្ហ': 'h', '្អ': 'a',

    // Vowels
    'ា': 'a', 'ិ': 'i', 'ី': 'i', 'ឹ': 'eu', 'ឺ': 'eu',
    'ុ': 'u', 'ូ': 'ou', 'ួ': 'uo', 'ើ': 'aeu', 'ឿ': 'oea', 'ៀ': 'ie',
    'េ': 'e', 'ែ': 'ae', 'ៃ': 'ai', 'ោ': 'o', 'ៅ': 'au',
    'ុំ': 'om', 'ំ': 'om', 'ាំ': 'am', 'ះ': 'h', 'ុះ': 'uh', 'េះ': 'eh', 'ោះ': 'oh',

    // Independent vowels
    'ឥ': 'i', 'ឦ': 'i', 'ឧ': 'u', 'ឨ': 'u', 'ឩ': 'u', 'ឪ': 'ou',
    'ឫ': 'reu', 'ឬ': 'reu', 'ឭ': 'leu', 'ឮ': 'leu',
    'ឯ': 'e', 'ឰ': 'ai', 'ឱ': 'o', 'ឲ': 'ao', 'ឳ': 'au',

    // Diacritics
    '់': '', '៊': '', '៉': '', '៍': '', '៎': '', '៌': 'r'
  };

  let latin = '';
  let chars = Array.from(name);
  
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    
    if (char === '្' && i + 1 < chars.length) {
      const jeung = char + chars[i+1];
      if (map[jeung]) {
        latin += map[jeung];
      }
      i++;
      continue;
    }
    
    // Check combined chars like ុំ
    if (i + 1 < chars.length && map[char + chars[i+1]]) {
      latin += map[char + chars[i+1]];
      i++;
      continue;
    }

    if (map[char] !== undefined) {
      latin += map[char];
    } else {
      latin += char;
    }
  }

  // Formatting: split by space, capitalize each word
  return latin.split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}
