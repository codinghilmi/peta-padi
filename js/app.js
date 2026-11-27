import {
  buildRegionStory,
  computeDataAudit,
  formatAreaOrProd,
  formatNumber,
  formatPercent,
  formatProvinceName,
  formatPValue,
  formatSignedDelta,
  getCvFriendlyBadge,
  getInternalProvinceColor,
  getRankMedal,
  getRegionFillColor,
  getTierForRank,
  TIER_CONFIG,
} from './formatters.js';
import { fetchMapHtml, mountIndonesiaMap } from './mapLoader.js';

const MAX_BAR_SCALE = 65;

const state = {
  data: null,
  audit: null,
  kawasanRanked: [],
  provinceLookup: new Map(),
  mapContext: null,

  mode: 'explore', // 'explore' | 'compare'
  zoomedKawasan: null,
  hoveredKawasan: null,
  hoveredSvgId: null,
  syncedProvince: null, // Provinsi tersorot saat hover bar di panel / klik di peta zoom

  compareA: null,
  compareB: null,
  compareSelectTarget: 'A',

  kitchenStep: 0,
  isTouchPointer: false,
  countUpAnimId: null,
};

const els = {
  headerSubtitle: document.getElementById('header-subtitle'),
  pillMean: document.getElementById('pill-mean'),
  pillMeanText: document.getElementById('pill-mean-text'),
  meanPopover: document.getElementById('mean-popover'),
  pillTop: document.getElementById('pill-top'),
  pillTopText: document.getElementById('pill-top-text'),
  pillFinding: document.getElementById('pill-finding'),
  pillFindingText: document.getElementById('pill-finding-text'),

  errorBanner: document.getElementById('app-error-banner'),
  workspace: document.getElementById('workspace'),
  heroStage: document.getElementById('hero-stage'),

  btnExplore: document.getElementById('btn-mode-explore'),
  btnCompare: document.getElementById('btn-mode-compare'),
  btnResetMap: document.getElementById('btn-reset-map'),
  btnOpenKitchen: document.getElementById('btn-open-kitchen'),
  stageStatusBar: document.getElementById('stage-status-bar'),

  mapWrap: document.getElementById('map-canvas-wrap'),
  mapLoading: document.getElementById('map-loading'),
  mapHost: document.getElementById('map-svg-host'),
  mapLegend: document.getElementById('map-legend'),
  quickIslandsList: document.getElementById('quick-islands-list'),
  mapTooltip: document.getElementById('map-tooltip'),
  sidePanel: document.getElementById('side-panel'),

  footerSource: document.getElementById('footer-source'),
  btnProjectNote: document.getElementById('btn-project-note'),

  kitchenDialog: document.getElementById('kitchen-dialog'),
  kitchenTabs: document.getElementById('kitchen-tabs'),
  kitchenBody: document.getElementById('kitchen-body'),
  btnCloseKitchen: document.getElementById('btn-close-kitchen'),
  btnStepPrev: document.getElementById('btn-step-prev'),
  btnStepNext: document.getElementById('btn-step-next'),
  stepDots: document.getElementById('step-dots'),

  noteDialog: document.getElementById('note-dialog'),
  noteBody: document.getElementById('note-body'),
  btnCloseNote: document.getElementById('btn-close-note'),
  btnCloseNoteFooter: document.getElementById('btn-close-note-footer'),
};

function showError(msg) {
  els.errorBanner.hidden = false;
  els.errorBanner.innerHTML = `
    ⚠️ <strong>Gagal memuat dashboard:</strong> ${msg}
    <span>Jalankan lewat server lokal (misal <code>python -m http.server 8000</code>), bukan membuka file langsung via <code>file://</code>.</span>
  `;
}

function renderHeaderAndQuickBar() {
  const { meta, nasional } = state.data;
  const topRegion = state.kawasanRanked[0];

  els.headerSubtitle.textContent = `Eksplorasi Produktivitas Padi ${nasional.n_provinsi} Provinsi (Data ${meta.sumber} ${meta.tahun})`;
  els.footerSource.textContent = `${meta.sumber} (${meta.tahun}) — ${meta.satuan}`;

  // 3 Pill Badges
  els.pillMeanText.textContent = `Rata-rata Provinsi: ${formatNumber(nasional.mean_provinsi, 2)} ku/ha`;
  els.meanPopover.innerHTML = `
    <strong>Kenapa beda dengan angka nasional BPS (${formatNumber(nasional.produktivitas_tertimbang_bps, 2)} ku/ha)?</strong><br />
    Angka <strong>${formatNumber(nasional.mean_provinsi, 2)} ku/ha</strong> memberi bobot setara bagi seluruh ${nasional.n_provinsi} provinsi (cocok untuk uji beda antarwilayah).
    Angka BPS <strong>${formatNumber(nasional.produktivitas_tertimbang_bps, 2)} ku/ha</strong> adalah rata-rata tertimbang luas panen, sehingga tertarik naik oleh sentra sawah luas di Jawa.
  `;

  els.pillTopText.textContent = `Tertinggi: ${topRegion.name} (${formatNumber(topRegion.statistik.mean, 2)} ku/ha)`;
  els.pillFindingText.textContent = `Temuan Utama: Lokasi Pulau Berpengaruh Besar (${formatPercent(nasional.anova.eta_sq, 1)})`;

  // Legenda Ringkas 3 Tier
  els.mapLegend.innerHTML = `
    <span class="legend-item"><span class="legend-dot t1"></span>Tier 1: Tinggi</span>
    <span class="legend-item"><span class="legend-dot t2"></span>Tier 2: Menengah</span>
    <span class="legend-item"><span class="legend-dot t3"></span>Tier 3: Rendah</span>
  `;

  // Tombol pil cepat 6 pulau
  els.quickIslandsList.innerHTML = state.kawasanRanked
    .map((r) => {
      const color = getRegionFillColor(r.peringkat);
      return `
        <button type="button" class="island-chip" data-quick-kawasan="${r.name}">
          <span class="chip-dot" style="background:${color}" aria-hidden="true"></span>
          <span>#${r.peringkat} ${r.name}</span>
        </button>
      `;
    })
    .join('');

  // Catatan Proyek modal body
  els.noteBody.innerHTML = `
    <p class="kitchen-lead">
      Dashboard ini disusun sebagai proyek akhir mata kuliah <strong>Statistika Dasar</strong> oleh
      <strong>Muhammad Hilmi Mu'afa (NRP 3326600014)</strong> menggunakan data resmi
      <strong>${meta.sumber} tahun ${meta.tahun}</strong> (${nasional.n_provinsi} provinsi dalam ${state.kawasanRanked.length} kawasan kepulauan).
    </p>
    <div class="dob-note">
      <strong>Catatan Peta 34 vs 38 Provinsi:</strong> Geometri dasar peta SVG mengikuti batas 34 provinsi
      (Papua &amp; Papua Barat pra-pemekaran), sedangkan seluruh perhitungan statistik dan daftar rincian provinsi
      di kawasan <strong>Maluku &amp; Papua</strong> tetap menampilkan lengkap <strong>8 provinsi BPS ${meta.tahun}</strong>
      (termasuk Papua Selatan, Papua Tengah, Papua Pegunungan, dan Papua Barat Daya).
    </div>
  `;
}

