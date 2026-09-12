import { base44 } from '@/api/base44Client';

const CROP_ANALYSIS_PROMPT = `You are an expert image composition analyst and photo editor. Analyse this image in FOUR stages and return your assessment as structured JSON.

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
- "group_photo": Three or more people posed together.
- "document": A text-heavy document (certificate, letter, newspaper, passport).
- "landscape": A scenic or environmental shot with no people as the primary subject.

═══ STAGE 3: DETECT THE SUBJECT REGION (subject_bounds) ═══
Identify the SINGLE bounding box that encloses ALL of the image's important content — the part that MUST stay fully visible when the image is cropped to ANY aspect ratio (square thumbnail, 16:9 banner, 9:16 mobile, 4:3 card). This is the most important field: it is what stops heads and bodies from being cut off.

Rules:
- PEOPLE: the subject box MUST enclose EVERY visible person's face AND body — from the top of the highest head down to the lowest visible point of any subject (feet, or where the body meets the image edge). NEVER exclude a head. If multiple people are the subject of the photo, enclose all of them in one box.
- DOCUMENTS (certificate, letter, passport, newspaper): the subject box is the region containing the key information — name field, photo, headline, and main text block — not the blank margins.
- LANDSCAPE / no people: the subject box is the salient area (the main building, monument, vehicle, or focal object).
- Add a small padding margin (about 3-5% of the image dimension) around the content so faces/heads are not flush against the crop edge.
- The subject box MUST be INSIDE the crop_bounds (inner frame) from Stage 1.
- If the whole image is the subject (no meaningful empty space), set subject_bounds to the full frame {x_min: 0, y_min: 0, x_max: 1, y_max: 1}.

═══ STAGE 4: FOCAL POINT (tie-breaker) ═══
The single (x, y) point that is the MOST important to keep visible — used only as a centre tie-breaker when the crop window is larger than the subject region.
- People: the primary subject's eyes / bridge of nose.
- Documents: the most important text (the name on a certificate, the headline of a newspaper).
- Landscape: the visual centre of mass.
The focal point MUST be INSIDE the subject_bounds.

Return JSON with this exact structure:
{
  "focal_point_x": 0.0 to 1.0,
  "focal_point_y": 0.0 to 1.0,
  "shot_type": "closeup" | "portrait" | "mid_shot" | "long_shot" | "group_photo" | "document" | "landscape",
  "crop_bounds": { "x_min": 0.0-1.0, "y_min": 0.0-1.0, "x_max": 0.0-1.0, "y_max": 0.0-1.0 },
  "subject_bounds": { "x_min": 0.0-1.0, "y_min": 0.0-1.0, "x_max": 0.0-1.0, "y_max": 0.0-1.0 },
  "reasoning": "Brief explanation: shot type, inner frame, what the subject region covers, and why the focal point was placed there."
}`;

const clamp = (v) => Math.max(0, Math.min(1, v));
const normBox = (b, fallback) => {
  if (!b) return fallback;
  const xMin = clamp(Number(b.x_min) ?? 0);
  const yMin = clamp(Number(b.y_min) ?? 0);
  const xMax = clamp(Number(b.x_max) ?? 1);
  const yMax = clamp(Number(b.y_max) ?? 1);
  if (xMax <= xMin || yMax <= yMin) return fallback;
  return { x_min: xMin, y_min: yMin, x_max: xMax, y_max: yMax };
};
const FULL = { x_min: 0, y_min: 0, x_max: 1, y_max: 1 };

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
          properties: { x_min: { type: 'number' }, y_min: { type: 'number' }, x_max: { type: 'number' }, y_max: { type: 'number' } }
        },
        subject_bounds: {
          type: 'object',
          properties: { x_min: { type: 'number' }, y_min: { type: 'number' }, x_max: { type: 'number' }, y_max: { type: 'number' } }
        },
        reasoning: { type: 'string' }
      },
      required: ['focal_point_x', 'focal_point_y', 'shot_type', 'crop_bounds', 'subject_bounds']
    }
  });

  const focalX = clamp(Number(result.focal_point_x) || 0.5);
  const focalY = clamp(Number(result.focal_point_y) || 0.4);
  const shotType = result.shot_type || 'mid_shot';

  let cropBounds = null;
  const cb = normBox(result.crop_bounds, FULL);
  const cw = cb.x_max - cb.x_min;
  const ch = cb.y_max - cb.y_min;
  if (cw > 0 && ch > 0 && (cw < 0.95 || ch < 0.95)) {
    cropBounds = cb;
  }

  let subjectBounds = null;
  const sb = normBox(result.subject_bounds, null);
  if (sb) {
    const cxMin = cropBounds ? cropBounds.x_min : 0;
    const cyMin = cropBounds ? cropBounds.y_min : 0;
    const cxMax = cropBounds ? cropBounds.x_max : 1;
    const cyMax = cropBounds ? cropBounds.y_max : 1;
    subjectBounds = {
      x_min: Math.max(cxMin, sb.x_min),
      y_min: Math.max(cyMin, sb.y_min),
      x_max: Math.min(cxMax, sb.x_max),
      y_max: Math.min(cyMax, sb.y_max),
    };
    if (subjectBounds.x_max <= subjectBounds.x_min || subjectBounds.y_max <= subjectBounds.y_min) {
      subjectBounds = null;
    }
  }

  let finalFocalX = focalX;
  let finalFocalY = focalY;
  const ref = subjectBounds || cropBounds;
  if (ref) {
    finalFocalX = Math.max(ref.x_min, Math.min(ref.x_max, focalX));
    finalFocalY = Math.max(ref.y_min, Math.min(ref.y_max, focalY));
  }

  return {
    focal_point_x: finalFocalX,
    focal_point_y: finalFocalY,
    shot_type: shotType,
    crop_bounds: cropBounds,
    subject_bounds: subjectBounds,
    reasoning: result.reasoning || null,
  };
}