

let hoveredId = null;
const hoverPanel = document.getElementById('hover-panel');

// Load neighborhood scores
let neighborhoodJsonData = {};

fetch('./neighborhood_scores.json')
  .then(res => res.json())
  .then(data => {
    data.forEach(n => {
      neighborhoodJsonData[n.name] = n;
    });
    console.log('Scores loaded:', Object.keys(neighborhoodJsonData).length, 'neighborhoods');
    console.log('Sample entry:', neighborhoodJsonData['Jordaan']);
    // Update colors once data is ready
    if (map.isStyleLoaded()) updateMapColors();
  });

function getNeighborhoodValue(buurtName, indicator) {
  const entry = neighborhoodJsonData[buurtName];
  if (!entry) return '—';

  const scoreMap = {
    'Health':    'health_score',
    'Education': 'education_score',
    'Income':    'income_score',
    'Housing':   'housing_score',
  };

  const key = scoreMap[indicator];
  if (!key || entry[key] === undefined) return '—';

  return Math.round(entry[key]);
}

const indicatorConfig = {
  'Education': { color: '#e28c1c', icon: '🎓' },
  'Health':    { color: '#a3162d', icon: '🏥' },
  'Income':    { color: '#dfe23a', icon: '💰' },
  'Housing':   { color: '#119617', icon: '🏠' },
};

function getActiveIndicators() {
  return [...document.querySelectorAll('.indicator-item.active')]
    .map(el => el.querySelector('.indicator-label').textContent.trim());
}

function toggleIndicator(el) {
  el.classList.toggle('active');
  updateFooter();
  updateMapColors();
}

function updateFooter() {
  const count = document.querySelectorAll('.indicator-item.active').length;
  const text = count === 0 ? 'No indicators selected'
    : count === 1 ? '1 indicator selected'
    : `${count} indicators selected`;
  document.getElementById('footer-text').textContent = text;
}

function toggleSelect(id) {
  const dropdown = document.getElementById(id + '-dropdown');
  const trigger = dropdown.previousElementSibling;
  const isOpen = dropdown.classList.contains('open');
  document.querySelectorAll('.select-dropdown').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.select-trigger').forEach(t => t.classList.remove('open'));
  if (!isOpen) { dropdown.classList.add('open'); trigger.classList.add('open'); }
}

function selectOption(id, value) {
  const textEl = document.getElementById(id + '-text');
  textEl.textContent = value;
  textEl.classList.add('selected');
  const dropdown = document.getElementById(id + '-dropdown');
  dropdown.querySelectorAll('.select-option').forEach(opt => {
    opt.classList.toggle('chosen', opt.textContent === value);
  });
  dropdown.classList.remove('open');
  dropdown.previousElementSibling.classList.remove('open');
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.custom-select')) {
    document.querySelectorAll('.select-dropdown').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.select-trigger').forEach(t => t.classList.remove('open'));
  }
});

// Map
mapboxgl.accessToken = 'pk.eyJ1IjoiY2xlbXB0cnZsYiIsImEiOiJjbW5tYXYxdGExOWU5MndyNnhwZ291aHJsIn0.-liMXzoUsed9E2Iw13aVmA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/clemptrvlb/cmnejm6cl000e01sebxhc352m/draft',
  center: [4.9041, 52.3676],
  zoom: 12
});
const pillarColors = {
  'Health':    { low: '#FFF5F5', high: '#7F0000' },
  'Education': { low: '#FFF8F0', high: '#7F3200' },
  'Income':    { low: '#FFFDE7', high: '#7F6000' },
  'Housing':   { low: '#F0FFF4', high: '#1A4D2E' },
  'multiple':  { low: '#F5F0FF', high: '#3B0080' },
};

map.on('moveend', () => {
  const active = getActiveIndicators();
  if (active.length > 0) updateMapColors();
});

function interpolateColor(hex1, hex2, t) {
  const r1 = parseInt(hex1.slice(1,3),16);
  const g1 = parseInt(hex1.slice(3,5),16);
  const b1 = parseInt(hex1.slice(5,7),16);
  const r2 = parseInt(hex2.slice(1,3),16);
  const g2 = parseInt(hex2.slice(3,5),16);
  const b2 = parseInt(hex2.slice(5,7),16);
  const r = Math.round(r1 + (r2-r1)*t);
  const g = Math.round(g1 + (g2-g1)*t);
  const b = Math.round(b1 + (b2-b1)*t);
  return `rgb(${r},${g},${b})`;
}

