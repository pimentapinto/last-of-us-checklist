// Checklist de colecionáveis — The Last of Us Part I / Part II
// Persistência em localStorage: { checked: {id:true}, prefs: {...} }

const STORE_KEY = "tlou-collectibles-v1";

const CAT_COLORS = {
  artifacts: "#d8b56b",
  pendants: "#7fd0c9",
  comics: "#d76d77",
  manuals: "#b58ad6",
  convos: "#8fb8e8",
  jokes: "#e8a76f",
  shivs: "#9aa3ad",
  tools: "#c9c07a",
  benches: "#7fa8a0",
  safes: "#e3d9c8",
  cards: "#e08fb8",
  coins: "#e5c14e",
  journals: "#a3d68f",
  weapons: "#e07a5f",
  extras: "#9f9ff0",
};

let store;
try {
  store = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
} catch {
  store = {};
}
store.checked = store.checked || {};
store.prefs = Object.assign(
  { tab: "part1", hideDone: false, spoiler: false, hiddenCats: {} },
  store.prefs
);

const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

// Expande {n, label} em itens "{label} nº X" (numeração continua no grupo)
function expandItems(list) {
  const out = [];
  let pos = 0;
  if (!Array.isArray(list)) list = [list];
  for (const entry of list) {
    if (typeof entry === "string") {
      pos++;
      out.push({ name: entry });
    } else if (entry && typeof entry.n === "number") {
      for (let i = 0; i < entry.n; i++) {
        pos++;
        out.push({ name: `${entry.label} nº ${pos}`, hint: entry.hint });
      }
    } else if (entry && entry.name) {
      pos++;
      out.push(entry);
    }
  }
  return out;
}

const itemId = (g, ci, cat, i) => `${g}.${ci}.${cat}.${i}`;

/* ---------- RENDER ---------- */
function renderGame(gkey, section) {
  const game = DATA[gkey];
  const frag = document.createDocumentFragment();

  game.chapters.forEach((ch, ci) => {
    if (ch.section) {
      const div = document.createElement("div");
      div.className = "section-divider";
      div.textContent = ch.section;
      frag.appendChild(div);
    }

    const cats = Object.keys(ch.items || {});
    const groups = cats.map((cat) => ({ cat, items: expandItems(ch.items[cat]) }));
    const total = groups.reduce((s, g) => s + g.items.length, 0);

    if (total === 0) {
      const d = document.createElement("div");
      d.className = "chapter empty";
      d.dataset.name = norm(ch.name + " " + (ch.sub || ""));
      d.innerHTML = `<summary><div class="ch-head">
          <h3 class="ch-name">${ch.name}</h3>
          <div class="ch-sub">${ch.sub || ""} · sem colecionáveis</div>
        </div><span class="ch-count">—</span></summary>`;
      frag.appendChild(d);
      return;
    }

    const det = document.createElement("details");
    det.className = "chapter";
    det.dataset.name = norm(ch.name + " " + (ch.sub || ""));

    const sum = document.createElement("summary");
    sum.innerHTML = `<div class="ch-head">
        <h3 class="ch-name">${ch.name}</h3>
        <div class="ch-sub">${ch.sub || ""}</div>
      </div>
      <div class="ch-progress">
        <div class="bar"><i></i></div>
        <span class="ch-count">0/${total}</span>
      </div>`;
    det.appendChild(sum);

    const body = document.createElement("div");
    body.className = "ch-body";

    const tools = document.createElement("div");
    tools.className = "ch-tools";
    tools.innerHTML = `<button class="btn mini" type="button" data-markchapter>marcar capítulo inteiro</button>`;
    body.appendChild(tools);

    groups.forEach(({ cat, items }) => {
      const g = document.createElement("div");
      g.className = "group";
      g.dataset.cat = cat;
      g.style.setProperty("--cat", CAT_COLORS[cat] || "#8fce7a");

      const h = document.createElement("h4");
      h.innerHTML = `<i class="dot"></i>${game.categories[cat]}<span class="gn">0/${items.length}</span>`;
      g.appendChild(h);

      items.forEach((it, i) => {
        const id = itemId(gkey, ci, cat, i);
        const label = document.createElement("label");
        label.className = "item";
        label.dataset.name = norm(it.name);
        const hintText = it.hint || (HINTS && HINTS[it.name]) || CAT_HINTS[cat] || "";
        const hint = hintText ? `<span class="hint">${esc(hintText)}</span>` : "";
        label.innerHTML = `<input type="checkbox" data-id="${id}">
          <span class="box"></span>
          <span class="name">${esc(it.name)}${hint}</span>`;
        const input = label.querySelector("input");
        if (store.checked[id]) {
          input.checked = true;
          label.classList.add("done");
        }
        g.appendChild(label);
      });

      body.appendChild(g);
    });

    det.appendChild(body);
    frag.appendChild(det);
  });

  section.appendChild(frag);
}

