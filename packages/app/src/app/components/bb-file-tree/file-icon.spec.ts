import {
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
import { getFileIcon } from './file-icon';

describe('getFileIcon', () => {
  it('returns the pdf icon for .pdf files', () => {
    expect(getFileIcon('report.pdf')).toBe(faFilePdf);
  });

  it('returns the word icon for .docx files', () => {
    expect(getFileIcon('letter.docx')).toBe(faFileWord);
  });

  it('returns the excel icon for .xlsx files', () => {
    expect(getFileIcon('budget.xlsx')).toBe(faFileExcel);
  });

  it('returns the csv icon for .csv files', () => {
    expect(getFileIcon('data.csv')).toBe(faFileCsv);
  });

  it('returns the powerpoint icon for .pptx files', () => {
    expect(getFileIcon('slides.pptx')).toBe(faFilePowerpoint);
  });

  it('returns the zip icon for archive files', () => {
    expect(getFileIcon('archive.zip')).toBe(faFileZipper);
    expect(getFileIcon('archive.tar')).toBe(faFileZipper);
    expect(getFileIcon('archive.7z')).toBe(faFileZipper);
  });

  it('returns the code icon for code/markup files', () => {
    expect(getFileIcon('data.json')).toBe(faFileCode);
    expect(getFileIcon('index.html')).toBe(faFileCode);
    expect(getFileIcon('styles.css')).toBe(faFileCode);
  });

  it('returns the lines icon for markdown and plain text files', () => {
    expect(getFileIcon('README.md')).toBe(faFileLines);
    expect(getFileIcon('notes.txt')).toBe(faFileLines);
  });

  it('returns the image icon for image files', () => {
    expect(getFileIcon('photo.jpg')).toBe(faFileImage);
    expect(getFileIcon('icon.png')).toBe(faFileImage);
  });

  it('returns the audio icon for audio files', () => {
    expect(getFileIcon('song.mp3')).toBe(faFileAudio);
  });

  it('returns the video icon for video files', () => {
    expect(getFileIcon('movie.mp4')).toBe(faFileVideo);
  });

  it('returns the generic file icon for unknown extensions', () => {
    expect(getFileIcon('binary.xyz123')).toBe(faFile);
  });

  it('returns the generic file icon for files without an extension', () => {
    expect(getFileIcon('LICENSE')).toBe(faFile);
  });

  it('resolves the icon based on the file name regardless of its directory path', () => {
    expect(getFileIcon('movies/2024/movie.mp4')).toBe(faFileVideo);
  });
});
