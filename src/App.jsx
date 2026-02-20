import React, { useEffect, useMemo, useState } from "react";
import { api, streamEvents } from "./api";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function App() {
  const [tab, setTab] = useState("today");
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const stop = streamEvents((ev) => {
      setEvents((prev) => [{ at: new Date().toLocaleTimeString(), ev }, ...prev].slice(0, 30));
    });
    return stop;
  }, []);

  return (
    <div className="wrap">
      <header className="header">
        <h1>Ops Companion</h1>
        <div className="muted">Daily tracker + interview log + health (Kafka later)</div>
      </header>

      <nav className="tabs">
        <button className={tab==="today" ? "active" : ""} onClick={() => setTab("today")}>Today</button>
        <button className={tab==="interview" ? "active" : ""} onClick={() => setTab("interview")}>Interview</button>
        <button className={tab==="health" ? "active" : ""} onClick={() => setTab("health")}>Health</button>
      </nav>

      {tab === "today" && <Today />}
      {tab === "interview" && <Interview />}
      {tab === "health" && <Health events={events} />}
    </div>
  );
}

function Today() {
  const date = useMemo(() => todayISO(), []);
  const [habits, setHabits] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [summary, setSummary] = useState(null);
  const [notes, setNotes] = useState({});
  const [err, setErr] = useState("");

  async function refresh() {
    setErr("");
    const [h, c, s] = await Promise.all([api.listHabits(), api.listCheckIns(date), api.summaryToday()]);
    setHabits(h);
    setCheckins(c);
    setSummary(s);

    // prefill notes from checkins
    const n = {};
    c.forEach(ci => { n[ci.habit.id] = ci.note || ""; });
    setNotes((prev) => ({ ...prev, ...n }));
  }

  useEffect(() => { refresh().catch(e => setErr(e.message)); }, []);

  const byHabitId = useMemo(() => {
    const m = new Map();
    checkins.forEach(ci => m.set(ci.habit.id, ci));
    return m;
  }, [checkins]);

  async function mark(habitId, status) {
    try {
      setErr("");
      await api.upsertCheckIn({ habitId, date, status, note: notes[habitId] || "" });
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function toggleActive(habitId, active) {
    try {
      setErr("");
      await api.setHabitActive(habitId, active);
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <>
      {err && <div className="error">⚠️ {err}</div>}

      <section className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Today</h2>
          <div className="muted">{date}</div>
        </div>
        {summary && (
          <div className="row">
            <div className="pill">Done: <b>{summary.doneCount}</b> / {summary.totalActiveHabits}</div>
            <div className="pill">Streak: <b>{summary.streakDays}</b> days</div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Habits</h2>
        <div className="list">
          {habits.map(h => {
            const ci = byHabitId.get(h.id);
            return (
              <div key={h.id} className="habit">
                <div className="habitTop">
                  <div className="habitName">{h.name}</div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={!!h.active}
                      onChange={(e) => toggleActive(h.id, e.target.checked)}
                    />
                    <span>Active</span>
                  </label>
                </div>

                <div className="row">
                  <input
                    value={notes[h.id] || ""}
                    onChange={(e) => setNotes((p) => ({ ...p, [h.id]: e.target.value }))}
                    placeholder="note (optional)"
                  />
                  <button disabled={!h.active} onClick={() => mark(h.id, "DONE")}>
                    {ci?.status === "DONE" ? "DONE ✅" : "Mark DONE"}
                  </button>
                  <button className="secondary" disabled={!h.active} onClick={() => mark(h.id, "SKIPPED")}>
                    {ci?.status === "SKIPPED" ? "SKIPPED" : "Skip"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function Interview() {
  const [topic, setTopic] = useState("kubernetes");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [rating, setRating] = useState(3);
  const [tags, setTags] = useState("");
  const [entries, setEntries] = useState([]);
  const [err, setErr] = useState("");

  async function refresh() {
    setErr("");
    const list = await api.listInterview();
    setEntries(list);
  }
  useEffect(() => { refresh().catch(e => setErr(e.message)); }, []);

  async function submit(e) {
    e.preventDefault();
    try {
      setErr("");
      await api.addInterview({ topic, question, answer, rating, tags });
      setQuestion("");
      setAnswer("");
      setTags("");
      await refresh();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <>
      {err && <div className="error">⚠️ {err}</div>}

      <section className="card">
        <h2>Interview Log</h2>
        <form onSubmit={submit} className="col">
          <div className="row">
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="topic (aws/k8s/terraform)" />
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
              <option value={1}>1 (bad)</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5 (solid)</option>
            </select>
          </div>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="question" required />
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="your answer" rows={5} required />
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags (comma separated)" />
          <button type="submit">Save</button>
        </form>
      </section>

      <section className="card">
        <h2>Recent entries</h2>
        <div className="list">
          {entries.map(en => (
            <div className="entry" key={en.id}>
              <div className="row">
                <div className="pill">{en.topic}</div>
                <div className="pill">rating {en.rating}/5</div>
                <div className="muted">{new Date(en.createdAt).toLocaleString()}</div>
              </div>
              <div><b>Q:</b> {en.question}</div>
              <div className="muted" style={{ whiteSpace: "pre-wrap" }}><b>A:</b> {en.answer}</div>
              {en.tags && <div className="muted">tags: {en.tags}</div>}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Health({ events }) {
  const [ready, setReady] = useState(null);
  const [err, setErr] = useState("");

  async function refresh() {
    setErr("");
    const r = await api.ready();
    setReady(r);
  }
  useEffect(() => { refresh().catch(e => setErr(e.message)); }, []);

  return (
    <>
      {err && <div className="error">⚠️ {err}</div>}

      <section className="card">
        <h2>Health</h2>
        <button onClick={() => refresh().catch(e => setErr(e.message))}>Refresh</button>
        {ready && (
          <pre className="pre">{JSON.stringify(ready, null, 2)}</pre>
        )}
      </section>

      <section className="card">
        <h2>Live activity (SSE)</h2>
        <div className="list">
          {events.map((x, idx) => (
            <div className="event" key={idx}>
              <span className="muted">{x.at}</span> — <code>{JSON.stringify(x.ev)}</code>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
