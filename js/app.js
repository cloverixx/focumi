function _serialize(value) {
  if (value === null) return "Z";
  const t = typeof value;
  if (t === "string") {
    const enc = encodeURIComponent(value);
    return "S" + enc.length + ":" + enc;
  }
  if (t === "number") {
    const txt = String(value);
    return "N" + txt.length + ":" + txt;
  }
  if (t === "boolean") {
    return "B" + (value ? "1" : "0");
  }
  if (Array.isArray(value)) {
    let out = "A" + value.length + ":";
    for (let i = 0; i < value.length; i++) {
      out += _serialize(value[i]);
    }
    return out;
  }
  if (t === "object") {
    const keys = Object.keys(value);
    let out = "O" + keys.length + ":";
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const encKey = encodeURIComponent(k);
      out += encKey.length + ":" + encKey + _serialize(value[k]);
    }
    return out;
  }
  const enc = encodeURIComponent(String(value));
  return "S" + enc.length + ":" + enc;
}
function _deserialize(serial) {
  if (typeof serial !== "string") return null;
  let i = 0;
  const N = serial.length;
  function readUntilColon() {
    let start = i;
    while (i < N && serial[i] !== ":") i++;
    if (i >= N) return null;
    const token = serial.slice(start, i);
    i++;
    return token;
  }
  function parseValue() {
    if (i >= N) return null;
    const ch = serial[i++];
    if (ch === "Z") {
      return null;
    }
    if (ch === "B") {
      const b = serial[i++];
      return b === "1";
    }
    if (ch === "S") {
      const lenToken = readUntilColon();
      if (lenToken === null) return "";
      const len = parseInt(lenToken, 10);
      const slice = serial.substr(i, len);
      i += len;
      try {
        return decodeURIComponent(slice);
      } catch (e) {
        return slice;
      }
    }
    if (ch === "N") {
      const lenToken = readUntilColon();
      if (lenToken === null) return 0;
      const len = parseInt(lenToken, 10);
      const slice = serial.substr(i, len);
      i += len;
      const n = Number(slice);
      return isNaN(n) ? 0 : n;
    }
    if (ch === "A") {
      const countToken = readUntilColon();
      if (countToken === null) return [];
      const cnt = parseInt(countToken, 10);
      const arr = [];
      for (let k = 0; k < cnt; k++) {
        arr.push(parseValue());
      }
      return arr;
    }
    if (ch === "O") {
      const countToken = readUntilColon();
      if (countToken === null) return {};
      const cnt = parseInt(countToken, 10);
      const obj = {};
      for (let k = 0; k < cnt; k++) {
        let start = i;
        while (i < N && serial[i] !== ":") i++;
        const keyLenToken = serial.slice(start, i);
        i++;
        const keyLen = parseInt(keyLenToken, 10);
        const keyEnc = serial.substr(i, keyLen);
        i += keyLen;
        let key;
        try {
          key = decodeURIComponent(keyEnc);
        } catch (e) {
          key = keyEnc;
        }
        const val = parseValue();
        obj[key] = val;
      }
      return obj;
    }
    return null;
  }
  try {
    i = 0;
    return parseValue();
  } catch (e) {
    return null;
  }
}
function setCookie(name, value, days = 365) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  try {
    const serial = _serialize(value);
    const stored = encodeURIComponent(serial);
    document.cookie = name + "=" + stored + ";expires=" + d.toUTCString() + ";path=/";
  } catch (e) {
    const fall = encodeURIComponent(String(value));
    document.cookie = name + "=" + fall + ";expires=" + d.toUTCString() + ";path=/";
  }
}
function getCookie(name) {
  const parts = document.cookie.split("; ").find((row) => row.startsWith(name + "="));
  if (!parts) return null;
  try {
    const raw = parts.split("=")[1] || "";
    const decoded = decodeURIComponent(raw);
    const data = _deserialize(decoded);
    return data;
  } catch (e) {
    try {
      const raw = parts.split("=")[1] || "";
      return decodeURIComponent(raw);
    } catch (e2) {
      return null;
    }
  }
}
function applyVisibilityMap(map) {
  if (!map) return;
  Object.keys(map).forEach((id) => {
    const show = !!map[id];
    const $w = $("#" + id);
    if (!$w.length) return;
    if (show) $w.show();
    else $w.hide();
    $('.feature-btn[data-target="' + id + '"]').toggleClass("active", show);
  });
}
$(document).on("click", ".feature-btn", function () {
  const targetId = $(this).data("target");
  const $targetWidget = $("#" + targetId);
  $targetWidget.fadeToggle();
  $(this).toggleClass("active");
  const visibility = getCookie("focumi_visibility") || {};
  visibility[targetId] = $targetWidget.is(":visible");
  setCookie("focumi_visibility", visibility);
});
if (!getCookie("focumi_visited_before")) {
  const defaults = { todo: true, pomodoro: true, calendar: true };
  applyVisibilityMap(defaults);
  setCookie("focumi_visibility", defaults);
  setCookie("focumi_visited_before", true);
}
function saveLayoutOrder() {
  const order = $("#workspace")
    .children(".widget")
    .map(function () {
      return this.id;
    })
    .get();
  setCookie("focumi_layout_order", order);
}
function applyLayoutOrder() {
  const order = getCookie("focumi_layout_order");
  if (!order || !Array.isArray(order)) return;
  const $ws = $("#workspace");
  order.forEach((id) => {
    const $el = $("#" + id);
    if ($el.length) $ws.append($el);
  });
}
$(".widget").attr("draggable", "true");
$(document).on("dragstart", ".widget", function (e) {
  const dt = e.originalEvent.dataTransfer;
  dt.setData("text/widget-id", this.id || "");
});
$(document).on("dragover", "#workspace .widget", function (e) {
  e.preventDefault();
});
$(document).on("drop", "#workspace .widget", function (e) {
  e.preventDefault();
  const draggedId = e.originalEvent.dataTransfer.getData("text/widget-id");
  const $target = $(this);
  if (!draggedId) return;
  const $dragged = $("#" + draggedId);
  if (!$dragged.length || !$target.length) return;
  $dragged.insertBefore($target);
  saveLayoutOrder();
});
$(document).ready(function () {
  applyLayoutOrder();
  applyVisibilityMap(getCookie("focumi_visibility"));
});
$("#themePicker").on("change", function () {
  const t = $(this).val();
  document.body.classList.remove("theme-pastel", "theme-matrix", "theme-glass");
  if (t === "matrix") document.body.classList.add("theme-matrix");
  else if (t === "glass") document.body.classList.add("theme-glass");
  else if (t === "minimal") {
  } else document.body.classList.add("theme-pastel");
  setCookie("focumi_theme", t);
  try {
    const accent =
      getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() ||
      "#7c3aed";
    if (window.pomoChart) {
      window.pomoChart.data.datasets[0].backgroundColor = [accent];
      window.pomoChart.update();
    }
  } catch (e) {
  }
});
const savedTheme = getCookie("focumi_theme");
if (savedTheme) $("#themePicker").val(savedTheme).trigger("change");
let todos = getCookie("focumi_todos") || [];
function renderTodos() {
  $("#todoList").empty();
  if (!todos.length)
    $("#todoList").append('<div class="text-muted">Belum ada tugas</div>');
  todos.forEach((t, i) => {
    const el = $(
      `<div class='d-flex justify-content-between align-items-center p-2 mb-2 rounded todo-item'
         style='background:linear-gradient(90deg,#fff,#f7f9ff);position:relative'></div>`
    );
    const left = $("<div class='d-flex align-items-center gap-2'></div>");
    const chk = $('<input type="checkbox" class="todo-chk">')
      .prop("checked", !!t.done)
      .on("change", function () {
        toggleTodoDone(i);
      });
    const txt = $('<div class="fw-semibold todo-text"></div>').text(t.text);
    if (t.done) txt.css({ "text-decoration": "line-through", opacity: 0.6 });
    left.append(chk, $("<div>").append(txt).append(`<div class="text-muted small">${t.cat}</div>`));
    const right = $("<div></div>");
    const delBtn = $('<button class="btn btn-sm btn-danger">✕</button>').on(
      "click",
      () => {
        delTodo(i);
      }
    );
    right.append(delBtn);
    el.append(left, right);
    $("#todoList").append(el);
  });
  renderWheel();
}
function saveTodos() {
  setCookie("focumi_todos", todos);
}
window.delTodo = function (i) {
  todos.splice(i, 1);
  saveTodos();
  renderTodos();
  updateDashboard();
};
window.toggleTodoDone = function (i) {
  todos[i].done = !todos[i].done;
  saveTodos();
  renderTodos();
  updateDashboard();
};
$("#addTodo").on("click", function () {
  const text = $("#todoText").val().trim();
  const cat = $("#todoCat").val();
  if (!text) return;
  todos.push({ text, cat, done: false, created: Date.now() });
  saveTodos();
  renderTodos();
  $("#todoText").val("");
  updateDashboard();
});
renderTodos();
let pomo =
  getCookie("focumi_pomo") || {
    mode: 25,
    break: 5,
    remaining: 25 * 60,
    running: false,
    completedCycles: 0,
    selectedTemplate: "25/5",
  };
