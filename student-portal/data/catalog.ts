import type { CatalogSubject } from '@student/types'

export type BranchCode = 'CSE' | 'IT' | 'ECE' | 'MECH' | 'CIVIL'
export const BRANCH_CODES: BranchCode[] = ['CSE', 'IT', 'ECE', 'MECH', 'CIVIL']

const t = (code: string, name: string, short: string, credits: number, semester: number, teacher: string): CatalogSubject => ({
  code, name, short, credits, semester, teacher,
})

/** Every subject taught in any branch. A subject code is unique and belongs to one semester. */
export const CATALOG: CatalogSubject[] = [
  // ---- common first-year subjects
  t('MA101', 'Engineering Mathematics I', 'Maths I', 4, 1, 'Dr. R. Iyer'),
  t('PH101', 'Engineering Physics', 'Physics', 3, 1, 'Dr. S. Kulkarni'),
  t('EE101', 'Basic Electrical Engineering', 'BEE', 3, 1, 'Prof. A. Nair'),
  t('ME101', 'Engineering Graphics', 'Graphics', 2, 1, 'Prof. P. Joshi'),
  t('HS101', 'Communication Skills', 'Comm.', 2, 1, 'Dr. L. Fernandes'),
  t('MA102', 'Engineering Mathematics II', 'Maths II', 4, 2, 'Dr. R. Iyer'),
  t('CH102', 'Engineering Chemistry', 'Chemistry', 3, 2, 'Dr. V. Menon'),
  t('EV102', 'Environmental Science', 'EVS', 2, 2, 'Dr. T. George'),
  t('MG301', 'Engineering Economics', 'Economics', 2, 4, 'Dr. A. Shah'),

  // ---- CSE / IT
  t('CS101', 'Programming in C', 'C Prog.', 4, 1, 'Prof. M. Desai'),
  t('CS102', 'Data Structures', 'DS', 4, 2, 'Prof. K. Reddy'),
  t('EC102', 'Digital Logic Design', 'DLD', 3, 2, 'Prof. N. Bhatt'),
  t('CS103', 'Object Oriented Programming', 'OOP', 4, 2, 'Prof. M. Desai'),
  t('MA201', 'Discrete Mathematics', 'Discrete', 4, 3, 'Dr. S. Banerjee'),
  t('CS201', 'Computer Organization', 'COA', 3, 3, 'Prof. N. Bhatt'),
  t('CS202', 'Design & Analysis of Algorithms', 'DAA', 4, 3, 'Prof. K. Reddy'),
  t('CS203', 'Python Programming', 'Python', 3, 3, 'Prof. D. Kapoor'),
  t('MA202', 'Probability & Statistics', 'Prob&Stat', 3, 3, 'Dr. S. Banerjee'),
  t('CS204', 'Web Technologies', 'Web Tech', 3, 3, 'Prof. D. Kapoor'),
  t('CS301', 'Microprocessors', 'MPI', 3, 4, 'Prof. N. Bhatt'),
  t('CS302', 'Advanced Data Structures', 'Adv. DS', 4, 4, 'Prof. K. Reddy'),
  t('CS303', 'Computer Graphics', 'CG', 3, 4, 'Prof. P. Joshi'),
  t('CS304', 'Java Enterprise Development', 'Java EE', 3, 4, 'Prof. M. Desai'),
  t('CS305', 'Data Analytics Lab', 'DA Lab', 2, 4, 'Prof. D. Kapoor'),
  t('CS401', 'Database Management Systems', 'DBMS', 4, 5, 'Dr. Meera Pillai'),
  t('CS402', 'Operating Systems', 'OS', 4, 5, 'Prof. Rohit Verma'),
  t('CS403', 'Computer Networks', 'CN', 4, 5, 'Prof. Anita Rao'),
  t('CS404', 'Theory of Computation', 'TOC', 3, 5, 'Dr. S. Banerjee'),
  t('CS405', 'Software Engineering', 'SE', 3, 5, 'Prof. Kavita Singh'),
  t('CS406', 'AI & Machine Learning (Elective)', 'AI/ML', 3, 5, 'Dr. Arvind Nambiar'),
  t('IT401', 'Information Security', 'InfoSec', 3, 5, 'Dr. Farah Khan'),
  t('IT402', 'Cloud Computing (Elective)', 'Cloud', 3, 5, 'Prof. Vikram Sethi'),

  // ---- ECE
  t('EC101', 'Basic Electronics', 'Basic Elec.', 3, 1, 'Prof. N. Bhatt'),
  t('EC103', 'Network Analysis', 'Networks', 3, 2, 'Prof. S. Pandey'),
  t('EC104', 'Electronic Devices', 'Devices', 4, 2, 'Dr. H. Mukherjee'),
  t('MA203', 'Complex Analysis', 'Complex An.', 4, 3, 'Dr. S. Banerjee'),
  t('EC201', 'Analog Circuits', 'Analog', 4, 3, 'Dr. H. Mukherjee'),
  t('EC202', 'Signals & Systems', 'S&S', 4, 3, 'Prof. S. Pandey'),
  t('EC203', 'Digital Signal Processing', 'DSP', 3, 3, 'Prof. R. Chawla'),
  t('EC204', 'Electromagnetic Theory', 'EMT', 3, 3, 'Dr. B. Sinha'),
  t('EC205', 'Electronic Measurements', 'Measure.', 3, 3, 'Prof. R. Chawla'),
  t('EC301', 'Microprocessors & Microcontrollers', 'MPMC', 4, 4, 'Prof. N. Bhatt'),
  t('EC302', 'Analog Communication', 'Analog Comm.', 3, 4, 'Dr. B. Sinha'),
  t('EC303', 'Control Systems', 'Control', 4, 4, 'Prof. S. Pandey'),
  t('EC304', 'VLSI Design', 'VLSI', 3, 4, 'Dr. H. Mukherjee'),
  t('EC305', 'Communication Lab', 'Comm. Lab', 2, 4, 'Prof. R. Chawla'),
  t('EC401', 'Digital Communication', 'Digital Comm.', 4, 5, 'Dr. B. Sinha'),
  t('EC402', 'Embedded Systems', 'Embedded', 4, 5, 'Prof. N. Bhatt'),
  t('EC403', 'Antennas & Wave Propagation', 'Antennas', 3, 5, 'Dr. B. Sinha'),
  t('EC404', 'Information Theory & Coding', 'ITC', 3, 5, 'Prof. S. Pandey'),
  t('EC405', 'Power Electronics', 'Power Elec.', 3, 5, 'Dr. H. Mukherjee'),
  t('EC406', 'IoT & Wireless Sensors (Elective)', 'IoT', 3, 5, 'Prof. R. Chawla'),

  // ---- Mechanical
  t('ME103', 'Workshop Practice', 'Workshop', 3, 1, 'Prof. P. Joshi'),
  t('ME104', 'Engineering Mechanics', 'Mechanics', 4, 2, 'Dr. G. Deshmukh'),
  t('ME105', 'Thermodynamics', 'Thermo', 4, 2, 'Prof. A. Tiwari'),
  t('ME106', 'Materials Science', 'Materials', 3, 2, 'Dr. G. Deshmukh'),
  t('MA204', 'Applied Mathematics', 'Applied Maths', 4, 3, 'Dr. R. Iyer'),
  t('ME201', 'Fluid Mechanics', 'Fluids', 4, 3, 'Prof. A. Tiwari'),
  t('ME202', 'Strength of Materials', 'SOM', 4, 3, 'Dr. G. Deshmukh'),
  t('ME203', 'Manufacturing Processes', 'Manufact.', 3, 3, 'Prof. P. Joshi'),
  t('ME204', 'Kinematics of Machinery', 'Kinematics', 3, 3, 'Prof. S. Rathore'),
  t('ME205', 'Thermal Engineering', 'Thermal', 3, 3, 'Prof. A. Tiwari'),
  t('ME301', 'Heat Transfer', 'Heat Transfer', 4, 4, 'Prof. A. Tiwari'),
  t('ME302', 'Machine Design I', 'Mach. Design I', 4, 4, 'Prof. S. Rathore'),
  t('ME303', 'Dynamics of Machinery', 'DOM', 3, 4, 'Prof. S. Rathore'),
  t('ME304', 'Fluid Machinery', 'Fluid Mach.', 3, 4, 'Prof. A. Tiwari'),
  t('ME305', 'CAD Lab', 'CAD Lab', 2, 4, 'Prof. P. Joshi'),
  t('ME401', 'Machine Design II', 'Mach. Design II', 4, 5, 'Prof. S. Rathore'),
  t('ME402', 'Refrigeration & Air Conditioning', 'RAC', 3, 5, 'Prof. A. Tiwari'),
  t('ME403', 'Industrial Engineering', 'Ind. Eng.', 3, 5, 'Dr. M. Kapadia'),
  t('ME404', 'Mechatronics', 'Mechatronics', 4, 5, 'Dr. G. Deshmukh'),
  t('ME405', 'Finite Element Methods', 'FEM', 3, 5, 'Dr. G. Deshmukh'),
  t('ME406', 'Robotics (Elective)', 'Robotics', 3, 5, 'Prof. P. Joshi'),

  // ---- Civil
  t('CE101', 'Civil Engineering Materials', 'CE Materials', 3, 1, 'Dr. U. Bhosale'),
  t('CE102', 'Engineering Mechanics (Civil)', 'Mechanics', 4, 2, 'Dr. U. Bhosale'),
  t('CE103', 'Building Construction', 'Building Con.', 3, 2, 'Prof. J. Waghmare'),
  t('CE104', 'Fluid Mechanics I', 'Fluids I', 4, 2, 'Prof. D. Naik'),
  t('MA205', 'Numerical Methods', 'Num. Methods', 4, 3, 'Dr. S. Banerjee'),
  t('CE201', 'Strength of Materials (Civil)', 'SOM', 4, 3, 'Dr. U. Bhosale'),
  t('CE202', 'Structural Analysis I', 'Struct. An. I', 4, 3, 'Prof. J. Waghmare'),
  t('CE203', 'Surveying', 'Surveying', 3, 3, 'Prof. D. Naik'),
  t('CE204', 'Concrete Technology', 'Concrete', 3, 3, 'Prof. J. Waghmare'),
  t('CE205', 'Hydraulics', 'Hydraulics', 3, 3, 'Prof. D. Naik'),
  t('CE301', 'Structural Analysis II', 'Struct. An. II', 4, 4, 'Prof. J. Waghmare'),
  t('CE302', 'Geotechnical Engineering', 'Geotech', 4, 4, 'Dr. U. Bhosale'),
  t('CE303', 'Transportation Engineering', 'Transport', 3, 4, 'Prof. D. Naik'),
  t('CE304', 'Design of RC Structures', 'RCC Design', 4, 4, 'Prof. J. Waghmare'),
  t('CE305', 'Surveying Lab', 'Survey Lab', 2, 4, 'Prof. D. Naik'),
  t('CE401', 'Environmental Engineering', 'Env. Eng.', 3, 5, 'Dr. T. George'),
  t('CE402', 'Design of Steel Structures', 'Steel Design', 4, 5, 'Prof. J. Waghmare'),
  t('CE403', 'Water Resources Engineering', 'Water Res.', 3, 5, 'Prof. D. Naik'),
  t('CE404', 'Construction Management', 'Const. Mgmt', 3, 5, 'Dr. M. Kapadia'),
  t('CE405', 'Foundation Engineering', 'Foundation', 4, 5, 'Dr. U. Bhosale'),
  t('CE406', 'Remote Sensing & GIS (Elective)', 'GIS', 3, 5, 'Prof. D. Naik'),
]

