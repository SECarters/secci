import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify user is authenticated and is a driver
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { latitude, longitude, accuracy, speed, heading } = await req.json();

        // Validate required fields
        if (!latitude || !longitude) {
            return Response.json({ 
                error: 'Missing required fields: latitude and longitude' 
            }, { status: 400 });
        }

        // Create location update
        const locationUpdate = await base44.entities.LocationUpdate.create({
            userId: user.id,
            userName: user.full_name,
            truckId: user.truck || 'UNASSIGNED',
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            accuracy: accuracy ? parseFloat(accuracy) : undefined,
            speed: speed ? parseFloat(speed) : undefined,
            heading: heading ? parseFloat(heading) : undefined,
            timestamp: new Date().toISOString(),
            source: 'driver',
            status: 'active'
        });

        return Response.json({ 
            success: true, 
            locationUpdate 
        });

    } catch (error) {
        console.error('Location update error:', error);
        return Response.json({ 
            error: 'Failed to update location',
            details: error.message 
        }, { status: 500 });
    }
});