function updateMapColors() {
  const active = getActiveIndicators();

  if (active.length === 0) {
    // Reset to default blue
    map.setPaintProperty('neighborhoods-fill', 'fill-color', '#717c94');
    map.setPaintProperty('neighborhoods-fill', 'fill-opacity', [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      0.85, 0.6
    ]);
    return;
  }

  const colorKey = active.length === 1 ? active[0] : 'multiple';
  const { low, high } = pillarColors[colorKey];

  // Build color stops based on score
  const features = map.querySourceFeatures('neighborhoods');
  
  features.forEach(feature => {
    const name = feature.properties.Wijk;
    const entry = neighborhoodJsonData[name];
    if (!entry) return;

    let score = 0;
    if (active.length === 1) {
      const val = getNeighborhoodValue(name, active[0]);
      score = val === '—' ? 0 : val / 100;
    } else {
      // Average across active pillars
      const vals = active.map(ind => {
        const v = getNeighborhoodValue(name, ind);
        return v === '—' ? 0 : v;
      });
      score = (vals.reduce((a,b) => a+b, 0) / vals.length) / 100;
    }

    const color = interpolateColor(low, high, score);
    map.setFeatureState(
      { source: 'neighborhoods', id: feature.id },
      { fillColor: color }
    );
  });

  // Use feature state for color
  map.setPaintProperty('neighborhoods-fill', 'fill-color', [
    'case',
    ['!=', ['feature-state', 'fillColor'], null],
    ['feature-state', 'fillColor'],
    low
  ]);
}
map.on('load', () => {

  map.addSource('neighborhoods', {
    type: 'geojson',
    data: 'https://maps.amsterdam.nl/open_geodata/geojson_lnglat.php?KAARTLAAG=INDELING_WIJK&THEMA=gebiedsindeling'
  });

  map.addLayer({
    id: 'neighborhoods-fill',
    type: 'fill',
    source: 'neighborhoods',
    paint: {
      'fill-color': '#717c94',
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.7,
        0.8
      ],
      'fill-antialias': true
    }
  });

  map.addLayer({
    id: 'neighborhoods-outline',
    type: 'line',
    source: 'neighborhoods',
    paint: {
      'line-color': '#dddddd',
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        1,
        0.4
      ],
      'line-opacity': 0.8,
      
    }
  });



  // Hover logic
  map.on('mousemove', 'neighborhoods-fill', (e) => {
    if (hoveredId !== null) {
      map.setFeatureState({ source: 'neighborhoods', id: hoveredId }, { hover: false });
    }

    hoveredId = e.features[0].id;
    map.setFeatureState({ source: 'neighborhoods', id: hoveredId }, { hover: true });

    const props = e.features[0].properties;
    const buurtName = props.Wijk || props.Buurt;
    document.getElementById('hover-name').textContent = buurtName;

    const active = getActiveIndicators();
    const body = document.getElementById('hover-indicators');

    if (active.length === 0) {
      body.innerHTML = `<div class="no-indicators">No indicators selected</div>`;
    } else {
      body.innerHTML = active.map(ind => {
        const val = getNeighborhoodValue(buurtName, ind);
        const cfg = indicatorConfig[ind] || { color: '#FB923C' };
        const barWidth = val === '—' ? 0 : val;
        return `
          <div class="indicator-row">
            <div class="indicator-row-header">
              <span class="indicator-row-label">${cfg.icon || ''} ${ind}</span>
              <span class="indicator-row-value">${val}${val !== '—' ? '/100' : ''}</span>
            </div>
            <div class="indicator-bar-bg">
              <div class="indicator-bar-fill" style="width:${barWidth}%; background:${cfg.color};"></div>
            </div>
          </div>`;
      }).join('');
    }

    const x = e.originalEvent.clientX;
    const y = e.originalEvent.clientY;
    const panelW = 240;
    const left = x + panelW + 20 > window.innerWidth ? x - panelW - 12 : x + 12;
    const top = Math.min(y - 20, window.innerHeight - 200);

    hoverPanel.style.left = left + 'px';
    hoverPanel.style.top = top + 'px';
    hoverPanel.style.display = 'block';
  });

  map.on('mouseleave', 'neighborhoods-fill', () => {
    if (hoveredId !== null) {
      map.setFeatureState({ source: 'neighborhoods', id: hoveredId }, { hover: false });
    }
    hoveredId = null;
    hoverPanel.style.display = 'none';
  });

  map.on('click', 'neighborhoods-fill', (e) => {
    console.log('Clicked:', e.features[0].properties.Wijk, '| Found in data:', !!neighborhoodJsonData[e.features[0].properties.Wijk]);
    buildDetailPanel(e.features[0].properties);
  });

});

