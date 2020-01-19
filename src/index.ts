import { useRef, useState, useMemo, useCallback, useEffect } from "react";

/* Types */

export type Assert<T> = (value: T) => boolean;

export type Schema<T = any> = {
  key: string | RegExp;
  init?: T;
  assert?: Assert<T>;
};

export type Config = {
  keyPrefix: string;
  storage?: Storage;
  crossTab: boolean;
  serialize(value: any): string;
  deserialize(raw: string): any;
  schemas: Schema[];
};

export type InternalUpdater<T = any> = (value: T) => void;

export type UpdaterMap = Record<string, InternalUpdater[]>;

export type Updater<T> = (valueOrFactory: T | ((value: T) => T)) => void;

export type UseStoreReturn<T> = [T, Updater<T>];

/* Configurables */

const storeConfig: Config = {
  keyPrefix: "",
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  crossTab: false,
  serialize: JSON.stringify,
  deserialize: JSON.parse,
  schemas: []
};

export function config(options: Partial<Config>): void {
  if (
    options.hasOwnProperty("crossTab") &&
    typeof window !== "undefined" &&
    options.crossTab !== storeConfig.crossTab
  )
    window[options.crossTab ? "addEventListener" : "removeEventListener"](
      "storage",
      callUpdatersFromEvent as EventListener
    );
  Object.assign(storeConfig, options);
}

export function addSchema<T = any>(
  key: string | RegExp,
  init?: T,
  assert?: Assert<T>
): void {
  storeConfig.schemas.push({ key, init, assert });
}

/* Update Events */

const storeUpdaters: UpdaterMap = Object.create(null);

function addUpdater<T>(key: string, updater: InternalUpdater<T>): void {
  if (key in storeUpdaters) storeUpdaters[key].push(updater);
  else storeUpdaters[key] = [updater];
}

function removeUpdater<T>(key: string, updater: InternalUpdater<T>): void {
  if (key in storeUpdaters) {
    const index = storeUpdaters[key].indexOf(updater);
    index !== -1 && storeUpdaters[key].splice(index, 1);
  }
}

function callUpdaters<T>(key: string, value: T): void {
  if (key in storeUpdaters)
    for (const updater of storeUpdaters[key]) updater(value);
}

const callUpdatersFromEvent = (event: StorageEvent) => {
  event.storageArea === storeConfig.storage &&
    event.key &&
    event.key.startsWith(storeConfig.keyPrefix) &&
    event.oldValue !== null &&
    event.newValue !== null &&
    callUpdaters(
      event.key.substring(storeConfig.keyPrefix.length),
      storeConfig.deserialize(event.newValue)
    );
};

/* React Stuff */

export function useStore<T = any>(
  key: string,
  init?: T,
  assert?: Assert<T>
): UseStoreReturn<T> {
  const value = useRef<T>();

  const schema = useMemo<Schema<T> | undefined>(
    () =>
      storeConfig.schemas.find(schema => {
        if (typeof schema.key === "string") return schema.key === key;
        // regexp
        else return schema.key.test(key);
      }),
    [key]
  );

  useMemo(() => {
    if (storeConfig.storage) {
      const finalInit = [init, schema && schema.init, null].find(
        init => init !== undefined
      );
      const finalAssert = assert || (schema && schema.assert);

      try {
        const serialized = storeConfig.storage.getItem(
          `${storeConfig.keyPrefix}${key}`
        );
        if (serialized === null) {
          // noinspection ExceptionCaughtLocallyJS
          throw new Error();
        }
        const stored: T = storeConfig.deserialize(serialized);
        if (finalAssert && !finalAssert(stored)) {
          // noinspection ExceptionCaughtLocallyJS
          throw new Error();
        }
        value.current = stored;
      } catch (err) {
        storeConfig.storage.setItem(
          `${storeConfig.keyPrefix}${key}`,
          storeConfig.serialize(finalInit)
        );
        value.current = finalInit as T;
      }
    }
  }, [key, init, assert, schema]);

  const updateTrigger = useState({})[1];

  useEffect(() => {
    const updater = (newValue: T) => {
      value.current = newValue;
      updateTrigger({});
    };
    addUpdater(key, updater);
    return () => {
      removeUpdater(key, updater);
    };
  }, [key]);

  const globalUpdater = useCallback<Updater<T>>(
    (newValue: T | ((value: T) => T)) => {
      if (newValue instanceof Function) newValue = newValue(value.current as T);
      if (storeConfig.storage && newValue !== value.current) {
        storeConfig.storage.setItem(
          `${storeConfig.keyPrefix}${key}`,
          storeConfig.serialize(newValue)
        );
        callUpdaters(key, newValue);
      }
    },
    [key]
  );

  return [value.current as T, globalUpdater];
}

export function readStore<T = any>(key: string): T | undefined {
  if (storeConfig.storage) {
    const serialized = storeConfig.storage.getItem(
      `${storeConfig.keyPrefix}${key}`
    );
    if (serialized !== null) return storeConfig.deserialize(serialized);
  }
}
