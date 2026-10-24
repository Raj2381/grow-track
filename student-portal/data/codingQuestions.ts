import type { CodingLanguage } from '@student/types'

export type CodingQType = 'mcq' | 'output' | 'sql_query'
export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export interface CodingQuestion {
  id: string
  language: CodingLanguage
  type: CodingQType
  difficulty: Difficulty
  topic: string
  question: string
  code?: string
  options?: string[]
  /** option text for mcq/output; the reference query for sql_query */
  answer: string
  expectedQuery?: string
  explanation: string
}

const q = (x: CodingQuestion) => x

/** Sample table available to every SQL question (created in sql.js at test time). */
export const SQL_SCHEMA = `CREATE TABLE students (id INT, name TEXT, dept TEXT, cgpa REAL);
INSERT INTO students VALUES
 (1,'Aarav','CSE',8.7),(2,'Diya','IT',7.9),(3,'Rohan','CSE',6.8),
 (4,'Sneha','ECE',9.1),(5,'Kabir','CSE',8.2),(6,'Ananya','IT',NULL);`

export const SQL_TABLE_ROWS = [
  [1, 'Aarav', 'CSE', 8.7], [2, 'Diya', 'IT', 7.9], [3, 'Rohan', 'CSE', 6.8],
  [4, 'Sneha', 'ECE', 9.1], [5, 'Kabir', 'CSE', 8.2], [6, 'Ananya', 'IT', null],
]

