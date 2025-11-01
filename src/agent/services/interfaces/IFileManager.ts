export interface IFileManager {
  listPhpModules(rootPath: string): Promise<string[]>;
  readModuleFiles(modulePath: string): Promise<{ path: string; content: string }[]>;
}

