
export interface ProcessingLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface FileData {
  file: File;
  content?: string;
  dataUrl?: string;
  arrayBuffer?: ArrayBuffer;
}

export enum ConversionStatus {
  IDLE = 'IDLE',
  READING = 'READING',
  PARSING = 'PARSING',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export enum ConversionMode {
  MD_TO_DOCX = 'MD_TO_DOCX',
  DOCX_TO_MD = 'DOCX_TO_MD'
}
