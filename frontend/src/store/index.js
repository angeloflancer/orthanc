import { createStore, createLogger } from 'vuex'
import configuration from './modules/configuration'
import studies from './modules/studies'
import jobs from './modules/jobs'
import labels from './modules/labels'

const debug = process.env.NODE_ENV !== 'production'

const store = createStore({
  modules: {
    studies,
    configuration,
    jobs,
    labels
  },
  strict: debug,
  plugins: debug 
    ? [createLogger()] 
    : [],
  devtools: true // Enable Vuex DevTools (Vue DevTools only, not Redux)
})

export default store
