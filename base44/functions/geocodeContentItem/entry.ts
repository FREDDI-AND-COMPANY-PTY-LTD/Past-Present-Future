import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const itemId = body.item_id;
    if (!itemId) return Response.json({ error: 'item_id is required' }, { status: 400 });

    // Fetch the content item
    const item = await base44.asServiceRole.entities.ContentItem.get(itemId);
    if (!item) return Response.json({ error: 'Item not found' }, { status: 404 });

    // Build a location query from existing fields or AI analysis
    let locationQuery = item.location_name;
    if (!locationQuery && item.extracted_fields?.birth_place) {
      locationQuery = item.extracted_fields.birth_place;
    }
    if (!locationQuery && item.visual_elements?.locations_visible?.length > 0) {
      locationQuery = item.visual_elements.locations_visible[0];
    }
    // Try extracting from description using a simple pattern
    if (!locationQuery && item.description) {
      const match = item.description.match(/born\s+[\w\s,]+\d{4}\s+in\s+([^.]+)/i);
      if (match) locationQuery = match[1].trim();
    }
    if (!locationQuery && item.raw_ai_analysis) {
      const analysis = typeof item.raw_ai_analysis === 'string'
        ? JSON.parse(item.raw_ai_analysis)
        : item.raw_ai_analysis;
      if (analysis.birth_place) locationQuery = analysis.birth_place;
      else if (analysis.location) locationQuery = analysis.location;
    }

    if (!locationQuery) {
      return Response.json({ error: 'No location found to geocode in this item', item }, { status: 400 });
    }

    // Geocode using Google Maps Geocoding API
    const apiKey = Deno.env.get('APIKeyGoogleMaps');
    if (!apiKey) {
      return Response.json({ error: 'APIKeyGoogleMaps not set', location_query: locationQuery }, { status: 500 });
    }

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationQuery)}&key=${apiKey}`;
    const geocodeRes = await fetch(geocodeUrl);
    const geocodeData = await geocodeRes.json();

    if (!geocodeData.results || geocodeData.results.length === 0) {
      return Response.json({ error: 'Geocoding failed — no results', location_query: locationQuery, geocode_response: geocodeData }, { status: 400 });
    }

    const { lat, lng } = geocodeData.results[0].geometry.location;
    const formattedAddress = geocodeData.results[0].formatted_address;

    // Update the content item
    const updated = await base44.asServiceRole.entities.ContentItem.update(itemId, {
      latitude: lat,
      longitude: lng,
      location_name: locationQuery
    });

    return Response.json({
      success: true,
      location_query: locationQuery,
      geocoded_address: formattedAddress,
      latitude: lat,
      longitude: lng,
      item: {
        id: updated.id,
        title: updated.title,
        latitude: updated.latitude,
        longitude: updated.longitude,
        location_name: updated.location_name
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});