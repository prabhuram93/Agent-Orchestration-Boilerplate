import { View, Flex, Heading, ProgressBar } from '@adobe/react-spectrum'

interface ProgressLogProps {
  log: string[]
  isAnalyzing: boolean
  containerRef: React.RefObject<HTMLPreElement | null>
  onScroll: () => void
  effectiveTheme: 'light' | 'dark'
}

export function ProgressLog({ log, isAnalyzing, containerRef, onScroll, effectiveTheme }: ProgressLogProps) {
  return (
    <View>
      <Flex direction="row" gap="size-100" alignItems="center">
        <Heading level={3} margin={0}>
          Progress
        </Heading>
        {isAnalyzing && <ProgressBar isIndeterminate width="size-1000" aria-label="Analyzing" />}
      </Flex>
      <View
        marginTop="size-100"
        borderWidth="thin"
        borderColor="gray-400"
        borderRadius="medium"
        backgroundColor={effectiveTheme === 'dark' ? 'gray-100' : 'gray-75'}
        padding="size-200"
      >
        <pre
          ref={containerRef}
          onScroll={onScroll}
          style={{
            fontFamily: 'Monaco, Menlo, Ubuntu Mono, Consolas, source-code-pro, monospace',
            fontSize: '0.875rem',
            lineHeight: '1.5',
            color: effectiveTheme === 'dark' ? '#a8e6cf' : '#2d5f3f',
            whiteSpace: 'pre-wrap',
            margin: 0,
            maxHeight: '200px',
            overflow: 'auto',
          }}
        >
          {log.join('\n')}
        </pre>
      </View>
    </View>
  )
}

