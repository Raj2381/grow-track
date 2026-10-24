import type { BranchCode } from "../../student-portal/data/catalog";
import type { ActivityType } from "../../student-portal/types";

export const DATASET_SEED = 20261009;
export const STUDENT_COUNT = 800;

export type Department = {
  code: BranchCode;
  name: string;
  branch: string;
  weight: number;
  /** Shift applied to programming/technical skills (non-computing branches start lower). */
  techAffinity: number;
  sections: string[];
};

export const DEPARTMENTS: Department[] = [
  { code: "CSE", name: "Computer Science", branch: "B.Tech CSE", weight: 0.34, techAffinity: 0.1, sections: ["A", "B", "C", "D"] },
  { code: "IT", name: "Information Technology", branch: "B.Tech IT", weight: 0.22, techAffinity: 0.05, sections: ["A", "B", "C"] },
  { code: "ECE", name: "Electronics", branch: "B.Tech ECE", weight: 0.2, techAffinity: -0.08, sections: ["A", "B", "C"] },
  { code: "MECH", name: "Mechanical Engineering", branch: "B.Tech Mechanical", weight: 0.14, techAffinity: -0.18, sections: ["A", "B"] },
  { code: "CIVIL", name: "Civil Engineering", branch: "B.Tech Civil", weight: 0.1, techAffinity: -0.2, sections: ["A", "B"] },
];

export const MENTORS: Record<BranchCode, { id: string; name: string }[]> = {
  CSE: [
    { id: "FAC-CSE-1", name: "Dr. Meera Pillai" }, { id: "FAC-CSE-2", name: "Prof. Rohit Verma" },
    { id: "FAC-CSE-3", name: "Prof. Anita Rao" }, { id: "FAC-CSE-4", name: "Prof. Kavita Singh" },
    { id: "FAC-CSE-5", name: "Dr. Arvind Nambiar" }, { id: "FAC-CSE-6", name: "Prof. K. Reddy" },
  ],
  IT: [
    { id: "FAC-IT-1", name: "Dr. Farah Khan" }, { id: "FAC-IT-2", name: "Prof. Vikram Sethi" },
    { id: "FAC-IT-3", name: "Prof. D. Kapoor" }, { id: "FAC-IT-4", name: "Dr. Neelam Arora" },
  ],
  ECE: [
    { id: "FAC-ECE-1", name: "Dr. B. Sinha" }, { id: "FAC-ECE-2", name: "Prof. S. Pandey" },
    { id: "FAC-ECE-3", name: "Dr. H. Mukherjee" }, { id: "FAC-ECE-4", name: "Prof. R. Chawla" },
  ],
  MECH: [
    { id: "FAC-MECH-1", name: "Dr. G. Deshmukh" }, { id: "FAC-MECH-2", name: "Prof. A. Tiwari" },
    { id: "FAC-MECH-3", name: "Prof. S. Rathore" },
  ],
  CIVIL: [
    { id: "FAC-CIVIL-1", name: "Dr. U. Bhosale" }, { id: "FAC-CIVIL-2", name: "Prof. J. Waghmare" },
    { id: "FAC-CIVIL-3", name: "Prof. D. Naik" },
  ],
};

export type ArchetypeId =
  | "high_achiever"
  | "consistent_average"
  | "high_cgpa_low_placement"
  | "skilled_poor_attendance"
  | "late_bloomer"
  | "slow_decliner"
  | "sudden_drop"
  | "chronic_backlog"
  | "disengaged_capable";

export const ARCHETYPES: { id: ArchetypeId; label: string; share: number }[] = [
  { id: "high_achiever", label: "High achiever", share: 0.14 },
  { id: "consistent_average", label: "Consistent average", share: 0.35 },
  { id: "high_cgpa_low_placement", label: "High CGPA, low placement readiness", share: 0.09 },
  { id: "skilled_poor_attendance", label: "Skilled but poor attendance", share: 0.06 },
  { id: "late_bloomer", label: "Late bloomer (improving)", share: 0.07 },
  { id: "slow_decliner", label: "Slow decliner", share: 0.07 },
  { id: "sudden_drop", label: "Sudden drop", share: 0.05 },
  { id: "chronic_backlog", label: "Chronic backlog", share: 0.07 },
  { id: "disengaged_capable", label: "Disengaged but capable", share: 0.1 },
];

