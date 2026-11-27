/**
 * Helper pemformatan angka Indonesia (id-ID), pewarnaan choropleth,
 * dan kalkulasi statistik turunan dari dashboard_data.json.
 */

export const CHOROPLETH_SCALE = [
  { rank: 6, color: '#D8EAE6', textColor: '#1E293B' },
  { rank: 5, color: '#B2D6CE', textColor: '#1E293B' },
  { rank: 4, color: '#7CB8AC', textColor: '#1E293B' },
  { rank: 3, color: '#4D9A8E', textColor: '#FFFFFF' },
  { rank: 2, color: '#2A7B6F', textColor: '#FFFFFF' },
  { rank: 1, color: '#1B4D3E', textColor: '#FFFFFF' },
];

const RANK_COLOR_MAP = new Map(CHOROPLETH_SCALE.map((item) => [item.rank, item.color]));
const RAMP_RGB = CHOROPLETH_SCALE.map((item) => hexToRgb(item.color));

const ACRONYMS = new Set(['DKI', 'DI']);
const ABBREVIATIONS = {
  'KEP.': 'Kep.',
  'NTB': 'NTB',
  'NTT': 'NTT',
};

const nfCache = new Map();

function getFormatter(minFrac, maxFrac) {
  const key = `${minFrac}:${maxFrac}`;
  if (!nfCache.has(key)) {
    nfCache.set(
      key,
      new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: minFrac,
        maximumFractionDigits: maxFrac,
      })
    );
  }
  return nfCache.get(key);
}

export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return getFormatter(decimals, decimals).format(Number(value));
}

export function formatPercent(ratio, decimals = 1) {
  if (ratio === null || ratio === undefined || Number.isNaN(Number(ratio))) {
    return '—';
  }
  return `${formatNumber(Number(ratio) * 100, decimals)}%`;
}

export function formatSignedDelta(delta, decimals = 2) {
  if (delta === null || delta === undefined || Number.isNaN(Number(delta))) {
    return '—';
  }
  const num = Number(delta);
  const sign = num > 0 ? '+' : num < 0 ? '-' : '';
  return `${sign}${formatNumber(Math.abs(num), decimals)}`;
}

export function formatAreaOrProd(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  const num = Number(value);
  if (Math.abs(num) < 100) {
    return getFormatter(0, 2).format(num);
  }
  return getFormatter(0, 0).format(Math.round(num));
}

export function formatPValue(p) {
  if (p === null || p === undefined || Number.isNaN(Number(p))) {
    return '—';
  }
  const num = Number(p);
  if (num < 0.0001) {
    return '< 0,0001';
  }
  return formatNumber(num, 4);
}

export function formatProvinceName(rawName) {
  if (!rawName) return '';
  return String(rawName)
    .trim()
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      if (ABBREVIATIONS[upper]) return ABBREVIATIONS[upper];
      return upper.charAt(0) + upper.slice(1).toLowerCase();
    })
    .join(' ');
}

export function getCvInterpretation(cvPersen) {
  const cv = Number(cvPersen);
  if (cv < 10) {
    return { label: 'Merata', badgeClass: 'cv-low' };
  }
  if (cv <= 15) {
    return { label: 'Moderat', badgeClass: 'cv-mid' };
  }
  return { label: 'Timpang Internal', badgeClass: 'cv-high' };
}

