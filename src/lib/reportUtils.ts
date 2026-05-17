import { format, parseISO } from 'date-fns'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { Vehicle, Maintenance } from '@/types'

function parseDate(dateStr?: string): Date | null {
  if (!dateStr) return null
  try {
    const date = parseISO(dateStr.replace(' ', 'T'))
    return Number.isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

function formatDate(dateStr?: string): string {
  const date = parseDate(dateStr)
  return date ? format(date, 'dd/MM/yyyy') : ''
}

function formatServices(services?: string[] | string): string {
  if (!services) return ''
  if (Array.isArray(services)) return services.join(', ')
  try {
    const parsed = JSON.parse(services)
    return Array.isArray(parsed) ? parsed.join(', ') : String(parsed)
  } catch {
    return services
  }
}

function buildReportRows(vehicles: Vehicle[], maintenances: Maintenance[], vehicleId?: string) {
  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]))
  const rows = maintenances
    .filter((m) => !vehicleId || m.vehicle_id === vehicleId)
    .map((m) => {
      const vehicle = vehicleMap.get(m.vehicle_id)
      const maintenanceDate = parseDate(m.date) ?? parseDate(m.created_at)
      return {
        vehicle_plate: vehicle?.plate_number ?? 'Vehículo eliminado',
        vehicle_brand: vehicle?.brand ?? '',
        vehicle_model: vehicle?.model ?? '',
        vehicle_year: vehicle?.manufacture_year ?? '',
        maintenance_date: formatDate(m.date),
        maintenance_type: m.type === 'regular' ? 'Regular' : 'Adicional',
        current_mileage: m.current_mileage ?? '',
        next_mileage: m.next_mileage ?? '',
        performed_by: m.performed_by ?? '',
        location: m.location ?? '',
        services: formatServices(m.services),
        notes: m.notes ?? '',
        receipt_photo: m.receipt_photo ?? '',
        detail_photo: m.detail_photo ?? '',
        created_at: formatDate(m.created_at),
        maintenance_date_sort: maintenanceDate?.getTime() ?? 0,
      }
    })

  return rows.sort((a, b) => b.maintenance_date_sort - a.maintenance_date_sort)
}

export function getReportVehicles(vehicles: Vehicle[], maintenances: Maintenance[]): Vehicle[] {
  const vehicleIds = new Set(maintenances.map((m) => m.vehicle_id))
  return vehicles.filter((v) => vehicleIds.has(v.id)).sort((a, b) => a.plate_number.localeCompare(b.plate_number))
}

