/**
 * AI service — the ONLY place that talks to an LLM.
 * The integrated demo uses realistic mock output; do not ship provider secrets to the browser.
 */

const KEY: string | undefined = undefined
export const aiIsLive = false

export interface ChatMsg { role: 'user' | 'assistant'; content: string }

/** Live model calls are disabled in the integrated, unauthenticated demo. */
export async function callLLM(_system: string, _messages: ChatMsg[], _maxTokens = 800): Promise<string | null> {
  return null
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
const tryJson = <T,>(txt: string | null): T | null => {
  if (!txt) return null
  const m = txt.match(/\{[\s\S]*\}/)
  try { return m ? (JSON.parse(m[0]) as T) : null } catch { return null }
}

/* ----------------------------- interview bank ----------------------------- */
export type InterviewType = 'HR' | 'Technical' | 'Mixed'
export type Difficulty = 'Easy' | 'Medium' | 'Hard'

interface Q { q: string; keywords: string[]; ideal: string }
const BANK: Record<string, Record<Difficulty, Q[]>> = {
  HR: {
    Easy: [
      { q: 'Tell me about yourself.', keywords: ['project', 'skill', 'college', 'interest', 'learn'], ideal: 'I am a third-year CSE student who enjoys building web apps. I led a team of four in a 24-hour codeathon, improved my DBMS skills through an NPTEL course, and I am now looking to apply these skills in a software engineering role.' },
      { q: 'What are your greatest strengths?', keywords: ['example', 'team', 'learn', 'consistent', 'solve'], ideal: 'My biggest strength is learning quickly. For example, I picked up React in three weeks to deliver our hackathon prototype, and teammates rely on me to unblock them.' },
      { q: 'Why do you want to work in the IT industry?', keywords: ['technology', 'impact', 'grow', 'problem', 'build'], ideal: 'I enjoy solving real problems with technology, and the industry offers fast learning and the chance to build products that impact many users.' },
    ],
    Medium: [
      { q: 'Describe a time you faced a conflict in a team. How did you handle it?', keywords: ['listen', 'situation', 'resolved', 'result', 'communicate'], ideal: 'In our project, two teammates disagreed on the architecture. I set up a short meeting, let both explain, listed pros and cons, and we chose a hybrid approach. We delivered on time and learned to document decisions.' },
      { q: 'Tell me about a failure and what you learned from it.', keywords: ['learned', 'mistake', 'improve', 'next', 'result'], ideal: 'I failed a backlog subject because I started preparing late. I built a weekly study plan and cleared it in the next attempt; now I plan ahead for every exam.' },
      { q: 'Where do you see yourself in five years?', keywords: ['grow', 'role', 'skills', 'contribute', 'lead'], ideal: 'I see myself as a strong engineer who has mastered the core stack, mentors juniors, and contributes to important design decisions.' },
    ],
    Hard: [
      { q: 'You have two job offers: higher pay at a service company, or lower pay at a product startup. How do you decide?', keywords: ['learning', 'growth', 'criteria', 'long-term', 'values'], ideal: 'I would compare learning opportunities, mentorship, long-term growth and financial needs. Early in my career I weigh learning most, so I would lean toward the role that gives me ownership and strong mentors.' },
      { q: 'Convince me why we should hire you over another equally qualified candidate.', keywords: ['value', 'example', 'unique', 'contribute', 'results'], ideal: 'Beyond skills, I bring proven ownership: I led a hackathon team to the finals, I learn fast, and I communicate clearly. I will contribute from the first month.' },
    ],
  },
  DSA: {
    Easy: [
      { q: 'What is the difference between a stack and a queue?', keywords: ['lifo', 'fifo', 'push', 'pop', 'enqueue'], ideal: 'A stack is LIFO — push and pop happen at the same end, like undo history. A queue is FIFO — enqueue at the rear, dequeue at the front, like a ticket line.' },
      { q: 'What is the time complexity of searching in a balanced BST?', keywords: ['log', 'height', 'balanced', 'compare'], ideal: 'O(log n), because every comparison discards half the tree and the height of a balanced BST is log n.' },
    ],
    Medium: [
      { q: 'Explain how a hash table works and how collisions are handled.', keywords: ['hash', 'bucket', 'chaining', 'probing', 'load factor'], ideal: 'A hash function maps keys to bucket indices for O(1) average access. Collisions are handled via chaining (linked lists per bucket) or open addressing (linear/quadratic probing), and resizing keeps the load factor low.' },
      { q: 'How would you detect a cycle in a linked list?', keywords: ['slow', 'fast', 'pointer', 'floyd', 'hash'], ideal: 'Use Floyd\'s tortoise-and-hare: a slow pointer moves one step, a fast pointer two. If they meet there is a cycle. O(n) time, O(1) space.' },
    ],
    Hard: [
      { q: 'Design an LRU cache with O(1) get and put.', keywords: ['hash', 'doubly', 'linked', 'evict', 'o(1)'], ideal: 'Combine a hash map (key → node) with a doubly linked list ordered by recency. On access move the node to the head; on insert beyond capacity evict the tail. Both operations are O(1).' },
    ],
  },
  DBMS: {
    Easy: [{ q: 'What is normalization and why is it needed?', keywords: ['redundancy', 'anomal', 'normal form', 'table'], ideal: 'Normalization organises data into tables to remove redundancy and avoid insert, update and delete anomalies, using normal forms like 1NF, 2NF, 3NF and BCNF.' }],
    Medium: [
      { q: 'Explain ACID properties with an example.', keywords: ['atomic', 'consisten', 'isolation', 'durab', 'transaction'], ideal: 'In a bank transfer: Atomicity — both debit and credit happen or neither; Consistency — total balance stays valid; Isolation — concurrent transfers don\'t interfere; Durability — committed changes survive a crash.' },
      { q: 'What is the difference between clustered and non-clustered indexes?', keywords: ['physical', 'order', 'pointer', 'one', 'leaf'], ideal: 'A clustered index defines the physical order of rows — only one per table. A non-clustered index is a separate structure with pointers to rows, and a table can have many.' },
    ],
    Hard: [{ q: 'How do you optimise a slow SQL query?', keywords: ['index', 'explain', 'join', 'select', 'plan'], ideal: 'Read the execution plan (EXPLAIN), add suitable indexes, avoid SELECT *, filter early, review join order and types, and denormalise or cache only when measurements justify it.' }],
  },
  OS: {
    Easy: [{ q: 'What is the difference between a process and a thread?', keywords: ['memory', 'share', 'address', 'lightweight', 'context'], ideal: 'A process has its own address space; threads within a process share memory and resources, making them lightweight with faster context switches.' }],
    Medium: [
      { q: 'Explain deadlock and the four necessary conditions.', keywords: ['mutual', 'hold', 'wait', 'preemption', 'circular'], ideal: 'Deadlock is when processes wait on each other forever. It needs mutual exclusion, hold-and-wait, no preemption and circular wait. Breaking any one prevents deadlock.' },
      { q: 'What is virtual memory and why is it useful?', keywords: ['paging', 'page', 'disk', 'address', 'fault'], ideal: 'Virtual memory lets processes use more memory than physically available by paging unused pages to disk, giving isolation and a large contiguous address space; page faults load pages on demand.' },
    ],
    Hard: [{ q: 'Compare Round Robin and Shortest Job First scheduling.', keywords: ['quantum', 'starvation', 'turnaround', 'preempt', 'fair'], ideal: 'Round Robin gives each process a time quantum — fair and good response time but more context switches. SJF minimises average waiting time but can starve long jobs and needs burst-time knowledge.' }],
  },
}

export interface InterviewTurn { question: string; answer: string }

/** Pick the next interview question (mock) — or let the LLM generate one when a key is set. */
export async function getInterviewQuestion(type: InterviewType, difficulty: Difficulty, history: InterviewTurn[]): Promise<string> {
  const asked = new Set(history.map((h) => h.question))
  if (KEY) {
    const sys = `You are a professional campus-placement interviewer. Interview type: ${type}. Difficulty: ${difficulty}. Ask ONE concise question at a time. Do not repeat questions. Reply with only the question.`
    const msgs: ChatMsg[] = [{ role: 'user', content: 'Start the interview.' }]
    history.forEach((h) => msgs.push({ role: 'assistant', content: h.question }, { role: 'user', content: h.answer }))
    const r = await callLLM(sys, msgs, 120)
    if (r) return r.trim()
  }
  await delay(600)
  const topics = type === 'HR' ? ['HR'] : type === 'Technical' ? ['DSA', 'DBMS', 'OS'] : ['HR', 'DSA', 'DBMS', 'OS']
  // rotate topics so mixed/technical interviews cover several areas
  const topic = topics[history.length % topics.length]
  const pool = BANK[topic][difficulty].concat(BANK[topic].Medium, BANK[topic].Easy)
  const next = pool.find((q) => !asked.has(q.q)) ?? Object.values(BANK).flatMap((b) => b[difficulty]).find((q) => !asked.has(q.q))
  return (next ?? BANK.HR.Easy[0]).q
}

function findQ(question: string): Q | undefined {
  return Object.values(BANK).flatMap((b) => Object.values(b).flat()).find((q) => q.q === question)
}

export interface InterviewEvaluation {
  overall: number
  communication: number
  technical: number
  confidence: number
  strengths: string[]
  improvements: string[]
  weakest: { question: string; yourAnswer: string; sampleAnswer: string }
  summary: string
}

const FILLERS = ['um', 'uh', 'like', 'basically', 'actually', 'you know', 'kind of', 'sort of']

/** Heuristic evaluation used when no LLM key is set. Scores length, keyword coverage, structure and filler words. */
function mockEvaluate(turns: InterviewTurn[], type: InterviewType): InterviewEvaluation {
  const per = turns.map((t) => {
    const words = t.answer.trim().split(/\s+/).filter(Boolean)
    const lc = t.answer.toLowerCase()
    const q = findQ(t.question)
    const kw = q ? q.keywords.filter((k) => lc.includes(k)).length / q.keywords.length : 0.4
    const lengthScore = Math.min(1, words.length / 45)
    const fillers = FILLERS.reduce((n, f) => n + (lc.match(new RegExp(`\\b${f}\\b`, 'g'))?.length ?? 0), 0)
    const hasExample = /(for example|for instance|in my|i built|i led|when i|during)/.test(lc) ? 1 : 0
    const tech = Math.round(35 + kw * 55 + lengthScore * 10)
    const comm = Math.round(40 + lengthScore * 35 + hasExample * 15 - Math.min(15, fillers * 4) + (words.length > 12 ? 5 : -15))
    const conf = Math.round(45 + lengthScore * 30 - Math.min(20, fillers * 5) + (/(i think maybe|not sure|i don't know)/.test(lc) ? -12 : 8))
    return { t, tech: Math.max(5, Math.min(98, tech)), comm: Math.max(5, Math.min(98, comm)), conf: Math.max(5, Math.min(98, conf)), words: words.length, fillers, hasExample, kw }
  })
  const mean = (f: (p: (typeof per)[number]) => number) => Math.round(per.reduce((a, p) => a + f(p), 0) / Math.max(1, per.length))
  const technical = mean((p) => p.tech), communication = mean((p) => p.comm), confidence = mean((p) => p.conf)
  const overall = Math.round(technical * 0.4 + communication * 0.3 + confidence * 0.3)
  const weak = [...per].sort((a, b) => a.tech + a.comm - (b.tech + b.comm))[0]
  const strengths: string[] = [], improvements: string[] = []
  if (communication >= 65) strengths.push('Clear, well-structured communication.')
  if (technical >= 65) strengths.push('Good coverage of key technical concepts.')
  if (per.some((p) => p.hasExample)) strengths.push('You backed answers with real examples.')
  if (confidence >= 65) strengths.push('Confident and steady delivery.')
  if (!strengths.length) strengths.push('You completed the full interview — consistency is a great start.')
  if (per.some((p) => p.words < 25)) improvements.push('Several answers were short. Aim for 4–6 sentences using the STAR format (Situation, Task, Action, Result).')
  if (per.reduce((a, p) => a + p.fillers, 0) > 2) improvements.push('Reduce filler words (um, like, basically) — pause briefly instead.')
  if (technical < 65) improvements.push('Revise core concepts and use precise terminology in technical answers.')
  if (!per.some((p) => p.hasExample)) improvements.push('Add a concrete example from a project or internship to each answer.')
  if (!improvements.length) improvements.push('Try the Hard difficulty next to stretch yourself.')
  const q = weak ? findQ(weak.t.question) : undefined
  return {
    overall, communication, technical, confidence, strengths, improvements,
    weakest: {
      question: weak?.t.question ?? '',
      yourAnswer: weak?.t.answer ?? '',
      sampleAnswer: q?.ideal ?? 'Structure your answer: a one-line direct answer, a short explanation, and a real example from your project work.',
    },
    summary: `${type} interview completed with ${turns.length} questions. ${overall >= 75 ? 'Strong performance.' : overall >= 55 ? 'Decent performance with clear room to improve.' : 'Needs more practice — focus on structure and depth.'}`,
  }
}

export async function evaluateInterview(turns: InterviewTurn[], type: InterviewType, difficulty: Difficulty): Promise<InterviewEvaluation> {
  if (KEY) {
    const sys = 'You are an expert interview evaluator. Return ONLY JSON: {"overall":0-100,"communication":0-100,"technical":0-100,"confidence":0-100,"strengths":[string],"improvements":[string],"weakest":{"question":string,"yourAnswer":string,"sampleAnswer":string},"summary":string}'
    const body = turns.map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer}`).join('\n\n')
    const r = tryJson<InterviewEvaluation>(await callLLM(sys, [{ role: 'user', content: `${type} interview, ${difficulty} difficulty.\n\n${body}` }], 1200))
    if (r && typeof r.overall === 'number') return r
  }
  await delay(1200)
  return mockEvaluate(turns, type)
}

/* --------------------------- video introduction --------------------------- */
export interface IntroScore { score: number; feedback: string }

export async function scoreIntroduction(transcript: string, seconds: number): Promise<IntroScore> {
  if (KEY) {
    const sys = 'You evaluate a 1-minute student self-introduction transcript for communication quality. Return ONLY JSON: {"score":0-100,"feedback":string}'
    const r = tryJson<IntroScore>(await callLLM(sys, [{ role: 'user', content: transcript }], 400))
    if (r && typeof r.score === 'number') return r
  }
  await delay(900)
  const words = transcript.trim().split(/\s+/).filter(Boolean)
  const wpm = seconds > 0 ? (words.length / seconds) * 60 : 0
  const lc = transcript.toLowerCase()
  const fillers = FILLERS.reduce((n, f) => n + (lc.match(new RegExp(`\\b${f}\\b`, 'g'))?.length ?? 0), 0)
  const structure = ['name', 'my', 'study', 'project', 'skill', 'goal', 'interest'].filter((k) => lc.includes(k)).length
  let score = 35 + Math.min(25, words.length / 3) + structure * 4 - Math.min(15, fillers * 3)
  if (wpm > 90 && wpm < 170) score += 8
  score = Math.round(Math.max(10, Math.min(95, score)))
  const tips: string[] = []
  if (words.length < 80) tips.push('Your introduction was brief — aim for around 120–150 words in a minute.')
  if (fillers > 2) tips.push(`You used ${fillers} filler words; pause instead.`)
  if (structure < 4) tips.push('Cover who you are, what you study, a project or skill, and your goal.')
  if (wpm && (wpm < 90 || wpm > 170)) tips.push(wpm < 90 ? 'Speak a little faster for energy.' : 'Slow down slightly so every word lands.')
  return { score, feedback: tips.length ? tips.join(' ') : 'Well-structured and well-paced introduction. Keep the confident tone.' }
}
