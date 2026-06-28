/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Calendar as CalendarIcon,
  MessageSquare,
  ListTodo,
  Flame,
  Settings,
  Plus,
  Trash2,
  Check,
  Clock,
  ArrowRight,
  Brain,
  Layout,
  Grid,
  CheckCircle2,
  X,
  Bell,
  Eye,
  EyeOff,
  AlertTriangle,
  Send,
  HelpCircle,
  TrendingUp,
  RefreshCw,
  User,
  Sliders,
  ChevronRight,
  CalendarDays,
  Moon,
  Sun,
  Timer,
  Play,
  Pause,
  VolumeX,
  Volume2,
  Coffee,
  Music,
  History,
  Mic,
  MicOff
} from "lucide-react";
import { Task, Habit, UserProfile, ChatMessage, HabitPlan, SubTask } from "./types";
import { AIService } from "./services/ai";
import { startAmbientSound, stopAmbientSound, setAmbientVolume, ambientSoundTypes } from "./services/ambient";
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  fetchGoogleCalendarEvents as fetchGoogleCalendarEventsRange,
  createGoogleCalendarEvent,
  GoogleCalendarEvent,
  auth
} from "./services/auth";
import { triggerConfetti, ConfettiCanvas } from "./components/ConfettiCanvas";

const FOCUS_QUOTES = [
  { text: "The best way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "Focus is a muscle, and you are building it right now.", author: "Flow Coach" },
  { text: "Your mind is for having ideas, not holding them. Stay on track.", author: "David Allen" },
  { text: "Procrastination is the art of keeping up with yesterday.", author: "Don Marquis" },
  { text: "Only put off until tomorrow what you are willing to die having left undone.", author: "Pablo Picasso" },
  { text: "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.", author: "Stephen King" },
  { text: "One single-tasking block is worth a whole day of fractured chaos.", author: "Cal Newport" },
  { text: "Work like there is someone working twenty-four hours a day to take it all away from you.", author: "Mark Cuban" }
];

const getBonsaiStage = (completedCount: number) => {
  if (completedCount === 0) {
    return {
      emoji: "🌱",
      name: "Dormant Seed",
      description: "A silent, sleeping seed waiting to break ground. Complete 1 focus sprint to see it sprout!",
      stage: 0
    };
  } else if (completedCount === 1) {
    return {
      emoji: "🌿",
      name: "Fresh Sprout",
      description: "A tiny green sprout reaching for the sun. You conquered procrastination once! Keep going.",
      stage: 1
    };
  } else if (completedCount === 2) {
    return {
      emoji: "🪴",
      name: "Potted Sapling",
      description: "A beautiful green sapling taking shape. Your focus routine is starting to take root.",
      stage: 2
    };
  } else if (completedCount === 3) {
    return {
      emoji: "🌳",
      name: "Branching Bonsai",
      description: "A sturdy, lush, branching classic bonsai tree. Your discipline is extremely admirable!",
      stage: 3
    };
  } else {
    return {
      emoji: "🌸",
      name: "Cherry Blossom Bonsai",
      description: "A legendary blooming master bonsai tree with falling pink petals! Perfect flow achieved.",
      stage: 4
    };
  }
};

// Helper to get urgency metadata for each task card
const getTaskUrgencyMeta = (task: Task) => {
  const hoursLeft = AIService.getHoursUntilDeadline(task.deadline);
  const isOverdue = hoursLeft < 0 && task.status !== "Done";
  
  let score = task.urgencyScore || 3;
  let message = task.urgencyReason || "";

  // Ensure it strictly obeys requirements dynamically:
  if (isOverdue) {
    const absHours = Math.abs(hoursLeft);
    if (absHours < 2) {
      message = "Just missed — jump back in now. 🔥";
      score = 8;
    } else if (absHours >= 2 && absHours <= 12) {
      message = "Still recoverable — start within the next 30 min.";
      score = 8;
    } else if (absHours > 12 && absHours <= 24) {
      message = "Late but not lost. A partial submission is better than none.";
      score = 8;
    } else {
      message = "Communicate with stakeholders and submit what you have.";
      score = 10;
    }
  } else {
    if (hoursLeft <= 24) {
      score = 7;
      message = "Due today. Complete this before embarking on low-urgency tasks.";
    } else if (hoursLeft <= 48) {
      score = 5;
      message = "Due tomorrow. Start outlining or doing the heavy lifting today.";
    } else {
      score = 3;
      message = "Upcoming deadline. You have breathing room, but do 15 mins of prep.";
    }
  }

  // Determine left border color (10: red, 7-8: amber, 3-5: blue)
  let borderColor = "border-l-4 border-l-[#3B82F6]";
  let dotColor = "bg-[#3B82F6]";
  if (score >= 10) {
    borderColor = "border-l-4 border-l-[#EF4444]";
    dotColor = "bg-[#EF4444]";
  } else if (score >= 7) {
    borderColor = "border-l-4 border-l-[#F59E0B]";
    dotColor = "bg-[#F59E0B]";
  }

  return {
    score,
    message,
    borderColor,
    dotColor,
    isOverdue,
    hoursLeft
  };
};

const GoogleEventCard = ({ event }: { event: any; key?: any }) => {
  const start = event.start?.dateTime || event.start?.date;
  const end = event.end?.dateTime || event.end?.date;
  
  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isAllDay = !event.start?.dateTime;
  
  return (
    <div className="gcal-event-card">
      <div className="gcal-event-header">
        <span className="gcal-dot">●</span>
        <span className="gcal-event-title">{event.summary || 'Untitled Event'}</span>
      </div>
      <div className="gcal-event-time">
        {isAllDay
          ? '🗓 All Day'
          : `🕐 ${formatTime(start)} — ${formatTime(end)}`}
      </div>
      {event.description && (
        <p className="gcal-event-desc">{event.description}</p>
      )}
      {event.location && (
        <div className="gcal-event-location">
          📍 {event.location}
        </div>
      )}
    </div>
  );
};

// Default Profile
const DEFAULT_PROFILE: UserProfile = {
  name: "Sarvesh",
  productivityStyle: "Last-Minute Warrior",
  workHours: 4,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"
};

// Seed/Demo Data
const DEMO_TASKS: Task[] = [
  {
    id: "demo-task-1",
    title: "Finish Business Proposal Pitch Deck",
    deadline: (() => {
      const d = new Date();
      d.setHours(d.getHours() + 3);
      return d.toISOString().slice(0, 16);
    })(),
    priority: "High",
    status: "In Progress",
    subtasks: [
      { step: "Outline market sizing metrics", completed: true },
      { step: "Design slides for competitors & team slide", completed: false },
      { step: "Verify financial model totals", completed: false }
    ],
    urgencyScore: 9,
    urgencyReason: "🔥 Critical deadline panic window! Less than 4 hours remaining. Eliminate distractions now.",
    createdAt: new Date().toISOString()
  },
  {
    id: "demo-task-2",
    title: "Review Economics Final Cheat Sheet",
    deadline: (() => {
      const d = new Date();
      d.setHours(d.getHours() + 10);
      return d.toISOString().slice(0, 16);
    })(),
    priority: "Medium",
    status: "To Do",
    subtasks: [
      { step: "Read Chapter 12 summary", completed: false },
      { step: "Draw supply-demand curves", completed: false }
    ],
    urgencyScore: 8,
    urgencyReason: "⚡ Tight squeeze. Due today. Complete this before embarking on low-urgency tasks.",
    createdAt: new Date().toISOString()
  },
  {
    id: "demo-task-3",
    title: "Submit Bi-Weekly Status Update",
    deadline: (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 16);
    })(),
    priority: "High",
    status: "To Do",
    subtasks: [],
    urgencyScore: 10,
    urgencyReason: "🚨 OVERDUE! This task was due yesterday. Fix immediately to mitigate fallout.",
    createdAt: new Date().toISOString()
  },
  {
    id: "demo-task-4",
    title: "Set up Web Hosting & SSL Certificate",
    deadline: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return d.toISOString().slice(0, 16);
    })(),
    priority: "Low",
    status: "Done",
    subtasks: [
      { step: "Buy domain name", completed: true },
      { step: "Set DNS record pointers", completed: true }
    ],
    urgencyScore: 2,
    urgencyReason: "🍃 Accomplished task. Nice work staying ahead!",
    createdAt: new Date().toISOString()
  }
];

const DEMO_HABITS: Habit[] = [
  {
    id: "demo-habit-1",
    name: "Do 15-Min Focused Brain Dump",
    frequency: "Daily",
    completedDates: (() => {
      const dates = [];
      const d = new Date();
      for (let i = 1; i <= 6; i++) {
        const temp = new Date();
        temp.setDate(d.getDate() - i);
        dates.push(temp.toISOString().slice(0, 10));
      }
      return dates;
    })(),
    streak: 6,
    goal: "Clear mental noise every day before starting deep work"
  },
  {
    id: "demo-habit-2",
    name: "No Phone in Bed First 30 Min",
    frequency: "Daily",
    completedDates: (() => {
      const dates = [];
      const d = new Date();
      for (let i = 2; i <= 8; i += 2) {
        const temp = new Date();
        temp.setDate(d.getDate() - i);
        dates.push(temp.toISOString().slice(0, 10));
      }
      return dates;
    })(),
    streak: 3,
    goal: "Protect early morning focus from cheap dopamine"
  }
];

