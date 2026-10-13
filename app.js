'use strict';
/* Wedding – app.js
   Reines JavaScript, kein Framework. Läuft lokal (auch per Doppelklick)
   oder mit Cloud-Speicher (cloud.js wird nur dann nachgeladen). */

// ===PURE-START===
/* ---------- Hilfsfunktionen ohne Oberfläche (testbar) ---------- */
const STANDARD_ENGER = 'Engerer Kreis';
const NOTIZ_START = ['Deko', 'Musik', 'Outfit', 'Essen', 'Sonstiges'];

const AUFGABEN_VORLAGE = [
  ['Location anfragen und besichtigen', { m: 12 }],
  ['Termin beim Standesamt anfragen', { m: 12 }],
  ['Budget festlegen', { m: 12 }],
  ['Fotograf buchen', { m: 10 }],
  ['Catering buchen', { m: 10 }],
  ['DJ oder Band buchen', { m: 10 }],
  ['Gästeliste erstellen', { m: 8 }],
  ['Save the Date verschicken', { m: 8 }],
  ['Brautkleid und Anzug aussuchen', { m: 6 }],
  ['Ringe aussuchen', { m: 6 }],
  ['Einladungen verschicken', { m: 4 }],
  ['Hotel für Gäste organisieren', { m: 4 }],
  ['Ablaufplan erstellen', { m: 2 }],
  ['Musikwünsche festlegen', { m: 2 }],
  ['Zusagen und Absagen prüfen', { m: 1 }],
  ['Dienstleister bestätigen', { m: 1 }],
  ['Letzte Absprachen treffen', { t: 7 }],
  ['Ringe und Dokumente bereitlegen', { t: 7 }]
];

const BUDGET_VORLAGE = [
  'Location', 'Catering und Getränke', 'Kleidung', 'Ringe', 'Fotograf und Video',
  'Musik und DJ', 'Dekoration und Blumen', 'Einladungen und Papeterie', 'Torte',
  'Trauung', 'Transport', 'Unterkunft', 'Sonstiges'
];

let idZaehler = 0;
function neueId() {
  idZaehler++;
  return Date.now().toString(36) + idZaehler.toString(36) + Math.random().toString(36).slice(2, 6);
}

