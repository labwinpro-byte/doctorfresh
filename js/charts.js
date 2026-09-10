/* SmartOmbor ERP - Chart Renderer for Savdo Statistikasi */

let salesChartInstance = null;

function renderSalesChart(filterType = 'weekly') {
  const ctx = document.getElementById('salesChartCanvas');
  if (!ctx) return;

  if (typeof syncGlobalState === 'function') {
    syncGlobalState();
  }

  const chartData = (demoData && demoData.chartData && demoData.chartData[filterType]) ? demoData.chartData[filterType] : (demoData.chartData?.weekly || { labels: [], datasets: [{ label: '', data: [] }] });

  if (typeof Chart !== 'undefined') {
    // If Chart.js is loaded
    if (salesChartInstance) {
      salesChartInstance.destroy();
      salesChartInstance = null;
    }

    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.25)');
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)');

    salesChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: [{
          label: chartData.datasets[0].label,
          data: chartData.datasets[0].data,
          borderColor: '#2563EB',
          borderWidth: 3,
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#FFFFFF',
          pointBorderColor: '#2563EB',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#0F172A',
            titleFont: { family: 'Inter', size: 13 },
            bodyFont: { family: 'Inter', size: 14, weight: 'bold' },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                const val = context.parsed.y;
                if (val === 0) return '0 UZS';
                const sumUz = Math.round(val * 1000000);
                return sumUz.toLocaleString('uz-UZ') + ' UZS (' + val + ' mln)';
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: { family: 'Inter', size: 12 },
              color: '#64748B'
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: '#F1F5F9'
            },
            ticks: {
              font: { family: 'Inter', size: 12 },
              color: '#64748B',
              callback: function(val) {
                return val + ' mln';
              }
            }
          }
        }
      }
    });
  } else {
    // Fallback Canvas drawing if Chart.js is not loaded from CDN
    const canvasCtx = ctx.getContext('2d');
    const width = ctx.clientWidth || 600;
    const height = ctx.clientHeight || 260;
    ctx.width = width;
    ctx.height = height;

    canvasCtx.clearRect(0, 0, width, height);

    const labels = chartData.labels;
    const data = chartData.datasets[0].data;
    const maxVal = Math.max(...data, 1) * 1.2;
    const stepX = labels.length > 1 ? (width - 60) / (labels.length - 1) : (width - 60);

    // Draw Grid Lines
    canvasCtx.strokeStyle = '#F1F5F9';
    canvasCtx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = height - 40 - (i * (height - 60) / 4);
      canvasCtx.beginPath();
      canvasCtx.moveTo(40, y);
      canvasCtx.lineTo(width - 20, y);
      canvasCtx.stroke();
    }

    // Draw Line
    canvasCtx.beginPath();
    canvasCtx.strokeStyle = '#2563EB';
    canvasCtx.lineWidth = 3;

    const points = [];
    data.forEach((val, i) => {
      const x = 40 + i * stepX;
      const y = height - 40 - (val / maxVal * (height - 60));
      points.push({ x, y, val });
      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
    });
    canvasCtx.stroke();

    // Draw Points & Labels
    points.forEach((p, i) => {
      canvasCtx.beginPath();
      canvasCtx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      canvasCtx.fillStyle = '#FFFFFF';
      canvasCtx.fill();
      canvasCtx.strokeStyle = '#2563EB';
      canvasCtx.lineWidth = 2;
      canvasCtx.stroke();

      canvasCtx.fillStyle = '#64748B';
      canvasCtx.font = '11px Inter, sans-serif';
      canvasCtx.textAlign = 'center';
      canvasCtx.fillText(labels[i], p.x, height - 15);
    });
  }
}

