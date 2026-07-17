/**
 * JDI Diary — app.js  (Mobile-Optimized)
 * Just Do It · 월간/주간/일간 스마트 다이어리
 */

'use strict';

/* ══ Constants ══ */
const STORAGE_KEY  = 'jdi_diary_v2';
const SETTINGS_KEY = 'jdi_settings_v1';
const MONTHS_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const DAYS_KO   = ['일','월','화','수','목','금','토'];

const $  = id => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls)      e.className   = cls;
  if (text != null) e.textContent = text;
  return e;
};
const pad = n => String(n).padStart(2,'0');
const dateKey  = (y,m,d) => `${y}-${pad(m+1)}-${pad(d)}`;
const monthKey = (y,m)   => `${y}-${pad(m+1)}`;
const weekKey  = (y,m,w) => `${y}-${pad(m+1)}-W${w}`;
const today    = () => { const d=new Date(); return {y:d.getFullYear(),m:d.getMonth(),d:d.getDate()}; };
const isMobile = () => window.innerWidth < 768;

function updateMobileMode() {
  // Use innerWidth as primary, matchMedia as secondary check
  const byWidth = window.innerWidth < 768;
  const byMedia = window.matchMedia('(max-width: 767px)').matches;
  const mobile = byWidth || byMedia;
  document.body.classList.toggle('mobile-mode', mobile);
  // Hide sidebar on mobile
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.style.display = mobile ? 'none' : '';
  return mobile;
}

/* ══ Data Store ══ */
let db = { months:{}, weeks:{}, days:{} };
let settings = { dark:false, autoSave:true, scrollNow:true, googleClientId:'' };

function loadData() {
  try { const r=localStorage.getItem(STORAGE_KEY); if(r) db={months:{},weeks:{},days:{},...JSON.parse(r)}; } catch(e){}
  try { const r=localStorage.getItem(SETTINGS_KEY); if(r) settings={...settings,...JSON.parse(r)}; } catch(e){}
}
function saveData() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch(e){ showToast('⚠️ 저장 공간 부족'); }
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch(e){}
}

/* ══ App State ══ */
let state = {
  view: 'month',
  year: 0, month: 0,
  week: 1, day: 1,
  activeCol: 'just',    // mobile timeline active column
  autoSaveTimer: null,
  deferredInstall: null, // PWA install prompt
  accessToken: null     // OAuth2 access token
};

/* ══ Week Calculation ══ */
function getWeeks(year, month) {
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0: 일요일, ..., 6: 토요일

  const weeks = [];
  let currentStart = 1;
  let weekIndex = 1;

  let currentEnd = 1 + (6 - firstDayOfWeek);
  if (currentEnd > daysInMonth) {
    currentEnd = daysInMonth;
  }

  weeks.push({ week: weekIndex, start: currentStart, end: currentEnd });

  while (currentEnd < daysInMonth) {
    weekIndex++;
    currentStart = currentEnd + 1;
    currentEnd = currentStart + 6;
    if (currentEnd > daysInMonth) {
      currentEnd = daysInMonth;
    }
    weeks.push({ week: weekIndex, start: currentStart, end: currentEnd });
  }

  return weeks;
}

function getWeekForDay(d, year = state.year, month = state.month) {
  const weeks = getWeeks(year, month);
  const found = weeks.find(w => d >= w.start && d <= w.end);
  return found ? found.week : 1;
}

/* ══ Monthly Goals Logic ══ */
function getMonthData() {
  const k=monthKey(state.year,state.month);
  if(!db.months[k]) db.months[k]={goals:[]};
  return db.months[k];
}
function addMonthlyGoal(text='') {
  getMonthData().goals.push({ id:Date.now().toString(36), text, done:false });
  saveData(); return true;
}
function removeMonthlyGoal(id) {
  const d=getMonthData(); d.goals=d.goals.filter(g=>g.id!==id); saveData();
}

function parseGoalQuantity(text) {
  const p = /(\d+)\s*(권|개|회|번|장|편|km|kg|시간|분|페이지|p|박스|병|잔|세트)/;
  const m = text.match(p);
  if(m) { const n=parseInt(m[1]); const u=m[2]; if(n&&u) return {num:n,unit:u}; }
  return null;
}

function distributeGoalsToWeeks() {
  const data = getMonthData();
  const weeks = getWeeks(state.year, state.month);
  const filled = data.goals.filter(g=>g.text.trim());
  if(!filled.length) return null;

  const weekGoals = weeks.map(()=>[]);
  const preview   = [];

  for(const goal of filled) {
    const parsed = parseGoalQuantity(goal.text);
    for(let wi=0;wi<weeks.length;wi++) {
      let weekText, targetProgress;
      if(parsed) {
        const base = goal.text.replace(/\d+\s*(권|개|회|번|장|편|km|kg|시간|분|페이지|p|박스|병|잔|세트)/g,'').trim().replace(/\s+/g,' ');
        const share = wi < (parsed.num % weeks.length || weeks.length)
          ? Math.ceil(parsed.num/weeks.length)
          : Math.floor(parsed.num/weeks.length);
        weekText = `${base} [${share}${parsed.unit}]`.trim();
        targetProgress = Math.round((share/parsed.num)*100);
      } else {
        weekText = goal.text.trim();
        targetProgress = Math.round(100/weeks.length);
      }
      weekGoals[wi].push({
        id:`${goal.id}-w${wi+1}`,
        text:weekText, done:false, progress:0,
        targetProgress, fromGoalId:goal.id, fromGoalText:goal.text
      });
    }
  }
  weeks.forEach((w,i)=>preview.push({week:w.week, goals:weekGoals[i]}));
  return { weekGoals, weeks, preview };
}

function applyDistribution(weekGoals, weeks) {
  weeks.forEach((w,i)=>{
    const k=weekKey(state.year,state.month,w.week);
    if(!db.weeks[k]) db.weeks[k]={goals:[]};
    const manual=(db.weeks[k].goals||[]).filter(g=>!g.fromGoalId);
    db.weeks[k].goals=[...weekGoals[i],...manual];
  });
  saveData();
}

