<script>
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
    </div>
</template>

<style>
#app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
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
    background: linear-gradient(180deg, var(--nav-side-bg-color-gradient-start) 0%, var(--nav-side-bg-color-gradient-end) 100%);
    color: var(--nav-side-color);
    box-shadow: 4px 0 15px rgba(0, 0, 0, 0.1);
    transition: box-shadow 0.3s ease, transform 0.3s ease;
    z-index: 1000;
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
    background: 
        linear-gradient(180deg, rgba(249, 250, 251, 0.92) 0%, rgba(243, 244, 246, 0.92) 100%),
        url('https://images.unsplash.com/photo-1559757148-5c350d0d3c56?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    background-attachment: fixed;
    position: relative;
    padding: 24px;
}

.main-content::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.65) 0%, rgba(249, 250, 251, 0.65) 100%);
    pointer-events: none;
    z-index: 0;
}

.main-content > * {
    position: relative;
    z-index: 1;
}

</style>