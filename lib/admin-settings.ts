export type AdminSettings = {
  name: string;
  email: string;
  role: string;
  theme: "light" | "dark" | "system";
  emailNotifications: boolean;
  interventionReminders: boolean;
  minimumAttendance: number;
  minimumAcademicScore: number;
};

export const ADMIN_SETTINGS_STORAGE_KEY = "campusiq-admin-settings";

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  name: "Administrator",
  email: "",
  role: "Administrator",
  theme: "light",
  emailNotifications: true,
  interventionReminders: true,
  minimumAttendance: 75,
  minimumAcademicScore: 60,
};

export function parseAdminSettings(value: unknown): AdminSettings {
  if (!value || typeof value !== "object") {
    throw new Error("Saved settings have an invalid format.");
  }

  const settings = value as Partial<AdminSettings>;
  const validTheme =
    settings.theme === "light" ||
    settings.theme === "dark" ||
    settings.theme === "system";

  if (
    typeof settings.name !== "string" ||
    typeof settings.email !== "string" ||
    typeof settings.role !== "string" ||
    !validTheme ||
    typeof settings.emailNotifications !== "boolean" ||
    typeof settings.interventionReminders !== "boolean" ||
    typeof settings.minimumAttendance !== "number" ||
    typeof settings.minimumAcademicScore !== "number" ||
    settings.minimumAttendance < 0 ||
    settings.minimumAttendance > 100 ||
    settings.minimumAcademicScore < 0 ||
    settings.minimumAcademicScore > 100
  ) {
    throw new Error("Saved settings are incomplete or invalid.");
  }

  return settings as AdminSettings;
}

export function readAdminSettings(): AdminSettings {
  if (typeof window === "undefined") return DEFAULT_ADMIN_SETTINGS;

  const stored = window.localStorage.getItem(ADMIN_SETTINGS_STORAGE_KEY);
  if (!stored) return DEFAULT_ADMIN_SETTINGS;

  return parseAdminSettings(JSON.parse(stored) as unknown);
}