/* Nutzertexte immer escapen, bevor sie in HTML eingefügt werden */
function esc(t) {
  return String(t === undefined || t === null ? '' : t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function zweistellig(n) { return (n < 10 ? '0' : '') + n; }
function datumString(d) { return d.getFullYear() + '-' + zweistellig(d.getMonth() + 1) + '-' + zweistellig(d.getDate()); }
function leseDatum(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getMonth() !== Number(m[2]) - 1) return null;
  return d;
}
function tagesanfang(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function tageAddieren(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function tageZwischen(a, b) { return Math.round((tagesanfang(a).getTime() - tagesanfang(b).getTime()) / 86400000); }
function monateAbziehen(d, n) {
  const ziel = new Date(d.getFullYear(), d.getMonth() - n, 1);
  const letzter = new Date(ziel.getFullYear(), ziel.getMonth() + 1, 0).getDate();
  return new Date(ziel.getFullYear(), ziel.getMonth(), Math.min(d.getDate(), letzter));
}
function datumDeutsch(s) {
  const d = leseDatum(s);
  return d ? zweistellig(d.getDate()) + '.' + zweistellig(d.getMonth() + 1) + '.' + d.getFullYear() : '';
}

/* Zahlen wie "1.250,50" oder "1250.5" lesen */
function zahl(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let t = String(v === undefined || v === null ? '' : v).replace(/\s/g, '').replace(/€/g, '');
  if (t === '') return 0;
  if (t.indexOf(',') !== -1) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = parseFloat(t);
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
function zahlOderNull(v) {
  const t = String(v === undefined || v === null ? '' : v).trim();
  if (t === '' || !/\d/.test(t)) return null;
  return zahl(t);
}

function startAufgaben() {
  return AUFGABEN_VORLAGE.map(function (a) {
    return { id: neueId(), titel: a[0], faellig: '', erledigt: false, vorlauf: a[1], ueberfaellig: false };
  });
}
function startBudget() {
  return BUDGET_VORLAGE.map(function (n) { return { id: neueId(), name: n, geplant: 0, tatsaechlich: 0 }; });
}

function neuesDatenObjekt(n1, n2, datum, budget) {
  return {
    version: 1, name1: n1, name2: n2, datum: datum, budget: budget,
    engerName: STANDARD_ENGER,
    aufgaben: startAufgaben(), budgetKat: startBudget(),
    gaeste: [], dienstleister: [], ablauf: [],
    notizKat: NOTIZ_START.slice(), notizen: [],
    geaendert: 0
  };
}

/* Alte oder unvollständige Daten reparieren */
function normalisiere(d) {
  d.name1 = String(d.name1 || '');
  d.name2 = String(d.name2 || '');
  d.datum = String(d.datum || '');
  d.budget = (d.budget === null || d.budget === undefined || d.budget === '') ? null : zahl(d.budget);
  d.engerName = String(d.engerName || STANDARD_ENGER);
  ['aufgaben', 'gaeste', 'dienstleister', 'ablauf', 'notizen'].forEach(function (k) {
    if (!Array.isArray(d[k])) d[k] = [];
  });
  if (!Array.isArray(d.budgetKat)) d.budgetKat = startBudget();
  if (!Array.isArray(d.notizKat)) d.notizKat = NOTIZ_START.slice();
  d.geaendert = Number(d.geaendert) || 0;
  return d;
}

/* Fälligkeiten der Startvorlage berechnen: Hochzeitsdatum minus Vorlaufzeit.
   Liegt das Datum in der Vergangenheit, wird die Aufgabe auf die nächsten Tage
   gelegt (jeden zweiten Tag) und als überfällig markiert.
   Eigene Aufgaben (ohne vorlauf) bleiben unverändert. Gibt true zurück, wenn sich etwas geändert hat. */
function berechneFaelligkeiten(d, heute) {
  const hochzeit = leseDatum(d.datum);
  if (!hochzeit) return false;
  const h0 = tagesanfang(heute);
  const auto = [];
  d.aufgaben.forEach(function (a) {
    if (!a.vorlauf) return;
    const roh = a.vorlauf.m ? monateAbziehen(hochzeit, a.vorlauf.m) : tageAddieren(hochzeit, -(a.vorlauf.t || 0));
    auto.push({ a: a, roh: roh });
  });
  auto.sort(function (x, y) { return x.roh.getTime() - y.roh.getTime(); });
  let geaendert = false;
  let staffel = 0;
  auto.forEach(function (e) {
    let neu = e.roh;
    let flag = false;
    if (!e.a.erledigt && e.roh.getTime() < h0.getTime()) {
      neu = tageAddieren(h0, 1 + 2 * staffel);
      staffel++;
      flag = true;
      if (neu.getTime() > hochzeit.getTime() && hochzeit.getTime() >= h0.getTime()) neu = hochzeit;
    }
    const s = datumString(neu);
    if (e.a.faellig !== s || !!e.a.ueberfaellig !== flag) geaendert = true;
    e.a.faellig = s;
    e.a.ueberfaellig = flag;
  });
  return geaendert;
}

function istUeberfaellig(a, heute) {
  if (a.erledigt) return false;
  if (a.ueberfaellig) return true;
  const f = leseDatum(a.faellig);
  return !!f && f.getTime() < tagesanfang(heute).getTime();
}

/* Gäste: Erwachsene, Kinder, Einladungen. Alte Daten bleiben nutzbar. */
function gastWerte(g) {
  let erw;
  if (g.erw !== undefined && g.erw !== null && g.erw !== '') erw = Number(g.erw);
  else if (g.personen !== undefined && g.personen !== null && g.personen !== '') erw = Number(g.personen);
  else erw = 1;
  if (!isFinite(erw) || erw < 0) erw = 0;
  let kinder = Number(g.kinder);
  if (!isFinite(kinder) || kinder < 0) kinder = 0;
  let einl = (g.einl === undefined || g.einl === null || g.einl === '') ? 1 : Number(g.einl);
  if (!isFinite(einl) || einl < 0) einl = 0;
  erw = Math.floor(erw);
  kinder = Math.floor(kinder);
  einl = Math.floor(einl);
  const status = (g.status === 'zugesagt' || g.status === 'abgesagt') ? g.status : 'offen';
  return { erw: erw, kinder: kinder, einl: einl, personen: erw + kinder, status: status, eng: !!g.eng };
}
function leereSumme() { return { erw: 0, kinder: 0, personen: 0, einl: 0 }; }
function summeAddieren(s, w) {
  s.erw += w.erw; s.kinder += w.kinder; s.personen += w.personen; s.einl += w.einl;
}
function berechneGaeste(liste) {
  const s = { gesamt: leereSumme(), zugesagt: leereSumme(), offen: leereSumme(), abgesagt: leereSumme(), erwartet: leereSumme() };
  liste.forEach(function (g) {
    const w = gastWerte(g);
    summeAddieren(s.gesamt, w);
    summeAddieren(s[w.status], w);
  });
  summeAddieren(s.erwartet, { erw: s.zugesagt.erw, kinder: s.zugesagt.kinder, personen: s.zugesagt.personen, einl: s.zugesagt.einl });
  summeAddieren(s.erwartet, { erw: s.offen.erw, kinder: s.offen.kinder, personen: s.offen.personen, einl: s.offen.einl });
  return s;
}
function gastZeile(g) {
  const w = gastWerte(g);
  return w.erw + ' Erw. · ' + w.kinder + (w.kinder === 1 ? ' Kind' : ' Kinder') + ' · ' + w.einl + ' Einl.';
}

function budgetSummen(d) {
  let geplant = 0;
  let ist = 0;
  let ueber = 0;
  d.budgetKat.forEach(function (k) {
    const g = zahl(k.geplant);
    const t = zahl(k.tatsaechlich);
    geplant += g;
    ist += t;
    if (t > g) ueber++;
  });
  const hat = d.budget !== null && d.budget !== undefined && isFinite(d.budget);
  const basis = hat ? d.budget : geplant;
  const r = function (x) { return Math.round(x * 100) / 100; };
  return {
    geplant: r(geplant), tatsaechlich: r(ist),
    budget: hat ? d.budget : null,
    rest: r(basis - ist), restVon: hat ? 'Gesamtbudget' : 'geplant',
    ueberKategorien: ueber,
    geplantUeberBudget: hat ? r(Math.max(0, geplant - d.budget)) : 0
  };
}

function titelText(d) {
  return d && d.name1 ? 'Wedding ' + d.name1 + '&' + d.name2 : 'Wedding';
}

/* ---------- Kalender-Datei (.ics) ---------- */
function icsText(t) {
  return String(t === undefined || t === null ? '' : t)
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function icsFalten(zeile) {
  const teile = [];
  let aktuell = '';
  let bytes = 0;
  for (const ch of zeile) {
    const cp = ch.codePointAt(0);
    const b = cp < 128 ? 1 : (cp < 0x800 ? 2 : (cp < 0x10000 ? 3 : 4));
    const grenze = teile.length === 0 ? 75 : 74;
    if (bytes + b > grenze) { teile.push(aktuell); aktuell = ''; bytes = 0; }
    aktuell += ch;
    bytes += b;
  }
  teile.push(aktuell);
  return teile.join('\r\n ');
}
function icsStempel(d) {
  return d.getUTCFullYear() + zweistellig(d.getUTCMonth() + 1) + zweistellig(d.getUTCDate()) + 'T' +
    zweistellig(d.getUTCHours()) + zweistellig(d.getUTCMinutes()) + zweistellig(d.getUTCSeconds()) + 'Z';
}
function icsTag(d) { return d.getFullYear() + zweistellig(d.getMonth() + 1) + zweistellig(d.getDate()); }

function baueIcs(d, jetzt) {
  const stempel = icsStempel(jetzt);
  const kalenderName = titelText(d);
  const z = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wedding//Hochzeitsplaner//DE',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:' + icsText(kalenderName), 'NAME:' + icsText(kalenderName)
  ];
  const hz = leseDatum(d.datum);
  if (hz) {
    z.push('BEGIN:VEVENT',
      'UID:hochzeit-' + icsTag(hz) + '@wedding.app',
      'DTSTAMP:' + stempel,
      'DTSTART;VALUE=DATE:' + icsTag(hz),
      'DTEND;VALUE=DATE:' + icsTag(tageAddieren(hz, 1)),
      'SUMMARY:' + icsText('Hochzeit ' + d.name1 + ' & ' + d.name2),
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY',
      'DESCRIPTION:' + icsText('Heute ist eure Hochzeit!'),
      'TRIGGER:PT9H', 'END:VALARM',
      'END:VEVENT');
  }
  d.aufgaben.forEach(function (a) {
    const f = leseDatum(a.faellig);
    if (a.erledigt || !f) return;
    z.push('BEGIN:VEVENT',
      'UID:aufgabe-' + a.id + '@wedding.app',
      'DTSTAMP:' + stempel,
      'DTSTART:' + icsTag(f) + 'T090000',
      'DTEND:' + icsTag(f) + 'T093000',
      'SUMMARY:' + icsText(a.titel),
      'DESCRIPTION:' + icsText('Aufgabe für ' + kalenderName),
      'BEGIN:VALARM', 'ACTION:DISPLAY',
      'DESCRIPTION:' + icsText(a.titel),
      'TRIGGER:PT0S', 'END:VALARM',
      'END:VEVENT');
  });
  z.push('END:VCALENDAR');
  return z.map(icsFalten).join('\r\n') + '\r\n';
}
// ===PURE-END===

/* ---------- Zustand ---------- */
const SCHLUESSEL_MODUS = 'wedding_speicherort';
const SCHLUESSEL_DATEN = 'wedding_daten';
const SCHLUESSEL_GEFRAGT = 'wedding_cloud_gefragt_';
const ZEIT_LIMIT = 10000;

const ANSICHTEN = [
  ['start', 'Start'], ['checkliste', 'Checkliste'], ['budget', 'Budget'], ['gaeste', 'Gäste'],
  ['dienstleister', 'Dienstleister'], ['ablauf', 'Ablauf'], ['notizen', 'Notizen'], ['einstellungen', 'Einstellungen']
];
const SCHIRME = ['schirm-wahl', 'schirm-login', 'schirm-willkommen', 'app'];
const STATUS_TEXTE = { offen: 'Offen', zugesagt: 'Zugesagt', abgesagt: 'Abgesagt' };
const STATUS_FOLGE = { offen: 'zugesagt', zugesagt: 'abgesagt', abgesagt: 'offen' };
const DIENSTLEISTER_ARTEN = [
  'Location', 'Standesamt', 'Trauredner', 'Fotograf', 'Videograf', 'Catering', 'DJ', 'Band',
  'Florist', 'Konditor (Torte)', 'Friseur und Make-up', 'Brautmode', 'Herrenausstatter',
  'Juwelier', 'Papeterie', 'Transport', 'Unterkunft', 'Sonstiges'
];
const EURO = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

let speicherModus = null;       // 'lokal' oder 'cloud'
let daten = null;               // alle Daten des Paares
let cloudModul = null;          // cloud.js, nur im Cloud-Modus geladen
let aktuelleAnsicht = 'start';
let gastFilter = 'alle';
let notizFilter = 'alle';
let speicherTimer = null;
let offeneSpeicherungen = 0;
let toastTimer = null;
let mitnehmen = null;           // Daten, die beim Wechsel des Speicherorts mitgenommen werden können
let modalFelder = [];
let modalCallback = null;
let zieh = null;

function $(id) { return document.getElementById(id); }
function geld(n) { return EURO.format(n); }
function feldZahl(n) { return n ? String(n).replace('.', ',') : ''; }
function finde(liste, id) { return liste.find(function (x) { return x.id === id; }); }

function zeigeToast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.hidden = true; }, 3500);
}

function zeigeSchirm(name) {
  SCHIRME.forEach(function (s) { $(s).hidden = (s !== name); });
  window.scrollTo(0, 0);
}

function zeigeLade(text, mitAktionen) {
  $('lade').hidden = false;
  $('lade-text').textContent = text;
  $('lade-aktionen').hidden = !mitAktionen;
  $('lade-spinner').hidden = !!mitAktionen;
}
function versteckeLade() { $('lade').hidden = true; }

function zeigeStatus(text) { $('sync-status').textContent = text; }

/* ---------- Fehler und Zeitüberschreitung ---------- */
function mitZeit(versprechen, ms) {
  return new Promise(function (ok, fehler) {
    const t = setTimeout(function () { fehler(new Error('zeit')); }, ms);
    versprechen.then(function (w) { clearTimeout(t); ok(w); }, function (e) { clearTimeout(t); fehler(e); });
  });
}

function fehlerText(e) {
  const code = (e && e.code) || '';
  const msg = (e && e.message) || '';
  if (msg === 'zeit') return 'Zeitüberschreitung nach 10 Sekunden. Bitte Internetverbindung prüfen und noch einmal versuchen.';
  if (msg === 'config') return 'Firebase ist noch nicht eingerichtet. Trage zuerst die sechs Werte in firebase-config.js ein.';
  if (msg === 'datei') return 'Der Cloud-Modus funktioniert nicht per Doppelklick (file://). Öffne die App über Live Server oder über GitHub Pages.';
  if (msg === 'laden') return 'Die Cloud-Funktion konnte nicht geladen werden. Bist du online? Läuft die App über https oder Live Server?';
  const tabelle = {
    'auth/invalid-email': 'Die E-Mail-Adresse ist ungültig.',
    'auth/missing-email': 'Bitte eine E-Mail-Adresse eingeben.',
    'auth/missing-password': 'Bitte ein Passwort eingeben.',
    'auth/user-not-found': 'Zu dieser E-Mail gibt es kein Konto. Erstelle zuerst ein neues Konto.',
    'auth/wrong-password': 'Das Passwort stimmt nicht.',
    'auth/invalid-credential': 'E-Mail oder Passwort stimmt nicht.',
    'auth/email-already-in-use': 'Zu dieser E-Mail gibt es schon ein Konto. Bitte melde dich an.',
    'auth/weak-password': 'Das Passwort ist zu schwach. Nimm mindestens 6 Zeichen.',
    'auth/network-request-failed': 'Keine Verbindung zum Internet. Bitte später noch einmal versuchen.',
    'auth/too-many-requests': 'Zu viele Versuche. Bitte kurz warten und noch einmal probieren.',
    'auth/user-disabled': 'Dieses Konto ist gesperrt.',
    'auth/operation-not-allowed': 'Die Anmeldung mit E-Mail und Passwort ist in Firebase nicht aktiviert.',
    'auth/unauthorized-domain': 'Diese Domain ist in Firebase nicht freigegeben. Trage sie unter „Autorisierte Domains“ ein.',
    'auth/invalid-api-key': 'Der API-Schlüssel in firebase-config.js ist ungültig.',
    'auth/api-key-not-valid': 'Der API-Schlüssel in firebase-config.js ist ungültig.',
    'auth/no-user': 'Du bist nicht angemeldet.',
    'permission-denied': 'Zugriff verweigert. Bitte die Firestore-Regeln prüfen.',
    'unavailable': 'Der Server ist gerade nicht erreichbar. Bist du offline?',
    'failed-precondition': 'Die Datenbank ist noch nicht richtig eingerichtet.'
  };
  return tabelle[code] || 'Etwas ist schiefgelaufen (' + (code || msg || 'unbekannt') + ').';
}

/* ---------- Speichern und Laden ---------- */
function leseLokal() {
  try {
    const t = localStorage.getItem(SCHLUESSEL_DATEN);
    if (!t) return null;
    const d = JSON.parse(t);
    return d && typeof d === 'object' && !Array.isArray(d) ? d : null;
  } catch (e) { return null; }
}
function schreibeLokal(d) {
  try { localStorage.setItem(SCHLUESSEL_DATEN, JSON.stringify(d)); return true; }
  catch (e) { zeigeToast('Speichern nicht möglich. Ist der Speicher voll oder gesperrt?'); return false; }
}

function speichere() {
  if (!daten) return;
  daten.geaendert = Date.now();
  if (speicherModus === 'lokal') {
    schreibeLokal(daten);
  } else if (speicherModus === 'cloud') {
    zeigeStatus('Speichert …');
    clearTimeout(speicherTimer);
    speicherTimer = setTimeout(cloudSpeichern, 700);
  }
}

function cloudSpeichern() {
  speicherTimer = null;
  if (!cloudModul || !daten) return;
  offeneSpeicherungen++;
  if (navigator.onLine === false) zeigeStatus('Offline – wird später gespeichert');
  cloudModul.speichereCloudDaten(JSON.stringify(daten), daten.geaendert).then(function () {
    offeneSpeicherungen--;
    if (offeneSpeicherungen === 0 && !speicherTimer) zeigeStatus('Gespeichert ✓');
  }).catch(function (e) {
    offeneSpeicherungen--;
    zeigeStatus('Nicht gespeichert');
    zeigeToast(fehlerText(e));
  });
}

function aenderungFertig() {
  speichere();
  renderAnsicht();
}

/* ---------- Start, Speicherort, Anmeldung ---------- */
function startApp() {
  baueNav();
  registriereEreignisse();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* nicht schlimm */ });
  }
  let wert = null;
  try { wert = localStorage.getItem(SCHLUESSEL_MODUS); } catch (e) { wert = null; }
  if (wert === 'lokal') {
    speicherModus = 'lokal';
    const l = leseLokal();
    daten = l ? normalisiere(l) : null;
    starteMitDaten();
  } else if (wert === 'cloud') {
    speicherModus = 'cloud';
    startCloud();
  } else {
    zeigeSchirm('schirm-wahl');
  }
}