/* ══ Day Data ══ */
function getDayData() {
  const k=dateKey(state.year,state.month,state.day);
  if(!db.days[k]) db.days[k]={ timeline:Array.from({length:25},(_,i)=>({hour:i,just:'',do:'',it:''})) };
  while(db.days[k].timeline.length<25) db.days[k].timeline.push({hour:db.days[k].timeline.length,just:'',do:'',it:''});
  return db.days[k];
}
function saveDayFromDOM() {
  const k=dateKey(state.year,state.month,state.day);
  if(!db.days[k]) db.days[k]={timeline:[]};
  const rows=$('timeline-body').querySelectorAll('.timeline-row');
  rows.forEach((row,i)=>{
    if(!db.days[k].timeline[i]) db.days[k].timeline[i]={hour:i,just:'',do:'',it:''};
    row.querySelectorAll('.entry-textarea').forEach(ta=>{
      const col=ta.dataset.col;
      if(col) db.days[k].timeline[i][col]=ta.value;
    });
  });
  saveData();
}

/* ══ Render ══ */
function renderAll() {
  renderHeader();
  renderSidebar();
  switch(state.view) {
    case 'month': renderMonthView(); break;
    case 'week':  renderWeekView();  break;
    case 'day':   renderDayView();   break;
  }
}

function renderHeader() {
  $('sidebar-month-label').textContent=`${state.year}년 ${MONTHS_KO[state.month]}`;
  $('header-subtitle').textContent=`${state.year}. ${pad(state.month+1)}`;
  if($('month-view-title'))  $('month-view-title').textContent=`${state.year}년 ${MONTHS_KO[state.month]}`;
  if($('week-view-title'))   $('week-view-title').textContent=`${state.year}년 ${MONTHS_KO[state.month]}`;
}

function renderSidebar() {
  renderWeekTabs();
  renderSidebarWeeklyGoals();
  renderDayPicker();
}

function renderWeekTabs() {
  const c=$('week-tabs'); c.innerHTML='';
  getWeeks(state.year,state.month).forEach(w=>{
    const b=el('button','week-tab',`W${w.week}`);
    if(w.week===state.week) b.classList.add('active');
    b.addEventListener('click',()=>{ state.week=w.week; renderAll(); });
    c.appendChild(b);
  });
}

function renderSidebarWeeklyGoals() {
  const c=$('weekly-goals-list'); c.innerHTML='';
  const k=weekKey(state.year,state.month,state.week);
  const wData=db.weeks[k]||{goals:[]};
  if(!wData.goals.length){ c.innerHTML='<span style="font-size:12px;color:var(--outline)">주간 배분 없음</span>'; return; }
  wData.goals.forEach(g=>{
    const d=el('div','sidebar-weekly-goal');
    d.appendChild(el('div','goal-text',g.text));
    const bar=el('div','progress-bar-wrap');
    const fill=el('div','progress-bar-fill');
    fill.style.width=(g.done?100:g.progress||0)+'%';
    bar.appendChild(fill); d.appendChild(bar); c.appendChild(d);
  });
}

function renderDayPicker() {
  const c=$('day-picker'); c.innerHTML='';
  const daysInMonth=new Date(state.year,state.month+1,0).getDate();
  const firstDow=new Date(state.year,state.month,1).getDay();
  const t=today();
  DAYS_KO.forEach(d=>{ const h=el('div','label-mono',d); h.style.cssText='text-align:center;padding:3px 0;font-size:9px;'; c.appendChild(h); });
  for(let i=0;i<firstDow;i++) c.appendChild(el('div',''));
  for(let d=1;d<=daysInMonth;d++){
    const b=el('button','day-pick-btn');
    const numSpan=el('span','day-pick-num',d);
    b.appendChild(numSpan);
    
    const dk=dateKey(state.year,state.month,d);
    if(db.days[dk] && db.days[dk].sticker) {
      const stickerSpan=el('span','day-pick-sticker',db.days[dk].sticker);
      b.appendChild(stickerSpan);
    }
    
    if(d===state.day) b.classList.add('selected');
    if(d===t.d&&state.month===t.m&&state.year===t.y) b.classList.add('today');
    if(db.days[dk]&&db.days[dk].timeline?.some(r=>r.just||r.do||r.it)) b.classList.add('has-data');
    
    b.addEventListener('click',()=>{
      if(state.view==='day') saveDayFromDOM();
      state.day=d; state.week=getWeekForDay(d); switchView('day');
    });
    
    // Drag & Drop for calendar day
    b.addEventListener('dragover', e => {
      e.preventDefault();
      b.classList.add('drag-over');
    });
    b.addEventListener('dragleave', () => {
      b.classList.remove('drag-over');
    });
    b.addEventListener('drop', e => {
      e.preventDefault();
      b.classList.remove('drag-over');
      const emoji = e.dataTransfer.getData('text/plain');
      if (emoji) {
        if (!db.days[dk]) {
          db.days[dk] = { timeline: Array.from({length: 25}, (_, i) => ({hour: i, just: '', do: '', it: ''})) };
        }
        db.days[dk].sticker = emoji;
        saveData();
        renderDayPicker();
        if (d === state.day) {
          renderDayView();
        }
        showToast(`📅 ${d}일에 스티커가 붙었습니다!`);
      }
    });
    
    c.appendChild(b);
  }
}

/* ── Month View ── */
function renderMonthView() { renderMonthlyGoals(); renderWeeklySummary(); }

function renderMonthlyGoals() {
  const c=$('monthly-goals-list'); c.innerHTML='';
  const data=getMonthData();
  if(!data.goals.length){
    const hint=el('div','');
    hint.style.cssText='color:var(--outline);font-size:13px;padding:12px 0;grid-column:1/-1;text-align:center;';
    hint.textContent='+ 목표 추가 버튼을 눌러 시작하세요';
    c.appendChild(hint); return;
  }
  data.goals.forEach(goal=>c.appendChild(buildGoalItem(goal)));
}

