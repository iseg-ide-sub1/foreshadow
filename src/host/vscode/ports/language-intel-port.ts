import * as vscode from 'vscode';
import {
  CallHierarchyIncomingCall,
  CallHierarchyItemRef,
  CallHierarchyOutgoingCall,
  LanguageIntelPort,
} from '../../../foundation/ports/language-intel-port';
import { ArtifactType, SymbolRef } from '../../../foundation/domain/artifact';
import { FsUri, Location, Position } from '../../../foundation/domain/geometry';
import { VscodeMapper } from '../mapper';

function toCallHierarchyItemRef(item: vscode.CallHierarchyItem): CallHierarchyItemRef {
  return {
    name: item.name,
    uri: VscodeMapper.toFsUri(item.uri),
    range: VscodeMapper.toRange(item.range),
    selectionRange: VscodeMapper.toRange(item.selectionRange),
  };
}

export class VscodeLanguageIntelPort implements LanguageIntelPort {
  async getDocumentSymbols(uri: FsUri): Promise<SymbolRef[]> {
    try {
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        VscodeMapper.toVscodeUri(uri),
      );
      if (!symbols) return [];
      return symbols.map(s => VscodeMapper.toSymbolRef(s));
    } catch (e) {
      console.error('getDocumentSymbols failed', e);
      return [];
    }
  }

  async getDefinition(uri: FsUri, position: Position): Promise<Location[]> {
    try {
      const result = await vscode.commands.executeCommand<Array<vscode.Location | vscode.LocationLink>>(
        'vscode.executeDefinitionProvider',
        VscodeMapper.toVscodeUri(uri),
        VscodeMapper.toVscodePosition(position),
      );
      return this.normalizeLocations(result);
    } catch {
      return [];
    }
  }

  async getTypeDefinition(uri: FsUri, position: Position): Promise<Location[]> {
    try {
      const result = await vscode.commands.executeCommand<Array<vscode.Location | vscode.LocationLink>>(
        'vscode.executeTypeDefinitionProvider',
        VscodeMapper.toVscodeUri(uri),
        VscodeMapper.toVscodePosition(position),
      );
      return this.normalizeLocations(result);
    } catch {
      return [];
    }
  }

  async getReferences(uri: FsUri, position: Position, includeDeclaration: boolean = false): Promise<Location[]> {
    try {
      const result = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeReferenceProvider',
        VscodeMapper.toVscodeUri(uri),
        VscodeMapper.toVscodePosition(position),
        { includeDeclaration },
      );
      return (result || []).map(l => VscodeMapper.toLocation(l));
    } catch {
      return [];
    }
  }

  async getImplementations(uri: FsUri, position: Position): Promise<Location[]> {
    try {
      const result = await vscode.commands.executeCommand<Array<vscode.Location | vscode.LocationLink>>(
        'vscode.executeImplementationProvider',
        VscodeMapper.toVscodeUri(uri),
        VscodeMapper.toVscodePosition(position),
      );
      return this.normalizeLocations(result);
    } catch {
      return [];
    }
  }

  async prepareCallHierarchy(uri: FsUri, position: Position): Promise<CallHierarchyItemRef[]> {
    try {
      const items = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
        'vscode.prepareCallHierarchy',
        VscodeMapper.toVscodeUri(uri),
        VscodeMapper.toVscodePosition(position),
      );
      return (items || []).map(toCallHierarchyItemRef);
    } catch {
      return [];
    }
  }

  async provideIncomingCalls(item: CallHierarchyItemRef): Promise<CallHierarchyIncomingCall[]> {
    try {
      const vscodeItem = new vscode.CallHierarchyItem(
        vscode.SymbolKind.Function,
        item.name,
        '',
        VscodeMapper.toVscodeUri(item.uri),
        VscodeMapper.toVscodeRange(item.range),
        VscodeMapper.toVscodeRange(item.selectionRange),
      );
      const incoming = await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
        'vscode.provideIncomingCalls',
        vscodeItem,
      );
      return (incoming || []).map(call => ({
        from: toCallHierarchyItemRef(call.from),
        fromRanges: call.fromRanges.map(r => VscodeMapper.toRange(r)),
      }));
    } catch {
      return [];
    }
  }

  async provideOutgoingCalls(item: CallHierarchyItemRef): Promise<CallHierarchyOutgoingCall[]> {
    try {
      const vscodeItem = new vscode.CallHierarchyItem(
        vscode.SymbolKind.Function,
        item.name,
        '',
        VscodeMapper.toVscodeUri(item.uri),
        VscodeMapper.toVscodeRange(item.range),
        VscodeMapper.toVscodeRange(item.selectionRange),
      );
      const outgoing = await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
        'vscode.provideOutgoingCalls',
        vscodeItem,
      );
      return (outgoing || []).map(call => ({
        to: toCallHierarchyItemRef(call.to),
        fromRanges: call.fromRanges.map(r => VscodeMapper.toRange(r)),
      }));
    } catch {
      return [];
    }
  }

  async getHoverText(uri: FsUri, position: Position): Promise<string | undefined> {
    try {
      const hover = await vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider',
        VscodeMapper.toVscodeUri(uri),
        VscodeMapper.toVscodePosition(position),
      );
      if (!hover?.[0]?.contents) return undefined;
      const texts: string[] = [];
      for (const c of hover[0].contents) {
        if (typeof c === 'string') texts.push(c);
        else if (c instanceof vscode.MarkdownString) texts.push(c.value);
        else if ('value' in c && typeof (c as any).value === 'string') texts.push((c as any).value);
      }
      return texts.length > 0 ? texts.join('\n') : undefined;
    } catch {
      return undefined;
    }
  }

  mapSymbolKind(kind: number): ArtifactType {
    return VscodeMapper.mapSymbolKind(kind as vscode.SymbolKind);
  }

  private normalizeLocations(result: Array<vscode.Location | vscode.LocationLink> | undefined): Location[] {
    if (!result) return [];
    return result.map(item => {
      if (item instanceof vscode.Location) return VscodeMapper.toLocation(item);
      const link = item as vscode.LocationLink;
      return VscodeMapper.toLocation(
        new vscode.Location(link.targetUri, link.targetRange ?? link.targetSelectionRange!),
      );
    });
  }
}
