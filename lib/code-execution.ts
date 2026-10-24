import type {
  CodingChallenge,
  CodingLanguage,
} from "@/lib/coding-challenges";

export const wandboxCompilers: Record<CodingLanguage, string> = {
  javascript: "nodejs-20.17.0",
  python: "cpython-3.12.7",
  java: "openjdk-jdk-21+35",
  c: "gcc-13.2.0-c",
  cpp: "gcc-13.2.0",
};

const resultPrefix = "__CAMPUSIQ_CASE__:";

function cString(value: string) {
  return JSON.stringify(value);
}

function buildJavaHarness(challenge: CodingChallenge) {
  const name = challenge.functionNames.java;
  const statements = challenge.tests.map((test) => {
    if (challenge.kind === "two-sum") {
      const values = test.input[0] as number[];
      const target = test.input[1] as number;
      return `System.out.println("${resultPrefix}" + Arrays.toString(solution.${name}(new int[]{${values.join(",")}}, ${target})));`;
    }
    if (["sum-array", "max-element"].includes(challenge.kind)) {
      const values = test.input[0] as number[];
      return `System.out.println("${resultPrefix}" + solution.${name}(new int[]{${values.join(",")}}));`;
    }
    return `System.out.println("${resultPrefix}" + solution.${name}(${cString(test.input[0] as string)}));`;
  });
  return `\nclass Main {\n  public static void main(String[] args) {\n    Solution solution = new Solution();\n${statements
      .map((statement) => `    ${statement}`)
      .join("\n")}\n  }\n}\n`;
}

function buildPythonHarness(challenge: CodingChallenge) {
  const name = challenge.functionNames.python;
  const alternateName = name.includes("_")
    ? name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
    : name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  return `\nimport json\n_campusIqFunction = globals().get(${JSON.stringify(name)}) or globals().get(${JSON.stringify(alternateName)})\nif _campusIqFunction is None:\n    raise NameError("Define the function ${name} in the editor before running tests.")\nfor _args in ${JSON.stringify(challenge.tests.map((test) => test.input))}:\n    _actual = _campusIqFunction(*_args)\n    print(${JSON.stringify(resultPrefix)} + json.dumps(_actual, separators=(",", ":")))\n`;
}

function buildCOrCppHarness(
  challenge: CodingChallenge,
  language: "c" | "cpp",
  source: string,
) {
  const name = challenge.functionNames[language];
  const lines: string[] = [];
  if (language === "c") {
    challenge.tests.forEach((test, index) => {
      if (challenge.kind === "two-sum") {
        const values = test.input[0] as number[];
        const target = test.input[1] as number;
        lines.push(
          `  int _values_${index}[] = {${values.join(",")}};\n  int _answer_${index}[2] = {-1, -1};\n  ${name}(_values_${index}, ${values.length}, ${target}, _answer_${index});\n  printf("${resultPrefix}[%d,%d]\\n", _answer_${index}[0], _answer_${index}[1]);`,
        );
      } else if (["sum-array", "max-element"].includes(challenge.kind)) {
        const values = test.input[0] as number[];
        lines.push(
          `  printf("${resultPrefix}%d\\n", ${name}((int[]){${values.join(",")}}, ${values.length}));`,
        );
      } else if (challenge.kind === "reverse-string") {
        lines.push(
          `  char _answer_${index}[256]; ${name}(${cString(test.input[0] as string)}, _answer_${index}, 256); printf("${resultPrefix}%s\\n", _answer_${index});`,
        );
      } else {
        lines.push(
          `  printf("${resultPrefix}%s\\n", ${name}(${cString(test.input[0] as string)}) ? "true" : "false");`,
        );
      }
    });
    return `#include <ctype.h>\n#include <stdbool.h>\n#include <stdio.h>\n#include <string.h>\n${source}\nint main(void) {\n${lines.join(
      "\n",
    )}\n  return 0;\n}\n`;
  }

  challenge.tests.forEach((test, index) => {
    if (challenge.kind === "two-sum") {
      const values = test.input[0] as number[];
      const target = test.input[1] as number;
      lines.push(
        `  vector<int> _values_${index}{${values.join(",")}};\n  auto _answer_${index} = ${name}(_values_${index}, ${target});\n  cout << "${resultPrefix}[" << _answer_${index}[0] << "," << _answer_${index}[1] << "]" << endl;`,
      );
    } else if (["sum-array", "max-element"].includes(challenge.kind)) {
      const values = test.input[0] as number[];
      lines.push(
        `  cout << "${resultPrefix}" << ${name}(vector<int>{${values.join(",")}}) << endl;`,
      );
    } else if (challenge.kind === "reverse-string") {
      lines.push(
        `  cout << "${resultPrefix}" << ${name}(${cString(test.input[0] as string)}) << endl;`,
      );
    } else {
      lines.push(
        `  cout << "${resultPrefix}" << boolalpha << ${name}(${cString(test.input[0] as string)}) << endl;`,
      );
    }
  });
  return `#include <cctype>\n#include <iostream>\n#include <string>\n#include <vector>\nusing namespace std;\n${source}\nint main() {\n${lines.join(
    "\n",
  )}\n  return 0;\n}\n`;
}

export function buildExecutableProgram(
  challenge: CodingChallenge,
  language: CodingLanguage,
  source: string,
) {
  switch (language) {
    case "javascript":
      return `${source}\nconst _campusIqTests = ${JSON.stringify(
        challenge.tests,
      )};\nfor (const _test of _campusIqTests) {\n  const _result = ${challenge.functionNames.javascript}(..._test.input);\n  console.log(${JSON.stringify(resultPrefix)} + JSON.stringify(_result));\n}\n`;
    case "python":
      return `${source}\n${buildPythonHarness(challenge)}`;
    case "java":
      return `import java.util.*;\n${source}\n${buildJavaHarness(challenge)}`;
    case "c":
      return buildCOrCppHarness(challenge, "c", source);
    case "cpp":
      return buildCOrCppHarness(challenge, "cpp", source);
  }
}

export function parseCodingResults(
  stdout: string,
  challenge: CodingChallenge,
) {
  const values = stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith(resultPrefix))
    .map((line) => {
      const value: unknown = JSON.parse(line.slice(resultPrefix.length));
      return value;
    });

  if (values.length !== challenge.tests.length) {
    throw new Error(
      `The runner returned ${values.length} test result(s); expected ${challenge.tests.length}.`,
    );
  }

  return values.map((actual, index) => ({
    passed:
      JSON.stringify(actual) ===
      JSON.stringify(challenge.tests[index].expected),
    actual: JSON.stringify(actual),
    expected: JSON.stringify(challenge.tests[index].expected),
  }));
}
