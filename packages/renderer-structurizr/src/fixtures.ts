export function officialWorkspaceJson() {
  return {
    name: "Official Export",
    description: "Exported model",
    model: {
      people: [
        {
          id: "1",
          name: "User",
          description: "Uses the system.",
          tags: "Element,Person",
          relationships: [
            {
              id: "7",
              sourceId: "1",
              destinationId: "3",
              description: "Uses",
              tags: "Relationship",
            },
            { id: "8", sourceId: "1", destinationId: "2", description: "Uses" },
          ],
        },
      ],
      softwareSystems: [
        {
          id: "2",
          name: "Recovered System",
          description: "Primary system.",
          tags: "Element,Software System",
          properties: { "structurizr.dsl.identifier": "recovery" },
          relationships: [
            {
              id: "12",
              sourceId: "2",
              destinationId: "6",
              description: "Integrates with",
            },
          ],
          containers: [
            {
              id: "3",
              name: "Web",
              description: "UI",
              technology: "React",
              tags: "Element,Container",
              properties: { "structurizr.dsl.identifier": "web" },
              relationships: [
                {
                  id: "9",
                  sourceId: "3",
                  destinationId: "4",
                  description: "Calls",
                  tags: "Relationship",
                },
              ],
            },
            {
              id: "4",
              name: "API",
              description: "Service",
              technology: "FastAPI",
              tags: "Element,Container",
              properties: { "structurizr.dsl.identifier": "api" },
              relationships: [
                {
                  id: "10",
                  sourceId: "4",
                  destinationId: "5",
                  description: "Reads and writes",
                  tags: "Relationship",
                },
              ],
            },
            {
              id: "5",
              name: "Database",
              description: "State",
              technology: "PostgreSQL",
              tags: "Element,Container,Database",
              properties: { "structurizr.dsl.identifier": "appdb" },
            },
          ],
        },
        {
          id: "6",
          name: "External Dependency",
          description: "External system.",
          tags: "Element,Software System",
        },
      ],
    },
    views: {
      containerViews: [
        {
          key: "Containers",
          name: "Container View: Recovered System",
          softwareSystemId: "2",
          automaticLayout: {
            rankDirection: "LeftRight",
            implementation: "Graphviz",
          },
          dimensions: { width: 1700, height: 980 },
          elements: [
            { id: "1", x: 100, y: 360 },
            { id: "3", x: 520, y: 180 },
            { id: "4", x: 930, y: 180 },
            { id: "5", x: 930, y: 500 },
            { id: "6", x: 1330, y: 340 },
          ],
          relationships: [
            { id: "7", vertices: [{ x: 410, y: 445 }] },
            { id: "9", vertices: [{ x: 820, y: 272 }] },
            { id: "10", vertices: [{ x: 1110, y: 430 }] },
          ],
        },
      ],
      configuration: { styles: {} },
    },
  };
}

export function componentWorkspaceJson() {
  return {
    name: "Component Export",
    model: {
      people: [
        {
          id: "1",
          name: "User",
          tags: "Element,Person",
          relationships: [
            {
              id: "10",
              sourceId: "1",
              destinationId: "3",
              description: "Uses",
            },
          ],
        },
      ],
      softwareSystems: [
        {
          id: "2",
          name: "Recovered System",
          tags: "Element,Software System",
          containers: [
            {
              id: "3",
              name: "API",
              technology: "FastAPI",
              tags: "Element,Container",
              components: [
                {
                  id: "4",
                  name: "Request Controller",
                  technology: "Python",
                  tags: "Element,Component",
                  relationships: [
                    {
                      id: "11",
                      sourceId: "4",
                      destinationId: "5",
                      description: "Delegates",
                      tags: "Relationship",
                    },
                  ],
                },
                {
                  id: "5",
                  name: "Request Repository",
                  technology: "Python",
                  tags: "Element,Component",
                  relationships: [
                    {
                      id: "12",
                      sourceId: "5",
                      destinationId: "6",
                      description: "Reads and writes",
                      tags: "Relationship",
                    },
                  ],
                },
              ],
            },
            {
              id: "6",
              name: "Database",
              technology: "PostgreSQL",
              tags: "Element,Container,Database",
            },
          ],
        },
      ],
    },
    views: {
      componentViews: [
        {
          key: "ApiComponents",
          name: "Component View: API",
          containerId: "3",
          automaticLayout: {
            rankDirection: "LeftRight",
            implementation: "Graphviz",
          },
          dimensions: { width: 1400, height: 760 },
          elements: [
            { id: "4", x: 320, y: 220 },
            { id: "5", x: 720, y: 220 },
            { id: "6", x: 1080, y: 220 },
          ],
          relationships: [
            { id: "11", vertices: [{ x: 650, y: 302 }] },
            { id: "12", vertices: [{ x: 990, y: 302 }] },
          ],
        },
      ],
      configuration: { styles: {} },
    },
  };
}

