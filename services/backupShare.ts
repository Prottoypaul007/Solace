import { Capacitor, registerPlugin } from '@capacitor/core';

interface BackupSharePlugin {
  shareBackup(options: { filename: string; content: string }): Promise<void>;
  shareStatement(options: { filename: string; content: string }): Promise<void>;
}

const nativeShare = registerPlugin<BackupSharePlugin>('BackupShare');

export const saveBackupFile = async (filename: string, content: string): Promise<'shared' | 'downloaded'> => {
  if (Capacitor.getPlatform() === 'android') {
    await nativeShare.shareBackup({ filename, content });
    return 'shared';
  }

  const file = new File([content], filename, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: 'Solace backup' });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
};

export const saveStatementFile = async (filename: string, content: string): Promise<'shared' | 'downloaded'> => {
  if (Capacitor.getPlatform() === 'android') {
    await nativeShare.shareStatement({ filename, content });
    return 'shared';
  }
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
};
