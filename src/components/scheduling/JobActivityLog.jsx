import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, User, Calendar, Truck, Edit, Plus, Trash } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';

export default function JobActivityLog({ jobId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivityLog = async () => {
      if (!jobId) return;

      setLoading(true);
      try {
        // Fetch job to get creation details
        const job = await base44.entities.Job.get(jobId);
        
        // Fetch all assignments for this job
        const assignments = await base44.entities.Assignment.filter({ jobId });

        const activityLog = [];

        // Add job creation event
        if (job.created_date) {
          activityLog.push({
            type: 'created',
            timestamp: job.created_date,
            user: job.created_by,
            details: 'Job created'
          });
        }

        // Add assignment events
        for (const assignment of assignments) {
          activityLog.push({
            type: 'scheduled',
            timestamp: assignment.created_date,
            user: assignment.created_by,
            details: `Scheduled on ${assignment.truckId} for ${format(new Date(assignment.date), 'MMM d, yyyy')} at ${assignment.timeSlotId.replace(/-/g, ' ')}`
          });

          // If assignment was updated
          if (assignment.updated_date && assignment.updated_date !== assignment.created_date) {
            activityLog.push({
              type: 'rescheduled',
              timestamp: assignment.updated_date,
              user: assignment.updated_by || assignment.created_by,
              details: `Rescheduled to ${assignment.truckId} for ${format(new Date(assignment.date), 'MMM d, yyyy')} at ${assignment.timeSlotId.replace(/-/g, ' ')}`
            });
          }
        }

        // Add status change events by checking updated_date
        if (job.updated_date && job.updated_date !== job.created_date) {
          activityLog.push({
            type: 'status_change',
            timestamp: job.updated_date,
            user: job.updated_by || job.created_by,
            details: `Status changed to ${job.status.replace(/_/g, ' ')}`
          });
        }

        // Add POD submission if exists
        if (job.podFiles && job.podFiles.length > 0 && job.status === 'DELIVERED') {
          activityLog.push({
            type: 'pod_submitted',
            timestamp: job.updated_date,
            user: job.updated_by || job.created_by,
            details: `Proof of delivery submitted (${job.podFiles.length} file${job.podFiles.length > 1 ? 's' : ''})`
          });
        }

        // Add return event if job was returned
        if (job.isReturned && job.returnedDate) {
          activityLog.push({
            type: 'returned',
            timestamp: job.returnedDate,
            user: job.returnedBy,
            details: `Job returned to supplier${job.returnReason ? `: ${job.returnReason}` : ''}`
          });
        }

        // Sort by timestamp descending (newest first)
        activityLog.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setActivities(activityLog);
      } catch (error) {
        console.error('Error fetching activity log:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivityLog();
  }, [jobId]);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'created':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'scheduled':
        return <Calendar className="h-4 w-4 text-blue-600" />;
      case 'rescheduled':
        return <Edit className="h-4 w-4 text-orange-600" />;
      case 'status_change':
        return <Edit className="h-4 w-4 text-purple-600" />;
      case 'pod_submitted':
        return <Truck className="h-4 w-4 text-green-600" />;
      case 'returned':
        return <Trash className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityBadgeColor = (type) => {
    switch (type) {
      case 'created':
        return 'bg-green-100 text-green-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'rescheduled':
        return 'bg-orange-100 text-orange-800';
      case 'status_change':
        return 'bg-purple-100 text-purple-800';
      case 'pod_submitted':
        return 'bg-green-100 text-green-800';
      case 'returned':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 text-center py-4">No activity recorded</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Activity Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {activities.map((activity, index) => (
              <div key={index} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                <div className="flex-shrink-0 mt-0.5">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-gray-900">{activity.details}</p>
                    <Badge className={`${getActivityBadgeColor(activity.type)} text-xs flex-shrink-0`}>
                      {activity.type.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    {activity.user && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {activity.user}
                      </span>
                    )}
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(activity.timestamp), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}