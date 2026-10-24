import type { AptitudeSection, SoftSkill } from '@student/types'

export interface MCQ { q: string; options: string[]; answer: number; explanation: string }

const m = (q: string, options: string[], answer: number, explanation: string): MCQ => ({ q, options, answer, explanation })

/* All questions below are original practice questions written in the *style* of
   each pattern. They are not official company questions. */

export const APTITUDE_POOL: Record<AptitudeSection, MCQ[]> = {
  Quantitative: [
    m('What is 20% of 450?', ['80', '90', '100', '110'], 1, '20% = 1/5, and 450 ÷ 5 = 90.'),
    m('A 120 m long train moving at 54 km/h crosses a pole. How long does it take?', ['6 s', '8 s', '10 s', '12 s'], 1, '54 km/h = 15 m/s. Time = 120 ÷ 15 = 8 s.'),
    m('A can finish a job in 12 days and B in 18 days. Working together, how many days will they take?', ['6', '7.2', '8', '9'], 1, 'Rate = 1/12 + 1/18 = 5/36 per day, so time = 36/5 = 7.2 days.'),
    m('An item costs ₹800. At what price must it be sold for a 25% profit?', ['₹950', '₹1000', '₹1050', '₹1100'], 1, '800 × 1.25 = ₹1000.'),
    m('Simple interest on ₹5000 at 8% per annum for 3 years is:', ['₹1000', '₹1200', '₹1400', '₹1600'], 1, 'SI = P·R·T/100 = 5000 × 8 × 3 / 100 = ₹1200.'),
    m('The average of 5 numbers is 24. Four of them are 20, 22, 26 and 28. The fifth number is:', ['24', '22', '25', '26'], 0, 'Total = 120. Known sum = 96. Fifth = 120 − 96 = 24.'),
    m('Two numbers are in the ratio 3 : 5 and their sum is 64. The larger number is:', ['32', '36', '40', '45'], 2, 'One part = 64 ÷ 8 = 8. Larger = 5 × 8 = 40.'),
    m('A boat goes 36 km downstream. Its speed in still water is 10 km/h and the stream is 2 km/h. Time taken?', ['3 h', '3.6 h', '4 h', '4.5 h'], 0, 'Downstream speed = 12 km/h. Time = 36 ÷ 12 = 3 h.'),
    m('Compound interest on ₹10,000 at 10% p.a. for 2 years is:', ['₹2000', '₹2100', '₹2200', '₹2310'], 1, 'Amount = 10000 × 1.1² = 12100. CI = ₹2100.'),
    m('In how many ways can the letters of the word "CAT" be arranged?', ['3', '4', '6', '9'], 2, '3! = 6.'),
    m('Two dice are thrown. The probability that the sum is 7 is:', ['1/12', '1/6', '1/9', '5/36'], 1, 'Six favourable outcomes out of 36 → 1/6.'),
    m('Pipe A fills a tank in 10 h; pipe B empties it in 15 h. Both are opened together. Time to fill?', ['30 h', '25 h', '35 h', '40 h'], 0, 'Net rate = 1/10 − 1/15 = 1/30 per hour → 30 h.'),
    m('If 3x + 7 = 28, then x =', ['5', '6', '7', '8'], 2, '3x = 21, so x = 7.'),
    m('The HCF of 36 and 48 is:', ['6', '8', '12', '24'], 2, '36 = 2²·3², 48 = 2⁴·3 → HCF = 2²·3 = 12.'),
    m('The marked price of a shirt is ₹1500. After a 20% discount, the selling price is:', ['₹1100', '₹1200', '₹1250', '₹1300'], 1, '1500 × 0.8 = ₹1200.'),
    m('The area of a circle of radius 7 cm is (π = 22/7):', ['144 cm²', '154 cm²', '164 cm²', '176 cm²'], 1, 'πr² = 22/7 × 49 = 154.'),
  ],
  'Logical Reasoning': [
    m('Find the next number: 2, 6, 12, 20, 30, ?', ['40', '42', '44', '46'], 1, 'Differences are 4, 6, 8, 10, 12 → 30 + 12 = 42.'),
    m('Which one is the odd one out?', ['Apple', 'Banana', 'Carrot', 'Mango'], 2, 'Carrot is a vegetable; the others are fruits.'),
    m('If CAT is coded as 3-1-20 (letter positions), DOG is coded as:', ['4-15-7', '4-16-7', '4-15-6', '5-15-7'], 0, 'D=4, O=15, G=7.'),
    m('Ravi walks 5 km north, 3 km east, then 5 km south. How far is he from the start?', ['3 km', '5 km', '8 km', '13 km'], 0, 'North and south cancel out, leaving 3 km east.'),
    m('A is B\'s brother. B is C\'s mother. How is A related to C?', ['Father', 'Maternal uncle', 'Paternal uncle', 'Cousin'], 1, 'A is the brother of C\'s mother → maternal uncle.'),
    m('All cats are animals. All animals are mortal. Which must be true?', ['All mortals are cats', 'All cats are mortal', 'Some animals are not mortal', 'No cat is mortal'], 1, 'By transitivity, cats ⊂ animals ⊂ mortal.'),
    m('Find the next number: 1, 4, 9, 16, 25, ?', ['30', '34', '36', '49'], 2, 'Perfect squares: 6² = 36.'),
    m('In the row P, S, Q, T, R (left to right), who is in the middle?', ['P', 'S', 'Q', 'T'], 2, 'The third of five positions is Q.'),
    m('What is the angle between the hands of a clock at 3:00?', ['60°', '90°', '120°', '180°'], 1, 'Each hour mark is 30°; 3 marks = 90°.'),
    m('Today is Monday. What day will it be after 10 days?', ['Wednesday', 'Thursday', 'Friday', 'Saturday'], 1, '10 mod 7 = 3 → Monday + 3 = Thursday.'),
    m('Book : Reading :: Fork : ?', ['Cooking', 'Eating', 'Writing', 'Cutting'], 1, 'A book is used for reading; a fork is used for eating.'),
    m('Find the next number: 3, 9, 27, 81, ?', ['162', '243', '324', '729'], 1, 'Each term is multiplied by 3.'),
    m('Rahul ranks 8th from the top in a class of 30. What is his rank from the bottom?', ['21', '22', '23', '24'], 2, '30 − 8 + 1 = 23.'),
    m('Complete the pattern: AZ, BY, CX, ?', ['DV', 'DW', 'EW', 'DX'], 1, 'First letter moves forward, second moves backward: D, W.'),
    m('Some pens are pencils. All pencils are erasers. "Some pens are erasers" is:', ['Definitely true', 'Definitely false', 'Cannot be determined', 'True only if all pens are pencils'], 0, 'The pens that are pencils are erasers too.'),
    m('Six people shake hands once with each other. Total handshakes?', ['12', '15', '30', '36'], 1, '6C2 = 15.'),
  ],
  Verbal: [
    m('Choose the synonym of "Abundant":', ['Scarce', 'Plentiful', 'Rare', 'Tiny'], 1, 'Abundant means existing in large quantities — plentiful.'),
    m('Choose the antonym of "Benevolent":', ['Kind', 'Generous', 'Malevolent', 'Gentle'], 2, 'Benevolent = well-meaning; malevolent = wishing harm.'),
    m('She ___ to the market every morning.', ['go', 'goes', 'going', 'gone'], 1, 'Third-person singular, present simple → "goes".'),
    m('Neither of the boys ___ present.', ['were', 'are', 'was', 'have been'], 2, '"Neither" takes a singular verb.'),
    m('He is good ___ mathematics.', ['in', 'at', 'on', 'with'], 1, '"Good at" is the correct collocation.'),
    m('One word for "a person who loves books":', ['Bibliophile', 'Philatelist', 'Misanthrope', 'Optimist'], 0, 'Bibliophile = lover of books.'),
    m('What does the idiom "break the ice" mean?', ['Break something cold', 'Start a conversation in an awkward situation', 'Leave suddenly', 'Win a contest'], 1, 'It means to ease tension and begin a conversation.'),
    m('Choose the correct spelling:', ['Accomodate', 'Accommodate', 'Acommodate', 'Acomodate'], 1, 'Accommodate has double c and double m.'),
    m('Passive voice of "The chef cooked the meal":', ['The meal is cooked by the chef', 'The meal was cooked by the chef', 'The meal has cooked the chef', 'The chef was cooked by the meal'], 1, 'Simple past → "was cooked by".'),
    m('Choose the synonym of "Candid":', ['Hidden', 'Frank', 'Rude', 'Shy'], 1, 'Candid means truthful and straightforward — frank.'),
    m('He is ___ honest man.', ['a', 'an', 'the', 'no article'], 1, '"Honest" begins with a vowel sound, so "an".'),
    m('Passage: "Regular exercise improves not only physical health but also concentration and mood. Even a 20-minute walk can reduce stress." What is the main idea?', ['Walking is the best exercise', 'Exercise benefits both body and mind', 'Stress is unavoidable', 'Mood affects concentration'], 1, 'The passage links exercise to physical and mental benefits.'),
    m('Choose the best sentence:', ['If I was you, I would apply.', 'If I were you, I would apply.', 'If I am you, I would apply.', 'If I be you, I would apply.'], 1, 'Hypothetical (subjunctive) uses "were".'),
    m('Choose the antonym of "Expand":', ['Grow', 'Stretch', 'Contract', 'Enlarge'], 2, 'Expand ↔ contract.'),
    m('She has been working here ___ 2019.', ['for', 'since', 'from', 'by'], 1, '"Since" is used with a point in time.'),
    m('___ late again!', ['Your', 'Yore', "You're", 'Youre'], 2, '"You\'re" = "you are".'),
  ],
}