function buildGoalItem(goal) {
  const item=el('div','goal-item'); item.dataset.id=goal.id;
  const top=el('div','goal-item-top');
  const box=el('div','goal-checkbox');
  if(goal.done) box.classList.add('checked');
  box.addEventListener('click',()=>{
    goal.done=!goal.done;
    box.classList.toggle('checked',goal.done);
    input.classList.toggle('done',goal.done);
    const p=goal.done?100:calcGoalProgress(goal);
    fill.style.width=p+'%'; pct.textContent=p+'%';
    scheduleAutoSave();
  });
  const input=el('input','goal-input');
  input.type='text'; input.value=goal.text;
  input.placeholder='목표를 입력하세요... (예: 책 4권 읽기)';
  if(goal.done) input.classList.add('done');
  /* iOS font-size ≥16px prevents zoom */
  input.style.fontSize='16px';
  input.addEventListener('input',()=>{ goal.text=input.value; scheduleAutoSave(); });
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault(); addMonthlyGoal(''); renderMonthlyGoals();
      setTimeout(()=>{ const ins=$('monthly-goals-list').querySelectorAll('.goal-input'); ins[ins.length-1]?.focus(); },50);
    }
  });
  const rm=el('button','goal-remove','✕'); rm.title='삭제';
  rm.addEventListener('click',()=>{ removeMonthlyGoal(goal.id); renderMonthlyGoals(); renderWeeklySummary(); });
  top.append(box,input,rm);
  const meta=el('div','goal-meta');
  const prog=calcGoalProgress(goal);
  const pct=el('span','goal-percent',(goal.done?100:prog)+'%');
  meta.appendChild(pct);
  const bar=el('div','goal-progress');
  const fill=el('div','goal-progress-fill'); fill.style.width=(goal.done?100:prog)+'%';
  bar.appendChild(fill);
  item.append(top,meta,bar); return item;
}

function calcGoalProgress(goal) {
  if(goal.done) return 100;
  const mk=monthKey(state.year,state.month);
  let all=[];
  for(const k of Object.keys(db.weeks)){
    if(k.startsWith(mk)) (db.weeks[k].goals||[]).filter(g=>g.fromGoalId===goal.id).forEach(g=>all.push(g));
  }
  if(!all.length) return 0;
  return Math.round((all.filter(g=>g.done).length/all.length)*100);
}

function renderWeeklySummary() {
  const c=$('weekly-summary-grid'); c.innerHTML='';
  getWeeks(state.year,state.month).forEach(w=>{
    const k=weekKey(state.year,state.month,w.week);
    const wData=db.weeks[k]||{goals:[]};
    const card=el('div','week-summary-card');
    if(w.week===state.week) card.classList.add('active-week');
    const done=wData.goals.filter(g=>g.done).length;
    const pct=Math.round((done/(wData.goals.length||1))*100);
    card.innerHTML=`
      <div class="week-card-label">${w.week}주차</div>
      <div class="week-card-date">${state.month+1}/${w.start}–${state.month+1}/${w.end}</div>
      <div class="week-card-goals">${
        wData.goals.length
          ? wData.goals.slice(0,3).map(g=>`<div class="week-card-goal-item"${g.done?' style="text-decoration:line-through;color:var(--outline)"':''}>${g.text}</div>`).join('')
            + (wData.goals.length>3?`<div class="week-card-goal-item" style="color:var(--outline)">+${wData.goals.length-3}개 더</div>`:'')
          : '<span style="color:var(--outline);font-size:12px">목표 없음</span>'
      }</div>
      <div class="week-card-progress"><div class="week-card-progress-fill" style="width:${pct}%"></div></div>
      <div class="week-card-percent">${pct}% 완료</div>`;
    card.addEventListener('click',()=>{ state.week=w.week; switchView('week'); });
    c.appendChild(card);
  });
}

/* ── Week View ── */
function renderWeekView() {
  renderWeekTabBarMain();
  renderWeeklyGoalsMain();
}

function renderWeekTabBarMain() {
  const c=$('week-tab-bar-main'); c.innerHTML='';
  const weeks=getWeeks(state.year,state.month);
  weeks.forEach(w=>{
    const b=el('button','week-tab-main',`${w.week}주차`);
    if(w.week===state.week) b.classList.add('active');
    b.addEventListener('click',()=>{ state.week=w.week; renderWeekView(); renderSidebar(); });
    c.appendChild(b);
  });
  const cw=weeks.find(w=>w.week===state.week);
  if(cw) $('week-date-range').textContent=`${state.month+1}/${cw.start} — ${state.month+1}/${cw.end}`;
}

function renderWeeklyGoalsMain() {
  const c=$('weekly-goals-main-list'); c.innerHTML='';
  const k=weekKey(state.year,state.month,state.week);
  if(!db.weeks[k]) db.weeks[k]={goals:[]};
  const {goals}=db.weeks[k];
  if(!goals.length){
    const e=el('div','');
    e.style.cssText='padding:28px 16px;text-align:center;color:var(--outline);font-size:14px;line-height:1.8;';
    e.innerHTML='주간 목표가 없습니다.<br><small>월간 목표 입력 후 <strong>자동 배분</strong>을 사용하거나,<br>직접 추가하세요.</small>';
    c.appendChild(e); return;
  }
  goals.forEach((g,idx)=>c.appendChild(buildWeeklyGoalRow(g,idx,k)));
}

function buildWeeklyGoalRow(goal,idx,wk) {
  const row=el('div','weekly-goal-row');
  const top=el('div','wgoal-top');
  if(goal.fromGoalText){
    const badge=el('span','wgoal-from-badge',goal.fromGoalText.length>10?goal.fromGoalText.slice(0,10)+'…':goal.fromGoalText);
    badge.title=goal.fromGoalText; top.appendChild(badge);
  }
  const inp=el('input','wgoal-input'); inp.type='text'; inp.value=goal.text;
  inp.placeholder='주간 목표 입력...'; inp.style.fontSize='16px';
  inp.addEventListener('input',()=>{ goal.text=inp.value; scheduleAutoSave(); });
  const rm=el('button','goal-remove','✕'); rm.style.display='flex';
  rm.addEventListener('click',()=>{ db.weeks[wk].goals.splice(idx,1); saveData(); renderWeeklyGoalsMain(); renderSidebarWeeklyGoals(); renderWeeklySummary(); });
  top.append(inp,rm);
  const pr=el('div','wgoal-progress-row');
  const cb=el('button','wgoal-complete-btn'); if(goal.done) cb.classList.add('done');
  const pw=el('div','wgoal-progress-wrap');
  const pf=el('div','wgoal-progress-fill'); pf.style.width=(goal.done?100:goal.progress||0)+'%'; pw.appendChild(pf);
  const pt=el('span','wgoal-percent',`${goal.done?100:goal.targetProgress||25}%`);
  cb.addEventListener('click',()=>{ goal.done=!goal.done; cb.classList.toggle('done',goal.done); pf.style.width=(goal.done?100:0)+'%'; scheduleAutoSave(); renderWeeklySummary(); renderMonthlyGoals(); renderSidebarWeeklyGoals(); });
  pr.append(cb,pw,pt);
  row.append(top,pr); return row;
}

