import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { FileSystemPort } from '../../../foundation/ports/filesystem-port';

export class NodeFileSystemPort implements FileSystemPort {
  exists(p: string): boolean {
    return fs.existsSync(p);
  }

  async readFile(p: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    return fsp.readFile(p, encoding);
  }

  async writeFile(p: string, content: string, encoding: BufferEncoding = 'utf8'): Promise<void> {
    await this.mkdirp(path.dirname(p));
    await fsp.writeFile(p, content, encoding);
  }

  async mkdirp(p: string): Promise<void> {
    await fsp.mkdir(p, { recursive: true });
  }

  readFileSync(p: string, encoding: BufferEncoding = 'utf8'): string {
    return fs.readFileSync(p, encoding);
  }

  writeFileSync(p: string, content: string, encoding: BufferEncoding = 'utf8'): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, encoding);
  }
}