function starteMitDaten() {
  versteckeLade();
  if (!daten || !daten.name1 || !leseDatum(daten.datum)) { zeigeWillkommen(); return; }
  if (berechneFaelligkeiten(daten, new Date())) speichere();
  zeigeSchirm('app');
  aktualisiereKopf();
  zeigeAnsicht(aktuelleAnsicht);
}

function setzeSpeicherort(wert) {
  try { localStorage.setItem(SCHLUESSEL_MODUS, wert); } catch (e) { zeigeToast('Die Auswahl konnte nicht gespeichert werden.'); }
  speicherModus = wert;
  if (wert === 'lokal') {
    const lokal = leseLokal();
    if (mitnehmen) {
      const frage = lokal
        ? 'Die bisherigen Daten auf diesem Gerät speichern? Vorhandene lokale Daten werden dabei ersetzt.'
        : 'Die bisherigen Daten auf diesem Gerät speichern?';
      if (window.confirm(frage)) schreibeLokal(mitnehmen);
    }
    mitnehmen = null;
    const l = leseLokal();
    daten = l ? normalisiere(l) : null;
    zeigeStatus('');
    starteMitDaten();
  } else {
    mitnehmen = null;
    daten = null;
    startCloud();
  }
}

async function ladeCloudModul() {
  if (cloudModul) return cloudModul;
  if (location.protocol === 'file:') throw new Error('datei');
  let m;
  try { m = await mitZeit(import('./cloud.js'), ZEIT_LIMIT); }
  catch (e) { if (e && e.message === 'zeit') throw e; throw new Error('laden'); }
  if (!m.konfigurationOk()) throw new Error('config');
  cloudModul = m;
  return m;
}

async function startCloud() {
  zeigeLade('Verbinde mit der Cloud …', false);
  try {
    await ladeCloudModul();
    const nutzer = await mitZeit(cloudModul.warteAufBenutzer(), ZEIT_LIMIT);
    if (!nutzer) { zeigeLogin(''); return; }
    await ladeAusCloud();
  } catch (e) {
    zeigeLade(fehlerText(e), true);
  }
}

async function ladeAusCloud() {
  zeigeLade('Lade eure Daten …', false);
  const stand = await mitZeit(cloudModul.ladeCloudDaten(), ZEIT_LIMIT);
  let cloudDaten = null;
  if (stand && stand.json) {
    try { cloudDaten = JSON.parse(stand.json); } catch (e) { cloudDaten = null; }
  }
  const uid = cloudModul.aktuelleUid();
  const lokal = leseLokal();
  let gefragt = null;
  try { gefragt = localStorage.getItem(SCHLUESSEL_GEFRAGT + uid); } catch (e) { gefragt = null; }
  let uebernommen = false;
  if (lokal && !gefragt) {
    let frage = 'Auf diesem Gerät gibt es lokal gespeicherte Daten. Sollen sie in die Cloud übernommen werden?';
    if (cloudDaten) frage += '\n\nAchtung: In der Cloud sind schon Daten vorhanden. Sie würden ersetzt.';
    const ja = window.confirm(frage);
    try { localStorage.setItem(SCHLUESSEL_GEFRAGT + uid, '1'); } catch (e) { /* egal */ }
    if (ja) { cloudDaten = lokal; uebernommen = true; }
  }
  daten = cloudDaten && typeof cloudDaten === 'object' ? normalisiere(cloudDaten) : null;
  if (uebernommen) speichere();
  zeigeStatus(daten ? 'Verbunden ✓' : '');
  starteMitDaten();
}

function zeigeLogin(meldung) {
  versteckeLade();
  zeigeSchirm('schirm-login');
  zeigeLoginMeldung(meldung || '', true);
}
function zeigeLoginMeldung(text, istFehler) {
  const m = $('login-meldung');
  m.textContent = text;
  m.className = 'meldung ' + (istFehler ? 'fehler' : 'ok');
  m.hidden = !text;
}
function loginSperren(an) {
  Array.prototype.forEach.call(document.querySelectorAll('#login-form button'), function (b) { b.disabled = an; });
}

async function aktionAnmelden(neuesKonto) {
  const email = $('login-email').value.trim();
  const pw = $('login-pw').value;
  if (!email || !pw) { zeigeLoginMeldung('Bitte E-Mail und Passwort eingeben.', true); return; }
  if (neuesKonto && pw.length < 6) { zeigeLoginMeldung('Das Passwort braucht mindestens 6 Zeichen.', true); return; }
  loginSperren(true);
  zeigeLoginMeldung('Einen Moment …', false);
  try {
    await ladeCloudModul();
    if (neuesKonto) await mitZeit(cloudModul.kontoErstellen(email, pw), ZEIT_LIMIT);
    else await mitZeit(cloudModul.anmeldenMitEmail(email, pw), ZEIT_LIMIT);
  } catch (e) {
    zeigeLoginMeldung(fehlerText(e), true);
    loginSperren(false);
    return;
  }
  loginSperren(false);
  $('login-pw').value = '';
  zeigeLoginMeldung('', false);
  try { await ladeAusCloud(); }
  catch (e2) { zeigeLade(fehlerText(e2), true); }
}

async function aktionPasswortVergessen() {
  const email = $('login-email').value.trim();
  if (!email) { zeigeLoginMeldung('Bitte oben die E-Mail-Adresse eingeben.', true); return; }
  loginSperren(true);
  zeigeLoginMeldung('Einen Moment …', false);
  try {
    await ladeCloudModul();
    await mitZeit(cloudModul.resetMail(email), ZEIT_LIMIT);
    zeigeLoginMeldung('E-Mail zum Zurücksetzen ist unterwegs. Schau auch im Spam-Ordner nach.', false);
  } catch (e) {
    zeigeLoginMeldung(fehlerText(e), true);
  }
  loginSperren(false);
}

function aktionLieberLokal() {
  versteckeLade();
  setzeSpeicherort('lokal');
}

function aktionSpeicherortWechseln() {
  if (!window.confirm('Speicherort wechseln? Deine Daten gehen dabei nicht verloren. Danach kannst du neu wählen.')) return;
  mitnehmen = daten;
  daten = null;
  speicherModus = null;
  try { localStorage.removeItem(SCHLUESSEL_MODUS); } catch (e) { /* egal */ }
  zeigeStatus('');
  zeigeSchirm('schirm-wahl');
}

