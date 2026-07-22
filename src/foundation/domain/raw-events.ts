import { FsUri, Position, Range } from './geometry';

export type TextChange = {
  range: Range;
  rangeOffset: number;
  rangeLength: number;
  text: string;
};

export type RawHostEvent =
  | {
      type: 'textChanged';
      uri: FsUri;
      beforeText: string;
      afterText: string;
      changes: TextChange[];
    }
  | {
      type: 'selectionChanged';
      uri: FsUri;
      selections: Range[];
      active: Position;
      kind?: 'select' | 'cursor';
    }
  | {
      type: 'activeEditorChanged';
      uri: FsUri | null;
      previousUri?: FsUri;
      lineCount?: number;
    }
  | {
      type: 'fileRenamed';
      oldUri: FsUri;
      newUri: FsUri;
    }
  | {
      type: 'terminalCommand';
      processId: string;
      cmd: string;
      output: string;
      phase: 'start' | 'end';
    };
