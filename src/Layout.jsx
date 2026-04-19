import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Toaster } from '@/components/ui/toaster';
import {
  LogOut,
  Menu,
  Truck,
  Users,
  Briefcase,
  Settings,
  LayoutGrid,
  Calendar,
  User as UserIcon,
  Plus,
  CloudRain,
  Library,
  ChevronRight,
  ChevronLeft,
  PanelLeftClose,
  PanelLeft,
  Home,
  BarChart3
} from 'lucide-react';

import ReturnedJobAlert from './components/scheduling/ReturnedJobAlert';
import NotificationBell from './components/NotificationBell';

const NavLink = ({ to, icon: Icon, children, collapsed, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center ${collapsed ? 'justify-center px-2' : 'px-4'} py-2.5 text-sm font-medium rounded-lg transition-colors ${
        isActive ?
          'bg-blue-600 text-white' :
          'text-gray-600 hover:bg-gray-100'}`
      }
      title={collapsed ? children : ''}
    >
      <Icon className={`h-5 w-5 ${collapsed ? '' : 'mr-3'}`} />
      {!collapsed && children}
    </Link>
  );
};

const SubNavLink = ({ to, children, collapsed, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${collapsed ? '' : 'ml-8'} ${
        isActive ?
          'bg-blue-600 text-white' :
          'text-gray-600 hover:bg-gray-100'}`
      }
      title={collapsed ? children : ''}
    >
      {children}
    </Link>
  );
};

