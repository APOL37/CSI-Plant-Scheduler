import React, { useState, useRef, useEffect } from "react";

/* ─── FONTS ─────────────────────────────────────────────────────────────── */
const GFONTS = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');`;

/* ─── PERSISTENT STORAGE HOOK ────────────────────────────────────────────── */
function useLocalStorage(key, seed) {
  const [val, setVal] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate it's the right type (array vs object)
        if (Array.isArray(seed) && Array.isArray(parsed)) return parsed;
        if (!Array.isArray(seed) && !Array.isArray(parsed)) return parsed;
      }
      return seed;
    } catch { return seed; }
  });
  const persist = (next) => {
    setVal(prev => {
      const updated = typeof next === "function" ? next(prev) : next;
      try { localStorage.setItem(key, JSON.stringify(updated)); } catch {}
      return updated;
    });
  };
  return [val, persist];
}

function clearAllData() {
  ["csi_users","csi_jobs","csi_utlogs"].forEach(k => localStorage.removeItem(k));
  window.location.reload();
}

/* ─── 4 ROLES ────────────────────────────────────────────────────────────── */
const ROLES = {
  plant_manager: {
    id: "plant_manager",
    label: "Plant Manager",
    icon: "🏭",
    color: "#f59e0b",
    accent: "#fbbf24",
    description: "Full plant overview — all jobs, all assets, financials & QC.",
    tabs: ["overview", "gantt", "dispatch", "qc", "finance", "uptime", "users"],
    perms: { create: true, edit: true, delete: true, status: true, finance: true, qc: true, users: true, uptime: true, allAssets: true, allTypes: true },
  },
  batch_operator: {
    id: "batch_operator",
    label: "Batch Plant Operator",
    icon: "⚙️",
    color: "#38bdf8",
    accent: "#7dd3fc",
    description: "Manages batching plant schedules, mix designs, and belt lines.",
    tabs: ["gantt", "dispatch", "qc"],
    perms: { create: true, edit: true, delete: false, status: true, finance: false, qc: true, users: false, allAssets: false, allTypes: false, assetGroups: ["bp","cb"], jobTypes: ["Batch Order","Maintenance"] },
  },
  dispatcher: {
    id: "dispatcher",
    label: "Dispatcher / Logistics",
    icon: "📡",
    color: "#34d399",
    accent: "#6ee7b7",
    description: "Assigns mixer & pump truck dispatch, tracks live deliveries.",
    tabs: ["gantt", "dispatch", "uptime"],
    perms: { create: true, edit: true, delete: false, status: true, finance: false, qc: false, users: false, allAssets: false, uptime: true, allTypes: false, assetGroups: ["mt","pt"], jobTypes: ["Truck Dispatch","Concrete Pour","Maintenance"] },
  },
  qc_lab: {
    id: "qc_lab",
    label: "QC / Lab Technician",
    icon: "🔬",
    color: "#a78bfa",
    accent: "#c4b5fd",
    description: "Reviews mix grades, volumes, and quality compliance. Read-only.",
    tabs: ["dispatch", "qc"],
    perms: { create: false, edit: false, delete: false, status: false, finance: false, qc: true, users: false, allAssets: true, allTypes: true, readOnly: true },
  },
};

/* ─── DEMO USERS ─────────────────────────────────────────────────────────── */
const SEED_USERS = [
  { id:"u1", name:"Arnel Macapagal",  initials:"AM", role:"plant_manager",  asset:null,   pin:"1111" },
  { id:"u2", name:"Rodel Santos",     initials:"RS", role:"batch_operator", asset:"BP1",  pin:"2222" },
  { id:"u3", name:"Jun Reyes",        initials:"JR", role:"batch_operator", asset:"BP2",  pin:"3333" },
  { id:"u4", name:"Cris Dizon",       initials:"CD", role:"dispatcher",     asset:null,   pin:"4444" },
  { id:"u5", name:"Donna Aquino",     initials:"DA", role:"qc_lab",         asset:null,   pin:"5555" },
];
const BLANK_USER = { id:null, name:"", initials:"", role:"batch_operator", asset:null, pin:"" };

/* ─── ASSETS ─────────────────────────────────────────────────────────────── */
const ASSET_GROUPS = [
  { id:"bp", label:"Batching Plants", icon:"🏭", assets:[{id:"BP1",name:"Batch Plant 1",color:"#f59e0b"},{id:"BP2",name:"Batch Plant 2",color:"#fb923c"}] },
  { id:"mt", label:"Mixer Trucks",    icon:"🚛", assets:[{id:"MT01",name:"Mixer T-01",color:"#38bdf8"},{id:"MT02",name:"Mixer T-02",color:"#0ea5e9"},{id:"MT03",name:"Mixer T-03",color:"#0284c7"},{id:"MT04",name:"Mixer T-04",color:"#0369a1"}] },
  { id:"pt", label:"Pump Trucks",     icon:"💧", assets:[{id:"PT01",name:"Pump T-01",color:"#34d399"},{id:"PT02",name:"Pump T-02",color:"#059669"}] },
  { id:"cb", label:"Conveyor/Belt",   icon:"⚙️", assets:[{id:"CB1",name:"Belt Line A",color:"#c084fc"},{id:"CB2",name:"Belt Line B",color:"#a855f7"}] },
];
const ALL_ASSETS = ASSET_GROUPS.flatMap(g => g.assets);
const getAsset  = id => ALL_ASSETS.find(a => a.id === id);
const getGroup  = id => ASSET_GROUPS.find(g => g.assets.some(a => a.id === id));

/* ─── JOB META ───────────────────────────────────────────────────────────── */
const JOB_TYPES = ["Concrete Pour","Batch Order","Truck Dispatch","Maintenance"];
const JOB_ICONS = { "Concrete Pour":"🏗", "Batch Order":"📦", "Truck Dispatch":"🚛", "Maintenance":"🔧" };
const MIX_GRADES = ["C20","C25","C30","C35","C40","C45","C50","Special","—"];
const STATUSES = ["Scheduled","In Progress","Complete","On Hold","Cancelled"];
const PRIORITIES = ["Urgent","High","Normal","Low"];
const RATE = { C20:3200, C25:3500, C30:3800, C35:4200, C40:4600, C45:5000, C50:5500, Special:6000 };

const S_META = {
  "Scheduled":   { bg:"#1e3a5f", text:"#60a5fa", dot:"#3b82f6", border:"#3b82f644" },
  "In Progress": { bg:"#3b1f0a", text:"#fb923c", dot:"#f97316", border:"#f9731644" },
  "Complete":    { bg:"#0a3322", text:"#4ade80", dot:"#22c55e", border:"#22c55e44" },
  "On Hold":     { bg:"#2d1f00", text:"#fbbf24", dot:"#f59e0b", border:"#f59e0b44" },
  "Cancelled":   { bg:"#1f1215", text:"#f87171", dot:"#ef4444", border:"#ef444444" },
};
const P_META = {
  "Urgent": { color:"#ef4444", bg:"#ef444420" },
  "High":   { color:"#f97316", bg:"#f9731620" },
  "Normal": { color:"#60a5fa", bg:"#3b82f620" },
  "Low":    { color:"#6b7280", bg:"#6b728020" },
};

/* ─── HOURS ──────────────────────────────────────────────────────────────── */
const HOURS = Array.from({ length:20 }, (_,i) => i+4); // 4am–11pm
const fmtH = h => h===12?"12pm":h===0?"12am":h<12?`${h}am`:`${h-12}pm`;

/* ─── SEED DATA ──────────────────────────────────────────────────────────── */
const SEED = [
  { id:1,  assetId:"BP1",  type:"Batch Order",    start:5,  dur:3, status:"In Progress", priority:"High",   grade:"C30", volume:48,  site:"Block 7 – Ortigas Ave",      operator:"u2", notes:"Standard slump 100mm" },
  { id:2,  assetId:"BP2",  type:"Batch Order",    start:6,  dur:2, status:"Scheduled",   priority:"Normal", grade:"C25", volume:24,  site:"Skyline Tower – Makati",      operator:"u3", notes:"" },
  { id:3,  assetId:"MT01", type:"Truck Dispatch", start:7,  dur:2, status:"In Progress", priority:"Urgent", grade:"C35", volume:7,   site:"Block 7 – Ortigas Ave",       operator:"u4", notes:"First trip" },
  { id:4,  assetId:"MT02", type:"Truck Dispatch", start:8,  dur:2, status:"Scheduled",   priority:"High",   grade:"C30", volume:7,   site:"Skyline Tower – Makati",       operator:"u4", notes:"" },
  { id:5,  assetId:"MT03", type:"Maintenance",    start:6,  dur:4, status:"On Hold",     priority:"Normal", grade:"—",   volume:0,   site:"Plant Yard",                  operator:"u1", notes:"Drum bearing replacement" },
  { id:6,  assetId:"MT04", type:"Truck Dispatch", start:10, dur:2, status:"Scheduled",   priority:"Normal", grade:"C25", volume:7,   site:"SM North – QC",               operator:"u4", notes:"" },
  { id:7,  assetId:"PT01", type:"Concrete Pour",  start:8,  dur:5, status:"In Progress", priority:"Urgent", grade:"C40", volume:90,  site:"Pier 4 Footing – Port Area",  operator:"u4", notes:"High-strength, no retarder" },
  { id:8,  assetId:"PT02", type:"Concrete Pour",  start:13, dur:4, status:"Scheduled",   priority:"High",   grade:"C35", volume:60,  site:"Skyline Tower – Makati",       operator:"u4", notes:"Slab on grade" },
  { id:9,  assetId:"CB1",  type:"Batch Order",    start:5,  dur:6, status:"Complete",    priority:"Normal", grade:"C20", volume:120, site:"Plant Internal",              operator:"u2", notes:"Aggregate feed" },
  { id:10, assetId:"CB2",  type:"Maintenance",    start:12, dur:3, status:"Scheduled",   priority:"Low",    grade:"—",   volume:0,   site:"Plant Yard",                  operator:"u1", notes:"Belt tension adjustment" },
];

const BLANK = { id:null, assetId:"MT01", type:"Truck Dispatch", start:8, dur:2, status:"Scheduled", priority:"Normal", grade:"C30", volume:7, site:"", operator:"", notes:"" };

