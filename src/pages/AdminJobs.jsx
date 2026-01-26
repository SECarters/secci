import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import JobDetailsDialog from '../components/scheduling/JobDetailsDialog';
import AdvancedJobFilters from '../components/jobs/AdvancedJobFilters';
import { base44 } from '@/api/base44Client';

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [deliveryTypes, setDeliveryTypes] = useState([]); // State to store delivery types
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    deliveryType: 'all',
    dateFrom: null,
    dateTo: null,
    truck: 'all',
    sortBy: 'requestedDate',
    sortOrder: 'desc'
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);

        const isCustomer = user.role !== 'admin' && user.appRole !== 'dispatcher';
        const isOutreach = user.appRole === 'outreach';

        const [allJobs, allAssignments, fetchedCustomers, fetchedDeliveryTypes] = await Promise.all([
          base44.entities.Job.list(),
          base44.entities.Assignment.list(),
          base44.entities.Customer.list(),
          base44.entities.DeliveryType.list()
        ]);

        let finalJobs = [...allJobs];

        if (isCustomer && (user.customerId || user.additionalCustomerIds?.length > 0)) {
          const allowedCustomerIds = [
            user.customerId,
            ...(user.additionalCustomerIds || [])
          ].filter(Boolean);

          finalJobs = finalJobs.filter(job => allowedCustomerIds.includes(job.customerId));
        }

        if (isOutreach) {
          const manitouCodes = ['UPDWN', 'UNITUP', 'MANS'];
          const manitouTypeIds = fetchedDeliveryTypes
            .filter(dt => manitouCodes.includes(dt.code))
            .map(dt => dt.id);
          
          finalJobs = finalJobs.filter(job => manitouTypeIds.includes(job.deliveryTypeId));
        }

        finalJobs.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());

        setJobs(finalJobs);
        setFilteredJobs(finalJobs);
        setAssignments(allAssignments);
        setCustomers(fetchedCustomers);
        setDeliveryTypes(fetchedDeliveryTypes);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    let result = [...jobs];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(job => {
        const assignment = assignments.find(a => a.jobId === job.id);
        const searchableFields = [
          job.id,
          job.customerName,
          job.deliveryLocation,
          job.deliverySuburb,
          job.deliveryStreetNumber,
          job.deliveryStreetName,
          job.deliveryTypeName,
          job.pickupLocation,
          job.siteContactName,
          job.siteContactPhone,
          job.poSalesDocketNumber,
          job.orderNumber,
          job.deliveryNotes,
          job.status,
          assignment?.truckId || '',
          assignment?.timeSlotId || ''
        ].filter(Boolean).join(' ').toLowerCase();
        
        return searchableFields.includes(query);
      });
    }

    // Status filter
    if (filters.status !== 'all') {
      result = result.filter(job => job.status === filters.status);
    }

    // Delivery type filter
    if (filters.deliveryType !== 'all') {
      result = result.filter(job => job.deliveryTypeId === filters.deliveryType);
    }

    // Date range filter
    if (filters.dateFrom) {
      result = result.filter(job => job.requestedDate >= filters.dateFrom);
    }
    if (filters.dateTo) {
      result = result.filter(job => job.requestedDate <= filters.dateTo);
    }

    // Truck filter
    if (filters.truck !== 'all') {
      if (filters.truck === 'UNASSIGNED') {
        result = result.filter(job => !assignments.find(a => a.jobId === job.id));
      } else {
        result = result.filter(job => {
          const assignment = assignments.find(a => a.jobId === job.id);
          return assignment?.truckId === filters.truck;
        });
      }
    }

    // Sorting
    result = result.sort((a, b) => {
      let compareA, compareB;

      switch (filters.sortBy) {
        case 'customerName':
          compareA = a.customerName || '';
          compareB = b.customerName || '';
          break;
        case 'deliveryLocation':
          compareA = a.deliverySuburb || a.deliveryLocation || '';
          compareB = b.deliverySuburb || b.deliveryLocation || '';
          break;
        case 'requestedDate':
          compareA = new Date(a.requestedDate).getTime();
          compareB = new Date(b.requestedDate).getTime();
          break;
        case 'status':
          compareA = a.status || '';
          compareB = b.status || '';
          break;
        case 'created_date':
        default:
          compareA = new Date(a.created_date).getTime();
          compareB = new Date(b.created_date).getTime();
      }

      if (typeof compareA === 'string') {
        return filters.sortOrder === 'asc' ? compareA.localeCompare(compareB) : compareB.localeCompare(compareA);
      } else {
        return filters.sortOrder === 'asc' ? compareA - compareB : compareB - compareA;
      }
    });

    setFilteredJobs(result);
  }, [searchQuery, filters, jobs, assignments]);



  const getAssignmentForJob = (jobId) => {
    return assignments.find(a => a.jobId === jobId);
  };

  const getTruckForJob = (jobId) => {
    const assignment = assignments.find(a => a.jobId === jobId);
    return assignment?.truckId || null;
  };

  const getTimeSlotLabel = (timeSlotId) => {
    const timeSlots = {
      'first-am': 'First AM (6-9am)',
      'second-am': 'Second AM (9am-12pm)',
      'lunch': 'Lunch (12-3pm)',
      'afternoon': 'Afternoon (3-6pm)',
      'early-morning': 'Early AM (5-8am)',
      'morning-1': 'Morning 1 (8am-10:30am)',
      'morning-2': 'Morning 2 (10:30am-12:30pm)',
      'afternoon-1': 'Afternoon 1 (12:30pm-2pm)',
      'afternoon-2': 'Afternoon 2 (2pm-3:30pm)'
    };
    return timeSlots[timeSlotId] || timeSlotId;
  };

  const getStatusColor = (status) => {
    const colors = {
      PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      SCHEDULED: 'bg-indigo-100 text-indigo-800',
      IN_TRANSIT: 'bg-purple-100 text-purple-800',
      DELIVERED: 'bg-green-100 text-green-800',
      RETURNED: 'bg-black text-white',
      CANCELLED: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <div className="text-center p-8">Loading jobs...</div>;
  }

  const isCustomer = currentUser && currentUser.role !== 'admin' && currentUser.appRole !== 'dispatcher';
  const pageTitle = isCustomer ? 'My Jobs' : 'All Jobs';
  const pageDescription = isCustomer 
    ? 'View all your delivery requests and their current status' 
    : 'A complete history of all delivery jobs';

  // Helper function to get colors and icon for delivery type
  const getDeliveryTypeStyles = (deliveryType, isDifficult) => {
    let bgColor = '';
    let pillBgClass = 'bg-blue-100';
    let pillTextClass = 'text-blue-700';
    let icon = '';

    if (isDifficult) {
      bgColor = 'bg-[#F1AC88]';
      pillBgClass = 'bg-[#FF7A86]';
      pillTextClass = 'text-white';
      icon = '⚠️';
    } else if (deliveryType?.code === 'HAND') {
      bgColor = 'bg-[#BBE9E0]'; // Updated bgColor
      pillBgClass = 'bg-[#ACD6F6]';
      pillTextClass = 'text-gray-900';
      icon = '✋';
    } else if (deliveryType?.code === 'MANS') {
      bgColor = 'bg-[#F8B2AF]';
      pillBgClass = 'bg-[#ED5461]';
      pillTextClass = 'text-white';
      icon = '🔼';
    } else if (deliveryType?.code === 'UNITUP') {
      bgColor = 'bg-[#B2D7FF]';
      pillBgClass = 'bg-[#47A0FF]';
      pillTextClass = 'text-white';
      icon = '⬆️';
    } else if (deliveryType?.code === 'UPDWN') {
      bgColor = 'bg-[#FFDBF3]';
      pillBgClass = 'bg-[#FF8EDC]';
      pillTextClass = 'text-white';
      icon = '↕️';
    } else if (deliveryType?.code === 'UNITDWN') {
      bgColor = 'bg-[#EEDBFF]';
      pillBgClass = 'bg-[#CA8EFF]';
      pillTextClass = 'text-white';
      icon = '⬇️';
    } else if (deliveryType?.code === 'LATE') {
      bgColor = 'bg-[#E2E8F0]';
      pillBgClass = 'bg-[#EFE9E0]';
      pillTextClass = 'text-gray-900';
      icon = '🌛';
    } else if (deliveryType?.code === 'BOAT') {
      bgColor = 'bg-[#BBD3F0]';
      pillBgClass = 'bg-[#F0D8BB]';
      pillTextClass = 'text-gray-900';
      icon = '⛵';
    }

    return { bgColor, pillBgClass, pillTextClass, icon };
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{pageTitle}</h1>
          <p className="text-gray-600 mt-1">{pageDescription}</p>
        </div>

        {/* Advanced Filters */}
        <AdvancedJobFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filters={filters}
          onFiltersChange={setFilters}
          deliveryTypes={deliveryTypes}
          currentUser={currentUser}
        />

        {filteredJobs.length > 0 && (
          <div className="text-sm text-gray-600">
            Showing <span className="font-semibold">{filteredJobs.length}</span> {filteredJobs.length === 1 ? 'job' : 'jobs'}
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {!isCustomer && <TableHead>Customer</TableHead>}
                  <TableHead>Delivery Location</TableHead>
                  <TableHead>Requested Date</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead>Delivery Window</TableHead>
                  <TableHead>Assigned Truck</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isCustomer ? 6 : 7} className="text-center py-8 text-gray-500">
                      {hasActiveFilters ? 'No jobs found matching your search criteria' : 'No jobs found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredJobs.map(job => {
                    const assignedTruck = getTruckForJob(job.id);
                    const assignment = getAssignmentForJob(job.id);
                    const deliveryType = deliveryTypes.find(dt => dt.id === job.deliveryTypeId);
                    const styles = getDeliveryTypeStyles(deliveryType, job.isDifficultDelivery);

                    return (
                      <TableRow 
                        key={job.id}
                        className={`cursor-pointer ${styles.bgColor ? styles.bgColor : ''} hover:opacity-80 transition-opacity`}
                        onClick={() => {
                          setSelectedJob(job);
                          setDialogOpen(true);
                        }}
                      >
                        {!isCustomer && <TableCell>{job.customerName}</TableCell>}
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {deliveryType?.code && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${styles.pillBgClass} ${styles.pillTextClass} flex items-center gap-0.5`}>
                                  {styles.icon && <span>{styles.icon}</span>}
                                  {deliveryType.code}
                                </span>
                              )}
                              {job.isDifficultDelivery && (
                                <Badge className="bg-orange-500 text-white text-xs border-orange-600">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Difficult Delivery
                                </Badge>
                              )}
                            </div>
                            <div>{job.deliveryLocation}</div>
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(job.requestedDate), 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          {assignment ? (
                            <div>
                              <div className="font-medium text-gray-900">
                                {format(new Date(assignment.date), 'dd MMM yyyy')}
                              </div>
                              <div className="text-xs text-indigo-600">
                                {getTimeSlotLabel(assignment.timeSlotId)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">Not scheduled</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {job.deliveryWindow ? (
                            <span className="text-sm text-gray-600">{job.deliveryWindow}</span>
                          ) : (
                            <span className="text-sm text-gray-400">Not specified</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {assignedTruck ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {assignedTruck}
                            </Badge>
                          ) : (
                            <span className="text-sm text-gray-400">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(job.status)}>{job.status.replace(/_/g, ' ')}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <JobDetailsDialog
        job={selectedJob}
        open={isDialogOpen}
        onOpenChange={setDialogOpen}
        onJobUpdated={() => {
          setDialogOpen(false);
          window.location.reload(); 
        }}
      />
    </>
  );
}