import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { jobId, oldStatus, newStatus } = await req.json();

    if (!jobId || !newStatus) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Fetch the job details
    const job = await base44.asServiceRole.entities.Job.filter({ id: jobId });
    if (!job || job.length === 0) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    const jobData = job[0];

    // Get all dispatchers
    const dispatchers = await base44.asServiceRole.entities.User.filter({
      appRole: 'dispatcher'
    });

    // Notify dispatchers of status change
    const notificationsToCreate = [];

    for (const dispatcher of dispatchers) {
      notificationsToCreate.push({
        userId: dispatcher.id,
        jobId: jobId,
        title: `Job Status Updated`,
        message: `Job for ${jobData.customerName} at ${jobData.deliveryLocation} is now ${newStatus.replace(/_/g, ' ')}`,
        type: 'job_status_update',
        isRead: false,
        context: {
          oldStatus: oldStatus,
          newStatus: newStatus,
          customerName: jobData.customerName,
          deliveryLocation: jobData.deliveryLocation
        }
      });
    }

    // If status is DELIVERED or CANCELLED, notify the customer
    if (newStatus === 'DELIVERED' || newStatus === 'CANCELLED') {
      // Get customer users
      const customerUsers = await base44.asServiceRole.entities.User.filter({
        customerId: jobData.customerId
      });

      for (const customerUser of customerUsers) {
        notificationsToCreate.push({
          userId: customerUser.id,
          jobId: jobId,
          title: newStatus === 'DELIVERED' ? 'Delivery Completed' : 'Job Cancelled',
          message: `Your delivery to ${jobData.deliveryLocation} has been ${newStatus.toLowerCase()}`,
          type: 'job_status_update',
          isRead: false,
          context: {
            oldStatus: oldStatus,
            newStatus: newStatus,
            customerName: jobData.customerName,
            deliveryLocation: jobData.deliveryLocation
          }
        });
      }

      // Send email notification to customer
      if (jobData.customerId) {
        const customer = await base44.asServiceRole.entities.Customer.filter({ 
          id: jobData.customerId 
        });
        
        if (customer && customer.length > 0 && customer[0].contactEmail) {
          const emailSubject = newStatus === 'DELIVERED' 
            ? `Delivery Completed - ${jobData.customerName}`
            : `Job Cancelled - ${jobData.customerName}`;
          
          const emailBody = newStatus === 'DELIVERED'
            ? `Your delivery to ${jobData.deliveryLocation} has been successfully completed.\n\nJob Details:\n- Customer: ${jobData.customerName}\n- Location: ${jobData.deliveryLocation}\n- Delivery Type: ${jobData.deliveryTypeName}\n\nThank you for your business!`
            : `Your delivery to ${jobData.deliveryLocation} has been cancelled.\n\nJob Details:\n- Customer: ${jobData.customerName}\n- Location: ${jobData.deliveryLocation}\n- Delivery Type: ${jobData.deliveryTypeName}\n\nPlease contact us if you have any questions.`;

          try {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: customer[0].contactEmail,
              subject: emailSubject,
              body: emailBody
            });
          } catch (emailError) {
            console.error('Failed to send email:', emailError);
          }
        }
      }
    }

    // Create all notifications
    if (notificationsToCreate.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notificationsToCreate);
    }

    return Response.json({ 
      success: true, 
      notificationsCreated: notificationsToCreate.length 
    });

  } catch (error) {
    console.error('Error handling job status change:', error);
    return Response.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
});