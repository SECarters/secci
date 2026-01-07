import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, User, Truck, Clock, AlertTriangle, Plus, CheckCircle2, Package, RefreshCw, ArrowLeft, LayoutGrid, CalendarDays, CalendarRange } from 'lucide-react';
import { format, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import { createPageUrl } from '@/utils';
import CreateJobForm from '../components/scheduling/CreateJobForm';
import JobDetailsDialog from '../components/scheduling/JobDetailsDialog';
import { useToast } from '@/components/ui/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getJobCardInlineStyles, getBadgeStyles, getJobCardStyles } from '../components/scheduling/DeliveryTypeColorUtils';
import DeliveryTypeLegend from '../components/scheduling/DeliveryTypeLegend';
import EditPlaceholderForm from '../components/scheduling/EditPlaceholderForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const TRUCKS = [
  { id: 'ACCO1', name: 'ACCO1' },
  { id: 'ACCO2', name: 'ACCO2' },
  { id: 'FUSO', name: 'FUSO' },
  { id: 'ISUZU', name: 'ISUZU' },
  { id: 'UD', name: 'UD' }
];

const TIME_SLOTS = [
  { id: 'first-am', label: '6-8am (1st AM)', color: 'bg-blue-100' },
  { id: 'second-am', label: '8-10am (2nd AM)', color: 'bg-green-100' },
  { id: 'lunch', label: '10am-12pm (LUNCH)', color: 'bg-yellow-100' },
  { id: 'first-pm', label: '12-2pm (1st PM)', color: 'bg-orange-100' },
  { id: 'second-pm', label: '2-4pm (2nd PM)', color: 'bg-purple-100' }
];

const COLOR_OPTIONS = {
  gray: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  green: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300' }
};