export function getRegionColor(peringkat) {
  return RANK_COLOR_MAP.get(Number(peringkat)) || '#CBD5E1';
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const int = parseInt(clean, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function rgbToHex([r, g, b]) {
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Interpolasi warna linier pada skala 6-warna agraria untuk Mode Provinsi.
 */
export function getProvinceColor(value, minVal, maxVal) {
  if (maxVal <= minVal) return RAMP_RGB[3];
  const t = Math.max(0, Math.min(1, (Number(value) - minVal) / (maxVal - minVal)));
  const scaled = t * (RAMP_RGB.length - 1);
  const idx = Math.min(RAMP_RGB.length - 2, Math.floor(scaled));
  const frac = scaled - idx;
  const c0 = RAMP_RGB[idx];
  const c1 = RAMP_RGB[idx + 1];
  return rgbToHex([
    c0[0] + (c1[0] - c0[0]) * frac,
    c0[1] + (c1[1] - c0[1]) * frac,
    c0[2] + (c1[2] - c0[2]) * frac,
  ]);
}

function quantileSorted(sorted, q) {
  const pos = q * (sorted.length - 1);
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

/**
 * Menghitung ringkasan audit data & daftar pasangan signifikan Tukey HSD
 * secara dinamis langsung dari dashboard_data.json.
 */
export function computeDataAudit(data) {
  const entries = Object.entries(data.kawasan || {});
  const allProvinces = [];
  let missingCount = 0;

  for (const [kawasanName, region] of entries) {
    for (const prov of region.provinsi || []) {
      if (
        prov.Produktivitas === null ||
        prov.Produktivitas === undefined ||
        Number.isNaN(Number(prov.Produktivitas))
      ) {
        missingCount += 1;
      } else {
        allProvinces.push({ ...prov, kawasan: kawasanName });
      }
    }
  }

  const values = allProvinces.map((p) => Number(p.Produktivitas));
  const n = values.length;
  const mean = values.reduce((acc, v) => acc + v, 0) / n;
  const sdSample = Math.sqrt(values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1));
  const skewness =
    (n / ((n - 1) * (n - 2))) *
    values.reduce((acc, v) => acc + ((v - mean) / sdSample) ** 3, 0);

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantileSorted(sorted, 0.25);
  const q3 = quantileSorted(sorted, 0.75);
  const iqr = q3 - q1;
  const iqrOutlierCount = sorted.filter((v) => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length;
  const extremeOutlierCount = sorted.filter((v) => v < q1 - 3 * iqr || v > q3 + 3 * iqr).length;

  const shapiroPs = entries.map(([, r]) => Number(r.shapiro_wilk.p_value));
  const groupSizes = entries.map(([, r]) => Number(r.statistik.n));

  // Deduplikasi pasangan signifikan Tukey HSD (urutkan yang mean lebih tinggi sebagai sisi kiri)
  const pairSeen = new Set();
  const tukeyPairs = [];
  for (const [kawasanName, region] of entries) {
    for (const diff of region.beda_signifikan_tukey || []) {
      const oppName = diff.lawan;
      const oppRegion = data.kawasan[oppName];
      if (!oppRegion) continue;
      const pairKey = [kawasanName, oppName].sort().join('::');
      if (pairSeen.has(pairKey)) continue;
      pairSeen.add(pairKey);

      const leftIsHigher = region.statistik.mean >= oppRegion.statistik.mean;
      const higher = leftIsHigher ? kawasanName : oppName;
      const lower = leftIsHigher ? oppName : kawasanName;

      tukeyPairs.push({
        higher,
        lower,
        selisih: Number(diff.selisih_ku_ha),
        p_adj: Number(diff.p_adj),
      });
    }
  }

  tukeyPairs.sort((a, b) => b.selisih - a.selisih);

  return {
    nProvinsi: n,
    minProd: sorted[0],
    maxProd: sorted[sorted.length - 1],
    missingCount,
    skewness,
    iqrOutlierCount,
    extremeOutlierCount,
    shapiroMinP: Math.min(...shapiroPs),
    shapiroMaxP: Math.max(...shapiroPs),
    allNormal: entries.every(([, r]) => r.shapiro_wilk?.normal),
    minGroupN: Math.min(...groupSizes),
    maxGroupN: Math.max(...groupSizes),
    totalPairs: (entries.length * (entries.length - 1)) / 2,
    tukeyPairs,
    allProvinces,
  };
}
