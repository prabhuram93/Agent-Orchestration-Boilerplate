import { View, Flex, Heading, Text } from '@adobe/react-spectrum'
import type { ModuleAnalysisResult } from '../types'
import { ComplexityMetrics } from './ComplexityMetrics'
import { ComponentList } from './ComponentList'

interface ModuleCardProps {
  module: ModuleAnalysisResult
  effectiveTheme: 'light' | 'dark'
}

export function ModuleCard({ module, effectiveTheme }: ModuleCardProps) {
  const modulePath = module.modulePath || module.logic?.module || 'Unknown'
  const logic = module.logic || {}
  const complexity = module.complexity || {}

  return (
    <View
      borderWidth="thin"
      borderColor="gray-400"
      borderRadius="large"
      padding="size-300"
      backgroundColor="gray-50"
      UNSAFE_style={{
        boxShadow:
          effectiveTheme === 'dark' ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
        cursor: 'default',
      }}
      UNSAFE_className="module-card"
    >
      <Flex direction="column" gap="size-200">
        {/* Card Header */}
        <View paddingBottom="size-150" borderBottomWidth="thin" borderBottomColor="gray-300">
          <Heading
            level={4}
            margin={0}
            UNSAFE_style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {modulePath}
          </Heading>
        </View>

        {/* Summary Section */}
        {logic.summary && (
          <View paddingY="size-100">
            <Text
              UNSAFE_style={{
                fontSize: '0.875rem',
                lineHeight: '1.5',
                color: effectiveTheme === 'dark' ? '#c4c4c4' : '#666',
              }}
            >
              {logic.summary}
            </Text>
          </View>
        )}

        {/* Metrics Section */}
        <ComplexityMetrics
          linesOfCode={complexity.linesOfCode}
          classes={complexity.classes}
          functions={complexity.functions}
          cyclomaticComplexity={complexity.cyclomaticComplexity}
          effectiveTheme={effectiveTheme}
        />

        {/* Components Section */}
        <ComponentList
          entities={logic.entities}
          services={logic.services}
          controllers={logic.controllers}
          workflows={logic.workflows}
          effectiveTheme={effectiveTheme}
        />
      </Flex>
    </View>
  )
}

