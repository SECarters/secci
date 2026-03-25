import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Simply use the latest image from BOM
        const radarUrl = 'http://www.bom.gov.au/radar/IDR663.T.latest.png';
        
        console.log('Fetching radar image from:', radarUrl);
        
        // Fetch the radar image
        const response = await fetch(radarUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/png,image/*,*/*'
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch radar:', response.status, response.statusText);
            return Response.json({ 
                error: `Failed to fetch radar image: ${response.status} ${response.statusText}` 
            }, { status: 500 });
        }

        // Get the image data as array buffer
        const imageData = await response.arrayBuffer();
        
        // Return the image
        return new Response(imageData, {
            status: 200,
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (error) {
        console.error('Error in getRadarImage:', error);
        return Response.json({ 
            error: error.message || 'Unknown error occurred' 
        }, { status: 500 });
    }
});