export interface TestPattern { id: string; name: string; blurb: string; minutes: number; counts: Record<AptitudeSection, number>; offset: number }
export const PATTERNS: TestPattern[] = [
  { id: 'tcs', name: 'TCS NQT Pattern', blurb: 'Quant-heavy mix with a timed, section-wise format.', minutes: 30, counts: { Quantitative: 10, 'Logical Reasoning': 8, Verbal: 8 }, offset: 0 },
  { id: 'infosys', name: 'Infosys Pattern', blurb: 'Reasoning-focused paper with language questions.', minutes: 30, counts: { Quantitative: 8, 'Logical Reasoning': 10, Verbal: 8 }, offset: 4 },
  { id: 'accenture', name: 'Accenture Pattern', blurb: 'Balanced sections, slightly verbal-heavy.', minutes: 35, counts: { Quantitative: 9, 'Logical Reasoning': 9, Verbal: 10 }, offset: 8 },
  { id: 'general', name: 'General Practice', blurb: 'Short mixed set — a good warm-up.', minutes: 20, counts: { Quantitative: 6, 'Logical Reasoning': 6, Verbal: 6 }, offset: 12 },
]

/** Build the question list for a pattern; offset rotates the pool so each pattern feels different. */
export function buildTest(p: TestPattern) {
  return (Object.keys(p.counts) as AptitudeSection[]).flatMap((section) => {
    const pool = APTITUDE_POOL[section]
    return Array.from({ length: p.counts[section] }, (_, i) => ({ section, ...pool[(p.offset + i) % pool.length] }))
  })
}

