import { createRouter, createWebHistory } from 'vue-router'
import Settings from './components/Settings.vue'
import AccountSettings from './components/AccountSettings.vue'
import HospitalSettings from './components/HospitalSettings.vue'
import MemberManagement from './components/MemberManagement.vue'
import UserManagement from './components/UserManagement.vue'
import HospitalManagement from './components/HospitalManagement.vue'
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
import { baseOe2Url, orthancApiUrl } from "./globalConfigurations"

console.log('Base URL for router: ', baseOe2Url);

// Helper function to get user role from API
const getUserRole = async () => {
  const token = localStorage.getItem('auth-token');
  if (!token) return null;
  
  try {
    const response = await fetch(`${orthancApiUrl}api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.user?.role || 'doctor';
    }
  } catch (error) {
    console.error('Error getting user role:', error);
  }
  return null;
};

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

// Admin guard - require admin or owner role
const requireAdmin = async (to, from, next) => {
  const token = localStorage.getItem('auth-token');
  if (!token) {
    next('/login');
    return;
  }
  
  const role = await getUserRole();
  if (role === 'admin' || role === 'owner') {
    next();
  } else {
    next('/'); // Redirect to dashboard if not admin
  }
};

// Owner guard - require owner role
const requireOwner = async (to, from, next) => {
  const token = localStorage.getItem('auth-token');
  if (!token) {
    next('/login');
    return;
  }
  
  const role = await getUserRole();
  if (role === 'owner') {
    next();
  } else {
    next('/'); // Redirect to dashboard if not owner
  }
};

// Check if user has access to features (membership for doctors, subscription for admins)
const checkFeatureAccess = async (to, from, next) => {
  const token = localStorage.getItem('auth-token');
  if (!token) {
    next('/login');
    return;
  }
  
  try {
    const axios = (await import('axios')).default;
    
    const response = await axios.get(`${orthancApiUrl}api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data.success && response.data.user) {
      const user = response.data.user;
      
      // Owner always has access
      if (user.role === 'owner') {
        next();
        return;
      }
      
      // Admin needs active subscription
      if (user.role === 'admin') {
        if (user.subscription && user.subscription.isActive) {
          next();
        } else {
          // Show notification and redirect
          if (window.messageBus) {
            window.messageBus.emit('show-error-toast', 
              user.subscription 
                ? 'Contact the owner to extend the subscription.'
                : 'Contact the owner to set up your hospital subscription.'
            );
          }
          next('/');
        }
        return;
      }
      
      // Doctor needs accepted membership and active subscription
      if (user.role === 'doctor') {
        const hasMembership = user.hospitalMembership && user.hospitalMembership.status === 'accepted';
        const hasActiveSubscription = user.doctorSubscription && user.doctorSubscription.isActive;
        
        if (hasMembership && hasActiveSubscription) {
          next();
        } else {
          // Show notification and redirect
          if (window.messageBus) {
            let message = 'You can\'t use this before join the hospital.';
            if (hasMembership && !hasActiveSubscription) {
              message = 'Hospital is currently suspended, wait for the administrator to renew.';
            }
            window.messageBus.emit('show-error-toast', message);
          }
          next('/');
        }
        return;
      }
    }
    
    next('/');
  } catch (error) {
    console.error('Error checking feature access:', error);
    next('/');
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
      beforeEnter: [requireAuth, checkFeatureAccess]
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
      beforeEnter: [requireAuth, checkFeatureAccess]
    },
    {
      path: '/patients',
      components: {
        SideBarView: SideBar,
        ContentView: PatientList,
      },
      name: 'patients-list',
      beforeEnter: [requireAuth, checkFeatureAccess]
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
      beforeEnter: requireOwner
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
      path: '/hospital-settings',
      components: {
        SideBarView: SideBar,
        ContentView: HospitalSettings,
      },
      name: 'hospital-settings',
      beforeEnter: requireAdmin
    },
    {
      path: '/members',
      components: {
        SideBarView: SideBar,
        ContentView: MemberManagement,
      },
      name: 'members',
      beforeEnter: requireAdmin
    },
    {
      path: '/users',
      components: {
        SideBarView: SideBar,
        ContentView: UserManagement,
      },
      name: 'users',
      beforeEnter: requireOwner
    },
    {
      path: '/hospitals',
      components: {
        SideBarView: SideBar,
        ContentView: HospitalManagement,
      },
      name: 'hospitals',
      beforeEnter: requireOwner
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
