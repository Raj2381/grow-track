export type CodingLanguage = "javascript" | "python" | "java" | "c" | "cpp";
export type CodingTestCase = { input: unknown[]; expected: unknown };
export type CodingKind =
  | "two-sum"
  | "palindrome"
  | "sum-array"
  | "max-element"
  | "reverse-string"
  | "count-vowels";

export type CodingChallenge = {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium";
  topic: string;
  kind: CodingKind;
  description: string;
  examples: { input: string; output: string; explanation: string }[];
  functionNames: Record<CodingLanguage, string>;
  tests: CodingTestCase[];
};

const names = (javascript: string, python: string, c: string) => ({
  javascript,
  python,
  java: javascript,
  c,
  cpp: javascript,
});

const strings = ["GrowthTrack", "Never odd, or even!", "Campus IQ", "No lemon, no melon"];

export const codingChallenges: CodingChallenge[] = [
  {
    id: "two-sum", title: "Pair Sum Indices", difficulty: "Easy", topic: "Arrays", kind: "two-sum",
    description: "Return the indices of two distinct values that add up to the target. Return the pair in ascending index order.",
    examples: [{ input: "[4, 9, 6, 7], target = 10", output: "[0, 2]", explanation: "4 + 6 equals 10." }],
    functionNames: names("pairSumIndices", "pair_sum_indices", "pairSumIndices"),
    tests: [
      { input: [[4, 9, 6, 7], 10], expected: [0, 2] },
      { input: [[5, 3, 8], 11], expected: [1, 2] },
      { input: [[6, 6], 12], expected: [0, 1] },
      { input: [[2, 11, 4, 8], 12], expected: [2, 3] },
      { input: [[1, 5, 9, 2], 7], expected: [1, 3] },
    ],
  },
  {
    id: "normalized-palindrome", title: "Normalized Palindrome", difficulty: "Easy", topic: "Strings", kind: "palindrome",
    description: "Return true when a string reads the same after lowercasing and removing non-alphanumeric characters.",
    examples: [{ input: '"Never odd, or even!"', output: "true", explanation: "The normalized text is a palindrome." }],
    functionNames: names("isNormalizedPalindrome", "is_normalized_palindrome", "isNormalizedPalindrome"),
    tests: strings.map((input, index) => ({ input: [input], expected: [true, true, false, true][index] })),
  },
  {
    id: "sum-array", title: "Array Sum", difficulty: "Easy", topic: "Arrays", kind: "sum-array",
    description: "Return the sum of every integer in the array.",
    examples: [{ input: "[1, 2, 3, 4]", output: "10", explanation: "Add each value once." }],
    functionNames: names("sumArray", "sum_array", "sumArray"),
    tests: [
      { input: [[1, 2, 3, 4]], expected: 10 }, { input: [[-2, 5, 7]], expected: 10 },
      { input: [[0]], expected: 0 }, { input: [[10, -5, 2]], expected: 7 },
    ],
  },
  {
    id: "max-array", title: "Maximum Element", difficulty: "Easy", topic: "Arrays", kind: "max-element",
    description: "Return the largest integer in a non-empty array.",
    examples: [{ input: "[-4, 8, 2]", output: "8", explanation: "8 is the largest value." }],
    functionNames: names("maxElement", "max_element", "maxElement"),
    tests: [
      { input: [[-4, 8, 2]], expected: 8 }, { input: [[7]], expected: 7 },
      { input: [[3, 11, 5, 9]], expected: 11 }, { input: [[-8, -2, -5]], expected: -2 },
    ],
  },
  {
    id: "count-vowels", title: "Count Vowels", difficulty: "Easy", topic: "Strings", kind: "count-vowels",
    description: "Count the vowels a, e, i, o, and u in the text, ignoring case.",
    examples: [{ input: '"GrowthTrack"', output: "2", explanation: "The vowels are o and a." }],
    functionNames: names("countVowels", "count_vowels", "countVowels"),
    tests: [
      { input: ["GrowthTrack"], expected: 2 }, { input: ["AEIOU"], expected: 5 },
      { input: ["rhythm"], expected: 0 }, { input: ["University"], expected: 4 },
    ],
  },
  {
    id: "reverse-string", title: "Reverse Text", difficulty: "Easy", topic: "Strings", kind: "reverse-string",
    description: "Return the input text reversed without changing its characters.",
    examples: [{ input: '"campus"', output: '"supmac"', explanation: "Read the characters from right to left." }],
    functionNames: names("reverseString", "reverse_string", "reverseString"),
    tests: [
      { input: ["campus"], expected: "supmac" }, { input: ["GrowthTrack"], expected: "kcarThtworG" },
      { input: ["a"], expected: "a" }, { input: ["hello world"], expected: "dlrow olleh" },
    ],
  },
  {
    id: "sum-array-positives", title: "Sum Positive Values", difficulty: "Medium", topic: "Loops", kind: "sum-array",
    description: "Return the sum of values greater than zero; ignore zero and negative values.",
    examples: [{ input: "[-2, 4, 0, 3]", output: "7", explanation: "Only 4 and 3 contribute." }],
    functionNames: names("sumPositive", "sum_positive", "sumPositive"),
    tests: [
      { input: [[-2, 4, 0, 3]], expected: 7 }, { input: [[-1, -4]], expected: 0 },
      { input: [[5, 6]], expected: 11 }, { input: [[0, 2, -3, 8]], expected: 10 },
    ],
  },
  {
    id: "max-even", title: "Maximum Even Value", difficulty: "Medium", topic: "Conditions", kind: "max-element",
    description: "Return the largest even value in the array. Inputs always contain an even value.",
    examples: [{ input: "[3, 8, 5, 10]", output: "10", explanation: "10 is the largest even value." }],
    functionNames: names("maxEven", "max_even", "maxEven"),
    tests: [
      { input: [[3, 8, 5, 10]], expected: 10 }, { input: [[2, 7, 1]], expected: 2 },
      { input: [[-6, -3, -2]], expected: -2 }, { input: [[12, 4, 6]], expected: 12 },
    ],
  },
  {
    id: "vowels-only", title: "Vowels Only", difficulty: "Medium", topic: "Strings", kind: "count-vowels",
    description: "Return the number of vowels in the supplied sentence, including repeated vowels.",
    examples: [{ input: '"Data Structures"', output: "6", explanation: "Count every vowel occurrence." }],
    functionNames: names("countSentenceVowels", "count_sentence_vowels", "countSentenceVowels"),
    tests: [
      { input: ["Data Structures"], expected: 5 }, { input: ["Open AI"], expected: 4 },
      { input: ["BCDF"], expected: 0 }, { input: ["education"], expected: 5 },
    ],
  },
  {
    id: "palindrome-short", title: "Simple Palindrome", difficulty: "Medium", topic: "Strings", kind: "palindrome",
    description: "Return true if the text is exactly the same forwards and backwards. Case matters.",
    examples: [{ input: '"level"', output: "true", explanation: "The characters match in reverse order." }],
    functionNames: names("isSimplePalindrome", "is_simple_palindrome", "isSimplePalindrome"),
    tests: [
      { input: ["level"], expected: true }, { input: ["radar"], expected: true },
      { input: ["GrowthTrack"], expected: false }, { input: ["Level"], expected: false },
    ],
  },
  {
    id: "sum-odd", title: "Sum Odd Values", difficulty: "Medium", topic: "Loops", kind: "sum-array",
    description: "Return the sum of all odd integers in the array.",
    examples: [{ input: "[2, 3, 5, 8]", output: "8", explanation: "3 + 5 equals 8." }],
    functionNames: names("sumOdd", "sum_odd", "sumOdd"),
    tests: [
      { input: [[2, 3, 5, 8]], expected: 8 }, { input: [[1, 1, 2]], expected: 2 },
      { input: [[4, 6]], expected: 0 }, { input: [[-3, 4, 7]], expected: 4 },
    ],
  },
  {
    id: "max-absolute", title: "Largest Absolute Value", difficulty: "Medium", topic: "Arrays", kind: "max-element",
    description: "Return the value with the largest absolute magnitude. If tied, return the first one.",
    examples: [{ input: "[-9, 4, 7]", output: "-9", explanation: "The magnitude of -9 is greatest." }],
    functionNames: names("maxAbsolute", "max_absolute", "maxAbsolute"),
    tests: [
      { input: [[-9, 4, 7]], expected: -9 }, { input: [[3, -8, 2]], expected: -8 },
      { input: [[5, -5]], expected: 5 }, { input: [[0, -1]], expected: -1 },
    ],
  },
  {
    id: "reverse-words", title: "Reverse Word Order", difficulty: "Medium", topic: "Strings", kind: "reverse-string",
    description: "Return the words in reverse order, separated by one space. Inputs have no extra spaces.",
    examples: [{ input: '"learn every day"', output: '"day every learn"', explanation: "Reverse the word order." }],
    functionNames: names("reverseWords", "reverse_words", "reverseWords"),
    tests: [
      { input: ["learn every day"], expected: "day every learn" }, { input: ["one two"], expected: "two one" },
      { input: ["GrowthTrack"], expected: "GrowthTrack" }, { input: ["a b c d"], expected: "d c b a" },
    ],
  },
  ...Array.from({ length: 8 }, (_, index) => ({
    id: `practice-${index + 1}`, title: `Practice Challenge ${index + 1}`, difficulty: index < 4 ? "Easy" as const : "Medium" as const,
    topic: index % 2 ? "Strings" : "Arrays", kind: index % 2 ? "palindrome" as const : "sum-array" as const,
    description: index % 2 ? "Return true if the text is a palindrome after normalizing case and ignoring punctuation." : "Return the sum of all integers in the array.",
    examples: [{ input: index % 2 ? '"Level"' : "[1, 2, 3]", output: index % 2 ? "true" : "6", explanation: "Apply the rule to every input." }],
    functionNames: index % 2
      ? names("isPalindrome", "is_palindrome", "isPalindrome")
      : names("sumArray", "sum_array", "sumArray"),
    tests: index % 2
      ? [{ input: ["Level"], expected: true }, { input: ["hello"], expected: false }, { input: ["A man, a plan, a canal: Panama"], expected: true }]
      : [{ input: [[1, 2, 3]], expected: 6 }, { input: [[-2, 8]], expected: 6 }, { input: [[0]], expected: 0 }],
  })),
];

export function findCodingChallenge(challengeId: string) {
  return codingChallenges.find((challenge) => challenge.id === challengeId);
}
