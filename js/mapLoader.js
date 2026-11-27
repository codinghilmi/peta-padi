/**
 * Loader peta SVG Indonesia dari ./maps/indonesia.html, pengelompokan 6 kawasan,
 * layer outline, layer garis lengkung Bandingkan 2 Pulau, dan animasi zoom viewBox.
 */

import { getTierForRank } from './formatters.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

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
  'ID-PB': { kawasan: 'Maluku & Papua', provinsi: 'PAPUA BARAT', provinsiGroup: ['PAPUA BARAT', 'PAPUA BARAT DAYA'] },
  'ID-PA': {
    kawasan: 'Maluku & Papua',
    provinsi: 'PAPUA',
    provinsiGroup: ['PAPUA SELATAN', 'PAPUA PEGUNUNGAN', 'PAPUA', 'PAPUA TENGAH'],
  },
};

function createSvgElement(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

export async function fetchMapHtml() {
  const resp = await fetch('./maps/indonesia.html');
  if (!resp.ok) {
    throw new Error(`Gagal memuat aset peta (HTTP ${resp.status}).`);
  }
  return resp.text();
}

export function mountIndonesiaMap(hostElement, htmlText, kawasanData) {
  const doc = new DOMParser().parseFromString(htmlText, 'text/html');
  const sourceSvg = doc.querySelector('svg');
  if (!sourceSvg) throw new Error('Elemen <svg> tidak ditemukan di ./maps/indonesia.html.');

  const rawPaths = Array.from(sourceSvg.querySelectorAll('path[id]'));
  if (!rawPaths.length) throw new Error('Tidak ada path provinsi pada aset SVG.');

  const svg = createSvgElement('svg', {
    id: 'indonesia-map',
    class: 'indonesia-map-svg',
    viewBox: '-12 18 816 310',
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': 'Peta Interaktif Produktivitas Padi Indonesia 2024',
  });

  const groupMap = new Map();
  const overlayGroupMap = new Map();
  const pathRegistry = new Map();
  const regionBBoxes = new Map();

  const sortedKawasan = Object.entries(kawasanData)
    .sort((a, b) => a[1].peringkat - b[1].peringkat)
    .map(([name]) => name);

  for (const name of sortedKawasan) {
    const tier = getTierForRank(kawasanData[name].peringkat);
    const g = createSvgElement('g', {
      class: 'kawasan-group',
      'data-kawasan': name,
      'data-tier': tier,
    });
    groupMap.set(name, g);
    svg.appendChild(g);
  }

  const overlayLayer = createSvgElement('g', {
    id: 'map-overlay-layer',
    'pointer-events': 'none',
    'aria-hidden': 'true',
  });

  for (const name of sortedKawasan) {
    const tier = getTierForRank(kawasanData[name].peringkat);
    const og = createSvgElement('g', {
      class: 'kawasan-outline-group',
      'data-kawasan': name,
      'data-tier': tier,
    });
    overlayGroupMap.set(name, og);
    overlayLayer.appendChild(og);
  }

  const compareArcLayer = createSvgElement('g', {
    id: 'compare-arc-layer',
    'pointer-events': 'none',
    'aria-hidden': 'true',
  });

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
      tabindex: '0',
      role: 'button',
    });
    groupMap.get(mapping.kawasan).appendChild(pathEl);

    const outlineEl = createSvgElement('path', {
      d,
      class: 'province-outline',
      'data-provinsi': mapping.provinsi,
      'data-kawasan': mapping.kawasan,
      fill: 'none',
    });
    overlayGroupMap.get(mapping.kawasan).appendChild(outlineEl);

    pathRegistry.set(svgId, { element: pathEl, outline: outlineEl, svgId, ...mapping });
  }

  svg.appendChild(overlayLayer);
  svg.appendChild(compareArcLayer);
  hostElement.replaceChildren(svg);

  // Kalibrasi viewBox penuh & simpan bounding box tiap kawasan untuk animasi zoom-in akurat
  let fullViewBox = { x: -12, y: 18, width: 816, height: 310 };
  try {
    const totalBox = svg.getBBox();
    if (totalBox && totalBox.width > 0) {
      const pad = 12;
      fullViewBox = {
        x: totalBox.x - pad,
        y: totalBox.y - pad,
        width: totalBox.width + pad * 2,
        height: totalBox.height + pad * 2,
      };
      svg.setAttribute(
        'viewBox',
        `${fullViewBox.x.toFixed(2)} ${fullViewBox.y.toFixed(2)} ${fullViewBox.width.toFixed(2)} ${fullViewBox.height.toFixed(2)}`
      );
    }
    for (const [name, g] of groupMap.entries()) {
      const b = g.getBBox();
      regionBBoxes.set(name, {
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        cx: b.x + b.width / 2,
        cy: b.y + b.height / 2,
      });
    }
  } catch {
    // Fallback tetap aman
  }

  let activeAnimId = null;
  let currentViewBox = { ...fullViewBox };

  function parseCurrentViewBox() {
    const parts = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
      return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
    return { ...currentViewBox };
  }

  /**
   * Menghitung target viewBox yang menyertakan padding proporsional dan selaras
   * dengan rasio aspek kanvas SVG agar animasi zoom terasa sinematik & tidak terpotong.
   */
  function computeFittedBox(rawBox, padFactor = 0.2) {
    const pad = Math.max(16, Math.max(rawBox.width, rawBox.height) * padFactor);
    let targetW = rawBox.width + pad * 2;
    let targetH = rawBox.height + pad * 2;

    const rect = svg.getBoundingClientRect();
    const containerAspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 2.3;
    const boxAspect = targetW / targetH;

    if (boxAspect < containerAspect) {
      targetW = targetH * containerAspect;
    } else {
      targetH = targetW / containerAspect;
    }

    const cx = rawBox.x + rawBox.width / 2;
    const cy = rawBox.y + rawBox.height / 2;
    return {
      x: cx - targetW / 2,
      y: cy - targetH / 2,
      width: targetW,
      height: targetH,
    };
  }

  function animateViewBox(targetBox, duration = 550) {
    if (activeAnimId !== null) {
      cancelAnimationFrame(activeAnimId);
      activeAnimId = null;
    }

    const startBox = parseCurrentViewBox();
    const startTime = performance.now();
    const easeCubicOut = (t) => 1 - Math.pow(1 - t, 3);

    function step(now) {
      const elapsed = now - startTime;
      const rawT = Math.min(1, elapsed / duration);
      const t = easeCubicOut(rawT);

      const nextBox = {
        x: startBox.x + (targetBox.x - startBox.x) * t,
        y: startBox.y + (targetBox.y - startBox.y) * t,
        width: startBox.width + (targetBox.width - startBox.width) * t,
        height: startBox.height + (targetBox.height - startBox.height) * t,
      };
      currentViewBox = nextBox;
      svg.setAttribute(
        'viewBox',
        `${nextBox.x.toFixed(2)} ${nextBox.y.toFixed(2)} ${nextBox.width.toFixed(2)} ${nextBox.height.toFixed(2)}`
      );

      if (rawT < 1) {
        activeAnimId = requestAnimationFrame(step);
      } else {
        activeAnimId = null;
      }
    }

    activeAnimId = requestAnimationFrame(step);
  }

  function zoomToKawasan(kawasanName) {
    const box = regionBBoxes.get(kawasanName);
    if (!box) return;
    animateViewBox(computeFittedBox(box, 0.22), 550);
  }

  function zoomToPair(kawasanA, kawasanB) {
    const bA = regionBBoxes.get(kawasanA);
    const bB = regionBBoxes.get(kawasanB);
    if (!bA || !bB) {
      animateViewBox(fullViewBox, 500);
      return;
    }
    const minX = Math.min(bA.x, bB.x);
    const minY = Math.min(bA.y, bB.y);
    const maxX = Math.max(bA.x + bA.width, bB.x + bB.width);
    const maxY = Math.max(bA.y + bA.height, bB.y + bB.height);
    const union = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

    // Jika pasangan terpisah sangat jauh (>75% lebar nasional), gunakan fullViewBox agar lega
    if (union.width > fullViewBox.width * 0.72) {
      animateViewBox(fullViewBox, 500);
    } else {
      animateViewBox(computeFittedBox(union, 0.16), 550);
    }
  }

  function resetZoom() {
    animateViewBox(fullViewBox, 500);
  }

  function drawCompareArc(kawasanA, kawasanB) {
    compareArcLayer.replaceChildren();
    if (!kawasanA || !kawasanB || kawasanA === kawasanB) return;
    const bA = regionBBoxes.get(kawasanA);
    const bB = regionBBoxes.get(kawasanB);
    if (!bA || !bB) return;

    const dx = bB.cx - bA.cx;
    const dy = bB.cy - bA.cy;
    const dist = Math.hypot(dx, dy);
    const lift = Math.min(85, Math.max(26, dist * 0.26));
    const midX = (bA.cx + bB.cx) / 2;
    const midY = (bA.cy + bB.cy) / 2 - lift;

    const arc = createSvgElement('path', {
      class: 'compare-arc-path',
      d: `M ${bA.cx.toFixed(1)} ${bA.cy.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${bB.cx.toFixed(1)} ${bB.cy.toFixed(1)}`,
    });
    compareArcLayer.appendChild(arc);

    for (const [pt, cls] of [
      [bA, 'is-a'],
      [bB, 'is-b'],
    ]) {
      compareArcLayer.appendChild(
        createSvgElement('circle', {
          cx: pt.cx.toFixed(1),
          cy: pt.cy.toFixed(1),
          r: '7.5',
          class: `compare-pin-outer ${cls}`,
        })
      );
      compareArcLayer.appendChild(
        createSvgElement('circle', {
          cx: pt.cx.toFixed(1),
          cy: pt.cy.toFixed(1),
          r: '4',
          class: `compare-pin-inner ${cls}`,
        })
      );
    }
  }

  function clearCompareArc() {
    compareArcLayer.replaceChildren();
  }

  return {
    svg,
    groupMap,
    overlayGroupMap,
    pathRegistry,
    regionBBoxes,
    zoomToKawasan,
    zoomToPair,
    resetZoom,
    drawCompareArc,
    clearCompareArc,
  };
}