// Detail panel
const indicatorCards = {
  'Education': {
    class: 'education',
    icon: '🎓',
    description: 'Education outcomes score for this neighborhood.',
    iconColor: '#E7000B'
  },
  'Health': {
    class: 'health',
    icon: '🏥',
    description: 'Health and wellbeing score for this neighborhood.',
    iconColor: '#16A34A'
  },
  'Income': {
    class: 'income',
    icon: '💰',
    description: 'Income and economic score for this neighborhood.',
    iconColor: '#BB4D00'
  },
  'Housing': {
    class: 'housing',
    icon: '🏠',
    description: 'Housing conditions score for this neighborhood.',
    iconColor: '#7C3AED'
  },
};

function closeDetailPanel() {
  document.getElementById('detail-panel').classList.remove('open');
  switchPage(1);
}

function buildDetailPanel(props) {
  const name = props.Wijk || props.Buurt;
  document.getElementById('detail-name').textContent = name;

  const active = getActiveIndicators();
  const body = document.getElementById('detail-body');
  const entry = neighborhoodJsonData[name];

  if (active.length === 0) {
    body.innerHTML = `<p style="color:#9CA3AF; font-size:13px; font-style:italic;">No indicators selected.</p>`;
    document.getElementById('detail-panel').classList.add('open');
    return;
  }

  const allPillars = ['Health', 'Education', 'Income', 'Housing'];
  const pillarColors = {
    'Health':    '#16A34A',
    'Education': '#2B7FFF',
    'Income':    '#BB4D00',
    'Housing':   '#9333EA'
  };

  const scores = allPillars.map(ind => ({
    label: ind,
    value: getNeighborhoodValue(name, ind),
    color: pillarColors[ind],
    active: active.includes(ind)
  }));

  const radarHTML = buildRadarChart(scores, name);

  // Fetch population then render
  fetch('./population.json')
    .then(r => r.json())
    .then(popData => {
      const popEntry = popData.find(d => d.wijk_naam === name);
      const population = popEntry ? Math.round(popEntry.Population) : null;

      const maxPop = Math.max(...popData.map(p => p.Population));
      const sortedPop = [...popData].sort((a, b) => a.Population - b.Population);

      const populationHTML = popData.length > 0 ? `
        <div style="background:white; border-radius:14px; outline:1.6px #E5E7EB solid; padding:16px; width:100%; box-sizing:border-box;">
          <div style="font-size:11px; font-weight:600; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Population</div>
          <div style="font-size:13px; font-weight:600; color:#101828; margin-bottom:12px;">${name} — ${popEntry ? Math.round(popEntry.Population).toLocaleString() : '—'} residents</div>
          <div style="display:flex; align-items:flex-end; gap:2px; height:80px;">
            ${sortedPop.map(d => {
              const isSelected = d.wijk_naam === name;
              const heightPct = (d.Population / maxPop * 100).toFixed(1);
              return `<div style="flex:1; display:flex; flex-direction:column; justify-content:flex-end; height:100%;">
                <div class="pop-bar-vertical" 
                  style="width:100%; height:0%; background:${isSelected ? '#2B7FFF' : '#E5E7EB'}; border-radius:2px 2px 0 0; transition:height 0.8s cubic-bezier(0.4,0,0.2,1);"
                  data-height="${heightPct}">
                </div>
              </div>`;
            }).join('')}
          </div>
          <div style="height:1px; background:#E5E7EB; width:100%;"></div>
        </div>` : '';

      body.innerHTML = `
        <div class="radar-container">
          ${radarHTML}
        </div>
        ${populationHTML}`;

      requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.querySelectorAll('.pop-bar-vertical').forEach(bar => {
          bar.style.height = bar.dataset.height + '%';
        });
      });
    });

      // Actions
      document.getElementById('detail-actions').innerHTML = `
        <button class="suggest-btn" onclick="showInterventions('${name}')">
          💡 Suggest interventions
        </button>
        <button class="narrative-btn" onclick="generateNarrative('${name}')">
          📖 Generate narrative
        </button>
        <div class="interventions-list" id="interventions-list" style="display:none;"></div>`;

      document.getElementById('detail-panel').classList.add('open');
    })
    .catch(err => {
      console.error('Failed to load population.json:', err);

      body.innerHTML = `<div class="radar-container">${radarHTML}</div>`;
      document.getElementById('detail-actions').innerHTML = `
        <button class="suggest-btn" onclick="showInterventions('${name}')">💡 Suggest interventions</button>
        <button class="narrative-btn" onclick="generateNarrative('${name}')">📖 Generate narrative</button>
        <div class="interventions-list" id="interventions-list" style="display:none;"></div>`;

      document.getElementById('detail-panel').classList.add('open');
    });
}

