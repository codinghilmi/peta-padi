/**
 * Loader dan pengelompok SVG peta Indonesia dari ./maps/indonesia.html
 * beserta pemetaan resmi 34 geometri SVG -> 38 provinsi BPS 2024 & 6 kawasan.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Pemetaan resmi ID SVG (format 34 provinsi di maps/indonesia.html)
 * ke 6 kawasan & nama provinsi BPS 2024 pada dashboard_data.json.
 * Untuk Papua & Papua Barat (sebelum DOB), `provinsiGroup` menyimpan
 * seluruh provinsi BPS 2024 yang tercakup secara geografis.
 */
export const SVG_PROVINCE_MAP = {
  'ID-AC': { kawasan: 'Sumatera', provinsi: 'ACEH', provinsiGroup: ['ACEH'] },
  'ID-SU': { kawasan: 'Sumatera', provinsi: 'SUMATERA UTARA', provinsiGroup: ['SUMATERA UTARA'] },
  'ID-SB': { kawasan: 'Sumatera', provinsi: 'SUMATERA BARAT', provinsiGroup: ['SUMATERA BARAT'] },
  'ID-RI': { kawasan: 'Sumatera', provinsi: 'RIAU', provinsiGroup: ['RIAU'] },
  'ID-JA': { kawasan: 'Sumatera', provinsi: 'JAMBI', provinsiGroup: ['JAMBI'] },
  'ID-SS': { kawasan: 'Sumatera', provinsi: 'SUMATERA SELATAN', provinsiGroup: ['SUMATERA SELATAN'] },
  'ID-BE': { kawasan: 'Sumatera', provinsi: 'BENGKULU', provinsiGroup: ['BENGKULU'] },
  'ID-LA': { kawasan: 'Sumatera', provinsi: 'LAMPUNG', provinsiGroup: ['LAMPUNG'] },
  'ID-BB': { kawasan: 'Sumatera', provinsi: 'KEP. BANGKA BELITUNG', provinsiGroup: ['KEP. BANGKA BELITUNG'] },
  'ID-KR': { kawasan: 'Sumatera', provinsi: 'KEP. RIAU', provinsiGroup: ['KEP. RIAU'] },

  'ID-JK': { kawasan: 'Jawa', provinsi: 'DKI JAKARTA', provinsiGroup: ['DKI JAKARTA'] },
  'ID-JB': { kawasan: 'Jawa', provinsi: 'JAWA BARAT', provinsiGroup: ['JAWA BARAT'] },
  'ID-JT': { kawasan: 'Jawa', provinsi: 'JAWA TENGAH', provinsiGroup: ['JAWA TENGAH'] },
  'ID-YO': { kawasan: 'Jawa', provinsi: 'DI YOGYAKARTA', provinsiGroup: ['DI YOGYAKARTA'] },
  'ID-JI': { kawasan: 'Jawa', provinsi: 'JAWA TIMUR', provinsiGroup: ['JAWA TIMUR'] },
  'ID-BT': { kawasan: 'Jawa', provinsi: 'BANTEN', provinsiGroup: ['BANTEN'] },

  'ID-BA': { kawasan: 'Bali & Nusra', provinsi: 'BALI', provinsiGroup: ['BALI'] },
  'ID-NB': { kawasan: 'Bali & Nusra', provinsi: 'NUSA TENGGARA BARAT', provinsiGroup: ['NUSA TENGGARA BARAT'] },
  'ID-NT': { kawasan: 'Bali & Nusra', provinsi: 'NUSA TENGGARA TIMUR', provinsiGroup: ['NUSA TENGGARA TIMUR'] },

  'ID-KB': { kawasan: 'Kalimantan', provinsi: 'KALIMANTAN BARAT', provinsiGroup: ['KALIMANTAN BARAT'] },
  'ID-KT': { kawasan: 'Kalimantan', provinsi: 'KALIMANTAN TENGAH', provinsiGroup: ['KALIMANTAN TENGAH'] },
  'ID-KS': { kawasan: 'Kalimantan', provinsi: 'KALIMANTAN SELATAN', provinsiGroup: ['KALIMANTAN SELATAN'] },
  'ID-KI': { kawasan: 'Kalimantan', provinsi: 'KALIMANTAN TIMUR', provinsiGroup: ['KALIMANTAN TIMUR'] },
  'ID-KU': { kawasan: 'Kalimantan', provinsi: 'KALIMANTAN UTARA', provinsiGroup: ['KALIMANTAN UTARA'] },

  'ID-SA': { kawasan: 'Sulawesi', provinsi: 'SULAWESI UTARA', provinsiGroup: ['SULAWESI UTARA'] },
  'ID-ST': { kawasan: 'Sulawesi', provinsi: 'SULAWESI TENGAH', provinsiGroup: ['SULAWESI TENGAH'] },
  'ID-SN': { kawasan: 'Sulawesi', provinsi: 'SULAWESI SELATAN', provinsiGroup: ['SULAWESI SELATAN'] },
  'ID-SG': { kawasan: 'Sulawesi', provinsi: 'SULAWESI TENGGARA', provinsiGroup: ['SULAWESI TENGGARA'] },
  'ID-GO': { kawasan: 'Sulawesi', provinsi: 'GORONTALO', provinsiGroup: ['GORONTALO'] },
  'ID-SR': { kawasan: 'Sulawesi', provinsi: 'SULAWESI BARAT', provinsiGroup: ['SULAWESI BARAT'] },

  'ID-MA': { kawasan: 'Maluku & Papua', provinsi: 'MALUKU', provinsiGroup: ['MALUKU'] },
  'ID-MU': { kawasan: 'Maluku & Papua', provinsi: 'MALUKU UTARA', provinsiGroup: ['MALUKU UTARA'] },
  'ID-PB': {
    kawasan: 'Maluku & Papua',
    provinsi: 'PAPUA BARAT',
    provinsiGroup: ['PAPUA BARAT', 'PAPUA BARAT DAYA'],
  },
  'ID-PA': {
    kawasan: 'Maluku & Papua',
    provinsi: 'PAPUA',
    provinsiGroup: ['PAPUA SELATAN', 'PAPUA PEGUNUNGAN', 'PAPUA', 'PAPUA TENGAH'],
  },
};

