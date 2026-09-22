export type BarColor = 'red' | 'gray' | 'warm'

export interface ControlStat {
  label: string
  value: string
  detail: string
  alert?: boolean
}

export interface PayrollBar {
  label: string
  value: number
  color: BarColor
}

export interface RoleDistributionItem {
  label: string
  value: string
  highlight?: boolean
}

export const controlStats: ControlStat[] = [
  { label: 'Personal Activo', value: '482', detail: '+3.2% este mes' },
  { label: 'Presupuesto Ejecutado', value: '$128.4K', detail: '84% de la meta' },
  { label: 'Sedes Activas', value: '6', detail: 'El Salvador / C.A.' },
  { label: 'Planilla Pendiente', value: '$42.8K', detail: 'Cierre en 4 dias', alert: true },
]

export const payrollBars: PayrollBar[] = [
  { label: 'Santa Tecla', value: 92, color: 'red' },
  { label: 'Soyapango', value: 54, color: 'gray' },
  { label: 'Ricaldone', value: 79, color: 'red' },
  { label: 'Ayagualo', value: 33, color: 'warm' },
]

export const roleDistribution: RoleDistributionItem[] = [
  { label: 'Docentes Tiempo Completo', value: '58%', highlight: true },
  { label: 'Personal Administrativo', value: '26%' },
  { label: 'Mantenimiento y Servicios', value: '16%' },
]
