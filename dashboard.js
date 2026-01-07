// Add to <head> in index.html: <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

// In boot() or bindTopControls()
$$  ('#generatePdfBtn')?.addEventListener('click', generatePdfReport);

async function generatePdfReport() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFont('Inter', 'normal');
  doc.setFontSize(18);
  doc.text('Wheat Campaign Report', 20, 20);
  doc.setFontSize(12);
  doc.text(`Campaign: ${state.campaign.name}`, 20, 30);
  doc.text(`Sessions: ${state.filteredSessions.length}`, 20, 40);
  // Add KPI data
  const kpis = computeKpis(); // Assume function from existing code
  doc.text(`Farmers Reached: ${kpis.farmers}`, 20, 50);
  // Embed chart as image (canvas.toDataURL)
  const chartCanvas = document.querySelector('.chartWrap canvas'); // Example from donut
  if (chartCanvas) {
    const imgData = chartCanvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 20, 60, 100, 50);
  }
  doc.save(`${state.campaignId}_report.pdf`);
}
