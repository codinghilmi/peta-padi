import {
  CHOROPLETH_SCALE,
  computeDataAudit,
  formatAreaOrProd,
  formatNumber,
  formatPercent,
  formatProvinceName,
  formatPValue,
  formatSignedDelta,
  getCvInterpretation,
  getProvinceColor,
  getRegionColor,
} from './formatters.js';
import { fetchMapHtml, mountIndonesiaMap } from './mapLoader.js';

const MAX_PROGRESS_SCALE = 65;

const state = {
  data: null,
  audit: null,
  provinceLookup: new Map(),
  kawasanRanked: [],
  mapContext: null,

  mode: 'kawasan', // 'kawasan' | 'provinsi'
  selectedKawasan: null,
  focusedOpponent: null, // Jika klik pasangan signifikan spesifik (A vs B)
  selectedProvince: null, // Sorot baris provinsi saat klik di Mode Provinsi
  hoveredKawasan: null,
  hoveredSvgId: null,
  isTouchPointer: false,
};

const els = {
  headerSubtitle: document.getElementById('header-subtitle'),
  errorBanner: document.getElementById('app-error-banner'),

  kpiMeanLabel: document.getElementById('kpi-mean-label'),
  kpiMeanVal: document.getElementById('kpi-mean-val'),
  kpiMeanSub: document.getElementById('kpi-mean-sub'),
  kpiAnovaLabel: document.getElementById('kpi-anova-label'),
  kpiAnovaVal: document.getElementById('kpi-anova-val'),
  kpiAnovaBadge: document.getElementById('kpi-anova-badge'),
  kpiAnovaSub: document.getElementById('kpi-anova-sub'),
  kpiEtaVal: document.getElementById('kpi-eta-val'),
  kpiEtaSub: document.getElementById('kpi-eta-sub'),
  kpiKwLabel: document.getElementById('kpi-kw-label'),
  kpiKwVal: document.getElementById('kpi-kw-val'),
  kpiKwSub: document.getElementById('kpi-kw-sub'),

  btnModeKawasan: document.getElementById('btn-mode-kawasan'),
  btnModeProvinsi: document.getElementById('btn-mode-provinsi'),
  statusPill: document.getElementById('selection-status-pill'),
  btnReset: document.getElementById('btn-reset-selection'),

  mapStage: document.getElementById('map-stage'),
  mapLoading: document.getElementById('map-loading'),
  mapHost: document.getElementById('map-svg-host'),
  mapLegend: document.getElementById('map-legend'),
  mapTooltip: document.getElementById('map-tooltip'),

  detailPanel: document.getElementById('detail-panel'),
  footerSource: document.getElementById('footer-source'),

  btnMethodology: document.getElementById('btn-methodology'),
  methodologyDialog: document.getElementById('methodology-dialog'),
  methodologyBody: document.getElementById('methodology-body'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  btnCloseModalFooter: document.getElementById('btn-close-modal-footer'),
};

function showError(message) {
  els.errorBanner.hidden = false;
  els.errorBanner.innerHTML = `
    <strong>Gagal memuat data dashboard.</strong> ${message}
    <span class="error-hint">Pastikan halaman dijalankan melalui server HTTP lokal (misal: <code>python -m http.server 8000</code>), bukan langsung membuka file <code>file://</code>.</span>
  `;
}

function renderHeaderAndKpis() {
  const { meta, nasional } = state.data;
  const nKawasan = state.kawasanRanked.length;

  els.headerSubtitle.textContent = `Data ${meta.sumber} ${meta.tahun} • ${nasional.n_provinsi} Provinsi • ${nKawasan} Kawasan Kepulauan`;
  els.footerSource.innerHTML = `${meta.sumber} — <em>Luas Panen, Produksi, dan Produktivitas Padi Menurut Provinsi, ${meta.tahun}</em> (${meta.satuan}).`;

  // KPI 1: Rata-rata 38 Provinsi
  els.kpiMeanLabel.textContent = `Rata-rata ${nasional.n_provinsi} Provinsi`;
  els.kpiMeanVal.textContent = formatNumber(nasional.mean_provinsi, 2);
  els.kpiMeanSub.textContent = `Median ${formatNumber(nasional.median_provinsi, 2)} | Nasional BPS ${formatNumber(nasional.produktivitas_tertimbang_bps, 2)}`;

  // KPI 2: One-Way ANOVA
  els.kpiAnovaLabel.textContent = 'One-Way ANOVA (Utama)';
  els.kpiAnovaVal.textContent = `F = ${formatNumber(nasional.anova.F, 2)}`;
  const isAnovaSig = nasional.anova.p_value < 0.05;
  els.kpiAnovaBadge.textContent = isAnovaSig ? 'Signifikan α = 0,05' : 'Tidak Signifikan';
  els.kpiAnovaBadge.className = `badge ${isAnovaSig ? 'badge-success' : 'badge-neutral'}`;
  els.kpiAnovaSub.innerHTML = `<span class="mono">p = ${formatPValue(nasional.anova.p_value)}</span> • Beda antarwilayah nyata`;

  // KPI 3: Effect Size Eta Squared
  els.kpiEtaVal.textContent = formatPercent(nasional.anova.eta_sq, 1);
  const etaLevel = nasional.anova.eta_sq >= 0.14 ? 'Efek Besar' : nasional.anova.eta_sq >= 0.06 ? 'Efek Sedang' : 'Efek Kecil';
  els.kpiEtaSub.textContent = `${etaLevel} — faktor wilayah kepulauan`;

  // KPI 4: Kruskal-Wallis + Levene
  els.kpiKwVal.textContent = `H = ${formatNumber(nasional.kruskal_wallis.H, 2)}`;
  els.kpiKwSub.textContent = `p = ${formatNumber(nasional.kruskal_wallis.p_value, 4)} | ε² = ${formatPercent(nasional.kruskal_wallis.epsilon_sq, 1)} | Levene p = ${formatNumber(nasional.levene.p_value, 3)}`;
}

function renderMethodologyModal() {
  const { nasional } = state.data;
  const audit = state.audit;

  els.methodologyBody.innerHTML = `
    <ol class="method-steps">
      <li>
        <div class="method-step-head">
          <strong>1. Audit &amp; Kelengkapan Data</strong>
          <span class="badge badge-success">Valid (${audit.nProvinsi} Provinsi)</span>
        </div>
        <p>
          Sebanyak <span class="mono">${audit.nProvinsi}</span> provinsi lengkap dari BPS RI ${state.data.meta.tahun}
          (<span class="mono">${audit.missingCount}</span> missing,
          <span class="mono">${audit.extremeOutlierCount}</span> outlier ekstrem IQR,
          skewness = <span class="mono">${formatNumber(audit.skewness, 2)}</span>).
          Distribusi nasional mendekati simetris sehingga layak dianalisis dengan pendekatan parametrik.
        </p>
      </li>
      <li>
        <div class="method-step-head">
          <strong>2. Uji Asumsi Normalitas &amp; Homogenitas</strong>
          <span class="badge badge-success">Asumsi Terpenuhi</span>
        </div>
        <p>
          Seluruh <span class="mono">${state.kawasanRanked.length}</span> kawasan lolos uji normalitas
          <strong>Shapiro–Wilk</strong> (<span class="mono">p &gt; 0,05</span>; rentang
          <span class="mono">p = ${formatPValue(audit.shapiroMinP)}</span> hingga
          <span class="mono">${formatPValue(audit.shapiroMaxP)}</span>)
          dan <strong>Levene's Test</strong> (<span class="mono">F = ${formatNumber(nasional.levene.F, 4)}</span>,
          <span class="mono">p = ${formatPValue(nasional.levene.p_value)}</span>),
          sehingga varians antarwilayah terbukti homogen.
        </p>
      </li>
      <li>
        <div class="method-step-head">
          <strong>3. Pemilihan Uji Utama &amp; Uji Robustness</strong>
          <span class="badge badge-neutral">Parametrik + Non-parametrik</span>
        </div>
        <p>
          <strong>${nasional.metode_utama.replace(' (Tukey HSD)', '')}</strong>
          (<span class="mono">F = ${formatNumber(nasional.anova.F, 2)}</span>,
          <span class="mono">p = ${formatPValue(nasional.anova.p_value)}</span>,
          <span class="mono">&eta;&sup2; = ${formatNumber(nasional.anova.eta_sq, 3)}</span>)
          dipilih sebagai uji utama karena seluruh asumsi terpenuhi, didampingi
          <strong>Kruskal–Wallis</strong>
          (<span class="mono">H = ${formatNumber(nasional.kruskal_wallis.H, 2)}</span>,
          <span class="mono">p = ${formatPValue(nasional.kruskal_wallis.p_value)}</span>,
          <span class="mono">&epsilon;&sup2; = ${formatNumber(nasional.kruskal_wallis.epsilon_sq, 3)}</span>)
          sebagai uji sensitivitas karena ukuran kelompok tidak seimbang
          (<span class="mono">n = ${audit.minGroupN}</span> hingga <span class="mono">${audit.maxGroupN}</span>).
        </p>
      </li>
      <li>
        <div class="method-step-head">
          <strong>4. Uji Lanjut Post-Hoc (Tukey HSD)</strong>
          <span class="badge badge-coral">${audit.tukeyPairs.length} dari ${audit.totalPairs} Pasangan</span>
        </div>
        <p>
          Uji <strong>Tukey HSD</strong> (<span class="mono">&alpha; = 0,05</span>) mengidentifikasi
          <span class="mono">${audit.tukeyPairs.length}</span> dari <span class="mono">${audit.totalPairs}</span>
          pasangan kawasan dengan perbedaan produktivitas rata-rata yang signifikan secara statistik:
          ${audit.tukeyPairs
            .map((p) => `<strong>${p.higher} vs ${p.lower}</strong> (<span class="mono">+${formatNumber(p.selisih, 2)} ku/ha, p = ${formatPValue(p.p_adj)}</span>)`)
            .join('; ')}.
        </p>
      </li>
    </ol>
  `;
}

function renderLegend() {
  if (state.mode === 'kawasan') {
    const lowMean = state.kawasanRanked[state.kawasanRanked.length - 1].statistik.mean;
    const highMean = state.kawasanRanked[0].statistik.mean;
    const swatches = [...CHOROPLETH_SCALE]
      .map(
        (stop) =>
          `<span class="legend-swatch" style="background:${stop.color}" title="Peringkat #${stop.rank}"></span>`
      )
      .join('');

    els.mapLegend.innerHTML = `
      <div class="legend-title">Rata-rata Produktivitas Kawasan (ku/ha)</div>
      <div class="legend-scale">
        <div class="legend-swatches">${swatches}</div>
        <div class="legend-ticks mono">
          <span>${formatNumber(lowMean, 1)}</span>
          <span>${formatNumber(state.data.nasional.mean_provinsi, 1)} (Rerata)</span>
          <span>${formatNumber(highMean, 1)}</span>
        </div>
      </div>
      <div class="legend-tukey">
        <span class="legend-coral-chip" aria-hidden="true"></span>
        <span>Berbeda Signifikan (Tukey HSD, p &lt; 0,05)</span>
      </div>
    `;
  } else {
    const { minProd, maxProd } = state.audit;
    els.mapLegend.innerHTML = `
      <div class="legend-title">Produktivitas per Provinsi (ku/ha)</div>
      <div class="legend-scale">
        <div class="legend-gradient-bar"></div>
        <div class="legend-ticks mono">
          <span>${formatNumber(minProd, 1)}</span>
          <span>${formatNumber(state.data.nasional.mean_provinsi, 1)}</span>
          <span>${formatNumber(maxProd, 1)}</span>
        </div>
      </div>
      <div class="legend-note">
        Klik provinsi untuk melihat rincian kawasan; Papua &amp; Papua Barat memakai batas 34 prov.
      </div>
    `;
  }
}

function getActiveOpponentsSet() {
  if (!state.selectedKawasan) return new Set();
  if (state.focusedOpponent) {
    return new Set([state.focusedOpponent]);
  }
  const region = state.data.kawasan[state.selectedKawasan];
  return new Set((region?.beda_signifikan_tukey || []).map((item) => item.lawan));
}

function updateMapVisuals() {
  if (!state.mapContext) return;
  const { groupMap, overlayGroupMap, pathRegistry } = state.mapContext;
  const { kawasan } = state.data;
  const { minProd, maxProd } = state.audit;

  const opponents = getActiveOpponentsSet();
  const hasSelection = Boolean(state.selectedKawasan);

  // Update mode attribute pada root SVG
  state.mapContext.svg.setAttribute('data-mode', state.mode);
  state.mapContext.svg.classList.toggle('has-selection', hasSelection);

  // Update fill warna dasar setiap provinsi sesuai mode aktif
  for (const [, info] of pathRegistry.entries()) {
    const region = kawasan[info.kawasan];
    if (!region) continue;

    let fillColor = getRegionColor(region.peringkat);
    if (state.mode === 'provinsi') {
      const provObj = state.provinceLookup.get(info.provinsi);
      if (provObj) {
        fillColor = getProvinceColor(provObj.Produktivitas, minProd, maxProd);
      }
    }

    const isOpponent = state.mode === 'kawasan' && hasSelection && opponents.has(info.kawasan);
    info.element.style.fill = isOpponent ? 'url(#tukey-coral-pattern)' : fillColor;

    // Status hover/selection tingkat provinsi (Mode Provinsi)
    const isProvHovered = state.mode === 'provinsi' && state.hoveredSvgId === info.svgId;
    const isProvSelected =
      state.mode === 'provinsi' &&
      state.selectedProvince &&
      info.provinsiGroup.includes(state.selectedProvince);

    info.element.classList.toggle('is-prov-hovered', isProvHovered);
    info.element.classList.toggle('is-prov-selected', Boolean(isProvSelected));
    info.outline.classList.toggle('is-prov-hovered', isProvHovered);
    info.outline.classList.toggle('is-prov-selected', Boolean(isProvSelected));

    // Aksesibilitas label dinamis
    if (state.mode === 'kawasan') {
      info.element.setAttribute(
        'aria-label',
        `${formatProvinceName(info.provinsi)}, Kawasan ${info.kawasan}, peringkat ${region.peringkat}, rata-rata ${formatNumber(region.statistik.mean, 2)} kuintal per hektar`
      );
    } else {
      const pObj = state.provinceLookup.get(info.provinsi);
      info.element.setAttribute(
        'aria-label',
        `${formatProvinceName(info.provinsi)} (${info.kawasan}), produktivitas ${formatNumber(pObj?.Produktivitas, 2)} kuintal per hektar`
      );
    }
  }

  // Update status group kawasan (selected, tukey-opponent, dimmed, hovered)
  for (const [kawasanName, groupEl] of groupMap.entries()) {
    const isSelected = state.selectedKawasan === kawasanName;
    const isOpponent = hasSelection && opponents.has(kawasanName);
    const isDimmed = hasSelection && !isSelected && !isOpponent;
    const isHovered =
      state.mode === 'kawasan'
        ? state.hoveredKawasan === kawasanName
        : false;

    groupEl.classList.toggle('is-selected', isSelected);
    groupEl.classList.toggle('is-tukey-opponent', isOpponent);
    groupEl.classList.toggle('is-dimmed', isDimmed);
    groupEl.classList.toggle('is-hovered', isHovered);

    const overlayGroup = overlayGroupMap.get(kawasanName);
    if (overlayGroup) {
      overlayGroup.classList.toggle('is-selected', isSelected);
      overlayGroup.classList.toggle('is-tukey-opponent', isOpponent);
      overlayGroup.classList.toggle('is-hovered', isHovered);
    }
  }

  // Kontrol toolbar reset & status pill
  els.btnReset.hidden = !hasSelection && !state.selectedProvince;
  if (state.selectedKawasan) {
    const region = kawasan[state.selectedKawasan];
    els.statusPill.hidden = false;
    if (state.focusedOpponent) {
      els.statusPill.innerHTML = `Pasangan: <strong>${state.selectedKawasan}</strong> vs <strong>${state.focusedOpponent}</strong>`;
    } else {
      const nOpp = region.beda_signifikan_tukey.length;
      els.statusPill.innerHTML =
        nOpp > 0
          ? `Fokus: <strong>${state.selectedKawasan}</strong> • <span class="coral-text">${nOpp} lawan beda signifikan</span>`
          : `Fokus: <strong>${state.selectedKawasan}</strong> • Posisi menengah`;
    }
  } else {
    els.statusPill.hidden = true;
    els.statusPill.textContent = '';
  }
}

function renderDetailPanel() {
  if (!state.selectedKawasan) {
    renderOverviewPanel();
  } else {
    renderKawasanDetailPanel(state.selectedKawasan);
  }
}

function renderOverviewPanel() {
  const { kawasanRanked, audit } = state;

  const regionCardsHtml = kawasanRanked
    .map((region) => {
      const color = getRegionColor(region.peringkat);
      const cvInfo = getCvInterpretation(region.statistik.cv_persen);
      const barPct = Math.min(100, (region.statistik.mean / MAX_PROGRESS_SCALE) * 100);
      const nTukey = region.beda_signifikan_tukey.length;

      return `
        <button
          type="button"
          class="region-list-card"
          data-select-kawasan="${region.name}"
        >
          <div class="region-card-top">
            <div class="region-card-identity">
              <span class="region-swatch" style="background:${color}" aria-hidden="true"></span>
              <span class="rank-pill mono">#${region.peringkat}</span>
              <span class="region-name">${region.name}</span>
            </div>
            <div class="region-card-mean mono">
              <strong>${formatNumber(region.statistik.mean, 2)}</strong>
              <span>ku/ha</span>
            </div>
          </div>
          <div class="region-mini-bar" aria-hidden="true">
            <span class="region-mini-fill" style="width:${barPct.toFixed(1)}%; background:${color}"></span>
          </div>
          <div class="region-card-meta">
            <span>${region.statistik.n} provinsi • CV ${formatNumber(region.statistik.cv_persen, 1)}% (${cvInfo.label})</span>
            ${
              nTukey > 0
                ? `<span class="tukey-tag">${nTukey} beda nyata</span>`
                : '<span class="neutral-tag">Menengah</span>'
            }
          </div>
        </button>
      `;
    })
    .join('');

  const pairCardsHtml = audit.tukeyPairs
    .map((pair) => {
      return `
        <button
          type="button"
          class="pair-card"
          data-pair-higher="${pair.higher}"
          data-pair-lower="${pair.lower}"
        >
          <div class="pair-names">
            <span class="pair-dot is-higher" aria-hidden="true"></span>
            <strong>${pair.higher}</strong>
            <span class="pair-vs">vs</span>
            <span class="pair-dot is-lower" aria-hidden="true"></span>
            <strong>${pair.lower}</strong>
          </div>
          <div class="pair-stats mono">
            <span class="pair-diff">+${formatNumber(pair.selisih, 2)} ku/ha</span>
            <span class="pair-p">p = ${formatPValue(pair.p_adj)}</span>
          </div>
        </button>
      `;
    })
    .join('');

  els.detailPanel.innerHTML = `
    <div class="panel-header">
      <div>
        <span class="panel-kicker">Ikhtisar Nasional</span>
        <h2 class="panel-title">6 Kawasan Kepulauan</h2>
      </div>
      <span class="panel-sub-badge mono">Peringkat 1–6</span>
    </div>

    <p class="panel-intro">
      Klik pulau di peta atau pilih kartu kawasan di bawah untuk melihat metrik statistik, uji normalitas, perbandingan Tukey HSD, dan rincian 38 provinsi.
    </p>

    <div class="region-list" role="list">
      ${regionCardsHtml}
    </div>

    <section class="tukey-highlight-box" aria-label="Pasangan Berbeda Signifikan Tukey HSD">
      <div class="section-heading-row">
        <h3>${audit.tukeyPairs.length} Pasangan Berbeda Signifikan (Tukey HSD)</h3>
        <span class="alpha-chip mono">&alpha; = 0,05</span>
      </div>
      <p class="section-helper">Klik pasangan untuk menyorot perbedaan geografisnya di peta:</p>
      <div class="pair-list">
        ${pairCardsHtml}
      </div>
    </section>
  `;
}

function renderKawasanDetailPanel(kawasanName) {
  const region = state.data.kawasan[kawasanName];
  if (!region) return;

  const { nasional } = state.data;
  const stats = region.statistik;
  const deltaNat = stats.mean - nasional.mean_provinsi;
  const cvInfo = getCvInterpretation(stats.cv_persen);
  const color = getRegionColor(region.peringkat);
  const totalKawasan = state.kawasanRanked.length;

  const pairBannerHtml = state.focusedOpponent
    ? `
      <div class="pair-focus-banner">
        <div>
          <strong>Sorotan Pasangan:</strong> ${kawasanName} vs ${state.focusedOpponent}
        </div>
        <button type="button" class="link-btn" id="btn-show-all-opponents">
          Tampilkan semua lawan
        </button>
      </div>
    `
    : '';

  const tukeyHtml =
    region.beda_signifikan_tukey.length > 0
      ? `
        <div class="tukey-cards">
          ${region.beda_signifikan_tukey
            .map((item) => {
              const isHigher = item.arah === 'lebih tinggi';
              const isFocused = state.focusedOpponent === item.lawan;
              return `
                <button
                  type="button"
                  class="tukey-opponent-card ${isFocused ? 'is-focused' : ''}"
                  data-select-kawasan="${item.lawan}"
                >
                  <div class="tukey-opp-main">
                    <span class="tukey-dir ${isHigher ? 'dir-up' : 'dir-down'}">
                      ${isHigher ? 'Lebih tinggi' : 'Lebih rendah'}
                      <strong class="mono">${isHigher ? '+' : '-'}${formatNumber(item.selisih_ku_ha, 2)} ku/ha</strong>
                    </span>
                    <span class="tukey-opp-target">dibanding <strong>${item.lawan}</strong></span>
                  </div>
                  <div class="tukey-opp-meta mono">
                    <span>p-adj = ${formatPValue(item.p_adj)}</span>
                    <span class="jump-arrow" aria-hidden="true">&rarr;</span>
                  </div>
                </button>
              `;
            })
            .join('')}
        </div>
      `
      : `
        <div class="neutral-info-box">
          Tidak terdapat perbedaan rata-rata yang signifikan secara statistik terhadap kawasan lain pada &alpha; = 0,05 (posisi menengah).
        </div>
      `;

  const sortedProvinces = [...region.provinsi].sort((a, b) => b.Produktivitas - a.Produktivitas);
  const refLinePct = ((nasional.mean_provinsi / MAX_PROGRESS_SCALE) * 100).toFixed(2);

  const provinceRowsHtml = sortedProvinces
    .map((prov) => {
      const pct = Math.min(100, Math.max(0, (prov.Produktivitas / MAX_PROGRESS_SCALE) * 100));
      const isSelectedRow = state.selectedProvince === prov.Provinsi;
      const aboveAvg = prov.Produktivitas >= nasional.mean_provinsi;

      return `
        <div class="province-row ${isSelectedRow ? 'is-highlighted-row' : ''}" data-prov-row="${prov.Provinsi}">
          <div class="province-row-top">
            <span class="province-name">${formatProvinceName(prov.Provinsi)}</span>
            <span class="province-value mono">
              <strong>${formatNumber(prov.Produktivitas, 2)}</strong> ku/ha
            </span>
          </div>
          <div class="progress-track" aria-hidden="true">
            <div
              class="progress-fill ${aboveAvg ? 'is-above' : 'is-below'}"
              style="width:${pct.toFixed(2)}%"
            ></div>
            <span
              class="progress-ref-line"
              style="left:${refLinePct}%"
              title="Rata-rata 38 provinsi: ${formatNumber(nasional.mean_provinsi, 2)} ku/ha"
            ></span>
          </div>
          <div class="province-row-sub mono">
            <span>Luas Panen: ${formatAreaOrProd(prov.Luas_Panen)} ha</span>
            <span>Produksi: ${formatAreaOrProd(prov.Produksi)} ton</span>
          </div>
        </div>
      `;
    })
    .join('');

  const dobFootnoteHtml =
    kawasanName === 'Maluku & Papua'
      ? `
        <p class="dob-footnote">
          <strong>Catatan batas wilayah:</strong> Peta SVG menggunakan batas 34 provinsi (Papua &amp; Papua Barat pra-pemekaran), sedangkan analisis statistik menampilkan lengkap seluruh <strong>8 provinsi BPS ${state.data.meta.tahun}</strong> di kawasan ini termasuk 4 DOB Papua.
        </p>
      `
      : '';

  els.detailPanel.innerHTML = `
    <div class="detail-top-nav">
      <button type="button" id="btn-back-overview" class="btn-back">
        &larr; Semua Kawasan
      </button>
      <span class="rank-badge-lg" style="border-color:${color}">
        <span class="region-swatch" style="background:${color}" aria-hidden="true"></span>
        Peringkat #${region.peringkat} dari ${totalKawasan}
      </span>
    </div>

    <div class="detail-title-block">
      <h2>${kawasanName}</h2>
      <span class="mono detail-n-badge">n = ${stats.n} provinsi</span>
    </div>

    ${pairBannerHtml}

    <!-- 2x2 Grid Metrik Utama -->
    <div class="metrics-grid">
      <div class="metric-tile">
        <div class="metric-label">Rata-rata (Mean)</div>
        <div class="metric-val mono">${formatNumber(stats.mean, 2)} <small>ku/ha</small></div>
        <div class="metric-sub mono ${deltaNat >= 0 ? 'text-pos' : 'text-neg'}">
          ${formatSignedDelta(deltaNat, 2)} vs rerata ${nasional.n_provinsi} prov.
        </div>
      </div>

      <div class="metric-tile">
        <div class="metric-label">Median &amp; IQR</div>
        <div class="metric-val mono">${formatNumber(stats.median, 2)} <small>ku/ha</small></div>
        <div class="metric-sub mono">IQR ${formatNumber(stats.iqr, 2)} • SD ${formatNumber(stats.sd, 2)}</div>
      </div>

      <div class="metric-tile">
        <div class="metric-label">Rentang (Min – Max)</div>
        <div class="metric-val mono">${formatNumber(stats.min, 2)} – ${formatNumber(stats.max, 2)}</div>
        <div class="metric-sub mono">Selisih ${formatNumber(stats.max - stats.min, 2)} ku/ha</div>
      </div>

      <div class="metric-tile">
        <div class="metric-label">Koefisien Variasi (CV)</div>
        <div class="metric-val mono">${formatNumber(stats.cv_persen, 2)}%</div>
        <div class="metric-sub">
          <span class="cv-pill ${cvInfo.badgeClass}">${cvInfo.label}</span>
        </div>
      </div>
    </div>

    <!-- Validasi Asumsi Shapiro-Wilk -->
    <div class="assumption-box">
      <div class="assumption-head">
        <span class="assumption-title">Validasi Asumsi (Shapiro–Wilk)</span>
        <span class="badge ${region.shapiro_wilk.normal ? 'badge-success' : 'badge-neutral'}">
          ${region.shapiro_wilk.normal ? 'Lolos Normalitas (p > 0,05)' : 'Tidak Normal'}
        </span>
      </div>
      <div class="assumption-nums mono">
        <span>W = ${formatNumber(region.shapiro_wilk.W, 4)}</span>
        <span>p-value = ${formatPValue(region.shapiro_wilk.p_value)}</span>
      </div>
    </div>

    <!-- Hasil Uji Beda Post-Hoc (Tukey HSD) -->
    <section class="detail-section">
      <div class="section-heading-row">
        <h3>Hasil Uji Beda Post-Hoc (Tukey HSD)</h3>
      </div>
      ${tukeyHtml}
    </section>

    <!-- Rincian Provinsi -->
    <section class="detail-section">
      <div class="section-heading-row">
        <h3>Rincian Provinsi (${region.provinsi.length})</h3>
        <span class="ref-legend mono">
          <span class="ref-tick-sample" aria-hidden="true"></span>
          Rerata ${formatNumber(nasional.mean_provinsi, 2)}
        </span>
      </div>
      <div class="province-list">
        ${provinceRowsHtml}
      </div>
      ${dobFootnoteHtml}
    </section>
  `;
}

function buildTooltipHtml(pathInfo) {
  const region = state.data.kawasan[pathInfo.kawasan];
  if (!region) return '';

  if (state.mode === 'kawasan') {
    const cvInfo = getCvInterpretation(region.statistik.cv_persen);
    const nTukey = region.beda_signifikan_tukey.length;
    const tukeySummary =
      nTukey > 0
        ? `Beda signifikan dgn ${nTukey} kawasan`
        : 'Tidak beda signifikan (posisi menengah)';

    return `
      <div class="tt-head">
        <strong class="tt-title">${pathInfo.kawasan}</strong>
        <span class="tt-rank mono">#${region.peringkat}</span>
      </div>
      <div class="tt-grid mono">
        <div><span>Mean</span><strong>${formatNumber(region.statistik.mean, 2)} ku/ha</strong></div>
        <div><span>Median</span><strong>${formatNumber(region.statistik.median, 2)} ku/ha</strong></div>
        <div><span>CV Internal</span><strong>${formatNumber(region.statistik.cv_persen, 2)}% (${cvInfo.label})</strong></div>
      </div>
      <div class="tt-footer">
        <span class="tt-tukey ${nTukey > 0 ? 'is-sig' : ''}">${tukeySummary}</span>
        <span class="tt-cta">Klik untuk detail</span>
      </div>
    `;
  }

  // Mode Provinsi
  const natMean = state.data.nasional.mean_provinsi;
  const provGroup = pathInfo.provinsiGroup || [pathInfo.provinsi];

  if (provGroup.length > 1) {
    const rows = provGroup
      .map((name) => {
        const p = state.provinceLookup.get(name);
        if (!p) return '';
        const delta = p.Produktivitas - natMean;
        return `
          <div class="tt-multi-row">
            <span>${formatProvinceName(name)}</span>
            <strong class="mono">${formatNumber(p.Produktivitas, 2)} ku/ha <small>(${formatSignedDelta(delta, 2)})</small></strong>
          </div>
        `;
      })
      .join('');

    return `
      <div class="tt-head">
        <strong class="tt-title">${formatProvinceName(pathInfo.provinsi)} (+DOB)</strong>
        <span class="tt-kawasan-tag">${pathInfo.kawasan}</span>
      </div>
      <div class="tt-multi-list">${rows}</div>
      <div class="tt-footer">
        <span>Cakupan batas peta 34 prov. • Klik untuk detail kawasan</span>
      </div>
    `;
  }

  const p = state.provinceLookup.get(pathInfo.provinsi);
  if (!p) return '';
  const delta = p.Produktivitas - natMean;

  return `
    <div class="tt-head">
      <strong class="tt-title">${formatProvinceName(p.Provinsi)}</strong>
      <span class="tt-kawasan-tag">${pathInfo.kawasan}</span>
    </div>
    <div class="tt-grid mono">
      <div><span>Produktivitas</span><strong>${formatNumber(p.Produktivitas, 2)} ku/ha</strong></div>
      <div><span>vs Rerata Nas.</span><strong class="${delta >= 0 ? 'text-pos' : 'text-neg'}">${formatSignedDelta(delta, 2)} ku/ha</strong></div>
      <div><span>Luas Panen</span><strong>${formatAreaOrProd(p.Luas_Panen)} ha</strong></div>
    </div>
    <div class="tt-footer">
      <span>Klik untuk detail ${pathInfo.kawasan}</span>
    </div>
  `;
}

function positionTooltip(clientX, clientY) {
  const tooltip = els.mapTooltip;
  if (tooltip.hidden) return;

  const containerRect = els.mapStage.parentElement.getBoundingClientRect();
  const ttRect = tooltip.getBoundingClientRect();
  const offset = 14;

  let left = clientX - containerRect.left + offset;
  let top = clientY - containerRect.top + offset;

  if (left + ttRect.width > containerRect.width - 10) {
    left = clientX - containerRect.left - ttRect.width - offset;
  }
  if (top + ttRect.height > containerRect.height - 10) {
    top = clientY - containerRect.top - ttRect.height - offset;
  }

  left = Math.max(8, left);
  top = Math.max(8, top);

  tooltip.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
}

function hideTooltip() {
  els.mapTooltip.hidden = true;
  if (state.hoveredKawasan || state.hoveredSvgId) {
    state.hoveredKawasan = null;
    state.hoveredSvgId = null;
    updateMapVisuals();
  }
}

function selectKawasan(kawasanName, { focusedOpponent = null, selectedProvince = null } = {}) {
  state.selectedKawasan = kawasanName;
  state.focusedOpponent = focusedOpponent;
  state.selectedProvince = selectedProvince;
  renderDetailPanel();
  updateMapVisuals();

  if (selectedProvince) {
    const row = els.detailPanel.querySelector(`[data-prov-row="${CSS.escape(selectedProvince)}"]`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function resetSelection() {
  state.selectedKawasan = null;
  state.focusedOpponent = null;
  state.selectedProvince = null;
  renderDetailPanel();
  updateMapVisuals();
}

function setMode(nextMode) {
  if (state.mode === nextMode) return;
  state.mode = nextMode;
  state.hoveredKawasan = null;
  state.hoveredSvgId = null;
  els.mapTooltip.hidden = true;

  const isKawasan = nextMode === 'kawasan';
  els.btnModeKawasan.classList.toggle('is-active', isKawasan);
  els.btnModeKawasan.setAttribute('aria-selected', String(isKawasan));
  els.btnModeProvinsi.classList.toggle('is-active', !isKawasan);
  els.btnModeProvinsi.setAttribute('aria-selected', String(!isKawasan));

  renderLegend();
  updateMapVisuals();
}

function bindEvents() {
  // Segmented mode toggle
  els.btnModeKawasan.addEventListener('click', () => setMode('kawasan'));
  els.btnModeProvinsi.addEventListener('click', () => setMode('provinsi'));
  els.btnReset.addEventListener('click', resetSelection);

  // Interaksi peta via event delegation (anti-flicker saat pindah antarprovinsi)
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

    const hoverChanged =
      state.mode === 'kawasan'
        ? state.hoveredKawasan !== info.kawasan
        : state.hoveredSvgId !== svgId;

    if (hoverChanged || els.mapTooltip.hidden) {
      state.hoveredKawasan = info.kawasan;
      state.hoveredSvgId = svgId;
      els.mapTooltip.innerHTML = buildTooltipHtml(info);
      els.mapTooltip.hidden = false;
      updateMapVisuals();
    }

    positionTooltip(e.clientX, e.clientY);
  });

  svg.addEventListener('pointerleave', () => {
    hideTooltip();
  });

  svg.addEventListener('click', (e) => {
    const pathEl = e.target.closest('.province-path');
    if (!pathEl) return;
    const svgId = pathEl.getAttribute('id');
    const info = state.mapContext.pathRegistry.get(svgId);
    if (!info) return;

    if (state.mode === 'kawasan') {
      if (state.selectedKawasan === info.kawasan && !state.focusedOpponent) {
        resetSelection();
      } else {
        selectKawasan(info.kawasan);
      }
    } else {
      selectKawasan(info.kawasan, { selectedProvince: info.provinsi });
    }
  });

  svg.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const pathEl = e.target.closest('.province-path');
    if (!pathEl) return;
    e.preventDefault();
    pathEl.click();
  });

  // Delegasi klik & hover preview pada Panel Detail Samping
  els.detailPanel.addEventListener('click', (e) => {
    const backBtn = e.target.closest('#btn-back-overview');
    if (backBtn) {
      resetSelection();
      return;
    }

    const showAllBtn = e.target.closest('#btn-show-all-opponents');
    if (showAllBtn && state.selectedKawasan) {
      selectKawasan(state.selectedKawasan);
      return;
    }

    const pairBtn = e.target.closest('[data-pair-higher]');
    if (pairBtn) {
      const higher = pairBtn.getAttribute('data-pair-higher');
      const lower = pairBtn.getAttribute('data-pair-lower');
      if (state.mode !== 'kawasan') setMode('kawasan');
      selectKawasan(higher, { focusedOpponent: lower });
      return;
    }

    const regionBtn = e.target.closest('[data-select-kawasan]');
    if (regionBtn) {
      const targetKawasan = regionBtn.getAttribute('data-select-kawasan');
      selectKawasan(targetKawasan);
    }
  });

  els.detailPanel.addEventListener('pointerover', (e) => {
    if (state.mode !== 'kawasan' || state.isTouchPointer) return;
    const regionBtn = e.target.closest('[data-select-kawasan]');
    if (!regionBtn) return;
    const targetKawasan = regionBtn.getAttribute('data-select-kawasan');
    if (state.hoveredKawasan !== targetKawasan) {
      state.hoveredKawasan = targetKawasan;
      updateMapVisuals();
    }
  });

  els.detailPanel.addEventListener('pointerleave', () => {
    if (state.hoveredKawasan) {
      state.hoveredKawasan = null;
      updateMapVisuals();
    }
  });

  // Modal Metodologi
  els.btnMethodology.addEventListener('click', () => {
    if (typeof els.methodologyDialog.showModal === 'function') {
      els.methodologyDialog.showModal();
    } else {
      els.methodologyDialog.setAttribute('open', '');
    }
  });

  const closeModal = () => {
    if (typeof els.methodologyDialog.close === 'function') {
      els.methodologyDialog.close();
    } else {
      els.methodologyDialog.removeAttribute('open');
    }
  };

  els.btnCloseModal.addEventListener('click', closeModal);
  els.btnCloseModalFooter.addEventListener('click', closeModal);
  els.methodologyDialog.addEventListener('click', (e) => {
    if (e.target === els.methodologyDialog) {
      closeModal();
    }
  });

  // Tombol Escape membatalkan pilihan kawasan aktif (jika modal tidak terbuka)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (els.methodologyDialog.open) return;
      if (state.selectedKawasan || state.selectedProvince) {
        resetSelection();
      }
    }
  });
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

    // Urutkan 6 kawasan berdasarkan peringkat 1-6
    state.kawasanRanked = Object.entries(data.kawasan)
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => a.peringkat - b.peringkat);

    // Indeks cepat untuk lookup 38 provinsi
    for (const region of state.kawasanRanked) {
      for (const prov of region.provinsi) {
        state.provinceLookup.set(prov.Provinsi, {
          ...prov,
          kawasan: region.name,
        });
      }
    }

    renderHeaderAndKpis();
    renderMethodologyModal();
    renderLegend();
    renderDetailPanel();

    // Rakit peta SVG Indonesia
    const kawasanOrder = state.kawasanRanked.map((r) => r.name);
    state.mapContext = mountIndonesiaMap(els.mapHost, mapHtmlText, { kawasanOrder });
    els.mapLoading.hidden = true;

    updateMapVisuals();
    bindEvents();
  } catch (err) {
    console.error(err);
    els.mapLoading.hidden = true;
    showError(err.message || 'Terjadi kesalahan saat inisialisasi aplikasi.');
  }
}

init();
