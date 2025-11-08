"use client";
import React, { JSX, useEffect, useRef, useState } from "react";

// /Users/suteemonv/Codes/Github/SchedConvert/schedconvert/app/page.tsx

/**
 * Converted from original plain HTML+JS to a React + TypeScript (TSX) component.
 * Assumes Tailwind is globally available in the project.
 */

/* ============================
Utilities & Constants
============================ */
const DateUtils = {
  THAI_MONTHS: {
    "ม.ค.": 0,
    "ก.พ.": 1,
    "มี.ค.": 2,
    "เม.ย.": 3,
    "พ.ค.": 4,
    "มิ.ย.": 5,
    "ก.ค.": 6,
    "ส.ค.": 7,
    "ก.ย.": 8,
    "ต.ค.": 9,
    "พ.ย.": 10,
    "ธ.ค.": 11,
  } as Record<string, number>,

  SHORT_MONTH_NAMES_EN: [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ],

  convertThaiYear(thaiYearStr: string) {
    let year = parseInt(thaiYearStr, 10);
    if (year < 100) year += 2500;
    return year - 543;
  },

  formatForGoogle(date: Date | null) {
    if (!date) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
      date.getDate()
    )}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
  },

  formatForICS(date: Date | null) {
    return this.formatForGoogle(date);
  },

  getMonthNameEN(monthIndex: number) {
    return this.SHORT_MONTH_NAMES_EN[monthIndex] || "";
  },
};

/* ============================
Types & Model Helpers
============================ */
type EventModel = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location: string;
  notes: string[];
  originalText: string;
};

const makeId = () => {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}`;
};

const formatTimeRange = (ev: EventModel) => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(ev.start.getHours())}:${pad(ev.start.getMinutes())} - ${pad(
    ev.end.getHours()
  )}:${pad(ev.end.getMinutes())}`;
};

const formattedNotesText = (notes: string[]) => {
  if (!notes || notes.length === 0) return "";
  return "หมายเหตุ:\n" + notes.map((n) => "- " + n).join("\n");
};

/* ============================
Parser
============================ */
const ScheduleParser = {
  REGEX: {
    BLOCK_SPLIT: /_{3,}/g,
    TITLE: /⭕\s*(.+)/,
    DATE: /วัน\s*:\s*([^\n]+)/,
    TIME: /เวลา\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/,
    LOCATION: /@\s*(.+)/,
    NOTE: /🔴\s*(.+)/g,
    DATE_PARTS: /(\d{1,2})\s+([^\s]+)\s+(\d{2,4})/,
  },
  parse(text: string): EventModel[] {
    const events: EventModel[] = [];
    const blocks = text.split(this.REGEX.BLOCK_SPLIT);

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      const parsed = this._parseBlock(trimmed);
      if (parsed) events.push(parsed);
    }

    return events;
  },

  _parseBlock(blockText: string): EventModel | null {
    const { TITLE, DATE, TIME, LOCATION, NOTE, DATE_PARTS } = this.REGEX;
    const titleMatch = blockText.match(TITLE);
    const dateMatch = blockText.match(DATE);
    const timeMatch = blockText.match(TIME);

    if (!titleMatch || !dateMatch || !timeMatch) return null;

    const dateStr = dateMatch[1].trim();
    const dateParts = dateStr.match(DATE_PARTS);
    if (!dateParts) return null;

    const day = parseInt(dateParts[1], 10);
    const monthEnum = DateUtils.THAI_MONTHS[dateParts[2]];
    const year = DateUtils.convertThaiYear(dateParts[3]);

    if (isNaN(day) || monthEnum === undefined || isNaN(year)) return null;

    const [startH, startM] = timeMatch[1].trim().split(":").map(Number);
    const [endH, endM] = timeMatch[2].trim().split(":").map(Number);

    const locationMatch = blockText.match(LOCATION);
    const notesMatches = [...blockText.matchAll(NOTE)].map((m) => m[1].trim());

    return {
      id: makeId(),
      title: titleMatch[1].trim(),
      start: new Date(year, monthEnum, day, startH, startM),
      end: new Date(year, monthEnum, day, endH, endM),
      location: locationMatch ? locationMatch[1].trim() : "",
      notes: notesMatches,
      originalText: blockText,
    };
  },
};

