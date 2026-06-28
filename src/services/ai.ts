import { Task, HabitPlan } from "../types";

export class AIService {
  /**
   * Synchronously calculates the difference in decimal hours between now and the given deadline.
   */
  static getHoursUntilDeadline(deadlineStr: string): number {
    if (!deadlineStr) return 0;
    const now = new Date();
    const deadline = new Date(deadlineStr);
    return (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  }

  /**
   * Generates a daily insight tip.
   */
  static async getDailyInsight(demoMode: boolean, customApiKey: string): Promise<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (customApiKey) {
      headers["x-gemini-api-key"] = customApiKey;
    }

    const response = await fetch("/api/insight", {
      method: "POST",
      headers,
      body: JSON.stringify({ demoMode }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Failed to get daily insight");
    }

    const data = await response.json();
    return data.insight || "Focus on the smallest next step. Small wins build major momentum.";
  }

  /**
   * Prioritizes tasks by assigning urgency scores and reasons.
   */
  static async prioritizeTasks(
    tasks: Task[],
    demoMode: boolean,
    customApiKey: string
  ): Promise<{ id: string; urgencyScore: number; reason: string }[]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (customApiKey) {
      headers["x-gemini-api-key"] = customApiKey;
    }

    const response = await fetch("/api/prioritize", {
      method: "POST",
      headers,
      body: JSON.stringify({ taskList: tasks, demoMode }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Failed to prioritize tasks");
    }

    return await response.json();
  }

  /**
   * Breaks down a task into 5 action steps.
   */
  static async breakDownTask(
    taskTitle: string,
    deadline: string,
    demoMode: boolean,
    customApiKey: string
  ): Promise<{ step: string; estimatedMinutes: number }[]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (customApiKey) {
      headers["x-gemini-api-key"] = customApiKey;
    }

    const response = await fetch("/api/breakdown", {
      method: "POST",
      headers,
      body: JSON.stringify({ taskTitle, deadline, demoMode }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Failed to break down task");
    }

    return await response.json();
  }

  /**
   * Generates a 30-day habit progression plan.
   */
  static async generateHabitPlan(
    goal: string,
    demoMode: boolean,
    customApiKey: string
  ): Promise<HabitPlan> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (customApiKey) {
      headers["x-gemini-api-key"] = customApiKey;
    }

    const response = await fetch("/api/habit-plan", {
      method: "POST",
      headers,
      body: JSON.stringify({ userGoal: goal, demoMode }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Failed to generate habit plan");
    }

    return await response.json();
  }

  /**
   * Generates an optimized chronological productivity schedule.
   */
  static async generateSmartSchedule(
    workHours: number,
    tasks: Task[],
    demoMode: boolean,
    customApiKey: string
  ): Promise<{ taskId: string; startTime: string; endTime: string; tip: string }[]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (customApiKey) {
      headers["x-gemini-api-key"] = customApiKey;
    }

    const response = await fetch("/api/schedule", {
      method: "POST",
      headers,
      body: JSON.stringify({ availableHours: workHours, taskList: tasks, demoMode }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Failed to generate smart schedule");
    }

    return await response.json();
  }
}
