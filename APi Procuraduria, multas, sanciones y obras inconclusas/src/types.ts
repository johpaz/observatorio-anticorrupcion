export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface Fiscal {
  id: number;
  responsable: string;
  documento: string;
  entidad_afectada: string;
  tr: string;
  r: string;
  ente_reporta: string;
  departamento: string;
  municipio: string;
}

export interface Penal {
  id: number;
  departamento: string;
  municipio_id: number;
  codigo_dane: number;
  municipio: string;
  titulo: string;
  capitulo: string;
  articulo: string;
  anio: number;
}

export interface Disciplinario {
  id: number;
  id_sancion: string;
  tipo_sancion: string;
  tipo_afectado: string;
  tipo_documento: string;
  documento: string;
  apellido1: string;
  apellido2: string;
  nombre1: string;
  nombre2: string;
  cargo: string;
  depto_origen: string;
  mpio_origen: string;
  tipo_sancion_aplicada: string;
  duracion_anos: number | null;
  nivel: string;
  entidad_responsable: string;
  fecha_sancion: string;
  acto_administrativo: string;
  institucion: string;
  depto_institucion: string;
  mpio_institucion: string;
  anio: number | null;
  mes: number | null;
  dia: number | null;
}

export interface Multa {
  id: number;
  entidad: string;
  nit_entidad: string;
  nivel: string;
  tipo: string;
  resolucion: string;
  cedula_responsable: string;
  nombre_responsable: string;
  ref_contrato: string;
  valor_multa: number | null;
  fecha_imposicion: string;
  url: string;
}

export interface Obra {
  id: number;
  cod_entidad: string;
  cod_obra: string;
  departamento: string;
  ciudad: string;
  sector: string;
  grupo: string;
  nombre_entidad: string;
  objeto: string;
  valor_contrato: number | null;
  fecha_inicio: string;
  estado: string;
  clase_obra: string;
  avance: number | null;
  identificacion: string;
  nombre_contratista: string;
}