export default function DailyJobBoard() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedJob, setSelectedJob] = useState(null);
  const [isJobDialogOpen, setJobDialogOpen] = useState(false);
  const [createJobOpen, setCreateJobOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [selectedPlaceholder, setSelectedPlaceholder] = useState(null);
  const [isPlaceholderDialogOpen, setPlaceholderDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState('daily'); // 'daily', 'weekly', 'monthly'

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filter out cancelled jobs for all users - include RETURNED status
  const { data: jobs = [], isLoading: jobsLoading, isFetching: jobsFetching } = useQuery({
    queryKey: ['jobs', 'realtime'],
    queryFn: () => base44.entities.Job.filter({ 
      status: { $in: ['PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'DELIVERED', 'RETURNED', 'IN_TRANSIT'] }
    }),
    staleTime: 0,
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['assignments', 'realtime'],
    queryFn: () => base44.entities.Assignment.list(),
    staleTime: 0,
    refetchInterval: 5000, // Poll every 5 seconds
  });

  const { data: placeholders = [], isLoading: placeholdersLoading } = useQuery({
    queryKey: ['placeholders', 'realtime', selectedDate], // Add selectedDate as a dependency for placeholders
    queryFn: () => base44.entities.Placeholder.list(), // Will filter by date in useMemo
    staleTime: 0,
  });

  const { data: deliveryTypes = [] } = useQuery({
    queryKey: ['deliveryTypes'],
    queryFn: () => base44.entities.DeliveryType.list(),
    staleTime: 60000, // Cache for 1 minute (relatively static data)
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    staleTime: 60000,
  });

  const { data: pickupLocations = [] } = useQuery({
    queryKey: ['pickupLocations'],
    queryFn: () => base44.entities.PickupLocation.list(),
    staleTime: 60000,
  });

  const loading = jobsLoading || assignmentsLoading || placeholdersLoading;

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error fetching user:', error);
        setCurrentUser(false);
      }
    };
    init();
  }, []);

  // Process data for display using React.useMemo
  const { jobsByTruck, filteredJobs, dateFilteredPlaceholders } = React.useMemo(() => {
    if (!currentUser || loading) {
      return { jobsByTruck: {}, filteredJobs: [], dateFilteredPlaceholders: [] };
    }

    // Hide placeholders from customers
    const canSeePlaceholders = currentUser.role === 'admin' || 
      currentUser.appRole === 'dispatcher' || 
      currentUser.appRole === 'manager' ||
      currentUser.appRole === 'driver';

    let visibleJobs = [...jobs];

    if (currentUser.role !== 'admin' && currentUser.appRole === 'customer' &&
        (currentUser.customerId || currentUser.additionalCustomerIds?.length > 0)) {
      const allowedCustomerIds = [
        currentUser.customerId,
        ...(currentUser.additionalCustomerIds || [])
      ].filter(Boolean);

      visibleJobs = visibleJobs.filter((job) => allowedCustomerIds.includes(job.customerId));
    }

    const dateFilteredAndVisibleJobs = visibleJobs.filter((job) => job.requestedDate === selectedDate);

    const newJobsByTruck = {};
    TRUCKS.forEach((truck) => {
      newJobsByTruck[truck.id] = [];
    });
    newJobsByTruck['UNASSIGNED'] = [];

    dateFilteredAndVisibleJobs.forEach((job) => {
      const assignment = assignments.find((a) => a.jobId === job.id && a.date === selectedDate);
      if (assignment) {
        if (!newJobsByTruck[assignment.truckId]) {
          newJobsByTruck[assignment.truckId] = [];
        }
        newJobsByTruck[assignment.truckId].push({
          ...job,
          assignment,
          pickupLocation: pickupLocations.find(loc => loc.id === job.pickupLocationId)
        });
      } else if (job.status === 'SCHEDULED' || job.status === 'APPROVED' || job.status === 'PENDING_APPROVAL') {
        newJobsByTruck['UNASSIGNED'].push({
          ...job,
          pickupLocation: pickupLocations.find(loc => loc.id === job.pickupLocationId)
        });
      }
    });

    Object.keys(newJobsByTruck).forEach((truckId) => {
      newJobsByTruck[truckId].sort((a, b) => {
        if (!a.assignment) return 1;
        if (!b.assignment) return -1;
        const slotOrder = TIME_SLOTS.map(slot => slot.id);
        return slotOrder.indexOf(a.assignment.timeSlotId) - slotOrder.indexOf(b.assignment.timeSlotId);
      });
    });

    const dateFilteredPlaceholders = canSeePlaceholders 
      ? placeholders.filter((p) => p.date === selectedDate)
      : [];

    return {
      jobsByTruck: newJobsByTruck,
      filteredJobs: dateFilteredAndVisibleJobs,
      dateFilteredPlaceholders
    };
  }, [jobs, assignments, placeholders, deliveryTypes, customers, pickupLocations, selectedDate, currentUser, loading]);

  const goToPrevious = () => {
    if (viewMode === 'daily') {
      const newDate = subDays(new Date(selectedDate), 1);
      setSelectedDate(format(newDate, 'yyyy-MM-dd'));
    } else if (viewMode === 'weekly') {
      const newDate = subWeeks(new Date(selectedDate), 1);
      setSelectedDate(format(newDate, 'yyyy-MM-dd'));
    } else {
      const newDate = subMonths(new Date(selectedDate), 1);
      setSelectedDate(format(newDate, 'yyyy-MM-dd'));
    }
  };

  const goToNext = () => {
    if (viewMode === 'daily') {
      const newDate = addDays(new Date(selectedDate), 1);
      setSelectedDate(format(newDate, 'yyyy-MM-dd'));
    } else if (viewMode === 'weekly') {
      const newDate = addWeeks(new Date(selectedDate), 1);
      setSelectedDate(format(newDate, 'yyyy-MM-dd'));
    } else {
      const newDate = addMonths(new Date(selectedDate), 1);
      setSelectedDate(format(newDate, 'yyyy-MM-dd'));
    }
  };

  const goToToday = () => {
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const getJobsForTimeSlot = (timeSlotId) => {
    const slotAssignments = assignments.filter((a) => a.timeSlotId === timeSlotId && a.date === selectedDate);
    return slotAssignments.map((a) => ({
      job: filteredJobs.find((j) => j.id === a.jobId),
      truckId: a.truckId,
      assignment: a,
      slotPosition: a.slotPosition || 1
    })).filter((item) => item.job).
      sort((a, b) => a.truckId.localeCompare(b.truckId));
  };

  const getPlaceholdersForTimeSlot = (timeSlotId) => {
    return dateFilteredPlaceholders.filter((p) => p.timeSlotId === timeSlotId).
      sort((a, b) => a.truckId.localeCompare(b.truckId));
  };

  const handleJobClick = (job) => {
    setSelectedJob(job);
    setJobDialogOpen(true);
  };

  const handlePlaceholderClick = (placeholder) => {
    // Only dispatchers and admins can edit placeholders
    if (currentUser?.role === 'admin' || currentUser?.appRole === 'dispatcher') {
      setSelectedPlaceholder(placeholder);
      setPlaceholderDialogOpen(true);
    }
  };

  const handleJobUpdated = () => {
    // Invalidate all relevant queries to trigger immediate refresh
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['assignments'] });
    queryClient.invalidateQueries({ queryKey: ['placeholders'] });
  };

  const handleManualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['assignments'] });
    queryClient.invalidateQueries({ queryKey: ['placeholders'] });
    toast({
      title: "Refreshing...",
      description: "Getting the latest job updates.",
    });
  };

  const getDateRangeLabel = () => {
    const date = new Date(selectedDate);
    if (viewMode === 'daily') {
      return format(date, 'EEEE, MMMM d, yyyy');
    } else if (viewMode === 'weekly') {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    } else {
      return format(date, 'MMMM yyyy');
    }
  };

  const getWeekDays = () => {
    const date = new Date(selectedDate);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    return eachDayOfInterval({
      start: weekStart,
      end: endOfWeek(date, { weekStartsOn: 1 })
    });
  };

  const getMonthDays = () => {
    const date = new Date(selectedDate);
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  };

  const getJobsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return filteredJobs.filter(job => job.requestedDate === dateStr);
  };

  const getStatsForDate = (date) => {
    const jobsForDate = getJobsForDate(date);
    const totalM2 = jobsForDate.reduce((sum, job) => sum + (job.sqm || 0), 0);
    return {
      count: jobsForDate.length,
      totalM2
    };
  };

  if (currentUser === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // MOBILE VIEW
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gray-50 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="bg-white border-b px-4 py-4 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-900">
              {currentUser?.appRole === 'customer' ? 'Scheduler' : 'Daily Job Board'}
            </h1>
            <div className="flex items-center gap-2">
              <DeliveryTypeLegend />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleManualRefresh}
                className="h-8 w-8 p-0"
                title="Refresh now"
              >
                <RefreshCw className={`h-4 w-4 ${jobsFetching ? 'animate-spin' : ''}`} />
              </Button>
              {(currentUser?.role === 'admin' || currentUser?.appRole === 'dispatcher') && (
                <Button size="sm" onClick={() => setCreateJobOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Job
                </Button>
              )}
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center justify-center gap-1 mb-3 bg-gray-100 rounded-lg p-1">
            <Button
              variant={viewMode === 'daily' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('daily')}
              className="flex-1"
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Daily
            </Button>
            <Button
              variant={viewMode === 'weekly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('weekly')}
              className="flex-1"
            >
              <CalendarDays className="h-4 w-4 mr-1" />
              Weekly
            </Button>
            <Button
              variant={viewMode === 'monthly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('monthly')}
              className="flex-1"
            >
              <CalendarRange className="h-4 w-4 mr-1" />
              Monthly
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2 mb-2">
            <Button variant="ghost" size="icon" onClick={goToPrevious} className="h-9 w-9">
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <div className="flex-1 text-center">
              <p className="text-sm font-semibold text-gray-900">{getDateRangeLabel()}</p>
            </div>

            <Button variant="ghost" size="icon" onClick={goToNext} className="h-9 w-9">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={goToToday} className="w-full">
            Today
          </Button>

          {jobsFetching && (
            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-blue-600">
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span>Live updates active</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : viewMode === 'daily' ? (
          <div className="px-4 py-4 pb-24">
            <div className="space-y-4">
              {TIME_SLOTS.map((slot) => {
                const slotJobs = getJobsForTimeSlot(slot.id);
                const slotPlaceholders = getPlaceholdersForTimeSlot(slot.id);
                const totalItemsInSlot = slotJobs.length + slotPlaceholders.length;

                return (
                  <Card key={slot.id} className={`${slot.color} border-2`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-indigo-600" />
                          <span>{slot.label}</span>
                        </span>
                        <Badge variant="secondary" className="bg-white">
                          {totalItemsInSlot} {totalItemsInSlot === 1 ? 'item' : 'items'}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3" style={{ touchAction: 'pan-y' }}>
                        {totalItemsInSlot === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">No jobs or placeholders scheduled</p>
                        ) : (
                          <>
                            {(() => {
                              const truckOrder = ['ACCO1', 'ACCO2', 'FUSO', 'ISUZU', 'UD'];
                              const jobsWithPos = slotJobs.map(job => ({
                                item: job,
                                truckId: job.truckId,
                                slotPosition: job.slotPosition || 1,
                                isPlaceholder: false
                              }));
                              const placeholdersWithPos = slotPlaceholders.map(p => ({
                                item: p,
                                truckId: p.truckId,
                                slotPosition: p.slotPosition || 1,
                                isPlaceholder: true
                              }));

                              return [...jobsWithPos, ...placeholdersWithPos]
                                .sort((a, b) => {
                                  const truckA = truckOrder.indexOf(a.truckId);
                                  const truckB = truckOrder.indexOf(b.truckId);
                                  if (truckA !== truckB) return truckA - truckB;
                                  return a.slotPosition - b.slotPosition;
                                })
                                .map(({ item, isPlaceholder }) => {
                                  if (isPlaceholder) {
                                    const placeholder = item;
                                    const colorScheme = COLOR_OPTIONS[placeholder.color] || COLOR_OPTIONS.gray;
                                    const canEdit = currentUser?.role === 'admin' || currentUser?.appRole === 'dispatcher';
                                    return (
                                      <div
                                        key={placeholder.id}
                                        onClick={() => handlePlaceholderClick(placeholder)}
                                        className={`p-3 rounded-lg border-2 ${colorScheme.bg} ${colorScheme.border} ${canEdit ? 'cursor-pointer active:opacity-80 transition-all' : ''}`}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2">
                                            <Package className={`h-4 w-4 ${colorScheme.text}`} />
                                            <span className={`font-medium text-sm ${colorScheme.text}`}>
                                              {placeholder.label}
                                            </span>
                                          </div>
                                          {placeholder.truckId && (
                                            <Badge variant="outline" className="text-xs bg-white/90 text-gray-700 border-gray-400">
                                              <Truck className="h-3 w-3 mr-1" />
                                              {placeholder.truckId}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }

                                  const job = item.job;
                                  const deliveryType = deliveryTypes.find(dt => dt.id === job.deliveryTypeId);
                                  const pickupShortname = job.pickupLocation?.shortname;
                                  const cardStyles = getJobCardInlineStyles(deliveryType, job);
                                  const badgeStyles = getBadgeStyles(getJobCardStyles(deliveryType, job));

                                  return (
                                    <div
                                      key={job.id}
                                      onClick={() => {
                                        setSelectedJob(job);
                                        setJobDialogOpen(true);
                                      }}
                                      className="p-3 rounded-lg border-2 active:opacity-80 transition-all cursor-pointer"
                                      style={{
                                        ...cardStyles,
                                        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                                      }}
                                      onTouchStart={(e) => {
                                        const rgb = cardStyles['--card-color-rgb'];
                                        if (rgb) {
                                          e.currentTarget.style.backgroundColor = `rgba(${rgb}, 0.08)`;
                                        }
                                      }}
                                      onTouchEnd={(e) => {
                                        const rgb = cardStyles['--card-color-rgb'];
                                        if (rgb) {
                                          e.currentTarget.style.backgroundColor = `rgba(${rgb}, 0.06)`;
                                        }
                                      }}
                                      aria-label={`${deliveryType?.name || 'Standard'} delivery for ${job.customerName}`}
                                    >
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                          <Truck className="h-4 w-4 flex-shrink-0 text-gray-700" />
                                          <Badge 
                                            variant="outline" 
                                            className="text-xs bg-white/90 text-gray-900"
                                            style={{ borderColor: cardStyles.borderColor }}
                                          >
                                            {item.assignment.truckId}
                                          </Badge>
                                        </div>
                                        <div className="flex flex-col gap-1 items-end">
                                          {deliveryType?.code && (
                                            <span 
                                              className="px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 shadow-sm"
                                              style={badgeStyles}
                                            >
                                              {getJobCardStyles(deliveryType, job).icon && (
                                                <span className="text-sm">{getJobCardStyles(deliveryType, job).icon}</span>
                                              )}
                                              {deliveryType.code}
                                            </span>
                                          )}
                                          {pickupShortname && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">
                                              {pickupShortname}
                                            </span>
                                          )}
                                          {job.sqm && (
                                            <Badge variant="outline" className="text-xs bg-white/90 text-gray-900">
                                              {job.sqm.toLocaleString()}m²
                                            </Badge>
                                          )}
                                          {job.totalUnits && (
                                            <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-300">
                                              {job.totalUnits} units
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="font-semibold text-sm text-gray-900">
                                          {job.customerName}
                                        </p>
                                        <p className="text-sm text-gray-700">
                                          {job.deliveryLocation}
                                        </p>
                                        <p className="text-xs text-gray-600">
                                          {job.deliveryTypeName}
                                        </p>
                                        {job.siteContactName && (
                                          <p className="text-xs flex items-center gap-1 mt-2 text-gray-600">
                                            <User className="h-3 w-3" />
                                            {job.siteContactName} - {job.siteContactPhone}
                                          </p>
                                        )}
                                        {job.status === 'IN_TRANSIT' && (
                                          <Badge className="bg-blue-600 text-white text-xs mt-2 animate-pulse">
                                            <Truck className="h-3 w-3 mr-1" />
                                            IN TRANSIT
                                          </Badge>
                                        )}
                                        {job.driverStatus === 'EN_ROUTE' && (
                                          <Badge className="bg-indigo-600 text-white text-xs mt-2">
                                            <Truck className="h-3 w-3 mr-1" />
                                            EN ROUTE
                                          </Badge>
                                        )}
                                        {job.driverStatus === 'ARRIVED' && (
                                          <Badge className="bg-purple-600 text-white text-xs mt-2">
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            ARRIVED
                                          </Badge>
                                        )}
                                        {job.driverStatus === 'UNLOADING' && (
                                          <Badge className="bg-orange-600 text-white text-xs mt-2 animate-pulse">
                                            <Package className="h-3 w-3 mr-1" />
                                            UNLOADING
                                          </Badge>
                                        )}
                                        {job.driverStatus === 'PROBLEM' && (
                                          <Badge className="bg-red-600 text-white text-xs mt-2">
                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                            PROBLEM
                                          </Badge>
                                        )}
                                        {job.status === 'DELIVERED' && (
                                          <Badge className="bg-green-600 text-white text-xs mt-2">
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            DELIVERED
                                          </Badge>
                                        )}
                                        {(job.status === 'RETURNED' || job.isReturned) && (
                                          <Badge className="bg-black text-white text-xs mt-2">
                                            <ArrowLeft className="h-3 w-3 mr-1" />
                                            RETURNED
                                          </Badge>
                                        )}
                                        {job.podNotes && job.podNotes.trim().length > 0 && (
                                          <Badge className="bg-blue-500 text-white text-xs mt-2">
                                            <AlertTriangle className="h-3 w-3 mr-1" />POD Notes
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  );
                                });
                            })()}
                            </>
                            )}
                            </div>
                            </CardContent>
                            </Card>
                            );
                            })}
                            </div>
                            </div>
                            ) : viewMode === 'weekly' ? (
                            <div className="px-4 py-4 pb-24">
                            <div className="space-y-4">
                            {getWeekDays().map((day) => {
                            const dayJobs = getJobsForDate(day);
                            const isToday = isSameDay(day, new Date());

                            return (
                            <Card key={format(day, 'yyyy-MM-dd')} className={isToday ? 'border-blue-500 border-2' : ''}>
                            <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center justify-between">
                            <span className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-indigo-600" />
                            <span>{format(day, 'EEEE, MMM d')}</span>
                            {isToday && <Badge variant="default" className="ml-2">Today</Badge>}
                            </span>
                            <Badge variant="secondary" className="bg-white">
                            {dayJobs.length} {dayJobs.length === 1 ? 'job' : 'jobs'}
                            </Badge>
                            </CardTitle>
                            </CardHeader>
                            <CardContent>
                            <div className="space-y-3">
                            {dayJobs.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">No deliveries scheduled</p>
                            ) : (
                            dayJobs.map((job) => {
                            const deliveryType = deliveryTypes.find(dt => dt.id === job.deliveryTypeId);
                            const cardStyles = getJobCardInlineStyles(deliveryType, job);
                            const badgeStyles = getBadgeStyles(getJobCardStyles(deliveryType, job));

                            return (
                             <div
                               key={job.id}
                               onClick={() => {
                                 setSelectedJob(job);
                                 setJobDialogOpen(true);
                               }}
                               className="p-3 rounded-lg border-2 cursor-pointer transition-all"
                               style={cardStyles}
                             >
                               <div className="flex justify-between items-start gap-2">
                                 <div className="flex-1">
                                   {deliveryType?.code && (
                                     <span className="px-1.5 py-0.5 rounded text-[10px] font-bold mb-1 inline-block" style={badgeStyles}>
                                       {deliveryType.code}
                                     </span>
                                   )}
                                   <p className="font-semibold text-sm">{job.customerName}</p>
                                   <p className="text-xs text-gray-600">{job.deliveryLocation}</p>
                                   {job.deliveryWindow && (
                                     <p className="text-xs text-gray-500 mt-1">{job.deliveryWindow}</p>
                                   )}
                                 </div>
                                 {job.sqm && (
                                   <Badge variant="outline" className="text-xs">{job.sqm}m²</Badge>
                                 )}
                               </div>
                             </div>
                            );
                            })
                            )}
                            </div>
                            </CardContent>
                            </Card>
                            );
                            })}
                            </div>
                            </div>
                            ) : (
                            <div className="px-4 py-4 pb-24">
                            <div className="grid grid-cols-7 gap-2 mb-2">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                            <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
                            {day}
                            </div>
                            ))}
                            </div>

                            <div className="grid grid-cols-7 gap-2">
                            {(() => {
                            const monthStart = startOfMonth(new Date(selectedDate));
                            const monthEnd = endOfMonth(new Date(selectedDate));
                            const startDay = startOfWeek(monthStart, { weekStartsOn: 1 });
                            const endDay = endOfWeek(monthEnd, { weekStartsOn: 1 });
                            const allDays = eachDayOfInterval({ start: startDay, end: endDay });

                            return allDays.map((day) => {
                            const isCurrentMonth = day.getMonth() === new Date(selectedDate).getMonth();
                            const isToday = isSameDay(day, new Date());
                            const stats = getStatsForDate(day);
                            const hasJobs = stats.count > 0;

                            return (
                            <div
                            key={format(day, 'yyyy-MM-dd')}
                            className={`
                            group relative aspect-square border rounded-lg p-2 transition-all
                            ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white hover:bg-gray-50'}
                            ${isToday ? 'border-blue-500 border-2 bg-blue-50' : 'border-gray-200'}
                            ${hasJobs ? 'cursor-pointer hover:shadow-lg' : ''}
                            `}
                            onClick={() => {
                            if (hasJobs) {
                            setSelectedDate(format(day, 'yyyy-MM-dd'));
                            setViewMode('daily');
                            }
                            }}
                            >
                            <div className="text-xs font-medium">{format(day, 'd')}</div>
                            {hasJobs && (
                            <>
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-1 opacity-0 group-hover:opacity-100 bg-white/95 rounded-lg transition-opacity z-10">
                            <div className="text-xs font-semibold text-gray-900">{stats.count} jobs</div>
                            <div className="text-xs text-gray-600">{stats.totalM2.toFixed(0)}m²</div>
                            </div>
                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                            </div>
                            </>
                            )}
                            </div>
                            );
                            });
                            })()}
                            </div>
                            </div>
                            )}

                            <JobDetailsDialog
          job={selectedJob}
          open={isJobDialogOpen}
          onOpenChange={setJobDialogOpen}
          onJobUpdated={handleJobUpdated}
        />

        <CreateJobForm
          open={createJobOpen}
          onOpenChange={setCreateJobOpen}
          onJobCreated={handleJobUpdated}
          customers={customers}
          deliveryTypes={deliveryTypes}
        />

        {selectedPlaceholder && (
          <Dialog open={isPlaceholderDialogOpen} onOpenChange={setPlaceholderDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Placeholder</DialogTitle>
              </DialogHeader>
              <EditPlaceholderForm
                placeholder={selectedPlaceholder}
                onSaved={() => {
                  setPlaceholderDialogOpen(false);
                  handleJobUpdated();
                }}
                onCancel={() => setPlaceholderDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  // DESKTOP VIEW
  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {currentUser?.appRole === 'customer' ? 'Scheduler' : 'Daily Job Board'}
            </h1>
            <p className="text-gray-600 mt-1">{getDateRangeLabel()}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <Button
                variant={viewMode === 'daily' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('daily')}
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Daily
              </Button>
              <Button
                variant={viewMode === 'weekly' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('weekly')}
              >
                <CalendarDays className="h-4 w-4 mr-1" />
                Weekly
              </Button>
              <Button
                variant={viewMode === 'monthly' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('monthly')}
              >
                <CalendarRange className="h-4 w-4 mr-1" />
                Monthly
              </Button>
            </div>
            
            <DeliveryTypeLegend />
            {jobsFetching && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Live</span>
              </div>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleManualRefresh}
              title="Refresh now"
            >
              <RefreshCw className={`h-4 w-4 ${jobsFetching ? 'animate-spin' : ''}`} />
            </Button>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
              <Button variant="ghost" size="icon" onClick={goToPrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button variant="ghost" size="icon" onClick={goToNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {(currentUser?.role === 'admin' || currentUser?.appRole === 'dispatcher') && (
              <Button size="sm" onClick={() => setCreateJobOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Job
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : viewMode === 'daily' ? (
          <div className="px-4 md:px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TIME_SLOTS.map((slot) => {
                const slotJobs = getJobsForTimeSlot(slot.id);
                const slotPlaceholders = getPlaceholdersForTimeSlot(slot.id);
                const totalItemsInSlot = slotJobs.length + slotPlaceholders.length;

                return (
                  <Card key={slot.id} className={`${slot.color}`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-indigo-600" />
                          <span>{slot.label}</span>
                        </span>
                        <Badge variant="secondary" className="bg-white">
                          {totalItemsInSlot} {totalItemsInSlot === 1 ? 'item' : 'items'}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {totalItemsInSlot === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No jobs or placeholders scheduled</p>
                      ) : (
                        <>
                          {(() => {
                            const truckOrder = ['ACCO1', 'ACCO2', 'FUSO', 'ISUZU', 'UD'];
                            const jobsWithPos = slotJobs.map(job => ({
                              item: job,
                              truckId: job.truckId,
                              slotPosition: job.slotPosition || 1,
                              isPlaceholder: false
                            }));
                            const placeholdersWithPos = slotPlaceholders.map(p => ({
                              item: p,
                              truckId: p.truckId,
                              slotPosition: p.slotPosition || 1,
                              isPlaceholder: true
                            }));

                            return [...jobsWithPos, ...placeholdersWithPos]
                              .sort((a, b) => {
                                const truckA = truckOrder.indexOf(a.truckId);
                                const truckB = truckOrder.indexOf(b.truckId);
                                if (truckA !== truckB) return truckA - truckB;
                                return a.slotPosition - b.slotPosition;
                              })
                              .map(({ item, isPlaceholder }) => {
                                if (isPlaceholder) {
                                  const placeholder = item;
                                  const colorScheme = COLOR_OPTIONS[placeholder.color] || COLOR_OPTIONS.gray;
                                  const canEdit = currentUser?.role === 'admin' || currentUser?.appRole === 'dispatcher';
                                  return (
                                    <div
                                      key={placeholder.id}
                                      onClick={() => handlePlaceholderClick(placeholder)}
                                      className={`p-3 rounded-lg border-2 ${colorScheme.bg} ${colorScheme.border} ${canEdit ? 'cursor-pointer hover:opacity-90 transition-all' : ''}`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <Package className={`h-4 w-4 ${colorScheme.text}`} />
                                          <span className={`font-medium text-sm ${colorScheme.text}`}>
                                            {placeholder.label}
                                          </span>
                                        </div>
                                        {placeholder.truckId && (
                                          <Badge variant="outline" className="text-xs bg-white/90 text-gray-700 border-gray-400">
                                            <Truck className="h-3 w-3 mr-1" />
                                            {placeholder.truckId}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }

                                const job = item.job;
                                const deliveryType = deliveryTypes.find(dt => dt.id === job.deliveryTypeId);
                                const pickupShortname = job.pickupLocation?.shortname;
                                const cardStyles = getJobCardInlineStyles(deliveryType, job);
                                const badgeStyles = getBadgeStyles(getJobCardStyles(deliveryType, job));

                                return (
                                  <div
                                    key={job.id}
                                    onClick={() => handleJobClick(job)}
                                    className="p-3 rounded-lg border-2 cursor-pointer transition-all"
                                    style={{
                                      ...cardStyles,
                                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                                    }}
                                    onMouseEnter={(e) => {
                                      const rgb = cardStyles['--card-color-rgb'];
                                      if (rgb) {
                                        e.currentTarget.style.backgroundColor = `rgba(${rgb}, 0.10)`;
                                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      const rgb = cardStyles['--card-color-rgb'];
                                      if (rgb) {
                                        e.currentTarget.style.backgroundColor = `rgba(${rgb}, 0.06)`;
                                        e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                                      }
                                    }}
                                    aria-label={`${deliveryType?.name || 'Standard'} delivery for ${job.customerName}`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Truck className="h-4 w-4 flex-shrink-0 text-gray-700" />
                                          <Badge 
                                            variant="outline" 
                                            className="text-xs bg-white/90 text-gray-900"
                                            style={{ borderColor: cardStyles.borderColor }}
                                          >
                                            {item.assignment.truckId}
                                          </Badge>
                                        </div>
                                        {deliveryType?.code && (
                                          <div className="mb-1">
                                            <span 
                                              className="px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-0.5 shadow-sm"
                                              style={badgeStyles}
                                            >
                                              {getJobCardStyles(deliveryType, job).icon && (
                                                <span className="text-sm">{getJobCardStyles(deliveryType, job).icon}</span>
                                              )}
                                              {deliveryType.code}
                                            </span>
                                          </div>
                                        )}
                                        <h4 className="font-semibold text-sm mb-0.5 text-gray-900">
                                          {job.customerName}
                                        </h4>
                                        <p className="text-xs truncate text-gray-700">
                                          {job.deliveryLocation}
                                        </p>
                                        <p className="text-xs mt-0.5 text-gray-600">
                                          {job.deliveryTypeName}
                                        </p>
                                      </div>
                                      <div className="flex flex-col gap-1 items-end flex-shrink-0">
                                        {job.sqm && (
                                          <Badge variant="outline" className="text-xs bg-white/90 text-gray-900">
                                            {job.sqm.toLocaleString()}m²
                                          </Badge>
                                        )}
                                        {job.totalUnits && (
                                          <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-300">
                                            {job.totalUnits} units
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    {job.siteContactName && (
                                      <p className="text-xs flex items-center gap-1 mt-2 text-gray-600">
                                        <User className="h-3 w-3" />
                                        {job.siteContactName} - {job.siteContactPhone}
                                      </p>
                                    )}
                                    {job.status === 'IN_TRANSIT' && (
                                      <Badge className="bg-blue-600 text-white text-xs mt-2 animate-pulse">
                                        <Truck className="h-3 w-3 mr-1" />
                                        IN TRANSIT
                                      </Badge>
                                    )}
                                    {job.driverStatus === 'EN_ROUTE' && (
                                      <Badge className="bg-indigo-600 text-white text-xs mt-2">
                                        <Truck className="h-3 w-3 mr-1" />
                                        EN ROUTE
                                      </Badge>
                                    )}
                                    {job.driverStatus === 'ARRIVED' && (
                                      <Badge className="bg-purple-600 text-white text-xs mt-2">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        ARRIVED
                                      </Badge>
                                    )}
                                    {job.driverStatus === 'UNLOADING' && (
                                      <Badge className="bg-orange-600 text-white text-xs mt-2 animate-pulse">
                                        <Package className="h-3 w-3 mr-1" />
                                        UNLOADING
                                      </Badge>
                                    )}
                                    {job.driverStatus === 'PROBLEM' && (
                                      <Badge className="bg-red-600 text-white text-xs mt-2">
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        PROBLEM
                                      </Badge>
                                    )}
                                    {job.status === 'DELIVERED' && (
                                      <Badge className="bg-green-600 text-white text-xs mt-2">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        DELIVERED
                                      </Badge>
                                    )}
                                    {(job.status === 'RETURNED' || job.isReturned) && (
                                      <Badge className="bg-black text-white text-xs mt-2">
                                        <ArrowLeft className="h-3 w-3 mr-1" />
                                        RETURNED
                                      </Badge>
                                    )}
                                    {job.podNotes && job.podNotes.trim().length > 0 && (
                                      <Badge className="bg-blue-500 text-white text-xs mt-2">
                                        <AlertTriangle className="h-3 w-3 mr-1" />POD Notes
                                      </Badge>
                                    )}
                                  </div>
                                );
                              });
                          })()}
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : viewMode === 'weekly' ? (
          <div className="px-4 md:px-6 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
              {getWeekDays().map((day) => {
                const dayJobs = getJobsForDate(day);
                const isToday = isSameDay(day, new Date());
                
                return (
                  <Card key={format(day, 'yyyy-MM-dd')} className={isToday ? 'border-blue-500 border-2' : ''}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">
                        <div className="flex flex-col items-center">
                          <span className="font-semibold">{format(day, 'EEE')}</span>
                          <span className="text-xl font-bold">{format(day, 'd')}</span>
                          {isToday && <Badge variant="default" className="mt-1 text-xs">Today</Badge>}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {dayJobs.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-2">No jobs</p>
                      ) : (
                        dayJobs.map((job) => {
                          const deliveryType = deliveryTypes.find(dt => dt.id === job.deliveryTypeId);
                          const cardStyles = getJobCardInlineStyles(deliveryType, job);
                          
                          return (
                            <div
                              key={job.id}
                              onClick={() => {
                                setSelectedJob(job);
                                setJobDialogOpen(true);
                              }}
                              className="p-2 rounded border cursor-pointer hover:shadow-md transition-all text-xs"
                              style={cardStyles}
                            >
                              <p className="font-semibold truncate">{job.customerName}</p>
                              {job.sqm && (
                                <p className="text-gray-600">{job.sqm}m²</p>
                              )}
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="px-4 md:px-6 py-6">
            <div className="max-w-5xl mx-auto">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                  <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                    {day.substring(0, 3)}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-2">
                {(() => {
                  const monthStart = startOfMonth(new Date(selectedDate));
                  const monthEnd = endOfMonth(new Date(selectedDate));
                  const startDay = startOfWeek(monthStart, { weekStartsOn: 1 });
                  const endDay = endOfWeek(monthEnd, { weekStartsOn: 1 });
                  const allDays = eachDayOfInterval({ start: startDay, end: endDay });
                  
                  return allDays.map((day) => {
                    const isCurrentMonth = day.getMonth() === new Date(selectedDate).getMonth();
                    const isToday = isSameDay(day, new Date());
                    const stats = getStatsForDate(day);
                    const hasJobs = stats.count > 0;
                    
                    return (
                      <div
                        key={format(day, 'yyyy-MM-dd')}
                        className={`
                          group relative aspect-square border rounded-lg p-3 transition-all
                          ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white hover:bg-gray-50'}
                          ${isToday ? 'border-blue-500 border-2 bg-blue-50' : 'border-gray-200'}
                          ${hasJobs ? 'cursor-pointer hover:shadow-lg' : ''}
                        `}
                        onClick={() => {
                          if (hasJobs) {
                            setSelectedDate(format(day, 'yyyy-MM-dd'));
                            setViewMode('daily');
                          }
                        }}
                      >
                        <div className="text-sm font-medium">{format(day, 'd')}</div>
                        {hasJobs && (
                          <>
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-2 opacity-0 group-hover:opacity-100 bg-white/98 rounded-lg transition-opacity z-10">
                              <div className="text-sm font-semibold text-gray-900">{stats.count} {stats.count === 1 ? 'job' : 'jobs'}</div>
                              <div className="text-sm text-gray-600">{stats.totalM2.toFixed(0)}m² total</div>
                            </div>
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                                <span className="text-xs font-medium text-gray-600">{stats.count}</span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      <JobDetailsDialog
        job={selectedJob}
        open={isJobDialogOpen}
        onOpenChange={setJobDialogOpen}
        onJobUpdated={handleJobUpdated}
      />

      <CreateJobForm
        open={createJobOpen}
        onOpenChange={setCreateJobOpen}
        onJobCreated={handleJobUpdated}
        customers={customers}
        deliveryTypes={deliveryTypes}
      />

      {selectedPlaceholder && (
        <Dialog open={isPlaceholderDialogOpen} onOpenChange={setPlaceholderDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Placeholder</DialogTitle>
            </DialogHeader>
            <EditPlaceholderForm
              placeholder={selectedPlaceholder}
              onSaved={() => {
                setPlaceholderDialogOpen(false);
                handleJobUpdated();
              }}
              onCancel={() => setPlaceholderDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}