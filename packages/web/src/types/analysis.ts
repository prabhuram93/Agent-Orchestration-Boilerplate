export interface ModuleAnalysisResult {
  modulePath: string
  logic?: {
    module?: string
    summary?: string
    entities?: string[]
    services?: string[]
    controllers?: string[]
    workflows?: string[]
  }
  complexity?: {
    linesOfCode?: number
    classes?: number
    functions?: number
    cyclomaticComplexity?: number
  }
}

export interface AnalysisData {
  results?: ModuleAnalysisResult[]
}

export type ThemeMode = 'light' | 'dark' | 'system'

export interface StreamMessage {
  type: 'progress' | 'result' | 'error' | 'select-modules'
  message?: string
  data?: AnalysisData
  sessionId?: string
  rootPath?: string
  modules?: string[]
}

