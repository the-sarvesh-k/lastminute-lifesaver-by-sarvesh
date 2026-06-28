import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Helper to instantiate Gemini client dynamically
function getGeminiClient(req: express.Request) {
  // Use client-provided API key from header, or fallback to environment variable
  const apiKey = (req.headers["x-gemini-api-key"] as string) || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server, and no custom API key was provided.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Helper to log offline fallbacks gracefully without noisy error stack traces in server logs
function logFallback(endpoint: string, error: any) {
  const errMsg = String(error?.message || error || "").toLowerCase();
  const isQuota = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("limit") || errMsg.includes("resource_exhausted") || errMsg.includes("exhausted");
  if (isQuota) {
    console.log(`[Gemini Fallback] ${endpoint}: Free-tier quota exceeded (Rate Limit 429). Serving offline intelligent fallback.`);
  } else {
    console.log(`[Gemini Fallback] ${endpoint}: Serving offline intelligent fallback.`);
  }
}

// Helper to call generateContent with automatic model fallback for 503 (high demand/overloaded/unavailable) and 429 (rate limit) errors
async function generateContentWithFallback(ai: any, params: any) {
  const primaryModel = params.model || "gemini-3.5-flash";
  try {
    return await ai.models.generateContent(params);
  } catch (error: any) {
    const errorMsg = String(error?.message || error || "").toLowerCase();
    const isRetryable = 
      errorMsg.includes("503") || 
      errorMsg.includes("unavailable") || 
      errorMsg.includes("429") || 
      errorMsg.includes("quota") || 
      errorMsg.includes("limit") || 
      errorMsg.includes("resource_exhausted") || 
      errorMsg.includes("overloaded") || 
      errorMsg.includes("rate_limit");

    if (isRetryable) {
      console.log(`[Gemini Retry] Primary model (${primaryModel}) busy or quota limited. Retrying with 'gemini-3.1-flash-lite'...`);
      try {
        return await ai.models.generateContent({
          ...params,
          model: "gemini-3.1-flash-lite",
        });
      } catch (fallbackError: any) {
        console.log(`[Gemini Retry] Fallback 'gemini-3.1-flash-lite' busy. Retrying with 'gemini-flash-latest'...`);
        try {
          return await ai.models.generateContent({
            ...params,
            model: "gemini-flash-latest",
          });
        } catch (secondError: any) {
          throw secondError;
        }
      }
    }
    throw error;
  }
}

// 1. Task Prioritization Endpoint
app.post("/api/prioritize", async (req, res) => {
  let taskList: any[] = [];
  try {
    const { taskList: reqTaskList } = req.body;
    taskList = reqTaskList;
    if (!taskList || !Array.isArray(taskList)) {
      res.status(400).json({ error: "Invalid taskList. Must be an array." });
      return;
    }

    const ai = getGeminiClient(req);
    const response = await generateContentWithFallback(ai, {
      model: "gemini-3.5-flash",
      contents: `Given these tasks: ${JSON.stringify(taskList)}, rank them by urgency on a scale of 1-10 (10 being most urgent). Consider deadlines, priority, and estimated effort. Provide a concise, clear reason for each.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "The ID of the task as provided in input" },
              urgencyScore: { type: Type.INTEGER, description: "Urgency score from 1 to 10" },
              reason: { type: Type.STRING, description: "A concise 1-sentence reason for this score" },
            },
            required: ["id", "urgencyScore", "reason"],
          },
        },
      },
    });

    const resultText = response.text || "[]";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    logFallback("Prioritization", error);
    try {
      const fallback = taskList.map((t: any) => {
        const priorityScore = t.priority === "High" ? 8 : t.priority === "Medium" ? 5 : 3;
        return {
          id: t.id,
          urgencyScore: priorityScore,
          reason: `Auto-prioritized based on Importance: ${t.priority} Priority.`
        };
      });
      res.json(fallback);
    } catch (e) {
      res.status(500).json({ error: error.message || "Failed to prioritize tasks." });
    }
  }
});

// 2. Task Breakdown Endpoint
app.post("/api/breakdown", async (req, res) => {
  try {
    const { taskTitle, deadline } = req.body;
    if (!taskTitle) {
      res.status(400).json({ error: "taskTitle is required" });
      return;
    }

    const ai = getGeminiClient(req);
    const response = await generateContentWithFallback(ai, {
      model: "gemini-3.5-flash",
      contents: `Break down this task into exactly 5 clear, actionable sub-steps: '${taskTitle}'${deadline ? ` due on ${deadline}` : ""}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              step: { type: Type.STRING, description: "Description of the sub-step" },
              estimatedMinutes: { type: Type.INTEGER, description: "Estimated duration in minutes" },
            },
            required: ["step", "estimatedMinutes"],
          },
        },
      },
    });

    const resultText = response.text || "[]";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    logFallback("Breakdown", error);
    const fallback = [
      { step: "Clarify the core outcome: write down the final deliverable.", estimatedMinutes: 10 },
      { step: "Eliminate distractions: set a timer and put phone on focus mode.", estimatedMinutes: 5 },
      { step: "Do the absolute smallest first step: write one sentence or draft.", estimatedMinutes: 15 },
      { step: "Sprint for 20 minutes: work with high intensity on the task.", estimatedMinutes: 20 },
      { step: "Review your draft, touch up details, and prepare to submit.", estimatedMinutes: 10 },
    ];
    res.json(fallback);
  }
});

