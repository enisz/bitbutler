import {
  IconDefinition,
  faFile,
  faFileAudio,
  faFileCode,
  faFileCsv,
  faFileExcel,
  faFileImage,
  faFileLines,
  faFilePdf,
  faFilePowerpoint,
  faFileVideo,
  faFileWord,
  faFileZipper,
} from '@fortawesome/free-solid-svg-icons';
import mime from 'mime';

const MIME_ICON_MAP: Record<string, IconDefinition> = {
  // Documents
  'application/pdf': faFilePdf,
  'application/msword': faFileWord,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': faFileWord,
  'application/vnd.oasis.opendocument.text': faFileWord,

  // Spreadsheets / data tables
  'application/vnd.ms-excel': faFileExcel,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': faFileExcel,
  'application/vnd.oasis.opendocument.spreadsheet': faFileExcel,
  'text/csv': faFileCsv,
  'text/tab-separated-values': faFileCsv,

  // Presentations
  'application/vnd.ms-powerpoint': faFilePowerpoint,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': faFilePowerpoint,
  'application/vnd.oasis.opendocument.presentation': faFilePowerpoint,

  // Archives / compressed files
  'application/zip': faFileZipper,
  'application/x-7z-compressed': faFileZipper,
  'application/vnd.rar': faFileZipper,
  'application/x-rar-compressed': faFileZipper,
  'application/x-tar': faFileZipper,
  'application/gzip': faFileZipper,
  'application/x-gzip': faFileZipper,
  'application/x-bzip2': faFileZipper,
  'application/x-bittorrent': faFileZipper,

  // Code / markup / config
  'application/json': faFileCode,
  'application/xml': faFileCode,
  'application/javascript': faFileCode,
  'text/javascript': faFileCode,
  'text/html': faFileCode,
  'text/css': faFileCode,
  'text/markdown': faFileLines,

  // Broad category fallbacks (e.g. image/jpeg, audio/mpeg, video/mp4, text/plain)
  image: faFileImage,
  audio: faFileAudio,
  video: faFileVideo,
  text: faFileLines,
};

/**
 * Resolves a file name to its corresponding Font Awesome icon based on its MIME type.
 */
export function getFileIcon(fileName: string): IconDefinition {
  const mimeType = mime.getType(fileName);
  if (!mimeType) return faFile;

  if (MIME_ICON_MAP[mimeType]) return MIME_ICON_MAP[mimeType];

  const mainType = mimeType.split('/')[0];
  return MIME_ICON_MAP[mainType] ?? faFile;
}
