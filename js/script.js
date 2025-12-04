// js/script.js

const DATA_JSON_PATH = "data/openpowerlifting.json";
const YEARS = { min: 1971, max: 2024 };

const categories = {
  totals_all:   { label: "Totals (All)" },
  totals_open:  { label: "Totals (Open)" },
  totals_tested:{ label: "Totals (Tested)" },
  dots:         { label: "Dots" },
  squat:        { label: "Squat" },
  bench:        { label: "Bench" },
  deadlift:     { label: "Deadlift" }
};

const margin = { top: 20, right: 40, bottom: 110, left: 70 };
const width = 1000;
const height = 420;
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const brushMargin = { top: 10, right: 40, bottom: 30, left: 70 };
const brushHeight = 100;
const brushInnerHeight = brushHeight - brushMargin.top - brushMargin.bottom;

// main SVG
const svg = d3.select("#chart")
  .attr("viewBox", `0 0 ${width} ${height}`)
  .attr("preserveAspectRatio", "xMidYMid meet");

const g = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// clipping
g.append("clipPath").attr("id", "clip")
  .append("rect")
  .attr("width", innerWidth)
  .attr("height", innerHeight);

// scales
const x = d3.scaleTime().range([0, innerWidth]);
const y = d3.scaleLinear().range([innerHeight, 0]);

// axes groups
const xAxisG = g.append("g")
  .attr("transform", `translate(0,${innerHeight})`)
  .attr("class", "x axis");

const yAxisG = g.append("g")
  .attr("class", "y axis");

// axis labels
g.append("text")
  .attr("class", "axis-label")
  .attr("x", innerWidth / 2)
  .attr("y", innerHeight + 40)
  .attr("text-anchor", "middle")
  .text("Year");

const yLabel = g.append("text")
  .attr("class", "axis-label")
  .attr("transform", "rotate(-90)")
  .attr("x", -innerHeight / 2)
  .attr("y", -50)
  .attr("text-anchor", "middle")
  .text("Best result [kg]");

// line generator
const lineGen = d3.line()
  .x(d => x(d.yearDate))
  .y(d => y(d.best))
  .curve(d3.curveMonotoneX);

// colors
const color = { M: "#1f77b4", F: "#ff6fb3" };

// groups
const linesG = g.append("g").attr("clip-path", "url(#clip)");
const dotsG = g.append("g").attr("clip-path", "url(#clip)");

// tooltip
const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("display", "none");

// brush SVG
const brushSvg = d3.select("#brush")
  .attr("viewBox", `0 0 ${width} ${brushHeight}`)
  .attr("preserveAspectRatio", "xMidYMid meet");

const brushG = brushSvg.append("g")
  .attr("transform", `translate(${brushMargin.left},${brushMargin.top})`);

const brushX = d3.scaleTime().range([0, innerWidth]);
const brushXAxisG = brushG.append("g")
  .attr("transform", `translate(0,${brushInnerHeight})`);

let brush;

// UI
const categorySelect   = document.getElementById("categorySelect");
const federationSelect = document.getElementById("federationSelect");
const testedSelect     = document.getElementById("testedSelect");
const equipmentSelect  = document.getElementById("equipmentSelect");

// state
let fullData = null;
let yearsExtent = [new Date(YEARS.min, 0, 1), new Date(YEARS.max, 11, 31)];
let currentCategory = categorySelect.value;

// load preprocessed JSON
d3.json(DATA_JSON_PATH).then(json => {
  fullData = json;
  
  console.log("Data loaded successfully");
  
  // Populate federation dropdown with top federations
  if (json.federations && json.federations.length > 0) {
    // Count federation occurrences across all data
    const fedCounts = {};
    Object.keys(json.data).forEach(cat => {
      Object.keys(json.data[cat]).forEach(filterKey => {
        ["M", "F"].forEach(sex => {
          json.data[cat][filterKey][sex].forEach(d => {
            if (d.federation) {
              fedCounts[d.federation] = (fedCounts[d.federation] || 0) + 1;
            }
          });
        });
      });
    });
    
    // Get top 20 federations by count
    const topFeds = Object.entries(fedCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([fed, count]) => fed);
    
    console.log("Top federations:", topFeds);
    
    topFeds.forEach(fed => {
      const option = document.createElement('option');
      option.value = fed;
      option.textContent = fed;
      federationSelect.appendChild(option);
    });
  }
  
  // Convert yearDate strings to Date objects
  Object.keys(json.data).forEach(cat => {
    Object.keys(json.data[cat]).forEach(filterKey => {
      ["M", "F"].forEach(sex => {
        json.data[cat][filterKey][sex].forEach(d => {
          d.yearDate = new Date(d.yearDate);
        });
      });
    });
  });
  
  yearsExtent = [new Date(YEARS.min, 0, 1), new Date(YEARS.max, 11, 31)];
  x.domain(yearsExtent);
  brushX.domain(yearsExtent);
  
  updateChart();
}).catch(err => {
  console.error("Failed to load JSON:", err);
  alert("Failed to load preprocessed data JSON. Check console for details.");
});

