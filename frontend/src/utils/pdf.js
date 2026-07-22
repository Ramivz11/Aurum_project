// jspdf + jspdf-autotable pesan ~400KB: se descargan recién cuando el usuario
// exporta un PDF, no al abrir la app (clave en conexiones móviles).
export async function loadPdf() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  return { jsPDF, autoTable }
}
