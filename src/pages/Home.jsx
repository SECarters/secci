import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

export default function HomePage() {
  useEffect(() => {
    const redirect = async () => {
      try {
        const user = await base44.auth.me();
        
        // Platform admins go to admin dashboard
        if (user.role === 'admin') {
          window.location.href = createPageUrl('Dashboard');
          return;
        }
        
        // Route based on appRole
        if (user.appRole === 'dispatcher') {
          window.location.href = createPageUrl('Dashboard');
        } else if (user.appRole === 'driver') {
          window.location.href = createPageUrl('Dashboard');
        } else if (user.appRole === 'manager') {
          window.location.href = createPageUrl('Dashboard');
        } else {
          // Default to customer view (AdminJobs shows their jobs)
          window.location.href = createPageUrl('AdminJobs');
        }
      } catch (error) {
        console.error('Error redirecting user:', error);
        // If can't get user, redirect to daily job board as fallback
        window.location.href = createPageUrl('DailyJobBoard');
      }
    };
    
    redirect();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}