/* ---------- PROGRESS ---------- */
function refresh() {
  const totals = { part1: [0, 0], part2: [0, 0] };

  document.querySelectorAll("section.game").forEach((sec) => {
    const gkey = sec.id;
    sec.querySelectorAll(".chapter").forEach((ch) => {
      const inputs = ch.querySelectorAll("input[type=checkbox]");
      if (!inputs.length) return;
      let done = 0;
      inputs.forEach((inp) => { if (inp.checked) done++; });
      totals[gkey][0] += done;
      totals[gkey][1] += inputs.length;

      const bar = ch.querySelector(".ch-progress .bar > i");
      const cnt = ch.querySelector(".ch-count");
      if (bar) bar.style.width = (done / inputs.length) * 100 + "%";
      if (cnt) cnt.textContent = `${done}/${inputs.length}`;
      ch.classList.toggle("complete", done === inputs.length);
    });

    sec.querySelectorAll(".group").forEach((g) => {
      const inputs = g.querySelectorAll("input[type=checkbox]");
      let done = 0;
      inputs.forEach((inp) => { if (inp.checked) done++; });
      const gn = g.querySelector(".gn");
      if (gn) gn.textContent = `${done}/${inputs.length}`;
    });
  });

  const t1 = totals.part1, t2 = totals.part2;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const all = [t1[0] + t2[0], t1[1] + t2[1]];

  document.getElementById("gp1-bar").style.width = pct(t1[0], t1[1]) + "%";
  document.getElementById("gp1-txt").textContent = `${pct(t1[0], t1[1])}% (${t1[0]}/${t1[1]})`;
  document.getElementById("gp2-bar").style.width = pct(t2[0], t2[1]) + "%";
  document.getElementById("gp2-txt").textContent = `${pct(t2[0], t2[1])}% (${t2[0]}/${t2[1]})`;
  document.getElementById("gpa-bar").style.width = pct(all[0], all[1]) + "%";
  document.getElementById("gpa-txt").textContent = `${pct(all[0], all[1])}% (${all[0]}/${all[1]})`;

  document.querySelectorAll(".tab").forEach((t) => {
    const k = t.dataset.tab;
    const tt = totals[k];
    t.querySelector(".count").textContent = `${tt[0]}/${tt[1]}`;
  });
}

/* ---------- FILTERS ---------- */
function currentCats(game) {
  const set = new Set();
  DATA[game].chapters.forEach((c) =>
    Object.keys(c.items || {}).forEach((k) => set.add(k))
  );
  return [...set];
}

function buildChips() {
  const gkey = store.prefs.tab;
  const chips = document.getElementById("chips");
  chips.innerHTML = "";
  const hidden = store.prefs.hiddenCats[gkey] || {};

  currentCats(gkey).forEach((cat) => {
    const b = document.createElement("button");
    b.className = "chip " + (hidden[cat] ? "off" : "on");
    b.dataset.cat = cat;
    b.innerHTML = `<i class="dot" style="background:${CAT_COLORS[cat]}"></i>${DATA[gkey].categories[cat]}`;
    b.addEventListener("click", () => {
      const h = (store.prefs.hiddenCats[gkey] =
        store.prefs.hiddenCats[gkey] || {});
      h[cat] = !h[cat];
      b.classList.toggle("off", h[cat]);
      b.classList.toggle("on", !h[cat]);
      applyCatFilter();
      save();
    });
    chips.appendChild(b);
  });
}

