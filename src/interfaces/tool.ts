export interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: any;
}

export interface JsonSchema {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  readOnly: boolean;
}
