import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Define the threshold (in hours) for a job to be considered "old"
    const HOURS_THRESHOLD = 24;
    const thresholdDate = new Date();
    thresholdDate.setHours(thresholdDate.getHours() - HOURS_THRESHOLD);

    // Get all jobs that are APPROVED or PENDING_APPROVAL
    const allJobs = await base44.asServiceRole.entities.Job.filter({
      status: { $in: ['APPROVED', 'PENDING_APPROVAL'] }
    });

    // Get all assignments
    const allAssignments = await base44.asServiceRole.entities.Assignment.list();
    const assignedJobIds = new Set(allAssignments.map(a => a.jobId));

    // Filter for unassigned jobs older than threshold
    const staleUnassignedJobs = allJobs.filter(job => {
      const isUnassigned = !assignedJobIds.has(job.id);
      const isOld = new Date(job.created_date) < thresholdDate;
      return isUnassigned && isOld;
    });

    if (staleUnassignedJobs.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No stale unassigned jobs found',
        notificationsCreated: 0
      });
    }

    // Get all dispatchers
    const dispatchers = await base44.asServiceRole.entities.User.filter({
      appRole: 'dispatcher'
    });

    // Also notify admin users
    const admins = await base44.asServiceRole.entities.User.filter({
      role: 'admin'
    });

    const usersToNotify = [...dispatchers, ...admins];
    const notificationsToCreate = [];

    // Create notifications for each stale job
    for (const job of staleUnassignedJobs) {
      const hoursOld = Math.floor(
        (new Date() - new Date(job.created_date)) / (1000 * 60 * 60)
      );

      for (const user of usersToNotify) {
        notificationsToCreate.push({
          userId: user.id,
          jobId: job.id,
          title: '⚠️ Unassigned Job Alert',
          message: `Job for ${job.customerName} at ${job.deliveryLocation} has been unassigned for ${hoursOld} hours`,
          type: 'unassigned_job_alert',
          isRead: false,
          context: {
            customerName: job.customerName,
            deliveryLocation: job.deliveryLocation,
            requestedDate: job.requestedDate,
            hoursOld: hoursOld
          }
        });
      }
    }

    // Create all notifications
    if (notificationsToCreate.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notificationsToCreate);
    }

    return Response.json({ 
      success: true, 
      staleJobsFound: staleUnassignedJobs.length,
      notificationsCreated: notificationsToCreate.length 
    });

  } catch (error) {
    console.error('Error checking unassigned jobs:', error);
    return Response.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
});