import { useEffect, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { getStoreSettings } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function MainLayout() {
  const { profile } = useAuth();
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getStoreSettings().then((settings) => { if (mounted) setMaintenance(settings.maintenance_mode); }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="min-h-screen flex flex-col bg-ink-950">
      <Navbar />
      <main className="flex-1">
        {maintenance && !isAdmin ? (
          <div className="min-h-[70vh] flex items-center justify-center section-padding">
            <div className="text-center max-w-lg">
              <p className="text-xs uppercase tracking-[0.25em] text-gold-400 mb-4">Vast Nation</p>
              <h1 className="font-display text-4xl font-bold text-white mb-4">We’ll be back soon.</h1>
              <p className="text-ink-400 mb-8">Our store is temporarily unavailable while we make improvements. Please check back shortly.</p>
              <Link to="/" className="btn-gold inline-flex px-6 py-3 rounded-lg">Refresh Store</Link>
            </div>
          </div>
        ) : <Outlet />}
      </main>
      <Footer />
    </div>
  );
}
