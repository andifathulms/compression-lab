/**
 * The shared correctness corpus (PRD 6.1). Every coder round-trips every one
 * of these, including the awkward ones: empty, single symbol, one symbol
 * repeated, all-distinct symbols, and text outside the Basic Multilingual
 * Plane.
 */
export const CORPUS: Array<{ name: string; text: string }> = [
  { name: 'empty', text: '' },
  { name: 'one character', text: 'a' },
  { name: 'one character repeated', text: 'a'.repeat(300) },
  { name: 'two symbols', text: 'ab'.repeat(150) },
  {
    name: 'all distinct',
    text: Array.from({ length: 96 }, (_, i) => String.fromCharCode(32 + i)).join(''),
  },
  { name: 'astral', text: 'a\u{1F600}b\u{1F600}c\u{1D11E}d' },
  { name: 'english prose', text: 'the quick brown fox jumps over the lazy dog. '.repeat(20) },
  {
    name: 'newlines and punctuation',
    text: 'Line one.\nLine two, with a comma; and a semicolon.\n\tTabbed.\n',
  },
  { name: 'dna', text: 'ACGTACGGTTACAGGCTATCGGATCCAGT'.repeat(12) },
  { name: 'indonesian', text: 'Setiap orang berhak atas kebebasan berpikir dan berpendapat. '.repeat(8) },
];
