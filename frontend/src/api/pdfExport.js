import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

/**
 * Exporta el contenido HTML de un elemento a PDF
 * @param {string} elementId - ID del elemento DOM a exportar
 * @param {string} filename - Nombre del archivo PDF (sin extensión)
 * @param {string} title - Título opcional para el documento
 */
export const exportElementToPDF = async (elementId, filename, title) => {
  try {
    const element = document.getElementById(elementId)
    if (!element) throw new Error(`Elemento con ID "${elementId}" no encontrado`)

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const canvasWidth = canvas.width
    const canvasHeight = canvas.height
    const ratio = pdfWidth / canvasWidth

    let yPosition = 10

    // Agregar título si se proporciona
    if (title) {
      pdf.setFontSize(16)
      pdf.text(title, pdfWidth / 2, yPosition, { align: 'center' })
      yPosition += 15
    }

    // Agregar fecha
    const today = new Date().toLocaleDateString('es-AR')
    pdf.setFontSize(10)
    pdf.text(`Fecha: ${today}`, pdfWidth / 2, yPosition, { align: 'center' })
    yPosition += 10

    // Agregar imagen del contenido
    const scaledHeight = canvasHeight * ratio
    pdf.addImage(imgData, 'PNG', 0, yPosition, pdfWidth, scaledHeight)

    // Si el contenido es más largo que una página, agregar más páginas
    let remainingHeight = scaledHeight - (pdfHeight - yPosition - 10)
    while (remainingHeight > 0) {
      pdf.addPage()
      yPosition = -scaledHeight + (pdfHeight - 10)
      pdf.addImage(imgData, 'PNG', 0, yPosition, pdfWidth, scaledHeight)
      remainingHeight -= pdfHeight - 20
    }

    // Descargar el PDF
    pdf.save(`${filename}-${new Date().toISOString().split('T')[0]}.pdf`)
  } catch (error) {
    console.error('Error al exportar a PDF:', error)
    throw new Error(`No se pudo exportar a PDF: ${error.message}`)
  }
}

/**
 * Exporta una tabla a PDF con un formato mejorado
 * @param {Array} data - Datos a exportar
 * @param {Array} columns - Configuración de columnas {key, label, width}
 * @param {string} filename - Nombre del archivo
 * @param {string} title - Título del documento
 */
export const exportTableToPDF = (data, columns, filename, title) => {
  try {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    let yPosition = 15

    // Título
    pdf.setFontSize(16)
    pdf.text(title || 'Reporte', pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 10

    // Fecha
    const today = new Date().toLocaleDateString('es-AR')
    pdf.setFontSize(10)
    pdf.text(`Fecha: ${today}`, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 8

    // Encabezados de tabla
    pdf.setFontSize(11)
    pdf.setTextColor(255, 255, 255)
    pdf.setFillColor(70, 130, 180)

    let xPosition = 10
    const columnWidths = columns.map(col => col.width || pageWidth / columns.length)

    columns.forEach((col, index) => {
      pdf.rect(xPosition, yPosition, columnWidths[index], 8, 'F')
      pdf.text(col.label, xPosition + 2, yPosition + 5.5, { maxWidth: columnWidths[index] - 4 })
      xPosition += columnWidths[index]
    })

    yPosition += 8

    // Datos de la tabla
    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(9)

    data.forEach((row, rowIndex) => {
      if (yPosition + 7 > pageHeight - 10) {
        pdf.addPage()
        yPosition = 15
        // Repetir encabezados en nueva página
        pdf.setFillColor(70, 130, 180)
        pdf.setTextColor(255, 255, 255)
        xPosition = 10
        columns.forEach((col, index) => {
          pdf.rect(xPosition, yPosition, columnWidths[index], 8, 'F')
          pdf.text(col.label, xPosition + 2, yPosition + 5.5, { maxWidth: columnWidths[index] - 4 })
          xPosition += columnWidths[index]
        })
        yPosition += 8
        pdf.setTextColor(0, 0, 0)
      }

      xPosition = 10
      columns.forEach((col, index) => {
        const value = String(row[col.key] || '')
        pdf.text(value.substring(0, 50), xPosition + 2, yPosition + 5, { maxWidth: columnWidths[index] - 4 })
        xPosition += columnWidths[index]
      })

      // Línea divisoria
      pdf.setDrawColor(200, 200, 200)
      pdf.line(10, yPosition + 6.5, pageWidth - 10, yPosition + 6.5)
      yPosition += 7
    })

    pdf.save(`${filename}-${new Date().toISOString().split('T')[0]}.pdf`)
  } catch (error) {
    console.error('Error al exportar tabla a PDF:', error)
    throw new Error(`No se pudo exportar la tabla: ${error.message}`)
  }
}

/**
 * Exporta datos simples a PDF
 * @param {string} content - Contenido HTML o texto
 * @param {string} filename - Nombre del archivo
 * @param {string} title - Título del documento
 */
export const exportContentToPDF = (content, filename, title) => {
  try {
    const pdf = new jsPDF({
      unit: 'mm',
      format: 'a4',
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    let yPosition = 20

    // Título
    pdf.setFontSize(16)
    pdf.text(title || 'Documento', pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 15

    // Fecha
    const today = new Date().toLocaleDateString('es-AR')
    pdf.setFontSize(10)
    pdf.text(`Fecha: ${today}`, 10, yPosition)
    yPosition += 15

    // Contenido
    pdf.setFontSize(11)
    const splitText = pdf.splitTextToSize(content, pageWidth - 20)

    splitText.forEach((line, index) => {
      if (yPosition + 7 > pageHeight - 10) {
        pdf.addPage()
        yPosition = 20
      }
      pdf.text(line, 10, yPosition)
      yPosition += 7
    })

    pdf.save(`${filename}-${new Date().toISOString().split('T')[0]}.pdf`)
  } catch (error) {
    console.error('Error al exportar contenido a PDF:', error)
    throw new Error(`No se pudo exportar el contenido: ${error.message}`)
  }
}
