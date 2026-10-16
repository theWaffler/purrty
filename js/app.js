import { db } from './db.js';
import * as px from './pixels.js';

// ---------- small helpers ----------
const $ = (sel, el = document) => el.querySelector(sel);
const app = $('#app');
const modalRoot = $('#modal');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = MONTHS.map(m => m.slice(0, 3));
const MAX_HP = 5;
const MOODS = ['knocked everything off the table', 'claws out', 'hissy', 'tail flicking', 'content', 'purring'];
const CLASSES = ['Friend', 'Best friend', 'Family', 'Coworker', 'Boss', 'Neighbor', 'Roommate', 'Rival', 'Classmate'];
const STAT_IDEAS = ['Favorite food', 'Coffee order', 'Pets', 'Partner', 'Kids', 'Hobbies', 'Avoid talking about', 'Gift ideas', 'Hometown'];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysIn = (m, y = 2024) => new Date(y, m, 0).getDate();
const prettyDate = key => { const [y, m, d] = key.split('-').map(Number); return `${MON[m - 1]} ${d}${y !== new Date().getFullYear() ? ', ' + y : ''}`; };

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }
const settings = Object.assign({ sound: true }, JSON.parse(safeGet('purrty.settings') || '{}'));
const saveSettings = () => safeSet('purrty.settings', JSON.stringify(settings));

let people = [];
const listState = { q: '', sort: 'name' };

// ---------- level (age) and birthdays ----------
function bdayOn(year, m, d) {
  if (m === 2 && d === 29 && !isLeap(year)) return new Date(year, 1, 28);
  return new Date(year, m - 1, d);
}

// Level is the person's age.
// If we know the birth year, we work it out.
// If not, we use the age the user typed in, and add one every birthday since they typed it.
function level(p, now = new Date()) {
  const b = p.bday || {};
  const today = startOfDay(now);
  if (b.y && b.m && b.d) {
    let age = today.getFullYear() - b.y;
    if (today < bdayOn(today.getFullYear(), b.m, b.d)) age--;
    return Math.max(0, age);
  }
  if (p.ageManual === null || p.ageManual === undefined || p.ageManual === '') return null;
  let age = Number(p.ageManual);
  if (b.m && b.d && p.ageSetAt) {
    const from = startOfDay(new Date(p.ageSetAt));
    for (let y = from.getFullYear(); y <= today.getFullYear(); y++) {
      const bd = bdayOn(y, b.m, b.d);
      if (bd > from && bd <= today) age++;
    }
  }
  return age;
}

function nextBirthday(p, now = new Date()) {
  const b = p.bday || {};
  if (!b.m || !b.d) return null;
  const today = startOfDay(now);
  let bd = bdayOn(today.getFullYear(), b.m, b.d);
  if (bd < today) bd = bdayOn(today.getFullYear() + 1, b.m, b.d);
  return { date: bd, days: Math.round((bd - today) / 86400000) };
}

const hpOn = (p, key = ymd(new Date())) => (p.hp && p.hp[key] !== undefined ? p.hp[key] : MAX_HP);
const latestNote = p => (p.notes || []).slice().sort((a, b) => (b.date + b.t).localeCompare(a.date + a.t))[0];
const avatarSrc = p => (p.avatar && p.avatar.photo) || px.catURL((p.avatar && p.avatar.cat) || px.randomCat(p.id));
const lvText = p => { const l = level(p); return l === null ? 'Lv ??' : `Lv ${l}`; };

