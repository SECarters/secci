import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, User, Truck, Clock, AlertTriangle, Plus, CheckCircle2, Package, RefreshCw, ArrowLeft } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
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

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filter out cancelled jobs for all users - include RETURNED status
  const { data: jobs = [], isLoading: jobsLoading, isFetching: jobsFetching } = useQuery({
    queryKey: ['jobs', 'realtime'],
    queryFn: () => base44.entities.Job.filter({ 
      status: { $in: ['PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'DELIVERED', 'RETURNED'] }
    }),
    staleTime: 0,
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['assignments', 'realtime'],
    queryFn: () => base44.entities.Assignment.list(),
    staleTime: 0,
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

  const goToPreviousDay = () => {
    const newDate = subDays(new Date(selectedDate), 1);
    setSelectedDate(format(newDate, 'yyyy-MM-dd'));
  };

  const goToNextDay = () => {
    const newDate = addDays(new Date(selectedDate), 1);
    setSelectedDate(format(newDate, 'yyyy-MM-dd'));
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
            <h1 className="text-xl font-bold text-gray-900">Daily Job Board</h1>
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

          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="icon" onClick={goToPreviousDay} className="h-9 w-9">
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg flex-1 justify-center">
              <Calendar className="h-4 w-4 text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border-none bg-transparent text-sm font-medium focus:outline-none text-center"
              />
            </div>

            <Button variant="ghost" size="icon" onClick={goToNextDay} className="h-9 w-9">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={goToToday} className="w-full mt-2">
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
        ) : (
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
            <h1 className="text-3xl font-bold text-gray-900">Daily Job Board</h1>
            <p className="text-gray-600 mt-1">View all scheduled deliveries for the day</p>
          </div>
          <div className="flex items-center gap-3">
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
              <Button variant="ghost" size="icon" onClick={goToPreviousDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 px-3">
                <Calendar className="h-4 w-4 text-gray-500" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border-none bg-transparent text-sm font-medium focus:outline-none"
                />
              </div>
              <Button variant="ghost" size="icon" onClick={goToNextDay}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
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
        ) : (
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