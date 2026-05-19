import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Replace "rmc-plant-scheduler" below with your actual GitHub repo name
// e.g. if your repo URL is github.com/yourname/my-plant-app  →  base: "/my-plant-app/"
export default defineConfig({
  plugins: [react()],
  base: '/CSI-Plant-Scheduler/',
})