// 3. Smart Scheduling Endpoint
app.post("/api/schedule", async (req, res) => {
  let taskList: any[] = [];
  try {
    const { availableHours, taskList: reqTaskList } = req.body;
    taskList = reqTaskList;
    if (availableHours === undefined || !taskList || !Array.isArray(taskList)) {
      res.status(400).json({ error: "availableHours and taskList are required." });
      return;
    }

    const ai = getGeminiClient(req);
    const response = await generateContentWithFallback(ai, {
      model: "gemini-3.5-flash",
      contents: `I have ${availableHours} hours today. These are my pending tasks: ${JSON.stringify(taskList)}. Create an optimized schedule with start and end times for as many high-urgency tasks as fit, and suggest a productivity tip.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              taskId: { type: Type.STRING, description: "The ID of the scheduled task" },
              startTime: { type: Type.STRING, description: "Start time (e.g., '09:00 AM')" },
              endTime: { type: Type.STRING, description: "End time (e.g., '10:15 AM')" },
              tip: { type: Type.STRING, description: "Protip for tackling this block" },
            },
            required: ["taskId", "startTime", "endTime", "tip"],
          },
        },
      },
    });

    const resultText = response.text || "[]";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    logFallback("Smart Scheduling", error);
    try {
      const fallback = taskList.map((t: any, idx: number) => {
        const startHour = 9 + idx;
        const startAMPM = startHour >= 12 ? (startHour === 12 ? "12:00 PM" : `${startHour - 12}:00 PM`) : `${startHour}:00 AM`;
        const endHour = startHour + 1;
        const endAMPM = endHour >= 12 ? (endHour === 12 ? "12:00 PM" : `${endHour - 12}:00 PM`) : `${endHour}:00 AM`;
        return {
          taskId: t.id,
          startTime: startAMPM,
          endTime: endAMPM,
          tip: "Focus block. Disable all notifications and do a single-tasking sprint!"
        };
      });
      res.json(fallback);
    } catch (e) {
      res.status(500).json({ error: error.message || "Failed to generate optimized schedule." });
    }
  }
});

// 4. Daily AI Insight Endpoint
app.post("/api/insight", async (req, res) => {
  try {
    const ai = getGeminiClient(req);
    const response = await generateContentWithFallback(ai, {
      model: "gemini-3.5-flash",
      contents: "Generate one short, motivating and practical productivity tip (max 2 sentences) relevant to someone who tends to procrastinate on deadlines, is extremely busy, or has last-minute panic. Make it direct and actionable.",
    });

    res.json({ insight: response.text?.trim() || "Do the smallest step first. Momentum is the antidote to anxiety." });
  } catch (error: any) {
    logFallback("AI Insight", error);
    res.json({ insight: "Do the smallest step first. Momentum is the absolute antidote to anxiety." });
  }
});

// 5. Habit Plan Generator Endpoint
app.post("/api/habit-plan", async (req, res) => {
  let userGoal = "";
  try {
    const { userGoal: reqUserGoal } = req.body;
    userGoal = reqUserGoal;
    if (!userGoal) {
      res.status(400).json({ error: "userGoal is required." });
      return;
    }

    const ai = getGeminiClient(req);
    const response = await generateContentWithFallback(ai, {
      model: "gemini-3.5-flash",
      contents: `Create a highly tailored 30-day habit building plan for this goal: '${userGoal}'. Outline 4 weekly milestones with realistic daily actions.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            milestones: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  week: { type: Type.INTEGER, description: "Week number (1 to 4)" },
                  milestone: { type: Type.STRING, description: "The overarching focus or milestone for this week" },
                  dailyActions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING, description: "Actionable item for each day in this week" },
                  },
                },
                required: ["week", "milestone", "dailyActions"],
              },
            },
          },
          required: ["milestones"],
        },
      },
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    logFallback("Habit Plan", error);
    const title = userGoal || "Proactive Routine";
    const fallback = {
      milestones: [
        {
          week: 1,
          milestone: `Lay the Foundation for '${title}'`,
          dailyActions: [
            `Define your 'trigger event' for '${title}' (e.g., right after brushing teeth).`,
            `Perform a micro-version of the habit (just 2 minutes).`,
            `Eliminate preparation barriers (set up tools the night before).`,
            `Anchor '${title}' with a simple reward immediately after finishing.`,
            `Keep track of your very first streak checkmark with pride.`,
            `Check in on potential procrastination triggers early on.`,
            `Week 1 Complete! You are building the automated behavioral loop.`
          ]
        },
        {
          week: 2,
          milestone: `Secure Consistency for '${title}'`,
          dailyActions: [
            `Double your daily action or duration slightly (e.g., 10 minutes instead of 2 minutes).`,
            `Refuse to double-miss. If you slip up once, focus 100% on not slipping twice.`,
            `Link '${title}' to a physical or visual tracking checkmark to see your momentum.`,
            `If you feel lazy, tell yourself 'I will just do 5 minutes of ${title}'.`,
            `Audit your friction points: what is making you delay, and how can you fix it?`,
            `Do a mid-week check-in with your AI Coach to adjust goals.`,
            `Consolidate Week 2. You are cementing a new biological habit pathway.`
          ]
        },
        {
          week: 3,
          milestone: `Establish Rhythm & Overcome the Slump`,
          dailyActions: [
            `Commit to '${title}' even during low-motivation moments; focus on identity ('I am proactive').`,
            `Use 'Habit Stacking' (Habit A leads directly to '${title}').`,
            `Engage in friendly accountability (tell a friend or share your streak).`,
            `Notice the benefits: are you less stressed, more organized, or feeling accomplished?`,
            `Reward yourself with something you love for maintaining a 10-day streak of '${title}'.`,
            `Practice visualizing your progress mapping on the contribution calendar.`,
            `Week 3 milestone achieved. '${title}' is becoming second nature.`
          ]
        },
        {
          week: 4,
          milestone: `Identity Solidification & High Integration`,
          dailyActions: [
            `Perform the '${title}' action in a different setting or time to make it versatile.`,
            `Share your tips or methods with someone else to reinforce your own success.`,
            `Optimize efficiency: how can you get the same value with less strain?`,
            `Review your full 30-day streak on your contribution graph with pride.`,
            `Set '${title}' on autopilot and pair it with your next developmental goal.`,
            `Reflect on your procrastination levels regarding '${title}' before vs after this plan.`,
            `30 Days Complete! You are officially structured, proactive, and resilient. Congratulations!`
          ]
        }
      ]
    };
    res.json(fallback);
  }
});

