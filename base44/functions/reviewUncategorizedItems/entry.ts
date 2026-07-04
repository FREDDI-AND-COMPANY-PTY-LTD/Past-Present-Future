import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const uncategorized = await base44.asServiceRole.entities.ContentItem.filter({
      content_type: 'uncategorized'
    });

    if (!uncategorized || uncategorized.length === 0) {
      return Response.json({
        status: 'success',
        message: 'No uncategorized items to review.',
        uncategorized_count: 0,
        patterns: [],
        reclassification_suggestions: [],
        emerging_categories: [],
        summary: 'There are currently no uncategorized items in the archive.'
      });
    }

    const categorized = await base44.asServiceRole.entities.ContentItem.filter({}, '-created_date', 50);

    const uncategorizedSummary = uncategorized.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      visual_elements: item.visual_elements,
      extracted_fields: item.extracted_fields,
      transcribed_text: item.transcribed_text ? item.transcribed_text.substring(0, 300) : null,
      ai_confidence: item.ai_confidence,
      categorization_notes: item.categorization_notes,
      tags: item.tags,
    }));

    const categorizedSummary = (categorized || [])
      .filter(item => item.content_type !== 'uncategorized')
      .map(item => ({
        content_type: item.content_type,
        title: item.title,
        visual_elements: item.visual_elements,
        tags: item.tags,
      }));

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an AI analyst reviewing a family history archive's "uncategorized" image collection. These are images that could not be confidently classified when uploaded — they may be posters, concert tickets, event programs, receipts, artwork, maps, mixed-content images, or any other type of visual artifact from a family's history.

Your job is to:
1. Find PATTERNS among the uncategorized items — do any share similar formats, subjects, visual elements, or themes?
2. Suggest RECLASSIFICATIONS — could any uncategorized items actually fit an existing category? (photo, narrative, correspondence, press_clipping, passport, identity_document, certificate, memorial)
3. Identify EMERGING CATEGORIES — are there clusters of similar uncategorized items that might warrant a new category type?
4. Note any items that should remain uncategorized and why

UNCATEGORIZED ITEMS:
${JSON.stringify(uncategorizedSummary, null, 2)}

EXISTING CATEGORIES IN ARCHIVE (for reference — types already in use):
${JSON.stringify(categorizedSummary, null, 2)}

Return JSON:
{
  "patterns_identified": [
    {
      "pattern_name": "short name for this pattern",
      "description": "description of the pattern",
      "item_ids": ["ids of items matching this pattern"],
      "suggested_category": "existing category if one fits, or 'new_category' if a new one might be warranted",
      "suggested_new_category_name": "if new_category, suggest a name"
    }
  ],
  "reclassification_suggestions": [
    {
      "item_id": "id",
      "current_title": "title",
      "suggested_type": "photo|narrative|correspondence|press_clipping|passport|identity_document|certificate|memorial",
      "reasoning": "why this item should be reclassified"
    }
  ],
  "emerging_categories": [
    {
      "proposed_name": "name for potential new category",
      "description": "what this category would contain",
      "item_count": 0,
      "example_item_ids": ["ids"]
    }
  ],
  "summary": "brief overall assessment of the uncategorized collection"
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          patterns_identified: { type: 'array' },
          reclassification_suggestions: { type: 'array' },
          emerging_categories: { type: 'array' },
          summary: { type: 'string' },
        },
      },
    });

    return Response.json({
      status: 'success',
      uncategorized_count: uncategorized.length,
      patterns: result.patterns_identified || [],
      reclassification_suggestions: result.reclassification_suggestions || [],
      emerging_categories: result.emerging_categories || [],
      summary: result.summary || '',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});