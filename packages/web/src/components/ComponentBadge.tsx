import { View, Text } from '@adobe/react-spectrum'

interface BadgeStyle {
  backgroundColor: string
  border: string
  color: string
}

type ComponentType = 'entity' | 'service' | 'controller' | 'workflow'

const getBadgeStyle = (type: ComponentType, theme: 'light' | 'dark'): BadgeStyle => {
  const styles: Record<ComponentType, { light: BadgeStyle; dark: BadgeStyle }> = {
    entity: {
      dark: {
        backgroundColor: '#1e3a8a',
        border: '1px solid #3b82f6',
        color: '#bfdbfe',
      },
      light: {
        backgroundColor: '#dbeafe',
        border: '1px solid #93c5fd',
        color: '#1e40af',
      },
    },
    service: {
      dark: {
        backgroundColor: '#064e3b',
        border: '1px solid #10b981',
        color: '#a7f3d0',
      },
      light: {
        backgroundColor: '#d1fae5',
        border: '1px solid #6ee7b7',
        color: '#065f46',
      },
    },
    controller: {
      dark: {
        backgroundColor: '#7c2d12',
        border: '1px solid #f97316',
        color: '#fed7aa',
      },
      light: {
        backgroundColor: '#fed7aa',
        border: '1px solid #fdba74',
        color: '#7c2d12',
      },
    },
    workflow: {
      dark: {
        backgroundColor: '#581c87',
        border: '1px solid #a855f7',
        color: '#e9d5ff',
      },
      light: {
        backgroundColor: '#e9d5ff',
        border: '1px solid #c084fc',
        color: '#581c87',
      },
    },
  }

  return styles[type][theme]
}

interface ComponentBadgeProps {
  type: ComponentType
  label: string
  effectiveTheme: 'light' | 'dark'
}

export function ComponentBadge({ type, label, effectiveTheme }: ComponentBadgeProps) {
  const style = getBadgeStyle(type, effectiveTheme)

  return (
    <View
      paddingX="size-200"
      paddingY="size-100"
      borderRadius="large"
      UNSAFE_style={{
        backgroundColor: style.backgroundColor,
        border: style.border,
        minHeight: '28px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Text
        UNSAFE_style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          color: style.color,
          lineHeight: '1.4',
          wordBreak: 'break-word',
        }}
      >
        {label}
      </Text>
    </View>
  )
}