export function exportMaintenanceReportExcel(
  vehicles: Vehicle[],
  maintenances: Maintenance[],
  title: string,
  singleVehicleId?: string
) {
  const workbook = XLSX.utils.book_new()
  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]))

  if (singleVehicleId) {
    // Single vehicle report
    const vehicle = vehicleMap.get(singleVehicleId)
    const rows = buildReportRows(vehicles, maintenances, singleVehicleId)
    const sheetData = rows.map((row) => ({
      'Fecha mantenimiento': row.maintenance_date,
      'Tipo': row.maintenance_type,
      'Kilometraje actual': row.current_mileage,
      'Próximo km': row.next_mileage,
      'Realizado por': row.performed_by,
      'Realizado en': row.location,
      'Servicios': row.services,
      'Notas': row.notes,
      'Recibo': row.receipt_photo,
      'Detalle': row.detail_photo,
      'Fecha creación': row.created_at,
    }))

    const reportTitle = `Mantenimiento de ${vehicle?.plate_number ?? ''} ${vehicle?.brand ?? ''} ${vehicle?.model ?? ''} ${vehicle?.manufacture_year ?? ''}`.trim()
    const summaryRows = [
      [reportTitle],
      [],
      ['Marca', vehicle?.brand ?? '', 'Modelo', vehicle?.model ?? ''],
      ['Año', vehicle?.manufacture_year ?? '', 'PSI', vehicle?.air_pressure != null ? `${vehicle.air_pressure} PSI` : ''],
      ['Vencimiento SOAT', formatDate(vehicle?.soat_expiry), 'Vencimiento Rev. Técnica', formatDate(vehicle?.tech_review_next)],
      ['Vencimiento Extintor', formatDate(vehicle?.extinguisher_renewal), '', ''],
      [],
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(summaryRows)
    XLSX.utils.sheet_add_json(worksheet, sheetData, { origin: 'A12' })
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte')
  } else {
    // General report with one sheet per vehicle
    const reportVehicles = getReportVehicles(vehicles, maintenances)
    
    // Add one sheet per vehicle
    reportVehicles.forEach((vehicle) => {
      const rows = buildReportRows(vehicles, maintenances, vehicle.id)
      const sheetData = rows.map((row) => ({
        'Fecha mantenimiento': row.maintenance_date,
        'Tipo': row.maintenance_type,
        'Kilometraje actual': row.current_mileage,
        'Próximo km': row.next_mileage,
        'Realizado por': row.performed_by,
        'Realizado en': row.location,
        'Servicios': row.services,
        'Notas': row.notes,
        'Recibo': row.receipt_photo,
        'Detalle': row.detail_photo,
        'Fecha creación': row.created_at,
      }))

      const reportTitle = `Mantenimiento de ${vehicle.plate_number} ${vehicle.brand ?? ''} ${vehicle.model ?? ''} ${vehicle.manufacture_year ?? ''}`.trim()
      const summaryRows = [
        [reportTitle],
        [],
        ['Marca', vehicle.brand ?? '', 'Modelo', vehicle.model ?? ''],
        ['Año', vehicle.manufacture_year ?? '', 'PSI', vehicle.air_pressure != null ? `${vehicle.air_pressure} PSI` : ''],
        ['Vencimiento SOAT', formatDate(vehicle.soat_expiry), 'Vencimiento Rev. Técnica', formatDate(vehicle.tech_review_next)],
        ['Vencimiento Extintor', formatDate(vehicle.extinguisher_renewal), '', ''],
        [],
      ]

      const worksheet = XLSX.utils.aoa_to_sheet(summaryRows)
      XLSX.utils.sheet_add_json(worksheet, sheetData, { origin: 'A12' })
      const sheetName = vehicle.plate_number.replace(/[/:?*[\]]/g, '').substring(0, 31)
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    })
  }

  const fileName = `${title.replace(/\s+/g, '_').toLowerCase()}.xlsx`
  XLSX.writeFile(workbook, fileName)
}

