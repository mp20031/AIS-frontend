export const moduleStatuses = [
  {
    name: 'Planilla',
    status: 'Activo',
    tone: 'green',
    detail: '142 boletas procesadas este mes',
  },
  {
    name: 'Clinica',
    status: 'Proximamente',
    tone: 'gray',
    detail: 'Lanzamiento estimado Q4 2026',
  },
  {
    name: 'Activo Fijo',
    status: 'Proximamente',
    tone: 'gray',
    detail: 'Lanzamiento estimado Q1 2027',
  },
  {
    name: 'Personal Docente',
    status: 'En progreso',
    tone: 'orange',
    detail: 'En configuracion - 60% completo',
  },
  {
    name: 'Formacion',
    status: 'En progreso',
    tone: 'orange',
    detail: 'Piloto activo en 2 sedes',
  },
  {
    name: 'Sedes / Obras',
    status: 'Activo',
    tone: 'green',
    detail: '6 sedes reportando',
  },
]

export const controlStats = [
  { label: 'Personal Activo', value: '482', detail: '+3.2% este mes' },
  { label: 'Presupuesto Ejecutado', value: '$128.4K', detail: '84% de la meta' },
  { label: 'Sedes Activas', value: '6', detail: 'El Salvador / C.A.' },
  { label: 'Planilla Pendiente', value: '$42.8K', detail: 'Cierre en 4 dias', alert: true },
]

export const payrollBars = [
  { label: 'Santa Tecla', value: 92, color: 'red' },
  { label: 'Soyapango', value: 54, color: 'gray' },
  { label: 'Ricaldone', value: 79, color: 'red' },
  { label: 'Ayagualo', value: 33, color: 'warm' },
]

export const roleDistribution = [
  { label: 'Docentes Tiempo Completo', value: '58%', highlight: true },
  { label: 'Personal Administrativo', value: '26%' },
  { label: 'Mantenimiento y Servicios', value: '16%' },
]