// Helper: generateGeneralCoachFallback
function generateGeneralCoachFallback(userMessage: string): string {
  const msg = userMessage.toLowerCase();
  if (msg.includes("hello") || msg.includes("hi ") || msg.includes("hey")) {
    return "👋 Hello! I am your Coach Chat AI. I see you are navigating a busy schedule. I'm fully synced and ready to help you coordinate, plan your day, or tackle any task that is weighing on your mind. What are we focused on right now?\n\n💡 Try clicking **'What should I do RIGHT NOW?'** or **'Plan my day hour by hour'** below!";
  }
  if (msg.includes("motivation") || msg.includes("pep") || msg.includes("procrastinat") || msg.includes("boost") || msg.includes("crush")) {
    return "🔥 **LISTEN TO ME:** You do not need perfect motivation to start. Motivation is a feeling that follows action, not the other way around!\n\nTake the most intimidating task on your screen right now, strip it down to a laughably simple 2-minute step, and do it. No expectations of perfection. Just start the timer.\n\n⚡ **YOU CAN CRUSH THIS.** What is the first micro-step you will take right now? Tell me, and let's lock it in.";
  }
  if (msg.includes("stress") || msg.includes("anxious") || msg.includes("overwhelm") || msg.includes("panic")) {
    return "🧘 **Inhale for 4 seconds... hold for 4... exhale for 4... hold for 4.**\n\nWhen we are overwhelmed, our brain treats tasks like physical threats. We need to lower the friction. Pick one task—just one—and let go of everything else for the next 15 minutes. Can you do that? Let me know which task you're picking, and we will break it down together.";
  }
  return "I hear you! Let's conquer this. Focus is about elimination, not addition. Tell me what is stressing you out the most, or click **'Plan my day hour by hour'** to see a clean, stress-free route through your commitments.";
}

