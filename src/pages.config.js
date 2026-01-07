import AccessPending from './pages/AccessPending';
import AdminCustomers from './pages/AdminCustomers';
import AdminDeliveryTypes from './pages/AdminDeliveryTypes';
import AdminPickupLocations from './pages/AdminPickupLocations';
import AdminUsers from './pages/AdminUsers';
import CustomerRequestDelivery from './pages/CustomerRequestDelivery';
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
import DailyJobBoard from './pages/DailyJobBoard';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AccessPending": AccessPending,
    "AdminCustomers": AdminCustomers,
    "AdminDeliveryTypes": AdminDeliveryTypes,
    "AdminPickupLocations": AdminPickupLocations,
    "AdminUsers": AdminUsers,
    "CustomerRequestDelivery": CustomerRequestDelivery,
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
    "DailyJobBoard": DailyJobBoard,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};