/* --------------------------- technical skill tests ------------------------- */
export type CoreTech = 'DSA' | 'Web Dev' | 'DBMS' | 'Python'
export const TECH_TESTS: Record<CoreTech, MCQ[]> = {
  DSA: [
    m('Time complexity of binary search on a sorted array?', ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], 1, 'The search space halves each step.'),
    m('Which data structure follows LIFO?', ['Queue', 'Stack', 'Heap', 'Graph'], 1, 'A stack is Last-In-First-Out.'),
    m('BFS uses which data structure?', ['Stack', 'Queue', 'Priority queue', 'Tree'], 1, 'BFS processes nodes level by level with a queue.'),
    m('Worst-case time complexity of Quick Sort?', ['O(n log n)', 'O(n)', 'O(n²)', 'O(log n)'], 2, 'A bad pivot gives unbalanced partitions → O(n²).'),
    m('Average-case lookup time in a hash table?', ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'], 0, 'Good hashing gives constant-time lookups.'),
    m('In-order traversal of a BST gives:', ['Random order', 'Sorted order', 'Reverse order', 'Level order'], 1, 'Left–root–right visits keys in ascending order.'),
  ],
  'Web Dev': [
    m('Which HTML tag creates the largest heading?', ['<h6>', '<head>', '<h1>', '<title>'], 2, '<h1> is the top-level heading.'),
    m('Which CSS property changes text colour?', ['font-color', 'color', 'text-style', 'foreground'], 1, 'Use `color`.'),
    m('What does `typeof null` return in JavaScript?', ['"null"', '"undefined"', '"object"', '"number"'], 2, 'A long-standing quirk of JavaScript.'),
    m('HTTP status code for "Not Found"?', ['200', '301', '404', '500'], 2, '404 means the resource was not found.'),
    m('Which React hook manages local state?', ['useEffect', 'useState', 'useRef', 'useMemo'], 1, 'useState returns state and a setter.'),
    m('Which array method adds an element at the end in JS?', ['push', 'pop', 'shift', 'unshift'], 0, 'push appends to the end.'),
  ],
  DBMS: [
    m('Which SQL clause filters rows?', ['ORDER BY', 'GROUP BY', 'WHERE', 'HAVING'], 2, 'WHERE filters rows before grouping.'),
    m('A primary key must be:', ['Unique and non-null', 'Unique but nullable', 'Non-unique', 'Always numeric'], 0, 'It identifies each row uniquely.'),
    m('Which normal form removes partial dependencies?', ['1NF', '2NF', '3NF', 'BCNF'], 1, '2NF removes partial dependency on a composite key.'),
    m('In ACID, "I" stands for:', ['Integrity', 'Isolation', 'Indexing', 'Integration'], 1, 'Isolation: concurrent transactions do not interfere.'),
    m('Which join returns all rows from the left table?', ['INNER JOIN', 'LEFT JOIN', 'CROSS JOIN', 'SELF JOIN'], 1, 'LEFT JOIN keeps unmatched left rows.'),
    m('Which command removes a table entirely?', ['DELETE', 'TRUNCATE', 'DROP TABLE', 'REMOVE'], 2, 'DROP TABLE deletes structure and data.'),
  ],
  Python: [
    m('What does `[1, 2, 3][-1]` return?', ['1', '2', '3', 'Error'], 2, 'Index -1 is the last element.'),
    m('Which of these is immutable?', ['list', 'dict', 'set', 'tuple'], 3, 'Tuples cannot be modified after creation.'),
    m('Which keyword defines a function?', ['func', 'def', 'function', 'lambda only'], 1, '`def name():` defines a function.'),
    m('What is the output of `print(2 ** 3)`?', ['6', '8', '9', '5'], 1, '** is exponentiation: 2³ = 8.'),
    m('Which dict method returns all keys?', ['keys()', 'values()', 'items()', 'get()'], 0, 'dict.keys() returns the keys.'),
    m('`list(range(3))` produces:', ['[1, 2, 3]', '[0, 1, 2]', '[0, 1, 2, 3]', '[1, 2]'], 1, 'range(3) starts at 0 and stops before 3.'),
  ],
}

