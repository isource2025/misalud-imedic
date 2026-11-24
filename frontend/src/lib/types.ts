export type Cuenta = {
  dni: string;
  nombreCompleto: string;
  nombre: string;
  sexo: "M" | "F" | "X";
  email: string;
  telefono: string | null;
  fechaNacimiento: string | null;
  emailVerificado: boolean;
  identidadVerificada: boolean;
  metodoIdentidad: string | null;
  creadoEn: string;
};

export type TipoAtencion = "ambulatorio" | "internacion" | "hospital_dia" | "otro";

export type Diagnostico = { codigo: string | null; descripcion: string | null };

export type Atencion = {
  id: string;
  clinica: { id: number; nombre: string };
  centro: string | null;
  profesional: string | null;
  especialidad: string | null;
  tipo: TipoAtencion;
  tipoLabel: string;
  fechaIngreso: string;
  horaIngreso: string | null;
  fechaEgreso: string | null;
  servicio: string | null;
  diagnostico: Diagnostico | null;
  secciones: { hcIngreso: boolean; epicrisis: boolean; adjuntos: number };
};

export type TipoAdjunto = "pdf" | "imagen" | "dicom" | "video" | "documento" | "otro";

export type Adjunto = {
  id: string;
  nombre: string;
  extension: string | null;
  tipo: TipoAdjunto;
  vistaPrevia: boolean;
  categoria: string | null;
  fecha: string | null;
};

export type AdjuntosResponse = { adjuntos: Adjunto[]; publicados: boolean };

export type PacsEstudio = {
  id: string;
  fecha: string | null;
  descripcion: string;
  modalidad: string | null;
  seriesCount: number | null;
  instanceCount: number | null;
};

export type PacsSerie = {
  id: string;
  number: number;
  modality: string | null;
  description: string | null;
  instanceCount: number | null;
};

export type PacsArchivo = {
  id: string;
  nombre: string;
  size: number | null;
  seriesUid: string | null;
  /** Ruta relativa al estudio en el bridge (p. ej. SeriesUID/img.dcm). */
  ruta?: string | null;
};

export type PacsResponse = {
  publicados: boolean;
  disponible: boolean;
  desde: string | null;
  hasta: string | null;
  egresada: boolean;
  estudios: PacsEstudio[];
};

export type HcIngreso = {
  fecha: string;
  hora: string | null;
  motivoConsulta: string | null;
  enfermedadActual: string | null;
  textos?: { titulo: string; texto: string }[];
  secciones?: { titulo: string; campos: { campo: string; valor: string }[] }[];
  profesional: string | null;
  sector: string | null;
};

export type Epicrisis = {
  fecha: string;
  hora: string | null;
  texto: string | null;
  diagnostico: Diagnostico | null;
  profesional: string | null;
  sector: string | null;
};

export type AtencionDetalle = Atencion & {
  diagnosticoEgreso: Diagnostico | null;
  hcIngreso: HcIngreso[];
  epicrisis: Epicrisis[];
};

export type ClinicaRef = { id: number; nombre: string };

export type AtencionesResponse = {
  atenciones: Atencion[];
  clinicas: ClinicaRef[];
  clinicasNoDisponibles: ClinicaRef[];
};

export type ClinicaVinculo = {
  id: number;
  nombre: string;
  estado: "vinculada" | "pendiente" | "sin_registros";
  fichasConfirmadas: number;
  fichasPendientes: number;
  verificadoEn: string | null;
};

export type BusquedaClinica = {
  id: number;
  nombre: string;
  disponible: boolean;
  confirmado?: number;
  pendiente?: number;
  descartado?: number;
};
