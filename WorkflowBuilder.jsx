import { useState, useRef, useCallback, useEffect, useMemo, memo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/* ============================================================
   DESIGN TOKENS
============================================================ */
const DARK_TOKENS = {
  bg0: "#09090c", bg1: "#111116", bg2: "#17171d", bg3: "#1e1e26",
  bg4: "#26262f", bg5: "#2e2e38",
  b0: "rgba(255,255,255,0.05)", b1: "rgba(255,255,255,0.09)", b2: "rgba(255,255,255,0.15)",
  t1: "#edeae4", t2: "#8f8d9e", t3: "#4e4c5c",
  amber: "#f5a623", amberDim: "rgba(245,166,35,0.13)", amberGlow: "rgba(245,166,35,0.07)",
  green: "#3dd68c", greenDim: "rgba(61,214,140,0.12)",
  blue: "#4f8ef7", blueDim: "rgba(79,142,247,0.12)",
  rose: "#f25f5c", roseDim: "rgba(242,95,92,0.12)",
  purple: "#a78bfa", purpleDim: "rgba(167,139,250,0.12)",
  teal: "#2ca5e0", tealDim: "rgba(44,165,224,0.12)",
  wa: "#25d366", waDim: "rgba(37,211,102,0.12)",
};

const LIGHT_TOKENS = {
  bg0: "#f4f7fb", bg1: "#eef2f8", bg2: "#ffffff", bg3: "#f5f8ff",
  bg4: "#dfe7f2", bg5: "#cbd7e4",
  b0: "rgba(15,23,42,0.06)", b1: "rgba(15,23,42,0.12)", b2: "rgba(15,23,42,0.14)",
  t1: "#10203a", t2: "#42506a", t3: "#6b7a96",
  amber: "#d97706", amberDim: "rgba(217,119,6,0.14)", amberGlow: "rgba(217,119,6,0.08)",
  green: "#16a34a", greenDim: "rgba(22,163,74,0.14)",
  blue: "#2563eb", blueDim: "rgba(37,99,235,0.16)",
  rose: "#be123c", roseDim: "rgba(190,18,60,0.14)",
  purple: "#7c3aed", purpleDim: "rgba(124,58,237,0.14)",
  teal: "#0ea5e9", tealDim: "rgba(14,165,233,0.14)",
  wa: "#15803d", waDim: "rgba(21,128,61,0.14)",
};

const THEME_KEY = "flowmatic:theme:v1";
const WORKFLOWS_KEY = "flowmatic:saved-workflows:v1";
const STORAGE_KEY = "flowmatic:workflow:v1";

function getInitialThemeMode() {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return "dark";
}

const initialThemeMode = getInitialThemeMode();
const T = { ...(initialThemeMode === "light" ? LIGHT_TOKENS : DARK_TOKENS) };

const SAMPLE_WORKFLOWS = [
  { id:"wf-1", name:"Welcome Journey", status:"Running", contacts:"1,284", lastRun:"2m ago", savedAt: Date.now() - 1000 * 60 * 40, activeSince:"08:24 AM" },
  { id:"wf-2", name:"Reactivation Flow", status:"Running", contacts:"846", lastRun:"6m ago", savedAt: Date.now() - 1000 * 60 * 90, activeSince:"07:48 AM" },
  { id:"wf-3", name:"Onboarding Sequence", status:"Paused", contacts:"202", lastRun:"1h ago", savedAt: Date.now() - 1000 * 60 * 120, activeSince:"—" },
];

/* ============================================================
   NODE DEFINITIONS
============================================================ */
const NODE_DEFS = [
  // Triggers
  { key:"form_submit",  type:"trigger",   label:"Form Submitted",     icon:"📝", sub:"Signup / lead form",       cat:"Triggers" },
  { key:"tag_added",    type:"trigger",   label:"Tag Added",           icon:"🏷",  sub:"Contact tagged",           cat:"Triggers" },
  { key:"purchase",     type:"trigger",   label:"Purchase Made",       icon:"🛒", sub:"eCommerce order event",    cat:"Triggers" },
  { key:"date_trigger", type:"trigger",   label:"Date / Anniversary",  icon:"📅", sub:"Birthday or anniversary",  cat:"Triggers" },
  { key:"api_trigger",  type:"trigger",   label:"API / Webhook In",    icon:"🔌", sub:"External HTTP trigger",    cat:"Triggers" },
  // Channels
  { key:"send_email",   type:"email",     label:"Send Email",          icon:"📧", sub:"SMTP · SendGrid · SES",    cat:"Channels" },
  { key:"whatsapp",     type:"whatsapp",  label:"WhatsApp",            icon:"💬", sub:"WhatsApp Business API",    cat:"Channels" },
  { key:"send_sms",     type:"sms",       label:"SMS",                 icon:"📱", sub:"Twilio · Vonage",          cat:"Channels" },
  { key:"telegram",     type:"telegram",  label:"Telegram",            icon:"✈️", sub:"Telegram Bot API",         cat:"Channels" },
  { key:"push",         type:"push",      label:"Push Notification",   icon:"🔔", sub:"FCM · APNs · WebPush",     cat:"Channels" },
  // Logic
  { key:"condition",    type:"condition", label:"If / Else",           icon:"🔀", sub:"Branch on condition",      cat:"Logic" },
  { key:"jump_condition", type:"condition", label:"Jump Condition",     icon:"🧭", sub:"Route to a target node",    cat:"Logic" },
  { key:"ab_split",     type:"split",     label:"A/B Split",           icon:"⚡", sub:"Random % split",           cat:"Logic" },
  { key:"wait_delay",   type:"delay",     label:"Wait / Delay",        icon:"⏳", sub:"Minutes · hours · days",   cat:"Logic" },
  { key:"wait_event",   type:"delay",     label:"Wait for Event",      icon:"👁",  sub:"Wait until open/click",   cat:"Logic" },
  // Actions
  { key:"update_tag",   type:"action",    label:"Update Tag",          icon:"🏷",  sub:"Add or remove tag",        cat:"Actions" },
  { key:"update_field", type:"action",    label:"Update Field",        icon:"✏️", sub:"Set contact property",     cat:"Actions" },
  { key:"webhook_out",  type:"action",    label:"Webhook / API Call",  icon:"🌐", sub:"HTTP POST · GET",          cat:"Actions" },
  { key:"move_list",    type:"action",    label:"Move to List",        icon:"📂", sub:"Change contact list",      cat:"Actions" },
  { key:"end",          type:"end",       label:"End Workflow",        icon:"⏹",  sub:"Exit the flow",            cat:"Actions" },
];

const TYPE_COLOR = (theme) => ({
  trigger:   theme.green,  email:    theme.blue,  whatsapp: theme.wa,
  sms:       theme.amber,  telegram: theme.teal,  push:     theme.purple,
  condition: theme.amber,  split:    theme.amber, delay:    theme.purple,
  action:    theme.blue,   end:      theme.rose,
});

const TYPE_DIM = (theme) => ({
  trigger:   theme.greenDim,  email:    theme.blueDim,  whatsapp: theme.waDim,
  sms:       theme.amberDim,  telegram: theme.tealDim,  push:     theme.purpleDim,
  condition: theme.amberDim,  split:    theme.amberDim, delay:    theme.purpleDim,
  action:    theme.blueDim,   end:      theme.roseDim,
});

const TYPE_LABEL = {
  trigger:"Trigger", email:"Email", whatsapp:"WhatsApp", sms:"SMS",
  telegram:"Telegram", push:"Push", condition:"Logic", split:"Logic",
  delay:"Delay", action:"Action", end:"End",
};

function defaultFields(key) {
  return ({
    form_submit:  { form:"Signup Form", list:"Main List" },
    tag_added:    { tag:"*any*" },
    purchase:     { minAmount:"0", currency:"USD" },
    date_trigger: { field:"birthday", offset:"0" },
    api_trigger:  { secret:"wh_secret_xyz" },
    send_email:   { from:"hello@co.co", fromName:"Team", subject:"Hello {{first_name}} 👋", template:"welcome_v3", timing:"Immediately" },
    whatsapp:     { template:"welcome_msg", body:"Hi {{first_name}}, welcome!", lang:"en_US" },
    send_sms:     { provider:"Twilio", from:"+1 800 000 0000", body:"Hi {{first_name}}! Check this: {{link}}" },
    telegram:     { bot:"@FlowmaticBot", body:"Hello {{first_name}} 👋", parse:"HTML" },
    push:         { platform:"Both (FCM + APNs)", title:"New message!", body:"Tap to view" },
    condition:    { condType:"Contact Field", field:"open_event", op:"exists", val:"true" },
    jump_condition: { field:"lead_score", op:"is greater than", val:"50", jumpTo:"" },
    ab_split:     { pctA:"50", pctB:"50" },
    wait_delay:   { dur:"2", unit:"Days", sendAt:"Immediately after delay", days:"Any day" },
    wait_event:   { event:"Email Opened", timeout:"3 Days" },
    update_tag:   { action:"Add Tag", tag:"new-tag" },
    update_field: { field:"lifecycle_stage", val:"onboarding" },
    webhook_out:  { method:"POST", url:"https://hooks.example.com/", headers:"{}", body:"{}" },
    move_list:    { list:"Newsletter" },
    end:          { action:"Exit workflow" },
  }[key]) || {};
}

/* ============================================================
   INITIAL WORKFLOW
============================================================ */
let _id = 1;
const nid = () => `n${_id++}`;

const INIT_NODES = [
  { id:"n1", key:"form_submit",  type:"trigger",   label:"Form Submitted",     icon:"📝", sub:"Signup / lead form",     x:340, y:40,   fields:{ form:"Welcome Signup Form", list:"Main List" } },
  { id:"n2", key:"send_email",   type:"email",     label:"Send Email",         icon:"📧", sub:"SMTP · SendGrid · SES",  x:340, y:200,  fields:{ from:"hello@co.co", fromName:"Team", subject:"Welcome to Flowmatic 👋", template:"welcome_v3", timing:"Immediately" } },
  { id:"n3", key:"wait_delay",   type:"delay",     label:"Wait / Delay",       icon:"⏳", sub:"Minutes · hours · days", x:340, y:370,  fields:{ dur:"2", unit:"Days", sendAt:"9:00 AM", days:"Weekdays only" } },
  { id:"n4", key:"condition",    type:"condition", label:"If / Else",          icon:"🔀", sub:"Branch on condition",    x:340, y:530,  fields:{ condType:"Contact Field", field:"email_opened", op:"equals", val:"true" } },
  { id:"n5", key:"send_email",   type:"email",     label:"Send Email",         icon:"📧", sub:"SMTP · SendGrid · SES",  x:100, y:720,  fields:{ from:"hello@co.co", fromName:"Team", subject:"Just checking in 👀", template:"followup_v2", timing:"Immediately" } },
  { id:"n6", key:"whatsapp",     type:"whatsapp",  label:"WhatsApp",           icon:"💬", sub:"WhatsApp Business API",  x:580, y:720,  fields:{ template:"engaged_thanks", body:"Thanks for opening!", lang:"en_US" } },
  { id:"n7", key:"update_tag",   type:"action",    label:"Update Tag",         icon:"🏷",  sub:"Add or remove tag",      x:100, y:900,  fields:{ action:"Add Tag", tag:"needs-nurture" } },
  { id:"n8", key:"update_tag",   type:"action",    label:"Update Tag",         icon:"🏷",  sub:"Add or remove tag",      x:580, y:900,  fields:{ action:"Add Tag", tag:"highly-engaged" } },
];
_id = 9;

const INIT_EDGES = [
  { id:"e1", from:"n1", to:"n2", port:"out" },
  { id:"e2", from:"n2", to:"n3", port:"out" },
  { id:"e3", from:"n3", to:"n4", port:"out" },
  { id:"e4", from:"n4", to:"n5", port:"yes" },
  { id:"e5", from:"n4", to:"n6", port:"no"  },
  { id:"e6", from:"n5", to:"n7", port:"out" },
  { id:"e7", from:"n6", to:"n8", port:"out" },
];

const NODE_W = 230;
const PORT_R = 7;
const SNAP_GRID = 10;
const MAX_HISTORY = 80;

/* ============================================================
   HELPERS
============================================================ */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function uid() { return `n${_id++}`; }
function eid() { return `e${Date.now()}${Math.random().toString(36).slice(2,6)}`; }

function getPortPos(node, port) {
  const h = nodeHeight(node);
  if (port === "in")  return { x: node.x + NODE_W / 2, y: node.y };
  if (port === "yes") return { x: node.x + NODE_W * 0.28, y: node.y + h };
  if (port === "no")  return { x: node.x + NODE_W * 0.72, y: node.y + h };
  return { x: node.x + NODE_W / 2, y: node.y + h };
}

function nodeHeight(node) {
  const base = 88;
  const bodyLines = nodeBodyLines(node);
  return base + bodyLines * 28;
}

function nodeBodyLines(node) {
  const f = node.fields || {};
  switch (node.type) {
    case "trigger":   return 2;
    case "email":     return 3;
    case "whatsapp":  return 2;
    case "sms":       return 2;
    case "telegram":  return 2;
    case "push":      return 2;
    case "condition": return 2;
    case "split":     return 1;
    case "delay":     return 2;
    case "action":    return 2;
    case "end":       return 1;
    default:          return 1;
  }
}

function curve(x1, y1, x2, y2) {
  const dy = Math.abs(y2 - y1);
  const cx = (x1 + x2) / 2;
  const bend = Math.max(50, dy * 0.5);
  return `M${x1},${y1} C${x1},${y1 + bend} ${x2},${y2 - bend} ${x2},${y2}`;
}

function cloneNodes(list) {
  return list.map(n => ({ ...n, fields: { ...(n.fields || {}) } }));
}

function cloneEdges(list) {
  return list.map(e => ({ ...e }));
}

/* ============================================================
   GLOBAL STYLES (injected once)
============================================================ */
function globalCss(theme) {
  return `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: ${theme.bg0}; color: ${theme.t1}; overflow: hidden; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${theme.bg5}; border-radius: 99px; }
  input, select, textarea { font-family: 'DM Sans', sans-serif; }
  input:focus, select:focus, textarea:focus { outline: none; }
  button { cursor: pointer; font-family: 'DM Sans', sans-serif; }
  @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes popIn  { from{opacity:0;transform:scale(0.88)} to{opacity:1;transform:scale(1)} }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.35} }
  @keyframes dash   { to { stroke-dashoffset: -20; } }
  @keyframes runPulse { 0% { box-shadow: 0 0 0 0 rgba(245,166,35,0.35); } 100% { box-shadow: 0 0 0 14px rgba(245,166,35,0); } }
  @keyframes flowDash { to { stroke-dashoffset: -18; } }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
  }
`;
}
/* ============================================================
   REUSABLE UI ATOMS
============================================================ */
const Btn = ({ children, onClick, variant = "ghost", size = "md", style: s = {}, disabled }) => {
  const base = {
    display:"inline-flex", alignItems:"center", gap:6, borderRadius:8,
    fontFamily:"'DM Sans',sans-serif", fontWeight:500, cursor: disabled?"not-allowed":"pointer",
    border:"none", whiteSpace:"nowrap", userSelect:"none", transition:"all 0.15s",
    opacity: disabled ? 0.5 : 1,
    padding: size === "sm" ? "5px 10px" : size === "lg" ? "10px 20px" : "7px 14px",
    fontSize: size === "sm" ? 11.5 : size === "lg" ? 14 : 12.5,
  };
  const variants = {
    ghost:     { background:"transparent", color:T.t2 },
    secondary: { background:T.bg4, border:`1px solid ${T.b1}`, color:T.t1 },
    primary:   { background:T.amber, color:"#000", fontWeight:600, boxShadow:`0 2px 10px rgba(245,166,35,0.3)` },
    danger:    { background:T.roseDim, border:`1px solid rgba(242,95,92,0.2)`, color:T.rose },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...variants[variant], ...s }}
      onMouseEnter={e => {
        if (disabled) return;
        if (variant==="ghost")     e.currentTarget.style.background = T.bg4, e.currentTarget.style.color = T.t1;
        if (variant==="secondary") e.currentTarget.style.background = T.bg5;
        if (variant==="primary")   e.currentTarget.style.transform = "translateY(-1px)", e.currentTarget.style.boxShadow = "0 4px 18px rgba(245,166,35,0.45)";
      }}
      onMouseLeave={e => {
        if (disabled) return;
        if (variant==="ghost")     e.currentTarget.style.background = "transparent", e.currentTarget.style.color = T.t2;
        if (variant==="secondary") e.currentTarget.style.background = T.bg4;
        if (variant==="primary")   e.currentTarget.style.transform = "translateY(0)", e.currentTarget.style.boxShadow = "0 2px 10px rgba(245,166,35,0.3)";
      }}
    >
      {children}
    </button>
  );
};

