import * as vscode from 'vscode';
import { DocumentPort, TextDocumentSnapshot } from '../../../foundation/ports/document-port';
import { FsUri, Position, Range } from '../../../foundation/domain/geometry';
import { VscodeMapper } from '../mapper';

function wrapDocument(doc: vscode.TextDocument): TextDocumentSnapshot {
  return {
    uri: VscodeMapper.toFsUri(doc.uri),
    fsPath: doc.uri.fsPath,
    lineCount: doc.lineCount,
    languageId: doc.languageId,
    getText(range?: Range) {
      if (!range) return doc.getText();
      return doc.getText(VscodeMapper.toVscodeRange(range));
    },
    lineAt(line: number) {
      return doc.lineAt(line).text;
    },
    offsetAt(position: Position) {
      return doc.offsetAt(VscodeMapper.toVscodePosition(position));
    },
    positionAt(offset: number) {
      return VscodeMapper.toPosition(doc.positionAt(offset));
    },
  };
}

export class VscodeDocumentPort implements DocumentPort {
  getOpenDocument(uri: FsUri | string): TextDocumentSnapshot | undefined {
    const target = typeof uri === 'string' ? uri : uri.fsPath;
    const found = vscode.workspace.textDocuments.find(d => d.uri.fsPath === target);
    return found ? wrapDocument(found) : undefined;
  }

  async openDocument(uri: FsUri | string): Promise<TextDocumentSnapshot | undefined> {
    try {
      const opened = this.getOpenDocument(uri);
      if (opened) return opened;
      const vscodeUri = VscodeMapper.toVscodeUri(uri);
      const doc = await vscode.workspace.openTextDocument(vscodeUri);
      return wrapDocument(doc);
    } catch (e) {
      console.error('openDocument failed', e);
      return undefined;
    }
  }

  getActiveDocument(): TextDocumentSnapshot | undefined {
    const editor = vscode.window.activeTextEditor;
    return editor ? wrapDocument(editor.document) : undefined;
  }

  async getText(uri: FsUri | string, range?: Range): Promise<string> {
    const doc = await this.openDocument(uri);
    if (!doc) return '';
    return doc.getText(range);
  }
}
