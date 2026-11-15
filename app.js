// School Fees Tracker – vanilla JS, data in localStorage.
const KEY = "sft-data-v1";
const GRADES = ["Playgroup", "PP1", "PP2", ...Array.from({ length: 9 }, (_, i) => `Grade ${i + 1}`)];
const $ = (s, el = document) => el.querySelector(s);
const kes = n => "KES " + Math.round(n).toLocaleString("en-KE");
const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);

let db = load();
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { learners: [], charges: [], payments: [] }; }
  catch { return { learners: [], charges: [], payments: [] }; }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { notify("Could not save in this browser (private mode?)."); } render(); }

function totals(lid) {
  const charged = db.charges.filter(c => c.lid === lid).reduce((s, c) => s + c.amount, 0);
  const paid = db.payments.filter(p => p.lid === lid).reduce((s, p) => s + p.amount, 0);
  return { charged, paid, balance: charged - paid };
}
function learnerLabel(l) { return `${l.name} (${l.adm})`; }
function cell(text, cls) { const td = document.createElement("td"); td.textContent = text; if (cls) td.className = cls; return td; }
function notify(msg) { const n = $("#notice"); n.textContent = msg; n.hidden = false; clearTimeout(notify.t); notify.t = setTimeout(() => n.hidden = true, 3500); }

// ---------- Rendering ----------
function render() {
  const rows = db.learners.map(l => ({ l, ...totals(l.id) }));
  const charged = rows.reduce((s, r) => s + r.charged, 0), paid = rows.reduce((s, r) => s + r.paid, 0);
  $("#s-charged").textContent = kes(charged);
  $("#s-paid").textContent = kes(paid);
  $("#s-balance").textContent = kes(charged - paid);
  const rate = charged ? Math.min(100, Math.round(paid / charged * 100)) : 0;
  $("#s-rate").textContent = rate + "%";
  $("#s-bar").style.width = rate + "%";
  $("#empty").hidden = db.learners.length > 0;

  // By class
  const tb = $("#class-table tbody"); tb.innerHTML = "";
  for (const g of GRADES) {
    const rs = rows.filter(r => r.l.grade === g);
    if (!rs.length) continue;
    const c = rs.reduce((s, r) => s + r.charged, 0), p = rs.reduce((s, r) => s + r.paid, 0);
    const tr = document.createElement("tr");
    tr.append(cell(g), cell(rs.length, "n"), cell(kes(c), "n"), cell(kes(p), "n"), cell(kes(c - p), "n " + (c - p > 0 ? "owe" : "ok")));
    tb.append(tr);
  }

  // Recent payments
  const feed = $("#recent"); feed.innerHTML = "";
  const recent = [...db.payments].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts).slice(0, 6);
  if (!recent.length) feed.innerHTML = '<li class="muted">No payments yet.</li>';
  for (const p of recent) {
    const l = db.learners.find(x => x.id === p.lid); if (!l) continue;
    const li = document.createElement("li");
    li.innerHTML = '<span class="pill"></span><div><strong></strong><small></small></div><b></b>';
    li.querySelector(".pill").textContent = p.method;
    li.querySelector("strong").textContent = l.name;
    li.querySelector("small").textContent = `${p.date}${p.ref ? " · " + p.ref : ""}`;
    li.querySelector("b").textContent = kes(p.amount);
    feed.append(li);
  }

  // Learners table
  const q = $("#search").value.trim().toLowerCase(), fc = $("#filter-class").value, owing = $("#only-owing").checked;
  const lt = $("#learner-table tbody"); lt.innerHTML = "";
  const list = rows.filter(r => (!q || r.l.name.toLowerCase().includes(q) || r.l.adm.toLowerCase().includes(q))
    && (!fc || r.l.grade === fc) && (!owing || r.balance > 0))
    .sort((a, b) => GRADES.indexOf(a.l.grade) - GRADES.indexOf(b.l.grade) || a.l.name.localeCompare(b.l.name));
  for (const r of list) {
    const tr = document.createElement("tr");
    tr.append(cell(r.l.adm, "mono"), cell(r.l.name), cell(r.l.grade), cell(kes(r.charged), "n"), cell(kes(r.paid), "n"),
      cell(kes(r.balance), "n " + (r.balance > 0 ? "owe" : "ok")));
    const td = document.createElement("td"); td.className = "actions";
    td.innerHTML = '<button class="link" data-act="stmt">Statement</button><button class="link danger" data-act="del">Remove</button>';
    td.dataset.id = r.l.id; tr.append(td); lt.append(tr);
  }
  if (!list.length) lt.innerHTML = `<tr><td colspan="7" class="muted center">${db.learners.length ? "No learners match." : "No learners yet."}</td></tr>`;

  // Payments table
  const pt = $("#payment-table tbody"); pt.innerHTML = "";
  for (const p of [...db.payments].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts)) {
    const l = db.learners.find(x => x.id === p.lid);
    const tr = document.createElement("tr");
    tr.append(cell(p.date), cell(l ? learnerLabel(l) : "—"), cell(p.method), cell(p.ref || "—", "mono"), cell(kes(p.amount), "n"));
    const td = document.createElement("td"); td.className = "actions";
    td.innerHTML = '<button class="link danger" data-act="delpay">Delete</button>'; td.dataset.id = p.id; tr.append(td); pt.append(tr);
  }
  if (!db.payments.length) pt.innerHTML = '<tr><td colspan="6" class="muted center">No payments recorded.</td></tr>';

  // Learner datalist
  const dl = $("#learner-list"); dl.innerHTML = "";
  for (const l of db.learners) dl.append(new Option(learnerLabel(l)));
}

