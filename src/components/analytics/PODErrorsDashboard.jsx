import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Upload, XCircle, RefreshCw, Database } from 'lucide-react';
import { format } from 'date-fns';

export default function PODErrorsDashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch analytics events from localStorage (Base44 analytics stores them locally)
    const fetchEvents = () => {
      try {
        const allKeys = Object.keys(localStorage);
        const analyticsKeys = allKeys.filter(key => key.startsWith('base44_analytics_'));
        
        let allEvents = [];
        analyticsKeys.forEach(key => {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            if (Array.isArray(data)) {
              allEvents = [...allEvents, ...data];
            }
          } catch (e) {
            console.error('Failed to parse analytics data:', e);
          }
        });

        // Filter for POD-related error events
        const errorEvents = allEvents.filter(event => 
          event.eventName?.includes('pod_') && 
          (event.eventName?.includes('failed') || event.eventName?.includes('error'))
        ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 50);

        setEvents(errorEvents);
      } catch (error) {
        console.error('Failed to fetch analytics events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, []);

  const getEventIcon = (eventName) => {
    if (eventName.includes('validation')) return <AlertCircle className="h-4 w-4 text-orange-600" />;
    if (eventName.includes('processing')) return <RefreshCw className="h-4 w-4 text-yellow-600" />;
    if (eventName.includes('upload')) return <Upload className="h-4 w-4 text-red-600" />;
    if (eventName.includes('job_update')) return <Database className="h-4 w-4 text-purple-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getEventLabel = (eventName) => {
    const labels = {
      pod_photo_validation_failed: 'Validation Failed',
      pod_photo_processing_failed: 'Processing Failed',
      pod_direct_upload_failed: 'Direct Upload Failed',
      pod_upload_complete_failure: 'Complete Upload Failure',
      pod_submission_failed: 'Submission Failed',
      pod_api_upload_failed: 'API Upload Failed',
      pod_api_compressed_upload_failed: 'Compressed Upload Failed',
      pod_api_job_update_failed: 'Job Update Failed'
    };
    return labels[eventName] || eventName;
  };

  const getEventColor = (eventName) => {
    if (eventName.includes('validation')) return 'bg-orange-100 text-orange-800 border-orange-300';
    if (eventName.includes('processing')) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (eventName.includes('job_update')) return 'bg-purple-100 text-purple-800 border-purple-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  // Group events by type for summary
  const eventSummary = events.reduce((acc, event) => {
    const label = getEventLabel(event.eventName);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            POD Upload Errors
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
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            POD Upload Errors
          </span>
          <Badge variant="destructive">{events.length}</Badge>
        </CardTitle>
        <p className="text-sm text-gray-500">Recent photo upload and API failures</p>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No errors recorded</p>
            <p className="text-xs mt-1">All photo uploads successful! 🎉</p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {Object.entries(eventSummary).slice(0, 4).map(([label, count]) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900">{count}</div>
                  <div className="text-xs text-gray-600 truncate">{label}</div>
                </div>
              ))}
            </div>

            {/* Event Log */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {events.map((event, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${getEventColor(event.eventName)}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getEventIcon(event.eventName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-sm">
                        {getEventLabel(event.eventName)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {event.timestamp ? format(new Date(event.timestamp), 'HH:mm:ss') : 'N/A'}
                      </span>
                    </div>
                    <div className="text-xs space-y-1">
                      {event.properties?.job_id && (
                        <div><span className="font-medium">Job:</span> {event.properties.job_id}</div>
                      )}
                      {event.properties?.error && (
                        <div className="truncate"><span className="font-medium">Error:</span> {event.properties.error}</div>
                      )}
                      {event.properties?.photo_count && (
                        <div><span className="font-medium">Photos:</span> {event.properties.photo_count}</div>
                      )}
                      {event.properties?.retry_count && (
                        <div><span className="font-medium">Retries:</span> {event.properties.retry_count}</div>
                      )}
                      {event.properties?.photo_size_kb && (
                        <div><span className="font-medium">Size:</span> {event.properties.photo_size_kb}KB</div>
                      )}
                      {event.properties?.photo_index && (
                        <div><span className="font-medium">Photo #:</span> {event.properties.photo_index}</div>
                      )}
                      {event.properties?.error_count && (
                        <div><span className="font-medium">Error Count:</span> {event.properties.error_count}</div>
                      )}
                      {event.properties?.total_size_mb && (
                        <div><span className="font-medium">Total Size:</span> {event.properties.total_size_mb}MB</div>
                      )}
                      {event.properties?.is_online !== undefined && (
                        <div><span className="font-medium">Online:</span> {event.properties.is_online ? 'Yes' : 'No'}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}