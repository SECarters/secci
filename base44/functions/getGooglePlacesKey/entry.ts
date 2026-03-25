Deno.serve((req) => {
  try {
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    
    if (!apiKey) {
      return Response.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      );
    }

    return Response.json({ apiKey });
  } catch (error) {
    console.error('Error in getGooglePlacesKey:', error);
    return Response.json(
      { error: 'Failed to retrieve API key' },
      { status: 500 }
    );
  }
});