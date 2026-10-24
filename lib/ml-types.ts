/** Shapes of the JSON files written by the Round 2 pipeline (ml/*.py). All data is synthetic. */

export type OutcomeKey = "sgpa_below_6" | "backlog" | "placement" | "engagement";
export const OUTCOME_KEYS: OutcomeKey[] = ["sgpa_below_6", "backlog", "placement", "engagement"];
export type RiskLevel = "Low" | "Medium" | "High";

export type Driver = {
  /** Plain-language family, e.g. "Attendance trend". */
  f: string;
  /** Representative feature name. */
  k: string;
  /** Sentence with the student's own numbers. */
  t: string;
  /** Log-odds contribution relative to an average student; positive raises the risk. */
  c: number;
};

export type OutcomePrediction = {
  /** Probability of the at-risk class (for placement: NOT ready). */
  p: number;
  level: RiskLevel;
  drivers: Driver[];
  /** sgpa_below_6 only */
  pred?: number;
  lo?: number;
  hi?: number;
  band?: string;
  /** placement only: probability of being ready */
  p_ready?: number;
};

export type StudentFacts = {
  department: string;
  section: string;
  cgpa: number;
  sgpa_last: number;
  att: number;
  att_change: number;
  att_trend: number;
  backlogs: number;
  failed_total: number;
  submit_pct: number;
  late_pct: number;
  logins: number;
  logins_change: number;
  quiz: number;
  engagement_recent: number;
  aptitude: number;
  aptitude_attempts: number;
  coding: number;
  coding_attempts: number;
  interview: number;
  interview_attempts: number;
  tech: number;
  comm: number;
  points: number;
  faculty: number;
  success_score: number;
  round1_flag: RiskLevel;
  interventions: number;
};

export type StudentPrediction = {
  overall: RiskLevel;
  reason: string;
  mentorId: string | null;
  facts: StudentFacts;
} & Record<OutcomeKey, OutcomePrediction>;

export type PredictionsFile = {
  spec: Record<string, unknown>;
  students: Record<string, StudentPrediction>;
};

export type SegmentRecord = {
  id: string;
  label: string;
  definition: string;
  count: number;
  share_of_students: number;
  members: string[];
  by_department: Record<string, number>;
  department_lift: Record<string, number>;
  mean_risk: Record<"sgpa_below_6" | "backlog" | "not_placement_ready" | "engagement_drop", number | null>;
  mean_cgpa: number | null;
  mean_attendance: number | null;
  overall_high_share: number | null;
};

export type SegmentsFile = { students: number; segments: SegmentRecord[] };

export type Owner = "Faculty mentor" | "Training & Placement cell" | "Counsellor" | "Dean / Administrator" | "Department head";
export type Priority = "Critical" | "High" | "Medium" | "Low";

export type Recommendation = {
  id: string;
  targetType: "student" | "segment";
  targetId: string;
  targetLabel: string;
  department: string | null;
  action: string;
  reason: string;
  owner: Owner;
  ownerId: string | null;
  priority: Priority;
  priorityScore: number;
  expectedImpact: string;
  dueInDays: number;
  triggeredBy: string[];
  ruleId: string;
  outcomes: OutcomeKey[];
};

/* ------------------------------------------------------------------------------------------------ database read models */

export type TrendPoint = { n: number; students: number; mean_p: number; share_high: number; share_flagged: number; observed_rate: number | null };
export type SgpaTrendPoint = { n: number; predicted_mean: number; observed_mean: number | null };
export type TrendSeries = Record<OutcomeKey, TrendPoint[]>;
export type RiskTrendsFile = {
  cutoffs: number[];
  note: string;
  thresholds: Record<OutcomeKey, { screen: number; high: number }>;
  institution: TrendSeries & { sgpa: SgpaTrendPoint[] };
  by_department: Record<string, TrendSeries & { sgpa: SgpaTrendPoint[] }>;
  by_section: Record<string, TrendSeries>;
};

