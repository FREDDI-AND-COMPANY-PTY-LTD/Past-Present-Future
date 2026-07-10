import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { content_item_id } = body;
    if (!content_item_id) return Response.json({ error: 'content_item_id is required' }, { status: 400 });

    const item = await base44.asServiceRole.entities.ContentItem.get(content_item_id);
    if (!item) return Response.json({ error: 'Content item not found' }, { status: 404 });

    // Only analyze image-type content with a file_url
    if (!item.file_url) {
      return Response.json({ skipped: true, reason: 'No file_url' });
    }
    const imageTypes = ['photo', 'uncategorized', 'certificate', 'passport', 'identity_document', 'press_clipping', 'narrative', 'correspondence', 'memorial'];
    if (!imageTypes.includes(item.content_type)) {
      return Response.json({ skipped: true, reason: `Content type ${item.content_type} is not image-based` });
    }

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an expert image composition analyst. Analyse this image and determine the OPTIMAL FOCAL POINT — the single (x, y) coordinate that should remain visible when the image is cropped to any aspect ratio (square thumbnails, wide banners, etc.).

Rules for determining the focal point:
1. If there are PEOPLE (portraits, group photos), the focal point should be on the most important person's FACE — typically the central face, or the person who appears to be the subject.
2. If there is TEXT (certificates, documents, newspaper clippings), the focal point should be on the most important text block (e.g. the name field on a certificate, the headline of a newspaper).
3. If there is a single dominant SUBJECT (a building, a landmark, an object), the focal point should be on that subject.
4. If the image is a landscape or scene with no single subject, use the visual centre of mass — where the eye is naturally drawn.
5. For documents with a clear top-to-bottom layout (certificates, letters), bias the focal point slightly upward (y < 0.5) so the header/title area stays visible when cropped.

Return the focal point as normalised coordinates where:
- x: 0.0 = far left, 0.5 = horizontal centre, 1.0 = far right
- y: 0.0 = top, 0.5 = vertical centre, 1.0 = bottom

Be precise — a single percentage point matters for tight crops. Default to (0.5, 0.4) only if the image is perfectly uniform with no discernible subject.`,
      file_urls: [item.file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          focal_point_x: { type: 'number', description: 'X coordinate 0-1 (0=left, 0.5=center, 1=right)' },
          focal_point_y: { type: 'number', description: 'Y coordinate 0-1 (0=top, 0.5=center, 1=bottom)' },
          reasoning: { type: 'string', description: 'Brief explanation of why this focal point was chosen' }
        },
        required: ['focal_point_x', 'focal_point_y']
      }
    });

    // Clamp values to 0-1 range
    const clamp = (v) => Math.max(0, Math.min(1, v));
    const focalX = clamp(Number(result.focal_point_x) || 0.5);
    const focalY = clamp(Number(result.focal_point_y) || 0.4);

    await base44.asServiceRole.entities.ContentItem.update(content_item_id, {
      focal_point_x: focalX,
      focal_point_y: focalY
    });

    return Response.json({
      content_item_id,
      focal_point_x: focalX,
      focal_point_y: focalY,
      reasoning: result.reasoning || null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});