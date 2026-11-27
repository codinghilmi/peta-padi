/**
 * Helper pemformatan Indonesia (id-ID), palet Tier Stabilo,
 * gradasi internal pulau saat zoom, serta cerita & interpretasi awam.
 */

export const TIER_CONFIG = {
  1: {
    id: 1,
    label: 'Tier 1: Tinggi',
    badgeClass: 'tier-1-badge',
    border: '#2E8500',
    highlight: '#A7F3D0',
    ramp: ['#A7F3D0', '#34D399', '#58CC02'],
    byRank: { 1: '#58CC02', 2: '#34D399' },
  },
  2: {
    id: 2,
    label: 'Tier 2: Menengah',
    badgeClass: 'tier-2-badge',
    border: '#CA8A04',
    highlight: '#FEF08A',
    ramp: ['#FEF9C3', '#FDE047', '#F59E0B'],
    byRank: { 3: '#FACC15', 4: '#FDE047' },
  },
  3: {
    id: 3,
    label: 'Tier 3: Rendah',
    badgeClass: 'tier-3-badge',
    border: '#E11D48',
    highlight: '#FFE4E6',
    ramp: ['#FFE4E6', '#FDA4AF', '#FB7185'],
    byRank: { 5: '#FDA4AF', 6: '#FB7185' },
  },
};

const ACRONYMS = new Set(['DKI', 'DI']);
const ABBREVIATIONS = { 'KEP.': 'Kep.', NTB: 'NTB', NTT: 'NTT' };
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
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return getFormatter(decimals, decimals).format(Number(value));
}

export function formatPercent(ratio, decimals = 1) {
  if (ratio === null || ratio === undefined || Number.isNaN(Number(ratio))) return '—';
  return `${formatNumber(Number(ratio) * 100, decimals)}%`;
}

export function formatSignedDelta(delta, decimals = 2) {
  if (delta === null || delta === undefined || Number.isNaN(Number(delta))) return '—';
  const num = Number(delta);
  const sign = num > 0 ? '+' : num < 0 ? '-' : '';
  return `${sign}${formatNumber(Math.abs(num), decimals)}`;
}

export function formatAreaOrProd(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const num = Number(value);
  return Math.abs(num) < 100
    ? getFormatter(0, 2).format(num)
    : getFormatter(0, 0).format(Math.round(num));
}

