import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Truck, 
  Clock, 
  CheckCircle2, 
  Download,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  AlertTriangle,
  FileCheck,
  Target,
  Gauge,
  Users,
  MapPin
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, parseISO, differenceInDays, startOfWeek, endOfWeek, eachWeekOfInterval } from 'date-fns';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { createPageUrl } from '@/utils';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const TRUCKS = ['All', 'ACCO1', 'ACCO2', 'FUSO', 'ISUZU', 'UD'];

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [deliveryTypes, setDeliveryTypes] = useState([]);
  
  // Filters
  const [dateRange, setDateRange] = useState('30days');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTruck, setSelectedTruck] = useState('All');
  const [selectedCustomer, setSelectedCustomer] = useState('All');
  
  // Computed data
  const [kpis, setKpis] = useState({
    totalJobs: 0,
    completedJobs: 0,
    totalSqm: 0,
    podUploadRate: 0,
    difficultDeliveries: 0,
    onTimeDeliveryRate: 0,
    avgDeliveryTime: 0,
    completionRate: 0,
    avgJobsPerTruck: 0
  });
  
  const [chartData, setChartData] = useState({
    sqmTrends: [],
    customerActivity: [],
    sqmLeaderboard: [],
    truckPerformance: [],
    statusBreakdown: [],
    driverPerformance: [],
    completionByType: [],
    completionByRegion: [],
    deliveryTimeDistribution: [],
    vehicleUtilization: []
  });

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        
        if (user.role !== 'admin' && user.appRole !== 'dispatcher' && user.appRole !== 'manager') {
          window.location.href = createPageUrl('Dashboard');
          return;
        }
      } catch (error) {
        console.error('Error checking access:', error);
        window.location.href = createPageUrl('Dashboard');
      }
    };
    
    checkAccess();
  }, []);

  useEffect(() => {
    if (dateRange === 'custom') return;
    
    const today = new Date();
    let start = today;
    
    switch (dateRange) {
      case '7days':
        start = subDays(today, 7);
        break;
      case '30days':
        start = subDays(today, 30);
        break;
      case '90days':
        start = subDays(today, 90);
        break;
      case 'thisMonth':
        start = startOfMonth(today);
        break;
      case 'lastMonth':
        start = startOfMonth(subDays(today, 30));
        setEndDate(format(endOfMonth(subDays(today, 30)), 'yyyy-MM-dd'));
        break;
      default:
        start = subDays(today, 30);
    }
    
    setStartDate(format(start, 'yyyy-MM-dd'));
    if (dateRange !== 'lastMonth') {
      setEndDate(format(today, 'yyyy-MM-dd'));
    }
  }, [dateRange]);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      
      setLoading(true);
      try {
        const [allJobs, allAssignments, allCustomers, allDeliveryTypes] = await Promise.all([
          base44.entities.Job.list(),
          base44.entities.Assignment.list(),
          base44.entities.Customer.list(),
          base44.entities.DeliveryType.list()
        ]);
        
        setJobs(allJobs);
        setAssignments(allAssignments);
        setCustomers(allCustomers);
        setDeliveryTypes(allDeliveryTypes);
        
        calculateMetrics(allJobs, allAssignments, allCustomers, allDeliveryTypes);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, startDate, endDate, selectedTruck, selectedCustomer]);

  const calculateMetrics = (allJobs, allAssignments, allCustomers, allDeliveryTypes) => {
    // Filter jobs by date range
    const filteredJobs = allJobs.filter(job => {
      const jobDate = job.requestedDate || job.created_date;
      const inDateRange = jobDate >= startDate && jobDate <= endDate;
      const matchesTruck = selectedTruck === 'All' || 
        allAssignments.some(a => a.jobId === job.id && a.truckId === selectedTruck);
      const matchesCustomer = selectedCustomer === 'All' || job.customerId === selectedCustomer;
      
      return inDateRange && matchesTruck && matchesCustomer;
    });

    // Calculate KPIs
    const totalJobs = filteredJobs.length;
    const completedJobs = filteredJobs.filter(j => j.status === 'DELIVERED').length;
    const difficultDeliveries = filteredJobs.filter(j => j.isDifficultDelivery).length;
    
    // Total SQM
    const totalSqm = filteredJobs.reduce((sum, job) => sum + (job.sqm || 0), 0);
    
    // POD Upload Rate
    const jobsWithPOD = filteredJobs.filter(j => j.podFiles && j.podFiles.length > 0).length;
    const podUploadRate = totalJobs > 0 ? (jobsWithPOD / totalJobs) * 100 : 0;

    // On-Time Delivery Rate
    const scheduledJobs = filteredJobs.filter(j => j.requestedDate && j.status === 'DELIVERED');
    const onTimeJobs = scheduledJobs.filter(job => {
      const assignment = allAssignments.find(a => a.jobId === job.id);
      if (!assignment) return false;
      return assignment.date <= job.requestedDate;
    });
    const onTimeDeliveryRate = scheduledJobs.length > 0 ? (onTimeJobs.length / scheduledJobs.length) * 100 : 0;

    // Average Delivery Time (days from creation to delivery)
    const deliveredJobs = filteredJobs.filter(j => j.status === 'DELIVERED' && j.created_date);
    let totalDeliveryDays = 0;
    deliveredJobs.forEach(job => {
      const assignment = allAssignments.find(a => a.jobId === job.id);
      if (assignment && assignment.date) {
        const daysDiff = differenceInDays(parseISO(assignment.date), parseISO(job.created_date));
        totalDeliveryDays += Math.max(0, daysDiff);
      }
    });
    const avgDeliveryTime = deliveredJobs.length > 0 ? totalDeliveryDays / deliveredJobs.length : 0;

    // Completion Rate
    const completionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

    // Average Jobs Per Truck
    const trucksUsed = new Set(allAssignments.filter(a => {
      const job = filteredJobs.find(j => j.id === a.jobId);
      return job && a.date >= startDate && a.date <= endDate;
    }).map(a => a.truckId));
    const avgJobsPerTruck = trucksUsed.size > 0 ? totalJobs / trucksUsed.size : 0;

    setKpis({
      totalJobs,
      completedJobs,
      totalSqm: Math.round(totalSqm),
      podUploadRate: Math.round(podUploadRate),
      difficultDeliveries,
      onTimeDeliveryRate: Math.round(onTimeDeliveryRate),
      avgDeliveryTime: avgDeliveryTime.toFixed(1),
      completionRate: Math.round(completionRate),
      avgJobsPerTruck: avgJobsPerTruck.toFixed(1)
    });

    // SQM Trends - Week by Week
    try {
      const weeks = eachWeekOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate)
      }, { weekStartsOn: 1 }); // Monday as start of week

      const sqmByWeek = {};
      weeks.forEach(weekStart => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const weekKey = format(weekStart, 'MMM dd');
        sqmByWeek[weekKey] = 0;
      });

      filteredJobs.forEach(job => {
        const jobDate = parseISO(job.requestedDate || job.created_date);
        const weekStart = startOfWeek(jobDate, { weekStartsOn: 1 });
        const weekKey = format(weekStart, 'MMM dd');
        
        if (sqmByWeek.hasOwnProperty(weekKey)) {
          sqmByWeek[weekKey] += (job.sqm || 0);
        }
      });

      const sqmTrends = Object.entries(sqmByWeek).map(([week, sqm]) => ({
        week,
        sqm: Math.round(sqm)
      }));

      setChartData(prev => ({ ...prev, sqmTrends }));
    } catch (error) {
      console.error('Error calculating SQM trends:', error);
      setChartData(prev => ({ ...prev, sqmTrends: [] }));
    }

    // Customer activity (top 10)
    const jobsByCustomer = {};
    filteredJobs.forEach(job => {
      const customerName = job.customerName || 'Unknown';
      jobsByCustomer[customerName] = (jobsByCustomer[customerName] || 0) + 1;
    });
    
    const customerActivity = Object.entries(jobsByCustomer)
      .map(([name, count]) => ({ name, jobs: count }))
      .sort((a, b) => b.jobs - a.jobs)
      .slice(0, 10);

    // SQM Delivered Leaderboard (by truck)
    const sqmByTruck = {};
    TRUCKS.slice(1).forEach(truck => {
      sqmByTruck[truck] = 0;
    });
    
    allAssignments.forEach(assignment => {
      const job = filteredJobs.find(j => j.id === assignment.jobId);
      if (job && assignment.date >= startDate && assignment.date <= endDate && job.status === 'DELIVERED') {
        sqmByTruck[assignment.truckId] = (sqmByTruck[assignment.truckId] || 0) + (job.sqm || 0);
      }
    });
    
    const sqmLeaderboard = Object.entries(sqmByTruck)
      .map(([name, sqm]) => ({ name, sqm: Math.round(sqm) }))
      .sort((a, b) => b.sqm - a.sqm);

    // Truck performance (job count)
    const jobsByTruck = {};
    TRUCKS.slice(1).forEach(truck => {
      jobsByTruck[truck] = 0;
    });
    
    allAssignments.forEach(assignment => {
      const job = filteredJobs.find(j => j.id === assignment.jobId);
      if (job && assignment.date >= startDate && assignment.date <= endDate) {
        jobsByTruck[assignment.truckId] = (jobsByTruck[assignment.truckId] || 0) + 1;
      }
    });
    
    const truckPerformance = Object.entries(jobsByTruck).map(([name, jobs]) => ({ name, jobs }));

    // Status breakdown
    const jobsByStatus = {};
    filteredJobs.forEach(job => {
      const status = job.status || 'UNKNOWN';
      jobsByStatus[status] = (jobsByStatus[status] || 0) + 1;
    });
    
    const statusBreakdown = Object.entries(jobsByStatus).map(([name, value]) => ({ 
      name: name.replace(/_/g, ' '), 
      value 
    }));

    // Driver Performance (by assignments with completed jobs)
    const jobsByDriver = {};
    allAssignments.forEach(assignment => {
      const job = filteredJobs.find(j => j.id === assignment.jobId);
      if (job && assignment.date >= startDate && assignment.date <= endDate) {
        if (!jobsByDriver[assignment.truckId]) {
          jobsByDriver[assignment.truckId] = { total: 0, completed: 0, onTime: 0 };
        }
        jobsByDriver[assignment.truckId].total += 1;
        if (job.status === 'DELIVERED') {
          jobsByDriver[assignment.truckId].completed += 1;
          if (assignment.date <= job.requestedDate) {
            jobsByDriver[assignment.truckId].onTime += 1;
          }
        }
      }
    });

    const driverPerformance = Object.entries(jobsByDriver).map(([name, stats]) => ({
      name,
      total: stats.total,
      completed: stats.completed,
      completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      onTimeRate: stats.completed > 0 ? Math.round((stats.onTime / stats.completed) * 100) : 0
    })).sort((a, b) => b.completionRate - a.completionRate);

    // Completion Rate by Delivery Type
    const jobsByDeliveryType = {};
    filteredJobs.forEach(job => {
      const typeName = job.deliveryTypeName || 'Unknown';
      if (!jobsByDeliveryType[typeName]) {
        jobsByDeliveryType[typeName] = { total: 0, completed: 0 };
      }
      jobsByDeliveryType[typeName].total += 1;
      if (job.status === 'DELIVERED') {
        jobsByDeliveryType[typeName].completed += 1;
      }
    });

    const completionByType = Object.entries(jobsByDeliveryType).map(([name, stats]) => ({
      name,
      total: stats.total,
      completed: stats.completed,
      rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
    })).sort((a, b) => b.total - a.total);

    // Completion Rate by Region (suburb)
    const jobsByRegion = {};
    filteredJobs.forEach(job => {
      const region = job.deliverySuburb || 'Unknown';
      if (!jobsByRegion[region]) {
        jobsByRegion[region] = { total: 0, completed: 0 };
      }
      jobsByRegion[region].total += 1;
      if (job.status === 'DELIVERED') {
        jobsByRegion[region].completed += 1;
      }
    });

    const completionByRegion = Object.entries(jobsByRegion)
      .map(([name, stats]) => ({
        name,
        total: stats.total,
        completed: stats.completed,
        rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Delivery Time Distribution (in days)
    const deliveryTimeBuckets = { '0-1': 0, '2-3': 0, '4-7': 0, '8-14': 0, '15+': 0 };
    deliveredJobs.forEach(job => {
      const assignment = allAssignments.find(a => a.jobId === job.id);
      if (assignment && assignment.date) {
        const days = differenceInDays(parseISO(assignment.date), parseISO(job.created_date));
        if (days <= 1) deliveryTimeBuckets['0-1'] += 1;
        else if (days <= 3) deliveryTimeBuckets['2-3'] += 1;
        else if (days <= 7) deliveryTimeBuckets['4-7'] += 1;
        else if (days <= 14) deliveryTimeBuckets['8-14'] += 1;
        else deliveryTimeBuckets['15+'] += 1;
      }
    });

    const deliveryTimeDistribution = Object.entries(deliveryTimeBuckets).map(([range, count]) => ({
      range: `${range} days`,
      count
    }));

    // Vehicle Utilization (jobs per truck per day in date range)
    const dateRangeDays = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
    const vehicleUtilization = TRUCKS.slice(1).map(truck => {
      const truckJobs = allAssignments.filter(a => {
        const job = filteredJobs.find(j => j.id === a.jobId);
        return job && a.truckId === truck && a.date >= startDate && a.date <= endDate;
      });
      const avgJobsPerDay = dateRangeDays > 0 ? truckJobs.length / dateRangeDays : 0;
      const utilizationRate = Math.min(100, Math.round((avgJobsPerDay / 4) * 100)); // Assuming 4 jobs/day is 100%
      
      return {
        name: truck,
        jobs: truckJobs.length,
        avgPerDay: avgJobsPerDay.toFixed(1),
        utilization: utilizationRate
      };
    }).sort((a, b) => b.utilization - a.utilization);

    setChartData(prev => ({
      ...prev,
      customerActivity,
      sqmLeaderboard,
      truckPerformance,
      statusBreakdown,
      driverPerformance,
      completionByType,
      completionByRegion,
      deliveryTimeDistribution,
      vehicleUtilization
    }));
  };

  const exportToCSV = () => {
    const filteredJobs = jobs.filter(job => {
      const jobDate = job.requestedDate || job.created_date;
      const inDateRange = jobDate >= startDate && jobDate <= endDate;
      const matchesTruck = selectedTruck === 'All' || 
        assignments.some(a => a.jobId === job.id && a.truckId === selectedTruck);
      const matchesCustomer = selectedCustomer === 'All' || job.customerId === selectedCustomer;
      
      return inDateRange && matchesTruck && matchesCustomer;
    });

    const headers = ['Job ID', 'Customer', 'Delivery Type', 'Requested Date', 'Status', 'Truck', 'SQM', 'POD Uploaded', 'Location'];
    const rows = filteredJobs.map(job => {
      const assignment = assignments.find(a => a.jobId === job.id);
      return [
        job.id,
        job.customerName,
        job.deliveryTypeName,
        job.requestedDate,
        job.status,
        assignment?.truckId || 'Unassigned',
        job.sqm || 0,
        (job.podFiles && job.podFiles.length > 0) ? 'Yes' : 'No',
        job.deliveryLocation
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delivery_report_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const exportToPDF = async () => {
    // Generate a summary report
    const reportContent = `
DELIVERY ANALYTICS REPORT
Date Range: ${format(parseISO(startDate), 'MMM dd, yyyy')} - ${format(parseISO(endDate), 'MMM dd, yyyy')}
Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}

KEY PERFORMANCE INDICATORS
- Total Jobs: ${kpis.totalJobs}
- Completed Jobs: ${kpis.completedJobs}
- Total SQM Delivered: ${kpis.totalSqm.toLocaleString()} m²
- POD Upload Rate: ${kpis.podUploadRate}%
- Difficult Deliveries: ${kpis.difficultDeliveries}

TOP CUSTOMERS
${chartData.customerActivity.slice(0, 5).map((c, i) => `${i + 1}. ${c.name}: ${c.jobs} jobs`).join('\n')}

SQM DELIVERED LEADERBOARD
${chartData.sqmLeaderboard.map((t, i) => `${i + 1}. ${t.name}: ${t.sqm.toLocaleString()} m²`).join('\n')}

TRUCK PERFORMANCE (Job Count)
${chartData.truckPerformance.map(t => `${t.name}: ${t.jobs} jobs`).join('\n')}
    `.trim();

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delivery_report_${startDate}_to_${endDate}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  if (!currentUser || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-screen-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="text-gray-600 mt-1">Performance insights and data visualization</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={exportToPDF}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Date Range</label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="90days">Last 90 Days</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="lastMonth">Last Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateRange === 'custom' && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-9 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-9 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Truck</label>
              <Select value={selectedTruck} onValueChange={setSelectedTruck}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRUCKS.map(truck => (
                    <SelectItem key={truck} value={truck}>{truck}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Customer</label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Customers</SelectItem>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.customerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Jobs</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.totalJobs}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completion Rate</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-2xl font-bold text-gray-900">{kpis.completionRate}%</p>
                  {kpis.completionRate >= 90 ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : kpis.completionRate >= 70 ? (
                    <TrendingUp className="h-5 w-5 text-yellow-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                </div>
              </div>
              <Target className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">On-Time Delivery</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-2xl font-bold text-gray-900">{kpis.onTimeDeliveryRate}%</p>
                  {kpis.onTimeDeliveryRate >= 85 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-orange-600" />
                  )}
                </div>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Delivery Time</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.avgDeliveryTime} days</p>
              </div>
              <Calendar className="h-8 w-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total SQM</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.totalSqm.toLocaleString()}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Jobs/Truck</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.avgJobsPerTruck}</p>
              </div>
              <Gauge className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">POD Upload Rate</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-2xl font-bold text-gray-900">{kpis.podUploadRate}%</p>
                  {kpis.podUploadRate >= 90 ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : kpis.podUploadRate >= 70 ? (
                    <TrendingUp className="h-5 w-5 text-yellow-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                </div>
              </div>
              <FileCheck className="h-8 w-8 text-teal-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Difficult Deliveries</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.difficultDeliveries}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SQM Trends Week by Week */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Total SQM - Week by Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.sqmTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sqm" fill="#3b82f6" name="Square Meters" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* SQM Delivered Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-orange-600" />
              SQM Delivered Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.sqmLeaderboard}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sqm" fill="#f59e0b" name="Square Meters" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Customer Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-600" />
              Top Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.customerActivity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="jobs" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Truck Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-indigo-600" />
              Truck Performance (Job Count)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.truckPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="jobs" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-600" />
            Job Status Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {chartData.statusBreakdown.map((status, index) => (
              <div key={status.name} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold" style={{ color: COLORS[index % COLORS.length] }}>
                  {status.value}
                </p>
                <p className="text-sm text-gray-600 mt-1">{status.name}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Driver/Truck Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Driver Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {chartData.driverPerformance.map((driver) => (
                <div key={driver.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{driver.name}</p>
                    <p className="text-sm text-gray-600">
                      {driver.completed}/{driver.total} completed
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Completion</p>
                      <p className="font-bold text-green-600">{driver.completionRate}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">On-Time</p>
                      <p className="font-bold text-blue-600">{driver.onTimeRate}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-purple-600" />
              Vehicle Utilization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.vehicleUtilization}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                          <p className="font-medium">{data.name}</p>
                          <p className="text-sm text-gray-600">Total Jobs: {data.jobs}</p>
                          <p className="text-sm text-gray-600">Avg/Day: {data.avgPerDay}</p>
                          <p className="text-sm text-purple-600 font-medium">Utilization: {data.utilization}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="utilization" fill="#8b5cf6" name="Utilization %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Completion Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-600" />
              Completion Rate by Delivery Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.completionByType}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                          <p className="font-medium">{data.name}</p>
                          <p className="text-sm text-gray-600">Total: {data.total}</p>
                          <p className="text-sm text-gray-600">Completed: {data.completed}</p>
                          <p className="text-sm text-green-600 font-medium">Rate: {data.rate}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="rate" fill="#f59e0b" name="Completion Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-600" />
              Top 10 Regions by Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.completionByRegion}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                          <p className="font-medium">{data.name}</p>
                          <p className="text-sm text-gray-600">Total: {data.total}</p>
                          <p className="text-sm text-gray-600">Completed: {data.completed}</p>
                          <p className="text-sm text-green-600 font-medium">Rate: {data.rate}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="total" fill="#ef4444" name="Total Jobs" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Delivery Time Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Delivery Time Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.deliveryTimeDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#3b82f6" name="Number of Jobs" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}