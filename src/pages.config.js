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
import SheetSpecs from './pages/SheetSpecs';
import TestEmails from './pages/TestEmails';
import WeatherToday from './pages/WeatherToday';
import SchedulingBoard from './pages/SchedulingBoard';
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
    "SheetSpecs": SheetSpecs,
    "TestEmails": TestEmails,
    "WeatherToday": WeatherToday,
    "SchedulingBoard": SchedulingBoard,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};