/* ── Day View ── */
function renderDayView() {
  const d=new Date(state.year,state.month,state.day);
  const dow=DAYS_KO[d.getDay()];
  
  const titleText = isMobile()
    ? `${state.month+1}/${state.day} (${dow})`
    : `${state.year}년 ${state.month+1}월 ${state.day}일 (${dow})`;
    
  $('day-view-title').innerHTML = '';
  $('day-view-title').appendChild(document.createTextNode(titleText));
  
  const dk = dateKey(state.year, state.month, state.day);
  const sticker = db.days[dk]?.sticker;
  if (sticker) {
    const wrap = el('span', 'day-header-sticker-wrap');
    const st = el('span', 'day-header-sticker', sticker);
    st.title = '클릭 시 스티커 삭제';
    st.addEventListener('click', () => {
      if(confirm('이 날짜의 스티커를 삭제하시겠습니까?')) {
        db.days[dk].sticker = '';
        saveData();
        renderDayPicker();
        renderDayView();
      }
    });
    const rm = el('span', 'day-header-sticker-remove', '✕');
    wrap.append(st, rm);
    $('day-view-title').appendChild(wrap);
  }

  renderDayGoalsBar();
  renderColSwitcherUI();
  renderTimeline();
  renderNowIndicator();
}

function renderDayGoalsBar() {
  const c=$('day-goals-bar'); c.innerHTML='';
  const k=weekKey(state.year,state.month,getWeekForDay(state.day));
  const {goals=[]}=db.weeks[k]||{};
  if(!goals.length){ c.appendChild(el('span','day-goal-chip','이번 주 목표 없음')); return; }
  goals.forEach(g=>{ const chip=el('div','day-goal-chip',g.text); if(g.done) chip.classList.add('done'); c.appendChild(chip); });
}

/* ── Mobile Column Switcher ── */
function renderColSwitcherUI() {
  // Update active col switcher button
  document.querySelectorAll('.col-switch-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.col===state.activeCol);
  });
  // Update mobile header
  const colMeta = {
    just:{ label:'[just]', sub:'할 일' },
    do:  { label:'[do]',   sub:'한 일' },
    it:  { label:'[it]',   sub:'칭찬/반성' }
  };
  const meta = colMeta[state.activeCol] || colMeta.just;
  const lbl=$('mobile-col-label'); const sub=$('mobile-col-sub');
  if(lbl) lbl.textContent=meta.label;
  if(sub) sub.textContent=meta.sub;
}

function switchActiveCol(col) {
  state.activeCol=col;
  renderColSwitcherUI();
  const mobile = document.body.classList.contains('mobile-mode');
  // Update visible cells
  $('timeline-body').querySelectorAll('.entry-cell').forEach(cell=>{
    if(mobile){
      cell.classList.toggle('col-active', cell.dataset.col===col);
    } else {
      cell.classList.add('col-active');
    }
  });
}

/* ── Timeline ── */
function renderTimeline() {
  const c=$('timeline-body'); c.innerHTML='';
  const dayData=getDayData();
  const now=new Date();
  const curHour=(state.year===now.getFullYear()&&state.month===now.getMonth()&&state.day===now.getDate())
    ? now.getHours() : -1;
  const mobile = document.body.classList.contains('mobile-mode');

  for(let h=0;h<=24;h++){
    const rd=dayData.timeline[h]||{hour:h,just:'',do:'',it:''};
    const row=el('div','timeline-row');
    row.classList.add('hour-mark');
    if(h===curHour) row.classList.add('current-hour');

    const tc=el('div','time-cell');
    tc.textContent=`${pad(h)}:00`;
    if(h===curHour) tc.classList.add('current-time');

    const jc=buildEntryCell(rd,'just','할 일 메모...');
    const dc=buildEntryCell(rd,'do','한 일 기록...');
    const ic=buildEntryCell(rd,'it','칭찬 또는 반성...');

    // Mobile: only active col is visible
    if(mobile){
      jc.classList.toggle('col-active', state.activeCol==='just');
      dc.classList.toggle('col-active', state.activeCol==='do');
      ic.classList.toggle('col-active', state.activeCol==='it');
    } else {
      jc.classList.add('col-active');
      dc.classList.add('col-active');
      ic.classList.add('col-active');
    }

    row.append(tc,jc,dc,ic);
    c.appendChild(row);
  }

  if(settings.scrollNow && curHour>=0){
    setTimeout(()=>{
      const rows=c.querySelectorAll('.current-hour');
      if(rows.length) rows[0].scrollIntoView({block:'center',behavior:'smooth'});
    },150);
  }
}