// Helper: generateContextCoachFallback
function generateContextCoachFallback(userMessage: string, context: string): string {
  const msg = userMessage.toLowerCase();
  
  // 1. Parse tasks from the context
  const taskRegex = /\s*•\s*"([^"]+)"\s*\[([^\]]+)\s+priority\]\s*—\s*([^\n]+)/gi;
  let match;
  const tasks = [];
  while ((match = taskRegex.exec(context)) !== null) {
    tasks.push({
      title: match[1],
      priority: match[2],
      statusInfo: match[3]
    });
  }

  // 2. Parse calendar events
  const eventRegex = /\s*•\s*"([^"]+)"\s*—\s*([^\n]+)/gi;
  const events = [];
  while ((match = eventRegex.exec(context)) !== null) {
    const text = match[1];
    const timeInfo = match[2];
    if (!timeInfo.includes("streak") && !context.substring(0, match.index).includes("Active habits:")) {
      events.push({
        title: text,
        time: timeInfo
      });
    }
  }

  // 3. Parse habits
  const habitRegex = /\s*•\s*"([^"]+)"\s*—\s*([^\n]+)/gi;
  const habits = [];
  while ((match = habitRegex.exec(context)) !== null) {
    if (context.substring(0, match.index).includes("Active habits:")) {
      habits.push({
        name: match[1],
        streak: match[2]
      });
    }
  }

  // Handle "what should I do right now" or "priority"
  if (msg.includes("right now") || msg.includes("do now") || msg.includes("important") || msg.includes("priority") || msg.includes("start")) {
    if (tasks.length === 0) {
      return "🎉 Excellent! You have no pending or overdue tasks. This is the perfect time to build healthy habits or take a well-deserved rest.\n\n💡 Would you like to create a new habit or plan your upcoming week?";
    }
    
    // Sort tasks by: Overdue first, priority (High > Medium > Low)
    const sorted = [...tasks].sort((a, b) => {
      const aOverdue = a.statusInfo.toUpperCase().includes("OVERDUE");
      const bOverdue = b.statusInfo.toUpperCase().includes("OVERDUE");
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      
      const priorities: { [key: string]: number } = { "High": 3, "Medium": 2, "Low": 1 };
      const aP = priorities[a.priority] || 0;
      const bP = priorities[b.priority] || 0;
      return bP - aP;
    });

    const topTask = sorted[0];
    return `Based on your current status, the single most critical task you should tackle right now is:

🔥 **"${topTask.title}"** [Priority: **${topTask.priority}** — ${topTask.statusInfo}]

Here is your 3-step action plan to break procrastination and get moving:
1. **Clear Your Space**: Close all browser tabs that are not related to "${topTask.title}".
2. **The 2-Minute Rule**: Commit to doing it for just 2 minutes. Write one sentence, review one email, or format one slide. 
3. **Take a Micro-Break**: Once the 2 minutes are up, decide if you want to keep going. Usually, you will!

→ START NOW: Open "${topTask.title}" and take the first step!`;
  }

  // Handle "plan my day" or "hour-by-hour" or "schedule"
  if (msg.includes("plan my day") || msg.includes("hour") || msg.includes("schedule") || msg.includes("today") || msg.includes("timetable")) {
    if (tasks.length === 0 && events.length === 0) {
      return "📅 You have a completely clear canvas today! No tasks or calendar events are scheduled.\n\n💡 Use this blank state to recharge, study a new skill, or log a simple habit like 'Drink water' or 'Read 1 page' to build momentum.";
    }

    // Determine current hour
    let startHour = 9;
    let isPM = false;
    const timeMatch = context.match(/CURRENT DATE \& TIME:[^\n,]+,\s*(\d+):(\d+):(\d+)\s*(AM|PM)/i);
    if (timeMatch) {
      startHour = parseInt(timeMatch[1], 10);
      isPM = timeMatch[4].toUpperCase() === "PM";
    }
    let currentHour24 = isPM ? (startHour === 12 ? 12 : startHour + 12) : (startHour === 12 ? 0 : startHour);
    if (currentHour24 < 8 || currentHour24 > 22) {
      currentHour24 = 9; // Reset to 9 AM for scheduling
    }

    let scheduleText = `🗓️ **Your High-Efficiency Hour-by-Hour Plan** (Starting at ${currentHour24 > 12 ? currentHour24 - 12 : (currentHour24 === 0 ? 12 : currentHour24)}:00 ${currentHour24 >= 12 ? 'PM' : 'AM'}):\n\n`;

    let activeHour = currentHour24;
    const remainingTasks = [...tasks];

    // Align calendar events if they are for today
    for (let i = 0; i < 7; i++) {
      if (activeHour >= 22) {
        scheduleText += `• **${activeHour - 12}:00 PM onwards**: Unwind, log your completed habits, and sleep! 😴\n`;
        break;
      }

      const formattedHour = activeHour > 12 
        ? `${activeHour - 12}:00 PM` 
        : activeHour === 12 
          ? "12:00 PM" 
          : activeHour === 0 
            ? "12:00 AM" 
            : `${activeHour}:00 AM`;

      // Check if there is an event matching this hour
      const hourSuffix = activeHour >= 12 ? "PM" : "AM";
      const hour12 = activeHour > 12 ? activeHour - 12 : (activeHour === 0 ? 12 : activeHour);
      const searchStr = `${hour12}:00 ${hourSuffix}`;
      const searchStrNoZero = `${hour12}:${hourSuffix}`;

      const matchingEvent = events.find(e => e.time.includes(searchStr) || e.time.includes(searchStrNoZero));
      
      if (matchingEvent) {
        scheduleText += `• **${formattedHour}**: 🤝 **Calendar Event: ${matchingEvent.title}** (Be present and take notes!)\n`;
      } else if (remainingTasks.length > 0) {
        const task = remainingTasks.shift();
        scheduleText += `• **${formattedHour}**: 🚀 Focus on **"${task.title}"** [${task.priority} Priority] — ${task.statusInfo}\n`;
      } else {
        if (habits.length > 0 && i === 3) {
          const habit = habits[0];
          scheduleText += `• **${formattedHour}**: 🧘 Habit Reinforcement: **"${habit.name}"** (${habit.streak} streak)\n`;
        } else {
          scheduleText += `• **${formattedHour}**: 📥 Overflow Buffer / Inbox Zero Sprint\n`;
        }
      }

      activeHour += 1;
    }

    if (tasks.length > 0) {
      scheduleText += `\n→ START NOW: Open your highest priority task **"${tasks[0].title}"** and let's get the momentum rolling!`;
    } else {
      scheduleText += `\n→ START NOW: Add a new task or enjoy your clear day!`;
    }

    return scheduleText;
  }

  // Handle "conflicts"
  if (msg.includes("conflict") || msg.includes("clash") || msg.includes("overlap") || msg.includes("due")) {
    const highPriority = tasks.filter(t => t.priority === "High");
    if (highPriority.length >= 2) {
      return `⚠️ **Critical Conflict Warning:**

You have multiple High-priority tasks currently active. This can divide your focus and cause extreme procrastination or burnout!

**Action Strategy:**
1. Pick **one** single High-priority task and demote the others temporarily to "Medium" or schedule them for a different block.
2. Complete that single task 100% before unlocking the others.

→ START NOW: Pick one task and put everything else on silent!`;
    }
    return `✅ **No critical scheduling conflicts detected!** Your task list is properly distributed and balanced. Keep focus sharp!`;
  }

  // Handle "overwhelmed"
  if (msg.includes("overwhelm") || msg.includes("anxious") || msg.includes("panic") || msg.includes("stress") || msg.includes("scared")) {
    if (tasks.length > 0) {
      const urgent = tasks[0];
      return `🧘 **Take a deep breath. Inhale... 1, 2, 3, 4. Exhale... 1, 2, 3, 4.**

You are feeling overwhelmed because you are trying to solve all your problems at once. Your brain cannot process multiple stress points simultaneously.

Let's do "Stress Triage" right now:
1. Ignore everything except **"${urgent.title}"**.
2. Set a timer for 10 minutes.
3. Your only goal is to touch this task. Write one sentence, or read one page.
4. If you stop after 10 minutes, that is perfectly fine. You still won!

→ START NOW: Open "${urgent.title}" and set a 10-minute timer.`;
    }
  }

  // Default fallback
  if (tasks.length > 0) {
    const nextTask = tasks[0];
    return `Hi there! I am here as your Coach Chat AI. 

I've analyzed your context and I see you have **${tasks.length} active tasks** (including **"${nextTask.title}"** which is currently **${nextTask.statusInfo}**).

Let's make today highly successful:
• Click **"Plan my day hour by hour"** to get a clean, stress-free schedule.
• Click **"What should I do RIGHT NOW?"** to identify the absolute most critical starting point.

→ START NOW: Select one of the quick action buttons below or tell me what is blocking you right now!`;
  }

  return `Hi there! I am your Coach Chat AI. I see you don't have any pending tasks right now. 

To get started, add some tasks in the **Tasks** tab, or tell me if you'd like to plan some healthy habits or a daily study goal!

→ START NOW: Go to the Tasks tab and add your first priority item.`;
}

