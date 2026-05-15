import React, { useState, useCallback, useMemo } from 'react';
import { Attachment, ImageAttachment, FileAttachment, FolderAttachment, ATTACHMENT_LIMITS } from '../../../../types';

type DroppedPathKind = 'file' | 'folder';

interface DroppedPath {
  path: string;
  kind: DroppedPathKind;
}

export interface UseAttachmentsReturn {
  attachments: Attachment[];
  addImageAttachment: (file: File) => Promise<void>;
  addFileAttachment: (absolutePath: string, fileName: string, size?: number) => void;
  addFolderAttachment: (absolutePath: string, folderName: string) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  error: string | null;
  isDragOver: boolean;
  setIsDragOver: (v: boolean) => void;
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
}

function basename(path: string): string {
  return path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path;
}

function normalizeDroppedPath(rawPath: string): string | null {
  const trimmed = rawPath.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  try {
    if (trimmed.startsWith('file://')) {
      return decodeURIComponent(new URL(trimmed).pathname)
        .replace(/^\/([A-Za-z]:\/)/, '$1')
        .replace(/\//g, navigator.platform.toLowerCase().includes('win') ? '\\' : '/');
    }
  } catch {
    // Fall through and treat it as a plain local path.
  }
  if (/^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('\\\\')) {
    return trimmed;
  }
  return null;
}

function extractPathsFromText(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map(normalizeDroppedPath)
    .filter((path): path is string => Boolean(path));
}

function getEntryKinds(items: DataTransferItemList): Map<string, DroppedPathKind> {
  const kinds = new Map<string, DroppedPathKind>();
  for (const item of Array.from(items)) {
    const entry = item.webkitGetAsEntry?.();
    if (!entry) continue;
    kinds.set(entry.name, entry.isDirectory ? 'folder' : 'file');
  }
  return kinds;
}

function extractDroppedPaths(dataTransfer: DataTransfer): DroppedPath[] {
  const paths = new Set<string>();
  const uriList = dataTransfer.getData('text/uri-list');
  const plainText = dataTransfer.getData('text/plain');
  for (const path of [...extractPathsFromText(uriList), ...extractPathsFromText(plainText)]) {
    paths.add(path);
  }

  for (const file of Array.from(dataTransfer.files)) {
    const path = (file as File & { path?: string }).path || normalizeDroppedPath(file.name);
    if (path) paths.add(path);
  }

  const entryKinds = getEntryKinds(dataTransfer.items);
  return Array.from(paths).map((path) => {
    const name = basename(path);
    const kind = path.endsWith('/') || path.endsWith('\\')
      ? 'folder'
      : entryKinds.get(name) ?? 'file';
    return { path, kind };
  });
}

export function useAttachments(): UseAttachmentsReturn {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const addImageAttachment = useCallback(async (file: File) => {
    // Clear previous error
    setError(null);

    // Validate MIME type
    if (!ATTACHMENT_LIMITS.ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ATTACHMENT_LIMITS.ALLOWED_IMAGE_MIME_TYPES)[number])) {
      setError(`Unsupported file type: ${file.type || 'unknown'}`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Validate file size
    if (file.size > ATTACHMENT_LIMITS.MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setError(`File too large: ${sizeMB}MB (max 10MB)`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Read file as base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        // Strip "data:image/png;base64," prefix
        const base64Data = dataUrl.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    const attachment = new ImageAttachment({
      fileName: file.name || 'image.png',
      mimeType: file.type,
      base64,
      size: file.size,
    });

    setAttachments((prev) => [...prev, attachment]);
  }, []);

  const addFileAttachment = useCallback((absolutePath: string, fileName: string, size?: number) => {
    const attachment = new FileAttachment({ fileName, absolutePath, size });
    setAttachments((prev) => {
      if (prev.some((att) => att instanceof FileAttachment && att.absolutePath === attachment.absolutePath)) {
        return prev;
      }
      return [...prev, attachment];
    });
  }, []);

  const addFolderAttachment = useCallback((absolutePath: string, folderName: string) => {
    const attachment = new FolderAttachment({ folderName, absolutePath });
    setAttachments((prev) => {
      if (prev.some((att) => att instanceof FolderAttachment && att.absolutePath === attachment.absolutePath)) {
        return prev;
      }
      return [...prev, attachment];
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
    setError(null);
  }, []);

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length === 0) return; // 텍스트 붙여넣기는 기존 동작 유지

    e.preventDefault(); // 이미지가 있을 때만 기본 동작 차단
    for (const file of imageFiles) {
      await addImageAttachment(file);
    }
  }, [addImageAttachment]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, [setIsDragOver]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }, [setIsDragOver]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        await addImageAttachment(file);
      }
    }
    const droppedPaths = extractDroppedPaths(e.dataTransfer);
    for (const dropped of droppedPaths) {
      if (dropped.kind === 'folder') {
        addFolderAttachment(dropped.path, basename(dropped.path));
      } else {
        addFileAttachment(dropped.path, basename(dropped.path));
      }
    }
  }, [addImageAttachment, addFileAttachment, addFolderAttachment, setIsDragOver]);

  return useMemo(() => ({
    attachments,
    addImageAttachment,
    addFileAttachment,
    addFolderAttachment,
    removeAttachment,
    clearAttachments,
    error,
    isDragOver,
    setIsDragOver,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }), [attachments, addImageAttachment, addFileAttachment, addFolderAttachment, removeAttachment, clearAttachments, error, isDragOver, setIsDragOver, handlePaste, handleDragOver, handleDragLeave, handleDrop]);
}