export function deploymentWorkspaceJson() {
  return {
    name: "Deployment Export",
    model: {
      softwareSystems: [
        {
          id: "2",
          name: "Recovered System",
          tags: "Element,Software System",
          containers: [
            {
              id: "3",
              name: "Web App",
              technology: "React",
              tags: "Element,Container",
            },
            {
              id: "4",
              name: "API",
              technology: "FastAPI",
              tags: "Element,Container",
            },
          ],
        },
      ],
      deploymentEnvironments: [
        {
          name: "Production",
          deploymentNodes: [
            {
              id: "6",
              name: "Kubernetes Cluster",
              technology: "Kubernetes",
              tags: "Element,Deployment Node",
              infrastructureNodes: [
                {
                  id: "7",
                  name: "Ingress",
                  technology: "NGINX",
                  tags: "Element,Infrastructure Node",
                  relationships: [
                    {
                      id: "20",
                      sourceId: "7",
                      destinationId: "8",
                      description: "Routes",
                      tags: "Relationship",
                    },
                  ],
                },
              ],
              containerInstances: [
                {
                  id: "8",
                  containerId: "3",
                  tags: "Element,Container Instance",
                  relationships: [
                    {
                      id: "21",
                      sourceId: "8",
                      destinationId: "9",
                      description: "Calls",
                      tags: "Relationship",
                    },
                  ],
                },
                {
                  id: "9",
                  containerId: "4",
                  tags: "Element,Container Instance",
                },
              ],
            },
          ],
        },
      ],
    },
    views: {
      deploymentViews: [
        {
          key: "ProductionDeployment",
          name: "Deployment View: Production",
          environment: "Production",
          automaticLayout: {
            rankDirection: "LeftRight",
            implementation: "Graphviz",
          },
          dimensions: { width: 1600, height: 900 },
          elements: [
            { id: "6", x: 180, y: 120, width: 1180, height: 560 },
            { id: "7", x: 300, y: 320 },
            { id: "8", x: 680, y: 320 },
            { id: "9", x: 1060, y: 320 },
          ],
          relationships: [
            { id: "20", vertices: [{ x: 610, y: 406 }] },
            { id: "21", vertices: [{ x: 990, y: 406 }] },
          ],
        },
      ],
      configuration: { styles: {} },
    },
  };
}

export function dynamicWorkspaceJson() {
  return {
    name: "Dynamic Workspace",
    description: "Exported dynamic model",
    model: {
      people: [
        {
          id: "1",
          name: "User",
          description: "Starts the scenario.",
          tags: "Element,Person",
          relationships: [
            {
              id: "7",
              sourceId: "1",
              destinationId: "2",
              description: "Uses static dependency",
              tags: "Relationship",
            },
          ],
        },
      ],
      softwareSystems: [
        {
          id: "2",
          name: "Recovery System",
          description: "Coordinates request processing.",
          tags: "Element,Software System",
          containers: [
            {
              id: "3",
              name: "Web App",
              description: "Captures operator intent.",
              technology: "React",
              tags: "Element,Container",
            },
            {
              id: "4",
              name: "API",
              description: "Coordinates request writes.",
              technology: "FastAPI",
              tags: "Element,Container",
            },
            {
              id: "5",
              name: "Database",
              description: "Stores request state.",
              technology: "PostgreSQL",
              tags: "Element,Container,Database",
            },
          ],
        },
        {
          id: "6",
          name: "External Analytics",
          description: "Not part of the dynamic interaction.",
          tags: "Element,Software System",
        },
      ],
    },
    views: {
      systemContextViews: [
        {
          key: "SystemContext",
          name: "System Context View: Recovery System",
          softwareSystemId: "2",
          automaticLayout: {
            rankDirection: "LeftRight",
            implementation: "Graphviz",
          },
          dimensions: { width: 1200, height: 640 },
          elements: [
            { id: "1", x: 100, y: 120 },
            { id: "2", x: 680, y: 120 },
          ],
          relationships: [{ id: "7", vertices: [{ x: 520, y: 190 }] }],
        },
      ],
      dynamicViews: [
        {
          key: "Request Processing",
          name: "Dynamic View: Recovery System",
          elementId: "2",
          automaticLayout: {
            rankDirection: "LeftRight",
            implementation: "Graphviz",
          },
          dimensions: { width: 1800, height: 720 },
          elements: [
            { id: "1", x: 90, y: 160 },
            { id: "3", x: 500, y: 160 },
            { id: "4", x: 910, y: 160 },
            { id: "5", x: 1320, y: 160 },
          ],
          relationships: [
            {
              sourceId: "1",
              destinationId: "3",
              description: "Starts request",
              order: "1",
              tags: "Relationship",
              vertices: [{ x: 420, y: 246 }],
            },
            {
              sourceId: "3",
              destinationId: "4",
              description: "Writes request",
              order: "2",
              tags: "Relationship",
              vertices: [{ x: 830, y: 246 }],
            },
            {
              sourceId: "4",
              destinationId: "3",
              description: "Returns accepted",
              order: "3",
              tags: "Relationship",
              vertices: [{ x: 800, y: 140 }],
            },
            {
              sourceId: "4",
              destinationId: "3",
              description: "Streams update",
              order: "4",
              tags: "Relationship",
              vertices: [{ x: 810, y: 330 }],
            },
            {
              sourceId: "4",
              destinationId: "5",
              description: "Persists request",
              order: "5",
              tags: "Relationship",
              vertices: [{ x: 1240, y: 246 }],
            },
          ],
        },
      ],
      configuration: { styles: {} },
    },
  };
}