// Helper function to get current filter key
function getCurrentFilterKey() {
  const equipment = equipmentSelect.value;
  const tested = testedSelect.value;
  return `equipment_${equipment}_tested_${tested}`;
}

// Helper function to get best per year from records list
function getBestPerYear(records) {
  if (!records || records.length === 0) return [];
  
  // Group by year and get best
  const yearMap = new Map();
  
  records.forEach(r => {
    if (!yearMap.has(r.year) || r.best > yearMap.get(r.year).best) {
      yearMap.set(r.year, r);
    }
  });
  
  return Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
}

// Helper function to get current data
function getCurrentData() {
  if (!fullData || !fullData.data) return null;
  
  const cat = currentCategory;
  const filterKey = getCurrentFilterKey();
  
  // Try to get filtered data
  if (fullData.data[cat] && fullData.data[cat][filterKey]) {
    let dataM = fullData.data[cat][filterKey].M || [];
    let dataF = fullData.data[cat][filterKey].F || [];
    
    // Additional federation filter
    const federation = federationSelect.value;
    if (federation !== 'all') {
      dataM = dataM.filter(d => d.federation === federation);
      dataF = dataF.filter(d => d.federation === federation);
    }
    
    // Get best per year for visualization
    return {
      M: getBestPerYear(dataM),
      F: getBestPerYear(dataF)
    };
  }
  
  // Fallback to unfiltered data
  const fallbackKey = 'equipment_all_tested_all';
  if (fullData.data[cat] && fullData.data[cat][fallbackKey]) {
    return {
      M: getBestPerYear(fullData.data[cat][fallbackKey].M),
      F: getBestPerYear(fullData.data[cat][fallbackKey].F)
    };
  }
  
  return { M: [], F: [] };
}

// events
categorySelect.addEventListener("change", () => {
  currentCategory = categorySelect.value;
  updateChart();
});

federationSelect.addEventListener("change", () => {
  console.log("Federation changed to:", federationSelect.value);
  updateChart();
});

testedSelect.addEventListener("change", () => {
  console.log("Tested changed to:", testedSelect.value);
  updateChart();
});

equipmentSelect.addEventListener("change", () => {
  console.log("Equipment changed to:", equipmentSelect.value);
  updateChart();
});