async function aktionAbmelden() {
  if (!window.confirm('Wirklich abmelden?')) return;
  try {
    if (speicherTimer) { clearTimeout(speicherTimer); cloudSpeichern(); }
    if (cloudModul) await mitZeit(cloudModul.abmeldenKonto(), ZEIT_LIMIT);
  } catch (e) { zeigeToast(fehlerText(e)); return; }
  daten = null;
  zeigeStatus('');
  zeigeLogin('');
}

async function aktionAllesLoeschen() {
  if (!window.confirm('Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.')) return;
  clearTimeout(speicherTimer);
  speicherTimer = null;
  if (speicherModus === 'lokal') {
    try { localStorage.removeItem(SCHLUESSEL_DATEN); } catch (e) { /* egal */ }
  } else if (speicherModus === 'cloud' && cloudModul) {
    try { await mitZeit(cloudModul.speichereCloudDaten('', Date.now()), ZEIT_LIMIT); }
    catch (e) { zeigeToast(fehlerText(e)); return; }
  }
  daten = null;
  zeigeWillkommen();
}

/* Beim Zurückkehren in die App den neuesten Stand aus der Cloud holen */
async function aktualisiereAusCloud() {
  if (speicherModus !== 'cloud' || !cloudModul || !daten) return;
  if (speicherTimer || offeneSpeicherungen > 0 || !$('modal').hidden) return;
  try {
    const stand = await mitZeit(cloudModul.ladeCloudDaten(), ZEIT_LIMIT);
    if (!stand || !stand.json || stand.geaendert <= daten.geaendert) return;
    if (speicherTimer || offeneSpeicherungen > 0 || !$('modal').hidden) return;
    daten = normalisiere(JSON.parse(stand.json));
    aktualisiereKopf();
    renderAnsicht();
  } catch (e) { /* still ignorieren */ }
}

/* ---------- Willkommen ---------- */
function zeigeWillkommen() {
  versteckeLade();
  ['w-name1', 'w-name2', 'w-datum', 'w-budget'].forEach(function (id) { $(id).value = ''; });
  $('w-fehler').textContent = '';
  document.title = 'Wedding';
  zeigeSchirm('schirm-willkommen');
}

function aktionWillkommen() {
  const n1 = $('w-name1').value.trim();
  const n2 = $('w-name2').value.trim();
  const dat = $('w-datum').value;
  if (!n1 || !n2) { $('w-fehler').textContent = 'Bitte beide Namen eingeben.'; return; }
  if (!leseDatum(dat)) { $('w-fehler').textContent = 'Bitte das Hochzeitsdatum wählen.'; return; }
  daten = neuesDatenObjekt(n1, n2, dat, zahlOderNull($('w-budget').value));
  berechneFaelligkeiten(daten, new Date());
  speichere();
  aktuelleAnsicht = 'start';
  starteMitDaten();
}

/* ---------- Navigation ---------- */
function baueNav() {
  $('nav').innerHTML = ANSICHTEN.map(function (a) {
    return '<button type="button" class="nav-knopf" data-aktion="nav" data-ansicht="' + esc(a[0]) + '">' + esc(a[1]) + '</button>';
  }).join('');
}

function aktualisiereKopf() {
  $('app-titel').textContent = titelText(daten);
  document.title = titelText(daten);
}

function zeigeAnsicht(name) {
  aktuelleAnsicht = name;
  ANSICHTEN.forEach(function (a) { $('v-' + a[0]).hidden = (a[0] !== name); });
  Array.prototype.forEach.call(document.querySelectorAll('.nav-knopf'), function (b) {
    const aktiv = b.dataset.ansicht === name;
    b.classList.toggle('aktiv', aktiv);
    if (aktiv) {
      b.setAttribute('aria-current', 'page');
      if (b.scrollIntoView) { try { b.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) { /* egal */ } }
    } else {
      b.removeAttribute('aria-current');
    }
  });
  window.scrollTo(0, 0);
  renderAnsicht();
}

function renderAnsicht() {
  if (!daten) return;
  switch (aktuelleAnsicht) {
    case 'start': renderStart(); break;
    case 'checkliste': renderCheckliste(); break;
    case 'budget': renderBudget(); break;
    case 'gaeste': renderGaeste(); break;
    case 'dienstleister': renderDienstleister(); break;
    case 'ablauf': renderAblauf(); break;
    case 'notizen': renderNotizen(); break;
    case 'einstellungen': renderEinstellungen(); break;
    default: break;
  }
}

/* ---------- Eingabefenster ---------- */
function zeigeFormular(titel, felder, beiSpeichern) {
  modalFelder = felder;
  modalCallback = beiSpeichern;
  let html = '';
  felder.forEach(function (f) {
    const n = esc(f.name);
    if (f.typ === 'check') {
      html += '<label class="feld-check"><input type="checkbox" name="' + n + '"' + (f.wert ? ' checked' : '') + '><span>' + esc(f.label) + '</span></label>';
      return;
    }
    const wert = esc(f.wert === undefined || f.wert === null ? '' : f.wert);
    html += '<div class="feld"><label for="mf-' + n + '">' + esc(f.label) + (f.pflicht ? ' *' : '') + '</label>';
    if (f.typ === 'select') {
      html += '<select id="mf-' + n + '" name="' + n + '">' + f.optionen.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(f.wert) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
    } else if (f.typ === 'area') {
      html += '<textarea id="mf-' + n + '" name="' + n + '" rows="6" maxlength="5000">' + wert + '</textarea>';
    } else {
      let attr = ' type="text" maxlength="' + (f.max || 200) + '"';
      if (f.typ === 'date') attr = ' type="date"';
      else if (f.typ === 'time') attr = ' type="time"';
      else if (f.typ === 'ganzzahl') attr = ' type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4"';
      else if (f.typ === 'dezimal') attr = ' type="text" inputmode="decimal" maxlength="14"';
      if (f.liste) attr += ' list="mf-liste-' + n + '"';
      html += '<input id="mf-' + n + '" name="' + n + '"' + attr + ' value="' + wert + '" autocomplete="off"' +
        (f.platzhalter ? ' placeholder="' + esc(f.platzhalter) + '"' : '') + '>';
      if (f.liste) {
        html += '<datalist id="mf-liste-' + n + '">' + f.liste.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>';
      }
    }
    html += '</div>';
  });
  $('modal-felder').innerHTML = html;
  $('modal-titel').textContent = titel;
  $('modal-fehler').textContent = '';
  $('modal').hidden = false;
  document.body.classList.add('modal-offen');
}

function schliesseFormular() {
  $('modal').hidden = true;
  $('modal-felder').innerHTML = '';
  document.body.classList.remove('modal-offen');
  modalCallback = null;
  modalFelder = [];
}

function aktionModalOk() {
  const form = $('modal-form');
  const w = {};
  modalFelder.forEach(function (f) {
    const el = form.elements[f.name];
    w[f.name] = f.typ === 'check' ? !!el.checked : String(el.value).trim();
  });
  for (let i = 0; i < modalFelder.length; i++) {
    const f = modalFelder[i];
    if (f.pflicht && !w[f.name]) { $('modal-fehler').textContent = 'Bitte „' + f.label + '“ ausfüllen.'; return; }
  }
  const fehler = modalCallback ? modalCallback(w) : '';
  if (fehler) { $('modal-fehler').textContent = fehler; return; }
  schliesseFormular();
}

function ganzzahl(text) {
  const t = String(text).trim();
  if (t === '') return 0;
  return /^\d+$/.test(t) ? parseInt(t, 10) : null;
}

/* ---------- Start ---------- */
function renderStart() {
  const heute = new Date();
  const hz = leseDatum(daten.datum);
  let cd = '';
  if (hz) {
    const t = tageZwischen(hz, heute);
    if (t > 0) cd = '<div class="cd-zahl">' + t + '</div><div class="cd-text">' + (t === 1 ? 'Tag' : 'Tage') + ' bis zur Hochzeit</div>';
    else if (t === 0) cd = '<div class="cd-zahl">Heute</div><div class="cd-text">ist euer großer Tag!</div>';
    else cd = '<div class="cd-zahl">' + (-t) + '</div><div class="cd-text">' + (t === -1 ? 'Tag' : 'Tage') + ' seit der Hochzeit</div>';
    cd += '<div class="cd-datum">' + esc(datumDeutsch(daten.datum)) + '</div>';
  }
  $('start-countdown').innerHTML = cd;

  const fertig = daten.aufgaben.filter(function (a) { return a.erledigt; }).length;
  const ueberfaellig = daten.aufgaben.filter(function (a) { return istUeberfaellig(a, heute); }).length;
  const b = budgetSummen(daten);
  const g = berechneGaeste(daten.gaeste);
  const kacheln = [
    ['Aufgaben erledigt', fertig + ' von ' + daten.aufgaben.length, false],
    ['Überfällige Aufgaben', String(ueberfaellig), ueberfaellig > 0],
    ['Budget geplant', geld(b.geplant), false],
    ['Kosten tatsächlich', geld(b.tatsaechlich), b.rest < 0],
    ['Erwachsene gesamt', String(g.gesamt.erw), false],
    ['Kinder gesamt', String(g.gesamt.kinder), false],
    ['Zugesagte Personen', String(g.zugesagt.personen), false],
    ['Dienstleister', String(daten.dienstleister.length), false],
    ['Programmpunkte', String(daten.ablauf.length), false]
  ];
  $('start-uebersicht').innerHTML = kacheln.map(function (k) {
    return '<div class="kachel' + (k[2] ? ' warnung' : '') + '"><div class="kachel-wert">' + esc(k[1]) + '</div><div class="kachel-name">' + esc(k[0]) + '</div></div>';
  }).join('');
}

