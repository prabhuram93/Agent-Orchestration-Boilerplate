import { AgentOperation, OperationOptions } from './common';

export interface DiagramInputs {
  modulePath: string;
  logic: {
    module?: string;
    entities?: string[];
    services?: string[];
    controllers?: string[];
    workflows?: string[];
  };
}

export interface MermaidDiagram {
  id: string;
  title: string;
  description?: string;
  chart: string;
}

export type GeneratedDiagrams = MermaidDiagram[];

export class DiagramGenerationOperation extends AgentOperation<DiagramInputs, GeneratedDiagrams> {
  async execute(inputs: DiagramInputs, options: OperationOptions): Promise<GeneratedDiagrams> {
    const sandbox = options.sandbox as any | undefined;
    const rootPath = String(options.context?.rootPath || '');
    const progress = typeof options.progress === 'function' ? options.progress : undefined;
    const logic = inputs.logic || {};
    const entities = logic.entities || [];
    const services = logic.services || [];
    const controllers = logic.controllers || [];
    const workflows = logic.workflows || [];

    // Try AI-generated diagrams first
    if (sandbox) {
      const aiDiagrams = await this.generateAIDiagrams(
        inputs.modulePath,
        logic,
        sandbox,
        rootPath,
        progress
      );
      if (aiDiagrams.length > 0) {
        return aiDiagrams;
      }
    }

    // Fallback to generic structural diagrams
    progress?.(`Generating generic diagrams for ${inputs.modulePath}...`);
    return this.generateGenericDiagrams(entities, services, controllers, workflows);
  }

