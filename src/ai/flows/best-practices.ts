// src/ai/flows/best-practices.ts
'use server';
/**
 * @fileOverview Provides best practices for a given crop, including watering schedules and soil health notes.
 *
 * - getCropBestPractices - A function that retrieves best practices for a crop.
 * - CropBestPracticesInput - The input type for the getCropBestPractices function.
 * - CropBestPracticesOutput - The return type for the getCropBestPractices function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CropBestPracticesInputSchema = z.object({
  crop: z.string().describe('The name of the crop to get best practices for.'),
});
export type CropBestPracticesInput = z.infer<typeof CropBestPracticesInputSchema>;

const CropBestPracticesOutputSchema = z.object({
  bestPractices: z.string().describe('The best practices for the given crop, including watering schedule and soil health notes.'),
});
export type CropBestPracticesOutput = z.infer<typeof CropBestPracticesOutputSchema>;

export async function getCropBestPractices(input: CropBestPracticesInput): Promise<CropBestPracticesOutput> {
  return cropBestPracticesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'cropBestPracticesPrompt',
  input: {schema: CropBestPracticesInputSchema},
  output: {schema: CropBestPracticesOutputSchema},
  prompt: `You are an expert agricultural advisor. Provide the best practices for growing the following crop, including a watering schedule and notes about soil health. Do not use any markdown formatting.\n\nCrop: {{{crop}}}`,
});

const cropBestPracticesFlow = ai.defineFlow(
  {
    name: 'cropBestPracticesFlow',
    inputSchema: CropBestPracticesInputSchema,
    outputSchema: CropBestPracticesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