export function exportMaintenanceReportPDF(
  vehicles: Vehicle[],
  maintenances: Maintenance[],
  title: string,
  singleVehicleId?: string
) {
  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]))

  if (singleVehicleId) {
    // Single vehicle report
    const vehicle = vehicleMap.get(singleVehicleId)
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const rows = buildReportRows(vehicles, maintenances, singleVehicleId)
    const pageTitle = `Mantenimiento de ${vehicle?.plate_number ?? ''} ${vehicle?.brand ?? ''} ${vehicle?.model ?? ''} ${vehicle?.manufacture_year ?? ''}`.trim()

    doc.setFontSize(14)
    doc.text(pageTitle, 40, 40)
    doc.setFontSize(10)
    doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 40, 56)

    const leftColumn = [
      `Marca: ${vehicle?.brand ?? ''}`,
      `Modelo: ${vehicle?.model ?? ''}`,
      `Año: ${vehicle?.manufacture_year ?? ''}`,
      `Vencimiento SOAT: ${formatDate(vehicle?.soat_expiry)}`,
    ]
    const rightColumn = [
      `Vencimiento Rev. Técnica: ${formatDate(vehicle?.tech_review_next)}`,
      `Vencimiento Extintor: ${formatDate(vehicle?.extinguisher_renewal)}`,
      `PSI: ${vehicle?.air_pressure != null ? `${vehicle.air_pressure} PSI` : ''}`,
    ]

    const leftX = 40
    const rightX = 320
    let currentY = 76
    leftColumn.forEach((line, index) => {
      doc.text(line, leftX, currentY)
      if (rightColumn[index]) {
        doc.text(rightColumn[index], rightX, currentY)
      }
      currentY += 14
    })

    const tableColumns = [
      { header: 'Fecha', dataKey: 'maintenance_date' },
      { header: 'Tipo', dataKey: 'maintenance_type' },
      { header: 'Km actual', dataKey: 'current_mileage' },
      { header: 'Próximo km', dataKey: 'next_mileage' },
      { header: 'Realizado por', dataKey: 'performed_by' },
      { header: 'Realizado en', dataKey: 'location' },
      { header: 'Servicios', dataKey: 'services' },
      { header: 'Notas', dataKey: 'notes' },
    ]

    autoTable(doc, {
      startY: currentY + 10,
      head: [tableColumns.map((column) => column.header)],
      body: rows.map((row) => tableColumns.map((column) => (row as any)[column.dataKey])),
      styles: { fontSize: 8, cellPadding: 4 },
      theme: 'striped',
      headStyles: { fillColor: [22, 101, 210] },
      didDrawPage: (_data) => {
        const page = (doc.internal as any).getNumberOfPages()
        doc.setFontSize(9)
        doc.text(`Página ${page}`, doc.internal.pageSize.getWidth() - 60, doc.internal.pageSize.getHeight() - 20)
      },
      margin: { left: 40, right: 20, top: 70, bottom: 40 },
    })

    doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`)
  } else {
    // General report with one page per vehicle
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const reportVehicles = getReportVehicles(vehicles, maintenances)
    let firstPage = true

    reportVehicles.forEach((vehicle) => {
      if (!firstPage) {
        doc.addPage()
      }
      firstPage = false

      const rows = buildReportRows(vehicles, maintenances, vehicle.id)
      const pageTitle = `Mantenimiento de ${vehicle.plate_number} ${vehicle.brand ?? ''} ${vehicle.model ?? ''} ${vehicle.manufacture_year ?? ''}`.trim()

      doc.setFontSize(14)
      doc.text(pageTitle, 40, 40)
      doc.setFontSize(10)
      doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 40, 56)

      const leftColumn = [
        `Marca: ${vehicle.brand ?? ''}`,
        `Modelo: ${vehicle.model ?? ''}`,
        `Año: ${vehicle.manufacture_year ?? ''}`,
        `Vencimiento SOAT: ${formatDate(vehicle.soat_expiry)}`,
      ]
      const rightColumn = [
        `Vencimiento Rev. Técnica: ${formatDate(vehicle.tech_review_next)}`,
        `Vencimiento Extintor: ${formatDate(vehicle.extinguisher_renewal)}`,
        `PSI: ${vehicle.air_pressure != null ? `${vehicle.air_pressure} PSI` : ''}`,
      ]

      const leftX = 40
      const rightX = 320
      let currentY = 76
      leftColumn.forEach((line, index) => {
        doc.text(line, leftX, currentY)
        if (rightColumn[index]) {
          doc.text(rightColumn[index], rightX, currentY)
        }
        currentY += 14
      })

      const tableColumns = [
        { header: 'Fecha', dataKey: 'maintenance_date' },
        { header: 'Tipo', dataKey: 'maintenance_type' },
        { header: 'Km actual', dataKey: 'current_mileage' },
        { header: 'Próximo km', dataKey: 'next_mileage' },
        { header: 'Realizado por', dataKey: 'performed_by' },
        { header: 'Realizado en', dataKey: 'location' },
        { header: 'Servicios', dataKey: 'services' },
        { header: 'Notas', dataKey: 'notes' },
      ]

      autoTable(doc, {
        startY: currentY + 10,
        head: [tableColumns.map((column) => column.header)],
        body: rows.map((row) => tableColumns.map((column) => (row as any)[column.dataKey])),
        styles: { fontSize: 8, cellPadding: 4 },
        theme: 'striped',
        headStyles: { fillColor: [22, 101, 210] },
        didDrawPage: (_data) => {
          const page = (doc.internal as any).getNumberOfPages()
          doc.setFontSize(9)
          doc.text(`Página ${page}`, doc.internal.pageSize.getWidth() - 60, doc.internal.pageSize.getHeight() - 20)
        },
        margin: { left: 40, right: 20, top: 70, bottom: 40 },
      })
    })

    doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`)
  }
}
