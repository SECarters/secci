import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Calendar, Plus, Package, Truck, Clock, AlertTriangle, Bell, CalendarClock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, addDays, subDays, startOfDay } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import SchedulerGrid from '../components/scheduling/SchedulerGrid';
import CreateJobForm from '../components/scheduling/CreateJobForm';
import JobDetailsDialog from '../components/scheduling/JobDetailsDialog';
import CreatePlaceholderDialog from '../components/scheduling/CreatePlaceholderDialog';
import ScheduleJobDialog from '../components/scheduling/ScheduleJobDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { getJobCardInlineStyles, getBadgeStyles, getJobCardStyles } from '../components/scheduling/DeliveryTypeColorUtils';
import EditPlaceholderForm from '../components/scheduling/EditPlaceholderForm';


const TRUCKS = [
  { id: 'ACCO1', name: 'ACCO1', capacity: 14 },
  { id: 'ACCO2', name: 'ACCO2', capacity: 14 },
  { id: 'FUSO', name: 'FUSO', capacity: 9 },
  { id: 'ISUZU', name: 'ISUZU', capacity: 9 },
  { id: 'UD', name: 'UD', capacity: 9 }
];

const TIME_SLOTS = [
  { id: 'first-am', label: '6-8am (1st AM)' },
  { id: 'second-am', label: '8-10am (2nd AM)' },
  { id: 'lunch', label: '10am-12pm (LUNCH)' },
  { id: 'first-pm', label: '12-2pm (1st PM)' },
  { id: 'second-pm', label: '2-4pm (2nd PM)' },
];

