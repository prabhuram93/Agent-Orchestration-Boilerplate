import { View, Flex, Heading, Button, Divider, Grid, repeat } from '@adobe/react-spectrum'
import type { AnalysisData } from '../types'
import { ModuleCard } from './ModuleCard'

interface AnalysisReportProps {
  reportData: AnalysisData
  effectiveTheme: 'light' | 'dark'
  onDownloadPdf: () => void
}

export function AnalysisReport({ reportData, effectiveTheme, onDownloadPdf }: AnalysisReportProps) {
  if (!reportData || !reportData.results || reportData.results.length === 0) {
    return null
  }

  return (
    <View>
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        marginBottom="size-200"
      >
        <Heading level={3} margin={0}>
          Analysis Report
        </Heading>
        <Button variant="secondary" onPress={onDownloadPdf}>
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
        {reportData.results.map((module, idx) => (
          <ModuleCard key={idx} module={module} effectiveTheme={effectiveTheme} />
        ))}
      </Grid>
    </View>
  )
}