const DEFAULT_WELCOME_MSG: ChatMessage = {
  id: "welcome-msg",
  role: "assistant",
  content: "👋 Hello! I am your **Last-Minute Life Saver AI Productivity Coach**.\n\nAre you drowning in tasks, stressing about a critical deadline, or struggling to find focus? Tell me what's on your mind, or select a preset coach prompt below. We'll break it down together into bite-sized momentum sprints!",
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

interface TaskActionStepsProps {
  task: Task;
  tasks: Task[];
  syncTasks: (updated: Task[]) => void;
  loadingBreakdownId: string | null;
  handleBreakdownTask: (task: Task) => void;
  handleToggleSubtask: (taskId: string, subIndex: number) => void;
}

function TaskActionSteps({
  task,
  tasks,
  syncTasks,
  loadingBreakdownId,
  handleBreakdownTask,
  handleToggleSubtask,
}: TaskActionStepsProps) {
  const [newStepText, setNewStepText] = React.useState("");

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStepText.trim()) return;
    const newSub = { step: newStepText.trim(), completed: false };
    const updated = tasks.map((t) => {
      if (t.id === task.id) {
        return { ...t, subtasks: [...(t.subtasks || []), newSub] };
      }
      return t;
    });
    syncTasks(updated);
    setNewStepText("");
  };

  const handleDeleteSubtask = (subIndex: number) => {
    const updated = tasks.map((t) => {
      if (t.id === task.id) {
        const filteredSubs = (t.subtasks || []).filter((_, idx) => idx !== subIndex);
        return { ...t, subtasks: filteredSubs };
      }
      return t;
    });
    syncTasks(updated);
  };

  const hasSubtasks = task.subtasks && task.subtasks.length > 0;

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs font-semibold text-slate-500">
          Action Steps ({task.subtasks ? task.subtasks.filter((s) => s.completed).length : 0}/{task.subtasks ? task.subtasks.length : 0})
        </span>
        
        <button
          onClick={() => handleBreakdownTask(task)}
          disabled={loadingBreakdownId === task.id}
          className="text-xs text-[#6366F1] hover:text-[#4F46E5] font-bold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100/85 px-2.5 py-1 rounded-lg transition cursor-pointer"
          id={`breakdown-btn-${task.id}`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {loadingBreakdownId === task.id ? "Breaking down..." : "Break down with AI"}
        </button>
      </div>

      {/* Manual Action Step Input Form */}
      <form onSubmit={handleAddSubtask} className="flex gap-2">
        <input
          type="text"
          placeholder="Type a custom action step..."
          value={newStepText}
          onChange={(e) => setNewStepText(e.target.value)}
          className="flex-1 bg-slate-50 border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-700"
        />
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shrink-0 cursor-pointer flex items-center justify-center"
        >
          Add Step
        </button>
      </form>

      {hasSubtasks && (
        <div className="space-y-1.5 pt-1">
          {task.subtasks.map((sub, sidx) => (
            <div
              key={sidx}
              className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100/80 text-xs group"
            >
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={sub.completed}
                  onChange={() => handleToggleSubtask(task.id, sidx)}
                  className="rounded text-[#1D9E75] focus:ring-[#1D9E75] w-4 h-4 cursor-pointer"
                />
                <span className={sub.completed ? "line-through text-slate-400" : "text-slate-700 font-medium"}>
                  {sub.step}
                </span>
              </label>
              
              <div className="flex items-center gap-2 shrink-0">
                {sub.estimatedMinutes && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    ⏱️ {sub.estimatedMinutes}m
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleDeleteSubtask(sidx)}
                  className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition opacity-100 sm:opacity-0 group-hover:opacity-100 cursor-pointer"
                  title="Delete step"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() => handleBreakdownTask(task)}
            disabled={loadingBreakdownId === task.id}
            className="text-[10px] text-[#6366F1] hover:underline font-semibold block pt-1 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loadingBreakdownId === task.id ? "animate-spin" : ""}`} />
            Re-generate steps with AI
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  // Navigation: "dashboard" | "tasks" | "chat" | "calendar" | "habits" | "focus"
  const [currentTab, setCurrentTab] = useState<"dashboard" | "tasks" | "chat" | "calendar" | "habits" | "focus">("dashboard");

  // State core
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  // Auth & Google Calendar States
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [monthlyGoogleEvents, setMonthlyGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [googleCalendarLoading, setGoogleCalendarLoading] = useState<boolean>(false);
  const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null);

  // States for selected date Calendar Events (Problem 2 & 3)
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [googleEvents, setGoogleEvents] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Settings & Modes
  const [customApiKey, setCustomApiKey] = useState<string>("");
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [apiKeyFeedback, setApiKeyFeedback] = useState<string>("");
  const [demoMode, setDemoMode] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showAddHabitModal, setShowAddHabitModal] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("lmls_darkmode") === "true";
  });

  const toggleDarkMode = (enabled: boolean) => {
    setDarkMode(enabled);
    localStorage.setItem("lmls_darkmode", String(enabled));
  };

  // Applet variables
  const [insight, setInsight] = useState<string>("");
  const [loadingInsight, setLoadingInsight] = useState<boolean>(false);
  const [isPrioritizing, setIsPrioritizing] = useState<boolean>(false);
  
  // Bulk Actions Selection State
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // Pomodoro Timer State
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState<number>(25 * 60); // 25 minutes default
  const [pomodoroMode, setPomodoroMode] = useState<"focus" | "shortBreak" | "longBreak">("focus");
  const [pomodoroActive, setPomodoroActive] = useState<boolean>(false);
  const [pomodoroTaskId, setPomodoroTaskId] = useState<string | null>(null);
  const [pomodoroDuration, setPomodoroDuration] = useState<number>(25 * 60);
  const [pomodoroToast, setPomodoroToast] = useState<string | null>(null);
  const [pomodoroAlarmActive, setPomodoroAlarmActive] = useState<boolean>(false);

  // New High-Fidelity Focus States
  const [ambientSound, setAmbientSound] = useState<"none" | "binaural" | "noise" | "space" | "rhythm">("none");
  const [ambientVolume, setAmbientVolumeState] = useState<number>(0.5);
  const [distractionCount, setDistractionCount] = useState<number>(0);
  const [focusQuoteIdx, setFocusQuoteIdx] = useState<number>(0);
  const [focusHistory, setFocusHistory] = useState<{
    id: string;
    timestamp: string;
    mode: "focus" | "shortBreak" | "longBreak";
    durationMinutes: number;
    completed: boolean;
    taskTitle?: string;
    distractions: number;
  }[]>([]);

  // Voice Speech Recognition States & Handlers
  const [isChatListening, setIsChatListening] = useState<boolean>(false);
  const [isTaskListening, setIsTaskListening] = useState<boolean>(false);
  const chatRecognitionRef = useRef<any>(null);
  const taskRecognitionRef = useRef<any>(null);

  const toggleVoiceChat = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Safari.");
      return;
    }

    if (isChatListening) {
      if (chatRecognitionRef.current) {
        chatRecognitionRef.current.stop();
      }
      setIsChatListening(false);
    } else {
      setIsChatListening(true);
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text) {
          setChatInput((prev) => (prev ? prev + " " + text : text));
        }
      };

      rec.onend = () => {
        setIsChatListening(false);
      };

      rec.onerror = (err: any) => {
        console.error("Speech recognition error:", err.error);
        setIsChatListening(false);
        if (err.error === "no-speech") {
          // Ignore silently or log, do not show a disruptive alert
          console.log("No speech was detected. Listening timed out.");
        } else if (err.error === "audio-capture") {
          alert("No microphone was detected, or audio capture failed. Please make sure a microphone is plugged in, turned on, and not being used by another application.");
        } else if (err.error === "not-allowed") {
          alert("Microphone access is blocked. Please grant microphone permissions to this site. If you're running inside the live preview, try clicking 'Open in a new tab' button at the top right of the browser frame to grant access directly.");
        } else if (err.error === "network") {
          alert("A network error occurred. Speech recognition requires an active internet connection on this browser.");
        } else {
          alert(`Speech recognition error: ${err.error || "unknown"}`);
        }
      };

      chatRecognitionRef.current = rec;
      rec.start();
    }
  };

  const toggleVoiceTask = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Safari.");
      return;
    }

    if (isTaskListening) {
      if (taskRecognitionRef.current) {
        taskRecognitionRef.current.stop();
      }
      setIsTaskListening(false);
    } else {
      setIsTaskListening(true);
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text) {
          setNewTaskTitle((prev) => (prev ? prev + " " + text : text));
        }
      };

      rec.onend = () => {
        setIsTaskListening(false);
      };

      rec.onerror = (err: any) => {
        console.error("Speech recognition error:", err.error);
        setIsTaskListening(false);
        if (err.error === "no-speech") {
          // Ignore silently or log, do not show a disruptive alert
          console.log("No speech was detected. Listening timed out.");
        } else if (err.error === "audio-capture") {
          alert("No microphone was detected, or audio capture failed. Please make sure a microphone is plugged in, turned on, and not being used by another application.");
        } else if (err.error === "not-allowed") {
          alert("Microphone access is blocked. Please grant microphone permissions to this site. If you're running inside the live preview, try clicking 'Open in a new tab' button at the top right of the browser frame to grant access directly.");
        } else if (err.error === "network") {
          alert("A network error occurred. Speech recognition requires an active internet connection on this browser.");
        } else {
          alert(`Speech recognition error: ${err.error || "unknown"}`);
        }
      };

      taskRecognitionRef.current = rec;
      rec.start();
    }
  };

  // High-performance React ref pattern to read values inside the setInterval countdown with zero timer jitter
  const focusSessionRef = useRef({
    pomodoroMode,
    pomodoroTaskId,
    pomodoroDuration,
    distractionCount,
  });

  useEffect(() => {
    focusSessionRef.current = {
      pomodoroMode,
      pomodoroTaskId,
      pomodoroDuration,
      distractionCount,
    };
  }, [pomodoroMode, pomodoroTaskId, pomodoroDuration, distractionCount]);

  // Synchronize Ambient Audio Synthesizer
  useEffect(() => {
    if (pomodoroActive) {
      startAmbientSound(ambientSound, ambientVolume);
    } else {
      stopAmbientSound();
    }
    return () => {
      stopAmbientSound();
    };
  }, [ambientSound, pomodoroActive]);

  useEffect(() => {
    setAmbientVolume(ambientVolume);
  }, [ambientVolume]);
  
  // Create / Edit Task state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [newTaskStatus, setNewTaskStatus] = useState<"To Do" | "In Progress" | "Done">("To Do");

  // Create Habit state
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitFreq, setNewHabitFreq] = useState<"Daily" | "Weekly">("Daily");
  const [newHabitGoal, setNewHabitGoal] = useState("");

  // Habit Plan display
  const [habitGoalInput, setHabitGoalInput] = useState("");
  const [generatedHabitPlan, setGeneratedHabitPlan] = useState<HabitPlan | null>(null);
  const [isGeneratingHabitPlan, setIsGeneratingHabitPlan] = useState(false);

  // Smart Schedule state
  const [smartSchedule, setSmartSchedule] = useState<{ taskId: string; startTime: string; endTime: string; tip: string }[] | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleGapsRequested, setScheduleGapsRequested] = useState(false);

  // Chat inputs
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [hasRunAutoAnalysis, setHasRunAutoAnalysis] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Kanban toggle state
  const [taskViewMode, setTaskViewMode] = useState<"list" | "kanban">("list");
  // Task filter chips: "all" | "today" | "overdue" | "upcoming"
  const [taskFilter, setTaskFilter] = useState<"all" | "today" | "overdue" | "upcoming">("all");

  // Load everything from localStorage
  useEffect(() => {
    const localTasks = localStorage.getItem("lmls_tasks");
    const localHabits = localStorage.getItem("lmls_habits");
    const localProfile = localStorage.getItem("lmls_profile");
    const localChat = localStorage.getItem("lmls_chat");
    const localApiKey = localStorage.getItem("lmls_apikey");
    const localDemo = localStorage.getItem("lmls_demomode");

    if (localTasks) setTasks(JSON.parse(localTasks));
    else {
      setTasks(DEMO_TASKS);
      localStorage.setItem("lmls_tasks", JSON.stringify(DEMO_TASKS));
    }

    if (localHabits) setHabits(JSON.parse(localHabits));
    else {
      setHabits(DEMO_HABITS);
      localStorage.setItem("lmls_habits", JSON.stringify(DEMO_HABITS));
    }

    if (localProfile) setProfile(JSON.parse(localProfile));
    else {
      setProfile(DEFAULT_PROFILE);
      localStorage.setItem("lmls_profile", JSON.stringify(DEFAULT_PROFILE));
    }

    if (localChat) setChatHistory(JSON.parse(localChat));
    else {
      setChatHistory([DEFAULT_WELCOME_MSG]);
      localStorage.setItem("lmls_chat", JSON.stringify([DEFAULT_WELCOME_MSG]));
    }

    if (localApiKey) setCustomApiKey(localApiKey);
    
    if (localDemo !== null) {
      setDemoMode(localDemo === "true");
    } else {
      setDemoMode(!localApiKey); // If no API key, default to Demo Mode
    }

    const localFocusHistory = localStorage.getItem("lmls_focus_history");
    if (localFocusHistory) {
      try {
        setFocusHistory(JSON.parse(localFocusHistory));
      } catch (e) {
        console.error("Failed to parse focus history:", e);
      }
    }
  }, []);

  // Pomodoro Audio Feedback Helper
  const playPomodoroBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 chime note
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (err) {
      console.warn("AudioContext beep failed", err);
    }
  };

  const playTickSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, ctx.currentTime); // High pitched click
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (err) {
      console.warn("AudioContext tick failed", err);
    }
  };

  // Continuous Alarm Audio Effect
  useEffect(() => {
    if (!pomodoroAlarmActive) return;

    const playAlarmBeep = () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth"; // dramatic buzzer sound
        osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15); // E5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } catch (err) {
        console.warn("AudioContext alarm failed", err);
      }
    };

    playAlarmBeep();
    const interval = setInterval(playAlarmBeep, 800);

    return () => clearInterval(interval);
  }, [pomodoroAlarmActive]);

  // Pomodoro countdown timer logic
  useEffect(() => {
    if (!pomodoroActive) return;

    const interval = setInterval(() => {
      setPomodoroTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setPomodoroActive(false);
          setPomodoroAlarmActive(true); // START CONTINUOUS ALARM
          playPomodoroBeep();

          // Log focus session completion
          const currentSession = focusSessionRef.current;
          const associatedTask = tasks.find(t => t.id === currentSession.pomodoroTaskId);
          const historyItem = {
            id: "focus-" + Date.now(),
            timestamp: new Date().toISOString(),
            mode: currentSession.pomodoroMode,
            durationMinutes: Math.round(currentSession.pomodoroDuration / 60),
            completed: true,
            taskTitle: associatedTask ? associatedTask.title : undefined,
            distractions: currentSession.distractionCount
          };
          
          try {
            const existingHistoryStr = localStorage.getItem("lmls_focus_history") || "[]";
            const existingHistory = JSON.parse(existingHistoryStr);
            const updatedHistory = [historyItem, ...existingHistory];
            localStorage.setItem("lmls_focus_history", JSON.stringify(updatedHistory));
            setFocusHistory(updatedHistory);
          } catch (e) {
            console.error("Failed to write focus history:", e);
          }

          // Reset distraction count for the next block
          setDistractionCount(0);

          // Move states/toasts accordingly
          if (pomodoroMode === "focus") {
            setPomodoroToast("🎉 focus-complete");
            setPomodoroMode("shortBreak");
            setPomodoroTimeLeft(5 * 60);
            setPomodoroDuration(5 * 60);
          } else if (pomodoroMode === "shortBreak") {
            setPomodoroToast("🎉 break-complete");
            setPomodoroMode("longBreak");
            setPomodoroTimeLeft(15 * 60);
            setPomodoroDuration(15 * 60);
          } else {
            setPomodoroToast("🎉 session-reset");
            setPomodoroMode("focus");
            setPomodoroTimeLeft(25 * 60);
            setPomodoroDuration(25 * 60);
          }
          return 0;
        }

        const nextVal = prev - 1;
        if (nextVal > 0 && nextVal < 10) {
          playTickSound();
        }
        return nextVal;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [pomodoroActive, pomodoroMode]);

  // Sync state helpers
  const syncTasks = (updated: Task[]) => {
    setTasks(updated);
    localStorage.setItem("lmls_tasks", JSON.stringify(updated));
  };

  const syncHabits = (updated: Habit[]) => {
    setHabits(updated);
    localStorage.setItem("lmls_habits", JSON.stringify(updated));
  };

  const syncProfile = (updated: UserProfile) => {
    setProfile(updated);
    localStorage.setItem("lmls_profile", JSON.stringify(updated));
  };

  const syncChat = (updated: ChatMessage[]) => {
    setChatHistory(updated);
    localStorage.setItem("lmls_chat", JSON.stringify(updated));
  };

  const saveApiKey = (key: string) => {
    const trimmedKey = key.trim();
    setCustomApiKey(trimmedKey);
    localStorage.setItem("lmls_apikey", trimmedKey);
    if (trimmedKey) {
      setDemoMode(false);
      localStorage.setItem("lmls_demomode", "false");
      setApiKeyFeedback("✓ Gemini API Key Updated! Switched off Demo Mode.");
    } else {
      setDemoMode(true);
      localStorage.setItem("lmls_demomode", "true");
      setApiKeyFeedback("✓ Key cleared. Returned to Demo Mode.");
    }
    // Fade out feedback after 4 seconds
    setTimeout(() => {
      setApiKeyFeedback("");
    }, 4000);
  };

  const toggleDemoMode = (val: boolean) => {
    setDemoMode(val);
    localStorage.setItem("lmls_demomode", String(val));
  };

  // Auth listener on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setGoogleAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setGoogleAccessToken(null);
      }
    );
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const autoSyncGoogleCalendarEventsToTasks = (eventsList: any[]) => {
    if (!eventsList || eventsList.length === 0) return;
    
    setTasks((currentTasks) => {
      let addedCount = 0;
      const updatedTasks = [...currentTasks];
      
      eventsList.forEach((event) => {
        const gcalId = `gcal-${event.id}`;
        // Check if task already exists by id
        const exists = updatedTasks.some((t) => t.id === gcalId);
        if (!exists) {
          const start = event.start?.dateTime || event.start?.date;
          const formattedDeadline = start 
            ? new Date(start).toISOString().slice(0, 16) 
            : new Date().toISOString().slice(0, 16);
          
          const newTask: Task = {
            id: gcalId,
            title: event.summary || "Untitled Google Calendar Event",
            deadline: formattedDeadline,
            priority: "Medium",
            status: "To Do",
            subtasks: [],
            urgencyScore: 5,
            urgencyReason: "Synced automatically from your Google Calendar.",
            createdAt: new Date().toISOString()
          };
          updatedTasks.push(newTask);
          addedCount++;
        }
      });
      
      if (addedCount > 0) {
        localStorage.setItem("lmls_tasks", JSON.stringify(updatedTasks));
        console.log(`Successfully auto-synced ${addedCount} Google Calendar events & tasks to your task section!`);
      }
      
      return updatedTasks;
    });
  };

  const loadGoogleCalendarEvents = async () => {
    try {
      setGoogleCalendarLoading(true);
      const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString();
      const endOfMonth = new Date(currentYear, currentMonth + 1, 1).toISOString();
      
      const events = await fetchGoogleCalendarEventsRange(startOfMonth, endOfMonth);
      setMonthlyGoogleEvents(events);
      autoSyncGoogleCalendarEventsToTasks(events);
    } catch (err) {
      console.error("Failed to load Google Calendar events:", err);
    } finally {
      setGoogleCalendarLoading(false);
    }
  };

  // React to token changes to load events
  useEffect(() => {
    if (googleToken) {
      loadGoogleCalendarEvents();
      // Also fetch for currently selected date
      handleDateSelect(selectedDate);
    } else {
      setMonthlyGoogleEvents([]);
      setGoogleEvents([]);
    }
  }, [googleToken]);

  const handleGoogleSignIn = async () => {
    try {
      setGoogleCalendarLoading(true);
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        setGoogleAccessToken(res.accessToken);
      }
    } catch (err: any) {
      console.error("Login failed:", err);
    } finally {
      setGoogleCalendarLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await logout();
      setGoogleUser(null);
      setGoogleToken(null);
      setGoogleAccessToken(null);
      setMonthlyGoogleEvents([]);
      setGoogleEvents([]);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Google Calendar events fetch for a selected date only (Problem 2)
  const fetchGoogleCalendarEvents = async (selectedDate: Date) => {
    try {
      // Get access token from Firebase auth
      const user = auth.currentUser;
      if (!user) return [];
      
      const token = await user.getIdToken();
      
      // Set time range for the selected date (midnight to midnight)
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const timeMin = startOfDay.toISOString();
      const timeMax = endOfDay.toISOString();
      
      // Fetch from Google Calendar API
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${encodeURIComponent(timeMin)}&` +
        `timeMax=${encodeURIComponent(timeMax)}&` +
        `singleEvents=true&` +
        `orderBy=startTime`,
        {
          headers: {
            Authorization: `Bearer ${googleAccessToken}`, // use stored OAuth token
            'Content-Type': 'application/json',
          }
        }
      );
      
      if (!response.ok) throw new Error('Calendar fetch failed');
      const data = await response.json();
      return data.items || [];
      
    } catch (error) {
      console.error('Google Calendar fetch error:', error);
      return [];
    }
  };

  // Call on date select
  const handleDateSelect = async (date: Date) => {
    setSelectedDate(date);
    
    // Also sync selectedCalendarDateStr as dayString (YYYY-MM-DD)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dayString = `${year}-${month}-${day}`;
    setSelectedCalendarDateStr(dayString);

    setCalendarLoading(true);
    const events = await fetchGoogleCalendarEvents(date);
    setGoogleEvents(events);
    autoSyncGoogleCalendarEventsToTasks(events);
    setCalendarLoading(false);
  };

  const handleExportTaskToCalendar = async (task: Task) => {
    if (!googleToken) {
      alert("Please sign in with Google first!");
      return;
    }
    
    const confirmed = window.confirm(`Export task "${task.title}" to Google Calendar?`);
    if (!confirmed) return;

    try {
      setSyncingTaskId(task.id);
      
      const endDateTime = task.deadline; // "YYYY-MM-DDTHH:mm"
      const endDate = new Date(endDateTime);
      const startDate = new Date(endDate.getTime() - 30 * 60 * 1000); // 30 mins before
      
      const eventPayload = {
        summary: `📌 Task: ${task.title}`,
        description: `Priority: ${task.priority}\nStatus: ${task.status}\nCreated by Last-Minute Life Saver.`,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };
      
      await createGoogleCalendarEvent(eventPayload);
      alert(`Successfully exported "${task.title}" to Google Calendar!`);
      loadGoogleCalendarEvents();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to export task: ${err.message}`);
    } finally {
      setSyncingTaskId(null);
    }
  };

  const handleScheduleFocusBlock = async (block: { taskId: string; startTime: string; endTime: string; tip: string }) => {
    if (!googleToken) {
      alert("Please sign in with Google first!");
      return;
    }

    const targetTask = tasks.find((t) => t.id === block.taskId);
    const taskTitle = targetTask ? targetTask.title : "High Priority Work";
    
    const confirmed = window.confirm(`Schedule AI Focus Block for "${taskTitle}" (${block.startTime} - ${block.endTime}) in Google Calendar?`);
    if (!confirmed) return;

    try {
      setGoogleCalendarLoading(true);
      
      const startDateTime = `${selectedCalendarDateStr}T${block.startTime}:00`;
      const endDateTime = `${selectedCalendarDateStr}T${block.endTime}:00`;
      
      const startDate = new Date(startDateTime);
      const endDate = new Date(endDateTime);
      
      const eventPayload = {
        summary: `⚡ Focus Zone: ${taskTitle}`,
        description: `AI Coaching tip:\n${block.tip}\n\nGenerated by Last-Minute Life Saver.`,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };
      
      await createGoogleCalendarEvent(eventPayload);
      alert("Focus block scheduled in Google Calendar successfully!");
      loadGoogleCalendarEvents();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to schedule focus block: ${err.message}`);
    } finally {
      setGoogleCalendarLoading(false);
    }
  };

  // Fetch AI Insight on first mount
  useEffect(() => {
    fetchInsight();
  }, [demoMode, customApiKey]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, chatLoading]);

  const fetchInsight = async () => {
    setLoadingInsight(true);
    try {
      const tip = await AIService.getDailyInsight(demoMode, customApiKey);
      setInsight(tip);
    } catch (e) {
      console.error(e);
      setInsight("Action is the foundational key to all success. Break inertia right now!");
    } finally {
      setLoadingInsight(false);
    }
  };

  // Run AI prioritization logic
  const handleAIPrioritization = async () => {
    if (tasks.length === 0) return;
    setIsPrioritizing(true);
    try {
      const scores = await AIService.prioritizeTasks(tasks, demoMode, customApiKey);
      const updated = tasks.map((t) => {
        const item = scores.find((s) => s.id === t.id);
        if (item) {
          return {
            ...t,
            urgencyScore: item.urgencyScore,
            urgencyReason: item.reason
          };
        }
        return t;
      });
      syncTasks(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPrioritizing(false);
    }
  };

  // Add Task
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const defaultDeadline = () => {
      const d = new Date();
      d.setHours(d.getHours() + 12);
      return d.toISOString().slice(0, 16);
    };

    const added: Task = {
      id: "task-" + Date.now(),
      title: newTaskTitle.trim(),
      deadline: newTaskDeadline || defaultDeadline(),
      priority: newTaskPriority,
      status: newTaskStatus,
      subtasks: [],
      createdAt: new Date().toISOString()
    };

    const newTaskList = [added, ...tasks];
    setNewTaskTitle("");
    setNewTaskDeadline("");
    setNewTaskPriority("Medium");
    setNewTaskStatus("To Do");
    setShowAddModal(false);
    
    // Auto prioritize tasks once added to set urgency scores
    syncTasks(newTaskList);
    
    // Quick async prioritization trigger
    setTimeout(() => {
      triggerQuickPrioritize(newTaskList);
    }, 400);
  };

  // Quick background priority generator for immediate UI satisfaction
  const triggerQuickPrioritize = async (taskList: Task[]) => {
    try {
      const scores = await AIService.prioritizeTasks(taskList, demoMode, customApiKey);
      const updated = taskList.map((t) => {
        const item = scores.find((s) => s.id === t.id);
        if (item) {
          return {
            ...t,
            urgencyScore: item.urgencyScore,
            urgencyReason: item.reason
          };
        }
        return t;
      });
      syncTasks(updated);
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Task
  const handleDeleteTask = (id: string) => {
    const filtered = tasks.filter((t) => t.id !== id);
    syncTasks(filtered);
    // If smart schedule contains it, remove
    if (smartSchedule) {
      setSmartSchedule(smartSchedule.filter((s) => s.taskId !== id));
    }
  };

  // Toggle Subtask Completion
  const handleToggleSubtask = (taskId: string, subIndex: number) => {
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        const newSubs = [...t.subtasks];
        newSubs[subIndex] = { ...newSubs[subIndex], completed: !newSubs[subIndex].completed };
        return { ...t, subtasks: newSubs };
      }
      return t;
    });
    syncTasks(updated);
  };

  // Update Task Status
  const playDingSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const oscPrimary = ctx.createOscillator();
      const oscOvertone = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscPrimary.type = "sine";
      oscPrimary.frequency.setValueAtTime(1046.50, ctx.currentTime);
      oscPrimary.frequency.exponentialRampToValueAtTime(1318.51, ctx.currentTime + 0.08);

      oscOvertone.type = "sine";
      oscOvertone.frequency.setValueAtTime(1567.98, ctx.currentTime);

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);

      oscPrimary.connect(gainNode);
      oscOvertone.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscPrimary.start(ctx.currentTime);
      oscOvertone.start(ctx.currentTime);
      oscPrimary.stop(ctx.currentTime + 0.6);
      oscOvertone.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.warn("Audio ding blocked or unsupported:", e);
    }
  };

  const handleUpdateTaskStatus = (
    id: string,
    nextStatus: "To Do" | "In Progress" | "Done",
    event?: React.MouseEvent
  ) => {
    const updated = tasks.map((t) => {
      if (t.id === id) {
        return { ...t, status: nextStatus };
      }
      return t;
    });
    syncTasks(updated);

    if (nextStatus === "Done") {
      playDingSound();
      if (event && event.clientX && event.clientY) {
        triggerConfetti(event.clientX, event.clientY);
      } else {
        triggerConfetti();
      }
    }
  };

  // Break it down with Gemini
  const [loadingBreakdownId, setLoadingBreakdownId] = useState<string | null>(null);
  const handleBreakdownTask = async (task: Task) => {
    setLoadingBreakdownId(task.id);
    try {
      const steps = await AIService.breakDownTask(task.title, task.deadline, demoMode, customApiKey);
      const subtasks: SubTask[] = steps.map((s) => ({
        step: s.step,
        completed: false,
        estimatedMinutes: s.estimatedMinutes
      }));

      const updated = tasks.map((t) => {
        if (t.id === task.id) {
          return { ...t, subtasks };
        }
        return t;
      });
      syncTasks(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBreakdownId(null);
    }
  };

  // Add Habit
  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    const added: Habit = {
      id: "habit-" + Date.now(),
      name: newHabitName.trim(),
      frequency: newHabitFreq,
      completedDates: [],
      streak: 0,
      goal: newHabitGoal.trim() || "Consolidating routine for high productivity"
    };

    syncHabits([added, ...habits]);
    setNewHabitName("");
    setNewHabitGoal("");
    setShowAddHabitModal(false);
  };

  // Toggle Daily Habit Completion
  const handleToggleHabitDate = (habitId: string, dateStr: string) => {
    const updated = habits.map((h) => {
      if (h.id === habitId) {
        let dates = [...h.completedDates];
        if (dates.includes(dateStr)) {
          dates = dates.filter((d) => d !== dateStr);
        } else {
          dates.push(dateStr);
        }

        // Recompute streak
        // Simple streak algorithm: count backwards starting from today/yesterday
        let currentStreak = 0;
        const checkDate = new Date();
        
        for (let i = 0; i < 30; i++) {
          const checkStr = checkDate.toISOString().slice(0, 10);
          if (dates.includes(checkStr)) {
            currentStreak++;
          } else {
            // allow a single skip if checked is yesterday to preserve streak if today is not yet done
            if (i === 0) {
              // skip checking today, let's look at yesterday
              const yest = new Date();
              yest.setDate(yest.getDate() - 1);
              const yestStr = yest.toISOString().slice(0, 10);
              if (dates.includes(yestStr)) {
                // streak continues from yesterday
                checkDate.setDate(checkDate.getDate() - 1);
                continue;
              }
            }
            break;
          }
          checkDate.setDate(checkDate.getDate() - 1);
        }

        return {
          ...h,
          completedDates: dates,
          streak: currentStreak
        };
      }
      return h;
    });
    syncHabits(updated);
  };

  // Delete Habit
  const handleDeleteHabit = (id: string) => {
    const filtered = habits.filter((h) => h.id !== id);
    syncHabits(filtered);
  };

  // ===== REBUILT AI COACH CHAT AGGREGATION & SNEAK PEEK SYSTEM =====
  const buildFullContext = async (): Promise<string> => {
    const now = new Date();
    const todayStr = now.toDateString();

    // 1. Read all tasks from localStorage
    const tasksFromStorage = JSON.parse(localStorage.getItem('lmls_tasks') || localStorage.getItem('tasks') || '[]');
    
    const overdue = tasksFromStorage.filter((t: any) => 
      (t.status !== 'Done' && t.status !== 'completed') && new Date(t.deadline) < now
    );
    const todayTasks = tasksFromStorage.filter((t: any) => {
      const d = new Date(t.deadline);
      return (t.status !== 'Done' && t.status !== 'completed') && d.toDateString() === todayStr && d >= now;
    });
    const upcoming = tasksFromStorage.filter((t: any) => {
      const d = new Date(t.deadline);
      return (t.status !== 'Done' && t.status !== 'completed') && d > now && d.toDateString() !== todayStr;
    });
    const completed = tasksFromStorage.filter((t: any) => t.status === 'Done' || t.status === 'completed');

    const formatTask = (t: any) => {
      const due = new Date(t.deadline);
      const diffMs = due.getTime() - now.getTime();
      const diffH = Math.round(diffMs / 3600000);
      const timeStr = diffMs < 0 
        ? `OVERDUE by ${Math.abs(diffH)}h`
        : diffH < 24 ? `due in ${diffH}h` : `due ${due.toLocaleDateString()}`;
      return `  • "${t.title}" [${t.priority} priority] — ${timeStr}`;
    };

    // 2. Read Google Calendar events (next 7 days)
    let calendarContext = 'Google Calendar: Not connected';
    if (googleAccessToken) {
      try {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
          `timeMin=${now.toISOString()}&timeMax=${weekEnd.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=20`,
          { headers: { Authorization: `Bearer ${googleAccessToken}` } }
        );
        const data = await res.json();
        const events = (data.items || []).map((e: any) => {
          const start = e.start?.dateTime || e.start?.date;
          const startDate = new Date(start);
          return `  • "${e.summary}" — ${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
        });
        calendarContext = events.length > 0 
          ? `Google Calendar events (next 7 days):\n${events.join('\n')}`
          : 'Google Calendar: Connected but no upcoming events';
      } catch {
        calendarContext = 'Google Calendar: Connected (fetch failed)';
      }
    }

    // 3. Build habits context
    const habitsFromStorage = JSON.parse(localStorage.getItem('lmls_habits') || localStorage.getItem('habits') || '[]');
    const habitContext = habitsFromStorage.length > 0
      ? `Active habits:\n${habitsFromStorage.map((h: any) => `  • "${h.name}" — ${h.streak || 0} day streak`).join('\n')}`
      : 'No habits tracked yet';

    // 4. Compile full context string
    return `
CURRENT DATE & TIME: ${now.toLocaleString()}

OVERDUE TASKS (${overdue.length}):
${overdue.length > 0 ? overdue.map(formatTask).join('\n') : '  None'}

TODAY'S REMAINING TASKS (${todayTasks.length}):
${todayTasks.length > 0 ? todayTasks.map(formatTask).join('\n') : '  None'}

UPCOMING TASKS (${upcoming.length}):
${upcoming.length > 0 ? upcoming.map(formatTask).join('\n') : '  None'}

COMPLETED TODAY: ${completed.filter((t: any) => new Date(t.updatedAt || t.createdAt || now.toISOString()).toDateString() === todayStr).length} tasks

${calendarContext}

${habitContext}
    `.trim();
  };

  const appendMessage = (role: "user" | "assistant" | "ai", content: string) => {
    const finalRole = (role === "assistant" || role === "ai") ? "assistant" : "user";
    const newMsg: ChatMessage = {
      id: "chat-" + Date.now() + "-" + Math.random(),
      role: finalRole,
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatHistory((prev) => {
      const updated = [...prev, newMsg];
      localStorage.setItem("lmls_chat", JSON.stringify(updated));
      return updated;
    });
  };

  const clearInput = () => {
    setChatInput("");
  };

  const showTyping = () => {
    setChatLoading(true);
    return "typing-id";
  };

  const removeTyping = (id: any) => {
    setChatLoading(false);
  };

  const sendMessage = async (userMessage: string, silent: boolean = false) => {
    if (!silent) {
      appendMessage('user', userMessage);
    }
    clearInput();
    const typingId = showTyping();

    const context = await buildFullContext();
    const apiKeyToUse = customApiKey || "";

    try {
      const response = await fetch("/api/coach-chat", {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(apiKeyToUse ? { "x-gemini-api-key": apiKeyToUse } : {})
        },
        body: JSON.stringify({
          userMessage,
          context
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to fetch response");
      }

      const data = await response.json();
      let reply = data.content || 'Sorry, could not get a response.';
      reply = reply.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
      removeTyping(typingId);
      appendMessage('assistant', reply);
    } catch (err: any) {
      removeTyping(typingId);
      if (demoMode && !apiKeyToUse) {
        appendMessage('assistant', 'Add your Gemini API key in Settings to enable AI analysis');
      } else {
        appendMessage('assistant', 'Connection error. Check your API key in Settings.');
      }
    }
  };

  const handleSendChat = async (msgText: string) => {
    await sendMessage(msgText);
  };

  const PRESETS = [
    { label: '🚨 What should I do RIGHT NOW?', msg: 'Looking at all my tasks and deadlines, what is the single most important thing I should do right now? Be specific.' },
    { label: '📅 Plan my day hour by hour', msg: 'Create a realistic hour-by-hour plan for the rest of today based on my tasks and calendar events. Include time blocks.' },
    { label: '⚠️ Any deadline conflicts?', msg: 'Analyze my tasks and calendar events. Are there any time conflicts or tasks I am at risk of missing? Warn me.' },
    { label: '😰 I am overwhelmed — help', msg: 'I have too much to do and feel overwhelmed. Look at my tasks and tell me what to drop, delay, or delegate. Prioritize ruthlessly.' },
    { label: '📊 Give me a productivity report', msg: 'Analyze all my tasks — completed, pending, overdue. Give me a short productivity report and 2 specific improvements I should make.' },
    { label: '🎯 What can I finish today?', msg: 'Based on the time left today and my pending tasks, which tasks are realistic to complete today? Give me a focused hit list.' },
  ];

  const runAutoAnalysis = async () => {
    const tasksFromStorage = JSON.parse(localStorage.getItem('lmls_tasks') || localStorage.getItem('tasks') || '[]');
    if (tasksFromStorage.length === 0) return;
    await sendMessage('Give me a quick snapshot of my current situation — what needs my attention most urgently right now?', true);
  };

  useEffect(() => {
    if (currentTab === "chat" && !hasRunAutoAnalysis) {
      setHasRunAutoAnalysis(true);
      runAutoAnalysis();
    }
  }, [currentTab, hasRunAutoAnalysis]);

  // Action button clicks from Chat bubbles
  const handleChatAction = (actionType: string) => {
    if (actionType.includes("Add to Tasks") || actionType.includes("Add task")) {
      setNewTaskTitle("Focus Sprint suggested by AI Coach");
      setNewTaskPriority("High");
      setNewTaskStatus("To Do");
      setShowAddModal(true);
      setCurrentTab("tasks");
    } else if (actionType.includes("Set Reminder") || actionType.includes("Reminder")) {
      alert("⏰ Proactive nudge set! We will alarm you shortly. Put your phone on focus mode now!");
    }
  };

  // Generate habit routine with AI
  const handleGenerateHabitPlan = async () => {
    if (!habitGoalInput.trim()) return;
    setIsGeneratingHabitPlan(true);
    try {
      const plan = await AIService.generateHabitPlan(habitGoalInput.trim(), demoMode, customApiKey);
      setGeneratedHabitPlan(plan);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingHabitPlan(false);
    }
  };

  // Accept a week milestone and add as habits
  const handleAdoptMilestoneAsHabit = (actionStr: string) => {
    const exists = habits.some((h) => h.name.toLowerCase() === actionStr.toLowerCase());
    if (exists) {
      alert("You are already tracking this habit!");
      return;
    }
    const added: Habit = {
      id: "habit-" + Date.now(),
      name: actionStr,
      frequency: "Daily",
      completedDates: [],
      streak: 0,
      goal: `Adopted from: ${habitGoalInput || "Custom 30-day Goal milestone"}`
    };
    syncHabits([added, ...habits]);
    alert(`Added "${actionStr}" to your Active Habits list!`);
  };

  // Generate smart focus schedule
  const handleGenerateSmartSchedule = async () => {
    setIsScheduling(true);
    setScheduleGapsRequested(true);
    try {
      const blocks = await AIService.generateSmartSchedule(profile.workHours, tasks, demoMode, customApiKey);
      setSmartSchedule(blocks);
    } catch (e) {
      console.error(e);
    } finally {
      setIsScheduling(false);
    }
  };

  // Clear all data & load clean demo
  const handleResetApp = () => {
    if (confirm("Are you sure you want to reset all data back to clean demo data?")) {
      setTasks(DEMO_TASKS);
      setHabits(DEMO_HABITS);
      setProfile(DEFAULT_PROFILE);
      setChatHistory([DEFAULT_WELCOME_MSG]);
      setSmartSchedule(null);
      setGeneratedHabitPlan(null);
      localStorage.setItem("lmls_tasks", JSON.stringify(DEMO_TASKS));
      localStorage.setItem("lmls_habits", JSON.stringify(DEMO_HABITS));
      localStorage.setItem("lmls_profile", JSON.stringify(DEFAULT_PROFILE));
      localStorage.setItem("lmls_chat", JSON.stringify([DEFAULT_WELCOME_MSG]));
      alert("App state has been successfully reset!");
    }
  };

  // Helper counters
  const now = new Date();
  const getTodayDatesString = () => now.toISOString().slice(0, 10);
  const todayStr = getTodayDatesString();

  const getHighPriorityDeadlineConflicts = () => {
    const activeHigh = tasks.filter((t) => t.priority === "High" && t.status !== "Done");
    const groups: { [key: string]: Task[] } = {};
    activeHigh.forEach((task) => {
      const dl = task.deadline;
      if (!groups[dl]) {
        groups[dl] = [];
      }
      groups[dl].push(task);
    });
    return Object.entries(groups)
      .filter(([_, list]) => list.length >= 2)
      .map(([deadline, list]) => ({
        deadline,
        tasks: list
      }));
  };

  const getDueTodayCount = () => {
    return tasks.filter((t) => {
      if (t.status === "Done") return false;
      const deadlineDate = t.deadline.slice(0, 10);
      return deadlineDate === todayStr;
    }).length;
  };

  const getOverdueCount = () => {
    return tasks.filter((t) => {
      if (t.status === "Done") return false;
      const hours = AIService.getHoursUntilDeadline(t.deadline);
      return hours < 0;
    }).length;
  };

  const criticalTasks = [...tasks]
    .filter((t) => t.status !== "Done")
    .sort((a, b) => {
      const metaA = getTaskUrgencyMeta(a);
      const metaB = getTaskUrgencyMeta(b);
      return metaB.score - metaA.score;
    });

  // Calculate percentage of tasks completed today
  const getTodayTasksCount = () => {
    return tasks.filter((t) => t.deadline.slice(0, 10) === todayStr).length;
  };
  const getTodayCompletedTasksCount = () => {
    return tasks.filter((t) => t.deadline.slice(0, 10) === todayStr && t.status === "Done").length;
  };
  const todayTasksCount = getTodayTasksCount();
  const todayCompletedCount = getTodayCompletedTasksCount();
  const focusScoreVal = todayTasksCount > 0 ? Math.round((todayCompletedCount / todayTasksCount) * 100) : 100;

  const focusRadius = 24;
  const focusCircumference = 2 * Math.PI * focusRadius;
  const focusStrokeDashoffset = focusCircumference - (focusScoreVal / 100) * focusCircumference;

  // Time remaining calculator
  const formatTimeLeft = (deadlineStr: string) => {
    const hoursLeft = AIService.getHoursUntilDeadline(deadlineStr);
    if (hoursLeft < 0) {
      const abs = Math.abs(hoursLeft);
      if (abs < 1) {
        return `Overdue by ${Math.round(abs * 60)}m`;
      }
      return `Overdue by ${Math.floor(abs)}h ${Math.round((abs % 1) * 60)}m`;
    } else {
      if (hoursLeft < 1) {
        return `Due in ${Math.round(hoursLeft * 60)}m`;
      }
      return `Due in ${Math.floor(hoursLeft)}h ${Math.round((hoursLeft % 1) * 60)}m`;
    }
  };

  // Calendar dates matrix setup (current month)
  const currentMonthDate = new Date();
  const currentYear = currentMonthDate.getFullYear();
  const currentMonth = currentMonthDate.getMonth();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const [selectedCalendarDateStr, setSelectedCalendarDateStr] = useState<string>(todayStr);

  // Filter tasks for task manager based on chips
  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === "all") return true;
    if (taskFilter === "today") {
      return t.deadline.slice(0, 10) === todayStr;
    }
    if (taskFilter === "overdue") {
      const hours = AIService.getHoursUntilDeadline(t.deadline);
      return hours < 0 && t.status !== "Done";
    }
    if (taskFilter === "upcoming") {
      const hours = AIService.getHoursUntilDeadline(t.deadline);
      return hours >= 0 && t.status !== "Done";
    }
    return true;
  });

  // Calculate habit completion percentage for active circular rings
  const getHabitCompletionRate = (habit: Habit) => {
    const last7Days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Days.push(d.toISOString().slice(0, 10));
    }
    const completedInLast7 = habit.completedDates.filter((d) => last7Days.includes(d)).length;
    const target = habit.frequency === "Daily" ? 7 : 1;
    return Math.min(100, Math.round((completedInLast7 / target) * 100));
  };

  return (
    <div className={`min-h-screen bg-[#F8FAFC] flex flex-col pb-24 md:pb-6 relative text-[#1E293B] font-sans max-w-lg mx-auto md:max-w-4xl shadow-xl border-x border-slate-100 ${darkMode ? "dark-mode" : ""}`} id="app-root">
      <ConfettiCanvas />
      
      {/* Top Banner & Header */}
      <header className="bg-[#0F172A] border-b border-slate-800 text-white p-4 sticky top-0 z-30 shadow-sm flex items-center justify-between" id="app-header">
        <div className="flex items-center gap-2">
          <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md jelly-icon quick-action-icon">
            <Flame className="w-6 h-6 text-amber-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Last-Minute Life Saver</h1>
            <p className="text-[11px] text-[#94A3B8] font-mono">
              Mode: {demoMode ? "✨ Demo Mode (Offline)" : "⚡ Gemini Pro API Live"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 relative">
          {/* Subtle helper banner for new users to configure their API key and name */}
          {!showSettings && (
            <div className="hidden md:flex items-center gap-1.5 bg-indigo-950/80 border border-indigo-800/60 rounded-lg px-2.5 py-1 text-[10px] text-indigo-200 animate-pulse font-medium shadow-sm">
              <span>Configure Name & API Key here ⚙️</span>
            </div>
          )}
          
          {/* Quick toggle settings button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-white/10 rounded-lg transition duration-200 text-slate-300 hover:text-white relative group"
            aria-label="Toggle App Settings"
            id="header-settings-btn"
          >
            <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
            
            {/* Visual notification dot to grab attention */}
            {!showSettings && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping pointer-events-none" />
            )}
            {!showSettings && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full pointer-events-none" />
            )}
            
            {/* Tooltip for hover / touchscreen */}
            <span className="absolute top-full right-0 mt-2 bg-slate-900 border border-slate-700 text-[10px] text-slate-200 font-bold px-2 py-1 rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
              Change Name & Gemini API Key
            </span>
          </button>
        </div>
      </header>

      {/* Settings Panel Drawer */}
      {showSettings && (
        <div className="bg-slate-900 text-slate-200 p-5 border-b border-slate-700 animate-fade-in relative z-20" id="settings-panel">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-brand-accent" /> Control Center
            </h3>
            <button 
              onClick={() => setShowSettings(false)} 
              className="p-1 hover:bg-slate-800 rounded-full"
              id="settings-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {/* Custom Gemini Key Input */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-slate-400 font-semibold">Custom Gemini API Key</label>
                {customApiKey && (
                  <button
                    onClick={() => saveApiKey("")}
                    className="text-rose-400 hover:text-rose-300 text-[10px] underline font-medium cursor-pointer"
                  >
                    Clear Key
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  type={showApiKey ? "text" : "password"}
                  placeholder="Paste your GEMINI_API_KEY"
                  value={customApiKey}
                  onChange={(e) => saveApiKey(e.target.value)}
                  className="w-full bg-slate-800 text-white pl-3 pr-10 py-2 rounded border border-slate-700 focus:outline-none focus:border-purple-500 font-mono text-xs"
                  id="api-key-input"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 text-slate-400 hover:text-white cursor-pointer"
                  title={showApiKey ? "Hide Key" : "Show Key"}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {apiKeyFeedback ? (
                <p className="text-[10px] text-emerald-400 mt-1 font-semibold animate-pulse">
                  {apiKeyFeedback}
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 mt-1">
                  Keys are stored securely in your local browser storage.
                </p>
              )}
            </div>

            {/* Toggle Demo Mode */}
            <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg">
              <div>
                <span className="block text-white font-medium">Demo Mode</span>
                <span className="block text-[10px] text-slate-400">Uses smart local AI heuristics without hitting Gemini billing limits</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={demoMode}
                  onChange={(e) => toggleDemoMode(e.target.checked)}
                  className="sr-only peer"
                  id="demo-mode-checkbox"
                />
                <div className="w-9 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-500"></div>
              </label>
            </div>

            {/* Global Dark Mode Toggle */}
            <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                {darkMode ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
                <div>
                  <span className="block text-white font-medium">Dark Mode</span>
                  <span className="block text-[10px] text-slate-400">Switches to deep slate backgrounds and high-contrast text</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={darkMode}
                  onChange={(e) => toggleDarkMode(e.target.checked)}
                  className="sr-only peer"
                  id="dark-mode-checkbox"
                />
                <div className="w-9 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
              </label>
            </div>

            {/* Edit User Profile */}
            <div className="grid grid-cols-2 gap-3 bg-slate-800/50 p-3 rounded-lg">
              <div>
                <label className="block text-slate-400 mb-1">Your Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => syncProfile({ ...profile, name: e.target.value })}
                  className="w-full bg-slate-800 text-white px-2 py-1.5 rounded border border-slate-700"
                  id="profile-name-input"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Productivity Archetype</label>
                <select
                  value={profile.productivityStyle}
                  onChange={(e: any) => syncProfile({ ...profile, productivityStyle: e.target.value })}
                  className="w-full bg-slate-800 text-white px-2 py-1.5 rounded border border-slate-700"
                  id="profile-style-select"
                >
                  <option value="Last-Minute Warrior">Last-Minute Warrior</option>
                  <option value="Structured Planner">Structured Planner</option>
                  <option value="Chronic Procrastinator">Chronic Procrastinator</option>
                  <option value="Hyperfocus Sprint Specialist">Hyperfocus Sprint Specialist</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">Available Work Hours Today ({profile.workHours}h)</label>
                <input
                  type="range"
                  min="1"
                  max="16"
                  value={profile.workHours}
                  onChange={(e) => syncProfile({ ...profile, workHours: parseInt(e.target.value) })}
                  className="w-full accent-teal-400"
                  id="profile-hours-range"
                />
              </div>
            </div>

            {/* Google Calendar Integration Status */}
            <div className="bg-slate-800 p-3 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-white font-medium">Google Calendar Connection</span>
                  <span className="block text-[10px] text-slate-400">
                    {googleUser 
                      ? `Connected as ${googleUser.email}` 
                      : "Not connected to Google"}
                  </span>
                </div>
                {googleUser ? (
                  <button
                    onClick={handleGoogleSignOut}
                    className="bg-red-950 text-red-300 border border-red-800 hover:bg-red-900 font-bold px-3 py-1 rounded text-[10px] cursor-pointer"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={googleCalendarLoading}
                    className="bg-teal-950 text-teal-300 border border-teal-800 hover:bg-teal-900 font-bold px-3 py-1 rounded text-[10px] cursor-pointer"
                  >
                    {googleCalendarLoading ? "Connecting..." : "Connect"}
                  </button>
                )}
              </div>
            </div>

            {/* Force Reload / Reset Demo */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <button
                onClick={handleResetApp}
                className="text-red-400 hover:text-red-300 transition flex items-center gap-1 hover:underline"
                id="reset-app-btn"
              >
                <Trash2 className="w-3 h-3" /> Reset App to Clean Seed
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded font-semibold transition"
                id="save-settings-btn"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-4 overflow-y-auto space-y-6" id="main-content">
        
        {/* ========================================================= */}
        {/* TAB 1: DASHBOARD */}
        {/* ========================================================= */}
        {currentTab === "dashboard" && (
          <div className="space-y-6 animate-fade-in" id="screen-dashboard">
            {/* Welcome Greeting */}
            <div className="bg-[#0F172A] text-white rounded-2xl p-6 shadow-lg relative overflow-hidden" id="dashboard-greeting-card">
              {/* Subtle radial gradient behind brain icon */}
              <div className="absolute right-0 bottom-0 w-64 h-64 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_center,_#6366F1_0%,_transparent_70%)] flex items-center justify-center">
                <Brain className="w-36 h-36 text-indigo-400" />
              </div>

              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-[#1D9E75]/20 text-teal-300 text-[10px] uppercase tracking-wider font-mono px-2.5 py-1 rounded-full font-bold">
                      {profile.productivityStyle}
                    </span>
                  </div>
                  
                  <h2 className="text-[28px] font-semibold text-white tracking-tight leading-tight">
                    Good {now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"}, {profile.name}!
                  </h2>
                  
                  <p className="text-[14px] text-[#F59E0B] font-medium">
                    {getDueTodayCount()} tasks due today · {getOverdueCount()} overdue
                  </p>
                </div>

                {/* Calm Focus Score ring */}
                <div className="flex items-center gap-4 bg-[#1E293B]/60 p-4 rounded-xl border border-[#334155]/50 backdrop-blur-sm self-start sm:self-center">
                  <div className="relative w-16 h-16 shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 60 60">
                      <circle
                        cx="30"
                        cy="30"
                        r={focusRadius}
                        stroke="#334155"
                        strokeWidth="4"
                        fill="transparent"
                      />
                      <circle
                        cx="30"
                        cy="30"
                        r={focusRadius}
                        stroke="#6366F1"
                        strokeWidth="4.5"
                        fill="transparent"
                        strokeDasharray={focusCircumference}
                        strokeDashoffset={focusStrokeDashoffset}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-black font-mono text-white">
                      {focusScoreVal}%
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[11px] uppercase tracking-wider text-[#94A3B8] font-bold font-mono">Daily Focus Score</span>
                    <h4 className="text-xs font-semibold text-slate-200">
                      {focusScoreVal === 100 ? "All tasks cleared today! 🎉" : "Progress toward goals"}
                    </h4>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Warning for High-Priority Scheduling Conflicts */}
            {(() => {
              const conflicts = getHighPriorityDeadlineConflicts();
              if (conflicts.length === 0) return null;
              return (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4.5 shadow-sm animate-fade-in flex flex-col gap-3" id="conflict-warning-alert">
                  <div className="flex items-start gap-3">
                    <div className="bg-red-100 p-2 rounded-xl text-red-600">
                      <AlertTriangle className="w-5.5 h-5.5 animate-bounce" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-red-900 text-sm">Critical Scheduling Conflicts Detected!</h3>
                      <p className="text-xs text-red-700 leading-relaxed">
                        You have two or more **High-priority** tasks scheduled with the exact same deadline. This can lead to overwhelming pressure or missed commitments!
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-red-100 pt-3">
                    {conflicts.map((conf, index) => {
                      const dateObj = new Date(conf.deadline);
                      const formattedTime = `${dateObj.toLocaleDateString()} at ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                      return (
                        <div key={index} className="bg-white/80 p-3 rounded-xl border border-red-100 flex flex-col gap-1.5 shadow-xs">
                          <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider font-mono">
                            ⚠️ Conflicts due on: {formattedTime}
                          </span>
                          <div className="space-y-1">
                            {conf.tasks.map((t) => (
                              <div key={t.id} className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                <span className="text-xs font-semibold text-slate-800 line-clamp-1">
                                  {t.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => setCurrentTab("tasks")}
                      className="text-xs font-bold text-red-700 hover:text-red-900 underline flex items-center gap-1 cursor-pointer"
                    >
                      Reschedule Tasks <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Quick Actions section */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm" id="quick-actions-section">
              <div className="quick-actions-row">
                <div 
                  className="qa-item" 
                  onClick={() => {
                    setNewTaskTitle("");
                    setShowAddModal(true);
                  }}
                  id="qa-btn-add"
                >
                  <div className="quick-action-icon qa-add text-indigo-600">
                    <Plus className="w-5.5 h-5.5" />
                  </div>
                  <span className="qa-label">Add Task</span>
                </div>

                <div 
                  className="qa-item" 
                  onClick={() => {
                    setCurrentTab("calendar");
                  }}
                  id="qa-btn-plan"
                >
                  <div className="quick-action-icon qa-plan text-amber-600">
                    <CalendarDays className="w-5.5 h-5.5" />
                  </div>
                  <span className="qa-label">Plan My Day</span>
                </div>

                <div 
                  className="qa-item" 
                  onClick={handleAIPrioritization}
                  id="qa-btn-prioritize"
                >
                  <div className="quick-action-icon qa-prior text-emerald-600">
                    <Sparkles className="w-5.5 h-5.5" />
                  </div>
                  <span className="qa-label">Prioritize</span>
                </div>

                <div 
                  className="qa-item" 
                  onClick={() => {
                    setCurrentTab("chat");
                    handleSendChat("I need a boost of high-adrenaline motivation! Give me an intense pep talk to crush my procrastination.");
                  }}
                  id="qa-btn-motivate"
                >
                  <div className="quick-action-icon qa-motiv text-orange-600">
                    <Flame className="w-5.5 h-5.5" />
                  </div>
                  <span className="qa-label">Motivate Me</span>
                </div>
              </div>
            </div>

            {/* AI Insight of the Day Banner */}
            <div className="bg-gradient-to-r from-[#EEF2FF] to-[#E0E7FF] rounded-2xl p-5 border-l-4 border-l-[#6366F1] flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden shadow-sm shimmer-card ai-card" id="insight-banner">
              <div className="flex gap-3 items-start flex-1">
                <div className="bg-[#6366F1]/10 p-2.5 h-fit rounded-xl text-[#6366F1] jelly-icon quick-action-icon">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase tracking-wider font-bold text-[#6366F1] font-mono block">
                    AI Insight of the Day
                  </span>
                  {loadingInsight ? (
                    <div className="space-y-1.5 py-1">
                      <div className="h-3 bg-slate-200 rounded shimmer w-5/6"></div>
                      <div className="h-3 bg-slate-200 rounded shimmer w-3/4"></div>
                    </div>
                  ) : (
                    <p className="text-[14px] leading-[1.8] text-[#1E293B] italic">
                      "{insight || "Do the smallest step first. Breaking the startup inertia is 90% of the battle. Momentum is your friend!"}"
                    </p>
                  )}
                </div>
              </div>

              {/* Prominent Refuel Button */}
              <button
                onClick={fetchInsight}
                disabled={loadingInsight}
                className="bg-white hover:bg-[#F8FAFC] text-[#6366F1] border border-[#6366F1]/20 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition duration-150 shrink-0 self-start md:self-center glow-btn"
                id="insight-refresh-btn"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingInsight ? "animate-spin" : ""}`} />
                Refuel Mindset
              </button>
            </div>

            {/* Critical Tasks Row (Sorted by AI Urgency Score) */}
            <div className="space-y-3" id="critical-tasks-section">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-semibold text-[#1E293B] flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#6366F1]" /> AI-Prioritized Urgency Stack
                </h3>
                <button
                  onClick={handleAIPrioritization}
                  disabled={isPrioritizing || tasks.length === 0}
                  className="text-xs bg-[#6366F1] hover:bg-[#4F46E5] text-white px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition duration-200 disabled:opacity-50 shadow-sm active:scale-95 glow-btn"
                  id="dashboard-re-evaluate-btn"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isPrioritizing ? "Ranking..." : "Re-Rank Priorities"}
                </button>
              </div>

              {criticalTasks.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center text-[#64748B]">
                  <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm">No pending tasks! You are completely clear.</p>
                  <button
                    onClick={() => {
                      setNewTaskTitle("Complete urgent business delivery plan");
                      setShowAddModal(true);
                    }}
                    className="mt-3 text-xs text-[#6366F1] font-semibold hover:underline"
                  >
                    + Add a new task now
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {criticalTasks.slice(0, 3).map((task) => {
                    const meta = getTaskUrgencyMeta(task);
                    const isOverdue = AIService.getHoursUntilDeadline(task.deadline) < 0 && task.status !== "Done";
                    return (
                      <div
                        key={task.id}
                        className={`py-4 px-[18px] rounded-[16px] overflow-hidden bg-white border border-slate-100 ${meta.borderColor} shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 task-card ${isOverdue ? "overdue-pulse overdue-card" : ""}`}
                        id={`critical-task-card-${task.id}`}
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            {/* Remove the repeated 'HIGH PRIORITY' badge from every card. Only show it for 8+ scores, using Title Case with a colored dot. */}
                            {meta.score >= 8 && (
                              <span className="flex items-center gap-1.5 text-xs text-[#64748B] font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]"></span>
                                High Priority
                              </span>
                            )}

                            {task.id.startsWith("gcal-") && (
                              <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                <CalendarIcon className="w-3 h-3" /> GCal
                              </span>
                            )}

                            <span className="text-xs text-[#64748B] font-medium">
                              AI Urgency: <strong className={meta.score >= 10 ? "text-[#EF4444]" : meta.score >= 7 ? "text-[#F59E0B]" : "text-[#3B82F6]"}>{meta.score}/10</strong>
                            </span>

                            <span className="text-xs text-[#64748B] font-medium flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatTimeLeft(task.deadline)}
                            </span>
                          </div>

                          <h4 className="text-[15px] font-medium text-[#1E293B] leading-tight">
                            {task.title}
                          </h4>

                          {meta.message && (
                            <p className="text-xs text-slate-500 leading-snug">
                              💡 {meta.message}
                            </p>
                          )}

                          {/* Quick subtask percentage progress */}
                          {task.subtasks.length > 0 && (
                            <div className="space-y-1 pt-1">
                              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                                <span>Subtasks Progress</span>
                                <span>
                                  {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1">
                                <div
                                  className="bg-[#1D9E75] h-1 rounded-full transition-all duration-300"
                                  style={{
                                    width: `${
                                      (task.subtasks.filter((s) => s.completed).length / task.subtasks.length) * 100
                                    }%`
                                  }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Action buttons inside Dashboard Row */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={(e) => handleUpdateTaskStatus(task.id, "Done", e)}
                            className="bg-[#10B981] hover:bg-[#0D9488] text-white p-2 rounded-xl transition duration-150 ripple-btn"
                            title="Complete Task"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setCurrentTab("tasks");
                            }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-xl transition duration-150"
                            title="Open in Task Manager"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  
                  {criticalTasks.length > 3 && (
                    <button
                      onClick={() => setCurrentTab("tasks")}
                      className="text-xs text-center text-[#6366F1] font-semibold hover:underline block py-1"
                    >
                      View all remaining {criticalTasks.length - 3} tasks in Manager →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Smart mini stats card */}
            <div className="grid grid-cols-2 gap-4" id="dashboard-stats-grid">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                <span className="text-slate-400 text-xs block mb-1 uppercase tracking-wider font-mono">Task Status</span>
                <span className="text-2xl font-black text-slate-800" id="stats-completion">
                  {tasks.filter((t) => t.status === "Done").length} / {tasks.length}
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">completed tasks</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                <span className="text-slate-400 text-xs block mb-1 uppercase tracking-wider font-mono">Habit Streaks</span>
                <span className="text-2xl font-black text-[#1D9E75] flex items-center justify-center gap-1" id="stats-streak">
                  <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
                  {habits.length > 0 ? Math.max(...habits.map((h) => h.streak), 0) : 0} Days
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">highest current streak</span>
              </div>
            </div>

            {/* Minimalist Proactive Focus Quick-Widget */}
            <div className="bg-[#0F172A] text-white rounded-2xl p-5 border border-slate-800 shadow-xl relative overflow-hidden" id="pomodoro-quick-widget">
              {/* Radial glow background */}
              <div className="absolute right-0 top-0 w-32 h-32 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_#6366F1_0%,_transparent_70%)]" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4">
                  {/* Rotating/Pulse Icon Ring */}
                  <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-500 ${
                    pomodoroActive 
                      ? pomodoroMode === "focus" 
                        ? "border-indigo-500 bg-indigo-500/10 animate-pulse" 
                        : "border-emerald-500 bg-emerald-500/10 animate-pulse"
                      : "border-slate-800 bg-slate-900"
                  }`}>
                    <Timer className={`w-6 h-6 ${
                      pomodoroActive 
                        ? pomodoroMode === "focus" ? "text-indigo-400" : "text-emerald-400"
                        : "text-slate-400"
                    }`} />
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-slate-200">Pomodoro Focus Sprint</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xl font-black font-mono tracking-tight ${
                        pomodoroActive 
                          ? pomodoroMode === "focus" ? "text-indigo-400" : "text-emerald-400"
                          : "text-white"
                      }`}>
                        {(() => {
                          const mins = Math.floor(pomodoroTimeLeft / 60);
                          const secs = pomodoroTimeLeft % 60;
                          return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
                        })()}
                      </span>
                      <span className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md ${
                        pomodoroActive
                          ? pomodoroMode === "focus"
                            ? "bg-indigo-500/20 text-indigo-300"
                            : "bg-emerald-500/20 text-emerald-300"
                          : "bg-slate-800 text-slate-400"
                      }`}>
                        {pomodoroActive 
                          ? pomodoroMode === "focus" ? "Focusing" : "On Break"
                          : "Standby"
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right controls and redirect */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setPomodoroAlarmActive(false);
                      setPomodoroActive(!pomodoroActive);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-md ${
                      pomodoroActive
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }`}
                  >
                    {pomodoroActive ? "Pause" : "Start Focus"}
                  </button>
                  <button
                    onClick={() => setCurrentTab("focus")}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
                  >
                    Deep Work Arena <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress bar overlay at the very bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900">
                <div 
                  className={`h-full transition-all duration-1000 ease-linear ${
                    pomodoroMode === "focus" ? "bg-indigo-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${(1 - pomodoroTimeLeft / pomodoroDuration) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}


        {/* ========================================================= */}
        {/* TAB 2: TASK MANAGER */}
        {/* ========================================================= */}
        {currentTab === "tasks" && (
          <div className="space-y-6 animate-fade-in" id="screen-task-manager">
            
            {/* Filter and View Toggles */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4" id="task-manager-controls">
              <div className="flex flex-wrap gap-1.5">
                {(["all", "today", "overdue", "upcoming"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTaskFilter(filter)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                      taskFilter === filter
                        ? "bg-[#6366F1] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    id={`filter-chip-${filter}`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* View Toggle (List vs Kanban) */}
              <div className="bg-slate-100 p-1 rounded-xl flex self-start sm:self-auto">
                <button
                  onClick={() => setTaskViewMode("list")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    taskViewMode === "list"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  id="view-toggle-list"
                >
                  <ListTodo className="w-3.5 h-3.5" /> List
                </button>
                <button
                  onClick={() => setTaskViewMode("kanban")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    taskViewMode === "kanban"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  id="view-toggle-kanban"
                >
                  <Layout className="w-3.5 h-3.5" /> Kanban
                </button>
              </div>
            </div>

            {/* List View */}
            {taskViewMode === "list" && (
              <div className="space-y-4" id="list-view-container">
                {/* Select All & Bulk Actions Panel */}
                {filteredTasks.length > 0 && (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col gap-3 animate-fade-in" id="bulk-actions-panel">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={filteredTasks.length > 0 && filteredTasks.every((t) => selectedTaskIds.includes(t.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const allIds = filteredTasks.map((t) => t.id);
                              setSelectedTaskIds((prev) => {
                                const unique = new Set([...prev, ...allIds]);
                                return Array.from(unique);
                              });
                            } else {
                              const filteredIds = filteredTasks.map((t) => t.id);
                              setSelectedTaskIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
                            }
                          }}
                          className="rounded text-[#6366F1] focus:ring-[#6366F1] w-4.5 h-4.5 border-slate-300 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-700">
                          Select All ({filteredTasks.length} tasks)
                        </span>
                      </label>
                      
                      {selectedTaskIds.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#6366F1] font-bold bg-[#6366F1]/10 px-2.5 py-1 rounded-full border border-[#6366F1]/20">
                            {selectedTaskIds.length} task{selectedTaskIds.length > 1 ? "s" : ""} selected
                          </span>
                          <button
                            onClick={() => setSelectedTaskIds([])}
                            className="text-xs text-slate-500 hover:text-slate-800 font-medium underline cursor-pointer"
                          >
                            Clear selection
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Bulk Action Controls */}
                    {selectedTaskIds.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60 animate-fade-in">
                        <button
                          onClick={() => {
                            const updated = tasks.map((t) =>
                              selectedTaskIds.includes(t.id) ? { ...t, status: "Done" as const } : t
                            );
                            syncTasks(updated);
                            setSelectedTaskIds([]);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1 transition cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Complete Selected
                        </button>

                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-xs">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Priority:</span>
                          <select
                            onChange={(e) => {
                              const priority = e.target.value as "High" | "Medium" | "Low";
                              if (!priority) return;
                              const updated = tasks.map((t) =>
                                selectedTaskIds.includes(t.id) ? { ...t, priority } : t
                              );
                              syncTasks(updated);
                              setSelectedTaskIds([]);
                              e.target.value = "";
                            }}
                            defaultValue=""
                            className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                          >
                            <option value="" disabled>Change to...</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </div>

                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete ${selectedTaskIds.length} task(s)?`)) {
                              const updated = tasks.filter((t) => !selectedTaskIds.includes(t.id));
                              syncTasks(updated);
                              setSelectedTaskIds([]);
                            }
                          }}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1 transition cursor-pointer ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Selected
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {filteredTasks.length === 0 ? (
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-12 text-center text-[#64748B]">
                    <ListTodo className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm">No tasks found matching this criteria.</p>
                  </div>
                ) : (
                  filteredTasks.map((task) => {
                    const meta = getTaskUrgencyMeta(task);
                    const isOverdue = AIService.getHoursUntilDeadline(task.deadline) < 0 && task.status !== "Done";
                    return (
                      <div
                        key={task.id}
                        className={`py-4 px-[18px] rounded-[16px] overflow-hidden bg-white border border-slate-100 ${task.status === "Done" ? "opacity-70" : meta.borderColor} shadow-sm task-card ${isOverdue ? "overdue-pulse overdue-card" : ""}`}
                        id={`task-item-${task.id}`}
                      >
                        {/* Task Top Meta Info */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            {/* Card selection checkbox */}
                            <div className="pt-1 select-none">
                              <input
                                type="checkbox"
                                checked={selectedTaskIds.includes(task.id)}
                                onChange={() => {
                                  setSelectedTaskIds((prev) =>
                                    prev.includes(task.id)
                                      ? prev.filter((id) => id !== task.id)
                                      : [...prev, task.id]
                                  );
                                }}
                                className="rounded text-[#6366F1] focus:ring-[#6366F1] w-4.5 h-4.5 border-slate-300 transition cursor-pointer"
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Left Urgency Dot and label */}
                                <span className="flex items-center gap-1.5 text-xs text-[#64748B] font-medium">
                                  <span className={`w-2 h-2 rounded-full ${
                                    task.priority === "High" ? "bg-[#EF4444]" : task.priority === "Medium" ? "bg-[#F59E0B]" : "bg-[#3B82F6]"
                                  }`}></span>
                                  {task.priority} Priority
                                </span>

                                {task.id.startsWith("gcal-") && (
                                  <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                    <CalendarIcon className="w-3 h-3" /> GCal
                                  </span>
                                )}

                                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                                  task.status === "Done"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : task.status === "In Progress"
                                      ? "bg-indigo-50 text-indigo-700"
                                      : "bg-slate-50 text-slate-700"
                                }`}>
                                  {task.status}
                                </span>

                                {task.status !== "Done" && (
                                  <span className="text-xs text-[#64748B] font-medium flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    {formatTimeLeft(task.deadline)}
                                  </span>
                                )}
                              </div>

                              <h4 className={`text-[15px] font-medium text-[#1E293B] mt-1.5 leading-tight ${
                                task.status === "Done" ? "line-through text-slate-400" : ""
                              }`}>
                                {task.title}
                              </h4>
                            </div>
                          </div>

                          {/* Quick delete */}
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1 text-slate-400 hover:text-red-500 rounded transition shrink-0"
                            title="Delete Task"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Urgency breakdown & AI insight */}
                        {meta.message && task.status !== "Done" && (
                          <p className="text-xs text-[#64748B] bg-slate-50 px-3 py-2 rounded-xl mt-3 border border-slate-100">
                            💡 {meta.message}
                          </p>
                        )}

                        {/* AI Breakdown Subtasks Block */}
                        <TaskActionSteps
                          task={task}
                          tasks={tasks}
                          syncTasks={syncTasks}
                          loadingBreakdownId={loadingBreakdownId}
                          handleBreakdownTask={handleBreakdownTask}
                          handleToggleSubtask={handleToggleSubtask}
                        />

                        {/* Status updating controls */}
                        <div className="flex items-center justify-between border-t border-slate-100 mt-4 pt-3">
                          <span className="text-[11px] text-slate-400">
                            Created: {new Date(task.createdAt).toLocaleDateString()}
                          </span>
                          <div className="flex gap-2">
                            {task.status !== "To Do" && (
                              <button
                                onClick={() => handleUpdateTaskStatus(task.id, "To Do")}
                                className="text-xs border border-slate-200 px-2.5 py-1 rounded-lg text-slate-600 hover:bg-slate-50 transition"
                              >
                                Move to To-Do
                              </button>
                            )}
                            {task.status !== "In Progress" && task.status !== "Done" && (
                              <button
                                onClick={() => handleUpdateTaskStatus(task.id, "In Progress")}
                                className="text-xs bg-[#6366F1]/10 text-[#6366F1] px-2.5 py-1 rounded-lg font-semibold hover:bg-[#6366F1]/20 transition"
                              >
                                Start Work
                              </button>
                            )}
                            {task.status !== "Done" && (
                              <button
                                onClick={(e) => handleUpdateTaskStatus(task.id, "Done", e)}
                                className="text-xs bg-[#10B981] text-white px-2.5 py-1 rounded-lg font-semibold hover:bg-[#0D9488] transition flex items-center gap-1 ripple-btn"
                              >
                                <Check className="w-3 h-3" /> Complete
                              </button>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Kanban View */}
            {taskViewMode === "kanban" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="kanban-view-container">
                {(["To Do", "In Progress", "Done"] as const).map((status) => {
                  const columnTasks = filteredTasks.filter((t) => t.status === status);
                  return (
                    <div key={status} className="bg-slate-50 p-4 rounded-2xl space-y-3 min-h-[300px]">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                        <h4 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            status === "To Do" ? "bg-slate-400" : status === "In Progress" ? "bg-[#6366F1]" : "bg-[#10B981]"
                          }`}></span>
                          {status}
                        </h4>
                        <span className="text-xs bg-white text-slate-500 font-mono font-bold px-2 py-0.5 rounded-full">
                          {columnTasks.length}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {columnTasks.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-8 italic">No tasks</p>
                        ) : (
                          columnTasks.map((task) => {
                            const hoursLeft = AIService.getHoursUntilDeadline(task.deadline);
                            const isOverdue = hoursLeft < 0 && task.status !== "Done";
                            return (
                              <div
                                key={task.id}
                                className={`py-4 px-[18px] rounded-[16px] overflow-hidden border bg-white shadow-sm space-y-2.5 ${
                                  isOverdue ? "border-red-200 bg-red-50/20 overdue-pulse overdue-card" : "border-slate-100"
                                } task-card`}
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded ${
                                      task.priority === "High" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                                    }`}>
                                      {task.priority}
                                    </span>
                                    {task.id.startsWith("gcal-") && (
                                      <span className="bg-blue-50 text-blue-700 text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                        <CalendarIcon className="w-2.5 h-2.5" /> GCal
                                      </span>
                                    )}
                                  </div>
                                  {task.status !== "Done" && (
                                    <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${isOverdue ? "text-red-600 font-bold" : "text-slate-400"}`}>
                                      {hoursLeft < 0 ? "Overdue" : `${Math.floor(hoursLeft)}h left`}
                                    </span>
                                  )}
                                </div>
                                <h5 className="font-semibold text-xs text-slate-800 leading-snug">
                                  {task.title}
                                </h5>

                                {task.subtasks.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="w-full bg-slate-100 rounded-full h-1">
                                      <div
                                        className="bg-[#1D9E75] h-1 rounded-full"
                                        style={{
                                          width: `${
                                            (task.subtasks.filter((s) => s.completed).length / task.subtasks.length) * 100
                                          }%`
                                        }}
                                      ></div>
                                    </div>
                                    <span className="text-[9px] text-slate-400 font-mono block">
                                      {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} steps complete
                                    </span>
                                  </div>
                                )}

                                {/* Column status movement shortcuts */}
                                <div className="flex justify-between items-center pt-2 border-t border-slate-50 gap-1.5">
                                  <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="text-slate-400 hover:text-red-500 transition"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>

                                  <div className="flex gap-1">
                                    {status === "To Do" && (
                                      <button
                                        onClick={() => handleUpdateTaskStatus(task.id, "In Progress")}
                                        className="text-[9px] bg-indigo-50 text-[#6366F1] px-2 py-0.5 rounded font-bold"
                                      >
                                        In Progress →
                                      </button>
                                    )}
                                    {status === "In Progress" && (
                                      <button
                                        onClick={(e) => handleUpdateTaskStatus(task.id, "Done", e)}
                                        className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold"
                                      >
                                        Done ✓
                                      </button>
                                    )}
                                    {status === "Done" && (
                                      <button
                                        onClick={() => handleUpdateTaskStatus(task.id, "In Progress")}
                                        className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold"
                                      >
                                        ← Reopen
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}


        {/* ========================================================= */}
        {/* TAB 3: AI COACH CHAT */}
        {/* ========================================================= */}
        {currentTab === "chat" && (
          <div className="space-y-4 flex flex-col h-[calc(100vh-220px)] animate-fade-in" id="screen-chat">
            
            {/* Header description */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-4 flex justify-between items-center shadow-md">
              <div className="flex gap-3 items-center">
                <div className="bg-[#1D9E75]/20 text-[#1D9E75] p-2 rounded-xl jelly-icon quick-action-icon">
                  <Brain className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Coach Chat AI</h3>
                  <p className="text-xs text-slate-300">Your supportive, high-efficiency coach to navigate panic.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const freshWelcome: ChatMessage = {
                    ...DEFAULT_WELCOME_MSG,
                    id: `welcome-msg-${Date.now()}`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  };
                  setChatHistory([freshWelcome]);
                  localStorage.setItem("lmls_chat", JSON.stringify([freshWelcome]));
                }}
                className="px-3 py-1.5 bg-white/10 hover:bg-rose-600/20 text-xs font-semibold rounded-lg text-slate-200 hover:text-rose-200 transition shrink-0 flex items-center gap-1"
                id="clear-chat-btn"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Chat
              </button>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-4" id="chat-scroller">
              {chatHistory.map((m) => {
                const isBot = m.role === "assistant";
                return (
                  <div
                    key={m.id}
                    className={`flex gap-3 max-w-[85%] ${
                      isBot ? "self-start" : "ml-auto flex-row-reverse"
                    }`}
                  >
                    {/* Icon indicator */}
                    <div className={`p-2 h-fit rounded-xl shrink-0 ${
                      isBot ? "bg-[#6366F1] text-white" : "bg-teal-600 text-white"
                    } jelly-icon quick-action-icon`}>
                      {isBot ? <Sparkles className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>

                    {/* Chat Bubble Card */}
                    <div className={`p-3.5 rounded-2xl text-xs space-y-2 ${
                      isBot 
                        ? "bg-white text-slate-800 border border-slate-100 shadow-sm" 
                        : "bg-teal-50 text-teal-950 border border-teal-100"
                    }`}>
                      {/* Formatted body text supporting markdown-like highlights */}
                      <p className="whitespace-pre-line leading-relaxed">
                        {m.content}
                      </p>

                      {/* Detect actionable trigger indicators inside coach prompts */}
                      {isBot && (m.content.includes("Add to Tasks") || m.content.includes("↗")) && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 mt-2">
                          <button
                            onClick={() => handleChatAction("Add to Tasks")}
                            className="bg-[#6366F1] hover:bg-[#4F46E5] text-white px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 text-[10px] transition"
                          >
                            <Plus className="w-3 h-3" /> Create Task Suggested by AI Coach ↗
                          </button>
                          <button
                            onClick={() => handleChatAction("Set Reminder")}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-semibold text-[10px] transition"
                          >
                            <Bell className="w-3 h-3" /> Secure Nudge Alarm ↗
                          </button>
                        </div>
                      )}

                      <span className="block text-[9px] text-slate-400 text-right mt-1 font-mono">
                        {m.timestamp}
                      </span>
                    </div>
                  </div>
                );
              })}

              {chatLoading && (
                <div className="flex gap-3 max-w-[80%] self-start">
                  <div className="p-2 h-fit rounded-xl shrink-0 bg-[#6366F1] text-white">
                    <Sparkles className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-2 w-full">
                    <div className="h-3 bg-slate-200 rounded shimmer w-5/6"></div>
                    <div className="h-3 bg-slate-200 rounded shimmer w-2/3"></div>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Presets Row */}
            <div className="preset-chips-row" id="chat-presets">
              {PRESETS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => sendMessage(p.msg)}
                  className="preset-chip"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Input field */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat(chatInput);
              }}
              className="flex gap-2 items-center"
              id="chat-input-form"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Ask your coach anything about deadlines or goals..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatLoading}
                  className="w-full bg-slate-50 text-slate-800 text-xs pl-4 pr-10 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-[#6366F1] focus:bg-white transition"
                  id="chat-text-input"
                />
                <button
                  type="button"
                  onClick={toggleVoiceChat}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${
                    isChatListening 
                      ? "bg-rose-500 text-white animate-pulse" 
                      : "text-slate-400 hover:text-indigo-600 hover:bg-slate-100"
                  }`}
                  title={isChatListening ? "Listening... Click to stop" : "Type with your voice (Speech-to-Text)"}
                >
                  {isChatListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="bg-[#6366F1] hover:bg-[#4F46E5] text-white p-3 rounded-xl font-semibold transition disabled:opacity-50 shrink-0"
                id="chat-send-btn"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}


        {/* ========================================================= */}
        {/* TAB 4: CALENDAR VIEW */}
        {/* ========================================================= */}
        {currentTab === "calendar" && (
          <div className="space-y-6 animate-fade-in" id="screen-calendar">
            
            {/* Google Calendar Connect Banner (if not logged in) */}
            {!googleToken && (
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm" id="google-calendar-connect-banner">
                <div className="space-y-1 text-center md:text-left">
                  <h4 className="font-bold text-sm text-indigo-950 flex items-center justify-center md:justify-start gap-2">
                    <CalendarIcon className="w-4 h-4 text-indigo-600" /> Connect Google Calendar
                  </h4>
                  <p className="text-xs text-slate-600 max-w-md">
                    Import your meetings and schedule so the AI can find stress-free focus gaps and plan blocks around your real-world events.
                  </p>
                </div>
                <button
                  onClick={handleGoogleSignIn}
                  disabled={googleCalendarLoading}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm transition shrink-0 cursor-pointer"
                  id="google-signin-btn-calendar"
                >
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                  {googleCalendarLoading ? "Connecting..." : "Sign in with Google"}
                </button>
              </div>
            )}

            {/* Calendar Controls */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg space-y-4" id="calendar-widget">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-teal-400" />
                    {monthNames[currentMonth]} {currentYear}
                  </h3>
                  {googleUser ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <p className="text-[10px] text-slate-400">
                        Connected to Google Calendar ({googleUser.email})
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Monthly schedule overview</p>
                  )}
                </div>

                {/* Schedule Gaps AI Button */}
                <button
                  onClick={handleGenerateSmartSchedule}
                  disabled={isScheduling}
                  className="bg-[#1D9E75] hover:bg-[#16815F] text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  id="schedule-gaps-btn"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isScheduling ? "Scanning..." : "Find Focus Gaps"}
                </button>
              </div>

              {/* Calendar Grid Matrix */}
              <div className="grid grid-cols-7 gap-2 text-center text-xs">
                {/* Headers */}
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                  <span key={day} className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    {day}
                  </span>
                ))}

                {/* Spacers for first day */}
                {Array.from({ length: firstDayIndex }).map((_, idx) => (
                  <span key={`empty-${idx}`} className="py-2.5"></span>
                ))}

                {/* Days of month */}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dayString = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(
                    dayNum
                  ).padStart(2, "0")}`;

                  // Find tasks on this date
                  const dayTasks = tasks.filter((t) => t.deadline.slice(0, 10) === dayString);
                  const isSelected = selectedCalendarDateStr === dayString;

                  // Dot counts by urgency colors
                  const hasOverdue = dayTasks.some((t) => AIService.getHoursUntilDeadline(t.deadline) < 0 && t.status !== "Done");
                  const hasDueToday = dayString === todayStr && dayTasks.some((t) => t.status !== "Done");
                  const hasUpcoming = dayTasks.some((t) => AIService.getHoursUntilDeadline(t.deadline) >= 0 && t.status !== "Done");

                  // Google Calendar Events count
                  const dayEvents = monthlyGoogleEvents.filter((event) => {
                    if (!event.start) return false;
                    const startStr = event.start.dateTime || event.start.date;
                    return startStr && startStr.startsWith(dayString);
                  });
                  const hasGoogleEvents = dayEvents.length > 0;

                  return (
                    <button
                      key={dayNum}
                      onClick={() => handleDateSelect(new Date(dayString + "T12:00:00"))}
                      className={`py-2 rounded-xl transition relative flex flex-col items-center justify-between min-h-[42px] cursor-pointer ${
                        isSelected 
                          ? "bg-purple-600 text-white font-bold" 
                          : dayString === todayStr
                            ? "bg-purple-100 text-purple-900 border border-purple-300 font-semibold"
                            : "bg-slate-800/40 hover:bg-slate-800/80 text-slate-100"
                      }`}
                      id={`calendar-day-btn-${dayNum}`}
                    >
                      <span className="text-xs">{dayNum}</span>
                      
                      {/* Dots indicator container */}
                      <div className="flex gap-0.5 mt-1 justify-center h-1 w-full">
                        {hasOverdue && <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>}
                        {hasDueToday && <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>}
                        {hasUpcoming && <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>}
                        {hasGoogleEvents && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Smart Focus Gaps Suggestions */}
            {scheduleGapsRequested && (
              <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 space-y-3" id="smart-schedule-block">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-teal-950 flex items-center gap-1.5">
                    <Brain className="w-4 h-4 text-[#1D9E75]" /> AI Focus Block Allocation
                  </h4>
                  <span className="text-[10px] bg-teal-100 text-teal-800 font-mono font-bold px-2 py-0.5 rounded-full">
                    Target: {profile.workHours} Hours Today
                  </span>
                </div>

                {isScheduling ? (
                  <div className="space-y-2 py-2">
                    <div className="h-3 bg-teal-100 rounded shimmer w-5/6"></div>
                    <div className="h-3 bg-teal-100 rounded shimmer w-2/3"></div>
                  </div>
                ) : smartSchedule && smartSchedule.length > 0 ? (
                  <div className="space-y-3.5">
                    <p className="text-xs text-teal-900">
                      I surveyed your pending tasks and created a custom stress-free schedule block allocation:
                    </p>
                    <div className="space-y-2.5">
                      {smartSchedule.map((block, idx) => {
                        const targetTask = tasks.find((t) => t.id === block.taskId);
                        return (
                          <div key={idx} className="bg-white p-3 rounded-xl border border-teal-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="bg-[#1D9E75]/10 text-[#1D9E75] px-2 py-1 rounded-lg font-mono text-xs font-bold text-center shrink-0 min-w-[70px]">
                                {block.startTime} - {block.endTime}
                              </div>
                              <div className="space-y-1">
                                <h5 className="font-bold text-xs text-slate-800">
                                  {targetTask ? targetTask.title : "High Priority Work Block"}
                                </h5>
                                <p className="text-[11px] text-slate-500">
                                  💡 {block.tip}
                                </p>
                              </div>
                            </div>
                            {googleToken && (
                              <button
                                onClick={() => handleScheduleFocusBlock(block)}
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-[10px] font-bold transition shrink-0 flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" /> Schedule Event
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-teal-900 italic">
                    All tasks are done or we are lacking data. Try adding a high-urgency task to watch AI build focus zones!
                  </p>
                )}
              </div>
            )}

            {/* Selected Date Details Panel */}
            <div className="schedule-detail-panel" id="calendar-selected-details">
              <h3 className="schedule-date-title">
                📅 Schedule for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>

              {/* APP TASKS SECTION */}
              <div className="schedule-section">
                <div className="schedule-section-label">
                  <span className="task-dot">●</span> YOUR TASKS
                </div>
                {(() => {
                  const selectedDateTasks = tasks.filter((t) => t.deadline.slice(0, 10) === selectedCalendarDateStr);
                  if (selectedDateTasks.length === 0) {
                    return <p className="empty-state">No tasks due on this day</p>;
                  }
                  return (
                    <div className="space-y-2">
                      {selectedDateTasks.map((task) => {
                        const isOverdue = AIService.getHoursUntilDeadline(task.deadline) < 0 && task.status !== "Done";
                        return (
                          <div
                            key={task.id}
                            className={`bg-white p-3.5 rounded-[16px] overflow-hidden border border-slate-100 shadow-sm flex items-center justify-between gap-4 text-xs task-card ${isOverdue ? "overdue-pulse overdue-card" : ""}`}
                          >
                            <div className="space-y-1">
                              <h5 className="font-bold text-slate-800">{task.title}</h5>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                                  task.status === "Done" ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-800"
                                }`}>
                                  {task.status}
                                </span>
                                {task.id.startsWith("gcal-") && (
                                  <span className="bg-blue-50 text-blue-700 text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                    <CalendarIcon className="w-3 h-3" /> GCal
                                  </span>
                                )}
                                {googleToken && (
                                  <button
                                    onClick={() => handleExportTaskToCalendar(task)}
                                    disabled={syncingTaskId === task.id}
                                    className="text-[9px] text-indigo-600 font-bold hover:underline cursor-pointer"
                                  >
                                    {syncingTaskId === task.id ? "Syncing..." : "Export to Calendar"}
                                  </button>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setCurrentTab("tasks");
                                setTaskFilter("all");
                              }}
                              className="text-[#6366F1] hover:underline font-semibold shrink-0 cursor-pointer"
                            >
                              Details →
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* GOOGLE CALENDAR SECTION */}
              <div className="schedule-section">
                <div className="schedule-section-label">
                  📆 GOOGLE CALENDAR
                </div>
                {calendarLoading ? (
                  <div className="gcal-loading">Fetching events...</div>
                ) : !googleAccessToken ? (
                  <p className="empty-state">Connect Google Calendar in Settings to see your events</p>
                ) : googleEvents.length === 0 ? (
                  <p className="empty-state">No Google Calendar events this day</p>
                ) : (
                  googleEvents.map((event) => (
                    <GoogleEventCard key={event.id} event={event} />
                  ))
                )}
              </div>
            </div>
          </div>
        )}


        {/* ========================================================= */}
        {/* TAB 6: DEDICATED FOCUS ARENA */}
        {/* ========================================================= */}
        {currentTab === "focus" && (
          <div className="space-y-6 animate-fade-in" id="screen-focus-arena">
            {/* Header / Mindset Coach Card */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-indigo-500/20 shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 w-48 h-48 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_#818CF8_0%,_transparent_70%)]" />
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-indigo-500/30">
                      Deep Work Mode
                    </span>
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  </div>
                  <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                    <Timer className="w-5 h-5 text-indigo-400" /> Focus Arena
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                    Create a distraction-free environment. Train your mind, build your daily streak, and watch your virtual Bonsai garden blossom.
                  </p>
                </div>

                {/* Tactical Mindset Quote */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 max-w-sm flex flex-col justify-between shrink-0">
                  <p className="text-xs text-slate-200 italic leading-relaxed">
                    "{FOCUS_QUOTES[focusQuoteIdx % FOCUS_QUOTES.length].text}"
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/40">
                    <span className="text-[10px] text-indigo-400 font-bold font-mono">
                      — {FOCUS_QUOTES[focusQuoteIdx % FOCUS_QUOTES.length].author}
                    </span>
                    <button 
                      onClick={() => setFocusQuoteIdx((prev) => prev + 1)}
                      className="p-1 text-slate-400 hover:text-white transition active:scale-95 cursor-pointer"
                      title="Next Coaching Tip"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Continuous alarm trigger overlay inside Focus Arena */}
            {pomodoroAlarmActive && (
              <div className="bg-red-950 border-2 border-red-500 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse text-white shadow-lg relative overflow-hidden">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shrink-0 animate-bounce">
                    <Bell className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold tracking-tight uppercase font-mono text-red-400">🚨 Time is Up! 🚨</h3>
                    <p className="text-xs text-red-200 leading-relaxed">
                      {pomodoroMode === "focus" 
                        ? "Your Focus sprint has ended! Time to reward yourself with a break." 
                        : "Your Break has ended! Ready to engage in another focus block?"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPomodoroAlarmActive(false)}
                  className="bg-white hover:bg-slate-100 text-red-900 font-black text-xs uppercase px-5 py-2.5 rounded-xl shadow-md transition transform active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <VolumeX className="w-4 h-4" /> Dismiss Alarm
                </button>
              </div>
            )}

            {/* Main Focus Split Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Side: Clock, Presets, and Tasks (7 Columns) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Timer Clock Box */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col items-center">
                  
                  {/* Outer circle progress indicator */}
                  <div className="relative w-56 h-56 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        stroke="#F1F5F9"
                        strokeWidth="5"
                        fill="transparent"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        stroke={pomodoroTimeLeft > 0 && pomodoroTimeLeft < 10 ? "#EF4444" : (pomodoroMode === "focus" ? "#6366F1" : pomodoroMode === "shortBreak" ? "#10B981" : "#EC4899")}
                        strokeWidth="7"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 52}
                        strokeDashoffset={2 * Math.PI * 52 * (1 - pomodoroTimeLeft / pomodoroDuration)}
                        strokeLinecap="round"
                        className={`transition-all duration-1000 ease-linear ${pomodoroTimeLeft > 0 && pomodoroTimeLeft < 10 ? "animate-pulse" : ""}`}
                      />
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-4xl font-black font-mono tracking-tight transition-colors duration-150 ${pomodoroTimeLeft > 0 && pomodoroTimeLeft < 10 ? "text-red-500 animate-pulse font-bold" : "text-slate-800"}`}>
                        {(() => {
                          const mins = Math.floor(pomodoroTimeLeft / 60);
                          const secs = pomodoroTimeLeft % 60;
                          return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
                        })()}
                      </span>
                      <span className={`text-[10px] uppercase tracking-wider font-extrabold font-mono mt-1 ${
                        pomodoroMode === "focus" 
                          ? "text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full" 
                          : pomodoroMode === "shortBreak"
                            ? "text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full"
                            : "text-pink-600 bg-pink-50 border border-pink-100 px-2 py-0.5 rounded-full"
                      }`}>
                        {pomodoroMode === "focus" ? "Focus Block" : pomodoroMode === "shortBreak" ? "Short Break" : "Long Break"}
                      </span>
                    </div>
                  </div>

                  {/* Core Timer Controls */}
                  <div className="flex items-center gap-3 w-full mt-6 max-w-sm">
                    <button
                      onClick={() => {
                        setPomodoroAlarmActive(false);
                        setPomodoroActive(!pomodoroActive);
                      }}
                      className={`flex-1 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md text-white ${
                        pomodoroActive
                          ? "bg-amber-600 hover:bg-amber-700"
                          : "bg-[#6366F1] hover:bg-[#5051F1]"
                      }`}
                    >
                      {pomodoroActive ? (
                        <>
                          <Pause className="w-4 h-4" /> Pause Sprint
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" /> Begin Focus
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setPomodoroActive(false);
                        setPomodoroAlarmActive(false);
                        const dur = pomodoroMode === "focus" ? 25 * 60 : pomodoroMode === "shortBreak" ? 5 * 60 : 15 * 60;
                        setPomodoroTimeLeft(dur);
                        setPomodoroDuration(dur);
                      }}
                      className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 p-3 rounded-xl transition active:scale-95 cursor-pointer"
                      title="Reset Timer"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quick Preset Selector Buttons */}
                  <div className="mt-6 border-t border-slate-100 pt-5 w-full">
                    <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider block mb-2.5 text-center">
                      Quick Mode Presets
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        onClick={() => {
                          setPomodoroActive(false);
                          setPomodoroAlarmActive(false);
                          setPomodoroMode("focus");
                          setPomodoroTimeLeft(25 * 60);
                          setPomodoroDuration(25 * 60);
                        }}
                        className={`py-2 rounded-lg text-xs font-bold border transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          pomodoroMode === "focus" && pomodoroDuration === 25 * 60
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-xs"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        <span>25m Focus</span>
                        <span className="text-[9px] text-slate-400 font-normal font-mono">Standard Pomodoro</span>
                      </button>

                      <button
                        onClick={() => {
                          setPomodoroActive(false);
                          setPomodoroAlarmActive(false);
                          setPomodoroMode("focus");
                          setPomodoroTimeLeft(50 * 60);
                          setPomodoroDuration(50 * 60);
                        }}
                        className={`py-2 rounded-lg text-xs font-bold border transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          pomodoroMode === "focus" && pomodoroDuration === 50 * 60
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-xs"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        <span>50m Deep</span>
                        <span className="text-[9px] text-slate-400 font-normal font-mono">Ultra Concentration</span>
                      </button>

                      <button
                        onClick={() => {
                          setPomodoroActive(false);
                          setPomodoroAlarmActive(false);
                          setPomodoroMode("focus");
                          setPomodoroTimeLeft(10 * 60);
                          setPomodoroDuration(10 * 60);
                        }}
                        className={`py-2 rounded-lg text-xs font-bold border transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          pomodoroMode === "focus" && pomodoroDuration === 10 * 60
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-xs"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        <span>10m Quick</span>
                        <span className="text-[9px] text-slate-400 font-normal font-mono">Defeat Inertia</span>
                      </button>

                      <button
                        onClick={() => {
                          setPomodoroActive(false);
                          setPomodoroAlarmActive(false);
                          setPomodoroMode("shortBreak");
                          setPomodoroTimeLeft(5 * 60);
                          setPomodoroDuration(5 * 60);
                        }}
                        className={`py-2 rounded-lg text-xs font-bold border transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          pomodoroMode === "shortBreak"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        <span>5m Break</span>
                        <span className="text-[9px] text-slate-400 font-normal font-mono">Short Rest</span>
                      </button>
                    </div>

                    {/* Custom minute input box */}
                    <div className="flex items-center justify-center gap-2 mt-4 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl max-w-xs mx-auto">
                      <span className="text-xs text-slate-500 font-bold">Custom Focus Period:</span>
                      <input
                        type="number"
                        min="1"
                        max="180"
                        defaultValue="25"
                        onChange={(e) => {
                          const mins = parseInt(e.target.value);
                          if (mins && mins > 0) {
                            setPomodoroActive(false);
                            setPomodoroAlarmActive(false);
                            setPomodoroMode("focus");
                            setPomodoroTimeLeft(mins * 60);
                            setPomodoroDuration(mins * 60);
                          }
                        }}
                        className="w-14 bg-white border border-slate-200 text-center text-xs font-extrabold rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:border-indigo-500"
                      />
                      <span className="text-xs text-slate-400 font-bold">mins</span>
                    </div>
                  </div>
                </div>

                {/* Task Association & Sub-Step Tracker Card */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-indigo-500" /> Lock In Single Focus Task
                    </h3>
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 font-black uppercase font-mono px-2 py-0.5 rounded border border-indigo-100">
                      No Multitasking
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 font-mono tracking-wider mb-1.5">
                      Target Focus Task
                    </label>
                    <select
                      value={pomodoroTaskId || ""}
                      onChange={(e) => setPomodoroTaskId(e.target.value || null)}
                      className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="">-- General Mindful Concentration Session --</option>
                      {tasks
                        .filter((t) => t.status !== "Done")
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            🎯 {t.title} ({t.status})
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Active Sub-Tasks Checklist */}
                  {(() => {
                    const activeTask = tasks.find((t) => t.id === pomodoroTaskId);
                    if (!activeTask) return null;
                    const hasSubs = activeTask.subtasks && activeTask.subtasks.length > 0;
                    return (
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black uppercase text-indigo-600 font-mono tracking-wider">
                            Step Checklist for: {activeTask.title}
                          </h4>
                          <span className="text-[10px] text-slate-500 font-mono font-bold">
                            {activeTask.subtasks ? activeTask.subtasks.filter(s => s.completed).length : 0} / {activeTask.subtasks ? activeTask.subtasks.length : 0} Done
                          </span>
                        </div>

                        {hasSubs ? (
                          <div className="space-y-1.5">
                            {activeTask.subtasks.map((sub, sidx) => (
                              <label 
                                key={sidx} 
                                className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200/80 hover:bg-slate-100/50 cursor-pointer text-xs text-slate-700 select-none"
                              >
                                <input 
                                  type="checkbox"
                                  checked={sub.completed}
                                  onChange={() => handleToggleSubtask(activeTask.id, sidx)}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 w-4 h-4 cursor-pointer"
                                />
                                <span className={sub.completed ? "line-through text-slate-400" : "font-medium"}>
                                  {sub.step}
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 bg-white border border-dashed border-slate-200 rounded-xl space-y-2">
                            <p className="text-[10px] text-slate-400">This task has no sub-steps loaded yet.</p>
                            <button
                              onClick={() => handleBreakdownTask(activeTask)}
                              disabled={loadingBreakdownId === activeTask.id}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 flex items-center gap-1 mx-auto"
                            >
                              <Sparkles className="w-3 h-3" /> AI Breakdown Steps Now
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Right Side: Ambient Audio Synthesizer & ADHD Distraction Tracker (5 Columns) */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* ADHD Distraction Tracker & Hygiene Score */}
                <div className="bg-[#0F172A] text-white border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="absolute right-0 bottom-0 w-32 h-32 opacity-5 pointer-events-none bg-[radial-gradient(circle_at_center,_#EF4444_0%,_transparent_70%)]" />
                  
                  <div className="space-y-1.5">
                    <h3 className="font-extrabold text-xs text-slate-400 uppercase font-mono tracking-widest flex items-center gap-1.5">
                      ⚠️ Focus Hygiene Dashboard
                    </h3>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Almost checked social media, picked up your phone, or opened a secondary tab? Be honest — click below to log and conquer the impulse.
                    </p>
                  </div>

                  {/* Big Counter and Button */}
                  <div className="my-5 flex items-center justify-between bg-slate-950/60 border border-slate-800 p-4 rounded-xl">
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-black text-slate-400 font-mono block">Logged Distractions</span>
                      <span className="text-4xl font-black font-mono text-amber-500">
                        {distractionCount}
                      </span>
                    </div>

                    <div className="text-right space-y-1">
                      <span className="text-[9px] uppercase font-black text-slate-400 font-mono block">Focus Hygiene Rating</span>
                      <span className={`text-xs font-extrabold px-2 py-1 rounded-md inline-block ${
                        distractionCount === 0 
                          ? "bg-emerald-500/20 text-emerald-400" 
                          : distractionCount <= 2 
                            ? "bg-indigo-500/20 text-indigo-400" 
                            : distractionCount <= 4 
                              ? "bg-amber-500/20 text-amber-400" 
                              : "bg-red-500/20 text-red-400 animate-pulse"
                      }`}>
                        {distractionCount === 0 && "🏆 Pristine Focus"}
                        {distractionCount > 0 && distractionCount <= 2 && "⚡ Strong Mind"}
                        {distractionCount > 2 && distractionCount <= 4 && "🕒 Sidetracked"}
                        {distractionCount > 4 && "🚨 Panic Zone!"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setDistractionCount((prev) => prev + 1);
                      playTickSound();
                    }}
                    className="w-full py-3 bg-red-950 hover:bg-red-900 border border-red-500/30 text-red-200 rounded-xl text-xs font-extrabold transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Log Distraction Attempt
                  </button>

                  <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-400 text-center italic">
                    {distractionCount === 0 && "🧠 Mind set locked. You are completely immune to distractions."}
                    {distractionCount > 0 && distractionCount <= 2 && "⚠️ A small wave passed. Take a breath and focus back on the target."}
                    {distractionCount > 2 && "❌ Warning: ADHD clutter rising. Move your phone to another room right now."}
                  </div>
                </div>

                {/* Web Audio Ambient Audio Synthesizer */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                      <Music className="w-4 h-4 text-indigo-500" /> Flow Ambient Audio Synthesizer
                    </h3>
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                      Real-time Audio
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Synthesize real soundscapes directly in your browser. These block surrounding noise and lock your cognitive state.
                  </p>

                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase font-black text-slate-400 font-mono tracking-wider">
                      Select Sound Wave Preset
                    </label>
                    
                    <div className="space-y-1.5">
                      {[
                        { id: "none", name: "Silent Concentration", description: "Standard silent stopwatch counting." },
                        { id: "binaural", name: "Alpha Binaural Beats (10Hz)", description: "Synchronizes brain hemispheres to focus frequency." },
                        { id: "noise", name: "Deep Ocean Waves", description: "Pink-filtered relaxing sound of washing tide." },
                        { id: "space", name: "Cosmic Space Hum", description: "Deep sub-harmonic solar wind resonance." },
                        { id: "rhythm", name: "Focus Metronome Tick", description: "Steady 60 BPM rhythmic auditory clock anchor." }
                      ].map((sound) => {
                        const isSelected = ambientSound === sound.id;
                        return (
                          <button
                            key={sound.id}
                            onClick={() => {
                              setAmbientSound(sound.id as any);
                              if (pomodoroActive) {
                                startAmbientSound(sound.id as any, ambientVolume);
                              }
                            }}
                            className={`w-full text-left p-2.5 rounded-xl border transition text-xs flex flex-col gap-0.5 cursor-pointer select-none ${
                              isSelected
                                ? "bg-indigo-50 border-indigo-200 text-indigo-900 shadow-xs"
                                : "bg-slate-50 border-transparent hover:bg-slate-100 text-slate-700"
                            }`}
                          >
                            <span className="font-extrabold">{sound.name}</span>
                            <span className="text-[10px] text-slate-500 leading-tight font-medium">{sound.description}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Volume Slider */}
                    {ambientSound !== "none" && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] uppercase font-black text-slate-400 font-mono tracking-wider">Volume Controls</span>
                          <span className="text-[10px] text-slate-600 font-bold font-mono">{Math.round(ambientVolume * 100)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={ambientVolume}
                            onChange={(e) => setAmbientVolumeState(parseFloat(e.target.value))}
                            className="flex-1 accent-indigo-600 cursor-pointer"
                          />
                          <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        {pomodoroActive ? (
                          <div className="text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-100 p-1.5 rounded-md text-center font-bold">
                            🔊 Active sound loop playing!
                          </div>
                        ) : (
                          <div className="text-[9px] text-indigo-500 bg-indigo-50 border border-indigo-100 p-1.5 rounded-md text-center font-bold">
                            💡 Synthesizer will activate automatically once you click 'Begin Focus'.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Focus Bonsai Garden (Gamification) */}
                {(() => {
                  const completedFocusCount = focusHistory.filter(h => h.completed && h.mode === "focus").length;
                  const bonsai = getBonsaiStage(completedFocusCount);
                  return (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden text-slate-800">
                      <div className="space-y-1.5">
                        <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                          🪴 Focus Bonsai Garden
                        </h3>
                        <p className="text-[11px] text-slate-400 leading-normal">
                          Grow your master bonsai tree! Every completed focus session nourishes your bonsai and moves it closer to blooming cherry blossoms.
                        </p>
                      </div>

                      {/* Visual Garden Garden Display */}
                      <div className="my-5 bg-white border border-slate-100 rounded-xl p-5 flex flex-col items-center justify-center text-center shadow-xs">
                        <div className="text-6xl mb-2 filter drop-shadow-md animate-bounce">
                          {bonsai.emoji}
                        </div>
                        <h4 className="font-extrabold text-sm text-slate-800">{bonsai.name}</h4>
                        <span className="text-[10px] text-slate-400 uppercase font-black font-mono tracking-widest mt-1">Stage {bonsai.stage} / 4</span>
                        <p className="text-[11px] text-slate-500 leading-normal mt-2 max-w-xs">
                          {bonsai.description}
                        </p>

                        {/* Visual progress bar to next stage */}
                        <div className="w-full max-w-xs mt-4">
                          <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono mb-1">
                            <span>Bonsai Maturity</span>
                            <span>{completedFocusCount} / 4 Sessions</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min((completedFocusCount / 4) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-400 text-center">
                        Total Focus Sessions Completed: <strong className="text-slate-700">{completedFocusCount}</strong>
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>

            {/* Focus History & Saved Log Panel */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-indigo-500" /> Focus Session History
                </h3>
                {focusHistory.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure you want to completely reset your focus session history? This will also reset your bonsai tree to a seed.")) {
                        setFocusHistory([]);
                        localStorage.removeItem("lmls_focus_history");
                      }
                    }}
                    className="text-[10px] text-red-500 hover:text-red-700 font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear All History
                  </button>
                )}
              </div>

              {focusHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-500">
                    <thead className="text-[9px] uppercase font-black font-mono tracking-widest text-slate-400 border-b border-slate-100">
                      <tr>
                        <th className="py-2">Date & Time</th>
                        <th className="py-2">Mode</th>
                        <th className="py-2">Duration</th>
                        <th className="py-2">Target Task</th>
                        <th className="py-2 text-center">Distractions</th>
                        <th className="py-2 text-right">Hygiene Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {focusHistory.map((item) => {
                        const date = new Date(item.timestamp);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="py-3 font-medium text-slate-700">
                              {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-3">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                item.mode === "focus" 
                                  ? "bg-indigo-50 text-indigo-600" 
                                  : "bg-emerald-50 text-emerald-600"
                              }`}>
                                {item.mode === "focus" ? "Focus" : "Break"}
                              </span>
                            </td>
                            <td className="py-3 font-mono font-bold text-slate-700">
                              {item.durationMinutes}m
                            </td>
                            <td className="py-3 max-w-[200px] truncate italic">
                              {item.taskTitle || "Mindful Session"}
                            </td>
                            <td className="py-3 text-center font-mono font-extrabold text-slate-700">
                              {item.distractions}
                            </td>
                            <td className="py-3 text-right">
                              <span className={`text-[10px] font-bold ${
                                item.distractions === 0 
                                  ? "text-emerald-600" 
                                  : item.distractions <= 2 
                                    ? "text-indigo-600" 
                                    : "text-amber-600"
                              }`}>
                                {item.distractions === 0 ? "Pristine Flow" : `${item.distractions} sidetracked`}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-1">
                  <p className="text-xs text-slate-500 font-bold">No completed sessions logged yet</p>
                  <p className="text-[10px] text-slate-400">Complete your first 10m, 25m, or 50m block to see your achievements.</p>
                </div>
              )}
            </div>
          </div>
        )}


        {/* ========================================================= */}
        {/* TAB 5: HABIT & GOAL TRACKER */}
        {/* ========================================================= */}
        {currentTab === "habits" && (
          <div className="space-y-6 animate-fade-in" id="screen-habits">
            
            {/* Header info */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
              <div className="space-y-1">
                <h3 className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <TrendingUp className="w-5 h-5 text-teal-600" /> Long-Term Resiliency Builder
                </h3>
                <p className="text-xs text-slate-500">
                  Build atomic daily habits to conquer procrastination before it starts.
                </p>
              </div>
              <button
                onClick={() => setShowAddHabitModal(true)}
                className="bg-[#6366F1] hover:bg-[#4F46E5] text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition shrink-0 glow-btn"
                id="add-habit-modal-trigger"
              >
                <Plus className="w-4 h-4" /> Add Custom Habit
              </button>
            </div>

            {/* Circular Progress Rings for Active Habits */}
            {habits.length > 0 && (
              <div className="space-y-3" id="habit-progress-rings-section">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider font-mono">
                  Weekly Goal Achievements (Last 7 Days)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {habits.map((habit) => {
                    const completionRate = getHabitCompletionRate(habit);
                    // Circle calculation
                    const radius = 24;
                    const circumference = 2 * Math.PI * radius;
                    const strokeDashoffset = circumference - (completionRate / 100) * circumference;

                    return (
                      <div key={habit.id} className="bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm flex items-center gap-3">
                        {/* Circular ring SVG */}
                        <div className="relative w-14 h-14 shrink-0">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 60 60">
                            <circle
                              cx="30"
                              cy="30"
                              r={radius}
                              stroke="#E5E7EB"
                              strokeWidth="4"
                              fill="transparent"
                            />
                            <circle
                              cx="30"
                              cy="30"
                              r={radius}
                              stroke="#10B981"
                              strokeWidth="4.5"
                              fill="transparent"
                              strokeDasharray={circumference}
                              strokeDashoffset={strokeDashoffset}
                              className="transition-all duration-500"
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black font-mono text-slate-700">
                            {completionRate}%
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <h5 className="font-bold text-xs text-slate-800 line-clamp-1">{habit.name}</h5>
                          <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                            <Flame className="w-3 h-3 text-orange-500" /> {habit.streak}d streak
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI Habit Plan Generator Block */}
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 space-y-4" id="ai-habit-plan-block">
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-indigo-950 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#6366F1]" /> 30-Day AI Habit Blueprint Generator
                </h4>
                <p className="text-xs text-slate-600">
                  Enter your core goal, and Gemini will map out a frictionless 4-week step progression.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., Code every day, Eat healthy, Prepare for MBA..."
                  value={habitGoalInput}
                  onChange={(e) => setHabitGoalInput(e.target.value)}
                  className="flex-1 bg-white text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#6366F1]"
                  id="habit-goal-input-field"
                />
                <button
                  onClick={handleGenerateHabitPlan}
                  disabled={isGeneratingHabitPlan || !habitGoalInput.trim()}
                  className="bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs px-4 py-2.5 rounded-xl font-bold transition duration-150 disabled:opacity-50 shrink-0 glow-btn"
                  id="generate-habit-plan-btn"
                >
                  {isGeneratingHabitPlan ? "Structuring..." : "Generate Plan"}
                </button>
              </div>

              {generatedHabitPlan && (
                <div className="bg-white border border-indigo-100 rounded-xl p-4 space-y-4 animate-fade-in" id="habit-plan-results">
                  <h5 className="font-black text-xs text-[#6366F1] uppercase tracking-wider font-mono">
                    Your Personalized 4-Week Progression
                  </h5>
                  <div className="space-y-4 text-xs">
                    {generatedHabitPlan.milestones.map((ms) => (
                      <div key={ms.week} className="space-y-2 border-l-2 border-indigo-100 pl-3">
                        <span className="font-black text-[10px] text-[#10B981] uppercase font-mono">
                          Week {ms.week}: {ms.milestone}
                        </span>
                        <div className="space-y-1.5">
                          {ms.dailyActions.map((action, aidx) => (
                            <div key={aidx} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                              <span className="text-slate-700 max-w-[80%] leading-relaxed">
                                {action}
                              </span>
                              <button
                                onClick={() => handleAdoptMilestoneAsHabit(action)}
                                className="text-[10px] text-[#6366F1] font-bold hover:underline shrink-0"
                              >
                                + Adopt Habit
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Active Habits list & GitHub Heatmap Style Grid */}
            <div className="space-y-4" id="active-habits-tracker-list">
              <h4 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-slate-500" /> Core Habits & Consistency Heatmap
              </h4>

              {habits.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-10 text-center text-slate-400 text-xs">
                  No active habits. Try using the AI blueprint or click "Add Custom Habit" to start building.
                </div>
              ) : (
                <div className="space-y-5">
                  {habits.map((habit) => {
                    return (
                      <div key={habit.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-0.5">
                            <h5 className="font-bold text-sm text-slate-800">{habit.name}</h5>
                            <p className="text-[10px] text-slate-400 italic">💡 Goal: {habit.goal}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 font-mono">
                              <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
                              {habit.streak}d Streak
                            </span>
                            <button
                              onClick={() => handleDeleteHabit(habit.id)}
                              className="text-slate-300 hover:text-red-500 transition p-1"
                              title="Delete habit"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* 30-Day Contribution Graph Heatmap */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] text-slate-400 font-mono block font-bold">
                            30-Day Consistency Mapping (Click block to toggle day)
                          </span>
                          
                          <div className="flex flex-wrap gap-1" id={`heatmap-${habit.id}`}>
                            {Array.from({ length: 30 }).map((_, idx) => {
                              const checkDate = new Date();
                              // Map backwards starting from 29 days ago to today (idx 29)
                              checkDate.setDate(checkDate.getDate() - (29 - idx));
                              const dateStr = checkDate.toISOString().slice(0, 10);
                              const isCompleted = habit.completedDates.includes(dateStr);
                              const isToday = dateStr === todayStr;

                              return (
                                <button
                                  key={idx}
                                  onClick={() => handleToggleHabitDate(habit.id, dateStr)}
                                  className={`w-6 h-6 rounded-md text-[9px] font-bold font-mono transition flex items-center justify-center ${
                                    isCompleted
                                      ? "bg-[#1D9E75] text-white hover:bg-emerald-600"
                                      : isToday
                                        ? "bg-purple-100 border border-purple-400 text-purple-900 hover:bg-purple-200"
                                        : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                                  }`}
                                  title={`${checkDate.toLocaleDateString()}: ${isCompleted ? "Completed" : "Incomplete"}`}
                                  id={`habit-${habit.id}-day-${idx}`}
                                >
                                  {checkDate.getDate()}
                                </button>
                              );
                            })}
                          </div>
                          
                          <div className="flex justify-between text-[9px] text-slate-400 font-mono pt-1">
                            <span>29 Days Ago</span>
                            <span>Today</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Floating Action Quick Task Add button (+) */}
      {currentTab !== "chat" && (
        <div className="fab-wrapper" id="floating-task-add-btn">
          <span className="fab-label">Add Task</span>
          <button 
            onClick={() => {
              setNewTaskTitle("");
              setShowAddModal(true);
            }}
            className="fab-btn"
          >
            <span className="fab-plus">+</span>
          </button>
        </div>
      )}

      {/* BOTTOM TAB NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto md:max-w-4xl bg-white border-t border-slate-100 py-2.5 px-4 flex justify-around items-center z-50 rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.06)]" id="bottom-tabs">
        {(["dashboard", "tasks", "focus", "chat", "calendar", "habits"] as const).map((tab) => {
          const isActive = currentTab === tab;
          const label = tab === "chat" ? "Coach Chat AI" : tab === "focus" ? "Focus" : tab.charAt(0).toUpperCase() + tab.slice(1);
          
          let icon = null;
          if (tab === "dashboard") icon = <Grid className="w-5 h-5" />;
          else if (tab === "tasks") icon = <ListTodo className="w-5 h-5" />;
          else if (tab === "focus") icon = <Timer className="w-5 h-5" />;
          else if (tab === "chat") icon = <MessageSquare className="w-5 h-5" />;
          else if (tab === "calendar") icon = <CalendarIcon className="w-5 h-5" />;
          else if (tab === "habits") icon = <Flame className="w-5 h-5" />;

          return (
            <button
              key={tab}
              onClick={() => setCurrentTab(tab)}
              className="flex flex-col items-center relative py-1 focus:outline-none transition-all duration-200 nav-item-hover px-2 rounded-xl"
              id={`tab-btn-${tab}`}
            >
              {/* Active Pill Indicator above icon */}
              {isActive && (
                <span className="absolute -top-3 w-8 h-1 bg-[#6366F1] rounded-full animate-fade-in" />
              )}
              
              <div className={`${isActive ? "text-[#6366F1] scale-110" : "text-[#94A3B8] hover:text-[#64748B]"} transition-all duration-200`}>
                {icon}
              </div>
              <span className={`text-[10px] mt-1 ${isActive ? "text-[#6366F1] font-semibold" : "text-[#94A3B8]"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ========================================================= */}
      {/* MODAL 1: CREATE TASK */}
      {/* ========================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="add-task-modal">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-brand-primary" /> Create Critical Task
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full"
                id="task-modal-close"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleAddTask} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Task Title</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g., Submit Chemistry Midterm Report"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="w-full bg-slate-50 pl-3 pr-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#6366F1] text-slate-800"
                    id="task-modal-title"
                  />
                  <button
                    type="button"
                    onClick={toggleVoiceTask}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${
                      isTaskListening 
                        ? "bg-rose-500 text-white animate-pulse" 
                        : "text-slate-400 hover:text-indigo-600 hover:bg-slate-200"
                    }`}
                    title={isTaskListening ? "Listening... Click to stop" : "Speak task title"}
                  >
                    {isTaskListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e: any) => setNewTaskPriority(e.target.value)}
                    className="w-full bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#6366F1] text-slate-800"
                    id="task-modal-priority"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Status</label>
                  <select
                    value={newTaskStatus}
                    onChange={(e: any) => setNewTaskStatus(e.target.value)}
                    className="w-full bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#6366F1] text-slate-800"
                    id="task-modal-status"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Done">Done</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Deadline Target Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={newTaskDeadline}
                  onChange={(e) => setNewTaskDeadline(e.target.value)}
                  className="w-full bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#6366F1] text-slate-800"
                  id="task-modal-deadline"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition"
                  id="task-modal-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold rounded-xl transition glow-btn"
                  id="task-modal-submit"
                >
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: CREATE HABIT */}
      {/* ========================================================= */}
      {showAddHabitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="add-habit-modal">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-brand-accent" /> Create Custom Habit
              </h3>
              <button 
                onClick={() => setShowAddHabitModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full"
                id="habit-modal-close"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleAddHabit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Habit Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Drink 8 glasses of water"
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  className="w-full bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#6366F1] text-slate-800"
                  id="habit-modal-name"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Frequency</label>
                <select
                  value={newHabitFreq}
                  onChange={(e: any) => setNewHabitFreq(e.target.value)}
                  className="w-full bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#6366F1] text-slate-800"
                  id="habit-modal-freq"
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Habit Goal Description</label>
                <input
                  type="text"
                  placeholder="e.g., Hydrate adequately to boost cognition"
                  value={newHabitGoal}
                  onChange={(e) => setNewHabitGoal(e.target.value)}
                  className="w-full bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#6366F1] text-slate-800"
                  id="habit-modal-goal"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddHabitModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition"
                  id="habit-modal-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#10B981] hover:bg-[#0D9488] text-white font-semibold rounded-xl transition"
                  id="habit-modal-submit"
                >
                  Add Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

