import { useState, useCallback, useEffect } from 'react'
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
  const [log, setLog] = useState<string[]>([])
  const [result, setResult] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [reportData, setReportData] = useState<AnalysisData | null>(null)
  const [showModulePicker, setShowModulePicker] = useState(false)
  const [availableModules, setAvailableModules] = useState<string[]>([])
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [sessionId, setSessionId] = useState('')
  const [rootPath, setRootPath] = useState('')

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

  const addLog = useCallback((message: string) => {
    setLog((prev) => [...prev, message])
  }, [])

  const handleAnalyze = useCallback(async () => {
    setLog([])
    setResult('')
    setReportData(null)
    setIsAnalyzing(true)

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ repo: repoUrl }),
      })

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
  }, [repoUrl, addLog])

  const handleModuleSelection = useCallback(async () => {
    if (selectedModules.length === 0) {
      addLog('No modules selected.')
      return
    }

    setShowModulePicker(false)
    setIsAnalyzing(true)

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          repo: repoUrl,
          sessionId,
          selectedModules,
          rootPath,
        }),
      })

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
  }, [repoUrl, sessionId, selectedModules, rootPath, addLog])

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
          <Flex direction="row" justifyContent="end" alignItems="center" gap="size-200">
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
        </View>

        {/* Main Content */}
        <Flex 
          direction="column" 
          gap="size-300" 
          flex={1}
          UNSAFE_style={{ padding: '1.5rem', overflow: 'auto' }}
        >
          <View>
            <Heading level={1}>Magento Analysis Boilerplate</Heading>
          </View>

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

      <View>
        <Flex direction="row" gap="size-100" alignItems="center">
          <Heading level={3} margin={0}>Progress</Heading>
          {isAnalyzing && <ProgressBar isIndeterminate width="size-1000" aria-label="Analyzing" />}
        </Flex>
        <Well marginTop="size-100">
          <pre style={{
            background: '#111',
            color: '#0f0',
            padding: '1rem',
            whiteSpace: 'pre-wrap',
            margin: 0,
            maxHeight: '200px',
            overflow: 'auto'
          }}>
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
          <Flex direction="row" gap="size-200" alignItems="center" marginBottom="size-200">
            <Button variant="secondary" onPress={handleDownloadPdf}>
              Download PDF
            </Button>
          </Flex>
          <Divider size="M" marginBottom="size-300" />
          <Grid
            columns={repeat('auto-fill', 'size-3600')}
            autoRows="auto"
            gap="size-200"
          >
            {reportData.results?.map((module, idx) => {
              const modulePath = module.modulePath || module.logic?.module || 'Unknown'
              const logic = module.logic || {}
              const complexity = module.complexity || {}

              return (
                <Well key={idx}>
                  <Flex direction="column" gap="size-100">
                    <Heading level={4} margin={0}>{modulePath}</Heading>
                    
                    {logic.summary && (
                      <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#aaa' }}>
                        {logic.summary}
                      </Text>
                    )}

                    <Flex direction="row" gap="size-200" wrap marginTop="size-100">
                      {complexity.linesOfCode !== undefined && (
                        <View padding="size-100" backgroundColor="gray-100" borderRadius="medium">
                          <Text>LOC: <strong>{complexity.linesOfCode}</strong></Text>
                        </View>
                      )}
                      {complexity.classes !== undefined && (
                        <View padding="size-100" backgroundColor="gray-100" borderRadius="medium">
                          <Text>Classes: <strong>{complexity.classes}</strong></Text>
                        </View>
                      )}
                      {complexity.functions !== undefined && (
                        <View padding="size-100" backgroundColor="gray-100" borderRadius="medium">
                          <Text>Functions: <strong>{complexity.functions}</strong></Text>
                        </View>
                      )}
                      {complexity.cyclomaticComplexity !== undefined && (
                        <View padding="size-100" backgroundColor="gray-100" borderRadius="medium">
                          <Text>CC: <strong>{complexity.cyclomaticComplexity}</strong></Text>
                        </View>
                      )}
                    </Flex>

                    {logic.entities && logic.entities.length > 0 && (
                      <View marginTop="size-100">
                        <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#aaa' }}>Entities</Text>
                        <Flex direction="row" gap="size-100" wrap marginTop="size-50">
                          {logic.entities.map((entity, i) => (
                            <View
                              key={i}
                              paddingX="size-100"
                              paddingY="size-50"
                              backgroundColor="gray-200"
                              borderRadius="large"
                            >
                              <Text UNSAFE_style={{ fontSize: '0.75rem' }}>{entity}</Text>
                            </View>
                          ))}
                        </Flex>
                      </View>
                    )}

                    {logic.services && logic.services.length > 0 && (
                      <View marginTop="size-100">
                        <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#aaa' }}>Services</Text>
                        <Flex direction="row" gap="size-100" wrap marginTop="size-50">
                          {logic.services.map((service, i) => (
                            <View
                              key={i}
                              paddingX="size-100"
                              paddingY="size-50"
                              backgroundColor="gray-200"
                              borderRadius="large"
                            >
                              <Text UNSAFE_style={{ fontSize: '0.75rem' }}>{service}</Text>
                            </View>
                          ))}
                        </Flex>
                      </View>
                    )}

                    {logic.controllers && logic.controllers.length > 0 && (
                      <View marginTop="size-100">
                        <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#aaa' }}>Controllers</Text>
                        <Flex direction="row" gap="size-100" wrap marginTop="size-50">
                          {logic.controllers.map((controller, i) => (
                            <View
                              key={i}
                              paddingX="size-100"
                              paddingY="size-50"
                              backgroundColor="gray-200"
                              borderRadius="large"
                            >
                              <Text UNSAFE_style={{ fontSize: '0.75rem' }}>{controller}</Text>
                            </View>
                          ))}
                        </Flex>
                      </View>
                    )}

                    {logic.workflows && logic.workflows.length > 0 && (
                      <View marginTop="size-100">
                        <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#aaa' }}>Workflows</Text>
                        <Flex direction="row" gap="size-100" wrap marginTop="size-50">
                          {logic.workflows.map((workflow, i) => (
                            <View
                              key={i}
                              paddingX="size-100"
                              paddingY="size-50"
                              backgroundColor="gray-200"
                              borderRadius="large"
                            >
                              <Text UNSAFE_style={{ fontSize: '0.75rem' }}>{workflow}</Text>
                            </View>
                          ))}
                        </Flex>
                      </View>
                    )}
                  </Flex>
                </Well>
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