function buildRadarChart(scores, name) {
  const svgW = 380;   // wider viewBox to accommodate labels
  const svgH = 320;
  const cx = svgW / 2;
  const cy = svgH / 2;
  const r = 80;
  const levels = 4;
  const n = scores.length;

  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (val, i) => {
    const a = angle(i);
    const radius = (val / 100) * r;
    return {
      x: cx + radius * Math.cos(a),
      y: cy + radius * Math.sin(a)
    };
  };

  // Grid circles
  let gridSVG = '';
  const ringFills = ['#E5E7EB', '#ECECEC', '#F3F4F6', '#F8F8F8'];
  for (let l = levels; l >= 1; l--) {
    const lr = (r * l) / levels;
    gridSVG += `<circle cx="${cx}" cy="${cy}" r="${lr}" fill="${ringFills[l-1]}" stroke="#9CA3AF" stroke-width="0.8" stroke-dasharray="3 3"/>`;
  }

  // Axis lines
  let axesSVG = '';
  scores.forEach((_, i) => {
    const p = point(100, i);
    axesSVG += `<line x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" stroke="#D1D5DB" stroke-width="1"/>`;
  });

  // Polygon
  const activeScores = scores.map(s => s.value === '—' ? 0 : Number(s.value));
  const polygonPoints = activeScores.map((val, i) => {
    const p = point(val, i);
    return `${p.x},${p.y}`;
  }).join(' ');

  // Labels — pushed well outside the chart
  let labelsSVG = '';
  scores.forEach((s, i) => {
    const a = angle(i);
    const labelR = r + 45;
    const lx = cx + labelR * Math.cos(a);
    const ly = cy + labelR * Math.sin(a);
    const anchor = Math.abs(Math.cos(a)) < 0.1 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';

    labelsSVG += `
      <text x="${lx}" y="${ly - 6}" text-anchor="${anchor}" dominant-baseline="central"
        font-size="12" font-family="Inter, sans-serif" font-weight="600"
        fill="${s.active ? s.color : '#9CA3AF'}">${s.label}</text>
      <text x="${lx}" y="${ly + 10}" text-anchor="${anchor}" dominant-baseline="central"
        font-size="11" font-family="Inter, sans-serif" font-weight="400"
        fill="${s.active ? '#364153' : '#D1D5DB'}">${s.value !== '—' ? s.value : '—'}</text>`;
  });

  // Dots
  let dotsSVG = '';
  scores.forEach((s, i) => {
    const val = s.value === '—' ? 0 : Number(s.value);
    const p = point(val, i);
    dotsSVG += `<circle cx="${p.x}" cy="${p.y}" r="5" fill="${s.active ? s.color : '#E5E7EB'}" stroke="white" stroke-width="2"/>`;
  });

  return `
    <svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
      ${gridSVG}
      ${axesSVG}
      <polygon points="${polygonPoints}" fill="rgba(43,127,255,0.12)" stroke="#2B7FFF" stroke-width="2" stroke-linejoin="round"/>
      ${labelsSVG}
      ${dotsSVG}
    </svg>`;
}