/* ---------- Kalender-Datei ---------- */
function dateiSicher(t) {
  return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'Hochzeit';
}

async function aktionIcs() {
  const text = baueIcs(daten, new Date());
  const name = 'Wedding-' + dateiSicher(daten.name1 + '-' + daten.name2) + '.ics';
  if (typeof File === 'function' && navigator.canShare && navigator.share) {
    try {
      const datei = new File([text], name, { type: 'text/calendar' });
      if (navigator.canShare({ files: [datei] })) {
        await navigator.share({ files: [datei], title: titelText(daten) });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  zeigeToast('Kalender-Datei heruntergeladen.');
}

/* ---------- Checkliste ---------- */
function renderCheckliste() {
  const heute = new Date();
  const liste = daten.aufgaben;
  const fertig = liste.filter(function (a) { return a.erledigt; }).length;
  $('ck-text').textContent = fertig + ' von ' + liste.length + ' erledigt';
  $('ck-balken').style.width = (liste.length ? Math.round(fertig * 100 / liste.length) : 0) + '%';

  if (!liste.length) {
    $('ck-liste').innerHTML = '<li class="leer">Noch keine Aufgaben.<br><br><button type="button" class="knopf" data-aktion="aufgaben-vorlage">Startvorlage laden</button></li>';
    return;
  }
  const sortiert = liste.slice().sort(function (a, b) {
    if (a.erledigt !== b.erledigt) return a.erledigt ? 1 : -1;
    return String(a.faellig || '9999').localeCompare(String(b.faellig || '9999'));
  });
  $('ck-liste').innerHTML = sortiert.map(function (a) {
    const ueb = istUeberfaellig(a, heute);
    let marke = '';
    if (ueb) marke = ' <span class="marke warn">' + (a.ueberfaellig ? 'Überfällig – bald erledigen' : 'Überfällig') + '</span>';
    return '<li class="zeile' + (a.erledigt ? ' erledigt' : '') + '">' +
      '<button type="button" class="haken" data-aktion="aufgabe-haken" data-id="' + esc(a.id) + '" aria-pressed="' + (a.erledigt ? 'true' : 'false') + '" aria-label="Erledigt: ' + esc(a.titel) + '"></button>' +
      '<div class="zeile-text"><div class="titel">' + esc(a.titel) + '</div>' +
      '<div class="meta">' + (a.faellig ? 'Fällig: ' + esc(datumDeutsch(a.faellig)) : 'Ohne Datum') + marke + '</div></div>' +
      '<div class="zeile-knoepfe">' +
      '<button type="button" class="icon" data-aktion="aufgabe-bearbeiten" data-id="' + esc(a.id) + '" aria-label="Bearbeiten">✎</button>' +
      '<button type="button" class="icon" data-aktion="aufgabe-loeschen" data-id="' + esc(a.id) + '" aria-label="Löschen">✕</button>' +
      '</div></li>';
  }).join('');
}

function aktionAufgabeNeu() {
  zeigeFormular('Neue Aufgabe', [
    { name: 'titel', label: 'Aufgabe', typ: 'text', pflicht: true },
    { name: 'faellig', label: 'Fällig am', typ: 'date', pflicht: true }
  ], function (w) {
    if (!leseDatum(w.faellig)) return 'Bitte ein gültiges Datum wählen.';
    daten.aufgaben.push({ id: neueId(), titel: w.titel, faellig: w.faellig, erledigt: false, vorlauf: null, ueberfaellig: false });
    aenderungFertig();
    return '';
  });
}
function aktionAufgabeHaken(ds) {
  const a = finde(daten.aufgaben, ds.id);
  if (!a) return;
  a.erledigt = !a.erledigt;
  berechneFaelligkeiten(daten, new Date());
  aenderungFertig();
}
function aktionAufgabeBearbeiten(ds) {
  const a = finde(daten.aufgaben, ds.id);
  if (!a) return;
  zeigeFormular('Aufgabe bearbeiten', [
    { name: 'titel', label: 'Aufgabe', typ: 'text', pflicht: true, wert: a.titel },
    { name: 'faellig', label: 'Fällig am', typ: 'date', pflicht: true, wert: a.faellig }
  ], function (w) {
    if (!leseDatum(w.faellig)) return 'Bitte ein gültiges Datum wählen.';
    a.titel = w.titel;
    if (w.faellig !== a.faellig) {
      a.faellig = w.faellig;
      a.vorlauf = null;          // eigenes Datum: wird nicht mehr automatisch verschoben
      a.ueberfaellig = false;
    }
    aenderungFertig();
    return '';
  });
}
function aktionAufgabeLoeschen(ds) {
  const a = finde(daten.aufgaben, ds.id);
  if (!a || !window.confirm('Aufgabe „' + a.titel + '“ löschen?')) return;
  daten.aufgaben = daten.aufgaben.filter(function (x) { return x.id !== ds.id; });
  aenderungFertig();
}
function aktionAufgabenVorlage() {
  daten.aufgaben = startAufgaben();
  berechneFaelligkeiten(daten, new Date());
  aenderungFertig();
}

/* ---------- Budget ---------- */
function renderBudgetKopf() {
  const b = budgetSummen(daten);
  const zeilen = [];
  zeilen.push(['Gesamtbudget', b.budget === null ? 'nicht festgelegt' : geld(b.budget), '']);
  zeilen.push(['Geplant', geld(b.geplant), '']);
  zeilen.push(['Tatsächlich', geld(b.tatsaechlich), '']);
  zeilen.push([b.rest < 0 ? 'Überschreitung (' + b.restVon + ')' : 'Rest (' + b.restVon + ')', geld(Math.abs(b.rest)), b.rest < 0 ? 'negativ' : 'positiv']);
  let html = '<h2>Übersicht</h2>' + zeilen.map(function (z) {
    return '<div class="summen-zeile"><span>' + esc(z[0]) + '</span><strong class="' + z[2] + '">' + esc(z[1]) + '</strong></div>';
  }).join('');
  if (b.geplantUeberBudget > 0) html += '<p class="meldung fehler">Geplant liegt ' + esc(geld(b.geplantUeberBudget)) + ' über dem Gesamtbudget.</p>';
  if (b.ueberKategorien > 0) html += '<p class="meldung fehler">' + b.ueberKategorien + (b.ueberKategorien === 1 ? ' Kategorie ist' : ' Kategorien sind') + ' über dem geplanten Betrag.</p>';
  $('b-summe').innerHTML = html;
}

function katRestHtml(k) {
  const diff = Math.round((zahl(k.geplant) - zahl(k.tatsaechlich)) * 100) / 100;
  return diff < 0 ? 'Überschritten um ' + geld(-diff) : 'Rest: ' + geld(diff);
}

function renderBudget() {
  renderBudgetKopf();
  if (!daten.budgetKat.length) {
    $('b-liste').innerHTML = '<li class="leer">Keine Kategorien.<br><br><button type="button" class="knopf" data-aktion="budget-vorlage">Startvorlage laden</button></li>';
    return;
  }
  $('b-liste').innerHTML = daten.budgetKat.map(function (k) {
    const ueber = zahl(k.tatsaechlich) > zahl(k.geplant);
    const id = esc(k.id);
    return '<li class="karte kat' + (ueber ? ' ueber' : '') + '" data-kat="' + id + '">' +
      '<div class="kat-kopf"><span class="titel">' + esc(k.name) + '</span><span class="zeile-knoepfe">' +
      '<button type="button" class="icon" data-aktion="budget-umbenennen" data-id="' + id + '" aria-label="Umbenennen">✎</button>' +
      '<button type="button" class="icon" data-aktion="budget-loeschen" data-id="' + id + '" aria-label="Löschen">✕</button></span></div>' +
      '<div class="feld-paar">' +
      '<div><label>Geplant (€)</label><input type="text" inputmode="decimal" autocomplete="off" placeholder="0" value="' + esc(feldZahl(k.geplant)) + '" data-aenderung="budget-wert" data-id="' + id + '" data-feld="geplant"></div>' +
      '<div><label>Tatsächlich (€)</label><input type="text" inputmode="decimal" autocomplete="off" placeholder="0" value="' + esc(feldZahl(k.tatsaechlich)) + '" data-aenderung="budget-wert" data-id="' + id + '" data-feld="tatsaechlich"></div>' +
      '</div><div class="kat-rest">' + esc(katRestHtml(k)) + '</div></li>';
  }).join('');
}

function aenderungBudgetWert(ds, el) {
  const k = finde(daten.budgetKat, ds.id);
  if (!k || (ds.feld !== 'geplant' && ds.feld !== 'tatsaechlich')) return;
  k[ds.feld] = zahl(el.value);
  el.value = feldZahl(k[ds.feld]);
  speichere();
  renderBudgetKopf();
  const karte = el.closest('.kat');
  if (karte) {
    karte.classList.toggle('ueber', zahl(k.tatsaechlich) > zahl(k.geplant));
    const rest = karte.querySelector('.kat-rest');
    if (rest) rest.textContent = katRestHtml(k);
  }
}

function aktionBudgetNeu() {
  zeigeFormular('Neue Kategorie', [
    { name: 'name', label: 'Name der Kategorie', typ: 'text', pflicht: true },
    { name: 'geplant', label: 'Geplant (€, freiwillig)', typ: 'dezimal' }
  ], function (w) {
    daten.budgetKat.push({ id: neueId(), name: w.name, geplant: zahl(w.geplant), tatsaechlich: 0 });
    aenderungFertig();
    return '';
  });
}
function aktionBudgetUmbenennen(ds) {
  const k = finde(daten.budgetKat, ds.id);
  if (!k) return;
  zeigeFormular('Kategorie umbenennen', [
    { name: 'name', label: 'Name der Kategorie', typ: 'text', pflicht: true, wert: k.name }
  ], function (w) {
    k.name = w.name;
    aenderungFertig();
    return '';
  });
}
function aktionBudgetLoeschen(ds) {
  const k = finde(daten.budgetKat, ds.id);
  if (!k || !window.confirm('Kategorie „' + k.name + '“ löschen?')) return;
  daten.budgetKat = daten.budgetKat.filter(function (x) { return x.id !== ds.id; });
  aenderungFertig();
}
function aktionBudgetVorlageLoeschen() {
  if (!daten.budgetKat.length) { zeigeToast('Es gibt keine Kategorien.'); return; }
  if (!window.confirm('Alle Kategorien samt Beträgen löschen?')) return;
  daten.budgetKat = [];
  aenderungFertig();
}
function aktionBudgetVorlage() {
  daten.budgetKat = startBudget();
  aenderungFertig();
}

/* ---------- Gäste ---------- */
function gefilterteGaeste() {
  if (gastFilter === 'eng') return daten.gaeste.filter(function (g) { return g.eng; });
  if (gastFilter === 'haupt') return daten.gaeste.filter(function (g) { return !g.eng; });
  return daten.gaeste;
}

function renderGaeste() {
  const s = berechneGaeste(daten.gaeste);
  const zeile = function (name, x, betont) {
    return '<tr' + (betont ? ' class="betont"' : '') + '><th scope="row">' + esc(name) + '</th><td>' + x.erw + '</td><td>' + x.kinder + '</td><td>' + x.personen + '</td></tr>';
  };
  $('g-summe').innerHTML = '<h2>Zusammenfassung</h2>' +
    '<div class="summen-zeile"><span>Einladungen gesamt</span><strong>' + s.gesamt.einl + '</strong></div>' +
    '<div class="tabelle-rahmen"><table class="tabelle"><thead><tr><th></th><th>Erwachsene</th><th>Kinder</th><th>Personen</th></tr></thead><tbody>' +
    zeile('Gesamt', s.gesamt, false) + zeile('Zugesagt', s.zugesagt, false) + zeile('Offen', s.offen, false) +
    zeile('Abgesagt', s.abgesagt, false) + zeile('Erwartet (zugesagt + offen)', s.erwartet, true) +
    '</tbody></table></div>';

  const e = berechneGaeste(daten.gaeste.filter(function (g) { return g.eng; }));
  const kasten = function (zahlWert, name) { return '<div class="zahl-kasten"><strong>' + zahlWert + '</strong><span>' + esc(name) + '</span></div>'; };
  $('g-enger').innerHTML = '<h2>' + esc(daten.engerName) + '</h2><div class="zahlen-gitter">' +
    kasten(e.gesamt.erw, 'Erwachsene') + kasten(e.gesamt.kinder, 'Kinder') + kasten(e.gesamt.personen, 'Personen') +
    kasten(e.zugesagt.personen, 'davon zugesagt') + kasten(e.offen.personen, 'davon offen') + kasten(e.gesamt.einl, 'Einladungen') + '</div>';

  const chip = function (wert, text) {
    return '<button type="button" class="chip' + (gastFilter === wert ? ' aktiv' : '') + '" data-aktion="gast-filter" data-filter="' + wert + '">' + esc(text) + '</button>';
  };
  $('g-filter').innerHTML = chip('alle', 'Alle') + chip('eng', 'Nur ' + (daten.engerName === STANDARD_ENGER ? 'engerer Kreis' : daten.engerName)) + chip('haupt', 'Nur Hauptfeier');

  const liste = gefilterteGaeste().slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'de'); });
  if (!liste.length) {
    $('g-liste').innerHTML = '<li class="leer">' + (daten.gaeste.length ? 'Keine Gäste in diesem Filter.' : 'Noch keine Gäste. Tippe oben auf „Gast hinzufügen“.') + '</li>';
    return;
  }
  $('g-liste').innerHTML = liste.map(function (g) {
    const w = gastWerte(g);
    const id = esc(g.id);
    return '<li class="zeile gast"><div class="zeile-text"><div class="titel">' + esc(g.name) +
      (w.eng ? ' <span class="marke gold-marke">' + esc(daten.engerName) + '</span>' : '') + '</div>' +
      '<div class="meta">' + esc(gastZeile(g)) + '</div>' +
      (g.notiz ? '<div class="meta notiz">' + esc(g.notiz) + '</div>' : '') + '</div>' +
      '<div class="gast-rechts"><button type="button" class="marke status-' + w.status + '" data-aktion="gast-status" data-id="' + id + '" aria-label="Status ändern">' + esc(STATUS_TEXTE[w.status]) + '</button>' +
      '<div class="zeile-knoepfe">' +
      '<button type="button" class="icon" data-aktion="gast-bearbeiten" data-id="' + id + '" aria-label="Bearbeiten">✎</button>' +
      '<button type="button" class="icon" data-aktion="gast-loeschen" data-id="' + id + '" aria-label="Löschen">✕</button></div></div></li>';
  }).join('');
}