export const CODING_QUESTIONS: CodingQuestion[] = [
  /* ------------------------------- JAVA ------------------------------- */
  q({ id: 'J1', language: 'Java', type: 'output', difficulty: 'Easy', topic: 'Operators', question: 'What is the output?',
    code: 'int x = 5;\nSystem.out.println(x++ + ++x);', options: ['10', '11', '12', '13'], answer: '12',
    explanation: 'x++ uses 5 then x becomes 6; ++x makes x 7 and uses 7. 5 + 7 = 12.' }),
  q({ id: 'J2', language: 'Java', type: 'mcq', difficulty: 'Easy', topic: 'Data Types', question: 'Which of these is NOT a primitive type in Java?',
    options: ['int', 'boolean', 'String', 'char'], answer: 'String', explanation: 'String is a class (reference type), not a primitive.' }),
  q({ id: 'J3', language: 'Java', type: 'output', difficulty: 'Medium', topic: 'Strings', question: 'What is the output?',
    code: 'String s1 = "hi";\nString s2 = new String("hi");\nSystem.out.println(s1 == s2);', options: ['true', 'false', 'Compile error', 'hi'], answer: 'false',
    explanation: '== compares references. new String() creates a separate object. Use equals() to compare content.' }),
  q({ id: 'J4', language: 'Java', type: 'output', difficulty: 'Easy', topic: 'Operators', question: 'What is the output?',
    code: 'System.out.println(10 / 3);', options: ['3.33', '3', '3.0', '4'], answer: '3', explanation: 'Both operands are int, so integer division drops the decimal.' }),
  q({ id: 'J5', language: 'Java', type: 'mcq', difficulty: 'Easy', topic: 'OOP', question: 'Which keyword prevents a method from being overridden?',
    options: ['static', 'final', 'private', 'abstract'], answer: 'final', explanation: 'A final method cannot be overridden by subclasses.' }),
  q({ id: 'J6', language: 'Java', type: 'mcq', difficulty: 'Medium', topic: 'OOP', question: 'What is the default value of an int instance variable?',
    options: ['0', 'null', 'Garbage value', '-1'], answer: '0', explanation: 'Instance variables get default values; local variables do not.' }),
  q({ id: 'J7', language: 'Java', type: 'mcq', difficulty: 'Hard', topic: 'Exceptions', question: 'Which of these is a checked exception?',
    options: ['NullPointerException', 'ArithmeticException', 'IOException', 'ArrayIndexOutOfBoundsException'], answer: 'IOException',
    explanation: 'Checked exceptions must be handled or declared; the others are runtime (unchecked) exceptions.' }),
  q({ id: 'J8', language: 'Java', type: 'output', difficulty: 'Easy', topic: 'Arrays', question: 'What is the output?',
    code: 'int[] a = {1, 2, 3};\nSystem.out.println(a.length);', options: ['2', '3', '4', 'Compile error'], answer: '3', explanation: 'For arrays, length is a field holding the number of elements.' }),
  q({ id: 'J9', language: 'Java', type: 'output', difficulty: 'Medium', topic: 'Loops', question: 'What is the output?',
    code: 'for (int i = 0; i < 3; i++) {\n    if (i == 1) continue;\n    System.out.print(i);\n}', options: ['012', '02', '01', '2'], answer: '02',
    explanation: 'continue skips the rest of the body when i == 1, so only 0 and 2 are printed.' }),
  q({ id: 'J10', language: 'Java', type: 'mcq', difficulty: 'Medium', topic: 'OOP', question: 'Which concept lets a subclass provide its own implementation of a superclass method?',
    options: ['Overloading', 'Overriding', 'Encapsulation', 'Abstraction'], answer: 'Overriding', explanation: 'Overriding redefines an inherited method with the same signature; overloading uses different parameters.' }),

  /* ------------------------------ PYTHON ------------------------------ */
  q({ id: 'P1', language: 'Python', type: 'output', difficulty: 'Easy', topic: 'Lists', question: 'What is the output?',
    code: 'x = [1, 2, 3]\ny = x\ny.append(4)\nprint(x)', options: ['[1, 2, 3]', '[1, 2, 3, 4]', 'Error', '[4]'], answer: '[1, 2, 3, 4]',
    explanation: 'y = x does not copy the list; both names point to the same list.' }),
  q({ id: 'P2', language: 'Python', type: 'output', difficulty: 'Easy', topic: 'Operators', question: 'What is the output?',
    code: 'print(3 // 2, 3 / 2)', options: ['1 1', '1 1.5', '1.5 1.5', '1.5 1'], answer: '1 1.5', explanation: '// is floor division; / always returns a float.' }),
  q({ id: 'P3', language: 'Python', type: 'output', difficulty: 'Easy', topic: 'Strings', question: 'What is the output?',
    code: 'print("abc"[::-1])', options: ['abc', 'cba', 'c', 'Error'], answer: 'cba', explanation: 'A step of -1 reverses the string.' }),
  q({ id: 'P4', language: 'Python', type: 'mcq', difficulty: 'Easy', topic: 'Data Types', question: 'Which of these is immutable?',
    options: ['list', 'dict', 'set', 'tuple'], answer: 'tuple', explanation: 'Tuples cannot be modified after creation; lists, dicts and sets can.' }),
  q({ id: 'P5', language: 'Python', type: 'output', difficulty: 'Hard', topic: 'Functions', question: 'What is the output?',
    code: 'def f(a, b=[]):\n    b.append(a)\n    return b\n\nf(1)\nprint(f(2))', options: ['[2]', '[1, 2]', '[1]', 'Error'], answer: '[1, 2]',
    explanation: 'The default list is created once and shared between calls.' }),
  q({ id: 'P6', language: 'Python', type: 'output', difficulty: 'Medium', topic: 'Sets', question: 'What is the output?',
    code: 'print(len({1, 2, 2, 3}))', options: ['4', '3', '2', 'Error'], answer: '3', explanation: 'Sets remove duplicates.' }),
  q({ id: 'P7', language: 'Python', type: 'output', difficulty: 'Medium', topic: 'Comprehensions', question: 'What is the output?',
    code: 'print([i * i for i in range(5) if i % 2 == 0])', options: ['[0, 4, 16]', '[1, 9]', '[0, 1, 4, 9, 16]', '[4, 16]'], answer: '[0, 4, 16]',
    explanation: 'Even values of range(5) are 0, 2, 4; their squares are 0, 4, 16.' }),
  q({ id: 'P8', language: 'Python', type: 'mcq', difficulty: 'Medium', topic: 'Functions', question: 'What does *args allow in a function definition?',
    options: ['Passing keyword arguments only', 'Passing a variable number of positional arguments', 'Passing a pointer', 'Unpacking a dictionary'], answer: 'Passing a variable number of positional arguments',
    explanation: '*args collects extra positional arguments into a tuple; **kwargs collects keyword arguments.' }),
  q({ id: 'P9', language: 'Python', type: 'output', difficulty: 'Easy', topic: 'Strings', question: 'What is the output?',
    code: 'print("Hello".upper().lower()[:2])', options: ['HE', 'he', 'Hel', 'Error'], answer: 'he', explanation: 'upper() then lower() gives "hello"; slicing the first two characters gives "he".' }),
  q({ id: 'P10', language: 'Python', type: 'output', difficulty: 'Medium', topic: 'Dictionaries', question: 'What is the output?',
    code: "d = {'a': 1, 'b': 2}\nd['c'] = 3\nprint(len(d))", options: ['2', '3', '1', 'Error'], answer: '3', explanation: 'Assigning to a new key adds an entry, so there are three keys.' }),

  /* --------------------------------- C --------------------------------- */
  q({ id: 'C1', language: 'C', type: 'output', difficulty: 'Easy', topic: 'Arrays', question: 'What is the output?',
    code: 'int a[5] = {1, 2, 3};\nprintf("%d", a[4]);', options: ['3', 'Garbage value', '0', 'Error'], answer: '0', explanation: 'When an array is partly initialised, remaining elements become 0.' }),
  q({ id: 'C2', language: 'C', type: 'mcq', difficulty: 'Easy', topic: 'Data Types', question: 'What is sizeof(char) in C?',
    options: ['1', '2', '4', 'Depends on compiler'], answer: '1', explanation: 'The C standard defines sizeof(char) as exactly 1.' }),
  q({ id: 'C3', language: 'C', type: 'output', difficulty: 'Medium', topic: 'Pointers', question: 'What is the output?',
    code: 'int a = 5;\nint *p = &a;\n*p = 10;\nprintf("%d", a);', options: ['5', '10', 'Address of a', 'Error'], answer: '10', explanation: "*p changes the value stored at a's address." }),
  q({ id: 'C4', language: 'C', type: 'mcq', difficulty: 'Easy', topic: 'Memory', question: 'Which function allocates memory dynamically?',
    options: ['alloc()', 'malloc()', 'new', 'create()'], answer: 'malloc()', explanation: 'malloc() (from <stdlib.h>) allocates a block on the heap; new is C++.' }),
  q({ id: 'C5', language: 'C', type: 'output', difficulty: 'Medium', topic: 'Strings', question: 'What is the output?',
    code: 'char s[] = "hello";\nprintf("%zu", sizeof(s));', options: ['5', '6', '4', '8'], answer: '6', explanation: "5 characters plus the '\\0' terminator." }),
  q({ id: 'C6', language: 'C', type: 'output', difficulty: 'Hard', topic: 'Loops', question: 'What is the output?',
    code: 'int i;\nfor (i = 0; i < 5; i++);\nprintf("%d", i);', options: ['0 1 2 3 4', '4', '5', 'Error'], answer: '5',
    explanation: 'The semicolon after the for loop makes the loop body empty. The loop finishes with i = 5, then printf runs once.' }),
  q({ id: 'C7', language: 'C', type: 'output', difficulty: 'Medium', topic: 'Operators', question: 'What is the output?',
    code: 'int x = 7;\nprintf("%d", x >> 1);', options: ['3', '4', '14', '7'], answer: '3', explanation: 'Right shift by 1 divides by 2 (integer): 7 >> 1 = 3.' }),
  q({ id: 'C8', language: 'C', type: 'mcq', difficulty: 'Medium', topic: 'Pointers', question: 'What does a NULL pointer represent?',
    options: ['A pointer to the integer zero', 'A pointer that points to nothing', 'An uninitialised pointer', 'A pointer to the first array element'], answer: 'A pointer that points to nothing',
    explanation: 'NULL is a defined "no object" value. Dereferencing it is undefined behaviour.' }),
  q({ id: 'C9', language: 'C', type: 'output', difficulty: 'Easy', topic: 'Operators', question: 'What is the output?',
    code: 'printf("%d", 5 % 3);', options: ['1', '2', '0', '1.67'], answer: '2', explanation: '% gives the remainder: 5 = 1×3 + 2.' }),
  q({ id: 'C10', language: 'C', type: 'output', difficulty: 'Medium', topic: 'Pointers', question: 'What is the output?',
    code: 'int a[] = {10, 20, 30};\nint *p = a;\nprintf("%d", *(p + 2));', options: ['10', '20', '30', 'An address'], answer: '30', explanation: 'Pointer arithmetic: p + 2 points at a[2], which is 30.' }),

  /* --------------------------------- SQL -------------------------------- */
  q({ id: 'S1', language: 'SQL', type: 'mcq', difficulty: 'Easy', topic: 'Clauses', question: 'Which clause filters groups after GROUP BY?',
    options: ['WHERE', 'HAVING', 'ORDER BY', 'FILTER'], answer: 'HAVING', explanation: 'WHERE filters rows before grouping; HAVING filters the groups.' }),
  q({ id: 'S2', language: 'SQL', type: 'mcq', difficulty: 'Easy', topic: 'DDL', question: 'Which command removes the table structure along with its data?',
    options: ['DELETE', 'TRUNCATE', 'DROP', 'REMOVE'], answer: 'DROP', explanation: 'DROP removes the table entirely; DELETE and TRUNCATE remove rows only.' }),
  q({ id: 'S3', language: 'SQL', type: 'mcq', difficulty: 'Medium', topic: 'Joins', question: 'Which join returns all rows from the left table, even without a match?',
    options: ['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'CROSS JOIN'], answer: 'LEFT JOIN', explanation: 'LEFT JOIN keeps every left row and fills unmatched right columns with NULL.' }),
  q({ id: 'S4', language: 'SQL', type: 'output', difficulty: 'Medium', topic: 'Aggregates', question: 'Using the students table, what does this query return?',
    code: 'SELECT COUNT(cgpa) FROM students;', options: ['6', '5', '0', 'Error'], answer: '5', explanation: 'COUNT(column) ignores NULLs; COUNT(*) would return 6.' }),
  q({ id: 'S5', language: 'SQL', type: 'sql_query', difficulty: 'Medium', topic: 'Filtering',
    question: 'Write a query to show the names of CSE students with CGPA above 8, highest CGPA first.',
    answer: "SELECT name FROM students WHERE dept = 'CSE' AND cgpa > 8 ORDER BY cgpa DESC;",
    expectedQuery: "SELECT name FROM students WHERE dept = 'CSE' AND cgpa > 8 ORDER BY cgpa DESC;",
    explanation: "Filter with WHERE dept = 'CSE' AND cgpa > 8 and sort with ORDER BY cgpa DESC. Expected: Aarav, Kabir (order matters)." }),
  q({ id: 'S6', language: 'SQL', type: 'sql_query', difficulty: 'Medium', topic: 'Grouping',
    question: 'Write a query to show each department and the number of students in it.',
    answer: 'SELECT dept, COUNT(*) FROM students GROUP BY dept;', expectedQuery: 'SELECT dept, COUNT(*) FROM students GROUP BY dept;',
    explanation: 'GROUP BY dept with COUNT(*). Expected: CSE 3, ECE 1, IT 2 (order does not matter).' }),
  q({ id: 'S7', language: 'SQL', type: 'sql_query', difficulty: 'Easy', topic: 'Filtering',
    question: 'Write a query to show all columns for students in the IT department.',
    answer: "SELECT * FROM students WHERE dept = 'IT';", expectedQuery: "SELECT * FROM students WHERE dept = 'IT';",
    explanation: "SELECT * with WHERE dept = 'IT'. Expected: Diya and Ananya." }),
  q({ id: 'S8', language: 'SQL', type: 'sql_query', difficulty: 'Hard', topic: 'Grouping',
    question: 'Write a query to show each department with its average CGPA, only for departments whose average CGPA is above 8.',
    answer: 'SELECT dept, AVG(cgpa) FROM students GROUP BY dept HAVING AVG(cgpa) > 8;', expectedQuery: 'SELECT dept, AVG(cgpa) FROM students GROUP BY dept HAVING AVG(cgpa) > 8;',
    explanation: 'Use GROUP BY dept and filter the groups with HAVING AVG(cgpa) > 8. Only ECE (9.1) qualifies; AVG ignores NULLs.' }),
  q({ id: 'S9', language: 'SQL', type: 'mcq', difficulty: 'Easy', topic: 'Clauses', question: 'Which keyword removes duplicate rows from a SELECT result?',
    options: ['UNIQUE', 'DISTINCT', 'DIFFERENT', 'REMOVE'], answer: 'DISTINCT', explanation: 'SELECT DISTINCT returns each unique row once.' }),
  q({ id: 'S10', language: 'SQL', type: 'output', difficulty: 'Medium', topic: 'NULL Handling', question: 'Using the students table, what does this query return?',
    code: 'SELECT COUNT(*) FROM students WHERE cgpa > 7;', options: ['4', '5', '6', '3'], answer: '4', explanation: 'CGPAs above 7: 8.7, 7.9, 9.1, 8.2. The NULL row never satisfies a comparison.' }),
]

export const LANGUAGE_META: Record<CodingLanguage, { label: string; prism: string; blurb: string }> = {
  Java: { label: 'Java', prism: 'java', blurb: 'OOP, strings, exceptions' },
  Python: { label: 'Python', prism: 'python', blurb: 'Lists, functions, comprehensions' },
  C: { label: 'C', prism: 'c', blurb: 'Pointers, memory, arrays' },
  SQL: { label: 'SQL', prism: 'sql', blurb: 'Queries, joins, aggregates' },
}
