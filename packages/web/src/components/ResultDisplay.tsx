import { View, Heading } from '@adobe/react-spectrum'

interface ResultDisplayProps {
  result: string
}

export function ResultDisplay({ result }: ResultDisplayProps) {
  return (
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
          padding: '8px',
        }}
      />
    </View>
  )
}