function buildEntryCell(rowData, col, placeholder) {
  const cell=el('div','entry-cell');
  cell.dataset.col=col;
  cell.classList.add(`col-${col}`);
  const ta=el('textarea','entry-textarea');
  ta.value=rowData[col]||'';
  ta.placeholder=placeholder;
  ta.rows=1;
  ta.dataset.col=col;
  /* Prevent iOS zoom: font-size ≥ 16px */
  ta.style.fontSize='16px';
  ta.addEventListener('input',()=>{
    ta.style.height='auto';
    ta.style.height=ta.scrollHeight+'px';
    rowData[col]=ta.value;
    scheduleAutoSave();
  });
  ta.addEventListener('keydown',e=>{
    if(e.key==='Tab'&&!e.shiftKey){
      e.preventDefault();
      const all=cell.parentElement.querySelectorAll('.entry-textarea');
      const idx=Array.from(all).indexOf(ta);
      if(idx<all.length-1) all[idx+1].focus();
    }
  });
  
  // Drag & drop emoji to textarea
  cell.addEventListener('dragover', e => {
    e.preventDefault();
    cell.classList.add('drag-over');
  });
  cell.addEventListener('dragleave', () => {
    cell.classList.remove('drag-over');
  });
  cell.addEventListener('drop', e => {
    e.preventDefault();
    cell.classList.remove('drag-over');
    const emoji = e.dataTransfer.getData('text/plain');
    if (emoji) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const text = ta.value;
      ta.value = text.substring(0, start) + emoji + text.substring(end);
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + emoji.length;
      ta.dispatchEvent(new Event('input'));
    }
  });

  if(rowData[col]){
    requestAnimationFrame(()=>{ ta.style.height='auto'; ta.style.height=ta.scrollHeight+'px'; });
  }
  cell.appendChild(ta); return cell;
}

function renderNowIndicator() {
  const ind=$('now-indicator');
  if(!ind) return;
  const now=new Date();
  const isToday=state.year===now.getFullYear()&&state.month===now.getMonth()&&state.day===now.getDate();
  if(isToday){
    ind.classList.add('visible');
    $('now-label').textContent=`현재: ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  } else {
    ind.classList.remove('visible');
  }
}

/* ══ View Switching ══ */
function switchView(view) {
  if(state.view==='day' && view!=='day') saveDayFromDOM();
  state.view=view;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  $(`view-${view}`).classList.add('active');
  document.querySelectorAll('.bottom-nav-item[data-view], .bottom-nav-fab').forEach(b=>{
    b.classList.toggle('active', b.dataset.view===view);
    if(b.classList.contains('bottom-nav-fab')) b.classList.toggle('active-fab', b.dataset.view===view);
  });
  document.querySelectorAll('.drawer-item[data-view]').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  closeDrawer();
  renderAll();
  // Scroll to top of content
  $('main-content')?.scrollTo({top:0,behavior:'smooth'});
}

/* ══ Modal Helpers ══ */
function openModal(id) { $(id).classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }

function showToast(msg, duration=2500) {
  const t=$('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), duration);
}

/* ══ Drawer ══ */
function openDrawer()  { $('drawer').classList.add('open'); $('drawer-overlay').classList.add('open'); }
function closeDrawer() { $('drawer').classList.remove('open'); $('drawer-overlay').classList.remove('open'); }

/* ══ Auto Save ══ */
function scheduleAutoSave() {
  if(!settings.autoSave) return;
  clearTimeout(state.autoSaveTimer);
  state.autoSaveTimer=setTimeout(()=>{ saveDayFromDOM(); saveData(); },1200);
}

/* ══ Touch Swipe Handler ══ */
function addSwipeHandler(element, onSwipeLeft, onSwipeRight) {
  let startX=0, startY=0, moved=false;
  element.addEventListener('touchstart', e=>{
    startX=e.touches[0].clientX;
    startY=e.touches[0].clientY;
    moved=false;
  }, {passive:true});
  element.addEventListener('touchmove', e=>{
    const dx=Math.abs(e.touches[0].clientX-startX);
    const dy=Math.abs(e.touches[0].clientY-startY);
    if(dx>dy&&dx>8) moved=true;
  }, {passive:true});
  element.addEventListener('touchend', e=>{
    if(!moved) return;
    const dx=e.changedTouches[0].clientX-startX;
    const dy=e.changedTouches[0].clientY-startY;
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>40){
      if(dx<0) onSwipeLeft?.();
      else      onSwipeRight?.();
    }
  }, {passive:true});
}

/* ══ Distribute Modal ══ */
function showDistributeModal() {
  const result=distributeGoalsToWeeks();
  if(!result){ showToast('⚠️ 먼저 월간 목표를 입력하세요'); return; }
  const preview=$('distribute-preview'); preview.innerHTML='';
  result.preview.forEach(pw=>{
    const wd=el('div','preview-week');
    wd.appendChild(el('div','preview-week-label',`${pw.week}주차`));
    pw.goals.forEach(g=>wd.appendChild(el('div','preview-goal-line',g.text)));
    preview.appendChild(wd);
  });
  openModal('modal-distribute');
  $('btn-confirm-distribute').onclick=()=>{
    applyDistribution(result.weekGoals,result.weeks);
    closeModal('modal-distribute');
    showToast('✅ 주간 목표가 배분되었습니다!');
    renderAll();
  };
}

/* ══ Google Drive Export ══ */
function generateDocContent() {
  const dim = new Date(state.year, state.month + 1, 0).getDate();
  let dailyTableRows = '';
  
  for (let d = 1; d <= dim; d++) {
    const dk = dateKey(state.year, state.month, d);
    if (!db.days[dk]) continue;
    const tl = db.days[dk].timeline;
    if (!tl?.some(r => r.just || r.do || r.it)) continue;
    const dow = DAYS_KO[new Date(state.year, state.month, d).getDay()];
    
    dailyTableRows += `
      <tr style="background-color: #f3f3f3; font-weight: bold;">
        <td colspan="4" style="border: 1px solid #c2c8c0; padding: 8px; color: #4a654e;">▶ ${state.month + 1}월 ${d}일 (${dow})</td>
      </tr>
    `;
    
    tl.forEach(r => {
      if (r.just || r.do || r.it) {
        dailyTableRows += `
          <tr>
            <td style="border: 1px solid #c2c8c0; padding: 8px; font-family: monospace; text-align: center; font-weight: bold; background-color: #fcfcfc;">${pad(r.hour)}:00</td>
            <td style="border: 1px solid #c2c8c0; padding: 8px; white-space: pre-wrap;">${r.just || ''}</td>
            <td style="border: 1px solid #c2c8c0; padding: 8px; white-space: pre-wrap;">${r.do || ''}</td>
            <td style="border: 1px solid #c2c8c0; padding: 8px; white-space: pre-wrap;">${r.it || ''}</td>
          </tr>
        `;
      }
    });
  }

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>JDI Diary Export - ${state.year}년 ${state.month + 1}월</title>
  <style>
    body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 11pt; line-height: 1.8; margin: 2cm; color: #1a1c1c; }
    h1, h2, h3 { color: #4a654e; }
    .title { font-size: 18pt; font-weight: bold; border-bottom: 2px solid #4a654e; padding-bottom: 8px; margin-bottom: 20px; }
    .section-title { font-size: 13pt; font-weight: bold; margin-top: 25px; margin-bottom: 10px; color: #4a654e; border-left: 4px solid #4a654e; padding-left: 8px; }
    .goal-item { margin-bottom: 6px; list-style-type: square; }
    .done { text-decoration: line-through; color: #737972; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; margin-bottom: 25px; font-size: 10pt; }
    th, td { border: 1px solid #c2c8c0; padding: 8px; text-align: left; }
    th { background-color: #d6e3d8; color: #233d29; font-weight: bold; }
  </style>
</head>
<body>
  <div class="title">JDI DIARY — ${state.year}년 ${MONTHS_KO[state.month]}</div>
  
  <div class="section-title">Monthly Goals (월간 목표)</div>
  <ul>
    ${getMonthData().goals.length ? getMonthData().goals.map(g => `<li class="goal-item ${g.done ? 'done' : ''}">${g.text || '(내용 없음)'}</li>`).join('\n') : '<li>등록된 월간 목표가 없습니다.</li>'}
  </ul>
  
  ${getWeeks(state.year, state.month).map(w => {
    const k = weekKey(state.year, state.month, w.week);
    const { goals = [] } = db.weeks[k] || {};
    return `
      <div class="section-title">${w.week}주차 목표 (${state.month + 1}/${w.start} ~ ${state.month + 1}/${w.end})</div>
      <ul>
        ${goals.length ? goals.map(g => `<li class="goal-item ${g.done ? 'done' : ''}">${g.text || '(내용 없음)'} (${g.done ? 100 : g.targetProgress || 25}%)</li>`).join('\n') : '<li>등록된 주간 목표가 없습니다.</li>'}
      </ul>
    `;
  }).join('\n')}
  
  <div class="section-title">Daily Timeline &amp; Logs (일간 기록)</div>
  ${dailyTableRows ? `
    <table cellpadding="6" cellspacing="0">
      <thead>
        <tr style="background-color: #d6e3d8; color: #233d29;">
          <th width="70" style="text-align: center;">시간</th>
          <th>[just] 할 일</th>
          <th>[do] 한 일</th>
          <th>[it] 칭찬/반성</th>
        </tr>
      </thead>
      <tbody>
        ${dailyTableRows}
      </tbody>
    </table>
  ` : '<p>기록된 일간 다이어리가 없습니다.</p>'}
</body>
</html>`;
  return html;
}

function downloadDocxFallback(htmlContent, filename) {
  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

let tokenClient = null;
function initGoogleAPI() {
  return new Promise((resolve, reject) => {
    if (!settings.googleClientId) {
      reject(new Error('설정에서 Google Client ID를 입력하세요'));
      return;
    }
    
    const setupTokenClient = () => {
      if (window.google?.accounts?.oauth2) {
        if (!tokenClient) {
          tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: settings.googleClientId,
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: (response) => {
              if (response.error) {
                reject(new Error(response.error_description || response.error));
              } else {
                state.accessToken = response.access_token;
                resolve(response.access_token);
              }
            }
          });
        }
        resolve();
      } else {
        reject(new Error('Google Client 라이브러리를 찾을 수 없습니다.'));
      }
    };

    if (!window.google?.accounts?.oauth2) {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = setupTokenClient;
      s.onerror = () => reject(new Error('Google Identity Services 라이브러리 로드 실패'));
      document.head.appendChild(s);
    } else {
      setupTokenClient();
    }
  });
}

