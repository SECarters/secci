import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify user is authenticated and is a driver
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { jobId, driverStatus, problemDetails, etaMinutes, routeDistance, latitude, longitude } = await req.json();

        // Validate required fields
        if (!jobId || !driverStatus) {
            return Response.json({ 
                error: 'Missing required fields: jobId and driverStatus' 
            }, { status: 400 });
        }

        // Get the current job
        const job = await base44.entities.Job.get(jobId);
        if (!job) {
            return Response.json({ error: 'Job not found' }, { status: 404 });
        }

        // Update job with driver status
        const updateData = {
            driverStatus,
            driverStatusUpdatedAt: new Date().toISOString(),
            driverStatusUpdatedBy: user.email
        };

        if (problemDetails) {
            updateData.problemDetails = problemDetails;
        }

        if (etaMinutes !== undefined) {
            updateData.etaMinutes = etaMinutes;
        }

        if (routeDistance !== undefined) {
            updateData.routeDistance = routeDistance;
        }

        // If driver has arrived or is unloading, mark navigation as started
        if (driverStatus === 'EN_ROUTE' || driverStatus === 'ARRIVED' || driverStatus === 'UNLOADING') {
            updateData.navigationStarted = true;
        }

        await base44.entities.Job.update(jobId, updateData);

        // Also update location if provided
        if (latitude && longitude && user.truck) {
            await base44.entities.LocationUpdate.create({
                userId: user.id,
                userName: user.full_name,
                truckId: user.truck,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                timestamp: new Date().toISOString(),
                source: 'driver',
                status: driverStatus.toLowerCase().replace('_', ' ')
            });
        }

        // Send notification to dispatch if there's a problem
        if (driverStatus === 'PROBLEM') {
            try {
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: 'dispatch@secdelivery.com.au',
                    subject: `⚠️ Problem Reported: ${job.customerName}`,
                    body: `
                        <h2>Problem Reported by Driver</h2>
                        <p><strong>Driver:</strong> ${user.full_name}</p>
                        <p><strong>Truck:</strong> ${user.truck || 'Unknown'}</p>
                        <p><strong>Customer:</strong> ${job.customerName}</p>
                        <p><strong>Location:</strong> ${job.deliveryLocation}</p>
                        <p><strong>Problem Details:</strong> ${problemDetails || 'Not specified'}</p>
                        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                    `
                });
            } catch (emailError) {
                console.error('Failed to send problem notification email:', emailError);
            }
        }

        return Response.json({ 
            success: true,
            message: 'Job status updated successfully'
        });

    } catch (error) {
        console.error('Job status update error:', error);
        return Response.json({ 
            error: 'Failed to update job status',
            details: error.message 
        }, { status: 500 });
    }
});