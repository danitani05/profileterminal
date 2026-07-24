/* ============================================================
   sheet-data.js
   Modul generik: fetch data live dari Google Sheets (publish-to-web
   CSV per tab) dan isi ke elemen HTML lewat atribut data-field / id.

   Cara pakai di setiap halaman terminal:
   1. Set KODE_TERMINAL sesuai kode di tab TERMINAL_MASTER (mis. "TPK-MRK")
   2. Isi SHEET_URLS di bawah dengan link CSV hasil "Publish to web"
      (File > Share > Publish to web > pilih tab > format CSV) untuk
      MASING-MASING tab: TERMINAL_MASTER, INFRASTRUKTUR, PERALATAN,
      TRAFFIC, PERFORMANCE, TARIFF, SDM, KONTAK, ROUTES, COMMODITY, FORWARDER
   3. Panggil initTerminalData() saat halaman dimuat.

   Catatan: karena data diambil lewat fetch() dari internet, halaman
   perlu koneksi internet saat dibuka. Data hanya seaman link
   "publish to web" itu sendiri — siapa pun yang tahu link CSV bisa
   membacanya. Sesuai keputusan proyek (2026-07-23), seluruh field
   termasuk data keuangan sudah disetujui untuk tampil publik,
   sehingga tidak ada tab yang perlu disembunyikan.

   Update 2026-07-24 (revisi 20 poin): menambah wiring untuk wording
   editable (hero subtitle, about desc, development need, dst), tabel
   tarif rinci dinamis, CAGR, equipment grid 10-tipe kondisional,
   render ROUTES/COMMODITY/FORWARDER dari sheet, dan fitur hide
   section tersembunyi (show_* di TERMINAL_MASTER, nilai "YA"/kosong).
   ============================================================ */

const SHEET_PUB_BASE = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTzuKZdWelRpC8uB3XFnI__wbdVcnpfMVLrbJnsoVdhliDabC6JFUuAkWnAncYrMkWewKDKJpnO076/pub";

const SHEET_URLS = {
  TERMINAL_MASTER: `${SHEET_PUB_BASE}?gid=271236132&single=true&output=csv`,
  INFRASTRUKTUR:   `${SHEET_PUB_BASE}?gid=1610117028&single=true&output=csv`,
  PERALATAN:       `${SHEET_PUB_BASE}?gid=1019525911&single=true&output=csv`,
  TRAFFIC:         `${SHEET_PUB_BASE}?gid=1195278091&single=true&output=csv`,
  PERFORMANCE:     `${SHEET_PUB_BASE}?gid=391379788&single=true&output=csv`,
  TARIFF:          `${SHEET_PUB_BASE}?gid=2026412239&single=true&output=csv`,
  SDM:             `${SHEET_PUB_BASE}?gid=83850765&single=true&output=csv`,
  KONTAK:          `${SHEET_PUB_BASE}?gid=1872951039&single=true&output=csv`,
  ROUTES:          `${SHEET_PUB_BASE}?gid=578104136&single=true&output=csv`,
  COMMODITY:       `${SHEET_PUB_BASE}?gid=278282438&single=true&output=csv`,
  FORWARDER:       `${SHEET_PUB_BASE}?gid=1641441428&single=true&output=csv`,
};

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ""; }
      else if (c === '\n' || c === '\r') {
        if (field !== "" || row.length) { row.push(field); rows.push(row); row = []; field = ""; }
        if (c === '\r' && next === '\n') i++;
      } else { field += c; }
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(v => v !== ""))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
}

