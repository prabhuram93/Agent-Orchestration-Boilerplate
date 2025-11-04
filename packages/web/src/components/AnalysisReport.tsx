import { View, Flex, Heading, Button, Divider, Grid, repeat, ProgressBar, Content } from '@adobe/react-spectrum'
import type { AnalysisData } from '../types'
import { ModuleCard } from './ModuleCard'

interface AnalysisReportProps {
  reportData: AnalysisData | null
  effectiveTheme: 'light' | 'dark'
  onDownloadPdf: () => void
  isAnalyzing: boolean
}

export function AnalysisReport({ reportData, effectiveTheme, onDownloadPdf, isAnalyzing }: AnalysisReportProps) {
  const hasResults = reportData && reportData.results && reportData.results.length > 0

  return (
    <Flex direction="column" UNSAFE_style={{ height: '100%', minHeight: 0, width: '100%' }}>
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        marginBottom="size-200"
      >
        <Heading level={3} margin={0}>
          Analysis Report
        </Heading>
        {hasResults && (
          <Button variant="secondary" onPress={onDownloadPdf}>
            Download PDF
          </Button>
        )}
      </Flex>
      <Divider size="M" marginBottom="size-300" />
      
      <View UNSAFE_style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {isAnalyzing ? (
          <View
            borderWidth="thin"
            borderColor="gray-400"
            borderRadius="medium"
            padding="size-400"
            backgroundColor={effectiveTheme === 'dark' ? 'gray-100' : 'gray-50'}
            UNSAFE_style={{ height: '100%' }}
          >
            <Flex direction="column" gap="size-200" alignItems="center" justifyContent="center" height="100%">
              <ProgressBar
                isIndeterminate
                width="size-3000"
                aria-label="Analyzing modules"
              />
              <Content>
                <p style={{ margin: 0, color: effectiveTheme === 'dark' ? '#999' : '#666' }}>
                  Analyzing modules...
                </p>
              </Content>
            </Flex>
          </View>
        ) : hasResults ? (
          <Grid
            columns={repeat('auto-fit', 'minmax(700px, 1fr)')}
            autoRows="auto"
            gap="size-300"
            width="100%"
            UNSAFE_style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(700px, 1fr))',
            }}
          >
            {reportData?.results?.map((module, idx) => (
              <ModuleCard key={idx} module={module} effectiveTheme={effectiveTheme} />
            ))}
          </Grid>
        ) : (
          <View
            borderWidth="thin"
            borderColor="gray-400"
            borderRadius="medium"
            padding="size-400"
            backgroundColor={effectiveTheme === 'dark' ? 'gray-100' : 'gray-50'}
            UNSAFE_style={{ height: '100%' }}
          >
            <Flex alignItems="center" justifyContent="center" height="100%">
              <Content>
                <p style={{ margin: 0, color: effectiveTheme === 'dark' ? '#999' : '#666' }}>
                  No analysis results yet. Start an analysis to see the report.
                </p>
              </Content>
            </Flex>
          </View>
        )}
      </View>
    </Flex>
  )
}