function gastFelder(g) {
  const w = g ? gastWerte(g) : { erw: 1, kinder: 0, einl: 1, status: 'offen', eng: false };
  const engLabel = daten.engerName === STANDARD_ENGER ? 'Auch zum Engeren Kreis' : 'Auch zu: ' + daten.engerName;
  return [
    { name: 'name', label: 'Name', typ: 'text', pflicht: true, wert: g ? g.name : '' },
    { name: 'status', label: 'Status', typ: 'select', wert: w.status, optionen: [['offen', 'Offen'], ['zugesagt', 'Zugesagt'], ['abgesagt', 'Abgesagt']] },
    { name: 'erw', label: 'Anzahl Erwachsene', typ: 'ganzzahl', wert: String(w.erw) },
    { name: 'kinder', label: 'Anzahl Kinder', typ: 'ganzzahl', wert: String(w.kinder) },
    { name: 'einl', label: 'Anzahl Einladungen', typ: 'ganzzahl', wert: String(w.einl) },
    { name: 'eng', label: engLabel, typ: 'check', wert: w.eng },
    { name: 'notiz', label: 'Notiz', typ: 'text', wert: g ? (g.notiz || '') : '', max: 300 }
  ];
}

function gastPruefen(w) {
  const erw = ganzzahl(w.erw);
  const kinder = ganzzahl(w.kinder);
  const einl = ganzzahl(w.einl);
  if (erw === null || kinder === null || einl === null) return 'Bitte nur ganze Zahlen eingeben (0 ist erlaubt).';
  if (erw + kinder === 0) return 'Erwachsene und Kinder dürfen nicht beide 0 sein.';
  return { erw: erw, kinder: kinder, einl: einl };
}

function aktionGastNeu() {
  zeigeFormular('Neuer Gast', gastFelder(null), function (w) {
    const z = gastPruefen(w);
    if (typeof z === 'string') return z;
    daten.gaeste.push({ id: neueId(), name: w.name, status: w.status, erw: z.erw, kinder: z.kinder, einl: z.einl, eng: w.eng, notiz: w.notiz });
    aenderungFertig();
    return '';
  });
}
function aktionGastBearbeiten(ds) {
  const g = finde(daten.gaeste, ds.id);
  if (!g) return;
  zeigeFormular('Gast bearbeiten', gastFelder(g), function (w) {
    const z = gastPruefen(w);
    if (typeof z === 'string') return z;
    g.name = w.name; g.status = w.status; g.erw = z.erw; g.kinder = z.kinder; g.einl = z.einl; g.eng = w.eng; g.notiz = w.notiz;
    delete g.personen;   // alter Wert wird nicht mehr gebraucht
    aenderungFertig();
    return '';
  });
}
function aktionGastLoeschen(ds) {
  const g = finde(daten.gaeste, ds.id);
  if (!g || !window.confirm('Gast „' + g.name + '“ löschen?')) return;
  daten.gaeste = daten.gaeste.filter(function (x) { return x.id !== ds.id; });
  aenderungFertig();
}
function aktionGastStatus(ds) {
  const g = finde(daten.gaeste, ds.id);
  if (!g) return;
  g.status = STATUS_FOLGE[gastWerte(g).status];
  aenderungFertig();
}
function aktionGastFilter(ds) {
  gastFilter = ds.filter;
  renderGaeste();
}