// ---------- sound and feedback ----------
let audio;
function mew(happy) {
  if (!settings.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
    o.type = 'triangle';
    if (happy) {
      o.frequency.setValueAtTime(620, t);
      o.frequency.exponentialRampToValueAtTime(1150, t + 0.12);
      o.frequency.exponentialRampToValueAtTime(820, t + 0.26);
    } else {
      o.frequency.setValueAtTime(520, t);
      o.frequency.exponentialRampToValueAtTime(200, t + 0.28);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(audio.destination);
    o.start(t); o.stop(t + 0.32);
  } catch { /* no audio, no problem */ }
}

let toastTimer;
function toast(msg) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

async function askToPersist() {
  try {
    if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* not supported */ }
}

async function save(p) {
  p.updated = Date.now();
  await db.put(p);
  const i = people.findIndex(x => x.id === p.id);
  if (i >= 0) people[i] = p; else people.push(p);
}

// ---------- shared bits of markup ----------
function heartsRow(hp, { size = 'sm', buttons = false, pop = -1 } = {}) {
  let out = '';
  for (let i = 0; i < MAX_HP; i++) {
    const svg = px.heartSvg(i < hp, i === pop ? 'pop' : '');
    out += buttons
      ? `<button class="heart-btn" data-act="heart" data-i="${i}" aria-label="Set hearts to ${i < hp ? i : i + 1}">${svg}</button>`
      : svg;
  }
  return `<div class="hearts ${size}" ${buttons ? '' : `aria-label="${hp} of ${MAX_HP} hearts"`}>${out}</div>`;
}

const avatarImg = (p, size = '') => `<img class="av ${size}" src="${avatarSrc(p)}" alt="" width="64" height="64">`;

function topbar(backHref, backLabel, right = '') {
  return `<div class="topbar"><a class="back" href="${backHref}">${px.icon('back')}<span>${backLabel}</span></a>${right}</div>`;
}

// ---------- router ----------
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [view, id] = h.split('/');
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === (view === 'p' || view === 'edit' || view === 'new' || !view ? 'party' : view)));
  closeModal();
  if (view === 'p') return renderSheet(id);
  if (view === 'edit') return renderForm(id);
  if (view === 'new') return renderForm(null);
  if (view === 'bdays') return renderBirthdays();
  if (view === 'settings') return renderSettings();
  return renderList();
}
window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });

// ---------- party list ----------
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone; }

