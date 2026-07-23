/* ============================================================
   sheet-data.js
   Modul generik: fetch data live dari Google Sheets (publish-to-web
   CSV per tab) dan isi ke elemen HTML lewat atribut data-field / id.

   Cara pakai di setiap halaman terminal:
   1. Set KODE_TERMINAL sesuai kode di tab TERMINAL_MASTER (mis. "TPK-MRK")
   2. Isi SHEET_URLS di bawah dengan link CSV hasil "Publish to web"
      (File > Share > Publish to web > pilih tab > format CSV) untuk
      MASING-MASING tab: TERMINAL_MASTER, INFRASTRUKTUR, PERALATAN,
      TRAFFIC, PERFORMANCE, TARIFF, SDM, KONTAK
   3. Panggil initTerminalData() saat halaman dimuat.

   Catatan: karena data diambil lewat fetch() dari internet, halaman
   perlu koneksi internet saat dibuka. Data hanya seaman link
   "publish to web" itu sendiri — siapa pun yang tahu link CSV bisa
   membacanya. Sesuai keputusan proyek (2026-07-23), seluruh field
   termasuk data keuangan sudah disetujui untuk tampil publik,
   sehingga tidak ada tab yang perlu disembunyikan.
   ============================================================ */

const SHEET_URLS = {
  TERMINAL_MASTER: "PASTE_CSV_URL_TERMINAL_MASTER",
  INFRASTRUKTUR:   "PASTE_CSV_URL_INFRASTRUKTUR",
  PERALATAN:       "PASTE_CSV_URL_PERALATAN",
  TRAFFIC:         "PASTE_CSV_URL_TRAFFIC",
  PERFORMANCE:     "PASTE_CSV_URL_PERFORMANCE",
  TARIFF:          "PASTE_CSV_URL_TARIFF",
  SDM:             "PASTE_CSV_URL_SDM",
  KONTAK:          "PASTE_CSV_URL_KONTAK",
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
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Gagal fetch tab ${tabName}: ${res.status}`);
  return parseCSV(await res.text());
}

function fmtNum(n) {
  const num = Number(String(n).replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(num)) return n;
  return num.toLocaleString("id-ID");
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined && value !== "") el.textContent = value;
}

async function initTerminalData(kodeTerminal) {
  const [master, infra, alat, traffic, perf, tarif, sdm, kontak] = await Promise.all(
    Object.keys(SHEET_URLS).map(fetchTab)
  );

  const byKode = (rows, key = "kode_terminal") => rows.filter(r => (r.kode_terminal || r.kode) === kodeTerminal);

  const m = byKode(master, "kode")[0] || {};
  const i = byKode(infra)[0] || {};
  const trf = byKode(traffic).sort((a, b) => a.tahun - b.tahun);
  const perfRows = byKode(perf);
  const tarifRows = byKode(tarif);
  const sdmRow = byKode(sdm)[0] || {};
  const kontakRows = byKode(kontak);
  const alatRows = byKode(alat);

  // ── S1 Hero ──
  if (trf.length) setText("stat-teus-terakhir", fmtNum(trf[trf.length - 1].volume_teus));
  setText("stat-kapasitas-terminal", fmtNum(m.kapasitas_teus || i.kapasitas_shore_crane));

  // ── S3 Traffic chart data ──
  window.TERMINAL_TRAFFIC = trf.map(r => ({ year: r.tahun, vol: Number(r.volume_teus) }));
  if (window.TERMINAL_TRAFFIC.length && typeof window.renderThroughputChart === "function") {
    window.renderThroughputChart(window.TERMINAL_TRAFFIC);
  }

  // ── S3 Kapasitas ──
  setText("cap-val-shore-crane", i.kapasitas_shore_crane ? fmtNum(i.kapasitas_shore_crane) + " TEUs" : undefined);
  setText("cap-val-yard-crane", i.kapasitas_yard_crane ? fmtNum(i.kapasitas_yard_crane) + " TEUs" : undefined);
  setText("cap-val-berth", i.kapasitas_berth ? fmtNum(i.kapasitas_berth) + " TEUs" : undefined);
  setText("cap-val-yard", i.kapasitas_yard ? fmtNum(i.kapasitas_yard) + " TEUs" : undefined);
  setText("infra-berth-length", i.panjang_dermaga_m ? i.panjang_dermaga_m + " m" : undefined);
  setText("infra-draft", i.draft_mlws ? "−" + Math.abs(i.draft_mlws) + " mLWS" : undefined);
  setText("infra-cy", i.luas_cy_ha ? i.luas_cy_ha + " ha" : undefined);

  // ── S4 Performance: render tabel & KPI cards ──
  const perfTable = document.getElementById("perf-table-body");
  if (perfTable && perfRows.length) {
    perfTable.innerHTML = perfRows.map(r => `
      <tr><td>${r.indikator}</td><td>${r.realisasi} ${r.satuan}</td><td>${r.rkap} ${r.satuan}</td><td>${r.periode}</td></tr>
    `).join("");
  }

  // ── S5 SDM ──
  // Catatan: hanya angka breakdown (Operations/Support/Technical) yang punya
  // id di markup saat ini. Total/RKAP/Realisasi tertanam dalam teks gabungan
  // (butuh restrukturisasi HTML manual bila ingin dibuat dinamis juga.
  setText("sdm-operations", sdmRow.operations);
  setText("sdm-support", sdmRow.support);
  setText("sdm-technical", sdmRow.technical);

  // ── S7 Peralatan ──
  // Icon SVG tiap alat ditulis manual per jenis (tidak digenerate), supaya
  // desain tetap terjaga — hanya ANGKA JUMLAH yang di-update live, dicocokkan
  // lewat kolom jenis_alat di tab PERALATAN.
  const equipIdMap = {
    "Fixed Crane (Ship-to-shore)": "equip-num-fixed-crane",
    "Reach Stacker": "equip-num-reach-stacker",
    "Side Loader": "equip-num-side-loader",
    "Forklift": "equip-num-forklift",
    "Head Truck": "equip-num-head-truck",
    "Tronton": "equip-num-tronton",
  };
  alatRows.forEach(r => {
    const id = equipIdMap[r.jenis_alat];
    if (id) setText(id, r.jumlah);
  });

  // ── S9 Tariff (ringkasan total per ukuran kontainer) ──
  const totalRow = tarifRows.find(r => r.komponen === "Total All Components");
  if (totalRow) {
    setText("tariff-sum-20f", totalRow.ukuran_20f);
    setText("tariff-sum-40f", totalRow.ukuran_40f);
    setText("tariff-sum-20e", totalRow.ukuran_20e);
    setText("tariff-sum-40e", totalRow.ukuran_40e);
  }
  // Rincian tabel A/B/C (stevedoring/stripping/port charge) masih statis di
  // HTML — datanya tetap tersimpan lengkap di tab TARIFF untuk referensi saat
  // replikasi ke terminal lain, tapi belum di-render otomatis ke tabel rinci.

  // ── S10 Kontak ──
  setText("contact-address", m.alamat);
  setText("contact-email", m.email);
  // contact-phone tidak di-wire karena div aslinya berisi markup gabungan
  // (nomor + nama + jabatan) yang akan rusak bila ditimpa via textContent.

  return { master: m, infra: i, traffic: trf, performance: perfRows, tariff: tarifRows, sdm: sdmRow, kontak: kontakRows, peralatan: alatRows };
}