export const SKILL_RESOURCES: Record<string, { beginner: string[]; intermediate: string[]; advanced: string[] }> = {
  DSA: { beginner: ['GeeksforGeeks DSA Self-Paced', 'Striver\'s A2Z Sheet (Easy)'], intermediate: ['LeetCode Top 100 Liked', 'NeetCode 150'], advanced: ['Codeforces Div. 2 contests', 'CP-Algorithms'] },
  'Web Dev': { beginner: ['MDN Web Docs Learn', 'freeCodeCamp Responsive Web Design'], intermediate: ['React official tutorial', 'The Odin Project'], advanced: ['Full-stack project with auth + deployment', 'Web performance (web.dev)'] },
  DBMS: { beginner: ['W3Schools SQL', 'NPTEL DBMS (IIT Kharagpur)'], intermediate: ['SQLZoo & LeetCode SQL 50', 'Normalization practice sets'], advanced: ['CMU Database Systems (15-445)', 'Query optimisation & indexing labs'] },
  Java: { beginner: ['Java Programming (MOOC.fi)', 'Java basics on HackerRank'], intermediate: ['Effective Java (selected items)', 'Practise OOP & collections problems'], advanced: ['Concurrency in Practice', 'Build a Spring Boot service'] },
  C: { beginner: ['The C Programming Language (K&R) ch. 1–4', 'Practise pointers on paper'], intermediate: ['Memory management with valgrind', 'Implement linked lists & stacks in C'], advanced: ['Build a shell or allocator in C', 'Systems programming (CS:APP)'] },
  SQL: { beginner: ['SQLBolt', 'W3Schools SQL'], intermediate: ['LeetCode SQL 50', 'Window functions practice'], advanced: ['Query plans & indexing', 'Design a normalised schema end-to-end'] },
  Python: { beginner: ['Python for Everybody (Coursera)', 'Automate the Boring Stuff'], intermediate: ['Real Python tutorials', 'HackerRank Python track'], advanced: ['Fluent Python', 'Build a REST API with FastAPI'] },
  Communication: { beginner: ['Daily 5-minute speaking practice', 'Toastmasters / college debate club'], intermediate: ['Practise STAR-format answers', 'Present a project demo to peers'], advanced: ['Lead a technical talk', 'Mentor juniors'] },
  Teamwork: { beginner: ['Join a group project', 'Pair-programming sessions'], intermediate: ['Take a role in a hackathon team', 'Practise giving peer feedback'], advanced: ['Coordinate cross-team events'] },
  'Problem Solving': { beginner: ['Daily logic puzzles', 'Break problems into small steps'], intermediate: ['Case-study practice', 'Design-thinking workshop'], advanced: ['System design basics', 'Open-source contributions'] },
  Leadership: { beginner: ['Volunteer for a small club task', 'Lead one study group'], intermediate: ['Run a club event end-to-end', 'Course: Leading Teams (Coursera)'], advanced: ['Contest for a club head position', 'Organise an inter-college event'] },
  'Time Management': { beginner: ['Use a weekly planner', 'Pomodoro technique'], intermediate: ['Eisenhower matrix prioritisation', 'Weekly review ritual'], advanced: ['Plan semester-long roadmaps with milestones'] },
}

