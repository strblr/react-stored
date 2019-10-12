import { useRef, useState, useMemo, useCallback, useEffect } from 'react'

/* Configurables */

const storeConfig = {
  keyPrefix: '',
  storage: window.localStorage,
  crossTab: false,
  serialize: JSON.stringify,
  deserialize: JSON.parse,
  schemas: []
}

export const config = options => {
  if('crossTab' in options && options.crossTab !== storeConfig.crossTab)
    window[options.crossTab ? 'addEventListener' : 'removeEventListener']('storage', callUpdatersFromEvent)
  Object.assign(storeConfig, options)
}

export const addSchema = (key, init, assert) => {
  storeConfig.schemas.push({ key, init, assert })
}

/* Update Events */

const storeUpdaters = {}

const addUpdater = (key, updater) => {
  if(key in storeUpdaters)
    storeUpdaters[key].push(updater)
  else storeUpdaters[key] = [updater]
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

const callUpdatersFromEvent = event => {
  event.storageArea === storeConfig.storage
  && event.key && event.key.startsWith(storeConfig.keyPrefix)
  && event.oldValue !== null && event.newValue !== null
  && callUpdaters(
    event.key.substring(storeConfig.keyPrefix.length),
    storeConfig.deserialize(event.newValue)
  )
}

/* React Stuff */

export const useStore = (key, init, assert) => {
  const value = useRef()

  const schema = useMemo(
    () => storeConfig.schemas.find(schema => {
      if(typeof schema.key === 'string')
        return schema.key === key
      else // regexp
        return schema.key.test(key)
    }),
    [key]
  )

  useMemo(
    () => {
      const finalInit = [init, schema && schema.init, null].find(init => init !== undefined)
      const finalAssert = assert || (schema && schema.assert)

      try {
        const serialized = storeConfig.storage.getItem(`${storeConfig.keyPrefix}${key}`)
        if(serialized === null)
          throw new Error()
        const stored = storeConfig.deserialize(serialized)
        if(finalAssert && !finalAssert(stored))
          throw new Error()
        value.current = stored
      } catch(err) {
        storeConfig.storage.setItem(`${storeConfig.keyPrefix}${key}`, storeConfig.serialize(finalInit))
        value.current = finalInit
      }
    },
    [key, init, assert, schema]
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
      if(newValue !== value.current) {
        storeConfig.storage.setItem(`${storeConfig.keyPrefix}${key}`, storeConfig.serialize(newValue))
        callUpdaters(key, newValue)
      }
    },
    [key]
  )

  return [value.current, globalUpdater]
}

export const readStore = key => {
  const serialized = storeConfig.storage.getItem(`${storeConfig.keyPrefix}${key}`)
  return storeConfig.deserialize(serialized)
}