// ---------- Statement ----------
function statement(lid) {
  const l = db.learners.find(x => x.id === lid); if (!l) return;
  const items = [
    ...db.charges.filter(c => c.lid === lid).map(c => ({ date: c.date, desc: c.desc, debit: c.amount, credit: 0 })),
    ...db.payments.filter(p => p.lid === lid).map(p => ({ date: p.date, desc: `Payment – ${p.method}${p.ref ? " " + p.ref : ""}`, debit: 0, credit: p.amount })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  let bal = 0;
  const body = $("#stmt-body");
  body.innerHTML = `<h2>Fee statement</h2><p class="stmt-who"></p><table class="table"><thead><tr><th>Date</th><th>Description</th>
    <th class="n">Charged</th><th class="n">Paid</th><th class="n">Balance</th></tr></thead><tbody></tbody></table><p class="stmt-total"></p>`;
  $(".stmt-who", body).textContent = `${l.name} · Adm ${l.adm} · ${l.grade} · printed ${todayISO()}`;
  const tb = $("tbody", body);
  for (const it of items) {
    bal += it.debit - it.credit;
    const tr = document.createElement("tr");
    tr.append(cell(it.date), cell(it.desc), cell(it.debit ? kes(it.debit) : "", "n"), cell(it.credit ? kes(it.credit) : "", "n"), cell(kes(bal), "n"));
    tb.append(tr);
  }
  if (!items.length) tb.innerHTML = '<tr><td colspan="5" class="muted center">No transactions.</td></tr>';
  $(".stmt-total", body).textContent = `Balance due: ${kes(bal)}`;
  $("#statement").showModal();
}

// ---------- Events ----------
document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".tabs button").forEach(x => x.setAttribute("aria-selected", x === b));
  document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== "view-" + b.dataset.view);
}));
for (const sel of ["#learner-form select", "#charge-form select", "#filter-class"]) for (const g of GRADES) $(sel).append(new Option(g));
["#search", "#filter-class", "#only-owing"].forEach(s => $(s).addEventListener("input", render));
$("#payment-form").elements.date.value = todayISO();

