import { useRef, useState, useMemo, useCallback, useEffect } from 'react'

/* Configurables */

let storeStorage = window.localStorage
let storeKeyPrefix = ''
let storeSerialize = JSON.stringify
let storeDeserialize = JSON.parse

const storeSchemas = []

export const config = ({ storage, keyPrefix, serialize, deserialize, schemas }) => {
  storage && (storeStorage = storage)
  keyPrefix && (storeKeyPrefix = keyPrefix)
  serialize && (storeSerialize = serialize)
  deserialize && (storeDeserialize = deserialize)
  schemas && storeSchemas.push(...schemas)
}

export const addSchema = (key, init, assert) => {
  storeSchemas.push({ key, init, assert })
}

/* Update Events */

const storeUpdaters = {}

const addUpdater = (key, updater) => {
  if(!(key in storeUpdaters))
    storeUpdaters[key] = [updater]
  else
    storeUpdaters[key].push(updater)
}

const removeUpdater = (key, updater) => {
  if(key in storeUpdaters) {
    const index = storeUpdaters[key].indexOf(updater)
    index !== -1 && storeUpdaters[key].splice(index, 1)
  }
}

const callUpdaters = (key, value) => {
  if(key in storeUpdaters)
    for(const updater of storeUpdaters[key])
      updater(value)
}

/* React Stuff */

export const useStore = (key, init, assert) => {
  const storeSchema = useMemo(
    () => storeSchemas.find(schema => {
      if(typeof schema.key === 'string')
        return schema.key === key
      else // regexp
        return schema.key.test(key)
    }),
    [key]
  )

  const schema = useMemo(
    () => ({
      key,
      init: init === undefined ? storeSchema && storeSchema.init : init,
      assert: assert || (storeSchema && storeSchema.assert)
    }),
    [key, init, assert, storeSchema]
  )

  const value = useRef()

  useMemo(
    () => {
      try {
        const serialized = storeStorage.getItem(`${storeKeyPrefix}${schema.key}`)
        if(serialized === null)
          throw new Error()
        const stored = storeDeserialize(serialized)
        if(schema.assert && !schema.assert(stored))
          throw new Error()
        value.current = stored
      } catch(err) {
        storeStorage.setItem(`${storeKeyPrefix}${schema.key}`, storeSerialize(schema.init))
        value.current = schema.init
      }
    },
    [schema, value]
  )

  const updateTrigger = useState({})[1]

  useEffect(() => {
    const updater = newValue => {
      value.current = newValue
      updateTrigger({})
    }
    addUpdater(schema.key, updater)
    return () => {
      removeUpdater(schema.key, updater)
    }
  }, [schema, value, updateTrigger])

  const globalUpdater = useCallback(
    newValue => {
      if(typeof newValue === 'function')
        newValue = newValue(value.current)
      storeStorage.setItem(`${storeKeyPrefix}${schema.key}`, storeSerialize(newValue))
      callUpdaters(schema.key, newValue)
    },
    [schema, value]
  )

  return [value.current, globalUpdater]
}

export const readStore = key => {
  const serialized = storeStorage.getItem(`${storeKeyPrefix}${key}`)
  return storeDeserialize(serialized)
}
