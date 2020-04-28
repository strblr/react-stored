import { useRef, useState, useMemo, useLayoutEffect } from "react";

// Types

export type Key = string;

export type KeyPattern = Key | RegExp;

export type Asserter<T = any> = (value: T) => boolean;

export type Schema<T = any> = {
  key: KeyPattern;
  init: T;
  assert: Asserter<T>;
};

export type Options = {
  storage: Storage;
  keyPrefix: string;
  serialize(value: any): string;
  deserialize(raw: string): any;
  schemas: Array<Schema>;
};

export type Trigger = () => void;

export type TriggerMap = Record<Key, Array<Trigger>>;

export type Updater<T = any> = (value: T | ((value: T) => T)) => void;

// Main factory

export function createStore(options: Partial<Options>) {
  const config = completeOptions(options);
  const triggers: TriggerMap = Object.create(null);

  return {
    addSchema<T = any>(schema: Schema<T>) {
      config.schemas.push(schema);
    },
    setOptions(options: Partial<Options>) {
      Object.assign(config, options);
    },
    readStore<T = any>(key: Key) {
      const serialized = config.storage.getItem(`${config.keyPrefix}${key}`);
      return serialized === null
        ? undefined
        : (config.deserialize(serialized) as T);
    },
    useStore<T = any>(key: Key) {
      const schema = useMemo<Schema<T>>(() => {
        const schema = config.schemas.find(schema =>
          typeof schema.key === "string"
            ? schema.key === key
            : schema.key.test(key)
        );
        if (!schema)
          throw new Error("key used in useStore must match a schema");
        return schema;
      }, [key]);

      const [dirty, setDirty] = useState({});

      const value = useMemo(() => {
        const shortcut = () => {
          config.storage.setItem(
            `${config.keyPrefix}${key}`,
            config.serialize(schema.init)
          );
          return schema.init;
        };
        const serialized = config.storage.getItem(`${config.keyPrefix}${key}`);
        if (serialized === null) return shortcut();
        const stored = config.deserialize(serialized);
        if (!schema.assert(stored) && dirty) return shortcut();
        return stored as T;
      }, [key, schema, dirty]);

      useLayoutEffect(() => {
        const updater = () => setDirty({});
        addTrigger(triggers, key, updater);
        return () => removeTrigger(triggers, key, updater);
      }, [key]);

      const updater: Updater<T> = nextValue => {
        if (nextValue instanceof Function) nextValue = nextValue(value);
        if (nextValue !== value) {
          config.storage.setItem(
            `${config.keyPrefix}${key}`,
            config.serialize(nextValue)
          );
          callTriggers(triggers, key);
        }
      };

      const updaterRef = useRef(updater);
      useLayoutEffect(() => {
        updaterRef.current = updater;
      });

      const immutableUpdaterRef = useRef<Updater<T>>(nextValue =>
        updaterRef.current(nextValue)
      );

      return [value, immutableUpdaterRef.current] as [T, Updater<T>];
    }
  };
}

// Helpers

function completeOptions({
  storage,
  keyPrefix,
  serialize,
  deserialize,
  schemas
}: Partial<Options>): Options {
  return {
    storage:
      storage ??
      (hasLocalStorage()
        ? window.localStorage
        : (() => {
            throw new Error("createStore must be given a storage");
          })()),
    keyPrefix: keyPrefix ?? "",
    serialize: serialize ?? JSON.stringify,
    deserialize: deserialize ?? JSON.parse,
    schemas: schemas ?? []
  };
}

function hasLocalStorage() {
  return typeof window !== undefined && !!window.localStorage;
}

function addTrigger(triggers: TriggerMap, key: Key, trigger: Trigger) {
  if (!(key in triggers)) triggers[key] = [];
  triggers[key].push(trigger);
}

function removeTrigger(triggers: TriggerMap, key: Key, trigger: Trigger) {
  if (key in triggers) {
    const index = triggers[key].indexOf(trigger);
    if (index !== -1) triggers[key].splice(index, 1);
  }
}

function callTriggers(triggers: TriggerMap, key: Key) {
  if (key in triggers) for (const trigger of triggers[key]) trigger();
}
