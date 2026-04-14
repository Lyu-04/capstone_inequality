

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

  if (active.length === 0) {
    body.innerHTML = `<p style="color:#9CA3AF; font-size:13px; font-style:italic;">No indicators selected.</p>`;
  } else {
    body.innerHTML = active.map(ind => {
      const cfg = indicatorCards[ind];
      if (!cfg) return '';
      const val = getNeighborhoodValue(name, ind);
      return `
        <div class="indicator-card ${cfg.class}">
          <div class="card-top">
            <div class="card-icon">${cfg.icon}</div>
            <div class="card-score-block">
              <div class="card-score">${val}</div>
              <div class="card-score-label">Score</div>
            </div>
          </div>
          <div class="card-title">${ind}</div>
          <div class="card-neighborhood">${name}</div>
          <div class="card-description">${cfg.description}</div>
          <button class="card-button" onclick="goToTab('${ind}')">View more →</button>
        </div>`;
    }).join('');
    body.innerHTML += `
      <div class="interventions-section" id="interventions-section">
        <button class="suggest-btn" onclick="showInterventions('${name}')">
          💡 Suggest interventions
        </button>
        <div class="interventions-list" id="interventions-list" style="display:none;"></div>
      </div>`;
    
  }

  document.getElementById('detail-panel').classList.add('open');
}

function goToTab(indicator) {
  switchPage(2);
  switchTab(indicator);
}

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

  const GEMINI_API_KEY = 'GEMINI_API_KEY';

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
