import { createRouter, createWebHashHistory } from 'vue-router'
import Settings from './components/Settings.vue'
import SettingsLabels from './components/SettingsLabels.vue'
import SettingsPermissions from './components/SettingsPermissions.vue'
import Worklists from './components/Worklists.vue'
import AuditLogs from './components/AuditLogs.vue'
import StudyList from './components/StudyList.vue'
import SideBar from './components/SideBar.vue'
import NotFound from './components/NotFound.vue'
import Login from './components/Login.vue'
import Register from './components/Register.vue'
import VerifyEmail from './components/VerifyEmail.vue'
import { baseOe2Url } from "./globalConfigurations"

console.log('Base URL for router: ', baseOe2Url);

// Auth guard
const requireAuth = (to, from, next) => {
  const token = localStorage.getItem('auth-token');
  if (!token) {
    next('/login');
  } else {
    next();
  }
};

export const router = createRouter({
  history: createWebHashHistory(baseOe2Url),
  routes: [
    {
      path: '/login',
      component: Login,
      name: 'login'
    },
    {
      path: '/register',
      component: Register,
      name: 'register'
    },
    {
      path: '/verify-email/:token',
      component: VerifyEmail,
      name: 'verify-email'
    },
    {
      path: '/',
      alias: '/index.html',
      components: {
        SideBarView: SideBar,
        ContentView: StudyList,
      },
      name: 'home',
      beforeEnter: requireAuth
    },
    {
      path: '/filtered-studies',
      components: {
        SideBarView: SideBar,
        ContentView: StudyList,
      },
      name: 'local-studies-list',
      beforeEnter: requireAuth
    },
    {
      path: '/worklists',
      components: {
        SideBarView: SideBar,
        ContentView: Worklists,
      },
      name: 'worklists',
      beforeEnter: requireAuth
    },
    {
      path: '/settings',
      components: {
        SideBarView: SideBar,
        ContentView: Settings,
      },
      name: 'settings',
      beforeEnter: requireAuth
    },
    {
      path: '/settings-labels',
      components: {
        SideBarView: SideBar,
        ContentView: SettingsLabels,
      },
      name: 'settings-labels',
      beforeEnter: requireAuth
    },
    {
      path: '/settings-permissions',
      components: {
        SideBarView: SideBar,
        ContentView: SettingsPermissions,
      },
      name: 'settings-permissions',
      beforeEnter: requireAuth
    },
    {
      path: '/audit-logs',
      components: {
        SideBarView: SideBar,
        ContentView: AuditLogs,
      },
      name: 'audit-logs',
      beforeEnter: requireAuth
    },
    {
      path: '/:pathMatch(.*)',
      components: {
        SideBarView: SideBar,
        ContentView: NotFound,
      },
      name: 'keycloak-path-match',
      beforeEnter: requireAuth
    }

  ],
})
