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

   Update 2026-07-24 (galeri foto): caption galeri foto (about-grid)
   kini sheet-driven lewat kolom gallery_caption_1..5 di TERMINAL_MASTER,
   dan path foto dihitung otomatis per terminal dari slug halaman
   (photos/<slug>/terminal.jpg, operasional.jpg, budaya-lokal.jpg,
   kota.jpg, alam-sekitar.jpg). Terminal yang belum punya foto asli
   akan tetap menampilkan caption default netral.
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

// Parser CSV sederhana (menangani koma di dalam tanda kutip)
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

// Format angka dengan pemisah ribuan titik & desimal koma (konvensi Indonesia,
// konsisten di seluruh halaman — poin revisi #9).
function fmtNum(n) {
  if (isEmptyVal(n)) return undefined;
  const num = Number(String(n).replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(num)) return n;
  return num.toLocaleString("id-ID");
}

// Format nilai Rupiah ringkas (untuk sel tarif: 3.100.000 -> "Rp 3.100.000")
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

// ── Galeri Foto (about-grid): caption sheet-driven + path foto dinamis per terminal ──
// Urutan slot: 1=terminal, 2=operasional, 3=budaya lokal, 4=kota (foto udara),
// 5=alam/landmark sekitar. Nama file foto distandarkan sama di semua terminal;
// hanya folder (slug halaman) yang berbeda: photos/<slug>/<nama-file>.jpg
// (ditambahkan 2026-07-24, keputusan proyek: sheet-driven caption, bukan hardcode per file)
const GALLERY_FILES = ["terminal", "operasional", "budaya-lokal", "kota", "alam-sekitar"];
const GALLERY_DEFAULTS = [
  "Terminal Petikemas",
  "Aktivitas Bongkar Muat Kontainer",
  "Budaya Lokal Sekitar Terminal",
  "Pemandangan Kota Sekitar Terminal",
  "Alam Sekitar Terminal",
];

function getPageSlug() {
  const match = location.pathname.match(/terminal-([a-z0-9-]+)\.html/i);
  return match ? match[1] : null;
}