  private async generateAIDiagrams(
    modulePath: string,
    logic: DiagramInputs['logic'],
    sandbox: any,
    rootPath: string,
    progress?: (msg: string) => void
  ): Promise<MermaidDiagram[]> {
    try {
      progress?.(`Claude: health check for diagram generation in ${modulePath}...`);
      const cliCheck = await sandbox.exec(`bash -lc 'command -v claude >/dev/null 2>&1 && echo ok || echo missing'`);
      const credCheck = await sandbox.exec(
        `bash -lc 'cd "${rootPath}" 2>/dev/null || true; if env | grep -qE "^(ANTHROPIC_API_KEY|AWS_BEARER_TOKEN_BEDROCK|CLAUDE_CODE_USE_BEDROCK)="; then echo creds_ok; else echo creds_missing; fi'`
      );
      const cliOk = !!(cliCheck?.stdout || '').includes('ok');
      const credsOk = !!(credCheck?.stdout || '').includes('creds_ok');
      
      if (!cliOk || !credsOk) {
        progress?.(`Claude: unhealthy for diagrams (cli: ${cliOk ? 'ok' : 'missing'}, creds: ${credsOk ? 'ok' : 'missing'})`);
        return [];
      }

      progress?.(`Claude: generating context-aware diagrams for ${modulePath}...`);

      const summary = logic.summary || 'Analyze this module';
      const componentInfo = [
        entities.length > 0 ? `Entities: ${entities.join(', ')}` : '',
        services.length > 0 ? `Services: ${services.join(', ')}` : '',
        controllers.length > 0 ? `Controllers: ${controllers.join(', ')}` : '',
        workflows.length > 0 ? `Workflows: ${workflows.join(', ')}` : ''
      ].filter(Boolean).join('. ');

      const task = [
        `Analyze the code in ${modulePath}.`,
        `Module purpose: ${summary}.`,
        componentInfo ? `Components: ${componentInfo}.` : '',
        'Generate 2-3 Mermaid diagrams that explain HOW this module works and its key workflows.',
        'Return ONLY a JSON array of diagram objects.',
        'Each object must have: {"id": "unique-id", "title": "Diagram Title", "description": "What this shows", "chart": "mermaid syntax"}.',
        'Make diagrams SPECIFIC to this module\'s actual functionality, not generic structures.',
        'Focus on: actual business workflows, state transitions, data flows, decision paths, or use cases.',
        'Use appropriate Mermaid diagram types: flowchart, sequenceDiagram, stateDiagram-v2, graph.',
        'Make the chart field contain ONLY the mermaid syntax (no backticks, no "mermaid" tag).',
        'Ensure diagrams are educational and help understand what the module actually does.',
        'Return ONLY the JSON array, no other text.'
      ].filter(Boolean).join(' ');

      const safeTask = task.replace(/"/g, '\\"');
      const cd = rootPath ? `cd "${rootPath}" && ` : '';
      const cmd = `${cd}claude -p "${safeTask}"`;

      const res = await sandbox.exec(cmd);
      const out = res?.success ? res.stdout : res?.stderr;
      
      if (!out) {
        progress?.('Claude: no output for diagram generation');
        return [];
      }

      const preview = (out || '').slice(0, 200).replace(/\s+/g, ' ').trim();
      progress?.(`Claude: diagram output preview: ${preview}...`);

      const diagrams = this.parseAIDiagramResponse(out, progress);
      if (diagrams.length > 0) {
        progress?.(`Claude: generated ${diagrams.length} context-aware diagrams`);
        return diagrams;
      }

      progress?.('Claude: failed to parse diagram response');
      return [];
    } catch (err) {
      progress?.(`Claude: diagram generation error - ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  private parseAIDiagramResponse(output: string, progress?: (msg: string) => void): MermaidDiagram[] {
    try {
      // Try to extract JSON array from the output
      const jsonText = this.extractFirstJson(output);
      if (!jsonText) {
        return [];
      }

      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        return [];
      }

      const diagrams: MermaidDiagram[] = [];
      for (const item of parsed) {
        if (
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          typeof item.chart === 'string' &&
          item.chart.trim().length > 0
        ) {
          diagrams.push({
            id: item.id,
            title: item.title,
            description: typeof item.description === 'string' ? item.description : undefined,
            chart: item.chart.trim()
          });
        }
      }

      return diagrams;
    } catch (err) {
      progress?.(`Failed to parse AI diagram response: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  private extractFirstJson(input: string | undefined | null): string | null {
    if (!input) return null;
    const text = String(input).trim();
    if (!text) return null;

    // 1) If wrapped in triple backticks (optionally tagged as json), extract the inner block
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced && fenced[1]) {
      const inner = fenced[1].trim();
      if (inner.startsWith('[') || inner.startsWith('{')) return inner;
    }

    // 2) Find the first balanced JSON structure (array or object)
    const arrayStart = text.indexOf('[');
    const objectStart = text.indexOf('{');
    
    if (arrayStart === -1 && objectStart === -1) return null;
    
    // Try array first if it comes before object
    if (arrayStart !== -1 && (arrayStart < objectStart || objectStart === -1)) {
      const result = this.extractBalancedJson(text, arrayStart, '[', ']');
      if (result) return result;
    }
    
    // Try object
    if (objectStart !== -1) {
      const result = this.extractBalancedJson(text, objectStart, '{', '}');
      if (result) return result;
    }

    return null;
  }

  private extractBalancedJson(text: string, start: number, openChar: string, closeChar: string): string | null {
    let depth = 0;
    let inString = false;
    let isEscaped = false;
    
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (isEscaped) {
          isEscaped = false;
        } else if (ch === '\\') {
          isEscaped = true;
        } else if (ch === '"') {
          inString = false;
        }
      } else {
        if (ch === '"') {
          inString = true;
        } else if (ch === openChar) {
          depth++;
        } else if (ch === closeChar) {
          depth--;
          if (depth === 0) {
            return text.slice(start, i + 1).trim();
          }
        }
      }
    }
    return null;
  }

  private generateGenericDiagrams(
    entities: string[],
    services: string[],
    controllers: string[],
    workflows: string[]
  ): MermaidDiagram[] {
    const diagrams: MermaidDiagram[] = [];
    const hasComponents = entities.length > 0 || services.length > 0 || controllers.length > 0;

    if (hasComponents) {
      diagrams.push({
        id: 'sequence',
        title: 'Sequence Diagram',
        description: 'Shows the interaction flow between components during a request',
        chart: this.generateSequenceDiagram(entities, services, controllers),
      });

      diagrams.push({
        id: 'architecture',
        title: 'Architecture',
        description: 'Visualizes the overall module structure and component relationships',
        chart: this.generateArchitectureDiagram(entities, services, controllers, workflows),
      });
    }

    if (workflows.length > 0) {
      diagrams.push({
        id: 'workflow',
        title: 'Workflow Process',
        description: 'Displays the business workflow process flow',
        chart: this.generateWorkflowDiagram(workflows),
      });
    }

    return diagrams;
  }

  private generateSequenceDiagram(
    entities: string[],
    services: string[],
    controllers: string[]
  ): string {
    if (entities.length === 0 && services.length === 0 && controllers.length === 0) {
      return `sequenceDiagram
    participant User
    Note over User: No components found`;
    }

    let diagram = `sequenceDiagram
    participant Client
`;

    // Add participants
    if (controllers.length > 0) {
      const controller = controllers[0].replace(/[^a-zA-Z0-9]/g, '');
      diagram += `    participant ${controller} as Controller\n`;
    }
    if (services.length > 0) {
      const service = services[0].replace(/[^a-zA-Z0-9]/g, '');
      diagram += `    participant ${service} as Service\n`;
    }
    if (entities.length > 0) {
      const entity = entities[0].replace(/[^a-zA-Z0-9]/g, '');
      diagram += `    participant ${entity} as Entity\n`;
    }
    diagram += `    participant Database\n\n`;

    // Add interactions
    if (controllers.length > 0) {
      const controller = controllers[0].replace(/[^a-zA-Z0-9]/g, '');
      diagram += `    Client->>+${controller}: HTTP Request\n`;
      
      if (services.length > 0) {
        const service = services[0].replace(/[^a-zA-Z0-9]/g, '');
        diagram += `    ${controller}->>+${service}: Process Request\n`;
        
        if (entities.length > 0) {
          const entity = entities[0].replace(/[^a-zA-Z0-9]/g, '');
          diagram += `    ${service}->>+${entity}: Create/Update/Query\n`;
          diagram += `    ${entity}->>+Database: Persist Data\n`;
          diagram += `    Database-->>-${entity}: Result\n`;
          diagram += `    ${entity}-->>-${service}: Entity Data\n`;
        } else {
          diagram += `    ${service}->>+Database: Query Data\n`;
          diagram += `    Database-->>-${service}: Result\n`;
        }
        
        diagram += `    ${service}-->>-${controller}: Response Data\n`;
      }
      
      diagram += `    ${controller}-->>-Client: HTTP Response\n`;
    } else if (services.length > 0) {
      const service = services[0].replace(/[^a-zA-Z0-9]/g, '');
      diagram += `    Client->>+${service}: Service Call\n`;
      
      if (entities.length > 0) {
        const entity = entities[0].replace(/[^a-zA-Z0-9]/g, '');
        diagram += `    ${service}->>+${entity}: Use Entity\n`;
        diagram += `    ${entity}->>+Database: Database Operation\n`;
        diagram += `    Database-->>-${entity}: Result\n`;
        diagram += `    ${entity}-->>-${service}: Data\n`;
      }
      
      diagram += `    ${service}-->>-Client: Response\n`;
    }

    return diagram;
  }

  private generateArchitectureDiagram(
    entities: string[],
    services: string[],
    controllers: string[],
    workflows: string[]
  ): string {
    if (entities.length === 0 && services.length === 0 && controllers.length === 0) {
      return `graph TD
    NoData[No Components Found]
    style NoData fill:#f9f,stroke:#333,stroke-width:2px`;
    }

    let diagram = `graph TD
    Client[Client/UI]
`;

    // Add controllers
    if (controllers.length > 0) {
      diagram += `    Client --> Controllers\n`;
      diagram += `    subgraph Controllers\n`;
      controllers.slice(0, 5).forEach((ctrl, idx) => {
        diagram += `        C${idx}["${ctrl}"]\n`;
      });
      if (controllers.length > 5) {
        diagram += `        CMore["... ${controllers.length - 5} more"]\n`;
      }
      diagram += `    end\n\n`;
    }

    // Add services
    if (services.length > 0) {
      if (controllers.length > 0) {
        diagram += `    Controllers --> Services\n`;
      } else {
        diagram += `    Client --> Services\n`;
      }
      diagram += `    subgraph Services\n`;
      services.slice(0, 5).forEach((svc, idx) => {
        diagram += `        S${idx}["${svc}"]\n`;
      });
      if (services.length > 5) {
        diagram += `        SMore["... ${services.length - 5} more"]\n`;
      }
      diagram += `    end\n\n`;
    }

    // Add entities
    if (entities.length > 0) {
      if (services.length > 0) {
        diagram += `    Services --> Entities\n`;
      } else if (controllers.length > 0) {
        diagram += `    Controllers --> Entities\n`;
      }
      diagram += `    subgraph Entities\n`;
      entities.slice(0, 5).forEach((ent, idx) => {
        diagram += `        E${idx}["${ent}"]\n`;
      });
      if (entities.length > 5) {
        diagram += `        EMore["... ${entities.length - 5} more"]\n`;
      }
      diagram += `    end\n\n`;
      diagram += `    Entities --> Database[(Database)]\n`;
    }

    // Add workflows if available
    if (workflows.length > 0) {
      diagram += `    Services --> Workflows\n`;
      diagram += `    subgraph Workflows\n`;
      workflows.slice(0, 5).forEach((wf, idx) => {
        diagram += `        W${idx}["${wf}"]\n`;
      });
      if (workflows.length > 5) {
        diagram += `        WMore["... ${workflows.length - 5} more"]\n`;
      }
      diagram += `    end\n`;
    }

    // Add styling
    diagram += `
    style Client fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    style Controllers fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style Services fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    style Entities fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    style Database fill:#fce4ec,stroke:#880e4f,stroke-width:2px`;
    
    if (workflows.length > 0) {
      diagram += `
    style Workflows fill:#fff9c4,stroke:#f57f17,stroke-width:2px`;
    }

    return diagram;
  }

  private generateWorkflowDiagram(workflows: string[]): string {
    if (workflows.length === 0) {
      return `graph LR
    NoWorkflows[No Workflows Defined]
    style NoWorkflows fill:#f9f,stroke:#333,stroke-width:2px`;
    }

    let diagram = `graph LR
    Start([Start])
`;

    workflows.forEach((wf, idx) => {
      if (idx === 0) {
        diagram += `    Start --> W${idx}["${wf}"]\n`;
      } else {
        diagram += `    W${idx - 1} --> W${idx}["${wf}"]\n`;
      }
    });

    diagram += `    W${workflows.length - 1} --> End([End])\n\n`;
    diagram += `    style Start fill:#e1f5ff,stroke:#01579b,stroke-width:2px\n`;
    diagram += `    style End fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px\n`;

    return diagram;
  }
}