function getTukeyPairInfo(kawasanA, kawasanB) {
  if (!kawasanA || !kawasanB || kawasanA === kawasanB) return null;
  const regA = state.data.kawasan[kawasanA];
  const regB = state.data.kawasan[kawasanB];
  if (!regA || !regB) return null;

  const match = (regA.beda_signifikan_tukey || []).find((d) => d.lawan === kawasanB);
  const diffMean = Math.abs(regA.statistik.mean - regB.statistik.mean);
  return {
    significant: Boolean(match),
    selisih: match ? Number(match.selisih_ku_ha) : diffMean,
    pAdj: match ? Number(match.p_adj) : null,
    higher: regA.statistik.mean >= regB.statistik.mean ? kawasanA : kawasanB,
    lower: regA.statistik.mean >= regB.statistik.mean ? kawasanB : kawasanA,
  };
}

function updateUIState() {
  const isExplore = state.mode === 'explore';
  const hasZoom = isExplore && Boolean(state.zoomedKawasan);
  const hasPanelOpen = hasZoom || !isExplore;

  els.btnExplore.classList.toggle('is-active', isExplore);
  els.btnExplore.setAttribute('aria-selected', String(isExplore));
  els.btnCompare.classList.toggle('is-active', !isExplore);
  els.btnCompare.setAttribute('aria-selected', String(!isExplore));

  const showReset = hasZoom || (!isExplore && (Boolean(state.compareA) || Boolean(state.compareB)));
  els.btnResetMap.hidden = !showReset;

  els.workspace.classList.toggle('has-side-panel', hasPanelOpen);
  els.sidePanel.hidden = !hasPanelOpen;

  // Bar status kontekstual
  if (hasZoom) {
    els.stageStatusBar.hidden = false;
    els.stageStatusBar.innerHTML = `
      <span>🔍 Fokus di <strong>${state.zoomedKawasan}</strong> • Arahkan kursor atau klik tiap provinsi untuk cek detailnya.</span>
      <span>Tekan <kbd>Esc</kbd> / klik area laut untuk kembali</span>
    `;
  } else if (!isExplore) {
    els.stageStatusBar.hidden = false;
    if (!state.compareA) {
      els.stageStatusBar.innerHTML = `<span>⚔️ <strong>Mode Bandingkan:</strong> Klik <strong>Pulau A</strong> di peta atau pilih lewat dropdown di panel kanan.</span>`;
    } else if (!state.compareB) {
      els.stageStatusBar.innerHTML = `<span>⚔️ Pulau A: <strong>${state.compareA}</strong> terpilih — sekarang klik <strong>Pulau B</strong> di peta!</span>`;
    } else {
      els.stageStatusBar.innerHTML = `<span>⚔️ Membandingkan <strong>${state.compareA}</strong> vs <strong>${state.compareB}</strong> — klik pulau lain di peta untuk mengganti.</span>`;
    }
  } else {
    els.stageStatusBar.hidden = true;
  }

  // Update legenda dinamis sesuai mode
  if (!isExplore && (state.compareA || state.compareB)) {
    const items = [];
    if (state.compareA) {
      items.push(`<span class="legend-item"><span class="legend-dot cmp-a"></span>Pulau A: ${state.compareA}</span>`);
    }
    if (state.compareB) {
      items.push(`<span class="legend-item"><span class="legend-dot cmp-b"></span>Pulau B: ${state.compareB}</span>`);
    }
    els.mapLegend.innerHTML = items.join('');
  } else {
    els.mapLegend.innerHTML = `
      <span class="legend-item"><span class="legend-dot t1"></span>Tier 1: Tinggi</span>
      <span class="legend-item"><span class="legend-dot t2"></span>Tier 2: Menengah</span>
      <span class="legend-item"><span class="legend-dot t3"></span>Tier 3: Rendah</span>
    `;
  }

  // Update active state pada pil cepat pulau
  for (const chip of els.quickIslandsList.querySelectorAll('.island-chip')) {
    const name = chip.getAttribute('data-quick-kawasan');
    const active =
      (isExplore && state.zoomedKawasan === name) ||
      (!isExplore && (state.compareA === name || state.compareB === name));
    chip.classList.toggle('is-active', active);
  }

  updateMapVisuals();
}

