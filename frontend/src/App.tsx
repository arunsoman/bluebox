import { Routes, Route } from 'react-router'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Studio from '@/pages/Studio'
import Explorer from '@/pages/Explorer'
import Visualizer from '@/pages/Visualizer'
import Chat from '@/pages/Chat'
import Blueprint from '@/pages/Blueprint'
import Audit from '@/pages/Audit'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="studio" element={<Studio />} />
        <Route path="explorer" element={<Explorer />} />
        <Route path="impact" element={<Visualizer />} />
        <Route path="chat" element={<Chat />} />
        <Route path="blueprint" element={<Blueprint />} />
        <Route path="audit" element={<Audit />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