/* ─── DOWNTIME REASONS ───────────────────────────────────────────────────── */
const DOWNTIME_REASONS = ["Scheduled Maintenance","Breakdown / Fault","Waiting for Parts","Operator Unavailable","Fuel / Refilling","Inspection","Weather Hold","Other"];
const UT_SEED = [
  { id:"ut1",  assetId:"BP1",  date:"2025-05-19", uptimeH:10.5, downtimeH:1.5, reason:"Scheduled Maintenance", notes:"Monthly PM — conveyor belt check", loggedBy:"u2" },
  { id:"ut2",  assetId:"BP2",  date:"2025-05-19", uptimeH:9.0,  downtimeH:3.0, reason:"Breakdown / Fault",     notes:"Mixer motor overheated, replaced thermostat", loggedBy:"u3" },
  { id:"ut3",  assetId:"MT01", date:"2025-05-19", uptimeH:11.0, downtimeH:1.0, reason:"Fuel / Refilling",      notes:"", loggedBy:"u4" },
  { id:"ut4",  assetId:"MT02", date:"2025-05-19", uptimeH:8.0,  downtimeH:4.0, reason:"Waiting for Parts",     notes:"Drum seal replacement pending delivery", loggedBy:"u4" },
  { id:"ut5",  assetId:"MT03", date:"2025-05-19", uptimeH:12.0, downtimeH:0.0, reason:"",                      notes:"", loggedBy:"u4" },
  { id:"ut6",  assetId:"MT04", date:"2025-05-19", uptimeH:10.0, downtimeH:2.0, reason:"Operator Unavailable",  notes:"Driver reported sick, replacement arranged", loggedBy:"u4" },
  { id:"ut7",  assetId:"PT01", date:"2025-05-19", uptimeH:9.5,  downtimeH:2.5, reason:"Inspection",            notes:"Boom pump hydraulic inspection", loggedBy:"u1" },
  { id:"ut8",  assetId:"PT02", date:"2025-05-19", uptimeH:12.0, downtimeH:0.0, reason:"",                      notes:"", loggedBy:"u1" },
  { id:"ut9",  assetId:"CB1",  date:"2025-05-19", uptimeH:11.5, downtimeH:0.5, reason:"Scheduled Maintenance", notes:"Belt tension adjustment", loggedBy:"u2" },
  { id:"ut10", assetId:"CB2",  date:"2025-05-19", uptimeH:7.0,  downtimeH:5.0, reason:"Breakdown / Fault",     notes:"Idler roller seized — replaced", loggedBy:"u2" },
];
const BLANK_UT = { id:null, assetId:"BP1", date:"", uptimeH:8, downtimeH:0, reason:"Scheduled Maintenance", notes:"", loggedBy:"" };

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT
═══════════════════════════════════════════════════════════════════════════ */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{background:"#0d1117",color:"#f87171",padding:40,fontFamily:"Inter,sans-serif",minHeight:"100vh"}}>
          <div style={{maxWidth:600,margin:"0 auto"}}>
            <div style={{fontSize:14,fontWeight:700,color:"#f59e0b",marginBottom:12,letterSpacing:2}}>CSI PLANT SCHEDULER — ERROR</div>
            <div style={{fontSize:20,fontWeight:700,color:"#f0f6fc",marginBottom:16}}>Something went wrong</div>
            <div style={{background:"#161b22",padding:16,borderRadius:8,fontSize:13,color:"#f87171",marginBottom:20,fontFamily:"monospace",whiteSpace:"pre-wrap",wordBreak:"break-all"}}>
              {this.state.error?.message || "Unknown error"}
            </div>
            <button onClick={()=>{ localStorage.clear(); window.location.reload(); }}
              style={{background:"#f59e0b",color:"#000",border:"none",padding:"10px 20px",borderRadius:6,fontWeight:700,cursor:"pointer",fontSize:14}}>
              Clear Data &amp; Reload
            </button>
            <div style={{marginTop:12,fontSize:12,color:"#8b949e"}}>
              This button clears stored data and reloads. Your app will restart fresh.
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user,  setUser]            = useState(null);
  const [users, setUsers]           = useLocalStorage("csi_users", SEED_USERS);

  // Keep logged-in user object in sync with users list (name/role changes)
  const syncedUser = user ? (users.find(u => u.id === user.id) || user) : null;

  function handleLogout() { setUser(null); }

  return (
    <ErrorBoundary>
      {syncedUser
        ? <Scheduler user={syncedUser} allUsers={users} setUsers={setUsers} onLogout={handleLogout} />
        : <Login users={users} onLogin={setUser} />}
    </ErrorBoundary>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIN
═══════════════════════════════════════════════════════════════════════════ */
function Login({ onLogin, users }) {
  const [picked, setPicked] = useState(null);
  const [pin, setPin]       = useState("");
  const [shake, setShake]   = useState(false);

  function pressKey(d) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        if (next === picked.pin) {
          onLogin(picked);
        } else {
          setShake(true);
          setPin("");
          setTimeout(() => setShake(false), 500);
        }
      }, 150);
    }
  }

  const role = picked ? ROLES[picked.role] : null;

  // Group users by role
  const byRole = Object.values(ROLES).map(r => ({
    role: r,
    users: users.filter(u => u.role === r.id),
  }));

  return (
    <>
      <style>{GFONTS}{BASE}{LOGIN_CSS}</style>
      <div className="login-wrap">
        {/* LEFT PANEL */}
        <div className="login-left">
          <div className="login-brand">
            <div className="login-chip">RMC OPS</div>
            <h1 className="login-h1">Plant Operations<br />Scheduler</h1>
            <p className="login-tagline">Ready-Mix Concrete<br />Role-Based Access System</p>
          </div>
          <div className="login-roles">
            {Object.values(ROLES).map(r => (
              <div key={r.id} className="login-role-row" style={{ borderColor: r.color + "44" }}>
                <span className="lr-icon">{r.icon}</span>
                <div>
                  <div className="lr-name" style={{ color: r.color }}>{r.label}</div>
                  <div className="lr-desc">{r.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="login-right">
          {!picked ? (
            <div className="user-select">
              <div className="us-title">Select Profile</div>
              <div className="us-sub">Choose your account to sign in</div>
              {byRole.map(({ role: r, users }) => (
                <div key={r.id} className="role-section">
                  <div className="rs-label" style={{ color: r.color }}>{r.icon} {r.label}</div>
                  <div className="rs-users">
                    {users.map(u => (
                      <div key={u.id} className="user-tile" onClick={() => { setPicked(u); setPin(""); }}
                        style={{ "--rc": r.color }}>
                        <div className="ut-av" style={{ background: r.color + "25", color: r.color, borderColor: r.color + "55" }}>
                          {u.initials}
                        </div>
                        <div className="ut-name">{u.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`pin-wrap${shake ? " shake" : ""}`}>
              <button className="back-btn" onClick={() => { setPicked(null); setPin(""); }}>← Back</button>
              <div className="pin-av" style={{ background: role.color + "25", color: role.color, borderColor: role.color + "55" }}>
                {picked.initials}
              </div>
              <div className="pin-name">{picked.name}</div>
              <div className="pin-role" style={{ color: role.color }}>{role.icon} {role.label}</div>
              <div className="pin-dots">
                {[0,1,2,3].map(i => (
                  <div key={i} className="pin-dot" style={{ background: pin.length > i ? role.color : "transparent", borderColor: pin.length > i ? role.color : "#30363d" }} />
                ))}
              </div>
              <div className="pin-hint">Demo PIN: {picked.pin}</div>
              <div className="numpad">
                {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d, i) => (
                  <button key={i} className={`numkey${d === "" ? " ghost" : ""}`}
                    style={{ "--rc": role.color }}
                    onClick={() => {
                      if (d === "⌫") setPin(p => p.slice(0,-1));
                      else if (d !== "") pressKey(String(d));
                    }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCHEDULER  (role-aware)
═══════════════════════════════════════════════════════════════════════════ */
function Scheduler({ user, allUsers, setUsers, onLogout }) {
  const role  = ROLES[user.role];
  const perms = role.perms;

  const [jobs, setJobs]       = useLocalStorage("csi_jobs", SEED);
  const [utLogs, setUtLogs]   = useLocalStorage("csi_utlogs", UT_SEED);
  const [utModal, setUtModal] = useState(false);
  const [utForm, setUtForm]   = useState(BLANK_UT);
  const [sel, setSel]       = useState(null);
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(BLANK);
  const [tab, setTab]       = useState(role.tabs[0]);
  const [fType, setFType]   = useState("All");
  const [fStat, setFStat]   = useState("All");
  const [userPane, setUserPane] = useState(false);
  const [dragging, setDrag] = useState(null);
  const ganttRef            = useRef(null);
  const [now, setNow]       = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  const nowFrac = ((now.getHours() + now.getMinutes()/60) - HOURS[0]) / HOURS.length;

  /* filter assets/jobs for role */
  const visGroups = perms.allAssets
    ? ASSET_GROUPS
    : ASSET_GROUPS.filter(g => perms.assetGroups?.includes(g.id));

  const roleJobs = jobs.filter(j => {
    if (!perms.allTypes && !perms.jobTypes?.includes(j.type)) return false;
    if (!perms.allAssets) {
      const grp = getGroup(j.assetId);
      if (!perms.assetGroups?.includes(grp?.id)) return false;
    }
    return true;
  });

  const visible = roleJobs.filter(j =>
    (fType === "All" || j.type === fType) &&
    (fStat === "All" || j.status === fStat)
  );

  const selJob = jobs.find(j => j.id === sel);

  /* actions */
  function openNew()   { setForm({ ...BLANK, id: Date.now(), operator: user.id }); setModal(true); }
  function openEdit(j) { setForm({ ...j }); setModal(true); }
  function saveJob()   {
    setJobs(p => { const e = p.find(j => j.id === form.id); return e ? p.map(j => j.id === form.id ? form : j) : [...p, form]; });
    setModal(false);
  }
  function delJob(id)  { setJobs(p => p.filter(j => j.id !== id)); if (sel === id) setSel(null); setModal(false); }
  function cycleStatus(id) {
    if (!perms.status) return;
    setJobs(p => p.map(j => j.id !== id ? j : { ...j, status: STATUSES[(STATUSES.indexOf(j.status)+1) % STATUSES.length] }));
  }
  function onGanttDrop(e) {
    if (!dragging || !ganttRef.current || !perms.edit) return;
    const r = ganttRef.current.getBoundingClientRect();
    const ns = Math.max(HOURS[0], Math.min(HOURS[HOURS.length-2], Math.round(HOURS[0] + ((e.clientX-r.left)/r.width)*HOURS.length)));
    setJobs(p => p.map(j => j.id === dragging ? { ...j, start: ns } : j));
    setDrag(null);
  }

  /* stats */
  const statVol = roleJobs.filter(j => j.status !== "Cancelled").reduce((s,j) => s+j.volume, 0);

  const TAB_LABELS = { overview:"📊 Overview", gantt:"⬛ Timeline", dispatch:"☰ Dispatch", qc:"🔬 QC Data", finance:"💰 Finance", uptime:"⏱ Uptime", users:"👥 Users" };

  if (userPane) return (
    <>
      <style>{GFONTS}{BASE}{APP_CSS}</style>
      <UsersPanel onBack={() => setUserPane(false)} users={allUsers} setUsers={setUsers} currentUser={user} />
    </>
  );

  return (
    <>
      <style>{GFONTS}{BASE}{APP_CSS}</style>
      <div className="app">

        {/* ── TOPBAR ── */}
        <header className="topbar">
          <div className="tb-left">
            <div className="tb-chip">RMC OPS</div>
            <div>
              <h1 className="tb-title">Plant Operations Scheduler</h1>
              <div className="tb-sub">Ready-Mix Concrete · {now.toLocaleDateString([],{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>
            </div>
          </div>
          <div className="tb-right">
            <div className="tb-clock">{now.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
            {/* User badge */}
            <div className="user-badge" style={{ "--rc": role.color, borderColor: role.color + "44", background: role.color + "0e" }}>
              <div className="ub-av" style={{ background: role.color + "28", color: role.color }}>{user.initials}</div>
              <div>
                <div className="ub-name">{user.name}</div>
                <div className="ub-role" style={{ color: role.color }}>{role.icon} {role.label}</div>
              </div>
            </div>
            {perms.create && <button className="btn-primary" onClick={openNew} style={{ "--rc": role.color }}>+ New Job</button>}
            {perms.users  && <button className="btn-ghost"   onClick={() => setUserPane(true)}>👥 Users</button>}
            <button className="btn-ghost logout" onClick={onLogout}>Sign Out</button>
            {perms.users && (
              <button className="btn-ghost" title="Reset all data to demo defaults"
                onClick={()=>{ if(window.confirm("Reset ALL data to demo defaults? This cannot be undone.")) clearAllData(); }}
                style={{fontSize:11,padding:"5px 9px"}}>
                ↺ Reset Data
              </button>
            )}
          </div>
        </header>

        {/* ── ROLE BANNER ── */}
        <div className="role-banner" style={{ background: role.color + "0a", borderColor: role.color + "30" }}>
          <div className="rb-left">
            <span className="rb-icon">{role.icon}</span>
            <div>
              <div className="rb-title" style={{ color: role.color }}>{role.label}</div>
              <div className="rb-desc">{role.description}</div>
            </div>
          </div>
          <div className="rb-perms">
            {[["Create Jobs",perms.create],["Edit Jobs",perms.edit],["Delete Jobs",perms.delete],["Update Status",perms.status],["QC Data",perms.qc],["Finance",perms.finance],["Manage Users",perms.users]].map(([l,v]) => (
              <div key={l} className={`rb-perm ${v ? "on" : "off"}`}>{v ? "✓" : "✗"} {l}</div>
            ))}
          </div>
        </div>

        {/* ── FIRST-RUN NOTICE ── */}
        {perms.users && !localStorage.getItem("csi_setup_done") && (
          <div className="setup-banner">
            <span className="sb-icon">🚀</span>
            <div className="sb-text">
              <strong>Welcome! You're running on demo data.</strong>
              Go to <strong>👥 Users</strong> to add your real staff, then update jobs and assets to match your plant.
            </div>
            <button className="sb-close" onClick={()=>{ localStorage.setItem("csi_setup_done","1"); window.location.reload(); }}>
              Got it ✕
            </button>
          </div>
        )}

        {/* ── STATS ── */}
        <div className="stat-row">
          {[
            { icon:"📋", val:roleJobs.length,                                      label:"Total Jobs",  color:role.color },
            { icon:"⚡", val:roleJobs.filter(j=>j.status==="In Progress").length,  label:"In Progress", color:"#f97316" },
            { icon:"🗓", val:roleJobs.filter(j=>j.status==="Scheduled").length,    label:"Scheduled",   color:"#38bdf8" },
            { icon:"✅", val:roleJobs.filter(j=>j.status==="Complete").length,     label:"Complete",    color:"#4ade80" },
            { icon:"🏗", val:statVol > 0 ? `${statVol} m³` : "—",                 label:"Total Volume",color:"#c084fc" },
          ].map((s, i) => (
            <div key={s.label} className="stat-card" style={{ animationDelay:`${i*55}ms` }}>
              <div className="sc-icon">{s.icon}</div>
              <div className="sc-val" style={{ color: s.color }}>{s.val}</div>
              <div className="sc-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── NAV + FILTERS ── */}
        <div className="nav-bar">
          <div className="tab-list">
            {role.tabs.map(t => (
              <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`}
                style={tab===t ? { "--rc": role.color } : {}}
                onClick={() => setTab(t)}>
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
          {(tab === "gantt" || tab === "dispatch") && (
            <div className="filter-set">
              <span className="f-lbl">Type</span>
              {["All", ...(perms.allTypes ? JOB_TYPES : (perms.jobTypes || JOB_TYPES))].map(t => (
                <button key={t} className={`chip ${fType===t?"active":""}`} style={fType===t?{"--rc":role.color}:{}} onClick={() => setFType(t)}>
                  {t !== "All" && JOB_ICONS[t] + " "}{t}
                </button>
              ))}
              <span className="f-lbl" style={{marginLeft:10}}>Status</span>
              {["All",...STATUSES].map(s => (
                <button key={s} className={`chip ${fStat===s?"active":""}`} style={fStat===s?{"--rc":role.color}:{}} onClick={() => setFStat(s)}>{s}</button>
              ))}
            </div>
          )}
        </div>

        {/* ── BODY ── */}
        <div className="body-wrap">
          <main className="content">

            {/* OVERVIEW (Plant Manager only) */}
            {tab === "overview" && (
              <div className="overview-grid">
                {/* Asset status cards */}
                {ASSET_GROUPS.map(g => (
                  <div key={g.id} className="ov-group">
                    <div className="ov-group-hdr">{g.icon} {g.label}</div>
                    <div className="ov-asset-list">
                      {g.assets.map(a => {
                        const aJobs = jobs.filter(j => j.assetId === a.id);
                        const active = aJobs.find(j => j.status === "In Progress");
                        const sched  = aJobs.filter(j => j.status === "Scheduled").length;
                        const maint  = aJobs.find(j => j.type === "Maintenance" && j.status !== "Complete" && j.status !== "Cancelled");
                        const status = active ? "ACTIVE" : maint ? "MAINT" : "READY";
                        const scol   = active ? "#f97316" : maint ? "#f87171" : "#4ade80";
                        return (
                          <div key={a.id} className="ov-asset" style={{ borderColor: a.color + "44" }}>
                            <div className="oa-top" style={{ background: a.color + "14" }}>
                              <span className="dot" style={{ background: a.color }} />
                              <span className="oa-name">{a.name}</span>
                              <span className="oa-status" style={{ color: scol }}>{status}</span>
                            </div>
                            <div className="oa-body">
                              {active && <div className="oa-job">{JOB_ICONS[active.type]} {active.site}</div>}
                              <div className="oa-meta">{sched} scheduled · {aJobs.filter(j=>j.volume>0).reduce((s,j)=>s+j.volume,0)} m³</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {/* Grade breakdown */}
                <div className="ov-group ov-full">
                  <div className="ov-group-hdr">🧪 Today's Mix Grades</div>
                  <div className="grade-strip">
                    {MIX_GRADES.filter(g=>g!=="—").map(g => {
                      const gJobs = jobs.filter(j => j.grade === g && j.status !== "Cancelled");
                      if (!gJobs.length) return null;
                      const vol = gJobs.reduce((s,j) => s+j.volume, 0);
                      return (
                        <div key={g} className="grade-tile">
                          <div className="gt-grade">{g}</div>
                          <div className="gt-vol">{vol} m³</div>
                          <div className="gt-count">{gJobs.length} jobs</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* GANTT */}
            {tab === "gantt" && (
              <div className="gantt-wrap">
                <div className="gantt-time-hdr">
                  <div className="g-asset-col" />
                  {HOURS.map(h => <div key={h} className="g-hr">{fmtH(h)}</div>)}
                </div>
                <div className="gantt-body" ref={ganttRef} onDragOver={e=>e.preventDefault()} onDrop={onGanttDrop}>
                  {visGroups.map(grp => (
                    <div key={grp.id}>
                      <div className="g-grp-row">{grp.icon} {grp.label}</div>
                      {grp.assets.map(a => {
                        const aJobs = visible.filter(j => j.assetId === a.id);
                        return (
                          <div key={a.id} className="g-row">
                            <div className="g-asset-cell">
                              <span className="dot" style={{ background: a.color }} />
                              <span className="g-asset-name">{a.name}</span>
                            </div>
                            <div className="g-track">
                              {HOURS.map(h => <div key={h} className="g-col" style={{ left:`${((h-HOURS[0])/HOURS.length)*100}%` }} />)}
                              {nowFrac > 0 && nowFrac < 1 && (
                                <div className="g-now" style={{ left:`${nowFrac*100}%` }}>
                                  <div className="g-now-lbl">NOW</div>
                                </div>
                              )}
                              {aJobs.map(job => {
                                const lft = ((job.start-HOURS[0])/HOURS.length)*100;
                                const wid = (job.dur/HOURS.length)*100;
                                const sm  = S_META[job.status];
                                return (
                                  <div key={job.id}
                                    className={`g-bar${sel===job.id?" g-sel":""}${job.type==="Maintenance"?" g-maint":""}`}
                                    style={{ left:`${Math.max(0,lft)}%`, width:`${Math.min(100,wid)}%`, background:sm.bg, borderColor:sm.border, color:sm.text }}
                                    draggable={perms.edit}
                                    onDragStart={e => { if (perms.edit) { setDrag(job.id); e.dataTransfer.effectAllowed="move"; } }}
                                    onClick={() => setSel(sel===job.id ? null : job.id)}>
                                    <span style={{fontSize:11}}>{JOB_ICONS[job.type]}</span>
                                    <span className="g-bar-lbl">{job.site || job.type}</span>
                                    {job.volume > 0 && <span className="g-bar-vol">{job.volume}m³</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DISPATCH LIST */}
            {tab === "dispatch" && (
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr>
                    <th>Asset</th><th>Type</th><th>Site / Project</th><th>Grade</th>
                    <th>Vol</th><th>Start</th><th>Dur</th><th>Operator</th>
                    <th>Priority</th><th>Status</th>
                    {!perms.readOnly && <th />}
                  </tr></thead>
                  <tbody>
                    {visible.map(job => {
                      const a = getAsset(job.assetId);
                      const sm = S_META[job.status];
                      const pm = P_META[job.priority];
                      const op = allUsers.find(u => u.id === job.operator);
                      return (
                        <tr key={job.id} className={sel===job.id?"tr-sel":""} onClick={() => setSel(sel===job.id?null:job.id)}>
                          <td><span className="dot" style={{background:a?.color}}/><span style={{marginLeft:5}}>{a?.name}</span></td>
                          <td>{JOB_ICONS[job.type]} {job.type}</td>
                          <td className="td-trunc">{job.site||"—"}</td>
                          <td><span className="g-badge">{job.grade}</span></td>
                          <td>{job.volume>0?`${job.volume}m³`:"—"}</td>
                          <td>{fmtH(job.start)}</td>
                          <td>{job.dur}h</td>
                          <td>{op?.name||"—"}</td>
                          <td><span className="p-badge" style={{color:pm.color,background:pm.bg}}>{job.priority}</span></td>
                          <td>
                            <span className="s-badge" style={{color:sm.text,background:sm.bg,borderColor:sm.border,cursor:perms.status?"pointer":"default"}}
                              onClick={e => { e.stopPropagation(); cycleStatus(job.id); }}>
                              <span className="s-dot" style={{background:sm.dot}} />{job.status}
                            </span>
                          </td>
                          {!perms.readOnly && (
                            <td><button className="row-btn" onClick={e=>{e.stopPropagation();openEdit(job);}}>✎</button></td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {visible.length===0 && <div className="tbl-empty">No jobs match the current filters.</div>}
              </div>
            )}

            {/* QC DATA */}
            {tab === "qc" && (
              <div className="qc-layout">
                <div className="qc-main">
                  <div className="section-hdr">🔬 Mix Design & QC Log</div>
                  <table className="tbl">
                    <thead><tr><th>Site / Project</th><th>Grade</th><th>Volume (m³)</th><th>Asset</th><th>Operator</th><th>Status</th><th>Notes</th></tr></thead>
                    <tbody>
                      {roleJobs.filter(j=>j.grade!=="—").map(job => {
                        const a = getAsset(job.assetId);
                        const sm = S_META[job.status];
                        const op = allUsers.find(u => u.id === job.operator);
                        return (
                          <tr key={job.id}>
                            <td>{job.site}</td>
                            <td><span className="g-badge g-lg">{job.grade}</span></td>
                            <td><strong style={{color:"#f0f6fc"}}>{job.volume} m³</strong></td>
                            <td><span className="dot" style={{background:a?.color}}/> {a?.name}</td>
                            <td>{op?.name||"—"}</td>
                            <td><span className="s-badge" style={{color:sm.text,background:sm.bg,borderColor:sm.border}}><span className="s-dot" style={{background:sm.dot}}/>{job.status}</span></td>
                            <td style={{color:"#8b949e",fontSize:12}}>{job.notes||"—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="qc-sidebar">
                  <div className="section-hdr">Grade Summary</div>
                  {MIX_GRADES.filter(g=>g!=="—").map(g => {
                    const gj = roleJobs.filter(j => j.grade === g);
                    if (!gj.length) return null;
                    const vol = gj.reduce((s,j)=>s+j.volume,0);
                    return (
                      <div key={g} className="grade-card">
                        <div className="gc-grade">{g}</div>
                        <div className="gc-vol">{vol} <span>m³</span></div>
                        <div className="gc-count">{gj.length} batch{gj.length!==1?"es":""}</div>
                        <div className="gc-bar-wrap">
                          <div className="gc-bar" style={{ width:`${Math.min(100,(vol/300)*100)}%`, background:"#f59e0b" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* FINANCE */}
            {tab === "finance" && (
              <div className="table-wrap">
                <div className="section-hdr">💰 Billing & Revenue Summary — Today</div>
                <table className="tbl">
                  <thead><tr><th>Asset</th><th>Type</th><th>Site / Project</th><th>Grade</th><th>Volume (m³)</th><th>Rate (₱/m³)</th><th>Est. Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {jobs.filter(j=>j.volume>0).map(job => {
                      const a  = getAsset(job.assetId);
                      const sm = S_META[job.status];
                      const rate = RATE[job.grade] || 0;
                      const amt  = rate * job.volume;
                      return (
                        <tr key={job.id}>
                          <td><span className="dot" style={{background:a?.color}}/> {a?.name}</td>
                          <td>{JOB_ICONS[job.type]} {job.type}</td>
                          <td className="td-trunc">{job.site}</td>
                          <td><span className="g-badge">{job.grade}</span></td>
                          <td>{job.volume}</td>
                          <td>₱{rate.toLocaleString()}</td>
                          <td><strong style={{color:"#4ade80"}}>₱{amt.toLocaleString()}</strong></td>
                          <td><span className="s-badge" style={{color:sm.text,background:sm.bg,borderColor:sm.border}}><span className="s-dot" style={{background:sm.dot}}/>{job.status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="finance-footer">
                  <div className="ff-item">
                    <span className="ff-lbl">Total Deliveries</span>
                    <span className="ff-val" style={{color:role.color}}>{jobs.filter(j=>j.volume>0).length}</span>
                  </div>
                  <div className="ff-item">
                    <span className="ff-lbl">Total Volume</span>
                    <span className="ff-val" style={{color:"#38bdf8"}}>{jobs.filter(j=>j.volume>0).reduce((s,j)=>s+j.volume,0)} m³</span>
                  </div>
                  <div className="ff-item">
                    <span className="ff-lbl">Est. Revenue Today</span>
                    <span className="ff-val" style={{color:"#4ade80"}}>
                      ₱{jobs.filter(j=>j.volume>0).reduce((s,j)=>s+(RATE[j.grade]||0)*j.volume,0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}


            {/* UPTIME / DOWNTIME */}
            {tab === "uptime" && (
              <UptimeTab
                utLogs={utLogs} setUtLogs={setUtLogs}
                utModal={utModal} setUtModal={setUtModal}
                utForm={utForm}  setUtForm={setUtForm}
                perms={perms} user={user} role={role}
                visGroups={visGroups} allUsers={allUsers}
              />
            )}

          </main>

          {/* ── SIDE DETAIL ── */}
          <aside className="side-detail">
            {!selJob ? (
              <div className="sd-empty">
                <div className="sd-empty-icon">◈</div>
                <div className="sd-empty-txt">Select a job</div>
                <div className="sd-empty-sub">Click any bar or row</div>
              </div>
            ) : (
              <div className="sd-body" key={selJob.id}>
                <div className="sd-type">{JOB_ICONS[selJob.type]} {selJob.type}</div>
                <div className="sd-site">{selJob.site || "Plant Yard"}</div>
                <div className="sd-asset-row">
                  <span className="dot" style={{background:getAsset(selJob.assetId)?.color}}/>
                  <span className="sd-asset">{getAsset(selJob.assetId)?.name}</span>
                  <span className="sd-grp">{getGroup(selJob.assetId)?.label}</span>
                </div>
                <div className="sd-divider" />
                <div className="kv-list">
                  {[
                    ["Status",     <span className="s-badge" style={{color:S_META[selJob.status].text,background:S_META[selJob.status].bg,borderColor:S_META[selJob.status].border}}><span className="s-dot" style={{background:S_META[selJob.status].dot}}/>{selJob.status}</span>],
                    ["Priority",   <span className="p-badge" style={{color:P_META[selJob.priority].color,background:P_META[selJob.priority].bg}}>{selJob.priority}</span>],
                    ["Mix Grade",  <span className="g-badge">{selJob.grade}</span>],
                    ["Volume",     selJob.volume > 0 ? `${selJob.volume} m³` : "—"],
                    ["Start",      fmtH(selJob.start)],
                    ["End",        fmtH(selJob.start + selJob.dur)],
                    ["Duration",   `${selJob.dur}h`],
                    ["Operator",   allUsers.find(u=>u.id===selJob.operator)?.name || "—"],
                  ].map(([k,v]) => (
                    <div key={k} className="kv-row"><span className="kv-k">{k}</span><span className="kv-v">{v}</span></div>
                  ))}
                </div>
                {selJob.notes && (
                  <div className="sd-notes">
                    <div className="sdn-lbl">NOTES</div>
                    <div className="sdn-txt">{selJob.notes}</div>
                  </div>
                )}
                {!perms.readOnly ? (
                  <div className="sd-actions">
                    {perms.edit   && <button className="btn-ghost sm" onClick={() => openEdit(selJob)}>✎ Edit</button>}
                    {perms.status && <button className="btn-cycle sm" onClick={() => cycleStatus(selJob.id)}>↻ Status</button>}
                    {perms.delete && <button className="btn-danger sm" onClick={() => delJob(selJob.id)}>✕ Delete</button>}
                  </div>
                ) : (
                  <div className="read-only-tag">👁 View Only — {role.label}</div>
                )}
              </div>
            )}

            {/* Fleet mini summary */}
            <div className="fleet-summary">
              <div className="fs-title">Fleet Status</div>
              {visGroups.map(g => (
                <div key={g.id} className="fs-group">
                  <div className="fsg-lbl">{g.icon} {g.label}</div>
                  {g.assets.map(a => {
                    const aj = jobs.filter(j => j.assetId === a.id);
                    const act = aj.filter(j => j.status === "In Progress").length;
                    const sch = aj.filter(j => j.status === "Scheduled").length;
                    return (
                      <div key={a.id} className="fsa-row">
                        <span className="dot sm" style={{ background: a.color }} />
                        <span className="fsa-name">{a.name}</span>
                        <div className="fsa-tags">
                          {act > 0 && <span className="tag act">{act} active</span>}
                          {sch > 0 && <span className="tag sch">{sch} sched</span>}
                          {act === 0 && sch === 0 && <span className="tag idle">idle</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>

      {/* ── MODAL ── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(false)}>
          <div className="modal-box">
            <div className="modal-hdr">
              <span>{jobs.find(j=>j.id===form.id) ? "Edit Job" : "New Job"}</span>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-2col">
                <MFld label="Job Type">
                  <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
                    {(perms.allTypes?JOB_TYPES:(perms.jobTypes||JOB_TYPES)).map(t=><option key={t}>{t}</option>)}
                  </select>
                </MFld>
                <MFld label="Asset">
                  <select value={form.assetId} onChange={e=>setForm(p=>({...p,assetId:e.target.value}))}>
                    {visGroups.map(g=>(
                      <optgroup key={g.id} label={g.label}>
                        {g.assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </MFld>
              </div>
              <MFld label="Site / Project Address">
                <input value={form.site} onChange={e=>setForm(p=>({...p,site:e.target.value}))} placeholder="e.g. Block 7 – Ortigas Ave"/>
              </MFld>
              <div className="form-2col">
                <MFld label="Mix Grade">
                  <select value={form.grade} onChange={e=>setForm(p=>({...p,grade:e.target.value}))}>
                    {MIX_GRADES.map(g=><option key={g}>{g}</option>)}
                  </select>
                </MFld>
                <MFld label={`Volume: ${form.volume} m³`}>
                  <input type="range" min={0} max={200} value={form.volume} onChange={e=>setForm(p=>({...p,volume:+e.target.value}))}/>
                </MFld>
              </div>
              <div className="form-2col">
                <MFld label={`Start: ${fmtH(form.start)}`}>
                  <input type="range" min={HOURS[0]} max={HOURS[HOURS.length-2]} value={form.start} onChange={e=>setForm(p=>({...p,start:+e.target.value}))}/>
                </MFld>
                <MFld label={`Duration: ${form.dur}h`}>
                  <input type="range" min={1} max={12} value={form.dur} onChange={e=>setForm(p=>({...p,dur:+e.target.value}))}/>
                </MFld>
              </div>
              <div className="form-2col">
                <MFld label="Status">
                  <select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
                    {STATUSES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </MFld>
                <MFld label="Priority">
                  <select value={form.priority} onChange={e=>setForm(p=>({...p,priority:e.target.value}))}>
                    {PRIORITIES.map(x=><option key={x}>{x}</option>)}
                  </select>
                </MFld>
              </div>
              <MFld label="Assign Operator">
                <select value={form.operator} onChange={e=>setForm(p=>({...p,operator:e.target.value}))}>
                  <option value="">— Unassigned —</option>
                  {allUsers.map(u=>{
                    const r=ROLES[u.role];
                    return <option key={u.id} value={u.id}>{u.name} ({r.label})</option>;
                  })}
                </select>
              </MFld>
              <MFld label="Notes">
                <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Slump specs, instructions…"/>
              </MFld>
            </div>
            <div className="modal-ftr">
              {jobs.find(j=>j.id===form.id) && perms.delete
                ? <button className="btn-danger" onClick={()=>delJob(form.id)}>Delete Job</button>
                : <div/>}
              <div style={{display:"flex",gap:8}}>
                <button className="btn-ghost" onClick={()=>setModal(false)}>Cancel</button>
                <button className="btn-primary" style={{"--rc":role.color}} onClick={saveJob}>Save Job</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   UPTIME / DOWNTIME TAB
═══════════════════════════════════════════════════════════════════════════ */
function UptimeTab({ utLogs, setUtLogs, utModal, setUtModal, utForm, setUtForm, perms, user, role, visGroups, allUsers }) {
  const [filterAsset, setFilterAsset] = useState("All");
  const [selLog, setSelLog] = useState(null);

  const SHIFT_H = 12; // reference shift hours for OEE %

  const allAssets = visGroups.flatMap(g => g.assets);
  const filteredLogs = filterAsset === "All"
    ? utLogs
    : utLogs.filter(l => l.assetId === filterAsset);

  function openNew() {
    setUtForm({ ...BLANK_UT, id: "ut" + Date.now(), date: new Date().toISOString().slice(0,10), loggedBy: user.id });
    setUtModal(true);
  }
  function openEdit(l) { setUtForm({ ...l }); setUtModal(true); }
  function saveLog() {
    setUtLogs(p => { const e = p.find(l => l.id === utForm.id); return e ? p.map(l => l.id === utForm.id ? utForm : l) : [...p, utForm]; });
    setUtModal(false);
  }
  function delLog(id) { setUtLogs(p => p.filter(l => l.id !== id)); setSelLog(null); setUtModal(false); }

  // Per-asset summary
  const assetSummary = allAssets.map(a => {
    const logs = utLogs.filter(l => l.assetId === a.id);
    const totalUp   = logs.reduce((s,l) => s + l.uptimeH, 0);
    const totalDown = logs.reduce((s,l) => s + l.downtimeH, 0);
    const total     = totalUp + totalDown;
    const pct       = total > 0 ? Math.round((totalUp / total) * 100) : 0;
    const lastLog   = logs.sort((a,b) => b.date.localeCompare(a.date))[0];
    return { ...a, totalUp, totalDown, total, pct, lastLog, logCount: logs.length };
  });

  // Plant-wide totals
  const plantUp   = assetSummary.reduce((s,a) => s + a.totalUp, 0);
  const plantDown = assetSummary.reduce((s,a) => s + a.totalDown, 0);
  const plantPct  = plantUp + plantDown > 0 ? Math.round((plantUp / (plantUp + plantDown)) * 100) : 0;

  const uptimeColor = pct => pct >= 85 ? "#4ade80" : pct >= 65 ? "#f59e0b" : "#f87171";

  return (
    <div className="ut-wrap">
      {/* ── HEADER BAR ── */}
      <div className="ut-topbar">
        <div className="ut-topbar-left">
          <span className="section-hdr" style={{border:"none",background:"transparent",padding:"0",display:"inline"}}>⏱ Equipment Uptime &amp; Downtime Log</span>
          <div className="ut-plant-kpis">
            <div className="ut-kpi"><span className="ut-kpi-v" style={{color:"#4ade80"}}>{plantUp.toFixed(1)}h</span><span className="ut-kpi-l">Total Uptime</span></div>
            <div className="ut-kpi"><span className="ut-kpi-v" style={{color:"#f87171"}}>{plantDown.toFixed(1)}h</span><span className="ut-kpi-l">Total Downtime</span></div>
            <div className="ut-kpi"><span className="ut-kpi-v" style={{color: uptimeColor(plantPct)}}>{plantPct}%</span><span className="ut-kpi-l">Plant Availability</span></div>
          </div>
        </div>
        <div className="ut-topbar-right">
          <select className="ut-select" value={filterAsset} onChange={e => setFilterAsset(e.target.value)}>
            <option value="All">All Assets</option>
            {visGroups.map(g => (
              <optgroup key={g.id} label={g.label}>
                {g.assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </optgroup>
            ))}
          </select>
          {perms.uptime && <button className="btn-primary" style={{"--rc": role.color}} onClick={openNew}>+ Log Entry</button>}
        </div>
      </div>

      <div className="ut-body">
        {/* ── ASSET CARDS ── */}
        <div className="ut-cards-col">
          <div className="ut-col-hdr">Asset Availability</div>
          {assetSummary.map(a => {
            const uc = uptimeColor(a.pct);
            const isFiltered = filterAsset !== "All" && filterAsset !== a.id;
            return (
              <div key={a.id} className={`ut-asset-card${isFiltered ? " ut-dimmed" : ""}`}
                style={{ borderColor: a.color + "44" }}
                onClick={() => setFilterAsset(filterAsset === a.id ? "All" : a.id)}>
                <div className="utac-top">
                  <span className="dot" style={{ background: a.color }} />
                  <span className="utac-name">{a.name}</span>
                  <span className="utac-pct" style={{ color: uc }}>{a.pct}%</span>
                </div>
                {/* Bar */}
                <div className="utac-bar-track">
                  <div className="utac-bar-up"   style={{ width: `${a.pct}%`,          background: uc }} />
                  <div className="utac-bar-down" style={{ width: `${100 - a.pct}%`,    background: "#f8717133" }} />
                </div>
                <div className="utac-meta">
                  <span style={{color:"#4ade80"}}>▲ {a.totalUp.toFixed(1)}h up</span>
                  <span style={{color:"#f87171"}}>▼ {a.totalDown.toFixed(1)}h down</span>
                  <span style={{color:"#8b949e"}}>{a.logCount} log{a.logCount!==1?"s":""}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── LOG TABLE ── */}
        <div className="ut-table-col">
          <div className="ut-col-hdr">Log Entries {filterAsset !== "All" && `— ${getAsset(filterAsset)?.name}`}</div>
          <div className="ut-table-scroll">
            <table className="tbl">
              <thead><tr>
                <th>Asset</th><th>Date</th><th>Uptime</th><th>Downtime</th>
                <th>Availability</th><th>Reason</th><th>Logged By</th><th>Notes</th>
                {perms.uptime && <th />}
              </tr></thead>
              <tbody>
                {filteredLogs.sort((a,b) => b.date.localeCompare(a.date)).map(log => {
                  const a   = getAsset(log.assetId);
                  const tot = log.uptimeH + log.downtimeH;
                  const pct = tot > 0 ? Math.round((log.uptimeH/tot)*100) : 0;
                  const uc  = uptimeColor(pct);
                  const op  = allUsers.find(u => u.id === log.loggedBy);
                  return (
                    <tr key={log.id} className={selLog===log.id?"tr-sel":""} onClick={() => setSelLog(selLog===log.id?null:log.id)}>
                      <td><span className="dot" style={{background:a?.color}}/><span style={{marginLeft:5}}>{a?.name}</span></td>
                      <td style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>{log.date}</td>
                      <td><span style={{color:"#4ade80",fontWeight:600}}>{log.uptimeH}h</span></td>
                      <td>
                        {log.downtimeH > 0
                          ? <span style={{color:"#f87171",fontWeight:600}}>{log.downtimeH}h</span>
                          : <span style={{color:"#8b949e"}}>—</span>}
                      </td>
                      <td>
                        <div className="ut-inline-bar">
                          <div style={{width:`${pct}%`,height:"100%",background:uc,borderRadius:2}}/>
                        </div>
                        <span style={{color:uc,fontSize:11,fontWeight:700,marginLeft:5}}>{pct}%</span>
                      </td>
                      <td style={{fontSize:11,color: log.downtimeH>0?"#f59e0b":"#8b949e"}}>
                        {log.reason || (log.downtimeH===0 ? "No downtime" : "—")}
                      </td>
                      <td style={{fontSize:11}}>{op?.name || "—"}</td>
                      <td className="td-trunc" style={{fontSize:11,color:"#8b949e"}}>{log.notes||"—"}</td>
                      {perms.uptime && (
                        <td><button className="row-btn" onClick={e=>{e.stopPropagation();openEdit(log);}}>✎</button></td>
                      )}
                    </tr>
                  );
                })}
                {filteredLogs.length === 0 && (
                  <tr><td colSpan={9} className="tbl-empty">No log entries for this asset yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── LOG MODAL ── */}
      {utModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setUtModal(false)}>
          <div className="modal-box" style={{width:480}}>
            <div className="modal-hdr">
              <span>{utLogs.find(l=>l.id===utForm.id) ? "Edit Log Entry" : "New Uptime Log"}</span>
              <button className="modal-close" onClick={()=>setUtModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-2col">
                <MFld label="Asset">
                  <select value={utForm.assetId} onChange={e=>setUtForm(p=>({...p,assetId:e.target.value}))}>
                    {visGroups.map(g=>(
                      <optgroup key={g.id} label={g.label}>
                        {g.assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </MFld>
                <MFld label="Date">
                  <input type="date" value={utForm.date} onChange={e=>setUtForm(p=>({...p,date:e.target.value}))}/>
                </MFld>
              </div>
              <div className="form-2col">
                <MFld label={`Uptime Hours: ${utForm.uptimeH}h`}>
                  <input type="range" min={0} max={24} step={0.5} value={utForm.uptimeH}
                    onChange={e=>setUtForm(p=>({...p,uptimeH:+e.target.value,downtimeH:Math.max(0,24-+e.target.value)}))}/>
                  <div className="ut-slider-labels"><span style={{color:"#4ade80"}}>{utForm.uptimeH}h UP</span><span style={{color:"#f87171"}}>{utForm.downtimeH}h DOWN</span></div>
                </MFld>
                <MFld label={`Downtime Hours: ${utForm.downtimeH}h`}>
                  <input type="range" min={0} max={24} step={0.5} value={utForm.downtimeH}
                    onChange={e=>setUtForm(p=>({...p,downtimeH:+e.target.value,uptimeH:Math.max(0,24-+e.target.value)}))}/>
                </MFld>
              </div>
              {/* Visual preview bar */}
              <div className="ut-preview-bar">
                <div style={{flex:utForm.uptimeH,background:"#4ade80",borderRadius:"4px 0 0 4px",minWidth:2}}/>
                <div style={{flex:utForm.downtimeH,background:"#f8717144",borderRadius:"0 4px 4px 0",minWidth:utForm.downtimeH>0?2:0}}/>
              </div>
              <div className="ut-preview-labels">
                <span style={{color:"#4ade80"}}>▲ {utForm.uptimeH}h Uptime</span>
                <span style={{color:"#f87171"}}>▼ {utForm.downtimeH}h Downtime</span>
                <span style={{color:"#8b949e"}}>{utForm.uptimeH+utForm.downtimeH > 0 ? Math.round((utForm.uptimeH/(utForm.uptimeH+utForm.downtimeH))*100) : 0}% availability</span>
              </div>
              <MFld label="Downtime Reason">
                <select value={utForm.reason} onChange={e=>setUtForm(p=>({...p,reason:e.target.value}))}>
                  <option value="">— No downtime / N/A —</option>
                  {DOWNTIME_REASONS.map(r=><option key={r}>{r}</option>)}
                </select>
              </MFld>
              <MFld label="Notes / Details">
                <textarea value={utForm.notes} onChange={e=>setUtForm(p=>({...p,notes:e.target.value}))} placeholder="Describe the issue, repair done, parts replaced…"/>
              </MFld>
            </div>
            <div className="modal-ftr">
              {utLogs.find(l=>l.id===utForm.id) && perms.uptime
                ? <button className="btn-danger" onClick={()=>delLog(utForm.id)}>Delete Log</button>
                : <div/>}
              <div style={{display:"flex",gap:8}}>
                <button className="btn-ghost" onClick={()=>setUtModal(false)}>Cancel</button>
                <button className="btn-primary" style={{"--rc":role.color}} onClick={saveLog}>Save Log</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   USERS PANEL  (Plant Manager only) — full CRUD
═══════════════════════════════════════════════════════════════════════════ */
function UsersPanel({ onBack, users, setUsers, currentUser }) {
  const [fr, setFr]         = useState("all");
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(BLANK_USER);
  const [showPin, setShowPin] = useState(false);
  const [pinErr, setPinErr] = useState("");

  const shown = fr === "all" ? users : users.filter(u => u.role === fr);

  function openNew() {
    setForm({ ...BLANK_USER, id: "u" + Date.now() });
    setShowPin(false); setPinErr(""); setModal(true);
  }
  function openEdit(u) {
    setForm({ ...u });
    setShowPin(false); setPinErr(""); setModal(true);
  }
  function saveUser() {
    if (!form.name.trim())       { setPinErr("Name is required."); return; }
    if (!form.initials.trim())   { setPinErr("Initials are required."); return; }
    if (!form.pin || form.pin.length !== 4 || !/^\d{4}$/.test(form.pin)) {
      setPinErr("PIN must be exactly 4 digits."); return;
    }
    // prevent duplicate PINs (except same user)
    const dup = users.find(u => u.pin === form.pin && u.id !== form.id);
    if (dup) { setPinErr(`PIN already used by ${dup.name}.`); return; }
    setUsers(prev => {
      const exists = prev.find(u => u.id === form.id);
      return exists ? prev.map(u => u.id === form.id ? form : u) : [...prev, form];
    });
    setModal(false);
  }
  function deleteUser(id) {
    if (id === currentUser.id) { setPinErr("You cannot delete your own account."); return; }
    setUsers(prev => prev.filter(u => u.id !== id));
    setModal(false);
  }

  // Auto-generate initials from name
  function autoInitials(name) {
    return name.trim().split(" ").filter(Boolean).map(w => w[0].toUpperCase()).slice(0,2).join("");
  }

  return (
    <>
      <style>{GFONTS}{BASE}{APP_CSS}</style>
      <div className="app">
        <header className="topbar">
          <div className="tb-left">
            <div className="tb-chip">RMC OPS</div>
            <div><h1 className="tb-title">User Management</h1><div className="tb-sub">Process Owner Accounts · Role-Based Access</div></div>
          </div>
          <div className="tb-right">
            <button className="btn-primary" style={{"--rc":"#f59e0b"}} onClick={openNew}>+ Add User</button>
            <button className="btn-ghost" onClick={onBack}>← Back</button>
          </div>
        </header>

        {/* Role filter */}
        <div className="nav-bar">
          <div className="tab-list">
            <button className={`tab-btn ${fr==="all"?"active":""}`} onClick={()=>setFr("all")}>
              All ({users.length})
            </button>
            {Object.values(ROLES).map(r=>(
              <button key={r.id} className={`tab-btn ${fr===r.id?"active":""}`}
                style={fr===r.id?{"--rc":r.color}:{}} onClick={()=>setFr(r.id)}>
                {r.icon} {r.label} ({users.filter(u=>u.role===r.id).length})
              </button>
            ))}
          </div>
        </div>

        <div className="um-layout">
          {/* User cards */}
          <div className="um-cards">
            {shown.map(u => {
              const r = ROLES[u.role];
              const p = r.perms;
              const isSelf = u.id === currentUser.id;
              return (
                <div key={u.id} className="um-card" style={{ borderColor: r.color + "44" }}>
                  <div className="umc-top" style={{ background: r.color + "12" }}>
                    <div className="umc-av" style={{ background: r.color + "28", color: r.color, borderColor: r.color + "55" }}>{u.initials}</div>
                    <div style={{flex:1}}>
                      <div className="umc-name">{u.name} {isSelf && <span style={{fontSize:12,color:"#f59e0b",background:"#f59e0b18",padding:"1px 6px",borderRadius:3,marginLeft:4}}>YOU</span>}</div>
                      <div className="umc-role" style={{ color: r.color }}>{r.icon} {r.label}</div>
                      {u.asset && <div className="umc-asset">Asset: {getAsset(u.asset)?.name||u.asset}</div>}
                    </div>
                    <button className="um-edit-btn" onClick={()=>openEdit(u)} title="Edit user">✎</button>
                  </div>
                  <div className="umc-body">
                    <div className="umc-desc">{r.description}</div>
                    <div className="umc-perms">
                      {[["Create",p.create],["Edit",p.edit],["Delete",p.delete],["Status",p.status],["QC",p.qc],["Finance",p.finance],["Users",p.users]].map(([l,v])=>(
                        <span key={l} className={`up ${v?"up-y":"up-n"}`}>{v?"✓":"✗"} {l}</span>
                      ))}
                    </div>
                    <div className="umc-tabs">
                      <span className="umt-lbl">Tabs:</span>
                      {r.tabs.map(t=><span key={t} className="umt-chip">{t}</span>)}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add user card */}
            <div className="um-add-card" onClick={openNew}>
              <div className="um-add-icon">+</div>
              <div className="um-add-lbl">Add New User</div>
            </div>
          </div>

          {/* Permissions matrix */}
          <div className="um-matrix">
            <div className="section-hdr">Permissions Matrix</div>
            <table className="tbl">
              <thead><tr><th>Role</th><th>Users</th><th>Create</th><th>Edit</th><th>Delete</th><th>Status</th><th>QC</th><th>Finance</th><th>Manage Users</th></tr></thead>
              <tbody>
                {Object.values(ROLES).map(r => {
                  const p = r.perms;
                  const uc = users.filter(u=>u.role===r.id).length;
                  const chk = v => <span style={{color:v?"#4ade80":"#f8717166",fontWeight:700}}>{v?"✓":"✗"}</span>;
                  return (
                    <tr key={r.id}>
                      <td><span style={{color:r.color,fontWeight:700}}>{r.icon} {r.label}</span></td>
                      <td style={{textAlign:"center"}}>{uc}</td>
                      <td style={{textAlign:"center"}}>{chk(p.create)}</td>
                      <td style={{textAlign:"center"}}>{chk(p.edit)}</td>
                      <td style={{textAlign:"center"}}>{chk(p.delete)}</td>
                      <td style={{textAlign:"center"}}>{chk(p.status)}</td>
                      <td style={{textAlign:"center"}}>{chk(p.qc)}</td>
                      <td style={{textAlign:"center"}}>{chk(p.finance)}</td>
                      <td style={{textAlign:"center"}}>{chk(p.users)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── ADD / EDIT MODAL ── */}
      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal-box" style={{width:460}}>
            <div className="modal-hdr">
              <span>{users.find(u=>u.id===form.id) ? "Edit User" : "New User"}</span>
              <button className="modal-close" onClick={()=>setModal(false)}>×</button>
            </div>
            <div className="modal-body">

              {/* Avatar preview */}
              <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
                <div style={{
                  width:60,height:60,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
                  fontFamily:"'Inter',sans-serif",fontSize:20,fontWeight:800,
                  background: (ROLES[form.role]?.color||"#f59e0b")+"28",
                  color: ROLES[form.role]?.color||"#f59e0b",
                  border:`2px solid ${(ROLES[form.role]?.color||"#f59e0b")}55`,
                }}>
                  {form.initials || "?"}
                </div>
              </div>

              <MFld label="Full Name">
                <input value={form.name}
                  onChange={e=>{
                    const name = e.target.value;
                    const auto = autoInitials(name);
                    setForm(p=>({...p, name, initials: auto || p.initials}));
                  }}
                  placeholder="e.g. Juan dela Cruz"/>
              </MFld>

              <div className="form-2col">
                <MFld label="Initials (2 letters)">
                  <input value={form.initials} maxLength={2}
                    onChange={e=>setForm(p=>({...p,initials:e.target.value.toUpperCase()}))}
                    placeholder="e.g. JD"/>
                </MFld>
                <MFld label="Role">
                  <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value,asset:null}))}>
                    {Object.values(ROLES).map(r=>(
                      <option key={r.id} value={r.id}>{r.icon} {r.label}</option>
                    ))}
                  </select>
                </MFld>
              </div>

              <MFld label="Assigned Asset (optional)">
                <select value={form.asset||""} onChange={e=>setForm(p=>({...p,asset:e.target.value||null}))}>
                  <option value="">— None —</option>
                  {ASSET_GROUPS.map(g=>(
                    <optgroup key={g.id} label={g.label}>
                      {g.assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </MFld>

              <MFld label="4-Digit PIN">
                <div style={{position:"relative"}}>
                  <input
                    type={showPin?"text":"password"}
                    value={form.pin}
                    maxLength={4}
                    onChange={e=>{ setForm(p=>({...p,pin:e.target.value.replace(/\D/g,"")})); setPinErr(""); }}
                    placeholder="Enter 4-digit PIN"
                    style={{letterSpacing:showPin?"2px":"6px",paddingRight:40}}/>
                  <button onClick={()=>setShowPin(p=>!p)}
                    style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#8b949e",cursor:"pointer",fontSize:14}}>
                    {showPin?"🙈":"👁"}
                  </button>
                </div>
              </MFld>

              {pinErr && <div style={{color:"#f87171",fontSize:11,marginTop:-4}}>{pinErr}</div>}

              {/* Role permissions preview */}
              <div style={{background:"#0d1117",border:"1px solid #21262d",borderRadius:6,padding:"10px 12px"}}>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#8b949e",letterSpacing:2,textTransform:"uppercase",marginBottom:7}}>
                  {ROLES[form.role]?.icon} {ROLES[form.role]?.label} — Permissions Preview
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {[["Create",ROLES[form.role]?.perms.create],["Edit",ROLES[form.role]?.perms.edit],["Delete",ROLES[form.role]?.perms.delete],["Status",ROLES[form.role]?.perms.status],["QC",ROLES[form.role]?.perms.qc],["Finance",ROLES[form.role]?.perms.finance],["Users",ROLES[form.role]?.perms.users]].map(([l,v])=>(
                    <span key={l} className={`up ${v?"up-y":"up-n"}`}>{v?"✓":"✗"} {l}</span>
                  ))}
                </div>
              </div>

            </div>
            <div className="modal-ftr">
              {users.find(u=>u.id===form.id) && form.id !== currentUser.id
                ? <button className="btn-danger" onClick={()=>deleteUser(form.id)}>Delete User</button>
                : <div/>}
              <div style={{display:"flex",gap:8}}>
                <button className="btn-ghost" onClick={()=>setModal(false)}>Cancel</button>
                <button className="btn-primary" style={{"--rc":"#f59e0b"}} onClick={saveUser}>Save User</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── SMALL HELPERS ─────────────────────────────────────────────────────── */
function MFld({ label, children }) {
  return <div className="mfld"><label>{label}</label>{children}</div>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CSS
═══════════════════════════════════════════════════════════════════════════ */
const BASE = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0d1117; color: #d1d5db; font-family: 'Inter', system-ui, sans-serif; font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #161b22; }
  ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }

  /* UPTIME TAB */
  .ut-wrap { display:flex; flex-direction:column; flex:1; overflow:hidden; }
  .ut-topbar { display:flex; align-items:center; justify-content:space-between; padding:10px 16px; background:#161b22; border-bottom:1px solid #21262d; gap:12px; flex-wrap:wrap; }
  .ut-topbar-left { display:flex; align-items:center; gap:20px; flex-wrap:wrap; }
  .ut-topbar-right { display:flex; align-items:center; gap:8px; }
  .ut-plant-kpis { display:flex; gap:16px; }
  .ut-kpi { display:flex; flex-direction:column; align-items:center; }
  .ut-kpi-v { font-family:'Inter',sans-serif;font-weight:700; font-size:18px; font-weight:800; line-height:1; }
  .ut-kpi-l { font-size:12px; color:#8b949e; text-transform:uppercase; letter-spacing:1px; margin-top:2px; }
  .ut-select { background:#0d1117; border:1px solid #30363d; border-radius:5px; padding:6px 10px; color:#c9d1d9; font-family:'Inter',sans-serif; font-size:12px; outline:none; cursor:pointer; }
  .ut-body { display:grid; grid-template-columns:220px 1fr; flex:1; overflow:hidden; }
  .ut-cards-col { overflow-y:auto; border-right:1px solid #21262d; background:#0d1117; }
  .ut-table-col { overflow:hidden; display:flex; flex-direction:column; }
  .ut-table-scroll { overflow:auto; flex:1; }
  .ut-col-hdr { padding:8px 12px; font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:2px; color:#8b949e; text-transform:uppercase; border-bottom:1px solid #21262d; background:#161b22; }
  .ut-asset-card { padding:10px 12px; border-bottom:1px solid #21262d; border-left:3px solid transparent; cursor:pointer; transition:all .15s; background:#0d1117; }
  .ut-asset-card:hover { background:#161b22; }
  .ut-asset-card.ut-dimmed { opacity:.4; }
  .utac-top { display:flex; align-items:center; gap:6px; margin-bottom:6px; }
  .utac-name { font-size:12px; color:#f0f6fc; font-weight:600; flex:1; }
  .utac-pct { font-family:'Inter',sans-serif;font-weight:700; font-size:14px; font-weight:800; }
  .utac-bar-track { display:flex; height:5px; border-radius:3px; overflow:hidden; background:#21262d; margin-bottom:5px; }
  .utac-bar-up { transition:width .4s ease; }
  .utac-bar-down { }
  .utac-meta { display:flex; gap:8px; font-size:12px; flex-wrap:wrap; }
  .ut-inline-bar { display:inline-block; width:50px; height:6px; background:#21262d; border-radius:3px; overflow:hidden; vertical-align:middle; }
  .ut-slider-labels { display:flex; justify-content:space-between; font-size:12px; margin-top:3px; }
  .ut-preview-bar { display:flex; height:10px; border-radius:4px; overflow:hidden; margin:6px 0 3px; background:#21262d; }
  .ut-preview-labels { display:flex; gap:14px; font-size:11px; margin-bottom:4px; font-weight:600; }

  /* SETUP BANNER */
  .setup-banner { display:flex; align-items:center; gap:12px; padding:10px 22px; background:#f59e0b0e; border-bottom:1px solid #f59e0b33; flex-wrap:wrap; }
  .sb-icon { font-size:20px; flex-shrink:0; }
  .sb-text { font-size:12px; color:#c9d1d9; flex:1; line-height:1.5; }
  .sb-text strong { color:#f59e0b; }
  .sb-close { font-size:11px; font-weight:700; background:#f59e0b18; color:#f59e0b; border:1px solid #f59e0b44; padding:5px 11px; border-radius:5px; cursor:pointer; white-space:nowrap; }
  .sb-close:hover { background:#f59e0b28; }

  @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
`;

const LOGIN_CSS = `
  .login-wrap { display: grid; grid-template-columns: 340px 1fr; min-height: 100vh; }
  .login-left { background: #0d1117; border-right: 1px solid #21262d; padding: 40px 30px; display: flex; flex-direction: column; gap: 36px; }
  .login-brand {}
  .login-chip { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 4px; color: #f59e0b; background: #f59e0b14; border: 1px solid #f59e0b33; padding: 4px 10px; border-radius: 3px; display: inline-block; margin-bottom: 16px; }
  .login-h1 { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 30px; font-weight: 800; color: #f0f6fc; line-height: 1.15; margin-bottom: 10px; }
  .login-tagline { font-size: 13px; color: #8b949e; line-height: 1.6; }
  .login-roles { display: flex; flex-direction: column; gap: 10px; }
  .login-role-row { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 8px; border: 1px solid; background: #161b2288; }
  .lr-icon { font-size: 20px; margin-top: 1px; flex-shrink: 0; }
  .lr-name { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 13px; font-weight: 700; margin-bottom: 2px; }
  .lr-desc { font-size: 11px; color: #8b949e; line-height: 1.4; }
  .login-right { background: #161b22; display: flex; align-items: center; justify-content: center; padding: 40px; overflow-y: auto; }
  .user-select { width: 100%; max-width: 600px; }
  .us-title { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 26px; font-weight: 800; color: #f0f6fc; margin-bottom: 4px; }
  .us-sub { font-size: 13px; color: #8b949e; margin-bottom: 28px; }
  .role-section { margin-bottom: 24px; }
  .rs-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px; }
  .rs-users { display: flex; flex-wrap: wrap; gap: 10px; }
  .user-tile { display: flex; flex-direction: column; align-items: center; gap: 9px; padding: 18px 14px; background: #0d1117; border: 1px solid #21262d; border-radius: 10px; cursor: pointer; min-width: 120px; transition: all .15s; }
  .user-tile:hover { border-color: var(--rc, #f59e0b); background: color-mix(in srgb, var(--rc, #f59e0b) 6%, #0d1117); transform: translateY(-2px); box-shadow: 0 4px 20px rgba(0,0,0,.4); }
  .ut-av { width: 46px; height: 46px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Inter', sans-serif; font-weight: 800; font-size: 14px; font-weight: 800; border: 2px solid; }
  .ut-name { font-size: 12px; font-weight: 600; color: #f0f6fc; text-align: center; }
  /* PIN */
  .pin-wrap { max-width: 300px; width: 100%; text-align: center; animation: fadeUp .2s ease; }
  .pin-wrap.shake { animation: shake .4s ease; }
  .back-btn { background: none; border: 1px solid #30363d; color: #8b949e; padding: 5px 13px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-bottom: 24px; transition: all .15s; }
  .back-btn:hover { border-color: #8b949e; color: #c9d1d9; }
  .pin-av { width: 70px; height: 70px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Inter', sans-serif; font-weight: 800; font-size: 20px; font-weight: 800; margin: 0 auto 12px; border: 2px solid; }
  .pin-name { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 20px; font-weight: 800; color: #f0f6fc; margin-bottom: 3px; }
  .pin-role { font-size: 12px; font-weight: 600; margin-bottom: 20px; }
  .pin-dots { display: flex; justify-content: center; gap: 12px; margin-bottom: 8px; }
  .pin-dot { width: 13px; height: 13px; border-radius: 50%; border: 2px solid; transition: all .15s; }
  .pin-hint { font-size: 11px; color: #484f58; margin-bottom: 16px; }
  .numpad { display: grid; grid-template-columns: repeat(3, 68px); gap: 9px; justify-content: center; }
  .numkey { width: 68px; height: 68px; border-radius: 10px; border: 1px solid #30363d; background: #0d1117; color: #f0f6fc; font-family: 'Inter', sans-serif; font-weight: 800; font-size: 22px; font-weight: 700; cursor: pointer; transition: all .1s; }
  .numkey:hover:not(.ghost) { background: color-mix(in srgb, var(--rc) 12%, #0d1117); border-color: color-mix(in srgb, var(--rc) 40%, #30363d); }
  .numkey.ghost { background: transparent; border-color: transparent; cursor: default; pointer-events: none; }
`;

const APP_CSS = `
  .app { display: flex; flex-direction: column; min-height: 100vh; }
  /* TOPBAR */
  .topbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 22px; background: #161b22; border-bottom: 1px solid #21262d; flex-wrap: wrap; gap: 8px; }
  .tb-left { display: flex; align-items: center; gap: 12px; }
  .tb-chip { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 3px; color: #f59e0b; background: #f59e0b14; border: 1px solid #f59e0b33; padding: 4px 9px; border-radius: 3px; white-space: nowrap; }
  .tb-title { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 19px; font-weight: 800; color: #f0f6fc; line-height: 1; }
  .tb-sub { font-size: 12px; color: #9ca3af; margin-top: 3px; font-weight: 400; }
  .tb-right { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
  .tb-clock { font-family: 'JetBrains Mono', monospace; font-size: 18px; color: #f0f6fc; letter-spacing: 1px; }
  .user-badge { display: flex; align-items: center; gap: 9px; padding: 5px 11px; border-radius: 8px; border: 1px solid; }
  .ub-av { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Inter', sans-serif; font-weight: 800; font-size: 12px; font-weight: 800; }
  .ub-name { font-size: 13px; font-weight: 600; color: #f9fafb; line-height: 1.2; }
  .ub-role { font-size: 10px; font-weight: 600; margin-top: 1px; }
  .btn-primary { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 12px; font-weight: 700; letter-spacing: .5px; background: var(--rc, #f59e0b); color: #000; border: none; padding: 7px 15px; border-radius: 6px; cursor: pointer; transition: filter .15s; white-space: nowrap; }
  .btn-primary:hover { filter: brightness(1.15); }
  .btn-ghost { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; background: transparent; color: #8b949e; border: 1px solid #30363d; padding: 6px 13px; border-radius: 6px; cursor: pointer; transition: all .15s; white-space: nowrap; }
  .btn-ghost:hover, .btn-ghost.logout:hover { border-color: #f87171; color: #f87171; }
  .btn-ghost:not(.logout):hover { border-color: #8b949e; color: #c9d1d9; }
  .btn-cycle { font-size: 12px; font-weight: 600; background: #3b82f618; color: #60a5fa; border: 1px solid #3b82f633; padding: 5px 11px; border-radius: 5px; cursor: pointer; transition: background .15s; }
  .btn-cycle:hover { background: #3b82f628; }
  .btn-danger { font-size: 12px; font-weight: 600; background: transparent; color: #f87171; border: 1px solid #ef444433; padding: 5px 11px; border-radius: 5px; cursor: pointer; }
  .btn-danger:hover { background: #ef444418; }
  .sm { padding: 4px 9px; font-size: 11px; }
  /* ROLE BANNER */
  .role-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 22px; border-bottom: 1px solid; flex-wrap: wrap; }
  .rb-left { display: flex; align-items: center; gap: 10px; }
  .rb-icon { font-size: 20px; }
  .rb-title { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 13px; font-weight: 800; letter-spacing: .3px; }
  .rb-desc { font-size: 12px; color: #9ca3af; margin-top: 2px; font-weight: 400; }
  .rb-perms { display: flex; gap: 5px; flex-wrap: wrap; }
  .rb-perm { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500; padding: 2px 7px; border-radius: 3px; }
  .rb-perm.on  { background: #22c55e14; color: #4ade80; }
  .rb-perm.off { background: #ef444414; color: #f8717155; }
  /* STATS */
  .stat-row { display: grid; grid-template-columns: repeat(5,1fr); border-bottom: 1px solid #21262d; }
  .stat-card { padding: 12px 16px; border-right: 1px solid #21262d; display: flex; align-items: center; gap: 10px; animation: fadeUp .3s ease both; }
  .stat-card:last-child { border-right: none; }
  .sc-icon { font-size: 18px; }
  .sc-val { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 24px; font-weight: 800; line-height: 1; }
  .sc-label { font-size: 10px; color: #8b949e; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
  /* NAV */
  .nav-bar { display: flex; align-items: center; gap: 14px; padding: 8px 22px; background: #161b22; border-bottom: 1px solid #21262d; flex-wrap: wrap; }
  .tab-list { display: flex; gap: 3px; }
  .tab-btn { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 12px; font-weight: 700; padding: 5px 13px; border-radius: 5px; border: 1px solid #30363d; background: transparent; color: #8b949e; cursor: pointer; transition: all .15s; white-space: nowrap; }
  .tab-btn.active { background: color-mix(in srgb, var(--rc,#f59e0b) 14%, transparent); border-color: color-mix(in srgb, var(--rc,#f59e0b) 40%, transparent); color: var(--rc,#f59e0b); }
  .tab-btn:hover:not(.active) { background: #21262d; border-color: #484f58; color: #c9d1d9; }
  .filter-set { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .f-lbl { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #8b949e; text-transform: uppercase; letter-spacing: 1px; }
  .chip { font-size: 12px; padding: 4px 10px; border-radius: 20px; border: 1px solid #30363d; background: transparent; color: #8b949e; cursor: pointer; transition: all .15s; white-space: nowrap; }
  .chip:hover { border-color: #8b949e; color: #c9d1d9; }
  .chip.active { background: color-mix(in srgb,var(--rc,#f59e0b) 14%,transparent); border-color: color-mix(in srgb,var(--rc,#f59e0b) 40%,transparent); color: var(--rc,#f59e0b); }
  /* BODY */
  .body-wrap { display: grid; grid-template-columns: 1fr 265px; flex: 1; min-height: 0; }
  .content { overflow: hidden; border-right: 1px solid #21262d; display: flex; flex-direction: column; }
  .section-hdr { padding: 12px 16px; font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; color: #9ca3af; text-transform: uppercase; border-bottom: 1px solid #21262d; background: #161b22; }
  /* OVERVIEW */
  .overview-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 14px; padding: 16px; overflow-y: auto; flex: 1; }
  .ov-group { background: #161b22; border: 1px solid #21262d; border-radius: 8px; overflow: hidden; }
  .ov-full { grid-column: 1/-1; }
  .ov-group-hdr { padding: 9px 13px; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 2px; color: #8b949e; border-bottom: 1px solid #21262d; background: #0d1117; }
  .ov-asset-list { display: flex; flex-direction: column; gap: 1px; padding: 6px; }
  .ov-asset { border: 1px solid; border-radius: 6px; overflow: hidden; }
  .oa-top { display: flex; align-items: center; gap: 7px; padding: 7px 10px; }
  .oa-name { font-size: 12px; font-weight: 600; color: #f0f6fc; flex: 1; }
  .oa-status { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 1px; }
  .oa-body { padding: 5px 10px 8px; }
  .oa-job { font-size: 12px; color: #c9d1d9; margin-bottom: 3px; }
  .oa-meta { font-size: 11px; color: #8b949e; }
  .grade-strip { display: flex; gap: 10px; padding: 10px; flex-wrap: wrap; }
  .grade-tile { background: #0d1117; border: 1px solid #21262d; border-radius: 6px; padding: 10px 14px; text-align: center; }
  .gt-grade { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 18px; font-weight: 800; color: #f59e0b; }
  .gt-vol { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 14px; font-weight: 700; color: #f0f6fc; margin-top: 3px; }
  .gt-count { font-size: 10px; color: #8b949e; margin-top: 2px; }
  /* GANTT */
  .gantt-wrap { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
  .gantt-time-hdr { display: flex; background: #161b22; border-bottom: 1px solid #21262d; flex-shrink: 0; }
  .g-asset-col { width: 140px; flex-shrink: 0; padding: 6px 12px; font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #8b949e; letter-spacing: 2px; }
  .g-hr { flex: 1; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #8b949e; padding: 6px 0; border-left: 1px solid #21262d; }
  .gantt-body { overflow-y: auto; flex: 1; }
  .g-grp-row { padding: 5px 12px; background: #0d1117; border-bottom: 1px solid #21262d; font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 500; letter-spacing: 2px; color: #8b949e; text-transform: uppercase; }
  .g-row { display: flex; align-items: center; border-bottom: 1px solid #21262d; min-height: 38px; }
  .g-asset-cell { width: 140px; flex-shrink: 0; display: flex; align-items: center; gap: 6px; padding: 0 12px; }
  .g-asset-name { font-size: 12px; color: #e5e7eb; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .g-track { flex: 1; height: 38px; position: relative; overflow: hidden; }
  .g-col { position: absolute; top: 0; bottom: 0; width: 1px; background: #21262d; pointer-events: none; }
  .g-now { position: absolute; top: 0; bottom: 0; width: 2px; background: #f97316; z-index: 4; pointer-events: none; }
  .g-now-lbl { position: absolute; top: 2px; left: 3px; font-family: 'JetBrains Mono', monospace; font-size: 7px; color: #f97316; letter-spacing: 1px; }
  .g-bar { position: absolute; top: 4px; height: 30px; border-radius: 4px; border: 1px solid; cursor: grab; display: flex; align-items: center; gap: 4px; padding: 0 8px; font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; transition: filter .1s, top .1s; z-index: 2; }
  .g-bar:hover { filter: brightness(1.3); top: 2px; z-index: 10; }
  .g-sel { outline: 2px solid #f59e0b88; top: 2px; z-index: 10; }
  .g-maint { background-image: repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(255,255,255,.04) 4px,rgba(255,255,255,.04) 8px) !important; }
  .g-bar-lbl { flex: 1; overflow: hidden; text-overflow: ellipsis; }
  .g-bar-vol { font-family: 'JetBrains Mono', monospace; font-size: 9px; opacity: .8; flex-shrink: 0; }
  /* TABLE */
  .table-wrap { overflow: auto; flex: 1; }
  .tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
  .tbl thead tr { background: #161b22; border-bottom: 2px solid #21262d; position: sticky; top: 0; z-index: 2; }
  .tbl th { padding: 8px 10px; font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 500; letter-spacing: 2px; color: #8b949e; text-align: left; white-space: nowrap; text-transform: uppercase; }
  .tbl td { padding: 9px 12px; border-bottom: 1px solid #21262d; vertical-align: middle; font-size:13px; line-height:1.5; }
  .tbl tbody tr { cursor: pointer; transition: background .1s; }
  .tbl tbody tr:hover { background: #161b22; }
  .tr-sel { background: #f59e0b08 !important; outline: 1px solid #f59e0b22; }
  .td-trunc { max-width: 130px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tbl-empty { padding: 36px; text-align: center; color: #8b949e; font-size: 13px; }
  /* BADGES */
  .g-badge { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; color: #f59e0b; background: #f59e0b14; padding: 2px 6px; border-radius: 3px; }
  .g-lg { font-size: 14px; padding: 3px 9px; }
  .p-badge { font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: 500; }
  .s-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 600; padding: 3px 7px; border-radius: 3px; border: 1px solid; white-space: nowrap; }
  .s-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .row-btn { background: none; border: 1px solid #30363d; color: #8b949e; padding: 2px 7px; border-radius: 4px; cursor: pointer; font-size: 12px; }
  .row-btn:hover { border-color: #8b949e; color: #c9d1d9; }
  /* QC */
  .qc-layout { display: grid; grid-template-columns: 1fr 200px; flex: 1; overflow: hidden; }
  .qc-main { overflow: auto; border-right: 1px solid #21262d; }
  .qc-sidebar { overflow-y: auto; padding: 12px; background: #0d1117; }
  .grade-card { background: #161b22; border: 1px solid #21262d; border-radius: 7px; padding: 11px 13px; margin-bottom: 8px; }
  .gc-grade { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 18px; font-weight: 800; color: #f59e0b; }
  .gc-vol { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 16px; font-weight: 700; color: #f0f6fc; margin-top: 3px; }
  .gc-vol span { font-size: 11px; color: #8b949e; }
  .gc-count { font-size: 11px; color: #8b949e; margin-top: 2px; }
  .gc-bar-wrap { height: 3px; background: #21262d; border-radius: 2px; margin-top: 8px; overflow: hidden; }
  .gc-bar { height: 100%; border-radius: 2px; transition: width .4s ease; }
  /* FINANCE */
  .finance-footer { display: flex; gap: 0; border-top: 2px solid #21262d; background: #161b22; }
  .ff-item { flex: 1; padding: 14px 18px; border-right: 1px solid #21262d; }
  .ff-item:last-child { border-right: none; }
  .ff-lbl { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #8b949e; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px; }
  .ff-val { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 22px; font-weight: 800; }
  /* SIDE DETAIL */
  .side-detail { display: flex; flex-direction: column; overflow-y: auto; background: #0d1117; }
  .sd-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; padding: 32px 16px; gap: 6px; }
  .sd-empty-icon { font-size: 28px; opacity: .1; }
  .sd-empty-txt { font-size: 13px; color: #8b949e; }
  .sd-empty-sub { font-size: 11px; color: #484f58; }
  .sd-body { padding: 14px; border-bottom: 1px solid #21262d; animation: fadeUp .2s ease; }
  .sd-type { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 2px; color: #8b949e; text-transform: uppercase; margin-bottom: 5px; }
  .sd-site { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 16px; font-weight: 800; color: #f0f6fc; line-height: 1.2; margin-bottom: 8px; }
  .sd-asset-row { display: flex; align-items: center; gap: 6px; margin-bottom: 11px; }
  .sd-asset { font-size: 12px; color: #c9d1d9; font-weight: 600; }
  .sd-grp { font-size: 10px; color: #8b949e; }
  .sd-divider { height: 1px; background: #21262d; margin-bottom: 11px; }
  .kv-list { display: flex; flex-direction: column; gap: 6px; }
  .kv-row { display: flex; justify-content: space-between; align-items: center; }
  .kv-k { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #8b949e; text-transform: uppercase; letter-spacing: 1px; }
  .kv-v { font-size: 13px; color: #e5e7eb; font-weight: 500; }
  .sd-notes { margin-top: 10px; padding: 8px 10px; background: #161b22; border: 1px solid #21262d; border-radius: 5px; }
  .sdn-lbl { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #8b949e; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 3px; }
  .sdn-txt { font-size: 11px; color: #8b949e; line-height: 1.6; }
  .sd-actions { display: flex; gap: 5px; margin-top: 11px; flex-wrap: wrap; }
  .read-only-tag { margin-top: 11px; font-size: 10px; color: #8b949e; background: #21262d; padding: 5px 10px; border-radius: 4px; text-align: center; font-family: 'JetBrains Mono', monospace; letter-spacing: 1px; }
  /* FLEET */
  .fleet-summary { padding: 12px; }
  .fs-title { font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 500; letter-spacing: 2px; color: #8b949e; text-transform: uppercase; margin-bottom: 10px; }
  .fs-group { margin-bottom: 10px; }
  .fsg-lbl { font-size: 10px; font-weight: 600; color: #8b949e; margin-bottom: 4px; }
  .fsa-row { display: flex; align-items: center; gap: 5px; padding: 2px 0; }
  .fsa-name { font-size: 11px; color: #c9d1d9; flex: 1; }
  .fsa-tags { display: flex; gap: 3px; }
  .tag { font-family: 'JetBrains Mono', monospace; font-size: 9px; padding: 1px 5px; border-radius: 3px; font-weight: 500; }
  .tag.act { background: #f9731622; color: #f97316; }
  .tag.sch { background: #3b82f622; color: #60a5fa; }
  .tag.idle { background: #21262d; color: #484f58; }
  /* DOTS */
  .dot { display: inline-block; border-radius: 50%; flex-shrink: 0; width: 8px; height: 8px; }
  .dot.sm { width: 6px; height: 6px; }
  .dot.lg { width: 10px; height: 10px; }
  /* MODAL */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.78); backdrop-filter: blur(6px); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .modal-box { background: #161b22; border: 1px solid #30363d; border-radius: 11px; width: 510px; max-height: 88vh; display: flex; flex-direction: column; box-shadow: 0 30px 80px #000d; animation: fadeUp .2s ease; }
  .modal-hdr { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #21262d; font-family: 'Inter', sans-serif; font-weight: 800; font-size: 17px; font-weight: 800; color: #f0f6fc; }
  .modal-close { background: none; border: none; color: #8b949e; font-size: 20px; cursor: pointer; line-height: 1; }
  .modal-body { padding: 16px 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
  .modal-ftr { display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; border-top: 1px solid #21262d; }
  .mfld { display: flex; flex-direction: column; gap: 4px; }
  .mfld label { font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; color: #8b949e; }
  .mfld input, .mfld select, .mfld textarea { background: #0d1117; border: 1px solid #374151; border-radius: 6px; padding: 8px 12px; color: #e5e7eb; font-family: 'Inter', sans-serif; font-size: 13px; outline: none; width: 100%; transition: border-color .15s; }
  .mfld input[type=range] { padding: 4px 0; accent-color: #f59e0b; cursor: pointer; }
  .mfld input:focus, .mfld select:focus, .mfld textarea:focus { border-color: #f59e0b55; }
  .mfld textarea { resize: vertical; min-height: 56px; }
  .mfld select option, .mfld select optgroup { background: #161b22; }
  .form-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  /* USER MGMT */
  .um-edit-btn { background:none; border:1px solid #30363d; color:#8b949e; padding:3px 8px; border-radius:4px; cursor:pointer; font-size:13px; transition:all .15s; }
  .um-edit-btn:hover { border-color:#f59e0b; color:#f59e0b; }
  .um-add-card { background:#161b22; border:1px dashed #30363d; border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:24px; cursor:pointer; transition:all .15s; min-height:120px; }
  .um-add-card:hover { border-color:#f59e0b55; background:#f59e0b0a; }
  .um-add-icon { font-size:28px; color:#30363d; font-weight:300; line-height:1; }
  .um-add-card:hover .um-add-icon { color:#f59e0b; }
  .um-add-lbl { font-size:12px; color:#8b949e; font-weight:600; }
  .um-add-card:hover .um-add-lbl { color:#f59e0b; }
  .um-layout { display: flex; flex-direction: column; gap: 20px; padding: 20px 22px; overflow-y: auto; flex: 1; }
  .um-cards { display: grid; grid-template-columns: repeat(auto-fill,minmax(260px,1fr)); gap: 12px; }
  .um-card { background: #161b22; border: 1px solid; border-radius: 10px; overflow: hidden; }
  .umc-top { display: flex; align-items: center; gap: 11px; padding: 13px 14px; }
  .umc-av { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Inter', sans-serif; font-weight: 800; font-size: 14px; font-weight: 800; flex-shrink: 0; border: 2px solid; }
  .umc-name { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 14px; font-weight: 700; color: #f0f6fc; }
  .umc-role { font-size: 11px; font-weight: 600; margin-top: 2px; }
  .umc-asset { font-size: 10px; color: #8b949e; margin-top: 1px; }
  .umc-body { padding: 11px 14px; }
  .umc-desc { font-size: 12px; color: #8b949e; margin-bottom: 10px; line-height: 1.5; }
  .umc-perms { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 9px; }
  .up { font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 500; padding: 2px 7px; border-radius: 3px; }
  .up-y { background: #22c55e14; color: #4ade80; }
  .up-n { background: #ef444414; color: #f8717155; }
  .umc-tabs { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
  .umt-lbl { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #8b949e; letter-spacing: 1px; }
  .umt-chip { font-size: 10px; background: #21262d; color: #8b949e; padding: 2px 6px; border-radius: 3px; }
  .um-matrix { background: #161b22; border: 1px solid #21262d; border-radius: 8px; overflow: hidden; }
`;