function updateMapVisuals() {
  if (!state.mapContext) return;
  const { svg, groupMap, overlayGroupMap, pathRegistry } = state.mapContext;
  const { kawasan } = state.data;

  const isExplore = state.mode === 'explore';
  const isZoomed = isExplore && Boolean(state.zoomedKawasan);
  const isCompare = !isExplore;

  svg.classList.toggle('is-zoomed', isZoomed);
  svg.classList.toggle('is-compare', isCompare);

  // Hitung rentang min-max internal jika sedang zoom-in ke satu pulau
  let zoomedMin = 0;
  let zoomedMax = 1;
  let zoomedRank = 1;
  if (isZoomed) {
    const zReg = kawasan[state.zoomedKawasan];
    zoomedMin = zReg.statistik.min;
    zoomedMax = zReg.statistik.max;
    zoomedRank = zReg.peringkat;
  }

  for (const [, info] of pathRegistry.entries()) {
    const region = kawasan[info.kawasan];
    if (!region) continue;

    let fillColor = getRegionFillColor(region.peringkat);

    if (isZoomed && info.kawasan === state.zoomedKawasan) {
      // Gradasi internal pulau agar setiap provinsi mudah dibedakan saat di-zoom
      const provObj = state.provinceLookup.get(info.provinsi);
      const val = provObj ? provObj.Produktivitas : region.statistik.mean;
      fillColor = getInternalProvinceColor(val, zoomedMin, zoomedMax, zoomedRank);
    } else if (isCompare) {
      if (state.compareA === info.kawasan) {
        fillColor = '#58CC02';
      } else if (state.compareB === info.kawasan) {
        fillColor = '#38BDF8';
      }
    }

    info.element.style.fill = fillColor;

    const isProvHover =
      isZoomed &&
      info.kawasan === state.zoomedKawasan &&
      (state.hoveredSvgId === info.svgId ||
        (state.syncedProvince && info.provinsiGroup.includes(state.syncedProvince)));

    info.element.classList.toggle('is-prov-hovered', Boolean(isProvHover));
    info.outline.classList.toggle('is-prov-hovered', Boolean(isProvHover));

    if (isZoomed && info.kawasan === state.zoomedKawasan) {
      const pObj = state.provinceLookup.get(info.provinsi);
      info.element.setAttribute(
        'aria-label',
        `${formatProvinceName(info.provinsi)}, produktivitas ${formatNumber(pObj?.Produktivitas, 2)} kuintal per hektar`
      );
    } else {
      info.element.setAttribute(
        'aria-label',
        `${formatProvinceName(info.provinsi)} (${info.kawasan}), rata-rata kawasan ${formatNumber(region.statistik.mean, 2)} kuintal per hektar`
      );
    }
  }

  const hasHoverInFull = isExplore && !isZoomed && Boolean(state.hoveredKawasan);
  const hasCompareBoth = isCompare && Boolean(state.compareA) && Boolean(state.compareB);

  for (const [name, g] of groupMap.entries()) {
    const isHovered = isExplore && !isZoomed && state.hoveredKawasan === name;
    const isSelected = isZoomed && state.zoomedKawasan === name;
    const isCompareA = isCompare && state.compareA === name;
    const isCompareB = isCompare && state.compareB === name;

    let isDimmed = false;
    if (isZoomed) {
      isDimmed = name !== state.zoomedKawasan;
    } else if (hasHoverInFull) {
      isDimmed = name !== state.hoveredKawasan;
    } else if (isCompare && (state.compareA || state.compareB)) {
      isDimmed = !isCompareA && !isCompareB;
    }

    g.classList.toggle('is-hovered', isHovered);
    g.classList.toggle('is-selected', isSelected);
    g.classList.toggle('is-dimmed', isDimmed);

    const og = overlayGroupMap.get(name);
    if (og) {
      og.classList.toggle('is-hovered', isHovered || (isCompare && state.hoveredKawasan === name));
      og.classList.toggle('is-selected', isSelected);
      og.classList.toggle('is-compare-a', isCompareA);
      og.classList.toggle('is-compare-b', isCompareB);
    }
  }

  if (hasCompareBoth) {
    state.mapContext.drawCompareArc(state.compareA, state.compareB);
  } else {
    state.mapContext.clearCompareArc();
  }
}

function renderInsightPanel(kawasanName) {
  const region = state.data.kawasan[kawasanName];
  if (!region) return;

  const { nasional } = state.data;
  const tier = getTierForRank(region.peringkat);
  const tierCfg = TIER_CONFIG[tier];
  const cvBadge = getCvFriendlyBadge(region.statistik.cv_persen);
  const story = buildRegionStory(kawasanName, region, nasional);
  const sortedProvs = [...region.provinsi].sort((a, b) => b.Produktivitas - a.Produktivitas);
  const refLeftPct = ((nasional.mean_provinsi / MAX_BAR_SCALE) * 100).toFixed(2);

  const tukeyHtml =
    region.beda_signifikan_tukey.length > 0
      ? `
        <div class="tukey-chips-list">
          ${region.beda_signifikan_tukey
            .map((diff) => {
              const up = diff.arah === 'lebih tinggi';
              return `
                <button
                  type="button"
                  class="tukey-chip-btn"
                  data-compare-pair="${kawasanName}::${diff.lawan}"
                  title="Klik untuk langsung membandingkan ${kawasanName} vs ${diff.lawan}"
                >
                  <span>
                    vs <strong>${diff.lawan}</strong>:
                    <strong class="mono">${up ? '+' : '-'}${formatNumber(diff.selisih_ku_ha, 2)} ku/ha</strong>
                    (Beda Nyata! p=${formatPValue(diff.p_adj)})
                  </span>
                  <span aria-hidden="true">⚔️</span>
                </button>
              `;
            })
            .join('')}
        </div>
      `
      : `
        <div class="friendly-neutral-box">
          Posisinya di tengah—secara statistik tidak berbeda jauh dari pulau lain (Tukey HSD, &alpha; = 0,05).
        </div>
      `;

  const provBarsHtml = sortedProvs
    .map((prov) => {
      const pct = Math.min(100, Math.max(0, (prov.Produktivitas / MAX_BAR_SCALE) * 100));
      const fillColor = getInternalProvinceColor(
        prov.Produktivitas,
        region.statistik.min,
        region.statistik.max,
        region.peringkat
      );
      const isSynced = state.syncedProvince === prov.Provinsi;
      return `
        <button
          type="button"
          class="prov-bar-item ${isSynced ? 'is-synced' : ''}"
          data-prov-name="${prov.Provinsi}"
        >
          <div class="prov-bar-head">
            <span class="prov-bar-name">${formatProvinceName(prov.Provinsi)}</span>
            <span class="prov-bar-num mono">${formatNumber(prov.Produktivitas, 2)} ku/ha</span>
          </div>
          <div class="chunky-track" aria-hidden="true">
            <div class="chunky-fill" style="width:${pct.toFixed(1)}%; background:${fillColor}"></div>
            <span
              class="chunky-ref-marker"
              style="left:${refLeftPct}%"
              title="Rata-rata 38 provinsi: ${formatNumber(nasional.mean_provinsi, 2)} ku/ha"
            ></span>
          </div>
          <div class="prov-bar-meta mono">
            <span>Luas: ${formatAreaOrProd(prov.Luas_Panen)} ha</span>
            <span>Produksi: ${formatAreaOrProd(prov.Produksi)} ton</span>
          </div>
        </button>
      `;
    })
    .join('');

  const dobFootnote =
    kawasanName === 'Maluku & Papua'
      ? `
        <div class="dob-note">
          Peta memakai batas 34 provinsi, namun daftar ini memuat lengkap seluruh <strong>8 provinsi BPS ${state.data.meta.tahun}</strong> termasuk 4 DOB Papua.
        </div>
      `
      : '';

  els.sidePanel.innerHTML = `
    <div class="panel-top-row">
      <span class="rank-sticker ${tierCfg.badgeClass}">
        ${getRankMedal(region.peringkat)} • ${tierCfg.label}
      </span>
      <span class="mono" style="font-size:12px;color:var(--ink-secondary);font-weight:700;">
        ${region.statistik.n} provinsi
      </span>
    </div>

    <h2 class="panel-hero-title">${kawasanName}</h2>
    <p class="story-box">${story}</p>

    <div class="mini-tiles-3">
      <div class="mini-tile">
        <span class="mini-tile-label">Rata-rata</span>
        <span class="mini-tile-val">${formatNumber(region.statistik.mean, 2)}</span>
        <span class="mini-tile-sub">ku/ha</span>
      </div>
      <div class="mini-tile">
        <span class="mini-tile-label">Nilai Tengah</span>
        <span class="mini-tile-val">${formatNumber(region.statistik.median, 2)}</span>
        <span class="mini-tile-sub">IQR ${formatNumber(region.statistik.iqr, 2)}</span>
      </div>
      <div class="mini-tile">
        <span class="mini-tile-label">Pemerataan</span>
        <span class="mini-tile-val">${formatNumber(region.statistik.cv_persen, 1)}%</span>
        <span class="mini-tile-sub">${cvBadge.label}</span>
      </div>
    </div>

    <div>
      <h3 class="panel-section-title">
        <span>Uji Beda vs Pulau Lain (Tukey HSD)</span>
      </h3>
      ${tukeyHtml}
    </div>

    <div>
      <h3 class="panel-section-title">
        <span>Peringkat Provinsi (${region.provinsi.length})</span>
        <span class="mono" style="font-size:11px;color:var(--ink-secondary);">Garis: ${formatNumber(nasional.mean_provinsi, 2)}</span>
      </h3>
      <div class="prov-bars-list">${provBarsHtml}</div>
    </div>

    ${dobFootnote}

    <div class="panel-footer-actions">
      <button type="button" class="pill-btn pill-btn-sky" id="btn-compare-from-insight">
        ⚔️ Bandingkan ${kawasanName} dengan Pulau Lain
      </button>
      <button type="button" class="pill-btn" id="btn-back-indonesia">
        ← Kembali ke Peta Indonesia
      </button>
    </div>
  `;
}

