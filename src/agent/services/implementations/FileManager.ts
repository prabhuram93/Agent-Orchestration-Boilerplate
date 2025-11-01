import { IFileManager } from '../interfaces/IFileManager';

export class FileManager implements IFileManager {
  async listPhpModules(_rootPath: string): Promise<string[]> {
    // For local testing, return a couple of fake modules
    return ['app/code/Vendor/ModuleA', 'app/code/Vendor/ModuleB'];
  }

  async readModuleFiles(_modulePath: string): Promise<{ path: string; content: string }[]> {
    return [];
  }
}