/* ---------- Dienstleister ---------- */
function renderDienstleister() {
  if (!daten.dienstleister.length) {
    $('d-liste').innerHTML = '<li class="leer">Noch keine Dienstleister.</li>';
    return;
  }
  $('d-liste').innerHTML = daten.dienstleister.map(function (d) {
    const id = esc(d.id);
    return '<li class="zeile"><div class="zeile-text"><div class="titel">' + esc(d.name) + '</div><div class="meta">' + esc(d.art || 'Ohne Art') + '</div></div>' +
      '<div class="zeile-knoepfe">' +
      '<button type="button" class="icon" data-aktion="dl-bearbeiten" data-id="' + id + '" aria-label="Bearbeiten">✎</button>' +
      '<button type="button" class="icon" data-aktion="dl-loeschen" data-id="' + id + '" aria-label="Löschen">✕</button></div></li>';
  }).join('');
}
function dlFelder(d) {
  return [
    { name: 'name', label: 'Name', typ: 'text', pflicht: true, wert: d ? d.name : '' },
    { name: 'art', label: 'Art (z. B. Fotograf)', typ: 'text', wert: d ? d.art : '', liste: DIENSTLEISTER_ARTEN }
  ];
}
function aktionDlNeu() {
  zeigeFormular('Neuer Dienstleister', dlFelder(null), function (w) {
    daten.dienstleister.push({ id: neueId(), name: w.name, art: w.art });
    aenderungFertig();
    return '';
  });
}
function aktionDlBearbeiten(ds) {
  const d = finde(daten.dienstleister, ds.id);
  if (!d) return;
  zeigeFormular('Dienstleister bearbeiten', dlFelder(d), function (w) {
    d.name = w.name;
    d.art = w.art;
    aenderungFertig();
    return '';
  });
}
function aktionDlLoeschen(ds) {
  const d = finde(daten.dienstleister, ds.id);
  if (!d || !window.confirm('„' + d.name + '“ löschen?')) return;
  daten.dienstleister = daten.dienstleister.filter(function (x) { return x.id !== ds.id; });
  aenderungFertig();
}

/* ---------- Ablaufplan ---------- */
function renderAblauf() {
  if (!daten.ablauf.length) {
    $('a-liste').innerHTML = '<li class="leer">Noch keine Programmpunkte.</li>';
    return;
  }
  $('a-liste').innerHTML = daten.ablauf.map(function (p) {
    const id = esc(p.id);
    return '<li class="zeile ablauf-zeile" data-id="' + id + '">' +
      '<span class="griff" aria-label="Verschieben" role="button">☰</span>' +
      '<div class="zeit">' + esc(p.zeit) + '</div>' +
      '<div class="zeile-text"><div class="titel">' + esc(p.titel) + '</div></div>' +
      '<div class="zeile-knoepfe">' +
      '<button type="button" class="icon" data-aktion="ablauf-bearbeiten" data-id="' + id + '" aria-label="Bearbeiten">✎</button>' +
      '<button type="button" class="icon" data-aktion="ablauf-loeschen" data-id="' + id + '" aria-label="Löschen">✕</button></div></li>';
  }).join('');
}
function ablaufFelder(p) {
  return [
    { name: 'zeit', label: 'Uhrzeit', typ: 'time', pflicht: true, wert: p ? p.zeit : '' },
    { name: 'titel', label: 'Titel', typ: 'text', pflicht: true, wert: p ? p.titel : '' }
  ];
}
function aktionAblaufNeu() {
  zeigeFormular('Neuer Programmpunkt', ablaufFelder(null), function (w) {
    daten.ablauf.push({ id: neueId(), zeit: w.zeit, titel: w.titel });
    aenderungFertig();
    return '';
  });
}
function aktionAblaufBearbeiten(ds) {
  const p = finde(daten.ablauf, ds.id);
  if (!p) return;
  zeigeFormular('Programmpunkt bearbeiten', ablaufFelder(p), function (w) {
    p.zeit = w.zeit;
    p.titel = w.titel;
    aenderungFertig();
    return '';
  });
}
function aktionAblaufLoeschen(ds) {
  const p = finde(daten.ablauf, ds.id);
  if (!p || !window.confirm('Programmpunkt „' + p.titel + '“ löschen?')) return;
  daten.ablauf = daten.ablauf.filter(function (x) { return x.id !== ds.id; });
  aenderungFertig();
}
function aktionAblaufSortieren() {
  daten.ablauf.sort(function (a, b) { return String(a.zeit).localeCompare(String(b.zeit)); });
  aenderungFertig();
}

