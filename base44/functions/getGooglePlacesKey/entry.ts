import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow dispatchers and admins to retrieve the API key
    const allowedRoles = ['admin', 'dispatcher', 'driver', 'manager'];
    if (user.role !== 'admin' && !allowedRoles.includes(user.appRole)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'Google Places API key not configured' }, { status: 500 });
    }

    return Response.json({ apiKey });
  } catch (error) {
    console.error('Error in getGooglePlacesKey:', error);
    return Response.json({ error: 'Failed to retrieve API key' }, { status: 500 });
  }
});