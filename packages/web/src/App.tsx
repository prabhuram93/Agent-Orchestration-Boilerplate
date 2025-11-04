import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Provider,
  defaultTheme,
  View,
  Heading,
  Button,
  Text,
  Flex,
  TextField,
  Well,
  ProgressBar,
  CheckboxGroup,
  Checkbox,
  DialogContainer,
  Dialog,
  Content,
  Divider,
  Grid,
  repeat,
  ActionButton,
  MenuTrigger,
  Menu,
  Item,
  ButtonGroup,
} from '@adobe/react-spectrum'
import Light from '@spectrum-icons/workflow/Light'
import './App.css'

interface ModuleAnalysisResult {
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

interface AnalysisData {
  results?: ModuleAnalysisResult[]
}

type ThemeMode = 'light' | 'dark' | 'system'

function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme')
    return (saved as ThemeMode) || 'dark'
  })

  // Resolve system theme preference
  const [systemPreference, setSystemPreference] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'dark'
  })

  const effectiveTheme = themeMode === 'system' ? systemPreference : themeMode
  
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
  
  // Refs for auto-scroll functionality
  const logContainerRef = useRef<HTMLPreElement>(null)
  const shouldAutoScrollRef = useRef(true)

  useEffect(() => {
    localStorage.setItem('theme', themeMode)
  }, [themeMode])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e: MediaQueryListEvent) => {
        setSystemPreference(e.matches ? 'dark' : 'light')
      }
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [])

  // Auto-scroll to bottom when log updates (if user hasn't scrolled up)
  useEffect(() => {
    if (shouldAutoScrollRef.current && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [log])

  // Track user scroll behavior
  const handleScroll = useCallback(() => {
    if (logContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current
      // Consider "at bottom" if within 10px of the bottom
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 10
      shouldAutoScrollRef.current = isAtBottom
    }
  }, [])

  const addLog = useCallback((message: string) => {
    setLog((prev) => [...prev, message])
  }, [])

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setZipFile(file)
    }
  }, [])

  const handleAnalyze = useCallback(async () => {
    setLog([])
    setResult('')
    setReportData(null)
    setIsAnalyzing(true)
    shouldAutoScrollRef.current = true // Reset auto-scroll for new analysis

    try {
      let response: Response

      // Check if we have a file upload or just a repo URL
      if (zipFile) {
        const formData = new FormData()
        formData.append('repo', repoUrl)
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
            const obj = JSON.parse(line)
            if (obj.type === 'progress') {
              addLog(obj.message)
            } else if (obj.type === 'result') {
              setResult(JSON.stringify(obj.data, null, 2))
              setReportData(obj.data)
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
    } catch (e) {
      console.error(e)
      addLog(`Request error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsAnalyzing(false)
    }
  }, [repoUrl, zipFile, sessionId, addLog])

  const handleModuleSelection = useCallback(async () => {
    if (selectedModules.length === 0) {
      addLog('No modules selected.')
      return
    }

    setShowModulePicker(false)
    setIsAnalyzing(true)
    shouldAutoScrollRef.current = true // Reset auto-scroll for module selection

    try {
      let response: Response

      // Check if we have a file upload or just a repo URL
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
            const obj = JSON.parse(line)
            if (obj.type === 'progress') {
              addLog(obj.message)
            } else if (obj.type === 'result') {
              setResult(JSON.stringify(obj.data, null, 2))
              setReportData(obj.data)
            } else if (obj.type === 'error') {
              addLog(`Error: ${obj.message}`)
            }
          } catch (e) {
            console.error('Failed to parse line', line, e)
          }
        }
      }
    } catch (e) {
      console.error(e)
      addLog(`Request error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsAnalyzing(false)
    }
  }, [repoUrl, zipFile, sessionId, selectedModules, rootPath, addLog])

  const handleDownloadPdf = useCallback(() => {
    window.print()
  }, [])

  return (
    <Provider theme={defaultTheme} colorScheme={effectiveTheme}>
      <Flex direction="column" height="100vh">
        {/* Top Menu Bar */}
        <View
          backgroundColor="gray-100"
          borderBottomColor="gray-300"
          borderBottomWidth="thin"
          paddingX="size-300"
          paddingY="size-200"
        >
          <Flex direction="row" justifyContent="space-between" alignItems="center" gap="size-200">
            <Heading level={1} margin={0} UNSAFE_style={{ fontSize: '1.5rem' }}>
              Magento Analysis Boilerplate
            </Heading>
            <Flex direction="row" alignItems="center" gap="size-200">
              <MenuTrigger>
                <ActionButton isQuiet aria-label="Theme">
                  <Light />
                </ActionButton>
                <Menu
                  selectedKeys={[themeMode]}
                  selectionMode="single"
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as ThemeMode
                    setThemeMode(selected)
                  }}
                >
                  <Item key="light">Light</Item>
                  <Item key="dark">Dark</Item>
                  <Item key="system">System</Item>
                </Menu>
              </MenuTrigger>
              <Button variant="accent">Sign In</Button>
            </Flex>
          </Flex>
        </View>

        {/* Main Content */}
        <Flex 
          direction="column" 
          gap="size-300" 
          flex={1}
          UNSAFE_style={{ padding: '1.5rem', overflow: 'auto' }}
        >
      <Flex direction="column" gap="size-200">
        <Flex direction="row" gap="size-200" alignItems="end">
          <TextField
            label="Repo URL"
            value={repoUrl}
            onChange={setRepoUrl}
            width="size-6000"
            placeholder="https://github.com/owner/repo.git"
          />
          <Button
            variant="accent"
            onPress={handleAnalyze}
            isDisabled={isAnalyzing}
          >
            Analyze
          </Button>
        </Flex>
        
        <Flex direction="row" gap="size-200" alignItems="center">
          <Text UNSAFE_style={{ fontWeight: 500 }}>Or upload a zip file:</Text>
          <input
            type="file"
            accept=".zip"
            onChange={handleFileChange}
            style={{
              padding: '8px',
              borderRadius: '4px',
              border: effectiveTheme === 'dark' ? '1px solid #555' : '1px solid #ccc',
              backgroundColor: effectiveTheme === 'dark' ? '#2a2a2a' : '#fff',
              color: effectiveTheme === 'dark' ? '#fff' : '#000',
              cursor: 'pointer',
            }}
          />
          {zipFile && (
            <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#10b981' }}>
              Selected: {zipFile.name}
            </Text>
          )}
        </Flex>
      </Flex>

      <View>
        <Flex direction="row" gap="size-100" alignItems="center">
          <Heading level={3} margin={0}>Progress</Heading>
          {isAnalyzing && <ProgressBar isIndeterminate width="size-1000" aria-label="Analyzing" />}
        </Flex>
        <Well marginTop="size-100">
          <pre 
            ref={logContainerRef}
            onScroll={handleScroll}
            style={{
              background: '#111',
              color: '#0f0',
              padding: '1rem',
              whiteSpace: 'pre-wrap',
              margin: 0,
              maxHeight: '200px',
              overflow: 'auto'
            }}
          >
            {log.join('\n')}
          </pre>
        </Well>
      </View>

      <View>
        <Heading level={3}>Final Result</Heading>
        <textarea
          readOnly
          value={result}
          style={{
            width: '100%',
            height: '200px',
            fontFamily: 'monospace',
            fontSize: '12px',
            padding: '8px'
          }}
        />
      </View>

      {reportData && (
        <View>
          <Flex direction="row" justifyContent="space-between" alignItems="center" marginBottom="size-200">
            <Heading level={3} margin={0}>Analysis Report</Heading>
            <Button variant="secondary" onPress={handleDownloadPdf}>
              Download PDF
            </Button>
          </Flex>
          <Divider size="M" marginBottom="size-300" />
          <Grid
            columns={repeat('auto-fill', 'minmax(700px, 1fr)')}
            autoRows="auto"
            gap="size-300"
            UNSAFE_style={{ 
              gridTemplateColumns: 'repeat(auto-fill, minmax(700px, 1fr))',
            }}
          >
            {reportData.results?.map((module, idx) => {
              const modulePath = module.modulePath || module.logic?.module || 'Unknown'
              const logic = module.logic || {}
              const complexity = module.complexity || {}

              return (
                <View 
                  key={idx}
                  borderWidth="thin"
                  borderColor="gray-400"
                  borderRadius="large"
                  padding="size-300"
                  backgroundColor="gray-50"
                  UNSAFE_style={{
                    boxShadow: effectiveTheme === 'dark' 
                      ? '0 2px 8px rgba(0,0,0,0.4)' 
                      : '0 2px 8px rgba(0,0,0,0.1)',
                    transition: 'all 0.2s ease',
                    cursor: 'default',
                  }}
                  UNSAFE_className="module-card"
                >
                  <Flex direction="column" gap="size-200">
                    {/* Card Header */}
                    <View paddingBottom="size-150" borderBottomWidth="thin" borderBottomColor="gray-300">
                      <Heading level={4} margin={0} UNSAFE_style={{ 
                        fontSize: '1.125rem',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {modulePath}
                      </Heading>
                    </View>
                    
                    {/* Summary Section */}
                    {logic.summary && (
                      <View paddingY="size-100">
                        <Text UNSAFE_style={{ 
                          fontSize: '0.875rem', 
                          lineHeight: '1.5',
                          color: effectiveTheme === 'dark' ? '#c4c4c4' : '#666'
                        }}>
                          {logic.summary}
                        </Text>
                      </View>
                    )}

                    {/* Metrics Section */}
                    {(complexity.linesOfCode !== undefined || 
                      complexity.classes !== undefined || 
                      complexity.functions !== undefined || 
                      complexity.cyclomaticComplexity !== undefined) && (
                      <View>
                        <Text UNSAFE_style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: effectiveTheme === 'dark' ? '#999' : '#666',
                          marginBottom: '0.5rem'
                        }}>
                          Complexity Metrics
                        </Text>
                        <Grid 
                          columns={repeat('auto-fit', 'minmax(80px, 1fr)')} 
                          gap="size-150"
                        >
                          {complexity.linesOfCode !== undefined && (
                            <View 
                              padding="size-150" 
                              backgroundColor="gray-200" 
                              borderRadius="medium"
                              UNSAFE_style={{ textAlign: 'center' }}
                            >
                              <Text UNSAFE_style={{ 
                                fontSize: '0.7rem', 
                                color: effectiveTheme === 'dark' ? '#999' : '#666',
                                display: 'block',
                                marginBottom: '0.25rem'
                              }}>
                                LOC
                              </Text>
                              <Text UNSAFE_style={{ 
                                fontSize: '1.125rem', 
                                fontWeight: 700,
                                display: 'block'
                              }}>
                                {complexity.linesOfCode}
                              </Text>
                            </View>
                          )}
                          {complexity.classes !== undefined && (
                            <View 
                              padding="size-150" 
                              backgroundColor="gray-200" 
                              borderRadius="medium"
                              UNSAFE_style={{ textAlign: 'center' }}
                            >
                              <Text UNSAFE_style={{ 
                                fontSize: '0.7rem', 
                                color: effectiveTheme === 'dark' ? '#999' : '#666',
                                display: 'block',
                                marginBottom: '0.25rem'
                              }}>
                                Classes
                              </Text>
                              <Text UNSAFE_style={{ 
                                fontSize: '1.125rem', 
                                fontWeight: 700,
                                display: 'block'
                              }}>
                                {complexity.classes}
                              </Text>
                            </View>
                          )}
                          {complexity.functions !== undefined && (
                            <View 
                              padding="size-150" 
                              backgroundColor="gray-200" 
                              borderRadius="medium"
                              UNSAFE_style={{ textAlign: 'center' }}
                            >
                              <Text UNSAFE_style={{ 
                                fontSize: '0.7rem', 
                                color: effectiveTheme === 'dark' ? '#999' : '#666',
                                display: 'block',
                                marginBottom: '0.25rem'
                              }}>
                                Functions
                              </Text>
                              <Text UNSAFE_style={{ 
                                fontSize: '1.125rem', 
                                fontWeight: 700,
                                display: 'block'
                              }}>
                                {complexity.functions}
                              </Text>
                            </View>
                          )}
                          {complexity.cyclomaticComplexity !== undefined && (
                            <View 
                              padding="size-150" 
                              backgroundColor="gray-200" 
                              borderRadius="medium"
                              UNSAFE_style={{ textAlign: 'center' }}
                            >
                              <Text UNSAFE_style={{ 
                                fontSize: '0.7rem', 
                                color: effectiveTheme === 'dark' ? '#999' : '#666',
                                display: 'block',
                                marginBottom: '0.25rem'
                              }}>
                                CC
                              </Text>
                              <Text UNSAFE_style={{ 
                                fontSize: '1.125rem', 
                                fontWeight: 700,
                                display: 'block'
                              }}>
                                {complexity.cyclomaticComplexity}
                              </Text>
                            </View>
                          )}
                        </Grid>
                      </View>
                    )}

                    {/* Components Section */}
                    {((logic.entities && logic.entities.length > 0) ||
                      (logic.services && logic.services.length > 0) ||
                      (logic.controllers && logic.controllers.length > 0) ||
                      (logic.workflows && logic.workflows.length > 0)) && (
                      <View marginTop="size-100">
                        <Text UNSAFE_style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: effectiveTheme === 'dark' ? '#999' : '#666',
                          marginBottom: '0.75rem',
                          display: 'block'
                        }}>
                          Components
                        </Text>
                        <Flex direction="column" gap="size-150">
                          {logic.entities && logic.entities.length > 0 && (
                            <View>
                              <Text UNSAFE_style={{ 
                                fontSize: '0.875rem', 
                                fontWeight: 600,
                                marginBottom: '0.5rem',
                                display: 'block'
                              }}>
                                Entities ({logic.entities.length})
                              </Text>
                              <Flex direction="row" gap="size-125" wrap>
                                {logic.entities.map((entity, i) => (
                                  <View
                                    key={i}
                                    paddingX="size-200"
                                    paddingY="size-100"
                                    borderRadius="large"
                                    UNSAFE_style={{
                                      backgroundColor: effectiveTheme === 'dark' 
                                        ? '#1e3a8a' 
                                        : '#dbeafe',
                                      border: effectiveTheme === 'dark' 
                                        ? '1px solid #3b82f6' 
                                        : '1px solid #93c5fd',
                                      minHeight: '28px',
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Text UNSAFE_style={{ 
                                      fontSize: '0.875rem', 
                                      fontWeight: 500,
                                      color: effectiveTheme === 'dark' ? '#bfdbfe' : '#1e40af',
                                      lineHeight: '1.4',
                                      wordBreak: 'break-word',
                                    }}>
                                      {entity}
                                    </Text>
                                  </View>
                                ))}
                              </Flex>
                            </View>
                          )}

                          {logic.services && logic.services.length > 0 && (
                            <View>
                              <Text UNSAFE_style={{ 
                                fontSize: '0.875rem', 
                                fontWeight: 600,
                                marginBottom: '0.5rem',
                                display: 'block'
                              }}>
                                Services ({logic.services.length})
                              </Text>
                              <Flex direction="row" gap="size-125" wrap>
                                {logic.services.map((service, i) => (
                                  <View
                                    key={i}
                                    paddingX="size-200"
                                    paddingY="size-100"
                                    borderRadius="large"
                                    UNSAFE_style={{
                                      backgroundColor: effectiveTheme === 'dark' 
                                        ? '#064e3b' 
                                        : '#d1fae5',
                                      border: effectiveTheme === 'dark' 
                                        ? '1px solid #10b981' 
                                        : '1px solid #6ee7b7',
                                      minHeight: '28px',
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Text UNSAFE_style={{ 
                                      fontSize: '0.875rem', 
                                      fontWeight: 500,
                                      color: effectiveTheme === 'dark' ? '#a7f3d0' : '#065f46',
                                      lineHeight: '1.4',
                                      wordBreak: 'break-word',
                                    }}>
                                      {service}
                                    </Text>
                                  </View>
                                ))}
                              </Flex>
                            </View>
                          )}

                          {logic.controllers && logic.controllers.length > 0 && (
                            <View>
                              <Text UNSAFE_style={{ 
                                fontSize: '0.875rem', 
                                fontWeight: 600,
                                marginBottom: '0.5rem',
                                display: 'block'
                              }}>
                                Controllers ({logic.controllers.length})
                              </Text>
                              <Flex direction="row" gap="size-125" wrap>
                                {logic.controllers.map((controller, i) => (
                                  <View
                                    key={i}
                                    paddingX="size-200"
                                    paddingY="size-100"
                                    borderRadius="large"
                                    UNSAFE_style={{
                                      backgroundColor: effectiveTheme === 'dark' 
                                        ? '#7c2d12' 
                                        : '#fed7aa',
                                      border: effectiveTheme === 'dark' 
                                        ? '1px solid #f97316' 
                                        : '1px solid #fdba74',
                                      minHeight: '28px',
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Text UNSAFE_style={{ 
                                      fontSize: '0.875rem', 
                                      fontWeight: 500,
                                      color: effectiveTheme === 'dark' ? '#fed7aa' : '#7c2d12',
                                      lineHeight: '1.4',
                                      wordBreak: 'break-word',
                                    }}>
                                      {controller}
                                    </Text>
                                  </View>
                                ))}
                              </Flex>
                            </View>
                          )}

                          {logic.workflows && logic.workflows.length > 0 && (
                            <View>
                              <Text UNSAFE_style={{ 
                                fontSize: '0.875rem', 
                                fontWeight: 600,
                                marginBottom: '0.5rem',
                                display: 'block'
                              }}>
                                Workflows ({logic.workflows.length})
                              </Text>
                              <Flex direction="row" gap="size-125" wrap>
                                {logic.workflows.map((workflow, i) => (
                                  <View
                                    key={i}
                                    paddingX="size-200"
                                    paddingY="size-100"
                                    borderRadius="large"
                                    UNSAFE_style={{
                                      backgroundColor: effectiveTheme === 'dark' 
                                        ? '#581c87' 
                                        : '#e9d5ff',
                                      border: effectiveTheme === 'dark' 
                                        ? '1px solid #a855f7' 
                                        : '1px solid #c084fc',
                                      minHeight: '28px',
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Text UNSAFE_style={{ 
                                      fontSize: '0.875rem', 
                                      fontWeight: 500,
                                      color: effectiveTheme === 'dark' ? '#e9d5ff' : '#581c87',
                                      lineHeight: '1.4',
                                      wordBreak: 'break-word',
                                    }}>
                                      {workflow}
                                    </Text>
                                  </View>
                                ))}
                              </Flex>
                            </View>
                          )}
                        </Flex>
                      </View>
                    )}
                  </Flex>
                </View>
              )
            })}
          </Grid>
        </View>
      )}

      <DialogContainer onDismiss={() => setShowModulePicker(false)}>
        {showModulePicker && (
          <Dialog>
            <Heading>Select Modules to Analyze</Heading>
            <Divider />
            <Content>
              <View maxHeight="size-5000" overflow="auto">
                <CheckboxGroup
                  value={selectedModules}
                  onChange={setSelectedModules}
                >
                  {availableModules.map((module) => (
                    <Checkbox key={module} value={module}>
                      {module}
                    </Checkbox>
                  ))}
                </CheckboxGroup>
              </View>
            </Content>
            <ButtonGroup>
              <Button variant="secondary" onPress={() => setShowModulePicker(false)}>
                Cancel
              </Button>
              <Button variant="accent" onPress={handleModuleSelection}>
                Analyze Selected
              </Button>
            </ButtonGroup>
          </Dialog>
        )}
      </DialogContainer>
        </Flex>
      </Flex>
    </Provider>
  )
}

export default App