function goToTab(indicator) {
  switchPage(2);
  switchTab(indicator);
}

// Update switchPage to only handle pages 1 and 2
function switchPage(pageNum) {
  document.getElementById('detail-page-1').style.display = pageNum === 1 ? 'flex' : 'none';
  document.getElementById('detail-page-2').style.display = pageNum === 2 ? 'flex' : 'none';

  const name = document.getElementById('detail-name').textContent;
  document.getElementById('detail-name-2').textContent = name;

  if (pageNum === 2) switchTab('Health');
}

function renderBeeswarm() {
  const data = {
    'Low Birth Weight Babies': {
      unit: '% of all births below 5 lbs. 8 oz.',
      values: [3.1, 3.4, 4.2, 4.5, 4.8, 5.0, 5.1, 5.3, 5.5, 5.6, 5.8, 6.0, 6.2, 6.4, 6.9],
      highlight: { label: 'This neighborhood', value: 6.9 }
    },
    'Pre-Term Births': {
      unit: '% of all births',
      values: [4.5, 5.0, 5.5, 5.8, 6.0, 6.2, 6.5, 6.8, 7.0, 7.2, 7.5, 7.9, 8.1, 8.5, 9.2],
      highlight: { label: 'This neighborhood', value: 7.9 }
    }
  };

  const container = document.getElementById('beeswarm-chart');
  if (!container) return;
  const width = container.offsetWidth || 300;
  const rowHeight = 100;
  const margin = { top: 20, right: 20, bottom: 10, left: 10 };
  const chartWidth = width - margin.left - margin.right;

  // Clear previous chart
  d3.select('#beeswarm-chart').selectAll('*').remove();

  const svg = d3.select('#beeswarm-chart')
    .append('svg')
    .attr('width', width)
    .attr('height', Object.keys(data).length * rowHeight + margin.top + margin.bottom);

  Object.entries(data).forEach(([metric, info], rowIndex) => {
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top + rowIndex * rowHeight})`);

    const allValues = info.values;
    const xMin = d3.min(allValues) * 0.9;
    const xMax = d3.max(allValues) * 1.05;

    const x = d3.scaleLinear()
      .domain([xMin, xMax])
      .range([0, chartWidth]);

    // Baseline
    g.append('line')
      .attr('x1', 0).attr('x2', chartWidth)
      .attr('y1', 40).attr('y2', 40)
      .attr('stroke', '#E5E7EB')
      .attr('stroke-width', 1);

    const jitter = allValues.map((v, i) => ({
      value: v,
      y: 40 + (Math.sin(i * 2.5) * 12),
      isHighlight: v === info.highlight.value
    }));

    // Regular dots
    g.selectAll('.dot')
      .data(jitter.filter(d => !d.isHighlight))
      .enter()
      .append('circle')
      .attr('cx', d => x(d.value))
      .attr('cy', d => d.y)
      .attr('r', 6)
      .attr('fill', d => {
        const t = (d.value - xMin) / (xMax - xMin);
        return d3.interpolateRgb('#FECACA', '#7F1D1D')(t);
      })
      .attr('opacity', 0.8);

    // Highlight dot
    const highlight = jitter.find(d => d.isHighlight);
    if (highlight) {
      const tx = x(highlight.value);
      const tooltipG = g.append('g').attr('transform', `translate(${tx}, 0)`);

      tooltipG.append('rect')
        .attr('x', -28).attr('y', 0)
        .attr('width', 56).attr('height', 28)
        .attr('rx', 6)
        .attr('fill', 'white')
        .attr('stroke', '#E5E7EB')
        .attr('stroke-width', 1)
        .attr('filter', 'drop-shadow(0px 1px 3px rgba(0,0,0,0.1))');

      tooltipG.append('text')
        .attr('x', 0).attr('y', 18)
        .attr('text-anchor', 'middle')
        .attr('font-size', 11)
        .attr('font-weight', 700)
        .attr('font-family', 'Inter')
        .attr('fill', '#101828')
        .text(highlight.value + '%');

      tooltipG.append('polygon')
        .attr('points', '-5,28 5,28 0,34')
        .attr('fill', 'white')
        .attr('stroke', '#E5E7EB')
        .attr('stroke-width', 1);

      g.append('circle')
        .attr('cx', x(highlight.value))
        .attr('cy', 40)
        .attr('r', 7)
        .attr('fill', '#101828')
        .attr('stroke', 'white')
        .attr('stroke-width', 2);
    }

    g.append('text')
      .attr('x', 0).attr('y', 68)
      .attr('font-size', 13)
      .attr('font-weight', 600)
      .attr('font-family', 'Inter')
      .attr('fill', '#101828')
      .text(`${info.highlight.value}%  ${metric}`);

    g.append('text')
      .attr('x', 0).attr('y', 82)
      .attr('font-size', 11)
      .attr('font-family', 'Inter')
      .attr('fill', '#9CA3AF')
      .text(info.unit);
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.detail-tab').forEach(tab => {
    tab.classList.toggle('active', tab.textContent === tabName);
  });

  const body = document.getElementById('detail-body-2');

  if (tabName === 'Health') {
    body.innerHTML = `
      <div class="chart-card">
        <div class="chart-title">Infant Mortality Rate Distribution</div>
        <div class="chart-subtitle">Deaths per 1,000 live births across regions</div>
        <div class="chart-area">
          <div class="chart-bars">
            <div class="chart-row">
              <div class="chart-label">North</div>
              <div class="chart-bar-wrap">
                <div class="chart-bar" style="width: 27%"></div>
              </div>
            </div>
            <div class="chart-row">
              <div class="chart-label">South</div>
              <div class="chart-bar-wrap">
                <div class="chart-bar" style="width: 82%"></div>
              </div>
            </div>
            <div class="chart-row">
              <div class="chart-label">East</div>
              <div class="chart-bar-wrap">
                <div class="chart-bar" style="width: 36%"></div>
              </div>
            </div>
            <div class="chart-row">
              <div class="chart-label">West</div>
              <div class="chart-bar-wrap">
                <div class="chart-bar" style="width: 46%"></div>
              </div>
            </div>
            <div class="chart-row">
              <div class="chart-label">Central</div>
              <div class="chart-bar-wrap">
                <div class="chart-bar" style="width: 100%"></div>
              </div>
            </div>
          </div>
          <div class="chart-x-axis">
            <span>0</span>
            <span>15</span>
            <span>30</span>
            <span>45</span>
            <span>60</span>
          </div>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Health Indicators</div>
        <div class="chart-subtitle">Distribution across Amsterdam neighborhoods</div>
        <div id="beeswarm-chart"></div>
      </div>`;
    renderBeeswarm();
  } else {
    body.innerHTML = `<p style="color:#9CA3AF; font-size:13px; padding-top:16px;">Content for ${tabName} coming soon.</p>`;
  }
}



async function showInterventions(neighborhoodName) {
  const btn = document.querySelector('.suggest-btn');
  const list = document.getElementById('interventions-list');
  const active = getActiveIndicators();

  const scoreSummary = active.map(ind => {
    const val = getNeighborhoodValue(neighborhoodName, ind);
    return `${ind}: ${val}/100`;
  }).join(', ');

  btn.textContent = '⏳ Finding interventions...';
  btn.classList.add('loading');
  list.style.display = 'flex';
  list.innerHTML = `<p style="color:#9CA3AF; font-size:12px; font-style:italic;">Loading recommendations...</p>`;

  const GEMINI_API_KEY = 'AIzaSyDKFDEJWqiLR1nEJ7flUrKNA_xlCKaPewg';

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a Dutch social policy expert. A neighborhood called "${neighborhoodName}" in Amsterdam has the following inequality scores (0-100, higher = more deprived): ${scoreSummary}.

Suggest 3 concrete evidence-based policy interventions relevant to the Netherlands. Respond ONLY with a valid JSON array, no markdown, no extra text, AND IN ENGLISH, exactly like this:
[{"name":"intervention name","pillar":"Health","description":"two sentence description","source":"NJi / CBS / Municipality of Amsterdam"},{"name":"intervention name","pillar":"Education","description":"two sentence description","source":"source here"},{"name":"intervention name","pillar":"Income","description":"two sentence description","source":"source here"}]`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1000,
            thinkingConfig: {
              thinkingBudget: 0  // disable thinking mode
            }
          }
        })
      }
    );

    const data = await response.json();
    console.log('Full error:', JSON.stringify(data));
    console.log('Full response:', data.candidates[0].content.parts);
    console.log('Gemini response:', data);

    if (data.error) throw new Error(data.error.message);

    const text = data.candidates[0].content.parts[0].text;
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = clean.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON found');
    const interventions = JSON.parse(jsonMatch[0]);

    list.innerHTML = interventions.map(iv => `
      <div class="intervention-card">
        <div class="intervention-header">
          <span class="intervention-name">${iv.name}</span>
          <span class="intervention-pillar">${iv.pillar}</span>
        </div>
        <div class="intervention-desc">${iv.description}</div>
        <div class="intervention-source">Source: ${iv.source}</div>
      </div>`
    ).join('');

    btn.textContent = '💡 Suggest interventions';
    btn.classList.remove('loading');

  } catch (err) {
    list.innerHTML = `<p style="color:#E24B4A; font-size:12px;">Could not load interventions. Please try again.</p>`;
    btn.textContent = '💡 Suggest interventions';
    btn.classList.remove('loading');
    console.error(err);
  }
}

