import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DISPATCH_EMAIL = Deno.env.get('DISPATCH_EMAIL') || 'dispatch@secdelivery.com.au';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (user.role !== 'admin' && user.appRole !== 'driver') {
            return Response.json({ error: 'Forbidden: Only drivers can update job status' }, { status: 403 });
        }

        const { jobId, driverStatus, problemDetails, etaMinutes, routeDistance, latitude, longitude } = await req.json();

        if (!jobId || !driverStatus) {
            return Response.json({ 
                error: 'Missing required fields: jobId and driverStatus' 
            }, { status: 400 });
        }

        const job = await base44.entities.Job.get(jobId);
        if (!job) {
            return Response.json({ error: 'Job not found' }, { status: 404 });
        }

        // Verify driver owns this job (job must be assigned to driver's truck)
        if (user.role !== 'admin' && user.truck) {
            const assignments = await base44.entities.Assignment.filter({ jobId });
            const hasAssignment = assignments.some(a => a.truckId === user.truck);
            if (!hasAssignment) {
                return Response.json({ error: 'Forbidden: Job not assigned to your truck' }, { status: 403 });
            }
        }

        const updateData = {
            driverStatus,
            driverStatusUpdatedAt: new Date().toISOString(),
            driverStatusUpdatedBy: user.email
        };

        if (problemDetails) updateData.problemDetails = problemDetails;
        if (etaMinutes !== undefined) updateData.etaMinutes = etaMinutes;
        if (routeDistance !== undefined) updateData.routeDistance = routeDistance;

        if (driverStatus === 'EN_ROUTE' || driverStatus === 'ARRIVED' || driverStatus === 'UNLOADING') {
            updateData.navigationStarted = true;
        }

        await base44.entities.Job.update(jobId, updateData);

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

        if (driverStatus === 'PROBLEM') {
            try {
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: DISPATCH_EMAIL,
                    subject: `Problem Reported: ${job.customerName}`,
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
        return Response.json({ error: 'Failed to update job status' }, { status: 500 });
    }
});