export const FEMALE_NAMES = [
  "Aanya", "Ananya", "Diya", "Ishita", "Kavya", "Meera", "Neha", "Priya", "Riya", "Sanya", "Sneha", "Tara", "Aditi",
  "Anika", "Bhavna", "Charvi", "Divya", "Esha", "Gauri", "Harini", "Isha", "Jiya", "Kriti", "Lavanya", "Mahika", "Nidhi",
  "Pooja", "Radhika", "Saanvi", "Shruti", "Tanvi", "Uma", "Vaidehi", "Yashvi", "Zoya", "Pallavi", "Rhea", "Simran",
];
export const MALE_NAMES = [
  "Aarav", "Rohan", "Kabir", "Arjun", "Vihaan", "Aditya", "Rahul", "Dev", "Ishaan", "Karan", "Manav", "Nikhil", "Om",
  "Pranav", "Rishi", "Samarth", "Tushar", "Varun", "Yash", "Aryan", "Bhavesh", "Chirag", "Dhruv", "Eshan", "Gaurav",
  "Harsh", "Jatin", "Kunal", "Lakshya", "Mohit", "Naman", "Parth", "Rajat", "Siddharth", "Tejas", "Utkarsh", "Vivek", "Zaid",
];
export const SURNAMES = [
  "Sharma", "Patel", "Verma", "Singh", "Mehta", "Reddy", "Joshi", "Malhotra", "Iyer", "Gupta", "Nair", "Rao", "Kulkarni",
  "Banerjee", "Desai", "Kapoor", "Chopra", "Bhatt", "Menon", "Pillai", "Shah", "Khan", "Das", "Chatterjee", "Agarwal",
  "Mishra", "Pandey", "Tiwari", "Saxena", "Bose", "Naik", "Deshmukh", "Jain", "Kaur", "Thakur", "Yadav", "Sinha", "Arora",
  "Bajaj", "Ghosh",
];

export const ACTIVITY_BANK: Record<ActivityType, { title: string; organizer: string; category: string; role: string }[]> = {
  event: [
    { title: 'Tech Fest "Innovate"', organizer: "College Tech Council", category: "Technical", role: "Volunteer" },
    { title: "Annual Cultural Night", organizer: "Cultural Committee", category: "Cultural", role: "Participant" },
    { title: "Inter-college Quiz", organizer: "IIT Bombay Mood Indigo", category: "Quiz", role: "Finalist" },
    { title: "Blood Donation Drive", organizer: "NSS Unit", category: "Social", role: "Organiser" },
    { title: "Industry Expert Talk", organizer: "Training & Placement Cell", category: "Career", role: "Attendee" },
  ],
  club: [
    { title: "Coding Club", organizer: "ACM Student Chapter", category: "Technical", role: "Core Member" },
    { title: "Robotics Club", organizer: "Dept. of ECE", category: "Technical", role: "Member" },
    { title: "Photography Club", organizer: "Student Council", category: "Arts", role: "Treasurer" },
    { title: "Debate Society", organizer: "Student Council", category: "Communication", role: "Member" },
  ],
  hackathon: [
    { title: "Smart India Hackathon", organizer: "Govt. of India (MoE)", category: "National", role: "Team Lead — Finalist" },
    { title: "HackWithInfy", organizer: "Infosys", category: "Industry", role: "Participant" },
    { title: "College Codeathon 24h", organizer: "CSE Department", category: "Internal", role: "Winner (2nd place)" },
  ],
  certification: [
    { title: "AWS Cloud Practitioner", organizer: "Amazon Web Services", category: "Cloud", role: "Certified" },
    { title: "NPTEL — Core Subject Course", organizer: "NPTEL / IIT Madras", category: "Academic", role: "Elite Certificate" },
    { title: "Python for Everybody", organizer: "Coursera", category: "Programming", role: "Completed" },
    { title: "Google Data Analytics", organizer: "Google", category: "Analytics", role: "Completed" },
  ],
};

export const APTITUDE_PATTERNS = ["TCS NQT Pattern", "Infosys Pattern", "Accenture Pattern", "General Practice"];

export const INTERVIEW_FEEDBACK = {
  low: "Answers lacked structure and concrete examples; practise explaining your projects step by step.",
  mid: "Reasonable fundamentals, but answers need more depth and confident delivery.",
  high: "Clear, structured and confident answers with good use of examples.",
};

export const REMARK_POS = [
  "Participates actively and asks thoughtful questions.",
  "Consistently disciplined and punctual.",
  "Positive attitude and helps classmates.",
  "Shows steady improvement this semester.",
];
export const REMARK_MID = [
  "Capable, but needs to participate more in discussions.",
  "Occasionally late to class; should be more regular.",
  "Good potential — needs more consistent effort.",
];
export const REMARK_LOW = [
  "Rarely engages in class; please speak up when in doubt.",
  "Frequent absences are affecting performance.",
  "Needs to improve focus and submit work on time.",
];