// update chart
function updateChart() {
  const data = getCurrentData();
  if (!data) {
    console.warn("No data available");
    return;
  }
  
  const dataM = data.M || [];
  const dataF = data.F || [];
  
  console.log(`Rendering: ${dataM.length} male records, ${dataF.length} female records`);
  
  const lineDataM = dataM.filter(d => d.best != null);
  const lineDataF = dataF.filter(d => d.best != null);
  
  const allBestVals = [...dataM, ...dataF]
    .map(d => d.best)
    .filter(v => v != null);
  
  const yMax = allBestVals.length ? d3.max(allBestVals) * 1.06 : 100;
  
  y.domain([0, yMax]);
  x.domain(yearsExtent);
  brushX.domain(yearsExtent);
  
  const xAxis = d3.axisBottom(x)
    .ticks(d3.timeYear.every(5))
    .tickFormat(d3.timeFormat("%Y"));
  
  const yAxis = d3.axisLeft(y).ticks(6);
  
  xAxisG.transition().duration(700).call(xAxis);
  yAxisG.transition().duration(700).call(yAxis);
  
  if (currentCategory === "dots") {
    yLabel.text("Dots points");
  } else {
    yLabel.text(`${categories[currentCategory].label} [kg]`);
  }
  
  // lines
  linesG.selectAll(".line").remove();
  
  if (lineDataM.length > 1) {
    linesG.append("path")
      .datum(lineDataM)
      .attr("class", "line male-line")
      .attr("fill", "none")
      .attr("stroke", color.M)
      .attr("stroke-width", 2)
      .attr("d", lineGen)
      .attr("opacity", 0.9);
  }
  
  if (lineDataF.length > 1) {
    linesG.append("path")
      .datum(lineDataF)
      .attr("class", "line female-line")
      .attr("fill", "none")
      .attr("stroke", color.F)
      .attr("stroke-width", 2)
      .attr("d", lineGen)
      .attr("opacity", 0.9);
  }
  
  // dots
  dotsG.selectAll(".dot-male").remove();
  dotsG.selectAll(".dot-female").remove();
  
  dotsG.selectAll(".dot-male")
    .data(dataM.filter(d => d.best != null))
    .enter().append("circle")
    .attr("class", "dot-male")
    .attr("r", 4)
    .attr("cx", d => x(d.yearDate))
    .attr("cy", d => y(d.best))
    .attr("fill", color.M)
    .attr("stroke", "#fff")
    .on("mouseover", (event, d) => showTooltip(event, d))
    .on("mousemove", (event, d) => moveTooltip(event))
    .on("mouseout", hideTooltip);
  
  dotsG.selectAll(".dot-female")
    .data(dataF.filter(d => d.best != null))
    .enter().append("circle")
    .attr("class", "dot-female")
    .attr("r", 4)
    .attr("cx", d => x(d.yearDate))
    .attr("cy", d => y(d.best))
    .attr("fill", color.F)
    .attr("stroke", "#fff")
    .on("mouseover", (event, d) => showTooltip(event, d))
    .on("mousemove", (event, d) => moveTooltip(event))
    .on("mouseout", hideTooltip);
  
  // brush preview - create combined timeline
  const allYears = new Set([...dataM.map(d => d.year), ...dataF.map(d => d.year)]);
  const brushPreview = [];
  
  Array.from(allYears).sort((a, b) => a - b).forEach(year => {
    const mData = dataM.find(d => d.year === year);
    const fData = dataF.find(d => d.year === year);
    const val = d3.max([mData?.best, fData?.best].filter(v => v != null));
    
    if (val != null && !isNaN(val)) {
      brushPreview.push({ 
        yearDate: new Date(year, 0, 1), 
        best: val 
      });
    }
  });
  
  brushG.selectAll(".brush-area").remove();
  
  if (brushPreview.length > 0) {
    const brushArea = d3.area()
      .x(d => brushX(d.yearDate))
      .y0(brushInnerHeight)
      .y1(d => brushInnerHeight - (d.best ? (d.best / yMax) * brushInnerHeight : 0));
    
    brushG.append("path")
      .datum(brushPreview)
      .attr("class", "brush-area")
      .attr("fill", "#4a90e2")
      .attr("opacity", 0.2)
      .attr("d", brushArea);
  }
  
  const brushTicks = [
    new Date(yearsExtent[0].getFullYear(), 0, 1),
    new Date(yearsExtent[1].getFullYear(), 0, 1)
  ];
  
  brushXAxisG.call(
    d3.axisBottom(brushX)
      .tickValues(brushTicks)
      .tickFormat(d3.timeFormat("%Y"))
  );
  
  // brush
  brush = d3.brushX()
    .extent([[0, 0], [innerWidth, brushInnerHeight]])
    .on("end", brushed);
  
  brushG.selectAll(".brush").remove();
  brushG.append("g").attr("class", "brush").call(brush);
  
  // ganze Spanne vorselektieren
  brushG.select(".brush").call(brush.move, [0, innerWidth]);
  
  // double click reset
  brushG.on("dblclick", () => {
    x.domain(yearsExtent);
    xAxisG.transition().duration(600).call(xAxis);
    updatePositions();
  });
  
  function updatePositions() {
    svg.selectAll(".male-line").attr("d", lineGen);
    svg.selectAll(".female-line").attr("d", lineGen);
    dotsG.selectAll(".dot-male")
      .attr("cx", d => x(d.yearDate))
      .attr("cy", d => y(d.best));
    dotsG.selectAll(".dot-female")
      .attr("cx", d => x(d.yearDate))
      .attr("cy", d => y(d.best));
  }
}

// tooltip
function showTooltip(event, d) {
  if (!d) return;
  const bw = d.bodyweight ? `${(+d.bodyweight).toFixed(1)} kg` : "n/a";
  const tested = d.tested || "n/a";
  const division = d.division || "n/a";
  const equipment = d.equipment || "n/a";
  const html = `
    ${d.name || "(unknown athlete)"}<br>
    Sex: ${d.sex} • ${d.category}<br>
    Year: ${d.year} • ${d.best ? d.best.toFixed(1) + " kg" : "n/a"}<br>
    BW: ${bw} • Equipment: ${equipment}<br>
    ${d.country ? d.country + " • " : ""}${d.federation || ""}<br>
    Division: ${division} • Tested: ${tested}<br>
    Meet: ${d.meet || ""}
  `;
  tooltip.style("display", "block").html(html);
  moveTooltip(event);
}

function moveTooltip(event) {
  tooltip
    .style("left", (event.pageX + 14) + "px")
    .style("top", (event.pageY + 14) + "px");
}

function hideTooltip() {
  tooltip.style("display", "none");
}

// brushed
function brushed(event) {
  const s = event.selection;
  if (!s) return;
  
  const [x0, x1] = s;
  const start = brushX.invert(x0);
  const end   = brushX.invert(x1);
  
  x.domain([start, end]);
  
  xAxisG.transition().duration(500).call(
    d3.axisBottom(x)
      .ticks(d3.timeYear.every(2))
      .tickFormat(d3.timeFormat("%Y"))
  );
  
  dotsG.selectAll(".dot-male")
    .transition().duration(500)
    .attr("cx", d => x(d.yearDate))
    .attr("cy", d => y(d.best));
  
  dotsG.selectAll(".dot-female")
    .transition().duration(500)
    .attr("cx", d => x(d.yearDate))
    .attr("cy", d => y(d.best));
  
  linesG.selectAll(".male-line")
    .transition().duration(500)
    .attr("d", lineGen);
  
  linesG.selectAll(".female-line")
    .transition().duration(500)
    .attr("d", lineGen);
}