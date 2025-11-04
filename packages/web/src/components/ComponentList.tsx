import { View, Text, Flex } from '@adobe/react-spectrum'
import { ComponentBadge } from './ComponentBadge'

interface ComponentSection {
  type: 'entity' | 'service' | 'controller' | 'workflow'
  title: string
  items: string[]
}

interface ComponentListProps {
  entities?: string[]
  services?: string[]
  controllers?: string[]
  workflows?: string[]
  effectiveTheme: 'light' | 'dark'
}

export function ComponentList({
  entities,
  services,
  controllers,
  workflows,
  effectiveTheme,
}: ComponentListProps) {
  const sections: ComponentSection[] = []

  if (entities && entities.length > 0) {
    sections.push({ type: 'entity', title: 'Entities', items: entities })
  }
  if (services && services.length > 0) {
    sections.push({ type: 'service', title: 'Services', items: services })
  }
  if (controllers && controllers.length > 0) {
    sections.push({ type: 'controller', title: 'Controllers', items: controllers })
  }
  if (workflows && workflows.length > 0) {
    sections.push({ type: 'workflow', title: 'Workflows', items: workflows })
  }

  if (sections.length === 0) {
    return null
  }

  return (
    <View marginTop="size-100">
      <Text
        UNSAFE_style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: effectiveTheme === 'dark' ? '#999' : '#666',
          marginBottom: '0.75rem',
          display: 'block',
        }}
      >
        Components
      </Text>
      <Flex direction="column" gap="size-150">
        {sections.map((section) => (
          <View key={section.type}>
            <Text
              UNSAFE_style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                marginBottom: '0.5rem',
                display: 'block',
              }}
            >
              {section.title} ({section.items.length})
            </Text>
            <Flex direction="row" gap="size-125" wrap>
              {section.items.map((item, i) => (
                <ComponentBadge
                  key={i}
                  type={section.type}
                  label={item}
                  effectiveTheme={effectiveTheme}
                />
              ))}
            </Flex>
          </View>
        ))}
      </Flex>
    </View>
  )
}