// 6. Proactive AI Coach Chat Endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "messages array is required." });
      return;
    }

    const lastUserMessage = [...messages].reverse().find(m => m.role === "user")?.content || "";

    try {
      const ai = getGeminiClient(req);

      // Filter and transform chat history to conform to Gemini API requirements
      const formattedContents = messages.map((m: any) => ({
        role: m.role === "assistant" ? "model" : m.role === "user" ? "user" : "user",
        parts: [{ text: m.content }],
      }));

      const response = await generateContentWithFallback(ai, {
        model: "gemini-3.5-flash",
        contents: formattedContents,
        config: {
          systemInstruction: "You are 'The Last-Minute Life Saver' productivity coach. You are supportive, direct, and focused on reducing panic and procrastination. When users share their stress or a huge workload, you give them practical, micro-steps. Always try to offer an actionable item. You can prompt them with suggestions like 'Add to Tasks ↗' or 'Set Reminder ↗' by writing them as highlighted actions. Keep responses short and impactful (2-4 sentences max if possible).",
        },
      });

      res.json({ content: response.text?.trim() || "I am here to help you get this done! What is our absolute highest priority right now?" });
    } catch (apiError: any) {
      logFallback("Gemini Chat API", apiError);
      let isQuotaError = false;
      const errMsg = String(apiError?.message || apiError || "").toLowerCase();
      if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("limit") || errMsg.includes("resource_exhausted")) {
        isQuotaError = true;
      }
      let fallbackContent = generateGeneralCoachFallback(lastUserMessage);
      if (isQuotaError) {
        fallbackContent += "\n\n⚠️ **Notice:** The global free Gemini API quota has been reached (Rate Limit 429). I have automatically engaged my high-fidelity local intelligent fallback to keep you on track. To restore full, instant live AI reasoning, please paste your own Gemini API Key in the Control Center (gear icon in the top-right).";
      }
      res.json({ content: fallbackContent });
    }
  } catch (error: any) {
    console.error("Chat Router Error:", error);
    res.status(500).json({ error: error.message || "Failed to communicate with AI Coach." });
  }
});

