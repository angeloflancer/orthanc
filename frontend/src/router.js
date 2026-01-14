import { createRouter, createWebHashHistory } from 'vue-router'
import Settings from './components/Settings.vue'
import AccountSettings from './components/AccountSettings.vue'
import Worklists from './components/Worklists.vue'
import StudyList from './components/StudyList.vue'
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
    // Preserve URL parameters when redirecting authenticated users
    const urlParams = new URLSearchParams(window.location.search);
    const params = {};
    
    // Preserve common query parameters that might be used for study filtering
    const validParams = ['StudyInstanceUID', 'PatientID', 'AccessionNumber', 'StudyDate', 
                        'PatientName', 'StudyDescription', 'ModalitiesInStudy', 'labels', 
                        'source-type', 'remote-source', 'order-by', 'labels-constraint'];
    
    for (const key of validParams) {
      if (urlParams.has(key)) {
        params[key] = urlParams.get(key);
      }
    }
    
    // Redirect to dashboard/home with preserved parameters if any
    if (Object.keys(params).length > 0) {
      next({ path: '/', query: params });
    } else {
      next('/'); // Redirect to dashboard/home
    }
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
      path: '/account-settings',
      components: {
        SideBarView: SideBar,
        ContentView: AccountSettings,
      },
      name: 'account-settings',
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
