export const roles = [
  { id: 'admin', name: 'Administrador', description: 'Acceso total a modulos y configuraciones', users: 12 },
  { id: 'rrhh', name: 'RRHH', description: 'Gestion de personal, planilla y clinica', users: 34 },
  { id: 'docente', name: 'Docente', description: 'Formacion y consulta de horarios', users: 1402 },
  { id: 'consulta', name: 'Consulta', description: 'Solo lectura, sin permisos de edicion', users: 122 },
]

export const visibleModules = [
  'Dashboard',
  'Planilla',
  'Clinica',
  'Activo Fijo',
  'Personal Docente',
  'Formacion',
]
