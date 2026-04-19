import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Only admin/dispatcher can trigger this — not customers
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin' && !['dispatcher', 'manager'].includes(user.appRole)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { jobId } = await req.json();

    if (!jobId) {
      return Response.json({ error: 'Missing jobId parameter' }, { status: 400 });
    }

    const job = await base44.asServiceRole.entities.Job.filter({ id: jobId });
    if (!job || job.length === 0) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    const jobData = job[0];

    const dispatchers = await base44.asServiceRole.entities.User.filter({ appRole: 'dispatcher' });
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });

    const usersToNotify = [...dispatchers, ...admins];
    const notificationsToCreate = [];

    for (const u of usersToNotify) {
      notificationsToCreate.push({
        userId: u.id,
        jobId: jobId,
        title: 'New Job Created',
        message: `New job from ${jobData.customerName} to ${jobData.deliveryLocation}`,
        type: 'new_job',
        isRead: false,
        context: {
          customerName: jobData.customerName,
          deliveryLocation: jobData.deliveryLocation,
          requestedDate: jobData.requestedDate,
          status: jobData.status
        }
      });
    }

    if (notificationsToCreate.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notificationsToCreate);
    }

    return Response.json({ 
      success: true, 
      notificationsCreated: notificationsToCreate.length 
    });

  } catch (error) {
    console.error('Error handling new job creation:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});