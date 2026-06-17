import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import Footer from './Footer';

export default function Layout() {
  const location = useLocation();

  return (
    <div className="app-root flex min-h-[100dvh]">
      {/* Noise texture overlay is in index.css */}

      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Top bar */}
        <TopBar />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{
                duration: 0.3,
                ease: [0, 0, 0.2, 1] as [number, number, number, number],
              }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
