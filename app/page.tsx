"use client";
import React, { JSX, useRef, useState } from "react";

// /Users/suteemonv/Codes/Github/SchedConvert/schedconvert/app/main.tsx

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
App Component
============================ */
export default function Home(): JSX.Element {
  const [inputText, setInputText] = useState<string>("");
  const [events, setEvents] = useState<EventModel[]>([]);
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