const FIRST_YEAR = (dept: string[], sem2: string[]): string[][] => [
  ['MA101', 'PH101', 'EE101', 'ME101', 'HS101', dept[0]],
  ['MA102', 'CH102', 'EV102', ...sem2],
]
const CSE_SEMS: string[][] = [
  ...FIRST_YEAR(['CS101'], ['CS102', 'EC102', 'CS103']),
  ['MA201', 'CS201', 'CS202', 'CS203', 'MA202', 'CS204'],
  ['CS301', 'CS302', 'CS303', 'CS304', 'MG301', 'CS305'],
  ['CS401', 'CS402', 'CS403', 'CS404', 'CS405', 'CS406'],
]

/** Subject codes per branch, indexed by semester - 1. Every semester has exactly six subjects. */
export const BRANCH_SUBJECT_CODES: Record<BranchCode, string[][]> = {
  CSE: CSE_SEMS,
  IT: [...CSE_SEMS.slice(0, 4), ['CS401', 'CS402', 'CS403', 'IT401', 'CS405', 'IT402']],
  ECE: [
    ...FIRST_YEAR(['EC101'], ['EC102', 'EC103', 'EC104']),
    ['MA203', 'EC201', 'EC202', 'EC203', 'EC204', 'EC205'],
    ['EC301', 'EC302', 'EC303', 'EC304', 'MG301', 'EC305'],
    ['EC401', 'EC402', 'EC403', 'EC404', 'EC405', 'EC406'],
  ],
  MECH: [
    ...FIRST_YEAR(['ME103'], ['ME104', 'ME105', 'ME106']),
    ['MA204', 'ME201', 'ME202', 'ME203', 'ME204', 'ME205'],
    ['ME301', 'ME302', 'ME303', 'ME304', 'MG301', 'ME305'],
    ['ME401', 'ME402', 'ME403', 'ME404', 'ME405', 'ME406'],
  ],
  CIVIL: [
    ...FIRST_YEAR(['CE101'], ['CE102', 'CE103', 'CE104']),
    ['MA205', 'CE201', 'CE202', 'CE203', 'CE204', 'CE205'],
    ['CE301', 'CE302', 'CE303', 'CE304', 'MG301', 'CE305'],
    ['CE401', 'CE402', 'CE403', 'CE404', 'CE405', 'CE406'],
  ],
}

