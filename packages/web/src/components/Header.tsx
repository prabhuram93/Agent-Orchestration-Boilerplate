import {
  View,
  Heading,
  Button,
  Flex,
  ActionButton,
  MenuTrigger,
  Menu,
  Item,
} from '@adobe/react-spectrum'
import Light from '@spectrum-icons/workflow/Light'
import type { ThemeMode } from '../types'

interface HeaderProps {
  themeMode: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
}

export function Header({ themeMode, onThemeChange }: HeaderProps) {
  return (
    <View
      backgroundColor="gray-100"
      borderBottomColor="gray-300"
      borderBottomWidth="thin"
      paddingX="size-300"
      paddingY="size-200"
    >
      <Flex direction="row" justifyContent="space-between" alignItems="center" gap="size-200">
        <Heading level={1} margin={0} UNSAFE_style={{ fontSize: '1.5rem' }}>
          Magento Analysis Boilerplate
        </Heading>
        <Flex direction="row" alignItems="center" gap="size-200">
          <MenuTrigger>
            <ActionButton isQuiet aria-label="Theme">
              <Light />
            </ActionButton>
            <Menu
              selectedKeys={[themeMode]}
              selectionMode="single"
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as ThemeMode
                onThemeChange(selected)
              }}
            >
              <Item key="light">Light</Item>
              <Item key="dark">Dark</Item>
              <Item key="system">System</Item>
            </Menu>
          </MenuTrigger>
          <Button variant="accent">Sign In</Button>
        </Flex>
      </Flex>
    </View>
  )
}

