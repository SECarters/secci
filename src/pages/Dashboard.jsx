import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Package, Truck, TrendingUp, Cloud, Droplets, Clock as ClockIcon, AlertTriangle, CalendarRange } from 'lucide-react';
import { format, startOfDay, startOfWeek, addDays } from 'date-fns';
import { createPageUrl } from '@/utils';

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayStats, setTodayStats] = useState({
    totalSqm: 0,
    totalDeliveries: 0,
    totalWeight: 0,
    scheduledJobs: 0,
    approvedJobs: 0,
    completedToday: 0,
    difficultDeliveries: 0
  });
  const [weekAheadStats, setWeekAheadStats] = useState({
    totalJobs: 0,
    totalSqm: 0,
    difficultDeliveries: 0
  });
  const [thisWeekStats, setThisWeekStats] = useState({
    totalSqm: 0
  });
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Separate function to fetch only weather
  const fetchWeatherOnly = async () => {
    try {
      const response = await base44.functions.invoke('getWeather');
      if (response.data && response.data.data) {
        setWeather(response.data.data);
        setWeatherError(null);
      } else if (response.data && response.data.error) {
        setWeatherError(response.data.error);
      } else {
        setWeatherError('Unexpected weather data format');
      }
    } catch (error) {
      console.error('Failed to fetch weather:', error);
      setWeatherError('Failed to load weather data');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);

        const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
        const mondayThisWeek = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday this week
        const sundayThisWeek = addDays(mondayThisWeek, 6); // Sunday this week
        
        // Fetch delivery types and filter for Manitou jobs if outreach user
        const [todayAssignments, allJobs, deliveryTypes] = await Promise.all([
          base44.entities.Assignment.filter({ date: today }),
          base44.entities.Job.list(),
          base44.entities.DeliveryType.list()
        ]);

        const isOutreach = user.appRole === 'outreach';
        const isCustomer = user.role !== 'admin' && (user.appRole === 'customer' || !user.appRole);
        
        // Helper function to check if date is this week
        const isThisWeek = (date) => {
          return date >= mondayThisWeek && date <= sundayThisWeek;
        };
        
        // Determine filtering based on user role
        let filteredJobs = allJobs;
        
        if (isCustomer) {
          // Customer: filter by their customer ID(s)
          const allowedCustomerIds = [
            user.customerId,
            ...(user.additionalCustomerIds || [])
          ].filter(Boolean);
          filteredJobs = filteredJobs.filter(job => allowedCustomerIds.includes(job.customerId));
        } else if (isOutreach) {
          // Outreach: filter by Manitou delivery types
          const manitouCodes = ['UPDWN', 'UNITUP', 'MANS'];
          const manitouTypeIds = deliveryTypes
            .filter(dt => manitouCodes.includes(dt.code))
            .map(dt => dt.id);
          filteredJobs = filteredJobs.filter(job => manitouTypeIds.includes(job.deliveryTypeId));
        }
        // Admin, dispatcher, manager: see all jobs (no additional filtering)

        // Today's stats (jobs scheduled for today)
        const jobIds = todayAssignments.map(a => a.jobId);
        const todayJobs = filteredJobs.filter(job => jobIds.includes(job.id));
        const completedTodayJobs = todayJobs.filter(job => job.status === 'DELIVERED');

        const totalSqm = todayJobs.reduce((sum, job) => sum + (job.sqm || 0), 0);
        const totalWeight = todayJobs.reduce((sum, job) => sum + (job.weightKg || 0), 0);
        const scheduledJobs = filteredJobs.filter(job => job.status === 'SCHEDULED').length;
        const approvedJobs = filteredJobs.filter(job => job.status === 'APPROVED' || job.status === 'PENDING_APPROVAL').length;
        const completedToday = completedTodayJobs.length;
        const difficultDeliveries = todayJobs.filter(job => job.isDifficultDelivery).length;

        setTodayStats({
          totalSqm,
          totalDeliveries: todayJobs.length,
          totalWeight,
          scheduledJobs,
          approvedJobs,
          completedToday,
          difficultDeliveries
        });

        // Week Ahead stats (now → end of Sunday this week)
        const allAssignments = await base44.entities.Assignment.list();
        const weekAheadAssignments = allAssignments.filter(a => {
          const assignmentDate = new Date(a.date);
          const now = new Date();
          return assignmentDate >= now && assignmentDate <= sundayThisWeek;
        });
        
        const weekAheadJobIds = weekAheadAssignments.map(a => a.jobId);
        const weekAheadJobs = filteredJobs.filter(job => 
          weekAheadJobIds.includes(job.id) && 
          (job.status === 'SCHEDULED' || job.status === 'DELIVERED')
        );
        
        setWeekAheadStats({
          totalJobs: weekAheadJobs.length,
          totalSqm: weekAheadJobs.reduce((sum, job) => sum + (job.sqm || 0), 0),
          difficultDeliveries: weekAheadJobs.filter(job => job.isDifficultDelivery).length
        });

        // This Week stats (Monday 00:00 → now)
        const thisWeekAssignments = allAssignments.filter(a => {
          const assignmentDate = new Date(a.date);
          return assignmentDate >= mondayThisWeek && assignmentDate <= new Date();
        });
        
        const thisWeekJobIds = thisWeekAssignments.map(a => a.jobId);
        const thisWeekJobs = filteredJobs.filter(job => 
          thisWeekJobIds.includes(job.id) && 
          (job.status === 'SCHEDULED' || job.status === 'DELIVERED')
        );
        
        setThisWeekStats({
          totalSqm: thisWeekJobs.reduce((sum, job) => sum + (job.sqm || 0), 0)
        });

        // Customer-specific stats for this week
        if (isCustomer) {
          const customerRequestedThisWeek = filteredJobs.filter(job => 
            job.requestedDate && isThisWeek(new Date(job.requestedDate))
          ).length;
          
          const customerTotalM2ThisWeek = filteredJobs
            .filter(job => job.requestedDate && isThisWeek(new Date(job.requestedDate)))
            .reduce((sum, job) => sum + (job.sqm || 0), 0);
          
          const now = new Date();
          const customerCompletedThisWeek = filteredJobs.filter(job => 
            job.status === 'DELIVERED' && 
            job.updated_date && 
            new Date(job.updated_date) >= mondayThisWeek &&
            new Date(job.updated_date) <= now
          ).length;

          setThisWeekStats(prev => ({
            ...prev,
            customerRequestedThisWeek,
            customerTotalM2ThisWeek,
            customerCompletedThisWeek
          }));
        }

        // Fetch weather only if page is visible initially
        if (!document.hidden) {
          await fetchWeatherOnly();
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Listen for page visibility changes
    const handleVisibilityChange = () => {
      // Only fetch weather when page becomes visible and if weather hasn't been fetched yet
      if (!document.hidden && !weather) {
        fetchWeatherOnly();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getWeatherIcon = (condition) => {
    if (condition?.toLowerCase().includes('rain')) {
      return <Droplets className="h-16 w-16 text-white opacity-50" />;
    }
    return <Cloud className="h-16 w-16 text-white opacity-50" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isOutreach = currentUser?.appRole === 'outreach';
  const isCustomer = currentUser?.role !== 'admin' && (currentUser?.appRole === 'customer' || !currentUser?.appRole);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {getGreeting()}, {currentUser?.full_name?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-gray-600 mt-1">Here's what's happening today</p>
      </div>

      {/* Clock and Weather Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Clock Card */}
        <Card className="bg-gradient-to-br from-blue-500 to-blue-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="text-white">
                <p className="text-sm font-medium opacity-90">Current Time</p>
                <p className="text-5xl font-bold mt-2">
                  {format(currentTime, 'h:mm')}
                  <span className="text-2xl ml-2">{format(currentTime, 'a')}</span>
                </p>
                <p className="text-lg mt-2 opacity-90">
                  {format(currentTime, 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
              <ClockIcon className="h-16 w-16 text-white opacity-50" />
            </div>
          </CardContent>
        </Card>

        {/* Weather Card */}
        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-700">
          <CardContent className="p-6">
            <div className="text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium opacity-90">Brisbane Weather</p>
                  {weather ? (
                    <>
                      <div className="flex items-baseline mt-2">
                        <p className="text-5xl font-bold">{Math.round(weather.temp)}°</p>
                        <span className="text-2xl ml-2">C</span>
                      </div>
                      <p className="text-lg mt-2 capitalize opacity-90">{weather.description}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-2">
                          <Droplets className="h-4 w-4" />
                          <span className="text-sm">{weather.rain_chance}% Rain</span>
                        </div>
                        <div className="text-sm">
                          Humidity: {weather.humidity}%
                        </div>
                      </div>
                    </>
                  ) : weatherError ? (
                    <p className="text-lg mt-2">{weatherError}</p>
                  ) : (
                    <p className="text-lg mt-2">Loading weather...</p>
                  )}
                </div>
                <div>
                  {weather && getWeatherIcon(weather.description)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Overview Section */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Today's Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Total Deliveries/Jobs Today */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = createPageUrl('DailyJobBoard')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {isOutreach ? 'Jobs Today' : isCustomer ? 'Deliveries Expected Today' : 'Deliveries Today'}
              </CardTitle>
              <Truck className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{todayStats.totalDeliveries}</div>
              <p className="text-xs text-gray-500 mt-1">{isOutreach ? 'Scheduled for today' : 'Scheduled for delivery'}</p>
            </CardContent>
          </Card>

          {/* Total SQM/Hours Today */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = createPageUrl('DailyJobBoard')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {isOutreach ? 'Total Hours Booked Today' : 'Total m² Today'}
              </CardTitle>
              <Package className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {isOutreach ? `${todayStats.totalSqm.toLocaleString()}h` : todayStats.totalSqm.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {isOutreach ? 'Across all machines' : 'Square meters scheduled'}
              </p>
            </CardContent>
          </Card>

          {/* Completed Today or Awaiting Schedule */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = createPageUrl(isCustomer ? 'AdminJobs' : 'SchedulingBoard')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {isCustomer ? 'Completed Deliveries Today' : 'Awaiting Schedule'}
              </CardTitle>
              <Package className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{isCustomer ? todayStats.completedToday : todayStats.approvedJobs}</div>
              <p className="text-xs text-gray-500 mt-1">{isCustomer ? 'Deliveries completed today' : 'Jobs ready to schedule'}</p>
            </CardContent>
          </Card>

          {/* Difficult Deliveries */}
          {todayStats.difficultDeliveries > 0 && (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-orange-200" onClick={() => window.location.href = createPageUrl('DailyJobBoard')}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-orange-700">
                  Difficult Deliveries
                </CardTitle>
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-900">{todayStats.difficultDeliveries}</div>
                <p className="text-xs text-orange-600 mt-1">Requires special attention</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* The Week Section */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-purple-600" />
          This Week
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isCustomer ? (
            <>
              <Card className="border-purple-200 bg-purple-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-700">
                    Deliveries Requested
                  </CardTitle>
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {thisWeekStats.customerRequestedThisWeek || 0}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Requested this week
                  </p>
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-purple-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-700">
                    Total m²
                  </CardTitle>
                  <Package className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {(thisWeekStats.customerTotalM2ThisWeek || 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Square meters this week
                  </p>
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-purple-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-700">
                    Completed Deliveries
                  </CardTitle>
                  <Calendar className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {thisWeekStats.customerCompletedThisWeek || 0}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Completed this week
                  </p>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card className="border-purple-200 bg-purple-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-700">
                    Delivered
                  </CardTitle>
                  <Calendar className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {isOutreach ? `${thisWeekStats.totalSqm.toLocaleString()}h` : thisWeekStats.totalSqm.toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {isOutreach ? 'Total hours scheduled and/or completed since Monday morning' : 'Total m² delivered this week'}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-purple-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-700">
                    {isOutreach ? 'Total Hours' : 'Scheduled'}
                  </CardTitle>
                  <Package className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {isOutreach ? `${weekAheadStats.totalSqm.toLocaleString()}h` : weekAheadStats.totalSqm.toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {isOutreach ? 'Booked machine hours' : 'Total m² still to deliver'}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-purple-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-700">
                    Difficult Deliveries
                  </CardTitle>
                  <AlertTriangle className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{weekAheadStats.difficultDeliveries}</div>
                  <p className="text-xs text-gray-600 mt-1">Special attention required</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>



      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => window.location.href = createPageUrl(currentUser?.appRole === 'driver' ? 'DriverMyRuns' : 'SchedulingBoard')}
            className="p-6 bg-blue-50 hover:bg-blue-100 rounded-lg text-left transition-colors"
          >
            <Calendar className="h-6 w-6 text-blue-600 mb-3" />
            <p className="font-semibold text-gray-900 mb-1">
              {currentUser?.appRole === 'driver' ? 'My Runs' : 'Open Scheduler'}
            </p>
            <p className="text-sm text-gray-600">
              {currentUser?.appRole === 'driver' ? 'View your delivery schedule' : 'Manage delivery schedule'}
            </p>
          </button>

          <button
            onClick={() => window.location.href = createPageUrl('DailyJobBoard')}
            className="p-6 bg-green-50 hover:bg-green-100 rounded-lg text-left transition-colors"
          >
            <Truck className="h-6 w-6 text-green-600 mb-3" />
            <p className="font-semibold text-gray-900 mb-1">Daily Job Board</p>
            <p className="text-sm text-gray-600">View today's deliveries</p>
          </button>

          <button
            onClick={() => window.location.href = createPageUrl('AdminJobs')}
            className="p-6 bg-purple-50 hover:bg-purple-100 rounded-lg text-left transition-colors"
          >
            <Package className="h-6 w-6 text-purple-600 mb-3" />
            <p className="font-semibold text-gray-900 mb-1">All Jobs</p>
            <p className="text-sm text-gray-600">Browse complete job list</p>
          </button>
        </div>
      </div>
    </div>
  );
}