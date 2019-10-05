# react-stored
The power and simplicity of `useState`, but with persistence across browser sessions, global sync'd access without context, speed and memory optimisation, anti-ill form checks, and other cool stuff.

Ever dreamed of such of feature but couldn't come up with a 100% clean and satisfying solution ? Well, this package is for you.

#### It is designed to :

1. provide you with a **reliable key-based** `useState`-like feature called `useStore`,
2. with tree-wide **auto-sync** with similar `useStore` calls,
3. **without** context,
4. with **persistence** accross page reloads, tabs, sessions,
5. with **configurable safety asserts** on deserialization and **default fallbacks**,
6. with **no unnecessary** rerender, ever,
7. with **simplicity** and **cool configuration** options.

## Quick demo

Say you have the two following components far away from one another in the tree :
```javascript
import React from 'react'
import { useStore } from 'react-stored'

function FirstComponent() {
  const [counter, setCounter] = useStore('counter', 0)
  return <>
    <h1>Counter : {counter}</h1>
    <button onClick={() => setCounter(counter + 1)}>
      Increment
     </button>
  </>
}
```

```javascript
import React from 'react'
import { useStore } from 'react-stored'

function SecondComponent() {
  const [counter, setCounter] = useStore('counter', 0)
  return <>
    <h1>Counter : {counter}</h1>
    <button onClick={() => setCounter(0)}>
      Reset
     </button>
  </>
}
```

Since they share the same key (`'counter'`), they actually seemlessly share the _same value_ and keep one another in sync _no matter_ how hard you try to unsync them. **Even better** : if you refresh the page, nothing changes. The values are persistent. You better like them, because they ain't going anywhere unless you change the key or... the key _prefix_ (see config section below).

The second argument to `useStore`, the number `0` in this case, represents the default counter value, as no persistent save cound be found the first time around.

## Reference

#### The `config` function

With this function, you can configure your stores globally. It has to be called **outside** of the React structure, before any `useStore` call, so usually somewhere in your `index.js` before your `ReactDOM.render`.

```javascript
import React from 'react'
import ReactDOM from 'react-dom'
import { config } from 'react-stored'
import App from './App'

// Below are the DEFAULT settings, it is pointless to set them explicitly to these values :

config({
  // The persistent storage to be used (could be replaced with sessionStorage) :
  storage: window.localStorage,
  
  // IMPORTANT : A seemless prefix to ALL your keys, this has to be specific to your app :
  keyPrefix: '',
  
  // A function that should transform JSON into a string :
  serialize: JSON.stringify,
  
  // A function that should transform a string into JSON :
  deserialize: JSON.parse
})

ReactDOM.render(<App/>, document.getElementById('root'))
```
