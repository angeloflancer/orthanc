<script>
import Toasts from './components/Toasts.vue'

function applyBootStrapTheme() {
    // hack to switch the theme: get the value from our custom css
    let bootstrapTheme = getComputedStyle(document.documentElement).getPropertyValue('--bootstrap-theme');
    console.log("-------------- Applying Bootstrap theme ...", bootstrapTheme);
    if (bootstrapTheme) {
        // and set it to the 'html' element
        document.documentElement.setAttribute('data-bs-theme', bootstrapTheme);
    } else {
        console.warn("-------------- Applying Bootstrap theme not defined yet, retrying ...");
        setTimeout(applyBootStrapTheme, 100);
    }
}

export default {
    components: {
        Toasts
    },
    computed: {
        showSidebar() {
            // Hide sidebar on login and register pages
            return this.$route.name !== 'login' && this.$route.name !== 'register';
        }
    },
    async created() {
        console.log("Creating App...");

        {// Load the CSS dynamically since it can be a custom css
            console.log("Loading the defaults + custom CSS ...");

            let link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = 'customizable/custom.css';
    
            document.getElementsByTagName('HEAD')[0].appendChild(link);

            setTimeout(applyBootStrapTheme, 0);
        }
        // {
        //     console.log("Loading the custom CSS ...");

        //     let link = document.createElement('link');
        //     link.rel = 'stylesheet';
        //     link.type = 'text/css';
        //     link.href = 'customizable/custom.css';
    
        //     document.getElementsByTagName('HEAD')[0].appendChild(link);
        // }

        await this.$store.dispatch('configuration/load');
        await this.$store.dispatch('studies/initialLoad');
        await this.$store.dispatch('labels/refresh');
        console.log("App created");
    },

}
</script>

<template>
    <div class="full-page">
        <div v-if="showSidebar" class="nav-side-layout">
            <router-view name="SideBarView"></router-view>
        </div>
        <div :class="{ 'content': showSidebar, 'content-full': !showSidebar }" class="main-content">
            <router-view></router-view>
            <router-view name="ContentView"></router-view>
        </div>
        <Toasts />
    </div>
</template>

<style>
#app {
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
}

.nav-side-layout {
    overflow: auto;
    position: fixed;
    top: 0px;
    width: var(--nav-bar-width);
    height: 100%;
    background: var(--sidebar-bg, var(--nav-side-bg-color));
    color: var(--sidebar-foreground, var(--nav-side-color));
    box-shadow: 4px 0 15px rgba(0, 0, 0, 0.1);
    transition: box-shadow 0.3s ease, transform 0.3s ease;
    z-index: 1000;
    /* Hide scrollbar in all cases – never show */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
}
.nav-side-layout::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
}

.nav-side-layout .toggle-btn {
    display: none;
}

.content-full {
    margin-left: 0;
    width: 100%;
}

.content, .content-full {
    position: relative;
}

.main-content {
    min-height: 100vh;
    background: var(--content-background);
    color: var(--content-foreground);
    position: relative;
    padding: 24px;
}

</style>