/* Drag & Drop mit Pointer-Events (Symbol ☰, touch-action: none) */
function ziehStart(e) {
  const griff = e.target && e.target.closest ? e.target.closest('.griff') : null;
  if (!griff) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const zeile = griff.closest('.ablauf-zeile');
  if (!zeile || zieh) return;
  e.preventDefault();
  const zeilen = Array.prototype.slice.call(zeile.parentNode.children);
  const sy = window.pageYOffset;
  zieh = {
    griff: griff, zeile: zeile, zeilen: zeilen, pid: e.pointerId,
    von: zeilen.indexOf(zeile), ziel: zeilen.indexOf(zeile), startY: e.clientY + sy,
    rects: zeilen.map(function (z) { const r = z.getBoundingClientRect(); return { top: r.top + sy, hoehe: r.height }; })
  };
  try { griff.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
  griff.addEventListener('pointermove', ziehBewegung);
  griff.addEventListener('pointerup', ziehEnde);
  griff.addEventListener('pointercancel', ziehAbbruch);
  zeile.classList.add('zieht');
}
function ziehBewegung(e) {
  if (!zieh || e.pointerId !== zieh.pid) return;
  e.preventDefault();
  if (e.clientY < 90) window.scrollBy(0, -10);
  else if (e.clientY > window.innerHeight - 90) window.scrollBy(0, 10);
  const dy = e.clientY + window.pageYOffset - zieh.startY;
  const r = zieh.rects[zieh.von];
  const mitte = r.top + r.hoehe / 2 + dy;
  let ziel = 0;
  zieh.rects.forEach(function (x, j) { if (j !== zieh.von && x.top + x.hoehe / 2 < mitte) ziel++; });
  zieh.ziel = ziel;
  zieh.zeile.style.transform = 'translateY(' + dy + 'px)';
  const platz = r.hoehe + 8;
  zieh.zeilen.forEach(function (z, j) {
    if (j === zieh.von) return;
    let versatz = 0;
    if (zieh.von < ziel && j > zieh.von && j <= ziel) versatz = -platz;
    else if (zieh.von > ziel && j >= ziel && j < zieh.von) versatz = platz;
    z.style.transform = versatz ? 'translateY(' + versatz + 'px)' : '';
  });
}
function ziehAufraeumen() {
  const z = zieh;
  z.griff.removeEventListener('pointermove', ziehBewegung);
  z.griff.removeEventListener('pointerup', ziehEnde);
  z.griff.removeEventListener('pointercancel', ziehAbbruch);
  try { z.griff.releasePointerCapture(z.pid); } catch (x) { /* egal */ }
  z.zeilen.forEach(function (el) { el.style.transform = ''; });
  z.zeile.classList.remove('zieht');
  zieh = null;
  return z;
}
function ziehEnde(e) {
  if (!zieh || e.pointerId !== zieh.pid) return;
  const z = ziehAufraeumen();
  if (z.ziel !== z.von) {
    const punkt = daten.ablauf.splice(z.von, 1)[0];
    daten.ablauf.splice(z.ziel, 0, punkt);
    speichere();
  }
  renderAblauf();
}
function ziehAbbruch() {
  if (!zieh) return;
  ziehAufraeumen();
  renderAblauf();
}

/* ---------- Notizen ---------- */
function renderNotizen() {
  if (notizFilter !== 'alle' && notizFilter !== '__ohne' && daten.notizKat.indexOf(notizFilter) === -1) notizFilter = 'alle';
  const hatOhne = daten.notizen.some(function (n) { return !n.kat || daten.notizKat.indexOf(n.kat) === -1; });
  const chip = function (wert, text) {
    return '<button type="button" class="chip' + (notizFilter === wert ? ' aktiv' : '') + '" data-aktion="notiz-filter" data-kat="' + esc(wert) + '">' + esc(text) + '</button>';
  };
  let f = chip('alle', 'Alle');
  daten.notizKat.forEach(function (k) { f += chip(k, k); });
  if (hatOhne) f += chip('__ohne', 'Ohne Kategorie');
  $('n-filter').innerHTML = f;

  const liste = daten.notizen.filter(function (n) {
    const gueltig = n.kat && daten.notizKat.indexOf(n.kat) !== -1;
    if (notizFilter === 'alle') return true;
    if (notizFilter === '__ohne') return !gueltig;
    return n.kat === notizFilter;
  });
  if (!liste.length) {
    $('n-liste').innerHTML = '<li class="leer">Keine Notizen.</li>';
  } else {
    $('n-liste').innerHTML = liste.map(function (n) {
      const id = esc(n.id);
      const gueltig = n.kat && daten.notizKat.indexOf(n.kat) !== -1;
      return '<li class="zeile"><div class="zeile-text"><div class="titel">' + esc(n.titel) + '</div>' +
        '<div class="meta"><span class="marke gold-marke">' + esc(gueltig ? n.kat : 'Ohne Kategorie') + '</span></div>' +
        (n.text ? '<div class="meta" style="white-space:pre-wrap">' + esc(n.text) + '</div>' : '') + '</div>' +
        '<div class="zeile-knoepfe">' +
        '<button type="button" class="icon" data-aktion="notiz-bearbeiten" data-id="' + id + '" aria-label="Bearbeiten">✎</button>' +
        '<button type="button" class="icon" data-aktion="notiz-loeschen" data-id="' + id + '" aria-label="Löschen">✕</button></div></li>';
    }).join('');
  }

  $('n-kategorien').innerHTML = daten.notizKat.length ? daten.notizKat.map(function (k) {
    return '<div class="kat-zeile"><span>' + esc(k) + '</span><span class="zeile-knoepfe">' +
      '<button type="button" class="icon" data-aktion="kat-umbenennen" data-kat="' + esc(k) + '" aria-label="Umbenennen">✎</button>' +
      '<button type="button" class="icon" data-aktion="kat-loeschen" data-kat="' + esc(k) + '" aria-label="Löschen">✕</button></span></div>';
  }).join('') + '<div style="height:12px"></div>' : '<p class="hinweis">Keine Kategorien.</p>';
}

function notizFelder(n) {
  const opt = [['', 'Ohne Kategorie']].concat(daten.notizKat.map(function (k) { return [k, k]; }));
  return [
    { name: 'titel', label: 'Titel', typ: 'text', pflicht: true, wert: n ? n.titel : '' },
    { name: 'text', label: 'Text', typ: 'area', wert: n ? n.text : '' },
    { name: 'kat', label: 'Kategorie', typ: 'select', optionen: opt, wert: n ? n.kat : (daten.notizKat.indexOf(notizFilter) !== -1 ? notizFilter : '') }
  ];
}
function aktionNotizNeu() {
  zeigeFormular('Neue Notiz', notizFelder(null), function (w) {
    daten.notizen.push({ id: neueId(), titel: w.titel, text: w.text, kat: w.kat });
    aenderungFertig();
    return '';
  });
}
function aktionNotizBearbeiten(ds) {
  const n = finde(daten.notizen, ds.id);
  if (!n) return;
  zeigeFormular('Notiz bearbeiten', notizFelder(n), function (w) {
    n.titel = w.titel; n.text = w.text; n.kat = w.kat;
    aenderungFertig();
    return '';
  });
}
function aktionNotizLoeschen(ds) {
  const n = finde(daten.notizen, ds.id);
  if (!n || !window.confirm('Notiz „' + n.titel + '“ löschen?')) return;
  daten.notizen = daten.notizen.filter(function (x) { return x.id !== ds.id; });
  aenderungFertig();
}
function aktionNotizFilter(ds) {
  notizFilter = ds.kat;
  renderNotizen();
}
function katNameFrei(name, ausser) {
  return !daten.notizKat.some(function (k) { return k !== ausser && k.toLowerCase() === name.toLowerCase(); });
}
function aktionKatNeu() {
  zeigeFormular('Neue Kategorie', [{ name: 'name', label: 'Name der Kategorie', typ: 'text', pflicht: true, max: 40 }], function (w) {
    if (!katNameFrei(w.name, '')) return 'Diese Kategorie gibt es schon.';
    daten.notizKat.push(w.name);
    aenderungFertig();
    return '';
  });
}
function aktionKatUmbenennen(ds) {
  const alt = ds.kat;
  if (daten.notizKat.indexOf(alt) === -1) return;
  zeigeFormular('Kategorie umbenennen', [{ name: 'name', label: 'Name der Kategorie', typ: 'text', pflicht: true, wert: alt, max: 40 }], function (w) {
    if (!katNameFrei(w.name, alt)) return 'Diese Kategorie gibt es schon.';
    daten.notizKat[daten.notizKat.indexOf(alt)] = w.name;
    daten.notizen.forEach(function (n) { if (n.kat === alt) n.kat = w.name; });
    if (notizFilter === alt) notizFilter = w.name;
    aenderungFertig();
    return '';
  });
}
function aktionKatLoeschen(ds) {
  const k = ds.kat;
  if (daten.notizKat.indexOf(k) === -1) return;
  if (!window.confirm('Kategorie „' + k + '“ löschen? Die Notizen bleiben erhalten (ohne Kategorie).')) return;
  daten.notizKat = daten.notizKat.filter(function (x) { return x !== k; });
  daten.notizen.forEach(function (n) { if (n.kat === k) n.kat = ''; });
  aenderungFertig();
}

/* ---------- Einstellungen ---------- */
function renderEinstellungen() {
  $('e-name1').value = daten.name1;
  $('e-name2').value = daten.name2;
  $('e-datum').value = daten.datum;
  $('e-budget').value = daten.budget === null ? '' : feldZahl(daten.budget);
  $('e-enger').value = daten.engerName;
  $('e-meldung').hidden = true;
  $('ort-text').textContent = speicherModus === 'cloud'
    ? 'Aktuell: In der Cloud (mit Konto).'
    : 'Aktuell: Lokal auf diesem Gerät.';
  $('konto-karte').hidden = speicherModus !== 'cloud';
  if (speicherModus === 'cloud') {
    const mail = cloudModul && cloudModul.aktuelleEmail ? cloudModul.aktuelleEmail() : '';
    $('konto-text').textContent = mail ? 'Angemeldet als ' + mail : 'Angemeldet.';
  }
}
function einstMeldung(text, istFehler) {
  const m = $('e-meldung');
  m.textContent = text;
  m.className = 'meldung ' + (istFehler ? 'fehler' : 'ok');
  m.hidden = false;
}
function aktionEinstSpeichern() {
  const n1 = $('e-name1').value.trim();
  const n2 = $('e-name2').value.trim();
  const dat = $('e-datum').value;
  if (!n1 || !n2) { einstMeldung('Bitte beide Namen eingeben.', true); return; }
  if (!leseDatum(dat)) { einstMeldung('Bitte ein gültiges Hochzeitsdatum wählen.', true); return; }
  daten.name1 = n1;
  daten.name2 = n2;
  daten.datum = dat;
  daten.budget = zahlOderNull($('e-budget').value);
  daten.engerName = $('e-enger').value.trim() || STANDARD_ENGER;
  berechneFaelligkeiten(daten, new Date());
  speichere();
  aktualisiereKopf();
  einstMeldung('Gespeichert.', false);
}

/* ---------- Ereignisse ---------- */
const AKTIONEN = {
  'nav': function (ds) { zeigeAnsicht(ds.ansicht); },
  'wahl-lokal': function () { setzeSpeicherort('lokal'); },
  'wahl-cloud': function () { setzeSpeicherort('cloud'); },
  'registrieren': function () { aktionAnmelden(true); },
  'passwort-vergessen': aktionPasswortVergessen,
  'lieber-lokal': aktionLieberLokal,
  'lade-nochmal': function () { if (cloudModul && cloudModul.aktuelleUid()) { ladeAusCloud().catch(function (e) { zeigeLade(fehlerText(e), true); }); } else { startCloud(); } },
  'lade-lokal': aktionLieberLokal,
  'ics': aktionIcs,
  'aufgabe-neu': aktionAufgabeNeu,
  'aufgabe-haken': aktionAufgabeHaken,
  'aufgabe-bearbeiten': aktionAufgabeBearbeiten,
  'aufgabe-loeschen': aktionAufgabeLoeschen,
  'aufgaben-vorlage': aktionAufgabenVorlage,
  'budget-neu': aktionBudgetNeu,
  'budget-umbenennen': aktionBudgetUmbenennen,
  'budget-loeschen': aktionBudgetLoeschen,
  'budget-vorlage-loeschen': aktionBudgetVorlageLoeschen,
  'budget-vorlage': aktionBudgetVorlage,
  'gast-neu': aktionGastNeu,
  'gast-bearbeiten': aktionGastBearbeiten,
  'gast-loeschen': aktionGastLoeschen,
  'gast-status': aktionGastStatus,
  'gast-filter': aktionGastFilter,
  'dl-neu': aktionDlNeu,
  'dl-bearbeiten': aktionDlBearbeiten,
  'dl-loeschen': aktionDlLoeschen,
  'ablauf-neu': aktionAblaufNeu,
  'ablauf-bearbeiten': aktionAblaufBearbeiten,
  'ablauf-loeschen': aktionAblaufLoeschen,
  'ablauf-sortieren': aktionAblaufSortieren,
  'notiz-neu': aktionNotizNeu,
  'notiz-bearbeiten': aktionNotizBearbeiten,
  'notiz-loeschen': aktionNotizLoeschen,
  'notiz-filter': aktionNotizFilter,
  'kat-neu': aktionKatNeu,
  'kat-umbenennen': aktionKatUmbenennen,
  'kat-loeschen': aktionKatLoeschen,
  'einst-speichern': aktionEinstSpeichern,
  'speicherort-wechseln': aktionSpeicherortWechseln,
  'abmelden': aktionAbmelden,
  'alles-loeschen': aktionAllesLoeschen,
  'modal-abbrechen': schliesseFormular
};

const AENDERUNGEN = {
  'budget-wert': aenderungBudgetWert
};

function registriereEreignisse() {
  document.addEventListener('click', function (e) {
    const t = e.target && e.target.closest ? e.target.closest('[data-aktion]') : null;
    if (!t) return;
    const f = AKTIONEN[t.dataset.aktion];
    if (f) f(t.dataset, t);
  });
  document.addEventListener('change', function (e) {
    const t = e.target;
    const n = t && t.dataset ? t.dataset.aenderung : '';
    if (n && AENDERUNGEN[n]) AENDERUNGEN[n](t.dataset, t);
  });
  document.addEventListener('pointerdown', ziehStart);
  $('login-form').addEventListener('submit', function (e) { e.preventDefault(); aktionAnmelden(false); });
  $('willkommen-form').addEventListener('submit', function (e) { e.preventDefault(); aktionWillkommen(); });
  $('modal-form').addEventListener('submit', function (e) { e.preventDefault(); aktionModalOk(); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      if (speicherTimer && speicherModus === 'cloud') { clearTimeout(speicherTimer); cloudSpeichern(); }
    } else {
      aktualisiereAusCloud();
    }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startApp);
else startApp();