export default function SchedulingBoard() {
  const [jobs, setJobs] = useState([]);
  const [allUnscheduledJobs, setAllUnscheduledJobs] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [placeholders, setPlaceholders] = useState([]);
  const [deliveryTypes, setDeliveryTypes] = useState([]);
  const [pickupLocations, setPickupLocations] = useState([]);
  
  // Get initial date from URL or default to today
  const [selectedDate, setSelectedDate] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    if (dateParam) {
      try {
        const date = new Date(dateParam);
        if (!isNaN(date.getTime())) {
          return dateParam;
        }
      } catch (e) {
        // Invalid date, use today
      }
    }
    return format(new Date(), 'yyyy-MM-dd');
  });
  
  const [loading, setLoading] = useState(true);
  const [isCreateJobOpen, setCreateJobOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isJobDialogOpen, setJobDialogOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [createPlaceholderOpen, setCreatePlaceholderOpen] = useState(false);
  const [placeholderSlot, setPlaceholderSlot] = useState(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [jobToSchedule, setJobToSchedule] = useState(null);

  const [notificationReadStatus, setNotificationReadStatus] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState([]);
  const [readNotifications, setReadNotifications] = useState([]);

  const { toast } = useToast();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };
    loadUser();
  }, []);

  const fetchData = useCallback(async () => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.appRole !== 'dispatcher')) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const date = startOfDay(new Date(selectedDate));
      
      const [allAvailableJobs, todaysAssignments, allDeliveryTypes, todaysPlaceholders, readStatusList, allPickupLocations] = await Promise.all([
        base44.entities.Job.filter({ 
          status: { $in: ['PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'DELIVERED', 'RETURNED'] }
        }),
        base44.entities.Assignment.filter({ date: format(date, 'yyyy-MM-dd') }),
        base44.entities.DeliveryType.list(),
        base44.entities.Placeholder.filter({ date: format(date, 'yyyy-MM-dd') }),
        base44.entities.NotificationReadStatus.filter({ userId: currentUser.id }),
        base44.entities.PickupLocation.list()
      ]);

      const currentTenant = currentUser.tenantId || 'plasterboard_dispatch';
      let visibleJobs = [...allAvailableJobs];

      if (currentTenant === 'outreach_hire') {
        const manitouCodes = ['UPDWN', 'UNITUP', 'MANS'];
        const manitouTypeIds = allDeliveryTypes
          .filter(dt => manitouCodes.includes(dt.code))
          .map(dt => dt.id);
        
        visibleJobs = visibleJobs.filter(job => 
          job.requiresManitou || 
          manitouTypeIds.includes(job.deliveryTypeId)
        );
      } else {
        visibleJobs = visibleJobs.filter(job => 
          !job.tenantId ||
          job.tenantId === 'plasterboard_dispatch' || 
          job.category === 'Plasterboard'
        );
      }

      setJobs(visibleJobs);
      setAssignments(todaysAssignments);
      setDeliveryTypes(allDeliveryTypes);
      setPlaceholders(todaysPlaceholders);
      setNotificationReadStatus(readStatusList);
      setPickupLocations(allPickupLocations);

      const assignedJobIds = new Set(visibleJobs.filter(j => 
        j.status === 'SCHEDULED' || 
        j.status === 'DELIVERED'
      ).map(j => j.id));
      
      const unscheduled = visibleJobs.filter(job => 
        !assignedJobIds.has(job.id) && 
        (job.status === 'APPROVED' || job.status === 'PENDING_APPROVAL')
      );
      
      const notificationJobs = [...unscheduled];
      
      const readJobIds = new Set(readStatusList.map(r => r.jobId));
      const unread = notificationJobs.filter(job => !readJobIds.has(job.id));
      const read = notificationJobs.filter(job => readJobIds.has(job.id));
      
      setUnreadNotifications(unread);
      setReadNotifications(read);
      setAllUnscheduledJobs(notificationJobs);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, currentUser]);

  useEffect(() => {
    if (currentUser && (currentUser.role === 'admin' || currentUser.appRole === 'dispatcher')) {
      fetchData();
    }
  }, [fetchData, currentUser]);



  const updateDateInUrl = (date) => {
    const url = new URL(window.location.href);
    url.searchParams.set('date', date);
    window.history.replaceState({}, '', url);
  };

  const goToPreviousDay = () => {
    const newDate = format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd');
    setSelectedDate(newDate);
    updateDateInUrl(newDate);
  };

  const goToNextDay = () => {
    const newDate = format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd');
    setSelectedDate(newDate);
    updateDateInUrl(newDate);
  };

  const goToToday = () => {
    const newDate = format(new Date(), 'yyyy-MM-dd');
    setSelectedDate(newDate);
    updateDateInUrl(newDate);
  };

  const handleOpenPlaceholderDialog = (truckId, timeSlotId, requestedSlotPosition) => {
    const finalSlotPosition = requestedSlotPosition <= 2 ? 1 : 3;

    setPlaceholderSlot({ truckId, timeSlotId, slotPosition: finalSlotPosition });
    setCreatePlaceholderOpen(true);
  };

  const handleJobClick = (job) => {
    setSelectedJob(job);
    setJobDialogOpen(true);
  };

  const getUnscheduledJobsForDate = () => {
    const assignedJobIds = new Set(assignments.map(a => a.jobId));
    return jobs.filter(job => 
      !assignedJobIds.has(job.id) && 
      (job.status === 'APPROVED' || job.status === 'PENDING_APPROVAL') &&
      job.requestedDate === selectedDate
    );
  };

  const getJobsForTruck = (truckId) => {
    const truckAssignments = assignments.filter(a => a.truckId === truckId);
    return truckAssignments.map(a => ({
      job: jobs.find(j => j.id === a.jobId),
      timeSlot: a.timeSlotId,
      slotPosition: a.slotPosition,
      assignment: a
    })).filter(item => item.job);
  };

  const getTruckUtilization = (truckId) => {
    const truckJobs = getJobsForTruck(truckId);
    const truckPlaceholders = placeholders.filter(p => p.truckId === truckId);
    
    const jobSqm = truckJobs.reduce((sum, item) => sum + (item.job?.sqm || 0), 0);
    const placeholderSqm = truckPlaceholders.reduce((sum, item) => sum + (item.sqm || 0), 0);
    
    return jobSqm + placeholderSqm;
  };

  const getPlaceholdersForTruck = (truckId) => {
    return placeholders.filter(p => p.truckId === truckId).map(p => ({
      placeholder: p,
      timeSlot: p.timeSlotId,
      slotPosition: p.slotPosition
    }));
  };

  const [selectedPlaceholder, setSelectedPlaceholder] = useState(null);
  const [isPlaceholderDialogOpen, setPlaceholderDialogOpen] = useState(false);

  const handlePlaceholderClick = (placeholder) => {
    setSelectedPlaceholder(placeholder);
    setPlaceholderDialogOpen(true);
  };

  const handleMarkAsRead = async (jobId) => {
    if (!currentUser) return;

    try {
      // Check if already marked as read
      const existingRead = notificationReadStatus.find(r => r.jobId === jobId && r.userId === currentUser.id);
      
      if (!existingRead) {
        // Create the read status in database
        await base44.entities.NotificationReadStatus.create({
          userId: currentUser.id,
          jobId: jobId,
          readAt: new Date().toISOString()
        });

        // Update local state immediately to move job from unread to read
        const job = unreadNotifications.find(j => j.id === jobId);
        if (job) {
          setUnreadNotifications(prev => prev.filter(j => j.id !== jobId));
          setReadNotifications(prev => [job, ...prev]);
          setNotificationReadStatus(prev => [...prev, { userId: currentUser.id, jobId, readAt: new Date().toISOString() }]);
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleJobFromNotification = async (job) => {
    // Mark as read first
    await handleMarkAsRead(job.id);
    
    // Then open the job details
    setSelectedJob(job);
    setJobDialogOpen(true);
    setNotificationOpen(false);
    
    // Navigate to the job's date if needed
    if (job.requestedDate) {
      setSelectedDate(job.requestedDate);
      updateDateInUrl(job.requestedDate);
    }
  };

  const handleDrop = async (draggedId, droppedOnId) => {
    if (!droppedOnId) return;

    const isPlaceholder = draggedId.startsWith('placeholder-');

    if (isPlaceholder) {
      const placeholderId = draggedId.replace('placeholder-', '');
      const placeholder = placeholders.find(p => p.id === placeholderId);
      
      if (!placeholder) return;

      if (droppedOnId === 'unscheduled') {
        try {
          await base44.entities.Placeholder.delete(placeholderId);
          await fetchData();
        } catch (error) {
          console.error('Error deleting placeholder:', error);
          toast({
            title: "Error",
            description: "Failed to remove placeholder. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        const parts = droppedOnId.split('-');
        const requestedSlotPosition = parseInt(parts[parts.length - 1]);
        const destinationTimeSlotId = parts.slice(1, parts.length - 1).join('-');
        const destinationTruckId = parts[0];

        const finalSlotPosition = requestedSlotPosition <= 2 ? 1 : 3;

        try {
          await base44.entities.Placeholder.update(placeholderId, {
            truckId: destinationTruckId,
            timeSlotId: destinationTimeSlotId,
            slotPosition: finalSlotPosition,
            date: selectedDate
          });
          await fetchData();
        } catch (error) {
          console.error('Error updating placeholder:', error);
          toast({
            title: "Error",
            description: "Failed to move placeholder. Please try again.",
            variant: "destructive",
          });
        }
      }
      return;
    }

    const jobId = draggedId;
    const sourceAssignment = assignments.find(a => a.jobId === jobId);
    const jobToUpdate = jobs.find(j => j.id === jobId);

    if (!jobToUpdate) return;

    if (droppedOnId === 'unscheduled') {
      if (sourceAssignment) {
        try {
          await base44.entities.Assignment.delete(sourceAssignment.id);
          await base44.entities.Job.update(jobId, { ...jobToUpdate, status: 'APPROVED' });
          await fetchData();
        } catch (error) {
          console.error('Error unscheduling job:', error);
          toast({
            title: "Error",
            description: "Failed to unschedule job. Please try again.",
            variant: "destructive",
          });
        }
      }
      return;
    }
    
    const parts = droppedOnId.split('-');
    const requestedSlotPosition = parseInt(parts[parts.length - 1]);
    const destinationTimeSlotId = parts.slice(1, parts.length - 1).join('-');
    const destinationTruckId = parts[0];
    
    const assignmentsExcludingCurrentJob = assignments.filter(a => a.jobId !== jobId);
    
    let finalSlotPosition;

    const isTargetingBlock1 = requestedSlotPosition <= 2;
    
    const primaryBlockStart = isTargetingBlock1 ? 1 : 3;
    const primaryBlockEnd = isTargetingBlock1 ? 2 : 4;

    const secondaryBlockStart = isTargetingBlock1 ? 3 : 1;
    const secondaryBlockEnd = isTargetingBlock1 ? 4 : 2;

    const primaryBlockOccupied = assignmentsExcludingCurrentJob.some(a => 
      a.truckId === destinationTruckId && 
      a.timeSlotId === destinationTimeSlotId && 
      a.slotPosition >= primaryBlockStart &&
      a.slotPosition <= primaryBlockEnd
    );

    if (!primaryBlockOccupied) {
      finalSlotPosition = primaryBlockStart;
    } else {
      const secondaryBlockOccupied = assignmentsExcludingCurrentJob.some(a => 
        a.truckId === destinationTruckId && 
        a.timeSlotId === destinationTimeSlotId && 
        a.slotPosition >= secondaryBlockStart &&
        a.slotPosition <= secondaryBlockEnd
      );

      if (!secondaryBlockOccupied) {
        finalSlotPosition = secondaryBlockStart;
      } else {
        toast({
          title: "Time Window Full",
          description: "Both delivery blocks in this time window are occupied. Please choose a different time or truck.",
          variant: "destructive",
        });
        return;
      }
    }
    
    try {
      if (sourceAssignment) {
        await base44.entities.Assignment.update(sourceAssignment.id, { 
          truckId: destinationTruckId, 
          timeSlotId: destinationTimeSlotId, 
          slotPosition: finalSlotPosition 
        });
      } else {
        await base44.entities.Assignment.create({
          jobId,
          truckId: destinationTruckId,
          timeSlotId: destinationTimeSlotId,
          slotPosition: finalSlotPosition,
          date: selectedDate,
        });
        await base44.entities.Job.update(jobId, { ...jobToUpdate, status: 'SCHEDULED' });
      }
      await fetchData();
    } catch (error) {
      console.error('Error scheduling job:', error);
      toast({
        title: "Error",
        description: "Failed to schedule job. Please try again.",
        variant: "destructive",
      });
    }
  };



  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Check if user can see notifications (admin or dispatcher only)
  const canSeeNotifications = currentUser.role === 'admin' || currentUser.appRole === 'dispatcher';

  // MOBILE VIEW
  if (isMobile) {
    return (
      <DndProvider backend={HTML5Backend}>
        <>
          <div className="min-h-screen bg-gray-50 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="bg-white border-b px-4 py-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold text-gray-900">Scheduling Board</h1>
              {canSeeNotifications && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setNotificationOpen(true)}
                  className="h-8 w-8 p-0"
                >
                  <div className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadNotifications.length > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold text-white">
                        {unreadNotifications.length}
                      </span>
                    )}
                  </div>
                </Button>
              )}
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
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    updateDateInUrl(e.target.value);
                  }}
                  className="border-none bg-transparent text-sm font-medium focus:outline-none text-center"
                />
              </div>

              <Button variant="ghost" size="icon" onClick={goToNextDay} className="h-9 w-9">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={goToToday} className="flex-1">
                Today
              </Button>
              <Button size="sm" onClick={() => setCreateJobOpen(true)} className="flex-1">
                <Plus className="h-4 w-4 mr-1" />
                Create Job
              </Button>
            </div>
            </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="px-4 py-4 pb-24">
              {allUnscheduledJobs.length > 0 && (
                  <Card className="bg-yellow-50 border-yellow-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-yellow-700" />
                          <span>Unscheduled Jobs</span>
                        </span>
                        <Badge variant="secondary" className="bg-yellow-200 text-yellow-900">
                          {allUnscheduledJobs.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {allUnscheduledJobs.map(job => {
                        const deliveryType = deliveryTypes.find(dt => dt.id === job.deliveryTypeId);
                        const pickupLocation = pickupLocations.find(loc => loc.id === job.pickupLocationId);
                        const pickupShortname = pickupLocation?.shortname;
                        const cardStyles = getJobCardInlineStyles(deliveryType, job);
                        const badgeStyles = getBadgeStyles(getJobCardStyles(deliveryType, job));
                        const textStyles = getJobCardStyles(deliveryType, job);

                        return (
                          <div
                            key={job.id}
                            className="p-3 rounded-lg border-2 active:bg-gray-50 transition-colors"
                            style={{
                              ...cardStyles,
                              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                            }}
                          >
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <div className="flex-1 min-w-0">
                                {(deliveryType?.code || pickupShortname) && (
                                  <div className="mb-1 flex gap-1 flex-wrap">
                                    {deliveryType?.code && (
                                      <span 
                                        className="px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 shadow-sm"
                                        style={badgeStyles}
                                      >
                                        {textStyles.icon && <span className="text-sm">{textStyles.icon}</span>}
                                        {deliveryType.code}
                                      </span>
                                    )}
                                    {pickupShortname && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">
                                        {pickupShortname}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <span className="font-semibold text-sm text-gray-900 block">{job.customerName}</span>
                              </div>
                              <div className="flex flex-col gap-1 items-end">
                                {job.sqm && (
                                  <Badge variant="secondary" className="text-[10px] bg-white/90 text-gray-900">
                                    {job.sqm}m²
                                  </Badge>
                                )}
                                {job.isDifficultDelivery && (
                                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-gray-600">{job.deliveryLocation}</p>
                            <p className="text-xs text-gray-500 mt-1">{job.deliveryTypeName}</p>
                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setJobToSchedule(job);
                                  setScheduleDialogOpen(true);
                                }}
                                className="flex-1"
                              >
                                <CalendarClock className="h-4 w-4 mr-1" />
                                Schedule
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedJob(job);
                                  setJobDialogOpen(true);
                                }}
                                className="flex-1"
                              >
                                View
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {TRUCKS.map(truck => {
                  const truckJobs = getJobsForTruck(truck.id);
                  const truckPlaceholders = getPlaceholdersForTruck(truck.id);
                  const totalSqm = getTruckUtilization(truck.id);
                  const utilizationPercent = Math.min((totalSqm / 2500) * 100, 100); 
                  
                  let barColor = 'bg-red-500';
                  if (totalSqm >= 1500) {
                    barColor = 'bg-green-500';
                  } else if (totalSqm >= 1000) {
                    barColor = 'bg-orange-500';
                  }

                  return (
                    <Card key={truck.id}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Truck className="h-5 w-5 text-blue-600" />
                            <span>{truck.name}</span>
                          </span>
                          <Badge variant="secondary">{truckJobs.length + truckPlaceholders.length}</Badge>
                        </CardTitle>
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>Load: {totalSqm.toLocaleString()}m²</span>
                            <span>{utilizationPercent.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${utilizationPercent}%` }}></div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {truckJobs.length === 0 && truckPlaceholders.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">No jobs scheduled</p>
                        ) : (
                          <>
                            {TIME_SLOTS.map(timeSlot => {
                              const slotJobs = truckJobs.filter(item => item.timeSlot === timeSlot.id);
                              const slotPlaceholders = truckPlaceholders.filter(item => item.timeSlot === timeSlot.id);
                              
                              if (slotJobs.length === 0 && slotPlaceholders.length === 0) return null;

                              return (
                                <div key={timeSlot.id} className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-indigo-600" />
                                    <span className="text-sm font-semibold text-indigo-900">{timeSlot.label}</span>
                                  </div>
                                  {slotJobs.map(({ job }) => {
                                    const deliveryType = deliveryTypes.find(dt => dt.id === job.deliveryTypeId);
                                    const pickupLocation = pickupLocations.find(loc => loc.id === job.pickupLocationId);
                                    const pickupShortname = pickupLocation?.shortname;
                                    const cardStyles = getJobCardInlineStyles(deliveryType, job);
                                    const badgeStyles = getBadgeStyles(getJobCardStyles(deliveryType, job));
                                    const textStyles = getJobCardStyles(deliveryType, job);
                                    
                                    return (
                                      <div
                                        key={job.id}
                                        onClick={() => {
                                          setSelectedJob(job);
                                          setJobDialogOpen(true);
                                        }}
                                        className="p-3 rounded-lg border-2 active:bg-gray-100 transition-colors"
                                        style={{
                                          ...cardStyles,
                                          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                                        }}
                                      >
                                        <div className="flex justify-between items-start gap-2 mb-1">
                                          <div className="flex-1 min-w-0">
                                            {(deliveryType?.code || pickupShortname) && (
                                              <div className="mb-1 flex gap-1 flex-wrap">
                                                {deliveryType?.code && (
                                                  <span 
                                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 shadow-sm"
                                                    style={badgeStyles}
                                                  >
                                                    {textStyles.icon && <span className="text-sm">{textStyles.icon}</span>}
                                                    {deliveryType.code}
                                                  </span>
                                                )}
                                                {pickupShortname && (
                                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">
                                                    {pickupShortname}
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                            <span className="font-semibold text-sm text-gray-900 block">{job.customerName}</span>
                                          </div>
                                          <div className="flex flex-col gap-1 items-end">
                                            {job.sqm && (
                                              <Badge variant="outline" className="text-xs bg-white/90 text-gray-900">
                                                {job.sqm}m²
                                              </Badge>
                                            )}
                                            {job.isDifficultDelivery && (
                                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                                            )}
                                          </div>
                                        </div>
                                        <p className="text-sm text-gray-600">{job.deliveryLocation}</p>
                                        <p className="text-xs text-gray-500 mt-1">{job.deliveryTypeName}</p>
                                        </div>
                                        );
                                        })}
                                        {slotPlaceholders.map(({ placeholder }) => {
                                        const colorOptions = [
                                        { value: 'gray', bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
                                        { value: 'blue', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
                                        { value: 'green', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
                                        { value: 'yellow', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
                                        { value: 'purple', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
                                        { value: 'pink', bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300' }
                                        ];
                                        const colorOption = colorOptions.find(opt => opt.value === placeholder.color) || colorOptions[0];

                                        return (
                                        <div
                                        key={placeholder.id}
                                        onClick={() => handlePlaceholderClick(placeholder)}
                                        className={`p-3 rounded-lg border-2 active:bg-gray-50 transition-colors ${colorOption.bg} ${colorOption.border}`}
                                        >
                                        <div className="flex justify-between items-start gap-2">
                                         <div className="flex-1 min-w-0">
                                           <span className={`font-semibold text-sm block ${colorOption.text}`}>{placeholder.label}</span>
                                         </div>
                                        </div>
                                        </div>
                                        );
                                        })}
                                        </div>
                                        );
                                        })}
                                        </>
                                        )}
                                        </CardContent>
                                        </Card>
                                        );
                                        })}
            </div>
          )}
        </div>

        <CreateJobForm 
          open={isCreateJobOpen}
          onOpenChange={setCreateJobOpen}
          onJobCreated={fetchData}
        />

        <JobDetailsDialog
          job={selectedJob}
          open={isJobDialogOpen}
          onOpenChange={setJobDialogOpen}
          onJobUpdated={fetchData}
        />

        <CreatePlaceholderDialog
          open={createPlaceholderOpen}
          onOpenChange={setCreatePlaceholderOpen}
          truckId={placeholderSlot?.truckId}
          timeSlotId={placeholderSlot?.timeSlotId}
          slotPosition={placeholderSlot?.slotPosition}
          date={selectedDate}
          onCreated={fetchData}
        />

        <ScheduleJobDialog
          job={jobToSchedule}
          open={scheduleDialogOpen}
          onOpenChange={setScheduleDialogOpen}
          onScheduled={fetchData}
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
                  fetchData();
                }}
                onCancel={() => setPlaceholderDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
          )}
          </>
          </DndProvider>
          );
          }

  // DESKTOP VIEW
  return (
    <>
      <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
            <div className="bg-white border-b px-4 md:px-6 py-4 flex-shrink-0 z-30">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900">Delivery Scheduler</h1>
                  <p className="text-sm md:text-base text-gray-600 mt-1">Schedule and manage daily deliveries</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Notification Dropdown - Only for admins and dispatchers */}
                  {canSeeNotifications && (
                    <DropdownMenu open={notificationOpen} onOpenChange={setNotificationOpen}>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="relative"
                        >
                          <Bell 
                            className={`h-5 w-5 ${unreadNotifications.length > 0 ? 'fill-red-500 text-red-500' : ''}`}
                          />
                          {unreadNotifications.length > 0 && (
                            <Badge 
                              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs"
                            >
                              {unreadNotifications.length}
                            </Badge>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[500px] max-w-[90vw]">
                        <div className="p-3 border-b">
                          <h3 className="font-semibold text-sm">Unscheduled Jobs</h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {unreadNotifications.length} job{unreadNotifications.length !== 1 ? 's' : ''} need{unreadNotifications.length === 1 ? 's' : ''} scheduling
                          </p>
                        </div>
                        <ScrollArea className="h-[400px]">
                          {unreadNotifications.length === 0 && readNotifications.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-500">
                              All jobs are scheduled! 🎉
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              {/* Unread Section */}
                              {unreadNotifications.length > 0 && (
                                <div className="p-2">
                                  <div className="px-2 py-1 text-xs font-semibold text-gray-700 uppercase">
                                    New Unscheduled Jobs
                                  </div>
                                  {unreadNotifications.map(job => {
                                    const deliveryType = deliveryTypes.find(dt => dt.id === job.deliveryTypeId);
                                    const pickupLocation = pickupLocations.find(loc => loc.id === job.pickupLocationId);
                                    const pickupShortname = pickupLocation?.shortname;
                                    const cardStyles = getJobCardInlineStyles(deliveryType, job);
                                    const badgeStyles = getBadgeStyles(getJobCardStyles(deliveryType, job));
                                    const textStyles = getJobCardStyles(deliveryType, job);

                                    return (
                                      <button
                                        key={job.id}
                                        onClick={() => handleJobFromNotification(job)}
                                        className="w-full p-3 mb-2 text-left hover:opacity-80 rounded-lg border-2 transition-colors"
                                        style={{
                                          ...cardStyles,
                                          boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1)'
                                        }}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 min-w-0">
                                            {(deliveryType?.code || pickupShortname) && (
                                              <div className="mb-1 flex gap-1 flex-wrap">
                                                {deliveryType?.code && (
                                                  <span 
                                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 shadow-sm"
                                                    style={badgeStyles}
                                                  >
                                                    {textStyles.icon && <span className="text-sm">{textStyles.icon}</span>}
                                                    {deliveryType.code}
                                                  </span>
                                                )}
                                                {pickupShortname && (
                                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">
                                                    {pickupShortname}
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                            <p className="font-medium text-sm text-gray-900 truncate">
                                              {job.customerName}
                                            </p>
                                            <p className="text-xs text-gray-600 mt-1">
                                              {job.deliveryTypeName}
                                            </p>
                                            <p className="text-xs text-gray-600 truncate">
                                              {job.deliveryLocation}
                                            </p>
                                            <div className="flex items-center gap-1 mt-1">
                                              <Calendar className="h-3 w-3 text-gray-400" />
                                              <p className="text-xs text-gray-500">
                                                {job.requestedDate ? format(new Date(job.requestedDate), 'MMM d, yyyy') : 'N/A'}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="flex flex-col gap-1 items-end flex-shrink-0">
                                            {job.sqm && (
                                              <Badge variant="outline" className="text-xs bg-white/90 text-gray-900">
                                                {job.sqm.toLocaleString()}m²
                                              </Badge>
                                            )}
                                            {job.isDifficultDelivery && (
                                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Read Section */}
                              {readNotifications.length > 0 && (
                                <>
                                  {unreadNotifications.length > 0 && <DropdownMenuSeparator />}
                                  <div className="p-2">
                                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                                      Previously Viewed
                                    </div>
                                    {readNotifications.map(job => {
                                      const deliveryType = deliveryTypes.find(dt => dt.id === job.deliveryTypeId);
                                      const pickupLocation = pickupLocations.find(loc => loc.id === job.pickupLocationId);
                                      const pickupShortname = pickupLocation?.shortname;
                                      const cardStyles = getJobCardInlineStyles(deliveryType, job);
                                      const badgeStyles = getBadgeStyles(getJobCardStyles(deliveryType, job));
                                      const textStyles = getJobCardStyles(deliveryType, job);

                                      return (
                                        <button
                                          key={job.id}
                                          onClick={() => handleJobFromNotification(job)}
                                          className="w-full p-3 mb-2 text-left hover:bg-gray-50 rounded-lg border border-gray-200 bg-white opacity-60 transition-colors"
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                              {(deliveryType?.code || pickupShortname) && (
                                                <div className="mb-1 flex gap-1 flex-wrap">
                                                  {deliveryType?.code && (
                                                    <span 
                                                      className="px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 shadow-sm"
                                                      style={badgeStyles}
                                                    >
                                                      {textStyles.icon && <span className="text-sm">{textStyles.icon}</span>}
                                                      {deliveryType.code}
                                                    </span>
                                                  )}
                                                  {pickupShortname && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">
                                                      {pickupShortname}
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                              <p className="font-medium text-sm text-gray-900 truncate">
                                                {job.customerName}
                                              </p>
                                              <p className="text-xs text-gray-600 mt-1">
                                                {job.deliveryTypeName}
                                              </p>
                                              <p className="text-xs text-gray-600 truncate">
                                                {job.deliveryLocation}
                                              </p>
                                              <div className="flex items-center gap-1 mt-1">
                                                <Calendar className="h-3 w-3 text-gray-400" />
                                                <p className="text-xs text-gray-500">
                                                  {job.requestedDate ? format(new Date(job.requestedDate), 'MMM d, yyyy') : 'N/A'}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="flex flex-col gap-1 items-end flex-shrink-0">
                                              {job.sqm && (
                                                <Badge variant="outline" className="text-xs">
                                                  {job.sqm.toLocaleString()}m²
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </ScrollArea>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                    <Button variant="ghost" size="icon" onClick={goToPreviousDay}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2 px-3">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => {
                          setSelectedDate(e.target.value);
                          updateDateInUrl(e.target.value);
                        }}
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
                  <Button size="sm" onClick={() => setCreateJobOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Create Job</span>
                  </Button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <DndProvider backend={HTML5Backend}>
                  <SchedulerGrid
                    trucks={TRUCKS}
                    timeSlots={TIME_SLOTS}
                    jobs={jobs}
                    assignments={assignments}
                    placeholders={placeholders}
                    selectedDate={selectedDate}
                    deliveryTypes={deliveryTypes}
                    onOpenPlaceholderDialog={handleOpenPlaceholderDialog}
                    onJobClick={handleJobClick}
                    onDrop={handleDrop}
                  />
                </DndProvider>
              </div>
              )}
              </div>

      <CreateJobForm 
        open={isCreateJobOpen}
        onOpenChange={setCreateJobOpen}
        onJobCreated={fetchData}
      />

      <JobDetailsDialog
        job={selectedJob}
        open={isJobDialogOpen}
        onOpenChange={setJobDialogOpen}
        onJobUpdated={fetchData}
      />

      <CreatePlaceholderDialog
        open={createPlaceholderOpen}
        onOpenChange={setCreatePlaceholderOpen}
        truckId={placeholderSlot?.truckId}
        timeSlotId={placeholderSlot?.timeSlotId}
        slotPosition={placeholderSlot?.slotPosition}
        date={selectedDate}
        onCreated={fetchData}
      />
    </>
  );
}