const Badge = ({ children, color }) => (
  <span style={{
    display:"inline-flex", alignItems:"center", gap:4,
    padding:"2px 7px", borderRadius:99, fontSize:10, fontWeight:700,
    background:`${color}22`, color, letterSpacing:"0.04em",
  }}>
    {children}
  </span>
);

const Label = ({ children }) => (
  <div style={{ fontSize:10.5, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:T.t3, marginBottom:6 }}>
    {children}
  </div>
);

const Input = ({ value, onChange, placeholder, type="text", rows }) => {
  const base = {
    width:"100%", background:T.bg3, border:`1px solid ${T.b1}`, borderRadius:8,
    padding:"7px 10px", color:T.t1, fontSize:12.5, resize:"none", transition:"border 0.15s",
  };
  return rows
    ? <textarea rows={rows} value={value} onChange={onChange} placeholder={placeholder} style={base} />
    : <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={base}
        onFocus={e => e.target.style.borderColor = T.amber}
        onBlur={e => e.target.style.borderColor = T.b1}
      />;
};

const Select = ({ value, onChange, options }) => (
  <select value={value} onChange={onChange} style={{
    width:"100%", background:T.bg3, border:`1px solid ${T.b1}`, borderRadius:8,
    padding:"7px 10px", color:T.t1, fontSize:12.5, cursor:"pointer", appearance:"none",
    backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%234e4c5c'/%3E%3C/svg%3E")`,
    backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center", paddingRight:28,
  }}
    onFocus={e => e.target.style.borderColor = T.amber}
    onBlur={e => e.target.style.borderColor = T.b1}
  >
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

const FG = ({ label, children }) => (
  <div style={{ marginBottom:12 }}>
    <Label>{label}</Label>
    {children}
  </div>
);

const Divider = () => <div style={{ borderTop:`1px solid ${T.b0}`, margin:"14px 0" }} />;

const SectionTitle = ({ children }) => (
  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:11.5, fontWeight:700, color:T.t2, marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
    {children}
  </div>
);

/* ============================================================
   TOAST
============================================================ */
function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, type="ok") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2800);
  }, []);
  return { toasts, push };
}

const ToastLayer = ({ toasts }) => (
  <div style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", zIndex:9999, display:"flex", flexDirection:"column", gap:8, pointerEvents:"none" }}>
    {toasts.map(t => (
      <div key={t.id} style={{
        background:T.bg3, border:`1px solid ${T.b2}`, borderRadius:12,
        padding:"9px 16px", fontSize:12.5, color:T.t1,
        display:"flex", alignItems:"center", gap:8,
        boxShadow:"0 4px 24px rgba(0,0,0,0.5)",
        animation:"fadeIn 0.25s ease both",
      }}>
        <span>{t.type==="ok" ? "✓" : "⚠"}</span>{t.msg}
      </div>
    ))}
  </div>
);

