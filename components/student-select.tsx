"use client";

import { useId, useState } from "react";

type Option = { id: string; name: string; department?: string };

/**
 * Searchable student field for long directories. Type a name or ID and pick a suggestion;
 * `onChange` receives the student id, or "" while the text does not match exactly one student.
 */
export function StudentSelect({
  students,
  value,
  onChange,
  className,
  id,
  placeholder = "Search by name or ID",
  required,
}: {
  students: Option[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const listId = useId();
  const label = (student: Option) => `${student.name} · ${student.id}`;
  const selected = students.find((student) => student.id === value);
  // typed text only matters while it differs from the selected student's label
  const [typed, setTyped] = useState<string | null>(null);
  const text = typed ?? (selected ? label(selected) : "");

  return (
    <>
      <input
        id={id}
        list={listId}
        className={className}
        value={text}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        onChange={(event) => {
          const next = event.target.value;
          setTyped(next);
          const match = students.find((student) => label(student) === next || student.id.toLowerCase() === next.trim().toLowerCase());
          onChange(match?.id ?? "");
          if (match) setTyped(null);
        }}
        onBlur={() => setTyped(null)}
      />
      <datalist id={listId}>
        {students.map((student) => (
          <option key={student.id} value={label(student)}>
            {student.department}
          </option>
        ))}
      </datalist>
    </>
  );
}
