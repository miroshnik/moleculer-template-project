export default function ({ $axios, redirect }) {
  $axios.onRequest((config) => {
    config.headers.common['x-access-token'] = process.env.NUXT_ENV_ADMIN_API_KEY || 'adminDev'
    config.https = true
    config.withCredentials = true
  })
}
