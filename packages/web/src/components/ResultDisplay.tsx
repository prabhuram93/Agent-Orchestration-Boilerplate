import { View, Heading } from '@adobe/react-spectrum'

interface ResultDisplayProps {
  result: string
  effectiveTheme: 'light' | 'dark'
}

export function ResultDisplay({ result, effectiveTheme }: ResultDisplayProps) {
  return (
    <View>
      <Heading level={3} margin={0}>Final Result</Heading>
      <View
        marginTop="size-100"
        borderWidth="thin"
        borderColor="gray-400"
        borderRadius="medium"
        backgroundColor={effectiveTheme === 'dark' ? 'gray-100' : 'gray-75'}
        padding="size-200"
      >
        <textarea
          readOnly
          value={result}
          style={{
            width: '100%',
            height: '200px',
            fontFamily: 'Monaco, Menlo, Ubuntu Mono, Consolas, source-code-pro, monospace',
            fontSize: '0.875rem',
            lineHeight: '1.5',
            color: effectiveTheme === 'dark' ? '#a8e6cf' : '#2d5f3f',
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            resize: 'vertical',
            margin: 0,
          }}
        />
      </View>
    </View>
  )
}

