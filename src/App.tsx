import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { router } from './router';
import { useAuthStore } from './stores/authStore';

function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--color-surface-900)',
            color: 'white',
          },
          success: {
            iconTheme: {
              primary: 'var(--color-brand-500)',
              secondary: 'white',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--color-accent-500)',
              secondary: 'white',
            },
          },
        }}
      />
    </>
  );
}

export default App;
