import { View, Flex, TextField, Button, Text } from '@adobe/react-spectrum'

interface AnalysisFormProps {
  repoUrl: string
  zipFile: File | null
  isAnalyzing: boolean
  effectiveTheme: 'light' | 'dark'
  onRepoUrlChange: (url: string) => void
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onAnalyze: () => void
}

export function AnalysisForm({
  repoUrl,
  zipFile,
  isAnalyzing,
  effectiveTheme,
  onRepoUrlChange,
  onFileChange,
  onAnalyze,
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
          <Button variant="accent" onPress={onAnalyze} isDisabled={isAnalyzing}>
            Analyze
          </Button>
        </Flex>

        <Flex direction="row" gap="size-200" alignItems="center">
          <Text UNSAFE_style={{ fontWeight: 500 }}>Or upload a zip file:</Text>
          <input
            type="file"
            accept=".zip"
            onChange={onFileChange}
            disabled={isAnalyzing}
            style={{
              padding: '8px',
              borderRadius: '4px',
              border: effectiveTheme === 'dark' ? '1px solid #555' : '1px solid #ccc',
              backgroundColor: effectiveTheme === 'dark' ? '#2a2a2a' : '#fff',
              color: effectiveTheme === 'dark' ? '#fff' : '#000',
              cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              opacity: isAnalyzing ? 0.5 : 1,
            }}
          />
          {zipFile && (
            <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#10b981' }}>
              Selected: {zipFile.name}
            </Text>
          )}
        </Flex>
      </Flex>
    </View>
  )
}

