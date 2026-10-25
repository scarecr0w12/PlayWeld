import {
  compile,
  ValidationError,
  type SettingDefinition,
  type SettingGroup,
} from '@gamecrafter/contracts';

interface RegisteredSetting {
  definition: SettingDefinition;
  validator: ReturnType<typeof compile<unknown>>;
}

export class SettingsRegistry {
  private readonly groups = new Map<string, SettingGroup>();
  private readonly definitions = new Map<string, RegisteredSetting>();

  register(source: string, groups: SettingGroup[], definitions: SettingDefinition[]): void {
    const pendingGroups = new Map<string, SettingGroup>();
    for (const group of groups) {
      if (this.groups.has(group.id) || pendingGroups.has(group.id)) {
        throw new Error(`Duplicate setting group: ${group.id}`);
      }
      pendingGroups.set(group.id, group);
    }

    const pendingDefinitions = new Map<string, RegisteredSetting>();
    for (const input of definitions) {
      if (this.definitions.has(input.key) || pendingDefinitions.has(input.key)) {
        throw new Error(`Duplicate setting key: ${input.key}`);
      }
      if (!this.groups.has(input.group) && !pendingGroups.has(input.group)) {
        throw new Error(`Unknown setting group ${input.group} for ${input.key}`);
      }
      const definition = { ...input, source };
      const validator = compile<unknown>(definition.schema as Parameters<typeof compile>[0]);
      try {
        validator.assert(definition.default);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid default for setting ${definition.key}: ${detail}`);
      }
      pendingDefinitions.set(definition.key, { definition, validator });
    }

    for (const [id, group] of pendingGroups) this.groups.set(id, group);
    for (const [key, registered] of pendingDefinitions) this.definitions.set(key, registered);
  }

  unregisterSource(source: string): string[] {
    const removed: string[] = [];
    for (const [key, registered] of this.definitions) {
      if (registered.definition.source !== source) continue;
      this.definitions.delete(key);
      removed.push(key);
    }
    return removed.sort((left, right) => left.localeCompare(right));
  }

  replaceSource(source: string, definitions: SettingDefinition[]): void {
    const previous = this.describe().definitions.filter(
      (definition) => definition.source === source,
    );
    this.unregisterSource(source);
    try {
      this.register(source, [], definitions);
    } catch (error) {
      this.register(source, [], previous);
      throw error;
    }
  }

  validateReplacement(source: string, definitions: SettingDefinition[]): void {
    const candidate = new SettingsRegistry();
    const current = this.describe();
    candidate.register(
      'validation',
      current.groups,
      current.definitions.filter((definition) => definition.source !== source),
    );
    candidate.register(source, [], definitions);
  }

  describe(): { groups: SettingGroup[]; definitions: SettingDefinition[] } {
    const groups = [...this.groups.values()].sort((left, right) => left.order - right.order);
    const groupOrders = new Map(groups.map((group) => [group.id, group.order]));
    const definitions = [...this.definitions.values()]
      .map(({ definition }) => definition)
      .sort(
        (left, right) =>
          (groupOrders.get(left.group) ?? Number.MAX_SAFE_INTEGER) -
            (groupOrders.get(right.group) ?? Number.MAX_SAFE_INTEGER) ||
          left.key.localeCompare(right.key),
      );
    return { groups, definitions };
  }

  get(key: string): SettingDefinition | undefined {
    return this.definitions.get(key)?.definition;
  }

  validateValue(key: string, value: unknown): string[] {
    const registered = this.definitions.get(key);
    if (!registered) throw new Error(`Unknown setting: ${key}`);
    if (registered.validator.check(value)) return [];
    try {
      registered.validator.assert(value);
    } catch (error) {
      if (error instanceof ValidationError) return error.errors;
      throw error;
    }
    return [];
  }
}
