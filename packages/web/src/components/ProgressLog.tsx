import { View, Flex, Heading, Well, ProgressBar } from '@adobe/react-spectrum'

interface ProgressLogProps {
  log: string[]
  isAnalyzing: boolean
  containerRef: React.RefObject<HTMLPreElement | null>
  onScroll: () => void
}

export function ProgressLog({ log, isAnalyzing, containerRef, onScroll }: ProgressLogProps) {
  return (
    <View>
      <Flex direction="row" gap="size-100" alignItems="center">
        <Heading level={3} margin={0}>
          Progress
        </Heading>
        {isAnalyzing && <ProgressBar isIndeterminate width="size-1000" aria-label="Analyzing" />}
      </Flex>
      <Well marginTop="size-100">
        <pre
          ref={containerRef}
          onScroll={onScroll}
          style={{
            background: '#111',
            color: '#0f0',
            padding: '1rem',
            whiteSpace: 'pre-wrap',
            margin: 0,
            maxHeight: '200px',
            overflow: 'auto',
          }}
        >
          {log.join('\n')}
        </pre>
      </Well>
    </View>
  )
}

