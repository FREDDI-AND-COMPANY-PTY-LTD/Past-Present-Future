import { base44 } from '@/api/base44Client';

const CROP_ANALYSIS_PROMPT = `You are an expert image composition analyst and photo editor. Analyse this image in THREE stages and return your assessment as structured JSON.

═══ STAGE 1: DETECT PHOTO-WITHIN-PHOTO / INNER FRAME ═══
Determine whether this image is a "photo within a photo" — i.e., the actual photographic content is a sub-region of the full image, surrounded by borders, margins, scanner bed, or a frame.

Common scenarios:
- A scanned photograph with white scanner borders around it
- A photograph of a framed picture hanging on a wall
- A document scan where the paper doesn't fill the frame
- A photo album page with the actual photo being one rectangle on the page
- A screenshot or scan with toolbars/borders around the content

If the content fills the entire frame (no significant borders), set crop_bounds to the full frame: {x_min: 0, y_min: 0, x_max: 1, y_max: 1}.

If there IS an inner frame, provide the bounding box of the actual content area (the photo itself, excluding borders/margins/scanner bed). Use normalized coordinates where (0,0) is top-left and (1,1) is bottom-right of the full image.

Only report an inner frame if the borders are significant (at least 5% of the dimension). Tiny edges (1-2%) should be treated as full-frame.

═══ STAGE 2: DETERMINE SHOT TYPE ═══
Classify the photographic composition:

- "closeup": A very tight shot — face fills most of the frame, or a specific detail is the entire subject. The subject occupies >70% of the frame.
- "portrait": A head-and-shoulders or head-and-torso shot. One person is the clear subject, occupying 40-70% of the frame height.
- "mid_shot": A waist-up or knee-up shot showing one or two people in context. Subjects occupy 25-50% of frame height.
- "long_shot": A wide shot showing the full scene — full-body, landscape, building, or environment. The subject/people are small relative to the frame.
- "group_photo": Three or more people posed together. The focal point should be the center of the group.
- "document": A text-heavy document (certificate, letter, newspaper, passport). The focal point should be on the most important text block (name field, headline, key data).
- "landscape": A scenic or environmental shot with no people as the primary subject. Use the visual centre of mass.

═══ STAGE 3: DETERMINE FOCAL POINT ═══
Based on the shot type and inner frame, determine the single (x, y) coordinate that should remain visible when the image is cropped to any aspect ratio (square thumbnails, wide banners, tall cards).

Focal point rules by shot type:
- closeup / portrait: On the subject's EYES or the bridge of the nose. For a single face, this is typically y = 0.15-0.30 (upper third). NEVER set y above 0.5 for portraits — faces are always in the upper portion of the frame.
- mid_shot: On the subject's face/upper chest area, typically y = 0.25-0.40.
- long_shot: On the center of the main subject or the visual center of mass.
- group_photo: On the central person's face. If people are arranged in rows, aim for the middle row's face level.
- document: On the most important text block (e.g., the name on a certificate, the headline of a newspaper). For certificates with a top-to-bottom layout, bias upward (y < 0.4).
- landscape: On the visual center of mass — where the eye is naturally drawn.

CRITICAL: The focal point coordinates must be INSIDE the crop_bounds (inner frame). If you detected an inner frame, the focal point should be relative to the FULL image, positioned within the content area.

Return JSON with this exact structure:
{
  "focal_point_x": 0.0 to 1.0,
  "focal_point_y": 0.0 to 1.0,
  "shot_type": "closeup" | "portrait" | "mid_shot" | "long_shot" | "group_photo" | "document" | "landscape",
  "crop_bounds": {
    "x_min": 0.0 to 1.0,
    "y_min": 0.0 to 1.0,
    "x_max": 0.0 to 1.0,
    "y_max": 0.0 to 1.0
  },
  "reasoning": "Brief explanation: what shot type was detected, whether an inner frame was found, and why the focal point was placed where it was."
}`;

export async function analyzeCrop(fileUrl) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: CROP_ANALYSIS_PROMPT,
    file_urls: [fileUrl],
    response_json_schema: {
      type: 'object',
      properties: {
        focal_point_x: { type: 'number', description: 'X coordinate 0-1 (0=left, 0.5=center, 1=right)' },
        focal_point_y: { type: 'number', description: 'Y coordinate 0-1 (0=top, 0.5=center, 1=bottom)' },
        shot_type: { type: 'string', enum: ['closeup', 'portrait', 'mid_shot', 'long_shot', 'group_photo', 'document', 'landscape'] },
        crop_bounds: {
          type: 'object',
          properties: {
            x_min: { type: 'number' },
            y_min: { type: 'number' },
            x_max: { type: 'number' },
            y_max: { type: 'number' }
          }
        },
        reasoning: { type: 'string' }
      },
      required: ['focal_point_x', 'focal_point_y', 'shot_type', 'crop_bounds']
    }
  });

  // Clamp values to 0-1 range
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const focalX = clamp(Number(result.focal_point_x) || 0.5);
  const focalY = clamp(Number(result.focal_point_y) || 0.4);
  const shotType = result.shot_type || 'mid_shot';

  // Process crop bounds — only store if significant inner frame detected
  let cropBounds = null;
  if (result.crop_bounds) {
    const xMin = clamp(Number(result.crop_bounds.x_min) || 0);
    const yMin = clamp(Number(result.crop_bounds.y_min) || 0);
    const xMax = clamp(Number(result.crop_bounds.x_max) || 1);
    const yMax = clamp(Number(result.crop_bounds.y_max) || 1);
    const w = xMax - xMin;
    const h = yMax - yMin;
    if (w > 0 && h > 0 && (w < 0.95 || h < 0.95)) {
      cropBounds = { x_min: xMin, y_min: yMin, x_max: xMax, y_max: yMax };
    }
  }

  // Ensure focal point is within crop bounds if they exist
  let finalFocalX = focalX;
  let finalFocalY = focalY;
  if (cropBounds) {
    finalFocalX = Math.max(cropBounds.x_min, Math.min(cropBounds.x_max, focalX));
    finalFocalY = Math.max(cropBounds.y_min, Math.min(cropBounds.y_max, focalY));
  }

  return {
    focal_point_x: finalFocalX,
    focal_point_y: finalFocalY,
    shot_type: shotType,
    crop_bounds: cropBounds,
    reasoning: result.reasoning || null,
  };
}