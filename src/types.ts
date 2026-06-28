export interface SubTask {
  step: string;
  completed: boolean;
  estimatedMinutes?: number;
}

export interface Task {
  id: string;
  title: string;
  deadline: string;
  priority: "High" | "Medium" | "Low";
  status: "To Do" | "In Progress" | "Done";
  subtasks?: SubTask[];
  urgencyScore?: number;
  urgencyReason?: string;
  createdAt: string;
}

export interface Habit {
  id: string;
  name: string;
  frequency: "Daily" | "Weekly";
  completedDates: string[];
  streak: number;
  goal?: string;
}

export interface UserProfile {
  name: string;
  productivityStyle: string;
  workHours: number;
  timezone: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface HabitPlanMilestone {
  week: number;
  milestone: string;
  dailyActions: string[];
}

export interface HabitPlan {
  milestones: HabitPlanMilestone[];
}
