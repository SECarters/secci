import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function RecentActivityTile() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      setLoading(true);
      try {
        // Fetch recent activity logs (last 20)
        const logs = await base44.entities.JobActivityLog.list('-created_date', 20);
        setActivities(logs);
      } catch (error) {
        console.error('Failed to fetch activity logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  const getActivityIcon = (type) => {
    const icons = {
      created: '➕',
      updated: '✏️',
      status_changed: '🔄',
      scheduled: '📅',
      deleted: '🗑️',
      returned: '↩️',
      delivered: '✅',
      approved: '✔️',
      cancelled: '❌'
    };
    return icons[type] || '📋';
  };

  const getActivityColor = (type) => {
    const colors = {
      created: 'bg-blue-100 text-blue-800',
      updated: 'bg-purple-100 text-purple-800',
      status_changed: 'bg-amber-100 text-amber-800',
      scheduled: 'bg-indigo-100 text-indigo-800',
      deleted: 'bg-red-100 text-red-800',
      returned: 'bg-gray-100 text-gray-800',
      delivered: 'bg-green-100 text-green-800',
      approved: 'bg-teal-100 text-teal-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {activities.map((activity, index) => (
              <div 
                key={activity.id} 
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="text-2xl flex-shrink-0 mt-0.5">
                  {getActivityIcon(activity.activityType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">
                        {activity.description}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {activity.customerName}
                      </p>
                    </div>
                    <Badge className={`${getActivityColor(activity.activityType)} text-xs flex-shrink-0`}>
                      {activity.activityType.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                    <Clock className="h-3 w-3" />
                    <span>{formatDistanceToNow(new Date(activity.created_date), { addSuffix: true })}</span>
                    <span>•</span>
                    <span>{activity.userName}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}