$("#learner-form").addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target.elements, adm = f.adm.value.trim();
  if (db.learners.some(l => l.adm.toLowerCase() === adm.toLowerCase())) return notify(`Admission no ${adm} is already used.`);
  db.learners.push({ id: uid(), adm, name: f.name.value.trim(), grade: f.grade.value, phone: f.phone.value.trim() });
  e.target.reset(); save(); notify("Learner added.");
});
$("#payment-form").addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target.elements, l = db.learners.find(x => learnerLabel(x) === f.learner.value || x.adm === f.learner.value.trim());
  if (!l) return notify("Choose a learner from the list.");
  const amount = Number(f.amount.value);
  if (!(amount > 0)) return notify("Enter an amount above zero.");
  const ref = f.ref.value.trim().toUpperCase();
  if (ref && db.payments.some(p => p.ref === ref)) return notify(`Reference ${ref} was already recorded. Duplicate payment?`);
  db.payments.push({ id: uid(), lid: l.id, amount, method: f.method.value, ref, date: f.date.value, ts: Date.now() });
  e.target.reset(); f.date.value = todayISO(); save();
  notify(`${kes(amount)} recorded for ${l.name}. New balance: ${kes(totals(l.id).balance)}.`);
});
$("#charge-form").addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target.elements, amount = Number(f.amount.value), learners = db.learners.filter(l => l.grade === f.grade.value);
  if (!learners.length) return notify(`No learners in ${f.grade.value} yet.`);
  for (const l of learners) db.charges.push({ id: uid(), lid: l.id, amount, desc: f.desc.value.trim(), date: todayISO() });
  e.target.reset(); save(); notify(`Charged ${kes(amount)} to ${learners.length} learner(s).`);
});
document.addEventListener("click", e => {
  const b = e.target.closest("button[data-act]"); if (!b) return;
  const id = b.closest("td").dataset.id;
  if (b.dataset.act === "stmt") statement(id);
  if (b.dataset.act === "del" && confirm("Remove this learner and all their fee records?")) {
    db.learners = db.learners.filter(l => l.id !== id); db.charges = db.charges.filter(c => c.lid !== id); db.payments = db.payments.filter(p => p.lid !== id); save();
  }
  if (b.dataset.act === "delpay" && confirm("Delete this payment?")) { db.payments = db.payments.filter(p => p.id !== id); save(); }
});
$("#close-stmt").addEventListener("click", () => $("#statement").close());
$("#export").addEventListener("click", () => {
  const esc = v => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [["Adm no", "Name", "Class", "Parent phone", "Charged", "Paid", "Balance"].map(esc).join(",")];
  for (const l of db.learners) { const t = totals(l.id); lines.push([l.adm, l.name, l.grade, l.phone || "", t.charged, t.paid, t.balance].map(esc).join(",")); }
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })), download: `fee-balances-${todayISO()}.csv` });
  a.click(); URL.revokeObjectURL(a.href);
});
$("#clear").addEventListener("click", () => { if (confirm("Delete ALL learners, charges and payments in this browser?")) { db = { learners: [], charges: [], payments: [] }; save(); } });
function sample() {
  if (db.learners.length && !confirm("Replace your data with sample data?")) return;
  db = { learners: [], charges: [], payments: [] };
  const names = ["Amani Otieno", "Wanjiru Kamau", "Baraka Mwangi", "Faith Chebet", "Kevin Odhiambo", "Neema Wairimu", "Brian Kiptoo",
    "Achieng Atieno", "Daniel Mutua", "Grace Njeri", "Ian Kariuki", "Mercy Akinyi", "Samuel Kimani", "Joy Wambui", "Victor Omondi"];
  const fees = { "Grade 1": 11000, "Grade 4": 14000, "Grade 7": 18000 };
  names.forEach((name, i) => {
    const grade = Object.keys(fees)[i % 3], id = uid();
    db.learners.push({ id, adm: String(1001 + i), name, grade, phone: "" });
    db.charges.push({ id: uid(), lid: id, amount: fees[grade], desc: "Term 1 2027 tuition", date: "2027-01-05" });
    db.charges.push({ id: uid(), lid: id, amount: 1500, desc: "Term 1 2027 activity fee", date: "2027-01-05" });
    const pay = [fees[grade] + 1500, fees[grade], Math.round(fees[grade] / 2), 0][i % 4];
    if (pay) db.payments.push({ id: uid(), lid: id, amount: pay, method: i % 3 ? "M-Pesa" : "Bank", ref: (i % 3 ? "SKL" : "BNK") + (4821 + i * 37), date: `2027-01-${String(6 + i).padStart(2, "0")}`, ts: i });
  });
  save(); notify("Sample data loaded (fictional learners).");
}
$("#load-sample").addEventListener("click", sample);
$("#load-sample-2").addEventListener("click", sample);
if (location.hash === "#demo" && !db.learners.length) { sample(); history.replaceState(null, "", location.pathname); }
render();