export function formatPValue(p) {
  if (p === null || p === undefined || Number.isNaN(Number(p))) return '—';
  const num = Number(p);
  return num < 0.0001 ? '< 0,0001' : formatNumber(num, 4);
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

export function getTierForRank(peringkat) {
  const rank = Number(peringkat);
  if (rank <= 2) return 1;
  if (rank <= 4) return 2;
  return 3;
}

export function getRegionFillColor(peringkat) {
  const tier = getTierForRank(peringkat);
  return TIER_CONFIG[tier].byRank[Number(peringkat)] || TIER_CONFIG[tier].ramp[1];
}

export function getRankMedal(peringkat) {
  const r = Number(peringkat);
  if (r === 1) return '🥇 #1';
  if (r === 2) return '🥈 #2';
  if (r === 3) return '🥉 #3';
  return `📍 #${r}`;
}

export function getCvFriendlyBadge(cvPersen) {
  const cv = Number(cvPersen);
  if (cv < 10) return { label: 'Sangat Merata 🟢', short: 'Merata' };
  if (cv <= 15) return { label: 'Cukup Merata 🟡', short: 'Moderat' };
  return { label: 'Cukup Jomplang 🟠', short: 'Timpang' };
}

function hexToRgb(hex) {
  const int = parseInt(hex.replace('#', ''), 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function rgbToHex([r, g, b]) {
  const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Menghasilkan gradasi internal yang cerah namun mudah dibedakan saat pulau di-zoom.
 */
export function getInternalProvinceColor(value, minVal, maxVal, peringkat) {
  const tier = getTierForRank(peringkat);
  const stops = TIER_CONFIG[tier].ramp.map(hexToRgb);
  if (maxVal <= minVal) return rgbToHex(stops[1]);
  const t = Math.max(0, Math.min(1, (Number(value) - minVal) / (maxVal - minVal)));
  const scaled = t * (stops.length - 1);
  const idx = Math.min(stops.length - 2, Math.floor(scaled));
  const frac = scaled - idx;
  const c0 = stops[idx];
  const c1 = stops[idx + 1];
  return rgbToHex([
    c0[0] + (c1[0] - c0[0]) * frac,
    c0[1] + (c1[1] - c0[1]) * frac,
    c0[2] + (c1[2] - c0[2]) * frac,
  ]);
}

/**
 * Membangun cerita 1-2 kalimat berbahasa awam secara dinamis dari data kawasan.
 */
export function buildRegionStory(kawasanName, region, nasional) {
  const meanStr = formatNumber(region.statistik.mean, 2);
  const topProv = [...region.provinsi].sort((a, b) => b.Produktivitas - a.Produktivitas)[0];
  const topName = formatProvinceName(topProv.Provinsi);
  const topVal = formatNumber(topProv.Produktivitas, 2);
  const diffs = region.beda_signifikan_tukey || [];

  if (region.peringkat === 1) {
    const oppNames = diffs.map((d) => d.lawan).join(' dan ');
    return `${kawasanName} memimpin produktivitas nasional. Rata-rata 1 hektar sawah di sini menghasilkan ${meanStr} kuintal gabah—jauh melampaui ${oppNames}.`;
  }
  if (region.peringkat === 2) {
    return `${kawasanName} menempel ketat di posisi kedua (${meanStr} ku/ha), didorong oleh performa unggul ${topName} (${topVal} ku/ha) meski sebaran antarprovinsinya masih cukup bervariasi.`;
  }
  if (diffs.length === 0 && region.statistik.cv_persen < 10) {
    return `${kawasanName} berada di kelompok menengah (${meanStr} ku/ha) dengan kualitas panen paling merata antarprovinsi (dipimpin ${topName} di ${topVal} ku/ha).`;
  }
  if (diffs.length === 0) {
    return `${kawasanName} mencatat rata-rata ${meanStr} ku/ha, namun jurang antarprovinsinya lebar: dari ${topName} (${topVal} ku/ha) hingga ${formatNumber(region.statistik.min, 2)} ku/ha.`;
  }
  if (region.peringkat === 5) {
    return `${kawasanName} mencatat rata-rata ${meanStr} ku/ha (${formatNumber(nasional.mean_provinsi - region.statistik.mean, 2)} ku/ha di bawah rerata provinsi), dengan capaian tertinggi di ${topName} (${topVal} ku/ha).`;
  }
  return `${kawasanName} memiliki rata-rata terendah secara nasional (${meanStr} ku/ha) dan terbukti tertinggal signifikan dibanding kawasan utama di Jawa serta Bali & Nusra.`;
}

function quantileSorted(sorted, q) {
  const pos = q * (sorted.length - 1);
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

export function computeDataAudit(data) {
  const entries = Object.entries(data.kawasan || {});
  const allProvinces = [];
  let missingCount = 0;

  for (const [kawasanName, region] of entries) {
    for (const prov of region.provinsi || []) {
      if (prov.Produktivitas === null || prov.Produktivitas === undefined || Number.isNaN(Number(prov.Produktivitas))) {
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
  const extremeOutlierCount = sorted.filter((v) => v < q1 - 3 * iqr || v > q3 + 3 * iqr).length;

  const shapiroPs = entries.map(([, r]) => Number(r.shapiro_wilk.p_value));
  const groupSizes = entries.map(([, r]) => Number(r.statistik.n));

  const pairSeen = new Set();
  const tukeyPairs = [];
  for (const [kawasanName, region] of entries) {
    for (const diff of region.beda_signifikan_tukey || []) {
      const oppName = diff.lawan;
      const oppRegion = data.kawasan[oppName];
      if (!oppRegion) continue;
      const key = [kawasanName, oppName].sort().join('::');
      if (pairSeen.has(key)) continue;
      pairSeen.add(key);

      const leftHigher = region.statistik.mean >= oppRegion.statistik.mean;
      tukeyPairs.push({
        higher: leftHigher ? kawasanName : oppName,
        lower: leftHigher ? oppName : kawasanName,
        selisih: Number(diff.selisih_ku_ha),
        p_adj: Number(diff.p_adj),
      });
    }
  }
  tukeyPairs.sort((a, b) => b.selisih - a.selisih);

  return {
    nProvinsi: n,
    missingCount,
    skewness,
    extremeOutlierCount,
    shapiroMinP: Math.min(...shapiroPs),
    shapiroMaxP: Math.max(...shapiroPs),
    minGroupN: Math.min(...groupSizes),
    maxGroupN: Math.max(...groupSizes),
    totalPairs: (entries.length * (entries.length - 1)) / 2,
    tukeyPairs,
  };
}
