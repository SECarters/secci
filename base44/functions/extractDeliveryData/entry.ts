import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { GoogleGenAI } from 'npm:@google/genai';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { fileUrl } = await req.json();

        if (!fileUrl) {
            return Response.json({ error: 'fileUrl is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get('GEMINI_API_KEY');
        if (!apiKey) {
            return Response.json({ 
                success: false,
                error: 'Gemini API key not configured' 
            }, { status: 500 });
        }

        // Fetch the file
        console.log('Fetching file:', fileUrl);
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) {
            console.error('File fetch failed:', fileResponse.status, fileResponse.statusText);
            return Response.json({ 
                success: false,
                error: 'Failed to fetch file' 
            }, { status: 400 });
        }

        const fileBuffer = await fileResponse.arrayBuffer();
        console.log('File size:', fileBuffer.byteLength, 'bytes');
        
        // Convert to base64
        const uint8Array = new Uint8Array(fileBuffer);
        const base64Data = btoa(Array.from(uint8Array, byte => String.fromCharCode(byte)).join(''));
        
        // Determine mime type
        const contentType = fileResponse.headers.get('content-type');
        let mimeType = contentType || 'application/pdf';
        
        const lowerUrl = fileUrl.toLowerCase();
        if (lowerUrl.includes('.png')) {
            mimeType = 'image/png';
        } else if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg')) {
            mimeType = 'image/jpeg';
        } else if (lowerUrl.includes('.pdf')) {
            mimeType = 'application/pdf';
        } else if (lowerUrl.includes('.webp')) {
            mimeType = 'image/webp';
        }
        
        // Validate file type
        const supportedTypes = [
            "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", 
            "application/pdf"
        ];
        
        if (!supportedTypes.includes(mimeType)) {
            return Response.json({
                success: false,
                error: `File format '${mimeType}' is not supported. Please upload an image or PDF.`
            }, { status: 400 });
        }
        
        console.log('Using mime type:', mimeType);

        const prompt = `Extract delivery/order information from this document. Return a JSON object with these fields (use null for fields you cannot find):

{
  "customer_name": "customer that has uploaded the docket",
  "customer_reference": "if a docket shows a customer_name that is different from their own (Bayside Plasterboard)",
  "delivery_address": "full delivery address only",
  "order_number": "PO number, sales order, docket number, or reference number",
  "supplier_name": "supplier or vendor name",
  "shipping_date": "delivery date in YYYY-MM-DD format",
  "site_contact": "site contact person name",
  "site_contact_phone": "site contact phone number",
  "total_m2": number or null,
  "total_weight": number or null (in kg),
  "total_sheets": number or null,
  "delivery_notes": "special instructions or notes",
  "line_items": [
    {
      "product_code": "product code/SKU",
      "product_description": "item description",
      "quantity": number,
      "unit": "sheets/pcs/m/etc",
      "m2": number or null,
      "weight": number or null
    }
  ]
}

Extract ALL line items. Use null for missing fields. Return ONLY valid JSON.`;

        console.log('Calling Gemini API with SDK...');
        
        const ai = new GoogleGenAI({ apiKey });

        const filePart = {
            inlineData: { data: base64Data, mimeType }
        };
        const textPart = { text: prompt };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [filePart, textPart] }],
            config: {
                responseMimeType: "application/json",
                systemInstruction: `
                    You are a robust backend data extraction service for delivery dockets, purchase orders, invoices, and work orders.
                    
                    Your objective is to extract data and return it in strict JSON format.

                    RULES:
                    1. Extract all requested fields. If a field is not found, set its value to null.
                    2. For numeric fields (total_m2, total_weight, total_sheets, quantity), return numbers without units.
                    3. Extract ALL line items visible in the document.
                    4. For dates, convert to YYYY-MM-DD format.
                    5. Do not hallucinate data - only extract what you can see.
                    6. Handle various document layouts (invoices, dockets, work orders, purchase orders).
                    7. Do not include any company names, or anything other than the full delivery address e.g. 'Lot 1044 (22) Fake Street, Brisbane City'
                    8. When processing documents uploaded by 'Bayside Plasterboard', use the customer_name field on their docket to populate the customer_reference field
                `
            },
        });

        if (!response.text) {
            console.error('Empty response from Gemini');
            return Response.json({
                success: false,
                error: 'No content returned from AI model'
            }, { status: 500 });
        }

        console.log('Gemini response received, length:', response.text.length);
        
        // Parse JSON from response
        let extractedData;
        try {
            let jsonStr = response.text.trim();
            // Handle markdown code blocks if present
            if (jsonStr.includes('```json')) {
                jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
            } else if (jsonStr.includes('```')) {
                jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
            }
            extractedData = JSON.parse(jsonStr);
        } catch (parseError) {
            console.error('Failed to parse Gemini response:', response.text.substring(0, 500));
            return Response.json({ 
                success: false,
                error: 'Failed to parse extracted data',
                rawResponse: response.text.substring(0, 500)
            }, { status: 500 });
        }

        console.log('Extraction successful');
        return Response.json({ 
            success: true, 
            data: extractedData 
        });

    } catch (error) {
        console.error('Document extraction error:', error);
        return Response.json({ 
            success: false,
            error: 'Failed to extract data from document',
            details: error.message 
        }, { status: 500 });
    }
});