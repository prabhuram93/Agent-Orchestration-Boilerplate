import { useState } from 'react'
import { View, Flex, Heading, TabList, TabPanels, Tabs, Item, Text } from '@adobe/react-spectrum'
import type { ModuleAnalysisResult } from '../types'
import { MermaidDiagram } from './MermaidDiagram'

interface WorkflowDiagramProps {
  module: ModuleAnalysisResult
  effectiveTheme: 'light' | 'dark'
}

/**
 * Generate a sequence diagram showing the flow through entities -> services -> controllers
 */
function generateSequenceDiagram(module: ModuleAnalysisResult): string {
  const logic = module.logic || {}
  const entities = logic.entities || []
  const services = logic.services || []
  const controllers = logic.controllers || []

  if (entities.length === 0 && services.length === 0 && controllers.length === 0) {
    return `sequenceDiagram
    participant User
    Note over User: No components found`
  }

  let diagram = `sequenceDiagram
    participant Client
`

  // Add participants
  if (controllers.length > 0) {
    const controller = controllers[0].replace(/[^a-zA-Z0-9]/g, '')
    diagram += `    participant ${controller} as Controller\n`
  }
  if (services.length > 0) {
    const service = services[0].replace(/[^a-zA-Z0-9]/g, '')
    diagram += `    participant ${service} as Service\n`
  }
  if (entities.length > 0) {
    const entity = entities[0].replace(/[^a-zA-Z0-9]/g, '')
    diagram += `    participant ${entity} as Entity\n`
  }
  diagram += `    participant Database\n\n`

  // Add interactions
  if (controllers.length > 0) {
    const controller = controllers[0].replace(/[^a-zA-Z0-9]/g, '')
    diagram += `    Client->>+${controller}: HTTP Request\n`
    
    if (services.length > 0) {
      const service = services[0].replace(/[^a-zA-Z0-9]/g, '')
      diagram += `    ${controller}->>+${service}: Process Request\n`
      
      if (entities.length > 0) {
        const entity = entities[0].replace(/[^a-zA-Z0-9]/g, '')
        diagram += `    ${service}->>+${entity}: Create/Update/Query\n`
        diagram += `    ${entity}->>+Database: Persist Data\n`
        diagram += `    Database-->>-${entity}: Result\n`
        diagram += `    ${entity}-->>-${service}: Entity Data\n`
      } else {
        diagram += `    ${service}->>+Database: Query Data\n`
        diagram += `    Database-->>-${service}: Result\n`
      }
      
      diagram += `    ${service}-->>-${controller}: Response Data\n`
    }
    
    diagram += `    ${controller}-->>-Client: HTTP Response\n`
  } else if (services.length > 0) {
    const service = services[0].replace(/[^a-zA-Z0-9]/g, '')
    diagram += `    Client->>+${service}: Service Call\n`
    
    if (entities.length > 0) {
      const entity = entities[0].replace(/[^a-zA-Z0-9]/g, '')
      diagram += `    ${service}->>+${entity}: Use Entity\n`
      diagram += `    ${entity}->>+Database: Database Operation\n`
      diagram += `    Database-->>-${entity}: Result\n`
      diagram += `    ${entity}-->>-${service}: Data\n`
    }
    
    diagram += `    ${service}-->>-Client: Response\n`
  }

  return diagram
}

/**
 * Generate a flowchart showing the architecture/structure
 */
function generateArchitectureDiagram(module: ModuleAnalysisResult): string {
  const logic = module.logic || {}
  const entities = logic.entities || []
  const services = logic.services || []
  const controllers = logic.controllers || []
  const workflows = logic.workflows || []

  if (entities.length === 0 && services.length === 0 && controllers.length === 0) {
    return `graph TD
    NoData[No Components Found]
    style NoData fill:#f9f,stroke:#333,stroke-width:2px`
  }

  let diagram = `graph TD
    Client[Client/UI]
`

  // Add controllers
  if (controllers.length > 0) {
    diagram += `    Client --> Controllers\n`
    diagram += `    subgraph Controllers\n`
    controllers.slice(0, 5).forEach((ctrl, idx) => {
      diagram += `        C${idx}["${ctrl}"]\n`
    })
    if (controllers.length > 5) {
      diagram += `        CMore["... ${controllers.length - 5} more"]\n`
    }
    diagram += `    end\n\n`
  }

  // Add services
  if (services.length > 0) {
    if (controllers.length > 0) {
      diagram += `    Controllers --> Services\n`
    } else {
      diagram += `    Client --> Services\n`
    }
    diagram += `    subgraph Services\n`
    services.slice(0, 5).forEach((svc, idx) => {
      diagram += `        S${idx}["${svc}"]\n`
    })
    if (services.length > 5) {
      diagram += `        SMore["... ${services.length - 5} more"]\n`
    }
    diagram += `    end\n\n`
  }

  // Add entities
  if (entities.length > 0) {
    if (services.length > 0) {
      diagram += `    Services --> Entities\n`
    } else if (controllers.length > 0) {
      diagram += `    Controllers --> Entities\n`
    }
    diagram += `    subgraph Entities\n`
    entities.slice(0, 5).forEach((ent, idx) => {
      diagram += `        E${idx}["${ent}"]\n`
    })
    if (entities.length > 5) {
      diagram += `        EMore["... ${entities.length - 5} more"]\n`
    }
    diagram += `    end\n\n`
    diagram += `    Entities --> Database[(Database)]\n`
  }

  // Add workflows if available
  if (workflows.length > 0) {
    diagram += `    Services --> Workflows\n`
    diagram += `    subgraph Workflows\n`
    workflows.slice(0, 5).forEach((wf, idx) => {
      diagram += `        W${idx}["${wf}"]\n`
    })
    if (workflows.length > 5) {
      diagram += `        WMore["... ${workflows.length - 5} more"]\n`
    }
    diagram += `    end\n`
  }

  // Add styling
  diagram += `
    style Client fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    style Controllers fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style Services fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    style Entities fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    style Database fill:#fce4ec,stroke:#880e4f,stroke-width:2px`
  
  if (workflows.length > 0) {
    diagram += `
    style Workflows fill:#fff9c4,stroke:#f57f17,stroke-width:2px`
  }

  return diagram
}

