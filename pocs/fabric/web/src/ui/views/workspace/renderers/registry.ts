import type { ComponentType } from 'react';
import type { WorkspaceFile } from '../../../../types';
import DefaultMarkdownRenderer from './DefaultMarkdownRenderer';
import DefaultCodeRenderer from './DefaultCodeRenderer';
import SpecViewRenderer from './SpecViewRenderer';
import KitTomlCardRenderer from './KitTomlCardRenderer';

export interface FileRendererProps {
  file: WorkspaceFile;
  highlightPack?: string;
}

export type FileRenderer = ComponentType<FileRendererProps>;

export const renderers: Record<string, FileRenderer> = {
  'default-markdown': DefaultMarkdownRenderer,
  'default-code': DefaultCodeRenderer,
  'spec-view': SpecViewRenderer,
  'kit-toml-card': KitTomlCardRenderer,
};

/** Returns the built-in renderer for a given file's language. */
export function defaultRendererKey(file: WorkspaceFile): string {
  return file.language === 'markdown' ? 'default-markdown' : 'default-code';
}