async function uploadToDrive(filename, htmlContent) {
  const se = $('drive-status');
  se.textContent = '인증 진행 중...';
  se.className = 'drive-status';
  
  try {
    await initGoogleAPI();

    const doUpload = async () => {
      se.textContent = '구글 드라이브에 저장 중...';
      const boundary = 'JDI_DIARY_UPLOAD_BOUNDARY_1784';
      const metadata = {
        name: filename,
        mimeType: 'application/vnd.google-apps.document' // Convert HTML to editable Google Doc
      };

      const multipartBody = new Blob([
        `--${boundary}\r\n`,
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        JSON.stringify(metadata),
        `\r\n--${boundary}\r\n`,
        'Content-Type: text/html; charset=utf-8\r\n\r\n',
        '\ufeff' + htmlContent,
        `\r\n--${boundary}--`
      ], { type: `multipart/related; boundary=${boundary}` });

      const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      });

      return resp;
    };

    // If no access token, request it first
    if (!state.accessToken) {
      await new Promise((resolve, reject) => {
        tokenClient.callback = (response) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
          } else {
            state.accessToken = response.access_token;
            resolve();
          }
        };
        tokenClient.requestAccessToken({ prompt: '' });
      });
    }

    let resp = await doUpload();

    // If token expired (401), request new token and retry
    if (resp.status === 401) {
      state.accessToken = null;
      se.textContent = '세션 만료. 다시 로그인 중...';
      await new Promise((resolve, reject) => {
        tokenClient.callback = (response) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
          } else {
            state.accessToken = response.access_token;
            resolve();
          }
        };
        tokenClient.requestAccessToken({ prompt: 'consent' });
      });
      resp = await doUpload();
    }

    if (resp.ok) {
      se.textContent = '✅ 구글 드라이브 문서 저장 완료!';
      se.className = 'drive-status success';
      showToast('☁️ 구글 드라이브 저장 완료!');
      setTimeout(() => closeModal('modal-drive'), 2000);
    } else {
      const errText = await resp.text();
      throw new Error(`저장 실패 (${resp.status}): ${errText}`);
    }
  } catch (e) {
    se.textContent = `❌ ${e.message}`;
    se.className = 'drive-status error';
    setTimeout(() => {
      showToast('💾 로컬 파일로 다운로드합니다.');
      downloadDocxFallback(htmlContent, filename);
      closeModal('modal-drive');
    }, 2500);
  }
}

