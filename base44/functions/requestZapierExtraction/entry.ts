import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// This function has been deprecated. Document extraction now uses
// base44.integrations.Core.ExtractDataFromUploadedFile via the extractDeliveryData function.
Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return Response.json({ error: 'This endpoint has been deprecated. Use extractDeliveryData instead.' }, { status: 410 });
});