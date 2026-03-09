import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const EXTERNAL_API_BASE = 'https://app.base44.com/api/apps/69284e31dfb5aba9575c1e0e/entities/DeliveryDocument';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = Deno.env.get('EXTERNAL_DOC_AI_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'External API key not configured' }, { status: 500 });
    }

    // Check content type for multipart form data (file upload)
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Handle file upload for extraction
      const formData = await req.formData();
      const file = formData.get('file');
      
      if (!file) {
        return Response.json({ error: 'No file provided' }, { status: 400 });
      }

      // Forward the file to external API as multipart/form-data
      const externalFormData = new FormData();
      externalFormData.append('file', file);
      externalFormData.append('owner_email', user.email);

      const response = await fetch(EXTERNAL_API_BASE, {
        method: 'POST',
        headers: {
          'api_key': apiKey
        },
        body: externalFormData
      });

      if (!response.ok) {
        const errorText = await response.text();
        return Response.json({ error: 'Failed to process document', details: errorText }, { status: response.status });
      }

      const data = await response.json();
      return Response.json({ success: true, document: data });
    }

    // Handle JSON requests
    const { action, entityId, updateData, filters } = await req.json();

    // Action: list - Fetch all delivery documents
    if (action === 'list') {
      let url = EXTERNAL_API_BASE;
      if (filters) {
        const params = new URLSearchParams(filters);
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        headers: {
          'api_key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return Response.json({ error: 'Failed to fetch documents', details: errorText }, { status: response.status });
      }

      const data = await response.json();
      return Response.json({ success: true, documents: data });
    }

    // Action: get - Fetch a specific document by ID
    if (action === 'get' && entityId) {
      const response = await fetch(`${EXTERNAL_API_BASE}/${entityId}`, {
        headers: {
          'api_key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return Response.json({ error: 'Failed to fetch document', details: errorText }, { status: response.status });
      }

      const data = await response.json();
      return Response.json({ success: true, document: data });
    }

    // Action: update - Update a delivery document
    if (action === 'update' && entityId && updateData) {
      const response = await fetch(`${EXTERNAL_API_BASE}/${entityId}`, {
        method: 'PUT',
        headers: {
          'api_key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return Response.json({ error: 'Failed to update document', details: errorText }, { status: response.status });
      }

      const data = await response.json();
      return Response.json({ success: true, document: data });
    }

    // Action: create - Create a new delivery document for extraction
    if (action === 'create' && updateData) {
      const response = await fetch(EXTERNAL_API_BASE, {
        method: 'POST',
        headers: {
          'api_key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...updateData,
          owner_email: user.email
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return Response.json({ error: 'Failed to create document', details: errorText }, { status: response.status });
      }

      const data = await response.json();
      return Response.json({ success: true, document: data });
    }

    return Response.json({ error: 'Invalid action. Supported: list, get, update, create, or upload file via multipart/form-data' }, { status: 400 });

  } catch (error) {
    console.error('External Doc Extract error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});