const AdminNav = ({ collapsed, onNavigate }) => {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const location = useLocation();
  
  const libraryPages = [
    createPageUrl('AdminJobs'),
    createPageUrl('AdminCustomers'),
    createPageUrl('AdminUsers'),
    createPageUrl('AdminPickupLocations'),
    createPageUrl('AdminDeliveryTypes'),
  ];
  
  const isLibraryActive = libraryPages.includes(location.pathname);

  useEffect(() => {
    if (isLibraryActive && !libraryOpen && !collapsed) {
      setLibraryOpen(true);
    }
  }, [isLibraryActive, libraryOpen, collapsed]);

  useEffect(() => {
    if (collapsed) {
      setLibraryOpen(false);
    }
  }, [collapsed]);
  
  return (
    <>
      <NavLink to={createPageUrl('Dashboard')} icon={Home} collapsed={collapsed} onClick={onNavigate}>Dashboard</NavLink>
      <NavLink to={createPageUrl('SchedulingBoard')} icon={LayoutGrid} collapsed={collapsed} onClick={onNavigate}>Scheduling</NavLink>
      <NavLink to={createPageUrl('DailyJobBoard')} icon={Calendar} collapsed={collapsed} onClick={onNavigate}>Daily Job Board</NavLink>
      <NavLink to={createPageUrl('Reports')} icon={BarChart3} collapsed={collapsed} onClick={onNavigate}>Reports</NavLink>
      
      {!collapsed ? (
        <Collapsible open={libraryOpen} onOpenChange={setLibraryOpen}>
          <CollapsibleTrigger asChild>
            <button
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                isLibraryActive ?
                  'bg-blue-600 text-white' :
                  'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center">
                <Library className="h-5 w-5 mr-3" />
                Company Library
              </div>
              <ChevronRight className={`h-4 w-4 transition-transform ${libraryOpen ? 'rotate-90' : ''}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-1">
            <SubNavLink to={createPageUrl('AdminJobs')} onClick={onNavigate}>All Jobs</SubNavLink>
            <SubNavLink to={createPageUrl('AdminCustomers')} onClick={onNavigate}>Customers</SubNavLink>
            <SubNavLink to={createPageUrl('AdminUsers')} onClick={onNavigate}>System Users</SubNavLink>
            <SubNavLink to={createPageUrl('AdminPickupLocations')} onClick={onNavigate}>Pickup Locations</SubNavLink>
            <SubNavLink to={createPageUrl('AdminDeliveryTypes')} onClick={onNavigate}>Delivery Types</SubNavLink>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <NavLink to={createPageUrl('AdminJobs')} icon={Library} collapsed={collapsed} onClick={onNavigate}>Library</NavLink>
      )}
      
      <NavLink to={createPageUrl('WeatherToday')} icon={CloudRain} collapsed={collapsed} onClick={onNavigate}>Weather Today</NavLink>
    </>
  );
};

const DispatcherNav = ({ collapsed, onNavigate }) => {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const location = useLocation();
  
  const libraryPages = [
    createPageUrl('AdminJobs'),
    createPageUrl('AdminCustomers'),
    createPageUrl('AdminPickupLocations'),
    createPageUrl('AdminDeliveryTypes')
  ];
  
  const isLibraryActive = libraryPages.includes(location.pathname);

  useEffect(() => {
    if (isLibraryActive && !libraryOpen && !collapsed) {
      setLibraryOpen(true);
    }
  }, [isLibraryActive, libraryOpen, collapsed]);

  useEffect(() => {
    if (collapsed) {
      setLibraryOpen(false);
    }
  }, [collapsed]);
  
  return (
    <>
      <NavLink to={createPageUrl('Dashboard')} icon={Home} collapsed={collapsed} onClick={onNavigate}>Dashboard</NavLink>
      <NavLink to={createPageUrl('SchedulingBoard')} icon={LayoutGrid} collapsed={collapsed} onClick={onNavigate}>Scheduling</NavLink>
      <NavLink to={createPageUrl('DailyJobBoard')} icon={Calendar} collapsed={collapsed} onClick={onNavigate}>Daily Job Board</NavLink>
      <NavLink to={createPageUrl('Reports')} icon={BarChart3} collapsed={collapsed} onClick={onNavigate}>Reports</NavLink>
      
      {!collapsed ? (
        <Collapsible open={libraryOpen} onOpenChange={setLibraryOpen}>
          <CollapsibleTrigger asChild>
            <button
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                isLibraryActive ?
                  'bg-blue-600 text-white' :
                  'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center">
                <Library className="h-5 w-5 mr-3" />
                Company Library
              </div>
              <ChevronRight className={`h-4 w-4 transition-transform ${libraryOpen ? 'rotate-90' : ''}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-1">
            <SubNavLink to={createPageUrl('AdminJobs')} onClick={onNavigate}>All Jobs</SubNavLink>
            <SubNavLink to={createPageUrl('AdminCustomers')} onClick={onNavigate}>Customers</SubNavLink>
            <SubNavLink to={createPageUrl('AdminPickupLocations')} onClick={onNavigate}>Pickup Locations</SubNavLink>
            <SubNavLink to={createPageUrl('AdminDeliveryTypes')} onClick={onNavigate}>Delivery Types</SubNavLink>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <NavLink to={createPageUrl('AdminJobs')} icon={Library} collapsed={collapsed} onClick={onNavigate}>Library</NavLink>
      )}
      
      <NavLink to={createPageUrl('WeatherToday')} icon={CloudRain} collapsed={collapsed} onClick={onNavigate}>Weather Today</NavLink>
    </>
  );
};

const DriverNav = ({ collapsed, onNavigate }) =>
  <>
    <NavLink to={createPageUrl('Dashboard')} icon={Home} collapsed={collapsed} onClick={onNavigate}>Dashboard</NavLink>
    <NavLink to={createPageUrl('DriverMyRuns')} icon={Calendar} collapsed={collapsed} onClick={onNavigate}>My Runs</NavLink>
    <NavLink to={createPageUrl('DailyJobBoard')} icon={LayoutGrid} collapsed={collapsed} onClick={onNavigate}>Daily Job Board</NavLink>
    <NavLink to={createPageUrl('WeatherToday')} icon={CloudRain} collapsed={collapsed} onClick={onNavigate}>Weather Today</NavLink>
  </>;

const OutreachNav = ({ collapsed, onNavigate }) =>
  <>
    <NavLink to={createPageUrl('Dashboard')} icon={Home} collapsed={collapsed} onClick={onNavigate}>Dashboard</NavLink>
    <NavLink to={createPageUrl('DailyJobBoard')} icon={Calendar} collapsed={collapsed} onClick={onNavigate}>Daily Job Board</NavLink>
    <NavLink to={createPageUrl('WeatherToday')} icon={CloudRain} collapsed={collapsed} onClick={onNavigate}>Weather Today</NavLink>
  </>;

const CustomerNav = ({ collapsed, onNavigate }) =>
  <>
    <NavLink to={createPageUrl('AdminJobs')} icon={Briefcase} collapsed={collapsed} onClick={onNavigate}>My Jobs</NavLink>
    <NavLink to={createPageUrl('DailyJobBoard')} icon={Calendar} collapsed={collapsed} onClick={onNavigate}>Scheduler</NavLink>
    <NavLink to={createPageUrl('CustomerRequestDelivery')} icon={Plus} collapsed={collapsed} onClick={onNavigate}>Request Delivery</NavLink>
    <NavLink to={createPageUrl('WeatherToday')} icon={CloudRain} collapsed={collapsed} onClick={onNavigate}>Weather Today</NavLink>
  </>;

const ManagerNav = ({ collapsed, onNavigate }) => {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const location = useLocation();
  
  const libraryPages = [
    createPageUrl('AdminJobs'),
    createPageUrl('AdminCustomers')
  ];
  
  const isLibraryActive = libraryPages.includes(location.pathname);

  useEffect(() => {
    if (isLibraryActive && !libraryOpen && !collapsed) {
      setLibraryOpen(true);
    }
  }, [isLibraryActive, libraryOpen, collapsed]);

  useEffect(() => {
    if (collapsed) {
      setLibraryOpen(false);
    }
  }, [collapsed]);
  
  return (
    <>
      <NavLink to={createPageUrl('Dashboard')} icon={Home} collapsed={collapsed} onClick={onNavigate}>Dashboard</NavLink>
      <NavLink to={createPageUrl('DailyJobBoard')} icon={Calendar} collapsed={collapsed} onClick={onNavigate}>Daily Job Board</NavLink>
      <NavLink to={createPageUrl('Reports')} icon={BarChart3} collapsed={collapsed} onClick={onNavigate}>Reports</NavLink>
      
      {!collapsed ? (
        <Collapsible open={libraryOpen} onOpenChange={setLibraryOpen}>
          <CollapsibleTrigger asChild>
            <button
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                isLibraryActive ?
                  'bg-blue-600 text-white' :
                  'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center">
                <Library className="h-5 w-5 mr-3" />
                Company Library
              </div>
              <ChevronRight className={`h-4 w-4 transition-transform ${libraryOpen ? 'rotate-90' : ''}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-1">
            <SubNavLink to={createPageUrl('AdminJobs')} onClick={onNavigate}>All Jobs</SubNavLink>
            <SubNavLink to={createPageUrl('AdminCustomers')} onClick={onNavigate}>Customers</SubNavLink>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <NavLink to={createPageUrl('AdminJobs')} icon={Library} collapsed={collapsed} onClick={onNavigate}>Library</NavLink>
      )}
      
      <NavLink to={createPageUrl('WeatherToday')} icon={CloudRain} collapsed={collapsed} onClick={onNavigate}>Weather Today</NavLink>
    </>
  );
};

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [returnedJobs, setReturnedJobs] = useState([]);
  const [showReturnedAlert, setShowReturnedAlert] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      try {
        const currentUser = await base44.auth.me();
        
        if (!mounted) return;
        
        setUser(currentUser);

        // Check for returned jobs that need alerts (for admin, dispatcher, manager, customer)
        const shouldCheckReturned = currentUser.role === 'admin' || 
          currentUser.appRole === 'dispatcher' || 
          currentUser.appRole === 'manager' ||
          currentUser.appRole === 'customer';
        
        if (shouldCheckReturned) {
          try {
            const allJobs = await base44.entities.Job.filter({ status: 'RETURNED' });
            
            // Filter jobs that this user should see alerts for
            const jobsForUser = allJobs.filter(job => {
              // Skip if user already dismissed this alert
              const dismissedBy = job.returnAlertDismissedBy || [];
              if (dismissedBy.includes(currentUser.id)) return false;
              
              // Skip if user chose "remind later" in the same session
              // (returnAlertRemindLater is cleared on new login, so this works)
              const remindLater = job.returnAlertRemindLater || [];
              // For remind later, we show it again (it's stored to track per-session dismissal)
              // But we want to show it on next login, so we actually DON'T filter these out
              
              // Check if user should see this job
              if (currentUser.role === 'admin' || currentUser.appRole === 'dispatcher') {
                return true; // Admin and dispatchers see all
              }
              if (currentUser.appRole === 'manager' || currentUser.appRole === 'customer') {
                // Customers and managers only see their own jobs
                return job.customerId === currentUser.customerId;
              }
              return false;
            });
            
            if (jobsForUser.length > 0) {
              setReturnedJobs(jobsForUser);
              setShowReturnedAlert(true);
            }
          } catch (e) {
            console.error('Failed to check returned jobs:', e);
          }
        }

        const needsCustomerId = currentUser.appRole === 'customer' || currentUser.appRole === 'manager' || !currentUser.appRole;
        const isPending = currentUser && currentUser.role !== 'admin' && needsCustomerId && !currentUser.customerId;

        if (isPending && currentPageName !== 'AccessPending') {
          window.location.href = createPageUrl('AccessPending');
          return;
        }

        // Explicit driver redirect - drivers ALWAYS go to Dashboard on login
        if (currentUser.appRole === 'driver') {
          const isRootPath = location.pathname === '/' || location.pathname === '/app';
          const isLoginCallback = location.search.includes('code=') || location.search.includes('state=');
          
          if ((isRootPath || isLoginCallback) && currentPageName !== 'Dashboard') {
            window.location.href = createPageUrl('Dashboard');
            return;
          }
        }

        const isRootPath = location.pathname === '/' || location.pathname === '/app';
        const isLoginCallback = location.search.includes('code=') || location.search.includes('state=');
        
        if ((isRootPath || isLoginCallback) && !isPending && currentPageName !== 'Dashboard' && currentPageName !== 'AdminJobs' && currentPageName !== 'DailyJobBoard') {
          let dashboardUrl;
          
          if (currentUser.role === 'admin') {
            dashboardUrl = createPageUrl('Dashboard');
          } else if (currentUser.appRole === 'dispatcher') {
            dashboardUrl = createPageUrl('Dashboard');
          } else if (currentUser.appRole === 'driver') {
            dashboardUrl = createPageUrl('Dashboard');
          } else if (currentUser.appRole === 'manager') {
            dashboardUrl = createPageUrl('Dashboard');
          } else if (currentUser.appRole === 'customer') {
            dashboardUrl = createPageUrl('AdminJobs');
          } else if (currentUser.appRole === 'outreach' || currentUser.appRole === 'outreachOperator') {
            dashboardUrl = createPageUrl('DailyJobBoard');
          } else {
            dashboardUrl = createPageUrl('DailyJobBoard');
          }
          
          window.location.href = dashboardUrl;
          return;
        }
      } catch (e) {
        console.error('Authentication error:', e);
        if (!mounted) return;
        
        setError(e);
        if (!window.location.search.includes('code=') && !window.location.search.includes('state=')) {
          const nextUrl = window.location.href;
          base44.auth.redirectToLogin(nextUrl);
        }
        return;
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    init();
    
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  const handleMobileNavigate = () => {
    setMobileMenuOpen(false);
  };

  const renderNavLinks = (onNavigate) => {
    if (!user) return null;
    const needsCustomerId = user.appRole === 'customer' || user.appRole === 'manager' || !user.appRole;
    const isPending = !!(user && user.role !== 'admin' && needsCustomerId && !user.customerId);

    if (isPending) return null;

    if (user.role === 'admin') {
      return <AdminNav collapsed={sidebarCollapsed} onNavigate={onNavigate} />;
    }

    const appRole = user.appRole;



    switch (appRole) {
      case 'dispatcher':
        return <DispatcherNav collapsed={sidebarCollapsed} onNavigate={onNavigate} />;
      case 'driver':
        return <DriverNav collapsed={sidebarCollapsed} onNavigate={onNavigate} />;
      case 'manager':
        return <ManagerNav collapsed={sidebarCollapsed} onNavigate={onNavigate} />;
      case 'outreach':
      case 'outreachOperator':
        return <OutreachNav collapsed={sidebarCollapsed} onNavigate={onNavigate} />;
      case 'customer':
      default:
        return <CustomerNav collapsed={sidebarCollapsed} onNavigate={onNavigate} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Authenticating...</p>
        </div>
      </div>
    );
  }

  const needsCustomerId = user.appRole === 'customer' || user.appRole === 'manager' || !user.appRole;
  const isPending = !!(user && user.role !== 'admin' && needsCustomerId && !user.customerId);

  if (isPending && currentPageName === 'AccessPending') {
    return (
      <div className="min-h-screen w-full bg-gray-50 overflow-auto">
        <main className="p-6">
          {children}
        </main>
      </div>
    );
  }

  const isCustomer = user.role !== 'admin' && (user.appRole === 'customer' || !user.appRole);
  const isDriver = user.role !== 'admin' && user.appRole === 'driver';

  const getSidebarTitle = () => {
    if (isCustomer && user.customerName) {
      return user.customerName;
    }
    if (isDriver) {
      return 'Drivers';
    }
    if (user.appRole === 'outreach' || user.appRole === 'outreachOperator') {
      return 'Outreach Hire';
    }
    return 'Dispatch';
  };

  const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-64';
  const mainMargin = sidebarCollapsed ? 'md:ml-16' : 'md:ml-64';

  return (
    <>
      <style>{`
        html, body, #root {
          height: 100%;
          margin: 0;
          padding: 0;
        }
        
        .pac-container {
          z-index: 999999 !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
          border-radius: 0.375rem !important;
          border: 1px solid #e5e7eb !important;
          margin-top: 4px !important;
          background: white !important;
        }
        
        .pac-item {
          padding: 8px 12px !important;
          cursor: pointer !important;
          border: none !important;
          background: white !important;
          line-height: 1.5 !important;
        }
        
        .pac-item:hover {
          background-color: #f3f4f6 !important;
        }
        
        .pac-item-selected,
        .pac-item-selected:hover {
          background-color: #e5e7eb !important;
        }
        
        .pac-icon {
          margin-right: 8px !important;
        }
        
        .pac-item-query {
          font-weight: 600 !important;
          color: #111827 !important;
        }
        
        .pac-container * {
          pointer-events: auto !important;
        }
      `}</style>
      
      <div className="h-screen w-screen flex bg-gray-50 overflow-hidden">
        {/* Desktop Sidebar */}
        <div className={`hidden md:flex flex-col ${sidebarWidth} border-r bg-white h-full fixed left-0 top-0 z-20 transition-all duration-300`}>
          <div className={`flex items-center flex-shrink-0 px-4 pt-5 pb-4 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            {!sidebarCollapsed && (
              <>
                <Truck className="h-8 w-8 text-blue-600" />
                <span className="ml-3 font-semibold text-xl">
                  {getSidebarTitle()}
                </span>
              </>
            )}
            {sidebarCollapsed && <Truck className="h-8 w-8 text-blue-600" />}
          </div>
          
          {/* Toggle Button */}
          <div className={`px-2 pb-2 flex ${sidebarCollapsed ? 'justify-center' : 'justify-end'}`}>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="bg-blue-50 border-2 border-blue-300 text-blue-700 hover:bg-blue-100 hover:border-blue-400 shadow-sm"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </Button>
          </div>
          
          {isCustomer && user.customerName && !sidebarCollapsed && (
            <div className="px-4 py-2 mx-2 mb-2 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-600 font-medium text-center">Customer Portal</p>
            </div>
          )}
          
          <nav className="flex-1 px-5 space-y-2 overflow-y-auto">
            {renderNavLinks()}
          </nav>
          <div className="px-5 pb-4 flex-shrink-0">
            <Button
              variant="ghost"
              className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start'} text-gray-600 hover:bg-gray-100`}
              onClick={handleLogout}
              title={sidebarCollapsed ? 'Log Out' : ''}
            >
              <LogOut className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
              {!sidebarCollapsed && 'Log Out'}
            </Button>
          </div>
        </div>

        {/* Main Content Wrapper - applies margin for desktop, contains mobile header & main */}
        <div className={`flex-1 flex flex-col ${mainMargin} h-full transition-all duration-300`}>
          {/* Mobile Header */}
          <div className="md:hidden bg-white border-b px-4 py-3 flex items-center justify-between z-30">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="touch-manipulation active:bg-gray-100"
                  aria-label="Open menu"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="flex flex-col h-full">
                  <div className="flex items-center flex-shrink-0 px-4 pt-5">
                    <Truck className="h-8 w-8 text-blue-600" />
                    <span className="ml-3 font-semibold text-xl">
                      {getSidebarTitle()}
                    </span>
                  </div>
                  
                  {isCustomer && user.customerName && (
                    <div className="px-4 py-2 mx-2 my-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-600 font-medium text-center">Customer Portal</p>
                    </div>
                  )}
                  
                  <nav className="mt-5 flex-1 px-5 space-y-2 overflow-y-auto">
                    {renderNavLinks(handleMobileNavigate)}
                  </nav>
                  <div className="p-5 flex-shrink-0">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-gray-600 hover:bg-gray-100"
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                    >
                      <LogOut className="h-5 w-5 mr-3" />
                      Log Out
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2">
              <Truck className="h-6 w-6 text-blue-600" />
              <span className="font-semibold text-lg">{getSidebarTitle()}</span>
            </div>
          </div>

          {/* Desktop header with notification bell */}
          <div className="hidden md:flex items-center justify-end px-6 py-3 bg-white border-b">
            <NotificationBell />
          </div>

          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>

      <Toaster />
      
      {/* Returned Job Alert Popup */}
      {showReturnedAlert && returnedJobs.length > 0 && user && (
        <ReturnedJobAlert
          returnedJobs={returnedJobs}
          user={user}
          onDismiss={() => setShowReturnedAlert(false)}
          onJobsUpdated={() => {
            // Refresh the returned jobs list
            base44.entities.Job.filter({ status: 'RETURNED' }).then(jobs => {
              const dismissedBy = jobs.filter(job => {
                const dismissed = job.returnAlertDismissedBy || [];
                return !dismissed.includes(user.id);
              });
              setReturnedJobs(dismissedBy);
              if (dismissedBy.length === 0) {
                setShowReturnedAlert(false);
              }
            });
          }}
        />
      )}
    </>
  );
}