const DEFAULT_KAWASAN_ORDER = [
  'Jawa',
  'Bali & Nusra',
  'Sulawesi',
  'Sumatera',
  'Maluku & Papua',
  'Kalimantan',
];

function createSvgElement(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, String(val));
  }
  return el;
}

/**
 * Mengambil dan mem-parsing teks HTML dari ./maps/indonesia.html.
 */
export async function fetchMapHtml() {
  const response = await fetch('./maps/indonesia.html');
  if (!response.ok) {
    throw new Error(`Gagal memuat aset peta (HTTP ${response.status}).`);
  }
  return response.text();
}

/**
 * Merakit seluruh path 34 provinsi dari HTML peta menjadi kanvas <svg> terpadu,
 * mengelompokkannya ke dalam <g class="kawasan-group" data-kawasan="...">,
 * membuat layer outline anti-flicker, dan menyesuaikan viewBox ketat.
 */
export function mountIndonesiaMap(hostElement, htmlText, { kawasanOrder = DEFAULT_KAWASAN_ORDER } = {}) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  const sourceSvg = doc.querySelector('svg');
  if (!sourceSvg) {
    throw new Error('Elemen <svg> tidak ditemukan di ./maps/indonesia.html.');
  }

  const rawPaths = Array.from(sourceSvg.querySelectorAll('path[id]'));
  if (rawPaths.length === 0) {
    throw new Error('Tidak ada elemen <path> provinsi di dalam SVG peta.');
  }

  const svg = createSvgElement('svg', {
    id: 'indonesia-map',
    class: 'indonesia-map-svg',
    viewBox: '-10 20 812 307',
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': 'Peta Choropleth Produktivitas Padi Indonesia 2024 per Wilayah Kepulauan',
  });

  // Definisi pattern editorial oranye-bata untuk menandai lawan signifikan Tukey HSD
  const defs = createSvgElement('defs');
  const pattern = createSvgElement('pattern', {
    id: 'tukey-coral-pattern',
    width: '6',
    height: '6',
    patternUnits: 'userSpaceOnUse',
    patternTransform: 'rotate(45)',
  });
  pattern.appendChild(
    createSvgElement('rect', {
      width: '6',
      height: '6',
      fill: '#F6DFD7',
    })
  );
  pattern.appendChild(
    createSvgElement('line', {
      x1: '0',
      y1: '0',
      x2: '0',
      y2: '6',
      stroke: '#C85A32',
      'stroke-width': '1.6',
      'stroke-opacity': '0.55',
    })
  );
  defs.appendChild(pattern);
  svg.appendChild(defs);

  // Kelompokkan path ke <g class="kawasan-group" data-kawasan="...">
  const groupMap = new Map();
  const overlayGroupMap = new Map();
  const pathRegistry = new Map();
  const outlineRegistry = new Map();

  for (const kawasan of kawasanOrder) {
    const g = createSvgElement('g', {
      class: 'kawasan-group',
      'data-kawasan': kawasan,
    });
    groupMap.set(kawasan, g);
    svg.appendChild(g);
  }

  const overlayLayer = createSvgElement('g', {
    id: 'map-overlay-layer',
    class: 'map-overlay-layer',
    'pointer-events': 'none',
    'aria-hidden': 'true',
  });

  for (const kawasan of kawasanOrder) {
    const og = createSvgElement('g', {
      class: 'kawasan-outline-group',
      'data-kawasan': kawasan,
    });
    overlayGroupMap.set(kawasan, og);
    overlayLayer.appendChild(og);
  }

  for (const rawPath of rawPaths) {
    const svgId = rawPath.getAttribute('id');
    const d = rawPath.getAttribute('d');
    const mapping = SVG_PROVINCE_MAP[svgId];
    if (!mapping || !d) continue;

    const pathEl = createSvgElement('path', {
      id: svgId,
      d,
      class: 'province-path',
      'data-provinsi': mapping.provinsi,
      'data-kawasan': mapping.kawasan,
      'data-svg-title': rawPath.getAttribute('title') || mapping.provinsi,
      tabindex: '0',
      role: 'button',
    });

    const targetGroup = groupMap.get(mapping.kawasan);
    targetGroup.appendChild(pathEl);

    // Kloning path khusus outline stroke di layer atas agar hover/select bebas flicker
    const outlineEl = createSvgElement('path', {
      d,
      class: 'province-outline',
      'data-provinsi': mapping.provinsi,
      'data-kawasan': mapping.kawasan,
      fill: 'none',
    });
    overlayGroupMap.get(mapping.kawasan).appendChild(outlineEl);

    pathRegistry.set(svgId, {
      element: pathEl,
      outline: outlineEl,
      svgId,
      ...mapping,
    });
    outlineRegistry.set(svgId, outlineEl);
  }

  svg.appendChild(overlayLayer);
  hostElement.replaceChildren(svg);

  // Hitung bounding box aktual seluruh pulau agar peta memenuhi kanvas tanpa ruang kosong berlebih
  try {
    const bbox = svg.getBBox();
    if (bbox && bbox.width > 0 && bbox.height > 0) {
      const padX = 10;
      const padY = 10;
      svg.setAttribute(
        'viewBox',
        `${(bbox.x - padX).toFixed(2)} ${(bbox.y - padY).toFixed(2)} ${(bbox.width + padX * 2).toFixed(2)} ${(bbox.height + padY * 2).toFixed(2)}`
      );
    }
  } catch {
    // Tetap gunakan viewBox fallback yang sudah terkalibrasi
  }

  return {
    svg,
    groupMap,
    overlayGroupMap,
    pathRegistry,
    outlineRegistry,
    mappedCount: pathRegistry.size,
  };
}
