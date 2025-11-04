import { useState, useEffect } from 'react'
import { View, Flex, Button, Heading, Tabs, TabList, TabPanels, Item } from '@adobe/react-spectrum'
import ChevronUp from '@spectrum-icons/workflow/ChevronUp'
import ChevronDown from '@spectrum-icons/workflow/ChevronDown'

interface SessionMetadata {
  inputs: {
    repoUrl: string
    uploadedFileName: string
    modulesSelected: string[]
  }
  events: {
    uploadStartTimestamp: string
    uploadEndTimestamp: string
    moduleAnalysisStartTimestamp: string
    moduleAnalysisEndTimestamp: string
  }
}

interface LogsAccordionProps {
  log: string[]
  result: string
  metadata: SessionMetadata
  containerRef: React.RefObject<HTMLPreElement | null>
  onScroll: () => void
  effectiveTheme: 'light' | 'dark'
}

export function LogsAccordion({
  log,
  result,
  metadata,
  containerRef,
  onScroll,
  effectiveTheme,
}: LogsAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Get the latest log line
  const latestLog = log.length > 0 ? log[log.length - 1] : null

  // Scroll to bottom when accordion is expanded
  useEffect(() => {
    if (isExpanded && containerRef.current) {
      // Use setTimeout to ensure DOM has fully rendered before scrolling
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight
        }
      }, 100)
    }
  }, [isExpanded, containerRef])

  return (
    <View
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      backgroundColor={effectiveTheme === 'dark' ? 'gray-200' : 'gray-50'}
      borderTopWidth="thick"
      borderTopColor="gray-400"
      UNSAFE_style={{
        zIndex: 1000,
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Accordion Header */}
      <View
        paddingX="size-300"
        paddingY="size-200"
      >
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <Flex
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            gap="size-200"
          >
            <Flex direction="row" gap="size-200" alignItems="center" UNSAFE_style={{ flex: 1, minWidth: 0 }}>
              <Heading level={4} margin={0}>
                Logs
              </Heading>
              {/* Latest log preview */}
              {latestLog && !isExpanded && (
                <div
                  style={{
                    fontFamily: 'Monaco, Menlo, Ubuntu Mono, Consolas, source-code-pro, monospace',
                    fontSize: '0.75rem',
                    lineHeight: '1.4',
                    color: effectiveTheme === 'dark' ? '#a8e6cf' : '#2d5f3f',
                    opacity: 0.8,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    marginLeft: '16px',
                  }}
                >
                  {latestLog}
                </div>
              )}
            </Flex>
            <View UNSAFE_style={{ pointerEvents: 'none' }}>
              <Button
                variant="secondary"
                isQuiet
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <ChevronDown /> : <ChevronUp />}
              </Button>
            </View>
          </Flex>
        </div>
      </View>

      {/* Accordion Content */}
      {isExpanded && (
        <View
          paddingX="size-300"
          paddingBottom="size-300"
          UNSAFE_style={{
            height: '325px',
            overflowY: 'auto',
          }}
        >
          <Tabs aria-label="Logs tabs" density="compact">
            <TabList>
              <Item key="progress">Progress</Item>
              <Item key="result">Result</Item>
              <Item key="metadata">Metadata</Item>
            </TabList>
            <TabPanels>
              <Item key="progress">
                <View marginTop="size-200">
                  {log.length > 0 ? (
                    <View
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
                          maxHeight: '230px',
                          overflow: 'auto',
                        }}
                      >
                        {log.join('\n')}
                      </pre>
                    </View>
                  ) : (
                    <View padding="size-200">
                      <p style={{ margin: 0, color: effectiveTheme === 'dark' ? '#999' : '#666' }}>
                        No progress logs yet.
                      </p>
                    </View>
                  )}
                </View>
              </Item>
              <Item key="result">
                <View marginTop="size-200">
                  {result ? (
                    <View
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
                          height: '230px',
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
                  ) : (
                    <View padding="size-200">
                      <p style={{ margin: 0, color: effectiveTheme === 'dark' ? '#999' : '#666' }}>
                        No results yet.
                      </p>
                    </View>
                  )}
                </View>
              </Item>
              <Item key="metadata">
                <View marginTop="size-200">
                  <View
                    borderWidth="thin"
                    borderColor="gray-400"
                    borderRadius="medium"
                    backgroundColor={effectiveTheme === 'dark' ? 'gray-100' : 'gray-75'}
                    padding="size-200"
                  >
                    <pre
                      style={{
                        fontFamily: 'Monaco, Menlo, Ubuntu Mono, Consolas, source-code-pro, monospace',
                        fontSize: '0.875rem',
                        lineHeight: '1.5',
                        color: effectiveTheme === 'dark' ? '#a8e6cf' : '#2d5f3f',
                        whiteSpace: 'pre-wrap',
                        margin: 0,
                        maxHeight: '230px',
                        overflow: 'auto',
                      }}
                    >
                      {JSON.stringify(metadata, null, 2)}
                    </pre>
                  </View>
                </View>
              </Item>
            </TabPanels>
          </Tabs>
        </View>
      )}
    </View>
  )
}

