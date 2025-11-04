import { View, Text, Grid, repeat } from '@adobe/react-spectrum'

interface ComplexityMetric {
  label: string
  value: number
}

interface ComplexityMetricsProps {
  linesOfCode?: number
  classes?: number
  functions?: number
  cyclomaticComplexity?: number
  effectiveTheme: 'light' | 'dark'
}

export function ComplexityMetrics({
  linesOfCode,
  classes,
  functions,
  cyclomaticComplexity,
  effectiveTheme,
}: ComplexityMetricsProps) {
  const metrics: ComplexityMetric[] = []

  if (linesOfCode !== undefined) {
    metrics.push({ label: 'LOC', value: linesOfCode })
  }
  if (classes !== undefined) {
    metrics.push({ label: 'Classes', value: classes })
  }
  if (functions !== undefined) {
    metrics.push({ label: 'Functions', value: functions })
  }
  if (cyclomaticComplexity !== undefined) {
    metrics.push({ label: 'CC', value: cyclomaticComplexity })
  }

  if (metrics.length === 0) {
    return null
  }

  return (
    <View>
      <Text
        UNSAFE_style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: effectiveTheme === 'dark' ? '#999' : '#666',
          marginBottom: '0.5rem',
        }}
      >
        Complexity Metrics
      </Text>
      <Grid columns={repeat('auto-fit', 'minmax(80px, 1fr)')} gap="size-150">
        {metrics.map((metric) => (
          <View
            key={metric.label}
            padding="size-150"
            backgroundColor="gray-200"
            borderRadius="medium"
            UNSAFE_style={{ textAlign: 'center' }}
          >
            <Text
              UNSAFE_style={{
                fontSize: '0.7rem',
                color: effectiveTheme === 'dark' ? '#999' : '#666',
                display: 'block',
                marginBottom: '0.25rem',
              }}
            >
              {metric.label}
            </Text>
            <Text
              UNSAFE_style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                display: 'block',
              }}
            >
              {metric.value}
            </Text>
          </View>
        ))}
      </Grid>
    </View>
  )
}