/* ============================================================
   NODE CARD
============================================================ */
const NodeCard = memo(function NodeCard({ node, selected, isExecuting, onSelect, onDelete, onDragStart, onPortMouseDown, onPortMouseUp, onAddAfter, onContextMenu }) {
  const color = TYPE_COLOR(T)[node.type] || T.t2;
  const dim   = TYPE_DIM(T)[node.type]   || T.bg4;
  const h     = nodeHeight(node);
  const isCondition = node.type === "condition";
  const isEnd       = node.type === "end";
  const isTrigger   = node.type === "trigger";
  const f = node.fields || {};

  const bodyRows = useMemo(() => {
    switch (node.type) {
      case "trigger":
        if (node.key==="form_submit")  return [["📋","Form",f.form],["📂","List",f.list]];
        if (node.key==="tag_added")    return [["🏷","Tag",f.tag]];
        if (node.key==="purchase")     return [["💰","Min $",f.minAmount],["💱","Currency",f.currency]];
        if (node.key==="date_trigger") return [["📅","Field",f.field],["↕","Offset",f.offset+" days"]];
        if (node.key==="api_trigger")  return [["🔑","Secret","••••••••"]];
        return [];
      case "email":    return [["✉️","Subject",trunc(f.subject,26)],["🎨","Template",f.template],["👤","From",f.fromName]];
      case "whatsapp": return [["📄","Template",f.template],["💬","Message",trunc(f.body,24)]];
      case "sms":      return [["📱","Provider",f.provider],["💬","Body",trunc(f.body,24)]];
      case "telegram": return [["✈️","Bot",f.bot],["💬","Message",trunc(f.body,24)]];
      case "push":     return [["🔔","Platform",f.platform],["📝","Title",trunc(f.title,22)]];
      case "condition":
        if (node.key === "jump_condition") return [["🧭","Jump if",`${f.field} ${f.op} ${f.val}`],["🎯","Target",f.jumpTo || "(none)"]];
        return [["❓","Check",f.field],["⚖","Op",f.op+" "+f.val]];
      case "split":    return [["A","Split A",f.pctA+"%"]];
      case "delay":
        if (node.key==="wait_delay")  return [["⏳","Wait",f.dur+" "+f.unit],["🕐","Send at",f.sendAt]];
        return [["👁","Event",f.event],["⏱","Timeout",f.timeout]];
      case "action":
        if (node.key==="update_tag")   return [["🏷","Action",f.action],["🔖","Tag",f.tag]];
        if (node.key==="update_field") return [["✏️","Field",f.field],["📌","Value",f.val]];
        if (node.key==="webhook_out")  return [["🌐","Method",f.method],["🔗","URL",trunc(f.url,22)]];
        if (node.key==="move_list")    return [["📂","List",f.list]];
        return [];
      case "end":      return [["⏹","Action","Exit workflow"]];
      default: return [];
    }
  }, [node]);

  const [hovered, setHovered] = useState(false);

  return (
    <div
      data-node="true"
      style={{
        position:"absolute", left:node.x, top:node.y, width:NODE_W,
        cursor:"move", userSelect:"none",
        filter: isExecuting ? `drop-shadow(0 0 14px ${T.amber}66)` : selected ? `drop-shadow(0 0 10px ${color}55)` : hovered ? "drop-shadow(0 4px 16px rgba(0,0,0,0.5))" : "none",
        transition:"filter 0.2s",
        animation:"popIn 0.2s ease both",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={e => { e.stopPropagation(); onSelect(); onDragStart(e); }}
      onClick={e => { e.stopPropagation(); onSelect(); }}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onContextMenu(e); }}
    >
      {/* Card */}
      <div style={{
        background:T.bg2, borderRadius:14,
        border:`1.5px solid ${isExecuting ? T.amber : selected ? color : hovered ? T.b2 : T.b1}`,
        overflow:"hidden", transition:"border-color 0.15s",
        boxShadow: isExecuting ? `0 0 0 3px ${T.amber}44` : selected ? `0 0 0 3px ${color}33` : "0 4px 20px rgba(0,0,0,0.4)",
      }}>
        {/* Top accent */}
        <div style={{ height:3, background:`linear-gradient(90deg, ${isExecuting ? T.amber : color}, ${(isExecuting ? T.amber : color)}88)` }} />

        {/* Head */}
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px 8px" }}>
          <div style={{ width:34, height:34, borderRadius:8, background:dim, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
            {node.icon}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:12.5, fontWeight:700, color:T.t1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{node.label}</div>
            <div style={{ fontSize:10.5, color:T.t3, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{node.sub}</div>
          </div>
          <Badge color={color}>{TYPE_LABEL[node.type]}</Badge>
        </div>

        {/* Body rows */}
        {bodyRows.length > 0 && (
          <div style={{ padding:"0 14px 10px", display:"flex", flexDirection:"column", gap:5 }}>
            {bodyRows.map(([ico, k, v], i) => (
              <div key={i} style={{
                background:T.bg3, border:`1px solid ${T.b0}`, borderRadius:6,
                padding:"5px 9px", fontSize:11, display:"flex", alignItems:"center", gap:7,
              }}>
                <span style={{ opacity:0.55, fontSize:11, flexShrink:0 }}>{ico}</span>
                <span style={{ color:T.t2, flexShrink:0 }}>{k}</span>
                <span style={{ marginLeft:"auto", color:T.t1, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:120, textAlign:"right" }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Condition branches */}
        {isCondition && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, padding:"0 14px 12px" }}>
            <div style={{ textAlign:"center", padding:"5px", borderRadius:6, background:T.greenDim, border:`1px solid ${T.green}33`, color:T.green, fontSize:11, fontWeight:700 }}>✔ Yes</div>
            <div style={{ textAlign:"center", padding:"5px", borderRadius:6, background:T.roseDim,  border:`1px solid ${T.rose}33`,  color:T.rose,  fontSize:11, fontWeight:700 }}>✘ No</div>
          </div>
        )}

        {/* Footer delete (on hover) */}
        {(hovered || selected) && (
          <div style={{ position:"absolute", top:6, right:6, display:"flex", gap:4 }}>
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onDelete(); }}
              style={{ width:22, height:22, borderRadius:6, border:`1px solid ${T.b1}`, background:T.bg4, cursor:"pointer", fontSize:11, color:T.rose, display:"flex", alignItems:"center", justifyContent:"center" }}
            >✕</button>
          </div>
        )}
      </div>

      {/* IN port */}
      {!isTrigger && (
        <div
          onMouseDown={e => { e.stopPropagation(); }}
          onMouseUp={e => { e.stopPropagation(); onPortMouseUp("in"); }}
          style={{
            position:"absolute", width:PORT_R*2, height:PORT_R*2, borderRadius:"50%",
            background:T.bg4, border:`2px solid ${T.b2}`,
            top:-PORT_R, left:`calc(50% - ${PORT_R}px)`,
            cursor:"crosshair", zIndex:10, transition:"all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background=T.amber; e.currentTarget.style.borderColor=T.amber; e.currentTarget.style.transform="scale(1.4)"; }}
          onMouseLeave={e => { e.currentTarget.style.background=T.bg4; e.currentTarget.style.borderColor=T.b2; e.currentTarget.style.transform="scale(1)"; }}
        />
      )}

      {/* OUT port(s) */}
      {!isEnd && !isCondition && (
        <div
          onMouseDown={e => { e.stopPropagation(); onPortMouseDown("out"); }}
          style={{
            position:"absolute", width:PORT_R*2, height:PORT_R*2, borderRadius:"50%",
            background:T.bg4, border:`2px solid ${T.b2}`,
            bottom:-PORT_R, left:`calc(50% - ${PORT_R}px)`,
            cursor:"crosshair", zIndex:10, transition:"all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background=color; e.currentTarget.style.borderColor=color; e.currentTarget.style.transform="scale(1.4)"; }}
          onMouseLeave={e => { e.currentTarget.style.background=T.bg4; e.currentTarget.style.borderColor=T.b2; e.currentTarget.style.transform="scale(1)"; }}
        />
      )}
      {isCondition && (
        <>
          {["yes","no"].map((port, i) => (
            <div key={port}
              onMouseDown={e => { e.stopPropagation(); onPortMouseDown(port); }}
              style={{
                position:"absolute", width:PORT_R*2, height:PORT_R*2, borderRadius:"50%",
                background: port==="yes" ? T.greenDim : T.roseDim,
                border:`2px solid ${port==="yes" ? T.green : T.rose}`,
                bottom:-PORT_R, left: port==="yes" ? `calc(28% - ${PORT_R}px)` : `calc(72% - ${PORT_R}px)`,
                cursor:"crosshair", zIndex:10, transition:"all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform="scale(1.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform="scale(1)"; }}
            >
              <span style={{ position:"absolute", bottom:-16, left:"50%", transform:"translateX(-50%)", fontSize:9, color: port==="yes" ? T.green : T.rose, fontWeight:700, whiteSpace:"nowrap" }}>{port}</span>
            </div>
          ))}
        </>
      )}

      {/* Add after (+) */}
      {!isEnd && (
        <div
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onAddAfter(); }}
          style={{
            position:"absolute", width:22, height:22, borderRadius:"50%",
            background:T.bg4, border:`1.5px solid ${T.b2}`,
            bottom:-44, left:`calc(50% - 11px)`,
            cursor:"pointer", zIndex:10,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:14, color:T.t2,
            opacity: hovered || selected ? 1 : 0,
            transition:"all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background=T.amber; e.currentTarget.style.borderColor=T.amber; e.currentTarget.style.color="#000"; e.currentTarget.style.transform="scale(1.2)"; }}
          onMouseLeave={e => { e.currentTarget.style.background=T.bg4; e.currentTarget.style.borderColor=T.b2; e.currentTarget.style.color=T.t2; e.currentTarget.style.transform="scale(1)"; }}
        >+</div>
      )}
    </div>
  );
});

/* ============================================================
   EDGE SVG
============================================================ */
const Edges = memo(function Edges({ nodes, edges, connecting, activeEdgeId, selectedEdgeId, onEdgeClick }) {
  const nodeMap = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);

  return (
    <svg style={{ position:"absolute", inset:0, overflow:"visible" }}>
      <defs>
        {["default","yes","no"].map(t => (
          <marker key={t} id={`arr-${t}`} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={t==="yes" ? T.green+"88" : t==="no" ? T.rose+"88" : T.t1+"66"} />
          </marker>
        ))}
      </defs>
      {edges.map(e => {
        const from = nodeMap[e.from];
        const to   = nodeMap[e.to];
        if (!from || !to) return null;
        const fp = getPortPos(from, e.port);
        const tp = getPortPos(to, "in");
        const isYes = e.port === "yes", isNo = e.port === "no";
        const defaultStroke = isYes ? T.green+"66" : isNo ? T.rose+"66" : T.b2;
        const marker = `url(#arr-${isYes?"yes":isNo?"no":"default"})`;
        const d = curve(fp.x, fp.y, tp.x, tp.y);
        const isActive = activeEdgeId === e.id || selectedEdgeId === e.id;
        return (
          <g key={e.id}>
            <path d={d} stroke={defaultStroke} strokeWidth={isActive ? 3 : 2} fill="none" strokeDasharray="6 3" markerEnd={marker}
              onClick={() => onEdgeClick(e.id)}
              style={{
                cursor:"pointer",
                stroke: isActive ? T.amber : defaultStroke,
                animation: isActive ? "flowDash 0.45s linear infinite" : "none",
                pointerEvents:"stroke",
              }}
            />
            {(isYes || isNo) && (
              <path d={d} stroke={isYes ? T.green+"22" : T.rose+"22"} strokeWidth={6} fill="none" pointerEvents="none" />
            )}
          </g>
        );
      })}
      {connecting && (
        <path
          d={curve(connecting.fx, connecting.fy, connecting.mx, connecting.my)}
          stroke={T.amber+"99"} strokeWidth={2} fill="none" strokeDasharray="8 4"
          pointerEvents="none"
        />
      )}
    </svg>
  );
});

/* ============================================================
   LEFT SIDEBAR
============================================================ */
const CATS = ["Triggers","Channels","Logic","Actions"];

function Sidebar({ onDragStart }) {
  const [open, setOpen] = useState({ Triggers:true, Channels:true, Logic:true, Actions:true });
  const toggle = cat => setOpen(p => ({ ...p, [cat]: !p[cat] }));

  return (
    <div style={{ width:248, background:T.bg1, borderRight:`1px solid ${T.b0}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"14px 14px 10px", borderBottom:`1px solid ${T.b0}` }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, color:T.t2, letterSpacing:"0.06em", textTransform:"uppercase" }}>
          Node Library
        </div>
        <div style={{ fontSize:11, color:T.t3, marginTop:2 }}>Drag onto canvas</div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"10px 10px" }}>
        {CATS.map(cat => {
          const defs = NODE_DEFS.filter(d => d.cat === cat);
          return (
            <div key={cat} style={{ marginBottom:6 }}>
              <button
                onClick={() => toggle(cat)}
                style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
                  background:"none", border:"none", padding:"5px 6px", cursor:"pointer",
                  fontSize:10.5, fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase",
                  color:T.t3, marginBottom:4,
                }}
              >
                {cat}
                <span style={{ transition:"transform 0.2s", display:"inline-block", transform: open[cat] ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
              </button>
              {open[cat] && defs.map(d => (
                <SidebarChip key={d.key} def={d} onDragStart={onDragStart} />
              ))}
            </div>
          );
        })}
      </div>

      {/* Stats footer */}
      <div style={{ padding:"12px", borderTop:`1px solid ${T.b0}`, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {[["2.4k","Enrolled"],["68%","Completed"],["8","Nodes"],["Active","Status"]].map(([v,l]) => (
          <div key={l} style={{ background:T.bg2, border:`1px solid ${T.b0}`, borderRadius:8, padding:"9px 10px", textAlign:"center" }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:800, color:T.t1 }}>{v}</div>
            <div style={{ fontSize:10, color:T.t3, marginTop:1 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SidebarChip({ def, onDragStart }) {
  const color = TYPE_COLOR(T)[def.type] || T.t2;
  const dim   = TYPE_DIM(T)[def.type]   || T.bg4;
  const [hov, setHov] = useState(false);

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, def)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", alignItems:"center", gap:9, padding:"8px 10px",
        borderRadius:9, border:`1px solid ${hov ? T.b2 : T.b0}`,
        background: hov ? T.bg3 : T.bg2,
        cursor:"grab", marginBottom:5, transition:"all 0.15s",
        transform: hov ? "translateX(3px)" : "translateX(0)",
        boxShadow: hov ? "0 3px 12px rgba(0,0,0,0.3)" : "none",
        position:"relative",
      }}
    >
      <div style={{ position:"absolute", left:0, top:"15%", bottom:"15%", width:3, borderRadius:3, background:color }} />
      <div style={{ width:30, height:30, borderRadius:6, background:dim, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0, marginLeft:8 }}>
        {def.icon}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:500, color: hov ? T.t1 : T.t1 }}>{def.label}</div>
        <div style={{ fontSize:10.5, color:T.t3 }}>{def.sub}</div>
      </div>
      {hov && <span style={{ fontSize:13, color:T.t3 }}>⠿</span>}
    </div>
  );
}

/* ============================================================
   PROPERTY PANEL
============================================================ */
function Panel({ node, nodes, onUpdate, onDelete, tab, onTabChange }) {
  if (!node) return (
    <div style={{ width:290, background:T.bg1, borderLeft:`1px solid ${T.b0}`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:T.t3, textAlign:"center", padding:24 }}>
      <div style={{ fontSize:36, marginBottom:12, opacity:0.35 }}>✦</div>
      <div style={{ fontSize:13, fontWeight:500, color:T.t2, marginBottom:6 }}>No node selected</div>
      <div style={{ fontSize:12, lineHeight:1.7 }}>Click a node on the canvas to inspect and configure its properties.</div>
    </div>
  );

  const f = node.fields || {};
  const upd = (k, v) => onUpdate(node.id, { ...f, [k]: v });
  const color = TYPE_COLOR(T)[node.type] || T.t2;

  return (
    <div style={{ width:290, background:T.bg1, borderLeft:`1px solid ${T.b0}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"14px 14px 12px", borderBottom:`1px solid ${T.b0}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:180 }}>{node.label}</div>
        <Btn variant="danger" size="sm" onClick={() => onDelete(node.id)}>🗑</Btn>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, padding:"10px 12px", borderBottom:`1px solid ${T.b0}` }}>
        {[
          ["config", "Config"],
          ["behavior", "Behavior"],
          ["stats", "Stats"],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => onTabChange(k)}
            style={{
              height:30,
              borderRadius:10,
              border:`1px solid ${tab === k ? T.amber+"66" : T.b0}`,
              background:tab === k ? T.amberDim : T.bg2,
              color:tab === k ? T.amber : T.t2,
              fontSize:12,
              cursor:"pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"14px 14px" }}>
        {/* Node tag */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, padding:"10px 12px", background:T.bg2, border:`1px solid ${T.b0}`, borderRadius:10 }}>
          <div style={{ width:34, height:34, borderRadius:8, background:TYPE_DIM(T)[node.type]||T.bg4, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>{node.icon}</div>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:T.t1 }}>{node.label}</div>
            <div style={{ fontSize:10.5, color:T.t3 }}>{node.id} · {TYPE_LABEL[node.type]}</div>
          </div>
          <Badge color={color}>{TYPE_LABEL[node.type]}</Badge>
        </div>

        {tab === "config" && <>
        <SectionTitle>⚙ Configuration</SectionTitle>

        {/* TRIGGER forms */}
        {node.key === "form_submit" && <>
          <FG label="Form"><Select value={f.form} onChange={e=>upd("form",e.target.value)} options={["Welcome Signup Form","Contact Us","Newsletter Signup","Demo Request"]} /></FG>
          <FG label="Add to List"><Select value={f.list} onChange={e=>upd("list",e.target.value)} options={["Main List","Newsletter","VIP","Prospects"]} /></FG>
        </>}
        {node.key === "tag_added" && <FG label="Tag Name"><Input value={f.tag} onChange={e=>upd("tag",e.target.value)} placeholder="tag-name or *any*" /></FG>}
        {node.key === "purchase" && <>
          <FG label="Min Order Amount"><Input type="number" value={f.minAmount} onChange={e=>upd("minAmount",e.target.value)} /></FG>
          <FG label="Currency"><Select value={f.currency} onChange={e=>upd("currency",e.target.value)} options={["USD","EUR","GBP","AED","PKR"]} /></FG>
        </>}
        {node.key === "date_trigger" && <>
          <FG label="Date Field"><Select value={f.field} onChange={e=>upd("field",e.target.value)} options={["birthday","anniversary","signup_date","trial_end"]} /></FG>
          <FG label="Days Before/After"><Input type="number" value={f.offset} onChange={e=>upd("offset",e.target.value)} /></FG>
        </>}

        {/* EMAIL */}
        {node.type === "email" && <>
          <FG label="From Name"><Input value={f.fromName} onChange={e=>upd("fromName",e.target.value)} /></FG>
          <FG label="From Email"><Input value={f.from} onChange={e=>upd("from",e.target.value)} /></FG>
          <FG label="Subject Line"><Input value={f.subject} onChange={e=>upd("subject",e.target.value)} placeholder="Subject…" /></FG>
          <FG label="Preview Text"><Input value={f.preview||""} onChange={e=>upd("preview",e.target.value)} placeholder="Preview text…" /></FG>
          <FG label="Template"><Select value={f.template} onChange={e=>upd("template",e.target.value)} options={["welcome_v3","followup_v2","promo_v1","newsletter_v4","reengagement_v1"]} /></FG>
          <FG label="Send Timing"><Select value={f.timing} onChange={e=>upd("timing",e.target.value)} options={["Immediately","Send at best time","9:00 AM","10:00 AM","Custom time"]} /></FG>
        </>}

        {/* WHATSAPP */}
        {node.type === "whatsapp" && <>
          <FG label="Template Name"><Input value={f.template} onChange={e=>upd("template",e.target.value)} placeholder="Approved template ID" /></FG>
          <FG label="Message Body"><Input rows={3} value={f.body} onChange={e=>upd("body",e.target.value)} placeholder="Message with {{variables}}" /></FG>
          <FG label="Language"><Select value={f.lang} onChange={e=>upd("lang",e.target.value)} options={["en_US","en_GB","es_ES","fr_FR","ar_SA","ur_PK"]} /></FG>
        </>}

        {/* SMS */}
        {node.type === "sms" && <>
          <FG label="Provider"><Select value={f.provider} onChange={e=>upd("provider",e.target.value)} options={["Twilio","Vonage","MessageBird","Plivo"]} /></FG>
          <FG label="From Number"><Input value={f.from} onChange={e=>upd("from",e.target.value)} placeholder="+1 800…" /></FG>
          <FG label="Message Body"><Input rows={3} value={f.body} onChange={e=>upd("body",e.target.value)} placeholder="Hi {{first_name}}!" /></FG>
          <div style={{ fontSize:10.5, color:T.t3, marginTop:-6, marginBottom:12 }}>160 chars max · merge tags supported</div>
        </>}

        {/* TELEGRAM */}
        {node.type === "telegram" && <>
          <FG label="Bot Username"><Input value={f.bot} onChange={e=>upd("bot",e.target.value)} placeholder="@YourBot" /></FG>
          <FG label="Chat ID / Channel"><Input value={f.chat||""} onChange={e=>upd("chat",e.target.value)} placeholder="@channel or chat ID" /></FG>
          <FG label="Message"><Input rows={3} value={f.body} onChange={e=>upd("body",e.target.value)} /></FG>
          <FG label="Parse Mode"><Select value={f.parse} onChange={e=>upd("parse",e.target.value)} options={["HTML","Markdown","Plain"]} /></FG>
        </>}

        {/* PUSH */}
        {node.type === "push" && <>
          <FG label="Platform"><Select value={f.platform} onChange={e=>upd("platform",e.target.value)} options={["Both (FCM + APNs)","FCM (Android)","APNs (iOS)","Web Push"]} /></FG>
          <FG label="Title"><Input value={f.title} onChange={e=>upd("title",e.target.value)} /></FG>
          <FG label="Body"><Input value={f.body} onChange={e=>upd("body",e.target.value)} /></FG>
          <FG label="Click URL"><Input value={f.url||""} onChange={e=>upd("url",e.target.value)} placeholder="https://…" /></FG>
          <FG label="Icon URL"><Input value={f.icon||""} onChange={e=>upd("icon",e.target.value)} placeholder="https://…/icon.png" /></FG>
        </>}

        {/* CONDITION */}
        {node.key === "jump_condition" && <>
          <FG label="Field / Property"><Input value={f.field} onChange={e=>upd("field",e.target.value)} /></FG>
          <FG label="Operator"><Select value={f.op} onChange={e=>upd("op",e.target.value)} options={["equals","not equals","contains","exists","is greater than","is less than"]} /></FG>
          <FG label="Value"><Input value={f.val} onChange={e=>upd("val",e.target.value)} /></FG>
          <FG label="Jump To (yes path)">
            <Select
              value={f.jumpTo || ""}
              onChange={e=>upd("jumpTo",e.target.value)}
              options={["", ...nodes.filter(n => n.id !== node.id).map(n => `${n.id} • ${n.label}`)]}
            />
          </FG>
          <div style={{ fontSize:10.5, color:T.t3, marginTop:-6, marginBottom:12 }}>Uses "yes" output to jump to selected node; "no" follows no-path.</div>
        </>}
        {node.type === "condition" && node.key !== "jump_condition" && <>
          <FG label="Condition Type"><Select value={f.condType} onChange={e=>upd("condType",e.target.value)} options={["Contact Field","Event Property","Segment Membership","Tag Exists","Score Threshold"]} /></FG>
          <FG label="Field / Property"><Input value={f.field} onChange={e=>upd("field",e.target.value)} /></FG>
          <FG label="Operator"><Select value={f.op} onChange={e=>upd("op",e.target.value)} options={["equals","not equals","contains","exists","is greater than","is less than"]} /></FG>
          <FG label="Value"><Input value={f.val} onChange={e=>upd("val",e.target.value)} /></FG>
        </>}

        {/* A/B SPLIT */}
        {node.type === "split" && <>
          <FG label="Variant A (%)"><Input type="number" value={f.pctA} onChange={e=>upd("pctA",e.target.value)} /></FG>
          <FG label="Variant B (%)"><Input type="number" value={f.pctB} onChange={e=>upd("pctB",e.target.value)} /></FG>
          <div style={{ fontSize:10.5, color:T.t3, marginTop:-6, marginBottom:12 }}>Must total 100%</div>
        </>}

        {/* DELAY */}
        {node.key === "wait_delay" && <>
          <FG label="Duration">
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <Input type="number" value={f.dur} onChange={e=>upd("dur",e.target.value)} />
              <Select value={f.unit} onChange={e=>upd("unit",e.target.value)} options={["Minutes","Hours","Days","Weeks"]} />
            </div>
          </FG>
          <FG label="Send At"><Select value={f.sendAt} onChange={e=>upd("sendAt",e.target.value)} options={["Immediately after delay","9:00 AM","10:00 AM","12:00 PM","6:00 PM","Custom"]} /></FG>
          <FG label="Send Days"><Select value={f.days} onChange={e=>upd("days",e.target.value)} options={["Any day","Weekdays only","Weekends only"]} /></FG>
        </>}
        {node.key === "wait_event" && <>
          <FG label="Wait for Event"><Select value={f.event} onChange={e=>upd("event",e.target.value)} options={["Email Opened","Link Clicked","Reply Received","Purchase Made","Form Submitted","Page Visited"]} /></FG>
          <FG label="Timeout (if no event)"><Input value={f.timeout} onChange={e=>upd("timeout",e.target.value)} placeholder="e.g. 3 Days" /></FG>
        </>}

        {/* ACTIONS */}
        {node.key === "update_tag" && <>
          <FG label="Action"><Select value={f.action} onChange={e=>upd("action",e.target.value)} options={["Add Tag","Remove Tag","Toggle Tag"]} /></FG>
          <FG label="Tag Name"><Input value={f.tag} onChange={e=>upd("tag",e.target.value)} /></FG>
        </>}
        {node.key === "update_field" && <>
          <FG label="Field Name"><Input value={f.field} onChange={e=>upd("field",e.target.value)} /></FG>
          <FG label="New Value"><Input value={f.val} onChange={e=>upd("val",e.target.value)} /></FG>
        </>}
        {node.key === "webhook_out" && <>
          <FG label="Method"><Select value={f.method} onChange={e=>upd("method",e.target.value)} options={["POST","GET","PUT","PATCH","DELETE"]} /></FG>
          <FG label="URL"><Input value={f.url} onChange={e=>upd("url",e.target.value)} placeholder="https://…" /></FG>
          <FG label="Headers (JSON)"><Input rows={2} value={f.headers} onChange={e=>upd("headers",e.target.value)} placeholder='{"Authorization":"Bearer …"}' /></FG>
          <FG label="Body (JSON)"><Input rows={3} value={f.body||""} onChange={e=>upd("body",e.target.value)} placeholder='{"contact":"{{email}}"}' /></FG>
        </>}
        {node.key === "move_list" && <FG label="Destination List"><Select value={f.list} onChange={e=>upd("list",e.target.value)} options={["Newsletter","VIP","Prospects","Cold","Archived"]} /></FG>}
        </>}

        {tab === "behavior" && <>
        <SectionTitle>⚡ Behavior</SectionTitle>
        {[["Track Events","Record engagement metrics",true],["Stop on Bounce","Skip if email bounced",false],["Respect Quiet Hours","Don't send at night",true]].map(([t,d,def]) => (
          <ToggleRow key={t} title={t} desc={d} defaultChecked={def} />
        ))}
        </>}

        {/* Stats for channels */}
        {tab === "stats" && ["email","whatsapp","sms","telegram","push"].includes(node.type) && <>
          <SectionTitle>📊 Performance</SectionTitle>
          {[["Delivered","4,210",100],["Opened","41.3%",41],["Clicked","8.7%",9],["Converted","1.8%",2]].map(([k,v,pct]) => (
            <div key={k} style={{ marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                <span style={{ color:T.t2 }}>{k}</span>
                <span style={{ color:T.t1, fontWeight:600 }}>{v}</span>
              </div>
              <div style={{ height:4, background:T.bg4, borderRadius:99 }}>
                <div style={{ height:"100%", borderRadius:99, width:`${pct}%`, background:`linear-gradient(90deg, ${T.amber}, #e8761a)` }} />
              </div>
            </div>
          ))}
        </>}
        {tab === "stats" && !["email","whatsapp","sms","telegram","push"].includes(node.type) && (
          <div style={{ color:T.t3, fontSize:12, lineHeight:1.7 }}>No channel stats for this node type yet.</div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({ title, desc, defaultChecked }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 0" }}>
      <div>
        <div style={{ fontSize:12.5, fontWeight:500, color:T.t1 }}>{title}</div>
        <div style={{ fontSize:11, color:T.t3, marginTop:1 }}>{desc}</div>
      </div>
      <div
        onClick={() => setOn(!on)}
        style={{
          width:36, height:20, borderRadius:99, cursor:"pointer", flexShrink:0,
          background: on ? T.amberDim : T.bg4,
          border:`1.5px solid ${on ? T.amber+"66" : T.b1}`,
          position:"relative", transition:"all 0.2s",
        }}
      >
        <div style={{
          position:"absolute", width:12, height:12, borderRadius:"50%",
          background: on ? T.amber : T.t3,
          top:"50%", transform:`translate(${on?"18px":"3px"},-50%)`,
          transition:"all 0.2s",
        }} />
      </div>
    </div>
  );
}

/* ============================================================
   ADD NODE MODAL
============================================================ */
function NodeModal({ open, onClose, onAdd }) {
  const [q, setQ] = useState("");
  const filtered = NODE_DEFS.filter(d =>
    !q || d.label.toLowerCase().includes(q.toLowerCase()) || d.cat.toLowerCase().includes(q.toLowerCase())
  );

  useEffect(() => { if (open) setQ(""); }, [open]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(6px)" }}
    >
      <div onClick={e=>e.stopPropagation()} style={{
        width:520, maxHeight:"78vh", background:T.bg1, border:`1px solid ${T.b2}`,
        borderRadius:20, overflow:"hidden", display:"flex", flexDirection:"column",
        boxShadow:"0 20px 60px rgba(0,0,0,0.7)", animation:"popIn 0.2s ease both",
      }}>
        {/* Modal header */}
        <div style={{ padding:"16px 18px", borderBottom:`1px solid ${T.b0}`, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700, flexShrink:0 }}>Add Node</div>
          <input
            autoFocus
            value={q}
            onChange={e=>setQ(e.target.value)}
            placeholder="Search nodes…"
            style={{
              flex:1, background:T.bg3, border:`1px solid ${T.b1}`, borderRadius:8,
              padding:"7px 12px", color:T.t1, fontSize:12.5, outline:"none",
            }}
            onFocus={e=>e.target.style.borderColor=T.amber}
            onBlur={e=>e.target.style.borderColor=T.b1}
          />
          <Btn variant="ghost" onClick={onClose}>✕</Btn>
        </div>
        {/* Grid */}
        <div style={{ overflowY:"auto", padding:14, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {filtered.map(d => {
            const color = TYPE_COLOR(T)[d.type];
            const dim   = TYPE_DIM(T)[d.type];
            return (
              <div key={d.key}
                onClick={() => { onAdd(d); onClose(); }}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 12px",
                  background:T.bg2, border:`1px solid ${T.b0}`, borderRadius:10,
                  cursor:"pointer", transition:"all 0.15s",
                }}
                onMouseEnter={e=>{ e.currentTarget.style.background=T.bg3; e.currentTarget.style.borderColor=T.b2; e.currentTarget.style.transform="translateY(-1px)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.background=T.bg2; e.currentTarget.style.borderColor=T.b0; e.currentTarget.style.transform="translateY(0)"; }}
              >
                <div style={{ width:34, height:34, borderRadius:8, background:dim, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>{d.icon}</div>
                <div>
                  <div style={{ fontSize:12.5, fontWeight:500, color:T.t1 }}>{d.label}</div>
                  <div style={{ fontSize:10.5, color:T.t3, marginTop:1 }}>{d.sub}</div>
                </div>
                <Badge color={color} style={{ marginLeft:"auto", flexShrink:0 }}>{TYPE_LABEL[d.type]}</Badge>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn:"span 2", textAlign:"center", padding:32, color:T.t3 }}>No nodes match "{q}"</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   CONTEXT MENU
============================================================ */
function ContextMenu({ ctx, onDuplicate, onDelete, onDisable, onAddAfter, onEdit, onClose }) {
  if (!ctx) return null;
  const items = [
    { icon:"◉", label:"Duplicate Node", shortcut:"Ctrl+D", action: onDuplicate },
    { icon:"+", label:"Add Node After", shortcut:"A", action: onAddAfter },
    null,
    { icon:"Ⅱ", label: ctx.disabled ? "Enable Node" : "Disable Node", shortcut:"/", action: onDisable },
    { icon:"⚙", label:"Edit Properties", shortcut:"Enter", action: onEdit },
    null,
    { icon:"⌫", label:"Delete Node", shortcut:"Del", action: onDelete, danger: true },
  ];
  return (
    <div
      onClick={onClose}
      style={{ position:"fixed", inset:0, zIndex:900 }}
    >
      <div
        onClick={e=>e.stopPropagation()}
        style={{
          position:"fixed", left:ctx.x, top:ctx.y, background:T.bg2,
          border:`1px solid ${T.b2}`, borderRadius:14, padding:6, minWidth:210,
          boxShadow:"0 8px 32px rgba(0,0,0,0.6)", zIndex:901,
          animation:"fadeIn 0.12s ease both",
        }}
      >
        {items.map((item, i) =>
          item === null
            ? <div key={i} style={{ borderTop:`1px solid ${T.b0}`, margin:"4px 0" }} />
            : (
              <div key={i}
                onClick={() => { item.action(); onClose(); }}
                style={{
                  display:"flex", alignItems:"center", gap:9, padding:"8px 10px",
                  borderRadius:8, cursor:"pointer", fontSize:12.5,
                  color: item.danger ? T.rose : T.t2,
                  transition:"all 0.12s",
                }}
                onMouseEnter={e=>e.currentTarget.style.background = item.danger ? T.roseDim : T.bg3}
                onMouseLeave={e=>e.currentTarget.style.background = "transparent"}
              >
                <span style={{ width:18, textAlign:"center", fontSize:13 }}>{item.icon}</span>
                <span>{item.label}</span>
                <span style={{ marginLeft:"auto", color:T.t3, fontSize:11 }}>{item.shortcut || ""}</span>
              </div>
            )
        )}
      </div>
    </div>
  );
}

const PORTAL_SECTIONS = [
  { key:"workflows", label:"WF", name:"Workflows", desc:"Journey builder and orchestration" },
  { key:"automation", label:"AT", name:"Automation", desc:"Queues, runs, and execution health" },
  { key:"crm", label:"CRM", name:"CRM", desc:"Pipeline, contacts, and account ops" },
  { key:"analytics", label:"BI", name:"Analytics", desc:"Attribution and performance insights" },
];

const ROUTE_TO_SECTION = {
  "/": "workflows",
  "/workflows": "workflows",
  "/automation": "automation",
  "/crm": "crm",
  "/analytics": "analytics",
};

const SECTION_TO_ROUTE = {
  workflows: "/workflows",
  automation: "/automation",
  crm: "/crm",
  analytics: "/analytics",
};

function getSectionFromPath(pathname) {
  return ROUTE_TO_SECTION[pathname] || "workflows";
}

function PortalCard({ title, value, note, accent = T.amber }) {
  return (
    <div style={{ background:T.bg2, border:`1px solid ${T.b0}`, borderRadius:12, padding:"10px 12px", minHeight:78 }}>
      <div style={{ fontSize:10.5, color:T.t3, textTransform:"uppercase", letterSpacing:"0.06em" }}>{title}</div>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:700, color:T.t1, lineHeight:1.05, marginTop:4 }}>{value}</div>
      <div style={{ fontSize:11, color:accent, marginTop:4 }}>{note}</div>
    </div>
  );
}

function AutomationDashboard() {
  const jobs = [
    ["Welcome Journey", "Running", "1,284 contacts", T.green],
    ["Trial Conversion", "Paused", "312 contacts", T.amber],
    ["Reactivation Flow", "Running", "846 contacts", T.green],
    ["Winback WhatsApp", "Draft", "0 contacts", T.t2],
  ];

  return (
    <div style={{ flex:1, padding:16, overflowY:"auto", display:"grid", gridTemplateColumns:"2fr 1fr", gap:14 }}>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0, 1fr))", gap:10 }}>
          <PortalCard title="Executions (24h)" value="98,432" note="+6.2% from yesterday" accent={T.green} />
          <PortalCard title="Avg Latency" value="248ms" note="Within SLO target" accent={T.blue} />
          <PortalCard title="Error Rate" value="0.4%" note="Needs monitoring on webhooks" accent={T.amber} />
        </div>
        <div style={{ background:T.bg1, border:`1px solid ${T.b0}`, borderRadius:14, padding:12 }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:14, marginBottom:10 }}>Automation Runs</div>
          {jobs.map(([name, state, volume, color]) => (
            <div key={name} style={{ display:"flex", alignItems:"center", padding:"10px 8px", borderTop:`1px solid ${T.b0}` }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:color, marginRight:10 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12.5, color:T.t1 }}>{name}</div>
                <div style={{ fontSize:11, color:T.t3 }}>{volume}</div>
              </div>
              <div style={{ fontSize:11.5, color:T.t2 }}>{state}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background:T.bg1, border:`1px solid ${T.b0}`, borderRadius:14, padding:12 }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:14, marginBottom:10 }}>Ops Checklist</div>
        {[
          ["Webhook retries configured", true],
          ["Quiet hours enabled", true],
          ["Failover SMS provider", false],
          ["Journey versioning", true],
        ].map(([label, ok]) => (
          <div key={label} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:ok ? T.t2 : T.rose, padding:"8px 0", borderTop:`1px solid ${T.b0}` }}>
            <span>{ok ? "✓" : "!"}</span>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function CrmDashboard() {
  const columns = [
    { name:"New Leads", items:["Acme Inc", "Horizon Labs", "Nimbus Co"] },
    { name:"Qualified", items:["Northwind", "Vertex Digital"] },
    { name:"Proposal", items:["BluePeak", "Aurelia Group"] },
    { name:"Won", items:["Orbit Commerce"] },
  ];

  return (
    <div style={{ flex:1, padding:16, overflowY:"auto", display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4, minmax(0, 1fr))", gap:10 }}>
        <PortalCard title="Pipeline Value" value="$482k" note="Active opportunities" accent={T.green} />
        <PortalCard title="Open Deals" value="27" note="8 closing this week" accent={T.blue} />
        <PortalCard title="Lead Response" value="14m" note="Median first response time" accent={T.purple} />
        <PortalCard title="Churn Risk" value="3.1%" note="Down from last month" accent={T.amber} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12, minHeight:0 }}>
        <div style={{ background:T.bg1, border:`1px solid ${T.b0}`, borderRadius:14, padding:12 }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:14, marginBottom:10 }}>Sales Pipeline</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4, minmax(0, 1fr))", gap:8 }}>
            {columns.map(col => (
              <div key={col.name} style={{ background:T.bg2, border:`1px solid ${T.b0}`, borderRadius:10, padding:8 }}>
                <div style={{ fontSize:11, color:T.t3, marginBottom:6 }}>{col.name}</div>
                {col.items.map(item => (
                  <div key={item} style={{ background:T.bg3, border:`1px solid ${T.b0}`, borderRadius:8, padding:"6px 8px", fontSize:11.5, color:T.t1, marginBottom:6 }}>
                    {item}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:T.bg1, border:`1px solid ${T.b0}`, borderRadius:14, padding:12 }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:14, marginBottom:10 }}>Recent CRM Activity</div>
          {[
            "Aurelia Group moved to Proposal",
            "New lead captured: SkyBridge",
            "Task completed: QBR prep for Acme",
            "Contact score +12 for Orbit Commerce",
          ].map(item => (
            <div key={item} style={{ fontSize:11.5, color:T.t2, borderTop:`1px solid ${T.b0}`, padding:"9px 0" }}>{item}</div>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ============================================================
   MAIN APP
============================================================ */
const trunc = (s="", n=26) => s.length > n ? s.slice(0,n)+"…" : s;

export default function WorkflowBuilder() {
  const location = useLocation();
  const navigate = useNavigate();
  const [nodes, setNodes]   = useState(() => INIT_NODES.map(n => ({ ...n })));
  const [edges, setEdges]   = useState(() => INIT_EDGES.map(e => ({ ...e })));
  const [selected, setSelected] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [modal, setModal]   = useState(false);
  const [modalAfter, setModalAfter] = useState(null);
  const [ctx, setCtx]       = useState(null);
  const [panelTab, setPanelTab] = useState("config");
  const [wfName, setWfName] = useState("Welcome & Onboarding Flow");
  const section = getSectionFromPath(location.pathname);
  const [themeMode, setThemeMode] = useState(() => getInitialThemeMode());
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [savedWorkflows, setSavedWorkflows] = useState([]);
  const [workflowDetails, setWorkflowDetails] = useState(null);
  const historyRef = useRef([]);
  const futureRef = useRef([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [runtime, setRuntime] = useState({
    status: "idle",
    activeNodeId: null,
    activeEdgeId: null,
    logs: [],
    startedAt: null,
    executedSteps: 0,
    elapsed: 0,
  });

  // Pan & zoom
  const [pan, setPan]   = useState({ x: 60, y: 40 });
  const [scale, setScale] = useState(0.9);
  const panRef  = useRef(null);
  const scaleRef = useRef(scale);
  const panSRef  = useRef(pan);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { panSRef.current = pan; }, [pan]);

  // Drag node
  const dragging = useRef(null);
  const rafMoveRef = useRef(null);
  const latestPointerRef = useRef({ x: 0, y: 0 });
  // Pan
  const panning  = useRef(null);
  // Connecting
  const [connecting, setConnecting] = useState(null);
  const connectRef = useRef(null);

  const { toasts, push: toast } = useToast();
  const wrapRef = useRef(null);
  const didLoadRef = useRef(false);
  const runTimersRef = useRef([]);
  const runningRef = useRef(false);

  const deleteEdge = useCallback((edgeId) => {
    if (!edgeId) return;
    setEdges(prev => prev.filter(e => e.id !== edgeId));
    setSelectedEdge(prev => prev === edgeId ? null : prev);
    toast("Link removed");
  }, [toast]);

  const selectEdge = useCallback((edgeId) => {
    setSelected(null);
    setSelectedEdge(edgeId);
    toast("Link selected. Use Delete Link to remove it.");
  }, []);

  const createSnapshot = useCallback(() => ({
    nodes: cloneNodes(nodes),
    edges: cloneEdges(edges),
    wfName,
  }), [nodes, edges, wfName]);

  const restoreSnapshot = useCallback((snap) => {
    if (!snap) return;
    setNodes(cloneNodes(snap.nodes || []));
    setEdges(cloneEdges(snap.edges || []));
    setWfName(snap.wfName || "Welcome & Onboarding Flow");
  }, []);

  const pushHistory = useCallback((snap) => {
    historyRef.current.push(snap);
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    futureRef.current = [];
    setHistoryVersion(v => v + 1);
  }, []);

  const checkpoint = useCallback(() => {
    pushHistory(createSnapshot());
  }, [createSnapshot, pushHistory]);

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) {
      toast("Nothing to undo");
      return;
    }
    futureRef.current.push(createSnapshot());
    restoreSnapshot(prev);
    setHistoryVersion(v => v + 1);
  }, [createSnapshot, restoreSnapshot, toast]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) {
      toast("Nothing to redo");
      return;
    }
    historyRef.current.push(createSnapshot());
    restoreSnapshot(next);
    setHistoryVersion(v => v + 1);
  }, [createSnapshot, restoreSnapshot, toast]);

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          setNodes(cloneNodes(parsed.nodes));
          setEdges(cloneEdges(parsed.edges));
          if (typeof parsed.wfName === "string") setWfName(parsed.wfName);
          if (typeof parsed.savedAt === "number") setLastSavedAt(parsed.savedAt);
          toast("Draft restored");
        }
      }
    } catch {}

    try {
      const savedWorkflowsRaw = window.localStorage.getItem(WORKFLOWS_KEY);
      if (savedWorkflowsRaw) {
        const saved = JSON.parse(savedWorkflowsRaw);
        if (Array.isArray(saved)) setSavedWorkflows(saved);
      }
    } catch {}

    try {
      const themePref = window.localStorage.getItem(THEME_KEY);
      if (themePref === "light" || themePref === "dark") setThemeMode(themePref);
    } catch {}
  }, [toast]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const savedAt = Date.now();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          wfName,
          nodes: cloneNodes(nodes),
          edges: cloneEdges(edges),
          savedAt,
        }));
        setLastSavedAt(savedAt);
      } catch {}
    }, 350);
    return () => window.clearTimeout(t);
  }, [nodes, edges, wfName]);

  useEffect(() => {
    const tokens = themeMode === "light" ? LIGHT_TOKENS : DARK_TOKENS;
    Object.assign(T, tokens);
    document.documentElement.dataset.theme = themeMode;
    try { window.localStorage.setItem(THEME_KEY, themeMode); } catch {}
  }, [themeMode]);

  useEffect(() => {
    try { window.localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(savedWorkflows)); } catch {}
  }, [savedWorkflows]);

  const navigateToSection = useCallback((nextSection) => {
    const target = SECTION_TO_ROUTE[nextSection] || "/workflows";
    navigate(target);
  }, [navigate]);

  /* ── SELECTED NODE ── */
  const selectedNode = useMemo(() => nodes.find(n => n.id === selected) || null, [nodes, selected]);
  const nodeMap = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);
  const edgeByFrom = useMemo(() => {
    const m = {};
    edges.forEach(e => {
      if (!m[e.from]) m[e.from] = [];
      m[e.from].push(e);
    });
    return m;
  }, [edges]);
  useEffect(() => { setPanelTab("config"); }, [selected]);

  const clearRunTimers = useCallback(() => {
    runTimersRef.current.forEach(id => window.clearTimeout(id));
    runTimersRef.current = [];
  }, []);

  const sleep = useCallback((ms) => new Promise(resolve => {
    const id = window.setTimeout(resolve, ms);
    runTimersRef.current.push(id);
  }), []);

  const appendRuntimeLog = useCallback((msg) => {
    const timestamp = new Date();
    setRuntime(prev => ({
      ...prev,
      logs: [...prev.logs.slice(-7), `${timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}  ${msg}`],
      executedSteps: prev.status === "running" ? prev.executedSteps + 1 : prev.executedSteps,
      elapsed: prev.startedAt ? Date.now() - prev.startedAt : prev.elapsed,
    }));
  }, []);

  const evaluateCondition = useCallback((node) => {
    const f = node.fields || {};
    const op = (f.op || "").toLowerCase();
    const val = `${f.val ?? ""}`.toLowerCase();
    if (op.includes("exists")) return true;
    if (op.includes("not equals")) return val !== "true";
    if (op.includes("greater")) return Number(f.val || 0) > 50;
    if (op.includes("less")) return Number(f.val || 0) < 50;
    if (op.includes("contains")) return val.includes("true") || val.includes("yes");
    return val === "true" || val === "yes" || Math.random() > 0.45;
  }, []);

  const stopTestRun = useCallback((completed = false) => {
    runningRef.current = false;
    clearRunTimers();
    setRuntime(prev => ({
      ...prev,
      status: completed ? "completed" : "idle",
      activeNodeId: null,
      activeEdgeId: null,
    }));
  }, [clearRunTimers]);

  const selectNextEdge = useCallback((node) => {
    const outs = edgeByFrom[node.id] || [];
    if (!outs.length) return null;
    if (node.type === "condition") {
      const isYes = evaluateCondition(node);
      if (node.key === "jump_condition" && isYes) {
        const rawTarget = (node.fields?.jumpTo || "").split("•")[0].trim();
        if (rawTarget) {
          const jumpEdge = outs.find(e => e.to === rawTarget) || outs.find(e => e.port === "yes");
          if (jumpEdge) return jumpEdge;
        }
      }
      return outs.find(e => e.port === (isYes ? "yes" : "no")) || outs[0];
    }
    if (node.type === "split") {
      const pctA = Number(node.fields?.pctA || 50);
      const toss = Math.random() * 100;
      return toss <= pctA ? outs[0] : (outs[1] || outs[0]);
    }
    return outs.find(e => e.port === "out") || outs[0];
  }, [edgeByFrom, evaluateCondition]);

  const runWorkflowSimulation = useCallback(async () => {
    if (section !== "workflows") {
      toast("Open Workflows page to run a test");
      return;
    }
    const start = nodes.find(n => n.type === "trigger");
    if (!start) {
      toast("Add at least one trigger node", "warn");
      return;
    }
    stopTestRun(false);
    runningRef.current = true;
    const startTs = Date.now();
    setRuntime({ status:"running", activeNodeId:null, activeEdgeId:null, logs:[`Started from ${start.label}`], startedAt: startTs, executedSteps: 0, elapsed: 0 });
    toast("Test run started");

    const maxSteps = Math.max(20, nodes.length * 5);
    let current = start;
    let steps = 0;

    while (runningRef.current && current && steps < maxSteps) {
      steps += 1;
      setRuntime(prev => ({ ...prev, activeNodeId: current.id, activeEdgeId: null }));
      appendRuntimeLog(`Executing ${current.label}`);

      const waitMs = current.type === "delay" ? 900 : current.type === "condition" ? 500 : 380;
      await sleep(waitMs);
      if (!runningRef.current) break;
      if (current.type === "end") {
        appendRuntimeLog("Workflow ended successfully");
        stopTestRun(true);
        toast("Run completed ✓");
        return;
      }

      const nextEdge = selectNextEdge(current);
      if (!nextEdge) {
        appendRuntimeLog("No outgoing connection. Run finished.");
        stopTestRun(true);
        return;
      }
      setRuntime(prev => ({ ...prev, activeEdgeId: nextEdge.id }));
      await sleep(260);
      current = nodeMap[nextEdge.to];
      setSelected(current?.id || null);
    }

    if (steps >= maxSteps) appendRuntimeLog("Run stopped: possible loop detected.");
    stopTestRun(true);
  }, [section, nodes, nodeMap, selectNextEdge, sleep, stopTestRun, appendRuntimeLog, toast]);

  const displayedWorkflows = savedWorkflows.length ? savedWorkflows : SAMPLE_WORKFLOWS;
  const activeWorkflows = displayedWorkflows.filter(w => w.status.toLowerCase() === "running");

  const saveCurrentWorkflow = useCallback(() => {
    const savedAt = Date.now();
    const id = workflowDetails?.id || `wf-${savedAt}`;
    const payload = {
      id,
      name: wfName || "Untitled workflow",
      status: "Saved",
      contacts: `${nodes.length * 120}`,
      lastRun: "Just saved",
      savedAt,
      activeSince: "—",
      nodes: cloneNodes(nodes),
      edges: cloneEdges(edges),
    };
    setSavedWorkflows(prev => {
      const exists = prev.some(w => w.id === id);
      return exists ? prev.map(w => w.id === id ? payload : w) : [payload, ...prev];
    });
    setWorkflowDetails(payload);
    toast("Workflow saved to local library");
  }, [workflowDetails, wfName, nodes, edges]);

  const loadWorkflowFromLibrary = useCallback((id) => {
    const item = displayedWorkflows.find(w => w.id === id);
    if (!item) return;
    setNodes(cloneNodes(item.nodes || []));
    setEdges(cloneEdges(item.edges || []));
    setWfName(item.name || "Workflow");
    setWorkflowDetails(item);
    toast(`Loaded ${item.name}`);
  }, [displayedWorkflows]);

  const deleteWorkflowFromLibrary = useCallback((id) => {
    setSavedWorkflows(prev => prev.filter(w => w.id !== id));
    setWorkflowDetails(prev => prev && prev.id === id ? null : prev);
    toast("Workflow removed from library");
  }, []);

  /* ── CANVAS TO WORLD ── */
  const clientToWorld = useCallback((cx, cy) => {
    const rect = wrapRef.current?.getBoundingClientRect() || { left:0, top:0 };
    return {
      x: (cx - rect.left - panSRef.current.x) / scaleRef.current,
      y: (cy - rect.top  - panSRef.current.y) / scaleRef.current,
    };
  }, []);

  /* ── DRAG NODE ── */
  const onNodeDragStart = useCallback((e, nodeId) => {
    e.stopPropagation();
    const n = nodes.find(x => x.id === nodeId);
    if (!n) return;
    checkpoint();
    dragging.current = { nodeId, startCX: e.clientX, startCY: e.clientY, origX: n.x, origY: n.y };
  }, [nodes, checkpoint]);

  /* ── PAN ── */
  const onCanvasMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && !e.target.closest("[data-node]"))) {
      panning.current = { startCX: e.clientX, startCY: e.clientY, origX: panSRef.current.x, origY: panSRef.current.y };
      setSelected(null);
    }
  }, []);

  /* ── GLOBAL MOUSE MOVE ── */
  useEffect(() => {
    const processMove = () => {
      rafMoveRef.current = null;
      const e = latestPointerRef.current;
      if (!e) return;
      if (dragging.current) {
        const { nodeId, startCX, startCY, origX, origY } = dragging.current;
        const dx = (e.x - startCX) / scaleRef.current;
        const dy = (e.y - startCY) / scaleRef.current;
        const nextX = Math.max(0, Math.round((origX + dx) / SNAP_GRID) * SNAP_GRID);
        const nextY = Math.max(0, Math.round((origY + dy) / SNAP_GRID) * SNAP_GRID);
        setNodes(prev => prev.map(n => n.id === nodeId
          ? { ...n, x: nextX, y: nextY }
          : n
        ));
      }
      if (panning.current) {
        const { startCX, startCY, origX, origY } = panning.current;
        setPan({ x: origX + (e.x - startCX), y: origY + (e.y - startCY) });
      }
      if (connectRef.current) {
        const rect = wrapRef.current?.getBoundingClientRect() || { left:0, top:0 };
        const mx = (e.x - rect.left - panSRef.current.x) / scaleRef.current;
        const my = (e.y - rect.top  - panSRef.current.y) / scaleRef.current;
        setConnecting({ ...connectRef.current, mx, my });
      }
    };
    const onMove = (e) => {
      latestPointerRef.current = { x: e.clientX, y: e.clientY };
      if (!rafMoveRef.current) {
        rafMoveRef.current = window.requestAnimationFrame(processMove);
      }
    };
    const onUp = () => {
      dragging.current = null;
      panning.current  = null;
      connectRef.current = null;
      setConnecting(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      if (rafMoveRef.current) {
        window.cancelAnimationFrame(rafMoveRef.current);
        rafMoveRef.current = null;
      }
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  /* ── WHEEL ZOOM ── */
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.07 : 0.07;
    const rect  = wrapRef.current.getBoundingClientRect();
    const cx    = e.clientX - rect.left;
    const cy    = e.clientY - rect.top;
    setScale(s => {
      const ns = clamp(s + delta, 0.25, 2);
      const ds = ns - s;
      setPan(p => ({ x: p.x - cx * ds / s, y: p.y - cy * ds / s }));
      return ns;
    });
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  /* ── SIDEBAR DROP ── */
  const onSidebarDragStart = useCallback((e, def) => {
    e.dataTransfer.setData("app/nodedef", JSON.stringify(def));
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("app/nodedef");
    if (!raw) return;
    const def = JSON.parse(raw);
    const pos = clientToWorld(e.clientX, e.clientY);
    addNodeAt(def, pos.x - NODE_W/2, pos.y - 60);
  }, [clientToWorld]);

  /* ── ADD NODE ── */
  const addNodeAt = useCallback((def, x, y, afterId) => {
    checkpoint();
    const id = uid();
    const newNode = {
      id, key: def.key, type: def.type, label: def.label,
      icon: def.icon, sub: def.sub, x: Math.max(10, x), y: Math.max(10, y),
      fields: defaultFields(def.key), disabled: false,
    };
    setNodes(prev => [...prev, newNode]);
    if (afterId) {
      setEdges(prev => [...prev, { id: eid(), from: afterId, to: id, port: "out" }]);
    }
    setSelected(id);
    toast(`${def.label} added`);
    return id;
  }, [toast, checkpoint]);

  const handleModalAdd = useCallback((def) => {
    const centerX = (wrapRef.current?.clientWidth || 800) / 2;
    const centerY = (wrapRef.current?.clientHeight || 600) / 2;
    let x, y;
    if (modalAfter) {
      const an = nodes.find(n => n.id === modalAfter);
      x = an ? an.x : (centerX - panSRef.current.x) / scaleRef.current - NODE_W/2;
      y = an ? an.y + nodeHeight(an) + 80 : (centerY - panSRef.current.y) / scaleRef.current - 60;
    } else {
      x = (centerX - panSRef.current.x) / scaleRef.current - NODE_W/2;
      y = (centerY - panSRef.current.y) / scaleRef.current - 60;
    }
    addNodeAt(def, x, y, modalAfter);
    setModalAfter(null);
  }, [nodes, modalAfter, addNodeAt]);

  /* ── DELETE NODE ── */
  const deleteNode = useCallback((id) => {
    checkpoint();
    setNodes(p => p.filter(n => n.id !== id));
    setEdges(p => p.filter(e => e.from !== id && e.to !== id));
    if (selected === id) setSelected(null);
    toast("Node deleted");
  }, [selected, toast, checkpoint]);

  /* ── UPDATE FIELDS ── */
  const updateNode = useCallback((id, fields) => {
    setNodes(p => p.map(n => n.id === id ? { ...n, fields } : n));
  }, []);

  /* ── CONNECTIONS ── */
  const onPortMouseDown = useCallback((nodeId, port) => {
    const node = nodes.find(n => n.id === nodeId);
    const fp = getPortPos(node, port);
    connectRef.current = { fromId: nodeId, fromPort: port, fx: fp.x, fy: fp.y, mx: fp.x, my: fp.y };
    setConnecting({ fromId: nodeId, fromPort: port, fx: fp.x, fy: fp.y, mx: fp.x, my: fp.y });
  }, [nodes]);

  const onPortMouseUp = useCallback((toNodeId, toPort) => {
    if (!connectRef.current) return;
    const { fromId, fromPort } = connectRef.current;
    if (toNodeId === fromId) return;
    if (toPort !== "in") return;
    checkpoint();
    // Remove duplicate
    setEdges(prev => {
      const filtered = prev.filter(e => !(e.from === fromId && e.port === fromPort));
      return [...filtered, { id: eid(), from: fromId, to: toNodeId, port: fromPort }];
    });
    connectRef.current = null;
    setConnecting(null);
    toast("Nodes connected ✓");
  }, [toast, checkpoint]);

  const toggleNodeDisabled = useCallback((id) => {
    checkpoint();
    setNodes(p => p.map(n => n.id === id ? { ...n, disabled: !n.disabled } : n));
  }, [checkpoint]);

  /* ── FIT VIEW ── */
  const fitView = useCallback(() => {
    if (!nodes.length || !wrapRef.current) return;
    const ww = wrapRef.current.clientWidth;
    const wh = wrapRef.current.clientHeight;
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const minX = Math.min(...xs) - 40, minY = Math.min(...ys) - 40;
    const maxX = Math.max(...xs) + NODE_W + 40, maxY = Math.max(...ys) + 200 + 40;
    const s = Math.min(ww/(maxX-minX), wh/(maxY-minY), 1.1) * 0.88;
    setScale(s);
    setPan({ x: (ww - (maxX-minX)*s)/2 - minX*s, y: (wh - (maxY-minY)*s)/2 - minY*s });
    toast("View fitted");
  }, [nodes, toast]);

  /* ── CONTEXT MENU ── */
  const onCtxMenu = useCallback((e, nodeId) => {
    e.preventDefault();
    setSelected(nodeId);
    const node = nodes.find(n => n.id === nodeId);
    setCtx({ x: e.clientX, y: e.clientY, nodeId, disabled: node?.disabled });
  }, [nodes]);

  /* ── KEYBOARD ── */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") { setCtx(null); setSelected(null); setModal(false); }
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      if (ctrlOrCmd && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (ctrlOrCmd && e.key.toLowerCase() === "d" && selected) {
        e.preventDefault();
        const n = nodes.find(x => x.id === selected);
        if (n) {
          const def = NODE_DEFS.find(d => d.key === n.key) || n;
          addNodeAt(def, n.x + NODE_W + 20, n.y);
        }
        return;
      }
      if ((ctrlOrCmd && e.key.toLowerCase() === "y") || (ctrlOrCmd && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "Enter" && selected) {
        e.preventDefault();
        setPanelTab("config");
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        const tag = document.activeElement?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
          deleteNode(selected);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, deleteNode, undo, redo, nodes, addNodeAt]);

  useEffect(() => () => stopTestRun(false), [stopTestRun]);
  useEffect(() => {
    if (section !== "workflows" && runningRef.current) stopTestRun(false);
  }, [section, stopTestRun]);

  const workflowRequestPayload = useMemo(() => ({
    workflow: {
      name: wfName,
      version: 1,
      nodes: nodes.map(n => ({ id: n.id, key: n.key, type: n.type, fields: n.fields, disabled: !!n.disabled })),
      edges: edges.map(e => ({ id: e.id, from: e.from, to: e.to, port: e.port })),
      metadata: { generatedAt: new Date().toISOString(), source: "frontend-simulator" },
    },
  }), [wfName, nodes, edges]);

  /* ── RENDER ── */
  const sectionMeta = PORTAL_SECTIONS.find(s => s.key === section) || PORTAL_SECTIONS[0];
  const canUndo = historyVersion >= 0 && historyRef.current.length > 0;
  const canRedo = historyVersion >= 0 && futureRef.current.length > 0;
  const topCards = useMemo(() => ([
    { title:"Workflows", value:`${nodes.length}`, note:"Active nodes" },
    { title:"Automation", value:"12", note:"Running journeys" },
    { title:"CRM", value:"2.4k", note:"Contacts in flow" },
    { title:"Conversion", value:"8.7%", note:"Engagement rate" },
  ]), [nodes.length]);

  return (
    <>
      <style>{globalCss(T)}</style>
      <div style={{ display:"flex", height:"100vh", width:"100vw", overflow:"hidden", background:T.bg0 }}>

        {/* Portal navigation rail */}
        <div style={{
          width:80, borderRight:`1px solid ${T.b0}`, background:T.bg1, flexShrink:0,
          display:"flex", flexDirection:"column", alignItems:"center", padding:"12px 10px", gap:8,
        }}>
          <div style={{
            width:42, height:42, borderRadius:12, background:"linear-gradient(135deg,#f5a623,#e8761a)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:700, color:"#000",
            boxShadow:"0 0 20px rgba(245,166,35,0.35)", marginBottom:4,
          }}>⚡</div>
          {PORTAL_SECTIONS.map(item => (
            <button
              key={item.key}
              title={item.name}
              onClick={() => navigateToSection(item.key)}
              style={{
                width:48, height:48, borderRadius:12,
                border:`1px solid ${section === item.key ? T.amber+"66" : T.b0}`,
                background:section === item.key ? T.amberDim : T.bg2, color:section === item.key ? T.amber : T.t2,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:11, fontWeight:700, letterSpacing:"0.04em",
                cursor:"pointer",
              }}
            >
              {item.label}
            </button>
          ))}
          <div style={{ flex:1 }} />
          <div style={{ width:42, height:42, borderRadius:12, background:T.bg3, border:`1px solid ${T.b1}`, display:"flex", alignItems:"center", justifyContent:"center", color:T.t2, fontSize:13 }}>⚙</div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", flex:1, minWidth:0 }}>

        {/* ── TOP BAR ── */}
        <div style={{ minHeight:88, background:T.bg1, borderBottom:`1px solid ${T.b0}`, display:"flex", flexDirection:"column", justifyContent:"center", padding:"10px 16px", gap:8, flexShrink:0, zIndex:100 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:8, paddingRight:14, borderRight:`1px solid ${T.b0}`, flexShrink:0 }}>
            <div style={{ width:28, height:28, borderRadius:7, background:"linear-gradient(135deg,#f5a623,#e8761a)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, boxShadow:"0 0 12px rgba(245,166,35,0.4)" }}>⚡</div>
            <span style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700 }}>Flow<span style={{ color:T.amber }}>matic</span></span>
          </div>
          {/* Workflow name */}
          <input
            value={wfName}
            onChange={e => setWfName(e.target.value)}
            style={{ background:"none", border:"none", outline:"none", fontFamily:"'Syne',sans-serif", fontSize:13.5, fontWeight:600, color:T.t1, width:260, padding:"4px 8px", borderRadius:7, transition:"background 0.15s", cursor:"text" }}
            onFocus={e => e.target.style.background = T.bg3}
            onBlur={e => e.target.style.background = "none"}
          />
          {/* Status */}
          <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:T.t3 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:T.green, boxShadow:`0 0 6px ${T.green}`, animation:"pulse 2s infinite" }} />
            {nodes.length} nodes · Active
          </div>
          {section === "workflows" && (
            <div style={{ fontSize:11.5, color: runtime.status === "running" ? T.amber : runtime.status === "completed" ? T.green : T.t3 }}>
              {runtime.status === "running" ? "Runtime running..." : runtime.status === "completed" ? "Last run completed" : "Runtime idle"}
            </div>
          )}
          <div style={{ fontSize:11.5, color:T.t3 }}>
            {lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Autosave enabled"}
          </div>
          <div style={{ fontSize:11.5, color:T.t2, background:T.bg2, border:`1px solid ${T.b0}`, borderRadius:99, padding:"4px 10px" }}>
            {sectionMeta.name} - {sectionMeta.desc}
          </div>
          <div style={{ flex:1 }} />
          {/* Actions */}
          <Btn variant="ghost" onClick={undo} disabled={!canUndo}>↩ Undo</Btn>
          <Btn variant="ghost" onClick={redo} disabled={!canRedo}>↪ Redo</Btn>
          <Btn variant="ghost" onClick={fitView}>⊡ Fit</Btn>
          <Btn variant="ghost" onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}>{themeMode === "dark" ? "☀ Light" : "🌙 Dark"}</Btn>
          {selectedEdge && <Btn variant="danger" onClick={() => deleteEdge(selectedEdge)}>🗑 Delete Link</Btn>}
          <Btn variant="secondary" onClick={() => setModal(true)}>+ Add Node</Btn>
          <Btn variant="secondary" onClick={saveCurrentWorkflow}>💾 Save</Btn>
          <Btn variant="secondary" onClick={() => { navigator.clipboard?.writeText(JSON.stringify(workflowRequestPayload, null, 2)); toast("Workflow request payload copied"); }}>⎘ Request</Btn>
          {runtime.status === "running"
            ? <Btn variant="danger" onClick={() => { stopTestRun(false); toast("Run stopped", "warn"); }}>■ Stop</Btn>
            : <Btn variant="secondary" onClick={runWorkflowSimulation}>▷ Test</Btn>}
          <Btn variant="primary" onClick={() => toast("Workflow published 🎉")}>⬆ Publish</Btn>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {topCards.map(card => (
              <div key={card.title} style={{
                flex:"1 1 0", minWidth:110, background:T.bg2, border:`1px solid ${T.b0}`, borderRadius:10, padding:"8px 10px",
              }}>
                <div style={{ fontSize:10.5, color:T.t3, textTransform:"uppercase", letterSpacing:"0.06em" }}>{card.title}</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:T.t1, lineHeight:1.1, marginTop:2 }}>{card.value}</div>
                <div style={{ fontSize:10.5, color:T.t2, marginTop:2 }}>{card.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {section === "workflows" && (
            <>
              {/* Sidebar */}
              <Sidebar onDragStart={onSidebarDragStart} />

              {/* Canvas */}
              <div
                ref={wrapRef}
                style={{
                  flex:1, position:"relative", overflow:"hidden", cursor: panning.current ? "grabbing" : "default",
                  background:T.bg0,
                  backgroundImage:`radial-gradient(circle at 50% 40%, ${T.amberGlow} 0%, transparent 55%), radial-gradient(${T.bg2} 1px, transparent 1px)`,
                  backgroundSize:`100% 100%, 26px 26px`,
                }}
                onMouseDown={onCanvasMouseDown}
                onDragOver={e => e.preventDefault()}
                onDrop={onDrop}
                onContextMenu={e => { e.preventDefault(); setCtx(null); }}
              >
            {/* Canvas hint */}
            <div style={{ position:"absolute", top:14, left:"50%", transform:"translateX(-50%)", background:T.bg2, border:`1px solid ${T.b1}`, borderRadius:99, padding:"5px 14px", fontSize:11, color:T.t3, pointerEvents:"none", zIndex:50, whiteSpace:"nowrap" }}>
              Drag nodes from left · Scroll to zoom · Drag ports to connect
            </div>

            {/* Zoom controls */}
            <div style={{ position:"absolute", bottom:16, left:"50%", transform:"translateX(-50%)", display:"flex", alignItems:"center", gap:4, background:T.bg1, border:`1px solid ${T.b1}`, borderRadius:12, padding:"4px 6px", zIndex:50, boxShadow:"0 4px 20px rgba(0,0,0,0.4)" }}>
              <Btn variant="ghost" size="sm" onClick={() => setScale(s => clamp(s-0.12,0.25,2))}>−</Btn>
              <span style={{ fontSize:11.5, color:T.t2, minWidth:38, textAlign:"center" }}>{Math.round(scale*100)}%</span>
              <Btn variant="ghost" size="sm" onClick={() => setScale(s => clamp(s+0.12,0.25,2))}>+</Btn>
              <div style={{ width:1, height:16, background:T.b1, margin:"0 2px" }} />
              <Btn variant="ghost" size="sm" onClick={fitView}>Fit</Btn>
            </div>

            {/* Transformed canvas */}
            <div
              style={{ position:"absolute", inset:0, transformOrigin:"0 0", transform:`translate(${pan.x}px, ${pan.y}px) scale(${scale})`, willChange:"transform" }}
            >
              {/* SVG edges */}
              <Edges nodes={nodes} edges={edges} connecting={connecting} activeEdgeId={runtime.activeEdgeId} selectedEdgeId={selectedEdge} onEdgeClick={selectEdge} />

              {/* Nodes */}
              {nodes.map(n => (
                <NodeCard
                  key={n.id}
                  node={n}
                  selected={n.id === selected}
                  isExecuting={runtime.activeNodeId === n.id}
                  onSelect={() => { setSelected(n.id); setSelectedEdge(null); }}
                  onDelete={() => deleteNode(n.id)}
                  onDragStart={e => onNodeDragStart(e, n.id)}
                  onPortMouseDown={port => onPortMouseDown(n.id, port)}
                  onPortMouseUp={port => onPortMouseUp(n.id, port)}
                  onAddAfter={() => { setModalAfter(n.id); setModal(true); }}
                  onContextMenu={(e) => onCtxMenu(e, n.id)}
                />
              ))}
            </div>
              </div>

              {/* Panel */}
              <Panel
                node={selectedNode}
                nodes={nodes}
                onUpdate={updateNode}
                onDelete={deleteNode}
            tab={panelTab}
            onTabChange={setPanelTab}
              />
            </>
          )}

          {section === "automation" && <AutomationDashboard />}
          {section === "crm" && <CrmDashboard />}
          {section === "analytics" && (
            <div style={{ flex:1, padding:16, display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:12 }}>
              <PortalCard title="Revenue Influenced" value="$126k" note="Last 30 days attribution" accent={T.green} />
              <PortalCard title="Top Channel" value="Email" note="48% contribution" accent={T.blue} />
              <PortalCard title="Automation Lift" value="+19%" note="Compared to manual campaigns" accent={T.purple} />
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Modals & overlays */}
      <NodeModal open={modal} onClose={() => { setModal(false); setModalAfter(null); }} onAdd={handleModalAdd} />

      <ContextMenu
        ctx={ctx}
        onDuplicate={() => {
          const n = nodes.find(x => x.id === ctx.nodeId);
          if (n) {
            const def = NODE_DEFS.find(d => d.key === n.key) || n;
            addNodeAt(def, n.x + NODE_W + 20, n.y);
          }
        }}
        onDelete={() => deleteNode(ctx.nodeId)}
        onDisable={() => toggleNodeDisabled(ctx.nodeId)}
        onEdit={() => { setSelected(ctx.nodeId); setPanelTab("config"); }}
        onAddAfter={() => { setModalAfter(ctx.nodeId); setModal(true); }}
        onClose={() => setCtx(null)}
      />

      <ToastLayer toasts={toasts} />
      {section === "workflows" && runtime.logs.length > 0 && (
        <div style={{
          position:"fixed", right:18, bottom:18, width:340, maxHeight:180, overflowY:"auto",
          background:T.bg1, border:`1px solid ${T.b1}`, borderRadius:12, padding:"10px 12px", zIndex:500,
          boxShadow:"0 10px 36px rgba(0,0,0,0.45)",
        }}>
          <div style={{ fontSize:11, color:T.t3, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Runtime Log</div>
          {runtime.logs.slice(-8).map((line, idx) => (
            <div key={`${line}-${idx}`} style={{ fontSize:11.5, color:T.t2, lineHeight:1.5, borderTop: idx ? `1px solid ${T.b0}` : "none", paddingTop: idx ? 6 : 0, marginTop: idx ? 6 : 0 }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </>
  );
}