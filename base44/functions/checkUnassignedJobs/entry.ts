import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SHARED_SECRET = Deno.env.get('AUTOMATION_SECRET');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Support two calling contexts:
    // 1. Scheduled automation (no user) — verified by shared secret header
    // 2. Manual call by admin/dispatcher — verified by user auth
    let authorized = false;

    const secretHeader = req.headers.get('x-automation-secret');
    if (SHARED_SECRET && secretHeader === SHARED_SECRET) {
      authorized = true;
    } else {
      try {
        const user = await base44.auth.me();
        if (user && (user.role === 'admin' || user.appRole === 'dispatcher')) {
          authorized = true;
        }
      } catch (_) {
        // no user context — falls through to unauthorized
      }
    }

    if (!authorized) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const HOURS_THRESHOLD = 24;
    const thresholdDate = new Date();
    thresholdDate.setHours(thresholdDate.getHours() - HOURS_THRESHOLD);

    const allJobs = await base44.asServiceRole.entities.Job.filter({
      status: { $in: ['APPROVED', 'PENDING_APPROVAL'] }
    });

    const allAssignments = await base44.asServiceRole.entities.Assignment.list();
    const assignedJobIds = new Set(allAssignments.map(a => a.jobId));

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

    const dispatchers = await base44.asServiceRole.entities.User.filter({ appRole: 'dispatcher' });
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const usersToNotify = [...dispatchers, ...admins];

    // Existing unread notifications — deduplicate per jobId + userId
    const existingNotifications = await base44.asServiceRole.entities.Notification.filter({
      type: 'unassigned_job_alert',
      isRead: false
    });
    const existingKeys = new Set(existingNotifications.map(n => `${n.jobId}:${n.userId}`));

    const notificationsToCreate = [];

    for (const job of staleUnassignedJobs) {
      const hoursOld = Math.floor(
        (new Date() - new Date(job.created_date)) / (1000 * 60 * 60)
      );

      for (const u of usersToNotify) {
        const key = `${job.id}:${u.id}`;
        if (!existingKeys.has(key)) {
          notificationsToCreate.push({
            userId: u.id,
            jobId: job.id,
            title: '⚠️ Unassigned Job Alert',
            message: `Job for ${job.customerName} at ${job.deliveryLocation} has been unassigned for ${hoursOld} hours`,
            type: 'unassigned_job_alert',
            isRead: false,
            context: {
              customerName: job.customerName,
              deliveryLocation: job.deliveryLocation,
              requestedDate: job.requestedDate,
              hoursOld
            }
          });
        }
      }
    }

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
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});