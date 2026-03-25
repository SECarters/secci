import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Geoscape Address Lookup Function
 * 
 * Two modes:
 * 1. Autocomplete: Pass 'query' to get address suggestions from Predictive API
 * 2. Get Details: Pass 'addressId' to get full address details with coordinates
 * 
 * Uses Geoscape Predictive API (optimal for autocomplete) and falls back to
 * Addresses API Geocoder for unstructured text validation.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, addressId, stateFilter } = await req.json();
    
    const apiKey = Deno.env.get('GEOSCAPE_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'Geoscape API key not configured' }, { status: 500 });
    }

    // Mode 1: Get full address details by ID (after user selects from suggestions)
    if (addressId) {
      const url = `https://api.psma.com.au/v1/predictive/address/${encodeURIComponent(addressId)}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Geoscape address lookup error:', response.status, errorText);
        return Response.json({ error: 'Failed to fetch address details' }, { status: response.status });
      }

      const data = await response.json();
      
      if (data.address) {
        const addr = data.address;
        const props = addr.properties || {};
        const coords = addr.geometry?.coordinates || [];
        
        return Response.json({
          success: true,
          result: {
            addressId: addr.id,
            address: props.formatted_address,
            streetNumber: props.street_number_1,
            streetName: props.street_name,
            streetType: props.street_type,
            suburb: props.locality_name,
            state: props.state_territory,
            postcode: props.postcode,
            longitude: coords[0],
            latitude: coords[1],
            gnafId: addr.id,
            geoFeature: props.geo_feature,
            cadastralId: props.cadastral_identifier
          }
        });
      }
      
      return Response.json({ success: false, error: 'Address not found' });
    }

    // Mode 2: Autocomplete suggestions (as user types)
    if (query && query.length >= 3) {
      // Use Predictive API for fast autocomplete
      const params = new URLSearchParams({
        query: query,
        maxResults: '10'
      });
      
      // Optional state filter (e.g., 'QLD' or 'QLD,NSW')
      if (stateFilter) {
        params.set('stateFilter', stateFilter);
      }

      const url = `https://api.psma.com.au/v1/predictive/address?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Geoscape predictive error:', response.status, errorText);
        
        // Fallback to Addresses API Geocoder if Predictive fails
        return await fallbackGeocode(apiKey, query, stateFilter);
      }

      const data = await response.json();
      
      if (data.suggest && data.suggest.length > 0) {
        const suggestions = data.suggest.map(item => ({
          addressId: item.id,
          address: item.address,
          rank: item.rank
        }));

        return Response.json({
          success: true,
          suggestions,
          source: 'predictive'
        });
      }
      
      // No results from Predictive, try Geocoder
      return await fallbackGeocode(apiKey, query, stateFilter);
    }

    return Response.json({ error: 'Query or addressId required' }, { status: 400 });

  } catch (error) {
    console.error('Geocode error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Fallback to Addresses API Geocoder for unstructured text
 * This handles cases where Predictive API doesn't return results
 */
async function fallbackGeocode(apiKey, query, stateFilter) {
  try {
    const params = new URLSearchParams({
      address: query,
      maxResults: '5'
    });
    
    if (stateFilter) {
      params.set('stateFilter', stateFilter);
    }

    const url = `https://api.psma.com.au/v2/addresses/geocoder?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return Response.json({ success: false, suggestions: [], source: 'geocoder' });
    }

    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const suggestions = data.features.map(feature => {
        const props = feature.properties || {};
        const coords = feature.geometry?.coordinates || [];
        
        return {
          addressId: props.addressId || props.streetLocalityPid || props.localityPid,
          address: props.formattedAddress,
          streetNumber: props.streetNumber1,
          streetName: props.streetName,
          streetType: props.streetType,
          suburb: props.localityName,
          state: props.stateTerritory,
          postcode: props.postcode,
          longitude: coords[0],
          latitude: coords[1],
          matchType: feature.matchType,
          matchQuality: feature.matchQuality,
          matchScore: feature.matchScore
        };
      });

      return Response.json({
        success: true,
        suggestions,
        result: suggestions[0], // Best match
        source: 'geocoder'
      });
    }

    return Response.json({ success: false, suggestions: [], source: 'geocoder' });
    
  } catch (error) {
    console.error('Fallback geocode error:', error);
    return Response.json({ success: false, suggestions: [], error: error.message });
  }
}