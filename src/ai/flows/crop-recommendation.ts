// Crop recommendation flow
'use server';
/**
 * @fileOverview AI tool to provide a 4-season crop rotation recommendation to optimize soil health.
 *
 * - cropRecommendation - A function that provides crop rotation recommendations.
 * - CropRecommendationInput - The input type for the cropRecommendation function.
 * - CropRecommendationOutput - The return type for the cropRecommendation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CropRecommendationInputSchema = z.object({
  currentCrop: z.string().describe('The currently planted crop.'),
});

export type CropRecommendationInput = z.infer<typeof CropRecommendationInputSchema>;

const CropRecommendationOutputSchema = z.object({
  recommendations: z.array(z.object({
    season: z.string().describe('The name of the season (e.g., "Next Season", "Season 2").'),
    recommendedCrop: z.string().describe('The crop recommended for planting in this season.'),
    reasoning: z.string().describe('The reasoning behind this specific crop recommendation.'),
  })).length(4).describe('An array of 4 crop rotation recommendations for the next four seasons.')
});

export type CropRecommendationOutput = z.infer<typeof CropRecommendationOutputSchema>;

export async function cropRecommendation(input: CropRecommendationInput): Promise<CropRecommendationOutput> {
  return cropRecommendationFlow(input);
}

const cropRecommendationPrompt = ai.definePrompt({
  name: 'cropRecommendationPrompt',
  input: {schema: CropRecommendationInputSchema},
  output: {schema: CropRecommendationOutputSchema},
  prompt: `You are an expert in crop rotation strategies.

  Based on the current crop, recommend a 4-season rotation plan to optimize soil health and maximize yield.
  For each season, provide the recommended crop and reasoning. The first season should be labeled "Next Season", followed by "Season 2", "Season 3", and "Season 4".

  Current Crop: {{{currentCrop}}}

  Provide a recommendation for the next 4 crops and explain your reasoning for each.
  Output should be formatted as a JSON object.
  `,
});

const cropRecommendationFlow = ai.defineFlow(
  {
    name: 'cropRecommendationFlow',
    inputSchema: CropRecommendationInputSchema,
    outputSchema: CropRecommendationOutputSchema,
  },
  async input => {
    const {output} = await cropRecommendationPrompt(input);
    return output!;
  }
);