function exportJSON(){
  saveDayFromDOM();
  const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url;
  a.download=`jdi_diary_${state.year}${pad(state.month+1)}.json`;
  a.click(); URL.revokeObjectURL(url);
  showToast('💾 JSON 파일로 저장했습니다');
}
function importJSON(file){
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(data.months||data.weeks||data.days){
        db={months:{},weeks:{},days:{},...data}; saveData(); renderAll(); showToast('✅ 데이터를 불러왔습니다');
      } else showToast('❌ 유효하지 않은 파일');
    } catch(ex){ showToast('❌ JSON 오류: '+ex.message); }
  };
  reader.readAsText(file);
}

/* ══ Settings ══ */
function applySettings(){
  document.documentElement.setAttribute('data-theme', settings.dark?'dark':'');
  $('dark-mode-toggle').checked=settings.dark;
  $('auto-save-toggle').checked=settings.autoSave;
  $('scroll-now-toggle').checked=settings.scrollNow;
  if($('google-client-id')) $('google-client-id').value=settings.googleClientId||'';
}

/* ══ Month/Day Navigation ══ */
function changeMonth(delta){
  if(state.view==='day') saveDayFromDOM();
  state.month+=delta;
  if(state.month<0){state.month=11;state.year--;}
  if(state.month>11){state.month=0;state.year++;}
  state.week=1; state.day=1; renderAll();
}
function changeDay(delta){
  if(state.view==='day') saveDayFromDOM();
  const dim=new Date(state.year,state.month+1,0).getDate();
  state.day+=delta;
  if(state.day<1){
    state.month--; if(state.month<0){state.month=11;state.year--;}
    state.day=new Date(state.year,state.month+1,0).getDate();
  }
  if(state.day>dim){
    state.day=1; state.month++; if(state.month>11){state.month=0;state.year++;}
  }
  state.week=getWeekForDay(state.day); renderAll();
}

/* ══ PWA Install ══ */
function initPWA(){
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault(); state.deferredInstall=e;
    const banner=$('install-banner');
    if(banner&&!localStorage.getItem('pwa_dismissed')) banner.classList.add('visible');
  });
  $('install-accept')?.addEventListener('click',()=>{
    state.deferredInstall?.prompt();
    state.deferredInstall?.userChoice.then(()=>{ $('install-banner').classList.remove('visible'); });
  });
  $('install-dismiss')?.addEventListener('click',()=>{
    $('install-banner').classList.remove('visible');
    localStorage.setItem('pwa_dismissed','1');
  });
}

/* ══ Event Listeners ══ */
function bindEvents(){
  /* Drawer */
  $('btn-menu').addEventListener('click', openDrawer);
  $('btn-close-drawer').addEventListener('click', closeDrawer);
  $('drawer-overlay').addEventListener('click', closeDrawer);
  document.querySelectorAll('.drawer-item[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));

  /* Bottom nav */
  document.querySelectorAll('.bottom-nav-item[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  // FAB button (center day button)
  const fab = $('bnav-day');
  if (fab) fab.addEventListener('click', () => switchView('day'));

  /* Month nav */
  $('prev-month').addEventListener('click',()=>changeMonth(-1));
  $('next-month').addEventListener('click',()=>changeMonth(1));
  $('prev-month-m').addEventListener('click',()=>changeMonth(-1));
  $('next-month-m').addEventListener('click',()=>changeMonth(1));

  /* Month view goals */
  $('btn-add-goal').addEventListener('click',()=>{
    addMonthlyGoal(''); renderMonthlyGoals();
    setTimeout(()=>{ const ins=$('monthly-goals-list').querySelectorAll('.goal-input'); ins[ins.length-1]?.focus(); },80);
  });

  /* Week view */
  $('btn-add-weekly-goal').addEventListener('click',()=>{
    const k=weekKey(state.year,state.month,state.week);
    if(!db.weeks[k]) db.weeks[k]={goals:[]};
    db.weeks[k].goals.push({id:Date.now().toString(36),text:'',done:false,progress:0,targetProgress:25});
    saveData(); renderWeeklyGoalsMain();
    setTimeout(()=>{ const ins=$('weekly-goals-main-list').querySelectorAll('.wgoal-input'); ins[ins.length-1]?.focus(); },80);
  });

  /* Distribute */
  $('btn-distribute').addEventListener('click', showDistributeModal);
  $('btn-cancel-distribute').addEventListener('click',()=>closeModal('modal-distribute'));

  /* Mobile column switcher */
  document.querySelectorAll('.col-switch-btn').forEach(btn=>{
    btn.addEventListener('click',()=>switchActiveCol(btn.dataset.col));
  });

  /* Swipe on day view: left = next day, right = prev day */
  const daySection=$('view-day');
  addSwipeHandler(daySection,
    ()=>{ if(state.view==='day') changeDay(1); },
    ()=>{ if(state.view==='day') changeDay(-1); }
  );
  /* Swipe on week view: left = next week, right = prev week */
  const weekSection=$('view-week');
  addSwipeHandler(weekSection,
    ()=>{ if(state.view==='week'){ const ws=getWeeks(state.year,state.month); const idx=ws.findIndex(w=>w.week===state.week); if(idx<ws.length-1){state.week=ws[idx+1].week;renderWeekView();renderSidebar();} else changeMonth(1); } },
    ()=>{ if(state.view==='week'){ const ws=getWeeks(state.year,state.month); const idx=ws.findIndex(w=>w.week===state.week); if(idx>0){state.week=ws[idx-1].week;renderWeekView();renderSidebar();} else changeMonth(-1); } }
  );

  /* Day nav */
  $('prev-day').addEventListener('click',()=>changeDay(-1));
  $('next-day').addEventListener('click',()=>changeDay(1));
  $('btn-today').addEventListener('click',()=>{
    if(state.view==='day') saveDayFromDOM();
    const t=today(); state.year=t.y; state.month=t.m; state.day=t.d;
    state.week=getWeekForDay(t.d); renderAll();
  });
  $('btn-save-day').addEventListener('click',()=>{
    saveDayFromDOM(); saveData(); showToast('💾 저장되었습니다'); renderDayPicker();
  });

  /* Settings */
  $('btn-settings').addEventListener('click',()=>{ applySettings(); openModal('modal-settings'); });
  $('btn-close-settings').addEventListener('click',()=>{
    settings.dark=$('dark-mode-toggle').checked;
    settings.autoSave=$('auto-save-toggle').checked;
    settings.scrollNow=$('scroll-now-toggle').checked;
    settings.googleClientId=($('google-client-id')?.value||'').trim();
    saveSettings(); applySettings(); closeModal('modal-settings');
    showToast('⚙️ 설정이 저장되었습니다');
  });
  $('dark-mode-toggle').addEventListener('change',()=>{
    settings.dark=$('dark-mode-toggle').checked;
    document.documentElement.setAttribute('data-theme',settings.dark?'dark':'');
  });
  $('btn-reset-data').addEventListener('click',()=>{
    if(confirm('⚠️ 모든 데이터가 삭제됩니다. 계속하시겠습니까?')){
      localStorage.removeItem(STORAGE_KEY); db={months:{},weeks:{},days:{}};
      closeModal('modal-settings'); renderAll(); showToast('🗑️ 초기화 완료');
    }
  });

  /* Drive */
  const openDriveModal=()=>{
    $('drive-filename').value=`JDI_Diary_${state.year}_${pad(state.month+1)}.docx`;
    $('drive-status').textContent=''; $('drive-status').className='drive-status';
    openModal('modal-drive');
  };
  $('btn-export-drive').addEventListener('click', openDriveModal);
  $('bottom-export').addEventListener('click', openDriveModal);
  $('btn-cancel-drive').addEventListener('click',()=>closeModal('modal-drive'));
  $('btn-google-signin').addEventListener('click',()=>{
    const fn=$('drive-filename').value.trim()||`JDI_Diary_${state.year}_${pad(state.month+1)}.docx`;
    uploadToDrive(fn, generateDocContent());
  });

  /* Local export/import */
  $('btn-export-local').addEventListener('click', exportJSON);
  $('bottom-save-local').addEventListener('click',()=>{ saveDayFromDOM(); saveData(); showToast('💾 로컬 저장 완료'); });
  $('btn-import-local').addEventListener('click',()=>$('import-file-input').click());
  $('import-file-input').addEventListener('change',e=>{ if(e.target.files[0]) importJSON(e.target.files[0]); e.target.value=''; });

  /* Modal backdrop close */
  document.querySelectorAll('.modal-backdrop').forEach(mb=>{
    mb.addEventListener('click',e=>{ if(e.target===mb) closeModal(mb.id); });
  });

  /* Keyboard shortcuts */
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      document.querySelectorAll('.modal-backdrop.open').forEach(m=>closeModal(m.id));
      closeDrawer();
    }
    if((e.ctrlKey||e.metaKey)&&e.key==='s'){
      e.preventDefault(); saveDayFromDOM(); saveData(); showToast('💾 저장되었습니다');
    }
  });

  /* Responsive: re-render timeline on resize */
  let resizeTimer;
  window.addEventListener('resize',()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(()=>{ updateMobileMode(); if(state.view==='day') renderTimeline(); },200);
  });
}