function closeNarrative() {
  document.getElementById('narrative-modal').style.display = 'none';
}

async function generateNarrative(neighborhoodName) {
  const modal = document.getElementById('narrative-modal');
  const loading = document.getElementById('narrative-loading');
  const content = document.getElementById('narrative-content');

  document.getElementById('narrative-modal-title').textContent = neighborhoodName;
  modal.style.display = 'flex';
  loading.style.display = 'flex';
  content.innerHTML = '';

  const active = getActiveIndicators();
  const entry = neighborhoodJsonData[neighborhoodName];

  const scoreSummary = active.map(ind => {
    const val = getNeighborhoodValue(neighborhoodName, ind);
    return `${ind}: ${val}/100`;
  }).join(', ');

  const GEMINI_API_KEY = 'AIzaSyDKFDEJWqiLR1nEJ7flUrKNA_xlCKaPewg';

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a Dutch urban policy analyst writing a concise inequality narrative for policymakers.

Neighborhood: ${neighborhoodName}, Amsterdam
Inequality scores (0-100, higher = more deprived): ${scoreSummary}

Write a short narrative of 3-4 paragraphs that summarizes the inequality profile, highlights the most critical indicators, and ends with one sentence on policy urgency. Make sure to give the answer in ENGLISH, no jargon, no bullet points.`
            }]
          }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2000
          }
        })
      }
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.candidates[0].content.parts[0].text;

// Don't split by \n — render the whole text at once
// Just replace double newlines with paragraph breaks
const formatted = text
  .trim()
  .split(/\n\n+/)  // split on double newlines only
  .filter(p => p.trim().length > 0)
  .map(p => p.replace(/\n/g, ' ').trim()); // collapse single newlines into spaces

loading.style.display = 'none';
content.innerHTML = `
  ${formatted.map(p => `
    <p style="font-size:14px; color:#364153; line-height:1.7; margin-bottom:14px;">${p}</p>
  `).join('')}
  <div style="height:1px; background:#F3F4F6; margin:16px 0;"></div>
  <div style="font-size:11px; font-weight:600; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:10px;">Key indicators</div>
  ${active.map(ind => {
    const val = getNeighborhoodValue(neighborhoodName, ind);
    const cfg = indicatorConfig[ind];
    return `
      <div style="display:flex; align-items:flex-start; gap:10px; background:#F9FAFB; border-radius:10px; padding:12px 14px; outline:1px solid #E5E7EB; margin-bottom:8px;">
        <div style="width:8px; height:8px; border-radius:50%; background:${cfg.color}; flex-shrink:0; margin-top:5px;"></div>
        <span style="font-size:13px; color:#364153; line-height:1.5;"><strong>${ind}</strong> — score ${val}/100</span>
      </div>`;
  }).join('')}`;

  } catch (err) {
    loading.style.display = 'none';
    content.innerHTML = `<p style="color:#E24B4A; font-size:13px;">Could not generate narrative. Please try again.</p>`;
    console.error(err);
  }
}

