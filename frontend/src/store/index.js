import { createStore, createLogger } from 'vuex'
import configuration from './modules/configuration'
import studies from './modules/studies'
import jobs from './modules/jobs'
import labels from './modules/labels'

const debug = process.env.NODE_ENV !== 'production'

// Plugin to connect Vuex to Redux DevTools extension
const reduxDevToolsPlugin = (store) => {
  if (typeof window === 'undefined' || !window.__REDUX_DEVTOOLS_EXTENSION__) {
    console.warn('Redux DevTools extension not found')
    return
  }

  try {
    const devTools = window.__REDUX_DEVTOOLS_EXTENSION__.connect({
      name: 'Vuex Store',
      trace: true,
      traceLimit: 25
    })

    // Send initial state
    devTools.init(store.state)

    // Subscribe to store mutations
    store.subscribe((mutation, state) => {
      devTools.send(
        {
          type: mutation.type || 'VUEX_MUTATION',
          payload: mutation.payload,
          mutation: mutation
        },
        state
      )
    })

    // Subscribe to Redux DevTools actions (for time-travel debugging)
    devTools.subscribe((message) => {
      if (message.type === 'DISPATCH' && message.payload) {
        const { type, state } = message.payload
        if (type === 'JUMP_TO_STATE' || type === 'JUMP_TO_ACTION') {
          // Handle time-travel if needed
          console.log('Redux DevTools time-travel:', type, state)
        }
      }
    })

    console.log('Vuex store connected to Redux DevTools')
  } catch (error) {
    console.error('Error connecting to Redux DevTools:', error)
  }
}

const store = createStore({
  modules: {
    studies,
    configuration,
    jobs,
    labels
  },
  strict: debug,
  plugins: debug 
    ? [createLogger(), reduxDevToolsPlugin] 
    : [reduxDevToolsPlugin], // Always include Redux DevTools plugin
  devtools: true // Enable Vuex DevTools
})

// Expose store globally for debugging
if (typeof window !== 'undefined') {
  window.__VUEX_STORE__ = store
  // Also expose for Vue DevTools if needed
  if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
    window.__VUE_DEVTOOLS_GLOBAL_HOOK__.store = store
  }
}

export default store