let pomoInterval = null;
function updatePomoDisplay() {
  const m = Math.floor(pomo.remaining / 60),
    s = pomo.remaining % 60;
  $("#pomoDisplay").text(
    String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0")
  );
}
updatePomoDisplay();
function startPomo() {
  if (pomo.running) return;
  pomo.running = true;
  setCookie("focumi_pomo", pomo);
  pomoInterval = setInterval(() => {
    if (pomo.remaining <= 0) {
      clearInterval(pomoInterval);
      pomo.running = false;
      pomo.completedCycles = (pomo.completedCycles || 0) + 1;
      try {
        if (window.alertAudio) {
          window.alertAudio.currentTime = 0;
          window.alertAudio.play().catch(() => {});
        }
      } catch (e) {
      }
      notify("Sesi selesai — istirahat!");
      pomo.remaining = (pomo.break || 5) * 60;
      setCookie("focumi_pomo", pomo);
      renderPomoStats();
      updateDashboard();
      return;
    }
    pomo.remaining--;
    updatePomoDisplay();
  }, 1000);
}
function pausePomo() {
  pomo.running = false;
  clearInterval(pomoInterval);
  setCookie("focumi_pomo", pomo);
}
function resetPomo() {
  pausePomo();
  try {
    if (window.alertAudio && !window.alertAudio.paused) {
      window.alertAudio.pause();
      window.alertAudio.currentTime = 0;
    } else if (window.alertAudio) {
      window.alertAudio.currentTime = 0;
    }
  } catch (e) {
  }
  pomo.remaining = (pomo.mode || 25) * 60;
  setCookie("focumi_pomo", pomo);
  updatePomoDisplay();
}
$("#pomoStart").on("click", startPomo);
$("#pomoPause").on("click", pausePomo);
$("#pomoReset").on("click", resetPomo);
$(document).on("click", ".pomo-template", function () {
  $(".pomo-template").removeClass("active");
  $(this).addClass("active");
  const m = parseInt($(this).data("min"), 10);
  const b = parseInt($(this).data("break"), 10);
  pomo.mode = m;
  pomo.break = b;
  pomo.remaining = m * 60;
  pomo.selectedTemplate = m + "/" + b;
  setCookie("focumi_pomo", pomo);
  $("#pomoNote").text("Template: " + pomo.selectedTemplate + " (focus / break)");
  updatePomoDisplay();
});
$("#pomoCustomApply").on("click", function () {
  const m = parseInt($("#pomoCustomFocus").val(), 10);
  const b = parseInt($("#pomoCustomBreak").val(), 10);
  if (isNaN(m) || isNaN(b) || m <= 0 || b < 0) {
    showCenterAlert("Masukkan angka valid untuk fokus dan istirahat");
    return;
  }
  pomo.mode = m;
  pomo.break = b;
  pomo.remaining = m * 60;
  pomo.selectedTemplate = m + "/" + b;
  setCookie("focumi_pomo", pomo);
  $("#pomoNote").text("Template: " + pomo.selectedTemplate + " (custom)");
  updatePomoDisplay();
  $(".pomo-template").removeClass("active");
});
$(document).on("keypress", "#pomoCustomFocus, #pomoCustomBreak", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    $("#pomoCustomApply").trigger("click");
  }
});
$(document).ready(function () {
  $("#pomoCustomFocus").val(pomo.mode || 25);
  $("#pomoCustomBreak").val(pomo.break || 5);
});
const ctxP =
  document.getElementById("pomoStats") &&
  document.getElementById("pomoStats").getContext("2d");