function applySearch() {
  const gkey = store.prefs.tab;
  const catHidden = store.prefs.hiddenCats[gkey] || {};
  const q = norm(document.getElementById("search").value.trim());
  const sec = document.getElementById(gkey);

  sec.querySelectorAll(".chapter").forEach((ch) => {
    const chapterMatch = q && ch.dataset.name.includes(q);
    let anyVisible = !q || chapterMatch;

    ch.querySelectorAll(".item").forEach((it) => {
      const show = !q || chapterMatch || it.dataset.name.includes(q);
      it.classList.toggle("hidden", !show);
      if (show) anyVisible = true;
    });

    ch.querySelectorAll(".group").forEach((g) => {
      const hasVisibleItem = [...g.querySelectorAll(".item")].some(
        (i) => !i.classList.contains("hidden")
      );
      g.classList.toggle("hidden", !!catHidden[g.dataset.cat] || !hasVisibleItem);
    });

    ch.classList.toggle("hidden", !!q && !anyVisible);
    if (q && anyVisible && ch.tagName === "DETAILS") ch.open = true;
  });
}

const applyCatFilter = applySearch;

/* ---------- EVENTS ---------- */
function init() {
  renderGame("part1", document.getElementById("part1"));
  renderGame("part2", document.getElementById("part2"));

  document.body.classList.toggle("hide-done", store.prefs.hideDone);
  document.body.classList.toggle("spoiler", store.prefs.spoiler);
  document.getElementById("hideDone").checked = store.prefs.hideDone;
  document.getElementById("spoiler").checked = store.prefs.spoiler;

  // abas
  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      store.prefs.tab = t.dataset.tab;
      save();
      switchTab();
    });
  });

  function switchTab() {
    document.querySelectorAll(".tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.tab === store.prefs.tab)
    );
    document.getElementById("part1").classList.toggle("hidden", store.prefs.tab !== "part1");
    document.getElementById("part2").classList.toggle("hidden", store.prefs.tab !== "part2");
    buildChips();
    applyCatFilter();
    applySearch();
  }

  // checkbox change (delegado)
  document.querySelector("main").addEventListener("change", (e) => {
    if (!e.target.matches("input[type=checkbox]")) return;
    const id = e.target.dataset.id;
    if (e.target.checked) store.checked[id] = true;
    else delete store.checked[id];
    e.target.closest(".item").classList.toggle("done", e.target.checked);
    save();
    refresh();
  });

  document.getElementById("search").addEventListener("input", applySearch);

  document.getElementById("hideDone").addEventListener("change", (e) => {
    store.prefs.hideDone = e.target.checked;
    document.body.classList.toggle("hide-done", e.target.checked);
    save();
  });

  document.getElementById("spoiler").addEventListener("change", (e) => {
    store.prefs.spoiler = e.target.checked;
    document.body.classList.toggle("spoiler", e.target.checked);
    save();
  });

  document.getElementById("expandAll").addEventListener("click", () => {
    const sec = document.getElementById(store.prefs.tab);
    const chapters = [...sec.querySelectorAll("details.chapter")];
    const allOpen = chapters.every((d) => d.open);
    chapters.forEach((d) => (d.open = !allOpen));
  });

  // marcar/desmarcar capítulo inteiro
  document.querySelector("main").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-markchapter]");
    if (!btn) return;
    const chapter = btn.closest(".chapter");
    const inputs = [...chapter.querySelectorAll("input[type=checkbox]")];
    const allDone = inputs.every((i) => i.checked);
    inputs.forEach((i) => setCheck(i, !allDone));
    save();
    refresh();
  });

  function setCheck(input, val) {
    input.checked = val;
    input.closest(".item").classList.toggle("done", val);
    if (val) store.checked[input.dataset.id] = true;
    else delete store.checked[input.dataset.id];
  }

  function syncInputs() {
    document.querySelectorAll("input[data-id]").forEach((i) => {
      const on = !!store.checked[i.dataset.id];
      i.checked = on;
      i.closest(".item").classList.toggle("done", on);
    });
  }

  // ---------- EXPORTAR / IMPORTAR ----------
  document.getElementById("exportBtn").addEventListener("click", () => {
    const data = {
      app: "tlou-checklist",
      version: 1,
      exportedAt: new Date().toISOString(),
      checked: Object.keys(store.checked),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tlou-checklist-progress.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const importFile = document.getElementById("importFile");
  document.getElementById("importBtn").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", () => {
    const f = importFile.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const raw = Array.isArray(data) ? data : data.checked;
        const ids = (raw || []).filter(
          (id) => typeof id === "string" && /^(part1|part2)\.\d+\.\w+\.\d+$/.test(id)
        );
        if (!ids.length) {
          alert("Arquivo não contém progresso válido do checklist.");
          return;
        }
        if (
          !confirm(
            `Importar ${ids.length} itens marcados?\nIsso SUBSTITUI o progresso atual dos dois jogos.`
          )
        ) {
          return;
        }
        store.checked = {};
        ids.forEach((id) => (store.checked[id] = true));
        save();
        syncInputs();
        refresh();
        alert(`${ids.length} itens importados com sucesso.`);
      } catch {
        alert("Não foi possível ler o arquivo (JSON inválido).");
      }
      importFile.value = "";
    };
    reader.readAsText(f);
  });

  // ---------- CHEAT MODE ----------
  const modal = document.getElementById("cheatModal");

  function openCheat() {
    const sel = document.getElementById("cheatCat");
    sel.innerHTML = "";
    currentCats(store.prefs.tab).forEach((cat) => {
      const o = document.createElement("option");
      o.value = cat;
      o.textContent = DATA[store.prefs.tab].categories[cat];
      sel.appendChild(o);
    });
    modal.classList.add("open");
  }

  function closeCheat() {
    modal.classList.remove("open");
  }

  document.getElementById("cheatBtn").addEventListener("click", openCheat);
  document.getElementById("cheatClose").addEventListener("click", closeCheat);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeCheat();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCheat();
  });

  function bulkSet(selector, val) {
    document
      .querySelectorAll(`#${store.prefs.tab} ${selector}`)
      .forEach((i) => setCheck(i, val));
    save();
    refresh();
  }

  document.getElementById("cheatMarkAll").addEventListener("click", () => {
    if (confirm(`Marcar TODOS os colecionáveis de ${DATA[store.prefs.tab].title}?`))
      bulkSet("input[type=checkbox]", true);
  });
  document.getElementById("cheatUnmarkAll").addEventListener("click", () => {
    if (confirm(`Desmarcar TODOS os colecionáveis de ${DATA[store.prefs.tab].title}?`))
      bulkSet("input[type=checkbox]", false);
  });
  document.getElementById("cheatCatMark").addEventListener("click", () => {
    const cat = document.getElementById("cheatCat").value;
    bulkSet(`.group[data-cat="${cat}"] input[type=checkbox]`, true);
  });
  document.getElementById("cheatCatUnmark").addEventListener("click", () => {
    const cat = document.getElementById("cheatCat").value;
    bulkSet(`.group[data-cat="${cat}"] input[type=checkbox]`, false);
  });

  // ---------- ANALISADOR DE SAVE (USR-DATA, Part I PC) ----------
  const saveReports = document.getElementById("saveReports");
  const saveFile = document.getElementById("saveFile");
  const saveDir = document.getElementById("saveDir");

  document.getElementById("savePick").addEventListener("click", () => saveFile.click());
  document.getElementById("savePickDir").addEventListener("click", () => saveDir.click());

  saveFile.addEventListener("change", () => {
    analyzeFiles([...saveFile.files]);
    saveFile.value = "";
  });

  saveDir.addEventListener("change", () => {
    const files = [...saveDir.files];
    // nomes de slot via params.json irmãos ("Jogo salvo 5" etc.)
    const slotNames = {};
    files.forEach((f) => {
      if (!/params\.json$/i.test(f.name)) return;
      const dir = (f.webkitRelativePath || "").split("/").slice(0, -1).join("/");
      const r = new FileReader();
      r.onload = () => {
        try {
          const j = JSON.parse(r.result);
          if (j.subTitle) slotNames[dir] = j.subTitle;
        } catch {}
      };
      r.readAsText(f);
    });
    const saves = files.filter((f) => /usr-data$/i.test(f.name));
    if (!saves.length) {
      saveReports.innerHTML = `<div class="save-card err">Nenhum <code>USR-DATA</code> encontrado na pasta selecionada.</div>`;
      saveDir.value = "";
      return;
    }
    analyzeFiles(saves, slotNames);
    saveDir.value = "";
  });

  async function analyzeFiles(files, slotNames = {}) {
    saveReports.innerHTML = "";
    for (const f of files) {
      const card = document.createElement("div");
      card.className = "save-card";
      try {
        const buf = await f.arrayBuffer();
        const dir = (f.webkitRelativePath || "").split("/").slice(0, -1).join("/");
        const rep = TLOUSave.parse(buf, f.name);
        rep.slotName = slotNames[dir] || null;
        card.appendChild(renderSaveReport(rep));
      } catch (err) {
        card.classList.add("err");
        card.innerHTML = `<b>${esc(f.name)}</b> — ${esc(err.message)}`;
      }
      saveReports.appendChild(card);
    }
  }

  function renderSaveReport(r) {
    const el = document.createElement("div");
    const kb = r.fileSize / 1024;
    const size = kb > 1024 ? (kb / 1024).toFixed(1) + " MB" : Math.round(kb) + " KB";

    const badges = [];
    if (r.saveType) badges.push(`<span class="badge">${esc(r.saveType)}</span>`);
    if (r.slotName) badges.push(`<span class="badge">${esc(r.slotName)}</span>`);
    if (r.completed) badges.push(`<span class="badge done">CONCLUÍDO</span>`);
    if (r.ngPlus) badges.push(`<span class="badge ng">${esc(r.ngPlus)}</span>`);

    const rows = [];
    if (r.isProfile) {
      rows.push(`<div class="sv-row"><span>Tipo</span><b>Save de perfil (sem progresso de campanha)</b></div>`);
    } else {
      if (r.chapter) rows.push(`<div class="sv-row"><span>Capítulo</span><b>${esc(r.chapter)}</b></div>`);
      if (r.chapterIndex != null) rows.push(`<div class="sv-row"><span>Índice do capítulo</span><b>${r.chapterIndex}</b></div>`);
      if (r.difficulty) rows.push(`<div class="sv-row"><span>Dificuldade</span><b>${esc(r.difficulty)}</b></div>`);
      if (r.playtimeText || r.playtimeSeconds != null) {
        const secs = r.playtimeSeconds;
        const h = secs != null ? `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}min ${secs % 60}s` : null;
        rows.push(`<div class="sv-row"><span>Tempo de jogo</span><b>${esc(r.playtimeText || h)}</b></div>`);
      }
      if (r.collectedTotal != null)
        rows.push(`<div class="sv-row"><span>Colecionáveis</span><b>${r.collectedTotal} coletados</b></div>`);
    }

    // inventário legível
    const inv = r.inventory.filter((e) => e.label);
    let invHtml = "";
    if (inv.length) {
      invHtml =
        `<div class="sv-inv">` +
        inv.map((e) => `<span class="sv-item">${esc(e.label)} <b>${e.value}</b></span>`).join("") +
        `</div>`;
      const unknown = r.inventory.length - inv.length;
      if (unknown > 0)
        invHtml += `<div class="sv-note">${unknown} registro(s) interno(s) não identificado(s).</div>`;
    }

    // manuais detectados no save
    let manHtml = "";
    if (r.manualsFound.length) {
      manHtml =
        `<div class="sv-group"><span class="sv-label">Manuais detectados (${r.manualsFound.length}/12)</span>` +
        `<div class="sv-inv">` +
        r.manualsFound.map((m) => `<span class="sv-item ok">${esc(m.name)}</span>`).join("") +
        `</div></div>`;
    }
    if (r.toolLevel > 0) {
      manHtml += `<div class="sv-group"><span class="sv-label">Ferramentas</span><div class="sv-inv"><span class="sv-item ok">nível ${r.toolLevel}/5</span></div></div>`;
    }

    const canMark = r.manualsFound.length || r.toolLevel > 0;
    el.innerHTML =
      `<div class="sv-head"><b>${esc(r.slotName || r.fileName)}</b><span class="sv-size">${size}</span></div>` +
      `<div class="sv-badges">${badges.join("")}</div>` +
      rows.join("") +
      (r.isProfile ? "" : `<div class="sv-group"><span class="sv-label">Inventário</span>${invHtml || `<div class="sv-note">sem registros de inventário</div>`}</div>`) +
      manHtml +
      `<div class="sv-note">Artefatos, quadrinhos e pingentes usam chaves geradas por partida — o estado por-item não é decodificável (o total acima vem do save).</div>` +
      (canMark
        ? `<button class="btn mini sv-mark">Marcar detectados no checklist (Part I)</button>`
        : "");

    const btn = el.querySelector(".sv-mark");
    if (btn) btn.addEventListener("click", () => markDetected(r));
    return el;
  }

  // marca no checklist os itens detectáveis do save (manuais + ferramentas)
  function markDetected(r) {
    const marked = [];
    r.manualsFound.forEach((m) => {
      const id = findItemId("part1", "manuals", m.name);
      if (id) {
        store.checked[id] = true;
        marked.push(m.name);
      }
    });
    // tool-level N → marca "Ferramenta Nv. 1..N" na ordem dos capítulos
    const toolNames = ["Ferramenta Nv. 1", "Ferramenta Nv. 2", "Ferramenta Nv. 3", "Ferramenta Nv. 4", "Ferramenta Nv. 5"];
    for (let i = 0; i < Math.min(r.toolLevel, 5); i++) {
      const id = findItemId("part1", "tools", toolNames[i]);
      if (id) {
        store.checked[id] = true;
        marked.push(toolNames[i]);
      }
    }
    if (!marked.length) {
      alert("Nenhum item correspondente encontrado no checklist.");
      return;
    }
    save();
    syncInputs();
    refresh();
    applySearch();
    alert(`${marked.length} itens marcados no checklist:\n\n${marked.join("\n")}`);
  }

  function findItemId(gkey, cat, name) {
    const g = DATA[gkey];
    for (let ci = 0; ci < g.chapters.length; ci++) {
      const items = g.chapters[ci].items?.[cat];
      if (!items) continue;
      const expanded = expandItems(items);
      const i = expanded.findIndex((it) => it.name === name);
      if (i >= 0) return itemId(gkey, ci, cat, i);
    }
    return null;
  }

  document.getElementById("reset").addEventListener("click", () => {
    const g = store.prefs.tab;
    const name = DATA[g].title;
    if (!confirm(`Limpar todo o progresso de ${name}?`)) return;
    Object.keys(store.checked).forEach((id) => {
      if (id.startsWith(g + ".")) delete store.checked[id];
    });
    save();
    document
      .getElementById(g)
      .querySelectorAll("input[type=checkbox]")
      .forEach((i) => {
        i.checked = false;
        i.closest(".item").classList.remove("done");
      });
    refresh();
  });

  switchTab();
  refresh();
  fireflies();
}

