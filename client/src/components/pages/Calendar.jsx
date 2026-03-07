import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/calendar.css";
import { getCalendarData } from "../../utils/calendarService";

// TA: Main Calendar component - manages calendar state and rendering with multiple view modes (month/week/day)
const Calendar = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date(2024, 3, 1));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("month");
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const monthDropdownRef = useRef(null);
  const viewDropdownRef = useRef(null);

  // TA: Event listeners and data fetching
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target)) {
        setShowMonthDropdown(false);
      }
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target)) {
        setShowViewDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await getCalendarData();
        setEvents(data);
      } catch (error) {
        console.error("Error loading calendar data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // TA: Utility functions for date calculations, event filtering, and navigation handling
  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const formatMonthYear = (date) => date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const formatWeekRange = (date) => {
    const first = new Date(date);
    const last = new Date(date);
    first.setDate(first.getDate() - first.getDay());
    last.setDate(last.getDate() + (6 - last.getDay()));
    return `${first.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${last.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  };
  const getWeekDays = (date) => {
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(weekStart));
      weekStart.setDate(weekStart.getDate() + 1);
    }
    return days;
  };
  const getHours = () => Array.from({ length: 24 }, (_, i) => i);
  const getEventsForDate = (day) => {
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split("T")[0];
    return events.filter((event) => new Date(event.suggestedDate).toISOString().split("T")[0] === dateStr);
  };
  const getEventsForDateObj = (dateObj) => {
    const dateStr = dateObj.toISOString().split("T")[0];
    return events.filter((event) => new Date(event.suggestedDate).toISOString().split("T")[0] === dateStr);
  };
  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  const handlePrevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); };
  const handleNextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); };
  const handlePrevDay = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d); };
  const handleNextDay = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d); };
  const getBadgeColor = (status) => {
    const s = status?.toLowerCase();
    return s === "completed" ? "badge-completed" : s === "scheduled" ? "badge-scheduled" : "badge-idea";
  };
  const getStatusLabel = (status) => {
    const s = status?.toLowerCase();
    return s === "completed" ? "Completed Post" : s === "scheduled" ? "Scheduled Post" : "Idea / Suggestion";
  };
  const getPrevHandler = () => (viewMode === "month" ? handlePrevMonth : viewMode === "week" ? handlePrevWeek : handlePrevDay);
  const getNextHandler = () => (viewMode === "month" ? handleNextMonth : viewMode === "week" ? handleNextWeek : handleNextDay);
  const getDateDisplay = () => {
    if (viewMode === "month") return formatMonthYear(currentDate);
    if (viewMode === "week") return formatWeekRange(currentDate);
    return currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  };

  // TA: Prepare calendar grid data and filter events by search query
  const days = [];
  const firstDay = getFirstDayOfMonth(currentDate);
  const daysInMonth = getDaysInMonth(currentDate);
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let day = 1; day <= daysInMonth; day++) days.push(day);
  const filteredEvents = events.filter((event) =>
    event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.reason?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // TA: Render calendar UI
  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <h1>AI Suggested Content Calendar</h1>
        <p className="calendar-subtitle">Plan your content strategy with AI-suggested posts based on your calendar and analytics data</p>
      </div>

      {/* TA: Navigation and controls section */}
      <div className="calendar-top-bar">
        <div className="nav-section">
          <button className="nav-arrow-btn prev" onClick={getPrevHandler()}>‹</button>
          <button className="nav-arrow-btn next" onClick={getNextHandler()}>›</button>
        </div>

        <div className="date-section">
          <button className="date-dropdown-btn" onClick={() => setShowMonthDropdown(!showMonthDropdown)} ref={monthDropdownRef}>
            {getDateDisplay()}
            <span className="dropdown-icon">▼</span>
          </button>
          {showMonthDropdown && (
            <div className="dropdown-menu month-dropdown">
              <div className="dropdown-item">April 2024</div>
              <div className="dropdown-item">May 2024</div>
              <div className="dropdown-item">June 2024</div>
            </div>
          )}
        </div>

        <div className="controls-section">
          <div className="search-container">
            <input type="text" placeholder="Search" className="search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <span className="search-icon">🔍</span>
          </div>

          <div className="view-section" ref={viewDropdownRef}>
            <button className="view-btn" onClick={() => setShowViewDropdown(!showViewDropdown)}>
              View <span className="dropdown-icon">▼</span>
            </button>
            {showViewDropdown && (
              <div className="dropdown-menu view-dropdown">
                <div className={`dropdown-item ${viewMode === "month" ? "active" : ""}`} onClick={() => { setViewMode("month"); setShowViewDropdown(false); }}>Month</div>
                <div className={`dropdown-item ${viewMode === "week" ? "active" : ""}`} onClick={() => { setViewMode("week"); setShowViewDropdown(false); }}>Week</div>
                <div className={`dropdown-item ${viewMode === "day" ? "active" : ""}`} onClick={() => { setViewMode("day"); setShowViewDropdown(false); }}>Day</div>
              </div>
            )}
          </div>

          <button className="mode-btn">{viewMode === "month" ? "Month" : viewMode === "week" ? "Week" : "Day"}</button>
        </div>
      </div>

      {/* TA: Event status legend */
      <div className="calendar-legend">
        <div className="legend-item"><span className="legend-badge legend-idea"></span><span>Idea / Suggestion</span></div>
        <div className="legend-item"><span className="legend-badge legend-scheduled"></span><span>Scheduled Post</span></div>
        <div className="legend-item"><span className="legend-badge legend-completed"></span><span>Completed Post</span></div>
      </div>

      {/* TA: Calendar views (month, week, day) and search results */}
      {loading ? (
        <div className="loading">Loading calendar data...</div>
      ) : (
        <div className="calendar-wrapper">
          {/* Month view */}
          {viewMode === "month" && (
            <div className="calendar">
              <div className="calendar-grid">
                <div className="weekday-headers">
                  {weekDays.map((day) => (<div key={day} className="weekday-header">{day}</div>))}
                </div>
                <div className="calendar-days">
                  {days.map((day, index) => (
                    <div key={`day-${index}`} className={`calendar-day ${day ? "" : "empty"}`}>
                      {day && (
                        <>
                          <div className="day-number">{day}</div>
                          <div className="day-events">
                            {getEventsForDate(day).map((event, idx) => (
                              <div key={`${day}-${idx}`} className={`event-badge ${getBadgeColor(event.status)}`} title={event.title}>{event.title}</div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Week view */}
          {viewMode === "week" && (
            <div className="week-view">
              <div className="week-header">
                {getWeekDays(currentDate).map((day, idx) => (
                  <div key={`week-day-${idx}`} className="week-day-col">
                    <div className="week-day-label">{weekDays[day.getDay()]}</div>
                    <div className="week-day-date">{day.getDate()}</div>
                  </div>
                ))}
              </div>
              <div className="week-content">
                {getHours().map((hour) => (
                  <div key={`hour-${hour}`} className="week-hour-row">
                    <div className="week-time-cell">{`${hour.toString().padStart(2, "0")}:00`}</div>
                    {getWeekDays(currentDate).map((day, dayIdx) => (
                      <div key={`cell-${hour}-${dayIdx}`} className="week-time-slot">
                        {getEventsForDateObj(day).filter((event) => event.suggestedTime?.startsWith(hour.toString().padStart(2, "0")) || hour === 8).map((event) => (
                          <div key={event.id} className={`event-badge ${getBadgeColor(event.status)}`} title={event.title}>{event.title}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Day view */}
          {viewMode === "day" && (
            <div className="day-view">
              <div className="day-title">{currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
              <div className="day-content">
                {getHours().map((hour) => (
                  <div key={`day-hour-${hour}`} className="day-hour-row">
                    <div className="day-time-label">{`${hour.toString().padStart(2, "0")}:00`}</div>
                    <div className="day-events-slot">
                      {getEventsForDateObj(currentDate).filter((event) => event.suggestedTime?.startsWith(hour.toString().padStart(2, "0")) || hour === 8).map((event) => (
                        <div key={event.id} className={`event-badge ${getBadgeColor(event.status)}`} title={event.title}>
                          <div className="event-time">{event.suggestedTime || "All day"}</div>
                          <div className="event-title">{event.title}</div>
                          {event.reason && <div className="event-reason">{event.reason}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search results */}
      {searchQuery && filteredEvents.length > 0 && (
        <div className="search-results">
          <h3>Search Results ({filteredEvents.length})</h3>
          <div className="results-list">
            {filteredEvents.map((event) => (
              <div key={event.id} className={`result-item ${getBadgeColor(event.status)}`}>
                <div className="result-status">{getStatusLabel(event.status)}</div>
                <div className="result-title">{event.title}</div>
                {event.reason && <div className="result-reason">{event.reason}</div>}
                <div className="result-date">{new Date(event.suggestedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