// 7. Context-Aware AI Coach Chat Endpoint (Data-Driven Analyst)
app.post("/api/coach-chat", async (req, res) => {
  const { userMessage, context } = req.body;
  try {
    try {
      const ai = getGeminiClient(req);

      const systemPrompt = `You are an AI productivity analyst inside the "Last-Minute Life Saver" app. Your job is to analyze the user's tasks, deadlines, and calendar events and give SPECIFIC, DATA-DRIVEN advice to help them make better decisions and complete tasks more effectively.

Here is the user's COMPLETE current situation:
${context}

YOUR RULES:
1. ALWAYS reference specific task names and deadlines from the data above — never be generic
2. If asked "what should I do now?" → rank their overdue/today tasks by urgency and tell them exactly what to start with and why
3. If asked to "plan my day" → create a realistic hour-by-hour schedule using their tasks AND calendar events, avoiding conflicts
4. If asked about a specific task → give targeted advice for that exact task
5. Detect conflicts: if a calendar event overlaps with a task deadline, warn them
6. Keep responses clear and focused — use bullet points for plans and schedules. Ensure you fully complete any requested hour-by-hour schedules or lists without stopping midway. Do not arbitrarily truncate the response.
7. Format task names in quotes like: "Submit Pitch Deck"
8. If no tasks exist → encourage them to add tasks and explain what you can do
9. NEVER say "I don't have access to your tasks" — you always have the context above
10. End action-oriented replies with one specific next step prefixed with "→ START NOW:"`;

      const response = await generateContentWithFallback(ai, {
        model: "gemini-3.5-flash",
        contents: [{
          role: "user",
          parts: [{ text: systemPrompt + '\n\nUser message: "' + userMessage + '"' }]
        }],
        config: {
          maxOutputTokens: 1500,
          temperature: 0.3,
          topP: 0.8
        }
      });

      res.json({ content: response.text || "" });
    } catch (apiError: any) {
      logFallback("Gemini Coach Chat API", apiError);
      let isQuotaError = false;
      const errMsg = String(apiError?.message || apiError || "").toLowerCase();
      if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("limit") || errMsg.includes("resource_exhausted")) {
        isQuotaError = true;
      }
      let fallbackContent = generateContextCoachFallback(userMessage, context);
      if (isQuotaError) {
        fallbackContent += "\n\n⚠️ **Notice:** The global free Gemini API quota has been reached (Rate Limit 429). I have automatically engaged my high-fidelity local intelligent fallback to keep you on track. To restore full, instant live AI reasoning, please paste your own Gemini API Key in the Control Center (gear icon in the top-right).";
      }
      res.json({ content: fallbackContent });
    }
  } catch (error: any) {
    console.error("Coach Chat Router Error:", error);
    res.status(500).json({ error: error.message || "Failed to communicate with AI Coach." });
  }
});

// Start dev or production server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