/* ---------- FIREFLIES ---------- */
function fireflies() {
  const c = document.getElementById("fireflies");
  const ctx = c.getContext("2d");
  let w, h, dots;

  function resize() {
    w = c.width = c.offsetWidth * devicePixelRatio;
    h = c.height = c.offsetHeight * devicePixelRatio;
    dots = Array.from({ length: 42 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: (Math.random() * 1.6 + 0.6) * devicePixelRatio,
      vx: (Math.random() - 0.5) * 0.12 * devicePixelRatio,
      vy: (Math.random() - 0.5) * 0.1 * devicePixelRatio,
      p: Math.random() * Math.PI * 2,
      s: Math.random() * 0.02 + 0.006,
    }));
  }
  resize();
  addEventListener("resize", resize);

  (function tick() {
    ctx.clearRect(0, 0, w, h);
    dots.forEach((d) => {
      d.x += d.vx; d.y += d.vy; d.p += d.s;
      if (d.x < -10) d.x = w + 10; if (d.x > w + 10) d.x = -10;
      if (d.y < -10) d.y = h + 10; if (d.y > h + 10) d.y = -10;
      const a = 0.15 + (Math.sin(d.p) + 1) * 0.3;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(184,245,158,${a})`;
      ctx.shadowColor = "rgba(184,245,158,0.8)";
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    requestAnimationFrame(tick);
  })();
}

document.addEventListener("DOMContentLoaded", init);