function animateCompareNumbers(meanA, meanB, diffVal) {
  if (state.countUpAnimId !== null) {
    cancelAnimationFrame(state.countUpAnimId);
    state.countUpAnimId = null;
  }

  const elA = document.getElementById('cmp-score-a');
  const elB = document.getElementById('cmp-score-b');
  const elDiff = document.getElementById('cmp-diff-num');
  const barA = document.getElementById('cmp-bar-a');
  const barB = document.getElementById('cmp-bar-b');
  if (!elA || !elB || !elDiff) return;

  // Memicu animasi bar tumbuh pada frame berikutnya
  requestAnimationFrame(() => {
    if (barA) barA.style.width = `${Math.min(100, (meanA / MAX_BAR_SCALE) * 100).toFixed(1)}%`;
    if (barB) barB.style.width = `${Math.min(100, (meanB / MAX_BAR_SCALE) * 100).toFixed(1)}%`;
  });

  const start = performance.now();
  const duration = 520;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function frame(now) {
    const raw = Math.min(1, (now - start) / duration);
    const t = easeOut(raw);
    elA.textContent = `${formatNumber(meanA * t, 2)} ku/ha`;
    elB.textContent = `${formatNumber(meanB * t, 2)} ku/ha`;
    elDiff.textContent = `${formatNumber(diffVal * t, 2)} ku/ha`;
    if (raw < 1) {
      state.countUpAnimId = requestAnimationFrame(frame);
    } else {
      state.countUpAnimId = null;
    }
  }
  state.countUpAnimId = requestAnimationFrame(frame);
}

function renderComparePanel() {
  const optionsHtml = (selectedName, placeholder) => {
    const opts = state.kawasanRanked
      .map(
        (r) =>
          `<option value="${r.name}" ${selectedName === r.name ? 'selected' : ''}>${getRankMedal(r.peringkat)} ${r.name} (${formatNumber(r.statistik.mean, 1)})</option>`
      )
      .join('');
    return `<option value="">${placeholder}</option>${opts}`;
  };

  const pairShortcutsHtml = state.audit.tukeyPairs
    .map(
      (p) => `
      <button type="button" class="shortcut-pair-btn" data-quick-pair="${p.higher}::${p.lower}">
        <span>✨ ${p.higher} vs ${p.lower}</span>
        <span class="mono">+${formatNumber(p.selisih, 2)} ku/ha</span>
      </button>
    `
    )
    .join('');

  let resultHtml = `
    <div class="compare-result-card">
      <div style="font-weight:700;font-size:13px;color:var(--ink);">
        Pilih dua pulau di atas (atau klik langsung di peta) untuk melihat apakah selisih panennya beda nyata atau cuma kebetulan statistik!
      </div>
      <div>
        <div class="panel-section-title"><span>🔥 3 Pasangan Paling Timpang</span></div>
        <div class="shortcut-chips">${pairShortcutsHtml}</div>
      </div>
    </div>
  `;

  let hasValidPair = false;
  let regA = null;
  let regB = null;
  let pairInfo = null;

  if (state.compareA && state.compareB && state.compareA !== state.compareB) {
    hasValidPair = true;
    regA = state.data.kawasan[state.compareA];
    regB = state.data.kawasan[state.compareB];
    pairInfo = getTukeyPairInfo(state.compareA, state.compareB);

    const sackCount = (mean) => '🌾'.repeat(Math.max(1, Math.min(5, Math.round(mean / 11))));
    const explanation = pairInfo.significant
      ? `Rata-rata produktivitas <strong>${pairInfo.higher}</strong> lebih tinggi <strong class="mono">${formatNumber(pairInfo.selisih, 2)} ku/ha</strong> dibanding <strong>${pairInfo.lower}</strong> (Tukey HSD <span class="mono">p = ${formatPValue(pairInfo.pAdj)}</span> &lt; 0,05). Perbedaan ini terlalu konsisten untuk dianggap kebetulan.`
      : `Selisih rata-rata kedua pulau hanya <strong class="mono">${formatNumber(pairInfo.selisih, 2)} ku/ha</strong>. Karena variasi antarprovinsi di dalamnya cukup lebar (CV ${formatNumber(regA.statistik.cv_persen, 1)}% vs ${formatNumber(regB.statistik.cv_persen, 1)}%), uji Tukey HSD pada &alpha; = 0,05 menyatakan keduanya belum terbukti berbeda nyata.`;

    resultHtml = `
      <div class="compare-result-card">
        <div class="verdict-badge ${pairInfo.significant ? 'is-sig' : 'is-ns'}">
          ${pairInfo.significant ? 'BEDA NYATA SECARA STATISTIK ✨' : 'SECARA STATISTIK MIRIP / BELUM CUKUP BUKTI BEDA 🤝'}
        </div>

        <div class="compare-bars-grid">
          <div class="compare-island-row">
            <div class="compare-island-head">
              <span>🟢 ${state.compareA} <span aria-hidden="true">${sackCount(regA.statistik.mean)}</span></span>
              <span id="cmp-score-a" class="compare-big-score">0,00 ku/ha</span>
            </div>
            <div class="compare-track"><div id="cmp-bar-a" class="compare-fill is-a"></div></div>
          </div>

          <div class="compare-island-row">
            <div class="compare-island-head">
              <span>🔵 ${state.compareB} <span aria-hidden="true">${sackCount(regB.statistik.mean)}</span></span>
              <span id="cmp-score-b" class="compare-big-score">0,00 ku/ha</span>
            </div>
            <div class="compare-track"><div id="cmp-bar-b" class="compare-fill is-b"></div></div>
          </div>
        </div>

        <div class="compare-diff-callout">
          <span>Selisih Rata-rata</span>
          <span id="cmp-diff-num" class="mono" style="font-size:15px;color:var(--ink);">0,00 ku/ha</span>
        </div>

        <p class="compare-explain">${explanation}</p>

        <div class="panel-footer-actions" style="border-top:none;padding-top:2px;">
          <button type="button" class="pill-btn" id="btn-try-another-pair">🔄 Coba Pasangan Lain</button>
          <div>
            <div class="panel-section-title" style="margin-top:4px;"><span>Lihat 3 Pasangan Paling Timpang</span></div>
            <div class="shortcut-chips">${pairShortcutsHtml}</div>
          </div>
        </div>
      </div>
    `;
  }

  els.sidePanel.innerHTML = `
    <div class="panel-top-row">
      <span class="rank-sticker tier-1-badge">⚔️ Mode Bandingkan</span>
      <button type="button" class="btn-note-link" id="btn-compare-back-explore">← Mode Jelajah</button>
    </div>

    <h2 class="panel-hero-title">Duel Produktivitas Pulau</h2>

    <div class="compare-selectors">
      <select id="select-compare-a" class="compare-select-pill is-a" aria-label="Pilih Pulau Pertama">
        ${optionsHtml(state.compareA, 'Pilih Pulau A...')}
      </select>
      <span class="vs-badge" aria-hidden="true">VS</span>
      <select id="select-compare-b" class="compare-select-pill is-b" aria-label="Pilih Pulau Kedua">
        ${optionsHtml(state.compareB, 'Pilih Pulau B...')}
      </select>
    </div>

    ${resultHtml}
  `;

  if (hasValidPair) {
    animateCompareNumbers(regA.statistik.mean, regB.statistik.mean, pairInfo.selisih);
  }
}

