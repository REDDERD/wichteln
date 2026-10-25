const SVG_NS = 'http://www.w3.org/2000/svg';
const NODE_R = 18;
const GAP = 16;
const MAX_WIDTH = 880;

function s(tag, attrs, text) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.keys(attrs || {}).forEach(key => node.setAttribute(key, attrs[key]));
  if (text) node.textContent = text;
  return node;
}

// Zeichnet die Paarungen als Graph. Jeder Ring ist ein geschlossener Kreis
// von Schenkenden, der Pfeil zeigt von der schenkenden zur beschenkten Person.
export function renderGraph(people, assignments, showNames) {
  const names = {};
  people.forEach(p => { names[p.id] = p.name; });

  const cycles = findCycles(people.map(p => p.id), assignments).sort((a, b) => b.length - a.length);
  const labelSpace = showNames ? 96 : 12;
  const cells = cycles.map(cycle => {
    const radius = Math.max(46, 48 / Math.sin(Math.PI / Math.max(2, cycle.length)));
    return { cycle, radius, size: 2 * (radius + NODE_R + labelSpace) };
  });

  // Ringe zeilenweise anordnen.
  const rows = [];
  let row = null;
  cells.forEach(cell => {
    if (!row || row.width + GAP + cell.size > MAX_WIDTH) {
      row = { cells: [], width: -GAP, height: 0 };
      rows.push(row);
    }
    row.cells.push(cell);
    row.width += GAP + cell.size;
    row.height = Math.max(row.height, cell.size);
  });
  const width = Math.max.apply(null, rows.map(r => r.width).concat([200]));

  const svg = s('svg', { role: 'img', 'aria-label': 'Grafik der Paarungen' });
  const defs = s('defs');
  const marker = s('marker', {
    id: 'graph-arrow', viewBox: '0 0 10 10', refX: '10', refY: '5',
    markerWidth: '12', markerHeight: '12', markerUnits: 'userSpaceOnUse', orient: 'auto'
  });
  marker.appendChild(s('path', { d: 'M0,0 L10,5 L0,10 z', class: 'graph-arrow' }));
  defs.appendChild(marker);
  svg.appendChild(defs);

  const edges = s('g');
  const nodes = s('g');
  svg.appendChild(edges);
  svg.appendChild(nodes);

  let y = 0;
  rows.forEach(r => {
    let x = (width - r.width) / 2;
    r.cells.forEach(cell => {
      drawCycle(cell, x + cell.size / 2, y + r.height / 2);
      x += cell.size + GAP;
    });
    y += r.height + GAP;
  });
  const height = Math.max(y - GAP, 60);

  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
  svg.style.maxWidth = width + 'px';
  return svg;

  function drawCycle(cell, cx, cy) {
    const n = cell.cycle.length;
    const points = cell.cycle.map((id, k) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * k) / n;
      return { id, angle, x: cx + cell.radius * Math.cos(angle), y: cy + cell.radius * Math.sin(angle) };
    });

    points.forEach((p, k) => {
      const q = points[(k + 1) % n];
      edges.appendChild(s('path', { class: 'graph-edge', d: edgePath(p, q), 'marker-end': 'url(#graph-arrow)' }));
    });

    points.forEach(p => {
      const a = assignments[p.id];
      nodes.appendChild(s('circle', {
        class: 'graph-node' + (a && a.revealed ? ' revealed' : ''),
        cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: NODE_R
      }));
      if (showNames) nodes.appendChild(label(p, cx, cy, cell.radius, names[p.id] || '?'));
    });
  }
}

function findCycles(ids, assignments) {
  const seen = new Set();
  const cycles = [];
  ids.forEach(start => {
    if (seen.has(start) || !assignments[start]) return;
    const cycle = [];
    let current = start;
    while (current && !seen.has(current)) {
      seen.add(current);
      cycle.push(current);
      current = assignments[current] ? assignments[current].receiverId : null;
    }
    cycles.push(cycle);
  });
  return cycles;
}

// Leicht nach außen gebogene Kante, damit sich Hin- und Rückweg bei Zweierpaaren nicht überdecken.
function edgePath(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const bend = len * 0.22;
  const c = { x: (a.x + b.x) / 2 + (dy / len) * bend, y: (a.y + b.y) / 2 - (dx / len) * bend };
  const start = towards(a, c, NODE_R + 3);
  const end = towards(b, c, NODE_R + 2);
  return 'M' + f(start.x) + ' ' + f(start.y) + ' Q' + f(c.x) + ' ' + f(c.y) + ' ' + f(end.x) + ' ' + f(end.y);
}

function towards(from, to, distance) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: from.x + (dx / len) * distance, y: from.y + (dy / len) * distance };
}

function f(n) {
  return n.toFixed(1);
}

function label(p, cx, cy, radius, text) {
  const distance = radius + NODE_R + 8;
  const cos = Math.cos(p.angle);
  const sin = Math.sin(p.angle);
  let y = cy + distance * sin + 5;
  const anchor = cos > 0.35 ? 'start' : cos < -0.35 ? 'end' : 'middle';
  if (anchor === 'middle') y += sin > 0 ? 10 : -6;
  const shortText = text.length > 14 ? text.slice(0, 13) + '…' : text;
  return s('text', {
    class: 'graph-label', x: f(cx + distance * cos), y: f(y), 'text-anchor': anchor
  }, shortText);
}
