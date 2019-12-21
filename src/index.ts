import { useRef, useState, useMemo, useCallback, useEffect } from "react";

/* Configurables */

interface Schema {
  key: string | RegExp;
  init: any;
  assert(_: any): boolean;
}

interface Config {
  keyPrefix: string;
  storage?: Storage;
  crossTab: boolean;
  serialize(_: any): string;
  deserialize(_: string): any;
  schemas: Schema[];
}

const storeConfig: Config = {
  keyPrefix: "",
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  crossTab: false,
  serialize: JSON.stringify,
  deserialize: JSON.parse,
  schemas: []
};

export const config = (options: Config) => {
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
};

export const addSchema = (
  key: string | RegExp,
  init: any,
  assert: (_: any) => boolean
) => {
  storeConfig.schemas.push({ key, init, assert });
};

/* Update Events */

type Updater = (_: any) => void;

interface UpdaterMap {
  [_: string]: Updater[];
}

const storeUpdaters: UpdaterMap = {};

const addUpdater = (key: string, updater: Updater) => {
  if (storeUpdaters.hasOwnProperty(key)) storeUpdaters[key].push(updater);
  else storeUpdaters[key] = [updater];
};

const removeUpdater = (key: string, updater: Updater) => {
  if (storeUpdaters.hasOwnProperty(key)) {
    const index = storeUpdaters[key].indexOf(updater);
    index !== -1 && storeUpdaters[key].splice(index, 1);
  }
};

const callUpdaters = (key: string, value: Updater) => {
  if (storeUpdaters.hasOwnProperty(key))
    for (const updater of storeUpdaters[key]) updater(value);
};

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

export const useStore = (
  key: string,
  init?: any,
  assert?: (_: any) => boolean
): [any, (_: any) => void] => {
  const value = useRef<any>();

  const schema = useMemo<Schema | undefined>(
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
        if (serialized === null) throw new Error();
        const stored = storeConfig.deserialize(serialized);
        if (finalAssert && !finalAssert(stored)) throw new Error();
        value.current = stored;
      } catch (err) {
        storeConfig.storage.setItem(
          `${storeConfig.keyPrefix}${key}`,
          storeConfig.serialize(finalInit)
        );
        value.current = finalInit;
      }
    }
  }, [key, init, assert, schema]);

  const updateTrigger = useState({})[1];

  useEffect(() => {
    const updater = (newValue: any) => {
      value.current = newValue;
      updateTrigger({});
    };
    addUpdater(key, updater);
    return () => {
      removeUpdater(key, updater);
    };
  }, [key]);

  const globalUpdater = useCallback(
    newValue => {
      if (typeof newValue === "function") newValue = newValue(value.current);
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

  return [value.current, globalUpdater];
};

export const readStore = (key: string) => {
  if (storeConfig.storage) {
    const serialized = storeConfig.storage.getItem(
      `${storeConfig.keyPrefix}${key}`
    );
    if (serialized !== null) return storeConfig.deserialize(serialized);
  }
};