function renderKitchenStep() {
  const step = state.kitchenStep;
  const { meta, nasional } = state.data;
  const audit = state.audit;

  for (const tab of els.kitchenTabs.querySelectorAll('.step-tab')) {
    const idx = Number(tab.getAttribute('data-step'));
    tab.classList.toggle('is-active', idx === step);
    tab.setAttribute('aria-selected', String(idx === step));
  }

  els.stepDots.innerHTML = [0, 1, 2, 3]
    .map((i) => `<span class="step-dot ${i === step ? 'is-active' : ''}"></span>`)
    .join('');

  els.btnStepPrev.disabled = step === 0;
  els.btnStepPrev.style.opacity = step === 0 ? '0.45' : '1';
  els.btnStepNext.textContent = step === 3 ? 'Selesai ✓' : 'Lanjut →';

  if (step === 0) {
    els.kitchenBody.innerHTML = `
      <p class="kitchen-lead">
        Sebelum membandingkan antarpulau, seluruh data dari <strong>${meta.sumber} (${meta.tahun})</strong> diaudit agar bebas dari nilai kosong dan outlier ekstrem.
      </p>
      <div class="audit-grid">
        <div class="audit-card">
          <h3>✅ ${audit.nProvinsi} Provinsi Lengkap</h3>
          <div class="mono" style="font-size:12.5px;">
            • Data kosong: <strong>${audit.missingCount}</strong><br/>
            • Outlier ekstrem IQR: <strong>${audit.extremeOutlierCount}</strong><br/>
            • Skewness: <strong>${formatNumber(audit.skewness, 2)}</strong> (simetris)
          </div>
        </div>
        <div class="audit-card">
          <h3>⚖️ ${formatNumber(nasional.mean_provinsi, 2)} vs ${formatNumber(nasional.produktivitas_tertimbang_bps, 2)} ku/ha</h3>
          <div style="font-size:12.5px;color:var(--ink-secondary);">
            <strong>Mean Provinsi (${formatNumber(nasional.mean_provinsi, 2)})</strong> memberi bobot sama tiap provinsi untuk uji ANOVA,
            sedangkan <strong>Angka BPS (${formatNumber(nasional.produktivitas_tertimbang_bps, 2)})</strong> tertimbang luas panen.
          </div>
        </div>
      </div>
    `;
  } else if (step === 1) {
    const shapiroCards = state.kawasanRanked
      .map(
        (r) => `
        <div class="shapiro-card">
          <span><strong>✅ ${r.name}</strong> (n=${r.statistik.n})</span>
          <span class="mono">W=${formatNumber(r.shapiro_wilk.W, 3)} | p=${formatPValue(r.shapiro_wilk.p_value)}</span>
        </div>
      `
      )
      .join('');

    els.kitchenBody.innerHTML = `
      <p class="kitchen-lead">
        Uji <strong>Shapiro–Wilk</strong> memastikan data tiap pulau berdistribusi normal, dan <strong>Levene's Test</strong> memastikan ragam antarwilayah seragam.
      </p>
      <div class="shapiro-grid">${shapiroCards}</div>
      <div class="formula-box">
        <strong>Uji Homogenitas Varians (Levene's Test):</strong>
        <div class="formula-eq">F = ${formatNumber(nasional.levene.F, 4)} &nbsp;|&nbsp; p-value = ${formatPValue(nasional.levene.p_value)} (&gt; 0,05 → Homogen ✅)</div>
        <span style="font-size:12.5px;">
          <em>Kesimpulan awam:</em> Karena data tiap pulau tersebar normal dan seragam, kita sah memakai uji <strong>One-Way ANOVA</strong> sebagai metode utama!
        </span>
      </div>
    `;
  } else if (step === 2) {
    els.kitchenBody.innerHTML = `
      <p class="kitchen-lead">
        Kita menjalankan uji parametrik utama sekaligus uji non-parametrik sebagai penguat (karena jumlah provinsi tiap pulau bervariasi dari n = ${audit.minGroupN} hingga n = ${audit.maxGroupN}).
      </p>
      <div class="formula-box">
        <strong>1. One-Way ANOVA (Uji Utama)</strong>
        <div class="formula-eq">F = MS_antar / MS_dalam = ${formatNumber(nasional.anova.F, 2)} &nbsp;|&nbsp; p = ${formatPValue(nasional.anova.p_value)} &nbsp;|&nbsp; η² = ${formatNumber(nasional.anova.eta_sq, 4)}</div>
        <span style="font-size:12.5px;">
          <strong>${formatPercent(nasional.anova.eta_sq, 1)}</strong> variasi produktivitas padi antarprovinsi dijelaskan oleh faktor lokasi kepulauan (<strong>Efek Besar</strong>).
        </span>
      </div>
      <div class="formula-box">
        <strong>2. Kruskal–Wallis (Uji Sensitivitas / Robustness)</strong>
        <div class="formula-eq">H = ${formatNumber(nasional.kruskal_wallis.H, 2)} &nbsp;|&nbsp; p = ${formatPValue(nasional.kruskal_wallis.p_value)} &nbsp;|&nbsp; ε² = ${formatNumber(nasional.kruskal_wallis.epsilon_sq, 4)}</div>
        <span style="font-size:12.5px;">
          Mengonfirmasi hasil tetap sangat signifikan meski ukuran kelompok tidak seimbang.
        </span>
      </div>
    `;
  } else {
    const maxDiff = Math.max(...audit.tukeyPairs.map((p) => p.selisih), 20);
    const forestHtml = audit.tukeyPairs
      .map((p) => {
        const w = Math.min(100, (p.selisih / maxDiff) * 90);
        return `
          <div class="forest-row">
            <div class="forest-row-top">
              <span><strong>${p.higher}</strong> vs <strong>${p.lower}</strong></span>
              <span class="mono" style="font-weight:700;color:var(--tier1-border);">+${formatNumber(p.selisih, 2)} ku/ha (p=${formatPValue(p.p_adj)})</span>
            </div>
            <div class="forest-track" aria-hidden="true">
              <div class="forest-bar" style="width:${w.toFixed(1)}%"></div>
            </div>
            <div style="display:flex;justify-content:flex-end;">
              <button type="button" class="pill-btn pill-btn-sky" style="min-height:32px;padding:4px 12px;font-size:12px;" data-spotlight-pair="${p.higher}::${p.lower}">
                🔍 Sorot di Peta
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    els.kitchenBody.innerHTML = `
      <p class="kitchen-lead">
        Dari ${audit.totalPairs} kemungkinan pasangan antarpulau, uji lanjut <strong>Tukey HSD (&alpha; = 0,05)</strong> menemukan <strong>${audit.tukeyPairs.length} pasangan</strong> yang benar-benar berbeda signifikan:
      </p>
      <div class="forest-list">${forestHtml}</div>
    `;
  }
}

function buildTooltipHtml(info) {
  const region = state.data.kawasan[info.kawasan];
  if (!region) return '';

  const natMean = state.data.nasional.mean_provinsi;

  // Saat sedang zoom-in di dalam pulau, tampilkan tooltip detail provinsi
  if (state.mode === 'explore' && state.zoomedKawasan === info.kawasan) {
    const group = info.provinsiGroup || [info.provinsi];
    const rows = group
      .map((name) => {
        const p = state.provinceLookup.get(name);
        if (!p) return '';
        const d = p.Produktivitas - natMean;
        return `
          <div class="tt-prov-row">
            <span><strong>${formatProvinceName(name)}</strong></span>
            <span class="mono"><strong>${formatNumber(p.Produktivitas, 2)}</strong> ku/ha (${formatSignedDelta(d, 2)})</span>
          </div>
        `;
      })
      .join('');

    const firstProv = state.provinceLookup.get(info.provinsi);
    return `
      <div class="tt-head">
        <span class="tt-badge">${formatProvinceName(info.provinsi)}${group.length > 1 ? ' (+DOB)' : ''}</span>
        <span class="tt-tier-tag ${TIER_CONFIG[getTierForRank(region.peringkat)].badgeClass}">${info.kawasan}</span>
      </div>
      <div class="tt-prov-stats">${rows}</div>
      <div class="tt-cta" style="border-top:none;padding-top:0;">
        ${
          group.length === 1 && firstProv
            ? `Luas ${formatAreaOrProd(firstProv.Luas_Panen)} ha • Produksi ${formatAreaOrProd(firstProv.Produksi)} ton`
            : 'Cakupan batas peta 34 prov. • Lihat semua DOB di panel'
        }
      </div>
    `;
  }

  // Mode penuh atau Bandingkan: tampilkan tooltip ramah level kawasan
  const delta = region.statistik.mean - natMean;
  const tier = getTierForRank(region.peringkat);
  const tierCfg = TIER_CONFIG[tier];
  const compareWord = delta >= 0 ? 'di atas rata-rata provinsi' : 'di bawah rata-rata provinsi';
  const ctaText =
    state.mode === 'compare'
      ? 'Klik untuk pilih sebagai pulau pembanding →'
      : 'Klik untuk zoom & bedah isi pulau →';

  return `
    <div class="tt-head">
      <span class="tt-badge">${getRankMedal(region.peringkat)} ${info.kawasan}</span>
      <span class="tt-tier-tag ${tierCfg.badgeClass}">${tierCfg.label.replace('Tier ', 'T')}</span>
    </div>
    <div class="tt-big-num">${formatNumber(region.statistik.mean, 2)} <small>ku/ha</small></div>
    <div class="tt-compare-line"><span class="mono">${formatSignedDelta(delta, 2)} ku/ha</span> ${compareWord}</div>
    <div class="tt-cta">${ctaText}</div>
  `;
}

function positionTooltip(clientX, clientY) {
  const tt = els.mapTooltip;
  if (tt.hidden) return;
  const hostRect = els.heroStage.getBoundingClientRect();
  const ttRect = tt.getBoundingClientRect();
  const offset = 14;

  let left = clientX - hostRect.left + offset;
  let top = clientY - hostRect.top + offset;
  if (left + ttRect.width > hostRect.width - 10) left = clientX - hostRect.left - ttRect.width - offset;
  if (top + ttRect.height > hostRect.height - 10) top = clientY - hostRect.top - ttRect.height - offset;

  left = Math.max(8, left);
  top = Math.max(8, top);
  tt.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
}

function hideTooltip() {
  els.mapTooltip.hidden = true;
  if (state.hoveredKawasan || state.hoveredSvgId) {
    state.hoveredKawasan = null;
    state.hoveredSvgId = null;
    updateMapVisuals();
  }
}

function zoomIntoKawasan(kawasanName) {
  state.mode = 'explore';
  state.zoomedKawasan = kawasanName;
  state.hoveredKawasan = null;
  state.hoveredSvgId = null;
  state.syncedProvince = null;
  els.mapTooltip.hidden = true;

  renderInsightPanel(kawasanName);
  updateUIState();
  state.mapContext?.zoomToKawasan(kawasanName);
}

function resetToFullMap() {
  state.zoomedKawasan = null;
  state.syncedProvince = null;
  state.hoveredKawasan = null;
  state.hoveredSvgId = null;
  els.mapTooltip.hidden = true;

  if (state.mode === 'compare') {
    state.compareA = null;
    state.compareB = null;
    state.compareSelectTarget = 'A';
    renderComparePanel();
  }
  updateUIState();
  state.mapContext?.resetZoom();
}

function enterCompareMode(initialA = null, initialB = null) {
  state.mode = 'compare';
  state.zoomedKawasan = null;
  state.syncedProvince = null;
  state.hoveredKawasan = null;
  state.hoveredSvgId = null;
  state.compareA = initialA;
  state.compareB = initialB;
  state.compareSelectTarget = initialA && !initialB ? 'B' : 'A';
  els.mapTooltip.hidden = true;

  renderComparePanel();
  updateUIState();

  if (initialA && initialB && initialA !== initialB) {
    state.mapContext?.zoomToPair(initialA, initialB);
  } else {
    state.mapContext?.resetZoom();
  }
}

function openKitchenModal(stepIdx = 0) {
  state.kitchenStep = stepIdx;
  renderKitchenStep();
  if (typeof els.kitchenDialog.showModal === 'function') {
    els.kitchenDialog.showModal();
  } else {
    els.kitchenDialog.setAttribute('open', '');
  }
}

function closeDialog(dialogEl) {
  if (typeof dialogEl.close === 'function') {
    dialogEl.close();
  } else {
    dialogEl.removeAttribute('open');
  }
}

function bindEvents() {
  // Popover penjelasan mean provinsi vs BPS tertimbang (bebas konflik hover + click)
  const toggleMeanPopover = (show) => {
    const next = typeof show === 'boolean' ? show : els.meanPopover.hidden;
    els.meanPopover.hidden = !next;
    els.pillMean.setAttribute('aria-expanded', String(next));
  };
  els.pillMean.addEventListener('click', (e) => {
    e.stopPropagation();
    // Saat klik dengan mouse, hanya tutup jika tidak baru saja dibuka lewat hover; pada touch/keyboard selalu toggle
    if (state.isTouchPointer || e.detail === 0) {
      toggleMeanPopover();
    } else {
      toggleMeanPopover(true);
    }
  });
  els.pillMean.parentElement.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'touch') toggleMeanPopover(true);
  });
  els.pillMean.parentElement.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch') toggleMeanPopover(false);
  });
  document.addEventListener('click', (e) => {
    if (!els.pillMean.parentElement.contains(e.target)) {
      toggleMeanPopover(false);
    }
  });

  // Pill 2 & Pill 3 shortcuts
  els.pillTop.addEventListener('click', () => zoomIntoKawasan(state.kawasanRanked[0].name));
  els.pillFinding.addEventListener('click', () => openKitchenModal(2));

  // Floating bar buttons
  els.btnExplore.addEventListener('click', () => {
    if (state.mode === 'explore') return;
    state.mode = 'explore';
    state.compareA = null;
    state.compareB = null;
    resetToFullMap();
  });

  els.btnCompare.addEventListener('click', () => {
    if (state.mode === 'compare') return;
    enterCompareMode(state.zoomedKawasan || null, null);
  });

  els.btnResetMap.addEventListener('click', resetToFullMap);
  els.btnOpenKitchen.addEventListener('click', () => openKitchenModal(0));

  // Pil cepat 6 pulau
  els.quickIslandsList.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-quick-kawasan]');
    if (!chip) return;
    const name = chip.getAttribute('data-quick-kawasan');
    if (state.mode === 'explore') {
      zoomIntoKawasan(name);
    } else {
      handleComparePick(name);
    }
  });

  // Interaksi SVG Map
  const svg = state.mapContext.svg;
  svg.addEventListener('pointerdown', (e) => {
    state.isTouchPointer = e.pointerType === 'touch';
  });

  svg.addEventListener('pointermove', (e) => {
    if (state.isTouchPointer || e.pointerType === 'touch') return;
    const pathEl = e.target.closest('.province-path');
    if (!pathEl) {
      hideTooltip();
      return;
    }

    const svgId = pathEl.getAttribute('id');
    const info = state.mapContext.pathRegistry.get(svgId);
    if (!info) return;

    const isZoomed = state.mode === 'explore' && Boolean(state.zoomedKawasan);
    if (isZoomed && info.kawasan !== state.zoomedKawasan) {
      hideTooltip();
      return;
    }

    const changed = isZoomed
      ? state.hoveredSvgId !== svgId
      : state.hoveredKawasan !== info.kawasan;

    if (changed || els.mapTooltip.hidden) {
      state.hoveredKawasan = info.kawasan;
      state.hoveredSvgId = svgId;
      state.syncedProvince = isZoomed ? info.provinsi : null;
      els.mapTooltip.innerHTML = buildTooltipHtml(info);
      els.mapTooltip.hidden = false;
      updateMapVisuals();

      if (isZoomed) {
        for (const item of els.sidePanel.querySelectorAll('.prov-bar-item')) {
          item.classList.toggle('is-synced', info.provinsiGroup.includes(item.getAttribute('data-prov-name')));
        }
      }
    }
    positionTooltip(e.clientX, e.clientY);
  });

  svg.addEventListener('pointerleave', () => {
    hideTooltip();
    if (state.syncedProvince) {
      state.syncedProvince = null;
      for (const item of els.sidePanel.querySelectorAll('.prov-bar-item')) {
        item.classList.remove('is-synced');
      }
    }
  });

  svg.addEventListener('click', (e) => {
    const pathEl = e.target.closest('.province-path');
    if (!pathEl) {
      // Klik area laut kosong saat sedang zoom-in mengembalikan ke peta penuh
      if (state.mode === 'explore' && state.zoomedKawasan) {
        resetToFullMap();
      }
      return;
    }
    const info = state.mapContext.pathRegistry.get(pathEl.getAttribute('id'));
    if (!info) return;

    if (state.mode === 'explore') {
      if (state.zoomedKawasan === info.kawasan) {
        // Klik provinsi di pulau yang sedang di-zoom menyorot baris provinsinya di panel
        state.syncedProvince = info.provinsi;
        updateMapVisuals();
        for (const item of els.sidePanel.querySelectorAll('.prov-bar-item')) {
          const match = info.provinsiGroup.includes(item.getAttribute('data-prov-name'));
          item.classList.toggle('is-synced', match);
          if (match) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      } else {
        zoomIntoKawasan(info.kawasan);
      }
    } else {
      handleComparePick(info.kawasan);
    }
  });

  svg.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const pathEl = e.target.closest('.province-path');
    if (!pathEl) return;
    e.preventDefault();
    pathEl.click();
  });

  // Delegasi panel samping (Insight & Compare)
  els.sidePanel.addEventListener('click', (e) => {
    if (e.target.closest('#btn-back-indonesia')) {
      resetToFullMap();
      return;
    }
    if (e.target.closest('#btn-compare-from-insight')) {
      enterCompareMode(state.zoomedKawasan, null);
      return;
    }
    if (e.target.closest('#btn-compare-back-explore')) {
      state.mode = 'explore';
      resetToFullMap();
      return;
    }
    if (e.target.closest('#btn-try-another-pair')) {
      state.compareB = null;
      state.compareSelectTarget = 'B';
      renderComparePanel();
      updateUIState();
      state.mapContext?.resetZoom();
      return;
    }

    const pairBtn = e.target.closest('[data-compare-pair], [data-quick-pair]');
    if (pairBtn) {
      const raw = pairBtn.getAttribute('data-compare-pair') || pairBtn.getAttribute('data-quick-pair');
      const [a, b] = raw.split('::');
      enterCompareMode(a, b);
      return;
    }

    const provBtn = e.target.closest('[data-prov-name]');
    if (provBtn && state.zoomedKawasan) {
      const pName = provBtn.getAttribute('data-prov-name');
      state.syncedProvince = state.syncedProvince === pName ? null : pName;
      for (const item of els.sidePanel.querySelectorAll('.prov-bar-item')) {
        item.classList.toggle('is-synced', item.getAttribute('data-prov-name') === state.syncedProvince);
      }
      updateMapVisuals();
    }
  });

  els.sidePanel.addEventListener('change', (e) => {
    if (e.target.id === 'select-compare-a') {
      const val = e.target.value || null;
      state.compareA = val;
      if (state.compareB === val) state.compareB = null;
      state.compareSelectTarget = val && !state.compareB ? 'B' : 'A';
      renderComparePanel();
      updateUIState();
      if (state.compareA && state.compareB) state.mapContext?.zoomToPair(state.compareA, state.compareB);
    } else if (e.target.id === 'select-compare-b') {
      const val = e.target.value || null;
      state.compareB = val;
      if (state.compareA === val) state.compareA = null;
      renderComparePanel();
      updateUIState();
      if (state.compareA && state.compareB) state.mapContext?.zoomToPair(state.compareA, state.compareB);
    }
  });

  // Hover sinkron antara daftar bar provinsi di panel dan SVG saat sedang zoom
  els.sidePanel.addEventListener('pointerover', (e) => {
    if (state.isTouchPointer || state.mode !== 'explore' || !state.zoomedKawasan) return;
    const provBtn = e.target.closest('[data-prov-name]');
    if (!provBtn) return;
    const pName = provBtn.getAttribute('data-prov-name');
    if (state.syncedProvince !== pName) {
      state.syncedProvince = pName;
      updateMapVisuals();
    }
  });

  els.sidePanel.addEventListener('pointerleave', () => {
    if (state.mode === 'explore' && state.zoomedKawasan && state.syncedProvince) {
      state.syncedProvince = null;
      updateMapVisuals();
    }
  });

  // Dapur Statistik Modal 4-Tab Stepper
  els.kitchenTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.step-tab');
    if (!tab) return;
    state.kitchenStep = Number(tab.getAttribute('data-step'));
    renderKitchenStep();
  });

  els.btnStepPrev.addEventListener('click', () => {
    if (state.kitchenStep > 0) {
      state.kitchenStep -= 1;
      renderKitchenStep();
    }
  });

  els.btnStepNext.addEventListener('click', () => {
    if (state.kitchenStep < 3) {
      state.kitchenStep += 1;
      renderKitchenStep();
    } else {
      closeDialog(els.kitchenDialog);
    }
  });

  els.kitchenBody.addEventListener('click', (e) => {
    const spotBtn = e.target.closest('[data-spotlight-pair]');
    if (!spotBtn) return;
    const [a, b] = spotBtn.getAttribute('data-spotlight-pair').split('::');
    closeDialog(els.kitchenDialog);
    enterCompareMode(a, b);
  });

  els.btnCloseKitchen.addEventListener('click', () => closeDialog(els.kitchenDialog));
  els.kitchenDialog.addEventListener('click', (e) => {
    if (e.target === els.kitchenDialog) closeDialog(els.kitchenDialog);
  });

  // Modal Catatan Proyek
  els.btnProjectNote.addEventListener('click', () => {
    if (typeof els.noteDialog.showModal === 'function') els.noteDialog.showModal();
    else els.noteDialog.setAttribute('open', '');
  });
  els.btnCloseNote.addEventListener('click', () => closeDialog(els.noteDialog));
  els.btnCloseNoteFooter.addEventListener('click', () => closeDialog(els.noteDialog));
  els.noteDialog.addEventListener('click', (e) => {
    if (e.target === els.noteDialog) closeDialog(els.noteDialog);
  });

  // Escape membatalkan zoom / mode compare / menutup popover
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (els.kitchenDialog.open || els.noteDialog.open) return;
    if (!els.meanPopover.hidden) {
      toggleMeanPopover(false);
      return;
    }
    if (state.zoomedKawasan || (state.mode === 'compare' && (state.compareA || state.compareB))) {
      resetToFullMap();
    }
  });
}

function handleComparePick(kawasanName) {
  if (!state.compareA || state.compareSelectTarget === 'A') {
    if (state.compareB === kawasanName) state.compareB = null;
    state.compareA = kawasanName;
    state.compareSelectTarget = 'B';
  } else if (state.compareA === kawasanName) {
    state.compareA = null;
    state.compareSelectTarget = 'A';
  } else {
    state.compareB = kawasanName;
    state.compareSelectTarget = 'A';
  }

  renderComparePanel();
  updateUIState();

  if (state.compareA && state.compareB) {
    state.mapContext?.zoomToPair(state.compareA, state.compareB);
  } else {
    state.mapContext?.resetZoom();
  }
}

async function init() {
  try {
    const [dataResp, mapHtmlText] = await Promise.all([
      fetch('./dashboard_data.json'),
      fetchMapHtml(),
    ]);

    if (!dataResp.ok) {
      throw new Error(`Gagal membaca dashboard_data.json (HTTP ${dataResp.status}).`);
    }
    const data = await dataResp.json();
    state.data = data;
    state.audit = computeDataAudit(data);

    state.kawasanRanked = Object.entries(data.kawasan)
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => a.peringkat - b.peringkat);

    for (const region of state.kawasanRanked) {
      for (const prov of region.provinsi) {
        state.provinceLookup.set(prov.Provinsi, { ...prov, kawasan: region.name });
      }
    }

    renderHeaderAndQuickBar();

    state.mapContext = mountIndonesiaMap(els.mapHost, mapHtmlText, data.kawasan);
    els.mapLoading.hidden = true;

    updateUIState();
    bindEvents();
  } catch (err) {
    console.error(err);
    els.mapLoading.hidden = true;
    showError(err.message || 'Terjadi kesalahan saat memuat aplikasi.');
  }
}

init();