/* ══ Clock ══ */
function startClock(){
  setInterval(()=>{
    if(state.view==='day'){
      renderNowIndicator();
      const body=$('timeline-body');
      if(body){
        const now=new Date();
        body.querySelectorAll('.timeline-row').forEach(r=>r.classList.remove('current-hour'));
        if(state.year===now.getFullYear()&&state.month===now.getMonth()&&state.day===now.getDate()){
          const rows=body.querySelectorAll('.timeline-row');
          rows[now.getHours()]?.classList.add('current-hour');
        }
      }
    }
  }, 60000);
}

/* ══ Sticker Panel Initialization ══ */
function initStickerPanel() {
  const panel = $('sticker-panel');
  const btnOpen = $('btn-stickers');
  const btnOpenHeader = $('btn-stickers-header');
  const btnClose = $('btn-close-stickers');
  
  if (!panel || !btnOpen || !btnClose) return;
  
  btnOpen.addEventListener('click', () => {
    panel.classList.add('open');
  });
  if (btnOpenHeader) {
    btnOpenHeader.addEventListener('click', () => {
      panel.classList.toggle('open'); // header button can toggle open/close
    });
  }
  btnClose.addEventListener('click', () => {
    panel.classList.remove('open');
  });
  
  panel.addEventListener('dragstart', e => {
    if (e.target.classList.contains('sticker-item')) {
      e.dataTransfer.setData('text/plain', e.target.dataset.emoji);
      e.dataTransfer.effectAllowed = 'copy';
      if (navigator.vibrate) navigator.vibrate(15);
    }
  });
  
  const header = panel.querySelector('.sticker-panel-header');
  let isDragging = false;
  let startX, startY;
  let startLeft, startTop;
  
  header.addEventListener('mousedown', e => {
    if (e.target.classList.contains('sticker-close')) return;
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = panel.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    
    panel.style.bottom = 'auto';
    panel.style.right = 'auto';
    panel.style.left = startLeft + 'px';
    panel.style.top = startTop + 'px';
    
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    let left = startLeft + dx;
    let top = startTop + dy;
    
    const maxX = window.innerWidth - panel.offsetWidth;
    const maxY = window.innerHeight - panel.offsetHeight;
    
    left = Math.max(0, Math.min(left, maxX));
    top = Math.max(0, Math.min(top, maxY));
    
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

/* ══ Init ══ */
function init(){
  loadData(); applySettings();
  const t=today();
  state.year=t.y; state.month=t.m; state.day=t.d;
  state.week=getWeekForDay(t.d);
  updateMobileMode(); // Set mobile-mode class before first render
  bindEvents(); renderAll(); startClock(); initPWA(); initStickerPanel();

  // Auto-save every 30s
  setInterval(()=>{ if(settings.autoSave){ saveDayFromDOM(); saveData(); } }, 30000);

  // Service Worker
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
}

document.addEventListener('DOMContentLoaded', init);
