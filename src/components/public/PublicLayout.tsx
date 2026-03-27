import { Outlet } from 'react-router-dom';
import { PublicNav } from './PublicNav';
import { PublicFooter } from './PublicFooter';

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-white text-surface-900">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