let pomoChart = null;
if (ctxP) {
  const accent =
    (getComputedStyle(document.documentElement).getPropertyValue("--accent") || "").trim() ||
    "#7c3aed";
  pomoChart = new Chart(ctxP, {
    type: "doughnut",
    data: {
      labels: ["Completed"],
      datasets: [{ data: [pomo.completedCycles || 0], backgroundColor: [accent] }],
    },
  });
  window.pomoChart = pomoChart;
  function renderPomoStats() {
    const s = pomo.completedCycles || 0;
    pomoChart.data.datasets[0].data = [s];
    pomoChart.update();
  }
  renderPomoStats();
}
const quotes = [
  "everything will be okay at the end :3",
  "love yourself first, and everyone will love you always!",
  "may you always bloom at the right time and place.",
  "failure isn't opposite of success, it's part of success.",
  "be yourself, and never to surrender.",
  "you deserve all the good things in your life <3",
  "keep going and keep growing.",
  "keep moving forward! ><",
  "you are smarter than you think!",
  "don't wish for it, work for it.",
  "never lose your hope, make it happen into your life."
];
function typeQuote(q) {
  const box = $("#quoteBox");
  box.text(q);
}
function showQuoteModal(q, opts = {}) {
  if (typeof opts === "number") opts = { timeout: opts };
  const timeout = opts.timeout || 3600;
  const $modal = $("#quoteModal");
  const $text = $("#quoteText");
  if (!$modal.length || !$text.length) return;
  $text.text(q);
  $modal.stop(true, true).fadeIn(180);
  if (timeout > 0) {
    clearTimeout($modal.data("hideTimer"));
    const t = setTimeout(() => {
      $modal.fadeOut(240);
    }, timeout);
    $modal.data("hideTimer", t);
  }
}
$("#closeQuote").on("click", function () {
  $("#quoteModal").fadeOut(180);
});
const audio = new Audio();
audio.loop = true;
audio.volume = 0.6;
const alertAudio = new Audio("assets/music/alert.opus");
alertAudio.preload = "auto";
alertAudio.volume = 0.9;
window.alertAudio = alertAudio;
$("#musicPlay").on("click", () => {
  if (audio.paused) {
    audio.play();
    $("#musicPlay").text("Pause");
  } else {
    audio.pause();
    $("#musicPlay").text("Play");
  }
});
$("#musicSelect").on("change", function () {
  const m = $(this).val();
  const map = {
    music_1: "assets/music/music_1.opus",
    music_2: "assets/music/music_2.opus",
    music_3: "assets/music/music_3.opus",
    music_4: "assets/music/music_4.opus",
    music_5: "assets/music/music_5.opus",
  };
  audio.src = map[m] || "";
  if (audio.src && !audio.paused) audio.play();
});
$("#musicVol").on("input", function () {
  audio.volume = parseFloat($(this).val());
});
const eqCanvas = document.getElementById("musicEQ");
if (eqCanvas) {
  const eq = eqCanvas.getContext("2d");
  function drawEQ() {
    eq.clearRect(0, 0, eqCanvas.width, eqCanvas.height);
    const bars = 20;
    const w = eqCanvas.width / bars;
    for (let i = 0; i < bars; i++) {
      const h = Math.random() * eqCanvas.height;
      eq.fillStyle = "rgba(124,58,237,0.8)";
      eq.fillRect(i * w + 4, eqCanvas.height - h, w - 6, h);
    }
  }
  setInterval(drawEQ, 160);
}
let notes = getCookie("focumi_notes") || [];
function renderNotes() {
  $("#notesArea").empty();
  notes.forEach((n, idx) => {
    const el = $(
      `<div class="note-card" data-id="${idx}" 
         style="left:${n.x}px;top:${n.y}px;background:${n.color ||
        "#fff7b2"}">
           <div class="note-text" contenteditable>${n.text}</div>
           <div class="d-flex justify-content-end mt-1">
             <button class="btn btn-sm btn-danger del-note">Del</button>
           </div>
       </div>`
    );
    $("#notesArea").append(el);
    makeDraggable(el[0]);
  });
}
function saveNotes() {
  setCookie("focumi_notes", notes);
}
$("#addNote").on("click", () => {
  notes.push({
    text: "New note",
    x: 30 + notes.length * 12,
    y: 30 + notes.length * 12,
    color: "#fff7b2",
  });
  saveNotes();
  renderNotes();
});
$("#notesArea").on("click", ".del-note", function () {
  const id = $(this).closest(".note-card").data("id");
  notes.splice(id, 1);
  saveNotes();
  renderNotes();
});
let globalDragging = false;
function makeDraggable(el) {
  const container = document.getElementById("notesArea");
  el.addEventListener("mousedown", startDrag);
  el.addEventListener("touchstart", startDrag, { passive: false });
  function startDrag(e) {
    const targetElem = (e.touches && e.touches[0] && e.touches[0].target) || e.target;
    if (
      targetElem &&
      targetElem.closest &&
      (targetElem.closest(".note-text") ||
        targetElem.closest("button") ||
        targetElem.closest(".del-note") ||
        targetElem.closest("input") ||
        targetElem.closest("textarea") ||
        targetElem.closest("a"))
    ) {
      return;
    }
    e.preventDefault();
    globalDragging = true;
    const rectC = container.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const startX = e.touches ? e.touches[0].clientX : e.clientX;
    const startY = e.touches ? e.touches[0].clientY : e.clientY;
    const offsetX = startX - rect.left;
    const offsetY = startY - rect.top;
    function moveAt(pageX, pageY) {
      let newLeft = pageX - rectC.left - offsetX;
      let newTop = pageY - rectC.top - offsetY;
      newLeft = Math.max(0, Math.min(newLeft, rectC.width - rect.width));
      newTop = Math.max(0, Math.min(newTop, rectC.height - rect.height));
      el.style.left = newLeft + "px";
      el.style.top = newTop + "px";
    }
    function onMove(ev) {
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      moveAt(cx, cy);
    }
    function onUp() {
      globalDragging = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
      const idn = parseInt(el.dataset.id, 10);
      notes[idn].x = parseInt(el.style.left, 10);
      notes[idn].y = parseInt(el.style.top, 10);
      notes[idn].text = el.querySelector(".note-text").innerText;
      saveNotes();
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
  }
}
renderNotes();
$("#exportNotes").on("click", () => {
  const area = document.getElementById("notesArea");
  if (!area) {
    showCenterAlert("Area catatan tidak ditemukan");
    return;
  }
  html2canvas(area, { useCORS: true, scale: 2 })
    .then((canvas) => {
      const link = document.createElement("a");
      link.download = "focumi_notes.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    })
    .catch((err) => showCenterAlert("Export gagal: " + (err && err.message ? err.message : String(err))));
});
let wheelSpinning = false;
function renderWheel() {
  const canvas = document.getElementById("wheelCanvas");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const size = Math.min(rect.width, rect.height) || 240;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + "px";
  canvas.style.height = size + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);
  const tasks = (getCookie("focumi_todos") || []).map((t) => t.text);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;
  if (!tasks.length) {
    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#999";
    ctx.font = "14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No tasks", cx, cy + 4);
    return;
  }
  const segCount = tasks.length;
  const segAngle = (Math.PI * 2) / segCount;
  for (let i = 0; i < segCount; i++) {
    const start = -Math.PI / 2 + i * segAngle;
    const end = start + segAngle;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? "#7c3aed" : "#93c5fd";
    ctx.fill();
    ctx.save();
    ctx.translate(cx, cy);
    const mid = (start + end) / 2;
    ctx.rotate(mid);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "12px Inter, sans-serif";
    ctx.textAlign = "right";
    const label = tasks[i].length > 20 ? tasks[i].slice(0, 17) + "…" : tasks[i];
    ctx.fillText(label, r - 8, 4);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.fillStyle = "#fff";
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#333";
  ctx.font = "bold 12px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Focumi", cx, cy + 4);
}
renderWheel();
window.addEventListener("resize", () => {
  renderWheel();
});
$("#spinWheel").on("click", () => {
  if (wheelSpinning) return;
  const taskList = (getCookie("focumi_todos") || []).map((t) => t.text);
  if (!taskList.length) {
    showCenterAlert("Tambahkan beberapa task terlebih dahulu");
    return;
  }
  wheelSpinning = true;
  const segCount = taskList.length;
  const segAngle = 360 / segCount;
  const randomIndex = Math.floor(Math.random() * segCount);
  const centerAngleForIndex =
    (360 - randomIndex * segAngle - segAngle / 2) % 360;
  const rot = 360 * 6 + centerAngleForIndex;
  $("#wheelCanvas").css({
    transition: "transform 4s cubic-bezier(.1,.8,.2,1)",
    transform: "rotate(" + rot + "deg)",
  });
  setTimeout(() => {
    wheelSpinning = false;
    const chosen = taskList[randomIndex];
    notify("Wheel pilih: " + chosen);
    $("#wheelCanvas").css({
      transition: "none",
      transform: "rotate(0deg)",
    });
  }, 4200);
});
let moodData = getCookie("focumi_mood") || [];
const moodCanvas = document.getElementById("moodChart");
let moodChart;
let renderMoodChart = () => {};
if (moodCanvas) {
  const moodCtx = moodCanvas.getContext("2d");
  moodChart = new Chart(moodCtx, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          label: "Mood",
          data: [],
          backgroundColor: "#93c5fd",
        },
      ],
    },
    options: {
      scales: { y: { min: 0, max: 5 } },
    },
  });
  renderMoodChart = function () {
    const labels = moodData.map((d) => d.date);
    const data = moodData.map((d) => d.score);
    moodChart.data.labels = labels;
    moodChart.data.datasets[0].data = data;
    moodChart.update();
  };
  $(".mood-btn").on("click", function () {
    const score = parseInt($(this).data("mood"), 10);
    const date = new Date().toISOString().slice(0, 10);
    moodData.push({ date, score });
    setCookie("focumi_mood", moodData);
    renderMoodChart();
    updateDashboard();
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    showQuoteModal(q, { timeout: 3800 });
    try {
      playMoodMusic(score);
    } catch (e) {
    }
  });
  renderMoodChart();
}
const bgAudio = new Audio();
bgAudio.loop = true;
bgAudio.volume = 0.45;
const moodTracks = {
  5: "assets/music/music_1.opus",
  4: "assets/music/music_2.opus",
  3: "assets/music/music_3.opus",
  2: "assets/music/music_4.opus",
  1: "assets/music/music_5.opus",
};
function closeMoodModal() {
  $("#moodModal").fadeOut();
}
function openMoodModal() {
  const $m = $("#moodModal");
  $m.stop(true, true).css("display", "flex").hide().fadeIn(180);
}
function playMoodMusic(score) {
  const src = moodTracks[score];
  if (!src) return;
  try {
    audio.src = src;
    $("#musicSelect").val("");
    audio.play().then(() => {
      $("#musicPlay").text("Pause");
    }).catch(() => {
      $("#musicPlay").text("Pause");
    });
  } catch (e) {
  }
}
$(document).on("click", ".modal-mood-btn", function () {
  const score = parseInt($(this).data("mood"), 10);
  const date = new Date().toISOString().slice(0, 10);
  moodData.push({ date, score });
  setCookie("focumi_mood", moodData);
  renderMoodChart();
  setCookie("focumi_mood_set_today", true);
  try {
    playMoodMusic(score);
  } catch (e) {
  }
  const q = quotes[Math.floor(Math.random() * quotes.length)];
  showQuoteModal(q, { timeout: 3800 });
  notify("Terima kasih! Mood disimpan.");
  closeMoodModal();
  updateDashboard();
});
$("#skipMood").on("click", function () {
  setCookie("focumi_mood_set_today", true);
  closeMoodModal();
});
$(document).ready(function () {
  if (!getCookie("focumi_mood_set_today")) {
    setTimeout(openMoodModal, 600);
  }
});
function openFocusRoom() {
  $("#focusRoom").fadeIn();
  $("#focusTimer").text($("#pomoDisplay").text());
}
function closeFocusRoom() {
  $("#focusRoom").fadeOut();
}
$("#open-focus-room").on("click", openFocusRoom);
$("#exitFocus").on("click", closeFocusRoom);
if (!getCookie("focumi_todos")) setCookie("focumi_todos", []);
if (!getCookie("focumi_notes")) setCookie("focumi_notes", []);
$(document).ready(function () {
  const $parallaxBg = $("#parallax-bg");
  const orbColors = [
    "rgba(124, 58, 237, 0.35)",
    "rgba(56, 189, 248, 0.28)",
    "rgba(236, 72, 153, 0.25)",
  ];
  for (let i = 0; i < 3; i++) {
    const $orb = $('<div class="parallax-orb"></div>');
    $orb.css({
      width: Math.floor(Math.random() * 200 + 260) + "px",
      height: Math.floor(Math.random() * 200 + 260) + "px",
      background: orbColors[i % orbColors.length],
      top: Math.random() * 80 + "vh",
      left: Math.random() * 80 + "vw",
      "--data-speed": Math.random() * 30 + 10,
    });
    $parallaxBg.append($orb);
  }
  $(document).on("mousemove", function (e) {
    const percentX = e.clientX / window.innerWidth - 0.5;
    const percentY = e.clientY / window.innerHeight - 0.5;
    $(".parallax-orb").each(function () {
      const speed = parseFloat($(this).css("--data-speed")) || 20;
      const moveX = percentX * speed * -1;
      const moveY = percentY * speed * -1;
      $(this).css("transform", `translate(${moveX}px, ${moveY}px)`);
    });
  });
  $(".widget").prepend('<div class="widget-glint"></div>');
  $(".widget").on("mousemove", function (e) {
    if (globalDragging) return;
    const interactiveSelectors = "input, textarea, .note-card, .time-block, .handle, .modal-mood-btn, .form-range, select, button";
    if ($(e.target).closest(interactiveSelectors).length) return;
    const $widget = $(this);
    const $glint = $widget.find(".widget-glint");
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 6;
    const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -6;
    $widget.css(
      "transform",
      `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`
    );
    $glint.css({ left: x + "px", top: y + "px", display: "block", opacity: 0.9 });
  });
  $(".widget").on("mouseleave", function () {
    const $widget = $(this);
    if (globalDragging) return;
    $widget.css("transform", "rotateX(0deg) rotateY(0deg) scale(1)");
    $widget.find(".widget-glint").css("display", "none");
  });
  setTimeout(() => {
    applyLayoutOrder();
    applyVisibilityMap(getCookie("focumi_visibility"));
  }, 120);
});
function notify(msg, timeout = 3000) {
  const $n = $(`<div class="focumi-toast">${msg}</div>`).appendTo("body");
  setTimeout(() => {
    $n.addClass("visible");
  }, 20);
  setTimeout(() => {
    $n.removeClass("visible");
    setTimeout(() => $n.remove(), 300);
  }, timeout);
}
function showCenterAlert(message, options = {}) {
  if (typeof options === "number") options = { timeout: options };
  const timeout = options.timeout === undefined ? 3500 : options.timeout;
  const $back = $('<div class="focumi-center-alert-backdrop" role="dialog" aria-modal="true"></div>');
  const $box = $('<div class="focumi-center-alert" role="document"></div>');
  const $msg = $(`<div class="alert-msg"></div>`).text(message);
  const $actions = $('<div class="alert-actions"></div>');
  const $ok = $('<button class="btn btn-sm btn-primary">OK</button>');
  $actions.append($ok);
  $box.append($msg, $actions);
  $back.append($box);
  $("body").append($back);
  function removeAlert() {
    $back.fadeOut(160, function () { $back.remove(); });
  }
  $ok.on("click", removeAlert);
  $back.on("click", function (e) {
    if (e.target === this) removeAlert();
  });
  if (timeout > 0) {
    setTimeout(removeAlert, timeout);
  }
}
function updateDashboard() {
  const focusedMins =
    pomo && (pomo.completedCycles ? (pomo.completedCycles * (pomo.mode || 25)) : 0);
  const doneCount = (todos || []).filter((t) => t.done).length;
  const habitCount = (moodData || []).length;
  $("#dash-focused").text(focusedMins);
  $("#dash-done").text(doneCount);
  $("#dash-habit").text(habitCount);
  const barCtx =
    document.getElementById("dashBar") &&
    document.getElementById("dashBar").getContext("2d");
  if (barCtx) {
    const labels = moodData.slice(-7).map((d) => d.date);
    const data = moodData.slice(-7).map((d) => d.score);
    if (!window._dashBar)
      window._dashBar = new Chart(barCtx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Mood (last7)",
              data,
              backgroundColor: "rgba(124,58,237,0.6)",
            },
          ],
        },
        options: {
          scales: { y: { min: 0, max: 5 } },
        },
      });
    else {
      window._dashBar.data.labels = labels;
      window._dashBar.data.datasets[0].data = data;
      window._dashBar.update();
    }
  }
  const pieCtx =
    document.getElementById("dashPie") &&
    document.getElementById("dashPie").getContext("2d");
  if (pieCtx) {
    const total = todos.length || 1;
    const done = doneCount;
    const rem = Math.max(0, total - done);
    if (!window._dashPie)
      window._dashPie = new Chart(pieCtx, {
        type: "pie",
        data: {
          labels: ["Done", "Remaining"],
          datasets: [
            {
              data: [done, rem],
              backgroundColor: ["#7c3aed", "#93c5fd"],
            },
          ],
        },
      });
    else {
      window._dashPie.data.datasets[0].data = [done, rem];
      window._dashPie.update();
    }
  }
}
updateDashboard();
let eventsStore = getCookie("focumi_events") || {};
let selectedDate = new Date();
const calGrid = document.getElementById("calendarGrid");
const calLabel = document.getElementById("calLabel");
const eventList = document.getElementById("eventList");
const eventModal = $("#eventModal");
const eventDateInput = $("#eventDate");
const eventTimeInput = $("#eventTime");
const eventTitleInput = $("#eventTitle");
let editingEventId = null;
function formatDateKey(d) {
  if (!d) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function saveEventsStore() {
  setCookie("focumi_events", eventsStore);
}
function renderCalendar(referenceDate = new Date()) {
  if (!calGrid) return;
  const viewDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();
  calLabel.innerText = viewDate.toLocaleString("id-ID", { month: "long", year: "numeric" });
  calGrid.innerHTML = "";
  const weekdays = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  weekdays.forEach((w) => {
    const lbl = document.createElement("div");
    lbl.className = "calendar-weekday-label";
    lbl.innerText = w;
    calGrid.appendChild(lbl);
  });
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const totalCells = 42;
  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement("div");
    cell.className = "calendar-cell";
    let dayNum = 0;
    let cellDate = null;
    if (i < firstDayIndex) {
      dayNum = prevMonthDays - (firstDayIndex - 1 - i);
      cell.classList.add("other-month");
      cellDate = new Date(year, month - 1, dayNum);
    } else if (i >= firstDayIndex + daysInMonth) {
      dayNum = i - (firstDayIndex + daysInMonth) + 1;
      cell.classList.add("other-month");
      cellDate = new Date(year, month + 1, dayNum);
    } else {
      dayNum = i - firstDayIndex + 1;
      cellDate = new Date(year, month, dayNum);
      const today = new Date();
      if (today.toDateString() === cellDate.toDateString()) {
        cell.style.boxShadow = "0 0 0 2px rgba(124,58,237,0.12) inset";
      }
    }
    const num = document.createElement("div");
    num.className = "calendar-day-num";
    num.innerText = dayNum;
    cell.appendChild(num);
    const k = formatDateKey(cellDate);
    const evs = eventsStore[k] || [];
    if (evs.length) {
      const dotsWrap = document.createElement("div");
      dotsWrap.style.position = "absolute";
      dotsWrap.style.bottom = "6px";
      dotsWrap.style.left = "6px";
      evs.slice(0, 3).forEach(() => {
        const dot = document.createElement("span");
        dot.className = "event-dot";
        dotsWrap.appendChild(dot);
      });
      if (evs.length > 3) {
        const more = document.createElement("span");
        more.className = "small text-muted";
        more.style.marginLeft = "4px";
        more.innerText = "+" + (evs.length - 3);
        dotsWrap.appendChild(more);
      }
      cell.appendChild(dotsWrap);
    }
    (function (d) {
      cell.addEventListener("click", function () {
        selectedDate = d;
        renderEventsForSelected();
        $("#calendarGrid .calendar-cell").css("outline", "none");
        $(cell).css("outline", "2px solid rgba(124,58,237,0.12)");
      });
    })(cellDate);
    calGrid.appendChild(cell);
  }
  if (selectedDate.getMonth() !== month || selectedDate.getFullYear() !== year) {
    selectedDate = new Date(year, month, 1);
  }
  renderEventsForSelected();
}
function renderEventsForSelected() {
  if (!eventList) return;
  const k = formatDateKey(selectedDate);
  $("#eventList").empty();
  const header = $("<div class='fw-semibold mb-1'></div>").text(selectedDate.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  $("#eventList").append(header);
  const evs = eventsStore[k] || [];
  if (!evs.length) {
    $("#eventList").append('<li class="list-group-item small text-muted">Belum ada events</li>');
  } else {
    evs.forEach((ev) => {
      const li = $(`<li class="list-group-item d-flex justify-content-between align-items-center small"></li>`);
      const left = $(`<div><div class="fw-semibold">${ev.title}</div><div class="text-muted small">${ev.time || ""}</div></div>`);
      const right = $(`<div></div>`);
      const del = $(`<button class="btn btn-sm btn-outline-danger btn-delete-event">Hapus</button>`);
      del.on("click", function () {
        deleteEventById(k, ev.id);
      });
      right.append(del);
      li.append(left, right);
      $("#eventList").append(li);
    });
  }
  $("#calendarGrid .calendar-cell").each(function () {
    const cellNum = $(this).find(".calendar-day-num").text();
    const cellIndex = $(this).index();
  });
}
function addEvent(dateKey, title, time) {
  if (!dateKey || !title) return;
  const entry = { id: "e_" + Date.now() + "_" + Math.floor(Math.random() * 999), title, time: time || "" };
  eventsStore[dateKey] = eventsStore[dateKey] || [];
  eventsStore[dateKey].push(entry);
  saveEventsStore();
  renderCalendar(selectedDate);
  notify("Event tersimpan");
}
function deleteEventById(dateKey, id) {
  if (!eventsStore[dateKey]) return;
  eventsStore[dateKey] = eventsStore[dateKey].filter((e) => e.id !== id);
  if (!eventsStore[dateKey].length) delete eventsStore[dateKey];
  saveEventsStore();
  renderCalendar(selectedDate);
  notify("Event dihapus");
}
$("#calPrev").on("click", function () {
  selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
  renderCalendar(selectedDate);
});
$("#calNext").on("click", function () {
  selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
  renderCalendar(selectedDate);
});
$("#addEventBtn").on("click", function () {
  openEventModal();
});
$("#clearEventsBtn").on("click", function () {
  if (!confirm("Hapus semua events?")) return;
  eventsStore = {};
  saveEventsStore();
  renderCalendar(selectedDate);
  renderEventsForSelected();
  notify("Semua event dihapus");
});
function openEventModal(date) {
  editingEventId = null;
  const d = date ? new Date(date) : selectedDate;
  const key = formatDateKey(d);
  eventDateInput.val(key);
  eventTimeInput.val("");
  eventTitleInput.val("");
  eventModal.fadeIn();
}
$("#cancelEventBtn").on("click", function () {
  eventModal.fadeOut();
});
$("#saveEventBtn").on("click", function () {
  const dateVal = eventDateInput.val();
  const timeVal = eventTimeInput.val();
  const titleVal = eventTitleInput.val().trim();
  if (!dateVal || !titleVal) {
    showCenterAlert("Isi tanggal dan judul event");
    return;
  }
  addEvent(dateVal, titleVal, timeVal);
  eventModal.fadeOut();
  renderEventsForSelected();
});
$(document).on("dblclick", ".calendar-cell", function () {
  const day = $(this).find(".calendar-day-num").text();
  openEventModal(selectedDate);
});
renderCalendar(selectedDate);
const ambienceCanvas = document.getElementById("ambience-canvas");
const ambienceCtx = ambienceCanvas && ambienceCanvas.getContext("2d");
let ambienceParticles = [];
let ambienceMode = getCookie("focumi_ambience") || "none";
function resizeAmbienceCanvas() {
  if (!ambienceCanvas) return;
  ambienceCanvas.style.width = window.innerWidth + "px";
  ambienceCanvas.style.height = window.innerHeight + "px";
  ambienceCanvas.width = window.innerWidth;
  ambienceCanvas.height = window.innerHeight;
}
resizeAmbienceCanvas();
window.addEventListener("resize", resizeAmbienceCanvas);
if (typeof $ !== "undefined" && $("#ambiencePicker").length) {
  $("#ambiencePicker").val(ambienceMode);
}
$("#ambiencePicker").on("change", function () {
  ambienceMode = $(this).val();
  setCookie("focumi_ambience", ambienceMode);
  setupAmbience(ambienceMode);
});
function setupAmbience(mode) {
  ambienceParticles = [];
  if (mode === "snow") {
    for (let i = 0; i < 140; i++) {
      ambienceParticles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 3 + 1,
        vx: Math.random() * 0.6 - 0.3,
        vy: Math.random() * 0.6 + 0.3,
        alpha: 0.7,
      });
    }
  } else if (mode === "rain") {
    for (let i = 0; i < 200; i++) {
      ambienceParticles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        w: Math.random() * 1.6 + 0.6,
        h: Math.random() * 12 + 8,
        vx: Math.random() * 0.8 - 0.4,
        vy: Math.random() * 4 + 4,
        alpha: 0.65,
      });
    }
  } else {
  }
}
setupAmbience(ambienceMode);
function tickAmbience() {
  if (!ambienceCtx) return;
  ambienceCtx.clearRect(0, 0, ambienceCanvas.width, ambienceCanvas.height);
  if (ambienceMode === "snow") {
    ambienceCtx.fillStyle = "rgba(255,255,255,0.8)";
    ambienceParticles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y > ambienceCanvas.height) {
        p.y = -10;
        p.x = Math.random() * ambienceCanvas.width;
      }
      ambienceCtx.beginPath();
      ambienceCtx.globalAlpha = p.alpha;
      ambienceCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ambienceCtx.fill();
    });
    ambienceCtx.globalAlpha = 1;
  } else if (ambienceMode === "rain") {
    ambienceCtx.strokeStyle = "rgba(120,150,180,0.45)";
    ambienceCtx.lineWidth = 1.2;
    ambienceParticles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y > ambienceCanvas.height + 30 || p.x < -50 || p.x > ambienceCanvas.width + 50) {
        p.y = -20;
        p.x = Math.random() * ambienceCanvas.width;
      }
      ambienceCtx.globalAlpha = p.alpha;
      ambienceCtx.beginPath();
      ambienceCtx.moveTo(p.x, p.y);
      ambienceCtx.lineTo(p.x + (p.vx * 4), p.y + p.h);
      ambienceCtx.stroke();
    });
    ambienceCtx.globalAlpha = 1;
  }
  requestAnimationFrame(tickAmbience);
}
tickAmbience();
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
if (!getCookie("focumi_events")) setCookie("focumi_events", {});
if (!getCookie("focumi_todos")) setCookie("focumi_todos", []);
if (!getCookie("focumi_notes")) setCookie("focumi_notes", []);
$("#inspire").on("click", () => {
  const q = quotes[Math.floor(Math.random() * quotes.length)];
  typeQuote(q);
  showQuoteModal(q, { timeout: 3800 });
});
$(document).ready(function () {
  const q = quotes[Math.floor(Math.random() * quotes.length)];
  showQuoteModal(q, 3800);
});
(function () {
  const MOBILE_BREAK = 768;
  const $menuToggle = $("#menuToggle");
  const $mobileMenu = $("#mobileMenu");
  const $featureToggles = $(".feature-toggles");
  const $controls = $(".controls");
  function applyResponsiveMove() {
    if ($(window).width() <= MOBILE_BREAK) {
      if (!$mobileMenu.data("moved")) {
        $mobileMenu.append($featureToggles, $controls);
        $mobileMenu.data("moved", true);
      }
      $menuToggle.show();
    } else {
      if ($mobileMenu.data("moved")) {
        $(".topbar .brand").after($featureToggles);
        $(".topbar .brand").after($controls);
        $mobileMenu.data("moved", false);
        $mobileMenu.hide();
      }
      $menuToggle.hide();
    }
  }
  $(document).ready(function () {
    applyResponsiveMove();
  });
  $(window).on("resize", function () {
    applyResponsiveMove();
  });
  $menuToggle.on("click", function (e) {
    e.stopPropagation();
    const isVisible = $mobileMenu.is(":visible");
    if (isVisible) {
      $mobileMenu.slideUp(160);
      $menuToggle.attr("aria-expanded", "false").removeClass("open");
    } else {
      $mobileMenu.slideDown(160);
      $menuToggle.attr("aria-expanded", "true").addClass("open");
    }
  });
  $(document).on("click", function (e) {
    if ($mobileMenu.is(":visible") && !$(e.target).closest("#mobileMenu, #menuToggle").length) {
      $mobileMenu.slideUp(160);
      $menuToggle.attr("aria-expanded", "false").removeClass("open");
    }
  });
  window.addEventListener("orientationchange", function () {
    $mobileMenu.hide();
    $menuToggle.removeClass("open").attr("aria-expanded", "false");
  });
})();