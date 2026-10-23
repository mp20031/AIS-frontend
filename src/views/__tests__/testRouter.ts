import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { defineComponent, h } from 'vue'

const Page = (name: string) => defineComponent({ name, render: () => h('div', name) })

/**
 * The app's route names on blank pages, without the real guards: a component
 * test checks where the component *sends* you, not what the guards do (that
 * is router/__tests__).
 */
export async function testRouter(initial = '/'): Promise<Router> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Page('Home') },
      { path: '/login', name: 'login', component: Page('Login') },
      { path: '/dashboard', name: 'dashboard', component: Page('Dashboard') },
      { path: '/launch/:moduleKey', name: 'launch', component: Page('Launch') },
      { path: '/seguridad', name: 'seguridad', component: Page('Seguridad') },
    ],
  })
  await router.push(initial)
  await router.isReady()
  return router
}
