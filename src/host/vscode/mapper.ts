import * as vscode from 'vscode';
import {
  FsUri,
  Location,
  Position,
  Range,
  makeLocation,
  makePosition,
  makeRange,
  makeUri,
} from '../../foundation/domain/geometry';
import { ArtifactType, SymbolRef } from '../../foundation/domain/artifact';

export class VscodeMapper {
  static toFsUri(uri: vscode.Uri): FsUri {
    return makeUri(uri.fsPath, uri.scheme);
  }

  static toVscodeUri(uri: FsUri | string): vscode.Uri {
    if (typeof uri === 'string') return vscode.Uri.file(uri);
    if (uri.scheme && uri.scheme !== 'file') {
      return vscode.Uri.parse(`${uri.scheme}:${uri.fsPath}`);
    }
    return vscode.Uri.file(uri.fsPath);
  }

  static toPosition(pos: vscode.Position): Position {
    return makePosition(pos.line, pos.character);
  }

  static toVscodePosition(pos: Position): vscode.Position {
    return new vscode.Position(pos.line, pos.character);
  }

  static toRange(range: vscode.Range): Range {
    return makeRange(this.toPosition(range.start), this.toPosition(range.end));
  }

  static toVscodeRange(range: Range): vscode.Range {
    return new vscode.Range(this.toVscodePosition(range.start), this.toVscodePosition(range.end));
  }

  static toLocation(loc: vscode.Location): Location {
    return makeLocation(this.toFsUri(loc.uri), this.toRange(loc.range));
  }

  static toVscodeLocation(loc: Location): vscode.Location {
    return new vscode.Location(this.toVscodeUri(loc.uri), this.toVscodeRange(loc.range));
  }

  static mapSymbolKind(kind: vscode.SymbolKind): ArtifactType {
    const map: Record<number, ArtifactType> = {
      [vscode.SymbolKind.File]: ArtifactType.File,
      [vscode.SymbolKind.Module]: ArtifactType.Module,
      [vscode.SymbolKind.Namespace]: ArtifactType.Namespace,
      [vscode.SymbolKind.Package]: ArtifactType.Package,
      [vscode.SymbolKind.Class]: ArtifactType.Class,
      [vscode.SymbolKind.Method]: ArtifactType.Method,
      [vscode.SymbolKind.Property]: ArtifactType.Property,
      [vscode.SymbolKind.Field]: ArtifactType.Field,
      [vscode.SymbolKind.Constructor]: ArtifactType.Constructor,
      [vscode.SymbolKind.Enum]: ArtifactType.Enum,
      [vscode.SymbolKind.Interface]: ArtifactType.Interface,
      [vscode.SymbolKind.Function]: ArtifactType.Function,
      [vscode.SymbolKind.Variable]: ArtifactType.Variable,
      [vscode.SymbolKind.Constant]: ArtifactType.Constant,
      [vscode.SymbolKind.String]: ArtifactType.String,
      [vscode.SymbolKind.Number]: ArtifactType.Number,
      [vscode.SymbolKind.Boolean]: ArtifactType.Boolean,
      [vscode.SymbolKind.Array]: ArtifactType.Array,
      [vscode.SymbolKind.Object]: ArtifactType.Object,
      [vscode.SymbolKind.Key]: ArtifactType.Key,
      [vscode.SymbolKind.Null]: ArtifactType.Null,
      [vscode.SymbolKind.EnumMember]: ArtifactType.EnumMember,
      [vscode.SymbolKind.Struct]: ArtifactType.Struct,
      [vscode.SymbolKind.Event]: ArtifactType.Event,
      [vscode.SymbolKind.Operator]: ArtifactType.Operator,
      [vscode.SymbolKind.TypeParameter]: ArtifactType.TypeParameter,
    };
    return map[kind] ?? ArtifactType.Unknown;
  }

  static toSymbolRef(symbol: vscode.DocumentSymbol): SymbolRef {
    return {
      name: symbol.name,
      kind: this.mapSymbolKind(symbol.kind),
      selectionStart: this.toPosition(symbol.selectionRange.start),
      range: this.toRange(symbol.range),
      children: symbol.children?.map(c => this.toSymbolRef(c)),
    };
  }
}
