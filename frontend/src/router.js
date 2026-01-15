import { createRouter, createWebHistory } from 'vue-router'
import Settings from './components/Settings.vue'
import AccountSettings from './components/AccountSettings.vue'
import Worklists from './components/Worklists.vue'
import StudyList from './components/StudyList.vue'
import WordFileList from './components/WordFileList.vue'
import PatientList from './components/PatientList.vue'
import Dashboard from './components/Dashboard.vue'
import SideBar from './components/SideBar.vue'
import NotFound from './components/NotFound.vue'
import Login from './components/Login.vue'
import Register from './components/Register.vue'
import VerifyEmail from './components/VerifyEmail.vue'
import { baseOe2Url } from "./globalConfigurations"

console.log('Base URL for router: ', baseOe2Url);

// Auth guard - redirect to login if not authenticated
const requireAuth = (to, from, next) => {
  const token = localStorage.getItem('auth-token');
  if (!token) {
    next('/login');
  } else {
    next();
  }
};

// Guest guard - redirect to dashboard if already authenticated
const requireGuest = (to, from, next) => {
  const token = localStorage.getItem('auth-token');
  if (token) {
    next('/'); // Redirect to dashboard
  } else {
    next();
  }
};

export const router = createRouter({
  history: createWebHistory(baseOe2Url),
  routes: [
    {
      path: '/login',
      component: Login,
      name: 'login',
      beforeEnter: requireGuest
    },
    {
      path: '/register',
      component: Register,
      name: 'register',
      beforeEnter: requireGuest
    },
    {
      path: '/verify-email/:token',
      component: VerifyEmail,
      name: 'verify-email'
    },
    {
      path: '/',
      components: {
        SideBarView: SideBar,
        ContentView: Dashboard,
      },
      name: 'dashboard',
      beforeEnter: requireAuth
    },
    {
      path: '/index.html',
      redirect: '/'
    },
    {
      path: '/studies',
      components: {
        SideBarView: SideBar,
        ContentView: StudyList,
      },
      name: 'studies-list',
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
      path: '/word-files',
      components: {
        SideBarView: SideBar,
        ContentView: WordFileList,
      },
      name: 'word-files-list',
      beforeEnter: requireAuth
    },
    {
      path: '/patients',
      components: {
        SideBarView: SideBar,
        ContentView: PatientList,
      },
      name: 'patients-list',
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
      path: '/account-settings',
      components: {
        SideBarView: SideBar,
        ContentView: AccountSettings,
      },
      name: 'account-settings',
      beforeEnter: requireAuth
    },
    // Catch-all 404 route - must be last
    {
      path: '/:pathMatch(.*)*',
      components: {
        SideBarView: SideBar,
        ContentView: NotFound,
      },
      name: 'not-found',
      beforeEnter: requireAuth
    }
  ],
})

// Navigation guard to prevent unwanted URL changes
router.beforeEach((to, from, next) => {
  // Ensure the path doesn't get corrupted
  if (to.path && to.path.includes('undefined')) {
    next('/');
    return;
  }
  next();
});
