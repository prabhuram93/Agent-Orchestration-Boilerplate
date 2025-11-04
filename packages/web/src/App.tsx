import { useState, useCallback } from 'react'
import { Provider, defaultTheme, Flex, View } from '@adobe/react-spectrum'
import {
  Header,
  AnalysisForm,
  AnalysisReport,
  LogsAccordion,
} from './components'
import { useTheme, useAutoScroll } from './hooks'
import type { AnalysisData, StreamMessage } from './types'
import './App.css'

// Get API URL from environment variables
const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const { themeMode, setThemeMode, effectiveTheme } = useTheme()
  const [repoUrl, setRepoUrl] = useState('https://github.com/magento/magento2')
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [result, setResult] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [reportData, setReportData] = useState<AnalysisData | null>(null)
  const [availableModules, setAvailableModules] = useState<string[]>([])
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [sessionId, setSessionId] = useState('')
  const [rootPath, setRootPath] = useState('')
  const [metadata, setMetadata] = useState({
    inputs: {
      repoUrl: '',
      uploadedFileName: '',
      modulesSelected: [] as string[],
    },
    events: {
      uploadStartTimestamp: '',
      uploadEndTimestamp: '',
      moduleAnalysisStartTimestamp: '',
      moduleAnalysisEndTimestamp: '',
    },
  })

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
              // Start with no modules selected by default
              setSelectedModules([])
              // Set upload end timestamp when modules are ready for selection
              const uploadEndTime = new Date().toISOString()
              setMetadata((prev) => ({
                ...prev,
                events: { ...prev.events, uploadEndTimestamp: uploadEndTime },
              }))
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

    const uploadStartTime = new Date().toISOString()
    setMetadata({
      inputs: {
        repoUrl: zipFile ? '' : repoUrl,
        uploadedFileName: zipFile ? zipFile.name : '',
        modulesSelected: [],
      },
      events: {
        uploadStartTimestamp: uploadStartTime,
        uploadEndTimestamp: '',
        moduleAnalysisStartTimestamp: '',
        moduleAnalysisEndTimestamp: '',
      },
    })

    try {
      let response: Response

      if (zipFile) {
        const formData = new FormData()
        formData.append('zip', zipFile, zipFile.name)
        if (sessionId) {
          formData.append('sessionId', sessionId)
        }
        response = await fetch(`${API_URL}/api/analyze`, {
          method: 'POST',
          body: formData,
        })
      } else {
        response = await fetch(`${API_URL}/api/analyze`, {
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

    setIsAnalyzing(true)
    resetAutoScroll()

    const moduleAnalysisStartTime = new Date().toISOString()
    setMetadata((prev) => ({
      inputs: {
        ...prev.inputs,
        modulesSelected: selectedModules,
      },
      events: {
        ...prev.events,
        moduleAnalysisStartTimestamp: moduleAnalysisStartTime,
      },
    }))

    try {
      let response: Response

      if (zipFile) {
        const formData = new FormData()
        formData.append('repo', repoUrl)
        formData.append('zip', zipFile, zipFile.name)
        formData.append('sessionId', sessionId)
        formData.append('selectedModules', JSON.stringify(selectedModules))
        formData.append('rootPath', rootPath)

        response = await fetch(`${API_URL}/api/analyze`, {
          method: 'POST',
          body: formData,
        })
      } else {
        response = await fetch(`${API_URL}/api/analyze`, {
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
      
      const moduleAnalysisEndTime = new Date().toISOString()
      setMetadata((prev) => ({
        ...prev,
        events: {
          ...prev.events,
          moduleAnalysisEndTimestamp: moduleAnalysisEndTime,
        },
      }))
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

  const handleSelectAll = useCallback(() => {
    setSelectedModules(availableModules)
  }, [availableModules])

  const handleDeselectAll = useCallback(() => {
    setSelectedModules([])
  }, [])

  return (
    <Provider theme={defaultTheme} colorScheme={effectiveTheme}>
      <Flex direction="column" height="100vh">
        <Header themeMode={themeMode} onThemeChange={setThemeMode}/>

        {/* Main Content */}
        <Flex
          direction="column"
          gap="size-300"
          flex={1}
          UNSAFE_style={{ 
            padding: '1.5rem', 
            paddingBottom: '5rem', // Extra padding for the fixed accordion
            overflow: 'hidden',
            minHeight: 0
          }}
        >
          <AnalysisForm
            repoUrl={repoUrl}
            zipFile={zipFile}
            isAnalyzing={isAnalyzing}
            effectiveTheme={effectiveTheme}
            availableModules={availableModules}
            selectedModules={selectedModules}
            onRepoUrlChange={setRepoUrl}
            onFileChange={handleFileChange}
            onAnalyze={handleAnalyze}
            onModuleSelectionChange={setSelectedModules}
            onAnalyzeSelected={handleModuleSelection}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
          />

          <View UNSAFE_style={{ flex: 1, minHeight: 0, display: 'flex', width: '100%' }}>
            <AnalysisReport
              reportData={reportData}
              effectiveTheme={effectiveTheme}
              onDownloadPdf={handleDownloadPdf}
              isAnalyzing={isAnalyzing}
            />
          </View>
        </Flex>

        {/* Bottom-Anchored Logs */}
        <LogsAccordion
          log={log}
          result={result}
          metadata={metadata}
          containerRef={containerRef}
          onScroll={handleScroll}
          effectiveTheme={effectiveTheme}
        />
      </Flex>
    </Provider>
  )
}

export default App
