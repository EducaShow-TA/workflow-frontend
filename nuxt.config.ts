export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      apiBase: '',
    },
  },
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-07-15',

  devtools: {
    enabled: true,
  },

  // Frontend como Single Page Application
  ssr: false,

  // Validacion estricta de TypeScript
  typescript: {
    strict: true,
  },

  // Modulos del proyecto
  modules: ['@pinia/nuxt', '@nuxt/eslint'],
})
