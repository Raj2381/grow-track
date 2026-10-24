"use client";

import { useEffect, useState } from "react";
import {
  readAttendanceSessions,
  subscribeToAttendanceSessions,
  type AttendanceSession,
} from "@/lib/attendance";
import {
  readAcademicUpdates,
  readMockInterviewResults,
  subscribeToAcademicUpdates,
  subscribeToMockInterviewResults,
  type AcademicUpdate,
  type MockInterviewResult,
} from "@/lib/student-portal";
import {
  readInterventions,
  subscribeToInterventions,
  type Intervention,
} from "@/lib/interventions";

export type StudentDemoRecords = {
  sessions: AttendanceSession[];
  interventions: Intervention[];
  academicUpdates: AcademicUpdate[];
  interviewResults: MockInterviewResult[];
  loading: boolean;
  error: string;
};

const initialRecords: StudentDemoRecords = {
  sessions: [],
  interventions: [],
  academicUpdates: [],
  interviewResults: [],
  loading: true,
  error: "",
};

export function useStudentDemoRecords() {
  const [records, setRecords] = useState(initialRecords);

  useEffect(() => {
    function refresh() {
      const errors: string[] = [];
      let next = { ...initialRecords, loading: false, error: "" };

      try {
        next = { ...next, sessions: readAttendanceSessions() };
      } catch (error) {
        errors.push(
          error instanceof Error
            ? `Attendance: ${error.message}`
            : "Attendance data could not be read.",
        );
      }
      try {
        next = { ...next, interventions: readInterventions() };
      } catch (error) {
        errors.push(
          error instanceof Error
            ? `Interventions: ${error.message}`
            : "Intervention data could not be read.",
        );
      }
      try {
        next = { ...next, academicUpdates: readAcademicUpdates() };
      } catch (error) {
        errors.push(
          error instanceof Error
            ? `Academic results: ${error.message}`
            : "Academic results could not be read.",
        );
      }
      try {
        next = { ...next, interviewResults: readMockInterviewResults() };
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error.message
            : "Mock interview results could not be read.",
        );
      }

      next.error = errors.join(" ");
      setRecords(next);
    }

    const timeoutId = window.setTimeout(refresh, 0);
    const unsubscribeAttendance = subscribeToAttendanceSessions(refresh);
    const unsubscribeInterventions = subscribeToInterventions(refresh);
    const unsubscribeAcademics = subscribeToAcademicUpdates(refresh);
    const unsubscribeInterviews = subscribeToMockInterviewResults(refresh);
    return () => {
      window.clearTimeout(timeoutId);
      unsubscribeAttendance();
      unsubscribeInterventions();
      unsubscribeAcademics();
      unsubscribeInterviews();
    };
  }, []);

  return records;
}