/* ------------------------- situational judgment test ----------------------- */
export interface SJTScenario { id: string; skill: SoftSkill; scenario: string; options: { text: string; score: number }[] }
const s = (id: string, skill: SoftSkill, scenario: string, opts: [string, number][]): SJTScenario => ({ id, skill, scenario, options: opts.map(([text, score]) => ({ text, score })) })

export const SJT: SJTScenario[] = [
  s('c1', 'Communication', 'You must explain a complex technical idea to a classmate who is struggling. What do you do?', [
    ['Explain it with a simple analogy, then check their understanding with a question.', 100], ['Send them a link to the textbook chapter.', 40], ['Explain quickly in technical terms and move on.', 20], ['Tell them to ask the professor.', 10]]),
  s('c2', 'Communication', 'In a presentation, a faculty member asks a question you cannot answer. You…', [
    ['Admit you are unsure, share what you do know, and offer to follow up.', 100], ['Guess confidently to avoid looking weak.', 25], ['Stay silent until they move on.', 10], ['Blame the question for being out of syllabus.', 0]]),
  s('t1', 'Teamwork', 'A teammate isn\'t contributing before a deadline. What do you do?', [
    ['Talk to them privately, understand the issue, and redistribute work fairly.', 100], ['Complain to the professor immediately.', 35], ['Do their share silently and say nothing.', 45], ['Remove their name from the report.', 0]]),
  s('t2', 'Teamwork', 'Your team disagrees on the technology stack for the project. You…', [
    ['Listen to every view, list pros/cons, and decide together using agreed criteria.', 100], ['Push your own preference until others give in.', 25], ['Let the loudest person decide.', 35], ['Work separately on your own version.', 10]]),
  s('p1', 'Problem Solving', 'Your code passes locally but fails on the lab server an hour before submission. You…', [
    ['Compare environments, read error logs, and isolate the difference step by step.', 100], ['Rewrite everything from scratch.', 30], ['Ask a friend to fix it for you.', 20], ['Submit it and explain later.', 10]]),
  s('p2', 'Problem Solving', 'You have to solve a problem you\'ve never seen before. First step?', [
    ['Restate the problem, try small examples, and look for patterns.', 100], ['Search for the exact solution online and copy it.', 25], ['Skip it and move to easier ones.', 40], ['Wait for someone to share the answer.', 10]]),
  s('l1', 'Leadership', 'You are made team lead for a hackathon with strong and weak members. You…', [
    ['Match tasks to strengths, set check-ins, and support the weaker members.', 100], ['Take on the hardest tasks yourself.', 45], ['Give everyone identical tasks regardless of skill.', 30], ['Let the team self-organise with no plan.', 20]]),
  s('l2', 'Leadership', 'Your club event is falling behind schedule. What do you do?', [
    ['Re-prioritise tasks, delegate clearly, and communicate the new plan to everyone.', 100], ['Work through the night alone.', 40], ['Cancel the event.', 10], ['Blame the members publicly.', 0]]),
  s('m1', 'Time Management', 'You have 3 assignments, a quiz, and a club event in the same week. You…', [
    ['List tasks by deadline and importance, schedule time blocks, and start with the most urgent.', 100], ['Do the easiest ones first and see what happens.', 45], ['Start the night before each deadline.', 20], ['Skip the quiz preparation.', 15]]),
  s('m2', 'Time Management', 'You keep getting distracted by your phone while studying. You…', [
    ['Use focus blocks (e.g. 25 minutes) with the phone out of reach, then take planned breaks.', 100], ['Promise yourself to focus harder.', 35], ['Study only when you "feel like it".', 15], ['Study with social media open.', 5]]),
]