/**
 * Generate a workflow-specific diagram
 */
function generateWorkflowDiagram(module: ModuleAnalysisResult): string {
  const logic = module.logic || {}
  const workflows = logic.workflows || []

  if (workflows.length === 0) {
    return `graph LR
    NoWorkflows[No Workflows Defined]
    style NoWorkflows fill:#f9f,stroke:#333,stroke-width:2px`
  }

  let diagram = `graph LR
    Start([Start])
`

  workflows.forEach((wf, idx) => {
    if (idx === 0) {
      diagram += `    Start --> W${idx}["${wf}"]\n`
    } else {
      diagram += `    W${idx - 1} --> W${idx}["${wf}"]\n`
    }
  })

  diagram += `    W${workflows.length - 1} --> End([End])\n\n`
  diagram += `    style Start fill:#e1f5ff,stroke:#01579b,stroke-width:2px\n`
  diagram += `    style End fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px\n`

  return diagram
}

export function WorkflowDiagram({ module, effectiveTheme }: WorkflowDiagramProps) {
  // Use pre-generated diagrams from analysis if available, otherwise generate fallback diagrams
  const diagrams = module.diagrams && module.diagrams.length > 0 
    ? module.diagrams 
    : generateFallbackDiagrams(module)

  const [selectedTab, setSelectedTab] = useState<string>(diagrams[0]?.id || 'none')

  if (!diagrams || diagrams.length === 0) {
    return (
      <View
        borderWidth="thin"
        borderColor="gray-400"
        borderRadius="medium"
        padding="size-200"
        backgroundColor="gray-75"
        UNSAFE_style={{
          marginTop: '1rem',
        }}
      >
        <Text UNSAFE_style={{ fontStyle: 'italic', color: '#666' }}>
          No diagrams available for this module
        </Text>
      </View>
    )
  }

  return (
    <View
      borderWidth="thin"
      borderColor="gray-400"
      borderRadius="medium"
      padding="size-200"
      backgroundColor="gray-75"
      UNSAFE_style={{
        marginTop: '1rem',
      }}
    >
      <Flex direction="column" gap="size-200">
        <Heading level={5} margin={0} UNSAFE_style={{ fontSize: '0.95rem', fontWeight: 600 }}>
          Workflow Visualizations
        </Heading>
        
        <Tabs
          aria-label="Diagram types"
          selectedKey={selectedTab}
          onSelectionChange={(key) => setSelectedTab(key as string)}
        >
          <TabList>
            {diagrams.map((diagram) => (
              <Item key={diagram.id}>{diagram.title}</Item>
            ))}
          </TabList>
          <TabPanels>
            {diagrams.map((diagram) => (
              <Item key={diagram.id}>
                {diagram.description && (
                  <Text UNSAFE_style={{ 
                    display: 'block',
                    marginBottom: '0.75rem', 
                    fontSize: '0.875rem', 
                    color: effectiveTheme === 'dark' ? '#c4c4c4' : '#666',
                    fontStyle: 'italic'
                  }}>
                    {diagram.description}
                  </Text>
                )}
                <MermaidDiagram chart={diagram.chart} effectiveTheme={effectiveTheme} />
              </Item>
            ))}
          </TabPanels>
        </Tabs>
      </Flex>
    </View>
  )
}

/**
 * Generate fallback diagrams for backward compatibility when backend doesn't provide them
 */
function generateFallbackDiagrams(module: ModuleAnalysisResult) {
  const diagrams = []
  const logic = module.logic || {}
  const entities = logic.entities || []
  const services = logic.services || []
  const controllers = logic.controllers || []
  const workflows = logic.workflows || []

  const hasComponents = entities.length > 0 || services.length > 0 || controllers.length > 0

  if (hasComponents) {
    diagrams.push({
      id: 'sequence',
      title: 'Sequence Diagram',
      description: 'Shows the interaction flow between components during a request',
      chart: generateSequenceDiagram(module)
    })

    diagrams.push({
      id: 'architecture',
      title: 'Architecture',
      description: 'Visualizes the overall module structure and component relationships',
      chart: generateArchitectureDiagram(module)
    })
  }

  if (workflows.length > 0) {
    diagrams.push({
      id: 'workflow',
      title: 'Workflow Process',
      description: 'Displays the business workflow process flow',
      chart: generateWorkflowDiagram(module)
    })
  }

  return diagrams
}

