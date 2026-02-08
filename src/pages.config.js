/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AccessPending from './pages/AccessPending';
import AdminCustomers from './pages/AdminCustomers';
import AdminDeliveryTypes from './pages/AdminDeliveryTypes';
import AdminJobs from './pages/AdminJobs';
import AdminPickupLocations from './pages/AdminPickupLocations';
import AdminUsers from './pages/AdminUsers';
import CustomerRequestDelivery from './pages/CustomerRequestDelivery';
import DailyJobBoard from './pages/DailyJobBoard';
import Dashboard from './pages/Dashboard';
import DataExport from './pages/DataExport';
import DriverMyRuns from './pages/DriverMyRuns';
import Home from './pages/Home';
import LiveTracking from './pages/LiveTracking';
import Reports from './pages/Reports';
import SchedulingBoard from './pages/SchedulingBoard';
import SheetSpecs from './pages/SheetSpecs';
import TestEmails from './pages/TestEmails';
import WeatherToday from './pages/WeatherToday';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AccessPending": AccessPending,
    "AdminCustomers": AdminCustomers,
    "AdminDeliveryTypes": AdminDeliveryTypes,
    "AdminJobs": AdminJobs,
    "AdminPickupLocations": AdminPickupLocations,
    "AdminUsers": AdminUsers,
    "CustomerRequestDelivery": CustomerRequestDelivery,
    "DailyJobBoard": DailyJobBoard,
    "Dashboard": Dashboard,
    "DataExport": DataExport,
    "DriverMyRuns": DriverMyRuns,
    "Home": Home,
    "LiveTracking": LiveTracking,
    "Reports": Reports,
    "SchedulingBoard": SchedulingBoard,
    "SheetSpecs": SheetSpecs,
    "TestEmails": TestEmails,
    "WeatherToday": WeatherToday,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};