const BY_CODE = new Map(CATALOG.map((s) => [s.code, s]))

export const isBranchCode = (v: string): v is BranchCode => (BRANCH_CODES as string[]).includes(v)

/** Subjects of one semester for a branch (defaults to CSE, the original demo branch). */
export const subjectsOfSemester = (sem: number, branch: BranchCode = 'CSE'): CatalogSubject[] =>
  (BRANCH_SUBJECT_CODES[branch][sem - 1] ?? []).map((code) => BY_CODE.get(code)!)
export const subjectByCode = (code: string) => BY_CODE.get(code)!

export const TOPICS: Record<string, string[]> = {
  CS401: ['ER Modelling', 'Relational Algebra', 'SQL Basics', 'Joins & Subqueries', 'Normalization (1NF–3NF)', 'BCNF', 'Transactions & ACID', 'Concurrency Control', 'Indexing & B+ Trees', 'Query Optimization', 'Recovery Techniques', 'NoSQL Overview'],
  CS402: ['Process Concepts', 'Threads', 'CPU Scheduling', 'Synchronization', 'Semaphores & Monitors', 'Deadlocks', 'Memory Management', 'Paging', 'Segmentation', 'Virtual Memory', 'File Systems', 'Disk Scheduling'],
  CS403: ['OSI & TCP/IP Models', 'Physical Layer', 'Data Link Layer', 'Error Detection', 'MAC Protocols', 'IP Addressing', 'Subnetting', 'Routing Algorithms', 'TCP Congestion Control', 'UDP & Sockets', 'DNS & HTTP', 'Network Security'],
  CS404: ['Finite Automata', 'NFA to DFA', 'Regular Expressions', 'Pumping Lemma', 'Context-Free Grammars', 'Pushdown Automata', 'Turing Machines', 'Decidability', 'Halting Problem', 'P vs NP', 'NP-Completeness', 'Reductions'],
  CS405: ['SDLC Models', 'Agile & Scrum', 'Requirements Engineering', 'UML Diagrams', 'Design Patterns', 'Software Testing', 'Black/White Box Testing', 'Project Estimation', 'Risk Management', 'Version Control', 'CI/CD', 'Maintenance'],
  CS406: ['Intro to AI', 'Search Strategies', 'Linear Regression', 'Logistic Regression', 'Decision Trees', 'KNN & SVM', 'Neural Networks', 'Backpropagation', 'Clustering', 'Model Evaluation', 'CNN Basics', 'Ethics in AI'],
}

/** Lecture topics of a subject; subjects without a hand-written syllabus fall back to numbered units. */
export const topicsFor = (code: string): string[] =>
  TOPICS[code] ?? Array.from({ length: 8 }, (_, i) => `${subjectByCode(code).short} — Unit ${i + 1}`)