export type ClassifierMetrics = {
  roc_auc: number; pr_auc: number; precision: number; recall: number; f1: number; accuracy: number; balanced_accuracy: number;
  false_positive_rate: number; threshold: number; confusion_matrix: { tn: number; fp: number; fn: number; tp: number };
  n: number; positives: number; roc_auc_ci95?: [number, number]; brier?: number;
};
export type GlobalDrivers = { method: string; top_features: { feature: string; group: string; importance: number; std: number; label: string }[]; by_group: Record<string, number> };
export type TargetReport = {
  title: string; risk_class: string;
  model: { family: string; params: Record<string, unknown>; chosen_because: string };
  test_metrics: ClassifierMetrics;
  baselines: { success_score: ClassifierMetrics & { name: string }; round1_risk_flag: ClassifierMetrics & { name: string }; no_skill: ClassifierMetrics & { name: string } };
  gain_over_success_score: { delta_roc_auc_vs_success_score: number; delta_roc_auc_vs_risk_flag: number; recall_at_success_score_precision: number; success_score_recall: number; success_score_precision: number; delta_recall_at_fixed_precision: number };
  threshold: number; threshold_rule: string;
  calibration: { method: string; brier_test: number; reliability_test: { bin: number; n: number; mean_predicted: number; observed_rate: number }[] };
  ablation: ClassifierMetrics & { delta_roc_auc_vs_full_model: number; cv_auc: number; note: string };
  by_semester: Record<string, { n: number; positives: number; roc_auc: number | null; recall: number | null; precision: number | null }>;
  by_department: Record<string, { n: number; positives: number; roc_auc: number | null; recall: number | null; precision: number | null }>;
  early_detection: { definition: string; n_rows: number; caught_by_model: number; share_caught_by_model: number | null; share_caught_by_success_score: number | null };
  fairness_out_of_sample: Record<string, Record<string, { n: number; positives: number; recall: number | null; false_positive_rate: number | null; flagged_share: number }>>;
  global_drivers: GlobalDrivers;
  drivers_explain?: string;
  n_train_students: number; n_test_students: number; prevalence: { train: number; test: number };
};
export type ModelMetricsFile = {
  caveats: string[];
  seed: number; sklearn_version: string; python_version: string; data_sha256: string;
  split: { train_students: number; test_students: number; labelled_cutoffs: number[]; rule: string };
  targets: Record<OutcomeKey, TargetReport>;
  regression: {
    title: string; model: { family: string; chosen_because: string };
    test_metrics: { mae: number; rmse: number; r2: number; band_accuracy: number; interval80_coverage: number };
    baselines: { persistence_last_sgpa: { mae: number; rmse: number; r2: number; band_accuracy: number }; cohort_mean: { mae: number; rmse: number; r2: number; band_accuracy: number } };
    prediction_interval80: { test_coverage: number }; global_drivers: GlobalDrivers;
  };
  explanation_faithfulness: { passed: boolean; driver_display_rule: string };
};

export type DirectoryRow = {
  student_id: string; name: string; roll_no: string; branch_code: string; department: string; section: string; mentor_id: string;
  overall: RiskLevel; reason: string;
  sgpa_p: number; sgpa_level: RiskLevel; pred_sgpa: number; sgpa_lo: number; sgpa_hi: number; sgpa_band: string;
  backlog_p: number; backlog_level: RiskLevel;
  notready_p: number; ready_p: number; placement_level: RiskLevel;
  engagement_p: number; engagement_level: RiskLevel;
  overall_rank: number; risk_score: number;
};

export type LevelCounts = { Low: number; Medium: number; High: number };
export type PredictionSummary = {
  total: number;
  overall: LevelCounts;
  outcomes: {
    sgpa_below_6: LevelCounts & { mean_p: number | null; mean_sgpa: number | null };
    backlog: LevelCounts & { mean_p: number | null };
    placement: LevelCounts & { mean_p: number | null; mean_ready: number | null };
    engagement: LevelCounts & { mean_p: number | null };
  };
  by_department: { branch_code: string; department: string; total: number; High: number; Medium: number; Low: number; sgpa_high: number; backlog_high: number; placement_high: number; engagement_high: number; mean_sgpa: number | null; mean_backlog_p: number | null }[];
};
export type RecommendationSummary = {
  total: number;
  by_owner: Partial<Record<Owner, number>>;
  by_priority: Partial<Record<Priority, number>>;
  by_status: Partial<Record<RecStatus, number>>;
  by_target_type: Partial<Record<"student" | "segment", number>>;
  open_critical_or_high: number;
};
export type RecStatus = "open" | "accepted" | "done" | "dismissed";
export type StoredRecommendation = Recommendation & { status: RecStatus; assignedTo: string | null; updatedAt: string };
