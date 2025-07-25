// Crop recommendation flow
'use server';
/**
 * @fileOverview AI tool to provide crop rotation recommendations to optimize soil health.
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
  recommendedCrop: z.string().describe('The next crop recommended for planting.'),
  reasoning: z.string().describe('The reasoning behind the crop recommendation.'),
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

  Based on the current crop, recommend the next crop to plant to optimize soil health and maximize yield.

  Current Crop: {{{currentCrop}}}

  Provide a recommendation for the next crop and explain your reasoning.
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