function renderList() {
  const showInstall = isIOS() && !isStandalone() && safeGet('purrty.hideInstall') !== '1';
  app.innerHTML = `
    <header class="brand">
      <img class="av logo" src="${px.catURL({ fur: 'ginger', pattern: 'tabby', eyes: 'green', acc: 'crown' })}" alt="">
      <div><h1>Purrty</h1><p class="sub">${people.length ? `${people.length} in your party` : 'your party of people'}</p></div>
    </header>
    ${showInstall ? `<div class="box notice"><p>Tap <b>Share</b> then <b>Add to Home Screen</b>. It keeps your notes safe from Safari's cleanup.</p><button class="link" data-act="hide-install">Got it</button></div>` : ''}
    ${people.length ? `
    <div class="controls">
      <input id="search" class="input" type="search" placeholder="Search names, notes, stats" value="${esc(listState.q)}" autocomplete="off">
      <div class="chips" role="group" aria-label="Sort">
        ${[['name', 'A to Z'], ['grumpy', 'Grumpiest'], ['bday', 'Birthday']].map(([k, l]) => `<button class="chip ${listState.sort === k ? 'on' : ''}" data-act="sort" data-sort="${k}">${l}</button>`).join('')}
      </div>
    </div>` : ''}
    <div id="roster"></div>
    <a class="box recruit" href="#/new">${px.icon('plus')}<span>Recruit a member</span></a>`;
  renderRoster();
}

function renderRoster() {
  const el = $('#roster');
  if (!el) return;
  if (!people.length) {
    el.innerHTML = `<div class="empty">
      <img class="av xl bob" src="${px.catURL({ fur: 'gray', pattern: 'tuxedo', eyes: 'gold', acc: 'wizard' })}" alt="">
      <h2>Your purrty is empty</h2>
      <p>Add the people in your life and keep track of the little things about them.</p></div>`;
    return;
  }
  const q = listState.q.trim().toLowerCase();
  let list = people.filter(p => {
    if (!q) return true;
    const hay = [p.name, p.cls, ...(p.notes || []).map(n => n.text), ...(p.stats || []).map(s => `${s.k} ${s.v}`)].join(' ').toLowerCase();
    return hay.includes(q);
  });
  const byName = (a, b) => a.name.localeCompare(b.name);
  if (listState.sort === 'grumpy') list.sort((a, b) => hpOn(a) - hpOn(b) || byName(a, b));
  else if (listState.sort === 'bday') list.sort((a, b) => ((nextBirthday(a) || { days: 999 }).days - (nextBirthday(b) || { days: 999 }).days) || byName(a, b));
  else list.sort(byName);

  if (!list.length) { el.innerHTML = `<p class="nothing">No one matches "${esc(listState.q)}"</p>`; return; }
  el.innerHTML = list.map(p => {
    const nb = nextBirthday(p);
    const note = latestNote(p);
    const badge = nb && nb.days === 0 ? `<span class="badge gold">${px.icon('cake')} today</span>`
      : nb && nb.days <= 7 ? `<span class="badge">${px.icon('cake')} ${nb.days}d</span>` : '';
    return `<a class="box member" href="#/p/${p.id}">
      ${avatarImg(p)}
      <div class="info">
        <div class="row1"><span class="name">${esc(p.name)}</span><span class="lv">${lvText(p)}</span></div>
        ${heartsRow(hpOn(p))}
        <div class="sub">${note ? esc(note.text) : esc(p.cls || 'No notes yet')}</div>
      </div>${badge}</a>`;
  }).join('');
}

// ---------- character sheet ----------
function renderSheet(id, pop = -1) {
  const p = people.find(x => x.id === id);
  if (!p) { location.hash = '#/'; return; }
  const hp = hpOn(p);
  const nb = nextBirthday(p);
  const lv = level(p);
  const levelUp = nb && nb.days === 0;
  const b = p.bday || {};
  const notes = (p.notes || []).slice().sort((a, c) => (c.date + c.t).localeCompare(a.date + a.t));

  // last 7 days as little health bars
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = ymd(d);
    const before = p.created && startOfDay(new Date(p.created)) > startOfDay(d);
    const v = before ? null : hpOn(p, key);
    week.push(`<div class="day ${i === 0 ? 'today' : ''}"><div class="bar" aria-label="${v === null ? 'not tracked' : v + ' hearts'}">${Array.from({ length: MAX_HP }, (_, k) => `<i class="${v !== null && k < v ? 'on' : ''}"></i>`).reverse().join('')}</div><span>${'SMTWTFS'[d.getDay()]}</span></div>`);
  }

  app.innerHTML = `
    ${topbar('#/', 'Party', `<a class="btn sm ghost" href="#/edit/${p.id}">Edit</a>`)}
    <section class="hero">
      <button class="avatar-btn" data-act="avatar" aria-label="Change look">${avatarImg(p, 'xl')}<span class="paint">${px.icon('dice')}</span></button>
      <h1 class="pname">${esc(p.name)}</h1>
      <div class="lvline"><span class="lv big">${lv === null ? 'Lv ??' : 'Lv ' + lv}</span>${p.cls ? `<span class="cls">${esc(p.cls)}</span>` : ''}</div>
      ${levelUp ? `<div class="levelup">${px.icon('star')} Level up! Happy birthday ${px.icon('star')}</div>` : ''}
    </section>

    <section class="box panel">
      <div class="panel-h"><h2>HP today</h2><span class="mood m${hp}">${MOODS[hp]}</span></div>
      <div id="hpwrap">${heartsRow(hp, { size: 'lg', buttons: true, pop })}</div>
      <p class="hint">Tap a heart when they bug you. Hearts refill every morning.</p>
      <div class="week">${week.join('')}</div>
    </section>

    <section class="box panel">
      <div class="panel-h"><h2>Stats</h2></div>
      <dl class="stats">
        ${b.m && b.d ? `<div class="stat"><dt>Birthday</dt><dd>${MONTHS[b.m - 1]} ${b.d}${b.y ? ', ' + b.y : ''}<small>${nb.days === 0 ? 'today!' : `in ${nb.days} day${nb.days === 1 ? '' : 's'}`}</small></dd></div>` : ''}
        ${(p.stats || []).map((s, i) => `<div class="stat"><dt>${esc(s.k)}</dt><dd>${esc(s.v)}</dd><button class="x" data-act="del-stat" data-i="${i}" aria-label="Remove ${esc(s.k)}">${px.icon('x')}</button></div>`).join('')}
        ${!(b.m && b.d) && !(p.stats || []).length ? '<p class="hint">Nothing yet. Add favorites, pets, things to avoid.</p>' : ''}
      </dl>
      <form class="addstat" data-form="stat">
        <input class="input" name="k" list="statIdeas" placeholder="Favorite food" maxlength="40" required>
        <input class="input" name="v" placeholder="Tacos al pastor" maxlength="120" required>
        <button class="btn sq" aria-label="Add stat">${px.icon('plus')}</button>
      </form>
      <datalist id="statIdeas">${STAT_IDEAS.map(s => `<option value="${s}">`).join('')}</datalist>
    </section>

    <section class="box panel">
      <div class="panel-h"><h2>Quest log</h2></div>
      <form data-form="note" class="addnote">
        <textarea class="input" name="text" rows="2" placeholder="What happened? What should you remember?" maxlength="1000" required></textarea>
        <button class="btn">Log it</button>
      </form>
      <ul class="notes">
        ${notes.map(n => `<li><span class="date">${prettyDate(n.date)}</span><span class="text">${esc(n.text)}</span><button class="x" data-act="del-note" data-id="${n.id}" aria-label="Delete note">${px.icon('x')}</button></li>`).join('') || '<li class="hint">No entries yet.</li>'}
      </ul>
    </section>`;
  app.dataset.id = p.id;
}

// ---------- add / edit form ----------
function renderForm(id) {
  const p = id ? people.find(x => x.id === id) : null;
  if (id && !p) { location.hash = '#/'; return; }
  const b = (p && p.bday) || {};
  const lv = p ? level(p) : null;
  app.innerHTML = `
    ${topbar(p ? `#/p/${p.id}` : '#/', p ? esc(p.name) : 'Party')}
    <form class="box panel form" id="pform" novalidate>
      <h2>${p ? 'Edit member' : 'New party member'}</h2>
      <label>Name<input class="input" name="name" maxlength="40" required value="${esc(p ? p.name : '')}" autocomplete="off"></label>
      <label>Class<input class="input" name="cls" list="classes" maxlength="30" placeholder="Coworker" value="${esc(p ? p.cls : '')}"></label>
      <datalist id="classes">${CLASSES.map(c => `<option value="${c}">`).join('')}</datalist>
      <fieldset>
        <legend>Birthday</legend>
        <div class="row3">
          <select class="input" name="m" aria-label="Month"><option value="">Month</option>${MONTHS.map((m, i) => `<option value="${i + 1}" ${b.m === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select>
          <select class="input" name="d" aria-label="Day"><option value="">Day</option>${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${b.d === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
          <input class="input" name="y" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="Year" aria-label="Year (optional)" value="${b.y || ''}">
        </div>
      </fieldset>
      <label id="ageWrap">Level (their age)<input class="input" name="age" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="Only if you don't know the year" value="${!b.y && lv !== null ? lv : ''}"></label>
      <p class="hint" id="ageHint"></p>
      <p class="error" id="formErr" role="alert"></p>
      <button class="btn wide">${p ? 'Save changes' : 'Add to party'}</button>
    </form>
    ${p ? `<button class="btn danger wide" data-act="delete">Release from party</button>` : ''}`;

  const f = $('#pform');
  const sync = () => {
    const y = f.y.value.trim(), m = +f.m.value, d = +f.d.value;
    const hasYear = /^\d{4}$/.test(y);
    $('#ageWrap').hidden = hasYear;
    let hint = '';
    if (hasYear && m && d) {
      const age = level({ bday: { y: +y, m, d } });
      hint = `Level ${age}, worked out from their birthday.`;
    } else if (!hasYear && m && d) hint = 'No year? Type their age and the level goes up by itself every birthday.';
    else if (!hasYear) hint = 'Add a birthday so their level can count up on its own.';
    $('#ageHint').textContent = hint;
    $('#formErr').textContent = '';
  };
  f.addEventListener('input', sync);
  sync();
  f.addEventListener('submit', e => { e.preventDefault(); submitForm(f, p); });
}

async function submitForm(f, existing) {
  const err = msg => { $('#formErr').textContent = msg; };
  const name = f.name.value.trim();
  const cls = f.cls.value.trim();
  const m = +f.m.value || null, d = +f.d.value || null;
  const yStr = f.y.value.trim();
  const ageStr = f.age.value.trim();
  const thisYear = new Date().getFullYear();
  if (!name) return err('Give them a name first.');
  if ((m && !d) || (!m && d)) return err('Pick both a month and a day, or leave both empty.');
  if (yStr && !/^\d{4}$/.test(yStr)) return err('Year should look like 1990.');
  const y = yStr ? +yStr : null;
  if (y && (y < 1900 || y > thisYear)) return err(`Year should be between 1900 and ${thisYear}.`);
  if (y && !m) return err('Add the month and day too.');
  if (m && d && d > daysIn(m, y || 2024)) return err(`${MONTHS[m - 1]} doesn't have ${d} days.`);
  if (m && d && y && bdayOn(y, m, d) > new Date()) return err("That birthday hasn't happened yet.");
  if (!y && ageStr && !/^\d{1,3}$/.test(ageStr)) return err('Age should be a number.');
  if (!y && ageStr && +ageStr > 130) return err('That level seems a bit high.');

  const p = existing ? JSON.parse(JSON.stringify(existing)) : {
    id: uid(), created: Date.now(), hp: {}, notes: [], stats: [], avatar: null,
  };
  if (!p.avatar) p.avatar = { cat: px.randomCat(p.id) };
  const oldB = (existing && existing.bday) || {};
  const bdayChanged = oldB.m !== m || oldB.d !== d;
  p.name = name;
  p.cls = cls;
  p.bday = { m, d, y };
  if (y) { p.ageManual = null; p.ageSetAt = null; }
  else if (ageStr) {
    const a = +ageStr;
    const current = existing ? level(existing) : null;
    if (a !== current || bdayChanged || !existing) { p.ageManual = a; p.ageSetAt = new Date().toISOString(); }
  } else { p.ageManual = null; p.ageSetAt = null; }

  await save(p);
  if (!existing) { askToPersist(); mew(true); toast(`${name} joined the party`); }
  else toast('Saved');
  location.hash = `#/p/${p.id}`;
}

// ---------- birthdays ----------
function renderBirthdays() {
  const withB = people.map(p => ({ p, nb: nextBirthday(p) })).filter(x => x.nb).sort((a, b) => a.nb.days - b.nb.days || a.p.name.localeCompare(b.p.name));
  const without = people.filter(p => !nextBirthday(p));
  app.innerHTML = `
    <header class="brand"><span class="bigicon">${px.icon('cake')}</span><div><h1>Birthdays</h1><p class="sub">who levels up next</p></div></header>
    ${withB.length ? withB.map(({ p, nb }) => {
      const lv = level(p);
      const turning = lv === null ? '' : nb.days === 0 ? `now Lv ${lv}` : `turns ${lv + 1}`;
      return `<a class="box member bday ${nb.days === 0 ? 'today' : ''}" href="#/p/${p.id}">
        ${avatarImg(p)}
        <div class="info"><div class="row1"><span class="name">${esc(p.name)}</span></div>
        <div class="sub">${MON[nb.date.getMonth()]} ${nb.date.getDate()}${turning ? ' · ' + turning : ''}</div></div>
        <div class="count">${nb.days === 0 ? 'Today!' : nb.days === 1 ? 'Tomorrow' : `${nb.days}<small>days</small>`}</div></a>`;
    }).join('') : `<div class="empty"><img class="av xl bob" src="${px.catURL({ fur: 'peach', pattern: 'solid', eyes: 'blue', acc: 'bow' })}" alt=""><h2>No birthdays yet</h2><p>Add a birthday to someone and they'll show up here.</p></div>`}
    ${without.length ? `<h2 class="section">Birthday unknown</h2><div class="mini-row">${without.map(p => `<a href="#/edit/${p.id}" class="mini">${avatarImg(p)}<span>${esc(p.name)}</span></a>`).join('')}</div>` : ''}`;
}

// ---------- settings ----------
async function renderSettings() {
  let persisted = null;
  try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch { /* */ }
  app.innerHTML = `
    <header class="brand"><span class="bigicon">${px.icon('yarn')}</span><div><h1>Settings</h1><p class="sub">your data never leaves this phone</p></div></header>
    <section class="box panel">
      <div class="panel-h"><h2>Backup</h2></div>
      <p>Your party lives only on this device. Save a backup now and then so you never lose it.</p>
      <div class="btnrow">
        <button class="btn" data-act="export">Save backup</button>
        <label class="btn ghost">Load backup<input type="file" accept="application/json,.json" data-act="import" hidden></label>
      </div>
      <p class="hint">Loading a backup adds its people to your party and updates anyone already here.</p>
    </section>
    <section class="box panel">
      <div class="panel-h"><h2>Storage</h2><span class="mood ${persisted ? 'm5' : 'm2'}">${persisted === null ? 'unknown' : persisted ? 'protected' : 'not protected'}</span></div>
      <p>${persisted ? 'Your browser promised not to clear this data.' : 'Ask the browser to keep this data safe. On iPhone, adding to the Home Screen does this.'}</p>
      ${persisted ? '' : '<button class="btn ghost" data-act="persist">Protect my data</button>'}
    </section>
    <section class="box panel">
      <div class="panel-h"><h2>Sound</h2></div>
      <label class="toggle"><input type="checkbox" data-act="sound" ${settings.sound ? 'checked' : ''}><span>Little mews when you tap hearts</span></label>
    </section>
    <section class="box panel">
      <div class="panel-h"><h2>Danger zone</h2></div>
      <button class="btn danger" data-act="wipe">Erase everything</button>
    </section>
    <p class="foot">meowwww</p>`;
}

async function exportData() {
  const data = { app: 'purrty', version: 1, exported: new Date().toISOString(), people };
  const name = `purrty-backup-${ymd(new Date())}.json`;
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Purrty backup' });
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function importData(file) {
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data.people;
    if (!Array.isArray(list)) throw new Error('bad');
    let n = 0;
    for (const p of list) {
      if (!p || typeof p.id !== 'string' || typeof p.name !== 'string') continue;
      p.hp = p.hp || {}; p.notes = p.notes || []; p.stats = p.stats || [];
      await db.put(p); n++;
    }
    people = await db.all();
    toast(`Loaded ${n} member${n === 1 ? '' : 's'}`);
    mew(true);
  } catch {
    toast("That file doesn't look like a Purrty backup");
  }
}

// ---------- avatar editor ----------
function closeModal() { modalRoot.innerHTML = ''; document.body.classList.remove('locked'); }

function openAvatarEditor(p) {
  const draft = {
    cat: Object.assign({}, (p.avatar && p.avatar.cat) || px.randomCat(p.id)),
    photo: (p.avatar && p.avatar.photo) || null,
  };
  document.body.classList.add('locked');

  const paint = () => {
    const c = draft.cat;
    const opt = (key, items, preview) => items.map(it => {
      const on = !draft.photo && c[key] === it.id;
      const inner = preview
        ? `<img class="av" src="${px.catURL(Object.assign({}, c, { [key]: it.id }))}" alt="">`
        : `<span class="sw" style="background:${it.c}"></span>`;
      return `<button class="opt ${on ? 'on' : ''}" data-key="${key}" data-val="${it.id}" aria-pressed="${on}" aria-label="${it.name}">${inner}<span>${it.name}</span></button>`;
    }).join('');
    modalRoot.innerHTML = `
      <div class="modal-back" data-act="close-modal">
        <div class="modal box" role="dialog" aria-modal="true" aria-label="Change look">
          <div class="modal-top">
            <img class="av xxl" src="${draft.photo || px.catURL(c)}" alt="Preview">
            <div class="modal-actions">
              <button class="btn sm" data-m="reroll">${px.icon('dice')} Reroll</button>
              <label class="btn sm ghost">${px.icon('camera')} Photo<input type="file" accept="image/*" data-m="photo" hidden></label>
              ${draft.photo ? `<button class="btn sm ghost" data-m="unphoto">Back to kitty</button>` : ''}
            </div>
          </div>
          <div class="modal-body">
            <h3>Fur</h3><div class="opts">${opt('fur', px.FURS)}</div>
            <h3>Pattern</h3><div class="opts">${opt('pattern', px.PATTERNS, true)}</div>
            <h3>Eyes</h3><div class="opts">${opt('eyes', px.EYES)}</div>
            <h3>Accessory</h3><div class="opts">${opt('acc', px.ACCS, true)}</div>
          </div>
          <div class="modal-foot">
            <button class="btn ghost" data-m="cancel">Cancel</button>
            <button class="btn" data-m="save">Save look</button>
          </div>
        </div>
      </div>`;
  };

  paint();
  const onClick = async e => {
    const back = e.target.closest('[data-act="close-modal"]');
    if (back && e.target === back) return done();
    const opt = e.target.closest('.opt');
    if (opt) { draft.cat[opt.dataset.key] = opt.dataset.val; draft.photo = null; return paint(); }
    const m = e.target.closest('[data-m]');
    if (!m) return;
    const act = m.dataset.m;
    if (act === 'reroll') { draft.cat = px.randomCat(Math.random()); draft.photo = null; paint(); }
    else if (act === 'unphoto') { draft.photo = null; paint(); }
    else if (act === 'cancel') done();
    else if (act === 'save') {
      p.avatar = { cat: draft.cat, photo: draft.photo };
      await save(p);
      mew(true);
      done();
      renderSheet(p.id);
    }
  };
  const onChange = async e => {
    if (e.target.dataset.m !== 'photo' || !e.target.files[0]) return;
    try { draft.photo = await px.photoToPixels(e.target.files[0]); paint(); }
    catch { toast("Couldn't read that picture"); }
  };
  function done() {
    modalRoot.removeEventListener('click', onClick);
    modalRoot.removeEventListener('change', onChange);
    closeModal();
  }
  modalRoot.addEventListener('click', onClick);
  modalRoot.addEventListener('change', onChange);
}

// ---------- events ----------
app.addEventListener('click', async e => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;
  const p = people.find(x => x.id === app.dataset.id);

  if (act === 'sort') { listState.sort = t.dataset.sort; document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === t)); renderRoster(); }
  else if (act === 'hide-install') { safeSet('purrty.hideInstall', '1'); renderList(); }
  else if (act === 'heart' && p) {
    const i = +t.dataset.i, cur = hpOn(p);
    const next = i < cur ? i : i + 1;
    p.hp = p.hp || {};
    p.hp[ymd(new Date())] = next;
    await save(p);
    mew(next > cur);
    if (next < cur && navigator.vibrate) navigator.vibrate(18);
    renderSheet(p.id, next < cur ? i : next - 1);
  }
  else if (act === 'avatar' && p) openAvatarEditor(p);
  else if (act === 'del-stat' && p) { p.stats.splice(+t.dataset.i, 1); await save(p); renderSheet(p.id); }
  else if (act === 'del-note' && p) {
    if (!confirm('Delete this note?')) return;
    p.notes = p.notes.filter(n => n.id !== t.dataset.id); await save(p); renderSheet(p.id);
  }
  else if (act === 'delete') {
    const id = location.hash.split('/')[2];
    const who = people.find(x => x.id === id);
    if (!who || !confirm(`Release ${who.name} from your party? Their notes will be gone for good.`)) return;
    await db.del(id);
    people = people.filter(x => x.id !== id);
    toast(`${who.name} wandered off`);
    location.hash = '#/';
  }
  else if (act === 'export') exportData();
  else if (act === 'persist') { await askToPersist(); renderSettings(); }
  else if (act === 'wipe') {
    if (!confirm('Erase every member and note on this phone?')) return;
    if (!confirm('Really? This cannot be undone unless you saved a backup.')) return;
    await db.clear(); people = []; toast('All clear'); location.hash = '#/';
  }
});

app.addEventListener('change', async e => {
  const act = e.target.dataset.act;
  if (act === 'sound') { settings.sound = e.target.checked; saveSettings(); if (settings.sound) mew(true); }
  else if (act === 'import' && e.target.files[0]) { await importData(e.target.files[0]); e.target.value = ''; }
});

app.addEventListener('input', e => {
  if (e.target.id === 'search') { listState.q = e.target.value; renderRoster(); }
});

app.addEventListener('submit', async e => {
  const f = e.target;
  const p = people.find(x => x.id === app.dataset.id);
  if (!p || !f.dataset.form) return;
  e.preventDefault();
  if (f.dataset.form === 'stat') {
    const k = f.k.value.trim(), v = f.v.value.trim();
    if (!k || !v) return;
    p.stats = p.stats || [];
    p.stats.push({ k, v });
    await save(p);
    renderSheet(p.id);
  } else if (f.dataset.form === 'note') {
    const text = f.text.value.trim();
    if (!text) return;
    p.notes = p.notes || [];
    p.notes.push({ id: uid(), date: ymd(new Date()), t: new Date().toTimeString().slice(0, 8), text });
    await save(p);
    mew(true);
    renderSheet(p.id);
  }
});

// ---------- start ----------
document.documentElement.style.setProperty('--paw', px.pawBackground());
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = px.icon(el.dataset.icon); });

(async () => {
  try { people = await db.all(); }
  catch { app.innerHTML = '<p class="nothing">This browser blocked storage. Try leaving private browsing.</p>'; return; }
  route();
  // refresh hearts if the app stays open past midnight
  let day = ymd(new Date());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ymd(new Date()) !== day) { day = ymd(new Date()); route(); }
  });
})();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