/* ============================
Exporter
============================ */
const CalendarExporter = {
  generateGoogleLink(ev: EventModel) {
    const baseUrl = new URL("https://www.google.com/calendar/render");
    baseUrl.searchParams.append("action", "TEMPLATE");
    baseUrl.searchParams.append("text", ev.title);
    baseUrl.searchParams.append(
      "dates",
      `${DateUtils.formatForGoogle(ev.start)}/${DateUtils.formatForGoogle(
        ev.end
      )}`
    );
    if (ev.location) baseUrl.searchParams.append("location", ev.location);
    const details = formattedNotesText(ev.notes);
    if (details) baseUrl.searchParams.append("details", details);
    baseUrl.searchParams.append("ctz", "Asia/Bangkok");
    baseUrl.searchParams.append("sf", "true");
    baseUrl.searchParams.append("output", "xml");
    return baseUrl.toString();
  },

  generateICS(events: EventModel[]) {
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ScheduleConverterPro//TH",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    for (const ev of events) {
      const now = new Date();
      const description = formattedNotesText(ev.notes).replace(/\n/g, "\\n");

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${ev.id}@schedulepro`);
      lines.push(`DTSTAMP:${DateUtils.formatForICS(now)}Z`);
      lines.push(
        `DTSTART;TZID=Asia/Bangkok:${DateUtils.formatForICS(ev.start)}`
      );
      lines.push(`DTEND;TZID=Asia/Bangkok:${DateUtils.formatForICS(ev.end)}`);
      lines.push(`SUMMARY:${ev.title}`);
      if (ev.location) lines.push(`LOCATION:${ev.location}`);
      if (description) lines.push(`DESCRIPTION:${description}`);
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  },

  downloadICSFile(events: EventModel[], filename = "schedule.ics") {
    const icsData = this.generateICS(events);
    const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};

/* ============================
Google Calendar Service
============================ */
type GoogleCalendarService = {
  tokenClient: any;
  isSignedIn: boolean;
  userEmail: string | null;
  initialize: (clientId: string) => void;
  signIn: () => Promise<void>;
  signOut: () => void;
  createEvent: (event: EventModel, attendees?: string[]) => Promise<boolean>;
  createEvents: (
    events: EventModel[],
    attendees?: string[]
  ) => Promise<{ success: number; failed: number }>;
};

const GoogleCalendar: GoogleCalendarService = {
  tokenClient: null,
  isSignedIn: false,
  userEmail: null,

  initialize(clientId: string) {
    if (typeof window === "undefined" || !(window as any).google) {
      console.error("Google Identity Services not loaded");
      return;
    }

    this.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/calendar.events",
      callback: (tokenResponse: any) => {
        if (tokenResponse && tokenResponse.access_token) {
          this.isSignedIn = true;
          // Store token for later use
          if (typeof window !== "undefined") {
            (window as any).__google_calendar_token =
              tokenResponse.access_token;
          }
          // Get user info
          fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: {
              Authorization: `Bearer ${tokenResponse.access_token}`,
            },
          })
            .then((res) => res.json())
            .then((data) => {
              this.userEmail = data.email || null;
              // Trigger a custom event to notify React component
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("google-calendar-signed-in", {
                    detail: { email: data.email },
                  })
                );
              }
            })
            .catch(() => {
              this.userEmail = null;
            });
        }
      },
    });
  },

  async signIn() {
    if (!this.tokenClient) {
      throw new Error(
        "Google Calendar not initialized. Please provide GOOGLE_CLIENT_ID."
      );
    }
    this.tokenClient.requestAccessToken({ prompt: "consent" });
  },

  signOut() {
    if (typeof window !== "undefined" && (window as any).google) {
      const token = (window as any).__google_calendar_token;
      if (token) {
        (window as any).google.accounts.oauth2.revoke(token, () => {
          (window as any).__google_calendar_token = null;
        });
      }
    }
    this.isSignedIn = false;
    this.userEmail = null;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("google-calendar-signed-out"));
    }
  },

  async createEvent(event: EventModel, attendees?: string[]): Promise<boolean> {
    if (!this.isSignedIn || !this.tokenClient) {
      throw new Error("Not signed in to Google Calendar");
    }

    const token =
      typeof window !== "undefined"
        ? (window as any).__google_calendar_token
        : null;
    if (!token) {
      throw new Error("No access token available");
    }

    const startDate = new Date(event.start);
    const endDate = new Date(event.end);

    type GoogleCalendarEvent = {
      summary: string;
      location?: string;
      description?: string;
      start: {
        dateTime: string;
        timeZone: string;
      };
      end: {
        dateTime: string;
        timeZone: string;
      };
      attendees?: Array<{ email: string }>;
    };

    const eventData: GoogleCalendarEvent = {
      summary: event.title,
      location: event.location || undefined,
      description: formattedNotesText(event.notes) || undefined,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: "Asia/Bangkok",
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: "Asia/Bangkok",
      },
    };

    // Add attendees if provided
    if (attendees && attendees.length > 0) {
      eventData.attendees = attendees
        .map((email) => email.trim())
        .filter((email) => email.length > 0)
        .map((email) => ({ email }));
    }

    try {
      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to create event");
      }

      return true;
    } catch (error) {
      console.error("Error creating calendar event:", error);
      throw error;
    }
  },

  async createEvents(
    events: EventModel[],
    attendees?: string[]
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const event of events) {
      try {
        await this.createEvent(event, attendees);
        success++;
        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        failed++;
        console.error(`Failed to create event: ${event.title}`, error);
      }
    }

    return { success, failed };
  },
};

/* ============================
App Component
============================ */
export default function Home(): JSX.Element {
  const [inputText, setInputText] = useState<string>("");
  const [events, setEvents] = useState<EventModel[]>([]);
  const [isGoogleSignedIn, setIsGoogleSignedIn] = useState<boolean>(false);
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [isAddingToCalendar, setIsAddingToCalendar] = useState<boolean>(false);
  const [googleClientId, setGoogleClientId] = useState<string>("");
  const [sharedEmails, setSharedEmails] = useState<string[]>(() => {
    // Initialize from environment variable if available
    const envEmails = process.env.NEXT_PUBLIC_SHARED_EMAILS;
    if (envEmails) {
      return envEmails
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.length > 0);
    }
    return [];
  });
  const [newEmailInput, setNewEmailInput] = useState<string>("");
  const [showEmailManager, setShowEmailManager] = useState<boolean>(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const handleConvert = () => {
    if (!inputText.trim()) {
      inputRef.current?.focus();
      return;
    }
    const parsed = ScheduleParser.parse(inputText);
    setEvents(parsed);
  };

  const handleClear = () => {
    setInputText("");
    setEvents([]);
    inputRef.current?.focus();
  };

  const handleDownload = () => {
    if (events.length === 0) return;
    CalendarExporter.downloadICSFile(events);
  };

  // Initialize Google Calendar when script loads
  useEffect(() => {
    const checkGoogleLoaded = () => {
      if (typeof window !== "undefined" && (window as any).google) {
        // Get client ID from environment variable or state
        const clientId =
          process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || googleClientId;
        if (clientId) {
          GoogleCalendar.initialize(clientId);
          // Check if already signed in (token stored)
          const storedToken = (window as any).__google_calendar_token;
          if (storedToken) {
            GoogleCalendar.isSignedIn = true;
            setIsGoogleSignedIn(true);
            // Get user email
            fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
              headers: {
                Authorization: `Bearer ${storedToken}`,
              },
            })
              .then((res) => res.json())
              .then((data) => {
                GoogleCalendar.userEmail = data.email || null;
                setGoogleUserEmail(data.email || null);
              })
              .catch(() => {
                GoogleCalendar.userEmail = null;
                setGoogleUserEmail(null);
              });
          }
        }
      } else {
        // Retry after a short delay
        setTimeout(checkGoogleLoaded, 100);
      }
    };
    checkGoogleLoaded();

    // Listen for sign-in events
    const handleSignIn = (e: any) => {
      setIsGoogleSignedIn(true);
      setGoogleUserEmail(e.detail?.email || null);
    };
    const handleSignOut = () => {
      setIsGoogleSignedIn(false);
      setGoogleUserEmail(null);
    };

    window.addEventListener("google-calendar-signed-in", handleSignIn);
    window.addEventListener("google-calendar-signed-out", handleSignOut);

    return () => {
      window.removeEventListener("google-calendar-signed-in", handleSignIn);
      window.removeEventListener("google-calendar-signed-out", handleSignOut);
    };
  }, [googleClientId]);

  const handleGoogleSignIn = async () => {
    try {
      const clientId =
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || googleClientId;
      if (!clientId) {
        alert(
          "Please provide a Google Client ID. You can set it in the header or via NEXT_PUBLIC_GOOGLE_CLIENT_ID environment variable."
        );
        return;
      }
      if (!GoogleCalendar.tokenClient) {
        GoogleCalendar.initialize(clientId);
      }
      await GoogleCalendar.signIn();
      // State will be updated via event listeners
    } catch (error) {
      console.error("Error signing in:", error);
      alert(
        "Failed to sign in to Google Calendar. Please check your client ID."
      );
    }
  };

  const handleGoogleSignOut = () => {
    GoogleCalendar.signOut();
    setIsGoogleSignedIn(false);
    setGoogleUserEmail(null);
  };

  const handleAddToGoogleCalendar = async () => {
    if (!isGoogleSignedIn) {
      await handleGoogleSignIn();
      return;
    }

    if (events.length === 0) return;

    setIsAddingToCalendar(true);
    try {
      const result = await GoogleCalendar.createEvents(events, sharedEmails);
      alert(
        `Successfully added ${result.success} event(s) to your Google Calendar${
          result.failed > 0 ? `\n${result.failed} event(s) failed` : ""
        }${
          sharedEmails.length > 0
            ? `\nShared with ${sharedEmails.length} attendee(s)`
            : ""
        }`
      );
    } catch (error: any) {
      console.error("Error adding events to calendar:", error);
      alert(
        `Failed to add events to calendar: ${error.message || "Unknown error"}`
      );
    } finally {
      setIsAddingToCalendar(false);
    }
  };

  const handleAddEmail = () => {
    const email = newEmailInput.trim();
    if (email && email.includes("@") && !sharedEmails.includes(email)) {
      setSharedEmails([...sharedEmails, email]);
      setNewEmailInput("");
    }
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setSharedEmails(sharedEmails.filter((email) => email !== emailToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAddEmail();
    }
  };

  const eventCountText = `${events.length} items`;

  return (
    <div className="text-slate-800 flex flex-col h-screen overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0 shadow-sm z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg">
              {/* icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-6 h-6 text-indigo-600"
              >
                <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
                <path
                  fillRule="evenodd"
                  d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Schedule Converter
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && !googleClientId && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <input
                  type="text"
                  placeholder="Google Client ID"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-md text-xs w-64"
                />
              </div>
            )}
            {isGoogleSignedIn ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-xs font-medium">
                    {googleUserEmail || "Connected"}
                  </span>
                </div>
                <button
                  onClick={handleGoogleSignOut}
                  className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleSignIn}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-4 h-4"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Connect Google
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* Left Panel */}
        <section className="lg:col-span-5 flex flex-col h-full overflow-hidden">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full">
            <div className="flex items-center justify-between mb-3">
              <label
                htmlFor="inputText"
                className="font-semibold text-slate-700 flex items-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 text-indigo-500"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 2c-1.716 0-3.408.106-5.07.31C3.806 2.45 3 3.414 3 4.517V17.25a.75.75 0 0 0 1.075.676L10 15.082l5.925 2.844A.75.75 0 0 0 17 17.25V4.517c0-1.103-.806-2.068-1.93-2.207A41.403 41.403 0 0 0 10 2Z"
                    clipRule="evenodd"
                  />
                </svg>
                Input Schedule
              </label>
              <button
                onClick={handleClear}
                className="text-sm text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded-md hover:bg-red-50"
              >
                ล้างข้อมูล (Clear)
              </button>
            </div>

            <div className="relative flex-1 mb-4">
              <textarea
                id="inputText"
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="thai-font w-full h-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none text-sm leading-relaxed bg-slate-50 placeholder:text-slate-400"
                placeholder={`วางตารางงานของคุณที่นี่...ตัวอย่าง:
⭕ เต้น Basic
วัน : อา. 9 พ.ย. 68
เวลา 19:00 - 21:00 น. 
@ GMM  Audition 1 Flr. 16
                             ...`}
              />
            </div>

            <button
              onClick={handleConvert}
              className="group w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              <span>แปลงข้อความ (Convert)</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                className="w-5 h-5 group-hover:translate-x-1 transition-transform"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                />
              </svg>
            </button>
          </div>
        </section>

        {/* Right Panel */}
        <section className="lg:col-span-7 flex flex-col h-full overflow-hidden bg-slate-100/50 p-1 rounded-3xl lg:bg-transparent lg:p-0">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="font-semibold text-slate-700 flex items-center gap-3">
              <span className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 text-indigo-600"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              Events Result
              <span
                className={`text-xs font-medium bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full transition-opacity duration-300 ${
                  events.length === 0 ? "opacity-0" : ""
                }`}
              >
                {eventCountText}
              </span>
            </h2>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEmailManager(!showEmailManager)}
                className="text-sm bg-slate-500 hover:bg-slate-600 text-white font-medium py-2 px-3 rounded-lg transition-all flex items-center gap-2 shadow-sm active:scale-95"
                title="Manage shared emails"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path d="M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L18 7.162V6a2 2 0 0 0-2-2H3Z" />
                  <path d="m19 8.839-7.77 3.885a2.75 2.75 0 0 1-2.46 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z" />
                </svg>
                {sharedEmails.length > 0 && (
                  <span className="bg-white text-slate-600 text-xs px-1.5 py-0.5 rounded-full font-semibold">
                    {sharedEmails.length}
                  </span>
                )}
              </button>
              <button
                onClick={handleAddToGoogleCalendar}
                disabled={events.length === 0 || isAddingToCalendar}
                className="text-sm bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2 shadow-sm active:scale-95"
              >
                {isAddingToCalendar ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Adding...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-4 h-4"
                    >
                      <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
                      <path
                        fillRule="evenodd"
                        d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {isGoogleSignedIn
                      ? "Add to Google Calendar"
                      : "Connect & Add"}
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                disabled={events.length === 0}
                className="text-sm bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2 shadow-sm active:scale-95"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.965 3.129V2.75Z" />
                  <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                </svg>
                Download ICS
              </button>
            </div>
          </div>

          {/* Email Manager */}
          {showEmailManager && (
            <div className="mb-4 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L18 7.162V6a2 2 0 0 0-2-2H3Z" />
                    <path d="m19 8.839-7.77 3.885a2.75 2.75 0 0 1-2.46 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z" />
                  </svg>
                  Shared Emails ({sharedEmails.length})
                </h3>
                <button
                  onClick={() => setShowEmailManager(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </button>
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  type="email"
                  value={newEmailInput}
                  onChange={(e) => setNewEmailInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter email address"
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                <button
                  onClick={handleAddEmail}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Add
                </button>
              </div>
              {sharedEmails.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {sharedEmails.map((email, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-sm"
                    >
                      <span className="text-slate-700">{email}</span>
                      <button
                        onClick={() => handleRemoveEmail(email)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-4 h-4"
                        >
                          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">
                  No emails added. Events will not be shared with anyone.
                </p>
              )}
              <p className="text-xs text-slate-500 mt-3">
                These emails will be added as attendees to all calendar events.
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto relative rounded-2xl bg-slate-50/50 border border-slate-200/60 p-1">
            <div className="space-y-3 p-2 md:p-3 absolute inset-0 overflow-y-auto">
              {events.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                  <div className="bg-white p-6 rounded-full shadow-sm mb-6 border border-slate-100">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1"
                      stroke="currentColor"
                      className="w-16 h-16 text-indigo-200"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v7.5"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-600 mb-1">
                    No Events Yet
                  </h3>
                  <p className="text-sm text-slate-500 max-w-xs mx-auto">
                    Paste your schedule text on the left and click convert to
                    see the magic happen.
                  </p>
                </div>
              ) : (
                events.map((ev) => (
                  <div
                    key={ev.id}
                    className="event-card bg-white p-4 md:p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-200 transition-all duration-200 group"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="flex flex-col items-center bg-indigo-50 border border-indigo-100 rounded-lg p-2 min-w-[60px] flex-shrink-0">
                            <span className="text-xs font-semibold text-indigo-600 uppercase event-month">
                              {DateUtils.getMonthNameEN(ev.start.getMonth())}
                            </span>
                            <span className="text-2xl font-bold text-indigo-900 event-day thai-font">
                              {ev.start.getDate()}
                            </span>
                          </div>
                          <div>
                            <h3 className="thai-font font-bold text-[17px] text-slate-800 leading-tight mb-1 event-title">
                              {ev.title}
                            </h3>
                            <p className="text-sm text-slate-500 font-medium flex items-center gap-1.5">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="w-4 h-4 opacity-70"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span className="event-time">
                                {formatTimeRange(ev)}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2 pl-[72px]">
                          <div className="flex items-start gap-2 text-sm text-slate-600">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0"
                            >
                              <path
                                fillRule="evenodd"
                                d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.006.003.002.001.003.001a.75.75 0 0 0 .01-.003ZM10 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="event-location line-clamp-2 thai-font">
                              {ev.location || "No location specified"}
                            </span>
                          </div>

                          {ev.notes.length > 0 && (
                            <div className="flex items-start gap-2 mt-2 pt-2 border-t border-slate-100/80">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <ul className="event-notes list-none space-y-1 text-xs text-slate-600 thai-font flex-1">
                                {ev.notes.map((n: string, i: number) => (
                                  <li key={i}>{n}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      <a
                        href={CalendarExporter.generateGoogleLink(ev)}
                        target="_blank"
                        rel="noreferrer"
                        className="google-cal-btn group/btn flex items-center gap-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 py-2 px-4 rounded-lg transition-all w-full sm:w-auto justify-center flex-shrink-0"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-5 h-5"
                        >
                          <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
                          <path
                            fillRule="evenodd"
                            d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Add to Calendar
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