async function fetchTab(tabName) {
  const url = SHEET_URLS[tabName];
  if (!url || url.startsWith("PASTE_")) {
    console.warn(`[sheet-data] URL untuk tab ${tabName} belum diisi.`);
    return [];
  }
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Gagal fetch tab ${tabName}: ${res.status}`);
    return parseCSV(await res.text());
  } catch (e) {
    console.warn(`[sheet-data] Tab ${tabName} gagal dimuat (mungkin belum ada / belum dipublish):`, e);
    return [];
  }
}

function isEmptyVal(v) { return v === undefined || v === null || v === "" || v === "[TBD]"; }

function fmtNum(n) {
  if (isEmptyVal(n)) return undefined;
  const num = Number(String(n).replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(num)) return n;
  return num.toLocaleString("id-ID");
}

function fmtRupiah(n) {
  if (isEmptyVal(n)) return "—";
  const num = Number(String(n).replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(num)) return n;
  return num.toLocaleString("id-ID");
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined && value !== "" && value !== "[TBD]") el.textContent = value;
}

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el && html !== undefined) el.innerHTML = html;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function initTerminalData(kodeTerminal) {
  const [master, infra, alat, traffic, perf, tarif, sdm, kontak, routes, commodity, forwarder] = await Promise.all(
    Object.keys(SHEET_URLS).map(fetchTab)
  );

  const byKode = (rows, key = "kode_terminal") => rows.filter(r => (r.kode_terminal || r.kode) === kodeTerminal);

  const m = byKode(master, "kode")[0] || {};
  const i = byKode(infra)[0] || {};
  const trf = byKode(traffic).sort((a, b) => Number(a.tahun) - Number(b.tahun));
  const perfRows = byKode(perf);
  const tarifRows = byKode(tarif);
  const sdmRow = byKode(sdm)[0] || {};
  const kontakRows = byKode(kontak);
  const alatRows = byKode(alat);
  const routeRows = byKode(routes).sort((a, b) => Number(a.urutan) - Number(b.urutan));
  const commodityRows = byKode(commodity).sort((a, b) => Number(a.urutan) - Number(b.urutan));
  const forwarderRows = byKode(forwarder).sort((a, b) => Number(a.urutan) - Number(b.urutan));

  const SECTION_FLAG_TO_ID = {
    show_about: "about", show_hinterland: "hinterland", show_specs: "specs",
    show_performance: "performance", show_sdm: "sdm", show_tariff: "tariff",
    show_development: "development", show_contact: "contact",
  };
  Object.entries(SECTION_FLAG_TO_ID).forEach(([flagKey, sectionId]) => {
    const val = m[flagKey];
    if (val && val.trim().toUpperCase() !== "YA" && val.trim() !== "") {
      const el = document.getElementById(sectionId);
      if (el) el.style.display = "none";
    }
  });

  if (trf.length) setText("stat-teus-terakhir", fmtNum(trf[trf.length - 1].volume_teus));
  const capVal = m.kapasitas_teus || i.kapasitas_shore_crane;
  if (capVal) setText("stat-kapasitas-terminal", fmtNum(capVal));
  setText("hero-subtitle", m.hero_subtitle);

  setText("about-desc-1", m.about_desc_1);
  setText("about-desc-2", m.about_desc_2);
  setText("about-stat-berth", !isEmptyVal(i.panjang_dermaga_m) ? fmtNum(i.panjang_dermaga_m) + " m" : undefined);
  setText("about-stat-cy", !isEmptyVal(i.luas_cy_ha) ? fmtNum(i.luas_cy_ha) + " Ha" : undefined);
  setText("about-stat-draft", !isEmptyVal(i.draft_mlws) ? Math.abs(Number(String(i.draft_mlws).replace(/[^0-9.-]/g, ""))) + " m" : undefined);

  if (routeRows.length) {
    setHTML("routeListHL", routeRows.map((r, idx) => `
      <div class="route-item-adaline${idx === 0 ? " active" : ""}" data-ri="${idx}">
        <div style="display:flex;gap:20px;align-items:flex-start;">
          <span class="ri-num">${idx + 1}</span>
          <div><div class="ri-title">${esc(r.nama_kapal)}</div>
          <div class="ri-desc">${esc(r.deskripsi)}</div></div>
        </div>
      </div>`).join(""));
    if (typeof window.rebindRouteListeners === "function") window.rebindRouteListeners();
  }
  if (commodityRows.length) {
    const inbound = commodityRows.filter(r => (r.arah || "").toLowerCase() === "inbound");
    const outbound = commodityRows.filter(r => (r.arah || "").toLowerCase() === "outbound");
    setHTML("commodityInboundList", inbound.map(r => `<div class="hl-comm-item">${esc(r.nama)}</div>`).join(""));
    setHTML("commodityOutboundList", outbound.map(r => `<div class="hl-comm-item">${esc(r.nama)}</div>`).join(""));
  }
  const forwarderSection = document.getElementById("forwarderSection");
  if (forwarderSection) {
    if (forwarderRows.length) {
      forwarderSection.style.display = "";
      setHTML("forwarderList", forwarderRows.map(r => `<div class="hl-comm-item">${esc(r.nama)}</div>`).join(""));
    } else {
      forwarderSection.style.display = "none";
    }
  }
  if (routeRows.length && typeof window.setTerminalRoutes === "function") {
    window.setTerminalRoutes(routeRows.map(r => ({
      label: r.nama_kapal,
      route: r.deskripsi,
      ports: (r.ports || "").split(",").map(s => s.trim()).filter(Boolean),
    })));
  }

  window.TERMINAL_TRAFFIC = trf.map(r => ({ year: r.tahun, vol: Number(r.volume_teus) }));
  if (window.TERMINAL_TRAFFIC.length && typeof window.renderThroughputChart === "function") {
    window.renderThroughputChart(window.TERMINAL_TRAFFIC);
  }
  if (trf.length >= 2) {
    const first = Number(trf[0].volume_teus), last = Number(trf[trf.length - 1].volume_teus);
    const years = Number(trf[trf.length - 1].tahun) - Number(trf[0].tahun);
    if (first > 0 && years > 0) {
      const cagr = (Math.pow(last / first, 1 / years) - 1) * 100;
      setText("throughput-cagr", "CAGR " + cagr.toFixed(1) + "%");
    }
    const cumGrowth = first > 0 ? ((last - first) / first * 100) : undefined;
    if (cumGrowth !== undefined) {
      setHTML("throughput-cumulative", `<span style="color:var(--success);font-weight:700;">+${cumGrowth.toFixed(1)}%</span>&nbsp;Cumulative ${trf[0].tahun}–${trf[trf.length - 1].tahun}`);
    }
  }

  setText("cap-val-shore-crane", i.kapasitas_shore_crane ? fmtNum(i.kapasitas_shore_crane) + " TEUs" : undefined);
  setText("cap-val-yard-crane", i.kapasitas_yard_crane ? fmtNum(i.kapasitas_yard_crane) + " TEUs" : undefined);
  setText("cap-val-berth", i.kapasitas_berth ? fmtNum(i.kapasitas_berth) + " TEUs" : undefined);
  setText("cap-val-yard", i.kapasitas_yard ? fmtNum(i.kapasitas_yard) + " TEUs" : undefined);
  setText("infra-berth-length", !isEmptyVal(i.panjang_dermaga_m) ? i.panjang_dermaga_m + " m" : undefined);
  setText("infra-draft", !isEmptyVal(i.draft_mlws) ? "−" + Math.abs(Number(String(i.draft_mlws).replace(/[^0-9.-]/g, ""))) + " mLWS" : undefined);
  setText("infra-cy", !isEmptyVal(i.luas_cy_ha) ? i.luas_cy_ha + " ha" : undefined);
  setText("infra-width", !isEmptyVal(i.lebar_dermaga_m) ? "Width: " + i.lebar_dermaga_m + " m" : undefined);

  const perfTable = document.getElementById("perf-table-body");
  if (perfTable && perfRows.length) {
    perfTable.innerHTML = perfRows.map(r => `
      <tr><td>${esc(r.indikator)}</td><td>${esc(r.realisasi)} ${esc(r.satuan)}</td><td>${esc(r.rkap)} ${esc(r.satuan)}</td><td>${esc(r.periode)}</td></tr>
    `).join("");
  }
  setText("realization-note", m.realization_note);

  setText("sdm-operations", sdmRow.operations);
  setText("sdm-support", sdmRow.support);
  setText("sdm-technical", sdmRow.technical);
  setText("hr-wording", m.hr_wording);

  const equipIdMap = {
    "Quay Crane": "quay-crane",
    "Harbor Mobile Crane": "harbor-mobile-crane",
    "Fixed Crane (Ship-to-shore)": "fixed-crane",
    "Mobile Crane": "mobile-crane",
    "Rubber Tyred Gantry": "rtg",
    "Reach Stacker": "reach-stacker",
    "Side Loader": "side-loader",
    "Forklift": "forklift",
    "Head Truck": "head-truck",
    "Tronton": "tronton",
  };
  const presentTypes = new Set();
  alatRows.forEach(r => {
    const slug = equipIdMap[r.jenis_alat];
    if (slug && !isEmptyVal(r.jumlah)) {
      setText("equip-num-" + slug, r.jumlah);
      presentTypes.add(slug);
    }
  });
  Object.values(equipIdMap).forEach(slug => {
    const card = document.querySelector('[data-equip="' + slug + '"]');
    if (card) card.style.display = presentTypes.has(slug) ? "" : "none";
  });
  setText("development-need-text", m.development_need);
  setText("lini-note-1", m.lini_note);

  setText("tariff-desc", m.tariff_desc);
  const totalRow = tarifRows.find(r => r.komponen === "Total All Components");
  if (totalRow) {
    setText("tariff-sum-20f", fmtRupiah(totalRow.ukuran_20f));
    setText("tariff-sum-40f", fmtRupiah(totalRow.ukuran_40f));
    setText("tariff-sum-20e", fmtRupiah(totalRow.ukuran_20e));
    setText("tariff-sum-40e", fmtRupiah(totalRow.ukuran_40e));
  }
  function renderTariffGroup(bodyId, kelompokPrefix) {
    const el = document.getElementById(bodyId);
    if (!el) return;
    const rows = tarifRows.filter(r => (r.kelompok || "").startsWith(kelompokPrefix));
    if (!rows.length) return;
    let sub20f = 0, sub40f = 0, sub20e = 0, sub40e = 0;
    const html = rows.map(r => {
      sub20f += Number(r.ukuran_20f) || 0;
      sub40f += Number(r.ukuran_40f) || 0;
      sub20e += Number(r.ukuran_20e) || 0;
      sub40e += Number(r.ukuran_40e) || 0;
      return `<tr><td>${esc(r.komponen)}</td><td>${fmtRupiah(r.ukuran_20f)}</td><td>${fmtRupiah(r.ukuran_40f)}</td><td>${fmtRupiah(r.ukuran_20e)}</td><td>${fmtRupiah(r.ukuran_40e)}</td></tr>`;
    }).join("");
    const subtotal = `<tr class="sub"><td>Subtotal</td><td>${fmtRupiah(sub20f)}</td><td>${fmtRupiah(sub40f)}</td><td>${fmtRupiah(sub20e)}</td><td>${fmtRupiah(sub40e)}</td></tr>`;
    el.innerHTML = html + subtotal;
  }
  renderTariffGroup("tariff-body-a", "A.");
  renderTariffGroup("tariff-body-b", "B.");
  renderTariffGroup("tariff-body-c", "C.");

  if (m.support_requests) {
    const items = m.support_requests.split("|").map(s => s.trim()).filter(Boolean);
    setHTML("support-requests-list", items.map(t => `<li>${esc(t)}</li>`).join(""));
  }

  setText("contact-address", m.alamat);
  setText("contact-email", m.email);

  return {
    master: m, infra: i, traffic: trf, performance: perfRows, tariff: tarifRows,
    sdm: sdmRow, kontak: kontakRows, peralatan: alatRows,
    routes: routeRows, commodity: commodityRows, forwarder: forwarderRows,
  };
}
