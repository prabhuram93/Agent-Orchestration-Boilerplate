import { useState, useCallback } from 'react'
import { Provider, defaultTheme, Flex } from '@adobe/react-spectrum'
import {
  Header,
  AnalysisForm,
  ProgressLog,
  ResultDisplay,
  ModulePickerDialog,
  AnalysisReport,
} from './components'
import { useTheme, useAutoScroll } from './hooks'
import type { AnalysisData, StreamMessage } from './types'
import './App.css'

function App() {
  const { themeMode, setThemeMode, effectiveTheme } = useTheme()
  const [repoUrl, setRepoUrl] = useState('https://github.com/magento/magento2')
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [result, setResult] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [reportData, setReportData] = useState<AnalysisData | null>(null)
  const [showModulePicker, setShowModulePicker] = useState(false)
  const [availableModules, setAvailableModules] = useState<string[]>([])
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [sessionId, setSessionId] = useState('')
  const [rootPath, setRootPath] = useState('')

  const { containerRef, handleScroll, resetAutoScroll } = useAutoScroll<HTMLPreElement>([log])

  const addLog = useCallback((message: string) => {
    setLog((prev) => [...prev, message])
  }, [])

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setZipFile(file)
    }
  }, [])

  const processStreamResponse = useCallback(
    async (response: Response) => {
      if (!response.body) {
        addLog('No response body (stream not available).')
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const obj: StreamMessage = JSON.parse(line)
            if (obj.type === 'progress') {
              addLog(obj.message || '')
            } else if (obj.type === 'result') {
              setResult(JSON.stringify(obj.data, null, 2))
              setReportData(obj.data || null)
            } else if (obj.type === 'error') {
              addLog(`Error: ${obj.message}`)
            } else if (obj.type === 'select-modules') {
              setSessionId(obj.sessionId || '')
              setRootPath(obj.rootPath || '')
              setAvailableModules(obj.modules || [])
              setShowModulePicker(true)
            }
          } catch (e) {
            console.error('Failed to parse line', line, e)
          }
        }
      }
    },
    [addLog]
  )

  const handleAnalyze = useCallback(async () => {
    setLog([])
    setResult('')
    setReportData(null)
    setIsAnalyzing(true)
    resetAutoScroll()

    try {
      let response: Response

      if (zipFile) {
        const formData = new FormData()
        formData.append('zip', zipFile, zipFile.name)
        if (sessionId) {
          formData.append('sessionId', sessionId)
        }
        response = await fetch('/api/analyze', {
          method: 'POST',
          body: formData,
        })
      } else {
        response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ repo: repoUrl }),
        })
      }

      if (!response.ok) {
        const text = await response.text()
        addLog(`Request failed: ${response.status} ${response.statusText}`)
        if (text) addLog(text)
        throw new Error(`HTTP ${response.status}`)
      }

      await processStreamResponse(response)
    } catch (e) {
      console.error(e)
      addLog(`Request error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsAnalyzing(false)
    }
  }, [repoUrl, zipFile, sessionId, addLog, processStreamResponse, resetAutoScroll])

  const handleModuleSelection = useCallback(async () => {
    if (selectedModules.length === 0) {
      addLog('No modules selected.')
      return
    }

    setShowModulePicker(false)
    setIsAnalyzing(true)
    resetAutoScroll()

    try {
      let response: Response

      if (zipFile) {
        const formData = new FormData()
        formData.append('repo', repoUrl)
        formData.append('zip', zipFile, zipFile.name)
        formData.append('sessionId', sessionId)
        formData.append('selectedModules', JSON.stringify(selectedModules))
        formData.append('rootPath', rootPath)

        response = await fetch('/api/analyze', {
          method: 'POST',
          body: formData,
        })
      } else {
        response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            repo: repoUrl,
            sessionId,
            selectedModules,
            rootPath,
          }),
        })
      }

      if (!response.ok) {
        const text = await response.text()
        addLog(`Request failed: ${response.status} ${response.statusText}`)
        if (text) addLog(text)
        throw new Error(`HTTP ${response.status}`)
      }

      await processStreamResponse(response)
    } catch (e) {
      console.error(e)
      addLog(`Request error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsAnalyzing(false)
    }
  }, [
    repoUrl,
    zipFile,
    sessionId,
    selectedModules,
    rootPath,
    addLog,
    processStreamResponse,
    resetAutoScroll,
  ])

  const handleDownloadPdf = useCallback(() => {
    window.print()
  }, [])

  return (
    <Provider theme={defaultTheme} colorScheme={effectiveTheme}>
      <Flex direction="column" height="100vh">
        <Header themeMode={themeMode} onThemeChange={setThemeMode} />

        {/* Main Content */}
        <Flex
          direction="column"
          gap="size-300"
          flex={1}
          UNSAFE_style={{ padding: '1.5rem', overflow: 'auto' }}
        >
          <AnalysisForm
            repoUrl={repoUrl}
            zipFile={zipFile}
            isAnalyzing={isAnalyzing}
            effectiveTheme={effectiveTheme}
            onRepoUrlChange={setRepoUrl}
            onFileChange={handleFileChange}
            onAnalyze={handleAnalyze}
          />

          <ProgressLog
            log={log}
            isAnalyzing={isAnalyzing}
            containerRef={containerRef}
            onScroll={handleScroll}
            effectiveTheme={effectiveTheme}
          />

          <ResultDisplay result={result} />

          {reportData && (
            <AnalysisReport
              reportData={reportData}
              effectiveTheme={effectiveTheme}
              onDownloadPdf={handleDownloadPdf}
            />
          )}

          <ModulePickerDialog
            showModulePicker={showModulePicker}
            availableModules={availableModules}
            selectedModules={selectedModules}
            onSelectionChange={setSelectedModules}
            onDismiss={() => setShowModulePicker(false)}
            onConfirm={handleModuleSelection}
          />
        </Flex>
      </Flex>
    </Provider>
  )
}

export default App