function applyGallery(m) {
  const slug = getPageSlug();
  const captions = [1, 2, 3, 4, 5].map(n => m[`gallery_caption_${n}`]);

  function captionFor(fileIdx) {
    const val = captions[fileIdx];
    return (!isEmptyVal(val)) ? val : GALLERY_DEFAULTS[fileIdx];
  }

  function fillGroup(prefix, fileIndices, capClass) {
    fileIndices.forEach((fileIdx, slotPos) => {
      const el = document.getElementById(`${prefix}${slotPos}`);
      if (!el) return;
      const finalCap = captionFor(fileIdx);
      const img = el.querySelector("img");
      if (img) {
        if (slug) img.src = `../photos/${slug}/${GALLERY_FILES[fileIdx]}.jpg`;
        img.alt = finalCap;
      }
      const capEl = el.querySelector(`.${capClass}`);
      if (capEl) capEl.textContent = finalCap;
    });
  }

  // .asl group (mobile carousel): 5 item (asl0-asl4) — semua 5 slot foto
  fillGroup("asl", [0, 1, 2, 3, 4], "asl-cap");
  // .ath group (desktop grid): 4 item (ath0-ath3) — tanpa slot "terminal" (index 0)
  fillGroup("ath", [1, 2, 3, 4], "ath-cap");
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

  // ── Fitur tersembunyi: Hide Page / Per Aspek (poin #20) ──
  // Kolom show_about, show_hinterland, show_specs, show_performance, show_sdm,
  // show_tariff, show_development, show_contact di TERMINAL_MASTER. Nilai "YA"
  // = tampil (default kalau kolom kosong/belum ada = tetap tampil, supaya tidak
  // ada section yang tiba-tiba hilang untuk terminal yang belum diisi datanya).
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

  // ── S1 Hero ──
  if (trf.length) setText("stat-teus-terakhir", fmtNum(trf[trf.length - 1].volume_teus));
  const capVal = m.kapasitas_teus || i.kapasitas_shore_crane;
  if (capVal) setText("stat-kapasitas-terminal", fmtNum(capVal));
  setText("hero-subtitle", m.hero_subtitle); // poin #1

  // ── S2 About / Terminal Overview (poin #3, #4) ──
  setText("about-desc-1", m.about_desc_1);
  setText("about-desc-2", m.about_desc_2); // catatan: markup <strong> pada angka TEUs hilang jika desc2 diedit lewat sheet (plain text)
  // Mini-stat cards Terminal Overview — data sama dgn INFRASTRUKTUR, label bahasa Inggris & format seragam
  setText("about-stat-berth", !isEmptyVal(i.panjang_dermaga_m) ? fmtNum(i.panjang_dermaga_m) + " m" : undefined);
  setText("about-stat-cy", !isEmptyVal(i.luas_cy_ha) ? fmtNum(i.luas_cy_ha) + " Ha" : undefined);
  setText("about-stat-draft", !isEmptyVal(i.draft_mlws) ? Math.abs(Number(String(i.draft_mlws).replace(/[^0-9.-]/g, ""))) + " m" : undefined);

  // ── Galeri Foto (about-grid): caption + path foto per terminal, sheet-driven ──
  applyGallery(m);

  // ── S3 Hinterland: Routes / Commodity / Forwarder (poin #5, #6) ──
  if (routeRows.length) {
    setHTML("routeListHL", routeRows.map((r, idx) => `
      <div class="route-item-adaline${idx === 0 ? " active" : ""}" data-ri="${idx}">
        <div style="display:flex;gap:20px;align-items:flex-start;">
          <span class="ri-num">${idx + 1}</span>
          <div><div class="ri-title">${esc(r.nama_kapal)}</div>
          <div class="ri-desc">${esc(r.deskripsi)}</div></div>
        </div>
      </div>`).join(""));
    // routeListHL diganti total innerHTML-nya -> listener klik lama hilang, pasang ulang (lihat window.rebindRouteListeners di IIFE peta rute)
    if (typeof window.rebindRouteListeners === "function") window.rebindRouteListeners();
  }
  if (commodityRows.length) {
    const inbound = commodityRows.filter(r => (r.arah || "").toLowerCase() === "inbound");
    const outbound = commodityRows.filter(r => (r.arah || "").toLowerCase() === "outbound");
    setHTML("commodityInboundList", inbound.map(r => `<div class="hl-comm-item">${esc(r.nama)}</div>`).join(""));
    setHTML("commodityOutboundList", outbound.map(r => `<div class="hl-comm-item">${esc(r.nama)}</div>`).join(""));
  }
  // Top 10 Sea Freight Forwarding — section auto-hide kalau tidak ada data (poin #5)
  const forwarderSection = document.getElementById("forwarderSection");
  if (forwarderSection) {
    if (forwarderRows.length) {
      forwarderSection.style.display = "";
      setHTML("forwarderList", forwarderRows.map(r => `<div class="hl-comm-item">${esc(r.nama)}</div>`).join(""));
    } else {
      forwarderSection.style.display = "none";
    }
  }
  // Route map: path/garis mengikuti data ROUTES (ports per baris), titik pelabuhan tetap manual di PORTS (poin #6)
  if (routeRows.length && typeof window.setTerminalRoutes === "function") {
    window.setTerminalRoutes(routeRows.map(r => ({
      label: r.nama_kapal,
      route: r.deskripsi,
      ports: (r.ports || "").split(",").map(s => s.trim()).filter(Boolean),
    })));
  }

  // ── S3 Traffic chart data + CAGR (poin #12) ──
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

  // ── S3 Kapasitas & Infrastruktur (poin #4, #8, #9) ──
  setText("cap-val-shore-crane", i.kapasitas_shore_crane ? fmtNum(i.kapasitas_shore_crane) + " TEUs" : undefined);
  setText("cap-val-yard-crane", i.kapasitas_yard_crane ? fmtNum(i.kapasitas_yard_crane) + " TEUs" : undefined);
  setText("cap-val-berth", i.kapasitas_berth ? fmtNum(i.kapasitas_berth) + " TEUs" : undefined);
  setText("cap-val-yard", i.kapasitas_yard ? fmtNum(i.kapasitas_yard) + " TEUs" : undefined);
  setText("infra-berth-length", !isEmptyVal(i.panjang_dermaga_m) ? i.panjang_dermaga_m + " m" : undefined);
  setText("infra-draft", !isEmptyVal(i.draft_mlws) ? "−" + Math.abs(Number(String(i.draft_mlws).replace(/[^0-9.-]/g, ""))) + " mLWS" : undefined);
  setText("infra-cy", !isEmptyVal(i.luas_cy_ha) ? i.luas_cy_ha + " ha" : undefined);
  setText("infra-width", !isEmptyVal(i.lebar_dermaga_m) ? "Width: " + i.lebar_dermaga_m + " m" : undefined); // poin #8

  // ── S4 Performance: tabel & KPI cards, label wording (poin #13, #14) ──
  const perfTable = document.getElementById("perf-table-body");
  if (perfTable && perfRows.length) {
    perfTable.innerHTML = perfRows.map(r => `
      <tr><td>${esc(r.indikator)}</td><td>${esc(r.realisasi)} ${esc(r.satuan)}</td><td>${esc(r.rkap)} ${esc(r.satuan)}</td><td>${esc(r.periode)}</td></tr>
    `).join("");
  }
  setText("realization-note", m.realization_note); // poin #14, label "Financial KPI — {realization_note}" — kata "KPI" sudah statis di HTML (poin #13)

  // ── S5 SDM (poin #15) ──
  setText("sdm-operations", sdmRow.operations);
  setText("sdm-support", sdmRow.support);
  setText("sdm-technical", sdmRow.technical);
  setText("hr-wording", m.hr_wording);

  // ── S6 Terminal Specifications — Equipment grid 10 tipe, kondisional (poin #7) ──
  // Kartu yang datanya kosong/tidak ada disembunyikan; hanya tipe dengan data yang ditampilkan.
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
  setText("development-need-text", m.development_need); // poin #11
  setText("lini-note-1", m.lini_note); // poin #10 (rincian "Lini 1 & Lini 2" lain di Support Requests otomatis ikut ter-render ulang dari m.support_requests di atas)

  // ── S9 Tariff — ringkasan + rincian dinamis per kelompok (poin #16, #17) ──
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
    if (!rows.length) return; // biarkan HTML statis kalau data belum ada
    let subA = 0, sub40f = 0, sub20e = 0, sub40e = 0, sub20f = 0;
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

  // ── S8 Development & Growth Potential (poin #17, #18, #19) ──
  // Kartu Option 1-3 dihapus dari HTML (diganti placeholder galeri foto dari
  // photos/<slug>/); Support Requests tetap ada, wording-nya dari sheet.
  if (m.support_requests) {
    const items = m.support_requests.split("|").map(s => s.trim()).filter(Boolean);
    setHTML("support-requests-list", items.map(t => `<li>${esc(t)}</li>`).join(""));
  }

  // ── S10 Kontak ──
  setText("contact-address", m.alamat);
  setText("contact-email", m.email);

  return {
    master: m, infra: i, traffic: trf, performance: perfRows, tariff: tarifRows,
    sdm: sdmRow, kontak: kontakRows, peralatan: alatRows,
    routes: routeRows, commodity: commodityRows, forwarder: forwarderRows,
  };
}
