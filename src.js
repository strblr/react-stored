import { useRef, useState, useMemo, useCallback, useEffect } from 'react'

/* Configurables */

let storeStorage = window.localStorage
let storeKeyPrefix = ''
let storeCrossTab = false
let storeSerialize = JSON.stringify
let storeDeserialize = JSON.parse

const storeSchemas = []

export const config = ({ storage, keyPrefix, crossTab, serialize, deserialize, schemas }) => {
  storage && (storeStorage = storage)
  typeof keyPrefix === 'string' && (storeKeyPrefix = keyPrefix)
  typeof crossTab === 'boolean' && (storeCrossTab = crossTab)
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

window.addEventListener('storage', event => {
  if(
    storeCrossTab &&
    event.storageArea === storeStorage &&
    event.key && event.key.startsWith(storeKeyPrefix) &&
    event.oldValue !== null && event.newValue !== null
  )
    callUpdaters(event.key.substring(storeKeyPrefix.length), storeDeserialize(event.newValue))
})

/* React Stuff */

export const useStore = (key, init, assert) => {
  const value = useRef()

  const storeSchema = useMemo(
    () => storeSchemas.find(schema => {
      if(typeof schema.key === 'string')
        return schema.key === key
      else // regexp
        return schema.key.test(key)
    }),
    [key]
  )

  useMemo(
    () => {
      const finalInit = [init, storeSchema && storeSchema.init, null].find(init => init !== undefined)
      const finalAssert = assert || (storeSchema && storeSchema.assert)

      try {
        const serialized = storeStorage.getItem(`${storeKeyPrefix}${key}`)
        if(serialized === null)
          throw new Error()
        const stored = storeDeserialize(serialized)
        if(finalAssert && !finalAssert(stored))
          throw new Error()
        value.current = stored
      } catch(err) {
        storeStorage.setItem(`${storeKeyPrefix}${key}`, storeSerialize(finalInit))
        value.current = finalInit
      }
    },
    [key, init, assert, storeSchema]
  )

  const updateTrigger = useState({})[1]

  useEffect(() => {
    const updater = newValue => {
      value.current = newValue
      updateTrigger({})
    }
    addUpdater(key, updater)
    return () => {
      removeUpdater(key, updater)
    }
  }, [key, updateTrigger])

  const globalUpdater = useCallback(
    newValue => {
      if(typeof newValue === 'function')
        newValue = newValue(value.current)
      storeStorage.setItem(`${storeKeyPrefix}${key}`, storeSerialize(newValue))
      callUpdaters(key, newValue)
    },
    [key]
  )

  return [value.current, globalUpdater]
}

export const readStore = key => {
  const serialized = storeStorage.getItem(`${storeKeyPrefix}${key}`)
  return storeDeserialize(serialized)
}
