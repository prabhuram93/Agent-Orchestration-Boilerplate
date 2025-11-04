import {
  DialogContainer,
  Dialog,
  Heading,
  Divider,
  Content,
  View,
  CheckboxGroup,
  Checkbox,
  ButtonGroup,
  Button,
} from '@adobe/react-spectrum'

interface ModulePickerDialogProps {
  showModulePicker: boolean
  availableModules: string[]
  selectedModules: string[]
  onSelectionChange: (modules: string[]) => void
  onDismiss: () => void
  onConfirm: () => void
}

export function ModulePickerDialog({
  showModulePicker,
  availableModules,
  selectedModules,
  onSelectionChange,
  onDismiss,
  onConfirm,
}: ModulePickerDialogProps) {
  return (
    <DialogContainer onDismiss={onDismiss}>
      {showModulePicker && (
        <Dialog>
          <Heading>Select Modules to Analyze</Heading>
          <Divider />
          <Content>
            <View maxHeight="size-5000" overflow="auto">
              <CheckboxGroup value={selectedModules} onChange={onSelectionChange}>
                {availableModules.map((module) => (
                  <Checkbox key={module} value={module}>
                    {module}
                  </Checkbox>
                ))}
              </CheckboxGroup>
            </View>
          </Content>
          <ButtonGroup>
            <Button variant="secondary" onPress={onDismiss}>
              Cancel
            </Button>
            <Button variant="accent" onPress={onConfirm}>
              Analyze Selected
            </Button>
          </ButtonGroup>
        </Dialog>
      )}
    </DialogContainer>
  )
}

