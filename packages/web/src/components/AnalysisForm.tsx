import { View, Flex, TextField, Button, Text, Divider, Heading, CheckboxGroup, Checkbox } from '@adobe/react-spectrum'

interface AnalysisFormProps {
  repoUrl: string
  zipFile: File | null
  isAnalyzing: boolean
  effectiveTheme: 'light' | 'dark'
  availableModules: string[]
  selectedModules: string[]
  onRepoUrlChange: (url: string) => void
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onAnalyze: () => void
  onModuleSelectionChange: (modules: string[]) => void
  onAnalyzeSelected: () => void
  onSelectAll: () => void
  onDeselectAll: () => void
}

export function AnalysisForm({
  repoUrl,
  zipFile,
  isAnalyzing,
  effectiveTheme,
  availableModules,
  selectedModules,
  onRepoUrlChange,
  onFileChange,
  onAnalyze,
  onModuleSelectionChange,
  onAnalyzeSelected,
  onSelectAll,
  onDeselectAll,
}: AnalysisFormProps) {
  return (
    <View
      borderWidth="thin"
      borderColor="gray-400"
      borderRadius="large"
      padding="size-300"
      backgroundColor={effectiveTheme === 'dark' ? 'gray-100' : 'gray-75'}
      UNSAFE_style={{
        boxShadow:
          effectiveTheme === 'dark' ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
      }}
    >
      <Flex direction="column" gap="size-200">
        <Flex direction="row" gap="size-200" alignItems="end">
          <TextField
            label="Repo URL"
            value={repoUrl}
            onChange={(url) => {
              onRepoUrlChange((url || '').trim())
            }}
            width="size-6000"
            placeholder="https://github.com/owner/repo.git"
          />
          <Button variant="accent" onPress={onAnalyze} isDisabled={isAnalyzing || availableModules.length > 0}>
            Analyze
          </Button>
        </Flex>

        <Flex direction="row" gap="size-200" alignItems="center">
          <Text UNSAFE_style={{ fontWeight: 500 }}>Or upload a zip file:</Text>
          <input
            type="file"
            accept=".zip"
            onChange={onFileChange}
            disabled={isAnalyzing || availableModules.length > 0}
            style={{
              padding: '8px',
              borderRadius: '4px',
              border: effectiveTheme === 'dark' ? '1px solid #555' : '1px solid #ccc',
              backgroundColor: effectiveTheme === 'dark' ? '#2a2a2a' : '#fff',
              color: effectiveTheme === 'dark' ? '#fff' : '#000',
              cursor: (isAnalyzing || availableModules.length > 0) ? 'not-allowed' : 'pointer',
              opacity: (isAnalyzing || availableModules.length > 0) ? 0.5 : 1,
            }}
          />
          {zipFile && (
            <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#10b981' }}>
              Selected: {zipFile.name}
            </Text>
          )}
        </Flex>

        {availableModules.length > 0 && (
          <>
            <Divider size="S" marginTop="size-200" marginBottom="size-100" />
            <Flex direction="row" justifyContent="space-between" alignItems="center" marginTop="size-100" marginBottom="size-100">
              <Heading level={4}>
                Select Modules to Analyze
              </Heading>
              <Flex direction="row" gap="size-100">
                <Button 
                  variant="secondary" 
                  onPress={onSelectAll}
                  isDisabled={isAnalyzing || selectedModules.length === availableModules.length}
                  UNSAFE_style={{ fontSize: '0.875rem' }}
                >
                  Select All
                </Button>
                <Button 
                  variant="secondary" 
                  onPress={onDeselectAll}
                  isDisabled={isAnalyzing || selectedModules.length === 0}
                  UNSAFE_style={{ fontSize: '0.875rem' }}
                >
                  Deselect All
                </Button>
              </Flex>
            </Flex>
            <View 
              maxHeight="size-3000" 
              overflow="auto"
              borderWidth="thin"
              borderColor="gray-300"
              borderRadius="medium"
              padding="size-200"
              backgroundColor={effectiveTheme === 'dark' ? 'gray-200' : 'gray-50'}
            >
              <CheckboxGroup value={selectedModules} onChange={onModuleSelectionChange}>
                {availableModules.map((module) => (
                  <Checkbox key={module} value={module}>
                    {module}
                  </Checkbox>
                ))}
              </CheckboxGroup>
            </View>
            <Flex direction="row" gap="size-200" justifyContent="space-between" alignItems="center">
              <Text UNSAFE_style={{ fontSize: '0.875rem', color: effectiveTheme === 'dark' ? '#aaa' : '#666' }}>
                {selectedModules.length} of {availableModules.length} modules selected
              </Text>
              <Button 
                variant="accent" 
                onPress={onAnalyzeSelected} 
                isDisabled={isAnalyzing || selectedModules.length === 0}
              >
                Analyze Selected Modules
              </Button>
            </Flex>
          </>
        )}
      </Flex>
    </View>
  )
}

